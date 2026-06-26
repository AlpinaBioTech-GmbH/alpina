# This is NOT the Next.js you know

This project uses Next.js 16, which has breaking changes from older versions: APIs,
conventions, and file structure may differ from what you remember. Read the relevant
guide in `node_modules/next/dist/docs/` before writing routing, caching, proxy, or
data-fetching code. Heed deprecation notices.

# Copy style

Do NOT use long dashes (em dash or en dash) anywhere in copy: page content in Storyblok,
component strings, metadata, or emails. Replace them with whichever fits:

- Hyphen `-` for ranges and number spans (e.g. `2-4T`, `0-100%`).
- Colon `:` when introducing a list or explanation.
- Comma `,` for a parenthetical or a mid-sentence break.

# Branding

This is a neutral, rebrandable template. All brand identity lives in `brand.config.ts`
and `content.config.ts`. Do NOT hardcode a product name, URL, email, or persona in
components, prompts, or migrations: read it from config. Theme tokens live in
`src/app/globals.css` (neutral shadcn tokens) and `src/app/theme.css` (brand aliases).

# Integrations degrade gracefully

Every external integration (Anthropic, Voyage, social platforms, Mux, Resend) is
optional. Getters return `null` or skip when env vars are absent, and the admin sidebar
disables sections whose env is missing. Never throw at import time for a missing key.
