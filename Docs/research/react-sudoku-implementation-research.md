# Architectural Blueprint and Implementation Research for a High-Performance React Sudoku Application

## 1. Introduction and Architectural Vision

The evolution of a software application from a stateless, static document generator into a fully interactive, stateful browser-based platform introduces profound engineering complexities. In the context of a Sudoku application, this transition shifts the computational burden from a backend or client-side PDF generation script into real-time, browser-based memory management and DOM reconciliation. A Sudoku board is a highly dynamic interface. A standard 9x9 grid contains 81 individual cells, each acting as a discrete interactive entity capable of holding definitive values, multi-digit candidate arrays (pencil marks), and complex metadata regarding selection status, error states, and immutability.

When building this interactive React Sudoku board, the application state will undergo high-frequency mutations. User interactions—ranging from rapid keyboard entry and touch-based numpad inputs to continuous elapsed-time ticks and complex candidate cascading—demand an architecture that minimizes rendering latency. If state mutations trigger application-wide reconciliations, the resulting input lag and layout thrashing will severely degrade the user experience, breaking the illusion of a responsive application.

This comprehensive report delivers an exhaustive analysis of the foundational technologies, algorithmic methodologies, and architectural patterns required to fulfill this implementation plan. The analysis dictates the transition to granular state management via Zustand, the implementation of snapshot-based temporal middleware for undo/redo stacks, the algorithmic rigor required for dynamic puzzle generation and constraint validation across multiple grid topologies (4x4, 6x6, 9x9), the optimization of CSS Grid and Subgrid layouts, strict adherence to Web Accessibility Initiative – Accessible Rich Internet Applications (WAI-ARIA) protocols, and the deployment of isolated testing environments using Vitest and React Testing Library.

## 2. State Management Paradigm: The Supremacy of Zustand

### 2.1 Overcoming the Context API Bottleneck

The foundational architectural decision in this implementation plan is the rejection of the native React Context API in favor of Zustand for managing the interactive board's state. While the Context API provides a functional mechanism for avoiding prop drilling in shallow component trees or distributing low-frequency global configurations (such as static themes or authenticated user identities), it is fundamentally unsuited for high-frequency data streams and complex interactive matrices.

The critical limitation of the Context API lies in its inability to perform selective subscriptions. When a React component consumes a context provider, that component establishes a strict dependency on the entirety of the context object. Consequently, any mutation to any property within that context forces every consuming component to re-render, regardless of whether the specific data required by a given component actually changed.

In the context of a Sudoku board, the global state object must track the 81-cell grid, the currently selected cell coordinates, user configuration settings, and an active timer ticking every second. Under a Context-driven architecture, every timer tick or cell selection would trigger a cascading re-render of all 81 cells, the header, and the numpad. This architectural anti-pattern rapidly exhausts the browser's main thread, resulting in dropped frames, significant layout thrashing, and unacceptable input latency.

### 2.2 Granular Subscriptions and the Elimination of Wasted Renders

Zustand resolves this fundamental performance bottleneck by isolating state outside of the React component tree and employing a sophisticated, hook-based selective subscription model. Under this paradigm, a component only subscribes to the specific slice of state it requires to function. For the Sudoku board, each `Cell.tsx` component will execute a localized hook to extract only its specific coordinate data from the global store.

When a user inputs a digit into the cell at row 0, column 0, the Zustand store updates, but only the component representing `[0][0]`—and immediately adjacent peers affected by candidate reduction logic—will undergo the React reconciliation process. The remaining cells in the grid remain completely inert, bypassing the render phase entirely. The magnitude of the win depends on the app, but the mechanism is well-established: moving from a single Context that re-renders every consumer to per-cell Zustand selectors eliminates the O(n) re-render fan-out on every keystroke, which is exactly the pattern that causes visible input lag on an 81-cell grid.

