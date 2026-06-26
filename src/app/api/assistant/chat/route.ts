// src/app/api/assistant/chat/route.ts
// Public streaming chat endpoint for the assistant widget.
//   - IP rate limit + input length/count caps (it spends Anthropic tokens).
//   - Retrieves knowledge-base context (semantic RAG) for the latest question.
//   - Streams a grounded Claude response back as plain text.
import { createHash, randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { brand } from "@/lib/config";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { retrieveContext } from "@/lib/rag/retrieve";
import { DEFAULT_ASSISTANT_MODEL } from "@/lib/rag/config";
import {
  buildVisitor,
  recordVisitor,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  type ClientContext,
} from "@/lib/assistant/visitor";

type Source = { title: string; url: string | null };

const AnalysisSchema = z.object({
  summary: z.string(),
  intent: z.string(),
  worth_followup: z.boolean(),
});
type Analysis = z.infer<typeof AnalysisSchema>;

// Cheap secondary call (always Haiku) that classifies an exchange for the admin
// dashboard. Best-effort: returns null on any failure.
async function analyzeConversation(
  client: Anthropic,
  question: string,
  answer: string,
): Promise<Analysis | null> {
  try {
    const res = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `A visitor asked ${brand.assistant.analysisSubject} a question. For an internal dashboard, provide:
- summary: one short sentence describing the exchange.
- intent: a 2-4 word label (e.g. "Pricing inquiry", "Partnership", "Technical question").
- worth_followup: true if this looks like a sales lead or needs a human to follow up.

Question: ${question}

Answer: ${answer}`,
        },
      ],
      output_config: { format: zodOutputFormat(AnalysisSchema) },
    });
    return res.parsed_output ?? null;
  } catch (e) {
    console.error("conversation analysis failed:", e);
    return null;
  }
}

export const runtime = "nodejs";

// --- Abuse guards ----------------------------------------------------------
const MAX_MESSAGES = 20;
const MAX_USER_CHARS = 2000; // cap on what a visitor can submit
const MAX_ASSISTANT_CHARS = 12000; // prior model replies in history can be longer
const RATE_MAX = 30; // requests
const RATE_WINDOW_MS = 60 * 60 * 1000; // per hour, per IP (per server instance)

const HITS = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (HITS.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  HITS.set(ip, recent);
  return recent.length > RATE_MAX;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildSystemPrompt(base: string, context: string): string {
  if (!context) {
    return `${base}

You have no relevant context for this question. Tell the user you do not have that information and point them to the contact page. Do not invent an answer.`;
  }
  return `${base}

Answer using ONLY the context below. If the answer is not in it, say you do not have that information and point the user to the contact page. Do not invent facts. Cite sources inline using their [Title].

<context>
${context}
</context>`;
}

export async function POST(request: Request) {
  // 1. Rate limit by IP (hashed for storage; raw IP is never persisted).
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "Too many requests. Please slow down and try again later." },
      { status: 429 },
    );
  }
  const ipHash = createHash("sha256").update(ip).digest("hex");

  // First-party visitor id (cookie). Created on first chat, kept for a year,
  // so a person's multiple chats can be correlated.
  const cookieStore = await cookies();
  let visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  let setVisitorCookie = false;
  if (!visitorId) {
    visitorId = randomUUID();
    setVisitorCookie = true;
  }

  // 2. Parse + validate input.
  let body: { messages?: unknown; context?: ClientContext };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const messages = body.messages;
  const clientContext: ClientContext = body.context ?? {};
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES ||
    !messages.every(
      (m): m is ChatMessage =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0 &&
        m.content.length <=
          (m.role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS),
    )
  ) {
    return Response.json({ error: "Invalid messages." }, { status: 400 });
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return Response.json({ error: "No question provided." }, { status: 400 });
  }

  // 3. Load assistant config; bail if disabled or unconfigured.
  const db = getSupabaseAdmin();
  if (!db) {
    return Response.json({ error: "Assistant is not configured." }, { status: 503 });
  }
  const { data: cfg } = await db
    .from("assistant_config")
    .select("enabled, model, system_prompt")
    .eq("id", "default")
    .maybeSingle();
  if (!cfg || cfg.enabled === false) {
    return Response.json({ error: "The assistant is currently unavailable." }, { status: 503 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Assistant is not configured." }, { status: 503 });
  }

  // 4. Retrieve context for the latest question.
  let context = "";
  let sources: Source[] = [];
  try {
    const chunks = await retrieveContext(lastUser.content);
    context = chunks
      .map((c) => `[${c.title}]\n${c.content}`)
      .join("\n\n---\n\n");
    // One entry per cited document, in retrieval order.
    const seen = new Set<string>();
    sources = chunks
      .filter((c) => (seen.has(c.title) ? false : (seen.add(c.title), true)))
      .map((c) => ({ title: c.title, url: c.url }));
  } catch (e) {
    console.error("retrieval failed:", e);
  }

  const system = buildSystemPrompt(
    (cfg.system_prompt as string) || brand.assistant.defaultSystemPrompt,
    context,
  );
  const model = (cfg.model as string) || DEFAULT_ASSISTANT_MODEL;

  // 5. Capture visitor details (geo, device, locale, page context).
  const visitor = buildVisitor(hdrs, clientContext, ipHash);

  // 6. Stream a grounded response, then log the exchange + visitor.
  const anthropic = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      try {
        const llm = anthropic.messages.stream({
          model,
          max_tokens: 1024,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });
        for await (const event of llm) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            answer += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await llm.finalMessage();
        inputTokens = final.usage.input_tokens;
        outputTokens = final.usage.output_tokens;
      } catch (e) {
        console.error("assistant stream error:", e);
        controller.enqueue(
          encoder.encode("\n\nSorry, something went wrong. Please try again."),
        );
      } finally {
        controller.close();
      }

      // Best-effort logging + analysis + visitor; never blocks the response.
      if (answer) {
        const analysis = await analyzeConversation(
          anthropic,
          lastUser.content,
          answer,
        );
        try {
          await db.from("assistant_conversations").insert({
            ip_hash: ipHash,
            question: lastUser.content,
            answer,
            sources,
            model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            summary: analysis?.summary ?? null,
            intent: analysis?.intent ?? null,
            worth_followup: analysis?.worth_followup ?? false,
            visitor_id: visitorId,
            country: visitor.conversation.country,
            city: visitor.conversation.city,
            page_path: visitor.conversation.page_path,
            context: visitor.conversation.context,
          });
        } catch (e) {
          console.error("conversation log failed:", e);
        }
        try {
          await recordVisitor(db, visitorId, visitor.snapshot);
        } catch (e) {
          console.error("visitor record failed:", e);
        }
      }
    },
  });

  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    // URL-encoded: HTTP headers are byte-strings, but titles may contain
    // non-Latin1 characters (curly quotes, accents).
    "X-Assistant-Sources": encodeURIComponent(JSON.stringify(sources)),
  };
  if (setVisitorCookie) {
    responseHeaders["Set-Cookie"] =
      `${VISITOR_COOKIE}=${visitorId}; Path=/; Max-Age=${VISITOR_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax; Secure`;
  }

  return new Response(stream, { headers: responseHeaders });
}
