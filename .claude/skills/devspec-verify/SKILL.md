---
name: devspec-verify
description: Drive the running app with agent-browser and prove a change's UI matches its approved mockup — regions exist, styling isn't default/plain, layout is aligned, pagination actually pages. Use standalone after the worker builds (`/devspec-verify <change>`), or as the per-section Verify the worker runs in-loop.
license: MIT
compatibility: Requires the app running and the `agent-browser` CLI (`npx agent-browser`, needs `export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)`; from vercel-labs/agent-browser). Reads the change's ui.md + mockups/*.html as the visual source of truth. Writes screenshots to changes/<id>/verify/. No pixel-diff lib — `agent-browser get styles` computed-style asserts + region compare + screenshots for the human gate.
metadata:
  author: devspec
  version: "1.0"
---

Prove the built UI is real, not just present. A structural check ("`email` field exists, `Sign in` button exists") passes on a page that's a broken plain stack — unstyled buttons, collided elements, page 2 of the table that never loads. This skill drives the **running app** with the `agent-browser` CLI ([vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser)) and checks the UI *renders* the way the approved `mockups/<screen>.html` + `ui.md` say it should. **You verify built UI; you don't write or fix application code — a fail is reported, not patched here.**

**Tooling.** `agent-browser` is a native browser-automation CLI — every command takes `--json` for parseable output, and `get styles` reads **computed CSS**, which is the visual rung a DOM-presence check can't reach. Run it via `npx agent-browser` (needs `export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)` in the environment first); it downloads its own Chrome. The commands this skill uses:

```sh
agent-browser open <url>                 # launch + navigate
agent-browser snapshot -i --json         # accessibility tree, interactive els → @e refs
agent-browser is visible <sel> --json    # region/input present + visible (rung 1)
agent-browser get styles <sel> --json    # computed CSS: bg, padding, radius, display (rung 2)
agent-browser get text <sel> --json      # row contents, to prove page 2 differs (rung 3)
agent-browser click <sel|@eN>            # advance the pager
agent-browser screenshot <path>          # evidence + the human MANUAL gate
agent-browser close
```

(MCP entry `agent-browser mcp` exists too; the CLI is what a `Verify:` line runs — a plain shell command the worker executes.)

Two entry points, one comparison logic:

- **Standalone** — a human runs `/devspec-verify <change>` after the worker built the change, to eyeball-with-teeth: launch the app, walk each `ui.md` screen, assert + screenshot.
- **Worker verify line** — a UI section's `Verify:` in `tasks.md` calls this skill (or an `agent-browser` script it shapes), so the worker runs it in-loop and marks the change `blocked` if the UI doesn't hold.

