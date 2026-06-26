"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { serviceClient } from "@/lib/supabase/service";
import type { ActionResult } from "@/lib/admin/action-result";
import type { RunAttempt } from "@/lib/runs";
import {
  runDailyPost,
  previewPost,
  publishExisting as publishExistingLinkedin,
  publishComposed as publishComposedLinkedin,
  type LinkedinCandidate,
  type LinkedinResult,
} from "@/lib/linkedin/pipeline";
import {
  runDailyTweet,
  previewTweet,
  publishExisting as publishExistingTweet,
  publishComposed as publishComposedTweet,
  type TweetCandidate,
  type TwitterResult,
} from "@/lib/twitter/pipeline";
import {
  runDailyIgPost,
  previewIgPost,
  publishExisting as publishExistingIg,
  publishComposed as publishComposedIg,
  type InstagramCandidate,
  type InstagramResult,
} from "@/lib/instagram/pipeline";

export type Provider = "linkedin" | "twitter" | "instagram";

const POSTS_TABLES: Record<Provider, string> = {
  linkedin: "linkedin_posts",
  twitter: "twitter_posts",
  instagram: "instagram_posts",
};

function postsTable(provider: Provider) {
  return POSTS_TABLES[provider];
}

const PROVIDER_LABELS: Record<Provider, string> = {
  linkedin: "LinkedIn",
  twitter: "X",
  instagram: "Instagram",
};

function providerLabel(provider: Provider) {
  return PROVIDER_LABELS[provider];
}

function mapResult(result: LinkedinResult | TwitterResult | InstagramResult): ActionResult {
  return {
    ok: result.ok,
    message: result.ok
      ? `Posted: ${result.postUrl ?? "done"}`
      : `${result.status}: ${result.reason ?? "no details"}`,
    url: result.postUrl,
  };
}

function errorResult(err: unknown): ActionResult {
  return { ok: false, message: err instanceof Error ? err.message : String(err) };
}

export async function setAutoEnabled(provider: Provider, enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db
      .from("social_credentials")
      .update({ auto_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("provider", provider);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/admin/${provider}`);
    return {
      ok: true,
      message: `Daily auto-post ${enabled ? "enabled" : "disabled"} for ${providerLabel(provider)}`,
    };
  } catch (err) {
    return errorResult(err);
  }
}

// The personal-profile LinkedIn connection (provider "linkedin_member") is a
// secondary connection surfaced on /admin/linkedin, so it has its own toggle and
// disconnect actions that revalidate the LinkedIn page.
export async function setMemberAutoEnabled(enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db
      .from("social_credentials")
      .update({ auto_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("provider", "linkedin_member");
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/linkedin");
    return { ok: true, message: `Personal cross-posting ${enabled ? "enabled" : "disabled"}` };
  } catch (err) {
    return errorResult(err);
  }
}

export async function disconnectMember(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db
      .from("social_credentials")
      .delete()
      .eq("provider", "linkedin_member");
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/linkedin");
    return { ok: true, message: "LinkedIn profile disconnected" };
  } catch (err) {
    return errorResult(err);
  }
}

// The personal X account (provider "twitter_member") is a secondary connection
// on /admin/twitter that mirrors each company tweet — its own toggle/disconnect.
export async function setTwitterMemberAutoEnabled(enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db
      .from("social_credentials")
      .update({ auto_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("provider", "twitter_member");
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/twitter");
    return { ok: true, message: `Personal cross-posting ${enabled ? "enabled" : "disabled"}` };
  } catch (err) {
    return errorResult(err);
  }
}

export async function disconnectTwitterMember(): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db
      .from("social_credentials")
      .delete()
      .eq("provider", "twitter_member");
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/twitter");
    return { ok: true, message: "X account disconnected" };
  } catch (err) {
    return errorResult(err);
  }
}

export async function disconnectPlatform(provider: Provider): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db.from("social_credentials").delete().eq("provider", provider);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/admin/${provider}`);
    return { ok: true, message: `${providerLabel(provider)} disconnected` };
  } catch (err) {
    return errorResult(err);
  }
}

export async function generateAndPostNow(provider: Provider): Promise<ActionResult> {
  await requireAdmin();
  try {
    const result =
      provider === "linkedin"
        ? await runDailyPost("manual")
        : provider === "twitter"
          ? await runDailyTweet("manual")
          : await runDailyIgPost("manual");
    revalidatePath(`/admin/${provider}`);
    revalidatePath("/admin");
    return mapResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function retryPost(provider: Provider, postId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const result =
      provider === "linkedin"
        ? await publishExistingLinkedin(postId)
        : provider === "twitter"
          ? await publishExistingTweet(postId)
          : await publishExistingIg(postId);
    revalidatePath(`/admin/${provider}`);
    return mapResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function skipPost(provider: Provider, postId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db
      .from(postsTable(provider))
      .update({ status: "skipped", validator_notes: "skipped by admin" })
      .eq("id", postId)
      .in("status", ["queued", "failed"]);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/admin/${provider}`);
    return { ok: true, message: "Post skipped" };
  } catch (err) {
    return errorResult(err);
  }
}

export async function deletePost(provider: Provider, postId: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const db = serviceClient();
    if (!db) return { ok: false, message: "Supabase not configured" };
    const { error } = await db.from(postsTable(provider)).delete().eq("id", postId);
    if (error) return { ok: false, message: error.message };
    revalidatePath(`/admin/${provider}`);
    return { ok: true, message: "Post deleted" };
  } catch (err) {
    return errorResult(err);
  }
}

export interface PreviewResult {
  candidate: LinkedinCandidate | TweetCandidate | InstagramCandidate | null;
  approved: boolean;
  attempts: RunAttempt[];
}

export async function previewCandidate(provider: Provider): Promise<PreviewResult> {
  await requireAdmin();
  if (provider === "linkedin") return previewPost();
  if (provider === "twitter") return previewTweet();
  return previewIgPost();
}

export async function publishPreviewed(
  provider: Provider,
  payloadJson: string
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const result =
      provider === "linkedin"
        ? await publishComposedLinkedin(JSON.parse(payloadJson) as LinkedinCandidate)
        : provider === "twitter"
          ? await publishComposedTweet(JSON.parse(payloadJson) as TweetCandidate)
          : await publishComposedIg(JSON.parse(payloadJson) as InstagramCandidate);
    revalidatePath(`/admin/${provider}`);
    return mapResult(result);
  } catch (err) {
    return errorResult(err);
  }
}
