import { db } from "@workspace/db";
import { gridNodesTable, agentLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";
import { approvalQueue, type ApprovalRequest } from "./approvalQueue";

export type AgentLogEntry = {
  id: string;
  timestamp: string;
  agent: "sentinel" | "coordinator" | "diagnostician" | "remediator" | "validator" | "engineer" | "system";
  level: "info" | "warning" | "critical" | "action" | "success" | "report";
  message: string;
  nodeId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type SSEClient = { id: string; res: import("express").Response };
const sseClients: SSEClient[] = [];

export function registerSSEClient(id: string, res: import("express").Response) {
  sseClients.push({ id, res });
  const pending = approvalQueue.list();
  if (pending.length > 0) {
    try {
      res.write(`event: approval-list\ndata: ${JSON.stringify({ approvals: pending })}\n\n`);
    } catch { /* disconnected */ }
  }
}

export function removeSSEClient(id: string) {
  const idx = sseClients.findIndex((c) => c.id === id);
  if (idx !== -1) sseClients.splice(idx, 1);
}

function sendToClients(data: string) {
  for (const client of sseClients) {
    try { client.res.write(data); } catch { /* disconnected */ }
  }
}

function broadcastLog(entry: AgentLogEntry) {
  sendToClients(`data: ${JSON.stringify(entry)}\n\n`);
}

export function broadcastThinking(agent: string, partial: string) {
  sendToClients(`event: thinking\ndata: ${JSON.stringify({ agent, partial })}\n\n`);
}

export function broadcastThinkingDone(agent: string) {
  sendToClients(`event: thinking-done\ndata: ${JSON.stringify({ agent })}\n\n`);
}

function broadcastApprovalRequest(req: ApprovalRequest) {
  sendToClients(`event: approval-request\ndata: ${JSON.stringify(req)}\n\n`);
}

function broadcastApprovalResolved(id: string, approved: boolean) {
  sendToClients(`event: approval-resolved\ndata: ${JSON.stringify({ id, approved })}\n\n`);
}

approvalQueue.on("added", (req: ApprovalRequest) => broadcastApprovalRequest(req));
approvalQueue.on("updated", (id: string) => {
  sendToClients(`event: approval-list\ndata: ${JSON.stringify({ approvals: approvalQueue.list() })}\n\n`);
});

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

function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function nowIso() { return new Date().toISOString(); }

// Infrastructure command templates per node type
const NODE_TYPE_MAP: Record<string, string> = {
  "node-01": "CORE", "node-02": "CORE", "node-03": "EDGE", "node-04": "HUB",
  "node-05": "NODE", "node-06": "RELAY", "node-07": "GATEWAY", "node-08": "BRIDGE",
  "node-09": "MESH", "node-10": "VAULT", "node-11": "CACHE", "node-12": "SHIELD",
  "node-13": "FIREWALL", "node-14": "CLUSTER", "node-15": "LINK", "node-16": "SENTINEL_NODE",
};

function getInfraCommands(nodeId: string, nodeName: string): string[] {
  const type = NODE_TYPE_MAP[nodeId] ?? "NODE";
  const n = nodeName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  switch (type) {
    case "CORE":
      return [
        `kubectl rollout restart deployment/${n} -n production`,
        `kubectl rollout status deployment/${n} -n production --timeout=90s`,
        `kubectl top pod -l app=${n} -n production`,
      ];
    case "EDGE":
      return [
        `kubectl scale deployment/${n} --replicas=0 -n ingress`,
        `sleep 3 && kubectl scale deployment/${n} --replicas=3 -n ingress`,
        `curl -sf --retry 3 https://${n}.edge.internal/healthz`,
      ];
    case "HUB":
      return [
        `kubectl patch deployment ${n} -n production -p '{"spec":{"template":{"metadata":{"annotations":{"restart":"'$(date +%s)'"}}}}}'`,
        `kubectl rollout status deployment/${n} -n production`,
        `aws elb describe-instance-health --load-balancer-name ${n}`,
      ];
    case "RELAY":
      return [
        `haproxy -sf $(cat /var/run/haproxy/${n}.pid) -f /etc/haproxy/${n}.cfg`,
        `systemctl restart haproxy@${n}`,
        `curl -sf http://localhost:9000/stats | grep ${n}`,
      ];
    case "GATEWAY":
      return [
        `kubectl rollout restart deployment/${n} -n api-gateway`,
        `kubectl get pods -l app=${n} -n api-gateway --watch --timeout=60s`,
        `aws apigateway flush-stage-cache --rest-api-id $(cat /etc/gateway/${n}.id) --stage-name prod`,
      ];
    case "BRIDGE":
      return [
        `kubectl patch svc ${n} -n networking -p '{"spec":{"sessionAffinity":"None"}}'`,
        `kubectl rollout restart deployment/${n} -n networking`,
        `ping -c 4 ${n}.bridge.internal && traceroute ${n}.bridge.internal`,
      ];
    case "MESH":
      return [
        `istioctl proxy-status | grep ${n}`,
        `kubectl rollout restart daemonset/istio-proxy -n istio-system`,
        `kubectl delete pods -l app=${n} -n service-mesh --grace-period=30`,
      ];
    case "VAULT":
      return [
        `vault operator unseal -address=https://${n}.vault.svc:8200`,
        `vault write sys/seal-status -address=https://${n}.vault.svc:8200`,
        `kubectl rollout restart statefulset/${n} -n vault`,
      ];
    case "CACHE":
      return [
        `redis-cli -h ${n}.cache.svc PING`,
        `redis-cli -h ${n}.cache.svc CONFIG RESETSTAT`,
        `kubectl rollout restart deployment/${n} -n cache`,
      ];
    case "SHIELD":
      return [
        `kubectl rollout restart daemonset/${n} -n security`,
        `aws wafv2 update-web-acl --name ${n}-acl --scope REGIONAL`,
        `systemctl restart crowdsec@${n}`,
      ];
    case "FIREWALL":
      return [
        `iptables -F FORWARD && iptables -P FORWARD ACCEPT`,
        `systemctl restart firewalld`,
        `nft flush ruleset && nft -f /etc/nftables/${n}.conf`,
      ];
    case "CLUSTER":
      return [
        `kubectl drain ${n} --ignore-daemonsets --delete-emptydir-data --timeout=120s`,
        `kubectl cordon ${n}`,
        `sleep 5 && kubectl uncordon ${n}`,
      ];
    case "LINK":
      return [
        `ip route flush table main && ip route add default via $(cat /etc/routing/${n}.gw)`,
        `bgpctl reload`,
        `aws route53 change-resource-record-sets --hosted-zone-id $(cat /etc/r53/${n}.id) --change-batch file:///etc/r53/${n}-failover.json`,
      ];
    case "SENTINEL_NODE":
      return [
        `kubectl rollout restart deployment/prometheus -n monitoring`,
        `kubectl rollout restart deployment/alertmanager -n monitoring`,
        `systemctl restart node-exporter && systemctl restart vector`,
      ];
    default:
      return [
        `kubectl rollout restart deployment/${n} -n production`,
        `kubectl rollout status deployment/${n} -n production`,
      ];
  }
}

function classifyPriority(failingCount: number, offlineCount: number, degradedCount: number): "P1" | "P2" | "P3" {
  if (offlineCount > 0 || failingCount >= 4) return "P1";
  if (failingCount >= 1) return "P2";
  return "P3";
}

interface DiagnosisResult {
  rootCause: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  recommendedAction: string;
}

async function runDiagnostician(node: typeof gridNodesTable.$inferSelect): Promise<DiagnosisResult> {
  const prompt = `Node ${node.name} (${node.id}) is ${node.status.toUpperCase()}.
Metrics: latency=${node.latency.toFixed(0)}ms, errorRate=${(node.errorRate * 100).toFixed(1)}%, uptime=${node.uptime.toFixed(2)}%, cpu=${node.cpu.toFixed(0)}%, memory=${node.memory.toFixed(0)}%.
Node type: ${NODE_TYPE_MAP[node.id] ?? "NODE"}

Provide a concise root-cause analysis (2-3 sentences), then end with exactly this JSON block:
\`\`\`json
{"rootCause":"...","confidence":85,"riskLevel":"medium","recommendedAction":"..."}
\`\`\`
riskLevel must be "low", "medium", or "high". confidence is 0-100.`;

  let fullText = "";
  try {
    broadcastThinking("diagnostician", "");
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 280,
      messages: [
        { role: "system", content: "You are DIAGNOSTICIAN, an AI root-cause analysis agent for critical infrastructure. Be precise, technical, and concise. Always end with the requested JSON block." },
        { role: "user", content: prompt },
      ],
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullText += content;
        broadcastThinking("diagnostician", fullText);
      }
    }
    broadcastThinkingDone("diagnostician");
  } catch (err) {
    broadcastThinkingDone("diagnostician");
    logger.error({ err }, "Diagnostician LLM error");
  }

  // Parse JSON from response
  const jsonMatch = fullText.match(/```json\s*([\s\S]+?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as DiagnosisResult;
    } catch { /* fall through */ }
  }

  return {
    rootCause: `${node.name} exhibiting ${node.status} state. Metrics exceed baseline thresholds. Auto-recovery initiated.`,
    confidence: 70,
    riskLevel: node.status === "offline" ? "high" : "medium",
    recommendedAction: `Restart ${NODE_TYPE_MAP[node.id] ?? "service"} workload and restore traffic routing.`,
  };
}

async function runRemediator(node: typeof gridNodesTable.$inferSelect, diagnosis: DiagnosisResult): Promise<void> {
  const infraCommands = getInfraCommands(node.id, node.name);

  await persistLog({
    id: makeId(), timestamp: nowIso(), agent: "remediator", level: "action",
    message: `Executing repair on ${node.name}. Action: ${diagnosis.recommendedAction}`,
    nodeId: node.id,
    metadata: { infraCommands, confidence: diagnosis.confidence },
  });

  // Show each command being "executed"
  for (const cmd of infraCommands) {
    await persistLog({
      id: makeId(), timestamp: nowIso(), agent: "remediator", level: "action",
      message: `$ ${cmd}`,
      nodeId: node.id,
      metadata: { type: "infra-command" },
    });
    await new Promise((r) => setTimeout(r, 600));
  }

  await db.update(gridNodesTable).set({
    status: "repairing",
    assignedAgent: "remediator",
    lastUpdated: new Date(),
  }).where(eq(gridNodesTable.id, node.id));

  // Repair completes after a delay
  const delay = 6000 + Math.random() * 6000;
  setTimeout(async () => {
    const newLatency = 10 + Math.random() * 30;
    const newErrorRate = Math.random() * 0.005;
    const newUptime = 99.5 + Math.random() * 0.5;
    const newCpu = 15 + Math.random() * 25;
    const newMemory = 30 + Math.random() * 25;

    await db.update(gridNodesTable).set({
      status: "healthy",
      latency: newLatency,
      errorRate: newErrorRate,
      uptime: newUptime,
      cpu: newCpu,
      memory: newMemory,
      assignedAgent: null,
      lastUpdated: new Date(),
    }).where(eq(gridNodesTable.id, node.id));

    await runValidator(node, { latency: newLatency, errorRate: newErrorRate, uptime: newUptime, cpu: newCpu, memory: newMemory });
  }, delay);
}

async function runValidator(
  node: typeof gridNodesTable.$inferSelect,
  postMetrics: { latency: number; errorRate: number; uptime: number; cpu: number; memory: number }
): Promise<void> {
  const pass = postMetrics.latency < 100 && postMetrics.errorRate < 0.02 && postMetrics.uptime > 99;
  const confidence = pass ? 92 + Math.floor(Math.random() * 7) : 45 + Math.floor(Math.random() * 20);

  let validatorMsg = "";
  try {
    broadcastThinking("validator", "");
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 120,
      messages: [
        { role: "system", content: "You are VALIDATOR, an AI repair verification agent. Confirm whether repair metrics are acceptable in 1-2 sentences. Be concise. No markdown." },
        { role: "user", content: `${node.name} post-repair metrics: latency=${postMetrics.latency.toFixed(0)}ms, errorRate=${(postMetrics.errorRate * 100).toFixed(2)}%, uptime=${postMetrics.uptime.toFixed(2)}%, cpu=${postMetrics.cpu.toFixed(0)}%, memory=${postMetrics.memory.toFixed(0)}%. Confirm fix.` },
      ],
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        validatorMsg += content;
        broadcastThinking("validator", validatorMsg);
      }
    }
    broadcastThinkingDone("validator");
  } catch (err) {
    broadcastThinkingDone("validator");
    logger.error({ err }, "Validator LLM error");
    validatorMsg = `${node.name} repair ${pass ? "verified" : "inconclusive"}. Metrics ${pass ? "within" : "outside"} baseline thresholds.`;
  }

  await persistLog({
    id: makeId(), timestamp: nowIso(), agent: "validator", level: pass ? "success" : "warning",
    message: `[${pass ? "PASS" : "WARN"}] ${validatorMsg.trim()} (confidence: ${confidence}%)`,
    nodeId: node.id,
    metadata: { pass, confidence, postMetrics },
  });

  // Check if all nodes are healthy — if so, generate post-incident report
  if (pass) {
    const allNodes = await db.select().from(gridNodesTable);
    const stillBroken = allNodes.filter((n) => n.status === "failing" || n.status === "offline" || n.status === "degraded");
    if (stillBroken.length === 0) {
      setTimeout(() => generatePostIncidentReport(allNodes), 2000);
    }
  }
}

async function generatePostIncidentReport(nodes: typeof gridNodesTable.$inferSelect[]): Promise<void> {
  const summary = nodes.slice(0, 4).map((n) =>
    `${n.name}: latency=${n.latency.toFixed(0)}ms, cpu=${n.cpu.toFixed(0)}%, mem=${n.memory.toFixed(0)}%`
  ).join("; ");

  let report = "";
  try {
    broadcastThinking("coordinator", "");
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 350,
      messages: [
        { role: "system", content: "You are COORDINATOR generating a post-incident report. Write a structured report with: INCIDENT SUMMARY, ROOT CAUSE, IMPACT ASSESSMENT, REMEDIATION STEPS TAKEN, RECOMMENDATIONS. Use plain text, no markdown. Be concise but technical." },
        { role: "user", content: `All nodes have been restored. Post-repair state: ${summary}. Generate a post-incident report.` },
      ],
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        report += content;
        broadcastThinking("coordinator", report);
      }
    }
    broadcastThinkingDone("coordinator");
  } catch (err) {
    broadcastThinkingDone("coordinator");
    logger.error({ err }, "Coordinator post-incident LLM error");
    report = "POST-INCIDENT REPORT\nAll nodes restored to healthy state. Autonomous pipeline executed successfully. No further action required.";
  }

  await persistLog({
    id: makeId(), timestamp: nowIso(), agent: "coordinator", level: "report",
    message: `POST-INCIDENT REPORT\n${report.trim()}`,
    metadata: { type: "post-incident-report" },
  });
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
    id: makeId(), timestamp: nowIso(), agent: "sentinel", level: "info",
    message: `Initiating grid scan. Monitoring ${nodes.length} nodes across the infrastructure mesh.`,
  });

  if (problemNodes.length === 0) {
    await persistLog({
      id: makeId(), timestamp: nowIso(), agent: "sentinel", level: "success",
      message: "Grid scan complete. All systems nominal. No anomalies detected.",
    });
    return { nodesScanned: nodes.length, issuesFound: 0, actionsTriggered: 0, summary: "All systems nominal" };
  }

  // SENTINEL assessment
  const gridContext = problemNodes
    .map((n) => `${n.name}(${n.id}): status=${n.status}, cpu=${n.cpu.toFixed(0)}%, mem=${n.memory.toFixed(0)}%, latency=${n.latency.toFixed(0)}ms, errRate=${(n.errorRate * 100).toFixed(1)}%`)
    .join("\n");

  let sentinelAssessment = "";
  try {
    broadcastThinking("sentinel", "");
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 180,
      messages: [
        { role: "system", content: "You are SENTINEL, an AI infrastructure monitoring agent. Provide a terse technical threat assessment in 2 sentences. Reference specific node IDs and metrics. No markdown." },
        { role: "user", content: `Anomalies detected:\n${gridContext}\n\nProvide threat assessment.` },
      ],
      stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        sentinelAssessment += content;
        broadcastThinking("sentinel", sentinelAssessment);
      }
    }
    broadcastThinkingDone("sentinel");
  } catch (err) {
    broadcastThinkingDone("sentinel");
    sentinelAssessment = `Detected ${problemNodes.length} anomalous nodes: ${problemNodes.map((n) => n.name).join(", ")}.`;
  }

  await persistLog({
    id: makeId(), timestamp: nowIso(), agent: "sentinel",
    level: problemNodes.some((n) => n.status === "failing" || n.status === "offline") ? "critical" : "warning",
    message: sentinelAssessment.trim(),
  });

  // COORDINATOR classifies and routes
  const failingCount = problemNodes.filter((n) => n.status === "failing").length;
  const offlineCount = problemNodes.filter((n) => n.status === "offline").length;
  const degradedCount = problemNodes.filter((n) => n.status === "degraded").length;
  const priority = classifyPriority(failingCount, offlineCount, degradedCount);

  const priorityColor = priority === "P1" ? "🔴" : priority === "P2" ? "🟠" : "🟡";
  await persistLog({
    id: makeId(), timestamp: nowIso(), agent: "coordinator", level: "critical",
    message: `${priorityColor} INCIDENT ${priority} DECLARED — ${failingCount} failing, ${offlineCount} offline, ${degradedCount} degraded. Routing to DIAGNOSTICIAN pipeline. Incident response activated.`,
    metadata: { priority, failingCount, offlineCount, degradedCount },
  });

  // Filter to only nodes that need repair (failing/offline), run full pipeline
  const criticalNodes = problemNodes.filter((n) => n.status === "failing" || n.status === "offline");
  let actionsTriggered = 0;

  for (const node of criticalNodes) {
    // DIAGNOSTICIAN analyzes
    await persistLog({
      id: makeId(), timestamp: nowIso(), agent: "diagnostician", level: "action",
      message: `Initiating root-cause analysis on ${node.name}. Examining telemetry: cpu=${node.cpu.toFixed(0)}%, mem=${node.memory.toFixed(0)}%, latency=${node.latency.toFixed(0)}ms, err=${(node.errorRate * 100).toFixed(1)}%.`,
      nodeId: node.id,
    });

    const diagnosis = await runDiagnostician(node);

    await persistLog({
      id: makeId(), timestamp: nowIso(), agent: "diagnostician", level: diagnosis.riskLevel === "high" ? "critical" : "warning",
      message: `DIAGNOSIS [${node.name}] — ${diagnosis.rootCause} Confidence: ${diagnosis.confidence}%. Risk: ${diagnosis.riskLevel.toUpperCase()}. Action: ${diagnosis.recommendedAction}`,
      nodeId: node.id,
      metadata: { confidence: diagnosis.confidence, riskLevel: diagnosis.riskLevel },
    });

    const autoApprovable = diagnosis.confidence >= 75 && diagnosis.riskLevel !== "high";

    if (autoApprovable) {
      await persistLog({
        id: makeId(), timestamp: nowIso(), agent: "coordinator", level: "action",
        message: `AUTO-APPROVED: ${node.name} repair. Confidence ${diagnosis.confidence}% meets threshold (≥75%). Risk level ${diagnosis.riskLevel.toUpperCase()} acceptable. Dispatching REMEDIATOR.`,
        nodeId: node.id,
      });
      runRemediator(node, diagnosis);
      actionsTriggered++;
    } else {
      // Queue for human approval
      const reqId = makeId();
      const infraCommands = getInfraCommands(node.id, node.name);

      await persistLog({
        id: makeId(), timestamp: nowIso(), agent: "coordinator", level: "warning",
        message: `HUMAN APPROVAL REQUIRED: ${node.name} — Confidence ${diagnosis.confidence}% ${diagnosis.confidence < 75 ? "below 75% threshold" : ""} ${diagnosis.riskLevel === "high" ? "| Risk: HIGH" : ""}. Queued for operator sign-off.`,
        nodeId: node.id,
        metadata: { reqId, requiresApproval: true },
      });

      const req: ApprovalRequest = {
        id: reqId,
        nodeId: node.id,
        nodeName: node.name,
        action: diagnosis.recommendedAction,
        infraCommands,
        justification: diagnosis.rootCause,
        confidence: diagnosis.confidence,
        riskLevel: diagnosis.riskLevel,
        requestedBy: "diagnostician",
        timestamp: nowIso(),
      };

      // Don't await — runs in background waiting for human
      approvalQueue.add(req).then(async (approved) => {
        const freshNode = await db.select().from(gridNodesTable).where(eq(gridNodesTable.id, node.id)).limit(1);
        broadcastApprovalResolved(reqId, approved);
        if (approved && freshNode[0]) {
          await persistLog({
            id: makeId(), timestamp: nowIso(), agent: "coordinator", level: "action",
            message: `Operator approved repair for ${node.name}. Dispatching REMEDIATOR.`,
            nodeId: node.id,
          });
          runRemediator(freshNode[0], diagnosis);
        } else {
          await persistLog({
            id: makeId(), timestamp: nowIso(), agent: "coordinator", level: "warning",
            message: `${approved ? "Operator approved" : "Operator REJECTED"} repair for ${node.name}. ${!approved ? "Node remains in current state pending manual intervention." : ""}`,
            nodeId: node.id,
          });
        }
      });
    }
  }

  return { nodesScanned: nodes.length, issuesFound: problemNodes.length, actionsTriggered, summary: sentinelAssessment.trim() };
}

export async function repairNode(nodeId: string): Promise<void> {
  const [node] = await db.select().from(gridNodesTable).where(eq(gridNodesTable.id, nodeId)).limit(1);
  if (!node) return;

  const diagnosis: DiagnosisResult = {
    rootCause: `Manual repair initiated by operator for ${node.name}.`,
    confidence: 95,
    riskLevel: "low",
    recommendedAction: `Manual restart and recovery for ${node.name}.`,
  };

  await persistLog({
    id: makeId(), timestamp: nowIso(), agent: "coordinator", level: "action",
    message: `Manual repair request received for ${node.name}. Bypassing approval pipeline. Dispatching REMEDIATOR directly.`,
    nodeId,
  });

  runRemediator(node, diagnosis);
}

export async function injectShock(severity: string, targetNodeIds?: string[]): Promise<{ affectedNodes: string[]; severity: string; message: string }> {
  const nodes = await db.select().from(gridNodesTable);
  let targets: typeof nodes;

  if (targetNodeIds && targetNodeIds.length > 0) {
    targets = nodes.filter((n) => targetNodeIds.includes(n.id));
  } else {
    const count =
      severity === "catastrophic" ? Math.max(3, Math.floor(nodes.length * 0.4)) :
      severity === "high"         ? Math.max(2, Math.floor(nodes.length * 0.25)) :
      severity === "medium"       ? Math.max(1, Math.floor(nodes.length * 0.15)) : 1;
    targets = [...nodes].sort(() => Math.random() - 0.5).slice(0, count);
  }

  const affectedIds: string[] = [];
  for (const node of targets) {
    const newStatus = severity === "catastrophic" || severity === "high" ? "failing" : "degraded";
    await db.update(gridNodesTable).set({
      status: newStatus,
      latency: 200 + Math.random() * 800,
      errorRate: 0.3 + Math.random() * 0.6,
      uptime: 50 + Math.random() * 30,
      cpu: 85 + Math.random() * 14,
      memory: 88 + Math.random() * 11,
      lastUpdated: new Date(),
    }).where(eq(gridNodesTable.id, node.id));
    affectedIds.push(node.id);
  }

  const targetNames = targets.map((n) => n.name).join(", ");
  await persistLog({
    id: makeId(), timestamp: nowIso(), agent: "system", level: "critical",
    message: `⚡ SYSTEM SHOCK INJECTED [${severity.toUpperCase()}] — ${targets.length} node(s) affected: ${targetNames}`,
    metadata: { severity, affectedNodes: affectedIds },
  });

  setTimeout(async () => { await runSentinelScan(); }, 800);

  return { affectedNodes: affectedIds, severity, message: `System shock injected. ${targets.length} node(s) affected: ${targetNames}` };
}

export async function chatWithAgent(
  message: string,
  agentRole: "sentinel" | "engineer" | "analyst",
  onToken: (token: string) => void
): Promise<string> {
  const nodes = await db.select().from(gridNodesTable);
  const gridSummary = nodes.map((n) =>
    `${n.name}(${n.id}): ${n.status}, cpu=${n.cpu.toFixed(0)}%, mem=${n.memory.toFixed(0)}%, ${n.latency.toFixed(0)}ms, err=${(n.errorRate*100).toFixed(1)}%`
  ).join(" | ");

  const systemPrompts: Record<string, string> = {
    sentinel: "You are SENTINEL, an elite AI cybersecurity monitoring agent watching a city grid of 16 infrastructure nodes. You are analytical, precise, and speak in terse technical language. Current grid: " + gridSummary,
    engineer: "You are ENGINEER, an AI autonomous repair agent for a critical city infrastructure grid. You are pragmatic, action-oriented, and describe repairs in technical terms. Current grid: " + gridSummary,
    analyst: "You are ANALYST, an AI strategic advisor for the Resilience Lab. You provide high-level insights about infrastructure resilience, risk patterns, and recommendations. Current grid: " + gridSummary,
  };

  let fullResponse = "";
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 400,
    messages: [
      { role: "system", content: systemPrompts[agentRole] },
      { role: "user", content: message },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      onToken(content);
    }
  }

  return fullResponse;
}
