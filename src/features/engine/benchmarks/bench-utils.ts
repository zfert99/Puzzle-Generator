import { execSync } from 'child_process';

/**
 * Shared plumbing for the benchmark scripts (October 2026): a seeded PRNG so every script draws
 * the SAME puzzles on every commit, a warm-up so the first timed row does not pay the JIT, and a
 * distribution summary (median / p90 / max) instead of a bare average.
 *
 * Why seeded: the scripts used to draw from `Math.random`, so each run generated a fresh pool —
 * and for a generator whose per-puzzle time spans an order of magnitude (classic extreme 50–250
 * ms, Killer extreme 4–30 s) a row's average was mostly which puzzles got drawn. The HumanSolver
 * "Extreme" row, a 10-puzzle pool, moved between 4 and 26 ms with no code change and had to be
 * declared noise. A fixed seed list keeps the inputs *varied within a run* (AGENTS.md §5: no
 * single grid for V8 to specialise on) while making rows comparable *across* runs.
 *
 * Why median and p90: an average of five extremes is dominated by the one slow draw; the median
 * says what a typical puzzle costs and the p90 what the tail does, which is what the route budget
 * cares about. The log table keeps its columns — the distribution rides in the Metric column.
 */

/** Mulberry32 — small, fast, good enough for drawing puzzles; the same PRNG the seeded tests use. */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Base seed per script, so two scripts never time the same puzzle; draw `i` uses `base + i`. */
export const SEED_BASE = {
  classic: 1_000,
  humanSolver: 2_000,
  killer: 3_000,
  calc: 4_000,
  kakuro: 5_000,
  skyscrapers: 6_000,
} as const;

export interface TimingStats {
  avg: number;
  median: number;
  p90: number;
  max: number;
  n: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

export function stats(times: number[]): TimingStats {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    avg: times.reduce((a, b) => a + b, 0) / Math.max(1, times.length),
    median: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    max: sorted[sorted.length - 1] ?? 0,
    n: times.length,
  };
}

/** Time `count` draws of `draw(i)`; `draw` is handed the draw index so it can seed itself. */
export function timeDraws(count: number, draw: (i: number) => void): TimingStats {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    draw(i);
    times.push(performance.now() - start);
  }
  return stats(times);
}

/** Run `fn` a few times untimed so the first timed row does not include JIT compilation. */
export function warmUp(fn: () => void, rounds = 3): void {
  for (let i = 0; i < rounds; i++) fn();
}

/** The log table's Metric cell: the distribution behind the Avg column. */
export function distribution(s: TimingStats): string {
  return `p50 ${s.median.toFixed(2)} ms · p90 ${s.p90.toFixed(2)} ms · max ${s.max.toFixed(0)} ms (n=${s.n}, seeded)`;
}

export function currentCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

/** One row of `benchmark-logs.md`, in its five-column shape. */
export function logRow(timestamp: string, commit: string, label: string, avgMs: number, metric: string): string {
  return `| ${timestamp} | \`${commit}\` | ${label} | ${avgMs.toFixed(2)} ms | ${metric} |\n`;
}