If `devspec/context/` exists, read `conventions.md` FE block first — it names the design system whose tokens the built UI should be using (so "default/plain styling" is measured against *this* project's real components, not a generic baseline).

If `devspec/improve/testing.md` exists, read it for the test account/URL to log into the app with — use that account for the UI checks instead of asking.

## What "the app is running" means

This skill needs a live app at a URL. It does **not** start your stack — a human (or the project's run skill) does. Confirm the URL first:

- ask the user for the running URL, or read it from the project (`conventions.md`, `.env`, `docker-compose.yml`, a `run` skill).
- if nothing is running, stop and say so — `blocked: app not running, need <url>`. Never fake a pass against a dead server.

## The checks — structural, then visual, then flow

Walk each screen named in `ui.md`. For each, run the ladder; a screen passes only if every rung it has holds.

**1. Structural (regions/inputs/flow exist).** The baseline the mockup skill already suggested — `agent-browser is visible <sel> --json` for the screen's key regions, inputs, and the primary flow. `email` field present, `Sign in` button present, error banner appears on a bad submit. Use `snapshot -i` first to get element refs when selectors aren't obvious.

**2. Visual — diff the app against the mockup, property by property.** This is the core rung and the reason the skill exists: the mockup the user approved is the **reference**, the built app is the **candidate**, and you compare their computed styles element by element. Not "is the button styled at all" — "does the button match the mockup it was built from".

The mockup is a real HTML file → open it as the reference and read its computed CSS, then read the app's, and diff:

```sh
agent-browser open "file://$PWD/devspec/changes/<id>/mockups/<screen>.html"
agent-browser get styles <sel> --json   # → reference styles (mockup)
agent-browser open <app-url>/<route>
agent-browser get styles <sel> --json   # → candidate styles (app)
# diff the two per property
```

For each key element on the screen (primary button, inputs, cards, headers, table rows, container), compare these computed properties mockup↔app:
- **box** — `padding`, `margin`, `gap`, `width`/`height`
- **surface** — `background-color`, `border`, `border-radius`, `box-shadow`
- **type** — `font-size`, `font-weight`, `line-height`, `color`
- **layout** — `display`, `flex`/`grid` props, `justify-content`, `align-items`, computed `x`/`y` (alignment)

A property that differs beyond a small tolerance is a mismatch — record **element, property, mockup value, app value**. Examples the diff catches: button `padding: 12px 20px` in mockup but `0` in app (UA default → built plain), `border-radius: 8px` vs `0`, `background: #2563eb` vs `transparent`, fields left-aligned in mockup but staggered `x` in app.

Also flag the absolute breaks regardless of mockup: a primary element `0`-size, off-canvas, or overlapping another (computed box vs viewport). Same regions present as the mockup — a region in `ui.md`/mockup missing from the app is a mismatch too.

Pixel-exact isn't the bar (fonts render, sub-pixel rounding) — a tolerance on lengths, exact on the categorical ones (`display`, `border-radius: 0` vs not, transparent vs a color). The point is *"the app was built to the approved shape,"* proven per property, not eyeballed.

**3. Pagination — walk it, don't trust page 1.** If the screen has a pager or infinite scroll (list/table/feed — FE-only *or* fullstack), page-1-renders is not proof. Actually advance:
- `get text` the first rows, `click` **next** (or scroll to trigger load), `get text` again — assert page 2's rows render and **differ** from page 1, not a stuck spinner, empty state, or repeat.
- fullstack: the second page means a second fetch — the row-text differing is the proof new data arrived, not just that the control clicked.
- assert the pager reflects state (`is enabled` on next → false at the end; page 2 marked active). One hop past the first boundary is enough; you don't walk all N pages.

Auto-detect: if `ui.md` mentions a table/list/pagination, or `snapshot` shows a pager / next control / infinite-scroll sentinel, run this. Else skip it (note "no pagination on this screen").

## Screenshots + the human gate

`agent-browser screenshot devspec/changes/<change-id>/verify/<screen>.png` per screen (and per state where states differ). Two jobs:
- **evidence** — a fail names the screen and the shot shows why; a pass leaves proof it actually rendered.
- **the MANUAL visual gate** — pixel taste ("does this look *good*") is a human call, not an assert. If the change has a `Verify: MANUAL: BA approves screenshot` section, this skill produces the screenshot the human judges; the human ticks the `- [ ] MANUAL:` box to resume the worker. You never self-approve taste.

## Output — a fix list, not just a verdict

A fail is only useful if it says **what to change to make it pass**. So every mismatch is written as an actionable fix line — element, property, expected (mockup), got (app) — collected into `devspec/changes/<change-id>/verify/fixes.md`. The worker reads that file and fixes each line, then re-verifies; a human reading it sees exactly what's broken.

Per-screen summary to stdout, full detail to `fixes.md`:

```
verify add-auth:
  login   PASS  verify/login.png
  users   FAIL  4 mismatches → verify/fixes.md   verify/users.png
```

`verify/fixes.md`:

```markdown
# Verify fixes: add-auth  (app vs mockup)

## users — FAIL
- [ ] primary button `background-color`: mockup `#2563eb`, app `rgba(0,0,0,0)` — reuse `<Button>` from `src/ui/button.tsx`, don't hand-roll
- [ ] primary button `padding`: mockup `12px 20px`, app `0` (UA default) — same fix, reuse the component
- [ ] primary button `border-radius`: mockup `8px`, app `0`
- [ ] rows alignment: mockup cells share `x=24`, app staggered `x=[16,40,24]` — row not using the table's grid
- [ ] pagination: page 2 rows identical to page 1, no new fetch — pager not wired to load next
```

Each line is one concrete edit. Where the mismatch is default styling and a project component exists, the fix line says **reuse that component** (root cause), not "add padding: 12px" (patching a one-off the app shouldn't have).

- **Standalone run:** print the summary, point at `fixes.md` + screenshots. Tell the user which screens are broken; the fix list is what they (or the worker) act on. This skill doesn't edit app code.
- **Worker verify:** any mismatch → non-zero exit; the worker marks the change `blocked`, and its `notes` point at `verify/fixes.md`. On its next pass the worker works that list, rebuilds, and re-runs verify until it exits 0 — that's the fix loop. Clean run exits 0, writes no `fixes.md` (or an empty one), section satisfied.

## Reuse drift — the visual check catches it

The most common "looks plain" cause is the worker building a fresh element where the project already ships a styled component. The visual rung surfaces it: a browser-default button/table/input **is** the signature of ignored reuse. When a check fails on "raw styling" and `conventions.md` (or the code graph) shows an existing component for that element, say so in the fail — `primary button is default; <Button> exists at src/ui/button.tsx, not reused`. That points the fix at reuse, not at hand-styling a one-off. (Authoring-side, capture names the reuse target per subtask — see `devspec-capture`; this is the catch-net for when the worker skipped it.)

## Flow

1. Confirm the change id (`ls devspec/changes/`) and read its `ui.md` + `mockups/*.html`.
2. Get the running app URL (ask / read project). Not running → `blocked: app not running`, stop.
3. Per screen: structural (`is visible`) → visual — read the **mockup's** computed styles, then the **app's**, diff per property (`get styles` on both) → pagination walk (`get text`/`click`) if present. `screenshot` each to `verify/`. `close` at the end.
4. Write every mismatch as a fix line to `verify/fixes.md`; print the per-screen summary. Standalone → point the human at `fixes.md`. Worker verify → exit 0 if clean, non-zero + `notes → fixes.md` on any mismatch.
5. The fix loop: worker reads `fixes.md`, edits each line (reuse the named component where that's the cause), rebuilds, re-runs verify. Repeat until verify exits 0. A mismatch that's actually a wrong spec is fixed in `ui.md`/mockup (capture/ui-mockup) instead. This skill holds no state between runs — `fixes.md` is rewritten each run.

## Guardrails

- **Verify built UI, don't build or fix it.** A fail is reported with its screenshot; the fix is the worker's or capture's job, never this skill's.
- **App must be running — never fake a pass against a dead server.** No URL → `blocked: app not running`, stop.
- **Computed styles, not DOM presence.** "Field exists" is rung 1; "styled, aligned, not collided" is the rung that catches the plain/broken break. Check both.
- **Walk pagination past page 1.** Click next / scroll; assert page 2 renders new content and the pager reflects state. Page-1-renders is not proof.
- **Diff app↔mockup per property.** The mockup is the reference; read its computed styles and the app's, compare `padding`/`bg`/`radius`/`font`/alignment element by element. Not "is it styled" — "does it match what was approved". Tolerance on lengths, exact on categoricals (`display`, radius-0-vs-not, transparent-vs-color).
- **Every fail is a fix line.** Write element/property/mockup-value/app-value to `verify/fixes.md`; the worker fixes each line and re-verifies until exit 0. A verdict with no fix list is half a check.
- **Never self-approve the visual gate.** Produce the screenshot; a human ticks the `MANUAL:` box.
- **Screenshots are evidence.** Every screen leaves a shot under `verify/` — a fail names the screen, a pass proves it rendered.
- **A raw-styled element where a project component exists = reuse drift** — name the existing component in the fail so the fix targets reuse, not one-off styling.
