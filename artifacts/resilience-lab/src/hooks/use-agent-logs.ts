import { useState, useEffect, useRef, useCallback } from "react";
import { type AgentLogEntry } from "@workspace/api-client-react";
import { useGetAgentLogs } from "@workspace/api-client-react";

export function useAgentLogs() {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const logsRef = useRef<AgentLogEntry[]>([]);
  
  // Update ref when state changes
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Load initial logs
  const { data: initialLogsData } = useGetAgentLogs({ limit: 50 }, { 
    query: { 
      queryKey: ["agentLogs", "initial"],
      staleTime: Infinity 
    } 
  });

  useEffect(() => {
    if (initialLogsData?.logs) {
      setLogs(initialLogsData.logs);
    }
  }, [initialLogsData]);

  // Connect to SSE
  useEffect(() => {
    const eventSource = new EventSource("/api/agents/stream");
    
    eventSource.onmessage = (event) => {
      try {
        const newLog = JSON.parse(event.data) as AgentLogEntry;
        setLogs(prev => {
          // deduplicate
          if (prev.some(log => log.id === newLog.id)) {
            return prev;
          }
          return [newLog, ...prev].slice(0, 200); // keep last 200
        });
      } catch (err) {
        console.error("Failed to parse agent log stream data", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error", err);
      eventSource.close();
      // Simple reconnect logic could go here
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return logs;
}
