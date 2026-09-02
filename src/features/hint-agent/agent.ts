import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { connectHintServer, type HintToolClient } from './mcp-client';
import { DEFAULT_PUZZLE } from './hint-tools';

export const DEFAULT_MODEL = 'claude-opus-5';

/**
 * What the agent is allowed to say. A hint names a technique and the cells it
 * acts on and nothing else — no digit — or it is `null` with a reason. The
 * shape is deliberately narrow so the eval harness grades structure, not prose.
 */
export const HintResponseSchema = z.object({
  hint: z
    .object({
      strategy: z.string().describe('The technique name exactly as the deduction tool labels it.'),
      cells: z.array(z.string()).describe('Cells the technique acts on, in r#c# notation.'),
      explanation: z.string().describe('One or two sentences on why this technique applies. Never state which digit goes where.'),
    })
    .nullable()
    .describe('null when no deduction is available or you are not certain one is.'),
  reason: z.string().describe('If hint is null, why. Otherwise empty.'),
});

export type HintResponse = z.infer<typeof HintResponseSchema>;

/**
 * The whole behavioural contract lives here. It is what the eval measures, so
 * changes to it are changes to the number.
 */
export const SYSTEM_PROMPT = `You are a Sudoku tutor. The player is stuck and wants a nudge, not the answer.

Rules:
1. Always call list_available_deductions before answering. It is the ground truth for this position.
2. Give at most ONE step: name the technique and the cell or cells it acts on, taken from that list.
3. Never state a digit that should be placed. Describing which candidates a technique eliminates is allowed only for elimination techniques (pairs, wings, fish); for singles, name the cell and the technique and stop.
4. If the list is empty, or you are not certain the step you would name is in the list, answer with hint: null and say why. A refusal is correct; an invented step is not.
5. Prefer the simplest technique available (singles before pairs before fish).`;

/** Everything the harness needs to grade one run and to explain it afterwards. */
export interface HintRun {
  grid: string;
  model: string;
  response: HintResponse | null;
  rawText: string;
  toolCalls: string[];
  stopReason: Anthropic.Message['stop_reason'];
  usage: { input: number; output: number };
}

/** The slice of the SDK the loop needs; tests hand in a fake that satisfies it. */
export type MessagesClient = {
  messages: {
    create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;
  };
};

export interface RunHintAgentOptions {
  grid: string;
  model?: string;
  client?: MessagesClient;
  /** Injected tool client (in-process for tests); defaults to spawning the MCP server. */
  tools?: HintToolClient;
  maxTurns?: number;
}

/**
 * One hint for one position. A manual tool loop rather than the SDK's beta tool
 * runner because the tools come from an MCP client and the harness needs the
 * tool-call trace, not just the final message. Structured output is requested
 * via `output_config.format` so the final turn is always parseable JSON.
 */
export async function runHintAgent(options: RunHintAgentOptions): Promise<HintRun> {
  const model = options.model ?? DEFAULT_MODEL;
  const client = options.client ?? createClient();
  const tools = options.tools ?? (await connectHintServer(options.grid));
  const maxTurns = options.maxTurns ?? 6;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: 'I am stuck. What is one thing I can do next? Do not tell me the answer.' },
  ];
  const toolCalls: string[] = [];
  const usage = { input: 0, output: 0 };
  let last: Anthropic.Message | undefined;

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      last = await client.messages.create({
        model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: tools.tools,
        messages,
        output_config: { format: zodOutputFormat(HintResponseSchema) },
      });
      usage.input += last.usage.input_tokens;
      usage.output += last.usage.output_tokens;

      if (last.stop_reason !== 'tool_use') break;

      const toolUses = last.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: last.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        toolCalls.push(use.name);
        let content: string;
        let isError = false;
        try {
          content = await tools.callTool(use.name, use.input);
        } catch (error) {
          content = error instanceof Error ? error.message : String(error);
          isError = true;
        }
        results.push({ type: 'tool_result', tool_use_id: use.id, content, is_error: isError });
      }
      messages.push({ role: 'user', content: results });
    }
  } finally {
    if (!options.tools) await tools.close();
  }

  const rawText = last?.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('') ?? '';
  return {
    grid: options.grid,
    model,
    response: parseHint(rawText),
    rawText,
    toolCalls,
    stopReason: last?.stop_reason ?? null,
    usage,
  };
}

/**
 * Identity-linked Console keys must name the workspace each request acts in.
 * The SDK only reads `ANTHROPIC_WORKSPACE_ID` on its federation path, so for a
 * plain API key the header is added here. Unset means an ordinary key.
 */
export function createClient(): Anthropic {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {});
}

/** Lenient parse: a response that is not valid JSON in the schema counts as no response, never as a crash. */
export function parseHint(text: string): HintResponse | null {
  try {
    return HintResponseSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

async function main() {
  const grid = process.argv[2] ?? DEFAULT_PUZZLE;
  const run = await runHintAgent({ grid, model: process.env.HINT_MODEL });
  process.stdout.write(JSON.stringify(run, null, 2) + '\n');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`hint agent failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
