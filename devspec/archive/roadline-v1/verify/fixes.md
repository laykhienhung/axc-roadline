# Verify fixes: roadline-v1  (app vs mockup)

Tooling: the built-in browser (computed styles via `getComputedStyle`, same-origin mockups served from the build output) and headless Edge (screenshots). `agent-browser` is not installed; the checks are the same rungs.

## Run 3 — revision 2 (adaptive import) — PASS · 2026-09-29
App http://localhost:3000, fresh `data/`, `?today=2026-09-29`. Flow driven through the page's Import input:
1. **v2.0 workbook** → imported directly: no dialog, 12 columns, no import notes.
2. **v2.1 workbook** → mapping dialog opens, listing:
   - Status "In progress": 7 actions (T1 row 23, T2 rows 22, 24, T3 rows 20, 21, 25, T4 row 20) → On track
   - Status "Blocked": 0 actions, listed in the file's Status dropdown → Behind
   - Quarter "FY27-28": 14 actions → Next year
   - the "follows the quarter" info line

   Clicking Apply shows the applying state (both buttons disabled, "Importing…"). The timeline then has:
   - 13 columns, ending "Next year / FY27-28", with 7 / 5 / 2 / 0 topics for T1–T4
   - T1 showing "2 / 12 done · 7 next year"
   - the legend "On track (In progress)"
   - the next-actions subtitle "Q1 · 7 open this quarter · 14 moved to next year"
   - notes: "Applied saved mappings: In progress → On track · Blocked → Behind · FY27-28 → Next year" and the one-time version warning

   `data/mappings.json` saved with `seenVersions: ["2.0","2.1"]`.
3. **v2.1 again** → no dialog; only the applied-mappings note (no version warning).

Style diff against the mockups, in computed CSS:

| Screen | Mismatches | Elements checked |
|---|---|---|
| `import-mapping.html` | 0 | 18 |
| `timeline.html` (incl. notes, `.hd.ny`, `.cell.ny`, legend words) | 0 | 19 |
| `target.html` (incl. `.q.ny`, `.ny-tag`, hint, progress sub-line, grouped badges) | 0 | 13 |

- `/target/T1`: blocks Q1:3 Q2:4 Q3:2 Q4:3, then Next year:7; progress "2 / 12 done · this year · 7 more next year".
- No cell overflow. At 1440px the grid fits without sideways scroll: `scrollWidth` 1350 = `clientWidth` 1350.
- Screenshots: `verify/timeline.png`, `verify/target-T1.png`, `verify/import-mapping.jpg`.

Deviations from the spec/mockups:
- The Next-year block hint reads "Moved to the next fiscal year in the file." instead of `Mapped from quarter "FY27-28"`, because the original quarter word isn't kept on the action.
- The Next-year column is added by the UI from `nextFiscalLabel()`, not by `monthColumns({ nextYear })`.

- [x] **Next-year column clipped** (found in run 3): with 13 columns the grid needs 220 + 13 × 90 = 1390px, more than the 1352px content width, so the Next-year column was cut off at 1440–1600px unless the card was scrolled sideways. The mockup has the same `minmax(90px, 1fr)`. Fixed: `.grid` columns are now `minmax(80px, 1fr)` (220 + 13 × 80 = 1260px).

Note for the BA: at 1440px each month column is about 78px wide, so long words wrap. Headless Edge breaks them without a hyphen ("Retirem|ent"); desktop browsers with hyphenation dictionaries hyphenate them (`hyphens: auto`, `lang="en"`).

## Run 2 — PASS · 2026-09-29
v2.0 timeline: 0 mismatches (24 elements); target: 0 mismatches (17 elements). Structure, states and overflow all checked.

## Run 1 — FAIL (fixed)
- [x] period cell text overflow: long single words spilled into the next month column (the flex item had `min-width: auto`). Fixed with `<span class="tx">` + `min-width: 0` and `overflow-wrap: break-word; hyphens: auto`.
