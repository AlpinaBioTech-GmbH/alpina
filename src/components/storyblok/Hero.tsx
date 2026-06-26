// src/components/storyblok/Hero.tsx
// The `hero` blok: maps Storyblok fields onto the shared <HeroSection/>.
import { storyblokEditable } from "@storyblok/react/rsc";
import HeroSection from "@/components/site/HeroSection";
import { type SbLink } from "@/lib/links";

type Asset = { filename?: string | null; alt?: string | null };
type HeroBlok = {
  _uid: string;
  component: string;
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  cta_label?: string;
  cta_href?: SbLink;
  layout?: string;
  media_ratio?: string;
  autoplay?: boolean;
  video_url?: string;
  video_poster?: string;
  hero_video?: Asset;
  hero_image?: Asset;
};

export default function Hero({ blok }: { blok: HeroBlok }) {
  return (
    <HeroSection
      editable={storyblokEditable(blok)}
      eyebrow={blok.eyebrow}
      headline={blok.headline}
      subhead={blok.subhead}
      ctaLabel={blok.cta_label}
      ctaHref={blok.cta_href}
      layout={blok.layout}
      mediaRatio={blok.media_ratio}
      autoplay={blok.autoplay}
      videoUrl={blok.video_url}
      videoPoster={blok.video_poster}
      heroVideo={blok.hero_video}
      heroImage={blok.hero_image}
    />
  );
}
