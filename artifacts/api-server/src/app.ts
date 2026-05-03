import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedGrid } from "./lib/seedGrid";
import { runSentinelScan } from "./lib/agentOrchestrator";
import { runProbe, NODE_PROBES } from "./lib/nodeMonitor";
import { db } from "@workspace/db";
import { gridNodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

// Probe all nodes and write real metrics to DB
// Skips nodes that are currently in an active incident state (failing/offline/repairing)
// so the AI pipeline can finish its work without being overwritten by a probe.
async function runRealProbes() {
  const nodeIds = Object.keys(NODE_PROBES);
  await Promise.allSettled(
    nodeIds.map(async (nodeId) => {
      try {
        const [node] = await db
          .select()
          .from(gridNodesTable)
          .where(eq(gridNodesTable.id, nodeId))
          .limit(1);

        if (!node) return;

        // Don't override active incident states — let the pipeline manage those
        if (node.status === "failing" || node.status === "offline" || node.status === "repairing") return;

        const result = await runProbe(nodeId);
        if (!result) return;

        await db.update(gridNodesTable).set({
          status:     result.status,
          latency:    result.latency,
          errorRate:  result.errorRate,
          uptime:     result.uptime,
          cpu:        result.cpu,
          memory:     result.memory,
          networkIn:  result.networkIn,
          networkOut: result.networkOut,
          lastUpdated: new Date(),
        }).where(eq(gridNodesTable.id, nodeId));
      } catch (err) {
        logger.error({ err, nodeId }, "Real probe error");
      }
    })
  );
}

async function startBackgroundTasks() {
  await seedGrid().catch((err) => logger.error({ err }, "Failed to seed grid"));

  // Run real probes immediately on startup so metrics reflect actual state
  setTimeout(async () => {
    try {
      logger.info("Running initial real health probes across all 16 nodes...");
      await runRealProbes();
      logger.info("Initial real probe pass complete.");
    } catch (err) {
      logger.error({ err }, "Initial probe pass error");
    }
  }, 3_000);

  // Real health probes every 30 seconds — replaces the fake DB drift
  // Each probe hits a real target: HTTP endpoints, DNS, TCP, TLS, system metrics, file I/O
  setInterval(async () => {
    try {
      await runRealProbes();
    } catch (err) {
      logger.error({ err }, "Periodic real probe error");
    }
  }, 30_000);

  // Auto SENTINEL scan every 45 seconds
  setInterval(async () => {
    try {
      await runSentinelScan();
    } catch (err) {
      logger.error({ err }, "Auto-scan error");
    }
  }, 45_000);
}

startBackgroundTasks();

export default app;
