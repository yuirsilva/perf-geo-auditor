# Perf & GEO Auditor

Paste a URL. Get the **root causes** of slow Core Web Vitals and poor AI-search visibility, with fixes you can ship.

It combines three data sources, then has Claude investigate them with tools:

| Source | What it gives | Where |
|---|---|---|
| **CrUX** (via PageSpeed Insights) | Real-user p75 LCP / INP / CLS / TTFB, page- or origin-level | `src/lib/audit/psi.ts` |
| **Lighthouse** (via PageSpeed Insights) | Lab metrics, category scores, failing audits with details | `src/lib/audit/psi.ts` |
| **Crawl** | Meta, headings, images, render-blocking resources, JSON-LD, robots.txt rules for AI crawlers, llms.txt | `src/lib/audit/crawl.ts` |

**Claude** (`src/lib/audit/diagnose.ts`) gets a compact summary and two tools:
- `get_lighthouse_audit`: pull the rows of a specific failing audit (e.g. the LCP element) on demand, instead of stuffing everything into the prompt
- `inspect_resource`: check an asset's size, compression and caching headers

It returns a **typed diagnosis** (Zod schema + structured outputs, `src/lib/audit/diagnosis-schema.ts`): prioritized issues with evidence, root cause, fix, a code snippet and estimated impact, plus a structured-data and AI-crawler assessment. Token usage, cost and latency are stored per audit.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind 4 · Postgres (PGlite locally) + Drizzle · Better Auth · Anthropic TypeScript SDK (tool runner + structured outputs)

## Architecture

```
form (server action) ──► insert audit (queued) ──► redirect to /audits/:id
                              │
                         after() ──► runAudit(id)
                                       ├─ collecting: PSI ∥ crawl  ──► save psi, crawl
                                       ├─ diagnosing: Claude + tools ──► save diagnosis, tokens, cost
                                       └─ done | failed
/audits/:id  ── polls with router.refresh() until done
```

Security notes:
- **SSRF guard** (`url-guard.ts`): user URLs and every redirect hop are resolved and checked against private/loopback/link-local ranges before fetching. Bodies are size-capped and fetches time out.
- Audits are always queried by `id` **and** `userId`. Server actions re-check the session.

## Run it locally

```bash
pnpm install
cp .env.example .env          # then fill in the values below
pnpm db:push                  # create tables (in ./.pglite by default)
pnpm dev
```

`.env` values you need:
- `DATABASE_URL`: leave empty to use PGlite (Postgres running inside the app, data in `./.pglite`, no server or password). Set it to a `postgres://` URL to use a Postgres server instead.
- `BETTER_AUTH_SECRET`: any random 32+ byte string (`openssl rand -base64 32`)
- `ANTHROPIC_API_KEY`: from platform.claude.com
- `PAGESPEED_API_KEY`: free from Google Cloud ("PageSpeed Insights API"). **Without it you'll hit Google's shared anonymous quota almost immediately.**

Try the data collection without spending any API credits:

```bash
pnpm collect https://your-site.com
```

## Deploy (Vercel + Neon)

1. Use your Neon database (or create one) and run `pnpm db:push` against it.
2. Import the repo in Vercel and set the same env vars, with `BETTER_AUTH_URL` set to your production URL.
3. The pipeline runs inside `after()`, so it's bound by the function's max duration. If audits time out, move `runAudit` onto a queue (see roadmap).

## Roadmap (the 14-day sprint)

- [ ] **Evals:** ~15 real sites with the expected diagnosis written down. Score Claude's output against them (`scripts/` + a judge prompt) and track the score as you change prompts or effort.
- [ ] Cost and latency dashboard from the stored per-audit numbers. Try caching and `CLAUDE_EFFORT=low`, and measure whether quality holds.
- [ ] Background queue (Inngest / QStash / pg-boss) with retries
- [ ] Compare runs over time for the same URL
- [ ] Desktop + mobile strategies side by side
- [ ] Shareable public report links
