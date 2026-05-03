# Resilience Lab

A dark enterprise cybersecurity simulation platform that monitors a 16-node infrastructure grid and deploys a 5-agent AI pipeline to autonomously detect, diagnose, and repair incidents — with human approval gates for high-risk actions.

## What It Does

Resilience Lab simulates autonomous incident response in critical infrastructure:

- Monitors a **16-node grid** in real-time using actual health probes (HTTP, DNS, TCP, TLS, system metrics)
- Runs a **5-agent hierarchy** that detects threats, diagnoses root causes, executes repairs, and validates recovery
- Simulates **5 enterprise attack scenarios** (DDoS, cascading failure, zero-day, power outage, ransomware)
- Streams live AI reasoning to the frontend via **Server-Sent Events**
- Enforces **human approval gates** when agent confidence is low or risk is high

## Agent Pipeline

| Agent | Color | Role |
|---|---|---|
| SENTINEL | Cyan | Scans all 16 nodes every 45s, generates threat assessments |
| COORDINATOR | Violet | Classifies incidents (P1/P2/P3), orchestrates the pipeline |
| DIAGNOSTICIAN | Yellow | Root-cause analysis with confidence scores and risk levels |
| REMEDIATOR | Orange | Executes real repair commands (curl, DNS, TCP, file I/O) |
| VALIDATOR | Green | Verifies recovery, triggers post-incident reports |

Human approval is required when confidence < 75% or risk level = `high`. An amber approval panel appears in the UI for approve/reject decisions.

## Attack Scenarios

- **DDoS Surge** — floods 5 edge nodes with high latency and error rates
- **Cascade Failure** — 3-wave attack that triggers chain reactions
- **Zero-Day Exploit** — randomized 4-node compromise with root access
- **Power Grid Outage** — 6 nodes go completely offline
- **Ransomware Wave** — progressive encryption across all 16 nodes

## Tech Stack

**Backend**
- Node.js 24 + TypeScript 5.9
- Express 5, Drizzle ORM, PostgreSQL
- OpenAI GPT-4o-mini (streaming)
- Zod v4 validation
- esbuild (CJS bundle)

**Frontend**
- React + Vite
- Server-Sent Events for real-time agent logs, AI thinking, and approvals

**Monorepo**
- pnpm workspaces
- Orval for OpenAPI → API hooks + Zod schema codegen

## Getting Started

**Prerequisites:** Node.js 24+, pnpm, PostgreSQL

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# In a separate terminal, start the frontend
pnpm --filter @workspace/resilience-lab run dev
```

On startup the system seeds 16 nodes, runs initial health probes, and begins autonomous SENTINEL scans every 45 seconds. Inject a scenario from the UI to trigger the full agent pipeline.

## Other Commands

```bash
pnpm run typecheck                          # TypeScript check across all packages
pnpm run build                             # Typecheck + build everything
pnpm --filter @workspace/api-spec run codegen  # Regenerate API hooks from OpenAPI spec
```

## Real-Time Events

The SSE endpoint at `/api/agents/stream` emits:

| Event | Description |
|---|---|
| `message` | Completed agent log entry |
| `thinking` / `thinking-done` | Live AI token stream |
| `approval-request` | Human approval needed |
| `approval-resolved` | Approval decision propagated |
| `approval-list` | Full sync on client connect |
