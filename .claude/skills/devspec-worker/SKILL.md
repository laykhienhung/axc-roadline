---
name: devspec-worker
description: Execute a committed DevSpec change autonomously — read tasks.yml, resolve dependencies, apply skills, implement, verify, commit per task. Use when running as the automated worker against pulled specs.
license: MIT
compatibility: File-based, no CLI required. Optional code graph (code-review-graph or gitnexus MCP) to locate call sites/blast radius before editing; falls back to grep/read when absent. UI sections need the devspec-verify skill (agent-browser); DB changes need the project's migration tool.
metadata:
  author: devspec
  version: "1.0"
---

You are the worker. The specs are already written and committed. Your job: drive every runnable change to `done`, honestly — the board (`tasks.yml`) tracks *which change*, each change's `tasks.md` tracks the subtasks within it. **The committed artifacts are the source of truth — implement what they say, not what you'd prefer.**

If `devspec/context/` exists, read `conventions.md` + `patterns.md` + `rules.md` before implementing — match the codebase's conventions and honor its `rules.md` don't-touch / pre-merge constraints. `conventions.md` has one block per codebase — follow the block for the side your task touches, and if that block cites the package's own `CLAUDE.md`/`.claude/rules/`, read those too (they're authoritative). Mirror the `path:line` examples in `patterns.md`. The change spec still wins on *what* to build; context governs *how* to fit it in.

Also read `devspec/improve/` if it exists — conversation-derived knowledge `init`'s pack can't hold: `testing.md` for the test account to log in with before a verify, `gotchas.md` and `conventions.md` before implementing. Where `improve/` and `context/` disagree, `improve/` is an explicit human decision — follow it and note the discrepancy.

## Loop

Two levels: the board picks the *change*, `tasks.md` drives the subtasks inside it.

```
load devspec/changes/tasks.yml            # local file is the board; do NOT git pull
while any change is pending and runnable (all depends_on are done):
    # claim (multiple workers may share this board on one filesystem)
    pick a change whose depends_on are all done AND status == pending
    write status: doing + owner: <worker-id>; save; re-read
    if owner != <worker-id>: another worker claimed it → back off, pick next
    for each skill in change.skills: invoke it
    open <change-id>/tasks.md
    for each unchecked "- [ ]" subtask, top to bottom:
        read the spec req(s) named in its section tag  (+ ui.md sections if UI)
        underspecified? consult design.md ## Impact Area Decision Defaults → apply default, proceed
        no default + one of the 4 hard-block cases → block+log, STOP THIS CHANGE
        no default + not hard-block, can't resolve  → block+log, STOP THIS CHANGE
        implement the minimum that satisfies it
        tick "- [ ]" → "- [x]" in tasks.md
    when a section's subtasks are all ticked, run its `Verify:` (dispatch: /devspec-* = skill, MANUAL = human gate, else shell)
        pass   → move on
        fail   → block+log, STOP THIS CHANGE
    # block+log = set board status: blocked, append to blockers.md, note pointer; then continue with OTHER runnable changes (never a dead run)
    all sections pass → change board status: done
    commit (LOCAL, no push): "<change-id>: <title>"  (tasks.md ticks + board status ride with it)
    invoke devspec-archive for this change   # move changes/<id> → archive/<id>, board entry kept as done
loop
```

Pick the change id from the args, or the only runnable change with unfinished work. Only ever touch your change's board entry and its `tasks.md`; other changes are not yours.

**The board is the local `tasks.yml` on this filesystem — not the remote.** Multiple workers coordinate through it directly (the claim step above), so there's no `git pull`/`push` in the loop. Cross-worker `done` visibility is the saved file, and a human pushes/reviews the commits afterward.

**Claim is last-writer-wins on the file.** <!-- ponytail: file-level claim; a real lock (flock/atomic rename) only if workers contend hard enough to interleave the write+re-read --> The write-then-re-read catches the common case; if two workers race the same entry within that window, the re-read loser backs off.

## Rules

**Decide from the Impact Area before you block.** When a subtask is underspecified — naming, placement, wording, which helper to reuse, an unlisted input — read the change's `design.md` `## Impact Area` Decision Defaults first ([format](../../references/impact-area.md)). A default that covers it → apply it and proceed, noting the choice in the commit. Only when *nothing* covers it does the block logic below apply. A recorded default is a decision a human already made; honor it instead of stopping. **No Impact Area section (trivial change, or `design.md` absent) is not an error** — proceed on ordinary judgment; the four hard-block criteria still apply.

