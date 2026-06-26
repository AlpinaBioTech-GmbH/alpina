// src/components/site/AssistantWidget.tsx
// Floating public assistant. Shows preset questions, streams answers from
// /api/assistant/chat, and renders the conversation. Mounted site-wide via the
// (site) layout. Renders nothing when the assistant is disabled.
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import type { Source } from "@/lib/markdown";
import { brand } from "@/lib/config";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

// Conversation persists across reloads/navigations for this long.
const CHAT_STORAGE_KEY = "assistant-chat";
const CHAT_TTL_MS = 60 * 60 * 1000; // 1 hour

// Client-side details sent with each chat request for visitor analytics.
function collectClientContext() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, 200);
  }
  return {
    url: window.location.href,
    path: window.location.pathname,
    referrer: document.referrer || null,
    screen: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    device_pixel_ratio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    languages: navigator.languages?.join(",") || navigator.language || null,
    utm,
  };
}

export function AssistantWidget({
  enabled,
  presetQuestions,
}: {
  enabled: boolean;
  presetQuestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Clicking an internal hotlink closes the drawer (which animates the slide-
  // out) and navigates client-side, revealing the page behind it.
  const navigateInternal = useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router],
  );

  // Restore a recent conversation (within the TTL) on mount. Client-side
  // navigation keeps this component mounted, so this only matters for hard
  // reloads or landing on a page directly.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { messages: Message[]; updatedAt: number };
      if (
        Date.now() - saved.updatedAt < CHAT_TTL_MS &&
        Array.isArray(saved.messages)
      ) {
        setMessages(saved.messages.filter((m) => m.content !== ""));
      } else {
        localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  // Persist the conversation (with a timestamp for TTL) as it changes.
  useEffect(() => {
    try {
      if (messages.length === 0) return;
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify({ messages, updatedAt: Date.now() }),
      );
    } catch {
      // ignore quota/unavailable storage
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  const clearChat = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setInput("");

      const history = [...messages, { role: "user" as const, content: question }];
      // Show the question + an empty assistant bubble to stream into.
      setMessages([...history, { role: "assistant", content: "" }]);
      setBusy(true);

      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.slice(-20),
            context: collectClientContext(),
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          const msg =
            data?.error ?? "Sorry, the assistant is unavailable right now.";
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", content: msg };
            return next;
          });
          return;
        }

        let sources: Source[] = [];
        try {
          const raw = res.headers.get("X-Assistant-Sources");
          if (raw) sources = JSON.parse(decodeURIComponent(raw));
        } catch {
          sources = [];
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", content: acc, sources };
            return next;
          });
        }
      } catch {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          };
          return next;
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, messages],
  );

  if (!enabled) return null;

  return (
    <>
      {/* Launcher (rectangular, text). Hidden while the panel is open. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="fixed bottom-5 right-5 z-50 rounded-none bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-lg transition-transform hover:scale-105"
        >
          Talk to AI
        </button>
      ) : null}

      {/* Drawer: full-height panel, always mounted so it can slide. 100% width
          on small screens, 30% on large screens with a blurred page backdrop.
          Closed = slid off to the right, so navigating to a hotlink reveals the
          page with a smooth exit. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 hidden bg-background/30 backdrop-blur-sm transition-opacity duration-500 lg:block",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-label={`${brand.name} assistant`}
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col border-l bg-background shadow-2xl transition-transform duration-500 ease-out lg:w-[30%]",
          open ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
      >
            <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div>
                <p className="font-[family-name:var(--font-heading)] text-sm font-semibold">
                  {brand.name} Assistant
                </p>
                <p className="text-xs text-muted-foreground">
                  Ask a question to get the right answer fast
                </p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearChat}
                    className="rounded-none px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close assistant"
                  className="rounded-none p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>
            </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ask me about {brand.name}. Try one of these:
                </p>
                <div className="grid gap-2">
                  {presetQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="rounded-none border px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/60"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-none px-3 py-2 text-sm",
                    m.role === "user"
                      ? "ml-auto whitespace-pre-wrap bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : m.content ? (
                    <>
                      <Markdown
                        text={m.content}
                        sources={m.sources}
                        onInternalLink={navigateInternal}
                      />
                      {m.sources && m.sources.length > 0 ? (
                        <div className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                          <span className="font-medium">Sources: </span>
                          {m.sources.map((s, j) => (
                            <span key={`${s.title}-${j}`}>
                              {j > 0 ? ", " : ""}
                              {s.url ? (
                                <a
                                  href={s.url}
                                  onClick={(e) => {
                                    if (s.url!.startsWith("/")) {
                                      e.preventDefault();
                                      navigateInternal(s.url!);
                                    }
                                  }}
                                  className="underline underline-offset-2 hover:text-foreground"
                                >
                                  {s.title}
                                </a>
                              ) : (
                                s.title
                              )}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : busy && i === messages.length - 1 ? (
                    "..."
                  ) : (
                    ""
                  )}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={2000}
              placeholder="Ask a question..."
              disabled={busy}
              className="h-9 flex-1 rounded-none border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex size-9 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </form>
      </div>
    </>
  );
}
