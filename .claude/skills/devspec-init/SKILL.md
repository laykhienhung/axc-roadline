---
name: devspec-init
description: Scan the codebase once and write a stable context pack (stack, structure, conventions, patterns, rules) that every other DevSpec skill reads instead of re-deriving. Use once per repo, or to refresh after big changes.
license: MIT
compatibility: File-based, no CLI required. Optional code graph (code-review-graph or gitnexus MCP) for faster, lower-token scanning; falls back to grep/read when absent. Optional DB MCP (postgres/mysql/supabase) to snapshot schema conventions; falls back to migration/DDL files, or skips when there's no DB.
metadata:
  author: devspec
  version: "1.0"
---

Enter init mode. Scan the repo once and write down what it *is* — the shared ground truth for explore, capture, plan, and worker.

**IMPORTANT: Init mode is for describing, not changing.** You may read files, run the graph, and inspect config, but you must NEVER write application code, refactor, or dress an opinion up as an observed fact. Init reports reality. The output is a context pack under `devspec/context/` that downstream skills read instead of re-deriving the same conventions on every change.

If `devspec/improve/` already exists, read it before writing the pack — it holds human-agreed conventions and decisions that aren't in code. Your `context/` pack must not contradict them; where the code suggests one thing and `improve/` records a deliberate human choice, describe the code reality and note the `improve/` decision rather than overwriting it. Init never writes `improve/`.

**This is a scan, not a survey.** Facts come from the code — manifests, CI, routes, git log — not from the user. Ask only what the code genuinely can't tell you. Run init once per repo; re-run to refresh when the codebase drifts from what's written.

---

## The Stance

- **Detect, don't ask** - Stack, structure, build/test/run cmds, FE-vs-BE scope are all in the code. Read them, state them. A question about an observable is a bug.
- **Describe, don't prescribe** - Report the conventions that exist, not the ones you wish existed. Inconsistent codebase? Say so — don't crown a winner silently.
- **Evidence or it didn't happen** - Every claim traces to a `path:line`, a config entry, or a git-log line. No inference presented as fact.
- **Short beats complete** - Skimmable files that get read beat an exhaustive doc that doesn't. Cut anything derivable from the code itself.
- **Snapshot, not changelog** - Re-running overwrites the pack to match current reality. It records what is, not what changed.

---

## Empty / greenfield repo

Before scanning, check there's something to describe. If the repo is only scaffolding — `.git`, README, LICENSE, `.gitignore`, empty config — **don't run the observed scan and don't fabricate a summary.** Init describes what exists; on a fresh repo nothing does. Branch:

- **Stack decided** (user says so, or a manifest with deps but no code yet) - Write the pack as a **charter**: intended stack + conventions, every file opening with `> Greenfield: intended, not yet built. Refresh after first real code.` Targets, not observations — downstream must not read them as facts.
- **Stack undecided** - Don't guess. Point the user at `/devspec-explore` to decide stack and shape first, then re-run `/devspec-init` once there's a decision or first code to ground it. Say that, and stop.

Re-running after real code lands replaces the charter with an observed pack.

---

## Scan with the graph first

Use the code graph for structure/flows/hotspots — see [references/code-graph.md](../../references/code-graph.md) (build it first if none exists).

Fall back to Grep/Glob/Read only for what the graph doesn't cover — config, CI, lint rules, READMEs. Read manifests directly: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, lockfiles, `.eslintrc`/`ruff.toml`, CI yaml, `Makefile`, existing `CLAUDE.md`/`AGENTS.md`. Note which graph you used (or none) — it lands in `summary.md`.

---

## Scan the DB for conventions (if there is one)

**Read-only. Never run DDL, migrations, `DROP`, `ALTER`, or seed data** — same stance as `/devspec-db-design`, but repo-wide instead of per-change. Init records the schema's *conventions* so downstream skills stop re-deriving them; the per-change reader (`db.md`) still handles the tables a specific change touches.

Detect the source, list it in `summary.md`:

- **postgres / mysql / supabase / other SQL MCP** → list tables; sample naming, PK/FK, index, and column-type conventions across them. You want the *pattern*, not a full dump — read enough tables to state the rule and flag exceptions, not every column of every table.
- **No DB MCP reachable** → fall back to repo DDL: migration files (Flyway `V*__*.sql`, Alembic, Prisma schema, `schema.sql`), model/entity classes. Label `schema.md` file-derived — it may lag prod.
- **No DB at all** (no MCP, no DDL, no ORM models) → skip `schema.md` entirely. Don't fabricate one.

Extract only conventions that generalize across tables:
- **Naming** — table case (snake/singular/plural, prefixes), column case, PK column name, FK naming, timestamp columns (`created_at`/`updated_at`), soft-delete column.
- **Keys** — PK type (serial/uuid/bigint), FK on-delete default, composite-key usage.
- **Indexes** — naming pattern, what's routinely indexed (FKs, lookup columns, unique constraints).
- **Types** — money/decimal, enum-vs-lookup-table, timestamp type (`timestamptz` vs `timestamp`), JSON columns.

