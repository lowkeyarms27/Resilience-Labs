import type { Request, Response } from "express";
import { chatWithAgent } from "../../lib/agentOrchestrator";
import { logger } from "../../lib/logger";

export async function chatWithAgentHandler(req: Request, res: Response) {
  const { message, agent = "sentinel" } = req.body as { message: string; agent?: string };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const validAgents = ["sentinel", "engineer", "analyst"];
  const agentRole = validAgents.includes(agent) ? agent as "sentinel" | "engineer" | "analyst" : "sentinel";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    await chatWithAgent(message, agentRole, (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    logger.error({ err }, "Chat agent error");
    res.write(`data: ${JSON.stringify({ error: "Agent unavailable", done: true })}\n\n`);
  } finally {
    res.end();
  }
}
