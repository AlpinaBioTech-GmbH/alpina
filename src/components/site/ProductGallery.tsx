// Product image gallery: a left/right slider with thumbnails. Renders the
// product's Storyblok images (main + related). Diagrams/figures use object
// "contain" so nothing is cropped.
"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type GalleryImage = { filename?: string | null; alt?: string | null };

export default function ProductGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title?: string;
}) {
  const pics = images.filter((i) => i?.filename);
  const [i, setI] = useState(0);
  if (pics.length === 0) return null;

  const idx = Math.min(i, pics.length - 1);
  const current = pics[idx];
  const go = (delta: number) =>
    setI((n) => (n + delta + pics.length) % pics.length);

  return (
    <div>
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border"
        style={{ background: "var(--paper-2)", borderColor: "var(--hair)" }}
      >
        <Image
          key={current.filename}
          src={current.filename!}
          alt={current.alt || title || "Product image"}
          fill
          sizes="(min-width: 768px) 40rem, 100vw"
          className="object-contain p-4"
        />

        {pics.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center border transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
              style={{ background: "var(--paper)", borderColor: "var(--hair)", color: "var(--ink)" }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center border transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]"
              style={{ background: "var(--paper)", borderColor: "var(--hair)", color: "var(--ink)" }}
            >
              <ChevronRight size={18} />
            </button>
            <span
              className="absolute bottom-3 right-3 px-2 py-0.5 text-[0.65rem] font-semibold"
              style={{ background: "var(--signal)", color: "var(--on-signal)", fontFamily: "var(--font-mono)" }}
            >
              {idx + 1} / {pics.length}
            </span>
          </>
        )}
      </div>

      {pics.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {pics.map((p, n) => (
            <button
              key={p.filename}
              type="button"
              aria-label={`View image ${n + 1}`}
              onClick={() => setI(n)}
              className="relative size-16 overflow-hidden border transition-colors"
              style={{
                background: "var(--paper-2)",
                borderColor: n === idx ? "var(--signal)" : "var(--hair)",
              }}
            >
              <Image
                src={p.filename!}
                alt=""
                fill
                sizes="4rem"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
