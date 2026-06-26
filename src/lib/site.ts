// Absolute site origin used for catalog URLs and link-host validation.
// Sourced from the brand config (which reads NEXT_PUBLIC_SITE_URL), with any
// trailing slash stripped so URL joins stay clean.
import { brand } from "@/lib/config";

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? brand.siteUrl;
  return raw.replace(/\/+$/, "");
}
