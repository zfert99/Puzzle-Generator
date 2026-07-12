import PuzzleForm from '@/features/puzzle-configuration/components/PuzzleForm';

/**
 * Home Page (/)
 * 
 * This is the main landing page for the Puzzle Generator application.
 * It provides the primary user interface for selecting puzzle difficulty
 * levels and generating the downloadable PDF book.
 * 
 * We use a minimalist, premium design aesthetic with a subtle background pattern
 * and a gradient text effect for the main title to achieve a high-end feel.
 */
export default function Home() {
  return (
    // Main container forces the layout to take up at least the full screen height (min-h-screen)
    // and centers all content both horizontally and vertically.
    // A subtle SVG background pattern is applied via Tailwind arbitrary values.
    <main className="flex-1 flex flex-col items-center justify-center p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">

      {/* Header Section */}
      <div className="text-center mb-12">
        {/* The main title uses a transparent background clip with a gradient to create a sleek metallic/glass look */}
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-ink">
          PDF Puzzle Generator
        </h1>
        {/* A simple, descriptive subtitle explaining the app's core value proposition */}
        <p className="text-lg text-ink-soft max-w-xl mx-auto">
          Create customized, print-ready Sudoku puzzle books with interactive answer keys in seconds.
        </p>
      </div>

      {/* 
        The PuzzleForm component handles all the interactive state (sliders, inputs)
        and manages the API request to the backend generation route.
        By extracting this into a separate client component, we keep this main page
        as a fast, statically renderable server component.
      */}
      <PuzzleForm />

      {/* Simple, unobtrusive footer pushed to the bottom */}
      <footer className="mt-20 text-sm text-ink-soft">
        Minimalist Premium Design &copy; 2026
      </footer>
    </main>
  );
}
