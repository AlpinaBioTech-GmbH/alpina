"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getLinkedinOrgOptions, setLinkedinOrg } from "@/app/admin/(dashboard)/social/actions";
import type { LinkedinOrgOption } from "@/lib/admin/types";

/**
 * Page selector shown on the LinkedIn admin card. It lists every company page
 * the connected member administers and switches which one posts. Renders only
 * when the member administers more than one page, so single-page setups see
 * nothing extra.
 */
export function LinkedinOrgSelector({ current }: { current: string }) {
  const [orgs, setOrgs] = useState<LinkedinOrgOption[] | null>(null);
  const [selected, setSelected] = useState(current);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getLinkedinOrgOptions().then((res) => {
      if (!active) return;
      if (res.ok && res.orgs) {
        setOrgs(res.orgs);
        if (res.current) setSelected(res.current);
      } else {
        setLoadError(res.message ?? "Could not load organizations.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <p className="text-muted-foreground text-xs">Organization list unavailable: {loadError}</p>
    );
  }
  if (!orgs) {
    return <p className="text-muted-foreground text-xs">Loading organizations…</p>;
  }
  // Nothing to choose when the member administers a single page.
  if (orgs.length <= 1) return null;

  function onChange(urn: string) {
    const prev = selected;
    setSelected(urn); // optimistic
    startTransition(async () => {
      const result = await setLinkedinOrg(urn);
      if (result.ok) {
        toast.success(result.message);
      } else {
        setSelected(prev); // revert
        toast.error(result.message);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="li-org" className="text-sm font-medium">
        Posting as page
      </label>
      <select
        id="li-org"
        value={selected}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 w-full max-w-sm rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
        )}
      >
        {orgs.map((o) => (
          <option key={o.urn} value={o.urn}>
            {o.name} ({o.id})
          </option>
        ))}
      </select>
      <p className="text-muted-foreground text-xs">
        You administer multiple LinkedIn pages. Posts publish to the selected one.
      </p>
    </div>
  );
}
