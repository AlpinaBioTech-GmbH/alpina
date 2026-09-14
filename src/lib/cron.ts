/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
 * CRON_SECRET is set in the project env. The same bearer token allows manual
 * curl triggering. No secret configured ⇒ nothing is authorized.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Berlin-local Tuesday check. Vercel cron expressions are advisory on this
 * team (invocations observed near-daily at drifting times), so every weekly
 * route enforces its own cadence with this guard.
 */
export function isBerlinTuesday(now: Date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    weekday: "short",
  }).format(now);
  return weekday === "Tue";
}
