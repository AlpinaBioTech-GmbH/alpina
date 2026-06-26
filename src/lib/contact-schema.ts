// src/lib/contact-schema.ts
// Single source of truth for contact validation - used by the client form
// (react-hook-form) AND re-validated server-side in the Server Action.
import { z } from "zod";

// Interest options for AlpinaBioTech enquiries.
export const INTERESTS = [
  "Quote request",
  "Product enquiry",
  "Technical support",
  "Distribution / partnership",
  "General enquiry",
  "Other",
] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address.").max(200),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  interest: z.enum(INTERESTS, { message: "Pick what you're interested in." }),
  message: z
    .string()
    .trim()
    .min(10, "A sentence or two helps us route this.")
    .max(4000),
  // Anti-spam honeypot - must stay empty. Real users never fill it.
  website: z.string().max(0).optional().or(z.literal("")),
  source_page: z.string().max(300).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

export type ContactResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
