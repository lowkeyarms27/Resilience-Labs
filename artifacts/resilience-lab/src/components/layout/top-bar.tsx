import React, { useState } from "react";
import { useGetGridSummary, useInjectShock, useTriggerSentinelScan, getGetGridStateQueryKey, getGetGridSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ShieldAlert, Zap, AlertTriangle, CheckCircle, Server, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type InjectShockBodySeverity } from "@workspace/api-client-react";
import { toast } from "sonner";

export function TopBar() {
  const queryClient = useQueryClient();
  const { data: summary } = useGetGridSummary({
    query: {
      queryKey: getGetGridSummaryQueryKey(),
      refetchInterval: 2000
    }
  });

  const injectShock = useInjectShock({
    mutation: {
      onSuccess: () => {
        toast.success("System shock injected successfully.");
        queryClient.invalidateQueries({ queryKey: getGetGridStateQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetGridSummaryQueryKey() });
      },
      onError: (err) => {
        toast.error("Failed to inject shock.");
        console.error(err);
      }
    }
  });

  const triggerScan = useTriggerSentinelScan({
    mutation: {
      onSuccess: () => {
        toast.success("Sentinel scan triggered.");
      },
      onError: (err) => {
        toast.error("Failed to trigger scan.");
        console.error(err);
      }
    }
  });

  const handleInjectShock = (severity: InjectShockBodySeverity) => {
    injectShock.mutate({ data: { severity } });
  };

  const healthPercent = summary?.overallHealthPercent ?? 100;

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 z-10 relative">
      <div className="flex items-center gap-4 text-primary">
        <Activity className="w-6 h-6 pulse-blue" />
        <div>
          <h1 className="font-bold tracking-widest text-lg font-mono">RESILIENCE LAB</h1>
          <p className="text-xs text-muted-foreground font-mono">AUTONOMOUS SYSTEM MONITOR</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl px-8 flex flex-col gap-2">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">OVERALL SYSTEM HEALTH</span>
          <span className={healthPercent < 50 ? "text-destructive pulse-red" : healthPercent < 80 ? "text-amber-500" : "text-green-500"}>
            {healthPercent.toFixed(1)}%
          </span>
        </div>
        <Progress value={healthPercent} className="h-2" />
        
        {summary && (
          <div className="flex justify-between gap-4 text-[10px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1"><Server className="w-3 h-3"/> {summary.totalNodes} NODES</span>
            <span className="flex items-center gap-1 text-green-500"><CheckCircle className="w-3 h-3"/> {summary.healthyNodes} HEALTHY</span>
            <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="w-3 h-3"/> {summary.degradedNodes} DEGRADED</span>
            <span className="flex items-center gap-1 text-destructive"><ShieldAlert className="w-3 h-3"/> {summary.failingNodes} FAILING</span>
            <span className="flex items-center gap-1 text-blue-500"><Zap className="w-3 h-3"/> {summary.repairingNodes} REPAIRING</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {Math.round(summary.avgLatency)}ms AVG</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-mono text-xs tracking-wider"
          onClick={() => triggerScan.mutate()}
          disabled={triggerScan.isPending}
        >
          TRIGGER SCAN
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="destructive" 
              className="font-mono text-xs tracking-wider font-bold pulse-red"
              disabled={injectShock.isPending}
            >
              <Zap className="w-4 h-4 mr-2" />
              INJECT SHOCK
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 font-mono bg-card border-border">
            <DropdownMenuLabel className="text-xs text-muted-foreground">SELECT SEVERITY</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-xs hover:bg-accent cursor-pointer" onClick={() => handleInjectShock("low")}>Low Severity</DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-amber-500 hover:bg-accent cursor-pointer" onClick={() => handleInjectShock("medium")}>Medium Severity</DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-red-400 hover:bg-accent cursor-pointer" onClick={() => handleInjectShock("high")}>High Severity</DropdownMenuItem>
            <DropdownMenuItem className="text-xs text-red-600 font-bold hover:bg-accent cursor-pointer" onClick={() => handleInjectShock("catastrophic")}>Catastrophic</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
