import React, { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { GridMap } from "@/components/layout/grid-map";
import { AgentLogs } from "@/components/layout/agent-logs";
import { CommandConsole } from "@/components/layout/command-console";
import { ApprovalQueue } from "@/components/layout/approval-queue";
import { CommandPalette } from "@/components/layout/command-palette";
import { AgentStatusStrip } from "@/components/layout/agent-status-strip";
import { useAgentLogs } from "@/hooks/use-agent-logs";
import { useTriggerSentinelScan, useInjectShock, getGetGridStateQueryKey, getGetGridSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Dashboard() {
  const [consoleOpen, setPaletteOpen]  = useState(false);
  const [paletteOpen, setConsoleOpen]  = useState(false);
  const { logs, thinking, approvals }  = useAgentLogs();
  const queryClient = useQueryClient();

  const triggerScan = useTriggerSentinelScan({
    mutation: {
      onSuccess: () => toast.success("Sentinel scan initiated."),
      onError:   () => toast.error("Failed to trigger scan."),
    },
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

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    const isInput = tag === "input" || tag === "textarea";

    // Ctrl+K / Cmd+K — command palette
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setConsoleOpen((v) => !v);
      return;
    }

    if (isInput || paletteOpen || consoleOpen) return;

    if (e.key === "t" || e.key === "T") { triggerScan.mutate(); }
    if (e.key === "c" || e.key === "C") { setPaletteOpen((v) => !v); }
    if (e.key === "i" || e.key === "I") { injectShock.mutate({ data: { severity: "medium" } }); }
    if (e.key === "Escape")             { setPaletteOpen(false); }
  }, [paletteOpen, consoleOpen, triggerScan, injectShock]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground selection:bg-primary/30">
      <TopBar
        onToggleConsole={() => setPaletteOpen((v) => !v)}
        consoleOpen={consoleOpen}
        onOpenPalette={() => setConsoleOpen(true)}
        logs={logs}
      />

      <AgentStatusStrip logs={logs} thinking={thinking} />

      <div className="flex-1 flex overflow-hidden">
        <GridMap />
        <AgentLogs logs={logs} thinking={thinking} />
      </div>

      {consoleOpen && <CommandConsole onClose={() => setPaletteOpen(false)} />}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setConsoleOpen(false)}
        onOpenConsole={() => { setConsoleOpen(false); setPaletteOpen(true); }}
      />

      <ApprovalQueue approvals={approvals} />

      {/* Keyboard shortcut hint — bottom left */}
      <div className="fixed bottom-3 left-4 font-mono text-[10px] text-muted-foreground/30 flex items-center gap-2 pointer-events-none">
        <kbd className="border border-border/30 rounded px-1">⌘K</kbd>
        <span>command palette</span>
        <span className="mx-1">·</span>
        <kbd className="border border-border/30 rounded px-1">T</kbd>
        <span>scan</span>
        <span className="mx-1">·</span>
        <kbd className="border border-border/30 rounded px-1">C</kbd>
        <span>console</span>
      </div>
    </div>
  );
}
