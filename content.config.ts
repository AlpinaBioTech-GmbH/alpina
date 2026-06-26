/**
 * Content + AI configuration: the editorial voice for the article writer, the
 * persona and content "pillars" for social posts, and which Storyblok content
 * feeds the social catalog. This decouples all SAV/4QT-specific copy from the
 * pipeline code. Edit the strings; the pipelines read from here.
 */

export interface Pillar {
  id: string;
  label: string;
  guidance: string;
}

export const content = {
  /** Storyblok folder prefix where published articles live (with trailing slash). */
  articleSlugPrefix: "articles/",

  /** Editorial voice for the AI article writer + editor. */
  writer: {
    publication: "AlpinaBioTech",
    audience: "clinical and research scientists working in therapeutic drug monitoring and immunoassays",
    voice:
      "Scientific, precise, and plainspoken. No hype or marketing fluff. Lead with the assay, the analyte, and what it lets the reader measure. Always note Research Use Only status.",
    rules: [
      "900-1400 words.",
      "Cite retrieved sources inline as [n] and list them at the end.",
      "Use ## and ### headings, short paragraphs, bold for key terms.",
      "Do not use em dashes or en dashes; use hyphens, colons, or commas.",
      "Never invent figures, quotes, client names, or outcomes the sources do not support.",
    ],
    /** Author name attached to first-person opinion pieces. */
    opinionAuthorName: "AlpinaBioTech",
    /** Controlled tag vocabulary: the ONLY tags an article may carry. The
     *  writer picks 1-3 from this list and publishArticle enforces it (mapping
     *  near-synonyms back to these), so the /articles tag filter stays tidy. */
    articleTags: [
      "ELISA",
      "Therapeutic Drug Monitoring",
      "Immunogenicity",
      "Anti-Drug Antibodies",
      "Biosimilars",
      "Anti-TNF",
      "Assay Validation",
    ],
  },

  /** Shared tone for social composers + validators (both import these). */
  social: {
    persona:
      "The posts speak as AlpinaBioTech, a European distributor of ImmunoGuide ELISA kits for therapeutic drug monitoring and anti-drug antibody detection. " +
      "Voice: first-person plural (\"we\"), plainspoken, commercial, restrained, specific, useful. " +
      "No ego, no hype, no fake certainty, no filler.",
    anglePrinciple:
      "It is fine to feature the same piece of work again, but come at it from a genuinely different ANGLE each time so the POINT changes, not just the words. " +
      "Use a different lens: one lesson learned, a behind-the-scenes constraint, a contrarian take, one concrete tactic the reader can copy, a question to the reader, or the \"why it matters\" for a specific segment. " +
      "Do not re-make the same point about the same item.",
    accuracyRule:
      "Stay strictly grounded in what the catalog item actually supports. " +
      "No overstated or unverifiable outcome claims, no invented metrics, client counts, or ROI. " +
      "If we do not have a real number, do not imply one. Specific and true beats big and vague.",
    /** Rotating content themes for social posts (LRU-picked per run). */
    pillars: [
      {
        id: "product-value",
        label: "What we do and why it matters",
        guidance:
          "One concrete thing we offer, the real problem it solves, and who it is for. Grounded in the catalog item, no invented outcomes.",
      },
      {
        id: "behind-the-build",
        label: "Behind the build",
        guidance:
          "A design decision, trade-off, or constraint behind one of our products or articles: what we chose and why.",
      },
      {
        id: "lesson-learned",
        label: "A lesson worth sharing",
        guidance:
          "One decision, mistake, or trade-off and the practical takeaway a reader can apply today.",
      },
      {
        id: "industry-read",
        label: "Reading the industry",
        guidance:
          "A development in our space and its concrete implication for the reader, inviting them to the related article.",
      },
    ] as Pillar[],
  },

  /** What the social catalog draws from when grounding posts. */
  catalog: {
    includeArticles: true,
    includeNewsletter: false,
    /** Optional marketing page full-slugs to feature (e.g. ["pricing", "about"]). */
    pageSlugs: [] as string[],
  },

  /** Seed RSS feeds for the article pipeline (also editable in /admin/feeds). */
  rssSeed: [] as { url: string; label: string; category?: string }[],
} as const;

export type Content = typeof content;
