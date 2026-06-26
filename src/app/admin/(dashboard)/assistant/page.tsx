// src/app/admin/(dashboard)/assistant/page.tsx
// AI Assistant management. Loads the current config + knowledge sources and
// renders the editing UI. Auth + allowlist are enforced by the (dashboard)
// layout; data is read via the secret-key client.
import { getSupabaseAdmin } from "@/lib/supabase/service";
import {
  AssistantConfigForm,
  type AssistantConfig,
} from "@/components/admin/AssistantConfigForm";
import {
  KnowledgeBaseManager,
  type KbDocument,
} from "@/components/admin/KnowledgeBaseManager";
import { DEFAULT_ASSISTANT_MODEL } from "@/lib/rag/config";
import { brand } from "@/lib/config";

export const metadata = { title: "AI Assistant - Admin" };
export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: AssistantConfig = {
  enabled: true,
  model: DEFAULT_ASSISTANT_MODEL,
  system_prompt: brand.assistant.defaultSystemPrompt,
  preset_questions: [...brand.assistant.presetQuestions],
  excluded_slug_prefixes: [],
};

export default async function AssistantAdminPage() {
  const supabase = getSupabaseAdmin();

  let config = FALLBACK_CONFIG;
  let documents: KbDocument[] = [];
  let loadError: string | null = null;

  if (!supabase) {
    loadError = "Supabase is not configured. Add the keys to .env.local.";
  } else {
    const [c, d] = await Promise.all([
      supabase
        .from("assistant_config")
        .select("enabled, model, system_prompt, preset_questions, excluded_slug_prefixes")
        .eq("id", "default")
        .maybeSingle(),
      supabase
        .from("kb_documents")
        .select("id, title, source_type, status, chunk_count, error, updated_at")
        .order("updated_at", { ascending: false }),
    ]);

    if (c.error) loadError = c.error.message;
    if (c.data) config = { ...FALLBACK_CONFIG, ...(c.data as AssistantConfig) };
    documents = (d.data as KbDocument[]) ?? [];
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl">
          AI Assistant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the public assistant and the knowledge it answers from.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-none border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <AssistantConfigForm config={config} />
      <KnowledgeBaseManager documents={documents} />
    </div>
  );
}
