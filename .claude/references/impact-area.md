# Impact Area (shared)

The section that lets the worker **decide instead of stall**. Captured in `design.md` at plan time, rendered into `spec.html`, read by the worker at run time. It answers, up front, the questions the worker would otherwise hit mid-task with nowhere to look but a human.

Three parts:

## 1. Decision Defaults

The anti-block core. For every foreseeable gray area, a pre-decided answer + a fallback. The worker applies the default and proceeds; the fallback tells it what to do when the default assumption doesn't hold.

| Gray area | Default decision | Fallback if default doesn't fit |
|-----------|------------------|---------------------------------|
| Where the new util lives | `src/util/` per `patterns.md` | mirror the nearest sibling module |
| Error copy wording | follow `conventions.md` tone | terse, no punctuation, lowercase |
| Unlisted edge-case handling | fail closed, log, return the spec'd error shape | — |

Walk the spec for anything a competent dev would pause on — naming, placement, wording, which existing helper to reuse, what to do on an unlisted input — and pre-answer it. A gray area with a default is a gray area the worker never blocks on.

## 2. Blast Radius

What this change touches, resolved via the code graph at capture time (see [code-graph.md](code-graph.md) — `impact` / `get_impact_radius_tool` / `trace` / callers). Files, symbols, APIs, tables. The worker gets scope without re-discovering it.

## 3. Risk + reversibility tag

Tag each blast-radius entry `safe/reversible` or `risky/irreversible`. **This is an advisory reviewer signal, not the block trigger** — the worker decides whether to stop purely from its four hard-block criteria (destructive/irreversible, unpinned security decision, spec self-contradiction, external side-effect), never from a tag. The tag tells the human reviewer where to look hardest before approving, and flags an entry a worker *will* stop on so the spec can pin the decision up front.

- **safe/reversible** → a bad guess is cheap to undo. Additive/forward migrations count here — they're allowed work, not a block.
- **risky/irreversible** → destructive or unrecoverable (drop/delete data, weaken a security check). Expect the worker to hard-block; pre-pin the decision or accept the block.

Example:

```
## Blast Radius
- src/svc/ratelimit.py (new)              — safe/reversible
- src/api/login.py (adjust POST /login)   — safe/reversible
- migrations/003_add_attempts.sql (new)   — safe/reversible (additive, forward-only)
```
