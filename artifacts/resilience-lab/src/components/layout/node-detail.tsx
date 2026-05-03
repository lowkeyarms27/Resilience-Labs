import React from "react";
import { type GridNode } from "@workspace/api-client-react";
import { useRepairNode, getGetGridStateQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { X, AlertTriangle, CheckCircle, ShieldAlert, Zap, Wifi, Wrench, Cpu, MemoryStick, Activity, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/date-utils";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  healthy:   { label: "NOMINAL",    color: "text-green-400 bg-green-400/10 border-green-400/30",   icon: <CheckCircle className="w-4 h-4" /> },
  degraded:  { label: "DEGRADED",   color: "text-amber-400 bg-amber-400/10 border-amber-400/30",   icon: <AlertTriangle className="w-4 h-4" /> },
  failing:   { label: "CRITICAL",   color: "text-red-400 bg-red-400/10 border-red-400/30",         icon: <ShieldAlert className="w-4 h-4" /> },
  repairing: { label: "REPAIRING",  color: "text-blue-400 bg-blue-400/10 border-blue-400/30",      icon: <Zap className="w-4 h-4" /> },
  offline:   { label: "OFFLINE",    color: "text-gray-500 bg-gray-500/10 border-gray-500/30",      icon: <Wifi className="w-4 h-4 opacity-50" /> },
};

const NODE_TYPES: Record<string, { type: string; role: string; stack: string }> = {
  "node-01": { type: "CORE",     role: "Primary routing backbone. Handles inter-zone traffic distribution.",         stack: "Kubernetes / BGP" },
  "node-02": { type: "CORE",     role: "Secondary routing backbone. Failover partner to Alpha-Prime.",               stack: "Kubernetes / BGP" },
  "node-03": { type: "EDGE",     role: "External traffic ingress/egress. Faces public network boundary.",            stack: "nginx / Envoy" },
  "node-04": { type: "HUB",      role: "Central aggregation point for Sector B services.",                          stack: "AWS ALB / ECS" },
  "node-05": { type: "NODE",     role: "General-purpose compute node for distributed workloads.",                    stack: "Kubernetes" },
  "node-06": { type: "RELAY",    role: "Traffic relay between core and edge infrastructure.",                        stack: "HAProxy" },
  "node-07": { type: "GATEWAY",  role: "API gateway. Routes external requests to internal services.",                stack: "Kong / AWS API GW" },
  "node-08": { type: "BRIDGE",   role: "Cross-zone bridge. Connects Sector A to Sector B.",                         stack: "Istio / Calico" },
  "node-09": { type: "MESH",     role: "Service mesh controller. Manages inter-service communication.",              stack: "Istio / Linkerd" },
  "node-10": { type: "VAULT",    role: "Encrypted secrets store. Manages credentials and certificates.",             stack: "HashiCorp Vault" },
  "node-11": { type: "CACHE",    role: "Distributed cache layer. Reduces backend load by ~40%.",                    stack: "Redis Cluster" },
  "node-12": { type: "SHIELD",   role: "Security enforcement point. Handles WAF and DDoS mitigation.",              stack: "CrowdSec / AWS WAF" },
  "node-13": { type: "FIREWALL", role: "Network perimeter firewall. First line of defence.",                         stack: "nftables / firewalld" },
  "node-14": { type: "CLUSTER",  role: "Compute cluster orchestrator. Manages job scheduling.",                      stack: "Kubernetes / Nomad" },
  "node-15": { type: "LINK",     role: "Peering link to upstream providers. Critical uptime dependency.",            stack: "BGP / Route53" },
  "node-16": { type: "SENTINEL", role: "Monitoring node. Houses telemetry collectors and alerting.",                 stack: "Prometheus / Vector" },
};

function MetricRow({ label, value, danger, warn }: { label: string; value: string; danger?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
      <span className="text-[10px] text-muted-foreground font-mono tracking-wider">{label}</span>
      <span className={cn("text-[10px] font-mono font-bold", danger ? "text-red-400" : warn ? "text-amber-400" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function GaugeBar({ label, value, max = 100, icon, danger, warn }: {
  label: string; value: number; max?: number; icon: React.ReactNode; danger?: boolean; warn?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const color = danger ? "bg-red-500" : warn ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-1.5 text-[10px] font-mono tracking-wider", danger ? "text-red-400" : warn ? "text-amber-400" : "text-muted-foreground")}>
          {icon}
          {label}
        </div>
        <span className={cn("text-[10px] font-mono font-bold", danger ? "text-red-400" : warn ? "text-amber-400" : "text-foreground")}>
          {max === 100 ? `${Math.round(value)}%` : `${Math.round(value)} Mbps`}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface NodeDetailProps {
  node: GridNode;
  onClose: () => void;
}

export function NodeDetail({ node, onClose }: NodeDetailProps) {
  const queryClient = useQueryClient();
  const repairNode = useRepairNode({
    mutation: {
      onSuccess: () => {
        toast.success(`Repair dispatched to ${node.name}`);
        queryClient.invalidateQueries({ queryKey: getGetGridStateQueryKey() });
        onClose();
      },
    },
  });

  const cfg = STATUS_CONFIG[node.status] ?? STATUS_CONFIG.healthy;
  const nodeMeta = NODE_TYPES[node.id] ?? { type: "NODE", role: "Infrastructure node.", stack: "Unknown" };

  const cpu = (node as GridNode & { cpu?: number }).cpu ?? 30;
  const memory = (node as GridNode & { memory?: number }).memory ?? 40;
  const networkIn = (node as GridNode & { networkIn?: number }).networkIn ?? 100;
  const networkOut = (node as GridNode & { networkOut?: number }).networkOut ?? 80;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[440px] bg-card border border-border rounded-lg font-mono shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-muted-foreground tracking-widest">{nodeMeta.type}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground tracking-widest">{node.id.toUpperCase()}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-primary/70 tracking-widest">{nodeMeta.stack}</span>
            </div>
            <h2 className="text-lg font-bold tracking-wide text-foreground">{node.name}</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{nodeMeta.role}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:text-destructive transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status */}
        <div className="px-5 pt-4 pb-3">
          <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-bold tracking-widest", cfg.color)}>
            {cfg.icon}
            {cfg.label}
          </div>
        </div>

        {/* Resource utilization */}
        <div className="px-5 pb-4">
          <div className="text-[10px] text-muted-foreground tracking-widest mb-3 font-bold border-b border-border/40 pb-2">RESOURCE UTILIZATION</div>
          <div className="space-y-3">
            <GaugeBar label="CPU" value={cpu} icon={<Cpu className="w-3 h-3" />} danger={cpu > 90} warn={cpu > 70} />
            <GaugeBar label="MEMORY" value={memory} icon={<MemoryStick className="w-3 h-3" />} danger={memory > 90} warn={memory > 75} />
            <GaugeBar label="NETWORK IN" value={networkIn} max={1000} icon={<Network className="w-3 h-3" />} danger={networkIn > 900} warn={networkIn > 700} />
            <GaugeBar label="NETWORK OUT" value={networkOut} max={1000} icon={<Activity className="w-3 h-3" />} danger={networkOut > 900} warn={networkOut > 700} />
          </div>
        </div>

        {/* Performance metrics */}
        <div className="px-5 pb-4">
          <div className="text-[10px] text-muted-foreground tracking-widest mb-2 font-bold border-b border-border/40 pb-2">PERFORMANCE METRICS</div>
          <MetricRow label="LATENCY" value={`${Math.round(node.latency)}ms`} danger={node.latency > 500} warn={node.latency > 100} />
          <div className="pb-2 border-b border-border/40">
            <div className="mt-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", node.latency > 500 ? "bg-red-500" : node.latency > 100 ? "bg-amber-500" : "bg-green-500")}
                style={{ width: `${Math.min(100, (node.latency / 1000) * 100)}%` }}
              />
            </div>
          </div>
          <MetricRow label="ERROR RATE" value={`${(node.errorRate * 100).toFixed(2)}%`} danger={node.errorRate > 0.1} warn={node.errorRate > 0.02} />
          <MetricRow label="UPTIME" value={`${node.uptime.toFixed(3)}%`} danger={node.uptime < 90} warn={node.uptime < 98} />
          <MetricRow label="LAST UPDATED" value={new Date(node.lastUpdated).toLocaleTimeString()} />
          {node.assignedAgent && <MetricRow label="ASSIGNED AGENT" value={node.assignedAgent.toUpperCase()} />}
        </div>

        {/* Thresholds */}
        <div className="mx-5 mb-4 p-3 bg-background/40 rounded border border-border/50">
          <div className="text-[10px] text-muted-foreground tracking-widest mb-2 font-bold">ALERT THRESHOLDS</div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="text-green-400">✓ Normal<br/><span className="text-muted-foreground">CPU&lt;70% / Lat&lt;100ms</span></div>
            <div className="text-amber-400">⚠ Degraded<br/><span className="text-muted-foreground">CPU&lt;90% / Lat&lt;500ms</span></div>
            <div className="text-red-400">✗ Critical<br/><span className="text-muted-foreground">CPU&gt;90% / Lat&gt;500ms</span></div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          {(node.status === "failing" || node.status === "degraded") && !node.assignedAgent && (
            <Button variant="destructive" size="sm" className="flex-1 font-mono tracking-widest text-xs font-bold"
              onClick={() => repairNode.mutate({ nodeId: node.id })} disabled={repairNode.isPending}>
              <Wrench className="w-3.5 h-3.5 mr-2" />
              {repairNode.isPending ? "DISPATCHING…" : "DISPATCH REMEDIATOR"}
            </Button>
          )}
          {node.status === "offline" && (
            <Button variant="outline" size="sm" className="flex-1 font-mono tracking-widest text-xs border-amber-400/50 text-amber-400 hover:bg-amber-400/10"
              onClick={() => repairNode.mutate({ nodeId: node.id })} disabled={repairNode.isPending}>
              <Zap className="w-3.5 h-3.5 mr-2" />
              POWER RESTORE
            </Button>
          )}
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={onClose}>
            CLOSE
          </Button>
        </div>
      </div>
    </div>
  );
}