State the dominant rule *and* the exceptions — an inconsistent schema is a fact to report, not a winner to crown.

---

## What to write

Up to five files under `devspec/context/`. Each short. Downstream reads only what it needs.

| File | Holds |
|------|-------|
| `summary.md` | 1-page orientation: what the project does, stack, top-level structure, entry points, build/test/run. The "read me first" file. |
| `conventions.md` | **The standards a contributor must follow** — naming, layout, imports, style, tests, plus API standards (if the repo has an API) and frontend standards (if it has a UI). Written as concrete "do X" rules, not vague notes. |
| `patterns.md` | Recurring solutions in *this* codebase — error handling, data access, DI, state, component/endpoint shape. A real `path:line` per pattern so it's copyable. |
| `rules.md` | Hard constraints for anyone editing: what not to touch, pre-merge checks, security/perf non-negotiables, gotchas. |
| `schema.md` | **Only if the repo has a DB.** Schema-wide conventions — table/column naming, PK/FK, index, timestamp, and type patterns — so DB-affecting changes fit without re-deriving. Snapshot of conventions, not a per-change table dump. Skip the file when there's no DB. |

**conventions.md is the rule-set — one block per codebase.** A single-package repo gets one block; a monorepo gets one per app (frontend / backend / …), because rules differ per side. Within a block, group the standards (naming, layout, imports, format/lint, tests, plus API or UI specifics as they apply). Each rule is specific enough to follow blind and carries a real `path:line` or config file.

**Index existing rule files, don't duplicate them.** If a package already ships its own `CLAUDE.md` or `.claude/rules/`, those are authoritative — conventions.md links to them and summarizes, it doesn't restate them line-for-line. Detect them per package (`<pkg>/CLAUDE.md`, `<pkg>/.claude/rules/`) and cite them at the top of that side's block.

---

## File shapes

`summary.md`
```markdown
# Context: <repo name>

**Does**: <one paragraph — the product/purpose>
**Stack**: <langs, frameworks, key deps>
**Structure**:
  src/…      <what lives here>
  tests/…    <what lives here>
**Entry points**: <cli / server main / lib exports> (path:line)
**Build/test/run**:
  - build:  `<cmd>`
  - test:   `<cmd>`
  - run:    `<cmd>`
**Graph**: code-review-graph | gitnexus | none — <so downstream knows>
```

`conventions.md` — the rule-set, one `##` block per codebase. Each rule is a standard you could hand a new dev, with a real `path:line` or config file. Below is the shape, filled with a real monorepo so you can see the density expected:

