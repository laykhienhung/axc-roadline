# DB: roadline-db

**Source**: live. Read with `psql` (read-only session) on 2026-10-01 against `10.0.0.85:5439`.
**Dialect**: PostgreSQL **17.5** (Debian). Server encoding UTF8, TimeZone `Etc/UTC`, `max_connections` 100 (8 in use).
**Conventions**: `conventions.md` has no persistence block yet (`summary.md`: "Database: none — JSON files"). This change sets the first DB conventions; see "Conventions this sets".

## What's live today

| Database | Schemas (non-system) | `roadline` schema |
|----------|----------------------|-------------------|
| `postgres` | `public`, **`roadline`** | **exists, empty**: 0 tables, types or functions. Owner `postgres` |
| `pm_x` | `public` (66 tables of another app) | **does not exist** |

- **⚠ `.env` points at the wrong database.** `DATABASE_URL` names database `pm_x`, where `roadline` doesn't exist. The schema lives in database `postgres`, so the URL path must be `/postgres` (see open questions).
- **⚠ The app would connect as `postgres`**, which is a superuser (`rolsuper`, `rolcreatedb` and `rolcreaterole` all true).
- Extensions installed: only `plpgsql`. `pgcrypto` and `citext` are available but **not installed**. On PG 17, `gen_random_uuid()` is built in, so no extension is needed. Emails use `text` plus a lower-case check instead of `citext`.

## Tables touched (all new, schema `roadline`)

### plans (new): every successfully imported plan; the newest row is the current plan
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | bigint | no | `generated always as identity` | PK |
| plan | jsonb | no | — | the parsed `Plan` (`src/shared/model.ts`), about 30–60 KB |
| file_name | text | no | — | original upload name (UTF-8) |
| file | bytea | no | — | raw upload, ≤ 5 MB (`MAX_UPLOAD_BYTES`, `app.ts:12`) |
| template_version | text | yes | — | `plan.templateVersion` |
| imported_at | timestamptz | no | `now()` | |
| imported_by | text | yes | — | email (lower-case), filled once `roadline-auth` lands |
- Index `plans_imported_at_idx (imported_at desc)`. "Current" is `order by id desc limit 1` and "previous" is offset 1. The **last 10** are kept (see Decisions 4). This replaces `plan.prev.json` + `uploads/`.

### value_mappings (new): replaces `mappings.json` `status` / `quarter` / `due`
| col | type | null | default | note |
|-----|------|------|---------|------|
| kind | text | no | — | `check (kind in ('status','quarter','due'))` |
| word | text | no | — | normalized key (`normWord`, `src/shared/resolve.ts`) |
| meaning | text | no | — | tone / quarter / due meaning, as in the JSON today |
| updated_at | timestamptz | no | `now()` | |
| updated_by | text | yes | — | email, after auth |
- PK `(kind, word)`. Merge = `insert … on conflict (kind, word) do update`, where the submitted value wins (same rule as `MappingStore.merge`, `mapping-store.ts:64`).

### template_versions (new): replaces `mappings.json` `seenVersions`
| col | type | null | default | note |
|-----|------|------|---------|------|
| version | text | no | — | PK |
| first_seen_at | timestamptz | no | `now()` | |

### imports (new): audit log, one row per `POST /api/plan` attempt
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | bigint | no | identity | PK |
| at | timestamptz | no | `now()` | index `imports_at_idx (at desc)` |
| user_email | text | yes | — | snapshot, no FK (the audit outlives users). Null until auth |
| file_name | text | yes | — | null when no file was sent |
| file_size | integer | yes | — | bytes |
| outcome | text | no | — | `check (outcome in ('ok','invalid_plan','needs_mapping','invalid_mapping','no_file','file_too_large','unsupported_type','forbidden'))`, which are the API error codes (`conventions.md` API row) |
| problems | jsonb | yes | — | `Problem[]` or `UnknownValue[]` when not ok |
| plan_id | bigint | yes | — | FK → `plans.id` `on delete set null`; set when `ok` |

### pgmigrations (new, owned by node-pg-migrate)
The tool's own bookkeeping table, created in schema `roadline` (`--migrations-schema roadline`).

## Impact

- `PlanStore` (`src/server/plan-store.ts:10`): `load()` / `save(plan, original, fileName)` are replaced by a Postgres-backed store with the **same interface**. Its only caller is `createApp` (`src/server/app.ts:23`).
- `MappingStore` (`src/server/mapping-store.ts:39`): `load()` / `merge(partial, version)` likewise; caller `app.ts:24`. `parseMappingField` (`mapping-store.ts:17`) is pure and stays.
- `importPlan` (`app.ts:47`) gains one audit insert per outcome. Today's rule "save only after `ok: true`" (`rules.md`) is unchanged; the plan insert, mapping merge and `imports` row happen **in one transaction**.
- `tests/api.test.ts` builds `createApp({ dataDir })` with temp dirs. With no network DB in unit tests, see open question 3.
- Existing data: `data/plan.json` (32 KB), `plan.prev.json` (56 KB), `mappings.json` (1 KB) and `uploads/` (188 KB) on the dev machine, and whatever is on the internal server. This needs a **one-time import script**, not a migration.
- Nothing else in `postgres` or `pm_x` is read or written; the `roadline` schema is empty, so there's no shared-table seam.

**Migration verdict**: **additive only.** The schema is empty and every table is new; no backfill, `ALTER` or `DROP`. Forward-only SQL migrations in `migrations/` (no down step).

## Conventions this sets (fold into `conventions.md` backend block)
- Driver `pg` (node-postgres) `Pool` from `DATABASE_URL`, created once in `src/server/db.ts`; `search_path` comes from the URL `options=-csearch_path=roadline`.
- Migrations are `migrations/<timestamp>_<name>.sql` (node-pg-migrate SQL format, `-- Up Migration` only), run with `npm run db:migrate`, never by the server at startup unless `DB_MIGRATE_ON_START=1`.
- Names are snake_case, plural tables, `<table>_<col>_idx` indexes, `timestamptz` for times, `jsonb` for documents, `bigint identity` PKs, lower-case emails stored as `text`.

## Decisions (user, 2026-10-01)
1. **Database `postgres`**, schema `roadline`. The user fixes `DATABASE_URL` in `.env` (path `/pm_x` → `/postgres`). The server checks at startup that schema `roadline` exists and fails fast if it doesn't (`roadline: schema "roadline" not found in database <db>`).
2. **Keep role `postgres` for now** (internal pilot). This is a known risk, recorded as a follow-up: a dedicated `roadline_app` role with rights on schema `roadline` only. The README lists the GRANTs for later.
3. **`npm test` never touches a database.** Automated tests run on the JSON-file stores (temp dirs, as today) and report in the terminal. The Postgres stores share the same interface and are checked by hand against the real DB (a MANUAL gate), plus pure unit tests of their SQL-building helpers where useful. No `TEST_DATABASE_URL`.
4. **Keep the last 10 plans.** After each successful import, in the same transaction, rows in `plans` beyond the newest 10 are removed (`delete from plans where id not in (select id from plans order by id desc limit 10)`). `imports.plan_id` is `on delete set null`, so the audit rows survive. This is a routine runtime cleanup the user approved, not a migration. The JSON-file store keeps today's behaviour (current + prev).

## Open questions
None.
