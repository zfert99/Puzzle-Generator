'use client';

import { useShallow } from 'zustand/react/shallow';
import { useBoardStore } from '../../store/useBoardStore';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Game status bar: difficulty + grid size, a live timer, a mistakes counter,
 * Pause/Resume (pausing hides the board — see PlayExperience), and the
 * real-time-error-checking toggle. Reads everything (including difficulty) from the
 * store so it survives a persisted refresh.
 */
export function GameHeader() {
  const { size, difficulty, elapsedTime, mistakes, status, realTimeErrors } = useBoardStore(
    useShallow((s) => ({
      size: s.config.size,
      difficulty: s.difficulty,
      elapsedTime: s.elapsedTime,
      mistakes: s.mistakes,
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

      <div className="flex items-center gap-3">
        <span className="font-mono tabular-nums text-base" aria-live="off" aria-label="Elapsed time">
          {formatTime(elapsedTime)}
        </span>
        <span
          className="text-ink-soft tabular-nums"
          aria-label={`${mistakes} mistake${mistakes === 1 ? '' : 's'}`}
          title="Mistakes"
        >
          ✗ {mistakes}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={realTimeErrors}
          onClick={() => toggleRealTimeErrors()}
          className={`px-2 py-1 rounded transition-colors ${
            realTimeErrors ? 'bg-butterscotch text-ink' : 'bg-paper border-2 border-ink hover:bg-paper-2'
          }`}
          title="Highlight incorrect entries"
        >
          Errors
        </button>
        {status === 'paused' ? (
          <button type="button" onClick={() => resume()} className="px-2 py-1 rounded bg-paper border-2 border-ink hover:bg-paper-2">
            Resume
          </button>
        ) : (
          <button
            type="button"
            onClick={() => pause()}
            disabled={status !== 'playing'}
            className="px-2 py-1 rounded bg-paper border-2 border-ink hover:bg-paper-2 disabled:opacity-40"
          >
            Pause
          </button>
        )}
      </div>
    </div>
  );
}
