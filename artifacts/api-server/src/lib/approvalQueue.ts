import EventEmitter from "events";

export type RiskLevel = "low" | "medium" | "high";

export type ApprovalRequest = {
  id: string;
  nodeId: string;
  nodeName: string;
  action: string;
  infraCommands: string[];
  justification: string;
  confidence: number;
  riskLevel: RiskLevel;
  requestedBy: string;
  timestamp: string;
};

class ApprovalQueueManager extends EventEmitter {
  private pending = new Map<string, ApprovalRequest>();

  list(): ApprovalRequest[] {
    return Array.from(this.pending.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  add(req: ApprovalRequest): Promise<boolean> {
    this.pending.set(req.id, req);
    this.emit("added", req);
    return new Promise((resolve) => {
      const cleanup = (approved: boolean) => {
        this.removeListener(`decision:${req.id}`, cleanup);
        resolve(approved);
      };
      this.once(`decision:${req.id}`, cleanup);
      setTimeout(() => {
        if (this.pending.has(req.id)) {
          this.pending.delete(req.id);
          this.emit("updated");
          resolve(false);
        }
      }, 600_000);
    });
  }

  approve(id: string): boolean {
    if (!this.pending.has(id)) return false;
    this.pending.delete(id);
    this.emit(`decision:${id}`, true);
    this.emit("updated", id);
    return true;
  }

  reject(id: string): boolean {
    if (!this.pending.has(id)) return false;
    this.pending.delete(id);
    this.emit(`decision:${id}`, false);
    this.emit("updated", id);
    return true;
  }
}

export const approvalQueue = new ApprovalQueueManager();