Furthermore, Zustand's architectural design inherently resolves advanced React concurrency issues, most notably the "zombie child" anomaly and UI tearing. By leveraging the `useSyncExternalStore` hook (introduced in React 18 and still the underlying mechanism in React 19), Zustand guarantees that all components read from a consistent, synchronous snapshot of the external data source. This ensures that rapid state transitions—such as simultaneously highlighting errors, clearing pencil marks, and selecting a new cell—do not result in fragmented or contradictory UI states during concurrent rendering pauses.

### 2.4 Zustand vs. the Alternatives (2026 Check-In)

Zustand remains the pragmatic default for this kind of app: it crossed 50% adoption among React state-management libraries by 2025, has the largest ecosystem, and its single-store model maps cleanly onto "one grid, one source of truth." Jotai (atomic, bottom-up state) is the main alternative worth naming — it can be a better fit if the app grows deeply derived state (e.g., per-cell computed validity that depends on many other cells), but for a single Sudoku board, Zustand's simpler mental model wins. Valtio (proxy-based mutation) is a smaller niche choice and not necessary here. There is no reason to reconsider the Zustand choice for this project.

### 2.3 Object Selection and Memoization via useShallow

Implementing granular subscriptions requires precision in how selectors are authored. A common anti-pattern in Zustand utilization occurs when developers return an instantiated object from the selector function to extract multiple state properties simultaneously. Because Zustand utilizes the native `Object.is` method to evaluate whether a state change should trigger a re-render, returning a newly constructed object or array wrapper on every render cycle causes the strict equality check to fail instantaneously. This failure falsely signals to React that the state has mutated, potentially triggering infinite update loops or nullifying the performance benefits of the library.

To extract multiple values safely, the implementation must wrap the selector function in Zustand's `useShallow` hook. The `useShallow` hook intercepts the subscription evaluation and performs a shallow equality comparison on the properties of the returned object rather than evaluating the memory reference of the object itself.

| Selector Strategy | Equality Evaluation | Re-render Condition | Application in Sudoku Board |
| :--- | :--- | :--- | :--- |
| Single Primitive | `Object.is` (Strict) | Triggers only if the primitive value mutates. | Fetching the specific value of `state.grid[r][c]`. |
| Direct Destructuring | Reference (Strict) | Triggers on any global store update. | Prohibited anti-pattern; induces full board re-renders. |
| `useShallow` Object | Shallow Comparison | Triggers if the extracted properties diverge. | Fetching `{ value: grid[r][c], isSelected: selectedCell === id }`. |
| Custom Equality | Developer Defined | Triggers based on custom logic (e.g., deep equal). | Validating complex nested candidate arrays across grid operations. |

By meticulously applying `useShallow` across the `Cell.tsx`, `Numpad.tsx`, and `GameHeader.tsx` components, the application ensures that the UI remains highly responsive, updating solely in response to mathematically relevant state mutations.

## 3. Temporal State Management: The Undo/Redo Architecture

### 3.1 Middleware Selection and Memory Optimization

An interactive puzzle platform demands robust, localized history management, allowing users to traverse their operational history via Undo and Redo actions. While standard state management libraries require developers to manually construct and manage historical state stacks, the Zustand ecosystem offers specialized temporal middleware to automate this process.

The two predominant strategies for temporal tracking are snapshot-based storage and delta-based JSON patching. For applications managing massive data objects (exceeding tens of megabytes), JSON patch architectures like `zustand-travel` are necessary to prevent linear memory growth. However, a Sudoku application's state footprint is exceedingly small, consisting primarily of an 81-element matrix containing integers and short arrays.

In this specific domain, snapshot-based middleware such as `zundo` is vastly superior. Snapshot architectures bypass the computational overhead of diffing algorithms, allowing for near-instantaneous `setState`, undo, and redo operations. This zero-latency history traversal is critical for maintaining fluid user interaction during rapid gameplay.

