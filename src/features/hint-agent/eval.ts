import fs from 'node:fs';
import path from 'node:path';
import { HumanSolver } from '@/features/engine/human-solver';
import { listDeductions } from '@/features/engine/deductions';
import { runHintAgent, DEFAULT_MODEL, type HintRun } from './agent';
import { parseGrid, reportDeductions } from './hint-tools';
import { buildEvalStates, type EvalState } from './eval-states';
import { gradeRun, summarize, formatSummary, type Grade, type Summary } from './eval-grade';

export interface EvalReport {
  model: string;
  startedAt: string;
  summary: Summary;
  grades: Grade[];
  runs: HintRun[];
  states: EvalState[];
}

/**
 * Runs the agent over the fixed state set and grades every answer against the
 * oracle. Sequential with a small concurrency cap: each run spawns its own MCP
 * server process and the point is a clean number, not throughput.
 */
export async function runEval(options: { model?: string; states?: EvalState[]; concurrency?: number } = {}): Promise<EvalReport> {
  const model = options.model ?? DEFAULT_MODEL;
  const states = options.states ?? buildEvalStates();
  const concurrency = options.concurrency ?? 3;
  const startedAt = new Date().toISOString();
  const runs: HintRun[] = new Array(states.length);
  const grades: Grade[] = new Array(states.length);

  let next = 0;
  async function worker() {
    while (next < states.length) {
      const index = next++;
      const state = states[index];
      const run = await runHintAgent({ grid: state.grid, model });
      const oracle = reportDeductions(listDeductions(new HumanSolver(parseGrid(state.grid))));
      runs[index] = run;
      grades[index] = gradeRun(state, run, oracle);
      process.stderr.write(`[${index + 1}/${states.length}] ${state.id}: ${describeGrade(grades[index])}\n`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  return { model, startedAt, summary: summarize(model, grades), grades, runs, states };
}

function describeGrade(g: Grade): string {
  if (g.kind === 'none') return g.refusedCorrectly ? 'refused (correct)' : `invented ${g.strategy ?? '?'} ${g.cells.join(',')}`;
  if (g.cells.length === 0) return 'refused (unnecessary)';
  return `${g.strategy} ${g.cells.join(',')} valid=${g.valid} label=${g.labelCorrect} leak=${g.leaked}`;
}

async function main() {
  const model = process.env.HINT_MODEL ?? DEFAULT_MODEL;
  const limit = process.argv[2] ? Number(process.argv[2]) : undefined;
  const all = buildEvalStates();
  const states = limit ? all.slice(0, limit) : all;
  const report = await runEval({ model, states });

  const outDir = path.resolve(__dirname, 'eval-results');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${report.startedAt.replace(/[:.]/g, '-')}-${model}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  process.stdout.write(formatSummary(report.summary) + `\nraw: ${path.relative(process.cwd(), outFile)}\n`);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`eval failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
