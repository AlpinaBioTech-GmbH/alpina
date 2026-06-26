"use server";
// src/app/actions/contact.ts
// Contact Server Action: re-validate with the shared Zod schema (never trust the
// client), light rate-limit + honeypot, insert into Supabase via the service
// role, then fire two Resend emails (notify the team + acknowledge sender).
// Degrades gracefully when Supabase/Resend env isn't configured (dev).
import { headers } from "next/headers";
import { Resend } from "resend";
import { contactSchema, type ContactResult } from "@/lib/contact-schema";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { notifyEmail, ackEmail } from "@/emails/contact";
import { brand } from "@/lib/config";

// Minimal in-memory rate limit (per server instance). Good enough as a first
// line; a durable limiter (e.g. Upstash) is the production upgrade.
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (HITS.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  HITS.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function submitContact(raw: unknown): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some fields need attention.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const data = parsed.data;

  // Honeypot: silently succeed so bots don't learn anything.
  if (data.website) return { ok: true };

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return { ok: false, error: "Too many submissions, give it a minute, then retry." };
  }

  // 1. Persist (Supabase, service role).
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("contact_submissions").insert({
      name: data.name,
      company: data.company || null,
      email: data.email,
      role: data.role || null,
      interest: data.interest,
      message: data.message,
      source_page: data.source_page || null,
      user_agent: hdrs.get("user-agent") || null,
    });
    if (error) {
      console.error("contact insert failed:", error.message);
      return {
        ok: false,
        error: `We couldn't save that. Try again, or email ${brand.contact.email} directly.`,
      };
    }
  } else {
    // Dev fallback - no DB configured yet.
    console.warn("[contact] Supabase not configured; submission logged only:", {
      name: data.name,
      email: data.email,
      interest: data.interest,
    });
  }

  // 2. Notify + acknowledge (Resend). Email failure must not lose the lead.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const from = brand.contact.from;
      const notifyTo = brand.contact.notifyTo;
      const notify = notifyEmail(data);
      const ack = ackEmail(data);
      await Promise.allSettled([
        resend.emails.send({ from, to: notifyTo, subject: notify.subject, html: notify.html, replyTo: data.email }),
        resend.emails.send({ from, to: data.email, subject: ack.subject, html: ack.html }),
      ]);
    } catch (e) {
      console.error("contact email failed:", e);
      // Lead is already saved - don't fail the request over email.
    }
  } else {
    console.warn("[contact] Resend not configured; emails skipped.");
  }

  return { ok: true };
}
