// Admin sidebar navigation. Items are grouped by section and registered in the
// admin layout. Items whose integration env is missing render with a muted
// "setup" hint but stay clickable (the page guides configuration).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type AdminNavItem = {
  href: string;
  label: string;
  /** When false, show a "setup" hint (integration env not configured). */
  configured?: boolean;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export function AdminNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-5">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-none px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <span>{item.label}</span>
                {item.configured === false ? (
                  <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground/60">
                    setup
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
