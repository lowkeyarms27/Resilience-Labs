import React, { useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { GridMap } from "@/components/layout/grid-map";
import { AgentLogs } from "@/components/layout/agent-logs";
import { CommandConsole } from "@/components/layout/command-console";
import { ApprovalQueue } from "@/components/layout/approval-queue";
import { useAgentLogs } from "@/hooks/use-agent-logs";

export default function Dashboard() {
  const [consoleOpen, setConsoleOpen] = useState(false);
  const { logs, thinking, approvals } = useAgentLogs();

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground selection:bg-primary/30">
      <TopBar
        onToggleConsole={() => setConsoleOpen((v) => !v)}
        consoleOpen={consoleOpen}
      />
      <div className="flex-1 flex overflow-hidden">
        <GridMap />
        <AgentLogs logs={logs} thinking={thinking} />
      </div>
      {consoleOpen && <CommandConsole onClose={() => setConsoleOpen(false)} />}
      <ApprovalQueue approvals={approvals} />
    </div>
  );
}
