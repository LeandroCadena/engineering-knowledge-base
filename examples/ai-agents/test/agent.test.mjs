import test from 'node:test';
import assert from 'node:assert/strict';
import { Ledger, runAgent, parseAction } from '../dist/agent.js';
const actor = { id: 'alice', tenant: 'a', canRefund: true };
const lookup = { kind: 'tool', id: 'call-1', name: 'lookupOrder', args: { orderId: 'one' } };
const refund = {
  kind: 'tool',
  id: 'refund-1',
  name: 'refundOrder',
  args: { orderId: 'one', amountCents: 1000 },
};
const end = { kind: 'final', text: 'Finished' };
function script(actions) {
  let i = 0;
  return async () => actions[Math.min(i++, actions.length - 1)];
}
function options(extra = {}) {
  return {
    actor,
    runId: 'server-run-1',
    model: script([lookup, end]),
    ledger: new Ledger(),
    approvals: new Set(),
    maxTurns: 4,
    signal: new AbortController().signal,
    ...extra,
  };
}
test('allowlisted lookup returns a public result then stops', async () => {
  const r = await runAgent(options());
  assert.equal(r.status, 'completed');
  assert.deepEqual(r.history[0].result, { orderId: 'one', refunded: false, amountCents: 1000 });
});
test('model-supplied IDs cannot cross tenant ownership', async () => {
  await assert.rejects(
    runAgent(options({ model: script([{ ...lookup, args: { orderId: 'hidden' } }]) })),
    /unavailable/,
  );
});
test('unknown tools and forged authority fields are rejected', () => {
  assert.throws(() => parseAction({ ...refund, approved: true }), /fields/);
  assert.throws(() => parseAction({ ...refund, name: 'executeShell' }), /Unknown/);
  assert.throws(() => parseAction({ ...refund, args: { ...refund.args, tenant: 'b' } }), /fields/);
});
test('a write pauses before producing effects without a matching trusted grant', async () => {
  const ledger = new Ledger();
  const r = await runAgent(options({ ledger, model: script([refund]) }));
  assert.equal(r.status, 'approval_required');
  assert.equal(ledger.effects, 0);
});
test('approved duplicate calls reuse one receipt without repeating the effect', async () => {
  const ledger = new Ledger();
  const approvals = new Set([ledger.proposal(actor, 'one', 1000)]);
  const r = await runAgent(options({ ledger, approvals, model: script([refund, refund, end]) }));
  assert.equal(r.status, 'completed');
  assert.equal(ledger.effects, 1);
  assert.equal(approvals.size, 0);
  assert.deepEqual(r.history[0].result, r.history[1].result);
});
test('receipt namespaces do not grant another actor an approval', () => {
  const ledger = new Ledger();
  const approvals = new Set([ledger.proposal(actor, 'one', 1000)]);
  ledger.execute(actor, 'run', refund, approvals);
  // Another caller/tenant has its own namespace and still needs its own approval.
  const other = { id: 'bob', tenant: 'b', canRefund: true };
  const r = ledger.execute(
    other,
    'run',
    { ...refund, args: { orderId: 'hidden', amountCents: 2000 } },
    new Set(),
  );
  assert(r.pause);
  assert.equal(ledger.effects, 1);
});
test('permission is checked even when a matching receipt exists', () => {
  const ledger = new Ledger();
  ledger.execute(actor, 'run', refund, new Set([ledger.proposal(actor, 'one', 1000)]));
  assert.throws(
    () => ledger.execute({ ...actor, canRefund: false }, 'run', refund, new Set()),
    /forbidden/,
  );
});
test('endless valid proposals stop at the turn bound', async () => {
  const r = await runAgent(options({ model: script([lookup]), maxTurns: 2 }));
  assert.equal(r.status, 'budget_exhausted');
  assert.equal(r.history.length, 2);
});
test('cancellation is checked before proposing or executing an action', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    runAgent(
      options({
        signal: controller.signal,
        model: async () => {
          calls++;
          return refund;
        },
      }),
    ),
  );
  assert.equal(calls, 0);
});

test('reusing a call identity with a different order is an idempotency conflict', () => {
  const ledger = new Ledger();
  ledger.execute(actor, 'run', refund, new Set([ledger.proposal(actor, 'one', 1000)]));
  assert.throws(
    () =>
      ledger.execute(
        actor,
        'run',
        { ...refund, args: { orderId: 'two', amountCents: 1000 } },
        new Set(),
      ),
    /Idempotency conflict/,
  );
  assert.equal(ledger.effects, 1);
});
