import PuzzleForm from '@/components/PuzzleForm';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-[url('/bg-pattern.svg')] bg-cover bg-center">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
          PDF Puzzle Generator
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
          Create customized, print-ready Sudoku puzzle books with interactive answer keys in seconds.
        </p>
      </div>

      <PuzzleForm />

      <footer className="mt-20 text-sm text-gray-500">
        Minimalist Premium Design &copy; 2026
      </footer>
    </main>
  );
}
