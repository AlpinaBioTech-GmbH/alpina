# IMAGE-GENERATION.md — Article figure brief for the AlpinaBioTech website

Drop this file into the Claude Code project for the AlpinaBioTech site. It is the
**canonical instruction for generating the hero/figure image of any new article**, so
every figure matches the existing set and ships with correct rights metadata.

> **Important:** these figures are **hand-authored SVG**, not output from an image model.
> Authoring SVG keeps the rights clean (original work, no stock/IP), keeps file sizes
> tiny, and lets the website restyle them. Do **not** call an image-generation model for
> these — write the SVG.

---

## The exact prompt to use (copy/paste, fill the placeholders)

When a new article needs a figure, run this prompt verbatim, substituting the four
`{{...}}` values:

```
Author a single SVG figure for an AlpinaBioTech research article.

ARTICLE TITLE: {{ARTICLE_TITLE}}
CONCEPT TO ILLUSTRATE: {{ONE_LINE_CONCEPT}}   // e.g. "how a sandwich ELISA captures an analyte between two antibodies"
OUTPUT FILE: images/{{NN}}-{{kebab-topic}}.svg

Follow IMAGE-GENERATION.md exactly:
- viewBox="0 0 900 480", font-family="Arial, Helvetica, sans-serif", no external fonts/images.
- Use ONLY the AlpinaBioTech token palette (below). Background #f4f7f8.
- Title 26px bold #0e2a38 at x=40 y=48; one-line subtitle 15px #5b6b73 at y=74.
- Keep it a clean, labelled SCHEMATIC: simple shapes, generous spacing, legible labels.
  Clarity over decoration — the site applies its own styling around it.
- Every figure ends with the credit line at y=466 (see spec).
- Add a "schematic / conceptual / not to scale" qualifier in the credit line where the
  drawing simplifies real biology, geometry, or data.
- Be scientifically accurate. No real patient data, no real people, no company logos,
  no third-party or copyrighted imagery, no stock art.

Then output the matching front-matter `hero_image` block (alt/title/copyright/source/
license) for the article, using the rights convention in IMAGE-GENERATION.md.
```

---

## Design tokens (do not improvise colours)

| Token | Hex | Use |
|---|---|---|
| Ink | `#0e2a38` | titles, primary strokes, dark fills |
| Glacier teal | `#2e8c9e` | primary accent, capture/detection elements, curves |
| Light teal | `#7fb2bf` | secondary elements, intermediate layers |
| Signal amber | `#f2b705` | the "signal"/result motif, highlights, key markers |
| Slate | `#5b6b73` | secondary text, labels |
| Hairline | `#cdd8db` | card borders / strokes |
| Negative red | `#c0392b` | negative / sub-therapeutic / failure states (sparingly) |
| Surface | `#ffffff` | cards / panels |
| Background | `#f4f7f8` | full-canvas background |
| Credit grey | `#90a0a6` | the footer credit line only |

Signature motif: the **amber circle = "signal"** (the colour of a developed ELISA well).
Reuse it as the recurring visual anchor for "result / readout / detection" across figures.

## Layout rules

- Canvas `900 × 480`, background rect `#f4f7f8`.
- Title: `font-size="26" font-weight="bold" fill="#0e2a38"` at `x=40 y=48`.
- Subtitle: `font-size="15" fill="#5b6b73"` at `x=40 y=74`, one sentence.
- Content cards/panels: `fill="#ffffff" stroke="#cdd8db"`, `rx` 10–12.
- Axes (for plots): `stroke="#0e2a38" stroke-width="2"`; dashed reference lines use the
  relevant token with `stroke-dasharray="6 4"`.
- Arrows: short line + small filled triangle `polygon`, `#0e2a38`.
- Keep ≥40px margins; do not crowd. Restraint over density.

## Mandatory credit line (every figure)

Place at the bottom, `font-size="12" fill="#90a0a6"`, `x=40 y=466`:

```
© 2026 AlpinaBioTech GmbH — original illustration. {{QUALIFIER}}
```

`{{QUALIFIER}}` examples actually used: `Schematic only; not to scale.` ·
`Conceptual; thresholds are assay- and drug-specific.` ·
`Educational summary; not clinical guidance.` · `RUO context.`
Update the year to the year of authoring.

---

## Output & naming

- Save to `images/` as `NN-kebab-topic.svg`, where `NN` is the next two-digit sequence
  number and the slug matches the article (e.g. `07-sandwich-elisa-stepwise.svg`).
- One self-contained SVG per article. No `<script>`, no embedded raster, no web fonts.

## Rights & metadata (always produce this alongside the SVG)

All figures are **original works © AlpinaBioTech GmbH**, so there are no external
attribution duties. Emit a `hero_image` block for the article front-matter using this
exact shape — the four metadata strings map straight onto the Storyblok asset
`meta_data` fields (`alt`, `title`, `copyright`, `source`) at push time:

```yaml
hero_image:
  file: ../images/{{NN}}-{{kebab-topic}}.svg
  alt: "{{plain-language description of what the figure shows}}"
  title: "{{short figure title}}"
  copyright: "© {{YEAR}} AlpinaBioTech GmbH. All rights reserved."
  source: "Original illustration created in-house for AlpinaBioTech GmbH."
  license: "Proprietary — AlpinaBioTech GmbH (free to reuse within AlpinaBioTech web and print properties)"
```

`alt` must be genuinely descriptive (accessibility + SEO), not the file name.

---

## Content rules (non-negotiable)

1. **Accurate science.** The figure must be correct for an immunoassay / TDM / biologics
   audience. If unsure of a mechanism, check it before drawing — a wrong schematic is
   worse than none.
2. **RUO framing.** Nothing should imply diagnostic use. Where a figure touches clinical
   thresholds or decisions, label it conceptual/educational in the credit line.
3. **No real people, no patient data, no logos, no third-party or copyrighted imagery,
   no stock art.** Original shapes and labels only.
4. **Schematic, not literal.** State "not to scale" when geometry is simplified.
5. **Self-consistent.** Reuse the tokens, the amber-signal motif, and the title/subtitle/
   credit structure so the article library looks like one coherent set.

---

## Worked example (what "good" looks like)

Input: article *"Reading a Calibration Curve: Why 4PL Beats a Straight Line"*,
concept = "a 4-parameter logistic curve with the quantifiable range marked".

Expected output:
- `images/07-calibration-curve-4pl.svg` — `900×480`, `#f4f7f8` background; title in ink;
  a `#2e8c9e` sigmoid with `#f2b705` standard points; dashed `#cdd8db` lines marking LLOQ
  and ULOQ; the flat asymptotes shaded to show the unreliable zones; credit line
  `© 2026 AlpinaBioTech GmbH — original illustration. Conceptual; not to scale.`
- A matching `hero_image` YAML block with descriptive `alt` and the standard rights
  strings.

That is the bar for every new figure.
