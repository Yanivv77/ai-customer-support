# Rehearsal: support demo

A scripted Stageshow scene of the support panel for the demo video. It is an
illustration, not the live app: `a.click()` draws the cursor pressing and
`a.set()` changes the scene.

## Story (about 9 seconds, plays once, holds the payoff)

1. A new email from Dana Levi drops into the top of the inbox as "Working".
2. The cursor opens it; the AI reply shows "Checking the knowledge base".
3. The answer streams in place, then its source: "Frame size for the C1".
4. The ticket rolls to "Answered by AI", "Sent in 9s" appears, and a beat
   later the "Answered without a person" stat rolls from 86% to 87%.

The poster (reduced motion, thumbnails) is the final frame.

## Gold copied

- `linear`: the sidebar window, the list as context with one real row, the
  wide-hero crop (inset top and left, off the right and bottom).
- `ai-chat`: the thinking state, the answer streamed with `Stream`, the
  source arriving last.

## What changed from the gold

- The support panel's own look: cool grays, #1f5fae accent, Geist, its
  sidebar groups and lucide icons (the dashboard's icon set).
- A satellite stat card straddles the window's left edge over the sidebar.
- The phone design (`compact`, 358 x 320) shows the conversation alone; the
  list would make the window taller than wide.

## Checks

- `film.mjs --gate` passes at 1080 (contact sheet and `--states`) and at 390.
- Named, not fixed: `jump: ss-check__arc` (the pending check's arc spinning,
  its box changes as it turns) and `appears with no entrance: ss-count` (the
  kit Count's digit strip at its first roll; the roll reads cleanly at full
  size). Both are inside kit parts.

## Not checked

- The dark theme (the scene is light only).
- A fresh-eye review by someone else (`references/review.md`).
- Recording at 4K; the stage scales up to 2x with `fill`.
