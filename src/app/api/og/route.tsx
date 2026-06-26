// src/app/api/og/route.tsx
// Dynamic OpenGraph image generator. Branded card per page, built from the
// story's headline/title via ?slug=. Used by generateMetadata so every route,
// current and future, gets a unique OG image with no manual asset work.
// (A route handler rather than the opengraph-image file convention, which isn't
// allowed inside the [[...slug]] optional catch-all.)
import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { fetchStory } from "@/lib/storyblok";
import { brand } from "@/lib/config";

type Blok = { component: string; headline?: string; eyebrow?: string; heading?: string };

function derive(content: Record<string, unknown> | undefined) {
  let eyebrow: string = brand.name;
  let title: string = brand.tagline;
  if (!content) return { eyebrow, title };
  const body = content.body;
  if (Array.isArray(body)) {
    const bloks = body as Blok[];
    const hero = bloks.find((b) => b.component === "hero");
    if (hero?.headline) {
      title = hero.headline;
      eyebrow = hero.eyebrow || eyebrow;
    } else {
      const headed = bloks.find((b) => b.heading);
      title = headed?.heading || (content.title as string) || title;
    }
  } else {
    title = (content.title as string) || title;
    eyebrow = (content.eyebrow as string) || eyebrow;
  }
  return { eyebrow, title };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || "home";
  // Static routes with no Storyblok story (e.g. /articles) can pass an explicit
  // title/eyebrow instead of a slug, so they still get a per-page card.
  const titleParam = searchParams.get("title");
  const eyebrowParam = searchParams.get("eyebrow");
  const story = titleParam ? null : await fetchStory(slug).catch(() => null);
  let { eyebrow, title } = derive(
    story?.content as Record<string, unknown> | undefined,
  );
  if (eyebrowParam) eyebrow = eyebrowParam;
  if (titleParam) title = titleParam;

  const [figtree400, figtree600, mono] = await Promise.all([
    readFile(new URL("./Figtree-400.woff", import.meta.url)),
    readFile(new URL("./Figtree-600.woff", import.meta.url)),
    readFile(new URL("./IBMPlexMono-600.woff", import.meta.url)),
  ]);

  const titleSize = title.length > 48 ? 58 : title.length > 30 ? 70 : 84;

  // Alpina blue palette (hue 258), converted from the dark-theme oklch tokens:
  // deep-blue base, signal-blue accent, near-white text.
  const BASE = "#061226";
  const ACCENT = "#3d84ea";
  const TEXT = "#edf2fa";
  const MUTED = "#95a6be";
  const HAIR = "#28364a";
  const ON_SIGNAL = "#f8fcff"; // text on the signal-blue CTA

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BASE,
          color: TEXT,
          padding: "72px 80px",
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 6, background: ACCENT }} />
          <div
            style={{
              fontFamily: "IBM Plex Mono",
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            {eyebrow}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Figtree",
            fontSize: titleSize,
            fontWeight: 600,
            lineHeight: 1.05,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${HAIR}`,
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", fontFamily: "Figtree", fontSize: 40, fontWeight: 600 }}>
              {brand.name}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED, letterSpacing: 1 }}>
              {brand.tagline}
            </div>
          </div>
          {/* CTA, the site's primary button: mono, uppercase, sharp corners. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: ACCENT,
              color: ON_SIGNAL,
              fontFamily: "IBM Plex Mono",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              padding: "16px 30px",
            }}
          >
            {brand.nav.primaryCta.label}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Figtree", data: figtree400, weight: 400, style: "normal" },
        { name: "Figtree", data: figtree600, weight: 600, style: "normal" },
        { name: "IBM Plex Mono", data: mono, weight: 600, style: "normal" },
      ],
    },
  );
}
