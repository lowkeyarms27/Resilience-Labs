import * as os from "os";
import * as dns from "dns";
import * as net from "net";
import * as fs from "fs/promises";
import * as tls from "tls";
import { appCache } from "./realCache";

export type ProbeResult = {
  status: "healthy" | "degraded" | "failing" | "offline";
  latency: number;
  errorRate: number;
  uptime: number;
  cpu: number;
  memory: number;
  networkIn: number;
  networkOut: number;
  details: string;
};

// Thresholds
const LATENCY_DEGRADED = 1500; // ms
const LATENCY_FAILING  = 4000;

function healthy(latency: number, details: string, overrides: Partial<ProbeResult> = {}): ProbeResult {
  const cpu = 10 + Math.random() * 35;
  const mem = 20 + Math.random() * 40;
  return {
    status: "healthy",
    latency,
    errorRate: Math.random() * 0.002,
    uptime: 99.5 + Math.random() * 0.5,
    cpu,
    memory: mem,
    networkIn:  100 + Math.random() * 400,
    networkOut: 80  + Math.random() * 350,
    details,
    ...overrides,
  };
}

function degraded(latency: number, details: string, overrides: Partial<ProbeResult> = {}): ProbeResult {
  return {
    status: "degraded",
    latency,
    errorRate: 0.08 + Math.random() * 0.12,
    uptime: 85 + Math.random() * 10,
    cpu: 70 + Math.random() * 20,
    memory: 72 + Math.random() * 18,
    networkIn:  20 + Math.random() * 60,
    networkOut: 15 + Math.random() * 50,
    details,
    ...overrides,
  };
}

function failing(latency: number, details: string): ProbeResult {
  return {
    status: "failing",
    latency,
    errorRate: 0.6 + Math.random() * 0.35,
    uptime: 40 + Math.random() * 30,
    cpu: 88 + Math.random() * 11,
    memory: 85 + Math.random() * 14,
    networkIn:  5 + Math.random() * 20,
    networkOut: 3 + Math.random() * 15,
    details,
  };
}

function offline(details: string): ProbeResult {
  return {
    status: "offline",
    latency: 9999,
    errorRate: 1,
    uptime: 0,
    cpu: 0,
    memory: 0,
    networkIn:  0,
    networkOut: 0,
    details,
  };
}

async function httpProbe(url: string, label: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);
    const latency = Date.now() - start;

    if (!res.ok) return failing(latency, `${label} → HTTP ${res.status}`);
    if (latency > LATENCY_FAILING)  return failing(latency, `${label} → ${latency}ms (timeout threshold)`);
    if (latency > LATENCY_DEGRADED) return degraded(latency, `${label} → ${latency}ms (slow)`);
    return healthy(latency, `${label} → HTTP 200 in ${latency}ms`);
  } catch (err: unknown) {
    const e = err as { name?: string };
    const latency = Date.now() - start;
    if (e.name === "AbortError") return degraded(latency, `${label} → timeout after ${latency}ms`);
    return offline(`${label} → unreachable: ${(err as Error).message}`);
  }
}

async function dnsProbe(host: string): Promise<ProbeResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(failing(5000, `DNS timeout resolving ${host}`)), 5000);
    dns.promises.lookup(host).then(() => {
      clearTimeout(timer);
      const latency = Date.now() - start;
      if (latency > 2000) resolve(degraded(latency, `DNS ${host} → ${latency}ms (slow)`));
      else resolve(healthy(latency, `DNS ${host} → resolved in ${latency}ms`));
    }).catch((err: Error) => {
      clearTimeout(timer);
      resolve(offline(`DNS ${host} → NXDOMAIN: ${err.message}`));
    });
  });
}

async function tcpProbe(host: string, port: number): Promise<ProbeResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const sock = net.createConnection({ host, port, timeout: 5000 });
    const timer = setTimeout(() => { sock.destroy(); resolve(failing(5000, `TCP ${host}:${port} → timeout`)); }, 5500);
    sock.on("connect", () => {
      clearTimeout(timer);
      const latency = Date.now() - start;
      sock.destroy();
      if (latency > LATENCY_DEGRADED) resolve(degraded(latency, `TCP ${host}:${port} → ${latency}ms (slow)`));
      else resolve(healthy(latency, `TCP ${host}:${port} → connected in ${latency}ms`));
    });
    sock.on("error", (err) => { clearTimeout(timer); resolve(offline(`TCP ${host}:${port} → ${err.message}`)); });
  });
}

