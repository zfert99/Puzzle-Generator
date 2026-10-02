'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GridSizeSelector, type SelectableSize } from '@/features/puzzle-configuration/components/GridSizeSelector';
import { SKYSCRAPERS_TIERS_BY_SIZE } from '@/features/engine/skyscrapers/skyscrapers';
import type { SkyscrapersSize } from '@/features/engine/skyscrapers/skyscrapers-types';
import type { Difficulty } from '@/features/engine/sudoku';
import { useBoardStore } from '../store/useBoardStore';
import { useSavedGame, formatElapsed } from '../store/useSavedGame';
import { usePuzzle } from '../hooks/usePuzzle';
import { Board } from './Board/Board';
import { Numpad } from './Controls/Numpad';
import { GameHeader } from './Header/GameHeader';
import { KeyboardHints } from './KeyboardHints';
import { SolvedDialog } from './SolvedDialog';
import { ConfirmModal } from './ConfirmModal';
import { KakuroDevBadge } from './KakuroDevBadge';
import { SkyscrapersDevBadge } from './SkyscrapersDevBadge';
import { HintNote } from './HintNote';

const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'extreme'];

// Hydration-safe "are we on the client yet?" — false during SSR/hydration, true
// afterward — without a setState-in-effect. Gates rendering of persisted store state.
const noopSubscribe = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Client-side orchestrator for `/play`. Menu-first: it always opens on the config screen,
 * which offers a **Continue** button when a saved free-play game exists (the board store
 * persists one game to localStorage) and warns before a new game erases it. A local `view`
 * ('config' | 'playing') drives which screen shows — decoupled from store `status`, so the
 * menu can display while an unsolved game is still parked in the store.
 *
 * The timer ticks only while actively on the board (`view === 'playing'`), so stepping back
 * to the menu — or leaving the page — freezes it, and Continue resumes from where it stopped.
 */

type PlayVariant = 'classic' | 'killer' | 'calc' | 'kakuro' | 'skyscrapers';

/**
 * The sizes each type offers on this menu. Kakuro's and Skyscrapers' are their own (plan rule
 * D11), not 4/6/9 — Skyscrapers at 5/6/7 is the plan's D4, planned at the research
 * recommendation and still measured by E3.
 */
const SIZES: Record<PlayVariant, readonly SelectableSize[]> = {
  classic: [4, 6, 9],
  killer: [6, 9],
  calc: [4, 6, 9],
  kakuro: [6, 7, 9],
  skyscrapers: [5, 6, 7],
};

const VARIANT_LABEL: Record<PlayVariant, string> = {
  classic: 'Sudoku',
  killer: 'Killer',
  calc: 'Keisan',
  kakuro: 'Kakuro',
  skyscrapers: 'Skyscrapers',
};

function parseVariant(value: string | null): PlayVariant {
  return value === 'killer' || value === 'calc' || value === 'kakuro' || value === 'skyscrapers' ? value : 'classic';
}

/**
 * The tiers a type offers at a size — the one rule every lock decision uses (the picker, and the
 * clamps on switching type or size), so a new size or type changes it in one place. Expert and
 * Extreme are 9×9-only for the Sudoku family; Kakuro ships its full ladder at every size;
 * Skyscrapers' sets are the engine's own (`SKYSCRAPERS_TIERS_BY_SIZE`, plan D12: the 5×5 mini tops
 * out at hard, the 7×7 large starts at medium — the sizes offer what they can produce).
 */
function tiersFor(variant: PlayVariant, size: SelectableSize): readonly Difficulty[] {
  if (variant === 'skyscrapers') return SKYSCRAPERS_TIERS_BY_SIZE[size as SkyscrapersSize] ?? ALL_DIFFICULTIES;
  if (variant === 'kakuro' || size === 9) return ALL_DIFFICULTIES;
  return ALL_DIFFICULTIES.slice(0, 3);
}

