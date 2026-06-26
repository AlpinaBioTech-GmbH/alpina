// Operator notifications via Resend. Holds the shared email sender (used by the
// token-expiry reminders) plus alertOnFailures(), which pages the operator when
// a social posting run genuinely fails — so failures stop landing silently in
// the per-platform tables. Degrades to a no-op when RESEND_API_KEY is unset.
import { siteUrl } from "@/lib/site";
import { brand } from "@/lib/config";

function fromAddress(): string {
  return process.env.SOCIAL_FROM_EMAIL ?? brand.contact.from;
}

export function operatorEmail(): string {
  return process.env.SOCIAL_OPERATOR_EMAIL ?? brand.contact.notifyTo;
}

export async function sendOperatorEmail(subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(), to: [operatorEmail()], subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type SocialProvider = "linkedin" | "twitter" | "instagram";

export interface PlatformOutcome {
  ok: boolean;
  status: string;
  reason?: string;
}

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  linkedin: "LinkedIn",
  twitter: "X",
  instagram: "Instagram",
};

// Reasons worth paging about: a credential/secret problem that won't self-heal.
// Benign skips (auto-post off, empty catalog, already-ran, never-connected, a
// transient blip) never match, so they don't alert.
const ALERT_SUBSTRINGS = [
  "reconnect required",
  "needs reconnect",
  "persist failed",
  "token expired",
  "signing secret",
  "http 401",
];

export function isAlertworthy(outcome: PlatformOutcome): boolean {
  if (outcome.status === "failed") return true;
  if (outcome.status !== "skipped") return false;
  const reason = (outcome.reason ?? "").toLowerCase();
  return ALERT_SUBSTRINGS.some((s) => reason.includes(s));
}

/**
 * Sends ONE consolidated operator email if any platform in `results` failed in
 * an actionable way. Best-effort: never throws (sendOperatorEmail swallows its
 * own errors), so it can be awaited inside a posting flow without risk.
 */
export async function alertOnFailures(
  source: "cron" | "announce",
  results: Partial<Record<SocialProvider, PlatformOutcome>>,
): Promise<void> {
  const failing: { provider: SocialProvider; outcome: PlatformOutcome }[] = [];
  for (const provider of ["linkedin", "twitter", "instagram"] as SocialProvider[]) {
    const outcome = results[provider];
    if (outcome && isAlertworthy(outcome)) failing.push({ provider, outcome });
  }
  if (failing.length === 0) return;

  const lines = failing.map(
    ({ provider, outcome }) =>
      `- ${PROVIDER_LABELS[provider]}: ${outcome.status}` +
      `${outcome.reason ? ` - ${outcome.reason}` : ""}\n  ${siteUrl()}/admin/${provider}`,
  );
  await sendOperatorEmail(
    `${brand.name} social: ${failing.length} platform(s) failed`,
    `A social posting run (${source}) had ${failing.length} platform failure(s):\n\n` +
      `${lines.join("\n")}\n\nRetry from the admin dashboard once the cause is resolved.\n`,
  );
}
