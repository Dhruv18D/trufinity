import { describe, expect, jest, test } from '@jest/globals';
import { AnthropicEmailClassifier } from '../../src/modules/google/anthropic-email-classifier';

const input = { subject: 'Synthetic subject', bodyText: 'Synthetic body only.' };
const config = { model: 'test-model', timeoutMs: 1000, maxRetries: 2, promptVersion: 'test-v1' };

function client(response: unknown, calls: unknown[] = []) {
  return { calls, messages: { create: jest.fn(async (request: unknown) => { calls.push(request); return response; }) } } as any;
}

describe('Anthropic email classifier adapter', () => {
  test('requests strict structured classification without leaking input in errors', async () => {
    const c = client({ content: [{ type: 'text', text: JSON.stringify({ label: 'complaint', confidence: 0.9, reason: 'Synthetic reason.' }) }] });
    const result = await new AnthropicEmailClassifier(c, config).classify(input);
    expect(result.label).toBe('complaint');
    expect(c.messages.create).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-model', max_tokens: 200 }));
  });

  test('rejects malformed provider output', async () => {
    await expect(new AnthropicEmailClassifier(client({ content: [{ type: 'text', text: '{"label":"complaint"}' }] }), config).classify(input)).rejects.toThrow('invalid structured output');
  });

  test('retries retryable provider failures and succeeds', async () => {
    let count = 0;
    const c = { messages: { create: jest.fn(async () => { count += 1; if (count === 1) throw Object.assign(new Error('provider'), { response: { status: 429 } }); return { content: [{ type: 'text', text: '{"label":"none","confidence":0,"reason":"Synthetic reason."}' }] }; }) } } as any;
    const waits: number[] = [];
    await expect(new AnthropicEmailClassifier(c, config, async (ms) => { waits.push(ms); }).classify(input)).resolves.toMatchObject({ label: 'none' });
    expect(c.messages.create).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([100]);
  });

  test('sanitizes non-retryable provider errors', async () => {
    const c = { messages: { create: jest.fn(async () => { throw new Error(`${input.subject} ${input.bodyText}`); }) } } as any;
    await expect(new AnthropicEmailClassifier(c, config).classify(input)).rejects.toThrow('provider request failed');
  });
});
