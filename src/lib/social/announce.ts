// Announce a newly published article on all platforms. Best-effort by
// design: one platform failing never blocks the others, and the caller
// (article pipeline) wraps the whole call in try/catch.
import { articleCatalogItem } from "@/lib/social/catalog";
import { postItemToLinkedin, type LinkedinResult } from "@/lib/linkedin/pipeline";
import { postItemToTwitter, type TwitterResult } from "@/lib/twitter/pipeline";
import { postItemToInstagram, type InstagramResult } from "@/lib/instagram/pipeline";
import { alertOnFailures } from "@/lib/social/notify";
import type { RunTrigger } from "@/lib/runs";

export interface AnnounceResult {
  linkedin: LinkedinResult;
  twitter: TwitterResult;
  instagram: InstagramResult;
}

function settled<T extends { ok: boolean; status: string }>(
  result: PromiseSettledResult<T>,
): T | { ok: false; status: "failed"; reason: string } {
  return result.status === "fulfilled"
    ? result.value
    : { ok: false, status: "failed", reason: String(result.reason) };
}

export async function announceArticle(
  article: { slug: string; title: string; excerpt: string; tags?: string[] },
  opts: { trigger: RunTrigger; requireAuto?: boolean },
): Promise<AnnounceResult> {
  const item = articleCatalogItem(article);
  const shared = { trigger: opts.trigger, requireAuto: opts.requireAuto ?? true };
  const [li, tw, ig] = await Promise.allSettled([
    postItemToLinkedin(item, shared),
    postItemToTwitter(item, shared),
    postItemToInstagram(item, shared),
  ]);
  const result = {
    linkedin: settled(li) as LinkedinResult,
    twitter: settled(tw) as TwitterResult,
    instagram: settled(ig) as InstagramResult,
  };
  // Page the operator on actionable failures. Best-effort — never breaks the announce.
  await alertOnFailures("announce", result);
  return result;
}
