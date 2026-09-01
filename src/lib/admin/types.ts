// Row shapes shared between the admin server pages and their client islands.

export interface Connection {
  provider: string;
  display_name: string | null;
  author_urn: string;
  auto_enabled: boolean;
  expires_at: string | null;
}

/** A LinkedIn page the connected member administers, for the admin page selector. */
export interface LinkedinOrgOption {
  urn: string;
  id: string;
  name: string;
}

export interface PostRow {
  id: string;
  status: string;
  pillar: string | null;
  content_id: string;
  content_slug: string | null;
  url: string;
  commentary?: string;
  text?: string;
  caption?: string;
  slides?: { kicker?: string; title: string; body?: string }[];
  hashtags: string[];
  validator_notes: string | null;
  error: string | null;
  linkedin_url?: string | null;
  tweet_url?: string | null;
  permalink?: string | null;
  created_at: string;
  posted_at: string | null;
}

// The generated article draft persisted on a run (pipeline_runs.draft), used to
// recover and publish work from a run that failed at the Storyblok publish step.
export interface RunDraft {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  source_urls: string[];
}

export interface RunRow {
  id: string;
  kind: string;
  trigger: string;
  status: string;
  outcome: string | null;
  article_id: string | null;
  article_title: string | null;
  editor_score: number | null;
  revision_count: number | null;
  attempts: { attempt: number; score?: number; approved: boolean; notes: string }[];
  notes: string | null;
  draft: RunDraft | null;
  started_at: string;
  finished_at: string | null;
}
