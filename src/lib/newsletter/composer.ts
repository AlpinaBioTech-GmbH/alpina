// AI intro for the monthly digest. The model writes ONLY the subject, preview
// text, intro paragraphs, and an optional closing line, grounded strictly in
// the real article titles/teasers supplied. Article cards themselves are
// template code (src/emails/newsletter.ts), never AI.
import type Anthropic from "@anthropic-ai/sdk";
import { forcedToolCall, MODELS, todayLine } from "@/lib/anthropic/client";
import { stripLongDashesDeep } from "@/lib/strip-dashes";
import { brand, content } from "@/lib/config";
import type { DigestArticle } from "@/lib/newsletter/digest";

export interface ComposedIntro {
  subject: string;
  preview_text: string;
  intro_paragraphs: string[];
  closing_line?: string;
}

const SUBMIT_NEWSLETTER_TOOL: Anthropic.Tool = {
  name: "submit_newsletter",
  description: "Submit the newsletter subject, preview text, and intro copy.",
  input_schema: {
    type: "object",
    properties: {
      subject: {
        type: "string",
        description: "Email subject line, 35-70 characters, specific to this month's articles.",
      },
      preview_text: {
        type: "string",
        description: "Inbox preview text, 60-110 characters, adds information beyond the subject.",
      },
      intro_paragraphs: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 3,
        description: "1-3 short intro paragraphs (2-3 sentences each) framing this month's articles.",
      },
      closing_line: {
        type: "string",
        description: "Optional single closing sentence before the footer.",
      },
    },
    required: ["subject", "preview_text", "intro_paragraphs"],
  },
};

function systemPrompt(): string {
  return `You write the intro for ${content.writer.publication}'s monthly email digest of newly published articles.
AUDIENCE: ${content.writer.audience}
VOICE: ${content.writer.voice}
HARD RULES (non-negotiable):
- You are GROUNDED in the supplied article list. Never invent facts, figures, article names, products, or claims beyond the titles/teasers/tags provided.
- Never use em dashes or en dashes; use hyphens, colons, or commas.
- Never use emoji.
- Plain flowing prose. No markdown, no bullet lists, no headings: the layout handles structure.
- Do not greet by name and do not use "Dear". Start straight in ("This month..." or similar, but vary it).
- First person plural ("we") for ${brand.name}. Specific and substantive, no hype words (game-changer, unlock, cutting-edge, excited to share).
- The subject line must be concrete, not "Newsletter #N" or "Monthly update".
${todayLine()}`;
}

export async function composeIntro(opts: {
  monthLabel: string;
  articles: DigestArticle[];
  previousSubjects: string[];
}): Promise<{ intro: ComposedIntro; model: string }> {
  const list = opts.articles
    .map((a, i) => `${i + 1}. "${a.title}" (${a.date}; tags: ${a.tags.join(", ") || "none"})\n   Teaser: ${a.teaser}`)
    .join("\n");
  const user = `MONTH COVERED: ${opts.monthLabel}
ARTICLES PUBLISHED THIS MONTH (${opts.articles.length}):
${list}

${opts.previousSubjects.length ? `PREVIOUS ISSUE SUBJECTS (do not repeat their hooks):\n${opts.previousSubjects.map((s) => `- ${s}`).join("\n")}\n\n` : ""}Write the digest intro now via submit_newsletter.`;

  const model = MODELS.writer;
  const call = () =>
    forcedToolCall<ComposedIntro>({
      model,
      system: systemPrompt(),
      messages: [{ role: "user", content: user }],
      tool: SUBMIT_NEWSLETTER_TOOL,
      maxTokens: 2048,
    });

  let raw: ComposedIntro;
  try {
    raw = await call();
  } catch {
    raw = await call(); // one retry, then let the error propagate
  }

  const intro = stripLongDashesDeep(raw);
  const paragraphs = (intro.intro_paragraphs ?? []).map((p) => p.trim()).filter(Boolean);
  if (!intro.subject?.trim() || !intro.preview_text?.trim() || !paragraphs.length) {
    throw new Error("Composer returned incomplete newsletter intro.");
  }
  return {
    intro: {
      subject: intro.subject.trim(),
      preview_text: intro.preview_text.trim(),
      intro_paragraphs: paragraphs.slice(0, 3),
      closing_line: intro.closing_line?.trim() || undefined,
    },
    model,
  };
}
