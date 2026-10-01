---
name: devspec-capture
description: Capture a discussion into DevSpec artifacts (proposal, design, spec with layer-tagged tasks, optional ui), render a self-contained spec.html for browser review, and on approval auto-run /devspec-plan. Use after exploring, when the user is ready to write down what a change should be.
license: MIT
compatibility: File-based, no CLI required. Renders a self-contained spec.html the user opens in a browser. Optional code graph (code-review-graph or gitnexus MCP) to resolve concrete symbol names; falls back to grep/read when absent. Optional archify skill for the architecture diagram; falls back to ASCII.
metadata:
  author: devspec
  version: "1.0"
---

Capture the current thinking into files a worker can later execute from. **You write markdown only — no application code.**

**Speak caveman in chat, write artifacts normal.** Apply the `devspec-caveman` skill's style (level `full`) to your conversation here — terse confirmations, questions, summaries. But the artifacts you write (`proposal.md`, `design.md`, `spec.md`, `tasks.md`, `spec.html`) are persisted docs a reviewer reads → **normal English, never caveman**. User says "stop caveman" / "normal mode" → revert chat for the session.

**Ground before you capture.** If the change touches the database, run `/devspec-db-design` first — it reads the live schema and writes `db.md` you fold into `design.md`/`spec.md`, so you spec real columns, not guessed ones.

**UI change → `/devspec-ui-mockup` is mandatory, no exceptions.** *Any* front-end work needs an approved mockup + `ui.md` before you capture — a new page, an adjusted page, or a small tweak like adding/removing a button, moving an element, changing a state. If the change alters what a user sees, run `/devspec-ui-mockup` first; it turns reference images + existing patterns into an HTML mockup the user signs off, so you capture a shape that's already approved instead of one the worker guesses. Do not write `spec.md`/`tasks.md` for a FE change until `ui.md` exists. The only skip is a change with **zero** visible UI effect (pure backend/DB/config).

Both write to `devspec/changes/<change-id>/`.

**Init is mandatory — always run it first.** Before writing anything, check `devspec/context/`. Missing (init never ran)? **Run `/devspec-init` now** — not optional. The spec/design you write must fit the codebase's real conventions, patterns, and schema; without the pack you'd guess them. Only after init completes do you capture. (Greenfield repo with nothing to scan → init says so, then proceed.)

If `devspec/context/` exists (from `/devspec-init`), read the pack before writing: `summary.md` for orientation, `conventions.md` for the affected side's standards, `patterns.md` for how this codebase already solves the problem, `rules.md` for hard constraints. The `design.md` and `spec.md` you write must fit these — cite the convention or pattern each requirement follows, and if a requirement can't fit an existing rule, flag it in `design.md` (rejected-approach or open-question), don't quietly break the standard. A spec that ignores the project's own conventions is drift the worker will inherit.

If `devspec/improve/` exists, read it alongside the pack — `decisions.md`/`conventions.md` so the spec reflects settled choices, `testing.md`/`gotchas.md` for test accounts and traps a subtask may need to name. And when the discussion surfaces a *new* reusable fact, offer once to save it — "reusable — save to `improve/<file>.md`?" — and on confirm invoke `devspec-improve`'s capture. Write nothing without confirmation. On conflict `improve/` (human decision) wins over `context/`; flag it rather than silently overriding.

## Check the board first

**The board is shared memory across capture sessions.** Each change is captured in its own session, minutes or days apart; `devspec/changes/tasks.yml` is the one file that outlives them. So a new session starts blind to what earlier ones spec'd — reading the board is how it finds out. Skip this and you re-spec a table/API an earlier `pending` change already owns, and the clash only surfaces when the worker runs both. Read it first, every session.

Before writing a new change, read `devspec/changes/tasks.yml` and skim any change touching the same area — especially ones still `pending`/`doing` (captured but not built, so nothing about them is in the code yet). Two changes captured in separate sessions that need each other's *data* aren't a dep unless one needs the other's *built output*: if they only share a data shape, write that shape into both specs and keep both `depends_on: []` so they run in parallel; only a change that needs another's running code/migrated table gets `depends_on`. Open that change's `spec.md` + `tasks.md` and decide:

- **Already covered** — the new work is a subtask/req of a pending change → don't make a new change; note it belongs there and let the user extend that `tasks.md`/`spec.md`.
- **Depends on it** — new change needs the pending one's output → capture it as its own change, and tell the user to set `depends_on: [<that-change>]` at plan time.
- **Overlaps** — both touch the same files/reqs but neither contains the other → flag the conflict to the user; don't silently spec a duplicate.

Example: capturing `forgot-password` while `add-auth` is pending — if `add-auth`'s `tasks.md` already has a reset-token section, `forgot-password` folds in or depends on it, it doesn't restate token logic. The board is the only record of unbuilt work; a duplicate here becomes two changes editing the same code.

