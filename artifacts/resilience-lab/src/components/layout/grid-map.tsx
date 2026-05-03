import React from "react";
import { useGetGridState, useRepairNode, getGetGridStateQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Server, Activity, AlertTriangle, Zap, CheckCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/date-utils";
import { toast } from "sonner";
import { GridNode, NodeStatus } from "@workspace/api-client-react/src/generated/api.schemas";

export function GridMap() {
  const { data: gridState } = useGetGridState({
    query: {
      queryKey: getGetGridStateQueryKey(),
      refetchInterval: 2000
    }
  });

  return (
    <div className="flex-1 p-8 overflow-y-auto relative">
      <div className="scanline"></div>
      <div className="grid grid-cols-4 gap-6 h-full max-w-6xl mx-auto">
        {gridState?.nodes.map((node) => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}

function NodeCard({ node }: { node: GridNode }) {
  const queryClient = useQueryClient();
  const repairNode = useRepairNode({
    mutation: {
      onSuccess: () => {
        toast.success(`Repair initiated for node ${node.name}`);
        queryClient.invalidateQueries({ queryKey: getGetGridStateQueryKey() });
      }
    }
  });

  const getStatusStyles = (status: NodeStatus) => {
    switch (status) {
      case 'healthy': return 'border-green-500/30 bg-green-500/5 text-green-400 shadow-[0_0_15px_rgba(0,255,136,0.1)]';
      case 'degraded': return 'border-amber-500/50 bg-amber-500/10 text-amber-400';
      case 'failing': return 'border-red-500/80 bg-red-500/10 text-red-500 pulse-red';
      case 'repairing': return 'border-blue-500/50 bg-blue-500/10 text-blue-400 pulse-blue';
      case 'offline': return 'border-gray-800 bg-gray-900/50 text-gray-500 opacity-50';
      default: return 'border-border bg-card';
    }
  };

  const getStatusIcon = (status: NodeStatus) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'failing': return <ShieldAlert className="w-4 h-4" />;
      case 'repairing': return <Zap className="w-4 h-4" />;
      case 'offline': return <Activity className="w-4 h-4 opacity-50" />;
      default: return <Server className="w-4 h-4" />;
    }
  };

  return (
    <div 
      className={cn(
        "relative rounded-lg border p-4 flex flex-col justify-between font-mono transition-all duration-500 overflow-hidden group hover:scale-[1.02]",
        getStatusStyles(node.status)
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-current/5 pointer-events-none" />
      
      <div className="relative z-10 flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-sm tracking-wide text-foreground group-hover:text-primary transition-colors">{node.name}</h3>
          <p className="text-[10px] opacity-70 uppercase tracking-wider">{node.id.substring(0,8)}</p>
        </div>
        <div className={cn("p-1.5 rounded-full bg-background/50 backdrop-blur-sm")}>
          {getStatusIcon(node.status)}
        </div>
      </div>

      <div className="relative z-10 space-y-2 text-xs">
        <div className="flex justify-between items-center opacity-80">
          <span>LATENCY</span>
          <span className={node.latency > 500 ? "text-red-400" : node.latency > 200 ? "text-amber-400" : ""}>
            {Math.round(node.latency)}ms
          </span>
        </div>
        <div className="flex justify-between items-center opacity-80">
          <span>UPTIME</span>
          <span>{node.uptime.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between items-center opacity-80">
          <span>ERR_RATE</span>
          <span className={node.errorRate > 0.1 ? "text-red-400" : ""}>
            {(node.errorRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-4 pt-4 border-t border-current/20 flex flex-col gap-2">
        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
          <span>STATUS:</span>
          <span>{node.status}</span>
        </div>
        
        {node.assignedAgent && (
          <div className="text-[10px] text-primary flex items-center gap-1 opacity-80">
            <Zap className="w-3 h-3" />
            AGENT: {node.assignedAgent.toUpperCase()}
          </div>
        )}

        {(node.status === 'failing' || node.status === 'degraded') && !node.assignedAgent && (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full text-[10px] font-bold tracking-widest mt-2 border-current/50 hover:bg-current/10 h-7"
            onClick={() => repairNode.mutate({ nodeId: node.id })}
            disabled={repairNode.isPending}
          >
            {repairNode.isPending ? "INITIATING..." : "MANUAL OVERRIDE"}
          </Button>
        )}
      </div>
    </div>
  );
}