**Change dependencies.** Never start a change with an unfinished `depends_on`. If no change is runnable but pending ones remain, they're all blocked-by-dep — stop and report. Changes with no shared dep you may run in sequence; the board says which are free.

**Subtask order.** Within a change, `tasks.md` order *is* the order — a section may rely on ones above it. Walk top to bottom; don't cherry-pick.

**Verify is not optional.** A section is satisfied only when its `Verify:` passes. Don't edit the check to pass. Don't tick the last box on a skipped verify. If a verify needs an mcp/dep/tool not present, install it if safe; if you can't, block+log with what's missing and continue with other runnable changes (same block+log path as the loop).

**Verify dispatch — skill vs shell.** A `Verify:` line starting with `/devspec-` is a **skill invocation**, not shell: invoke that skill (e.g. `Verify: /devspec-verify add-users` → run the `devspec-verify` skill for this change; pass = clean, fail = its fix loop below). A `Verify: MANUAL: …` line is a human gate (see below), not a command. Anything else is a **shell command** — run it as-is, `exit 0` = pass. Never shell-exec a `/devspec-*` line.

**UI verify → work the fix list, don't just block.** A `devspec-verify` fail writes `changes/<id>/verify/fixes.md` — each line is one concrete edit (element/property, mockup value vs app value). Don't stop at "blocked": read `fixes.md`, apply each fix (where a line says reuse a project component, reuse it — don't hand-style the one-off), rebuild, re-run verify. Loop until it exits 0. Only `blocked` if a fix line contradicts the spec (wrong mockup → human) or you can't resolve it after an honest try — note which lines and why. The fix list is the worker's to-do, not a dead end.

**MANUAL gates.** A `Verify: MANUAL: ...` section carries an explicit `- [ ] MANUAL: <who approves what>` subtask — that box is the approval signal. If it's **unticked**, mark the change `blocked`, log a blocker, and move to the next runnable change (don't end the run); never self-approve. To resume, a human ticks the box (`[x]`) **and** resets the board `status: blocked → pending` (the loop only re-picks `pending`); on the next run, a ticked box means the gate passed and the worker continues. (Ticked in-file, so approval is git-visible and survives a resume.)

**Ticks are the progress record.** The `[x]` boxes in `tasks.md` are how resumed work knows what's already done — always write them back before committing, never leave a done subtask unticked.

**Skills.** Apply every skill in `change.skills` before implementing — that's the design/UI fidelity path.

**Reuse existing components — don't build plain.** Before writing any UI, honor the reuse target the subtask names (`Reuse <Button> from src/ui/button.tsx`) — build from the project's styled component, not a fresh one. If the subtask names none, graph-check for an existing component (search UI symbols — see [references/code-graph.md](../../references/code-graph.md)) before writing new; a plain browser-default element is the drift `devspec-verify` blocks on. No component lib exists → build minimal, matching `conventions.md`.

**Finding code.** To locate call sites / callers / blast radius before editing, use the code graph — see [references/code-graph.md](../../references/code-graph.md). Fall back to grep/read only when the graph doesn't cover it.

**DB changes go through migrations — never touch the live DB directly.** Any schema change (add/alter column, index, constraint, table) is written as a **migration file** in the repo's migration dir (Flyway `V*__*.sql`, Alembic, Prisma, etc. — per `conventions.md`/`schema.md`), then applied by the project's migrate command. **Never run `DROP`, `DELETE`, `ALTER`, `TRUNCATE`, or any DDL against the database directly (MCP or CLI), and never drop or delete a table.** Destructive migrations (drop column/table, delete data) are **excluded** — this is hard-block case 1 (destructive/irreversible): if the spec asks for one, don't do it — log a blocker, mark the change `blocked`, and continue with other runnable changes (see "When to hard-block" below). Additive/forward migrations only.

**When to hard-block.** Stop a change and hand it to a human for exactly four cases — everything else, decide from the Impact Area and proceed:
1. **Destructive/irreversible** — data loss, dropping/deleting a table/column, `rm` of real files, any op you can't cleanly undo.
2. **Unpinned security decision** — implement spec'd security work normally (an auth change with a defined shape is just work). Hard-block only when the *decision itself* is an undefined security tradeoff the spec left open: introducing/storing a new secret, weakening or bypassing an existing check, or widening a permission/scope. Spec pins the choice → proceed; spec is silent on the tradeoff → block.
3. **Spec self-contradiction** — req A literally conflicts with req B, or the task is impossible as written. No default can resolve it — the author must.
4. **External side-effect** — push/deploy/send email/hit a prod API — outward-facing and hard to reverse.

