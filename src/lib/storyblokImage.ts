// Server-side LQIP (low-quality image placeholder) generator for Storyblok
// assets. Fetches a small version of the image and re-encodes it as a tiny
// blurred webp data URI, used as next/image's blurDataURL so images fade in
// from a blurred preview instead of popping from an empty box.
import "server-only";
import { cache } from "react";
import sharp from "sharp";

// Cross-request memo (per server instance). Keyed by the full asset URL.
const memo = new Map<string, string | undefined>();

async function build(src: string): Promise<string | undefined> {
  try {
    // Storyblok image service: /m/64x0 = 64px wide, proportional height.
    const res = await fetch(`${src}/m/64x0`, { cache: "force-cache" });
    if (!res.ok) return undefined;
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input).resize(20).webp({ quality: 35 }).toBuffer();
    return `data:image/webp;base64,${out.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** Tiny blurred data URI for a Storyblok image, or undefined if unavailable.
 *  Memoized per-request (React cache) and per-process (Map). */
export const lqip = cache(
  async (src?: string | null): Promise<string | undefined> => {
    // Only Storyblok assets support the /m/ image service used for the LQIP.
    if (!src || !src.includes("a.storyblok.com")) return undefined;
    if (memo.has(src)) return memo.get(src);
    const value = await build(src);
    memo.set(src, value);
    return value;
  },
);
