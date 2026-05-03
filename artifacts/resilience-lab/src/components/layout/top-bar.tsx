import React from "react";
import {
  useGetGridSummary, useInjectShock, useTriggerSentinelScan,
  getGetGridStateQueryKey, getGetGridSummaryQueryKey,
} from "@workspace/api-client-react";
import { type InjectShockBodySeverity } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ShieldAlert, Zap, AlertTriangle, CheckCircle, Server, Clock, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/date-utils";

export function TopBar() {
  const queryClient = useQueryClient();
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

  const healthPercent = summary?.overallHealthPercent ?? 100;
  const isCritical = (summary?.failingNodes ?? 0) > 0;
  const isDegraded = (summary?.degradedNodes ?? 0) > 0;

  const healthColor =
    healthPercent < 50 ? "text-red-400" :
    healthPercent < 80 ? "text-amber-400" : "text-green-400";

  return (
    <header className={cn(
      "h-16 border-b bg-card flex items-center justify-between px-5 z-10 relative transition-colors duration-700",
      isCritical ? "border-red-500/40" : "border-border"
    )}>
      {isCritical && (
        <div className="absolute inset-0 bg-red-500/3 pointer-events-none" />
      )}

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

      <div className="flex-1 max-w-xl px-6 flex flex-col gap-1.5 relative z-10">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-muted-foreground tracking-wider">OVERALL SYSTEM HEALTH</span>
          <span className={cn("font-bold", healthColor)}>
            {healthPercent.toFixed(1)}%
          </span>
        </div>
        <div className="relative">
          <Progress
            value={healthPercent}
            className={cn(
              "h-1.5 transition-colors duration-700",
              isCritical ? "[&>div]:bg-red-500" : isDegraded ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
            )}
          />
        </div>

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

      <div className="flex items-center gap-3 relative z-10 shrink-0">
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
