---
name: devspec-db-design
description: Scan a real database before writing DB-affecting design — read the live schema, trace what a change touches, and write a grounded db.md the design/spec cite. Use when a change adds or alters tables, columns, indexes, or queries.
license: MIT
compatibility: Needs a connected DB MCP (postgres, mysql, supabase, or similar) to read the live schema. Falls back to migration/DDL files in the repo when no DB is reachable — says so in db.md.
metadata:
  author: devspec
  version: "1.0"
---

Ground a DB change in the *actual* schema before anyone specs it. **You read the database and write `db.md` — you never run DDL, migrations, or write application code.**

Design blind and the worker inherits your guesses — a column that's already `NOT NULL`, a table that a second feature also writes, an FK you didn't know existed. Read reality first.

If `devspec/context/` exists (from `/devspec-init`), read `summary.md` for the stack and `conventions.md` for the backend block first — persistence style, migration tool and layout, naming. The `db.md` you write must fit those (right dialect, right migration dir, existing column conventions); if the change can't fit an existing rule, flag it in `db.md`, don't silently break it.

## Read the schema, don't assume it

Prefer a connected DB MCP over reading migration files — it's the truth, files can lag. Detect what's connected:

- **postgres / mysql / supabase / other SQL MCP** → list tables, describe the tables the change touches, read column types/nullability/defaults, PK/FK, indexes, and existing constraints. Sample a few rows only if data shape is genuinely unclear from the schema.
- **No DB MCP reachable** → fall back to the repo's DDL: migration files (Flyway `V*__*.sql`, Alembic, Prisma schema, `schema.sql`), model/entity classes. State in `db.md` that this is file-derived, not live — it may drift from prod.

Note which source you used; it lands in `db.md` so downstream knows how much to trust it.

## Trace what the change touches

A new column or table rarely stands alone. Before writing, find the blast radius:

- **Who reads/writes these tables** — use the code graph (see [references/code-graph.md](../../references/code-graph.md)) to find the queries, mappers, repos, and models that hit the affected tables. Grep the mapper/SQL dirs only if no graph.
- **Shared tables** — if a second feature also writes a table you're altering, that's a seam. Name it.
- **Migration reality** — is this additive (safe), or does it reshape existing data (needs a backfill/migration step)? A non-null column on a populated table is a migration, not a one-liner.

## db.md format

Write to `devspec/changes/<change-id>/db.md`. Short, cited, scannable.

```markdown
# DB: add-auth

**Source**: postgres MCP (live) | file-derived (migrations) — <which>
**Dialect**: postgresql  (per conventions.md backend block)

## Tables touched
### users  (exists)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | uuid | no | gen_random_uuid() | PK |
| email | text | no | — | unique idx `users_email_key` |
| last_login | timestamptz | **add** | — | new, nullable — no backfill needed |

### sessions  (new)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | uuid | no | gen_random_uuid() | PK |
| user_id | uuid | no | — | FK → users.id, on delete cascade |
| expires_at | timestamptz | no | — | index for expiry sweep |

## Impact
- `UserRepository.findByEmail` (`repo/user.ts:8`) reads `users` — unaffected (additive)
- Billing also writes `users.updated_at` — no overlap with new cols
- **Migration**: additive only. `sessions` new, `users.last_login` nullable → no backfill.

## Open questions
- Cascade vs restrict on session FK? (proposal implies logout-all → cascade)
```

Only the rows/sections the change needs. Mark each column `exists` / `add` / `alter` / `drop` so the diff is obvious. Every impact line carries a real `path:line` or the table it names.

## Flow

1. Confirm the change id (`ls devspec/changes/` — reuse if it exists).
2. Detect the DB source (MCP live, or files). State which.
3. Read the schema for the tables the change touches; trace readers/writers via the graph.
4. Write `db.md`. Show the tables-touched grid and the migration verdict — that's what a human sanity-checks.
5. Hand off: `/devspec-capture` folds `db.md` into `design.md`/`spec.md`; `/devspec-plan` turns the migration + impact into tasks with a DB-check `verify`.

## Verify hooks for the plan

So the built change is provable, suggest these for capture's `tasks.md` (they become section `Verify:` lines, not something you run here):
- schema assertion — a query/test that the new column/table/constraint exists with the right type/nullability.
- migration runs clean — the migration applies and reverts on a scratch DB.
- no-regression — existing queries against the altered table still pass.

## Guardrails

- **Read-only.** Never run DDL, migrations, `DROP`, `ALTER`, or seed data. You describe the schema; the worker changes it.
- **Live beats files, but say which.** If you fell back to migration files, label `db.md` file-derived — don't present a possibly-stale schema as ground truth.
- **Don't design solo.** Capture the schema and the impact; the *decision* (cascade? index?) surfaces as an open question for the human, unless the proposal already settled it.
- **Fit the conventions.** Right dialect, right migration dir, existing naming. A change that ignores the backend block is drift.
- **Keep it short.** One grid per touched table, the impact lines that matter, nothing derivable from the code itself.
