import React, { useState } from "react";
import { useGetGridState, useRepairNode, getGetGridStateQueryKey } from "@workspace/api-client-react";
import { type GridNode, type NodeStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Server, Activity, AlertTriangle, Zap, CheckCircle, ShieldAlert, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/date-utils";
import { toast } from "sonner";
import { NodeDetail } from "./node-detail";

const NODE_TYPES: Record<string, string> = {
  "node-01": "CORE", "node-02": "CORE", "node-03": "EDGE", "node-04": "HUB",
  "node-05": "NODE", "node-06": "RELAY", "node-07": "GATEWAY", "node-08": "BRIDGE",
  "node-09": "MESH", "node-10": "VAULT", "node-11": "CACHE", "node-12": "SHIELD",
  "node-13": "FIREWALL", "node-14": "CLUSTER", "node-15": "LINK", "node-16": "SENTINEL",
};

export function GridMap() {
  const { data: gridState } = useGetGridState({
    query: { queryKey: getGetGridStateQueryKey(), refetchInterval: 2000 },
  });
  const [selectedNode, setSelectedNode] = useState<GridNode | null>(null);

  const nodes = gridState?.nodes ?? [];
  const failingCount = nodes.filter(n => n.status === "failing" || n.status === "offline").length;
  const degradedCount = nodes.filter(n => n.status === "degraded").length;
  const hasIncident = failingCount > 0 || degradedCount > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {hasIncident && (
        <div className={cn(
          "font-mono text-xs border-b px-6 py-2 flex items-center gap-3 shrink-0",
          failingCount > 0
            ? "bg-red-950/60 border-red-500/40 text-red-400"
            : "bg-amber-950/40 border-amber-500/30 text-amber-400"
        )}>
          <ShieldAlert className={cn("w-4 h-4 shrink-0", failingCount > 0 && "pulse-red")} />
          <span className="font-bold tracking-wider uppercase">
            {failingCount > 0
              ? `⚠ CRITICAL INCIDENT — ${failingCount} node${failingCount > 1 ? "s" : ""} failing`
              : `⚠ DEGRADED PERFORMANCE — ${degradedCount} node${degradedCount > 1 ? "s" : ""} impacted`}
          </span>
          <span className="opacity-60 ml-auto">AUTONOMOUS REPAIR IN PROGRESS</span>
        </div>
      )}

      <div className="flex-1 p-6 overflow-y-auto relative">
        <div className="scanline" />
        <div className="grid grid-cols-4 gap-4 max-w-6xl mx-auto">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onClick={() => setSelectedNode(node)}
            />
          ))}
        </div>
      </div>

      {selectedNode && (
        <NodeDetail
          node={nodes.find(n => n.id === selectedNode.id) ?? selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

function latencyBarWidth(latency: number): string {
  if (latency < 50)  return `${Math.round((latency / 50) * 30)}%`;
  if (latency < 200) return `${30 + Math.round(((latency - 50) / 150) * 40)}%`;
  return `${70 + Math.min(30, Math.round(((latency - 200) / 800) * 30))}%`;
}

function latencyBarColor(latency: number): string {
  if (latency < 100) return "bg-green-500";
  if (latency < 300) return "bg-amber-500";
  return "bg-red-500";
}

function NodeCard({ node, onClick }: { node: GridNode; onClick: () => void }) {
  const queryClient = useQueryClient();
  const repairNode = useRepairNode({
    mutation: {
      onSuccess: () => {
        toast.success(`Repair initiated for ${node.name}`);
        queryClient.invalidateQueries({ queryKey: getGetGridStateQueryKey() });
      },
    },
  });

  const getCardClass = (status: NodeStatus) => {
    switch (status) {
      case "healthy":   return "border-green-500/25 bg-green-500/5 text-green-400 hover:border-green-400/60 hover:shadow-[0_0_20px_rgba(0,255,136,0.08)]";
      case "degraded":  return "border-amber-500/50 bg-amber-500/8 text-amber-400 hover:border-amber-400/80";
      case "failing":   return "border-red-500/80 bg-red-500/10 text-red-400 pulse-red cursor-pointer";
      case "repairing": return "border-blue-500/50 bg-blue-500/8 text-blue-400 sweep-blue";
      case "offline":   return "border-gray-700/50 bg-gray-900/30 text-gray-600 opacity-50";
      default:          return "border-border bg-card";
    }
  };

  const getStatusIcon = (status: NodeStatus) => {
    switch (status) {
      case "healthy":   return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "degraded":  return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case "failing":   return <ShieldAlert className="w-4 h-4 text-red-400" />;
      case "repairing": return <Zap className="w-4 h-4 text-blue-400" />;
      case "offline":   return <Wifi className="w-4 h-4 opacity-40" />;
      default:          return <Server className="w-4 h-4" />;
    }
  };

  const statusLabel: Record<NodeStatus, string> = {
    healthy: "NOMINAL", degraded: "DEGRADED", failing: "CRITICAL",
    repairing: "REPAIRING", offline: "OFFLINE",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-lg border p-4 flex flex-col gap-3 font-mono transition-all duration-500 group cursor-pointer",
        getCardClass(node.status)
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20 rounded-lg pointer-events-none" />

      <div className="relative z-10 flex justify-between items-start">
        <div className="min-w-0">
          <div className="mb-0.5">
            <span className="text-[9px] opacity-50 tracking-widest font-bold">
              {NODE_TYPES[node.id] ?? "NODE"}
            </span>
          </div>
          <h3 className="font-bold text-sm tracking-wide text-foreground truncate group-hover:text-current transition-colors">
            {node.name}
          </h3>
          <p className="text-[10px] opacity-40 font-mono">{node.id.toUpperCase()}</p>
        </div>
        <div className="p-1.5 rounded bg-background/40 backdrop-blur-sm shrink-0">
          {getStatusIcon(node.status)}
        </div>
      </div>

      <div className="relative z-10 space-y-2.5 text-xs">
        <div>
          <div className="flex justify-between items-center opacity-70 mb-1">
            <span className="text-[10px] tracking-wider">LATENCY</span>
            <span className={cn("font-bold", node.latency > 300 ? "text-red-400" : node.latency > 100 ? "text-amber-400" : "")}>
              {Math.round(node.latency)}ms
            </span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full latency-bar-fill", latencyBarColor(node.latency))}
              style={{ width: latencyBarWidth(node.latency) }}
            />
          </div>
        </div>
        <div className="flex justify-between items-center opacity-70">
          <span className="text-[10px] tracking-wider">UPTIME</span>
          <span className={node.uptime < 90 ? "text-red-400 font-bold" : ""}>{node.uptime.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between items-center opacity-70">
          <span className="text-[10px] tracking-wider">ERR_RATE</span>
          <span className={node.errorRate > 0.05 ? "text-red-400 font-bold" : node.errorRate > 0.01 ? "text-amber-400" : ""}>
            {(node.errorRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="relative z-10 pt-2.5 border-t border-current/15 flex items-center justify-between">
        <span className={cn(
          "text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded",
          node.status === "healthy"   ? "text-green-400 bg-green-400/10" :
          node.status === "degraded"  ? "text-amber-400 bg-amber-400/10" :
          node.status === "failing"   ? "text-red-400 bg-red-400/10" :
          node.status === "repairing" ? "text-blue-400 bg-blue-400/10" :
                                        "text-gray-500 bg-gray-500/10"
        )}>
          {statusLabel[node.status]}
        </span>

        {node.assignedAgent ? (
          <span className="text-[10px] text-blue-400 flex items-center gap-1 opacity-80">
            <Activity className="w-2.5 h-2.5" />
            {node.assignedAgent.toUpperCase()}
          </span>
        ) : (node.status === "failing" || node.status === "degraded") ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] font-bold tracking-wider border-current/40 hover:bg-current/10 px-2"
            onClick={(e) => { e.stopPropagation(); repairNode.mutate({ nodeId: node.id }); }}
            disabled={repairNode.isPending}
          >
            {repairNode.isPending ? "…" : "OVERRIDE"}
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground/40 tracking-wider">CLICK TO INSPECT</span>
        )}
      </div>
    </div>
  );
}
