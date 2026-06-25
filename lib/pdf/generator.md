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

### `drawGrid(grid, startX, startY, size)`

**Goal:** Visually draw a 9x9 Sudoku board (either a puzzle or an answer key) on the PDF.
**Steps:**

1. Calculate how big each individual cell should be by dividing the total `size` by 9.
2. Set the font size once for the entire grid (we don't need to do this for every single cell).
3. **Draw the Numbers:**
   - Loop through all 9 rows and 9 columns (81 cells total).
   - If the cell has a number in it (not a 0), figure out exactly how wide and tall the text is.
   - Draw the text in the center of the cell. We apply a small vertical offset (pushing it down by 10% of the text height) to visually center it. This compensates for PDFKit including invisible "descender space" in its height calculation, which otherwise makes numbers look too high.
4. **Draw the Grid Lines:**
   - Loop 10 times (from 0 to 9) to draw the dividing lines.
   - Every 3rd line (0, 3, 6, 9) is drawn thick (line width 3) to create the 3x3 box outlines.
   - The other lines are drawn thin (line width 1).
   - Draw the horizontal line, then draw the vertical line.

### `drawPuzzles(isAnswers)`

**Goal:** Loop through all the organized puzzles and draw them, page by page. This handles both the blank puzzles and the solved answer keys.
**Steps:**

1. Create a main bookmark/outline section (either "Puzzles" or "Answer Keys").
2. Loop through each difficulty level ('easy', 'medium', 'hard', 'expert', 'extreme').
3. If there are puzzles in this difficulty, create a sub-bookmark for it.
4. **The Drawing Loop:** For every puzzle in this group:
   - Add a new page to the PDF.
   - Draw the title at the top (e.g., "Sudoku #1 (easy)" or "Sudoku #1 (easy) Answer").
   - Create a hidden named destination on the page (like an anchor link on a website) so we can link back to it later.
   - Call `drawGrid` to physically draw the puzzle. If `isAnswers` is true, we draw the `solution`. Otherwise, we draw the `grid` (which has holes).
   - **Interactive Links:** Move below the grid and draw a blue, underlined link. If we are drawing a puzzle, the link says "Go to Answer Key" and points to the answer page. If we are drawing an answer, it says "Back to Puzzle" and points to the puzzle page.

---

## 5. The Master Flow

**Goal:** Execute all the steps in the right order to build the final book.
**Steps:**

1. Call `titlePage()` to create the cover.
2. Set up the PDF Outline (the table of contents sidebar in PDF readers).
3. Calculate the static `gridSize` and `startX` position for the grids once, since they will be exactly the same size and horizontally centered on every single page.
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
