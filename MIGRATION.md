# AlpinaBioTech — Migration Plan: Wix → Vercel

This document is for the current owner of **alpinabiotech.com**. It walks you through
moving the website off Wix onto the new Next.js codebase (this repository) hosted on
Vercel, detaching Google Workspace from Wix so you pay Google directly, and creating
every account and API key the new site needs.

**Current state (verified July 2026):**

- Domain `alpinabiotech.com` is **registered at Wix** and uses Wix nameservers.
- The website is hosted on Wix.
- Email (`@alpinabiotech.com`) is **Google Workspace, purchased through Wix** —
  Wix bills you as a reseller; the MX records already point to Google.

**Target state:**

- Website: this codebase, deployed on **Vercel**.
- Content: **Storyblok** (CMS) — all pages, products, and categories are edited there.
- Database: **Supabase** (quote requests, admin users, assistant data).
- Email sending (forms/notifications): **Resend**. Email inboxes: unchanged (Google Workspace).
- Google Workspace: billed **directly by Google**, no Wix involvement.
- Domain: registered and DNS-managed at **Vercel**, same place as the hosting.

---

## Order of operations (important)

Do the phases in this order. The website and your email are independent — done in this
sequence, **email never goes down** and the old Wix site stays live until the new one
is verified.

1. **Phase 1** — Create accounts and collect all keys (nothing goes live).
2. **Phase 2** — Deploy the new site to Vercel and test it on a `*.vercel.app` URL.
3. **Phase 3** — Detach Google Workspace billing from Wix → direct with Google.
4. **Phase 4** — Transfer the domain away from Wix and cut DNS over to Vercel.
5. **Phase 5** — Post-cutover configuration (webhooks, pipeline, admin access).
6. **Phase 6** — Cancel the Wix premium plan (only after everything is verified).

> ⚠️ **The one thing that can break email:** the MX records that route your mail to
> Google live in Wix's DNS today. When DNS moves (Phase 4), those records must be
> recreated at the new DNS host **before** switching nameservers. Phase 4 covers this.

---

## Phase 1 — Accounts and keys

Create these accounts with a company email you control (e.g. `info@alpinabiotech.com`
or a dedicated `webmaster@` mailbox), **not** a personal address of an agency or
contractor. Store every key in a password manager as you go.

### 1.1 GitHub (code hosting)

1. Create a GitHub account/organization for the company: <https://github.com/signup>.
2. Have the developer **transfer this repository** to your account
   (GitHub → repo → Settings → Transfer ownership), or push it to a new **private**
   repository you own.
3. You will come back to this repo in Phase 5 to set the article-pipeline secrets.

### 1.2 Vercel (hosting)

1. Sign up at <https://vercel.com/signup> — easiest is "Continue with GitHub" using
   the account from 1.1.
2. Choose the **Pro plan** (~US$20/month). The free Hobby plan does not permit
   commercial sites under Vercel's terms, and Pro also covers the daily cron job the
   site uses.

### 1.3 Storyblok (CMS — where all site content lives)

The site's content (37 ELISA kits, 12 categories, all pages) already exists in a
Storyblok space set up by the developer. Two options:

- **Option A (recommended): take over the existing space.**
  1. Create an account at <https://app.storyblok.com/#/signup>.
  2. The developer invites you to the space as **Admin**, then transfers space
     ownership to you (Space → Settings → General → Transfer ownership).
  3. Collect these values from the space (Settings → Access Tokens):
     - **Preview token** (secret) → `STORYBLOK_PREVIEW_TOKEN`
     - **Public token** → `NEXT_PUBLIC_STORYBLOK_TOKEN`
     - The **space ID** (shown in Settings) → `STORYBLOK_SPACE_ID`
  4. Create your own **Personal Access Token** at
     <https://app.storyblok.com/#/me/account?tab=token> → `STORYBLOK_PERSONAL_ACCESS_TOKEN`
     (also used as `STORYBLOK_MANAGEMENT_TOKEN`).

