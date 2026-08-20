// Server-only Resend client + contact helpers for the newsletter. Contact
// calls never throw: subscriber writes to Supabase must succeed even when
// Resend is down or unconfigured (the backfill script reconciles).
import { Resend } from "resend";

let cached: Resend | null = null;

export function getResendClient(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export function newsletterSegmentId(): string | null {
  return process.env.NEWSLETTER_RESEND_SEGMENT_ID?.trim() || null;
}

export type ContactInput = {
  email: string;
  unsubscribed: boolean;
  // Resend segments (formerly "audiences") the contact belongs to. Falsy
  // entries are skipped so callers can pass optional segment ids directly.
  segmentIds?: Array<string | null | undefined>;
};

// Create (or recover the id of) a Resend contact. Returns the contact id,
// or null when Resend is unconfigured / the call failed.
export async function createResendContact(input: ContactInput): Promise<string | null> {
  const resend = getResendClient();
  if (!resend) return null;

  const segmentIds = (input.segmentIds ?? []).filter((id): id is string => Boolean(id));

  try {
    const { data, error } = await resend.contacts.create({
      email: input.email,
      unsubscribed: input.unsubscribed,
      ...(segmentIds.length ? { segments: segmentIds.map((id) => ({ id })) } : {}),
    });
    if (data?.id) return data.id;

    // Most likely "contact already exists": recover its id so the row links up.
    if (error) {
      const existing = await resend.contacts.get(input.email);
      if (existing.data?.id) return existing.data.id;
      console.warn("[newsletter] Resend contact create failed:", error.message);
    }
    return null;
  } catch (err) {
    console.warn("[newsletter] Resend contact create threw:", err);
    return null;
  }
}

// Update an existing Resend contact's unsubscribed flag. Returns true on
// success; never throws.
export async function updateResendContact(opts: {
  contactId: string;
  unsubscribed: boolean;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;
  try {
    const { error } = await resend.contacts.update({
      id: opts.contactId,
      unsubscribed: opts.unsubscribed,
    });
    if (error) console.warn("[newsletter] Resend contact update failed:", error.message);
    return !error;
  } catch (err) {
    console.warn("[newsletter] Resend contact update threw:", err);
    return false;
  }
}

// Create a Resend segment (setup script + test segment). Returns the segment
// id, or null when Resend is unconfigured / the call failed; never throws.
export async function createResendSegment(name: string): Promise<string | null> {
  const resend = getResendClient();
  if (!resend) return null;
  try {
    const { data, error } = await resend.segments.create({ name });
    if (error) console.warn("[newsletter] Resend segment create failed:", error.message);
    return data?.id ?? null;
  } catch (err) {
    console.warn("[newsletter] Resend segment create threw:", err);
    return null;
  }
}

// Add or remove a contact from a Resend segment. Returns true on success;
// never throws. A remove of a non-member counts as success so reconciliation
// loops cannot get stuck retrying an already-converged state.
export async function setResendSegmentMembership(opts: {
  contactId: string;
  segmentId: string;
  member: boolean;
}): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;
  try {
    const { error } = opts.member
      ? await resend.contacts.segments.add({ contactId: opts.contactId, segmentId: opts.segmentId })
      : await resend.contacts.segments.remove({ contactId: opts.contactId, segmentId: opts.segmentId });
    if (error) {
      if (!opts.member && /not[ _]found|not a member/i.test(error.message)) return true;
      console.warn("[newsletter] Resend segment membership failed:", error.message);
    }
    return !error;
  } catch (err) {
    console.warn("[newsletter] Resend segment membership threw:", err);
    return false;
  }
}
