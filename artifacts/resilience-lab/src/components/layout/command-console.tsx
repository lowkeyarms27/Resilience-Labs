import React, { useState, useRef, useEffect } from "react";
import { Terminal, Shield, Wrench, BarChart2, Send, X, Minimize2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/date-utils";

type AgentRole = "sentinel" | "engineer" | "analyst";
type Message = { role: "user" | "agent"; text: string; agent?: AgentRole; streaming?: boolean };

const AGENT_META: Record<AgentRole, { label: string; color: string; icon: React.ReactNode; placeholder: string }> = {
  sentinel: {
    label: "SENTINEL", color: "text-cyan-400 border-cyan-400/30",
    icon: <Shield className="w-3.5 h-3.5" />,
    placeholder: "Ask SENTINEL about grid health, anomalies, threat analysis…",
  },
  engineer: {
    label: "ENGINEER", color: "text-amber-400 border-amber-400/30",
    icon: <Wrench className="w-3.5 h-3.5" />,
    placeholder: "Ask ENGINEER about repair strategies, node fixes, recovery plans…",
  },
  analyst: {
    label: "ANALYST", color: "text-purple-400 border-purple-400/30",
    icon: <BarChart2 className="w-3.5 h-3.5" />,
    placeholder: "Ask ANALYST for risk assessment, resilience strategies, insights…",
  },
};

const QUICK_PROMPTS: Record<AgentRole, string[]> = {
  sentinel: [
    "What's the current threat level?",
    "Which nodes are most at risk?",
    "Explain the latest incident.",
  ],
  engineer: [
    "What's the fastest repair strategy?",
    "How do I prevent cascade failures?",
    "Prioritise the repair queue.",
  ],
  analyst: [
    "What are our resilience weaknesses?",
    "Predict next failure point.",
    "Give me an executive summary.",
  ],
};

interface CommandConsoleProps {
  onClose: () => void;
}

export function CommandConsole({ onClose }: CommandConsoleProps) {
  const [activeAgent, setActiveAgent] = useState<AgentRole>("sentinel");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      agent: "sentinel",
      text: "SENTINEL online. Command interface ready. Query the grid state, request threat analysis, or ask about specific nodes.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setIsLoading(true);

    const streamingId = Date.now();
    setMessages((prev) => [
      ...prev,
      { role: "agent", agent: activeAgent, text: "", streaming: true },
    ]);

    try {
      const response = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, agent: activeAgent }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as { token?: string; done?: boolean; error?: string };
            if (payload.token) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.streaming) {
                  next[next.length - 1] = { ...last, text: last.text + payload.token };
                }
                return next;
              });
            }
            if (payload.done) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.streaming) {
                  next[next.length - 1] = { ...last, streaming: false };
                }
                return next;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.streaming) {
          next[next.length - 1] = { ...last, text: "Connection error. Agent temporarily unreachable.", streaming: false };
        }
        return next;
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const meta = AGENT_META[activeAgent];

  return (
    <div className={cn(
      "fixed bottom-4 right-[26rem] z-50 flex flex-col bg-card border border-border rounded-lg shadow-2xl transition-all duration-300 font-mono",
      minimised ? "w-80 h-12" : "w-[480px] h-[480px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 rounded-t-lg shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold tracking-widest text-foreground">COMMAND CONSOLE</span>
          <span className={cn("text-[10px] font-bold tracking-wider flex items-center gap-1", meta.color)}>
            {meta.icon} {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimised(!minimised)} className="p-1 hover:text-primary transition-colors">
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-1 hover:text-destructive transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          {/* Agent tabs */}
          <div className="flex border-b border-border shrink-0">
            {(Object.keys(AGENT_META) as AgentRole[]).map((role) => {
              const m = AGENT_META[role];
              return (
                <button
                  key={role}
                  onClick={() => setActiveAgent(role)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold tracking-wider transition-colors",
                    activeAgent === role
                      ? cn("border-b-2 -mb-px", m.color)
                      : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                  )}
                >
                  {m.icon} {m.label}
                </button>
              );
            })}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 text-xs">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                {msg.role === "user" ? (
                  <div className="bg-primary/15 border border-primary/30 text-primary rounded px-3 py-2 max-w-[85%] leading-relaxed">
                    {msg.text}
                  </div>
                ) : (
                  <div className={cn(
                    "border rounded px-3 py-2 max-w-[95%] leading-relaxed text-foreground/90",
                    msg.agent ? AGENT_META[msg.agent].color : "border-border"
                  )}>
                    {msg.text}
                    {msg.streaming && (
                      <span className="inline-block w-2 h-3.5 bg-current ml-0.5 animate-pulse rounded-sm" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick prompts */}
          <div className="px-3 pt-1 pb-0 flex gap-1.5 flex-wrap shrink-0">
            {QUICK_PROMPTS[activeAgent].map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={isLoading}
                className="text-[10px] text-muted-foreground hover:text-primary border border-border hover:border-primary/50 rounded px-2 py-0.5 transition-colors truncate max-w-[200px]"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 shrink-0">
            <div className="flex gap-2 items-center border border-border rounded bg-background/50 px-3 py-2 focus-within:border-primary/50 transition-colors">
              <span className={cn("text-[10px] font-bold shrink-0", meta.color)}>&gt;_</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={meta.placeholder}
                disabled={isLoading}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
              <Button
                size="sm"
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="h-6 w-6 p-0 shrink-0"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
