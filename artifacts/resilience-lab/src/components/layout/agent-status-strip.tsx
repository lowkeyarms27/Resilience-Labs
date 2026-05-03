import React, { useMemo } from "react";
import { type AgentLogEntry } from "@workspace/api-client-react";
import { type ThinkingState } from "@/hooks/use-agent-logs";
import { Shield, Network, Search, Hammer, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/date-utils";

const AGENTS = [
  { id: "sentinel",      label: "SENTINEL",      icon: <Shield className="w-3 h-3" />,      color: "text-cyan-400",   glow: "shadow-cyan-400/40" },
  { id: "coordinator",   label: "COORDINATOR",   icon: <Network className="w-3 h-3" />,     color: "text-violet-400", glow: "shadow-violet-400/40" },
  { id: "diagnostician", label: "DIAGNOSTICIAN", icon: <Search className="w-3 h-3" />,      color: "text-yellow-400", glow: "shadow-yellow-400/40" },
  { id: "remediator",    label: "REMEDIATOR",    icon: <Hammer className="w-3 h-3" />,      color: "text-orange-400", glow: "shadow-orange-400/40" },
  { id: "validator",     label: "VALIDATOR",     icon: <ShieldCheck className="w-3 h-3" />, color: "text-green-400",  glow: "shadow-green-400/40" },
] as const;

type AgentId = typeof AGENTS[number]["id"];

interface AgentStatusStripProps {
  logs: AgentLogEntry[];
  thinking: ThinkingState;
}

export function AgentStatusStrip({ logs, thinking }: AgentStatusStripProps) {
  const agentStates = useMemo(() => {
    const now = Date.now();
    return AGENTS.map((agent) => {
      const isThinking = !!(thinking[agent.id as keyof ThinkingState]?.length);
      const recentLog = logs
        .filter((l) => l.agent === agent.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      const lastActivityMs = recentLog ? now - new Date(recentLog.timestamp).getTime() : Infinity;
      const isActive = !isThinking && lastActivityMs < 15_000;

      const state: "thinking" | "active" | "idle" =
        isThinking ? "thinking" : isActive ? "active" : "idle";

      const lastMsg = recentLog?.message?.slice(0, 48) ?? null;

      return { ...agent, state, lastMsg };
    });
  }, [logs, thinking]);

  return (
    <div className="border-b border-border bg-card/40 px-5 py-1.5 flex items-center gap-1 shrink-0 overflow-x-auto">
      {agentStates.map((agent, i) => (
        <React.Fragment key={agent.id}>
          <div className="flex items-center gap-2 px-2 py-1 rounded group relative shrink-0">
            {/* Status dot */}
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              {agent.state === "thinking" && (
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", agent.color.replace("text-", "bg-"))} />
              )}
              <span className={cn(
                "relative inline-flex rounded-full h-1.5 w-1.5",
                agent.state === "thinking" ? agent.color.replace("text-", "bg-") :
                agent.state === "active"   ? agent.color.replace("text-", "bg-") + " opacity-80" :
                "bg-muted-foreground/20"
              )} />
            </span>

            {/* Icon + label */}
            <span className={cn(
              "font-mono text-[10px] tracking-widest font-bold flex items-center gap-1 transition-colors duration-300",
              agent.state === "idle" ? "text-muted-foreground/40" : agent.color
            )}>
              {agent.icon}
              {agent.label}
            </span>

            {/* State badge */}
            <span className={cn(
              "font-mono text-[9px] tracking-wider px-1 rounded",
              agent.state === "thinking" ? cn("animate-pulse", agent.color, "bg-current/10") :
              agent.state === "active"   ? cn(agent.color, "opacity-70") :
              "text-muted-foreground/30"
            )}>
              {agent.state === "thinking" ? "THINKING" : agent.state === "active" ? "ACTIVE" : "IDLE"}
            </span>
          </div>

          {i < AGENTS.length - 1 && (
            <span className="text-border/50 font-mono text-xs shrink-0">›</span>
          )}
        </React.Fragment>
      ))}

      {/* Pipeline active indicator */}
      {agentStates.some((a) => a.state !== "idle") && (
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[10px] text-primary tracking-wider">PIPELINE ACTIVE</span>
        </div>
      )}
    </div>
  );
}
