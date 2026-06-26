import type Anthropic from "@anthropic-ai/sdk";
import { MODELS, todayLine, forcedToolCall } from "@/lib/anthropic/client";
import type { DraftArticle } from "@/lib/anthropic/writer";
import { content } from "@/lib/config";

export interface EditorVerdict {
  score: number;
  approved: boolean;
  notes: string;
  research_suggestions: string;
}

const SUBMIT_REVIEW_TOOL: Anthropic.Tool = {
  name: "submit_review",
  description: "Submit the editorial review exactly once.",
  input_schema: {
    type: "object",
    properties: {
      score: { type: "integer", description: "Overall quality 0-100." },
      approved: {
        type: "boolean",
        description: "true only if the article can be auto-published as-is (score >= 80, no factual red flags).",
      },
      notes: { type: "string", description: "Concrete, actionable revision notes." },
      research_suggestions: {
        type: "string",
        description: "Specific claims or gaps that need deeper web research; empty string if none.",
      },
    },
    required: ["score", "approved", "notes", "research_suggestions"],
  },
};

export async function reviewArticle(draft: DraftArticle): Promise<EditorVerdict> {
  const w = content.writer;
  const system = `You are the senior editor at ${w.publication}, reviewing an article before auto-publication. Audience: ${w.audience}.

Review for, in priority order:
1. ACCURACY & SOURCING: every factual claim must be plausible and tied to a [n] citation with a real-looking source URL. Unverifiable figures, invented programmes, or citation-free claims are disqualifying.
2. RECENCY: the story must be current, not stale news repackaged.
3. READER VALUE: the voice and concrete implications match the publication, no hype or filler.
4. CRAFT: structure, clarity, restricted markdown vocabulary respected, no em/en dashes.

Approve (approved=true) ONLY if the article is publishable as-is: score >= 80 and no accuracy red flags. Otherwise return concrete notes and, where claims need verification, research_suggestions the writer can act on with web search.

${todayLine()}`;

  const verdict = await forcedToolCall<EditorVerdict>({
    model: MODELS.editor,
    system,
    messages: [
      {
        role: "user",
        content: `Review this draft:\n\nTITLE: ${draft.title}\nSLUG: ${draft.slug}\nEXCERPT: ${draft.excerpt}\nCATEGORY: ${draft.category}\nTAGS: ${draft.tags.join(", ")}\nSOURCES:\n${draft.source_urls.map((u, i) => `[${i + 1}] ${u}`).join("\n")}\n\nBODY:\n${draft.body}`,
      },
    ],
    tool: SUBMIT_REVIEW_TOOL,
    maxTokens: 2048,
  });
  return {
    score: Math.max(0, Math.min(100, Math.round(verdict.score ?? 0))),
    approved: Boolean(verdict.approved),
    notes: verdict.notes ?? "",
    research_suggestions: verdict.research_suggestions ?? "",
  };
}
