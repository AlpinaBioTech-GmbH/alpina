// src/lib/newsTags.ts
// News topic tags. The canonical list also lives in the Storyblok news_article
// `tags` field; keep the two in sync. Values are the stored option values;
// labels are what readers see. Neutralized to generic categories.

export const NEWS_TAGS = [
  { value: "company", label: "Company" },
  { value: "product", label: "Product" },
  { value: "industry", label: "Industry" },
  { value: "engineering", label: "Engineering" },
  { value: "research", label: "Research" },
] as const;

const LABELS: Record<string, string> = Object.fromEntries(
  NEWS_TAGS.map((t) => [t.value, t.label]),
);

/** Human label for a stored tag value (falls back to the raw value). */
export function tagLabel(value: string): string {
  return LABELS[value] ?? value;
}

/** Tag values that exist in the taxonomy, in canonical order, for a story. */
export function orderedTags(values?: string[] | null): string[] {
  if (!values?.length) return [];
  const set = new Set(values);
  return NEWS_TAGS.map((t) => t.value).filter((v) => set.has(v));
}
