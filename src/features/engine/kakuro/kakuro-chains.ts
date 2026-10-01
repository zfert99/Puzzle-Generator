/**
 * Forcing chains over Berthier's redundant-variable model — the Kakuro plan's chain tiers
 * (E2b): what the ladder's tiers 4 and 5 are made of.
 *
 * **The model.** Kakuro's sum constraint is not binary, so ordinary candidate chains cannot
 * walk it. Berthier's KakuRules fix (research gap G5) is to add a redundant CSP-variable per
 * run — "which combination does this run use" — after which every constraint IS a binary link
 * between two candidates: two digits of one cell, the same digit in two cells of a run, two
 * combinations of one run, or a cell-digit and a run-combination that excludes it.
 *
 * **The chain.** A chain starts by supposing a target candidate is true, then follows forced
 * consequences along those links only: a candidate linked to a true one is false; a variable
 * (a cell, or a run) left with one candidate has it true. If some variable is left with none,
 * the supposition was wrong and the target is eliminated. The number of forced truths on the
 * way is the chain's **length** — the rating. This is Berthier's *braid*: a whip is the same
 * thing with the extra rule that each link may use only the previous element (no "memory");
 * braids and whips rate puzzles almost identically, and a braid is what a single propagation
 * loop naturally finds. Every step is a sound implication, so a contradiction is a proof,
 * not a guess (plan decision D10 — the ladder still never searches).
 *
 * See `kakuro-chains.md` for the "why", the semantics, and what was deliberately left out
 * (g-whips, surface sums).
 */

import { maskToDigits, popcount } from '../grid-utils';
import type { Run } from './kakuro-types';

/** What the chain engine needs of the logical solver's state. */
export interface ChainContext {
  size: number;
  runs: readonly Run[];
  /** Candidate mask per cell (a placed cell's is its digit). */
  masks: Int32Array;
  placed: Uint8Array;
  /** Flat cell → [across run index, down run index], −1 when none. */
  cellRuns: Int32Array;
  /** A run's combinations as masks, already filtered against its placed digits and cell masks. */
  openCombos: (runIndex: number) => readonly number[];
  /** "16-in-two across (row 3)" — for the explanation. */
  runLabel: (runIndex: number) => string;
  /** "row 3, column 2" — for the explanation. */
  cellText: (cell: number) => string;
}

export interface ForcingChain {
  /** The eliminated candidate. */
  cell: number;
  digit: number;
  /** Forced truths on the way, in order. */
  length: number;
  explanation: string;
}

/** One forced truth in the chain — for the explanation. */
type Forced = { kind: 'cell'; cell: number; digit: number } | { kind: 'run'; run: number; combo: number };

/**
 * Suppose `digit` at `cell`; follow the forced consequences through the binary model up to
 * `maxLength` forced truths. Returns the chain if the supposition contradicts itself, else
 * `null` (no contradiction within the bound — nothing can be concluded).
 */
