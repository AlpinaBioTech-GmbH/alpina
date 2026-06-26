// Seed the admin_users allowlist from ADMIN_EMAILS (comma-separated) so the
// magic-link login at /admin works. Idempotent (on conflict do nothing).
//
//   npm run seed-admin
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { Client } from "pg";

const emails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  if (!emails.length) {
    console.error("ADMIN_EMAILS is empty. Set it in .env.local, then re-run.");
    process.exit(1);
  }
  const c = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER,
    database: process.env.SUPABASE_DB_NAME,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  for (const email of emails) {
    await c.query(
      "insert into public.admin_users (email, role) values ($1, 'owner') on conflict (email) do nothing",
      [email],
    );
    console.log(`  ensured admin: ${email}`);
  }
  const { rows } = await c.query("select email, role from public.admin_users order by email");
  console.log("admin_users now:", rows.map((r) => `${r.email} (${r.role})`).join(", "));
  await c.end();
}

main().catch((err) => {
  console.error("seed-admin failed:", err.message || err);
  process.exit(1);
});
