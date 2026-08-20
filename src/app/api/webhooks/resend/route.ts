// Resend webhook receiver, two jobs:
// 1. Flow unsubscribes (contact.* events) back into newsletter_subscribers so
//    Supabase stays the source of truth.
// 2. Record broadcast email events (delivered/opened/clicked/bounced/...) into
//    newsletter_email_events for /admin/newsletter. The unique constraint
//    dedups, so counts are unique-per-recipient by construction.
// Signature-verified with the Resend SDK (svix scheme) via
// RESEND_WEBHOOK_SECRET; unknown events are acknowledged and ignored.
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { getResendClient } from "@/lib/newsletter/resend";

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    id?: string;
    email?: string;
    unsubscribed?: boolean;
    // email.* events
    broadcast_id?: string;
    to?: string[];
    created_at?: string;
    click?: { link?: string };
  };
};

// resend event type -> newsletter_email_events.event_type
const EMAIL_EVENTS: Record<string, string> = {
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const resend = getResendClient();
  if (!secret || !resend) {
    return new Response("Webhook secret not configured", { status: 503 });
  }

  const payload = await request.text();
  let event: ResendEvent;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    }) as unknown as ResendEvent;
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Database not configured", { status: 503 });

  // Broadcast email events -> KPI pages. The broadcast_id presence check
  // naturally ignores transactional mail (contact form, operator alerts).
  const eventType = EMAIL_EVENTS[event.type];
  if (eventType && event.data?.broadcast_id && event.data.to?.length) {
    const rows = event.data.to.map((recipient) => ({
      broadcast_id: event.data!.broadcast_id!,
      event_type: eventType,
      recipient: recipient.toLowerCase(),
      link_url: eventType === "clicked" ? (event.data?.click?.link ?? "") : "",
      occurred_at: event.data?.created_at ?? event.created_at ?? new Date().toISOString(),
    }));
    await supabase.from("newsletter_email_events").upsert(rows, {
      onConflict: "broadcast_id,event_type,recipient,link_url",
      ignoreDuplicates: true,
    });
    return Response.json({ received: true });
  }

  const email = event.data?.email?.toLowerCase();
  if (email && (event.type === "contact.updated" || event.type === "contact.created")) {
    const unsubscribed = event.data?.unsubscribed === true;
    await supabase
      .from("newsletter_subscribers")
      .update({
        status: unsubscribed ? "unsubscribed" : "subscribed",
        unsubscribed_at: unsubscribed ? new Date().toISOString() : null,
        ...(event.data?.id ? { resend_contact_id: event.data.id } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);
  } else if (email && event.type === "contact.deleted") {
    await supabase
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
        resend_contact_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("email", email);
  }

  return Response.json({ received: true });
}
