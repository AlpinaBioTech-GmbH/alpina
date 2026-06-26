import { requireAdmin } from "@/lib/supabase/admin-auth";
import { serviceClient } from "@/lib/supabase/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddFeedForm, DeleteFeedButton, FeedToggle } from "@/components/admin/FeedControls";

export const dynamic = "force-dynamic";

interface FeedRow {
  id: string;
  url: string;
  label: string;
  category: string;
  enabled: boolean;
}

export default async function AdminFeedsPage() {
  await requireAdmin();
  const db = serviceClient();
  let feeds: FeedRow[] = [];
  if (db) {
    const { data } = await db
      .from("rss_feeds")
      .select("id, url, label, category, enabled")
      .order("category")
      .order("label");
    feeds = (data as FeedRow[]) ?? [];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feeds</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          RSS sources the article pipeline pulls leads from. Add the outlets relevant to
          your topic and toggle them on or off.
        </p>
      </div>

      {!db && (
        <p className="text-destructive text-sm">
          Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add feed</CardTitle>
        </CardHeader>
        <CardContent>
          <AddFeedForm />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">Sources</h2>
        {feeds.length === 0 ? (
          <p className="text-muted-foreground border border-dashed p-8 text-center text-sm">
            No feeds yet. Add your first source above to give the pipeline leads to work from.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feed</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-20">Active</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeds.map((feed) => (
                <TableRow key={feed.id}>
                  <TableCell className="max-w-0">
                    <p className="truncate font-medium">{feed.label}</p>
                    <p className="text-muted-foreground truncate text-xs">{feed.url}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {feed.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <FeedToggle id={feed.id} enabled={feed.enabled} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <DeleteFeedButton id={feed.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
