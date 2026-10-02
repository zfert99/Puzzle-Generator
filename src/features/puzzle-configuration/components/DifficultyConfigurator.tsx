import React from 'react';
import type { SelectableSize } from './GridSizeSelector';

const DIFFICULTIES_BY_SIZE: Record<number, string[]> = {
  4: ['easy', 'medium', 'hard'],
  6: ['easy', 'medium', 'hard'],
  5: ['easy', 'medium', 'hard', 'expert', 'extreme'], // only Skyscrapers is 5×5; its tiers are per size (D6)
  7: ['easy', 'medium', 'hard', 'expert', 'extreme'], // Kakuro and Skyscrapers are 7×7, both with the full ladder
  9: ['easy', 'medium', 'hard', 'expert', 'extreme'],
};

interface Props {
  /** The active variant's size — drives the fallback ladder when `difficulties` is not given. */
  gridSize: SelectableSize;
  counts: Record<string, number>;
  onChange: (difficulty: string, value: number) => void;
  /** Override the available difficulties (e.g. Killer offers only easy/medium/hard). */
  difficulties?: string[];
  /** Variant, so the slow-generation warning names the right techniques + time range. */
  variant?: 'classic' | 'killer' | 'calc' | 'kakuro' | 'skyscrapers';
  /** Keisan Mystery / No-Op mode — hiding the operators makes unique boards rarer, so much slower. */
  mystery?: boolean;
}

/**
 * The slow-generation warning, tailored to variant + selected tiers + Mystery mode. Time ranges are
 * from measured 9×9 generation (per-puzzle avg → tail): classic Extreme ~5s; Keisan Expert ~1.5s /
 * Extreme ~2s; Mystery multiplies those ~5–8× (the operator-union table makes unique boards rare),
 * so Mystery Extreme can run tens of seconds. Returns `null` when nothing slow is selected.
 */
function slowGenerationWarning(
  variant: 'classic' | 'killer' | 'calc' | 'kakuro' | 'skyscrapers',
  counts: Record<string, number>,
  mystery: boolean,
): string | null {
  const hasExpert = (counts.expert ?? 0) > 0;
  const hasExtreme = (counts.extreme ?? 0) > 0;

  if (variant === 'calc') {
    if (mystery && hasExtreme) {
      return 'Heads up: Mystery Extreme is the slowest to generate — the hidden operators make unique boards rare, so expect roughly 15–30 seconds per puzzle and occasionally up to a minute. (Mystery Expert runs ~5–15 seconds each.)';
    }
    if (mystery && hasExpert) {
      return 'Heads up: with Mystery on, Expert puzzles take roughly 5–15 seconds each to generate — hiding the operators makes unique boards rarer.';
    }
    if (mystery && (hasExpert || hasExtreme)) return null; // (covered above)
    if (hasExtreme) {
      return 'Note: Keisan Extreme needs many hypothesis (guess-and-check) steps, so expect ~2–5 seconds per puzzle (occasionally more).';
    }
    if (hasExpert) {
      return 'Note: Keisan Expert needs a hypothesis (Nishio) step, so expect ~1–4 seconds per puzzle.';
    }
    return null;
  }

  if (variant === 'killer') {
    if (hasExpert || hasExtreme) {
      return 'Warning: Killer Expert/Extreme use advanced strategies and can take several seconds each to generate (Extreme is the slowest, up to ~10 seconds).';
    }
    return null;
  }

  if (variant === 'kakuro') return null; // every Kakuro tier generates in well under a second
  if (variant === 'skyscrapers') return null; // every offered Skyscrapers tier generates in under a second (E5 benchmark)

  // classic — kept verbatim (extreme-gated); other tiers generate quickly.
  if (hasExtreme) {
    return 'Warning: Extreme puzzles require elite-tier strategies (W-Wing, ALS, AICs) and may take up to 5 seconds per puzzle to generate.';
  }
  return null;
}

export function DifficultyConfigurator({ gridSize, counts, onChange, difficulties, variant = 'classic', mystery = false }: Props) {
  const availableDifficulties = difficulties ?? DIFFICULTIES_BY_SIZE[gridSize];
  const warning = slowGenerationWarning(variant, counts, mystery);

  return (
    <div className="space-y-4 mb-8">
      {(['easy', 'medium', 'hard', 'expert', 'extreme'] as const).map(diff => {
        const isDisabled = !availableDifficulties.includes(diff);
        return (
          <div key={diff} className={`flex items-center justify-between ${isDisabled ? 'opacity-40' : ''}`}>
            {/* htmlFor/id pairing (QA F5): without it the five inputs' accessible name was the
                placeholder "0" — five identical textboxes, Easy indistinguishable from Extreme.
                (Placeholder-only naming passes axe's WCAG-tagged `label` rule; only the
                best-practice `label-title-only` rule catches it — noted in the plan for a11y CI.) */}
            <label htmlFor={`count-${diff}`} className="capitalize font-medium text-lg w-1/3">
              {diff}
            </label>
            <input
              id={`count-${diff}`}
              type="number"
              min="0"
              max="50"
              value={isDisabled ? 0 : counts[diff]}
              onChange={(e) => onChange(diff, Math.min(50, parseInt(e.target.value) || 0))}
              disabled={isDisabled}
              className="input-field w-2/3 ml-4"
              placeholder="0"
            />
          </div>
        );
      })}
      <p className="text-sm text-ink-soft text-center mt-2">You can generate 1–50 puzzles total per request.</p>
      {availableDifficulties.length < 5 && (
        <p className="text-sm text-ink-soft text-center">
          {variant === 'skyscrapers'
            ? `${gridSize}×${gridSize} Skyscrapers offers ${availableDifficulties.join(', ')}.`
            : 'Expert and Extreme are only available for 9×9 grids.'}
        </p>
      )}
      {warning && (
        <p className="text-cherry text-sm font-medium mt-2 text-center px-4">{warning}</p>
      )}
    </div>
  );
}
