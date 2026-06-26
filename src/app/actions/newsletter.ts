"use server";
// src/app/actions/newsletter.ts
// Newsletter signup Server Action: re-validate with Zod, honeypot, insert into
// newsletter_subscribers via the service role, and handle the unique-constraint
// duplicate gracefully. Degrades (logs + succeeds) when Supabase isn't configured.
import { newsletterSchema, type NewsletterResult } from "@/lib/newsletter-schema";
import { getSupabaseAdmin } from "@/lib/supabase/service";

export async function subscribeNewsletter(raw: unknown): Promise<NewsletterResult> {
  const parsed = newsletterSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Enter a valid email address." };
  }
  const { email, website } = parsed.data;
  if (website) return { ok: true }; // honeypot - silently succeed

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn("[newsletter] Supabase not configured; signup logged only:", email);
    return { ok: true };
  }

  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: email.toLowerCase() });

  if (error) {
    // 23505 = unique_violation -> already subscribed.
    if (error.code === "23505") return { ok: true, already: true };
    console.error("newsletter insert failed:", error.message);
    return { ok: false, error: "Couldn't sign you up. Try again in a moment." };
  }

  return { ok: true };
}