```markdown
# Conventions

> Monorepo, two codebases — rules differ per side. Each side's own `CLAUDE.md` + `.claude/rules/` are authoritative; this file indexes and summarizes them.

## Frontend — `caris_upgrade/`
**Authoritative**: `caris_upgrade/CLAUDE.md`, `caris_upgrade/.claude/rules/`

| Area | Standard |
|------|----------|
| **Naming** | Files kebab-case (`pages/lane-code.tsx`, `pages/warehouse/shipping-instruction.tsx`); components PascalCase |
| **Layout** | Domain foldering — tab UIs `src/tab-contents/<domain>/`, React Query hooks `src/hooks/api/`, raw Axios `src/lib/api/`, Zustand stores `src/store/use*Store.ts` |
| **Imports** | Path aliases `@/*`→`src/*` (`@/components`, `@/hooks`, `@/lib`, `@/store`, `@/tab-contents`); inline `import type` enforced |
| **Format** | `.prettierrc`: semi, singleQuote, trailingComma=es5, printWidth=100, arrowParens=always |
| **Lint** | `eslint.config.mts`: unused-vars warn (prefix `_` to ignore), `any` warn, non-null warn, exhaustive-deps warn. React 19 (no import-in-scope) |
| **Tests** | vitest (`vitest.config.ts`); `pnpm test`=`vitest run --passWithNoTests`. Storybook for components (`stories/`, `.storybook/`) |
| **I18n** | `pnpm i18n:bundle` (predev/prebuild hook) from `locales/` |

## Backend — `caris_upgrade_be/`
**Authoritative**: `caris_upgrade_be/CLAUDE.md`, `caris_upgrade_be/.claude/rules/`

| Area | Standard |
|------|----------|
| **Naming** | Java standard — classes PascalCase, package `com.clt.caris.<module>`; controllers `*Controller`, DTOs `*Request`/`*Response` |
| **Layout** | Hexagonal per module — `adapter/input/rest/controller` (in), `adapter/output` (out), `application/{service,port,dto,mapper}`, `domain/{model,enums,exception}`, `infrastructure/`. Shared infra in `core/` |
| **Persistence** | MyBatis XML mappers `resources/mappers/<db>/<module>/`, one folder per dialect (mssql/postgresql/mysql). MSSQL primary; a mapper must exist per tenant DB type in use |
| **Migrations** | Flyway `resources/db/migration/{mssql,postgresql}/`, versioned `V<n>__*.sql` |
| **Tests** | JUnit Platform + spring-modulith-starter-test + mybatis-spring-boot-starter-test; `./gradlew test --tests "*Name"` for one class. No checkstyle/lint plugin |
| **Commits** | No git repo at monorepo root — style not observable |
```

The table gives each side a scannable grid instead of a wall of bullets. Include only the rows that apply (a lib without an API skips persistence/migrations). State the dominant rule AND flag exceptions — don't paper over drift. When something isn't observable (like commits above), say so; don't invent it.

`patterns.md` — the copyable how, one `path:line` per pattern so a worker can open it and mirror it.
```markdown
# Patterns

## error handling
<throw typed AppError → caught in error middleware → mapped to the error envelope>  — e.g. `src/middleware/error.ts:20`

## data access
<repository per aggregate; no raw SQL in handlers; tx via <helper>>  — e.g. `src/repos/user.ts:8`

## component composition   ← if UI
<container fetches, presentational renders; compose via children not config>  — e.g. `src/features/UserList.tsx:14`
```

`rules.md`
```markdown
# Rules

- Don't touch: <generated files, vendored dirs, migrations>
- Before merge: `<lint>` && `<test>` must pass
- Security: <auth boundary, secrets handling>
- Gotchas: <the thing that breaks in non-obvious ways>
```

`schema.md` — DB conventions only (skip the file if there's no DB). Rules that generalize across tables, each grounded in real table/column names.
```markdown
# Schema conventions

**Source**: postgres MCP (live) | file-derived (migrations) — <which>
**Dialect**: postgresql   **Tables**: <count>

| Area | Convention | Example |
|------|-----------|---------|
| **Table naming** | snake_case, plural | `users`, `order_items` |
| **Column naming** | snake_case | `created_at`, `user_id` |
| **PK** | `id` bigserial | every table; UUID exception: `sessions.id` |
| **FK** | `<table_singular>_id`, on delete restrict | `order_items.order_id → orders.id` |
| **Timestamps** | `created_at`/`updated_at` timestamptz, non-null | present on all but `audit_log` |
| **Soft delete** | `deleted_at` timestamptz nullable | `users`, `products` — hard delete elsewhere |
| **Indexes** | `idx_<table>_<col>`; FKs + lookup cols indexed | `idx_orders_user_id` |
| **Enums** | lookup table, not pg enum | `order_status` table |
| **Money** | `numeric(12,2)` | `orders.total` |

## Exceptions / drift
- `legacy_import` table is camelCase — pre-convention, don't mirror it.
```

Fill only the rows the schema actually shows; name the real drift instead of hiding it.

---

## Flow

There's a loose order, but it's a scan, not a ceremony:

1. **Graph** - Detect or build it. Record which (or none) for `summary.md`.
2. **Gather** - Manifests, CI, lint config, `git log --oneline -20` for commit style. Per package, detect an existing `<pkg>/CLAUDE.md` and `<pkg>/.claude/rules/` — cite them as authoritative, don't restate them. Graph queries for structure/flows/hotspots; grep/read for the rest.
3. **Draft `summary.md`, confirm one thing** - Stack, structure, cmds you *state* (they're facts). The only line worth confirming is the **"Does" prose** — the product's purpose, which code doesn't say. Confirm it, move on.
4. **Detect codebases** - One package → one block in `conventions.md`. Monorepo → one block per app (frontend/backend/…), rules per side. You scanned the layout; never ask "which side."
5. **Scan the DB** - If a DB MCP is connected (or DDL exists), read the schema **read-only** and extract cross-table conventions into `schema.md`. No DB → skip the file.
6. **Write the rest** - Fill `conventions.md` (a block per codebase, as a scannable table), `patterns.md`, `rules.md`, and `schema.md` (if there's a DB). Every rule is specific enough to follow blind, grounded in a real `path:line`, config file, or table/column name.
7. **Hand off** - Point at `/devspec-explore` (to think) or `/devspec-capture` (to write a change) — both now read `devspec/context/`.

---

## Guardrails

- **Don't ask what you can scan** - Stack, structure, build cmds, how many codebases come from the layout. Ask only the purpose prose, or a greenfield stack that isn't decided.
- **Don't restate existing rule files** - A package's own `CLAUDE.md`/`.claude/rules/` is authoritative; cite and summarize, don't copy it into conventions.md.
- **Don't prescribe** - Report conventions that exist. Inconsistent? Name the drift, don't pick a winner.
- **Don't infer as fact** - Every claim carries a `path:line`, config entry, or git-log line, or it doesn't ship.
- **Don't fabricate** - Empty repo with no decision → redirect to explore, don't invent a stack.
- **Don't write code** - Context pack only.
- **DB is read-only** - Read the schema for `schema.md`; never run DDL, migrations, `DROP`, `ALTER`, or seed data. No DB → no `schema.md`, don't invent one.
- **Do keep it short** - Files that get read beat files that are complete.
- **Do refresh in place** - Re-running overwrites to match current reality; it's a snapshot, not a log.
