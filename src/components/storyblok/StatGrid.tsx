// src/components/storyblok/StatGrid.tsx
// Stats band: a row of stats on the machined light base.
import { storyblokEditable, StoryblokServerComponent } from "@storyblok/react/rsc";

type Blok = { _uid: string; component: string };
type StatGridBlok = {
  _uid: string;
  component: string;
  heading?: string;
  stats?: Blok[];
};

export default function StatGrid({ blok }: { blok: StatGridBlok }) {
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
            className="mb-12 max-w-4xl text-3xl leading-tight md:text-4xl"
          >
            {blok.heading}
          </h2>
        )}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {blok.stats?.map((s) => (
            <StoryblokServerComponent blok={s} key={s._uid} />
          ))}
        </div>
      </div>
    </section>
  );
}
