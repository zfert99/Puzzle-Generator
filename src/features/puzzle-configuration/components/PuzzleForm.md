# PuzzleForm Component: Plain English Pseudocode

This document explains the core logic behind our `PuzzleForm.tsx` React component. It breaks down the React and TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Configuration Constants

**Grid Size Options:**
An array of supported grid sizes: `{ value: 4, label: '4×4' }`, `{ value: 6, label: '6×6' }`, `{ value: 9, label: '9×9' }`.

**Difficulty-by-Size Map:**
A lookup table defining which difficulties are available for each grid size:

- 4x4: Easy, Medium, Hard
- 6x6: Easy, Medium, Hard
- 9x9: Easy, Medium, Hard, Expert, Extreme

---

## 2. Setup & State Management

**Goal:** Create a user interface that tracks grid size, puzzle counts, and loading state.
**Steps:**

1. Declare the component as a Client Component (`'use client'`).
2. Set up state variables:
   - `variant`: `'classic'` or `'killer'` (defaults to classic) — a toggle at the top of the form.
   - `loading`: A boolean flag to track if the PDF is currently being generated.
   - `gridSize`: The selected grid size (4, 6, or 9). Defaults to 9.
   - `counts`: An object storing the desired quantity for each difficulty level. Easy, Medium, and Hard default to 2. Expert and Extreme default to 0.
   - `error`: A text string to hold any error messages.

### The Sudoku / Killer toggle

Two segmented buttons switch `variant`. In **Killer** mode the form hides the grid-size selector
(Killer is 9×9), shows a "no givens — the cage sums are the only clue" note, and passes
`difficulties={['easy','medium','hard']}` to the configurator (Killer v1 grades only those three).
`handleGenerate` then sends `{ variant: 'killer', easy, medium, hard }`; classic mode sends
`{ ...counts, gridSize }` as before.

---

## 3. Handling User Input

### handleGridSizeChange(size)

**Goal:** Switch grid sizes and automatically disable invalid difficulty selections.
**Steps:**

1. Set the `gridSize` state to the new value.
2. If the new size is NOT 9 (i.e. mini grid), reset `expert` and `extreme` counts to 0 since those difficulties aren't available for mini grids.

### handleChange(diff, value)

**Goal:** Safely update the puzzle counts when the user types in the input boxes.
**Steps:**

1. Convert the input string into a valid integer (`parseInt`). If the input is empty or invalid, default to `0`.
2. Update the `counts` state object by copying the previous values and updating only the specific difficulty that changed.

---

## 4. Form Validation & Submission

**Goal:** Check the user's request, send it to the server API, and handle downloading the resulting PDF.
**Steps:**

1. Create an async `handleGenerate` function that runs when the user clicks "Generate PDF".
2. **Validation:**
   - Clear any previous error messages.
   - Add up the total number of requested puzzles across all difficulties.
   - If the total is 0, show an error: "Please select at least one puzzle."
   - If the total is greater than 50, show an error: "Too many puzzles."
3. **Execution:**
   - Set `loading` to true so the user knows something is happening.
   - Send a `POST` request to the `/api/generate` endpoint, sending `{ ...counts, gridSize }` as the JSON body.
4. **Error Handling:**
   - If the server responds with a failure code, extract the error message and throw an error.
5. **Downloading the PDF:**
   - Convert the response into a raw data blob.
   - Create a temporary download link and trigger it to download "Sudoku_Puzzles.pdf".
   - Clean up the temporary URL and link element.
6. **Cleanup:**
   - Always set `loading` back to false in the `finally` block.

---

## 5. The User Interface (Render)

**Goal:** Visually render the configuration panel.
**Steps:**

1. Draw a main container (a glassmorphism panel) to hold everything.
2. **Grid Size Selector:**
   - Render a row of three segmented buttons ("4×4", "6×6", "9×9").
   - The active button has an indigo background with a glow shadow.
   - Clicking a button calls `handleGridSizeChange`.
3. **The Difficulty Inputs:**
   - Loop over all five difficulty names (`['easy', 'medium', 'hard', 'expert', 'extreme']`).
   - For each difficulty, check if it's available for the current grid size.
   - If it's NOT available, render the row at 40% opacity with the input disabled and value forced to 0.
   - If it IS available, render the row normally with the input value from state.
4. Display a subtle helper text reminding the user of the 1–50 limit.
5. If the grid size is not 9, display a note: "Expert and Extreme are only available for 9×9 grids."
6. If the user has requested any 'extreme' puzzles, display a red warning about generation time.
7. If there is an `error` message in the state, display it in red text.
8. **The Submit Button:**
   - Draw a large, primary button.
   - If `loading` is true, disable the button and show a spinning SVG icon along with "Generating...".
   - If `loading` is false, make the button clickable and show "Generate PDF".
