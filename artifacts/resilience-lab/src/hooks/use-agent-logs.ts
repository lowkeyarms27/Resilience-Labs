import { useState, useEffect, useRef } from "react";
import { type AgentLogEntry } from "@workspace/api-client-react";
import { useGetAgentLogs } from "@workspace/api-client-react";

export type ThinkingState = Record<string, string>;

export type ApprovalRequest = {
  id: string;
  nodeId: string;
  nodeName: string;
  action: string;
  infraCommands: string[];
  justification: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  requestedBy: string;
  timestamp: string;
};

export function useAgentLogs(): {
  logs: AgentLogEntry[];
  thinking: ThinkingState;
  approvals: ApprovalRequest[];
} {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [thinking, setThinking] = useState<ThinkingState>({});
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);

  const { data: initialLogsData } = useGetAgentLogs({ limit: 50 }, {
    query: { queryKey: ["agentLogs", "initial"], staleTime: Infinity },
  });

  useEffect(() => {
    if (initialLogsData?.logs) setLogs(initialLogsData.logs);
  }, [initialLogsData]);

  useEffect(() => {
    const eventSource = new EventSource("/api/agents/stream");

    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data) as AgentLogEntry;
        if (!newLog.id) return;
        setLogs((prev) => {
          if (prev.some((l) => l.id === newLog.id)) return prev;
          return [newLog, ...prev].slice(0, 200);
        });
      } catch { /* ignore */ }
    };

    eventSource.addEventListener("thinking", (event) => {
      try {
        const { agent, partial } = JSON.parse((event as MessageEvent).data) as { agent: string; partial: string };
        setThinking((prev) => ({ ...prev, [agent]: partial }));
      } catch { /* ignore */ }
    });

    eventSource.addEventListener("thinking-done", (event) => {
      try {
        const { agent } = JSON.parse((event as MessageEvent).data) as { agent: string };
        setThinking((prev) => { const next = { ...prev }; delete next[agent]; return next; });
      } catch { /* ignore */ }
    });

    // New approval request from backend
    eventSource.addEventListener("approval-request", (event) => {
      try {
        const req = JSON.parse((event as MessageEvent).data) as ApprovalRequest;
        setApprovals((prev) => {
          if (prev.some((a) => a.id === req.id)) return prev;
          return [req, ...prev];
        });
      } catch { /* ignore */ }
    });

    // Approval was resolved (approved or rejected)
    eventSource.addEventListener("approval-resolved", (event) => {
      try {
        const { id } = JSON.parse((event as MessageEvent).data) as { id: string; approved: boolean };
        setApprovals((prev) => prev.filter((a) => a.id !== id));
      } catch { /* ignore */ }
    });

    // Full list sync (on connect or after updates)
    eventSource.addEventListener("approval-list", (event) => {
      try {
        const { approvals: list } = JSON.parse((event as MessageEvent).data) as { approvals: ApprovalRequest[] };
        setApprovals(list);
      } catch { /* ignore */ }
    });

    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, []);

  return { logs, thinking, approvals };
}

// Hook for approvals polling (manual approve/reject via HTTP)
export function useApproveAction() {
  const approveRef = useRef<(id: string) => Promise<void>>();
  approveRef.current = async (id: string) => {
    await fetch(`/api/agents/approvals/${id}/approve`, { method: "POST" });
  };
  return approveRef;
}

export function useRejectAction() {
  const rejectRef = useRef<(id: string) => Promise<void>>();
  rejectRef.current = async (id: string) => {
    await fetch(`/api/agents/approvals/${id}/reject`, { method: "POST" });
  };
  return rejectRef;
}
