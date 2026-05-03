import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  useInjectShock, useTriggerSentinelScan,
  getGetGridStateQueryKey, getGetGridSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Terminal, Radio, Zap, ShieldAlert, Wrench, Search, ArrowRight, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/date-utils";

type Cmd = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  keywords: string[];
  shortcut?: string;
};

const STATIC_COMMANDS: Cmd[] = [
  { id: "scan",               label: "Trigger Sentinel Scan",       description: "Run immediate full-grid health scan",            icon: <Radio className="w-4 h-4" />,       category: "AGENT",      keywords: ["scan","sentinel","grid","check"],                   shortcut: "T" },
  { id: "console",            label: "Open Agent Console",          description: "Open the interactive agent command console",      icon: <Terminal className="w-4 h-4" />,     category: "NAVIGATION", keywords: ["console","terminal","chat","command"],               shortcut: "C" },
  { id: "inject:low",         label: "Inject Shock — Low",          description: "Inject low-severity fault into one node",         icon: <Zap className="w-4 h-4" />,          category: "SIMULATION", keywords: ["inject","shock","fault","low"],                       },
  { id: "inject:medium",      label: "Inject Shock — Medium",       description: "Inject medium-severity fault into 2-3 nodes",     icon: <Zap className="w-4 h-4" />,          category: "SIMULATION", keywords: ["inject","shock","fault","medium"],                    },
  { id: "inject:high",        label: "Inject Shock — High",         description: "Inject high-severity fault, multiple nodes",      icon: <Zap className="w-4 h-4" />,          category: "SIMULATION", keywords: ["inject","shock","fault","high","severe"],             },
  { id: "inject:catastrophic",label: "Inject Shock — Catastrophic", description: "Mass failure event across 40% of the grid",       icon: <Zap className="w-4 h-4 text-red-400" />, category: "SIMULATION", keywords: ["inject","shock","catastrophic","mass","critical"],  shortcut: "!" },
  { id: "scenario:ddos",      label: "Scenario — DDoS Surge",       description: "Simulate flood attack on edge nodes",             icon: <ShieldAlert className="w-4 h-4" />, category: "SCENARIO",   keywords: ["ddos","flood","surge","attack","edge"],               },
  { id: "scenario:cascade",   label: "Scenario — Cascade Failure",  description: "Chain reaction collapse across the mesh",         icon: <ShieldAlert className="w-4 h-4" />, category: "SCENARIO",   keywords: ["cascade","failure","chain","mesh"],                   },
  { id: "scenario:zero_day",  label: "Scenario — Zero-Day Exploit", description: "Critical vulnerability weaponised",               icon: <ShieldAlert className="w-4 h-4" />, category: "SCENARIO",   keywords: ["zero","day","exploit","vuln","critical"],             },
  { id: "scenario:power",     label: "Scenario — Power Grid Outage",description: "Sector power loss affects multiple nodes",        icon: <ShieldAlert className="w-4 h-4" />, category: "SCENARIO",   keywords: ["power","outage","grid","loss"],                       },
  { id: "scenario:ransomware",label: "Scenario — Ransomware Wave",  description: "Malware propagation across infrastructure",       icon: <ShieldAlert className="w-4 h-4" />, category: "SCENARIO",   keywords: ["ransomware","malware","wave","encrypt"],              },
  { id: "help",               label: "Show Keyboard Shortcuts",     description: "View all available keyboard shortcuts",           icon: <Search className="w-4 h-4" />,       category: "HELP",       keywords: ["help","keyboard","shortcuts","?"],                    shortcut: "?" },
];

const categoryColors: Record<string, string> = {
  AGENT:      "text-cyan-400",
  NAVIGATION: "text-blue-400",
  SIMULATION: "text-orange-400",
  SCENARIO:   "text-red-400",
  HELP:       "text-muted-foreground",
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenConsole: () => void;
}

export function CommandPalette({ open, onClose, onOpenConsole }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const injectShock = useInjectShock({
    mutation: {
      onSuccess: (_, vars) => {
        toast.error(`⚡ Shock injected [${vars.data.severity}]`, { duration: 4000 });
        queryClient.invalidateQueries({ queryKey: getGetGridStateQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetGridSummaryQueryKey() });
      },
      onError: () => toast.error("Failed to inject shock."),
    },
  });

  const triggerScan = useTriggerSentinelScan({
    mutation: {
      onSuccess: () => toast.success("Sentinel scan initiated."),
      onError:   () => toast.error("Failed to trigger scan."),
    },
  });

  const filtered = STATIC_COMMANDS.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q))
    );
  });

  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = useCallback((cmd: Cmd) => {
    onClose();
    if (cmd.id === "scan")         return triggerScan.mutate();
    if (cmd.id === "console")      return onOpenConsole();
    if (cmd.id.startsWith("inject:")) {
      const sev = cmd.id.split(":")[1] as "low" | "medium" | "high" | "catastrophic";
      return injectShock.mutate({ data: { severity: sev } });
    }
    if (cmd.id.startsWith("scenario:")) {
      const s = cmd.id.split(":")[1];
      const idMap: Record<string, string> = { ddos: "ddos_surge", cascade: "cascade_failure", zero_day: "zero_day", power: "power_outage", ransomware: "ransomware_wave" };
      fetch("/api/grid/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: idMap[s] ?? s }),
      }).then(async (r) => {
        const d = await r.json() as { scenarioName: string; affectedNodes: string[] };
        toast.error(`⚡ ${d.scenarioName} — ${d.affectedNodes.length} nodes affected`, { duration: 5000 });
        queryClient.invalidateQueries({ queryKey: getGetGridStateQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetGridSummaryQueryKey() });
      }).catch(() => toast.error("Failed to run scenario."));
    }
  }, [onClose, triggerScan, injectShock, onOpenConsole, queryClient]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape")     { onClose(); return; }
      if (e.key === "ArrowDown")  { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp")    { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && filtered[selected]) execute(filtered[selected]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selected, execute, onClose]);

  if (!open) return null;

  // Group by category
  const grouped: Record<string, Cmd[]> = {};
  for (const cmd of filtered) {
    (grouped[cmd.category] ??= []).push(cmd);
  }

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/50 text-foreground"
          />
          <span className="font-mono text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</span>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground font-mono text-xs">
              No commands matching "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([cat, cmds]) => (
              <div key={cat}>
                <div className={cn("px-4 py-1.5 text-[10px] font-mono font-bold tracking-widest", categoryColors[cat] ?? "text-muted-foreground")}>
                  {cat}
                </div>
                {cmds.map((cmd) => {
                  const idx = globalIdx++;
                  const isSelected = idx === selected;
                  return (
                    <div
                      key={cmd.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                        isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/40 text-foreground/80"
                      )}
                      onClick={() => execute(cmd)}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <span className={cn("shrink-0", isSelected ? "text-primary" : "text-muted-foreground")}>
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm font-medium">{cmd.label}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate">{cmd.description}</div>
                      </div>
                      {cmd.shortcut && (
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {cmd.shortcut}
                        </span>
                      )}
                      {isSelected && <ArrowRight className="w-3 h-3 shrink-0 text-primary" />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> select</span>
            <span>↑↓ navigate</span>
            <span>esc close</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {filtered.length} command{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
