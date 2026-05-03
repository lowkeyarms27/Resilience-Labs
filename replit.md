# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Resilience Lab — Architecture

Dark enterprise cybersecurity autonomous system monitor.

### Artifacts
- `artifacts/resilience-lab` — React + Vite frontend (port from `PORT` env)
- `artifacts/api-server` — Express 5 API server (port 8080, path `/api`)

### Agent Pipeline (4-agent hierarchy)
1. **SENTINEL** (cyan) — monitors 16 nodes every 45s, generates AI threat assessment
2. **COORDINATOR** (violet) — classifies P1/P2/P3, orchestrates the pipeline, generates post-incident reports
3. **DIAGNOSTICIAN** (yellow) — deep root-cause analysis per node; outputs confidence score (0–100) and risk level (low/medium/high)
4. **REMEDIATOR** (orange) — executes infrastructure repairs; logs real simulated CLI commands (kubectl, aws, redis-cli, etc.) per node type
5. **VALIDATOR** (green) — confirms post-repair metrics are within baseline; triggers post-incident report if all nodes resolved

### Human Approval Queue
- If Diagnostician confidence < 75% OR risk level = "high" → action queued for human sign-off
- Floating amber panel appears bottom-right with approve/reject buttons and infra command preview
- Approval/rejection propagates via SSE to all connected clients
- Backend: `approvalQueue.ts` — EventEmitter-based Promise pattern
- Routes: `GET /api/agents/approvals`, `POST /api/agents/approvals/:id/approve`, `POST /api/agents/approvals/:id/reject`

### Node Metrics
Each grid node tracks: latency, errorRate, uptime, CPU%, memory%, networkIn (Mbps), networkOut (Mbps)

### Infrastructure Command Simulation
Each node type (CORE/EDGE/HUB/RELAY/GATEWAY/BRIDGE/MESH/VAULT/CACHE/SHIELD/FIREWALL/CLUSTER/LINK) maps to realistic CLI commands shown live in the Remediator's log stream.

### Real-time Comms (SSE)
SSE stream at `/api/agents/stream` with named events:
- `message` — completed agent log entry
- `thinking` / `thinking-done` — live AI token streaming
- `approval-request` — new human approval needed
- `approval-resolved` — approval decision made
- `approval-list` — full list sync on connect

### Frontend State Pattern
`useAgentLogs()` is called ONCE in Dashboard and returns `{ logs, thinking, approvals }`. Props are passed down to `AgentLogs` and `ApprovalQueue` — single SSE connection.

### Scenarios (5 named attacks)
DDoS Surge, Cascade Failure, Zero-Day Exploit, Power Grid Outage, Ransomware Wave — each targets specific node subsets with realistic timing patterns.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
