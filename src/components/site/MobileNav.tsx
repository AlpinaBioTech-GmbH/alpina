// src/components/site/MobileNav.tsx
// Mobile nav drawer (nav collapses to a Sheet at small sizes). Client
// component - the header passes already-resolved links so this stays a thin
// interactive shell.
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { brand } from "@/lib/config";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavChild = { name: string; href: string };
type NavLink = {
  label: string;
  href: string;
  external: boolean;
  children?: NavChild[];
};

export default function MobileNav({
  links,
  cta,
  secondary,
}: {
  links: NavLink[];
  cta: { label: string; href: string };
  secondary?: { label: string; href: string; external: boolean } | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="inline-flex items-center justify-center p-2"
        style={{ color: "var(--on-contrast)" }}
      >
        <Menu size={24} />
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ background: "var(--void)", borderColor: "var(--steel)", color: "var(--on-contrast)" }}
        className="w-72"
      >
        {/* Custom close: dark X on a light chip, visible on the sheet in both themes */}
        <SheetClose
          aria-label="Close menu"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center"
          style={{ background: "var(--paper)", color: "var(--ink)" }}
        >
          <X size={18} />
        </SheetClose>
        <SheetHeader>
          <SheetTitle
            style={{ fontFamily: "var(--font-heading)", color: "var(--on-contrast)" }}
          >
            {brand.name}
          </SheetTitle>
        </SheetHeader>

        <nav className="mt-4 flex flex-col gap-1 px-4">
          {links.map((l) =>
            l.children && l.children.length > 0 ? (
              // Trigger item (e.g. a menu group): the parent has no page of its
              // own, so it shows as a label with its child links listed beneath.
              <div key={l.label} className="border-b py-3">
                <p
                  style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
                  className="text-sm uppercase tracking-[0.12em]"
                >
                  {l.label}
                </p>
                <div className="mt-2 flex flex-col gap-1 pl-3">
                  {l.children.map((c) => (
                    <Link
                      key={c.href + c.name}
                      href={c.href}
                      onClick={() => setOpen(false)}
                      style={{ fontFamily: "var(--font-mono)", color: "var(--on-contrast)" }}
                      className="py-2 text-sm tracking-[0.04em]"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={l.href + l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{ fontFamily: "var(--font-mono)", color: "var(--on-contrast)" }}
                className="border-b py-3 text-sm uppercase tracking-[0.12em]"
              >
                {l.label}
              </Link>
            ),
          )}

          {secondary && (
            <a
              href={secondary.href}
              {...(secondary.external ? { target: "_blank", rel: "noopener" } : {})}
              style={{ fontFamily: "var(--font-mono)", color: "var(--mist)" }}
              className="py-3 text-sm uppercase tracking-[0.12em]"
            >
              {secondary.label}
              {secondary.external ? " ↗" : ""}
            </a>
          )}

          <Link
            href={cta.href}
            onClick={() => setOpen(false)}
            style={{ background: "var(--signal)", color: "var(--on-signal)", fontFamily: "var(--font-mono)" }}
            className="mt-4 inline-flex items-center justify-center px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em]"
          >
            {cta.label}
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
