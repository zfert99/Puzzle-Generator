# PuzzleForm Component: Plain English Pseudocode

This document explains the core logic behind our `PuzzleForm.tsx` React component. It breaks down the React and TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Setup & State Management

**Goal:** Create a user interface that tracks how many puzzles of each difficulty the user wants, and whether we are currently generating a PDF.
**Steps:**
1. Declare the component as a Client Component (`'use client'`) because it relies on user interactions and browser state.
2. Set up state variables:
   - `loading`: A boolean flag (true/false) to track if the PDF is currently being generated. This is used to disable the button and show a spinner.
   - `counts`: An object storing the desired quantity for each difficulty level (`easy`, `medium`, `hard`, `expert`). They all default to 2.
   - `error`: A text string to hold any error messages (e.g., "Too many puzzles") to display to the user.

---

## 2. Handling User Input

**Goal:** Safely update the puzzle counts when the user types in the input boxes.
**Steps:**
1. Create a `handleChange` function that takes the difficulty name and the raw input string.
2. Convert the input string into a valid integer (`parseInt`). If the input is empty or invalid, default to `0`.
3. Update the `counts` state object by copying the previous values and updating only the specific difficulty that changed.

---

## 3. Form Validation & Submission

**Goal:** Check the user's request, send it to the server API, and handle downloading the resulting PDF.
**Steps:**
1. Create an async `handleGenerate` function that runs when the user clicks "Generate PDF".
2. **Validation:**
   - Clear any previous error messages.
   - Add up the total number of requested puzzles across all difficulties.
   - If the total is 0, show an error: "Please select at least one puzzle."
   - If the total is greater than 50, show an error: "Too many puzzles. Maximum is 50 per request."
3. **Execution:**
   - Set `loading` to true so the user knows something is happening.
   - Send a `POST` request to the `/api/generate` endpoint, sending the `counts` object as the JSON body.
4. **Error Handling:**
   - If the server responds with a failure code (e.g., 400 or 500), extract the error message from the response and throw an error.
5. **Downloading the PDF:**
   - If successful, convert the server's response into a raw data `blob`.
   - Create a temporary, invisible URL for this blob in the browser memory.
   - Create an invisible `<a>` (link) element, set its `href` to the blob URL, and set its `download` attribute to "Sudoku_Puzzles.pdf".
   - Temporarily attach the link to the document body, simulate a click on it to trigger the download, and then immediately clean up by removing the link and revoking the blob URL to free up memory.
6. **Cleanup:**
   - Whether the request succeeded or failed, always set `loading` back to false in the `finally` block to re-enable the button.

---

## 4. The User Interface (Render)

**Goal:** Visually render the configuration panel.
**Steps:**
1. Draw a main container (a glassmorphism panel) to hold everything.
2. **The Inputs:**
   - Loop over an array of the difficulty names (`['easy', 'medium', 'hard', 'expert']`).
   - For each difficulty, draw a label and a number input box.
   - Hook up the input box so its value matches the state, and its `onChange` event triggers `handleChange`.
3. Display a subtle helper text reminding the user of the 1–50 limit.
4. If there is an `error` message in the state, display it in red text.
5. **The Submit Button:**
   - Draw a large, primary button.
   - If `loading` is true, disable the button and show a spinning SVG icon along with "Generating...".
   - If `loading` is false, make the button clickable and show "Generate PDF".
