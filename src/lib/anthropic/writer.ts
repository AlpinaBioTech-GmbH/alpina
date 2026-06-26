import type Anthropic from "@anthropic-ai/sdk";
import { MODELS, todayLine, forcedToolCall, researchTurns } from "@/lib/anthropic/client";
import type { Lead } from "@/lib/rss";
import { content } from "@/lib/config";

export interface DraftArticle {
  title: string;
  slug: string;
  excerpt: string;
  body: string; // constrained markdown, converted to Storyblok richtext on publish
  category: string;
  tags: string[];
  source_urls: string[];
}

const SUBMIT_ARTICLE_TOOL: Anthropic.Tool = {
  name: "submit_article",
  description: "Submit the final article exactly once.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Specific, concrete headline. No clickbait." },
      slug: {
        type: "string",
        description: "URL slug: lowercase, words separated by hyphens, no stop-word padding.",
      },
      excerpt: { type: "string", description: "2-3 sentence summary of the article's core argument." },
      body: {
        type: "string",
        description:
          "Full article body in markdown. ONLY: ## and ### headings, paragraphs, **bold**, *italic*, [text](url) links, '- ' bullet lists, '> ' blockquotes, '---' rules. Cite sources inline as [1], [2] markers matching source_urls order.",
      },
      category: { type: "string", description: "One category name from the provided list." },
      tags: { type: "array", items: { type: "string" }, description: "3-6 short topical tags." },
      source_urls: {
        type: "array",
        items: { type: "string" },
        description: "Real URLs actually retrieved during research, in citation order.",
      },
    },
    required: ["title", "slug", "excerpt", "body", "category", "tags", "source_urls"],
  },
};

function writerSystem(): string {
  const w = content.writer;
  return `You write articles for ${w.publication}. Audience: ${w.audience}.

VOICE: ${w.voice}

ARTICLE RULES (hard):
${w.rules.map((r) => `- ${r}`).join("\n")}
- Open with the concrete development or tension, not throat-clearing.
- Ground every factual claim in sources you actually retrieved via the web_search tool in this conversation. Cite inline with [1], [2] markers; the numbers map to source_urls order.
- Never fabricate a URL, figure, quote, or name. If you cannot verify it, leave it out.
- Specific dates, figures, thresholds, named actors. Specific and true beats big and vague.
- Markdown vocabulary is restricted to: ## and ### headings, paragraphs, **bold**, *italic*, [text](url) links, "- " bullets, "> " blockquotes, "---" rules. Nothing else (no tables, no images, no code blocks).
- Never use em-dash or en-dash characters anywhere. Use commas, colons, or "to" for ranges.

${todayLine()}`;
}

function renderLeads(leads: Lead[]): string {
  return leads
    .map((l) => `- [${l.source}] ${l.title} (${l.publishedAt.slice(0, 10)}) ${l.url}`)
    .join("\n");
}

async function draftFromResearch(research: string, system?: string): Promise<DraftArticle> {
  const draft = await forcedToolCall<DraftArticle>({
    model: MODELS.writer,
    system: system ?? writerSystem(),
    messages: [
      {
        role: "user",
        content: `Here is your completed research and draft notes:\n\n${research}\n\nNow submit the final article via the submit_article tool. The body must follow the restricted markdown vocabulary and cite sources as [n] markers matching source_urls order.`,
      },
    ],
    tool: SUBMIT_ARTICLE_TOOL,
  });
  return normalizeDraft(draft);
}

function normalizeDraft(draft: DraftArticle): DraftArticle {
  return {
    ...draft,
    slug: draft.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80),
    tags: (draft.tags ?? []).slice(0, 6),
    source_urls: draft.source_urls ?? [],
  };
}

export async function writeArticle(opts: {
  leads: Lead[];
  avoidTitles: string[];
  categories: string[];
}): Promise<DraftArticle> {
  const research = await researchTurns({
    model: MODELS.writer,
    system: writerSystem(),
    prompt: `Recent leads from the trade press:\n\n${renderLeads(opts.leads)}\n\nPick the single strongest story or theme for an article: high reader relevance, enough verifiable substance for a full piece, not a repeat of our recent coverage.\n\nALREADY COVERED (avoid these topics and titles):\n${opts.avoidTitles.map((t) => `- ${t}`).join("\n")}\n\nAvailable categories (pick one later): ${opts.categories.join(", ")}\n\nResearch the chosen story with web_search: verify the core facts, find at least 3 solid sources, gather concrete figures and dates. Then write the complete article draft (markdown, [n] citations) as your final text output, ending with a SOURCES list of the real URLs you retrieved.`,
  });
  if (!research) throw new Error("writer research returned no text");
  return draftFromResearch(research);
}

