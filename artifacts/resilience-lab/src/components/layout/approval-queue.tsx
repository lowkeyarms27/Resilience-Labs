import React, { useState } from "react";
import { ShieldAlert, Check, X, Terminal, ChevronDown, ChevronUp, AlertTriangle, Cpu } from "lucide-react";
import { cn } from "@/lib/date-utils";
import { type ApprovalRequest } from "@/hooks/use-agent-logs";
import { toast } from "sonner";

const RISK_CONFIG = {
  low:    { color: "text-green-400",  bg: "bg-green-400/10  border-green-400/30",  label: "LOW" },
  medium: { color: "text-amber-400",  bg: "bg-amber-400/10  border-amber-400/30",  label: "MED" },
  high:   { color: "text-red-400",    bg: "bg-red-400/10    border-red-400/30",    label: "HIGH" },
};

interface ApprovalCardProps {
  req: ApprovalRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function ApprovalCard({ req, onApprove, onReject }: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const risk = RISK_CONFIG[req.riskLevel];

  const handle = async (action: "approve" | "reject") => {
    setLoading(action);
    try {
      if (action === "approve") onApprove(req.id);
      else onReject(req.id);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="border border-amber-400/30 bg-amber-400/5 rounded font-mono text-xs">
      {/* Header */}
      <div className="p-3 flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-amber-400 tracking-wide">{req.nodeName}</span>
            <div className="flex items-center gap-1.5">
              <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-bold tracking-widest", risk.bg, risk.color)}>
                {risk.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{req.confidence}% conf</span>
            </div>
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed line-clamp-2">{req.action}</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-muted-foreground">CONFIDENCE</span>
          <span className={cn("text-[10px] font-bold", req.confidence >= 75 ? "text-green-400" : req.confidence >= 50 ? "text-amber-400" : "text-red-400")}>
            {req.confidence}%
          </span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", req.confidence >= 75 ? "bg-green-500" : req.confidence >= 50 ? "bg-amber-500" : "bg-red-500")}
            style={{ width: `${req.confidence}%` }}
          />
        </div>
      </div>

      {/* Expandable section */}
      <button
        className="w-full px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground border-t border-amber-400/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Terminal className="w-3 h-3" />
        VIEW INFRA COMMANDS ({req.infraCommands.length})
        {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          <div className="text-[10px] text-muted-foreground mb-2 border-t border-amber-400/10 pt-2">
            JUSTIFICATION: <span className="text-foreground/70">{req.justification}</span>
          </div>
          {req.infraCommands.map((cmd, i) => (
            <div key={i} className="bg-background/60 rounded px-2 py-1.5 text-[10px] text-green-300 break-all border border-border/30">
              <span className="text-muted-foreground select-none">$ </span>{cmd}
            </div>
          ))}
        </div>
      )}

      {/* Approve / Reject */}
      <div className="px-3 pb-3 pt-1 flex gap-2">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-green-400/40 bg-green-400/10 text-green-400 text-[11px] font-bold tracking-widest hover:bg-green-400/20 transition-colors disabled:opacity-50"
          onClick={() => handle("approve")}
          disabled={loading !== null}
        >
          <Check className="w-3 h-3" />
          {loading === "approve" ? "APPROVING…" : "APPROVE"}
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-red-400/40 bg-red-400/10 text-red-400 text-[11px] font-bold tracking-widest hover:bg-red-400/20 transition-colors disabled:opacity-50"
          onClick={() => handle("reject")}
          disabled={loading !== null}
        >
          <X className="w-3 h-3" />
          {loading === "reject" ? "REJECTING…" : "REJECT"}
        </button>
      </div>
    </div>
  );
}

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
}

export function ApprovalQueue({ approvals }: ApprovalQueueProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (approvals.length === 0) return null;

  const approve = async (id: string) => {
    await fetch(`/api/agents/approvals/${id}/approve`, { method: "POST" });
    toast.success("Repair approved — REMEDIATOR dispatched");
  };

  const reject = async (id: string) => {
    await fetch(`/api/agents/approvals/${id}/reject`, { method: "POST" });
    toast.warning("Repair rejected — node remains in current state");
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-96 font-mono shadow-2xl">
      {/* Toggle header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-black rounded-t font-bold text-xs tracking-widest hover:bg-amber-400 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
        HUMAN APPROVAL REQUIRED
        <span className="ml-1 bg-black/30 text-white rounded px-1.5 py-0.5 text-[10px]">{approvals.length}</span>
        <span className="ml-auto">{collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>

      {!collapsed && (
        <div className="bg-card border border-amber-400/30 border-t-0 rounded-b max-h-[70vh] overflow-y-auto space-y-0 divide-y divide-border/30">
          <div className="px-3 py-2 bg-amber-400/5 border-b border-amber-400/20">
            <div className="flex items-center gap-2 text-[10px] text-amber-400/80">
              <Cpu className="w-3 h-3" />
              <span>DIAGNOSTICIAN flagged these actions as requiring operator sign-off before REMEDIATOR executes.</span>
            </div>
          </div>
          <div className="p-3 space-y-3">
            {approvals.map((req) => (
              <ApprovalCard key={req.id} req={req} onApprove={approve} onReject={reject} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
