import { serviceClient } from "@/lib/supabase/service";
import { PlatformCard } from "@/components/admin/PlatformCard";
import { LinkedinMemberCard } from "@/components/admin/LinkedinMemberCard";
import { TwitterMemberCard } from "@/components/admin/TwitterMemberCard";
import { PostsTable } from "@/components/admin/PostsTable";
import type { Provider } from "@/app/admin/(dashboard)/social/actions";
import type { Connection, PostRow } from "@/lib/admin/types";

const COPY: Record<Provider, { title: string; description: string }> = {
  linkedin: {
    title: "LinkedIn",
    description: "Daily auto-posting, previews, and the post log for the LinkedIn page.",
  },
  twitter: {
    title: "X (Twitter)",
    description: "Daily auto-posting, previews, and the post log for the X account.",
  },
  instagram: {
    title: "Instagram",
    description:
      "Daily branded carousels (1080×1350, dark typographic slides) with a link-in-bio CTA.",
  },
};

export async function SocialPlatformPage({
  provider,
  error,
  connected,
}: {
  provider: Provider;
  error?: string;
  connected?: string;
}) {
  const db = serviceClient();
  let connection: Connection | null = null;
  let posts: PostRow[] = [];
  if (db) {
    const [connRes, postsRes] = await Promise.all([
      db
        .from("social_credentials")
        .select("provider, display_name, author_urn, auto_enabled, expires_at")
        .eq("provider", provider)
        .maybeSingle(),
      db
        .from(
          provider === "linkedin"
            ? "linkedin_posts"
            : provider === "twitter"
              ? "twitter_posts"
              : "instagram_posts"
        )
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    connection = (connRes.data as Connection | null) ?? null;
    posts = (postsRes.data as PostRow[]) ?? [];
  }

  // LinkedIn and X each have a secondary connection: the admin's personal
  // profile/account, which mirrors each company post when connected and enabled.
  let memberConnection: Connection | null = null;
  const memberProvider =
    provider === "linkedin" ? "linkedin_member" : provider === "twitter" ? "twitter_member" : null;
  if (db && memberProvider) {
    const { data } = await db
      .from("social_credentials")
      .select("provider, display_name, author_urn, auto_enabled, expires_at")
      .eq("provider", memberProvider)
      .maybeSingle();
    memberConnection = (data as Connection | null) ?? null;
  }

  const { title, description } = COPY[provider];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>

      {error && <p className="text-destructive text-sm">OAuth error: {error}</p>}
      {connected && (
        <p className="text-muted-foreground text-sm">Connected {connected}.</p>
      )}
      {!db && (
        <p className="text-destructive text-sm">
          Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).
        </p>
      )}

      <PlatformCard provider={provider} connection={connection} />

      {provider === "linkedin" && <LinkedinMemberCard connection={memberConnection} />}
      {provider === "twitter" && <TwitterMemberCard connection={memberConnection} />}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">Recent posts</h2>
        <PostsTable provider={provider} posts={posts} />
      </section>
    </div>
  );
}
