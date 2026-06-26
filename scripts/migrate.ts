// Run the SQL migrations in supabase/migrations/ against a Postgres database.
//
// Requires a direct Postgres connection (NOT the REST API keys). Get the URI
// from the Supabase dashboard: Connect -> "Session pooler".
//
// Because DB passwords often contain characters that break a URI (& * ? # / @),
// provide the password SEPARATELY as a raw value so it never needs encoding:
//   SUPABASE_DB_URL=postgresql://postgres.<ref>:x@aws-0-<region>.pooler.supabase.com:5432/postgres
//   SUPABASE_DB_PASSWORD=<your raw db password>
// (the password embedded in the URL is ignored when SUPABASE_DB_PASSWORD is set)
//
// Then:  npm run migrate
// Migrations are idempotent (create ... if not exists), so re-running is safe.
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, type ClientConfig } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!DB_URL) {
  console.error(
    "Missing SUPABASE_DB_URL. Add the Session pooler URI from the Supabase\n" +
      "dashboard (Connect tab) to .env.local, plus SUPABASE_DB_PASSWORD=<raw password>.",
  );
  process.exit(1);
}

// Build an explicit config when a raw password is supplied (robust against
// special characters); otherwise fall back to parsing the full URI.
function buildConfig(): ClientConfig {
  const ssl = { rejectUnauthorized: false } as const;
  // Preferred: explicit connection parts (no URL parsing, no encoding issues).
  if (process.env.SUPABASE_DB_HOST && DB_PASSWORD) {
    return {
      host: process.env.SUPABASE_DB_HOST,
      port: Number(process.env.SUPABASE_DB_PORT || "5432"),
      user: process.env.SUPABASE_DB_USER || "postgres",
      database: process.env.SUPABASE_DB_NAME || "postgres",
      password: DB_PASSWORD,
      ssl,
    };
  }
  if (DB_PASSWORD) {
    // Robust parse: split on the LAST '@' so a password containing '@' (or any
    // other special char) does not confuse the host detection.
    const noScheme = DB_URL!.replace(/^postgres(?:ql)?:\/\//, "");
    const at = noScheme.lastIndexOf("@");
    if (at < 0) {
      console.error("SUPABASE_DB_URL is missing the '@host' part.");
      process.exit(1);
    }
    const creds = noScheme.slice(0, at); // user[:ignored-password]
    const hostpart = noScheme.slice(at + 1); // host:port/db[?params]
    const ci = creds.indexOf(":");
    const user = ci >= 0 ? creds.slice(0, ci) : creds;
    const slash = hostpart.indexOf("/");
    const hostport = slash >= 0 ? hostpart.slice(0, slash) : hostpart;
    let database = slash >= 0 ? hostpart.slice(slash + 1) : "postgres";
    const q = database.indexOf("?");
    if (q >= 0) database = database.slice(0, q);
    const colon = hostport.lastIndexOf(":");
    const host = colon >= 0 ? hostport.slice(0, colon) : hostport;
    const port = colon >= 0 ? Number(hostport.slice(colon + 1)) : 5432;
    return { host, port, user, database, password: DB_PASSWORD, ssl };
  }
  return { connectionString: DB_URL, ssl };
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

async function main() {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const cfg = buildConfig();
  const client = new Client(cfg);
  await client.connect();
  console.log(
    `Connected to ${(cfg as { host?: string }).host ?? "db"}. Applying ${files.length} migrations...`,
  );

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    try {
      await client.query(sql);
      console.log(`  ok: ${file}`);
    } catch (err) {
      console.error(`  FAILED: ${file}`);
      console.error(`    ${(err as Error).message}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error("migrate failed:", err.message || err);
  process.exit(1);
});
