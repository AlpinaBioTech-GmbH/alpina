"use server";
// src/app/actions/newsletter.ts
// Newsletter signup Server Action: re-validate with Zod, honeypot, insert into
// newsletter_subscribers via the service role, and handle the unique-constraint
// duplicate gracefully. Degrades (logs + succeeds) when Supabase isn't configured.
import { newsletterSchema, type NewsletterResult } from "@/lib/newsletter-schema";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { createResendContact, newsletterSegmentId } from "@/lib/newsletter/resend";

// Mirror the subscriber into the Resend segment (non-fatal: the helpers never
// throw, and the Supabase row is the source of truth either way).
async function mirrorToResend(email: string): Promise<void> {
  const contactId = await createResendContact({
    email,
    unsubscribed: false,
    segmentIds: [newsletterSegmentId()],
  });
  if (!contactId) return;
  const supabase = getSupabaseAdmin();
  await supabase
    ?.from("newsletter_subscribers")
    .update({ resend_contact_id: contactId, updated_at: new Date().toISOString() })
    .eq("email", email);
}

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

  const normalized = email.toLowerCase();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: normalized });

  if (error) {
    // 23505 = unique_violation -> already subscribed. Re-mirroring resubscribes
    // someone who signed up again after unsubscribing.
    if (error.code === "23505") {
      await supabase
        .from("newsletter_subscribers")
        .update({ status: "subscribed", unsubscribed_at: null, updated_at: new Date().toISOString() })
        .eq("email", normalized);
      await mirrorToResend(normalized);
      return { ok: true, already: true };
    }
    console.error("newsletter insert failed:", error.message);
    return { ok: false, error: "Couldn't sign you up. Try again in a moment." };
  }

  await mirrorToResend(normalized);
  return { ok: true };
}
