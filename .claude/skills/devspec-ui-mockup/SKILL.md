---
name: devspec-ui-mockup
description: Turn UI intent into an approved HTML mockup before writing ui.md — read reference images and existing UI patterns, build a real HTML mockup, iterate with the user screen by screen, then capture the approved shape. Use when a change has UI the user wants to see before it's built.
license: MIT
compatibility: Renders HTML mockups the user opens in a browser. Optional Playwright MCP to read the running app's existing UI patterns first. Optional reference images the user supplies. Falls back to ASCII sketch only if HTML rendering isn't wanted.
metadata:
  author: devspec
  version: "1.0"
---

Show the UI before it's specced. **You build a real HTML mockup the user checks in their browser, then write `ui.md`. You never write application code — the mockup is a static prop for alignment, not the implementation.**

A written `ui.md` alone leaves the worker guessing at layout. A mockup the user approved kills the ambiguity: the worker builds to a shape a human already signed off on.

If `devspec/context/` exists (from `/devspec-init`), read `conventions.md` for the frontend block first — component library, styling system, naming, layout foldering. The mockup should *look like this codebase's UI*, not a generic template. If a design system exists, mirror its tokens; don't invent a new visual language.

**Style from the codebase, never free-format.** The mockup's colors, spacing, fonts, radii, shadows, and component looks come from the project's **real style source** — not values you pick. Before styling, find and read that source (code graph → `conventions.md` FE block → the files themselves):
- **Design tokens / CSS variables** — theme file, `:root { --… }`, `tokens.{css,ts,json}`, `tailwind.config.*` `theme.extend`, a `theme.ts`. Copy the actual token names/values (`var(--color-primary)`, `bg-primary`, the real hex) into the mockup.
- **Utility/framework classes** — Tailwind/UnoCSS in the repo? Use the project's real class names in the mockup markup, not hand-rolled inline hex.
- **Component classes / CSS modules** — reuse the real class names the existing components apply, so the shape reads as a sibling.

Pull the real values in (inline them if the mockup must stay self-contained), and **cite the source** in `ui.md` ("colors/spacing from `src/styles/tokens.css`"). If no style source exists (no tokens, no framework, no theme), say so and build plain — but that's the only case where you don't reference the codebase. Never invent a palette or spacing scale when the project already has one.

## Ground before you mock

Two inputs make the mockup faithful instead of blind. Gather whichever exist:

- **Reference images** — the user may drop images (screenshots, Figma exports, competitor UIs, a napkin sketch). **Follow them.** They are the strongest signal of intent — match layout, hierarchy, and spacing to the reference, don't reinterpret it. If they conflict with the codebase's own patterns, surface the conflict; don't silently pick one.
- **The running app's existing UI** — if a Playwright MCP is connected and the app is running, open the relevant existing screens and read the real patterns: component shapes, spacing, colors, how forms/tables/modals already look. The new screen should be a sibling of these, not an alien. Screenshot or inspect; note what you're matching.

If neither exists — no images, no running app, no design system — say so, and build a plain, convention-fitting mockup. Don't fabricate a brand.

## The mockup loop

This is interactive and screen-by-screen. Don't dump every screen at once.

```
for each screen the change needs:
    write devspec/changes/<change-id>/mockups/<screen>.html
       - one self-contained file: inline CSS, no framework, no build step
       - match reference images + existing patterns + conventions.md
       - style from the codebase's real tokens/classes (see above), not free-format values
       - stack every state on the page: empty | loading | error | filled
    open it in the user's default browser (see below), and give the path too
    ask: does the shape/layout/states look right?
        user approves → lock this screen, move to next
        user wants changes → revise the same file, give the path again
```

**Open it as soon as it's written — every screen, every revision.** Don't make the user hunt for the path; launch their default browser on `devspec/changes/<change-id>/mockups/<screen>.html`, printing the path as a fallback for headless sessions — see [references/open-in-browser.md](../../references/open-in-browser.md).

Keep each mockup **one self-contained `.html` file** under `devspec/changes/<change-id>/mockups/<screen>.html` — inline styles, no framework, no bundler, so it renders by double-click with nothing installed. These files **persist** — `ui.md` cites them, and capture/plan/worker open them as the visual source of truth for the screen. Structural fidelity (right regions, right states, right flow) matters; pixel perfection does not — that's the real build's job.

