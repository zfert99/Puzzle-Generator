# API Route: Plain English Pseudocode

This document explains the core logic behind our `route.ts` API endpoint for the `/api/generate` route. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Receiving the Request

**Goal:** Intercept the incoming `POST` request from the frontend and figure out exactly what the user wants.
**Steps:**

1. Wait for an incoming network request.
2. Open up the hidden "body" of the request (the data payload sent by the user) and read it as JSON.
3. Extract the following from the JSON payload:
   - `easy`, `medium`, `hard`, `expert`, `extreme`: How many puzzles of each difficulty. Default to `0`.
   - `gridSize`: The grid size (4, 6, or 9). Defaults to `9`.

---

## 2. Input Validation

**Goal:** Reject bad or dangerous requests before doing any heavy lifting. We run five checks in order:
**Steps:**

1. **Type Check:** Are `easy`, `medium`, `hard`, `expert`, and `extreme` all actual numbers? If someone sends a string like `"apple"` instead of a number, immediately return a `400 Bad Request` error.
2. **Negative/Decimal Check:** Are any of the values negative (e.g., `-5`) or non-integer (e.g., `2.7`)? If so, return a `400 Bad Request` error.
3. **Grid Size Check:** Is `gridSize` one of the valid values (4, 6, or 9)? If not, return a `400 Bad Request` error.
4. **Mini Grid Difficulty Check:** If `gridSize` is NOT 9, are `expert` or `extreme` greater than 0? If so, return a `400 Bad Request` error — Expert and Extreme difficulties are only available for 9x9 grids.
5. **Zero Check:** Are all five values equal to `0`? If so, return a `400 Bad Request` error with the message: "Please select at least one puzzle to generate".
6. **Overload Check:** Does the total exceed the maximum limit of 50? If so, return a `400 Bad Request` error to prevent server overload.

---

## 3. Generating the Puzzles

**Goal:** Build the raw Sudoku puzzles based on the user's quantities and grid size.
**Steps:**

1. Create an empty list called `puzzles` to hold all of our generated boards.
2. Cast `gridSize` to the `GridSize` type.
3. **For each difficulty level** (Easy, Medium, Hard, Expert, Extreme):
   - Create a loop that runs the requested count of times.
   - Tell our Sudoku Engine to generate a puzzle of that difficulty at the specified `gridSize`.
   - Add it to the `puzzles` list.
4. *Result: We now have a single list containing all the raw, playable Sudoku objects.*

---

## 4. Building the PDF

**Goal:** Hand our list of raw puzzles over to the PDF engine to draw them visually.
**Steps:**

1. Call the `generatePuzzlePDF` function and pass it our full list of `puzzles`.
2. Wait for the PDF engine to finish drawing all the grids, titles, answer keys, and page numbers.
3. The PDF engine returns a raw binary `Buffer` (the actual file data).

---

## 5. Sending the Response

**Goal:** Send the completed PDF file back to the user's browser in a way that forces it to download.
**Steps:**

1. Package the binary PDF `Buffer` into a standard web response.
2. Add a `200 OK` status code.
3. **The Magic Headers:**
   - `Content-Type: application/pdf`: Tells the browser this data is a PDF document.
   - `Content-Disposition: attachment; filename="Sudoku_Puzzles.pdf"`: Forces a download instead of inline display.
4. Send the response back to the user.

---

## 6. Error Handling (The Safety Net)

**Goal:** If anything goes wrong during generation or PDF rendering, catch the error so the server doesn't crash.
**Steps:**

1. The entire process (Steps 1-5) is wrapped in a `try...catch` block.
2. If any function throws an error, the code immediately jumps to the `catch` block.
3. Log the error to the server's console so developers can investigate.
4. Send a `500 Internal Server Error` response back to the frontend, including the error details and stack trace.
