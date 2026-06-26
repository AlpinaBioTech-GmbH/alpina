// Deterministic long-dash removal, applied to every article at the publish
// choke point. House style: long dashes never appear in published copy:
// punctuation dashes become commas, ranges become plain hyphens. URLs are left
// untouched so citations and markdown links keep working.
//
// Covered characters: em dash (U+2014), en dash (U+2013), figure dash
// (U+2012), horizontal bar (U+2015).

const LONG_DASH = "[‒–—―]";
const URL_RE = /https?:\/\/[^\s)\]]+/g;
const NUL = String.fromCharCode(0);

function stripInProse(text: string): string {
  return (
    text
      // Unspaced digit ranges keep range semantics with a plain hyphen.
      .replace(new RegExp(`(\\d)${LONG_DASH}(\\d)`, "g"), "$1-$2")
      // Punctuation dashes (with or without surrounding spaces) become a comma + space.
      .replace(new RegExp(`\\s*${LONG_DASH}+\\s*`, "g"), ", ")
      // Anything that slipped through becomes a plain hyphen.
      .replace(new RegExp(LONG_DASH, "g"), "-")
  );
}

export function stripLongDashes(text: string): string {
  // Shield URL spans behind NUL-delimited placeholders so dashes inside
  // links survive; NUL can't occur in prose and isn't touched by dash rules.
  const urls: string[] = [];
  const shielded = text.replace(URL_RE, (url) => {
    urls.push(url);
    return `${NUL}URL${urls.length - 1}${NUL}`;
  });
  const cleaned = stripInProse(shielded);
  return cleaned.replace(new RegExp(`${NUL}URL(\\d+)${NUL}`, "g"), (_, i) => urls[Number(i)]);
}

/** Recursively strip long dashes from every string in a value (arrays/objects). */
export function stripLongDashesDeep<T>(value: T): T {
  if (typeof value === "string") return stripLongDashes(value) as unknown as T;
  if (Array.isArray(value)) return value.map(stripLongDashesDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripLongDashesDeep(v);
    }
    return out as T;
  }
  return value;
}
