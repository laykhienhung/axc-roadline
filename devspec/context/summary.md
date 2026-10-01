# Context: roadline

**Does**: Internal web view of the AXC team's annual objectives & action plan. Anyone with the link imports the plan workbook (`.xlsx` AXC template, or a flat `.csv`); the server validates it, asks once what new words mean (status / quarter / due values) and saves those mappings, then stores the plan for everyone. The page shows a month/quarter timeline of topics per target (plus a Next-year column), a detail page per target, and an auto-ranked "next actions" list. Read-only viewer — the workbook stays the source of truth.

**Stack**: TypeScript (strict) everywhere. Client: React 19 + React Router 7, built with Vite 6. Server: Node 22 + Express 5 + multer 2 (uploads). Parsing: SheetJS `xlsx` 0.20.3 (from cdn.sheetjs.com, `package.json`). Tests: Vitest 3 + supertest + Testing Library (jsdom). Lint: ESLint 9 + typescript-eslint, Prettier.

**Structure**:
  src/shared/   plan model, fiscal calendar, AXC + CSV parsers, word resolver/suggestions, next-action ranking, progress — pure TS, used by server and client
  src/server/   Express app (API + static SPA), workbook reader (grid + dropdown lists), JSON stores for the plan and value mappings
  src/client/   React SPA: `pages/` (timeline, target), `components/`, hooks (`use-plan`, `use-today`), `api.ts`, `styles.css`
  tests/        Vitest specs (`*.test.ts` node, `*.test.tsx` jsdom), `fixtures/` (real v2.0 and v2.1 AXC workbooks), `helpers.ts`, `render.tsx`
  data/         runtime: `plan.json`, `plan.prev.json`, `mappings.json`, `uploads/` (git-ignored)
  devspec/      specs, board, archive, reports (process docs, not app code)

**Entry points**: server `src/server/index.ts:11` (`createApp(...).listen`); app factory `src/server/app.ts:20`; SPA `src/client/main.tsx:7`; routes `src/client/app.tsx:22` (`/`, `/target/:id`).

**Build/test/run** (`package.json:7`):
  - build: `npm run build` (vite → `dist/client`, tsc `tsconfig.server.json` → `dist/server` + `dist/shared`)
  - test:  `npm test` (`vitest run`)
  - lint:  `npm run lint` (eslint + prettier --check)
  - run:   `npm start` (`node dist/server/index.js`; env `PORT`=3000, `DATA_DIR`=./data, `CLIENT_DIR`)
  - dev:   `npm run dev` (tsx watch server + vite with `/api` proxy, `vite.config.ts`)

**Database**: none — plan and mappings are JSON files in `DATA_DIR`.
**Graph**: none — `code-review-graph` CLI is installed but no graph MCP was connected; the repo (~2.8k lines) was scanned directly.
**Scanned**: 2026-09-29, after `roadline-v1` (archived at `devspec/archive/roadline-v1/`).
