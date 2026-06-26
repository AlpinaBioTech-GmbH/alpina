// src/lib/assistant/pricing.ts
// Per-model Anthropic pricing (USD per million tokens) and a cost helper.
// Used to display the approximate cost of each logged conversation.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
};

/** Approximate USD cost of a single answer (generation only). */
export function estimateCost(
  model: string | null,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (!model || inputTokens == null || outputTokens == null) return null;
  const p = PRICING[model];
  if (!p) return null;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** Format a small USD cost for display, e.g. "$0.0003". */
export function formatCost(cost: number | null): string {
  if (cost == null) return "-";
  if (cost === 0) return "$0";
  return `$${cost.toFixed(cost < 0.01 ? 4 : 2)}`;
}

export function formatTokens(input: number | null, output: number | null): string {
  if (input == null && output == null) return "-";
  const fmt = (n: number | null) =>
    n == null ? "?" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return `${fmt(input)} in / ${fmt(output)} out`;
}