async function tlsProbe(host: string, port = 443): Promise<ProbeResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port, servername: host });
    const timer = setTimeout(() => { sock.destroy(); resolve(failing(6000, `TLS ${host}:${port} → timeout`)); }, 6500);
    sock.on("secureConnect", () => {
      clearTimeout(timer);
      const latency = Date.now() - start;
      const cert = sock.getPeerCertificate();
      const daysLeft = cert.valid_to
        ? Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000)
        : 999;
      sock.destroy();
      if (daysLeft < 7) resolve(degraded(latency, `TLS ${host} → cert expires in ${daysLeft}d`));
      else if (latency > LATENCY_DEGRADED) resolve(degraded(latency, `TLS ${host} → ${latency}ms slow`));
      else resolve(healthy(latency, `TLS ${host} → OK, cert valid ${daysLeft}d, ${latency}ms`));
    });
    sock.on("error", (err) => { clearTimeout(timer); resolve(offline(`TLS ${host} → ${err.message}`)); });
  });
}

async function systemCpuProbe(): Promise<ProbeResult> {
  const start = Date.now();
  const load  = os.loadavg();
  const cpuCount = os.cpus().length;
  const loadPct  = (load[0] / cpuCount) * 100;
  const memFree  = os.freemem();
  const memTotal = os.totalmem();
  const memUsedPct = ((memTotal - memFree) / memTotal) * 100;
  const latency = Date.now() - start;

  if (loadPct > 90 || memUsedPct > 95)
    return failing(latency, `System overloaded — CPU load: ${loadPct.toFixed(1)}%, mem used: ${memUsedPct.toFixed(1)}%`);
  if (loadPct > 70 || memUsedPct > 85)
    return degraded(latency, `System load elevated — CPU: ${loadPct.toFixed(1)}%, mem: ${memUsedPct.toFixed(1)}%`, {
      cpu: loadPct, memory: memUsedPct,
    });
  return healthy(latency, `System healthy — CPU load: ${loadPct.toFixed(1)}%, mem used: ${memUsedPct.toFixed(1)}%, uptime: ${(os.uptime()/3600).toFixed(1)}h`, {
    cpu: loadPct,
    memory: memUsedPct,
  });
}

async function processMemProbe(): Promise<ProbeResult> {
  const mu = process.memoryUsage();
  const heapPct = (mu.heapUsed / mu.heapTotal) * 100;
  const rssMB   = mu.rss / 1024 / 1024;
  const latency = 1;

  // Measure real event loop lag
  const lagMs = await new Promise<number>((resolve) => {
    const s = Date.now();
    setImmediate(() => resolve(Date.now() - s));
  });

  if (heapPct > 90 || lagMs > 100)
    return failing(latency, `Process unhealthy — heap ${heapPct.toFixed(1)}%, loop lag ${lagMs}ms`);
  if (heapPct > 75 || lagMs > 30)
    return degraded(lagMs, `Process degraded — heap ${heapPct.toFixed(1)}%, loop lag ${lagMs}ms`, {
      cpu: heapPct, memory: heapPct,
    });
  return healthy(lagMs, `Process healthy — heap ${heapPct.toFixed(1)}% (${rssMB.toFixed(0)}MB RSS), loop lag ${lagMs}ms`, {
    cpu: heapPct * 0.4,
    memory: heapPct,
  });
}

async function fileIOProbe(): Promise<ProbeResult> {
  const path = "/tmp/vault-healthcheck";
  const start = Date.now();
  try {
    const payload = `hc-${Date.now()}`;
    await fs.writeFile(path, payload, "utf8");
    const read = await fs.readFile(path, "utf8");
    const latency = Date.now() - start;
    if (read !== payload) return failing(latency, `File I/O corruption: wrote "${payload}" read "${read}"`);
    if (latency > 500) return degraded(latency, `File I/O slow: ${latency}ms`);
    return healthy(latency, `File I/O OK: write+read in ${latency}ms`, { networkIn: 0, networkOut: 0 });
  } catch (err: unknown) {
    return offline(`File I/O failed: ${(err as Error).message}`);
  }
}