export function findForcingChain(ctx: ChainContext, cell: number, digit: number, maxLength: number): ForcingChain | null {
  const { size, runs, masks, placed, cellRuns } = ctx;
  const cellCount = size * size;
  const combosOf: (readonly number[])[] = [];
  for (let r = 0; r < runs.length; r++) combosOf.push(ctx.openCombos(r));

  // Working state of the supposition: which candidates are falsified, which are true.
  const falseDigits = new Int32Array(cellCount); // per cell
  const trueDigit = new Int32Array(cellCount); // 0 = not yet
  const falseCombos: Uint8Array[] = combosOf.map((combos) => new Uint8Array(combos.length));
  const trueCombo = new Int32Array(runs.length).fill(-1);
  const chain: Forced[] = [];
  const touchedCells = new Set<number>();
  const touchedRuns = new Set<number>();

  // Cells still open under the supposition: unplaced, and not yet forced.
  const remaining = (c: number) => masks[c] & ~falseDigits[c];

  const assertCell = (c: number, d: number): boolean => {
    if (trueDigit[c] === d) return true;
    if (trueDigit[c] !== 0 || (falseDigits[c] & (1 << (d - 1))) !== 0) return false;
    trueDigit[c] = d;
    const bit = 1 << (d - 1);
    falseDigits[c] |= masks[c] & ~bit;
    for (const slot of [0, 1] as const) {
      const r = cellRuns[c * 2 + slot];
      if (r === -1) continue;
      for (const mate of runs[r].cells) {
        if (mate === c || placed[mate]) continue;
        if ((masks[mate] & bit) !== 0) {
          falseDigits[mate] |= bit;
          touchedCells.add(mate);
        }
      }
      const combos = combosOf[r];
      for (let k = 0; k < combos.length; k++) {
        if ((combos[k] & bit) === 0 && falseCombos[r][k] === 0) {
          falseCombos[r][k] = 1;
          touchedRuns.add(r);
        }
      }
    }
    return true;
  };

  const assertRun = (r: number, k: number): boolean => {
    if (trueCombo[r] === k) return true;
    if (trueCombo[r] !== -1 || falseCombos[r][k] === 1) return false;
    trueCombo[r] = k;
    const combos = combosOf[r];
    for (let other = 0; other < combos.length; other++) if (other !== k) falseCombos[r][other] = 1;
    const combo = combos[k];
    for (const c of runs[r].cells) {
      if (placed[c]) continue;
      const outside = masks[c] & ~combo;
      if (outside !== 0) {
        falseDigits[c] |= outside;
        touchedCells.add(c);
      }
    }
    return true;
  };

  // Facts, not chain: a run with a single open combination already holds it. The logical solver
  // has normally applied those facts to the masks (tier 1), but a raw context may not have, so
  // assert them up front without counting them — they are true before the supposition.
  for (let r = 0; r < runs.length; r++) if (combosOf[r].length === 1) assertRun(r, 0);
  touchedCells.clear();
  touchedRuns.clear();

  // The supposition itself is not counted in the length. If the facts above already rule the
  // digit out, that is a contradiction of length 0 (the logical solver's tier 1 would normally
  // have removed it before a chain was ever tried).
  if ((falseDigits[cell] & (1 << (digit - 1))) !== 0) {
    return { cell, digit, length: 0, explanation: explain(ctx, cell, digit, [], 'a run of that cell has only one combination, and it excludes the digit', combosOf) };
  }
  if (!assertCell(cell, digit)) return null;

  for (;;) {
    // Any variable with no candidate left → contradiction. Any with exactly one → forced.
    let forced: Forced | null = null;
    let contradiction: string | null = null;

    for (const c of touchedCells) {
      if (trueDigit[c] !== 0) continue;
      const left = remaining(c);
      if (left === 0) {
        contradiction = `${ctx.cellText(c)} has no digit left`;
        break;
      }
      if (popcount(left) === 1 && forced === null) forced = { kind: 'cell', cell: c, digit: 32 - Math.clz32(left) };
    }
    if (!contradiction) {
      for (const r of touchedRuns) {
        if (trueCombo[r] !== -1) continue;
        let left = -1;
        let count = 0;
        for (let k = 0; k < combosOf[r].length; k++) {
          if (falseCombos[r][k] === 0) {
            left = k;
            if (++count > 1) break;
          }
        }
        if (count === 0) {
          contradiction = `${ctx.runLabel(r)} has no combination left`;
          break;
        }
        if (count === 1 && forced === null) forced = { kind: 'run', run: r, combo: left };
      }
    }

    if (contradiction) {
      return { cell, digit, length: chain.length, explanation: explain(ctx, cell, digit, chain, contradiction, combosOf) };
    }
    if (!forced || chain.length >= maxLength) return null;

    chain.push(forced);
    const ok = forced.kind === 'cell' ? assertCell(forced.cell, forced.digit) : assertRun(forced.run, forced.combo);
    if (!ok) {
      // Forcing something already falsified is itself the contradiction.
      const where = forced.kind === 'cell' ? ctx.cellText(forced.cell) : ctx.runLabel(forced.run);
      return { cell, digit, length: chain.length, explanation: explain(ctx, cell, digit, chain, `${where} is forced two ways`, combosOf) };
    }
  }
}

function explain(ctx: ChainContext, cell: number, digit: number, chain: Forced[], contradiction: string, combosOf: (readonly number[])[]): string {
  const steps = chain.map((f) =>
    f.kind === 'cell'
      ? `${ctx.cellText(f.cell)} → ${f.digit}`
      : `${ctx.runLabel(f.run)} → {${maskToDigits(combosOf[f.run][f.combo]).join(',')}}`
  );
  const path = steps.length > 0 ? `${steps.join(', ')}, and then ` : '';
  return `If ${ctx.cellText(cell)} were ${digit}: ${path}${contradiction} — so ${digit} is impossible there (chain of ${chain.length})`;
}

/**
 * The first elimination any forcing chain of at most `maxLength` can prove, scanning cells in
 * order and digits ascending. One deduction, like every other technique.
 */
export function findFirstChainElimination(ctx: ChainContext, maxLength: number): ForcingChain | null {
  const cellCount = ctx.size * ctx.size;
  for (let cell = 0; cell < cellCount; cell++) {
    if (ctx.placed[cell] || ctx.masks[cell] === 0) continue;
    if (ctx.cellRuns[cell * 2] === -1 && ctx.cellRuns[cell * 2 + 1] === -1) continue;
    if (popcount(ctx.masks[cell]) < 2) continue;
    for (const digit of maskToDigits(ctx.masks[cell])) {
      const chain = findForcingChain(ctx, cell, digit, maxLength);
      if (chain) return chain;
    }
  }
  return null;
}
