---
name: devspec-report
description: Render the whole devspec board (tasks.yml + archive/) and run history (runs.jsonl) into one accumulating report.html — what's implemented, what's left, what past runs did, across every change. Use when a dev wants a single page to check overall project status, not just one change.
license: MIT
compatibility: Renders one static HTML file the user opens in a browser (double-click, no build step). Reads tasks.yml, archive/*/tasks.md, runs.jsonl. No JS required.
metadata:
  author: devspec
  version: "1.0"
---

One page any dev opens to see what's implemented, what's left, and what past runs did — across the **whole board**, accumulating over time. Where capture renders one change's `spec.html` before the worker runs it, this renders every change after the fact: a project-wide status page. **You render data to HTML — no application code, no respec.**

## Where

`devspec/report/report.html`. Regenerated in place on every run.

## Inputs

- `devspec/changes/tasks.yml` — the board: every change's `title`, `status`, `depends_on`, `notes`, `archived`, `tasks_md`.
- `devspec/archive/*/` — archived changes' artifacts (their `tasks_md` points here once archived).
- `devspec/report/runs.jsonl` — one JSON object per line: `ts`, `change_id`, `title`, `status`, `sections_done`, `sections_total`, `blocked_reason`, `summary`. **Missing file is not an error** — render history as empty.
- `devspec/report/blockers.md` — append-only blocker log ([format](../../references/blockers.md)): `##`-headed blocks with `what`/`tried`/`needs`/`status`. **Missing file is not an error** — render Open Blockers as empty. Human-editable; read only.

## Sections done/total per change

Read the change's `tasks_md` path from its board entry, read that file, count the `##`-numbered task sections (each `## N. Title` heading is one section). A section counts as done when every `- [ ]` checkbox subtask under it is ticked `[x]`; `total` is the number of numbered sections. Show `done/total`. If `tasks_md` is missing or unreadable, show `—` for that change and keep going — never abort the whole report over one broken change.

## report.html layout (top to bottom)

1. **Header** — `X done · Y in-progress · Z blocked · N total` (status `doing` counts as in-progress) + generated timestamp.
2. **Open Blockers** — `##`-headed blocks in `blockers.md` whose `status:` is `open`, reverse-chronological by the block heading's timestamp (newest first). Per block show the heading (`change-id · section · ts`) and the `what` / `tried` / `needs` lines. This is the morning dev's triage list — what to resolve so the worker can resume. No open blocks (or no file) → render "no open blockers".
3. **Implemented** — changes with `status: done`: title, sections done/total.
4. **In progress / Left** — changes with `status: doing`, `pending`, or `blocked`: title, sections done/total; a `blocked` change also shows its `notes` as the block reason.
5. **History** — `runs.jsonl` entries, reverse-chronological (newest `ts` first): ts, change title, status, sections done/total, and the written `summary`.

## Rendering

One **self-contained** `report.html`: inline CSS, no framework, no bundler, no CDN, no JS required — renders by double-click, works offline.

<!-- ponytail: deliberately cut — no charts, no per-section drill-down, no filter/search, no server. It's a static snapshot; add these only if a dev asks for them repeatedly. -->

## Open it in the browser

Write the file, then launch the user's default browser on `devspec/report/report.html`, printing the path as a headless fallback — see [references/open-in-browser.md](../../references/open-in-browser.md).

## Flow

1. Read `devspec/changes/tasks.yml`. If absent, say so and stop — there's no board to report on.
2. For each change, resolve `tasks_md`, compute sections done/total (or `—` on failure).
3. Read `devspec/report/runs.jsonl` if present; parse line by line, skipping malformed lines rather than aborting.
4. Read `devspec/report/blockers.md` if present; collect `status: open` blocks. Missing → empty.
5. Render `report.html`: header counts, Open Blockers, Implemented, In progress / Left, History (newest first).
6. Open it in the browser; print the path too.

## Guardrails

- **Render only.** No application code, no respec, no editing the board or archived artifacts.
- **Disposable output.** `report.html` is regenerated every run — never hand-edit it.
- **Don't abort on one bad item.** Malformed `runs.jsonl` line or missing/unreadable `tasks_md` → skip that item, render everything else.
- **Missing `runs.jsonl` is not an error.** Render History as empty.
- **`blockers.md` is human-editable — read only.** The dev flips `status`/deletes blocks; the report never rewrites it. Missing file → Open Blockers empty.
- **Self-contained HTML.** Inline CSS, no framework/CDN/build, no JS required.
