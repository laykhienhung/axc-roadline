# Conventions

> One package, three sides (`src/shared`, `src/server`, `src/client`) in one repo. No `CLAUDE.md` or `.claude/rules/` in the repo — this file is the rule-set.

## roadline — `src/`

| Area | Standard |
|------|----------|
| **Persistence** | Use `FileStorage` when `DATABASE_URL` is unset; otherwise use one `pg` `Pool` from `src/server/db.ts` and PostgreSQL schema `roadline` selected by URL `options=-csearch_path%3Droadline`. Migrations are forward-only `migrations/<timestamp>_<name>.sql` files with `-- Up Migration` only, run via `npm run db:migrate` (or `DB_MIGRATE_ON_START=1`). Database names are snake_case plural; indexes are `<table>_<col>_idx`; use `timestamptz` for times, `jsonb` for documents, `bigint identity` keys, and lower-case emails in `text`. |
| **Language** | TypeScript `strict: true` (`tsconfig.json`, `tsconfig.server.json`). No `any` in app code |
| **Naming** | Files kebab-case (`parse-axc.ts`, `import-mapping-dialog.tsx`, `use-plan.ts`); components PascalCase (`TimelineGrid`); types/interfaces PascalCase; functions camelCase; hooks `use*` in `src/client/use-*.ts` |
| **Layout** | Pure logic in `src/shared/` (no DOM, no Node APIs); HTTP, files and SheetJS only in `src/server/`; UI in `src/client/` → `pages/*-page.tsx` compose `components/*.tsx`; fetch calls only in `src/client/api.ts` |
| **Imports** | Relative paths only, no aliases. **Server + shared import with `.js` extensions** (29/29, required by NodeNext in `tsconfig.server.json`); **client imports without extensions** (0/74, Vite `Bundler` resolution). Client may import `../shared/*`; shared never imports client/server. `import type` for type-only imports |
| **Format** | `.prettierrc`: singleQuote, semi, printWidth 100, trailingComma es5. LF line endings (`.gitattributes`) |
| **Lint** | `eslint.config.js`: `js.recommended` + `typescript-eslint` recommended; unused vars warn (prefix `_` to ignore) |
| **Tests** | Vitest, `tests/**/*.test.{ts,tsx}` (`vitest.config.ts`). UI tests start with `// @vitest-environment jsdom` (`tests/import.test.tsx:1`). Parser/derived tests run against the real fixtures (`tests/helpers.ts:16` `parseFixture`); UI tests mock fetch via `tests/render.tsx:8` `mockFetch` and render with `renderApp(path)` |
| **API** | JSON under `/api`. Errors `{ error: '<snake_case_code>', problems?: Problem[] }`: 400 `invalid_plan` / `invalid_mapping` / `no_file`, 404 `no_plan` / `not_found`, 413 `file_too_large`, 415 `unsupported_type`, 422 `needs_mapping` + `unknown` (`src/server/app.ts:38-107`) |
| **UI** | No component library — plain CSS in one file `src/client/styles.css`; tokens on `:root` (`styles.css:2`). Reuse the existing classes (`.card`, `.btn`, `.btn.primary`, `.seg`, `.dot` + `.bg-<tone>`, `.fg-<tone>`, `.badge`, `.legend`, `.grid`/`.hd`/`.cell`, `.note-line`, `.dialog`). Color = status tone only, always with a legend |
| **Status display** | Show the file's word, color by tone: `<StatusDot status word>`, `<StatusLabel>`, `<StatusBadge>` (`src/client/components/status-dot.tsx:13`) — never render `STATUS_LABEL[tone]` directly for data |
| **Dates** | Calendar days are `Ymd` (no time zone, `src/shared/model.ts`); "today" comes from `useToday()` (`src/client/use-today.ts:7`), overridable with `?today=YYYY-MM-DD`; internal links keep it via `useLinkSuffix()` |
| **Commits** | `<change-id>: <summary>` + body + `Co-Authored-By` trailer (git log, e.g. `fe47079`). Local commits; pushing is manual |
