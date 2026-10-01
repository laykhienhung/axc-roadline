# Tasks: roadline-db

There's no UI in this change. Server and shared imports use `.js` extensions (NodeNext, `conventions.md`). **`npm test` never connects to a database**: automated checks run on `FileStorage`, and the Postgres paths are checked by a person in section 7.

## 1. Storage interface and file implementation [req-1, req-5]
- [ ] 1.1 [backend] New `src/server/storage.ts`: `Storage`, `CommitImport`, `ImportEntry`, `StorageUnavailableError` (shapes in design.md)
- [ ] 1.2 [backend] New `src/server/file-storage.ts:FileStorage(dataDir)`: `loadPlan` → `PlanStore.load`; `loadMappings` → `MappingStore.load`; `commitImport` → `PlanStore.save` then `MappingStore.merge` then audit line; `logImport` → append `{ at, ...entry }` as one JSON line to `DATA_DIR/imports.jsonl`; `close()` no-op. `PlanStore` / `MappingStore` stay unchanged
- [ ] 1.3 [backend] `src/server/app.ts:createApp`: `AppOptions.storage?: Storage` (default `new FileStorage(dataDir)`). Replace the direct `PlanStore`/`MappingStore` use (`app.ts:23-24`) with `storage`. Call `logImport` on every non-ok exit (`no_file`, `unsupported_type`, `invalid_mapping`, `invalid_plan`, `needs_mapping`, and `file_too_large` in the multer branch) and `commitImport` on ok. Map `StorageUnavailableError` → 503 `{ error: 'db_unavailable' }`
- [ ] 1.4 [test] `tests/api.test.ts`: existing cases unchanged. Add: after an ok import, `imports.jsonl` has one `ok` line with the file name; a rejected file → `invalid_plan` line with problems; a `.txt` → `unsupported_type`; a 6 MB file → `file_too_large`; a storage stub whose `logImport` throws → the original 400 is still returned; a stub whose `loadPlan` throws `StorageUnavailableError` → 503 `db_unavailable`
Verify: `npx vitest run tests/api.test.ts`

## 2. Migration [req-2]
- [ ] 2.1 [db] Write migration `migrations/1759300000000_init.sql` (`-- Up Migration` only): `plans`, `value_mappings`, `template_versions`, `imports` exactly as in `db.md` (identity PKs, `jsonb`, `bytea`, `timestamptz default now()`, checks on `kind` and `outcome`, FK `imports.plan_id → plans.id on delete set null`, indexes `plans_imported_at_idx`, `imports_at_idx`). Schema-qualify nothing; the migrate runner sets schema `roadline`
- [ ] 2.2 [backend] `npm install pg node-pg-migrate` and `npm install -D @types/pg`. New `src/server/migrate.ts`: `process.loadEnvFile()` (try/catch), require `DATABASE_URL`, then `runner({ databaseUrl, dir: 'migrations', direction: 'up', schema: 'roadline', migrationsSchema: 'roadline', migrationsTable: 'pgmigrations', checkOrder: true })`. `package.json` script `"db:migrate": "tsx src/server/migrate.ts"`
- [ ] 2.3 [test] New `tests/migration.test.ts` (node, reads the file only): contains `create table` for the 4 tables, the 2 indexes, the FK with `on delete set null`, the outcome check listing all 8 codes, and no `drop` / `truncate` (case-insensitive)
Verify: `npx vitest run tests/migration.test.ts`

## 3. Postgres storage [req-3, req-4, req-6, req-8]
- [ ] 3.1 [backend] New `src/server/db.ts`: `createPool(url)` (max 5, `connectionTimeoutMillis` 5000, `application_name` `roadline`); `checkSchema(pool)` (`select 1 from pg_namespace where nspname = 'roadline'`, else throw `schema "roadline" not found in database <db>`); `describeUrl(url)` → `<host>/<db>` with no credentials
- [ ] 3.2 [backend] New `src/server/pg-storage.ts:PgStorage(pool)`: `loadPlan` (`select plan from plans order by id desc limit 1`); `loadMappings` (rows + versions → `rowsToMappings`); `commitImport` in one client transaction: insert plan (`returning id`), upsert mappings (`on conflict (kind, word) do update`), insert version (`on conflict do nothing`), prune to 10, insert `imports` `ok` row with `plan_id`; `ROLLBACK` + rethrow as `StorageUnavailableError` on error. `logImport` inserts a row. Connection errors become `StorageUnavailableError`. Export pure `mappingsToRows` / `rowsToMappings`
- [ ] 3.3 [test] New `tests/storage.test.ts` (no DB): `rowsToMappings(mappingsToRows(V21_MAPPINGS), ['2.1'])` round trip (`tests/helpers.ts:V21_MAPPINGS`); empty input → empty mappings; `FileStorage` contract: `loadPlan` null → `commitImport` → `loadPlan` returns the plan, `loadMappings` contains the merged words + version
Verify: `npx vitest run tests/storage.test.ts`

