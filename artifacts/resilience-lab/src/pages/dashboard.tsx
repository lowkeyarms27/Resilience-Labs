import React from "react";
import { TopBar } from "@/components/layout/top-bar";
import { GridMap } from "@/components/layout/grid-map";
import { AgentLogs } from "@/components/layout/agent-logs";

export default function Dashboard() {
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background text-foreground selection:bg-primary/30">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <GridMap />
        <AgentLogs />
      </div>
    </div>
  );
}
