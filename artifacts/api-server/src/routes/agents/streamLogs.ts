import type { Request, Response } from "express";
import { registerSSEClient, removeSSEClient } from "../../lib/agentOrchestrator";
import { v4 as uuidv4 } from "uuid";

export function streamAgentLogs(req: Request, res: Response) {
  const clientId = uuidv4();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(
    `data: ${JSON.stringify({ type: "connected", clientId })}\n\n`
  );

  registerSSEClient(clientId, res);

  req.on("close", () => {
    removeSSEClient(clientId);
  });
}
