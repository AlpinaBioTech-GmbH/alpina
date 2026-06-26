import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS, todayLine } from "@/lib/anthropic/client";
import { PERSONA, ANGLE_PRINCIPLE, ACCURACY_RULE } from "@/lib/social/voice";
import type { Pillar } from "@/lib/social/pillars";
import type { CatalogItem } from "@/lib/social/catalog";
import { BASE_HASHTAGS, cleanHashtags, normalizeDashes, renderCatalog } from "@/lib/social/format";
import { brand } from "@/lib/config";

export interface ComposedPost {
  itemId: string;
  commentary: string;
  hashtags: string[];
}

const SUBMIT_POST_TOOL: Anthropic.Tool = {
  name: "submit_post",
  description: "Submit the composed LinkedIn post.",
  input_schema: {
    type: "object",
    properties: {
      item_id: { type: "string", description: "id of the chosen catalog item." },
      commentary: { type: "string", description: "Post body only — no URL, no hashtags." },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description: "4-7 hashtags incl. the # sign.",
      },
    },
    required: ["item_id", "commentary"],
  },
};

function systemPrompt(): string {
  return `You write a single daily LinkedIn post for ${brand.name}, in the company's first-person-plural voice ("we"). Goal: build ${brand.name}'s brand with genuinely useful, non-cringe posts for our audience.
WHO WE ARE: ${PERSONA}
You are GROUNDED in the provided catalog of ${brand.name}'s real work and offerings — never invent facts, metrics, or links.
ACCURACY (non-negotiable): ${ACCURACY_RULE}
For the given pillar (angle):
1. Pick the ONE catalog item that best supports the angle to ground the post and link to. It's fine to choose an item you've linked before — find a fresh angle on it.
2. Write the post body ("commentary"): open with a strong, specific first line (never "We're excited to share"); then a short paragraph (2-4 sentences) in natural, flowing prose tying the angle to a concrete example from the chosen item. First person plural, specific, confident, substantive, no hype. AVOID LinkedIn clichés and choppy one-sentence-per-line "broetry". Banned phrasing: "Here's the thing", "Let that sink in", "Read that again", "game-changer", "unlock", "supercharge", "in today's fast-paced world", "the secret is"; 0-1 emoji max. Plain hyphens only — never em/en dashes. Do NOT include the URL or hashtags in the commentary — those are appended automatically.
3. Provide 4-7 relevant, specific hashtags. Never cringe tags (#solopreneur, #hustle, #grindset, ...).
ANGLE & REPETITION: ${ANGLE_PRINCIPLE}
${todayLine()}`;
}

export async function composeLinkedinPost(opts: {
  pillar: Pillar;
  catalog: CatalogItem[];
  recentTexts: string[];
  recentItemIds: string[];
}): Promise<ComposedPost | null> {
  const user = `TODAY'S PILLAR: ${opts.pillar.label}
Guidance: ${opts.pillar.guidance}

CATALOG (choose exactly one item):
${renderCatalog(opts.catalog, opts.recentItemIds)}

RECENT POSTS (don't duplicate their point or wording — a fresh angle on the same material/link is fine):
${opts.recentTexts.length ? opts.recentTexts.map((t) => `---\n${t}`).join("\n") : "(none yet)"}
${BASE_HASHTAGS.length ? `\nBase hashtags to consider: ${BASE_HASHTAGS.join(" ")}\n` : ""}
Compose the post now via submit_post.`;

  const response = await anthropic.messages.create({
    model: MODELS.social,
    max_tokens: 1500,
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    tools: [SUBMIT_POST_TOOL],
    tool_choice: { type: "tool", name: "submit_post" },
    messages: [{ role: "user", content: user }],
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  const input = block.input as { item_id?: string; commentary?: string; hashtags?: string[] };
  if (!input.item_id || !input.commentary?.trim()) return null;
  return {
    itemId: input.item_id,
    commentary: normalizeDashes(input.commentary.trim()),
    hashtags: cleanHashtags(input.hashtags, 7),
  };
}
