# Verify fixes: roadline-auth (app vs mockup)

Run 2026-10-01 against the built app on `http://localhost:3200` (file storage, `ADMIN_EMAILS=admin@example.com`). Computed styles were read from `mockups/*.html` (reference) and from the app (candidate) and compared per property; flows were walked in a real browser. The tool was the built-in browser plus a headless-Chrome DevTools script for the screenshots, standing in for `agent-browser`.

**Result: PASS.** Every line below was found in this run and fixed in the same run (commits `eda66b8`, `6ce4759` and the section 10 commit). A re-check after the fixes showed no mismatches.

## signin / signup / update-password: fixed
- [x] Flow: a wrong password (`POST /auth/signin` 401) went through the expired-session redirect, so it showed "Your session ended" and nested `next=/signin`. Expected: the "Email or password is wrong" alert. Fixed in `src/client/api.ts`, with regression tests both ways.
- [x] Flow: the welcome toast after sign-up and the "Password updated" toast never showed. Router state was dropped by PublicRoute's redirect, because React Router v7 navigates in a transition. Fixed by moving the toast into `useSession`; the sign-up test now asserts it.
- [x] Copy: "signed in as **a** Admin" changed to "an Admin".
- [x] `.auth-card` padding/gap: mockup `32px / 20px`, app `28px / 16px`.
- [x] `.auth-card h2` font-size/weight: mockup `24px / 500`, app `20px / 600`.
- [x] `.field input` padding/background: mockup `0 12px / --bg rgb(15,19,32)`, app `0 10px / --surface-2 rgb(19,25,49)`.
- [x] `.field label` font-size: mockup `13px`, app `14px`.
- [x] `.notice` padding/gap/font-size: mockup `12px 14px / 4px / 13px`, app `10px 12px / 3px / 14px`.
- [x] `.foot` padding-top/gap/border/font-size: mockup `14px / 8px / --line-soft / 13px`, app `16px / 12px / --line / 14px`; `.foot a` weight mockup `500`, app `400`.
- [x] Forced update foot: mockup "Not you?" (muted) + link "Sign out"; app showed one boxed `.btn` "Not you? Sign out".
- [x] Regression: the global `.err` / `.hint` field rules restyled the import-error card (`.err`) and the target-page hints (`.hint`). Scoped to `.field`.

## admin: fixed
- [x] `.users td` font-size/border-top: mockup `14px / none`, app `13px / 1px solid` (inherited from the global `table` / `td` rules). Overridden in the users table.
- [x] Users rows at 1280px: the row actions, dates and the "from server settings" label wrapped onto two lines; the mockup keeps each row on one line. Fixed with `white-space: nowrap` on those cells.

## Checked and matching (no change)
- Header by role: `.app-header`, `.user-chip`, `.avatar` identical; badge tones Admin `tone-done`, Editor `tone-on_track`, Viewer `tone-not_started`; `.readonly` 12px / 6px gap / muted; menu right-aligned under the chip, in the viewport, with role-specific items.
- Admin: page title, tabs (on/off), toolbar, `.search`, `th`, `.role-sel`, `.btn.sm`, `.lock`, confirm dialog (440px, project dialog border, focus on confirm).
- Pagination (Import log): page 1 has 50 rows with Newer disabled; Older loads 2 different rows (`before=` request); at the end Older is disabled and Newer enabled.
- Flows: server gate (`/` → 302 `/signin?next=%2F`, `/api/plan` 401); sign-up (normalized email, `ADMIN_EMAILS` → Admin); promote to Editor without re-login; reset → `1111` → forced screen, with `/target/T1` and `/api/plan` (403 `password_change_required`) blocked until a new password is set, then back to `/target/T1`; disable → open session revoked and sign-in shows "Your access is turned off"; viewer `POST /api/plan` → 403 and audit "Not allowed".

## Screenshots (for the BA, 11.2)
`signin`, `signin-wrong-password`, `signin-disabled`, `signin-signed-out`, `signup`, `signup-errors`, `update-password-voluntary`, `update-password-forced`, `header-admin-timeline`, `header-admin-menu`, `header-viewer-timeline`, `header-viewer-target`, `admin-not-admin`, `admin-users`, `admin-reset-confirm`, `admin-import-log`, `admin-import-log-page2` (all `.png` in this folder).

Not walked in the browser: the viewer "no plan yet" empty state, because the verify instance already had a plan. It is covered by `tests/header-roles.test.tsx`.
