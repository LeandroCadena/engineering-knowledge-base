import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { fromOpenAI, fromAnthropic, parseDecision, selectContext } from '../dist/adapters.js';
const text = JSON.stringify({ category: 'billing', summary: 'Duplicate charge' });
const openaiReply = (extra = {}) => ({
  id: 'resp_fixture',
  object: 'response',
  status: 'completed',
  output: [
    {
      id: 'msg_fixture',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text, annotations: [] }],
    },
  ],
  ...extra,
});
const claudeReply = (extra = {}) => ({
  id: 'msg_fixture',
  type: 'message',
  role: 'assistant',
  model: 'fixture-model',
  stop_reason: 'end_turn',
  stop_sequence: null,
  content: [{ type: 'text', text }],
  usage: { input_tokens: 10, output_tokens: 10 },
  ...extra,
});
function transport(reply, inspect = () => {}) {
  return async (url, init) => {
    inspect(String(url), JSON.parse(init.body));
    return new Response(JSON.stringify(reply), { headers: { 'content-type': 'application/json' } });
  };
}
function openAI(reply, inspect) {
  return new OpenAI({
    apiKey: 'fixture-not-a-key',
    maxRetries: 0,
    fetch: transport(reply, inspect),
  });
}
function claude(reply, inspect) {
  return new Anthropic({
    apiKey: 'fixture-not-a-key',
    maxRetries: 0,
    fetch: transport(reply, inspect),
  });
}
const signal = () => new AbortController().signal;
test('OpenAI SDK serializes Responses schema and normalizes validated output', async () => {
  const client = openAI(openaiReply(), (url, body) => {
    assert.match(url, /\/responses$/);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.name, 'ticket_route');
    assert.equal(body.input, 'Charged twice');
    assert.equal(body.max_output_tokens, 200);
  });
  assert.deepEqual(await fromOpenAI(client, 'fixture-model', 'Charged twice', signal()), {
    category: 'billing',
    summary: 'Duplicate charge',
  });
});
test('Anthropic SDK serializes Messages schema and normalizes validated output', async () => {
  const client = claude(claudeReply(), (url, body) => {
    assert.match(url, /\/messages$/);
    assert.equal(body.output_config.format.type, 'json_schema');
    assert.equal(body.messages[0].role, 'user');
    assert.equal(body.max_tokens, 200);
  });
  assert.deepEqual(await fromAnthropic(client, 'fixture-model', 'Charged twice', signal()), {
    category: 'billing',
    summary: 'Duplicate charge',
  });
});
test('refusal and incomplete outputs never become business decisions', async () => {
  await assert.rejects(
    fromOpenAI(
      openAI(
        openaiReply({
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'refusal', refusal: 'Cannot classify' }],
            },
          ],
        }),
      ),
      'fixture-model',
      'Ticket',
      signal(),
    ),
    /refusal/,
  );
  await assert.rejects(
    fromOpenAI(openAI(openaiReply({ status: 'incomplete' })), 'fixture-model', 'Ticket', signal()),
    /Incomplete/,
  );
  await assert.rejects(
    fromAnthropic(
      claude(claudeReply({ stop_reason: 'max_tokens' })),
      'fixture-model',
      'Ticket',
      signal(),
    ),
    /Incomplete/,
  );
});
test('local validation rejects malformed shape and semantic bounds', () => {
  for (const value of [
    'not json',
    JSON.stringify({ category: 'other', summary: 'x' }),
    JSON.stringify({ category: 'billing', summary: '' }),
    JSON.stringify({ category: 'billing', summary: 'x'.repeat(121) }),
    JSON.stringify({ category: 'billing', summary: 'x', approved: true }),
  ])
    assert.throws(() => parseDecision(value));
});
test('input bounds reject before the SDK transport runs', async () => {
  let calls = 0;
  const client = openAI(openaiReply(), () => calls++);
  await assert.rejects(fromOpenAI(client, 'fixture-model', 'x'.repeat(8001), signal()), /size/);
  assert.equal(calls, 0);
});
test('an already aborted request cannot produce a decision', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fromOpenAI(openAI(openaiReply()), 'fixture-model', 'Ticket', controller.signal),
  );
});
test('retrieval filters tenant before ranking and fits the context character budget', () => {
  const candidates = [
    { id: 'secret', tenant: 'b', score: 99, text: 'private' },
    { id: 'large', tenant: 'a', score: 5, text: 'x'.repeat(100) },
    { id: 'small', tenant: 'a', score: 4, text: 'allowed' },
  ];
  const context = selectContext('a', candidates, 10);
  assert.deepEqual(
    context.map((c) => c.id),
    ['small'],
  );
  assert.equal(candidates[0].id, 'secret');
});