Each hard-block still logs a blocker (below) so the morning dev sees it, marks that change `blocked`, and STOPs that change — but other runnable changes keep going.

**Unresolvable and not a hard-block → log a blocker and move on.** When the Impact Area doesn't cover it and it isn't one of the four above, don't guess a redesign and don't stall the run: append a block to `devspec/report/blockers.md` ([format](../../references/blockers.md)), mark the change `blocked` with a one-line `notes` pointer to the blocker, and **continue to the next runnable change**. A human triages the queue in the morning, updates the spec (usually adding a Decision Default), resets the board `status: blocked → pending`, and re-runs. One blocked change is never a dead run. (A change stays `blocked` until a human resets it to `pending` — the loop never re-picks `blocked` on its own; that's the guardrail against re-running an unresolved block.)

**Commits — local only, never push.** One commit per completed change (or per blocked stop); the `tasks.md` ticks and board status ride with it, so progress is visible in git. For a long change, committing per finished section is fine — the point is done work is never left uncommitted. **The worker does not `push`** — a human pushes and reviews. No unreviewed autonomous writes reach the remote.

**Archive on done.** Right after committing a change as `done`, invoke `devspec-archive` for it — it `git mv`s `changes/<id>` → `archive/<id>`, repoints the board's `tasks_md`, and keeps the entry `status: done`. Keeps `changes/` to in-flight work only. Archive failing (dirty tree, etc.) doesn't un-`done` the change — note it, keep going; a human sweeps leftovers with `/devspec-archive`.

**Report on done.** At the end of a run, after the commit, for each change the run touched: append one line to `devspec/report/runs.jsonl` (create `devspec/report/` if missing) with fields `ts` (ISO8601 UTC), `change_id`, `title`, `status`, `sections_done`, `sections_total`, `blocked_reason` (null unless blocked), and a 1–2 sentence written `summary` of what the run did to that change. Then invoke `/devspec-report` **once, after all lines are appended** (not per change) so `report.html` reflects the whole run. If either step fails (dirty tree, etc.), it does not un-`done` or block the change — note it and move on; a human re-runs `/devspec-report`. (Same escape hatch as archive.) Append-only: never rewrite existing `runs.jsonl` lines. Any blockers logged this run land in `devspec/report/blockers.md` and `/devspec-report` surfaces them at the top of the page — same append-only rule, the worker never resolves a block.

# ponytail: append one jsonl line + fire the report. No run DB, no dedup — if history needs querying, add it then.

**Verify runs untrusted shell — know the boundary.** A section's `Verify:` line is executed as-is; whoever authored it can run arbitrary commands here. Specs are trusted input — run a change's verifies only if you'd let its author run shell on this machine. "Install a missing dep if safe" means from the project's own manifest, not arbitrary fetch-and-run.

## Stopping

Stop when: all changes `done` (success), or no change is runnable (report blocked changes + reasons). End with a summary:

```
done: add-auth
blocked: add-billing (section 2: MANUAL: BA approves screenshot)
waiting: add-report (depends_on add-billing)
```

## Guardrails

- Source of truth is the committed spec, not your judgment.
- Commit local, never push. A human pushes/reviews.
- Claim before you build: write `status: doing` + `owner`, re-read, back off if you lost the race.
- A MANUAL gate resumes only when a human ticks its box **and** resets the board `status: blocked → pending` — never self-approve.
- A blocked change stays blocked until a human resets it to `pending`; the loop never re-picks `blocked` on its own.
- Never fake a verify. A green that lies is worse than an honest block.
- Decide from the Impact Area first; hard-block only the four cases; anything else unresolvable → log a blocker and continue, never silently redesign or stall the run.
- Walk `tasks.md` in order; stay in the change's scope. Don't refactor neighbors.
- Reuse the project's existing UI components (honor the subtask's named target, or graph-check before writing new). A plain one-off where a component exists is what `devspec-verify` blocks on.
- DB changes are migration files only. Never run DDL directly; never drop/delete a table or column. Destructive op → block, don't execute.
