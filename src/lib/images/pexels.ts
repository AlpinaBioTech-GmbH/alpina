// Pexels stock-photo search for article cover images. Pexels License allows
// free use without attribution; we still capture a credit + source URL for the
// article's image_credit / image_source_url fields. Returns null (never throws)
// when unconfigured or no match, so cover images stay strictly best-effort.

export interface PexelsPhoto {
  imageUrl: string; // direct, downloadable JPEG
  credit: string; // "Photo: {photographer} / Pexels"
  sourceUrl: string; // Pexels photo page
  alt: string;
}

export async function searchPexels(query: string): Promise<PexelsPhoto | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return null;
  const q = query.trim();
  if (!q) return null;
  try {
    const url =
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}` +
      `&per_page=10&orientation=landscape&size=large`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) {
      console.error(`[pexels] search "${q}" failed (${res.status})`);
      return null;
    }
    const data = (await res.json()) as {
      photos?: Array<{
        src?: { original?: string; large2x?: string; large?: string };
        url?: string;
        photographer?: string;
        alt?: string;
      }>;
    };
    return toPhoto(data.photos?.[0]) ?? null;
  } catch (err) {
    console.error(`[pexels] search "${q}" threw:`, err);
    return null;
  }
}

/** Extract the numeric photo id from a Pexels photo-page URL. */
export function pexelsPhotoIdFromUrl(url: string): string | null {
  const m = url.match(/pexels\.com\/photo\/(?:[^/?#]*-)?(\d+)/i);
  return m ? m[1] : null;
}

/** Resolve a specific Pexels photo (by id) to its downloadable image + credit. */
export async function getPexelsPhotoById(id: string): Promise<PexelsPhoto | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch(`https://api.pexels.com/v1/photos/${id}`, { headers: { Authorization: key } });
    if (!res.ok) {
      console.error(`[pexels] photo ${id} failed (${res.status})`);
      return null;
    }
    return toPhoto((await res.json()) as PexelsApiPhoto) ?? null;
  } catch (err) {
    console.error(`[pexels] photo ${id} threw:`, err);
    return null;
  }
}

interface PexelsApiPhoto {
  src?: { original?: string; large2x?: string; large?: string };
  url?: string;
  photographer?: string;
  alt?: string;
}

function toPhoto(p: PexelsApiPhoto | undefined): PexelsPhoto | null {
  const imageUrl = p?.src?.large2x || p?.src?.large || p?.src?.original;
  if (!p || !imageUrl) return null;
  return {
    imageUrl,
    credit: `Photo: ${p.photographer ?? "Pexels"} / Pexels`,
    sourceUrl: p.url ?? "https://www.pexels.com",
    alt: p.alt?.trim() || "",
  };
}
