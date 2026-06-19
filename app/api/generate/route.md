# API Route: Plain English Pseudocode

This document explains the core logic behind our `route.ts` API endpoint for the `/api/generate` route. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Receiving the Request

**Goal:** Intercept the incoming `POST` request from the frontend and figure out exactly what the user wants.
**Steps:**

1. Wait for an incoming network request.
2. Open up the hidden "body" of the request (the data payload sent by the user) and read it as JSON.
3. Extract four specific numbers from the JSON payload: `easy`, `medium`, `hard`, and `expert`. These represent how many puzzles of each difficulty the user requested. If the user didn't specify a number for a particular difficulty, default it to `0`.

---

## 2. Input Validation

**Goal:** Reject bad or dangerous requests before doing any heavy lifting. We run four checks in order:
**Steps:**

1. **Type Check:** Are `easy`, `medium`, `hard`, and `expert` all actual numbers? If someone sends a string like `"apple"` instead of a number, immediately return a `400 Bad Request` error.
2. **Negative/Decimal Check:** Are any of the values negative (e.g., `-5`) or non-integer (e.g., `2.7`)? If so, return a `400 Bad Request` error. You can't generate negative puzzles!
3. **Zero Check:** Are all four values equal to `0`? If so, the user didn't actually ask for anything. Return a `400 Bad Request` error with the message: "Please select at least one puzzle to generate".
4. **Overload Check:** Does the total (`easy + medium + hard + expert`) exceed the maximum limit of 50? If so, return a `400 Bad Request` error. This prevents a malicious user from requesting millions of puzzles and crashing the server.

---

## 3. Generating the Puzzles

**Goal:** Build the raw Sudoku puzzles based on the user's quantities.
**Steps:**

1. Create an empty list called `puzzles` to hold all of our generated boards.
2. **Easy Puzzles:** Create a loop that runs exactly `easy` times. Inside the loop, tell our Sudoku Engine to generate a new 'easy' puzzle, and add it to our `puzzles` list.
3. **Medium Puzzles:** Create a loop that runs exactly `medium` times. Tell the engine to generate a 'medium' puzzle, and add it to the list.
4. **Hard Puzzles:** Create a loop that runs exactly `hard` times. Tell the engine to generate a 'hard' puzzle, and add it to the list.
5. **Expert Puzzles:** Create a loop that runs exactly `expert` times. Tell the engine to generate an 'expert' puzzle, and add it to the list.
6. *Result: We now have a single list containing all the raw, playable Sudoku objects.*

---

## 4. Building the PDF

**Goal:** Hand our list of raw puzzles over to the PDF engine to draw them visually.
**Steps:**

1. Call the `generatePuzzlePDF` function and pass it our full list of `puzzles`.
2. Wait patiently for the PDF engine to finish drawing all the grids, titles, answer keys, and page numbers.
3. Once finished, the PDF engine hands us back a raw binary `Buffer` (the actual file data).

---

## 5. Sending the Response

**Goal:** Send the completed PDF file back to the user's browser in a way that forces it to download.
**Steps:**

1. Package the binary PDF `Buffer` into a standard web response.
2. Add a `200 OK` status code so the browser knows the request was successful.
3. **The Magic Headers:** Add hidden instructions (headers) to the response:
   - `Content-Type: application/pdf`: Tells the browser, "This data is a PDF document, not a regular webpage."
   - `Content-Disposition: attachment; filename="Sudoku_Puzzles.pdf"`: Tells the browser, "Don't try to open this in a new tab; force the user to download it as a file named `Sudoku_Puzzles.pdf`."
4. Send the response back to the user.

---

## 6. Error Handling (The Safety Net)

**Goal:** If anything goes wrong during generation or PDF rendering, catch the error so the server doesn't crash, and inform the user.
**Steps:**

1. The entire process (Steps 1-5) is wrapped in a `try...catch` block.
2. If any function breaks or throws an error, the code immediately jumps to the `catch` block.
3. Log the error to the server's console so developers can investigate.
4. Send a `500 Internal Server Error` response back to the frontend, including the error details and stack trace so the frontend can display a helpful message to the user.