## Where

Everything lives under `devspec/changes/<change-id>/`. Pick a short kebab id from the intent (`add-auth`, `fix-upload-race`). Create the dir if missing.

## Artifacts

Write only what the change needs. Not every change has UI.

| File | When | Holds |
|------|------|-------|
| `proposal.md` | always | Why this change, what it delivers, scope in/out. BA reviews this first. |
| `design.md` | non-trivial | Architecture decisions, chosen approach + rejected ones, data shapes, integration points. Include a short **`## Architecture`** block (components + flow) — `spec.html` draws it — and an **`## Impact Area`** block (Decision Defaults + Blast Radius + risk tags per [references/impact-area.md](../../references/impact-area.md)) — this is what lets the worker decide instead of stall. |
| `spec.md` | always | Behavior contract as requirements + scenarios (OpenSpec format). Each scenario is testable. This is what verify checks map to. |
| `tasks.md` | always | The change's subtask breakdown as an OpenSpec checklist, keyed to spec reqs. The worker walks this and ticks boxes. |
| `db.md` | DB work | Live schema of touched tables, impact, migration verdict. Written by `/devspec-db-design`. |
| `ui.md` | UI work | Screens, layout (ASCII sketch), states (empty/loading/error), components, interactions. Written by `/devspec-ui-mockup` (with approved HTML mockups). |

## spec.md format

OpenSpec shape: `### Requirement:` (SHALL statement) → one or more `#### Scenario:` (WHEN/THEN). Each requirement carries a stable `[req-N]` tag on its heading so `tasks.yml` and verify steps can reference it — the tag is the handle, the name is for humans.

```markdown
# Spec: add-auth

### Requirement: token validation [req-1]
The API SHALL reject expired tokens and accept valid ones.

#### Scenario: expired token
- **WHEN** a request carries an expired token
- **THEN** the API returns 401

#### Scenario: valid token
- **WHEN** a request carries a valid token
- **THEN** the request proceeds

### Requirement: login rate limit [req-2]
The API SHALL throttle repeated failed logins.

#### Scenario: too many failures
- **WHEN** 5 logins fail within 60s
- **THEN** further attempts return 429
```

One requirement = one SHALL statement. Every requirement has ≥1 scenario; a requirement with no scenario isn't testable yet. A verify command maps to a scenario's WHEN/THEN.

## tasks.md format

OpenSpec shape: `##`-numbered sections, each a coherent unit of work tagged with the spec req(s) it delivers; `- [ ]` checkbox subtasks under it. The subtasks are the change's real work breakdown — this is what the user reviews and what the worker walks top-to-bottom, ticking `[ ]` → `[x]` as it goes. The board (`tasks.yml`) tracks the *change*; `tasks.md` tracks *within* it.

**Tag every subtask with its layer and name the concrete artifact.** The reviewer reads `spec.html` before agents run unattended — their only chance to spot a missing endpoint, class, or screen. A vague subtask ("add a button", "handle auth") hides the gap; a specific one surfaces it. So each subtask carries a **layer tag** — `[backend]` `[service]` `[frontend]` `[db]` `[test]`, use only the layers this change's scope touches — and **names the real thing to create or adjust**: the class/file, the endpoint path + method, the request/response shape, the logic, or the existing component to reuse. Resolve names against the code graph first (existing symbols, `conventions.md`), so you write `AuthMiddleware` / `POST /login` / `src/ui/button.tsx:Button`, not a placeholder the worker has to invent.

```markdown
# Tasks: add-auth

## 1. Token validation [req-1]
- [ ] 1.1 [backend] Add expiry check to `AuthMiddleware` (`src/mw/auth.py`) — compare `exp` claim to now
- [ ] 1.2 [backend] Reject expired tokens with 401, pass valid ones through
- [ ] 1.3 [test] `tests/test_token.py`: expired → 401, valid → proceeds
Verify: `pytest tests/test_token.py`

## 2. Login rate limit [req-2]
- [ ] 2.1 [service] New `RateLimiter` (`src/svc/ratelimit.py`) — count failed logins per IP, 60s window
- [ ] 2.2 [backend] `POST /login` returns 429 after 5 failures; response `{error: "rate_limited", retry_after: <s>}`
- [ ] 2.3 [test] `tests/test_rate.py`: 6th failure within 60s → 429
Verify: `pytest tests/test_rate.py`
```

For a **UI section**, name the *existing component to reuse* per subtask — not "add a button". Resolve it against the project first (code graph → existing UI symbols, `conventions.md` FE block for the design system); write the real `path:symbol` into the subtask so the worker builds from the project's styled components instead of a fresh plain one (the #1 cause of "built, but looks broken"):

