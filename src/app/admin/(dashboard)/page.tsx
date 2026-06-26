// Admin dashboard: a configuration overview + quick links. Each integration is
// optional; this surfaces which are live so the operator knows what to set up.
import Link from "next/link";
import { features } from "@/lib/features";
import { brand } from "@/lib/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2 rounded-full ${
        on ? "bg-emerald-500" : "bg-muted-foreground/40"
      }`}
    />
  );
}

export default async function AdminDashboard() {
  const f = features();

  const integrations: { label: string; on: boolean; hint: string }[] = [
    { label: "Database (Supabase)", on: f.supabase, hint: "submissions, runs, KB" },
    { label: "AI assistant (Anthropic)", on: f.assistant, hint: "Talk-to-AI chat" },
    { label: "RAG embeddings (Voyage)", on: f.voyage, hint: "grounded answers" },
    { label: "Email (Resend)", on: f.email, hint: "contact notifications" },
    { label: "Article publishing (Storyblok)", on: f.storyblokWrite, hint: "writer pipeline" },
    { label: "X / Twitter", on: f.twitter, hint: "social posting" },
    { label: "LinkedIn", on: f.linkedin, hint: "social posting" },
    { label: "Instagram", on: f.instagram, hint: "carousel posting" },
    { label: "Cron secret", on: f.cron, hint: "scheduled posting" },
  ];

  const links: { href: string; label: string; desc: string }[] = [
    { href: "/admin/articles", label: "Articles", desc: "Generate and publish articles." },
    { href: "/admin/twitter", label: "Social", desc: "Connect and post to platforms." },
    { href: "/admin/assistant", label: "Assistant", desc: "Configure the chat + knowledge base." },
    { href: "/admin/submissions", label: "Submissions", desc: "Contact and newsletter signups." },
    { href: "/admin/admins", label: "Admins", desc: "Manage who can sign in." },
  ];

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
          {brand.name} admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of configured integrations and quick links.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
          <CardDescription>
            Optional features light up as you add their environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {integrations.map((i) => (
              <li key={i.label} className="flex items-center gap-3 text-sm">
                <StatusDot on={i.on} />
                <span className="font-medium">{i.label}</span>
                <span className="text-muted-foreground">{i.hint}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="h-full transition-colors hover:border-foreground/30">
              <CardHeader>
                <CardTitle className="text-base">{l.label}</CardTitle>
                <CardDescription>{l.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
