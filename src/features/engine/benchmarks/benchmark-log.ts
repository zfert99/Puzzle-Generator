import fs from 'fs';
import path from 'path';

const LOG_HEADER = `# Benchmark Logs\n\n<!-- markdownlint-disable MD013 MD060 -->\n\n| Timestamp | Commit | Benchmark | Avg Time | Metric |\n|---|---|---|---|---|\n`;

/** Absolute path of the shared benchmark log every benchmark script appends to. */
export const BENCHMARK_LOG_PATH = path.join(__dirname, 'benchmark-logs.md');

/**
 * Appends benchmark rows to the shared log, creating the file with its markdown
 * header if it does not exist yet. Returns the log path for console output.
 *
 * The header is written with the `wx` flag (exclusive create) instead of the
 * obvious `existsSync` guard: the guard is a check-then-use race — two benchmark
 * scripts started together could both see "missing" and the second `writeFileSync`
 * would truncate the first one's rows. `wx` pushes the decision into a single
 * atomic syscall, so the loser just gets `EEXIST` and falls through to appending.
 */
export function appendBenchmarkRows(rows: string[]): string {
  try {
    fs.writeFileSync(BENCHMARK_LOG_PATH, LOG_HEADER, { flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
  }
  fs.appendFileSync(BENCHMARK_LOG_PATH, rows.join(''));
  return BENCHMARK_LOG_PATH;
}
