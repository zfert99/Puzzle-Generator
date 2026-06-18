# Benchmark Script: Plain English Pseudocode

This document explains the core logic behind our `benchmark.ts` script. It breaks down the TypeScript syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Setup & Imports

**Goal:** Load the puzzle generator engine so we can test its speed.
**Steps:**
1. Import the `generateSudoku` function from our puzzle engine (`../lib/puzzle-engine/sudoku.ts`).

---

## 2. The Main Execution Loop

**Goal:** Generate multiple Expert puzzles and precisely measure how long each one takes to create.
**Steps:**
1. Define a `main` function to run the benchmark.
2. Create an empty list called `times` to store the duration of each generation attempt.
3. Start a loop that runs 10 times. For each iteration:
   - Record the exact start time using `Date.now()`.
   - Call `generateSudoku('expert')` to generate a single Expert puzzle.
   - Record the exact end time immediately after generation finishes.
   - Calculate the duration by subtracting the start time from the end time.
   - Add this duration to the `times` list and print it to the console so we can see progress.

---

## 3. Results Calculation

**Goal:** Calculate the overall average time to give us a clear performance metric.
**Steps:**
1. Add up all 10 durations from the `times` list to get the `total` time.
2. Divide the `total` by 10 (the number of puzzles) to calculate the `average` time.
3. Print the total time and the average time (formatted to 2 decimal places) to the console.
4. Finally, execute the `main()` function at the bottom of the script so it actually runs when we execute the file.
