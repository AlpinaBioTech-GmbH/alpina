// src/components/site/HeroSection.tsx
// Shared hero presentation used by the `hero` blok (and any page top), so every
// page's hero looks and behaves the same.
// Two layouts (the `layout` field):
//   "full"  - video/image fills the section as a full-screen background, copy
//             overlaid on a dark scrim (forced-light text). Default.
//   "split" - two columns: copy left, media framed right (ratio-controlled).
// Media priority is always video -> image -> flat --void band.
import Link from "next/link";
import OptimizedImage from "@/components/site/OptimizedImage";
import HeroBackgroundVideo from "@/components/site/HeroBackgroundVideo";
import ArticleVideo from "@/components/site/ArticleVideo";
import { resolveLink, type SbLink } from "@/lib/links";

type Asset = { filename?: string | null; alt?: string | null };

export type HeroSectionProps = {
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  ctaHref?: SbLink;
  layout?: string;
  mediaRatio?: string;
  autoplay?: boolean;
  videoUrl?: string;
  videoPoster?: string;
  heroVideo?: Asset;
  heroImage?: Asset;
  /** storyblokEditable() attributes, spread onto the section when used as a blok. */
  editable?: Record<string, unknown>;
};

export default function HeroSection({
  eyebrow,
  headline,
  subhead,
  ctaLabel,
  ctaHref,
  layout,
  mediaRatio,
  autoplay,
  videoUrl,
  videoPoster,
  heroVideo,
  heroImage,
  editable,
}: HeroSectionProps) {
  // Video wins over image. Video can be a text URL (e.g. Mux) or an uploaded asset.
  const videoSrc = videoUrl || heroVideo?.filename || "";
  const imageSrc = !videoSrc ? heroImage?.filename || "" : "";
  const hasMedia = Boolean(videoSrc || imageSrc);
  const split = layout === "split" && hasMedia;
  // Copy sits over the media only in full-screen mode -> force light text there.
  const overMedia = hasMedia && !split;
  const textColor = overMedia ? "#eceef1" : "var(--on-contrast)";
  const subColor = overMedia ? "rgba(236,238,241,0.82)" : "var(--mist)";
  // Framed media ratio: always 4:3 on small screens; wide screens follow the
  // `media_ratio` selector - portrait (3:4), landscape (4:3), else square (1:1).
  const ratioClass =
    mediaRatio === "portrait"
      ? "aspect-[4/3] md:aspect-[3/4]"
      : mediaRatio === "landscape"
        ? "aspect-[4/3] md:aspect-[4/3]"
        : "aspect-[4/3] md:aspect-square";
  const cta = resolveLink(ctaHref);

  return (
    <section
      {...(editable || {})}
      style={{ background: "var(--void)", color: textColor }}
      className={
        split
          ? "relative isolate overflow-hidden px-6 py-24 md:py-32"
          : "relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden px-6 py-20"
      }
    >
      {/* Full-screen background media (full layout only) */}
      {!split && videoSrc && (
        <HeroBackgroundVideo src={videoSrc} poster={videoPoster} />
      )}
      {!split && imageSrc && (
        <OptimizedImage
          src={imageSrc}
          alt=""
          aria-hidden
          fill
          priority
          blur
          sizes="100vw"
          className="-z-20 object-cover"
        />
      )}
      {overMedia && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(90deg, rgba(8,10,12,0.85) 0%, rgba(8,10,12,0.55) 45%, rgba(8,10,12,0.2) 100%), linear-gradient(0deg, rgba(8,10,12,0.6) 0%, rgba(8,10,12,0) 55%)",
          }}
        />
      )}

      <div className="mx-auto w-full max-w-6xl">
        <div className={split ? "grid items-center gap-10 md:grid-cols-2 md:gap-16" : ""}>
          {/* Text column */}
          <div className={split ? "" : "max-w-4xl"}>
            {eyebrow && (
              <p
                style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
                className="mb-6 text-xs uppercase tracking-[0.12em]"
              >
                {eyebrow}
              </p>
            )}
            {headline && (
              <h1
                style={{ fontFamily: "var(--font-heading)" }}
                className={
                  split
                    ? "text-4xl leading-[1.05] md:text-5xl lg:text-6xl"
                    : "max-w-4xl text-4xl leading-[1.05] md:text-6xl"
                }
              >
                {headline}
              </h1>
            )}
            {subhead && (
              <p
                style={{ color: subColor }}
                className={
                  split
                    ? "mt-6 max-w-xl text-lg leading-relaxed"
                    : "mt-6 max-w-2xl text-lg leading-relaxed"
                }
              >
                {subhead}
              </p>
            )}
            {ctaLabel && (
              <div className="mt-10">
                <Link
                  href={cta.href}
                  {...(cta.external ? { target: "_blank", rel: "noopener" } : {})}
                  style={{ background: "var(--signal)", color: "var(--on-signal)", fontFamily: "var(--font-mono)" }}
                  className="inline-flex items-center px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em]"
                >
                  {ctaLabel}
                </Link>
              </div>
            )}
          </div>

          {/* Media column (split layout only). Video either autoplays as a
              framed muted loop (autoplay) or is click-to-play with controls;
              image is a framed crop. */}
          {split &&
            (videoSrc ? (
              autoplay ? (
                <div className={`relative w-full overflow-hidden md:justify-self-end ${ratioClass}`}>
                  <HeroBackgroundVideo
                    src={videoSrc}
                    poster={videoPoster}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full md:justify-self-end">
                  <ArticleVideo
                    videoSrc={videoSrc}
                    poster={videoPoster}
                    posterAlt={headline || "Play video"}
                    aspectClass={ratioClass}
                  />
                </div>
              )
            ) : (
              <div className={`relative w-full overflow-hidden md:justify-self-end ${ratioClass}`}>
                <OptimizedImage
                  src={imageSrc}
                  alt={heroImage?.alt || headline || ""}
                  fill
                  priority
                  blur
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
