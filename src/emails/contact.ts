// src/emails/contact.ts
// On-brand transactional email HTML for the contact flow. Inline styles only
// (email clients ignore <style>/CSS vars). Neutral palette + brand wordmark.
import type { ContactInput } from "@/lib/contact-schema";
import { brand } from "@/lib/config";

const VOID = "#1c1917";
const PAPER = "#ede9e2";
const INK = "#1a1613";
const INK2 = "#5c534b";
const SIGNAL = "#1c1917";
const HAIR = "#cfc8bd";
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const SANS = "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

function esc(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function shell(title: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:${PAPER};font-family:${SANS};color:${INK}">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${SIGNAL}">${esc(brand.name)}</div>
    <h1 style="font-size:22px;margin:12px 0 20px;color:${INK}">${esc(title)}</h1>
    ${inner}
    <p style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${INK2};margin-top:32px;border-top:1px solid ${HAIR};padding-top:16px">${esc(brand.name)}</p>
  </div></body></html>`;
}

function row(label: string, value?: string) {
  if (!value) return "";
  return `<tr>
    <td style="font-family:${MONO};font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${INK2};padding:6px 16px 6px 0;vertical-align:top;white-space:nowrap">${esc(label)}</td>
    <td style="font-size:14px;color:${INK};padding:6px 0;vertical-align:top">${esc(value)}</td>
  </tr>`;
}

// Internal notification to the team inbox.
export function notifyEmail(data: ContactInput) {
  const table = `<table style="width:100%;border-collapse:collapse">
    ${row("Name", data.name)}
    ${row("Company", data.company)}
    ${row("Email", data.email)}
    ${row("Role", data.role)}
    ${row("Interest", data.interest)}
    ${row("From page", data.source_page)}
  </table>
  <div style="margin-top:20px;padding:16px;background:${VOID};color:${PAPER};font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(data.message)}</div>`;
  return {
    subject: `New enquiry: ${data.name}${data.company ? ` (${data.company})` : ""}`,
    html: shell("New enquiry", table),
  };
}

// Auto-acknowledgement to the submitter (interface voice, no apology-mood).
export function ackEmail(data: ContactInput) {
  const inner = `<p style="font-size:15px;line-height:1.6;color:${INK}">Got it, ${esc(data.name.split(" ")[0])}. Your message reached the ${esc(brand.name)} team, and we will be in touch shortly.</p>
  <p style="font-size:14px;line-height:1.6;color:${INK2}">For reference, here's what you sent:</p>
  <div style="margin-top:8px;padding:16px;background:#e0dbd2;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap">${esc(data.message)}</div>`;
  return {
    subject: `We've got your message - ${brand.name}`,
    html: shell("Message received", inner),
  };
}
