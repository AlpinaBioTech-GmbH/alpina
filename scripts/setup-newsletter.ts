// One-off newsletter setup against the Resend account:
//   1. creates the subscriber segment           -> NEWSLETTER_RESEND_SEGMENT_ID
//   2. creates the KPI webhook                  -> RESEND_WEBHOOK_SECRET
//   3. creates a test segment containing info@  -> NEWSLETTER_TEST_SEGMENT_ID
// Appends the ids to .env.local (skips vars already present) and prints the
// Vercel follow-ups. Safe to re-run.
//
//   npm run setup-newsletter
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { Resend } from "resend";

const KEY = process.env.RESEND_API_KEY?.trim();
if (!KEY) {
  console.error("Missing RESEND_API_KEY in .env.local.");
  process.exit(1);
}
const resend = new Resend(KEY);
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://alpinabiotech.com").replace(/\/+$/, "");
const NOTIFY = process.env.CONTACT_NOTIFY_TO?.trim();

function upsertEnv(vars: Record<string, string>) {
  const path = ".env.local";
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines: string[] = [];
  for (const [k, v] of Object.entries(vars)) {
    if (new RegExp(`^${k}=`, "m").test(existing)) {
      console.log(`  (skip, already in .env.local) ${k}`);
      continue;
    }
    lines.push(`${k}=${v}`);
  }
  if (lines.length) {
    appendFileSync(path, `\n# --- Newsletter (setup-newsletter.ts) ---\n${lines.join("\n")}\n`);
    for (const l of lines) console.log(`  wrote ${l.split("=")[0]}`);
  }
}

async function main() {
  const out: Record<string, string> = {};

  if (!process.env.NEWSLETTER_RESEND_SEGMENT_ID) {
    const seg = await resend.segments.create({ name: "AlpinaBioTech Newsletter" });
    if (seg.error || !seg.data?.id) throw new Error(`segment create: ${seg.error?.message}`);
    out.NEWSLETTER_RESEND_SEGMENT_ID = seg.data.id;
    console.log(`segment created: ${seg.data.id}`);
  } else {
    console.log("segment already configured");
  }

  if (!process.env.RESEND_WEBHOOK_SECRET) {
    const endpoint = `${SITE}/api/webhooks/resend`;
    const wh = await resend.webhooks.create({
      endpoint,
      events: [
        "email.delivered", "email.delivery_delayed", "email.opened", "email.clicked",
        "email.bounced", "email.complained", "email.failed",
        "contact.created", "contact.updated", "contact.deleted",
      ],
    });
    if (wh.error || !wh.data?.signing_secret) {
      console.warn(`webhook create failed (${wh.error?.message ?? "no secret"}).`);
      console.warn(`  Manual fallback: Resend dashboard -> Webhooks -> Add endpoint`);
      console.warn(`  URL: ${endpoint} (all email.* + contact.* events), then put the`);
      console.warn(`  signing secret in .env.local as RESEND_WEBHOOK_SECRET.`);
    } else {
      out.RESEND_WEBHOOK_SECRET = wh.data.signing_secret;
      console.log(`webhook created: ${wh.data.id} -> ${endpoint}`);
    }
  } else {
    console.log("webhook secret already configured");
  }

  if (!process.env.NEWSLETTER_TEST_SEGMENT_ID && NOTIFY) {
    const seg = await resend.segments.create({ name: "Newsletter test (internal)" });
    if (seg.data?.id) {
      out.NEWSLETTER_TEST_SEGMENT_ID = seg.data.id;
      const contact = await resend.contacts.create({
        email: NOTIFY,
        unsubscribed: false,
        segments: [{ id: seg.data.id }],
      });
      if (contact.error) {
        // Contact may already exist: attach it to the test segment by id.
        const existing = await resend.contacts.get(NOTIFY);
        if (existing.data?.id) {
          await resend.contacts.segments.add({ contactId: existing.data.id, segmentId: seg.data.id });
        }
      }
      console.log(`test segment created (${NOTIFY}): ${seg.data.id}`);
    }
  }

  upsertEnv(out);

  console.log(`\nDone. Next:`);
  console.log(`  1. Add to Vercel (production + preview): NEWSLETTER_RESEND_SEGMENT_ID, RESEND_WEBHOOK_SECRET`);
  console.log(`  2. npm run backfill-newsletter   # push existing subscribers into the segment`);
  console.log(`  3. npm run send-newsletter -- --dry   # preview this month's digest`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
