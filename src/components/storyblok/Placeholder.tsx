// src/components/storyblok/Placeholder.tsx
// Fallback for bloks not yet implemented. Shows the component name and renders
// any nested bloks fields, so the page always renders while you build the rest.
import {
  storyblokEditable,
  StoryblokServerComponent,
  type SbBlokData,
} from "@storyblok/react/rsc";

type Blok = { _uid: string; component: string; [k: string]: unknown };

const isBlokArray = (v: unknown): v is Blok[] =>
  Array.isArray(v) && v.every((i) => i && typeof i === "object" && "component" in i);

export default function Placeholder({ blok }: { blok: Blok }) {
  const nestedFields = Object.entries(blok).filter(([, v]) => isBlokArray(v));

  return (
    <section
      {...storyblokEditable(blok as unknown as SbBlokData)}
      style={{ borderColor: "var(--hair)", color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}
      className="mx-auto my-2 max-w-6xl border border-dashed px-6 py-6"
    >
      <p className="text-xs uppercase tracking-[0.12em]">blok: {blok.component}</p>
      {nestedFields.map(([key, arr]) => (
        <div key={key} className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.12em] opacity-60">{key}</p>
          {(arr as Blok[]).map((nested) => (
            <StoryblokServerComponent blok={nested} key={nested._uid} />
          ))}
        </div>
      ))}
    </section>
  );
}