**Maintenance note:** `zundo` is small, stable, and does what it says, but its release cadence has slowed — treat it as "finished," not "actively developed." Before committing to it, check its GitHub issues for open bugs against your React version. If deeper time-travel features are ever needed (e.g., branching history, persistence of history across sessions), `zustand-travel` (built on the newer `Travels`/JSON Patch core) is the actively maintained alternative, though it's overkill for an 81-cell grid.

### 3.2 Configuration and State Exclusion

Integrating `zundo` requires a highly customized configuration to prevent history pollution. The primary global store tracks not only the puzzle grid but also ephemeral UI states and a continuous timer. If the temporal middleware tracks the entire global state, every sequential tick of the `elapsedTime` counter will generate a new history snapshot, effectively burying the user's actual gameplay moves under a mountain of chronological noise. Furthermore, triggering an "undo" action should revert a numerical placement on the board, but it must absolutely not rewind the elapsed game clock.

This architectural conflict is resolved utilizing the `partialize` configuration option provided by the `zundo` API. The `partialize` callback explicitly filters the state object before it is committed to the history stack. By configuring the middleware to track exclusively the grid, candidates, and history arrays, while explicitly omitting `elapsedTime`, `status`, and `selectedCell`, the application ensures that the temporal stack accurately reflects logical puzzle progression without interfering with session tracking.

Additionally, the `handleSet` property within the middleware configuration can be employed to apply debouncing or throttling mechanisms. If a user utilizes touch controls to rapidly toggle multiple pencil marks in a single cell, tracking every individual tap may overwhelm the undo stack. Applying a brief debounce via `handleSet` can group rapid, sequential candidate toggles into a single, cohesive historical snapshot, significantly improving the logical flow of the undo/redo user experience.

## 4. Algorithmic Constraints and Dynamic Puzzle Generation

### 4.1 Topology and Dimensional Logic

The implementation plan specifies that the application must dynamically support multiple grid variants: 4x4, 6x6, and the standard 9x9. The mathematical constraint satisfaction problem (CSP) at the core of Sudoku dictates that a grid must be subdivided into discrete regions (blocks), each requiring a unique set of digits. The architectural foundation must programmatically derive these boundaries rather than hardcoding them, allowing the solver and generator algorithms to scale seamlessly across dimensions.

| Grid Variant | Total Matrix Cells | Valid Digit Range | Block Dimensions | Total Internal Blocks |
| :--- | :--- | :--- | :--- | :--- |
| 4x4 (Micro) | 16 | 1 through 4 | 2x2 | 4 |
| 6x6 (Mini) | 36 | 1 through 6 | 2x3 (2 rows by 3 columns) | 6 |
| 9x9 (Standard) | 81 | 1 through 9 | 3x3 | 9 |

The application's constraint engine must dynamically calculate block intersections based on the selected configuration. For example, identifying the origin coordinate of the sub-block containing a target cell requires calculating `row - (row % blockHeight)` and `col - (col % blockWidth)`. This mathematical generalization is paramount for validating placements and dynamically executing candidate reduction algorithms regardless of the user's initial grid selection.

### 4.2 Generation, Unique Solutions, and the Backtracking Engine

To transition away from generating static PDFs, the application must execute a client-side generation pipeline capable of synthesizing fresh puzzles on demand. A foundational rule of Sudoku puzzle integrity is that any presented board must possess exactly one, mathematically unique solution. Puzzles with multiple possible valid states require guessing, which violates the core premise of logic-based progression.

The generation architecture relies on an advanced recursive backtracking algorithm. The pipeline executes through a sequence of highly optimized phases:

