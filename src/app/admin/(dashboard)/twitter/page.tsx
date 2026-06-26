import { requireAdmin } from "@/lib/supabase/admin-auth";
import { SocialPlatformPage } from "@/components/admin/SocialPlatformPage";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // generate-and-post actions run the compose loop

export default async function AdminTwitterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  await requireAdmin();
  const { error, connected } = await searchParams;
  return <SocialPlatformPage provider="twitter" error={error} connected={connected} />;
}
