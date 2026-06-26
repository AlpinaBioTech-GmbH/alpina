// Rotating content "pillars" (angles) for social posts. The pillar SET comes
// from content.config.ts (content.social.pillars) so a rebrand never edits this
// file; the pickPillar() LRU logic is content-neutral and stays here.
import { content, type Pillar } from "@/lib/config";

export type { Pillar };

export const pillars: Pillar[] = content.social.pillars;

/** Least-recently-used pillar given recent post history (any provider).
 *  `exclude` lets a retry loop skip pillars already tried this run; if every
 *  pillar is excluded it falls back to the full set. */
export function pickPillar(recent: { pillar: string | null }[], exclude?: Set<string>): Pillar {
  const eligible = exclude?.size ? pillars.filter((p) => !exclude.has(p.id)) : pillars;
  const pool = eligible.length ? eligible : pillars;
  const usedOrder = recent.map((r) => r.pillar).filter(Boolean) as string[];
  for (const p of pool) if (!usedOrder.includes(p.id)) return p; // never used recently
  let best = pool[0],
    bestIdx = -1;
  for (const p of pool) {
    const idx = usedOrder.indexOf(p.id); // smaller = more recent
    const lastUsed = idx === -1 ? Infinity : idx;
    if (lastUsed > bestIdx) {
      bestIdx = lastUsed;
      best = p;
    }
  }
  return best;
}
