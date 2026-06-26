// src/components/site/ShareBar.tsx
// Social share row for articles. Builds share intents from the live page URL
// (resolved client-side), plus a copy-link button. Themed to brand tokens.
"use client";

import { useEffect, useState } from "react";
import {
  Send,
  Briefcase,
  Globe,
  Mail,
  Link2,
  Check,
} from "lucide-react";

export default function ShareBar({ title = "" }: { title?: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  const links = [
    { label: "Share on X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, Icon: Send },
    { label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, Icon: Briefcase },
    { label: "Share on Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, Icon: Globe },
    { label: "Share by email", href: `mailto:?subject=${t}&body=${u}`, Icon: Mail },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const itemCls =
    "inline-flex h-10 w-10 items-center justify-center border transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]";

  return (
    <div
      style={{ borderColor: "var(--hair)" }}
      className="mt-12 flex flex-wrap items-center gap-3 border-t pt-6"
    >
      <span
        style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}
        className="mr-1 text-xs uppercase tracking-[0.12em]"
      >
        Share
      </span>
      {links.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          style={{ borderColor: "var(--hair)", color: "var(--ink)" }}
          className={itemCls}
        >
          <Icon size={18} />
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy link"
        style={{ borderColor: "var(--hair)", color: copied ? "var(--signal)" : "var(--ink)" }}
        className={itemCls}
      >
        {copied ? <Check size={18} /> : <Link2 size={18} />}
      </button>
    </div>
  );
}