* **Terminal Matrix Construction:** The engine initiates with an entirely empty array. It iterates through the grid, placing a randomly selected, valid digit into an empty cell. If a placement violates regional constraints, the algorithm immediately backtracks, un-placing the digit and exploring alternative branches. To optimize this process, the engine utilizes the Minimum Remaining Value (MRV) heuristic, always targeting the cell with the fewest mathematical possibilities to drastically reduce the size of the search tree. This phase concludes with a fully solved, randomized terminal grid.
* **Symmetrical Puzzleification:** The algorithm systematically obscures cells to construct the puzzle. However, simple random deletion is insufficient. Following each discrete removal, the grid is parsed back into the solver engine to verify that the remaining given clues still restrict the board to a single, unique solution. If the removal introduces ambiguity (multiple valid solutions), the digit is restored, and the algorithm targets an alternative coordinate.
* **Deductive Difficulty Grading:** The subjective difficulty of a Sudoku puzzle is not merely a reflection of the quantity of missing clues, but rather an assessment of the complexity of the logical techniques required to deduce the missing digits. The algorithm evaluates the final puzzle by attempting to solve it using simulated human logic (e.g., assessing the necessity of naked pairs, hidden singles, or advanced intersection removals) and tracking the required iteration depth. This evaluation assigns the generated puzzle to the appropriate difficulty tier before presentation to the user.

### 4.3 Advanced Pencil Mark Reduction and Peer Precomputation

A defining feature of a premium digital Sudoku experience is intelligent candidate management. When a player finalizes a placement within a cell, the application must automatically cascade this information, stripping the newly placed digit from the candidate arrays (pencil marks) of all intersecting "peer" cells. This mirrors the essential "Obvious Singles" and "Last Free Cell" human solving methodologies. If an automated cleanup results in a peer cell possessing only a single remaining candidate, the engine identifies a "Naked Single," allowing the player to rapidly progress.

However, calculating the union of peer cells dynamically upon every keystroke incurs unnecessary computational overhead. To achieve peak efficiency, the application must construct a peer-lookup map during the initial application bootstrap. By precomputing a static array that maps every index (0 through 80) to an array of its 20 intersecting peers (the elements sharing its row, column, and block), the pencil mark reduction function is transformed from a heavy calculation into an instantaneous $O(1)$ dictionary lookup.

### 4.4 Next.js-Specific Gotcha: Hydration Mismatches from Puzzle Generation

Because this is a Next.js App Router project, the backtracking generator described above must not run during server rendering of a Server Component and then re-run (with different random output) on the client — that produces a classic React hydration mismatch, since `Math.random()`-driven shuffling will never produce identical output on server and client. Two safe patterns:

1. **Client-only generation:** mark the board container `"use client"` and generate the puzzle inside a `useEffect` (or lazily on first interaction), rendering a loading/skeleton state until the grid exists. Nothing puzzle-related is computed during SSR.
2. **Seeded generation:** generate a random seed on the server, pass it to the client, and use a seeded PRNG (e.g., a small mulberry32/xorshift implementation) so the exact same sequence of "random" choices happens on both server and client, keeping SSR output and client hydration output identical.

For a puzzle generator, option 1 is simpler and is the recommended default — there's no SEO or LCP benefit to server-rendering a specific puzzle instance, and it avoids an entire class of hydration bugs.

## 5. Rendering Architectures: CSS Grid and Visual Topologies

### 5.1 Macro-Layouts and Block Delineation

The physical rendering of the interactive board requires structural stability to prevent layout shifting across diverse viewport sizes. Implementing CSS Grid is mandatory to avoid the semantic and rendering complexities associated with deeply nested HTML tables. A primary challenge in styling a Sudoku board involves the precise delineation of the internal blocks. The borders separating the 3x3 regions must be significantly thicker than the minor grid lines separating individual cells.

This can be executed cleanly using the `:nth-child` pseudo-class in CSS. For a standard 9x9 matrix, applying a heavy border to the right edge of every third column (excluding the final column) and the bottom edge of every third row (excluding the final row) establishes the required visual hierarchy without polluting the DOM with extraneous wrapper `div` elements.

