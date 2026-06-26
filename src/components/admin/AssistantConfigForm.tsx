// src/components/admin/AssistantConfigForm.tsx
// Edits the public assistant's behaviour: on/off, model, system prompt, and the
// preset questions shown in the widget (one per line).
"use client";

import { useActionState } from "react";
import { saveConfig, type ActionState } from "@/app/admin/(dashboard)/assistant/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type AssistantConfig = {
  enabled: boolean;
  model: string;
  system_prompt: string;
  preset_questions: string[];
  excluded_slug_prefixes: string[];
};

export function AssistantConfigForm({ config }: { config: AssistantConfig }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    saveConfig,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assistant settings</CardTitle>
        <CardDescription>
          Controls the public chat widget. Changes apply immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={config.enabled}
              className="size-4 rounded-none border-input"
            />
            <span className="text-sm font-medium">Enabled (show widget on the site)</span>
          </label>

          <div className="grid gap-2">
            <Label htmlFor="model">Model</Label>
            <select
              id="model"
              name="model"
              defaultValue={config.model}
              className="h-9 w-full rounded-none border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="claude-haiku-4-5">Claude Haiku 4.5 (fast, low cost)</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (higher quality)</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="system_prompt">System prompt</Label>
            <Textarea
              id="system_prompt"
              name="system_prompt"
              defaultValue={config.system_prompt}
              rows={6}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              How the assistant should behave. It answers only from the knowledge
              base below.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="preset_questions">Preset questions (one per line, up to 5)</Label>
            <Textarea
              id="preset_questions"
              name="preset_questions"
              defaultValue={config.preset_questions.join("\n")}
              rows={4}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="excluded_slug_prefixes">
              Excluded Storyblok paths (one prefix per line)
            </Label>
            <Textarea
              id="excluded_slug_prefixes"
              name="excluded_slug_prefixes"
              defaultValue={config.excluded_slug_prefixes.join("\n")}
              rows={3}
              placeholder={"internal/\ndrafts/"}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Stories whose slug starts with any of these are skipped on the next
              Storyblok sync.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save settings"}
            </Button>
            {state ? (
              <span
                className={
                  state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"
                }
              >
                {state.message}
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
