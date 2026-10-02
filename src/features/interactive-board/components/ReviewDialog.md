# Review Dialog (`ReviewDialog.tsx`)

The "Not quite!" overlay for a board that is full but not correct.

## Why it is shared

**Why:** It began as inline JSX inside `DailyExperience`. The archive's practice replays start
their boards in the same daily mode (no live error feedback) but rendered no review at all, so
a full, wrong replay could only be fixed by guessing — the Hint button does nothing on a full
board. One component, driven by the shared `useBoardReview` hook, gives both surfaces the same
moment: the count of wrong cells (never which), "Keep looking", and the one-way opt-in to error
highlighting (`revealErrors`).

```text
props: open, wrongCount, errorsRevealed, onKeepLooking, onReveal
if not open -> null
render: backdrop + chunky panel (role=dialog, aria-modal, aria-label "Board full")
  "{wrongCount} cell(s) still incorrect"
  [Keep looking]  (focused on open via useDialogFocus — F7)
  [Show me what's wrong]  (hidden once errorsRevealed)
```
