import { type RequestHandler } from "express";
import { approvalQueue } from "../../lib/approvalQueue";

export const listApprovals: RequestHandler = (_req, res) => {
  res.json({ approvals: approvalQueue.list() });
};

export const approveAction: RequestHandler = (req, res) => {
  const { id } = req.params;
  const ok = approvalQueue.approve(id);
  if (!ok) {
    res.status(404).json({ error: "Approval request not found or already resolved" });
    return;
  }
  res.json({ approved: true, id });
};

export const rejectAction: RequestHandler = (req, res) => {
  const { id } = req.params;
  const ok = approvalQueue.reject(id);
  if (!ok) {
    res.status(404).json({ error: "Approval request not found or already resolved" });
    return;
  }
  res.json({ approved: false, id });
};
