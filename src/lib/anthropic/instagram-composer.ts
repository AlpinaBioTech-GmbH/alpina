import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODELS, todayLine } from "@/lib/anthropic/client";
import { PERSONA, ANGLE_PRINCIPLE, ACCURACY_RULE } from "@/lib/social/voice";
import type { Pillar } from "@/lib/social/pillars";
import type { CatalogItem } from "@/lib/social/catalog";
import { cleanHashtags, normalizeDashes, renderCatalog } from "@/lib/social/format";
import type { SlideSpec } from "@/lib/instagram/slides";
import { brand } from "@/lib/config";

export interface ComposedCarousel {
  itemId: string;
  caption: string; // body only — hashtags appended separately, never URLs
  hashtags: string[];
  slides: SlideSpec[];
}

const SUBMIT_POST_TOOL: Anthropic.Tool = {
  name: "submit_post",
  description: "Submit the composed Instagram carousel.",
  input_schema: {
    type: "object",
    properties: {
      item_id: { type: "string", description: "id of the chosen catalog item." },
      caption: {
        type: "string",
        description:
          "Caption body — no URLs, no hashtags. Hook first line, 2-4 short paragraphs, close with a 'link in bio' pointer.",
      },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description: "3-8 specific hashtags incl. the # sign.",
      },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kicker: { type: "string", description: "Optional small label above the title (<= 40 chars)." },
            title: { type: "string", description: "Slide headline (<= 90 chars cover/CTA, <= 80 content)." },
            body: { type: "string", description: "Optional supporting line(s), <= 220 chars." },
          },
          required: ["title"],
        },
        description:
          "3-10 slides. First = cover hook. Middle = one concrete point each. LAST = closing slogan/call-to-action slide (short, memorable). The rendered slide adds the site URL and a 'link in bio' chip automatically, so NEVER write 'link in bio' in any slide title or body; leave the closing slide's body empty or use it for a short supporting line.",
      },
    },
    required: ["item_id", "caption", "slides"],
  },
};

function systemPrompt(): string {
  return `You compose a single daily Instagram carousel for ${brand.name}, in the company's first-person-plural voice ("we"). Goal: genuinely useful, non-cringe swipeable posts for our audience.
WHO WE ARE: ${PERSONA}
You are GROUNDED in the provided catalog of ${brand.name}'s real work and offerings — never invent facts, metrics, or links.
ACCURACY (non-negotiable): ${ACCURACY_RULE}
INSTAGRAM SPECIFICS:
- Links in captions are dead text. NEVER put a URL in the caption or on a slide; the call to action is always "link in bio".
- The carousel is the content: cover slide hooks (specific, no clickbait), each middle slide lands ONE concrete point a reader can use, the LAST slide is a short memorable slogan/call-to-action. The design adds the site URL and a "link in bio" chip to that final slide automatically, so do NOT write the words "link in bio" on any slide (title or body) — leave the closing slide's body empty or use it for a short supporting line.
- Slide copy is display typography: short lines, punchy, concrete. Title <= 80-90 chars, body <= 220 chars. No emoji on slides; 0-2 emoji max in the caption. Plain hyphens only — never em/en dashes.
- Caption: strong first line (it's the preview), then 2-4 short paragraphs of substance (not a repeat of the slides), then a "link in bio" pointer. No banned phrasing: "Here's the thing", "Let that sink in", "Read that again", "game-changer", "unlock", "supercharge", "the secret is".
For the given pillar (angle): pick the ONE catalog item that best supports it. It's fine to choose an item featured before — find a fresh angle on it.
ANGLE & REPETITION: ${ANGLE_PRINCIPLE}
${todayLine()}`;
}

export async function composeCarousel(opts: {
  pillar: Pillar;
  catalog: CatalogItem[];
  recentTexts: string[];
  recentItemIds: string[];
}): Promise<ComposedCarousel | null> {
  const user = `TODAY'S PILLAR: ${opts.pillar.label}
Guidance: ${opts.pillar.guidance}

CATALOG (choose exactly one item):
${renderCatalog(opts.catalog, opts.recentItemIds)}

RECENT POSTS (don't duplicate their point or wording — a fresh angle on the same material/link is fine):
${opts.recentTexts.length ? opts.recentTexts.map((t) => `---\n${t}`).join("\n") : "(none yet)"}

Compose the carousel now via submit_post.`;

  const response = await anthropic.messages.create({
    model: MODELS.social,
    max_tokens: 3000,
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    tools: [SUBMIT_POST_TOOL],
    tool_choice: { type: "tool", name: "submit_post" },
    messages: [{ role: "user", content: user }],
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  const input = block.input as {
    item_id?: string;
    caption?: string;
    hashtags?: string[];
    slides?: SlideSpec[];
  };
  if (!input.item_id || !input.caption?.trim() || !input.slides?.length) return null;
  return {
    itemId: input.item_id,
    caption: normalizeDashes(input.caption.trim()),
    hashtags: cleanHashtags(input.hashtags, 8),
    slides: input.slides.slice(0, 10).map((s) => ({
      kicker: s.kicker ? normalizeDashes(s.kicker.trim()) : undefined,
      title: normalizeDashes((s.title ?? "").trim()),
      body: s.body ? normalizeDashes(s.body.trim()) : undefined,
    })),
  };
}

export function assembleCaption(caption: string, hashtags: string[]): string {
  return hashtags.length ? `${caption}\n\n${hashtags.join(" ")}` : caption;
}