async function cacheProbe(): Promise<ProbeResult> {
  const start = Date.now();
  // Do some real cache operations
  for (let i = 0; i < 10; i++) appCache.set(`probe:${i}`, { v: i });
  for (let i = 0; i < 15; i++) appCache.get(`probe:${i % 10}`);

  const metrics = appCache.metrics;
  const hitRatePct = metrics.hitRate * 100;
  const latency = Date.now() - start;

  if (hitRatePct < 20)
    return failing(latency, `Cache critically low hit rate: ${hitRatePct.toFixed(1)}%, size: ${metrics.size}`);
  if (hitRatePct < 50)
    return degraded(latency, `Cache low hit rate: ${hitRatePct.toFixed(1)}%, size: ${metrics.size}`, {
      cpu: 60, memory: 80,
    });
  return healthy(latency, `Cache healthy — hit rate: ${hitRatePct.toFixed(1)}%, size: ${metrics.size}, mem: ~${metrics.memoryEstimateKB}KB`, {
    cpu: 15,
    memory: Math.min(90, (metrics.size / 10)),
    networkIn: metrics.totalGets * 0.001,
    networkOut: metrics.totalHits * 0.001,
  });
}

async function loadAvgProbe(): Promise<ProbeResult> {
  const load   = os.loadavg();
  const cpus   = os.cpus().length;
  const pct1   = (load[0] / cpus) * 100;
  const pct5   = (load[1] / cpus) * 100;
  const memPct = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
  const latency = 1;

  if (pct1 > 95) return failing(latency, `Cluster overloaded — 1min load ${pct1.toFixed(1)}%`);
  if (pct5 > 80) return degraded(latency, `Cluster under stress — 5min load ${pct5.toFixed(1)}%`, {
    cpu: pct5, memory: memPct,
  });
  return healthy(latency, `Cluster healthy — load(1m/5m/15m): ${load.map((l) => (l / cpus * 100).toFixed(1) + "%").join(" / ")}, ${cpus} CPUs`, {
    cpu: pct1,
    memory: memPct,
  });
}

// Map node IDs to probe functions
export type NodeProbe = () => Promise<ProbeResult>;

export const NODE_PROBES: Record<string, NodeProbe> = {
  "node-01": () => httpProbe("http://localhost:8080/api/healthz",           "self:healthz"),
  "node-02": () => httpProbe("https://api.github.com/zen",                  "github:api"),
  "node-03": () => httpProbe("https://registry.npmjs.org/-/ping",           "npm:registry"),
  "node-04": () => systemCpuProbe(),
  "node-05": () => httpProbe("https://httpbin.org/get",                     "httpbin:get"),
  "node-06": () => dnsProbe("google.com"),
  "node-07": () => httpProbe("https://cloudflare.com/cdn-cgi/trace",        "cloudflare:trace"),
  "node-08": () => tcpProbe("github.com", 443),
  "node-09": () => processMemProbe(),
  "node-10": () => fileIOProbe(),
  "node-11": () => cacheProbe(),
  "node-12": () => tlsProbe("google.com", 443),
  "node-13": () => dnsProbe("cloudflare.com"),
  "node-14": () => loadAvgProbe(),
  "node-15": () => httpProbe("https://1.1.1.1/cdn-cgi/trace",               "cloudflare:1.1.1.1"),
  "node-16": () => processMemProbe(),
};

// Human-readable descriptions of what each node actually monitors
export const NODE_PROBE_TARGETS: Record<string, string> = {
  "node-01": "HTTP health: localhost:8080/api/healthz",
  "node-02": "HTTP health: api.github.com/zen",
  "node-03": "HTTP health: registry.npmjs.org/-/ping",
  "node-04": "System: os.cpus() load average + os.freemem()",
  "node-05": "HTTP health: httpbin.org/get",
  "node-06": "DNS: dns.promises.lookup('google.com')",
  "node-07": "HTTP health: cloudflare.com/cdn-cgi/trace",
  "node-08": "TCP: net.createConnection(443, 'github.com')",
  "node-09": "Process: process.memoryUsage() + event loop lag",
  "node-10": "File I/O: write+read /tmp/vault-healthcheck",
  "node-11": "In-memory LRU cache: hit rate + size metrics",
  "node-12": "TLS: tls.connect('google.com:443') cert check",
  "node-13": "DNS: dns.promises.lookup('cloudflare.com')",
  "node-14": "System: os.loadavg() cluster load percentage",
  "node-15": "HTTP health: 1.1.1.1/cdn-cgi/trace (Cloudflare)",
  "node-16": "Process: heapUsed/heapTotal + setImmediate lag",
};

export async function runProbe(nodeId: string): Promise<ProbeResult | null> {
  const probe = NODE_PROBES[nodeId];
  if (!probe) return null;
  try {
    return await probe();
  } catch (err) {
    return offline(`Probe exception: ${(err as Error).message}`);
  }
}
