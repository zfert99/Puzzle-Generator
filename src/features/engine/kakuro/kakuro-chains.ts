/**
 * Forcing chains over Berthier's redundant-variable model — the Kakuro plan's chain tiers
 * (E2b): what the ladder's tiers 4 and 5 are made of.
 *
 * **The model.** Kakuro's sum constraint is not binary, so ordinary candidate chains cannot
 * walk it. Berthier's KakuRules fix (research gap G5) is to add a redundant CSP-variable per
 * run — "which combination does this run use" — after which every constraint IS a binary link
 * between two candidates: two digits of one cell, the same digit in two cells of a run, two
 * combinations of one run, or a cell-digit and a run-combination that excludes it. One
 * non-binary link is kept as well, Berthier's *g-link*: a true combination needs each of its
 * digits held by some cell of the run.
 *
 * **The chain.** A chain starts by supposing a target candidate is true, then follows forced
 * consequences along those links only: a candidate linked to a true one is false; a variable
 * (a cell, or a run) left with one candidate has it true; a digit a true combination needs
 * that only one cell can hold is true there. If some variable is left with none — or a needed
 * digit has nowhere to go — the supposition was wrong and the target is eliminated. The number
 * of forced truths on the way is the chain's **length** — the rating. This is Berthier's
 * *braid*: a whip is the same thing with the extra rule that each link may use only the
 * previous element (no "memory"); braids and whips rate puzzles almost identically, and a braid
 * is what a single propagation loop naturally finds. Every step is a sound implication, so a
 * contradiction is a proof, not a guess (plan decision D10 — the ladder still never searches).
 *
 * See `kakuro-chains.md` for the "why", the semantics, and what was deliberately left out
 * (surface sums, whip-only mode).
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
  /** Where the contradiction surfaced: a run that emptied, else the run of the cell that did. */
  contradictionRun: number;
}

/** One forced truth in the chain — for the explanation. */
type Forced = { kind: 'cell'; cell: number; digit: number } | { kind: 'run'; run: number; combo: number };

/**
 * Everything a chain search needs that does not change between target candidates: the open
 * combinations of every run, and the working buffers. Built once per `findFirstChainElimination`
 * (hundreds of targets per step share it) and reset per target.
 */
export interface ChainWorkspace {
  combosOf: (readonly number[])[];
  falseDigits: Int32Array;
  trueDigit: Int32Array;
  falseCombos: Uint8Array[];
  trueCombo: Int32Array;
  touchedCells: Set<number>;
  touchedRuns: Set<number>;
}

export function prepareChainWorkspace(ctx: ChainContext): ChainWorkspace {
  const cellCount = ctx.size * ctx.size;
  const combosOf: (readonly number[])[] = [];
  for (let r = 0; r < ctx.runs.length; r++) combosOf.push(ctx.openCombos(r));
  return {
    combosOf,
    falseDigits: new Int32Array(cellCount),
    trueDigit: new Int32Array(cellCount),
    falseCombos: combosOf.map((combos) => new Uint8Array(combos.length)),
    trueCombo: new Int32Array(ctx.runs.length),
    touchedCells: new Set<number>(),
    touchedRuns: new Set<number>(),
  };
}

function resetWorkspace(ws: ChainWorkspace): void {
  ws.falseDigits.fill(0);
  ws.trueDigit.fill(0);
  for (const flags of ws.falseCombos) flags.fill(0);
  ws.trueCombo.fill(-1);
  ws.touchedCells.clear();
  ws.touchedRuns.clear();
}

/**
 * Suppose `digit` at `cell`; follow the forced consequences through the model up to
 * `maxLength` forced truths. Returns the chain if the supposition contradicts itself, else
 * `null` (no contradiction within the bound — nothing can be concluded).
 */
