import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { runHintAgent, parseHint, type MessagesClient } from './agent';
import { createInProcessHintClient } from './mcp-client';
import { DEFAULT_PUZZLE } from './hint-tools';

function toolUse(id: string, name: string): Anthropic.ToolUseBlock {
  return { type: 'tool_use', id, name, input: {}, caller: { type: 'direct' } };
}

function message(overrides: Partial<Anthropic.Message>): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'fake',
    content: [],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 } as Anthropic.Usage,
    ...overrides,
  } as Anthropic.Message;
}

/** A scripted API: first asks for the deduction list, then answers with whatever it was handed. */
function scriptedClient(finalText: string, captured: Anthropic.MessageCreateParamsNonStreaming[]): MessagesClient {
  let turn = 0;
  return {
    messages: {
      create: async params => {
        captured.push(params);
        turn++;
        if (turn === 1) {
          return message({
            stop_reason: 'tool_use',
            content: [toolUse('tu_1', 'list_available_deductions')],
          });
        }
        return message({ content: [{ type: 'text', text: finalText, citations: null }] });
      },
    },
  };
}

describe('runHintAgent', () => {
  it('feeds tool results back and returns the parsed final hint', async () => {
    const captured: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const final = JSON.stringify({ hint: { strategy: 'Hidden Single', cells: ['r5c6'], explanation: 'Only one spot in row 5.' }, reason: '' });
    const run = await runHintAgent({
      grid: DEFAULT_PUZZLE,
      client: scriptedClient(final, captured),
      tools: createInProcessHintClient(DEFAULT_PUZZLE),
    });

    expect(run.toolCalls).toEqual(['list_available_deductions']);
    expect(run.response?.hint?.strategy).toBe('Hidden Single');
    expect(run.usage).toEqual({ input: 20, output: 10 });

    const secondTurn = captured[1].messages;
    expect(secondTurn).toHaveLength(3);
    const toolResult = (secondTurn[2].content as Anthropic.ToolResultBlockParam[])[0];
    expect(toolResult.tool_use_id).toBe('tu_1');
    expect(String(toolResult.content)).toContain('"Hidden Single"');
    expect(captured[0].tools?.map(t => ('name' in t ? t.name : t.type))).toEqual(['get_grid_state', 'list_available_deductions']);
  });

  it('returns a null response when the final text is not schema-valid JSON', async () => {
    const run = await runHintAgent({
      grid: DEFAULT_PUZZLE,
      client: scriptedClient('Try looking at row 5.', []),
      tools: createInProcessHintClient(DEFAULT_PUZZLE),
    });
    expect(run.response).toBeNull();
    expect(run.rawText).toBe('Try looking at row 5.');
  });

  it('stops after maxTurns even if the model keeps calling tools', async () => {
    const client: MessagesClient = {
      messages: {
        create: async () => message({
          stop_reason: 'tool_use',
          content: [toolUse('tu_x', 'get_grid_state')],
        }),
      },
    };
    const run = await runHintAgent({ grid: DEFAULT_PUZZLE, client, tools: createInProcessHintClient(DEFAULT_PUZZLE), maxTurns: 3 });
    expect(run.toolCalls).toHaveLength(3);
    expect(run.response).toBeNull();
  });
});

describe('parseHint', () => {
  it('accepts a refusal', () => {
    expect(parseHint('{"hint":null,"reason":"No deduction available."}')).toEqual({ hint: null, reason: 'No deduction available.' });
  });
  it('rejects a hint missing cells', () => {
    expect(parseHint('{"hint":{"strategy":"X-Wing"},"reason":""}')).toBeNull();
  });
});
