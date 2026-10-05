<!-- Choices made and why, so no one relitigates a settled question. Append-only. -->

## Both AXC workbook templates stay importable
_captured: 2026-10-01_

Roadline imports template 2.x (target sheets `T1 - Name`, Weight, Deliverable / Success measure, period text "September 2026 - August 2027") **and** template 4.2 (objective sheets `O1 - Name`, "Start month (M1)" date → 12-month fiscal year, columns Partners / % / Reference document / Note, objective-detail rows `1.1 … Goal: …`). The layout is detected per file. Why: old backups (v2.4) and the 2.x fixtures stay valid while the team moves to 4.2.

## Progress = average % when the file has a % column
_captured: 2026-10-01_

For a 4.2 file, progress is the average of the action `%` values (empty = 0%), which is how the workbook itself defines it ("Progress = average % of all actions"). Files without a `%` column keep the 2.x rule: share of actions marked Done.

## 4.2 extra columns are shown in the UI
_captured: 2026-10-01_

Partners, %, Reference document, Note and each objective detail's Goal are shown on the target page and in the action drawer, not ignored.

## Free-text due words are mapped once, not a new due kind
_captured: 2026-10-01_

Due values like "Per BOD schedule", "Per pilot", "Per BOD review" go through the existing mapping dialog (e.g. to "end of its quarter") and the answer is remembered. No new recurring/on-request due kind was added.

## Local accounts, open sign-up, admin-set roles
_captured: 2026-10-01_

No Google Workspace or other identity provider. Anyone can sign up (any email domain) and is active immediately as Viewer; an admin sets Editor/Admin on `/admin`. First admin and break-glass come from `ADMIN_EMAILS` (forced admin at sign-in, locked in the UI). Why: the user did not want a Workspace dependency or an approval step.

## Reset password is 1111 with a forced update; no sign-in throttle
_captured: 2026-10-01_

An admin reset sets the password to `1111` and `mustChangePassword`; the user must set a new password before anything else opens. It does not expire. There is no sign-in throttling. Accepted risk (user decision): open sign-up + no throttle + `1111` reset — admins tell the user right after a reset and can disable unknown accounts.

## npm test never touches a database
_captured: 2026-10-01_

Automated tests run on the JSON-file stores (`FileStorage`, `FileAuthStore`) in temp dirs; Postgres code paths are checked by running the app against `postgres.roadline`. Why: the user wants `npm test` to run offline and never write to the shared DB.

## Pilot connects to Postgres as `postgres`
_captured: 2026-10-01_

The app uses the `postgres` superuser on `10.0.0.85:5439`, database `postgres`, schema `roadline` — accepted for the internal pilot. Follow-up: a dedicated `roadline_app` role (GRANTs are in the README Database section).