**Stack the states on the page — don't hide them behind interactions.** A static HTML file can't run a spinner or trip an error on submit, so a screen that only shows the filled state hides half the spec. Render empty, loading, error, and filled as labeled sections down the page (or one file per state) so the user checks every state by scrolling, not clicking.

## Capture the approved shape → ui.md

Once every screen is approved, write `devspec/changes/<change-id>/ui.md` — the durable artifact. The HTML was the alignment tool; `ui.md` is what capture/plan/worker read.

```markdown
# UI: add-auth

**Mockups**: `mockups/login.html`, `mockups/reset.html` (approved <date>)
**References**: matched to `refs/figma-login.png`; siblings existing `src/pages/signin.tsx`
**Style source**: tokens from `src/styles/tokens.css` (`--color-primary`, spacing scale); Tailwind classes per `tailwind.config.ts`

## login
Layout:
  ┌─────────────┐
  │ email  [__] │
  │ pass   [__] │
  │ [ Sign in ] │
  └─────────────┘
States: empty | submitting (button disabled, spinner) | error (red msg above button)
Interactions: Enter submits. Success → redirect /home. 3 fails → show reset link.
Components: reuse `<Input>` (`src/ui/input.tsx`), `<Button>` (`src/ui/button.tsx`) — real `path:symbol`, resolved via code graph, not generic. Worker builds from these; devspec-verify flags a plain one-off if it doesn't.
```

Structural, cited to the mockup and to the components it reuses. Enough that a worker builds the right shape and `devspec-verify` (agent-browser) can assert the regions/flow exist and the styling isn't plain.

## Flow

1. Confirm the change id (`ls devspec/changes/` — reuse if it exists).
2. Gather references: user images + running-app patterns (Playwright) + `conventions.md` FE block + the real **style source** (tokens/CSS vars/`tailwind.config`/component classes). State what you're matching and which style source you'll pull from.
3. Mockup loop — one screen at a time, real HTML, user approves each. Save to `mockups/`.
4. Write `ui.md` citing the approved mockups and the components reused.
5. Hand off: `/devspec-capture` folds `ui.md` into the change (naming the real components each screen reuses); the UI section's `Verify:` is `/devspec-verify` + an optional `MANUAL: BA approves screenshot` visual gate.

## Verify hooks for the plan

So the built UI is provable, suggest these for capture's `tasks.md` (they become section `Verify:` lines, not something you run here):
- `devspec-verify` — `agent-browser` drives the running app: regions/inputs/flow exist, styling isn't browser-default/plain (`get styles` computed CSS), layout aligned, and pagination walks past page 1. Catches the "built but looks broken" break a presence-only check misses. `Verify: /devspec-verify <change>`.
- visual gate — a `Verify: MANUAL: BA approves screenshot` section with a matching `- [ ] MANUAL: BA approves screenshot` subtask (the box the worker waits on; the human ticks it to resume). `devspec-verify` produces the screenshot the human judges. Worker blocks until it's ticked.

## Guardrails

- **Mockup is a static prop, and it persists.** Inline-CSS HTML to align on shape — never the real component, never wired to real data. It stays under `mockups/` as the screen's visual reference for capture/plan/worker; the worker builds the actual UI to spec from it.
- **Follow the reference images.** They're the intent. Match them; surface conflicts with codebase patterns rather than silently overriding either.
- **Look like this codebase.** Mirror the existing design system / patterns. Don't introduce a new visual language unless the change is explicitly a redesign.
- **Style from the real style source, not free-format.** Pull colors/spacing/fonts/radii from the project's tokens, CSS variables, `tailwind.config`, or component classes — copy the actual values, cite the source in `ui.md`. Invent a palette/scale only when the project genuinely has none.
- **Open it in the browser, don't just link it.** Launch the default browser (`open`/`xdg-open`/`start` by OS) on every write and revision; print the path as fallback.
- **One screen at a time.** Approve each before moving on — a batch dump gets rubber-stamped, not reviewed.
- **Show the states.** Empty/loading/error, not just the filled happy path.
- **Capture, don't design solo.** The user approves each screen; you don't lock a shape they haven't seen.
- **No application code.** Mockups and `ui.md` only.
