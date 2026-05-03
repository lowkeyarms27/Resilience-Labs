import React, { useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { GridMap } from "@/components/layout/grid-map";
import { AgentLogs } from "@/components/layout/agent-logs";
import { CommandConsole } from "@/components/layout/command-console";

export default function Dashboard() {
  const [consoleOpen, setConsoleOpen] = useState(false);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground selection:bg-primary/30">
      <TopBar
        onToggleConsole={() => setConsoleOpen((v) => !v)}
        consoleOpen={consoleOpen}
      />
      <div className="flex-1 flex overflow-hidden">
        <GridMap />
        <AgentLogs />
      </div>
      {consoleOpen && <CommandConsole onClose={() => setConsoleOpen(false)} />}
    </div>
  );
}
