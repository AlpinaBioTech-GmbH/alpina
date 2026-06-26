// src/components/storyblok/TeamMember.tsx
// One team member card. Photo, name, role, bio (richtext), LinkedIn.
import {
  storyblokEditable,
  renderRichText,
  type SbBlokData,
} from "@storyblok/react/rsc";
import OptimizedImage from "@/components/site/OptimizedImage";
import { Briefcase } from "lucide-react";
import { resolveLink, type SbLink } from "@/lib/links";

type Richtext = Parameters<typeof renderRichText>[0];
type TeamMemberBlok = {
  _uid: string;
  component: string;
  name?: string;
  role?: string;
  bio?: Richtext;
  photo?: { filename?: string | null; alt?: string | null };
  linkedin?: SbLink;
};

export default function TeamMember({ blok }: { blok: TeamMemberBlok }) {
  const bioHtml = blok.bio ? renderRichText(blok.bio) : "";
  const { href } = resolveLink(blok.linkedin);
  const hasPhoto = Boolean(blok.photo?.filename);

  return (
    <article
      {...storyblokEditable(blok as unknown as SbBlokData)}
      style={{ background: "var(--paper-2)", borderColor: "var(--hair)" }}
      className="flex flex-col border p-6"
    >
      <div
        style={{ borderColor: "var(--hair)", background: "var(--paper)" }}
        className="mb-5 flex aspect-square items-center justify-center overflow-hidden border"
      >
        {hasPhoto ? (
          <OptimizedImage
            src={blok.photo!.filename as string}
            alt={blok.photo?.alt || blok.name || ""}
            width={400}
            height={400}
            blur
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
            className="text-[0.7rem] uppercase tracking-[0.12em] opacity-70"
          >
            Photo: [asset todo]
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            style={{ fontFamily: "var(--font-heading)", color: "var(--ink)" }}
            className="text-lg"
          >
            {blok.name}
          </h3>
          {blok.role && (
            <p
              style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
              className="mt-1 text-[0.7rem] uppercase tracking-[0.12em]"
            >
              {blok.role}
            </p>
          )}
        </div>
        {blok.linkedin && href !== "#" && (
          <a
            href={href}
            target="_blank"
            rel="noopener"
            aria-label={`${blok.name} on LinkedIn`}
            style={{ color: "var(--ink-2)" }}
            className="shrink-0 hover:text-[var(--signal)]"
          >
            <Briefcase size={20} />
          </a>
        )}
      </div>

      {bioHtml && (
        <div
          style={{ color: "var(--ink-2)" }}
          className="mt-3 space-y-2 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: bioHtml }}
        />
      )}
    </article>
  );
}
