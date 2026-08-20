// Server-side feature detection. Every integration is optional; the admin
// sidebar uses this to mark sections whose env is not yet configured. Read
// only on the server (it inspects secret env vars).

export type Features = {
  supabase: boolean;
  assistant: boolean; // Anthropic chat
  voyage: boolean; // RAG embeddings
  email: boolean; // Resend
  newsletter: boolean; // monthly digest (Resend segment configured)
  storyblokWrite: boolean; // article publishing
  articles: boolean; // writer pipeline (needs Anthropic + Storyblok mgmt)
  linkedin: boolean;
  twitter: boolean;
  instagram: boolean;
  cron: boolean;
};

export function features(): Features {
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  const storyblokWrite = !!process.env.STORYBLOK_MANAGEMENT_TOKEN;
  return {
    supabase:
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!(
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
    assistant: anthropic,
    voyage: !!process.env.VOYAGE_API_KEY,
    email: !!process.env.RESEND_API_KEY,
    newsletter: !!process.env.RESEND_API_KEY && !!process.env.NEWSLETTER_RESEND_SEGMENT_ID,
    storyblokWrite,
    articles: anthropic && storyblokWrite,
    linkedin: !!process.env.LINKEDIN_CLIENT_ID,
    twitter: !!process.env.TWITTER_CLIENT_ID,
    instagram: !!process.env.INSTAGRAM_APP_ID,
    cron: !!process.env.CRON_SECRET,
  };
}
