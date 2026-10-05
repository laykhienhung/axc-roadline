# UI: roadline-template-v4

**Mockups**: `mockups/objective.html`, `mockups/drawer.html` (both approved 2026-10-01). Each embeds the project's real `src/client/styles.css`; the rules marked "NEW" are what this change adds.
**References**: current `/target/:id` (`src/client/pages/target-page.tsx`, `components/target-header.tsx`, `components/action-plan.tsx`) and the timeline action drawer (`components/action-drawer.tsx`).
**Style source**: `src/client/styles.css` tokens and classes (CRT theme): `.target-card`, `.facts`, `.fact`, `.pbar`, `.next-t`, `.ap`, `.q`, `.q-h`, `.drawer*`, `.chip`, `.badge` + `.tone-*`, `.dot`. There's no component library; new pieces are small components plus the NEW classes.

**Rule for the whole change**: a 2.x workbook renders exactly as today. Everything below applies to a plan read from a 4.2 workbook (`plan.layout === 'objectives'`).

## Wording
- The noun is **"objective"** for 4.2 and **"target"** for 2.x. It covers the page `aria-label`, "Next for this objective", "Open objective O1" in the drawer, and other user-visible "target" words in the timeline and summary (e.g. "targets needing attention" → "objectives needing attention").
- IDs and names come from the file (`O1 · Strategy & Roadmap`).

## objective page (`/target/:id`): `mockups/objective.html` A
```
[header: Timeline / O1 · Strategy & Roadmap ……… plan meta · UserMenu]
┌ target-card ──────────────────────────────────────────┬ Next for this objective ┐
│ O1 [Not started]                                       │ #1 … Oct 2026            │
│ Strategy & Roadmap                                     │ #2 … Nov 2026            │
│ objective text                                         │ #3 …                     │
│ Weight 17% (equal · 1 of 6) │ Owner │ Progress 6% avg of 7 [bar] 0/7 done │ Overdue │
└────────────────────────────────────────────────────────┴──────────────────────────┘
┌ Objective details (NEW) ───────────────────────────────────────────────────────────┐
│ 1.1  AI strategy & roadmap approved                                    13%  avg · 3 │
│      Goal: …   Needs first: …   JD: 1.1, 1.2                                        │
│ 1.2  …                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌ Action plan · 7 actions · 1.1 … · 1.2 … ────────────────────────────────────────────┐
│ Q1 Oct – Dec 2026 · 5 actions  NOW                                                  │
│ # │ [1.1] Action / 📎 refs / note (2 lines) │ Partners │ Owner │ Due │ % [bar] │ Status │
│ Q2 … "No actions this quarter."   All year …                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘
```
- **Weight fact**: `17%` plus small muted "equal · 1 of 6" when the file has no Weight. With a file weight it shows as today.
- **Progress fact**: when the plan has a `%` column, it shows the **average %** of this objective's actions ("6% avg of 7") with `.pbar` and a muted "0 / 7 done" line. Otherwise it reads as today (done / total).
- **Objective details card** (`section.card.details`, `aria-label="Objective details"`): one `.detail` per objective detail, holding the id (`.did`), title (`h3`), `Goal:` / `Needs first:` / `JD:` lines (any that exist), and on the right the detail's average % and action count. The card is hidden when the objective has no details (2.x).
- **Action table columns**: `#`, Action, then **Partners** when any action has partners, otherwise **Success measure** (today's). Then Owner, Due, then **%** when the plan has a `%` column, then Status.
  - Action cell: a **detail chip** `.dchip` ("1.1") before the text when the action belongs to a detail.
  - The "→ deliverable" sub-line appears only when it differs from the action.
  - Below the text: `.ref` "📎 first two names · +n" when there are references, and `.note` (2-line clamp) when there is a note.
- **% cell**: `.pct` (bar + "40%"). Blank shows "—".
- **Quarters** come from the fiscal start (4.2: Start month → Q1 Oct–Dec).

## action drawer: `mockups/drawer.html`
- **Facts** (`dl.drawer-facts`): Quarter, Due, Owner, then **Partners** (when set), then **Progress** (`.pct` with an 80px bar, or "— (counts as 0%)" when blank and the plan has %), then **Detail** "1.1 · title" (instead of "Section" when the action has a detail). Last is Weight, "17% of the year · equal" when the weight is equal.
- **Sections**, in this order, each shown only when it has content:
  1. "Objective detail 1.1 · title" with Goal / Needs first / JD
  2. Deliverable (2.x, as today)
  3. Success measure (2.x, as today)
  4. **Reference documents** (`ul.drawer-refs`, one 📎 per item)
  5. **Note** (`p.drawer-note`, full text, `white-space: pre-line`)
  6. Next for O1 (as today)
- The button reads "▶ Open objective O1" (4.2) or "▶ Open target T1" (2.x).

## Unchanged
Timeline tree, summary tiles, next actions and the import screens keep their layout; only the wording follows the noun. The mapping dialog already handles the new free-text due words (no UI change).

## Components
- New: `src/client/components/objective-details.tsx:ObjectiveDetails({ plan, target })` and `src/client/components/percent.tsx:Percent({ value, width })` (the `.pct` bar).
- Changed: `target-header.tsx:TargetHeader` (weight + progress facts, noun), `action-plan.tsx:ActionTable` / `ActionPlan` (columns, chip, refs, note), `action-drawer.tsx:ActionDrawer` (facts, sections, noun), `pages/target-page.tsx` (render `ObjectiveDetails`), and wording in `timeline-page.tsx` / `summary-tiles` (via `nounFor(plan)`).
- Reuse: `.chip`, `.badge` / `StatusBadge` (`components/status-dot.tsx`), `.pbar`, `.drawer-sec`, `.drawer-facts`.