Alternatively, an advanced gap-calculation methodology can be deployed. By establishing a uniform background color on the parent grid container and applying a specific gap value alongside `overflow: hidden`, the cells themselves dictate the minor grid lines. The major block borders can then be overlaid using absolutely positioned pseudo-elements (`::before` and `::after`) mapped via `calc()` functions and locally scoped variables (e.g., `var(--line-offset)`) to perfectly bisect the grid tracks. This ensures flawless scaling down to mobile resolutions without sub-pixel rendering artifacts.

### 5.2 Micro-Layouts: The Subgrid Pencil Mark Paradigm

The internal rendering of pencil marks presents a secondary layout challenge. Each individual cell must be capable of rendering up to 9 distinct candidates, arranged in a miniature 3x3 matrix, without disrupting the macro alignment of the primary board. CSS Subgrid is the optimal technology for this requirement. By applying `display: grid` and `grid-template-columns: subgrid` to the `Cell.tsx` components, the internal candidate numbers bypass their immediate container and align directly to the tracking parameters of the master board.

This guarantees that pencil marks across adjacent cells share flawless horizontal and vertical tracking. Whether a cell contains two candidates or eight, the typographic alignment remains perfectly anchored, drastically improving readability for the user.

CSS Subgrid reached Baseline "widely available" status in early 2026 (support has been in Chrome/Edge, Firefox, and Safari since 2023-ish, and cross-browser consistency has caught up since) — it's safe to use in production without a fallback for this project. One caveat: avoid nesting subgrid more than two levels deep, since Chrome, Firefox, and Safari still disagree on edge-case gap and auto-sizing behavior at deeper nesting.

### 5.3 React Profiling and the Eradication of Layout Thrashing

To ensure the CSS rendering pipeline is not bottlenecked by JavaScript execution, the development team must aggressively monitor component lifecycles using the React DevTools Profiler. When processing high-frequency state updates—such as rapidly scanning the board via the numpad or utilizing real-time error checking—unoptimized components will exhibit layout thrashing. Developers must activate the "Record why each component rendered while profiling" feature within the DevTools settings. By recording a session of rapid numeric input, the resulting flame graph provides incontrovertible evidence of optimization efficacy.

A properly architected application will display a single green or yellow bar representing the mutated cell, while the remaining 80 cells manifest as gray bars, indicating they successfully bypassed the render phase. If the flame graph reveals widespread component updates, developers must immediately audit the `useCallback` implementations and `React.memo` wrappers guarding the `Cell.tsx` properties, ensuring that complex objects or anonymous functions are not destroying referential equality checks.

## 6. Accessibility Integration: WAI-ARIA and Keyboard Navigation

### 6.1 Semantic Modeling and the Rejection of Table Paradigms

Migrating from a static document generation flow to a fully interactive digital interface introduces stringent accessibility requirements. For users relying on assistive technologies, a matrix of `div` elements visually styled via CSS Grid conveys zero semantic context. Initial implementations of complex data grids often attempt to force native HTML `<table>` semantics onto interactive elements. However, extensive testing across screen readers (such as VoiceOver and NVDA) has proven that native table semantics fail significantly when cells contain complex interactive behaviors like toggle buttons or candidate arrays.

Consequently, the application must explicitly implement the WAI-ARIA grid specifications. The parent container must utilize `role="grid"`, while individual rows (if utilized) receive `role="row"`. The interactive cells themselves must be assigned `role="gridcell"`. If the architectural design flattens the DOM structure for CSS Grid efficiency (omitting structural row elements), developers must mathematically inject `aria-rowindex` and `aria-colindex` attributes directly into each `gridcell`. This precise numerical mapping guarantees that the screen reader correctly interprets the cell's physical coordinate within the 2D plane.

### 6.2 Spatial Focus Management: The Roving Tabindex

A critical directive of the WAI-ARIA Authoring Practices Guide (APG) for composite widgets is the enforcement of single-tab-stop navigation. If a keyboard user navigates a page via the `Tab` key, tabbing into the Sudoku board should focus the currently active cell. Pressing `Tab` a second time must exit the board entirely, focusing the next sequential element on the page (such as the numpad or footer). Forcing a user with a motor disability to press `Tab` 81 consecutive times to escape the game board is a severe accessibility failure.

