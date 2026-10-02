# Board Review Hook (`useBoardReview.ts`)

The "full but not solved" judgement behind the shared `ReviewDialog`.

## Why fullness, and why only editable cells

**Why:** A daily-shaped board (the ranked daily and an archive replay) shows no live error
feedback, so the moment a player learns anything is when the board is full: either the store
reports `solved`, or they are told how many cells are wrong — never which. The first version
of this check lived in `DailyExperience` and asked whether every cell was non-zero. A Kakuro
can never pass that: its black cells are stored as 0 and marked as givens. So a full-but-wrong
Kakuro daily never opened the review dialog, and because that dialog is the only way to
`revealErrors` on a daily, the player had no signal at all. The count now skips every given
(a clue, or a black cell) and so does "full".

```text
useBoardReview(active):
  slice (useShallow): for each editable cell -> empty? wrong?
    isFull     = grid exists and no editable cell is empty
    wrongCount = isFull ? editable cells ≠ solution : 0
  dismissed   (state) — "Keep looking" was pressed for THIS filling
  wasFull     (state) — when fullness flips to false, forget the dismissal
  showReview  = active && isFull && status !== 'solved' && !dismissed
```

The hook is shared by the daily and the archive replay; the archive previously had no review
at all, so a full, wrong practice board could only be fixed by guessing.
