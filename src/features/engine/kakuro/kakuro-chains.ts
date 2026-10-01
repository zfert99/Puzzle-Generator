/**
 * Forcing chains over Berthier's redundant-variable model — the Kakuro plan's chain tiers
 * (E2b): what the ladder's tiers 4 and 5 are made of.
 *
 * **The model.** Kakuro's sum constraint is not binary, so ordinary candidate chains cannot
 * walk it. Berthier's KakuRules fix (research gap G5) is to add a redundant CSP-variable per
 * run — "which combination does this run use" — after which every constraint IS a binary link
 * between two candidates: two digits of one cell, the same digit in two cells of a run, two
 * combinations of one run, or a cell-digit and a run-combination that excludes it. One
 * non-binary link is kept as well, Berthier's *g-link*, in both directions: a combination
 * needing a digit no cell of the run can hold is false, and a digit every open combination
 * needs that only one cell can hold is true there.
 *
 * **The chain.** A chain starts by supposing a target candidate is true, then follows forced
 * consequences along those links only: a candidate linked to a true one is false; a variable
 * (a cell, or a run) left with one candidate has it true; a required digit with one holder is
 * true there. If some variable is left with none, the supposition was wrong and the target is
 * eliminated. The number of forced truths on the way is the chain's **length** — the rating.
 * This is Berthier's *braid*: a whip is the same thing with the extra rule that each link may
 * use only the previous element (no "memory"); braids and whips rate puzzles almost
 * identically, and a braid is what a single propagation loop naturally finds. Every step is a
 * sound implication, so a contradiction is a proof, not a guess (plan decision D10 — the
 * ladder still never searches).
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

type Contradiction = { text: string; run: number };

/**
 * Everything a chain search needs that does not change between target candidates: the open
 * combinations of every run, the working buffers, and a snapshot of the state after the facts
 * (what is forced before anything is supposed) — built once per `findFirstChainElimination`,
 * shared by the hundreds of targets of one step, each of which starts from the snapshot.
 */
export interface ChainWorkspace {
  combosOf: (readonly number[])[];
  falseDigits: Int32Array;
  trueDigit: Int32Array;
  falseCombos: Uint8Array[];
  trueCombo: Int32Array;
  touchedCells: Set<number>;
  touchedRuns: Set<number>;
  /** The state after the facts fixpoint; `findForcingChain` restores it per target. */
  facts: { falseDigits: Int32Array; trueDigit: Int32Array; falseCombos: Uint8Array[]; trueCombo: Int32Array };
  /** The facts alone contradict — the context is inconsistent, and no chain from it is a finding. */
  inconsistent: boolean;
}

/**
 * The propagation the chain walks: assert a cell-digit or a run-combination true, falsify what
 * the links say is now false, and scan the variables that changed for a contradiction or the
 * next forced truth. Works on a workspace so the buffers are shared across targets.
 */
class ChainPropagation {
  constructor(private readonly ctx: ChainContext, private readonly ws: ChainWorkspace) {}

  /** Digits a cell can still take under the current suppositions. */
  private remaining(cell: number): number {
    return this.ctx.masks[cell] & ~this.ws.falseDigits[cell];
  }

  private touchCell(cell: number): void {
    const { cellRuns } = this.ctx;
    this.ws.touchedCells.add(cell);
    const across = cellRuns[cell * 2];
    const down = cellRuns[cell * 2 + 1];
    if (across !== -1) this.ws.touchedRuns.add(across);
    if (down !== -1) this.ws.touchedRuns.add(down);
  }

  /** A cell's own run (its across run, else its down run) — where a cell's contradiction is reported. */
  runOfCell(cell: number): number {
    const { cellRuns } = this.ctx;
    return cellRuns[cell * 2] !== -1 ? cellRuns[cell * 2] : cellRuns[cell * 2 + 1];
  }

  /** Make `digit` true at `cell`; false if the cell is already decided otherwise. */
  assertCell(cell: number, digit: number): boolean {
    const { runs, masks, placed, cellRuns } = this.ctx;
    const { falseDigits, trueDigit, falseCombos, combosOf } = this.ws;
    if (trueDigit[cell] === digit) return true;
    if (trueDigit[cell] !== 0 || (falseDigits[cell] & (1 << (digit - 1))) !== 0) return false;
    trueDigit[cell] = digit;
    const bit = 1 << (digit - 1);
    falseDigits[cell] |= masks[cell] & ~bit;
    this.touchCell(cell);
    for (const slot of [0, 1] as const) {
      const r = cellRuns[cell * 2 + slot];
      if (r === -1) continue;
      for (const mate of runs[r].cells) {
        if (mate === cell || placed[mate]) continue;
        if ((masks[mate] & bit) !== 0 && (falseDigits[mate] & bit) === 0) {
          falseDigits[mate] |= bit;
          this.touchCell(mate);
        }
      }
      const combos = combosOf[r];
      for (let k = 0; k < combos.length; k++) {
        if ((combos[k] & bit) === 0 && falseCombos[r][k] === 0) {
          falseCombos[r][k] = 1;
          this.ws.touchedRuns.add(r);
        }
      }
    }
    return true;
  }