Once the user has tabbed into the board, internal navigation must be exclusively controlled via the directional arrow keys. This is achieved by implementing the "roving tabindex" pattern. The currently active cell is assigned `tabIndex={0}`, placing it in the document's sequential focus flow. The remaining 80 inert cells are assigned `tabIndex={-1}`. This removes them from the default tab sequence while ensuring they remain programmatically focusable via JavaScript.

A centralized `keydown` event listener monitors arrow key inputs. When an arrow key is depressed, the application calculates the coordinates of the adjacent target cell. The application programmatically fires `.focus()` on the target DOM node, updates its state to `tabIndex={0}`, and simultaneously downgrades the previously focused cell to `tabIndex={-1}`. To prevent user frustration during keyboard navigation, the application must also invoke `event.preventDefault()` and `event.stopPropagation()` on arrow key inputs to suppress the browser's default behavior of scrolling the viewport.

### 6.3 Contextual State Announcement and Dynamic Labeling

Beyond spatial movement, the screen reader must audibly describe the highly contextual state of the active cell. Standard `gridcell` roles lack the vocabulary to explain Sudoku-specific mechanics. The application must dynamically compute an `aria-label` or `aria-labelledby` attribute for every cell based on the global Zustand state.

If the user focuses on a cell containing an immutable starting number, the label must synthesize a descriptive string, such as "Given clue 7, Row 2, Column 4". If the cell contains user-generated pencil marks, the label must parse the array, announcing "Candidates 2, 5, and 8". Furthermore, interactive state toggles, such as the numpad button that activates "Pencil Mode," must utilize `aria-pressed` to confirm the operational shift, ensuring visually impaired users receive immediate auditory feedback regarding mode transitions.

## 7. Testing Methodologies and Simulation Environments

### 7.1 Vitest Configuration and Zustand Isolation

Guaranteeing the stability of complex interactive logic and roving tabindex behaviors requires comprehensive automated UI testing utilizing the Arrange-Act-Assert (AAA) methodology. The implementation plan pairs Vitest as the high-speed execution runner with React Testing Library (RTL) and jsdom for DOM emulation. This matches Next.js's own official testing guidance — the framework docs include a first-party Vitest setup guide for the App Router, and Vitest is the current default recommendation for new Next.js projects over Jest (faster startup, native ESM support, no `ts-jest`/`babel-jest` config needed). Keep Jest in mind only if this project later needs React Native/Expo compatibility, which isn't a concern here.

A persistent architectural vulnerability when testing global state managers like Zustand in concurrent runners like Vitest is the risk of state leakage. Because Vitest executes tests sequentially in the same node memory process by default, mutations applied to the global store in Test A will persist and pollute the initial conditions of Test B. To eradicate test flakiness, the environment must instantiate a global mock for Zustand.

By constructing a custom mock file (e.g., `src/__mocks__/zustand.ts`), developers can intercept the store creation lifecycle. The mock captures the `initialState` payload of every instantiated store and registers a custom reset function within a centralized `storeResetFns` Set. A global `afterEach` hook is subsequently declared, iterating over the `storeResetFns` Set and executing each reset function within a React `act()` block. This rigorous teardown sequence guarantees a perfectly sterile state environment for every individual test iteration.

### 7.2 Simulating Asynchronous User Interactions

The philosophical core of React Testing Library mandates that components must be tested through the lens of human interaction, rather than through direct invocation of internal methods or state properties. Consequently, validating the hybrid control schemes and keyboard navigation necessitates the utilization of the `@testing-library/user-event` package.

