## roadline-v1 · 10. End-to-end check and sign-off · 2026-09-29T02:29:22Z
what: MANUAL gate 10.2 — BA approves screenshots of the timeline and T1 detail pages
tried: none, MANUAL gate (worker never self-approves). Sections 1-9 and 10.1 are done and verified (40 tests, lint, build, /devspec-verify PASS). Screenshots: devspec/changes/roadline-v1/verify/timeline.png, verify/target-T1.png; details in verify/fixes.md.
needs: BA reviews the screenshots (or the running app, npm start → http://localhost:3000/?today=2026-09-28). If approved: tick "- [ ] 10.2 MANUAL" in devspec/changes/roadline-v1/tasks.md and set roadline-v1 status blocked → pending in devspec/changes/tasks.yml, then re-run /devspec-work. If not: note the changes needed (ui.md / mockups) and re-capture.
status: resolved

## roadline-v1 · 16. End-to-end check and sign-off · 2026-09-29T04:46:55Z
what: MANUAL gate 16.2 — BA approves screenshots of the timeline, T1 detail and mapping dialog (revision 2, adaptive import)
tried: none, MANUAL gate (worker never self-approves). Sections 1-15 and 16.1 done and verified: 68 tests, lint, build, end-to-end v2.0 → v2.1 (dialog → Apply) → v2.1 again, 0 style mismatches vs all three mockups. One layout fix applied (Next-year column clipped → min column 80px). Screenshots: devspec/changes/roadline-v1/verify/timeline.png, target-T1.png, import-mapping.jpg; details in verify/fixes.md. Supersedes the 10.2 block above.
needs: BA reviews the screenshots (or http://localhost:3000/?today=2026-09-29). If approved: tick "- [ ] 16.2 MANUAL" in devspec/changes/roadline-v1/tasks.md and set roadline-v1 status blocked → pending in devspec/changes/tasks.yml, then re-run /devspec-work. If not: note the changes needed (ui.md / mockups) and re-capture.
status: resolved

## roadline-v2 · 10. Visual sign-off · 2026-09-29T10:00:22Z
what: MANUAL gate 10.2 — BA must approve the redesign screenshots against the mockups.
tried: none, MANUAL gate (never self-approved). Automated checks all pass: lint, 84 tests, build, and the browser verify (run 2 clean, one CSS fix applied in run 1 — see verify/fixes.md).
needs: BA reviews devspec/changes/roadline-v2/verify/*.jpg against mockups/*.html; ticks 10.2 in tasks.md; sets tasks.yml roadline-v2 status blocked → pending; re-run the worker to finish (done + archive).
status: resolved

## roadline-auth · 11. Real database and visual sign-off · 2026-10-01T12:49:05Z
what: MANUAL gate 11.2 — BA approves the screenshots in devspec/changes/roadline-auth/verify/ (sign-in, sign-up, update password, headers by role, admin users + import log).
tried: none, MANUAL gate (never self-approved). Everything automated passes: lint, 152 tests, build; browser verify against all five mockups (verify/fixes.md — every mismatch found was fixed, re-check clean); 11.1 run on postgres.roadline at the user's instruction.
needs: BA reviews verify/*.png against mockups/*.html; ticks "- [ ] 11.2 MANUAL" in devspec/changes/roadline-auth/tasks.md; sets tasks.yml roadline-auth status blocked → pending; re-run the worker to finish (done + archive).
status: resolved

## roadline-template-v4 · 9. Visual sign-off · 2026-10-01T13:46:15Z
what: MANUAL gate 9.1 — BA approves the screenshots in devspec/changes/roadline-template-v4/verify/ (objective page O1/O2, timeline, drawer O1-2 / O1-5, 2.x page unchanged).
tried: none, MANUAL gate (never self-approved). Automated checks pass: lint, 189 tests, build; browser verify against both mockups (verify/fixes.md — no mismatches left); import flow checked (needs mapping → mapped → remembered → 2.x still fine).
needs: BA reviews verify/*.png against mockups/*.html; ticks "- [ ] 9.1 MANUAL" in tasks.md; sets roadline-template-v4 status blocked → pending; re-run the worker to finish (done + archive).
status: resolved
