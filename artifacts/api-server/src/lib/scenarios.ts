import { db } from "@workspace/db";
import { gridNodesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { persistLog, runSentinelScan } from "./agentOrchestrator";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() {
  return new Date().toISOString();
}

export type ScenarioId = "ddos_surge" | "cascade_failure" | "zero_day" | "power_outage" | "ransomware_wave";

export const SCENARIO_META: Record<ScenarioId, { name: string; description: string; icon: string }> = {
  ddos_surge:       { name: "DDoS SURGE",        description: "Flood attack on edge infrastructure",      icon: "⚡" },
  cascade_failure:  { name: "CASCADE FAILURE",    description: "Chain reaction collapse through mesh",     icon: "🔗" },
  zero_day:         { name: "ZERO-DAY EXPLOIT",   description: "Critical vulnerability weaponised",        icon: "☠" },
  power_outage:     { name: "POWER GRID OUTAGE",  description: "Sector power loss — nodes go dark",        icon: "🔌" },
  ransomware_wave:  { name: "RANSOMWARE WAVE",    description: "Encryption malware propagating",           icon: "💀" },
};

export async function runScenario(scenarioId: ScenarioId): Promise<{ affectedNodes: string[]; scenarioName: string }> {
  const nodes = await db.select().from(gridNodesTable);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  switch (scenarioId) {
    case "ddos_surge": {
      const targetIds = ["node-03", "node-06", "node-07", "node-13", "node-15"];
      for (const id of targetIds) {
        if (!byId[id]) continue;
        await db.update(gridNodesTable).set({
          status: "degraded", latency: 800 + Math.random() * 400,
          errorRate: 0.35 + Math.random() * 0.2, uptime: 70 + Math.random() * 15, lastUpdated: new Date(),
        }).where(eq(gridNodesTable.id, id));
      }
      await persistLog({
        id: makeId(), timestamp: nowIso(), agent: "system", level: "critical",
        message: "⚡ DDoS SURGE DETECTED — Malicious flood traffic overwhelming edge nodes. Gamma-Edge, Zeta-Relay, Eta-Gateway, Nu-Firewall, Omicron-Link degraded.",
        metadata: { scenario: "ddos_surge", affectedNodes: targetIds },
      });
      setTimeout(() => runSentinelScan(), 600);
      return { affectedNodes: targetIds, scenarioName: SCENARIO_META.ddos_surge.name };
    }

    case "cascade_failure": {
      const wave1 = ["node-04"];
      const wave2 = ["node-08", "node-11"];
      const wave3 = ["node-15", "node-09"];

      const applyWave = async (ids: string[], status: "failing" | "degraded") => {
        for (const id of ids) {
          if (!byId[id]) continue;
          await db.update(gridNodesTable).set({
            status, latency: 600 + Math.random() * 600, errorRate: 0.5 + Math.random() * 0.4,
            uptime: 40 + Math.random() * 20, lastUpdated: new Date(),
          }).where(eq(gridNodesTable.id, id));
        }
      };

      await applyWave(wave1, "failing");
      await persistLog({
        id: makeId(), timestamp: nowIso(), agent: "system", level: "critical",
        message: "🔗 CASCADE FAILURE INITIATED — Delta-Hub critical. Propagation wave beginning.",
        metadata: { scenario: "cascade_failure" },
      });
      setTimeout(async () => { await applyWave(wave2, "failing"); }, 1500);
      setTimeout(async () => { await applyWave(wave3, "degraded"); }, 3000);
      setTimeout(() => runSentinelScan(), 3500);

      return { affectedNodes: [...wave1, ...wave2, ...wave3], scenarioName: SCENARIO_META.cascade_failure.name };
    }

    case "zero_day": {
      const shuffled = [...nodes].sort(() => Math.random() - 0.5);
      const targets = shuffled.slice(0, 4);
      for (const node of targets) {
        await db.update(gridNodesTable).set({
          status: "failing", latency: 1200 + Math.random() * 600, errorRate: 0.7 + Math.random() * 0.3,
          uptime: 20 + Math.random() * 20, lastUpdated: new Date(),
        }).where(eq(gridNodesTable.id, node.id));
      }
      await persistLog({
        id: makeId(), timestamp: nowIso(), agent: "system", level: "critical",
        message: `☠ ZERO-DAY EXPLOIT ACTIVE — CVE-2025-UNKNOWN weaponised. ${targets.map((n) => n.name).join(", ")} compromised. Attackers have root access.`,
        metadata: { scenario: "zero_day", affectedNodes: targets.map((n) => n.id) },
      });
      setTimeout(() => runSentinelScan(), 600);
      return { affectedNodes: targets.map((n) => n.id), scenarioName: SCENARIO_META.zero_day.name };
    }

    case "power_outage": {
      const targetIds = ["node-01", "node-02", "node-05", "node-06", "node-09", "node-10"];
      for (const id of targetIds) {
        if (!byId[id]) continue;
        await db.update(gridNodesTable).set({
          status: "offline", latency: 9999, errorRate: 1.0, uptime: 0, lastUpdated: new Date(),
        }).where(eq(gridNodesTable.id, id));
      }
      await persistLog({
        id: makeId(), timestamp: nowIso(), agent: "system", level: "critical",
        message: "🔌 POWER GRID OUTAGE — Sector A & B power feed lost. Alpha-Prime, Beta-Core, Epsilon-Node, Zeta-Relay, Iota-Mesh, Kappa-Vault offline.",
        metadata: { scenario: "power_outage", affectedNodes: targetIds },
      });
      setTimeout(() => runSentinelScan(), 600);
      return { affectedNodes: targetIds, scenarioName: SCENARIO_META.power_outage.name };
    }

    case "ransomware_wave": {
      const allIds = nodes.map((n) => n.id);
      await persistLog({
        id: makeId(), timestamp: nowIso(), agent: "system", level: "critical",
        message: "💀 RANSOMWARE WAVE INITIATED — Encryption malware detected in network fabric. Propagating across all nodes.",
        metadata: { scenario: "ransomware_wave" },
      });
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        setTimeout(async () => {
          await db.update(gridNodesTable).set({
            status: "degraded", latency: 400 + Math.random() * 300,
            errorRate: 0.2 + Math.random() * 0.3, uptime: 60 + Math.random() * 20, lastUpdated: new Date(),
          }).where(eq(gridNodesTable.id, node.id));
        }, i * 400);
      }
      setTimeout(() => runSentinelScan(), nodes.length * 400 + 500);
      return { affectedNodes: allIds, scenarioName: SCENARIO_META.ransomware_wave.name };
    }
  }
}
