import React, { useEffect, useState, useRef } from "react";

const BOOT_LINES = [
  { delay: 0,    text: "RESILIENCE LAB OS v2.4.1 — SECURE BOOT INITIALIZED", type: "title" },
  { delay: 120,  text: "[ 0.000000] Kernel: Linux resilience-core 6.8.0-hardened #1 SMP", type: "kernel" },
  { delay: 240,  text: "[ 0.018432] Initializing cryptographic subsystems... OK", type: "ok" },
  { delay: 380,  text: "[ 0.041829] Loading secure memory allocator... OK", type: "ok" },
  { delay: 500,  text: "[ 0.089341] Mounting encrypted filesystem /dev/mapper/vault... OK", type: "ok" },
  { delay: 640,  text: "[ 0.134782] Establishing mTLS certificate chain... OK", type: "ok" },
  { delay: 780,  text: "[ 0.201847] Connecting to PostgreSQL cluster on :5432... OK", type: "ok" },
  { delay: 920,  text: "[ 0.289134] Verifying database schema integrity... OK", type: "ok" },
  { delay: 1060, text: "[ 0.334891] Loading grid topology... 16 nodes registered", type: "ok" },
  { delay: 1180, text: "[ 0.401234] Calibrating real-time health probe pipeline... OK", type: "ok" },
  { delay: 1280, text: "[ 0.489123] Spawning SSE event bus... OK", type: "ok" },
  { delay: 1400, text: "[ 0.521847] Loading AI inference runtime (gpt-4o-mini)... OK", type: "ok" },
  { delay: 1520, text: "[ 0.612938] Initializing SENTINEL agent.................. ONLINE", type: "agent" },
  { delay: 1660, text: "[ 0.701847] Initializing COORDINATOR agent.............. ONLINE", type: "agent" },
  { delay: 1800, text: "[ 0.798234] Initializing DIAGNOSTICIAN agent............ ONLINE", type: "agent" },
  { delay: 1940, text: "[ 0.891723] Initializing REMEDIATOR agent............... ONLINE", type: "agent" },
  { delay: 2080, text: "[ 0.978412] Initializing VALIDATOR agent................ ONLINE", type: "agent" },
  { delay: 2200, text: "[ 1.034891] Registering human approval queue... OK", type: "ok" },
  { delay: 2320, text: "[ 1.089234] Running initial health probes across 16 nodes...", type: "info" },
  { delay: 2500, text: "[ 1.198471] Alpha-Prime → HTTP 200 in 62ms", type: "probe" },
  { delay: 2580, text: "[ 1.214823] Beta-Core → GitHub API 200 in 118ms", type: "probe" },
  { delay: 2660, text: "[ 1.231947] Gamma-Edge → npm registry 200 in 94ms", type: "probe" },
  { delay: 2740, text: "[ 1.248312] Mu-Shield → TLS cert valid 247d, cipher AES-256", type: "probe" },
  { delay: 2820, text: "[ 1.261847] Zeta-Relay → DNS resolved in 17ms", type: "probe" },
  { delay: 2900, text: "[ 1.278934] Xi-Cluster → CPU load 1.2%, mem 59% utilized", type: "probe" },
  { delay: 3020, text: "[ 1.312847] All 16 node probes complete. Grid nominal.", type: "ok" },
  { delay: 3180, text: "[ 1.389234] Enabling autonomous incident response pipeline... OK", type: "ok" },
  { delay: 3340, text: "[ 1.401847] System integrity check PASSED", type: "ok" },
  { delay: 3480, text: "", type: "spacer" },
  { delay: 3520, text: "████████████████████  RESILIENCE LAB ONLINE  ████████████████████", type: "banner" },
];

const TOTAL_DURATION = 3900;

type BootLine = { delay: number; text: string; type: string };

function LineText({ line }: { line: BootLine }) {
  if (line.type === "spacer") return <div className="h-2" />;

  const colorMap: Record<string, string> = {
    title:  "text-cyan-300 font-bold tracking-widest text-sm mb-2",
    kernel: "text-gray-400",
    ok:     "text-green-400",
    agent:  "text-cyan-400 font-semibold",
    probe:  "text-emerald-300",
    info:   "text-yellow-300",
    banner: "text-green-300 font-bold tracking-widest text-center animate-pulse",
  };

  const cls = colorMap[line.type] ?? "text-gray-300";

  // Highlight [ OK ] / ONLINE
  const formatted = line.text
    .replace("OK", '<span class="text-green-300 font-bold">OK</span>')
    .replace("ONLINE", '<span class="text-cyan-300 font-bold">ONLINE</span>')
    .replace("PASSED", '<span class="text-green-300 font-bold">PASSED</span>');

  return (
    <div
      className={`font-mono text-xs leading-5 ${cls}`}
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
}

export function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState<BootLine[]>([]);
  const [progress, setProgress]       = useState(0);
  const [exiting, setExiting]         = useState(false);
  const [cursor, setCursor]           = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Blinking cursor
  useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  // Queue each boot line
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_LINES.forEach((line) => {
      timers.push(
        setTimeout(() => {
          setVisibleLines((prev) => [...prev, line]);
          setProgress(Math.min(100, Math.round((line.delay / TOTAL_DURATION) * 100)));
          setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          }, 30);
        }, line.delay)
      );
    });

    // Trigger exit after last line
    timers.push(
      setTimeout(() => {
        setProgress(100);
        setTimeout(() => setExiting(true), 400);
        setTimeout(() => onComplete(), 1100);
      }, TOTAL_DURATION)
    );

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-black transition-opacity duration-700 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,100,0.015) 2px, rgba(0,255,100,0.015) 4px)",
        }}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-green-900/40 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-mono text-xs text-green-400 tracking-widest uppercase">
            Resilience Lab — Secure Boot Sequence
          </span>
        </div>
        <span className="font-mono text-xs text-gray-600">
          {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
        </span>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {visibleLines.map((line, i) => (
          <LineText key={i} line={line} />
        ))}
        {/* Blinking cursor */}
        {!exiting && (
          <div className="font-mono text-xs text-green-400">
            {cursor ? "█" : " "}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="border-t border-green-900/40 px-6 py-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-xs text-gray-500 tracking-widest uppercase">
            System Boot Progress
          </span>
          <span className="font-mono text-xs text-green-400">{progress}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-gray-900 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-400 transition-all duration-300"
            style={{
              width: `${progress}%`,
              boxShadow: "0 0 8px rgba(74,222,128,0.7)",
            }}
          />
        </div>
        <div className="mt-2 flex justify-between">
          <span className="font-mono text-xs text-gray-700">BIOS v2.4.1</span>
          <span className="font-mono text-xs text-gray-700">
            {progress < 100 ? "INITIALIZING..." : "READY"}
          </span>
        </div>
      </div>
    </div>
  );
}
