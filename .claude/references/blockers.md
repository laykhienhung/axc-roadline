# Blockers log (shared)

The queue that keeps an unattended run from stalling. When the worker can't resolve something, it **logs a blocker and moves to the next runnable change** instead of ending the run. A dev triages the queue in the morning, fixes the spec, re-runs.

## Where

`devspec/report/blockers.md`. Append-only, human-readable. Create the file (and `devspec/report/`) if missing.

## Block shape

One block per unresolved item:

```
## <change-id> · <section> · <ISO8601 UTC>
what: <the decision the worker couldn't make>
tried: <default consulted, why it didn't fit — or "none, hard-block: <which>">
needs: <what a human must decide / which spec field to update>
status: open
```

The four hard-block cases (destructive/irreversible, unpinned security decision, spec self-contradiction, external side-effect) also log a block — `tried:` names which hard-block fired.

## Triage flow (morning dev)

1. Read the `open` blocks (surfaced at the top of `report.html`).
2. Fix the source: update the change's `spec.md`/`design.md` — usually add a Decision Default so it never recurs. For a MANUAL gate, tick its `- [ ] N.x MANUAL:` box in `tasks.md`.
3. **Reset the board so the worker will re-pick it: in `tasks.yml`, set the change's `status: blocked` → `pending`.** This is the actual gate — the worker's loop only picks `pending`, so a blocker flipped to `resolved` without this stays stuck.
4. Flip the block's `status: open` → `status: resolved` (or delete it) — bookkeeping so it drops off the report.
5. Re-run the worker — the change is now runnable.

Append-only for the worker: it never rewrites or resolves blocks, only appends. Resetting the board `status`, ticking MANUAL boxes, and resolving blocks are all the human's job.
