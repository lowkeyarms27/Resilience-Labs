import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentEnum = pgEnum("agent_type", [
  "sentinel",
  "engineer",
  "system",
]);

export const logLevelEnum = pgEnum("log_level", [
  "info",
  "warning",
  "critical",
  "action",
  "success",
]);

export const agentLogsTable = pgTable("agent_logs", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  agent: agentEnum("agent").notNull(),
  level: logLevelEnum("level").notNull().default("info"),
  message: text("message").notNull(),
  nodeId: text("node_id"),
  metadata: jsonb("metadata"),
});

export const insertAgentLogSchema = createInsertSchema(agentLogsTable);
export type InsertAgentLog = z.infer<typeof insertAgentLogSchema>;
export type AgentLogRow = typeof agentLogsTable.$inferSelect;
