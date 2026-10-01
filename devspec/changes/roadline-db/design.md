# Design: roadline-db

Schema, live facts and decisions are in `db.md` (live read on 2026-10-01). This file covers the code shape.

## Architecture

```
index.ts ── process.loadEnvFile() (if .env exists)
   ├─ DATABASE_URL set ─▶ db.ts createPool ─▶ checkSchema (schema "roadline" exists?) ─▶ PgStorage
   └─ unset ───────────▶ FileStorage(dataDir)  (PlanStore + MappingStore + imports.jsonl)
createApp({ storage }) ─▶ GET  /api/plan ─▶ storage.loadPlan()                 ─▶ 503 db_unavailable on DB error
                       └▶ POST /api/plan ─▶ parse … ─▶ storage.commitImport()  ─▶ BEGIN
                                                                                 insert plans
                                                                                 upsert value_mappings, template_versions
                                                                                 prune plans > 10
                                                                                 insert imports (ok, plan_id)
                                                                                 COMMIT
                                         └─ any non-ok outcome ─▶ storage.logImport({ outcome, problems… })
npm run db:migrate      ─▶ src/server/migrate.ts ─▶ node-pg-migrate runner (dir migrations/, schema roadline)
npm run db:import-files ─▶ src/server/import-files.ts ─▶ reads DATA_DIR JSON ─▶ PgStorage (refuses if plans not empty)
```

## Data shapes

```ts
// src/server/storage.ts
export interface ImportEntry {
  userEmail: string | null;              // null until roadline-auth
  fileName: string | null; fileSize: number | null;
  outcome: 'ok' | 'invalid_plan' | 'needs_mapping' | 'invalid_mapping' | 'no_file'
         | 'file_too_large' | 'unsupported_type' | 'forbidden';
  problems?: unknown;                    // Problem[] | UnknownValue[]
}
export interface CommitImport {
  plan: Plan; file: Buffer; fileName: string;
  submitted: Mappings;                   // merged over saved, submitted wins
  templateVersion: string | null;
  userEmail: string | null;
}
export interface Storage {
  loadPlan(): Promise<Plan | null>;
  loadMappings(): Promise<Mappings>;
  commitImport(c: CommitImport): Promise<void>;   // atomic: plan + mappings + prune + audit(ok)
  logImport(e: ImportEntry): Promise<void>;        // non-ok outcomes
  close(): Promise<void>;
}
export class StorageUnavailableError extends Error {}  // thrown by PgStorage on connection errors
```

- `FileStorage` (`src/server/file-storage.ts`) wraps the existing `PlanStore` and `MappingStore` without changing their behaviour, and appends audit entries as JSON lines to `DATA_DIR/imports.jsonl`.
- `PgStorage` (`src/server/pg-storage.ts`) takes a `pg.Pool`. Pure helpers sit in the same file and are exported for unit tests: `mappingsToRows(m)` → `{kind, word, meaning}[]` and `rowsToMappings(rows, versions)` → `Mappings`.
- `db.ts`: `createPool(url)` (`max: 5`, `connectionTimeoutMillis: 5000`, `application_name: 'roadline'`) and `checkSchema(pool)` → throws `schema "roadline" not found in database <db>`.

## Decisions

- **One `Storage` interface and two implementations.** Tests keep using files (user decision 3), and the Postgres code mirrors the same contract. `createApp({ dataDir, storage? })`: when `storage` is omitted it is `new FileStorage(dataDir)`, so the existing tests and their `createApp({ dataDir, clientDir })` calls keep working unchanged.
- **The transaction lives in the store**, not in `app.ts`. `commitImport` does BEGIN…COMMIT on one pooled client and ROLLBACK on any error. `FileStorage.commitImport` keeps today's order (plan, then mappings, then audit line).
- **Mappings merge** = `insert … on conflict (kind, word) do update set meaning = excluded.meaning, updated_at = now()`. Versions use `insert … on conflict do nothing`.
- **Prune** = after inserting the plan: `delete from plans where id not in (select id from plans order by id desc limit 10)`. This is approved runtime cleanup (`db.md` Decisions 4).
- **Migrations aren't run by the server** at startup, except when `DB_MIGRATE_ON_START=1`. A person runs `npm run db:migrate`.
- **`.env` loading**: `process.loadEnvFile()` (Node ≥ 21.7, the repo uses 22) in `index.ts`, `migrate.ts` and `import-files.ts`, wrapped in try/catch for when the file is missing. No `dotenv` dependency.
- **Driver `pg` + `node-pg-migrate`**: small and explicit, no ORM (proposal). `@types/pg` is a dev dependency.

### Rejected
- **An ORM (Prisma/Drizzle)**: more tooling than four tables need, and the user picked plain SQL.
- **Tests against a temporary PG schema**: the user doesn't want `npm test` to touch a DB.
- **Keeping `plan.prev.json` semantics in Postgres**: history rows supersede it.

## Impact Area

### Decision Defaults

| Gray area | Default decision | Fallback if default doesn't fit |
|-----------|------------------|---------------------------------|
| `DATABASE_URL` set but DB unreachable or schema missing at startup | print `roadline: <message>` and exit 1 | — |
| DB error while running (`GET`/`POST /api/plan`) | 503 `{ error: 'db_unavailable' }`, log the error without the URL. Plan unchanged | — |
| Audit insert fails for a non-ok outcome | log it, still return the original response (audit must not block the user) | — |
| Audit for 413 (multer limit) | `logImport({ outcome: 'file_too_large', fileName, fileSize: null })` in the multer error branch (`app.ts:35`) | — |
| `user_email` before auth | `null` | — |
| Migration file name | `migrations/1759300000000_init.sql`, header `-- Up Migration` only (no down) | — |
| `db:import-files` when `plans` isn't empty | refuse: `plans already has rows — nothing imported`, exit 1 | — |
| `db:import-files` raw file for an old plan | match `uploads/<stamp>-<name>` by `importedAt` stamp, else an empty `bytea` (`'\x'`) and a warning | — |
| Order of old plans | `plan.prev.json` first, then `plan.json` (so `plan.json` is the current one) | — |
| Pool size | 5 | — |
| Logging secrets | never log `DATABASE_URL`. Log host/db only via `new URL(...).host` + pathname | — |
| `jsonb` vs model drift | store `Plan` as-is. No schema version column (the plan already has `templateVersion`) | — |

### Blast Radius
- `migrations/1759300000000_init.sql` (new): safe/reversible (additive, forward-only; applied by a person)
- `src/server/storage.ts`, `file-storage.ts`, `pg-storage.ts`, `db.ts`, `migrate.ts`, `import-files.ts` (new): safe/reversible
- `src/server/app.ts` (`AppOptions.storage`, audit calls, 503): safe/reversible
- `src/server/index.ts` (env load, storage choice, fail fast): safe/reversible
- `src/server/plan-store.ts`, `mapping-store.ts`: unchanged, wrapped
- `package.json` (+ `pg`, `node-pg-migrate`, `@types/pg`; scripts `db:migrate`, `db:import-files`): safe/reversible
- `tests/storage.test.ts` (new), `tests/api.test.ts` (+ audit cases on FileStorage): safe/reversible
- Shared DB `postgres.roadline`: **external side effect**, so migrate and import are MANUAL (a person runs them)
- Runtime prune of `plans` beyond 10: risky/irreversible for the old rows, pre-approved by the user
