/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PuzzleForm from './PuzzleForm';
import { usePuzzleGeneration } from '../hooks/usePuzzleGeneration';

// Mock the hook
jest.mock('../hooks/usePuzzleGeneration');
const mockUsePuzzleGeneration = usePuzzleGeneration as jest.MockedFunction<typeof usePuzzleGeneration>;

describe('PuzzleForm Component', () => {
  const mockGenerate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePuzzleGeneration.mockReturnValue({
      loading: false,
      error: '',
      generate: mockGenerate,
    });
  });

  it('renders correctly with default values', () => {
    render(<PuzzleForm />);
    expect(screen.getByRole('heading', { name: /sudoku configuration/i })).toBeInTheDocument();
    
    // Check if the generate button is present
    expect(screen.getByRole('button', { name: /generate pdf/i })).toBeInTheDocument();
  });

  it('calls generate with correct configuration when submitted', async () => {
    const user = userEvent.setup();
    render(<PuzzleForm />);

    // In a real app we'd interact with sliders here, but let's just test submission with default counts
    // Defaults: gridSize=9, easy=2, medium=2, hard=2, expert=0, extreme=0
    const generateBtn = screen.getByRole('button', { name: /generate pdf/i });
    await user.click(generateBtn);

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith({
      gridSize: 9,
      easy: 2,
      medium: 2,
      hard: 2,
      expert: 0,
      extreme: 0
    });
  });

  it('displays loading state correctly', () => {
    mockUsePuzzleGeneration.mockReturnValue({
      loading: true,
      error: '',
      generate: mockGenerate,
    });

    render(<PuzzleForm />);
    
    const generateBtn = screen.getByRole('button', { name: /generating/i });
    expect(generateBtn).toBeDisabled();
    expect(generateBtn).toBeInTheDocument();
  });

  it('displays error message when error is present', () => {
    mockUsePuzzleGeneration.mockReturnValue({
      loading: false,
      error: 'Too many puzzles.',
      generate: mockGenerate,
    });

    render(<PuzzleForm />);
    
    expect(screen.getByText('Too many puzzles.')).toBeInTheDocument();
  });
});
