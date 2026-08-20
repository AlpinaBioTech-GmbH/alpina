// Gated admin shell. requireAdmin() enforces auth + the email allowlist for
// every page in this group (the login page sits outside the group, so it is
// not gated). The sidebar is grouped by section; add a task by adding a nav
// item and a matching route. Items whose integration env is missing show a
// "setup" hint via the feature flags.
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { features } from "@/lib/features";
import { AdminNav, type AdminNavGroup } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/config";
import { signOut } from "./actions";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { admin } = await requireAdmin();
  const f = features();

  const groups: AdminNavGroup[] = [
    {
      label: "Overview",
      items: [{ href: "/admin", label: "Dashboard" }],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/articles", label: "Articles", configured: f.articles },
        { href: "/admin/feeds", label: "Feeds" },
        { href: "/admin/library", label: "Library" },
      ],
    },
    {
      label: "Social",
      items: [
        { href: "/admin/twitter", label: "X / Twitter", configured: f.twitter },
        { href: "/admin/linkedin", label: "LinkedIn", configured: f.linkedin },
        { href: "/admin/instagram", label: "Instagram", configured: f.instagram },
      ],
    },
    {
      label: "Assistant",
      items: [
        { href: "/admin/assistant", label: "Config + KB", configured: f.assistant },
        { href: "/admin/conversations", label: "Conversations" },
      ],
    },
    {
      label: "Audience",
      items: [
        { href: "/admin/submissions", label: "Submissions" },
        { href: "/admin/newsletter", label: "Newsletter", configured: f.newsletter },
        { href: "/admin/visitors", label: "Visitors" },
      ],
    },
    {
      label: "Settings",
      items: [{ href: "/admin/admins", label: "Admins" }],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:py-8">
        <aside className="md:w-56 md:shrink-0">
          <div className="mb-6 flex items-center gap-2">
            <span className="font-[family-name:var(--font-heading)] text-lg font-bold">
              {brand.name}
            </span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Admin
            </span>
          </div>
          <AdminNav groups={groups} />
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-6 flex items-center justify-between gap-4 border-b pb-4">
            <span className="truncate text-sm text-muted-foreground">
              {admin.name ? `${admin.name} - ` : ""}
              {admin.email}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                View site
              </Link>
              <ThemeToggle />
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
