'use client';

import { useState } from 'react';

export default function PuzzleForm() {
  // State for loading, counts, and error handling
  const [loading, setLoading] = useState(false);
  // State for counts
  const [counts, setCounts] = useState({
    easy: 2,
    medium: 2,
    hard: 2,
    expert: 0
  });
  // State for error handling
  const [error, setError] = useState('');

  // Handler for changing the count of a specific difficulty
  const handleChange = (diff: keyof typeof counts, value: string) => {
    const num = parseInt(value) || 0;
    setCounts(prev => ({ ...prev, [diff]: num }));
  };

  // Handler for generating the PDF
  const handleGenerate = async () => {
    setError('');
    const total = counts.easy + counts.medium + counts.hard + counts.expert;
    if (total === 0) {
      setError('Please select at least one puzzle to generate.');
      return;
    }
    if (total > 50) {
      setError('Too many puzzles. Maximum is 50 per request.');
      return;
    }
    // Set loading to true
    setLoading(true);
    // Try to generate the PDF
    try {
      // Fetch the PDF from the API
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(counts)
      });

      // Check if the response is OK
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate PDF');
      }

      // Download the PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Sudoku_Puzzles.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Form for generating Sudoku puzzles with nice styling and error handling
    <div className="glass-panel p-8 max-w-md w-full mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Sudoku Configuration</h2>

      {/* Grid for selecting the number of puzzles for each difficulty */}
      <div className="space-y-4 mb-8">
        {/* Map over the difficulties and create an input field for each difficulty */
          (['easy', 'medium', 'hard', 'expert'] as const).map(diff => (
            <div key={diff} className="flex items-center justify-between">
              {/* Label for the difficulty */}
              <label className="capitalize font-medium text-lg w-1/3">{diff}</label>
              {/* Input field for the number of puzzles for the current difficulty */}
              <input
                type="number"
                min="0"
                max="50"
                value={counts[diff]}
                onChange={(e) => handleChange(diff, e.target.value)}
                className="input-field w-2/3 ml-4"
                placeholder="0"
              />
            </div>
          ))}
        {/* Note for the user */}
        <p className="text-sm text-gray-400 text-center mt-2">You can generate 1–50 puzzles total per request.</p>
        {counts.expert > 0 && (
          <p className="text-yellow-500 text-sm font-medium mt-2 text-center px-4">
            Warning: Generating Expert puzzles requires advanced logical validation and may take up to 30 seconds.
          </p>
        )}
      </div>

      {/* Error handling */}
      {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

      {/* Button for generating the PDF */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="btn-primary w-full text-lg flex justify-center items-center"
      >
        {loading ? (
          // Loading spinner and text
          <span className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Generating...</span>
          </span>
        ) : (
          'Generate PDF'
        )}
      </button>
    </div>
  );
}
