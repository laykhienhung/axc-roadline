# Verify fixes: roadline-v2  (app vs mockup)

## timeline — Next actions, Tasks view — FAIL (run 1)
- [x] overdue due text in `.trow .due`: mockup `color #A01E14; font-weight 600`, app `color rgb(74, 79, 89); font-weight 400` — `.trow .due` outranks `.late`; add a `.trow .due.late` rule in `src/client/styles.css`

## Run 2 — PASS
All screens match the mockups on the checked properties (header, buttons, segmented controls, summary tiles, board columns and cards, task rows, timeline cells and target column, target header, fact and quarter tiles, import empty / rejected / mapping). No page-wide horizontal scroll at 1280 or 1920 px; the timeline scrolls inside its card at 1280 px with the target column sticky. No pagination on these screens (Board columns and the Tasks box scroll instead). Only expected console errors (404 empty, 400 rejected, 422 mapping — from the states triggered on purpose).

Tooling note: checked with the built-in browser pane (computed styles via script) instead of `agent-browser`, against the running build on a scratch data dir holding the "Dec plan" (`tests/helpers.ts:decPlan`). Screenshots are in this folder.
