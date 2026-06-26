// Set the public assistant config (system prompt, starter questions, model,
// enabled) from brand.config. Run after editing brand.config.ts to push the
// values to the live assistant_config row.
//
//   npm run configure-assistant
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { Client } from "pg";
import { brand } from "../brand.config";

async function main() {
  const c = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER,
    database: process.env.SUPABASE_DB_NAME,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query(
    `update public.assistant_config
       set system_prompt = $1,
           preset_questions = $2::jsonb,
           model = $3,
           enabled = true,
           updated_at = now()
     where id = 'default'`,
    [
      brand.assistant.defaultSystemPrompt,
      JSON.stringify(brand.assistant.presetQuestions),
      process.env.ASSISTANT_MODEL || "claude-haiku-4-5",
    ],
  );
  const { rows } = await c.query(
    "select enabled, model, system_prompt, preset_questions from assistant_config where id='default'",
  );
  console.log("assistant_config updated:");
  console.log(JSON.stringify(rows[0], null, 2));
  await c.end();
}

main().catch((err) => {
  console.error("configure-assistant failed:", err.message || err);
  process.exit(1);
});
