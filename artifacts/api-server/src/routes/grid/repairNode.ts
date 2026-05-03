import type { Request, Response } from "express";
import { repairNode, persistLog } from "../../lib/agentOrchestrator";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function repairNodeHandler(req: Request, res: Response) {
  const nodeId = req.params["nodeId"];
  if (!nodeId) {
    res.status(400).json({ error: "nodeId required" });
    return;
  }

  await persistLog({
    id: makeId(),
    timestamp: new Date().toISOString(),
    agent: "engineer",
    level: "action",
    message: `Manual repair request received for node ${nodeId}. Initiating repair sequence.`,
    nodeId,
  });

  await repairNode(nodeId);

  res.json({
    nodeId,
    status: "repairing",
    message: `Repair initiated for node ${nodeId}`,
  });
}
