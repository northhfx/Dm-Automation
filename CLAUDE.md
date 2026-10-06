@AGENTS.md

# Project notes

DM automation for Facebook Pages + Instagram (comment → public reply + private-reply DM, keyword DM auto-replies) with a stats dashboard. UI text and code comments are Thai.

- Stack: Next.js 16 (App Router, `src/proxy.ts` for auth), Drizzle ORM + PostgreSQL, Tailwind v4, Vitest.
- Webhook (`src/app/api/webhooks/meta`) only verifies + enqueues; all work runs in the in-process worker (`src/lib/queue/worker.ts`) started from `src/instrumentation.ts`, which also runs migrations. Needs a long-running server (not serverless).
- Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and commit the new file in `drizzle/`.
- Checks: `npm run lint`, `npm run typecheck`, `npm test` (integration tests need Postgres at `TEST_DATABASE_URL`, default `postgresql://dm:dm@localhost:5432/dm_automation_test`; Graph API is mocked in `tests/helpers.ts`).
