import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS, todayLine } from "@/lib/anthropic/client";
import { PERSONA, ANGLE_PRINCIPLE, ACCURACY_RULE } from "@/lib/social/voice";
import type { Pillar } from "@/lib/social/pillars";
import type { CatalogItem } from "@/lib/social/catalog";
import { cleanHashtags, normalizeDashes, renderCatalog } from "@/lib/social/format";
import { brand } from "@/lib/config";

export interface ComposedTweet {
  itemId: string;
  text: string; // tweet body only — no URL, no hashtags
  hashtags: string[];
}

const SUBMIT_TWEET_TOOL: Anthropic.Tool = {
  name: "submit_post",
  description: "Submit the composed X (Twitter) post.",
  input_schema: {
    type: "object",
    properties: {
      item_id: { type: "string", description: "id of the chosen catalog item." },
      text: {
        type: "string",
        description:
          "Tweet body only — no URL, no hashtags. Max ~200 characters so the link and tags fit.",
      },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description: "0-2 hashtags incl. the # sign.",
      },
    },
    required: ["item_id", "text"],
  },
};

function systemPrompt(): string {
  return `You write a single daily X (Twitter) post for ${brand.name}, in the company's first-person-plural voice ("we"). Goal: genuinely useful, non-cringe posts for our audience.
WHO WE ARE: ${PERSONA}
You are GROUNDED in the provided catalog of ${brand.name}'s real work and offerings — never invent facts, metrics, or links.
ACCURACY (non-negotiable): ${ACCURACY_RULE}
For the given pillar (angle):
1. Pick the ONE catalog item that best supports the angle to ground the post and link to. It's fine to choose an item you've linked before — find a fresh angle on it.
2. Write the tweet body ("text"): ONE sharp, specific point in at most ~200 characters of natural prose. No hype, no clichés ("game-changer", "unlock", "Here's the thing"), 0-1 emoji max. Plain hyphens only — never em/en dashes. Do NOT include the URL or hashtags in the text — those are appended automatically.
3. Provide 0-2 specific hashtags. Never cringe tags (#solopreneur, #hustle, #grindset, ...).
ANGLE & REPETITION: ${ANGLE_PRINCIPLE}
${todayLine()}`;
}

export async function composeTweet(opts: {
  pillar: Pillar;
  catalog: CatalogItem[];
  recentTexts: string[];
  recentItemIds: string[];
}): Promise<ComposedTweet | null> {
  const user = `TODAY'S PILLAR: ${opts.pillar.label}
Guidance: ${opts.pillar.guidance}

CATALOG (choose exactly one item):
${renderCatalog(opts.catalog, opts.recentItemIds)}

RECENT POSTS (don't duplicate their point or wording — a fresh angle on the same material/link is fine):
${opts.recentTexts.length ? opts.recentTexts.map((t) => `---\n${t}`).join("\n") : "(none yet)"}

Compose the tweet now via submit_post.`;

  const response = await anthropic.messages.create({
    model: MODELS.social,
    max_tokens: 800,
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    tools: [SUBMIT_TWEET_TOOL],
    tool_choice: { type: "tool", name: "submit_post" },
    messages: [{ role: "user", content: user }],
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  const input = block.input as { item_id?: string; text?: string; hashtags?: string[] };
  if (!input.item_id || !input.text?.trim()) return null;
  return {
    itemId: input.item_id,
    text: normalizeDashes(input.text.trim()),
    hashtags: cleanHashtags(input.hashtags, 2),
  };
}
