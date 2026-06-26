/**
 * Brand identity for AlpinaBioTech. Edit this file (plus src/app/theme.css for
 * colors and src/app/layout.tsx for fonts) to adjust branding.
 *
 * Nothing here is secret: it ships in the client bundle. Secrets live in env.
 */
export const brand = {
  /** Short product/company name shown in nav, footer, titles. */
  name: "AlpinaBioTech",
  /** Full legal name for the footer copyright line. */
  legalName: "AlpinaBioTech GmbH",
  /** Canonical site URL (no trailing slash). Overridden by NEXT_PUBLIC_SITE_URL. */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  /** One-line tagline used under the wordmark and as a metadata fallback. */
  tagline: "Empowering Precision Diagnostics",
  /** Default meta description for pages that do not set their own. */
  description:
    "AlpinaBioTech is the exclusive European distributor of ImmunoGuide ELISA kits for therapeutic drug monitoring and anti-drug antibody detection, serving clinical labs, research institutions, and biotech companies.",
  /** Home page <title>. Other pages render "Page - {name}". */
  homeTitle:
    "AlpinaBioTech - Precision ELISA kits for therapeutic drug monitoring",

  /** Company registration + address (footer + imprint). */
  company: {
    address: "Schauinslandstrasse 12, 76199 Karlsruhe, Germany",
    registration: "Commercial Register of Mannheim, HRB 757253",
    manufacturerNote:
      "All products are manufactured by ImmunoGuide under ISO 13485 certification.",
    regulatoryNote: "For Research Use Only (RuO). Not for diagnostic procedures.",
  },

  contact: {
    /** Public contact address shown in the footer. */
    email: "info@alpinabiotech.com",
    /** Where contact/quote-form notifications are sent. Falls back to env. */
    notifyTo: process.env.CONTACT_NOTIFY_TO || "info@alpinabiotech.com",
    /** Verified Resend sender. Falls back to env. */
    from: process.env.CONTACT_FROM || "AlpinaBioTech <noreply@alpinabiotech.com>",
    linkedin: "https://www.linkedin.com/company/alpinabiotech/",
  },

  nav: {
    /** Primary call-to-action button in the header. */
    primaryCta: { label: "Request a quote", href: "/contact" },
    /** Secondary link: the ImmunoGuide manufacturer site. */
    secondaryLink: {
      label: "ImmunoGuide",
      href: "https://www.immunoguide.com",
    } as { label: string; href: string } | null,
  },

  assistant: {
    /** Default system prompt seeded into assistant_config on first run. */
    defaultSystemPrompt:
      "You are the AlpinaBioTech assistant. AlpinaBioTech is the exclusive European distributor of ImmunoGuide ELISA kits for therapeutic drug monitoring (drug-level ELISAs) and anti-drug antibody (ADA) detection. Answer using only the provided context about our products, kits, and company. If the context does not contain the answer, say so plainly and point the user to info@alpinabiotech.com. All kits are For Research Use Only. Be concise, accurate, and never invent specifications, sensitivities, or prices.",
    /** Subject phrase used in the conversation-analysis prompt. */
    analysisSubject: "the AlpinaBioTech ELISA-kit assistant",
    /** Starter questions shown in the widget before the first message. */
    presetQuestions: [
      "Which ELISA kits do you offer for adalimumab?",
      "What is the difference between a drug ELISA and an ADA ELISA?",
      "How do I request a quote?",
    ],
  },
} as const;

export type Brand = typeof brand;
