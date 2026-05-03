import React, { useEffect, useRef, useState } from "react";
import { useAgentLogs } from "@/hooks/use-agent-logs";
import { formatRelativeTime, cn } from "@/lib/date-utils";
import { Terminal, Shield, Wrench, Cpu, AlertTriangle, AlertCircle, Info, CheckCircle, ArrowRight } from "lucide-react";

const agentMeta: Record<string, { color: string; border: string; label: string }> = {
  sentinel: { color: "text-cyan-400",    border: "border-l-cyan-400 bg-cyan-400/5 border-cyan-400/15",       label: "SENTINEL" },
  engineer: { color: "text-amber-400",   border: "border-l-amber-400 bg-amber-400/5 border-amber-400/15",    label: "ENGINEER" },
  system:   { color: "text-fuchsia-400", border: "border-l-fuchsia-400 bg-fuchsia-400/5 border-fuchsia-400/15", label: "SYSTEM" },
};

const levelConfig: Record<string, { icon: React.ReactNode; cls: string }> = {
  info:     { icon: <Info className="w-3 h-3" />,           cls: "text-muted-foreground" },
  warning:  { icon: <AlertTriangle className="w-3 h-3" />,  cls: "text-amber-400" },
  critical: { icon: <AlertCircle className="w-3 h-3" />,    cls: "text-red-400" },
  action:   { icon: <ArrowRight className="w-3 h-3" />,     cls: "text-blue-400" },
  success:  { icon: <CheckCircle className="w-3 h-3" />,    cls: "text-green-400" },
};

export function AgentLogs() {
  const { logs, thinking } = useAgentLogs();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const prevLenRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsConnected(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (logs.length > prevLenRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevLenRef.current = logs.length;
  }, [logs.length]);

  const sorted = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const thinkingEntries = Object.entries(thinking).filter(([, text]) => text.length > 0);

  return (
    <div className="w-96 border-l border-border bg-card/80 backdrop-blur-sm flex flex-col h-[calc(100vh-4rem)] shrink-0">
      <div className="px-4 py-3 border-b border-border bg-card/60 flex items-center justify-between shrink-0">
        <h2 className="font-mono font-bold tracking-wider flex items-center gap-2 text-sm">
          <Terminal className="w-4 h-4 text-primary" />
          AGENT LOGS
        </h2>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className={cn("w-2 h-2 rounded-full shrink-0", isConnected ? "bg-green-400 blink" : "bg-gray-600")} />
          <span className={isConnected ? "text-green-400" : "text-muted-foreground"}>
            {isConnected ? "LIVE" : "CONNECTING"}
          </span>
          {logs.length > 0 && <span className="text-muted-foreground ml-1">· {logs.length}</span>}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 font-mono text-xs">
        {/* Thinking cards — pinned at top while streaming */}
        {thinkingEntries.map(([agent, partial]) => {
          const meta = agentMeta[agent] ?? agentMeta.system;
          return (
            <div key={`thinking-${agent}`} className={cn(
              "rounded-r border border-l-2 p-3 flex flex-col gap-1.5 log-entry-in",
              meta.border
            )}>
              <div className="flex items-center justify-between">
                <div className={cn("flex items-center gap-1.5 font-bold text-[10px] tracking-widest", meta.color)}>
                  {agent === "sentinel" && <Shield className="w-3 h-3" />}
                  {agent === "engineer" && <Wrench className="w-3 h-3" />}
                  {agent === "system"   && <Cpu className="w-3 h-3" />}
                  {meta.label}
                  <span className="ml-1 text-muted-foreground normal-case tracking-normal font-normal">thinking…</span>
                </div>
                <div className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 opacity-60" />
                <p className="leading-relaxed text-foreground/75 break-words flex-1 text-[11px]">
                  {partial}
                  <span className="inline-block w-1.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm align-middle" />
                </p>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && thinkingEntries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground flex-col gap-2 opacity-40">
            <Terminal className="w-8 h-8 pulse-blue" />
            <p className="text-xs tracking-wider">AWAITING TRANSMISSIONS</p>
          </div>
        ) : (
          sorted.map((log, idx) => {
            const meta = agentMeta[log.agent] ?? agentMeta.system;
            const lvl = levelConfig[log.level] ?? levelConfig.info;
            return (
              <div
                key={`${log.id}-${idx}`}
                className={cn("rounded-r border border-l-2 p-3 flex flex-col gap-1.5 transition-all log-entry-in", meta.border)}
              >
                <div className="flex items-center justify-between">
                  <div className={cn("flex items-center gap-1.5 font-bold text-[10px] tracking-widest", meta.color)}>
                    {log.agent === "sentinel" && <Shield className="w-3 h-3" />}
                    {log.agent === "engineer" && <Wrench className="w-3 h-3" />}
                    {log.agent === "system"   && <Cpu className="w-3 h-3" />}
                    {meta.label}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">{formatRelativeTime(log.timestamp)}</span>
                </div>

                <div className={cn("flex items-start gap-2", lvl.cls)}>
                  <span className="mt-0.5 shrink-0 opacity-80">{lvl.icon}</span>
                  <p className="leading-relaxed text-foreground/85 break-words flex-1 text-[11px]">{log.message}</p>
                </div>

                {log.nodeId && (
                  <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-0.5 pt-1.5 border-t border-current/10">
                    <span className="opacity-60">TARGET</span>
                    <span className="font-bold">{log.nodeId.toUpperCase()}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
