import { pgTable, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nodeStatusEnum = pgEnum("node_status", [
  "healthy",
  "degraded",
  "failing",
  "repairing",
  "offline",
]);

export const gridNodesTable = pgTable("grid_nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: nodeStatusEnum("status").notNull().default("healthy"),
  latency: real("latency").notNull().default(0),
  errorRate: real("error_rate").notNull().default(0),
  uptime: real("uptime").notNull().default(100),
  cpu: real("cpu").notNull().default(30),
  memory: real("memory").notNull().default(40),
  networkIn: real("network_in").notNull().default(100),
  networkOut: real("network_out").notNull().default(80),
  assignedAgent: text("assigned_agent"),
  lastUpdated: timestamp("last_updated", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertGridNodeSchema = createInsertSchema(gridNodesTable);
export type InsertGridNode = z.infer<typeof insertGridNodeSchema>;
export type GridNodeRow = typeof gridNodesTable.$inferSelect;
