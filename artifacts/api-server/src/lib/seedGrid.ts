import { db } from "@workspace/db";
import { gridNodesTable, agentLogsTable } from "@workspace/db";
import { logger } from "./logger";

const INITIAL_NODES = [
  { id: "node-01", name: "Alpha-Prime",   latency: 12, errorRate: 0.001, uptime: 99.98, cpu: 28, memory: 41, networkIn: 120, networkOut: 95 },
  { id: "node-02", name: "Beta-Core",     latency: 18, errorRate: 0.002, uptime: 99.95, cpu: 34, memory: 52, networkIn: 180, networkOut: 142 },
  { id: "node-03", name: "Gamma-Edge",    latency: 22, errorRate: 0.001, uptime: 99.97, cpu: 19, memory: 37, networkIn: 340, networkOut: 310 },
  { id: "node-04", name: "Delta-Hub",     latency: 15, errorRate: 0.003, uptime: 99.92, cpu: 45, memory: 61, networkIn: 220, networkOut: 198 },
  { id: "node-05", name: "Epsilon-Node",  latency: 20, errorRate: 0.002, uptime: 99.94, cpu: 31, memory: 48, networkIn: 95,  networkOut: 87 },
  { id: "node-06", name: "Zeta-Relay",    latency: 25, errorRate: 0.001, uptime: 99.99, cpu: 22, memory: 33, networkIn: 280, networkOut: 265 },
  { id: "node-07", name: "Eta-Gateway",   latency: 16, errorRate: 0.002, uptime: 99.96, cpu: 38, memory: 55, networkIn: 410, networkOut: 390 },
  { id: "node-08", name: "Theta-Bridge",  latency: 19, errorRate: 0.001, uptime: 99.97, cpu: 27, memory: 44, networkIn: 160, networkOut: 155 },
  { id: "node-09", name: "Iota-Mesh",     latency: 23, errorRate: 0.003, uptime: 99.91, cpu: 52, memory: 68, networkIn: 75,  networkOut: 68 },
  { id: "node-10", name: "Kappa-Vault",   latency: 14, errorRate: 0.001, uptime: 99.99, cpu: 12, memory: 29, networkIn: 45,  networkOut: 38 },
  { id: "node-11", name: "Lambda-Cache",  latency: 21, errorRate: 0.002, uptime: 99.95, cpu: 41, memory: 74, networkIn: 520, networkOut: 505 },
  { id: "node-12", name: "Mu-Shield",     latency: 17, errorRate: 0.001, uptime: 99.98, cpu: 35, memory: 46, networkIn: 190, networkOut: 175 },
  { id: "node-13", name: "Nu-Firewall",   latency: 24, errorRate: 0.002, uptime: 99.93, cpu: 29, memory: 38, networkIn: 380, networkOut: 360 },
  { id: "node-14", name: "Xi-Cluster",    latency: 13, errorRate: 0.001, uptime: 99.99, cpu: 67, memory: 72, networkIn: 230, networkOut: 215 },
  { id: "node-15", name: "Omicron-Link",  latency: 20, errorRate: 0.003, uptime: 99.90, cpu: 18, memory: 31, networkIn: 610, networkOut: 595 },
  { id: "node-16", name: "Pi-Sentinel",   latency: 18, errorRate: 0.001, uptime: 99.97, cpu: 24, memory: 43, networkIn: 85,  networkOut: 79 },
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
    agent: "coordinator" as const,
    level: "info" as const,
    message: "COORDINATOR online. 4-agent incident response pipeline active. Awaiting alerts.",
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
      cpu: n.cpu,
      memory: n.memory,
      networkIn: n.networkIn,
      networkOut: n.networkOut,
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