  /** Make combination `k` true for run `r`; false if the run is already decided otherwise. */
  assertRun(r: number, k: number): boolean {
    const { runs, masks, placed } = this.ctx;
    const { falseDigits, falseCombos, trueCombo, combosOf } = this.ws;
    if (trueCombo[r] === k) return true;
    if (trueCombo[r] !== -1 || falseCombos[r][k] === 1) return false;
    trueCombo[r] = k;
    this.ws.touchedRuns.add(r);
    const combos = combosOf[r];
    for (let other = 0; other < combos.length; other++) if (other !== k) falseCombos[r][other] = 1;
    const combo = combos[k];
    for (const cell of runs[r].cells) {
      if (placed[cell]) continue;
      const outside = masks[cell] & ~combo & ~falseDigits[cell];
      if (outside !== 0) {
        falseDigits[cell] |= outside;
        this.touchCell(cell);
      }
    }
    return true;
  }

  /** The digits some cell of run `r` can still hold (placed and asserted digits included). */
  private holdable(r: number): number {
    const { runs, masks, placed } = this.ctx;
    const { trueDigit } = this.ws;
    let mask = 0;
    for (const cell of runs[r].cells) {
      if (placed[cell]) mask |= masks[cell];
      else if (trueDigit[cell] !== 0) mask |= 1 << (trueDigit[cell] - 1);
      else mask |= this.remaining(cell);
    }
    return mask;
  }

  /**
   * Scan the touched variables. Returns a contradiction (as text + the run it surfaced in), or
   * the next forced truth, or neither. The g-link lives here: a combination needing a digit no
   * cell can hold is falsified on the way (not a link — nothing is forced true), and a digit
   * every open combination needs with exactly one holder is forced there.
   */
  scan(): { contradiction?: Contradiction; forced?: Forced } {
    const { runs, placed, runLabel, cellText } = this.ctx;
    const { touchedCells, touchedRuns, trueDigit, trueCombo, falseCombos, combosOf } = this.ws;
    let forced: Forced | undefined;
    for (const cell of touchedCells) {
      if (trueDigit[cell] !== 0) continue;
      const left = this.remaining(cell);
      if (left === 0) return { contradiction: { text: `${cellText(cell)} has no digit left`, run: this.runOfCell(cell) } };
      if (popcount(left) === 1 && !forced) forced = { kind: 'cell', cell, digit: 32 - Math.clz32(left) };
    }
    for (const r of touchedRuns) {
      const combos = combosOf[r];
      const flags = falseCombos[r];
      const holdable = this.holdable(r);
      let open = -1;
      let openCount = 0;
      let required = -1;
      for (let k = 0; k < combos.length; k++) {
        if (flags[k] === 1) continue;
        const unholdable = combos[k] & ~holdable;
        if (unholdable !== 0) {
          if (trueCombo[r] === k) {
            return { contradiction: { text: `${runLabel(r)} needs a ${maskToDigits(unholdable)[0]} but no cell can take it`, run: r } };
          }
          flags[k] = 1;
          continue;
        }
        open = k;
        openCount++;
        required &= combos[k];
      }
      if (openCount === 0) return { contradiction: { text: `${runLabel(r)} has no combination left`, run: r } };
      if (openCount === 1 && trueCombo[r] === -1 && !forced) forced = { kind: 'run', run: r, combo: open };
      if (forced) continue;
      for (const digit of maskToDigits(required)) {
        const bit = 1 << (digit - 1);
        let holder = -1;
        let holders = 0;
        for (const cell of runs[r].cells) {
          if (placed[cell] || trueDigit[cell] !== 0) {
            if (trueDigit[cell] === digit || (placed[cell] && this.ctx.masks[cell] === bit)) {
              holders = 2; // already held
              break;
            }
            continue;
          }
          if ((this.remaining(cell) & bit) !== 0) {
            holder = cell;
            holders++;
          }
        }
        if (holders === 1) {
          forced = { kind: 'cell', cell: holder, digit };
          break;
        }
      }
    }
    return { forced };
  }
}

/**
 * Build the shared workspace for a context and establish the facts in it: whatever is already
 * forced before supposing anything — a run with a single open combination, a cell with a single
 * candidate, and whatever those force in turn — to a fixpoint, without counting toward any
 * length. The logical solver has normally applied these to the masks (tier 1), but the grade
 * must not depend on which caller built the context. Done once per step; every target starts
 * from the snapshot.
 */
