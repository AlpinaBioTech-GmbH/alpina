// Brief Claude brand-safety review shared by every validator. Runs only after
// deterministic checks pass; fails OPEN on model errors (logged) so a flaky
// model call can't block an otherwise valid post.
import { anthropic, MODELS, todayLine } from "@/lib/anthropic/client";
import { brand } from "@/lib/config";

export interface BriefReview {
  approved: boolean;
  reason: string;
}

export async function reviewPostBriefly(
  fullText: string,
  recentTexts: string[],
): Promise<BriefReview> {
  const system = `You are a social-media editor protecting ${brand.name}'s professional brand. Approve a post if it is on-brand and non-cringe, makes no unverifiable/false claims, and has a clear point. Reusing the same site material/link as a recent post is FINE and expected — do NOT reject for linking to the same project, article, or page again. Reject for sameness ONLY when this post makes essentially the same point in similar wording as a recent post (a near-duplicate); a genuinely fresh angle, lesson, or framing on the same material should be APPROVED.
Respond with ONLY a JSON object: {"approved": boolean, "reason": string}. No other text.
${todayLine()}`;

  try {
    const response = await anthropic.messages.create({
      model: MODELS.social,
      max_tokens: 400,
      system,
      messages: [
        {
          role: "user",
          content: `POST TO REVIEW:\n${fullText}\n\nRECENT POSTS:\n${
            recentTexts.slice(0, 15).map((t) => `---\n${t}`).join("\n") || "(none)"
          }`,
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON in review response");
    const parsed = JSON.parse(match[0]) as BriefReview;
    return { approved: Boolean(parsed.approved), reason: String(parsed.reason ?? "") };
  } catch (err) {
    console.warn("[social] brief review failed open:", err);
    return { approved: true, reason: "review model unavailable; deterministic checks passed" };
  }
}
