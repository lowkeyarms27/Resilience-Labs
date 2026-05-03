import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedGrid } from "./lib/seedGrid";
import { runSentinelScan } from "./lib/agentOrchestrator";
import { db } from "@workspace/db";
import { gridNodesTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

async function startBackgroundTasks() {
  await seedGrid().catch((err) => logger.error({ err }, "Failed to seed grid"));

  // Auto-scan every 45 seconds
  setInterval(async () => {
    try {
      await runSentinelScan();
    } catch (err) {
      logger.error({ err }, "Auto-scan error");
    }
  }, 45_000);

  // Node health drift every 12 seconds — healthy nodes fluctuate slightly
  setInterval(async () => {
    try {
      const nodes = await db
        .select()
        .from(gridNodesTable)
        .where(and(eq(gridNodesTable.status, "healthy"), ne(gridNodesTable.assignedAgent, "engineer")));

      for (const node of nodes) {
        const drift = Math.random();
        if (drift < 0.15) {
          // 15% chance: small latency / error-rate nudge
          await db.update(gridNodesTable).set({
            latency: Math.max(8, node.latency + (Math.random() - 0.5) * 8),
            errorRate: Math.max(0, Math.min(0.05, node.errorRate + (Math.random() - 0.5) * 0.003)),
            lastUpdated: new Date(),
          }).where(eq(gridNodesTable.id, node.id));
        }
      }
    } catch (err) {
      logger.error({ err }, "Node drift error");
    }
  }, 12_000);
}

startBackgroundTasks();

export default app;
