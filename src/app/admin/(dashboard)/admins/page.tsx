// src/app/admin/(dashboard)/admins/page.tsx
// Manage the admin allowlist: who can sign in to /admin. The current user is
// flagged and cannot delete their own row.
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/service";
import { AddAdminForm } from "@/components/admin/AddAdminForm";
import { removeAdmin } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Admins - Admin" };
export const dynamic = "force-dynamic";

type AdminRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export default async function AdminsPage() {
  const { admin } = await requireAdmin();
  const supabase = getSupabaseAdmin();

  let rows: AdminRow[] = [];
  let loadError: string | null = null;

  if (!supabase) {
    loadError = "Supabase is not configured.";
  } else {
    const { data, error } = await supabase
      .from("admin_users")
      .select("id, email, name, role, created_at")
      .order("created_at", { ascending: true });
    if (error) loadError = error.message;
    rows = (data as AdminRow[]) ?? [];
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl">
          Admins
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who can sign in to the admin area. Adding an email lets that person sign
          in with a magic link.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-none border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add an admin</CardTitle>
          <CardDescription>No invite email is sent; share the login URL.</CardDescription>
        </CardHeader>
        <CardContent>
          <AddAdminForm />
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-none border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Added</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const isSelf = row.email.toLowerCase() === admin.email.toLowerCase();
              return (
                <tr key={row.id} className="align-middle">
                  <td className="px-3 py-2">
                    {row.email}
                    {isSelf ? (
                      <Badge variant="secondary" className="ml-2">
                        You
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{row.role}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmtDate(row.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isSelf ? null : (
                      <form action={removeAdmin}>
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
