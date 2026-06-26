// Instagram carousel slide renderer: 1080×1350 (4:5), dark typographic system.
// Satori (next/og) needs literal hex values, so the palette is inlined here.
// Cover = hook; content = kicker/title/body; final slide = slogan + site +
// "link in bio" chip. Brand wordmark and host come from the brand config.
import { ImageResponse } from "next/og";
import { brand } from "@/lib/config";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

// Neutral dark palette as literal hex (Satori cannot read CSS vars / oklch).
// Rebrand by editing these tokens to match your theme.
const C = {
  background: "#0a0a0a",
  foreground: "#fafafa",
  muted: "#a1a1aa",
  faint: "#52525b",
  primary: "#6366f1",
  border: "#27272a",
} as const;

/** Brand wordmark shown on every slide (uppercased). */
function wordmark(): string {
  return brand.name.toUpperCase();
}

/** Bare host (no scheme/path) shown in the slide footer. */
function siteHost(): string {
  try {
    return new URL(brand.siteUrl).host.replace(/^www\./, "");
  } catch {
    return brand.siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

export interface SlideSpec {
  kicker?: string;
  title: string;
  body?: string;
}

export type SlideKind = "cover" | "content" | "cta";

export function slideKind(index: number, total: number): SlideKind {
  if (index === 0) return "cover";
  if (index === total - 1 && total > 1) return "cta";
  return "content";
}

function Dots({ index, total }: { index: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === index ? 28 : 10,
            height: 10,
            borderRadius: 5,
            background: i === index ? C.primary : C.faint,
          }}
        />
      ))}
    </div>
  );
}

function Frame({ children, index, total }: { children: React.ReactNode; index: number; total: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.background,
        color: C.foreground,
        padding: "72px 80px",
      }}
    >
      {/* Brand row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 36,
          borderBottom: `2px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 16, height: 16, background: C.primary }} />
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>{wordmark()}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: C.muted }}>
          {index + 1}/{total}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>
        {children}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 36,
          borderTop: `2px solid ${C.border}`,
        }}
      >
        <Dots index={index} total={total} />
        <div style={{ display: "flex", fontSize: 26, color: C.muted, letterSpacing: 1 }}>
          {siteHost()}
        </div>
      </div>
    </div>
  );
}

function CoverSlide({ slide }: { slide: SlideSpec }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {slide.kicker && (
        <div style={{ display: "flex", fontSize: 30, color: C.primary, fontWeight: 700, letterSpacing: 4 }}>
          {slide.kicker.toUpperCase()}
        </div>
      )}
      <div style={{ display: "flex", fontSize: 88, fontWeight: 700, lineHeight: 1.12, letterSpacing: -2 }}>
        {slide.title}
      </div>
      {slide.body && (
        <div style={{ display: "flex", fontSize: 38, color: C.muted, lineHeight: 1.45 }}>{slide.body}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
        <div style={{ fontSize: 30, color: C.muted }}>swipe</div>
        <div style={{ fontSize: 34, color: C.primary }}>→</div>
      </div>
    </div>
  );
}

function ContentSlide({ slide, index }: { slide: SlideSpec; index: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: C.primary }}>
          {String(index).padStart(2, "0")}
        </div>
        {slide.kicker && (
          <div style={{ display: "flex", fontSize: 28, color: C.muted, letterSpacing: 3 }}>
            {slide.kicker.toUpperCase()}
          </div>
        )}
      </div>
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.18, letterSpacing: -1 }}>
        {slide.title}
      </div>
      {slide.body && (
        <div style={{ display: "flex", fontSize: 40, color: C.muted, lineHeight: 1.5 }}>{slide.body}</div>
      )}
    </div>
  );
}

// The CTA slide always draws the "LINK IN BIO" chip, so a body that only
// repeats that phrase would print it twice — drop it.
function isLinkInBioOnly(text: string): boolean {
  return /^link\s+in\s+bio\s*[.!]?$/i.test(text.trim());
}

function CtaSlide({ slide }: { slide: SlideSpec }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 48 }}>
      <div style={{ width: 96, height: 10, background: C.primary }} />
      <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.15, letterSpacing: -2 }}>
        {slide.title}
      </div>
      {slide.body && !isLinkInBioOnly(slide.body) && (
        <div style={{ display: "flex", fontSize: 40, color: C.muted, lineHeight: 1.5 }}>{slide.body}</div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "22px 40px",
          border: `3px solid ${C.primary}`,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        LINK IN BIO
      </div>
    </div>
  );
}

export async function renderSlideImage(
  slide: SlideSpec,
  index: number,
  total: number,
): Promise<ImageResponse> {
  const kind = slideKind(index, total);
  // No custom fonts: next/og ships a built-in font, so slides render without a
  // bundled font file. Add a `fonts` array here to use a brand typeface.
  return new ImageResponse(
    (
      <Frame index={index} total={total}>
        {kind === "cover" ? (
          <CoverSlide slide={slide} />
        ) : kind === "cta" ? (
          <CtaSlide slide={slide} />
        ) : (
          <ContentSlide slide={slide} index={index} />
        )}
      </Frame>
    ),
    { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
  );
}
