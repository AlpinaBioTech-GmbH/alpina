// src/components/storyblok/Page.tsx
import {
  storyblokEditable,
  StoryblokServerComponent,
  type SbBlokData,
} from "@storyblok/react/rsc";

type Blok = { _uid: string; component: string; [k: string]: unknown };
type PageBlok = Blok & { body?: Blok[] };

export default function Page({ blok }: { blok: PageBlok }) {
  return (
    <main {...storyblokEditable(blok as unknown as SbBlokData)}>
      {blok.body?.map((nested) => (
        <StoryblokServerComponent blok={nested} key={nested._uid} />
      ))}
    </main>
  );
}
