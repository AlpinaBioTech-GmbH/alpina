// Side-effect env loader for CLI scripts. MUST be the first import: ESM
// hoists imports, so a `config()` call in the script body runs too late for
// modules that read process.env at load time (e.g. src/lib/anthropic/client
// constructs its client during module evaluation).
import { config } from "dotenv";
config({ path: ".env.local" });
config();
