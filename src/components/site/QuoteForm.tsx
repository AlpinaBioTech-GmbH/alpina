// Request-a-quote form. Reuses the contact Server Action + contact_submissions
// table; the product name/SKU is prefilled into the message and interest is set
// to "Quote request". Degrades gracefully when Supabase/Resend are unconfigured.
"use client";

import { useState } from "react";
import { submitContact } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function QuoteForm({
  productName,
  sku,
}: {
  productName?: string;
  sku?: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const subjectLine = productName
    ? `I would like a quote for: ${productName}${sku ? ` (${sku})` : ""}.`
    : "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const note = String(fd.get("message") || "").trim();
    const payload = {
      name: String(fd.get("name") || ""),
      company: String(fd.get("company") || ""),
      email: String(fd.get("email") || ""),
      role: "",
      interest: "Quote request",
      message: [subjectLine, note].filter(Boolean).join("\n\n") || subjectLine,
      website: String(fd.get("website") || ""),
      source_page:
        typeof window !== "undefined" ? window.location.pathname : undefined,
    };
    const res = await submitContact(payload);
    if (res.ok) {
      setStatus("ok");
      form.reset();
    } else {
      setStatus("error");
      setError(res.error);
    }
  }

  if (status === "ok") {
    return (
      <div
        className="rounded-none border p-5 text-sm"
        style={{ borderColor: "var(--hair)", color: "var(--ink)" }}
      >
        Thank you. Your request has been received: we will reply by email shortly.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {/* Honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <div className="grid gap-2">
        <Label htmlFor="q-name">Name</Label>
        <Input id="q-name" name="name" required minLength={2} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="q-company">Organization</Label>
        <Input id="q-company" name="company" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="q-email">Email</Label>
        <Input id="q-email" name="email" type="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="q-message">Message</Label>
        <Textarea
          id="q-message"
          name="message"
          rows={4}
          className="placeholder:text-muted-foreground/55"
          placeholder={
            productName
              ? `Quantity, intended use, or questions about ${productName}.`
              : "How can we help?"
          }
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending..." : "Request a quote"}
      </Button>
    </form>
  );
}