```markdown
## 3. Users list screen [req-3]
- [ ] 3.1 Reuse `<DataTable>` from `src/ui/table.tsx` for the list — NOT a new table
- [ ] 3.2 Reuse `<Button variant=primary>` (`src/ui/button.tsx`) for the action
- [ ] 3.3 Wire pagination via the table's existing pager, page size 20
Verify: `/devspec-verify add-users` (agent-browser: regions + non-plain styling + pagination walks past page 1)
```

If the project has **no** component library (code graph finds none), say so and let the subtask build minimal — don't cite a component that doesn't exist. A UI section's `Verify:` is the `devspec-verify` skill (or an `agent-browser` script), which checks styling/alignment/pagination, not just that the field exists.

Rules:
- **Every subtask carries a layer tag and names a concrete artifact.** Tag from `[backend]` `[service]` `[frontend]` `[db]` `[test]` (only the layers the change touches) and name the real class/file/endpoint/component — resolved via the code graph, not a placeholder. `spec.html` groups tasks by layer so the reviewer scans each layer for a missing piece; an untagged or vague subtask defeats that.
- Every spec req appears in at least one section tag. A req with no section is uncaptured work.
- Order sections so a section only depends on ones above it — the worker runs them top-down.
- **DB changes are specced as migrations, never as direct DB ops.** A section that adds/alters a column, index, or table produces a **migration file** in the repo's migration dir (per `conventions.md`/`schema.md` dialect + layout) — its subtask says "write migration `V__*.sql`", not "run ALTER". **Never spec a `DROP`/`DELETE`/`TRUNCATE`/drop-table; destructive DB ops are excluded** — if the change seems to need one, flag it in `design.md` as an open question for a human, don't put it in `tasks.md`. Verify hits a scratch/test DB, never prod.
- Each section carries a `Verify:` line — the runnable check that fails if the section's req isn't met (mirrors the spec scenario). Prefer a real test. **A `Verify: MANUAL:` gate is a last resort — it stalls the unattended worker.** Use it only for a check no automation can do (cross-platform manual test on hardware the runner lacks, external human sign-off); everything else gets an automated `Verify:` plus a Decision Default in the Impact Area so the worker proceeds on its own. When MANUAL is truly unavoidable, add both `Verify: MANUAL: <what a human approves>` **and** an explicit `- [ ] N.x MANUAL: <who approves what>` subtask — that box is the approval signal; a human ticks it to unblock. No box = no way to resume.
- **UI sections reuse existing components.** A subtask that adds UI names the project's real component to reuse (`Reuse <Button> from src/ui/button.tsx`), resolved via the code graph + `conventions.md` FE block — not "add a button" the worker builds plain. No component lib in the project → say so, build minimal. The UI section's `Verify:` is `devspec-verify` (agent-browser: styling/alignment/pagination, not just presence), which also catches a fresh plain element where a project component exists.
- Fold test-writing into the section that needs it (as a subtask), don't leave verify pointing at a file nobody wrote.

## ui.md format

```markdown
# UI: add-auth

## login
Layout:
  ┌─────────────┐
  │ email  [__] │
  │ pass   [__] │
  │ [ Sign in ] │
  └─────────────┘
States: empty | submitting (button disabled) | error (red msg above button)
Interactions: Enter submits. Success → redirect /home.
```

Structural, not pixel-perfect. Enough that a worker builds the right shape and `devspec-verify` (agent-browser) can assert it.

## design.md architecture block

A short `## Architecture` block in `design.md`: the components this change touches/adds and how a request flows through them. `spec.html` renders it as the diagram the reviewer scans for a missing piece. ASCII flow is enough:

```markdown
## Architecture

Client → POST /login → AuthMiddleware → RateLimiter (svc) → UserRepo (db)
                                      ↘ 401 on expired token
```

Structural, not exhaustive. Name the real components (same ones the `tasks.md` subtasks create) so diagram and tasks agree.

## spec.html — the review page

Capture renders **one self-contained `spec.html`** at `devspec/changes/<change-id>/spec.html` — the page the reviewer opens in a browser and reads top-to-bottom before agents run unattended. It **mirrors the artifacts, inventing nothing**: an absent artifact renders as "not captured", never filled in.

**Self-contained.** Inline CSS, no framework/CDN/bundler — renders by double-click, offline. Convert each markdown artifact to HTML inline (headings, lists, tables, checkboxes, code blocks). Readable body width, section anchors or a sticky TOC so a long change is navigable, checkboxes as `☐`/`☑` matching `tasks.md`.

**Section order** (the review lens):

