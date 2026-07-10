# Global Styles: Plain English Pseudocode

This document explains the core logic behind our `globals.css` file. It breaks down the CSS and Tailwind syntax into plain English to help you understand *what* the code is doing and *why* it does it.

---

## 1. Tailwind Setup

**Goal:** Inject the Tailwind CSS framework into our project.
**Steps:**

1. Import Tailwind using the `@import "tailwindcss";` directive.
2. Define a custom Tailwind theme block `@theme`. We override the default sans-serif font (`--font-sans`) to prioritize our custom `Inter` font, falling back to standard system fonts if necessary.

---

## 2. Color Themes (Light & Dark Mode)

**Goal:** Define the core color palette for the entire application, and make it automatically adapt to the user's system preferences (Light or Dark mode).
**Steps:**

1. **Light Mode (Default):** Target the `:root` element (the very top of the HTML document) and define four core color variables:
   - `--background`: Pure white.
   - `--foreground`: Very dark gray/black (for text).
   - `--accent`: Pure black (for buttons and highlights).
   - `--border`: Light gray (for dividing lines and input boxes).
2. **Dark Mode:** Use a media query (`@media (prefers-color-scheme: dark)`) to check if the user prefers a dark interface. If they do, we redefine those exact same variables for the `:root`:
   - `--background`: Near black.
   - `--foreground`: Off-white (for text).
   - `--accent`: Pure white (for buttons and highlights).
   - `--border`: Dark gray.

By using these variables everywhere else in our CSS, our entire site instantly swaps between Light and Dark mode without any extra effort!

---

## 3. Base HTML Elements

**Goal:** Set the default styling for the entire web page.
**Steps:**

1. Target the `body` tag.
2. Tell it to use our dynamically changing `--foreground` color for text and `--background` color for the page background.
3. Apply our custom font (`--font-sans`) and enable smooth text rendering (`antialiased`).
4. Ensure the body always stretches to at least the full height of the browser window (`min-h-100vh`).

---

## 4. Custom UI Components

**Goal:** Create reusable "classes" for specific design elements so we don't have to repeat massive Tailwind class strings in our React code.

### The Glass Panel (`.glass-panel`)

**Steps:**

1. Create a semi-transparent white background (`rgba(255, 255, 255, 0.03)`). This creates a very faint white tint over whatever is behind it.
2. Add a thin border using our dynamic `--border` color.
3. **The Magic:** Apply a `backdrop-filter: blur(10px)`. This literally blurs whatever is behind the panel, creating a premium "frosted glass" effect.
4. Round the corners (`border-radius: 12px`).

### Primary Buttons (`.btn-primary`)

**Steps:**

1. Make the button background the `--accent` color, and the text the `--background` color (so they contrast perfectly).
2. Add comfortable padding and rounded corners.
3. Make the text slightly bold (`font-weight: 500`).
4. **Interactivity:**
   - Define a smooth transition for opacity and size.
   - When hovering over the button (`:hover`), slightly reduce its opacity.
   - When actively clicking the button (`:active`), shrink it down just a tiny bit (`scale(0.98)`) to make it feel like a real, physical button being pressed.
   - If the button is disabled (`:disabled`), fade it out to 50% opacity and change the mouse cursor to a "not allowed" sign.

### Input Fields (`.input-field`)

**Steps:**

1. Make the background completely transparent so the "frosted glass" panel behind it shows through.
2. Add a thin border using our `--border` color, and use our dynamic `--foreground` color for the text inside the box.
3. Add padding and softly rounded corners.
4. Make the input take up 100% of the width available to it.
5. **Focus State:** When the user clicks into the box (`:focus`), remove the ugly default browser outline and highlight the border with our `--accent` color. Add a smooth transition so the color change looks elegant.

### Completion Celebration (`.celebrate`, `.celebrate-emoji`)

**Goal:** Give the interactive board a small reward moment when a puzzle is solved.
**Steps:**

1. Define a `pop-in` keyframe that scales an element up from small/transparent, slightly overshoots, then settles — a satisfying "pop".
2. `.celebrate` runs `pop-in` once (used on the whole "Solved!" panel).
3. `.celebrate-emoji` runs `pop-in` once and then a gentle infinite `bounce-soft`, so the 🎉 keeps bobbing.
4. **Accessibility:** under `@media (prefers-reduced-motion: reduce)`, disable both animations so motion-sensitive users get a static celebration.