- **Option B: recreate the space from scratch.** The repo can rebuild everything:
  set `STORYBLOK_PERSONAL_ACCESS_TOKEN` in `.env.local`, then run
  `npm run create-space` followed by `npm run seed`. Only needed if the existing
  space cannot be transferred.

The free **Community** plan is sufficient for one space and this catalog.

### 1.4 Supabase (database — quote requests, admin login, assistant data)

1. Create an account at <https://supabase.com> and create a new project
   (choose an EU region if you prefer EU data residency). Free tier is fine to start.
2. Save the **database password** you set at project creation.
3. Collect from Project Settings → API:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_...`) → `SUPABASE_SECRET_KEY`
4. Set up the database schema (developer task, run locally from this repo):
   - Get the **Session pooler** connection string (Dashboard → Connect) →
     `SUPABASE_DB_URL`, plus `SUPABASE_DB_PASSWORD` (the raw password).
   - Run `npm run migrate` (creates all tables; safe to re-run).
   - Set `ADMIN_EMAILS=you@alpinabiotech.com` and run `npm run seed-admin`
     (allowlists you for the `/admin` magic-link login).
5. In Supabase → Authentication → URL Configuration, set the Site URL to
   `https://alpinabiotech.com` (after Phase 4) so admin magic-link emails point at
   the right domain.

### 1.5 Resend (transactional email — contact/quote form notifications)

1. Sign up at <https://resend.com> (free tier: 3,000 emails/month — plenty).
2. Create an API key → `RESEND_API_KEY`.
3. Add and verify the domain `alpinabiotech.com` (Resend → Domains → Add Domain).
   Resend gives you 3–4 DNS records (DKIM/SPF for a subdomain like `send.`). **Add
   these in Wix's DNS panel now** (Wix → Domains → ⋯ → Manage DNS Records) so the
   domain verifies before the DNS move — and note them down; you'll recreate them in
   Phase 4. These records do not affect your Google mailboxes.
4. Set `CONTACT_FROM` to a sender on the verified domain, e.g.
   `AlpinaBioTech <noreply@alpinabiotech.com>`, and `CONTACT_NOTIFY_TO` to the inbox
   that should receive quote requests (e.g. `info@alpinabiotech.com`).

### 1.6 Anthropic — Claude API key (AI assistant + article pipeline)

1. Create an account at <https://console.anthropic.com>.
2. Go to **Billing** and add a payment method / buy initial credits (pay-as-you-go;
   expect low single-digit dollars per article-pipeline run, and cents per assistant
   conversation).
3. Go to **API Keys** → Create Key → `ANTHROPIC_API_KEY`. It is shown **once** —
   store it immediately.
4. Optional but recommended: set a monthly spend limit in Billing so costs can't
   run away.

### 1.7 Voyage AI (optional — assistant document retrieval)

Only needed if you use the AI assistant with knowledge-base retrieval (RAG). Without
it the assistant still works, just without retrieved context.

1. Sign up at <https://www.voyageai.com> → dashboard → API keys → `VOYAGE_API_KEY`.

### 1.8 Pexels (optional — stock cover images for articles)

1. Free key at <https://www.pexels.com/api/> → `PEXELS_API_KEY`. Without it, articles
   publish without a cover image.

### 1.9 Generated secrets (no account needed)

Generate four random secrets — on a Mac/Linux terminal: `openssl rand -hex 32`
(run it once per secret):

| Variable | Purpose |
|---|---|
| `STORYBLOK_DRAFT_SECRET` | Protects the Storyblok preview route |
| `STORYBLOK_WEBHOOK_SECRET` | Verifies Storyblok publish webhooks |
| `CRON_SECRET` | Protects the daily social-posting cron endpoint |
| `IG_SLIDE_SIGNING_SECRET` | Signs Instagram slide URLs (must be identical in Vercel **and** GitHub Actions) |

### 1.10 Social media apps (optional — only if you use auto-posting)

The site can auto-post articles to X/Twitter, LinkedIn, and Instagram. Each requires
creating a developer app on the respective platform (client ID/secret, redirect URIs —
see `.env.example` for the exact variable names). **Skip this at migration time**;
everything works without it, and it can be added later.

