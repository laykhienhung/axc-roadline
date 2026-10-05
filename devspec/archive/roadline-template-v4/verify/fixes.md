# Verify fixes: roadline-template-v4 (app vs mockup)

Run 2026-10-01 against the built app on `http://localhost:3200` (file storage, throwaway data dir, admin@example.com). The 4.2 fixture was imported through the API: first without mappings, then with the mapped words. Computed styles were read in the browser and compared with `mockups/objective.html` and `mockups/drawer.html`. Screenshots were taken with headless Chrome.

**Result: PASS.** No mismatches were left after review. The one layout change made during review (dropping the empty side column for 4.2) was done before this run, in commit `282a779`.

## Import flow
- First import with no saved mappings → `needs_mapping` for status "In progress" and the due words "Per BOD schedule", "Per pilot", "Per BOD review", "Yearly", "Per course". "Blocked" is listed too because it is in the file's dropdown; it doesn't block the import.
- With the mappings → ok: layout `objectives`, 6 objectives, 84 actions, no version warning.
- Re-import of the same file with no mapping sent → 200, so the words are remembered.
- Then the v2.0 fixture → today's 2.x page (`target-T1-2x-unchanged.png`).

## objective page (`/target/O1`): matches
- Wording: card "Objective", "Next for this objective". Weight shows "17%" with "equal · 1 of 6". Progress shows "0% avg of 7" with a bar and "0 / 7 done". There is no side column (`tp-body solo`).
- `.details` padding `20px 24px` / gap `12px`. `.detail` is a grid `52px 1fr 150px`, padding `14px 16px`, gap `6px 14px`, border `--line-soft`. `.did` is 13px/600 `--ink`. Goal is 13px `--text-2`, needs is 12px muted. `.dprog` is 12px muted. All equal to the mockup.
- Table headers `# · Action · Partners · Owner · Due · % · Status`. `.dchip` is 11px/600 `--ink` with a `--line-strong` border. `.ref` is 12px `--link`. `.note` is 12px muted, max 560px, clamped to 2 lines (rendered 36px for 2×18px lines, content 144px).
- `%` cells show "—": the 4.2 file has no `%` values yet. The mockup's 40% is sample data.

## action drawer: matches
- O1-2 facts: Quarter "Q1 · Oct – Dec 2026", Due, Owner, Partners "BOD sponsor", Progress "— (counts as 0%)", Detail "1.1 · AI strategy & roadmap approved", Weight "17% of the year · equal".
- Sections in order: Objective detail 1.1 (Goal / Needs first / JD) · Reference documents (3) · Note (full text) · Next for O1. The button reads "▶ Open objective O1".
- Styles: goal 13px `--text-2`, needs 12px muted, `.drawer-refs` gap 4px / 13px, `.drawer-note` 13px `pre-line` with line-height 1.6. All equal to the mockup.
- O1-5: no references and no note, Progress "— (counts as 0%)", Detail 1.2.

## Screenshots (for the BA, 9.1)
`objective-O1.png`, `objective-O2.png`, `timeline-4.2.png`, `drawer-O1-2.png`, `drawer-O1-5.png`, `target-T1-2x-unchanged.png`.

Not captured as a screenshot: the mapping dialog for the new words. It is the existing, already-approved dialog (roadline-v1/v2), and the API run above shows the word list it receives.
