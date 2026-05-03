import React, { useEffect, useRef } from "react";
import { useAgentLogs } from "@/hooks/use-agent-logs";
import { formatRelativeTime, cn } from "@/lib/date-utils";
import { Terminal, Shield, Wrench, Cpu, AlertTriangle, AlertCircle, Info, CheckCircle, ArrowRight } from "lucide-react";

const agentColors = {
  sentinel: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5",
  engineer: "text-amber-500 border-amber-500/20 bg-amber-500/5",
  system: "text-fuchsia-400 border-fuchsia-400/20 bg-fuchsia-400/5"
};

const levelIcons = {
  info: <Info className="w-3 h-3" />,
  warning: <AlertTriangle className="w-3 h-3 text-yellow-400" />,
  critical: <AlertCircle className="w-3 h-3 text-red-500 pulse-red" />,
  action: <ArrowRight className="w-3 h-3 text-blue-400" />,
  success: <CheckCircle className="w-3 h-3 text-green-400" />
};

export function AgentLogs() {
  const logs = useAgentLogs();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-96 border-l border-border bg-card/80 backdrop-blur-sm flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between">
        <h2 className="font-mono font-bold tracking-wider flex items-center gap-2 text-sm">
          <Terminal className="w-4 h-4 text-primary" />
          AGENT LOGS
        </h2>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground flex-col gap-2 opacity-50">
            <Terminal className="w-8 h-8 pulse-blue" />
            <p>Awaiting agent transmissions...</p>
          </div>
        ) : (
          [...logs].reverse().map(log => (
            <div 
              key={log.id} 
              className={cn(
                "p-3 rounded border flex flex-col gap-2 transition-all",
                agentColors[log.agent]
              )}
            >
              <div className="flex items-center justify-between opacity-80">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                  {log.agent === 'sentinel' && <Shield className="w-3 h-3" />}
                  {log.agent === 'engineer' && <Wrench className="w-3 h-3" />}
                  {log.agent === 'system' && <Cpu className="w-3 h-3" />}
                  {log.agent}
                </div>
                <span className="text-[10px] opacity-60">
                  {formatRelativeTime(log.timestamp)}
                </span>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="mt-0.5 opacity-80">{levelIcons[log.level]}</div>
                <p className="leading-relaxed opacity-90 break-words flex-1">
                  {log.message}
                </p>
              </div>

              {log.nodeId && (
                <div className="text-[10px] opacity-50 flex items-center gap-1 mt-1 border-t border-current/10 pt-1">
                  TARGET: {log.nodeId.substring(0, 8)}...
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
