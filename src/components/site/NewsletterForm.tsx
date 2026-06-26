// src/components/site/NewsletterForm.tsx
// Footer newsletter signup. Posts to the subscribeNewsletter Server Action;
// inline status in the interface's own voice + a toast.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { subscribeNewsletter } from "@/app/actions/newsletter";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await subscribeNewsletter({ email, website });
    setPending(false);
    if (res.ok) {
      setDone(res.already ? "You're already on the list." : "You're in. Watch your inbox.");
      setEmail("");
      toast.success(res.already ? "Already subscribed." : "Subscribed.");
    } else {
      toast.error(res.error);
    }
  }

  if (done) {
    return (
      <p
        style={{ fontFamily: "var(--font-mono)", color: "var(--signal)" }}
        className="text-xs uppercase tracking-[0.12em]"
      >
        {done}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm items-stretch gap-2" noValidate>
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        style={{ background: "transparent", borderColor: "var(--steel)", color: "var(--on-contrast)" }}
        className="min-w-0 flex-1 border px-3 py-2 text-sm outline-none placeholder:text-[var(--mist)] focus:border-[var(--signal)]"
      />
      <button
        type="submit"
        disabled={pending}
        aria-label="Subscribe"
        style={{ background: "var(--signal)", color: "var(--on-signal)" }}
        className="inline-flex shrink-0 items-center justify-center px-4 disabled:opacity-60"
      >
        {pending ? "..." : <ArrowRight size={16} />}
      </button>
    </form>
  );
}
