// src/app/admin/(dashboard)/submissions/page.tsx
// Read-only view of contact form submissions and newsletter subscribers.
// Data is fetched server-side via the service/secret-key client (RLS bypass).
// The (dashboard) layout already enforces auth + the admin allowlist.
import { getSupabaseAdmin } from "@/lib/supabase/service";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Submissions - Admin" };
export const dynamic = "force-dynamic";

type ContactRow = {
  id: string;
  created_at: string;
  name: string;
  company: string | null;
  email: string;
  role: string | null;
  interest: string;
  message: string;
  source_page: string | null;
};

type SubscriberRow = {
  id: string;
  created_at: string;
  email: string;
  status: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function SubmissionsPage() {
  const supabase = getSupabaseAdmin();

  let contacts: ContactRow[] = [];
  let subscribers: SubscriberRow[] = [];
  let loadError: string | null = null;

  if (!supabase) {
    loadError = "Supabase is not configured. Add the keys to .env.local.";
  } else {
    const [c, s] = await Promise.all([
      supabase
        .from("contact_submissions")
        .select("id, created_at, name, company, email, role, interest, message, source_page")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("newsletter_subscribers")
        .select("id, created_at, email, status")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (c.error || s.error) {
      loadError = c.error?.message || s.error?.message || "Failed to load data.";
    }
    contacts = (c.data as ContactRow[]) ?? [];
    subscribers = (s.data as SubscriberRow[]) ?? [];
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl">
          Submissions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact enquiries and newsletter signups. Read-only.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-none border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">
            Contact <Badge variant="secondary" className="ml-2">{contacts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="subscribers">
            Newsletter <Badge variant="secondary" className="ml-2">{subscribers.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contact submissions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-none border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Interest</th>
                    <th className="px-3 py-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {fmtDate(row.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        {row.name}
                        {row.role ? (
                          <span className="block text-xs text-muted-foreground">
                            {row.role}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`mailto:${row.email}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {row.email}
                        </a>
                      </td>
                      <td className="px-3 py-2">{row.company ?? "-"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{row.interest}</Badge>
                      </td>
                      <td className="max-w-md px-3 py-2 text-muted-foreground">
                        {row.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="subscribers" className="mt-4">
          {subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No newsletter subscribers yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-none border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subscribers.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {fmtDate(row.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`mailto:${row.email}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {row.email}
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        {row.status === "unsubscribed" ? (
                          <Badge variant="outline">unsubscribed</Badge>
                        ) : (
                          <span className="text-muted-foreground">subscribed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
