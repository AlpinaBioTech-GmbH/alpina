// Token-expiry reminders: emails the operator (via Resend) when a platform's
// credentials are close to expiry or need reconnecting. Runs from the social
// cron regardless of the auto-post toggles.
import { serviceClient } from "@/lib/supabase/service";
import { sendOperatorEmail } from "@/lib/social/notify";
import { brand } from "@/lib/config";

export async function checkTokenReminders(): Promise<string[]> {
  const reminders: string[] = [];
  const db = serviceClient();
  if (!db) return reminders;

  const windowDays = Number(process.env.LINKEDIN_REMINDER_DAYS ?? 10);
  const { data: rows } = await db.from("social_credentials").select("*");
  for (const row of rows ?? []) {
    if (!row.expires_at) continue;
    const daysLeft = (new Date(row.expires_at).getTime() - Date.now()) / 86_400_000;
    // X access tokens rotate constantly; only the refresh-token health matters
    // there, surfaced as "reconnect required" by the pipeline. LinkedIn
    // (~60-day) and Instagram (60-day, normally auto-refreshed — a near-expiry
    // here means refreshing has been failing) are worth a reminder.
    if (row.provider !== "linkedin" && row.provider !== "instagram") continue;
    if (daysLeft <= windowDays) {
      const name = row.provider === "linkedin" ? "LinkedIn" : "Instagram";
      const label =
        daysLeft <= 0
          ? `expired ${Math.abs(Math.round(daysLeft))} day(s) ago`
          : `expires in ${Math.round(daysLeft)} day(s)`;
      reminders.push(`${row.provider}: token ${label}`);
      await sendOperatorEmail(
        `${brand.name} social: ${name} token ${label}`,
        `The ${name} connection (${row.display_name ?? row.author_urn}) ${label}.\n\nReconnect in the admin area: ${process.env.NEXT_PUBLIC_SITE_URL ?? brand.siteUrl}/admin/${row.provider}\n`,
      );
    }
  }
  return reminders;
}
