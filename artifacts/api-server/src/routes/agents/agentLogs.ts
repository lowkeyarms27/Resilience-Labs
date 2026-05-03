import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { agentLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

export async function getAgentLogs(req: Request, res: Response) {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const logs = await db
    .select()
    .from(agentLogsTable)
    .orderBy(desc(agentLogsTable.timestamp))
    .limit(limit);

  const total = await db.$count(agentLogsTable);

  res.json({
    logs: logs.reverse().map((l) => ({
      id: l.id,
      timestamp: l.timestamp.toISOString(),
      agent: l.agent,
      level: l.level,
      message: l.message,
      nodeId: l.nodeId,
      metadata: l.metadata,
    })),
    total,
  });
}
