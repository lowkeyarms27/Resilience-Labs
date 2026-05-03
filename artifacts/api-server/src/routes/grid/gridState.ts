import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { gridNodesTable } from "@workspace/db";

export async function getGridState(_req: Request, res: Response) {
  const nodes = await db.select().from(gridNodesTable);
  res.json({
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      latency: n.latency,
      errorRate: n.errorRate,
      uptime: n.uptime,
      assignedAgent: n.assignedAgent,
      lastUpdated: n.lastUpdated.toISOString(),
    })),
    timestamp: new Date().toISOString(),
  });
}
