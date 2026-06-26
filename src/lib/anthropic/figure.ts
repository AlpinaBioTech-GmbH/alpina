// Author an article's hero figure as hand-written SVG, per IMAGE-GENERATION.md.
// Every figure is an ORIGINAL schematic on the AlpinaBioTech token palette - no
// image model, no stock art - so the library stays one coherent, rights-clean
// set. Returns a validated SVG string, or null if a spec-compliant figure can't
// be produced (the pipeline then holds the article rather than shipping it
// without a figure). validateFigure() is the automated "editor check" that the
// figure is present and consistent with the previous articles.
import { anthropic, MODELS } from "@/lib/anthropic/client";

const FIGURE_BRIEF = `Author a single, self-contained SVG figure for an AlpinaBioTech research article.

HARD REQUIREMENTS (a figure that breaks any of these is rejected):
- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 480" font-family="Arial, Helvetica, sans-serif">.
- First child: <rect width="900" height="480" fill="#f4f7f8"/>.
- Title: <text x="40" y="48" font-size="26" font-weight="bold" fill="#0e2a38">…</text>. This is a SHORT figure title: keep it under ~46 characters so it never runs past x=860. If the article title is longer, shorten or rephrase it into a concise figure title (do NOT paste the full article title).
- Subtitle: <text x="40" y="74" font-size="15" fill="#5b6b73">…</text> (one sentence).
- Use ONLY these colours: #0e2a38 ink, #2e8c9e teal, #7fb2bf light teal, #f2b705 amber "signal", #5b6b73 slate, #cdd8db hairline, #c0392b red (sparingly), #ffffff cards, #f4f7f8 background, #90a0a6 credit.
- Cards/panels: fill="#ffffff" stroke="#cdd8db" rx 10-12. Axes: stroke="#0e2a38" stroke-width="2". Dashed refs: stroke-dasharray="6 4".
- Reuse the SIGNATURE MOTIF: an amber circle (#f2b705) means the "signal" / result / readout.
- >=40px margins, generous spacing, legible labels. A clean labelled SCHEMATIC; clarity over decoration.
- LAST element must be the credit line, EXACTLY in this shape (only the trailing qualifier varies):
  <text x="40" y="466" font-size="12" fill="#90a0a6">© 2026 AlpinaBioTech GmbH — original illustration. {QUALIFIER}</text>
  where {QUALIFIER} is a short clause such as "Conceptual; not to scale." or "Conceptual; thresholds are assay- and drug-specific.".
- NO <script>, NO <image>, NO embedded raster or base64, NO external fonts/URLs, NO logos, NO real people or patient data, NO third-party/copyrighted imagery.
- Scientifically accurate for an immunoassay / therapeutic-drug-monitoring / biologics audience. Schematic, not literal.

Output ONLY the raw SVG markup (start with <svg, end with </svg>). No markdown fences, no commentary.`;

function extractSvg(text: string): string | null {
  const m = text.match(/<svg[\s\S]*<\/svg>/);
  return m ? m[0].trim() : null;
}

/** The automated editor check: enforce the IMAGE-GENERATION.md brief so the
 *  figure is consistent with the existing set and rights-clean. */
export function validateFigure(svg: string): boolean {
  if (!/^<svg\b/.test(svg)) return false;
  if (!/viewBox="0 0 900 480"/.test(svg)) return false;
  if (!/<rect[^>]*fill="#f4f7f8"/.test(svg)) return false; // canvas background
  if (!/©\s*\d{4}\s*AlpinaBioTech GmbH/.test(svg)) return false; // credit line present
  // Title must fit the canvas (no clipping at 26px within ~820px of width).
  const title = svg.match(/<text x="40" y="48"[^>]*>([^<]*)<\/text>/)?.[1] ?? "";
  if (!title || title.length > 58) return false;
  if (/<script/i.test(svg)) return false;
  if (/<image\b/i.test(svg)) return false;
  if (/data:image|xlink:href|href\s*=\s*"https?:/i.test(svg)) return false; // no raster/external refs
  if (svg.length > 80_000) return false; // sanity bound
  return true;
}

/** Generate a spec-compliant hero figure for an article. Two attempts; returns
 *  null if neither passes validateFigure(). */
export async function generateFigureSvg(opts: {
  title: string;
  concept: string;
}): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await anthropic.messages.create({
        model: MODELS.writer,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${FIGURE_BRIEF}\n\nARTICLE TITLE: ${opts.title}\nCONCEPT TO ILLUSTRATE: ${opts.concept}`,
          },
        ],
      });
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const svg = extractSvg(text);
      if (svg && validateFigure(svg)) return svg;
      console.warn(`[figure] attempt ${attempt + 1} failed validation`);
    } catch (e) {
      console.error("[figure] generation error:", e);
    }
  }
  return null;
}