---

## Phase 2 — Deploy the new site to Vercel

Nothing here affects the live Wix site or email. Developer-friendly task; the owner
mainly needs to have completed Phase 1.

1. In Vercel: **Add New → Project → Import** the GitHub repository from 1.1.
   Framework is auto-detected (Next.js); the repo's `vercel.json` handles build
   settings and the daily cron.
2. Before the first deploy, add the **Environment Variables** (Project → Settings →
   Environment Variables). Minimum set for a working site:

   ```
   NEXT_PUBLIC_SITE_URL=https://alpinabiotech.com
   NEXT_PUBLIC_STORYBLOK_REGION=eu
   STORYBLOK_PREVIEW_TOKEN=...
   NEXT_PUBLIC_STORYBLOK_TOKEN=...
   STORYBLOK_SPACE_ID=...
   STORYBLOK_DRAFT_SECRET=...
   STORYBLOK_WEBHOOK_SECRET=...
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   SUPABASE_SECRET_KEY=...
   ADMIN_EMAILS=you@alpinabiotech.com
   RESEND_API_KEY=...
   CONTACT_NOTIFY_TO=info@alpinabiotech.com
   CONTACT_FROM=AlpinaBioTech <noreply@alpinabiotech.com>
   ANTHROPIC_API_KEY=...
   CRON_SECRET=...
   ```

   Optional extras when ready: `VOYAGE_API_KEY`, `PEXELS_API_KEY`,
   `IG_SLIDE_SIGNING_SECRET`, `SOCIAL_OPERATOR_EMAIL`, and the social app keys.
3. Deploy. Vercel gives you a URL like `alpina-xxxx.vercel.app`.
4. **Test on the vercel.app URL** before touching the domain:
   - [ ] Home, About, Contact pages render
   - [ ] `/catalog` lists the kits; filters work; a product detail page loads
   - [ ] Submit a test quote request → arrives at `CONTACT_NOTIFY_TO` and appears in
         Supabase (`contact_submissions` table)
   - [ ] `/admin` magic-link login works for your allowlisted email

Leave this deployment running; the Wix site is still the live one.

---

## Phase 3 — Detach Google Workspace from Wix (go direct with Google)

Currently Wix bills you for Google Workspace as a reseller. You will cancel the Wix
subscription and continue the same account directly with Google. **Your mailboxes,
mail history, Drive files, and addresses are unaffected** — only who bills you changes.

1. **Verify Google admin access first (do not skip).** Log in at
   <https://admin.google.com> with your Workspace super-admin account
   (the main `@alpinabiotech.com` admin user). If you don't know the admin
   credentials, recover them via Wix support **before** cancelling anything.
2. Note your renewal date in Wix (Wix → Billing & Payments → Subscriptions) so you
   can time the switch and avoid double payment.
