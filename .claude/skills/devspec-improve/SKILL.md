---
name: devspec-improve
description: Capture knowledge that emerges in discussion but isn't in code — test accounts, environment gotchas, decisions-with-why, team conventions — into devspec/improve/ so every DevSpec skill reuses it. Use on-demand (/devspec-improve) or when a discussion surfaces a reusable fact.
license: MIT
compatibility: File-based, no CLI required. Uses git to commit non-secret improve/ files (testing.md stays gitignored). No graph or DB needed.
metadata:
  author: devspec
  version: "1.0"
---

You capture conversation-derived knowledge into `devspec/improve/` — the facts that never show up in a code scan, so `devspec-init`'s `context/` pack can't hold them: the test account to log in with, the service that must be up first, why a settled decision was settled, a team convention not yet in code. `init` owns `context/` (code-derived, overwritten on re-run). Humans + this skill own `improve/` (conversation-derived, never overwritten except by the targeted appends here). Every DevSpec skill **reads** `improve/`; only this skill **writes** it.

## The four files

Fixed paths, so a consumer grabs exactly what it needs (the worker reads `testing.md` for the login account without listing a directory).

| File | Holds |
|---|---|
| `improve/testing.md` | Test credentials, accounts, seed data, "use account X to test login", test URLs |
| `improve/gotchas.md` | Traps, env quirks, ordering ("start service Y first"), known-broken things to avoid |
| `improve/decisions.md` | Choices made **and why** — so no one relitigates a settled question |
| `improve/conventions.md` | Team-agreed conventions **not** in code — naming, flow rules, process agreements |

**Format.** Append-only. One `## <topic>` section per fact, with a `_captured: YYYY-MM-DD_` line under the heading. One fact per section — small and single-purpose, so a skill reads only the relevant one.

```markdown
## Auth service must be running before UI tests
_captured: 2026-09-11_

Frontend login calls auth-svc on :8081. If it's down the login page hangs with
no error. Start `docker compose up auth-svc` before any devspec-verify run.
```

## Secrets

Real test creds must not reach git.

- `devspec/improve/testing.md` is **gitignored** — real creds stay local (shared workers on the same filesystem still read it, same as the worker board being a local file).
- `devspec/improve/testing.example.md` is **committed** — shows the fields so a fresh clone knows what to fill in.
- `gotchas.md` / `decisions.md` / `conventions.md` commit normally — no secrets.
- Ensure `.gitignore` contains `devspec/improve/testing.md`; add the line if missing. `testing.md` is for throwaway/test accounts only — never production secrets.

## Flow

1. **Ensure scaffold.** Create `devspec/improve/` and any missing file among `testing.md`, `gotchas.md`, `decisions.md`, `conventions.md`, plus `testing.example.md`. Seed each new file with a one-line header comment naming what it holds (don't clobber existing content); seed `testing.example.md` with a filled-in sample section so a fresh clone sees the fields to copy, e.g.:

   ```markdown
   ## <app> login
   _captured: YYYY-MM-DD_

   url: http://localhost:3000
   user: test@example.com
   pass: <in .env.local / vault>
   ```

   Ensure the `.gitignore` line for `testing.md`.
2. **Gather.** Pull reusable facts from the current discussion (or from `$ARGUMENTS`). Sort each into exactly one of the four categories. A fact is reusable if a *later* change would want it — a test login, an env ordering trap, a settled why, an agreed convention. Skip one-off details of the change being discussed.
3. **Confirm.** Show the user what you'll write, grouped by file. They confirm / edit / drop. Never write without confirmation.
4. **Append.** Add each fact as a `## <topic>` section with today's `_captured:` date to its file. Append; never rewrite existing sections.
5. **Commit — local only, never push.** `git add devspec/improve` (gitignored `testing.md` is skipped automatically), commit `improve: capture <what>`. A human reviews/pushes. Real creds in `testing.md` never enter the commit.

## Agent-suggested capture (from explore / capture)

`devspec-explore` and `devspec-capture` call this behavior inline: when the discussion surfaces a reusable fact mid-flow, offer once — "That looks reusable — save to `improve/<file>.md`?" — and on confirm append that single fact in the format above. On decline, write nothing. This is a lightweight hook, not a separate invocation; the on-demand flow above is the full version.

## Guardrails

- Only this skill writes `improve/`; it never writes `context/` (that's `init`'s).
- Never write without user confirmation. No hidden writes.
- Append-only — don't rewrite or dedupe existing sections (a human prunes if it grows messy).
- Local commit only, never push.
- `testing.md` is gitignored and for test accounts only — never commit real creds, never store production secrets.
- Route each fact to exactly one of the four files; if it fits none, it probably isn't `improve/` material.
