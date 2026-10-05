# Spec: roadline-db

### Requirement: storage selection and startup [req-1]
The server SHALL use PostgreSQL when `DATABASE_URL` is set and the JSON files otherwise, and SHALL refuse to start when the configured database isn't usable.

#### Scenario: no DATABASE_URL
- **WHEN** the server starts without `DATABASE_URL`
- **THEN** it uses `FileStorage(DATA_DIR)` and behaves exactly as today

#### Scenario: database usable
- **WHEN** `DATABASE_URL` points at a database where schema `roadline` exists
- **THEN** the server logs `storage: postgres <host>/<db>` (no credentials) and uses `PgStorage`

#### Scenario: database not usable
- **WHEN** the DB is unreachable or schema `roadline` doesn't exist
- **THEN** the process prints `roadline: <reason>` and exits with code 1

### Requirement: schema migration [req-2]
The repo SHALL contain one forward-only SQL migration that creates `plans`, `value_mappings`, `template_versions` and `imports` in schema `roadline` as listed in `db.md`, runnable with `npm run db:migrate`.

#### Scenario: migration content
- **WHEN** `migrations/1759300000000_init.sql` is read
- **THEN** it creates the four tables with the columns, checks, PKs, FK (`imports.plan_id → plans.id on delete set null`) and indexes from `db.md`, and contains no `DROP`, `TRUNCATE` or `ALTER … DROP`

#### Scenario: applied to the database
- **WHEN** a person runs `npm run db:migrate` against `postgres` / schema `roadline`
- **THEN** the four tables and `pgmigrations` exist in `roadline`, and a second run reports nothing to migrate

### Requirement: plans in Postgres, last 10 kept [req-3]
`PgStorage` SHALL serve the newest plan row as the current plan and SHALL keep only the newest 10 plans.

#### Scenario: load
- **WHEN** `plans` is empty
- **THEN** `loadPlan()` returns null (API 404 `no_plan`)
- **WHEN** plans exist
- **THEN** `loadPlan()` returns the `plan` of the row with the highest id

#### Scenario: prune
- **WHEN** an 11th plan is imported
- **THEN** `plans` holds the newest 10 rows, and audit rows of the removed plan keep `plan_id = null`

### Requirement: value mappings in Postgres [req-4]
`PgStorage` SHALL load and merge mappings with the same result as `MappingStore`: submitted words win, and template versions are remembered.

#### Scenario: round trip
- **WHEN** mappings `{status:{'in progress':'on_track'}, quarter:{'fy27-28':'next_year'}, due:{}}` and version `2.1` are merged
- **THEN** `loadMappings()` returns them with `seenVersions` containing `2.1`, and `rowsToMappings(mappingsToRows(m), ['2.1'])` deep-equals `m` + versions

#### Scenario: submitted wins
- **WHEN** a saved `status.blocked = behind` is merged with a submitted `status.blocked = at_risk`
- **THEN** the loaded meaning is `at_risk`

### Requirement: import audit log [req-5]
The server SHALL record every `POST /api/plan` attempt with its outcome.

#### Scenario: each outcome
- **WHEN** an import ends `ok`, `invalid_plan`, `needs_mapping`, `invalid_mapping`, `no_file`, `file_too_large` or `unsupported_type`
- **THEN** one audit entry is stored with that outcome, file name, size and problems (when not ok), and for `ok` the id of the new plan (Postgres) or the import time (files)

#### Scenario: audit failure doesn't block
- **WHEN** writing a non-ok audit entry throws
- **THEN** the client still gets the original error response

### Requirement: atomic import [req-6]
A successful import SHALL save the plan, merge mappings, prune and write the `ok` audit row all-or-nothing.

#### Scenario: failure mid-commit
- **WHEN** any statement inside `commitImport` fails
- **THEN** the transaction is rolled back, the previous plan is still served, mappings are unchanged, and the API answers 503 `db_unavailable`

### Requirement: move existing file data [req-7]
`npm run db:import-files` SHALL copy the existing JSON data into empty Postgres tables once.

#### Scenario: first run
- **WHEN** `plans` is empty and `DATA_DIR` has `plan.prev.json`, `plan.json` and `mappings.json`
- **THEN** two plan rows are inserted (prev first, so `plan.json` becomes current), mappings and versions are inserted, and the script prints counts

#### Scenario: second run
- **WHEN** `plans` already has rows
- **THEN** it prints `plans already has rows — nothing imported` and exits 1 without writing

### Requirement: database outage while running [req-8]
The API SHALL answer `503 { error: 'db_unavailable' }` instead of crashing when the database fails during a request.

#### Scenario: DB down
- **WHEN** `storage.loadPlan()` throws `StorageUnavailableError`
- **THEN** `GET /api/plan` returns 503 `{ error: 'db_unavailable' }` and the server keeps running
