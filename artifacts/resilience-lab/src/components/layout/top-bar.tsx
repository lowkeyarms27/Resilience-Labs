import React, { useState, useEffect, useRef } from "react";
import {
  useGetGridSummary, useInjectShock, useTriggerSentinelScan,
  getGetGridStateQueryKey, getGetGridSummaryQueryKey,
} from "@workspace/api-client-react";
import { type InjectShockBodySeverity, type AgentLogEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ShieldAlert, Zap, AlertTriangle, CheckCircle, Server, Clock, Radio, Terminal, Command, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/date-utils";

type ScenarioId = "ddos_surge" | "cascade_failure" | "zero_day" | "power_outage" | "ransomware_wave";

const SCENARIOS: { id: ScenarioId; name: string; icon: string; color: string; desc: string }[] = [
  { id: "ddos_surge",      name: "DDoS SURGE",        icon: "⚡", color: "text-orange-400", desc: "Flood attack on edge nodes" },
  { id: "cascade_failure", name: "CASCADE FAILURE",    icon: "🔗", color: "text-red-400",    desc: "Chain reaction collapse" },
  { id: "zero_day",        name: "ZERO-DAY EXPLOIT",   icon: "☠",  color: "text-purple-400", desc: "Critical vuln weaponised" },
  { id: "power_outage",    name: "POWER GRID OUTAGE",  icon: "🔌", color: "text-yellow-400", desc: "Sector power loss" },
  { id: "ransomware_wave", name: "RANSOMWARE WAVE",    icon: "💀", color: "text-red-600",    desc: "Malware propagation" },
];

interface TopBarProps {
  onToggleConsole: () => void;
  consoleOpen: boolean;
  onOpenPalette: () => void;
  logs: AgentLogEntry[];
}

function useUptime() {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(elapsed / 3_600_000);
  const m = Math.floor((elapsed % 3_600_000) / 60_000);
  const s = Math.floor((elapsed % 60_000) / 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

export function TopBar({ onToggleConsole, consoleOpen, onOpenPalette, logs }: TopBarProps) {
  const queryClient = useQueryClient();
  const [scenarioLoading, setScenarioLoading] = useState<string | null>(null);
  const uptime = useUptime();

  const incidentsResolved = logs.filter(
    (l) => l.agent === "validator" && l.level === "success"
  ).length;

  const { data: summary } = useGetGridSummary({
    query: { queryKey: getGetGridSummaryQueryKey(), refetchInterval: 2000 },
  });

  const injectShock = useInjectShock({
    mutation: {
      onSuccess: () => {
        toast.error("⚡ System shock injected.", { duration: 4000 });
        queryClient.invalidateQueries({ queryKey: getGetGridStateQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetGridSummaryQueryKey() });
      },
      onError: () => toast.error("Failed to inject shock."),
    },
  });

  const triggerScan = useTriggerSentinelScan({
    mutation: {
      onSuccess: () => toast.success("Sentinel scan initiated."),
      onError: () => toast.error("Failed to trigger scan."),
    },
  });

  const handleInjectShock = (severity: InjectShockBodySeverity) => {
    injectShock.mutate({ data: { severity } });
  };

  const handleScenario = async (scenario: ScenarioId) => {
    setScenarioLoading(scenario);
    try {
      const res = await fetch("/api/grid/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json() as { scenarioName: string; affectedNodes: string[] };
      const meta = SCENARIOS.find(s => s.id === scenario);
      toast.error(`${meta?.icon ?? "⚡"} ${data.scenarioName} initiated — ${data.affectedNodes.length} nodes affected`, { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: getGetGridStateQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGridSummaryQueryKey() });
    } catch {
      toast.error("Failed to run scenario.");
    } finally {
      setScenarioLoading(null);
    }
  };

  const healthPercent = summary?.overallHealthPercent ?? 100;
  const isCritical = (summary?.failingNodes ?? 0) > 0;
  const isDegraded = (summary?.degradedNodes ?? 0) > 0;
  const healthColor = healthPercent < 50 ? "text-red-400" : healthPercent < 80 ? "text-amber-400" : "text-green-400";

  return (
    <header className={cn(
      "h-16 border-b bg-card flex items-center justify-between px-5 z-10 relative transition-colors duration-700",
      isCritical ? "border-red-500/40" : "border-border"
    )}>
      {isCritical && <div className="absolute inset-0 bg-red-500/3 pointer-events-none" />}

      {/* Logo */}
      <div className="flex items-center gap-3 text-primary relative z-10 shrink-0">
        <Activity className={cn("w-5 h-5", isCritical ? "pulse-red" : "pulse-blue")} />
        <div>
          <h1 className="font-bold tracking-widest text-base font-mono leading-tight">RESILIENCE LAB</h1>
          <p className="text-[10px] text-muted-foreground font-mono leading-tight">AUTONOMOUS SYSTEM MONITOR</p>
        </div>
        <div className="flex items-center gap-1.5 ml-2 text-[10px] font-mono">
          <Radio className="w-3 h-3 text-green-400" />
          <span className="text-green-400 blink font-bold tracking-wider">LIVE</span>
        </div>
      </div>

      {/* Health bar */}
      <div className="flex-1 max-w-xl px-6 flex flex-col gap-1.5 relative z-10">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-muted-foreground tracking-wider">OVERALL SYSTEM HEALTH</span>
          <span className={cn("font-bold", healthColor)}>{healthPercent.toFixed(1)}%</span>
        </div>
        <Progress
          value={healthPercent}
          className={cn(
            "h-1.5 transition-colors duration-700",
            isCritical ? "[&>div]:bg-red-500" : isDegraded ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
          )}
        />
        {summary && (
          <div className="flex justify-between gap-3 text-[10px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1"><Server className="w-2.5 h-2.5" /> {summary.totalNodes}</span>
            <span className="flex items-center gap-1 text-green-500"><CheckCircle className="w-2.5 h-2.5" /> {summary.healthyNodes}</span>
            <span className={cn("flex items-center gap-1", summary.degradedNodes > 0 ? "text-amber-400" : "")}>
              <AlertTriangle className="w-2.5 h-2.5" /> {summary.degradedNodes}
            </span>
            <span className={cn("flex items-center gap-1", summary.failingNodes > 0 ? "text-red-400 font-bold" : "")}>
              <ShieldAlert className="w-2.5 h-2.5" /> {summary.failingNodes}
            </span>
            <span className={cn("flex items-center gap-1", summary.repairingNodes > 0 ? "text-blue-400" : "")}>
              <Zap className="w-2.5 h-2.5" /> {summary.repairingNodes}
            </span>
            <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {Math.round(summary.avgLatency)}ms</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 relative z-10 shrink-0">

        {/* Live stats */}
        <div className="flex items-center gap-3 mr-2 font-mono text-[10px] text-muted-foreground border border-border/40 rounded px-3 py-1.5 bg-background/30">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span className="tabular-nums">{uptime}</span>
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className={cn("tabular-nums", incidentsResolved > 0 ? "text-green-400" : "")}>
              {incidentsResolved} resolved
            </span>
          </span>
        </div>

        {/* Command palette trigger */}
        <Button
          variant="outline"
          size="sm"
          className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 font-mono text-xs h-8 gap-1.5"
          onClick={onOpenPalette}
        >
          <Command className="w-3 h-3" />
          <span className="hidden sm:inline">⌘K</span>
        </Button>

        {/* Console toggle */}
        <Button
          variant={consoleOpen ? "default" : "outline"}
          size="sm"
          className={cn(
            "font-mono text-xs tracking-wider h-8",
            consoleOpen
              ? "bg-primary text-primary-foreground"
              : "border-primary/40 text-primary hover:bg-primary/10"
          )}
          onClick={onToggleConsole}
        >
          <Terminal className="w-3 h-3 mr-1.5" />
          CONSOLE
        </Button>

        {/* Trigger Scan */}
        <Button
          variant="outline"
          size="sm"
          className="border-primary/50 text-primary hover:bg-primary/10 font-mono text-xs tracking-wider h-8"
          onClick={() => triggerScan.mutate()}
          disabled={triggerScan.isPending}
        >
          {triggerScan.isPending ? (
            <><Zap className="w-3 h-3 mr-1.5 animate-spin" /> SCANNING…</>
          ) : (
            <><Radio className="w-3 h-3 mr-1.5" /> TRIGGER SCAN</>
          )}
        </Button>

        {/* Scenarios dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 font-mono text-xs tracking-wider h-8"
              disabled={!!scenarioLoading}
            >
              <ShieldAlert className="w-3 h-3 mr-1.5" />
              {scenarioLoading ? "RUNNING…" : "SCENARIOS"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 font-mono bg-card border-border">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground tracking-wider">ATTACK SIMULATION</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SCENARIOS.map((s) => (
              <DropdownMenuItem
                key={s.id}
                className="cursor-pointer flex flex-col items-start gap-0.5 py-2"
                onClick={() => handleScenario(s.id)}
              >
                <div className={cn("flex items-center gap-2 text-xs font-bold", s.color)}>
                  <span>{s.icon}</span> {s.name}
                </div>
                <span className="text-[10px] text-muted-foreground ml-5">{s.desc}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Inject Shock */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="font-mono text-xs tracking-wider font-bold h-8 shadow-[0_0_12px_rgba(255,51,51,0.3)]"
              disabled={injectShock.isPending}
            >
              <Zap className="w-3 h-3 mr-1.5" />
              {injectShock.isPending ? "INJECTING…" : "INJECT SHOCK"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52 font-mono bg-card border-border">
            <DropdownMenuLabel className="text-[10px] text-muted-foreground tracking-wider">SELECT SEVERITY</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => handleInjectShock("low")}>
              <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2 shrink-0" /> Low Severity
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-amber-400 cursor-pointer" onClick={() => handleInjectShock("medium")}>
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 shrink-0" /> Medium Severity
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-red-400 cursor-pointer" onClick={() => handleInjectShock("high")}>
              <span className="w-2 h-2 rounded-full bg-red-500 mr-2 shrink-0" /> High Severity
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-red-600 font-bold cursor-pointer" onClick={() => handleInjectShock("catastrophic")}>
              <span className="w-2 h-2 rounded-full bg-red-700 mr-2 shrink-0 animate-ping" /> Catastrophic
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
