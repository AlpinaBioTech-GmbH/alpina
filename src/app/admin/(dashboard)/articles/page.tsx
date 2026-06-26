import { requireAdmin } from "@/lib/supabase/admin-auth";
import { fetchStories } from "@/lib/storyblok";
import { Icon } from "@/components/icons";
import { ActionButton } from "@/components/admin/ActionButton";
import { StatusBadge } from "@/components/admin/status-badge";
import { runArticlesNow, shareArticle } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // pipeline + share actions can take minutes

interface ArticleStory {
  uuid: string;
  name: string;
  full_slug: string;
  published_at: string | null;
  content: { title?: string; excerpt?: string; tags?: string[]; published_date?: string };
}

export default async function AdminArticlesPage() {
  await requireAdmin();
  let articles: ArticleStory[] = [];
  try {
    articles = (await fetchStories("articles/", { per_page: 30 })) as ArticleStory[];
  } catch {
    // Storyblok unavailable; render empty state
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Articles</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Published and draft articles in Storyblok, with manual pipeline and share controls.
          </p>
        </div>
        <ActionButton action={runArticlesNow} pendingLabel="Running…">
          <Icon name="sparkles" size={16} /> Run article pipeline now
        </ActionButton>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">All articles</h2>
        {articles.length === 0 ? (
          <p className="text-muted-foreground border border-dashed p-8 text-center text-sm">
            No articles found in Storyblok.
          </p>
        ) : (
          <div className="divide-y border-y">
            {articles.map((story) => {
              const title = story.content.title || story.name;
              const excerpt = story.content.excerpt ?? "";
              return (
                <div key={story.uuid} className="flex items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{title}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {story.full_slug}
                      {story.content.published_date && ` · ${story.content.published_date}`}
                      {excerpt && ` · ${excerpt}`}
                    </p>
                  </div>
                  {!story.published_at && <StatusBadge status="draft" />}
                  <ActionButton
                    action={shareArticle.bind(null, {
                      slug: story.full_slug,
                      title,
                      excerpt,
                      tags: story.content.tags,
                    })}
                    pendingLabel="Sharing…"
                    variant="outline"
                    size="sm"
                  >
                    Share to socials
                  </ActionButton>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
