// src/components/storyblok/TeamGrid.tsx
// Team section. Optional crew photo, then the member grid.
import { storyblokEditable, StoryblokServerComponent } from "@storyblok/react/rsc";
import OptimizedImage from "@/components/site/OptimizedImage";

type Blok = { _uid: string; component: string };
type TeamGridBlok = {
  _uid: string;
  component: string;
  heading?: string;
  team_photo?: { filename?: string | null; alt?: string | null };
  members?: Blok[];
};

export default function TeamGrid({ blok }: { blok: TeamGridBlok }) {
  const hasPhoto = Boolean(blok.team_photo?.filename);

  return (
    <section
      {...storyblokEditable(blok)}
      style={{ background: "var(--paper)", color: "var(--ink)" }}
      className="px-6 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl">
        {blok.heading && (
          <h2
            style={{ fontFamily: "var(--font-heading)", color: "var(--ink)" }}
            className="text-3xl leading-tight md:text-4xl"
          >
            {blok.heading}
          </h2>
        )}

        {hasPhoto && (
          <OptimizedImage
            src={blok.team_photo!.filename as string}
            alt={blok.team_photo?.alt || "Team"}
            width={1280}
            height={640}
            blur
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="mt-10 h-auto w-full object-cover"
          />
        )}

        {blok.members && blok.members.length > 0 && (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {blok.members.map((m) => (
              <StoryblokServerComponent blok={m} key={m._uid} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
