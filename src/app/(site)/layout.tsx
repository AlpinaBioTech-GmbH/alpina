// src/app/(site)/layout.tsx
// Public marketing chrome. Wraps every public page with the Storyblok-driven
// site header and footer. The /admin area lives outside this group, so it does
// not inherit this chrome.
import SiteHeader, { type GlobalConfig } from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { unstable_cache } from "next/cache";
import { AssistantWidget } from "@/components/site/AssistantWidget";
import { fetchGlobalConfig } from "@/lib/storyblok";
import { getSupabaseAdmin } from "@/lib/supabase/service";

// Cached so the public site doesn't query Supabase on every page view. The
// saveConfig admin action calls revalidateTag("assistant-config") for instant
// updates; otherwise it refreshes at most every 5 minutes.
const getAssistantWidgetConfig = unstable_cache(
  async (): Promise<{ enabled: boolean; presetQuestions: string[] }> => {
    const db = getSupabaseAdmin();
    if (!db) return { enabled: false, presetQuestions: [] };
    const { data } = await db
      .from("assistant_config")
      .select("enabled, preset_questions")
      .eq("id", "default")
      .maybeSingle();
    return {
      enabled: Boolean(data?.enabled),
      presetQuestions: (data?.preset_questions as string[]) ?? [],
    };
  },
  ["assistant-widget-config"],
  { tags: ["assistant-config"], revalidate: 300 },
);

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const globalStory = await fetchGlobalConfig();
  const config = (globalStory?.content as GlobalConfig | undefined) ?? null;
  const assistant = await getAssistantWidgetConfig();

  return (
    <>
      <SiteHeader config={config} />
      {children}
      <SiteFooter config={config} />
      <AssistantWidget
        enabled={assistant.enabled}
        presetQuestions={assistant.presetQuestions}
      />
    </>
  );
}
