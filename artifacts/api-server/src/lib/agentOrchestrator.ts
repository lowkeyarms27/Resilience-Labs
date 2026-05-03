import { db } from "@workspace/db";
import { gridNodesTable, agentLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

export type AgentLogEntry = {
  id: string;
  timestamp: string;
  agent: "sentinel" | "engineer" | "system";
  level: "info" | "warning" | "critical" | "action" | "success";
  message: string;
  nodeId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type SSEClient = {
  id: string;
  res: import("express").Response;
};

const sseClients: SSEClient[] = [];

export function registerSSEClient(
  id: string,
  res: import("express").Response
) {
  sseClients.push({ id, res });
}

export function removeSSEClient(id: string) {
  const idx = sseClients.findIndex((c) => c.id === id);
  if (idx !== -1) sseClients.splice(idx, 1);
}

function broadcastLog(entry: AgentLogEntry) {
  const data = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(data);
    } catch {
      // ignore write errors for disconnected clients
    }
  }
}

export async function persistLog(entry: AgentLogEntry) {
  await db.insert(agentLogsTable).values({
    id: entry.id,
    timestamp: new Date(entry.timestamp),
    agent: entry.agent,
    level: entry.level,
    message: entry.message,
    nodeId: entry.nodeId ?? null,
    metadata: entry.metadata ?? null,
  });
  broadcastLog(entry);
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export async function runSentinelScan(): Promise<{
  nodesScanned: number;
  issuesFound: number;
  actionsTriggered: number;
  summary: string;
}> {
  const nodes = await db.select().from(gridNodesTable);
  const problemNodes = nodes.filter(
    (n) => n.status === "failing" || n.status === "degraded" || n.status === "offline"
  );

  await persistLog({
    id: makeId(),
    timestamp: nowIso(),
    agent: "sentinel",
    level: "info",
    message: `Initiating grid scan. Monitoring ${nodes.length} nodes across the infrastructure mesh.`,
  });

  if (problemNodes.length === 0) {
    await persistLog({
      id: makeId(),
      timestamp: nowIso(),
      agent: "sentinel",
      level: "success",
      message: "Grid scan complete. All systems nominal. No anomalies detected.",
    });
    return {
      nodesScanned: nodes.length,
      issuesFound: 0,
      actionsTriggered: 0,
      summary: "All systems nominal",
    };
  }

  const gridContext = problemNodes
    .map(
      (n) =>
        `Node ${n.name} (${n.id}): status=${n.status}, latency=${n.latency}ms, errorRate=${(n.errorRate * 100).toFixed(1)}%, uptime=${n.uptime.toFixed(1)}%`
    )
    .join("\n");

  let sentinelAssessment = "";
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are SENTINEL, an AI infrastructure monitoring agent. Analyze the grid state and provide a terse, technical assessment in 2-3 sentences. Use technical language. Be specific about node IDs and metrics. No markdown.",
        },
        {
          role: "user",
          content: `Current grid anomalies:\n${gridContext}\n\nProvide your monitoring assessment.`,
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) sentinelAssessment += content;
    }
  } catch (err) {
    logger.error({ err }, "Sentinel LLM error");
    sentinelAssessment = `Detected ${problemNodes.length} anomalous node(s): ${problemNodes.map((n) => n.name).join(", ")}. Severity classification in progress.`;
  }

  const highSeverity = problemNodes.filter(
    (n) => n.status === "failing" || n.status === "offline"
  );

  for (const node of problemNodes) {
    const level =
      node.status === "failing" || node.status === "offline"
        ? "critical"
        : "warning";
    await persistLog({
      id: makeId(),
      timestamp: nowIso(),
      agent: "sentinel",
      level,
      message: `${node.name}: ${node.status.toUpperCase()} — latency ${node.latency}ms, error rate ${(node.errorRate * 100).toFixed(1)}%. Flagging for Engineer dispatch.`,
      nodeId: node.id,
      metadata: {
        latency: node.latency,
        errorRate: node.errorRate,
        uptime: node.uptime,
      },
    });
  }

  await persistLog({
    id: makeId(),
    timestamp: nowIso(),
    agent: "sentinel",
    level: highSeverity.length > 0 ? "critical" : "warning",
    message: sentinelAssessment.trim(),
  });

  let actionsTriggered = 0;
  if (highSeverity.length > 0) {
    actionsTriggered = await runEngineerRepairs(highSeverity);
  }

  return {
    nodesScanned: nodes.length,
    issuesFound: problemNodes.length,
    actionsTriggered,
    summary: sentinelAssessment.trim(),
  };
}