export function prepareChainWorkspace(ctx: ChainContext): ChainWorkspace {
  const cellCount = ctx.size * ctx.size;
  const combosOf: (readonly number[])[] = [];
  for (let r = 0; r < ctx.runs.length; r++) combosOf.push(ctx.openCombos(r));
  const ws: ChainWorkspace = {
    combosOf,
    falseDigits: new Int32Array(cellCount),
    trueDigit: new Int32Array(cellCount),
    falseCombos: combosOf.map((combos) => new Uint8Array(combos.length)),
    trueCombo: new Int32Array(ctx.runs.length).fill(-1),
    touchedCells: new Set<number>(),
    touchedRuns: new Set<number>(),
    facts: { falseDigits: new Int32Array(cellCount), trueDigit: new Int32Array(cellCount), falseCombos: [], trueCombo: new Int32Array(ctx.runs.length) },
    inconsistent: false,
  };
  const { runs, masks, placed, cellRuns } = ctx;
  const propagation = new ChainPropagation(ctx, ws);
  // Every open variable gets one look (the scan only revisits what changes afterwards), so a raw
  // context's g-link facts are found even when nothing is asserted outright.
  for (let r = 0; r < runs.length; r++) {
    if (combosOf[r].length === 1) propagation.assertRun(r, 0);
    else if (combosOf[r].length > 1) ws.touchedRuns.add(r);
  }
  for (let cell = 0; cell < cellCount; cell++) {
    if (placed[cell] || masks[cell] === 0 || (cellRuns[cell * 2] === -1 && cellRuns[cell * 2 + 1] === -1)) continue;
    if (popcount(masks[cell]) === 1) propagation.assertCell(cell, 32 - Math.clz32(masks[cell]));
    else ws.touchedCells.add(cell);
  }
  for (;;) {
    const { contradiction, forced } = propagation.scan();
    if (contradiction) {
      ws.inconsistent = true;
      break;
    }
    if (!forced) break;
    if (forced.kind === 'cell') propagation.assertCell(forced.cell, forced.digit);
    else propagation.assertRun(forced.run, forced.combo);
  }
  ws.facts.falseDigits.set(ws.falseDigits);
  ws.facts.trueDigit.set(ws.trueDigit);
  ws.facts.falseCombos = ws.falseCombos.map((flags) => flags.slice());
  ws.facts.trueCombo.set(ws.trueCombo);
  return ws;
}

/** Back to the facts: the state every target is supposed from. */
function restoreFacts(ws: ChainWorkspace): void {
  ws.falseDigits.set(ws.facts.falseDigits);
  ws.trueDigit.set(ws.facts.trueDigit);
  ws.falseCombos.forEach((flags, r) => flags.set(ws.facts.falseCombos[r]));
  ws.trueCombo.set(ws.facts.trueCombo);
  ws.touchedCells.clear();
  ws.touchedRuns.clear();
}

/**
 * Suppose `digit` at `cell`; follow the forced consequences through the model up to
 * `maxLength` forced truths. Returns the chain if the supposition contradicts itself, else
 * `null` (no contradiction within the bound — nothing can be concluded). An inconsistent
 * context (its facts alone contradict) proves nothing: every target returns `null`.
 */
export function findForcingChain(
  ctx: ChainContext,
  cell: number,
  digit: number,
  maxLength: number,
  workspace: ChainWorkspace = prepareChainWorkspace(ctx)
): ForcingChain | null {
  const ws = workspace;
  if (ws.inconsistent) return null;
  restoreFacts(ws);
  const propagation = new ChainPropagation(ctx, ws);
  const chain: Forced[] = [];

  // The supposition itself is not counted in the length. If the facts already rule the digit
  // out, that is a contradiction of length 0 (the logical solver's tier 1 would normally have
  // removed it before a chain was ever tried).
  if ((ws.falseDigits[cell] & (1 << (digit - 1))) !== 0) {
    return { cell, digit, length: 0, contradictionRun: propagation.runOfCell(cell), explanation: explain(ctx, cell, digit, [], 'what is already forced excludes it', ws.combosOf) };
  }
  if (!propagation.assertCell(cell, digit)) return null;

  for (;;) {
    const { contradiction, forced } = propagation.scan();
    if (contradiction) {
      return { cell, digit, length: chain.length, contradictionRun: contradiction.run, explanation: explain(ctx, cell, digit, chain, contradiction.text, ws.combosOf) };
    }
    if (!forced || chain.length >= maxLength) return null;
    chain.push(forced);
    // A forced truth is, by the scan's definition, still open — asserting it cannot fail.
    const asserted = forced.kind === 'cell' ? propagation.assertCell(forced.cell, forced.digit) : propagation.assertRun(forced.run, forced.combo);
    if (!asserted) throw new Error('kakuro chain: a forced truth was already decided');
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
 * combinations, buffers, the facts) is built once here and shared across every target.
 */
export function findFirstChainElimination(ctx: ChainContext, maxLength: number): ForcingChain | null {
  const cellCount = ctx.size * ctx.size;
  const workspace = prepareChainWorkspace(ctx);
  if (workspace.inconsistent) return null;
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
