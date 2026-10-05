<!-- Team-agreed conventions not visible in code (naming, flow, process). Append-only. -->

## Codex implements, Claude reviews (when asked to co-work)
_captured: 2026-10-01_

When the user asks for Codex CLI co-work, Codex (`codex exec`) implements one `tasks.md` section at a time and never commits, edits `devspec/`, or touches the user's uncommitted files. Claude reviews the diff, runs the section `Verify:`, fixes or sends back, ticks the boxes and commits one commit per section with the review fixes listed in the message. The user can hand the rest to Claude at any point.
