# HintNote (`HintNote.tsx`)

The last hint's reason, under the board: "Hint — Only 9 fits at row 2, column 4 (across
16-in-two; down 17-in-two)", with a collapsible "How we got there" listing the eliminations
that made the placement possible ("3-in-two across (row 1): only {1,2}", …).

## Why

A hint that only places a digit teaches nothing; the Kakuro plan's E2 slice asks for hints that
**name the technique**. The store records a `HintNote` on every hint (`lastHint`); the logical
solver fills in the technique, reason and lead-up, the exact-solver fallback and the plain
reveal record a one-line note with no lead-up. The component just renders whatever is there.

`role="status"` (a polite live region): a screen-reader user hears the explanation when the
digit lands, where `BoardAnnouncer` announces only the placement. Renders nothing until a hint
has been taken; cleared by a new game.
