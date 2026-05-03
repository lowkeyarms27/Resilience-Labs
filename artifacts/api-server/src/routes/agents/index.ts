import { Router } from "express";
import { getAgentLogs } from "./agentLogs";
import { streamAgentLogs } from "./streamLogs";
import { triggerSentinelScanHandler } from "./triggerScan";

const router = Router();

router.get("/agents/stream", streamAgentLogs);
router.get("/agents/logs", getAgentLogs);
router.post("/agents/trigger-scan", triggerSentinelScanHandler);

export default router;
