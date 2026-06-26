// Mega-menu dropdown for a nav item that has child cards. The trigger lives in
// the header, but the backdrop + panel are PORTALED to document.body so they
// escape the header's containing block. (The header has backdrop-blur, which
// makes it the containing block for position:fixed descendants - rendering the
// overlay there would mis-size it and blur the bar itself. The portal fixes both
// the sizing and the page-content blur.)
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

export type MenuCard = {
  name: string;
  one_liner?: string;
  image?: string;
  alt?: string;
  href: string;
};

export default function DomainsMenu({
  label,
  cards,
}: {
  label: string;
  cards: MenuCard[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  // Small delay so moving from the trigger down into the portaled panel doesn't
  // close the menu in the gap between them.
  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
      onBlur={closeSoon}
      className="flex h-16 items-center"
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          fontFamily: "var(--font-mono)",
          color: open ? "var(--on-contrast)" : "var(--mist)",
        }}
        className="inline-flex cursor-default items-center gap-1 text-xs uppercase tracking-[0.12em] transition-colors hover:text-[var(--on-contrast)]"
      >
        {label}
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {mounted &&
        createPortal(
          <div className={`fixed inset-0 top-16 z-40 ${open ? "" : "pointer-events-none"}`}>
            {/* Backdrop: blurs the page content below the header. Lives in the
                body (not the header) so backdrop-filter samples the real page.
                Its own opacity transition (same timing as the panel) so the blur
                and the menu fade in together, not sequentially. */}
            <div
              aria-hidden
              onMouseEnter={() => setOpen(false)}
              onClick={() => setOpen(false)}
              className={`absolute inset-0 bg-background/30 backdrop-blur-sm transition-opacity duration-200 ease-out ${
                open ? "opacity-100" : "opacity-0"
              }`}
            />
            {/* Panel: content-width, image cards with overlaid labels. */}
            <div
              onMouseEnter={openNow}
              onMouseLeave={closeSoon}
              className={`absolute left-1/2 top-0 w-full max-w-6xl -translate-x-1/2 px-6 transition-opacity duration-200 ease-out ${
                open ? "opacity-100" : "opacity-0"
              }`}
            >
              <div
                style={{
                  background: "var(--paper)",
                  borderColor: "var(--hair)",
                  // Spread cards equally across the full panel width: N columns
                  // (each 1/N), capped at 4 so larger menus wrap to a second row.
                  gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, minmax(0, 1fr))`,
                }}
                className="grid gap-5 border p-5 shadow-xl"
              >
                {cards.map((c) => (
                  <Link
                    key={c.href + c.name}
                    href={c.href}
                    onClick={() => setOpen(false)}
                    style={{ background: "var(--graphite)", borderColor: "var(--hair)" }}
                    className="relative block aspect-video overflow-hidden border transition-colors hover:border-[var(--signal)]"
                  >
                    {c.image && (
                      <Image
                        src={c.image}
                        alt={c.alt || c.name}
                        width={400}
                        height={225}
                        sizes="(min-width: 768px) 400px, 80vw"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(0deg, rgba(8,10,12,0.85) 0%, rgba(8,10,12,0.12) 55%, rgba(8,10,12,0) 100%)",
                      }}
                    />
                    <span className="absolute inset-x-0 bottom-0 p-3">
                      <span
                        style={{ fontFamily: "var(--font-mono)", color: "#eceef1" }}
                        className="block text-xs uppercase tracking-[0.12em]"
                      >
                        {c.name}
                      </span>
                      {c.one_liner ? (
                        <span
                          style={{ color: "#c3c8cf" }}
                          className="mt-1 block text-[0.7rem] leading-snug normal-case tracking-normal"
                        >
                          {c.one_liner}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
