import type { Request, Response } from "express";
import { runSentinelScan } from "../../lib/agentOrchestrator";

export async function triggerSentinelScanHandler(
  _req: Request,
  res: Response
) {
  const result = await runSentinelScan();
  res.json(result);
}
