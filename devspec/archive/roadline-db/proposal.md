# Proposal: roadline-db

## Why

Roadline stores the shared plan and the value mappings as JSON files in `DATA_DIR` on one server. Only the last two plans are kept, there's no record of who imported what or when, and there's nowhere to put the users and sessions that `roadline-auth` needs. The team has a PostgreSQL server (`10.0.0.85:5439`, database `postgres`, schema `roadline`, empty today) and wants Roadline's data there.

## What it delivers

- **PostgreSQL storage** in schema `roadline` for:
  - **plans**: every successful import (parsed plan, raw file, template version, time, importer once auth exists). The newest is the current plan and **the last 10 are kept**.
  - **value mappings** and **seen template versions**: replaces `mappings.json`.
  - **imports**: an **audit log** row for every import attempt, ok or not, with outcome, file name and size, problems, and the resulting plan.
- **Atomic import**: saving the plan, merging mappings, pruning history and writing the audit row happen in one transaction. A failure leaves the previous plan untouched.
- **Migrations**: plain SQL files in `migrations/`, run with `npm run db:migrate` (node-pg-migrate). Additive and forward-only.
- **One-time move of existing data**: `npm run db:import-files` copies today's `data/plan.prev.json`, `data/plan.json` and `data/mappings.json` into the empty tables.
- **Storage switch**: with `DATABASE_URL` set, the server uses Postgres. Without it, the server uses the existing JSON files, which is what the automated tests (`npm test`) use. **Tests never touch a database.**
- **Fail fast / degrade**: the server refuses to start if the database or the `roadline` schema isn't reachable. If the DB drops while running, API calls answer `503 db_unavailable` and don't crash.

No visible UI change: the screens, API shapes and import behaviour stay the same.

## Scope

**In**: `src/server/` (db pool, storage interface, Postgres and file implementations, migrate and import-files scripts), `migrations/`, `package.json` scripts and deps (`pg`, `node-pg-migrate`), README, the `.env` loading, and context-pack updates.

**Out**:
- Users, sessions and roles (in `roadline-auth`, which depends on this change).
- A dedicated DB role: the pilot runs as `postgres` by the user's decision, and the README lists the GRANTs for later.
- UI for history or the audit log (later, e.g. "what changed" between imports).
- Any `DROP`/`ALTER` of existing objects. The only data removal is the approved runtime prune of plans older than the newest 10.

## Notes

- **The user fixes `.env`**: `DATABASE_URL` currently points at database `pm_x`; the path must be `/postgres`.
- Running `npm run db:migrate` and `npm run db:import-files` against the shared DB is done **by a person** (MANUAL gate). The worker never writes to that database.
- Depends on `roadline-v2` (only so the board order stays linear; there's no code overlap). `roadline-auth` will depend on this change.
