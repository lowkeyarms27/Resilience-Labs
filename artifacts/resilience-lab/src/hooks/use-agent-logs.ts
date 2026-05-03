import { useState, useEffect, useRef } from "react";
import { type AgentLogEntry } from "@workspace/api-client-react";
import { useGetAgentLogs } from "@workspace/api-client-react";

export type ThinkingState = Record<string, string>; // agent -> partial text

export function useAgentLogs(): { logs: AgentLogEntry[]; thinking: ThinkingState } {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [thinking, setThinking] = useState<ThinkingState>({});

  const { data: initialLogsData } = useGetAgentLogs({ limit: 50 }, {
    query: { queryKey: ["agentLogs", "initial"], staleTime: Infinity },
  });

  useEffect(() => {
    if (initialLogsData?.logs) {
      setLogs(initialLogsData.logs);
    }
  }, [initialLogsData]);

  useEffect(() => {
    const eventSource = new EventSource("/api/agents/stream");

    // Default message → completed log entry
    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data) as AgentLogEntry;
        if (!newLog.id) return;
        setLogs((prev) => {
          if (prev.some((l) => l.id === newLog.id)) return prev;
          return [newLog, ...prev].slice(0, 200);
        });
      } catch { /* ignore parse errors */ }
    };

    // Named event: AI agent streaming a response
    eventSource.addEventListener("thinking", (event) => {
      try {
        const { agent, partial } = JSON.parse((event as MessageEvent).data) as { agent: string; partial: string };
        setThinking((prev) => ({ ...prev, [agent]: partial }));
      } catch { /* ignore */ }
    });

    // Named event: streaming finished
    eventSource.addEventListener("thinking-done", (event) => {
      try {
        const { agent } = JSON.parse((event as MessageEvent).data) as { agent: string };
        setThinking((prev) => {
          const next = { ...prev };
          delete next[agent];
          return next;
        });
      } catch { /* ignore */ }
    });

    eventSource.onerror = () => eventSource.close();

    return () => eventSource.close();
  }, []);

  return { logs, thinking };
}