## 4. Startup wiring [req-1]
- [ ] 4.1 [backend] `src/server/index.ts`: `try { process.loadEnvFile() } catch {}`. If `DATABASE_URL` is set: `createPool` → `checkSchema` → `new PgStorage(pool)` and log `storage: postgres <describeUrl>`; on error print `roadline: <message>`, `exit(1)`. If `DB_MIGRATE_ON_START=1`, run the same runner as `migrate.ts` first. Otherwise `FileStorage` and log `storage: files <dataDir>`. Close the pool on `SIGINT`/`SIGTERM`
- [ ] 4.2 [test] `npm run build` type-checks `index.ts`; `tests/api.test.ts` still passes with the default `FileStorage`
Verify: `npm run build && npx vitest run tests/api.test.ts`

## 5. Move existing data [req-7]
- [ ] 5.1 [backend] New `src/server/import-files.ts` (`npm run db:import-files` → `tsx src/server/import-files.ts`): load env, require `DATABASE_URL`, refuse if `select count(*) from plans` > 0 (`plans already has rows — nothing imported`, exit 1). Read `DATA_DIR` `plan.prev.json`, then `plan.json`, each via `PgStorage.commitImport` with the raw file matched from `uploads/` by `importedAt` stamp (else empty buffer + warning) and `userEmail: null`. Then mappings from `mappings.json`. Print `imported <n> plans, <m> mappings, <v> versions`
- [ ] 5.2 [test] Unit-test the pure helper `matchUpload(files, importedAt, fileName)` in `tests/storage.test.ts` (stamp format as `PlanStore.write`, `plan-store.ts:42`)
Verify: `npx vitest run tests/storage.test.ts`

## 6. Docs and context pack [req-1, req-2]
- [ ] 6.1 [backend] `README.md`: a "Database" section with `DATABASE_URL` (format with `?options=-csearch_path%3Droadline`; database `postgres`), `npm run db:migrate`, `npm run db:import-files`, `DB_MIGRATE_ON_START`, the storage switch (unset → files, used by tests), last-10 history, the audit log, and "pilot runs as `postgres`; later create a `roadline_app` role" with the GRANT statements. Add `DATABASE_URL=` to `.env.example`. Make sure `.env` is in `.gitignore` (it already is, line 6)
- [ ] 6.2 [backend] `devspec/context/summary.md` **Database** → PostgreSQL 17 schema `roadline` (files fallback). `conventions.md`: add the persistence conventions from `db.md`. `rules.md`: no `DROP` in migrations, tests never touch the DB, never log `DATABASE_URL`
- [ ] 6.3 [test] Full check
Verify: `npm run lint && npm test && npm run build`

## 7. Apply on the real database [req-2, req-3, req-6, req-7, req-8]
- [ ] 7.1 MANUAL: the user fixes `.env` (`DATABASE_URL` path `/postgres`), runs `npm run db:migrate` (tables created; a second run reports no migrations) and `npm run db:import-files` (2 plans, mappings imported)
- [ ] 7.2 MANUAL: with `npm run dev` on Postgres: the timeline shows the imported plan; importing the v2.1 fixture with the mapping dialog works and `select outcome from roadline.imports order by id` shows the attempts; 11 imports leave 10 rows in `roadline.plans`; stopping DB access → `/api/plan` 503 `db_unavailable` and the server keeps running
Verify: MANUAL: user confirms 7.1 and 7.2 against `postgres.roadline`
