import { Router } from "express";
import { getAgentLogs } from "./agentLogs";
import { streamAgentLogs } from "./streamLogs";
import { triggerSentinelScanHandler } from "./triggerScan";
import { chatWithAgentHandler } from "./chat";
import { listApprovals, approveAction, rejectAction } from "./approvals";

const router = Router();

router.get("/agents/stream", streamAgentLogs);
router.get("/agents/logs", getAgentLogs);
router.post("/agents/trigger-scan", triggerSentinelScanHandler);
router.post("/agents/chat", chatWithAgentHandler);
router.get("/agents/approvals", listApprovals);
router.post("/agents/approvals/:id/approve", approveAction);
router.post("/agents/approvals/:id/reject", rejectAction);

export default router;
