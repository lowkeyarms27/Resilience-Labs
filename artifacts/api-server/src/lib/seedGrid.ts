import { db } from "@workspace/db";
import { gridNodesTable, agentLogsTable } from "@workspace/db";
import { logger } from "./logger";

const INITIAL_NODES = [
  { id: "node-01", name: "Alpha-Prime", latency: 12, errorRate: 0.001, uptime: 99.98 },
  { id: "node-02", name: "Beta-Core", latency: 18, errorRate: 0.002, uptime: 99.95 },
  { id: "node-03", name: "Gamma-Edge", latency: 22, errorRate: 0.001, uptime: 99.97 },
  { id: "node-04", name: "Delta-Hub", latency: 15, errorRate: 0.003, uptime: 99.92 },
  { id: "node-05", name: "Epsilon-Node", latency: 20, errorRate: 0.002, uptime: 99.94 },
  { id: "node-06", name: "Zeta-Relay", latency: 25, errorRate: 0.001, uptime: 99.99 },
  { id: "node-07", name: "Eta-Gateway", latency: 16, errorRate: 0.002, uptime: 99.96 },
  { id: "node-08", name: "Theta-Bridge", latency: 19, errorRate: 0.001, uptime: 99.97 },
  { id: "node-09", name: "Iota-Mesh", latency: 23, errorRate: 0.003, uptime: 99.91 },
  { id: "node-10", name: "Kappa-Vault", latency: 14, errorRate: 0.001, uptime: 99.99 },
  { id: "node-11", name: "Lambda-Cache", latency: 21, errorRate: 0.002, uptime: 99.95 },
  { id: "node-12", name: "Mu-Shield", latency: 17, errorRate: 0.001, uptime: 99.98 },
  { id: "node-13", name: "Nu-Firewall", latency: 24, errorRate: 0.002, uptime: 99.93 },
  { id: "node-14", name: "Xi-Cluster", latency: 13, errorRate: 0.001, uptime: 99.99 },
  { id: "node-15", name: "Omicron-Link", latency: 20, errorRate: 0.003, uptime: 99.90 },
  { id: "node-16", name: "Pi-Sentinel", latency: 18, errorRate: 0.001, uptime: 99.97 },
];

const INITIAL_LOGS = [
  {
    id: "log-boot-1",
    agent: "system" as const,
    level: "info" as const,
    message: "Resilience Lab initialized. Grid infrastructure online. 16 nodes active.",
  },
  {
    id: "log-boot-2",
    agent: "sentinel" as const,
    level: "success" as const,
    message: "SENTINEL online. Monitoring grid integrity. All nodes reporting nominal status.",
  },
  {
    id: "log-boot-3",
    agent: "engineer" as const,
    level: "info" as const,
    message: "ENGINEER standing by. Ready to respond to Sentinel alerts. Repair tools loaded.",
  },
];

export async function seedGrid() {
  const existing = await db.select().from(gridNodesTable).limit(1);
  if (existing.length > 0) {
    logger.info("Grid already seeded, skipping.");
    return;
  }

  logger.info("Seeding grid nodes...");
  await db.insert(gridNodesTable).values(
    INITIAL_NODES.map((n) => ({
      id: n.id,
      name: n.name,
      status: "healthy" as const,
      latency: n.latency,
      errorRate: n.errorRate,
      uptime: n.uptime,
      assignedAgent: null,
      lastUpdated: new Date(),
    }))
  );

  logger.info("Seeding initial agent logs...");
  await db.insert(agentLogsTable).values(
    INITIAL_LOGS.map((l) => ({
      id: l.id,
      timestamp: new Date(),
      agent: l.agent,
      level: l.level,
      message: l.message,
      nodeId: null,
      metadata: null,
    }))
  );

  logger.info("Grid seeded successfully.");
}
