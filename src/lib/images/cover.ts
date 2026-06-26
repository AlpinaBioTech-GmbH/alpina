// Resolve a cover image for an article: find a Pexels photo, download it, and
// upload it to Storyblok assets. Best-effort — returns null (never throws) if
// PEXELS_API_KEY is unset, no photo matches, or any step fails, so a missing
// image never blocks publishing.
import { searchPexels } from "@/lib/images/pexels";
import { uploadImageAsset } from "@/lib/storyblok-management";

export interface ResolvedCover {
  assetId: number;
  assetUrl: string;
  alt: string;
  credit: string;
  sourceUrl: string;
}

export async function resolveCover(queries: string[], slug: string): Promise<ResolvedCover | null> {
  try {
    let photo = null;
    for (const q of queries) {
      photo = await searchPexels(q);
      if (photo) break;
    }
    if (!photo) return null;

    const res = await fetch(photo.imageUrl);
    if (!res.ok) {
      console.error(`[cover] download failed (${res.status}) for ${photo.imageUrl}`);
      return null;
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 5000) {
      console.error("[cover] downloaded image too small, skipping");
      return null;
    }

    const { id, url } = await uploadImageAsset({
      bytes,
      filename: `${slug.slice(0, 70)}-cover.jpg`,
      contentType: "image/jpeg",
    });
    return { assetId: id, assetUrl: url, alt: photo.alt, credit: photo.credit, sourceUrl: photo.sourceUrl };
  } catch (err) {
    console.error("[cover] resolveCover failed (non-fatal):", err);
    return null;
  }
}
