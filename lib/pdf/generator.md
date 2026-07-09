# PDF Generator: Plain English Pseudocode

This document explains the core logic behind our `generator.ts` PDF generation engine. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Setup & Initialization

**Goal:** Prepare a new PDF document that we can draw on and eventually send back as a completed file (a data Buffer).
**Steps:**

1. Create a new `PDFDocument`. We configure it to:
   - Not create the first page automatically (`autoFirstPage: false`).
   - Keep all pages in memory (`bufferPages: true`) so we can go back and add page numbers later.
   - Set a default margin of 50.
2. Listen for 'data' events and collect the raw PDF chunks into a list.
3. When the document finishes ('end'), glue all the chunks together and return the final Buffer.

---

## 2. Organization

**Goal:** Sort the raw list of puzzles into organized groups for the book.
**Steps:**

1. Create buckets for 'easy', 'medium', 'hard', 'expert', and 'extreme' puzzles.
2. Loop through the list of generated puzzles and place each one into its corresponding bucket, remembering its original index number so we can label it correctly (e.g., "Sudoku #1").

---

## 3. The Title Page

**Goal:** Create an attractive cover page for the puzzle book.
**Steps:**

1. Tell the PDF to add a new page.
2. Draw large, centered text: "Sudoku Puzzle Book".
3. Move down slightly and draw smaller subtitle text: "Generated specifically for you."

---

## 4. Core Drawing Helper Functions

### `drawGrid(grid, startX, startY, gridDrawSize)`

**Goal:** Visually draw any Sudoku board (4x4, 6x6, or 9x9) on the PDF, scaled to fill the same bounding box.
**Steps:**

1. Infer the `puzzleSize` from the grid's length and look up the `GridConfig` (to get `boxWidth` and `boxHeight`).
2. Calculate how big each individual cell should be by dividing `gridDrawSize` by `puzzleSize`.
3. Set the font size once for the entire grid.
4. **Draw the Numbers:**
   - Loop through all rows and columns.
   - If the cell has a number in it (not a 0), figure out exactly how wide and tall the text is.
   - Draw the text in the center of the cell with a small vertical offset (10% of text height) to visually center it.
5. **Draw the Grid Lines:**
   - Loop `puzzleSize + 1` times to draw the dividing lines.
   - For horizontal lines, draw thick (line width 3) at every `boxHeight` interval (e.g. 0, 2, 4 for a 6x6 with boxHeight=2).
   - For vertical lines, draw thick at every `boxWidth` interval (e.g. 0, 3, 6 for a 6x6 with boxWidth=3).
   - All other lines are drawn thin (line width 1).

### `drawPuzzles(isAnswers)`

**Goal:** Loop through all the organized puzzles and draw them, page by page. This handles both the blank puzzles and the solved answer keys.
**Steps:**

1. Create a main bookmark/outline section (either "Puzzles" or "Answer Keys").
2. Loop through each difficulty level ('easy', 'medium', 'hard', 'expert', 'extreme').
3. If there are puzzles in this difficulty, create a sub-bookmark for it.
4. **The Drawing Loop:** For every puzzle in this group:
   - Add a new page to the PDF.
   - Build a descriptive title including grid size if not 9x9 (e.g., "Sudoku #1 (4x4) (easy)").
   - Create a hidden named destination on the page so we can link back to it.
   - Call `drawGrid` to physically draw the puzzle. If `isAnswers` is true, we draw the `solution`. Otherwise, we draw the `grid` (which has holes).
   - **Interactive Links:** Move below the grid and draw a blue, underlined link pointing to the corresponding answer/puzzle page.

---

## 5. The Master Flow

**Goal:** Execute all the steps in the right order to build the final book.
**Steps:**

1. Call `titlePage()` to create the cover.
2. Set up the PDF Outline (the table of contents sidebar in PDF readers).
3. Calculate the static `gridDrawSize` and `startX` position for the grids once. All grids (4x4, 6x6, 9x9) are scaled to fill the same bounding box.
4. Call `drawPuzzles(false)` to draw all the blank puzzles.
5. Call `drawPuzzles(true)` to draw all the filled-in answer keys.
6. **Add Page Numbers:**
   - Get the total count of pages we just generated.
   - Loop through every single page we created.
   - For each page, switch back to it.
   - Temporarily disable the bottom margin (set it to 0). This is a trick to stop the PDF engine from accidentally creating a brand-new page when we try to draw text near the bottom edge.
   - Draw "Page X of Y" perfectly centered at the bottom.
   - Restore the bottom margin.
7. Tell the document we are finished (`doc.end()`), which triggers the final Buffer to be returned.
