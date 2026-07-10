'use client';

import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../store/useBoardStore';
import type { Difficulty } from '@/features/engine/sudoku';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface GameHeaderProps {
  difficulty: Difficulty;
}

/**
 * Game status bar: difficulty + grid size, a live timer, Pause/Resume (pausing hides
 * the board — see PlayExperience), and the real-time-error-checking toggle.
 */
export function GameHeader({ difficulty }: GameHeaderProps) {
  const { size, elapsedTime, status, realTimeErrors } = useBoardStore(
    useShallow((s) => ({
      size: s.config.size,
      elapsedTime: s.elapsedTime,
      status: s.status,
      realTimeErrors: s.realTimeErrors,
    }))
  );
  const pause = useBoardStore((s) => s.pause);
  const resume = useBoardStore((s) => s.resume);
  const toggleRealTimeErrors = useBoardStore((s) => s.toggleRealTimeErrors);

  return (
    <div className="w-full max-w-[520px] mx-auto mb-4 flex items-center justify-between gap-4 text-sm">
      <span className="capitalize font-medium">
        {difficulty} · {size}×{size}
      </span>

      <span className="font-mono tabular-nums text-base" aria-live="off" aria-label="Elapsed time">
        {formatTime(elapsedTime)}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={realTimeErrors}
          onClick={() => toggleRealTimeErrors()}
          className={`px-2 py-1 rounded transition-colors ${
            realTimeErrors ? 'bg-indigo-600 text-white' : 'bg-white/10 hover:bg-white/20'
          }`}
          title="Highlight incorrect entries"
        >
          Errors
        </button>
        {status === 'paused' ? (
          <button type="button" onClick={() => resume()} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20">
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() => pause()}
            disabled={status !== 'playing'}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40"
          >
            Pause
          </button>
        )}
      </div>
    </div>
  );
}
