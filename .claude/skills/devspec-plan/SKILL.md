---
name: devspec-plan
description: Register a captured change on the shared board tasks.yml — one entry per change with its status, cross-change dependencies, and worker skills. Subtasks already live in the change's tasks.md; this sets the change-level order the worker follows. Use once capture wrote the change's artifacts.
license: MIT
compatibility: File-based, no CLI required. Optional code graph (code-review-graph or gitnexus MCP) to judge cross-change coupling/blast radius; falls back to grep/read when absent.
metadata:
  author: devspec
  version: "1.0"
---

Register the change on the shared board `devspec/changes/tasks.yml`. **You write the plan, not the implementation.**

The subtasks already exist — capture wrote them into `<change-id>/tasks.md` as an OpenSpec checklist. Your job is the *board*: one entry per change, tracking its status and its dependencies on *other* changes, so the worker knows which changes are runnable now, which wait, and which run in parallel. Plan appends/updates your change's entry; never clobber other changes' entries. One place to see all in-flight work.

## Read first

If `devspec/context/` exists (from `/devspec-init`), read `summary.md` + `conventions.md` + `patterns.md` + `rules.md` first — that's the codebase ground truth, so you judge dependencies and blast radius against real patterns instead of re-deriving them.

`proposal.md`, `spec.md`, `design.md`, `tasks.md`, `ui.md` (if present) under `devspec/changes/<change-id>/`. `tasks.md` is the subtask checklist capture wrote — you don't rewrite it; you read it to size the change and judge how it relates to other in-flight changes. If a spec req has no `tasks.md` section, capture missed it — flag it back, don't paper over it on the board.

When judging deps against real code (shared files, integration points, blast radius across changes), use the code graph — see [references/code-graph.md](../../references/code-graph.md) (impact/query patterns). Fall back to grep/read only when the graph doesn't cover it.

## tasks.yml schema

Shared board — top-level `changes:` map, **one entry per change id** (not per subtask; subtasks live in that change's `tasks.md`).

One schema, every entry. Required: `title`, `tasks_md`, `depends_on`, `status`. Optional (default shown): `skills: []`, `notes: ""`, `owner: ""`.

```yaml
changes:
  add-auth:                           # change id = key
    title: authentication & rate limit
    tasks_md: changes/add-auth/tasks.md   # where the subtask checklist lives
    depends_on: []                    # other change ids that must finish first
    skills: []                        # skills the worker auto-applies across this change
    status: pending                   # pending | doing | done | blocked
    owner: ""                         # worker id that claimed it (set when status→doing)
    notes: ""                         # worker writes deviations/blockers here
  add-billing:                        # a change that builds on auth
    title: billing
    tasks_md: changes/add-billing/tasks.md
    depends_on: [add-auth]            # waits for add-auth; runs after
    skills: [frontend-design]         # optional; omit or [] when the worker needs no extra skill (as in add-auth above)
    status: pending
    owner: ""
    notes: ""
  fix-upload-race:                    # unrelated in-flight change, untouched by you
    title: fix upload race
    tasks_md: changes/fix-upload-race/tasks.md
    depends_on: []
    status: doing
    owner: "worker-1"
    notes: ""
```

Your change reads its artifacts from `devspec/changes/<change-id>/`; its **board entry** lives under `changes.<change-id>`. Within-change ordering is the `tasks.md` order, not the board's concern.

## Rules

**Dependencies are between changes.** `depends_on` lists *other change ids* that must finish first — that's what tells the worker sequential vs parallel: a change with `depends_on: []` is runnable now; changes with no shared dep run in parallel; a chain runs in order. Keep it shallow. Base a dep on real coupling (shared files/tables/APIs) — use the code graph to check, don't guess.

**No cycles — check, don't just assert.** Before writing your entry, walk `depends_on` transitively from your change: if you can reach your own id back, it's a cycle — refuse and report it, don't write it. (Otherwise the worker can't tell a real deadlock from legit waiting; it'll just stall forever as "waiting.")

**Skills.** List skills the worker auto-applies across the change. UI change → `frontend-design` (or whatever's installed). Per-section verify already lives in `tasks.md`; the board only carries the change-wide skills.

**Verify stays in tasks.md.** The runnable contract is the `Verify:` line under each `tasks.md` section — you don't duplicate it onto the board. Your board job is status + deps. If a section has no meaningful verify, that's a capture gap — flag it, don't ship the change.

**Granularity.** One board entry = one change = one reviewable/mergeable unit. If a "change" is really two independent pieces with no shared dep, split it into two entries so they can run in parallel.

## Flow

1. Read the change's `tasks.md` + spec; confirm every req has a section — run the `[req-N]` diff, don't eyeball (see [references/req-coverage.md](../../references/req-coverage.md)). Only in `spec.md` = a req with no task section (capture gap → flag back); only in `tasks.md` = a section pointing at a req that doesn't exist.
2. Judge this change's real dependency on *other* changes on the board (shared code → dep). Walk `depends_on` for a cycle back to your id; refuse if found.
3. Write/update your change's entry in `devspec/changes/tasks.yml` (leave others intact).
4. Show the user the change-level graph (ASCII) so BA can sanity-check ordering before commit.
5. Capture already rendered `spec.html` for the browser review before this step; once the change is on the board, the worker can run it.

```
fix-upload-race        (runnable now, parallel)
add-auth ──→ add-billing   (billing waits on auth)
```

## Guardrails

- Every spec req has a `tasks.md` section, or it's a gap — flag it (run the `[req-N]` diff, don't eyeball).
- Deps are between changes, based on real coupling. Walk `depends_on` for a cycle before writing; refuse on a back-edge. No self-dep.
- Don't rewrite `tasks.md` or duplicate its verify onto the board.
- Don't implement — you register the change; the worker executes it.
