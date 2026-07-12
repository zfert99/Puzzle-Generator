# Home Page: Plain English Pseudocode

This document explains the core logic behind our `page.tsx` file, which serves as the main landing page of our web application. It breaks down the React syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Imports

**Goal:** Bring in the interactive pieces we need to build the page.
**Steps:**

1. Import the `PuzzleForm` component. This is the interactive box where users select their puzzle quantities and click the generate button.

---

## 2. The Main Page Component

**Goal:** Build the visual layout and structure of the main landing page.
**Steps:**

1. Define the default exported function `Home`. Since it doesn't have a `'use client'` directive, it defaults to a React Server Component, meaning it renders on the server for better performance.
2. Create a main `<main>` container for the entire page. We style it using Tailwind CSS to:
   - Use a flexible column layout (`flex flex-col`), centering everything horizontally and vertically (`items-center justify-center`).
   - Ensure it takes up at least the full height of the screen (`min-h-screen`).
   - Add some padding (`p-8`).
   - Apply a subtle background pattern image (`bg-[url('/bg-pattern.svg')]`) that covers the entire screen.

---

## 3. The Header Section

**Goal:** Display the main title and introductory text to tell the user what this app does.
**Steps:**

1. Create a centered div (`text-center`) to hold the header content.
2. **The Title:** Draw an `<h1>` tag that says "PDF Puzzle Generator".
   - We make it very large (`text-5xl`) and bold (`font-extrabold`).
   - **The Gradient Effect:** We use a special trick to make the text look like a gradient. We make the actual text color transparent (`text-transparent`), clip the background to the text shape (`bg-clip-text`), and apply a linear gradient background that flows from dark gray to light gray (and adjusts for dark mode).
3. **The Subtitle:** Draw a smaller `<p>` tag describing the app: "Create customized, print-ready Sudoku puzzle books with interactive answer keys in seconds." We color it gray and restrict its maximum width so it stays nicely centered.

---

## 4. The Interactive Form

**Goal:** Display the tool the user actually interacts with.
**Steps:**

1. Render the `<PuzzleForm />` component exactly where we want it on the page. All the complex logic for tracking inputs and downloading the PDF lives entirely inside that separate component.
2. A `<ThemeToggle />` sits in a top row (Phase 5.1) — temporary placement until 5.2 moves it into shared header chrome.

---

## 4b. Cross-mode Navigation

**Goal:** Make the interactive modes discoverable from the front door — the home page is the PDF generator, but the Daily puzzle, Leaderboard, and free Play modes should be reachable without typing a URL.

**Steps:**

1. Below the form, render a small `<nav>` with links to `/daily` ("🗓️ Daily puzzle"), `/leaderboard` ("🏆 Leaderboard"), and `/play` ("Free play"), styled to match (indigo, hover underline).

---

## 5. The Footer

**Goal:** Add a simple copyright footer at the bottom of the page.
**Steps:**

1. Draw a `<footer>` tag below the form.
2. Push it down slightly with a top margin (`mt-20`), make the text small (`text-sm`), and color it gray (`text-gray-500`).
3. Display the text: "Minimalist Premium Design © 2026".