3. In Wix, cancel the Google Workspace subscription: **Billing & Payments →
   Subscriptions → Google Workspace → Cancel / turn off auto-renew**. The mailboxes
   keep working until the end of the paid period. (Wix help:
   [Canceling Your Business Email Renewal](https://support.wix.com/en/article/google-workspace-canceling-your-business-email-renewal).)
4. When the Wix subscription lapses, Google suspends billing on the account (your
   data is retained — Google keeps it for 180 days). Promptly sign in to
   <https://admin.google.com> → **Billing** → follow the prompts to **set up direct
   billing with Google** (add company payment details, choose a plan — Business
   Starter matches the typical Wix-resold tier).
5. If the Admin console doesn't offer a billing setup flow, contact
   [Google Workspace support](https://support.google.com/a/answer/1047213) from the
   Admin console and tell them: *"Our subscription was resold by Wix, the reseller
   subscription is cancelled, and we want direct billing with Google."* This is a
   routine request.
6. Verify: send and receive a test email, and check Admin console → Billing shows an
   active Google-billed subscription.

> Email delivery itself never depends on this phase — MX records stay pointed at
> Google throughout. The only real risk is losing admin access, which is why step 1
> comes first.

---

## Phase 4 — Move the domain from Wix to Vercel

The domain is registered at Wix and served by Wix DNS. You'll transfer the
registration **into Vercel**, so hosting, DNS, and the domain all live in one
account. One caveat to respect: Vercel does **not** automatically import your
existing DNS records, so you must recreate them in Vercel DNS by hand (step 4.3)
**before** the nameservers switch — this is what keeps Google email alive.

### 4.1 Inventory current DNS (before anything else)

In Wix → Domains → ⋯ → **Manage DNS Records**, screenshot/copy **every** record.
You must preserve at minimum:

- **MX records** → `aspmx.l.google.com` etc. (your Google email — critical)
- **SPF** TXT record (usually `v=spf1 include:_spf.google.com ~all`)
- **DKIM** TXT record(s) for Google (`google._domainkey...`), if present
- Google site-verification TXT record, if present
- The **Resend** records you added in Phase 1.5
- Any other custom records (subdomains, verification codes)

### 4.2 Transfer the registration from Wix to Vercel

(Wix help: [Transferring Your Wix Domain Away from Wix](https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749) ·
Vercel help: [Transfer a domain into Vercel](https://vercel.com/docs/domains/managing-domains/transfer-your-domain).)

1. Check eligibility: the domain must be >60 days past registration/last transfer and
   contact details unchanged for 60 days (ICANN lock).
2. Wix → Domains → ⋯ → **Transfer Away from Wix** → confirm. Wix unlocks the domain
   and emails the **EPP/authorization code** to the registrant contact (within 24h).
3. In the Vercel dashboard (your team) → **Domains → Add or Transfer In a Domain →
   Transfer In**, enter `alpinabiotech.com` and the EPP code, and pay the transfer
   fee (includes a 1-year renewal extension). Approve any confirmation email.
   Transfers take up to 5–7 days; **the site and email keep working during the
   transfer** because the Wix nameservers stay active until it completes.
4. **While the transfer is pending**, recreate every record from your 4.1 inventory
   in Vercel DNS (Domains → `alpinabiotech.com` → DNS Records, or during the
   transfer-in flow, which prompts you to add records). At minimum the Google **MX**
   records, SPF/DKIM **TXT** records, and the Resend records. Double-check against
   the inventory — Vercel does not copy them from Wix for you.

### 4.3 Cut the website over

1. When the transfer completes, Vercel switches the domain to its own nameservers
   (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`) and your Vercel DNS zone — the one
   you filled in step 4.2.4 — goes live. If nameservers aren't switched
   automatically, set them on the domain's page in the Vercel dashboard.
2. In the Vercel **project**: Settings → **Domains** → add `alpinabiotech.com` and
   `www.alpinabiotech.com`. Because the domain is Vercel-managed, the web records
   (A/CNAME) are configured automatically — no manual entry, and set `www` to
   redirect to the apex (or vice versa) when prompted.
3. Within minutes to a few hours:
   - [ ] `https://alpinabiotech.com` serves the new site with a valid certificate
   - [ ] `https://www.alpinabiotech.com` works
   - [ ] Send **and** receive a test email on `@alpinabiotech.com` — this confirms
         the MX records survived the move
   - [ ] Resend domain still shows "verified"

**Lower-risk interim alternative:** if the 60-day lock blocks the transfer, you can
keep the domain at Wix for now and simply edit records in Wix's DNS panel to point
the web traffic at Vercel (`A` on the apex → `76.76.21.21`, `CNAME` on `www` →
`cname.vercel-dns.com` — use the exact values the Vercel Domains screen shows).
Transfer the registration into Vercel later. Note that you must then keep paying Wix
for the domain until the transfer.

---

## Phase 5 — Post-cutover configuration

1. **Storyblok preview + webhook** (so editors see live previews and published
   changes appear on the site immediately):
   - Space → Settings → Visual Editor → set preview URL to `https://alpinabiotech.com/`
   - Space → Settings → Webhooks → add a "story published/unpublished" webhook to
     `https://alpinabiotech.com/api/revalidate` using `STORYBLOK_WEBHOOK_SECRET`
2. **Article pipeline (GitHub Actions)** — the AI article writer runs on GitHub, not
   Vercel. In the GitHub repo → Settings → Secrets and variables → Actions, add:
   `ANTHROPIC_API_KEY`, `STORYBLOK_MANAGEMENT_TOKEN`, `STORYBLOK_SPACE_ID`,
   `NEXT_PUBLIC_STORYBLOK_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   and optionally `PEXELS_API_KEY`, `RESEND_API_KEY`, `IG_SLIDE_SIGNING_SECRET`
   (same value as Vercel). Set the repository **variable** `NEXT_PUBLIC_SITE_URL`.
   It runs Mon/Wed/Fri automatically; trigger a manual run from the Actions tab to
   verify.
   - For the admin "Run pipeline now" button, also set `GITHUB_REPO=owner/repo` and a
     fine-grained GitHub token with Actions read/write as `GITHUB_DISPATCH_TOKEN` in
     Vercel.
3. **Update `NEXT_PUBLIC_SITE_URL`** in Vercel to `https://alpinabiotech.com` if it
   isn't already, and redeploy.
4. **Google Search Console**: add the domain property (or update the existing one)
   and submit `https://alpinabiotech.com/sitemap.xml` so Google indexes the new site.
5. Update the Supabase Auth Site URL (see 1.4 step 5) if you hadn't yet.

---

## Phase 6 — Decommission Wix

Only after **all** of these have been true for at least a few days:

- [ ] New site live on the domain, SSL valid
- [ ] Quote/contact forms delivering email
- [ ] Google email sending and receiving normally
- [ ] Google Workspace billed directly by Google (Phase 3 complete)
- [ ] Domain transfer completed (or DNS repointed if using the interim option)

Then, in Wix → Billing & Payments: cancel/turn off auto-renew on the **Premium site
plan** (and the domain subscription, if the domain has transferred out). Download
anything you still want from the Wix dashboard first (old form submissions,
analytics). Keep the Wix account itself for a few months as a safety net — it costs
nothing once subscriptions are off.

---

## Appendix A — Who to ask / handover from the developer

Ask the current developer (Julian) to hand over, via a password manager or other
secure channel — **not** plain email:

- The GitHub repository (ownership transfer)
- The Storyblok space (ownership transfer) or its tokens
- The existing Supabase project (Organization → transfer) **or** confirmation that
  you should create a fresh one (Phase 1.4 recreates the schema either way)
- Any existing `.env.local` values that are still valid

## Appendix B — Expected running costs

| Service | Plan | Approx. cost |
|---|---|---|
| Vercel | Pro | ~$20/month |
| Storyblok | Community | Free |
| Supabase | Free tier | Free (Pro $25/mo if it outgrows it) |
| Resend | Free tier | Free up to 3k emails/mo |
| Anthropic API | Pay-as-you-go | ~$5–20/month depending on pipeline use |
| Voyage AI | Free tier | Free at this volume |
| Google Workspace | Direct, Business Starter | ~$7/user/month (similar to Wix pricing) |
| Domain | Vercel Registrar | ~$15–20/year |
| **Wix (after migration)** | — | **$0** |

## Appendix C — Rollback

Until Phase 6, rollback is always possible: point the domain's A/CNAME records back
at the values Wix used (or re-connect the domain in Wix) and the old site returns.
Email is unaffected by any web rollback as long as the MX records are untouched.

---

*Sources for the Wix-specific steps:
[Wix: Google Workspace — Canceling Your Business Email Renewal](https://support.wix.com/en/article/google-workspace-canceling-your-business-email-renewal) ·
[Wix: Google Workspace FAQs](https://support.wix.com/en/article/google-workspace-faqs) ·
[Wix: Transferring Your Wix Domain Away from Wix](https://support.wix.com/en/article/transferring-your-wix-domain-away-from-wix-2477749) ·
[Google: Contact Workspace support](https://support.google.com/a/answer/1047213)*