export function findForcingChain(
  ctx: ChainContext,
  cell: number,
  digit: number,
  maxLength: number,
  workspace: ChainWorkspace = prepareChainWorkspace(ctx)
): ForcingChain | null {
  const { runs, masks, placed, cellRuns } = ctx;
  const ws = workspace;
  resetWorkspace(ws);
  const { combosOf, falseDigits, trueDigit, falseCombos, trueCombo, touchedCells, touchedRuns } = ws;
  const chain: Forced[] = [];

  // Cells still open under the supposition: unplaced, and not yet forced.
  const remaining = (c: number) => masks[c] & ~falseDigits[c];

  const touchCell = (c: number) => {
    touchedCells.add(c);
    const across = cellRuns[c * 2];
    const down = cellRuns[c * 2 + 1];
    if (across !== -1) touchedRuns.add(across);
    if (down !== -1) touchedRuns.add(down);
  };

  const assertCell = (c: number, d: number): boolean => {
    if (trueDigit[c] === d) return true;
    if (trueDigit[c] !== 0 || (falseDigits[c] & (1 << (d - 1))) !== 0) return false;
    trueDigit[c] = d;
    const bit = 1 << (d - 1);
    falseDigits[c] |= masks[c] & ~bit;
    touchCell(c);
    for (const slot of [0, 1] as const) {
      const r = cellRuns[c * 2 + slot];
      if (r === -1) continue;
      for (const mate of runs[r].cells) {
        if (mate === c || placed[mate]) continue;
        if ((masks[mate] & bit) !== 0 && (falseDigits[mate] & bit) === 0) {
          falseDigits[mate] |= bit;
          touchCell(mate);
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
    touchedRuns.add(r);
    const combos = combosOf[r];
    for (let other = 0; other < combos.length; other++) if (other !== k) falseCombos[r][other] = 1;
    const combo = combos[k];
    for (const c of runs[r].cells) {
      if (placed[c]) continue;
      const outside = masks[c] & ~combo & ~falseDigits[c];
      if (outside !== 0) {
        falseDigits[c] |= outside;
        touchCell(c);
      }
    }
    return true;
  };

  /**
   * Scan the touched variables. Returns a contradiction (as text + the run it surfaced in), or
   * the next forced truth, or neither. The g-link is checked here: every digit of a true
   * combination must still have a holder in the run.
   */
  const scan = (): { contradiction?: { text: string; run: number }; forced?: Forced } => {
    let forced: Forced | undefined;
    for (const c of touchedCells) {
      if (trueDigit[c] !== 0) continue;
      const left = remaining(c);
      if (left === 0) {
        const r = cellRuns[c * 2] !== -1 ? cellRuns[c * 2] : cellRuns[c * 2 + 1];
        return { contradiction: { text: `${ctx.cellText(c)} has no digit left`, run: r } };
      }
      if (popcount(left) === 1 && !forced) forced = { kind: 'cell', cell: c, digit: 32 - Math.clz32(left) };
    }
    for (const r of touchedRuns) {
      const combos = combosOf[r];
      if (trueCombo[r] === -1) {
        let left = -1;
        let count = 0;
        for (let k = 0; k < combos.length; k++) {
          if (falseCombos[r][k] === 0) {
            left = k;
            if (++count > 1) break;
          }
        }
        if (count === 0) return { contradiction: { text: `${ctx.runLabel(r)} has no combination left`, run: r } };
        if (count === 1 && !forced) forced = { kind: 'run', run: r, combo: left };
        continue;
      }
      // g-link: each digit of the true combination needs a holder.
      for (const d of maskToDigits(combos[trueCombo[r]])) {
        const bit = 1 << (d - 1);
        let holder = -1;
        let holders = 0;
        for (const c of runs[r].cells) {
          if (trueDigit[c] === d || (placed[c] && masks[c] === bit)) {
            holders = 2; // already there
            break;
          }
          if (!placed[c] && trueDigit[c] === 0 && (remaining(c) & bit) !== 0) {
            holder = c;
            holders++;
          }
        }
        if (holders === 0) return { contradiction: { text: `${ctx.runLabel(r)} needs a ${d} but no cell can take it`, run: r } };
        if (holders === 1 && !forced) forced = { kind: 'cell', cell: holder, digit: d };
      }
    }
    return { forced };
  };

  // Facts, not chain: whatever is already forced before supposing anything — a run with a
  // single open combination, a cell with a single candidate, and whatever those force in turn.
  // The logical solver has normally applied these to the masks (tier 1), but the grade must not
  // depend on which caller built the context, so they are established here, to a fixpoint,
  // without counting toward the length.
  for (let r = 0; r < runs.length; r++) if (combosOf[r].length === 1) assertRun(r, 0);
  for (let c = 0; c < masks.length; c++) {
    if (!placed[c] && masks[c] !== 0 && popcount(masks[c]) === 1 && (cellRuns[c * 2] !== -1 || cellRuns[c * 2 + 1] !== -1)) {
      assertCell(c, 32 - Math.clz32(masks[c]));
    }
  }
  for (;;) {
    const { contradiction, forced } = scan();
    if (contradiction || !forced) break; // an inconsistent context is not this chain's finding
    if (forced.kind === 'cell') assertCell(forced.cell, forced.digit);
    else assertRun(forced.run, forced.combo);
  }
  touchedCells.clear();
  touchedRuns.clear();

  // The supposition itself is not counted in the length. If the facts above already rule the
  // digit out, that is a contradiction of length 0 (the logical solver's tier 1 would normally
  // have removed it before a chain was ever tried).
  const ownRun = cellRuns[cell * 2] !== -1 ? cellRuns[cell * 2] : cellRuns[cell * 2 + 1];
  if ((falseDigits[cell] & (1 << (digit - 1))) !== 0) {
    return { cell, digit, length: 0, contradictionRun: ownRun, explanation: explain(ctx, cell, digit, [], 'what is already forced excludes it', combosOf) };
  }
  if (!assertCell(cell, digit)) return null;

  for (;;) {
    const { contradiction, forced } = scan();
    if (contradiction) {
      return { cell, digit, length: chain.length, contradictionRun: contradiction.run, explanation: explain(ctx, cell, digit, chain, contradiction.text, combosOf) };
    }
    if (!forced || chain.length >= maxLength) return null;

    chain.push(forced);
    const ok = forced.kind === 'cell' ? assertCell(forced.cell, forced.digit) : assertRun(forced.run, forced.combo);
    if (!ok) {
      // Forcing something already falsified is itself the contradiction.
      const where = forced.kind === 'cell' ? ctx.cellText(forced.cell) : ctx.runLabel(forced.run);
      const run = forced.kind === 'run' ? forced.run : (cellRuns[forced.cell * 2] !== -1 ? cellRuns[forced.cell * 2] : cellRuns[forced.cell * 2 + 1]);
      return { cell, digit, length: chain.length, contradictionRun: run, explanation: explain(ctx, cell, digit, chain, `${where} is forced two ways`, combosOf) };
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
 * order and digits ascending. One deduction, like every other technique. The workspace (open
 * combinations, buffers) is built once here and shared across every target.
 */
export function findFirstChainElimination(ctx: ChainContext, maxLength: number): ForcingChain | null {
  const cellCount = ctx.size * ctx.size;
  const workspace = prepareChainWorkspace(ctx);
  for (let cell = 0; cell < cellCount; cell++) {
    if (ctx.placed[cell] || ctx.masks[cell] === 0) continue;
    if (ctx.cellRuns[cell * 2] === -1 && ctx.cellRuns[cell * 2 + 1] === -1) continue;
    if (popcount(ctx.masks[cell]) < 2) continue;
    for (const digit of maskToDigits(ctx.masks[cell])) {
      const chain = findForcingChain(ctx, cell, digit, maxLength, workspace);
      if (chain) return chain;
    }
  }
  return null;
}