| Section | Source | Render |
|---------|--------|--------|
| Context | dir name + `tasks.yml` entry (if present) | change id, `title`, `status`, `depends_on`, `skills` |
| Proposal | `proposal.md` | rendered markdown — what/why |
| Architecture | `design.md` `## Architecture` (+ archify if installed) | the diagram (see below) |
| Impact Area | `design.md` `## Impact Area` | Decision Defaults table, Blast Radius list, risk/reversibility tags — how the worker will decide |
| Backend | `design.md` + `spec.md` + backend-tagged tasks | endpoints, request/response shapes, logic, classes to create/adjust |
| Frontend | `ui.md` + `mockups/*.html` | ui.md rendered; **each mockup in an `<iframe src="mockups/<screen>.html">`** + an "open standalone" link |
| Tasks | `tasks.md` | **grouped by layer tag**, each section with its checkboxes and `Verify:` line |
| Coverage | `spec.md` ⋈ `tasks.md` | the `[req-N]` diff, uncovered reqs flagged red |
| Board | `tasks.yml` | this change's row + inline dependency graph vs other changes |

**Architecture diagram — archify if installed, else ASCII.** If the `archify` skill is installed, use it to render the `## Architecture` block as an embedded self-contained diagram; otherwise fall back to the ASCII block in a `<pre>`. Never a hard dependency — degrade cleanly and note on the page which was used.

**Coverage check — compute it, don't eyeball.** The page's one active job is catching drift: a spec req with no task section. Run the `[req-N]` diff — see [references/req-coverage.md](../../references/req-coverage.md) — and render the result: uncovered reqs (only in `spec.md`) as a red banner naming them, orphan tasks (only in `tasks.md`) flagged too, clean diff as a green "every requirement is covered".

**Open `devspec/changes/<change-id>/spec.html` in the browser**, printing the path as a headless fallback — see [references/open-in-browser.md](../../references/open-in-browser.md).

<!-- ponytail: string-concat markdown→HTML inline; no markdown lib, no template engine. If a change's markdown gets exotic enough to break naive rendering, reach for a real md parser then, not before. -->

`spec.html` is **disposable** — regenerated from the artifacts. Fixes go to the markdown, never to the HTML.

## Flow

1. **Init check** — no `devspec/context/`? Run `/devspec-init` first, then continue.
2. Confirm the change id with the user.
3. **UI gate** — does the change alter anything a user sees (new/adjusted page, add/remove/move a button or element, state change)? If yes and `ui.md` is missing, **run `/devspec-ui-mockup` now** and get sign-off before writing spec/tasks. Only a zero-UI change skips this.
4. Draft `proposal.md`, show it, let BA react before writing the rest.
5. Write `design.md` (+ `## Architecture` + `## Impact Area` — walk the spec for gray areas and pre-decide each, resolve Blast Radius via the code graph, tag risk) / `spec.md` / `tasks.md` (layer-tagged, concrete names) (+ `ui.md` present for any UI change).
6. Run the `[req-N]` coverage diff (see spec.html section) — a gap here is a capture miss; fix it before rendering.
7. Render `spec.html` and open it in the browser (path as fallback).
8. **Ask the user to review, then gate on approval:** "Approve this spec — run `/devspec-plan`?" On **yes**, invoke `/devspec-plan` to register the change on the board. On **no**, they fix the source artifact (re-run capture / `/devspec-ui-mockup` / `/devspec-db-design`), then re-render — `spec.html` is disposable, the markdown is the source of truth. Auto-advance to plan only on explicit approval.

## Guardrails

- Don't write code. Artifacts only. `spec.html` mirrors the artifacts — it invents nothing; a missing artifact renders "not captured", never filled in.
- Auto-run `/devspec-plan` only on explicit approval. No approval = no advance.
- DB work is specced as forward migration files, never direct DDL. No `DROP`/`DELETE`/drop-table in `tasks.md` — destructive ops are excluded, flag to a human instead.
- Don't invent requirements the user didn't agree to — capture, don't design solo.
- **Every foreseeable gray area gets a Decision Default in the Impact Area.** A gray area the worker hits with no recorded default is a stall waiting to happen — pre-decide it now, don't leave the worker to guess or block.
- One requirement = one SHALL statement with ≥1 WHEN/THEN scenario. No scenario = not verifiable = not a req yet.
- Every spec req maps to a `tasks.md` section, every section carries a `Verify:`. Uncovered req or verify-less section = drift.
- **Any UI change requires `ui.md` from `/devspec-ui-mockup` before spec/tasks — mandatory, no exceptions.** New page, adjusted page, or a small tweak (add/remove/move a button, change a state) all count. Never capture a FE change without an approved mockup; only a zero-UI change skips it.
- UI subtasks name the existing component to reuse (real `path:symbol`, resolved via the code graph), or say "no component lib, build minimal" — never leave the worker to build a plain one-off. UI `Verify:` is `devspec-verify`, not bare presence.
- Keep files short. A spec nobody reads is drift waiting to happen.