function opinionSystem(): string {
  const w = content.writer;
  return `You write first-person opinion articles for ${w.publication} under the byline of ${w.opinionAuthorName}.

VOICE: first person ("I"), author-to-reader. ${w.voice} Conviction with intellectual honesty: state the strongest counterargument fairly and engage with it on the merits before arguing the position. No strawmen, no hype, no fake certainty. The reader should finish knowing exactly where the author stands and why, plus one thing they can do about it.

ARTICLE RULES (hard):
${w.rules.map((r) => `- ${r}`).join("\n")}
- Open with the concrete tension or development, not throat-clearing.
- The piece is grounded in the provided reference document; quote or paraphrase it precisely and cite it as a numbered source (its URL is provided). Verify every additional factual claim with the web_search tool and cite inline with [1], [2] markers mapping to source_urls order.
- Never fabricate a URL, figure, quote, or name. If you cannot verify it, leave it out.
- Markdown vocabulary is restricted to: ## and ### headings, paragraphs, **bold**, *italic*, [text](url) links, "- " bullets, "> " blockquotes, "---" rules. Nothing else.
- Never use em-dash or en-dash characters anywhere. Use commas, colons, or "to" for ranges.

${todayLine()}`;
}

export async function writeOpinionArticle(opts: {
  topic: string;
  angle: string;
  documentTitle: string;
  documentText: string;
  documentSourceUrl: string | null;
  leads: Lead[];
  avoidTitles: string[];
  categories: string[];
}): Promise<DraftArticle> {
  const research = await researchTurns({
    model: MODELS.writer,
    system: opinionSystem(),
    prompt: `TOPIC for today's opinion piece: ${opts.topic}

ANGLE (the debate to engage): ${opts.angle}

REFERENCE DOCUMENT: "${opts.documentTitle}"${opts.documentSourceUrl ? ` (cite as: ${opts.documentSourceUrl})` : ""}
EXTRACTED TEXT (may be truncated):
${opts.documentText}

RECENT LEADS from the trade press (use for current context where relevant):
${renderLeads(opts.leads.slice(0, 25))}

ALREADY PUBLISHED (avoid repeating these titles/topics):
${opts.avoidTitles.map((t) => `- ${t}`).join("\n")}

Available categories (pick one later): ${opts.categories.join(", ")}

Use web_search to verify the document's standing (who published it, reactions, deadlines) and any additional claims you make. Then write the complete first-person opinion article (markdown, [n] citations) as your final text output, ending with a SOURCES list of real URLs (the reference document's URL included).`,
  });
  if (!research) throw new Error("opinion writer research returned no text");
  return draftFromResearch(research, opinionSystem());
}

export async function reviseArticle(opts: {
  draft: DraftArticle;
  notes: string;
  researchSuggestions: string;
  leads: Lead[];
}): Promise<DraftArticle> {
  const research = await researchTurns({
    model: MODELS.writer,
    system: writerSystem(),
    prompt: `You wrote this draft article:\n\nTITLE: ${opts.draft.title}\nEXCERPT: ${opts.draft.excerpt}\nCATEGORY: ${opts.draft.category}\nTAGS: ${opts.draft.tags.join(", ")}\nSOURCES:\n${opts.draft.source_urls.map((u, i) => `[${i + 1}] ${u}`).join("\n")}\n\nBODY:\n${opts.draft.body}\n\nThe editor did NOT approve it. Editor notes:\n${opts.notes}\n\nNeeds deeper research:\n${opts.researchSuggestions || "(none specified)"}\n\nUse web_search to fix the flagged gaps: verify or replace weak claims, add missing sources, tighten the argument. Then write the full revised article (markdown, [n] citations) as your final text output, ending with a SOURCES list of the real URLs.`,
  });
  if (!research) throw new Error("reviser research returned no text");
  return draftFromResearch(research);
}
