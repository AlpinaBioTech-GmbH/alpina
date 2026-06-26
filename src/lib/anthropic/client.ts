import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "sk-ant-placeholder",
});

// Use `||` (not `??`): unset CI `vars.*` inject an empty string, and an empty
// model id is rejected by the API ("model: String should have at least 1
// character"). Empty/whitespace must fall back to the default.
export const MODELS = {
  writer: process.env.WRITER_MODEL?.trim() || "claude-sonnet-4-6",
  editor: process.env.EDITOR_MODEL?.trim() || "claude-sonnet-4-6",
  social: process.env.SOCIAL_MODEL?.trim() || process.env.WRITER_MODEL?.trim() || "claude-sonnet-4-6",
} as const;

/**
 * Current-date line appended to every agent system prompt — models otherwise
 * treat recent dates as "the future".
 */
export function todayLine(): string {
  const human = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `IMPORTANT — CURRENT DATE: Today is ${human} (UTC). This is the present day. Anything dated on or before today has already happened — never describe a past or present event or release as being "in the future," and treat your training-cutoff intuition about what's current as out of date relative to today.`;
}

/**
 * One model call with a forced tool choice; returns the tool input as T.
 * Forced tool_choice is incompatible with the server web_search tool, so
 * research happens in researchTurns() and submission happens here.
 */
export async function forcedToolCall<T>(opts: {
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tool: Anthropic.Tool;
  maxTokens?: number;
}): Promise<T> {
  const response = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8192,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: opts.messages,
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error(`forced tool call returned no tool_use block (stop: ${response.stop_reason})`);
  }
  return block.input as T;
}

/**
 * Research with the server-side web_search tool. Long research turns return
 * stop_reason "pause_turn"; we hand the partial turn back verbatim so Claude
 * resumes where it paused, then concatenate every text block across turns.
 */
export async function researchTurns(opts: {
  model: string;
  system: string;
  prompt: string;
  maxSearches?: number;
  maxTurns?: number;
  maxTokens?: number;
}): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.prompt }];
  const maxTurns = opts.maxTurns ?? 8;
  let fullText = "";
  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 8192,
      system: opts.system,
      tools: [
        { type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches ?? 8 },
      ],
      messages,
    });
    const turnText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("\n");
    if (turnText) fullText += (fullText ? "\n" : "") + turnText;
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  return fullText;
}