/** The picked tier if the type offers it at this size, else the nearest one it does (lower wins a tie). */
function clampDifficulty(difficulty: Difficulty, tiers: readonly Difficulty[]): Difficulty {
  if (tiers.includes(difficulty)) return difficulty;
  const wanted = ALL_DIFFICULTIES.indexOf(difficulty);
  return [...tiers].sort((a, b) => Math.abs(ALL_DIFFICULTIES.indexOf(a) - wanted) - Math.abs(ALL_DIFFICULTIES.indexOf(b) - wanted))[0];
}

export default function PlayExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  // Deep link from a hub card (`/play?variant=killer|calc|kakuro`): preselect the variant as the
  // initial state (not via a setState-in-effect). Keisan (`calc`) comes in 4/6/9; it seeds 6 (the
  // friendly mid size) rather than the classic default of 9. Kakuro seeds its mini, 6 (D6′);
  // Skyscrapers seeds its planned standard, 6 (D4).
  const initialVariant = parseVariant(searchParams.get('variant'));
  const [variant, setVariant] = useState<PlayVariant>(initialVariant);
  const [gridSize, setGridSize] = useState<SelectableSize>(
    initialVariant === 'calc' || initialVariant === 'kakuro' || initialVariant === 'skyscrapers' ? 6 : 9
  );
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [mystery, setMystery] = useState(false); // Keisan Mystery (no-op) toggle — hide operators
  const [view, setView] = useState<'config' | 'playing'>('config');
  const [viewingSolved, setViewingSolved] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [resumeHandled, setResumeHandled] = useState(false);
  const isKiller = variant === 'killer';
  const isCalc = variant === 'calc';
  // Kakuro is generated server-side since E4 and graded by the logical solver (easy…hard by
  // technique tier, expert/extreme by forcing-chain length); the label is the solver's.
  const isKakuro = variant === 'kakuro';
  // Skyscrapers generates fresh puzzles at exactly the picked tier (E5); each size offers the tiers
  // it can produce (D12) and the picker greys out the rest.
  const isSkyscrapers = variant === 'skyscrapers';
  const wantsResume = searchParams.get('resume') === '1';

  const { loading, error, fetchPuzzle } = usePuzzle();
  const status = useBoardStore((s) => s.status);
  const boardVariant = useBoardStore((s) => s.variant);
  const startNewGame = useBoardStore((s) => s.startNewGame);
  const resume = useBoardStore((s) => s.resume);
  const tick = useBoardStore((s) => s.tick);

  const saved = useSavedGame();

  // Deep link from the hub's Continue banner (`/play?resume=1`): jump straight into the saved
  // free-play game instead of the menu. Adjust state during render (once, after mount, when the
  // persisted game is readable) — the sanctioned prev-value pattern, not a setState-in-effect.
  // Only honor it for a play-mode game so a daily in the shared store never opens here.
  if (mounted && wantsResume && !resumeHandled) {
    setResumeHandled(true);
    if (saved?.mode === 'play') setView('playing');
  }
  // Unpause the resumed game (store action, not React state).
  useEffect(() => {
    if (view === 'playing' && wantsResume && useBoardStore.getState().status === 'paused') resume();
  }, [view, wantsResume, resume]);
  const savedIsPlay = saved?.mode === 'play';

  // Timer: active only while actively playing on the board — never on the menu or when paused.
  useEffect(() => {
    if (view !== 'playing' || status !== 'playing') return;
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [view, status, tick]);

  const miniGrid = gridSize !== 9;
  const offeredTiers = tiersFor(variant, gridSize);

  const handleGridSizeChange = (size: SelectableSize) => {
    setGridSize(size);
    setDifficulty(clampDifficulty(difficulty, tiersFor(variant, size)));
  };

  const handleVariantChange = (v: PlayVariant) => {
    setVariant(v);
    // A size the new type doesn't offer falls back to the type's first (smallest) size — Killer
    // has no 4×4, the Sudoku family has no 7×7 — and a tier it doesn't offer there to the nearest
    // one it does (expert on a mini → hard; easy on a 7×7 Skyscrapers → medium).
    const nextSize = SIZES[v].includes(gridSize) ? gridSize : SIZES[v][0];
    if (nextSize !== gridSize) setGridSize(nextSize);
    setDifficulty(clampDifficulty(difficulty, tiersFor(v, nextSize)));
  };

  const startFresh = async () => {
    const puzzle = await fetchPuzzle({ difficulty, gridSize, variant, noOp: isCalc && mystery });
    if (puzzle) {
      setViewingSolved(false);
      startNewGame(puzzle); // mode defaults to 'play'; variant/cages come from the puzzle
      setView('playing');
    }
  };

  // New game erases the single saved slot (play OR daily) — warn first if one exists.
  const handlePlay = () => {
    if (saved) setWarnOpen(true);
    else void startFresh();
  };

  const confirmNew = () => {
    setWarnOpen(false);
    void startFresh();
  };

  const handleContinue = () => {
    if (status === 'paused') resume();
    setViewingSolved(false);
    setView('playing');
  };

  // "Keep playing" — take the player to their saved game: resume it here if it's a free-play
  // game, otherwise go to the surface that owns it (a saved daily lives on /daily).
  const keepPlaying = () => {
    setWarnOpen(false);
    if (saved?.mode === 'play') handleContinue();
    else if (saved) router.push('/daily');
  };

  // Avoid a hydration mismatch: render a neutral placeholder until mounted.
  if (!mounted) {
    return <div className="glass-panel p-8 max-w-md w-full mx-auto h-48" aria-hidden="true" />;
  }

  // ---- Config / menu screen ----
  if (view !== 'playing') {
    return (
      <div className="glass-panel p-8 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-semibold mb-6 text-center">New Game</h2>

        {savedIsPlay && saved && (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleContinue}
              className="btn-primary w-full text-lg flex justify-center items-center"
            >
              Continue{' '}
              {saved.variant === 'classic' ? `${saved.gridSize}×${saved.gridSize}` : VARIANT_LABEL[saved.variant]}{' '}
              {saved.difficulty} · {formatElapsed(saved.elapsedTime)}
            </button>
            <p className="text-xs text-ink-soft text-center mt-3">— or start a new game —</p>
          </div>
        )}

        {/* Puzzle type toggle. role=group + aria-pressed (QA F10): selection must be announced,
            not carried by background colour alone. */}
        {/* Five equal columns: a wrapping flex row would strand the fifth label on its own full-width line. */}
        <div role="group" aria-label="Puzzle type" className="grid grid-cols-5 gap-2 mb-6">
          {(['classic', 'killer', 'calc', 'kakuro', 'skyscrapers'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={variant === v}
              onClick={() => handleVariantChange(v)}
              className={`px-2 py-2 rounded-lg text-sm font-medium border-2 border-ink transition-all ${
                variant === v ? 'bg-butterscotch text-ink' : 'bg-paper hover:bg-paper-2'
              }`}
            >
              {VARIANT_LABEL[v]}
            </button>
          ))}
        </div>

        {/* One selector, per-variant size list: Killer is 6/9, Keisan (Calcudoku) is 4/6/9, Kakuro 6/7/9, Skyscrapers 5/6/7. */}
        <GridSizeSelector value={gridSize} onChange={handleGridSizeChange} sizes={SIZES[variant]} />

        <div className="mb-6">
          {/* Span + aria-labelledby + aria-pressed (QA F10) — same reasoning as GridSizeSelector. */}
          <span id="play-difficulty-label" className="block text-sm font-medium text-ink-soft mb-2 text-center">
            Difficulty
          </span>
          <div role="group" aria-labelledby="play-difficulty-label" className="flex flex-wrap justify-center gap-2">
            {ALL_DIFFICULTIES.map((d) => {
              const disabled = !offeredTiers.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  aria-pressed={difficulty === d}
                  onClick={() => setDifficulty(d)}
                  className={`px-3 py-2 rounded-lg text-sm capitalize transition-all ${
                    difficulty === d ? 'bg-butterscotch text-ink border-2 border-ink' : 'bg-paper border-2 border-ink hover:bg-paper-2'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {isKakuro ? (
            <p className="text-xs text-ink-soft text-center mt-2">
              Kakuro is new: every puzzle is graded by the solver, and every level is logic-only — the header shows the grade it earned.
            </p>
          ) : isSkyscrapers ? (
            <p className="text-xs text-ink-soft text-center mt-2">
              Skyscrapers is new: every puzzle is fresh, unique and graded by the solver — logic only, no guessing. The 5×5 tops out at hard; the 7×7 starts at medium.
            </p>
          ) : (
            miniGrid && (
              <p className="text-xs text-ink-soft text-center mt-2">Expert and Extreme are only available for 9×9 grids.</p>
            )
          )}
          {isKiller && difficulty === 'extreme' && (
            <p className="text-xs text-ink-soft text-center mt-2">Extreme Killers are rare finds — generating one can take ~10 seconds.</p>
          )}
          {isCalc && difficulty === 'extreme' && (
            <p className="text-xs text-ink-soft text-center mt-2">Extreme Keisan needs many hypothesis steps — generating one can take a few seconds.</p>
          )}
        </div>

        {/* Mystery / No-Op toggle — Keisan only. Hides the cage operators; an orthogonal modifier over
            any size/difficulty (the operator becomes part of the puzzle). */}
        {isCalc && (
          <div className="mb-6">
            <button
              type="button"
              role="switch"
              aria-checked={mystery}
              onClick={() => setMystery((m) => !m)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border-2 border-ink transition-all ${
                mystery ? 'bg-butterscotch text-ink' : 'bg-paper hover:bg-paper-2'
              }`}
            >
              <span className="text-sm font-medium">🔮 Mystery mode</span>
              <span className={`text-xs px-2 py-0.5 rounded ${mystery ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-soft'}`}>
                {mystery ? 'ON' : 'OFF'}
              </span>
            </button>
            <p className="text-xs text-ink-soft text-center mt-2">
              Operators are hidden — deduce whether each cage is + − × ÷ as well as its digits.
            </p>
          </div>
        )}

        {error && <p className="text-cherry text-sm mb-4 text-center">{error}</p>}

        <button
          type="button"
          onClick={handlePlay}
          disabled={loading}
          className="btn-primary w-full text-lg flex justify-center items-center"
        >
          {loading ? 'Generating…' : 'Play'}
        </button>

        <ConfirmModal
          open={warnOpen}
          title="Start a new puzzle?"
          message="You have a saved puzzle in progress. Starting a new one will erase it — you can only save one puzzle at a time."
          confirmLabel="Start new"
          cancelLabel="Keep playing"
          onConfirm={confirmNew}
          onCancel={keepPlaying}
          onDismiss={() => setWarnOpen(false)}
        />
      </div>
    );
  }

  // ---- Game ----
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[520px] mx-auto mb-2">
        <button
          type="button"
          onClick={() => setView('config')}
          className="text-sm text-ink-soft hover:text-ink hover:underline"
        >
          ← Menu
        </button>
      </div>

      <GameHeader />

      {status === 'paused' ? (
        <div className="w-[min(92vw,520px)] aspect-square flex items-center justify-center rounded-lg bg-paper text-ink-soft">
          Paused
        </div>
      ) : (
        <Board />
      )}

      <Numpad />

      <HintNote />

      {/* E1/E2's visible proof that real solvers sit behind the board — development only. */}
      {process.env.NODE_ENV === 'development' && boardVariant === 'kakuro' && <KakuroDevBadge />}
      {process.env.NODE_ENV === 'development' && boardVariant === 'skyscrapers' && <SkyscrapersDevBadge />}

      <KeyboardHints />

      {status === 'solved' && !viewingSolved && (
        <SolvedDialog
          ariaLabel="Solved"
          stampLabel="Solved!"
          elapsedSeconds={useBoardStore.getState().elapsedTime}
          mistakes={useBoardStore.getState().mistakes}
          primaryLabel="New puzzle"
          onPrimary={() => setView('config')}
          secondaryAction={
            <button
              type="button"
              onClick={() => setViewingSolved(true)}
              className="px-5 py-3 rounded-lg border border-ink hover:bg-paper-2 transition-colors"
            >
              View puzzle
            </button>
          }
        />
      )}
    </div>
  );
}
