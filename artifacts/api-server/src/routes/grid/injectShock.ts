import type { Request, Response } from "express";
import { injectShock } from "../../lib/agentOrchestrator";

export async function injectShockHandler(req: Request, res: Response) {
  const body = req.body as {
    severity?: string;
    targetNodeIds?: string[];
  };
  const severity = body.severity ?? "medium";
  const targetNodeIds = body.targetNodeIds;

  const result = await injectShock(severity, targetNodeIds);
  res.json(result);
}
