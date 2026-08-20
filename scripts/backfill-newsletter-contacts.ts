// Push existing newsletter_subscribers into the Resend segment and store the
// contact ids. Idempotent (skips rows with a contact id; "already exists"
// recovers the id). ~600ms between calls stays under Resend's ~2 req/s limit.
//
//   npm run backfill-newsletter
import "./env";
import { createClient } from "@supabase/supabase-js";
import { createResendContact, newsletterSegmentId } from "@/lib/newsletter/resend";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const segment = newsletterSegmentId();
  if (!url || !key) throw new Error("Missing Supabase env.");
  if (!segment) throw new Error("Missing NEWSLETTER_RESEND_SEGMENT_ID (run setup-newsletter first).");

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: rows, error } = await db
    .from("newsletter_subscribers")
    .select("id, email, status, resend_contact_id")
    .is("resend_contact_id", null)
    .eq("status", "subscribed")
    .order("created_at");
  if (error) throw new Error(error.message);
  if (!rows?.length) {
    console.log("Nothing to backfill.");
    return;
  }

  let ok = 0, failed = 0;
  for (const row of rows) {
    const contactId = await createResendContact({
      email: row.email,
      unsubscribed: false,
      segmentIds: [segment],
    });
    if (contactId) {
      await db.from("newsletter_subscribers").update({ resend_contact_id: contactId }).eq("id", row.id);
      ok++;
      console.log(`  ok: ${row.email}`);
    } else {
      failed++;
      console.log(`  FAILED: ${row.email}`);
    }
    await sleep(600);
  }
  console.log(`\nDone. ${ok} mirrored, ${failed} failed of ${rows.length}. Re-run to retry failures.`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