async function runEngineerRepairs(
  nodes: typeof gridNodesTable.$inferSelect[]
): Promise<number> {
  await persistLog({
    id: makeId(),
    timestamp: nowIso(),
    agent: "engineer",
    level: "action",
    message: `Sentinel alert acknowledged. Received ${nodes.length} critical incident(s). Initiating repair protocol.`,
  });

  let count = 0;
  for (const node of nodes) {
    await repairNode(node.id);
    count++;
  }
  return count;
}

export async function repairNode(nodeId: string): Promise<void> {
  const [node] = await db
    .select()
    .from(gridNodesTable)
    .where(eq(gridNodesTable.id, nodeId))
    .limit(1);

  if (!node) return;

  await persistLog({
    id: makeId(),
    timestamp: nowIso(),
    agent: "engineer",
    level: "action",
    message: `Dispatching repair unit to ${node.name}. Setting status to REPAIRING. Isolating fault domain.`,
    nodeId,
  });

  await db
    .update(gridNodesTable)
    .set({ status: "repairing", assignedAgent: "engineer", lastUpdated: new Date() })
    .where(eq(gridNodesTable.id, nodeId));

  let engineerPlan = "";
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "You are ENGINEER, an AI infrastructure repair agent. Describe the repair action you're taking in 1-2 sentences. Be specific and technical. Use active voice. Reference the node name. No markdown.",
        },
        {
          role: "user",
          content: `Repairing node ${node.name}: status was ${node.status}, latency=${node.latency}ms, errorRate=${(node.errorRate * 100).toFixed(1)}%. Describe the repair action.`,
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) engineerPlan += content;
    }
  } catch (err) {
    logger.error({ err }, "Engineer LLM error");
    engineerPlan = `Re-routing traffic away from ${node.name}. Applying patch and restarting service mesh.`;
  }

  await persistLog({
    id: makeId(),
    timestamp: nowIso(),
    agent: "engineer",
    level: "action",
    message: engineerPlan.trim(),
    nodeId,
  });

  // Simulate repair time then restore
  setTimeout(async () => {
    await db
      .update(gridNodesTable)
      .set({
        status: "healthy",
        latency: 10 + Math.random() * 30,
        errorRate: Math.random() * 0.01,
        uptime: 99 + Math.random(),
        assignedAgent: null,
        lastUpdated: new Date(),
      })
      .where(eq(gridNodesTable.id, nodeId));

    await persistLog({
      id: makeId(),
      timestamp: nowIso(),
      agent: "engineer",
      level: "success",
      message: `${node.name} repair complete. Service restored. Health metrics nominal. Returning to standby.`,
      nodeId,
    });
  }, 5000 + Math.random() * 5000);
}

export async function injectShock(
  severity: string,
  targetNodeIds?: string[]
): Promise<{ affectedNodes: string[]; severity: string; message: string }> {
  const nodes = await db.select().from(gridNodesTable);
  let targets: typeof nodes;

  if (targetNodeIds && targetNodeIds.length > 0) {
    targets = nodes.filter((n) => targetNodeIds.includes(n.id));
  } else {
    const count =
      severity === "catastrophic"
        ? Math.max(3, Math.floor(nodes.length * 0.4))
        : severity === "high"
          ? Math.max(2, Math.floor(nodes.length * 0.25))
          : severity === "medium"
            ? Math.max(1, Math.floor(nodes.length * 0.15))
            : 1;
    targets = [...nodes].sort(() => Math.random() - 0.5).slice(0, count);
  }

  const affectedIds: string[] = [];
  for (const node of targets) {
    const newStatus =
      severity === "catastrophic" || severity === "high" ? "failing" : "degraded";
    await db
      .update(gridNodesTable)
      .set({
        status: newStatus,
        latency: 200 + Math.random() * 800,
        errorRate: 0.3 + Math.random() * 0.6,
        uptime: 50 + Math.random() * 30,
        lastUpdated: new Date(),
      })
      .where(eq(gridNodesTable.id, node.id));
    affectedIds.push(node.id);
  }

  const targetNames = targets.map((n) => n.name).join(", ");

  await persistLog({
    id: makeId(),
    timestamp: nowIso(),
    agent: "system",
    level: "critical",
    message: `⚡ SYSTEM SHOCK INJECTED [${severity.toUpperCase()}] — ${targets.length} node(s) affected: ${targetNames}`,
    metadata: { severity, affectedNodes: affectedIds },
  });

  // Trigger sentinel scan after a brief delay
  setTimeout(async () => {
    await runSentinelScan();
  }, 800);

  return {
    affectedNodes: affectedIds,
    severity,
    message: `System shock injected. ${targets.length} node(s) affected: ${targetNames}`,
  };
}
