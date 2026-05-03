import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { gridNodesTable } from "@workspace/db";

export async function getGridSummary(_req: Request, res: Response) {
  const nodes = await db.select().from(gridNodesTable);
  const total = nodes.length;
  const healthy = nodes.filter((n) => n.status === "healthy").length;
  const degraded = nodes.filter((n) => n.status === "degraded").length;
  const failing = nodes.filter((n) => n.status === "failing").length;
  const repairing = nodes.filter((n) => n.status === "repairing").length;
  const offline = nodes.filter((n) => n.status === "offline").length;
  const avgLatency =
    total > 0 ? nodes.reduce((acc, n) => acc + n.latency, 0) / total : 0;
  const overallHealthPercent =
    total > 0 ? Math.round((healthy / total) * 100) : 100;
  const activeIncidents = failing + offline;

  res.json({
    totalNodes: total,
    healthyNodes: healthy,
    degradedNodes: degraded,
    failingNodes: failing,
    repairingNodes: repairing,
    offlineNodes: offline,
    overallHealthPercent,
    avgLatency: Math.round(avgLatency),
    activeIncidents,
  });
}
