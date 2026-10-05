<!-- Traps, env quirks, ordering rules, known-broken things to avoid. Append-only. -->

## DATABASE_URL must name database `postgres`, not `pm_x`
_captured: 2026-10-01_

The `roadline` schema lives in database `postgres` on `10.0.0.85:5439`. Database `pm_x` on the same server belongs to another app (66 tables) and has no `roadline` schema — a URL ending `/pm_x` makes the server exit with `schema "roadline" not found`. Keep `?options=-csearch_path%3Droadline` on the URL.

## PUBLIC_URL must match the address people open
_captured: 2026-10-01_

Non-GET requests are Origin-checked against `PUBLIC_URL` (default `http://localhost:3000`). Behind ngrok or a reverse proxy, sign-in, sign-up, import and admin actions fail with `403 bad_origin` until `PUBLIC_URL` is set to the public URL (an `https://` URL also turns on Secure cookies).

## Codex CLI sandbox cannot run Vitest
_captured: 2026-10-01_

`codex exec -s workspace-write` gets `spawn EPERM` when Vitest/esbuild start child processes, and it has no network for `npm install`. When Codex implements a section, the reviewer installs deps first and runs the section's `Verify:`; Codex only runs `tsc` and `eslint`.

## `roadline-verify@example.invalid` exists in postgres.roadline
_captured: 2026-10-01_

Created by the roadline-auth 11.1 database check with a random, discarded password — nobody can sign in with it. It was admin only because it was in `ADMIN_EMAILS` for that run; disable it from `/admin` once you are signed in as admin.

## Vercel entry `api/index.ts` (uncommitted) no longer compiles
_captured: 2026-10-01_

Since roadline-auth, `createApp` requires an `auth` option (`{ cfg, store }`); the uncommitted `api/index.ts` still calls `createApp({ dataDir, clientDir })`. Vercel also cannot reach the private DB at `10.0.0.85`.
