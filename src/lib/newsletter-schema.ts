// src/lib/newsletter-schema.ts
// Shared validation for the footer newsletter signup - client + server.
import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
  // Anti-spam honeypot - must stay empty.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;

export type NewsletterResult =
  | { ok: true; already?: boolean }
  | { ok: false; error: string };
