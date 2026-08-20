// Newsletter digest email renderer. Table-based 600px shell with fully inline
// styles: broadcasts land in unknown clients (Outlook included). Palette is
// the site's medical-blue theme converted to hex (emails cannot read CSS vars;
// keep in sync with src/app/globals.css :root tokens).
// Two modes:
//   broadcast - the real send; must contain Resend's unsubscribe merge tag.
//   copy      - the info@ copy / dry-run preview; inert unsubscribe link.
import { brand } from "@/lib/config";
import { siteUrl } from "@/lib/site";
import type { DigestArticle } from "@/lib/newsletter/digest";

const PAPER = "#f8fafe"; // --background
const PAPER2 = "#dee9f9"; // --secondary
const INK = "#0d1d34"; // --foreground
const INK2 = "#475974"; // --muted-foreground
const SIGNAL = "#1d60bc"; // --primary
const VOID = "#07101c"; // dark-mode background (header band)
const ON_VOID = "#e8eff9"; // dark-mode foreground
const HAIR = "#d1dcec"; // --border
const MIST = "#418ad1"; // muted accent on the dark band
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS = "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

const UNSUBSCRIBE_TAG = "{{{RESEND_UNSUBSCRIBE_URL}}}";

export type NewsletterEmailMode = "broadcast" | "copy";

export type RenderDigestOptions = {
  title: string; // e.g. "AlpinaBioTech Digest - July 2026"
  monthLabel: string; // "July 2026"
  introParagraphs: string[];
  closingLine?: string | null;
  articles: DigestArticle[];
  previewText: string;
  mode: NewsletterEmailMode;
  archiveUrl?: string | null; // "View in browser"
  previousIssue?: { title: string; url: string } | null;
};

function esc(s = ""): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function eyebrow(text: string, color = SIGNAL): string {
  return `<div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${color}">${esc(text)}</div>`;
}

function articleDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function articleCard(a: DigestArticle): string {
  // Storyblok image service: 2x the 536px content width. SVG heroes render as-is.
  const hero = a.heroUrl
    ? `<a href="${esc(a.url)}" style="text-decoration:none"><img src="${esc(a.heroUrl.endsWith(".svg") ? a.heroUrl : `${a.heroUrl}/m/1072x0`)}" width="536" alt="${esc(a.heroAlt)}" style="display:block;width:100%;max-width:536px;height:auto;border-radius:6px;margin:0 0 14px;border:1px solid ${HAIR}"/></a>`
    : "";
  const tags = a.tags.length
    ? `<div style="font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${INK2};margin:0 0 8px">${esc(a.tags.slice(0, 3).join(" / "))}</div>`
    : "";
  return `<tr><td style="padding:0 32px">
    <div style="border-top:1px solid ${HAIR};padding:24px 0 10px">
      ${hero}
      ${tags}
      <h2 style="margin:0 0 8px;font-family:${SANS};font-weight:600;font-size:19px;line-height:1.35"><a href="${esc(a.url)}" style="color:${INK};text-decoration:none">${esc(a.title)}</a></h2>
      <div style="font-family:${MONO};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${INK2};margin:0 0 10px">${esc(articleDate(a.date))}</div>
      <p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.65;color:${INK}">${esc(a.teaser)}</p>
      <a href="${esc(a.url)}" style="font-family:${MONO};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${SIGNAL};text-decoration:none">Read the article <img src="${siteUrl()}/email/arrow-right.png" width="14" height="14" alt="" style="vertical-align:-2px;border:0"/></a>
    </div>
  </td></tr>`;
}

export function renderDigestEmail(opts: RenderDigestOptions): { html: string; text: string } {
  const unsubscribeHref = opts.mode === "broadcast" ? UNSUBSCRIBE_TAG : "#";

  const intro = opts.introParagraphs
    .map((p) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK}">${esc(p)}</p>`)
    .join("");

  const closing = opts.closingLine
    ? `<tr><td style="padding:4px 32px 8px">
        <div style="border-top:1px solid ${HAIR};padding-top:20px">
          <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK}">${esc(opts.closingLine)}</p>
        </div>
      </td></tr>`
    : "";

  const previous = opts.previousIssue
    ? `<tr><td style="padding:10px 32px 6px">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="background:${PAPER2};padding:16px 20px;border-radius:8px">
          ${eyebrow("From the archive", INK2)}
          <p style="margin:8px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${INK}">Missed our last issue? Read <a href="${esc(opts.previousIssue.url)}" style="color:${SIGNAL};text-decoration:underline">${esc(opts.previousIssue.title)}</a>.</p>
        </td></tr></table>
      </td></tr>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${SANS}">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(opts.previewText)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${PAPER}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;background:${PAPER}">
      <tr><td style="background:${VOID};padding:30px 32px;border-radius:8px 8px 0 0">
        ${eyebrow(`${brand.name} | Monthly digest`, MIST)}
        <h1 style="margin:12px 0 8px;font-family:${SANS};font-weight:600;font-size:24px;line-height:1.3;color:${ON_VOID}">${esc(opts.title)}</h1>
        <div style="font-family:${MONO};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${MIST}">${esc(opts.monthLabel)}</div>
      </td></tr>
      <tr><td style="padding:26px 32px 12px">${intro}</td></tr>
      ${opts.articles.map(articleCard).join("")}
      ${closing}
      ${previous}
      <tr><td style="padding:20px 32px 30px;border-top:1px solid ${HAIR}">
        <p style="margin:0 0 10px;font-family:${MONO};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${INK2}">
          ${opts.archiveUrl ? `<a href="${esc(opts.archiveUrl)}" style="color:${INK2};text-decoration:underline">View in browser</a> &nbsp;|&nbsp; ` : ""}<a href="${unsubscribeHref}" style="color:${INK2};text-decoration:underline">Unsubscribe</a>
        </p>
        <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:1.6;color:${INK2}">${esc(brand.legalName)} &middot; ${esc(brand.company.address)}<br/>${esc(brand.company.registration)}</p>
        <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${INK2}">${esc(brand.company.regulatoryNote)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  if (opts.mode === "broadcast" && !html.includes(UNSUBSCRIBE_TAG)) {
    throw new Error("Broadcast email is missing the unsubscribe link.");
  }

  const text = [
    opts.title,
    opts.monthLabel,
    "",
    ...opts.introParagraphs.flatMap((p) => [p, ""]),
    ...opts.articles.flatMap((a) => [`${a.title} (${articleDate(a.date)})`, a.teaser, a.url, ""]),
    opts.closingLine ?? "",
    opts.previousIssue ? `Previous issue: ${opts.previousIssue.title} - ${opts.previousIssue.url}` : "",
    "",
    opts.archiveUrl ? `View in browser: ${opts.archiveUrl}` : "",
    opts.mode === "broadcast" ? `Unsubscribe: ${UNSUBSCRIBE_TAG}` : "",
    "",
    `${brand.legalName} - ${brand.company.address}`,
    brand.company.regulatoryNote,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { html, text };
}
