---
name: devspec-archive
description: Move a finished change's artifacts out of devspec/changes/ into devspec/archive/, keeping its board entry as done. Use once a change reaches status done — the worker auto-fires this per change; a human runs it to sweep leftovers.
license: MIT
compatibility: File-based, no CLI required. Uses git (git mv) to preserve history; falls back to plain mv in a non-git repo. No graph or DB needed.
metadata:
  author: devspec
  version: "1.0"
---

A `done` change's artifacts still sit in `devspec/changes/<id>/` next to in-flight work. This moves them to `devspec/archive/<id>/` so `changes/` holds only unbuilt/running changes, while the board (`tasks.yml`) keeps the entry as `done` for history and dependency lineage. **You move files and repoint one path — no application code, no new requirements.**

The worker fires this the moment a change hits `done` (see its loop). A human also runs it directly to archive changes that finished before this skill existed, or to sweep any `done`-but-unarchived entry.

## Precondition — done means done

Archive only a change whose board `status` is `done`. If it's `pending`/`doing`/`blocked`, refuse and say so — a not-yet-built change moved out of `changes/` vanishes from capture's board scan and the worker's runnable set. `done` is the only safe state.

Deps stay intact because the board entry stays: `depends_on` references change *ids*, not paths, and the id keeps its `done` row. Moving the dir breaks nothing a later change points at.

## Where

`devspec/changes/<id>/` → `devspec/archive/<id>/`. The whole change dir moves as a unit — `spec.md`, `tasks.md`, `spec.html`, `mockups/` ride together, so `spec.html`'s relative `<iframe src="mockups/…">` still resolves after the move. Create `devspec/archive/` if missing.

## Steps

1. Read `devspec/changes/tasks.yml`, find `changes.<id>`. **Refuse if `status != done`** or the entry is absent. If `devspec/archive/<id>/` already exists, it's already archived — say so, stop.
2. Move the dir, preserving git history:
   ```sh
   mkdir -p devspec/archive
   git mv devspec/changes/<id> devspec/archive/<id>
   ```
   (No git? plain `mv` — but this repo is git, so prefer `git mv`.)
3. Repoint the board entry so its artifacts still resolve, and mark it archived. Keep `status: done`; **don't touch other entries**:
   ```yaml
   changes:
     <id>:
       title: ...
       tasks_md: archive/<id>/tasks.md   # was changes/<id>/tasks.md
       depends_on: [...]
       status: done
       archived: archive/<id>            # add: where it went
       ...
   ```
4. Commit **local, no push** (worker convention): `git commit -m "<id>: archive"`. The move + the board repoint ride in one commit.

## Worker auto-fire

The worker invokes this per change, right after it commits a change as `done` — so `changes/` self-cleans as work finishes and the human reviewing commits sees the archive move alongside the build. If archive fails (e.g. dirty state), the worker doesn't block the change — it's already `done`; note it and move on, a human sweeps later.

<!-- ponytail: git mv + one yaml repoint. No manifest, no index rebuild. If archive ever needs to be queryable as its own board, add an archive.yml then — not before. -->

## Guardrails

- **Only `done` archives.** Refuse `pending`/`doing`/`blocked` — moving unbuilt work off the board loses it.
- **Keep the entry, keep `status: done`.** Board stays the dependency record; don't delete the row, don't flip the status.
- **Repoint `tasks_md` to the new path** and add `archived:` — a stale `changes/<id>/…` pointer after the move is drift.
- **Touch only this change's entry and its dir.** Other changes are not yours.
- **Local commit, never push.** Same as the worker — a human pushes/reviews.
- **No application code.** You relocate artifacts; you don't build or respec the change.