Because the `user-event` API heavily simulates the complex cascade of internal browser events (e.g., `keydown`, `keypress`, `keyup`), its execution is inherently asynchronous. When writing integration tests to verify the roving tabindex logic, the test blocks must implement `async`/`await` syntax. The test logic must query the semantic tree to isolate the initial cell (e.g., `screen.getByRole('gridcell', { name: /row 1, column 1/i })`), invoke `.focus()`, and subsequently await the simulated keyboard event via `await userEvent.keyboard('[ArrowRight]')`. The final assertion verifies the success of the programmatic focus shift utilizing `expect(adjacentCell).toHaveFocus()`. By strictly enforcing asynchronous simulation, the test suite accurately validates the synergy between the WAI-ARIA accessibility layer, the React event loop, and the underlying Zustand state mutations.

## 8. Conclusion

The transition from a stateless puzzle generator to a high-performance, interactive React application is a complex architectural undertaking that requires deep synergy between state management, rendering optimization, and algorithmic execution. By aggressively decoupling the application state from the component tree via Zustand, and leveraging `useShallow` alongside granular selective subscriptions, the application nullifies the layout thrashing and input latency associated with the React Context API in high-frequency update scenarios.

The deployment of the `zundo` temporal middleware, precisely partialized to exclude continuous timers, delivers an instantaneous, snapshot-based undo/redo history stack without bloating memory. At the algorithmic level, replacing static PDFs with a recursive backtracking engine ensures the on-demand generation of deterministic puzzles with mathematically guaranteed unique solutions across 4x4, 6x6, and 9x9 topologies. Precomputing peer dependencies into an $O(1)$ matrix guarantees that advanced candidate reduction algorithms execute in zero-time during rapid gameplay.

Visually, CSS Grid and Subgrid frameworks establish immutable, responsive layouts that maintain strict typographic alignment of pencil marks without polluting the DOM with extraneous elements. Finally, by discarding standard table roles in favor of strict WAI-ARIA grid semantics and an expertly managed roving tabindex pattern, the application guarantees equal access for keyboard-only users and assistive technologies. Ultimately, this architectural blueprint fuses algorithmic rigor, cutting-edge rendering optimizations, and uncompromising accessibility standards to deliver a scalable, professional-grade interactive puzzle platform.

## Research Update Log (July 2026)

- Removed ~90 meaningless `[cite: NNNN]` markers throughout the document (artifacts from the original research tool with no accompanying bibliography — pure noise).
- Zustand: confirmed it's still the right default in 2026 (largest ecosystem, 50%+ adoption); added a short section naming Jotai as the main alternative and when it would actually matter (deeply derived state), so the choice isn't presented as beyond question.
- Softened an unsourced, suspiciously precise performance stat ("70% faster, 55ms→15ms") in the Zustand section — no such benchmark could be verified, and it read as a fabricated citation.
- Clarified `useSyncExternalStore` is a React 18 API still used under the hood in React 19, since the project will run on React 19 / Next.js 16.
- Added a maintenance-status caveat for `zundo` (slow release cadence, effectively "finished") and pointed to `zustand-travel` as the actively maintained alternative if richer time-travel is ever needed.
- Added a new subsection (4.4) on a real, project-specific gotcha: SSR hydration mismatches from `Math.random()`-based puzzle generation in the Next.js App Router, with two concrete fixes (client-only generation vs. seeded PRNG).
- Confirmed CSS Subgrid reached Baseline "widely available" in March 2026 — safe for production without a fallback; added a nesting-depth caveat.
- Confirmed the Vitest + React Testing Library recommendation matches Next.js's own official testing docs (not just a third-party opinion), and explained why Vitest over Jest for this project specifically.
- Verified the WAI-ARIA grid/roving-tabindex/`aria-rowindex`/`aria-colindex` guidance against the current W3C ARIA Authoring Practices Guide — no changes needed, it's accurate.
- Trimmed redundant restatements of the same point across adjacent paragraphs (e.g., Context API re-render explanation repeated in 2.1 and 2.2).
