export type Actor = { id: string; tenant: string; canRefund: boolean };
type Order = {
  id: string;
  tenant: string;
  amountCents: number;
  version: number;
  refunded: boolean;
};
type Action =
  | { kind: 'final'; text: string }
  | {
      kind: 'tool';
      id: string;
      name: 'lookupOrder' | 'refundOrder';
      args: { orderId: string; amountCents?: number };
    };
export type Model = (history: readonly unknown[], signal: AbortSignal) => Promise<unknown>;
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid object');
  return v as Record<string, unknown>;
}
function keys(v: Record<string, unknown>, expected: string[]) {
  if (Object.keys(v).sort().join(',') !== expected.sort().join(','))
    throw new Error('Unexpected fields');
}
function short(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 80;
}
export function parseAction(value: unknown): Action {
  const v = object(value);
  if (v.kind === 'final') {
    keys(v, ['kind', 'text']);
    if (typeof v.text !== 'string' || v.text.length > 500) throw new Error('Invalid final');
    return { kind: 'final', text: v.text };
  }
  keys(v, ['kind', 'id', 'name', 'args']);
  if (v.kind !== 'tool' || !short(v.id) || (v.name !== 'lookupOrder' && v.name !== 'refundOrder'))
    throw new Error('Unknown action');
  const args = object(v.args);
  keys(args, v.name === 'lookupOrder' ? ['orderId'] : ['orderId', 'amountCents']);
  if (!short(args.orderId)) throw new Error('Invalid order ID');
  if (
    v.name === 'refundOrder' &&
    (!Number.isSafeInteger(args.amountCents) || (args.amountCents as number) <= 0)
  )
    throw new Error('Invalid amount');
  return {
    kind: 'tool',
    id: v.id,
    name: v.name,
    args: {
      orderId: args.orderId,
      ...(v.name === 'refundOrder' ? { amountCents: args.amountCents as number } : {}),
    },
  };
}
export class Ledger {
  private orders = new Map<string, Order>([
    ['one', { id: 'one', tenant: 'a', amountCents: 1000, version: 1, refunded: false }],
    ['two', { id: 'two', tenant: 'a', amountCents: 1000, version: 1, refunded: false }],
    ['hidden', { id: 'hidden', tenant: 'b', amountCents: 2000, version: 1, refunded: false }],
  ]);
  private receipts = new Map<
    string,
    { payload: string; result: { orderId: string; refunded: true } }
  >();
  effects = 0;
  proposal(actor: Actor, orderId: string, amountCents: number) {
    const order = this.owned(actor, orderId);
    return JSON.stringify([actor.tenant, actor.id, order.id, amountCents, order.version]);
  }
  private owned(actor: Actor, id: string) {
    const order = this.orders.get(id);
    if (!order || order.tenant !== actor.tenant) throw new Error('Order unavailable');
    return order;
  }
  execute(
    actor: Actor,
    runId: string,
    action: Extract<Action, { kind: 'tool' }>,
    approvals: Set<string>,
  ) {
    const order = this.owned(actor, action.args.orderId);
    if (action.name === 'lookupOrder')
      return {
        result: { orderId: order.id, refunded: order.refunded, amountCents: order.amountCents },
      };
    if (!actor.canRefund) throw new Error('Refund forbidden');
    const amount = action.args.amountCents!;
    if (amount !== order.amountCents) throw new Error('Only full refunds supported');
    const key = JSON.stringify([actor.tenant, actor.id, runId, action.id]);
    const payload = JSON.stringify([order.id, amount]);
    const prior = this.receipts.get(key);
    if (prior) {
      if (prior.payload !== payload) throw new Error('Idempotency conflict');
      return { result: prior.result };
    }
    if (order.refunded) throw new Error('Already refunded');
    const proposal = this.proposal(actor, order.id, amount);
    if (!approvals.has(proposal))
      return { pause: { orderId: order.id, amountCents: amount, proposal } };
    // One synchronous in-memory critical section, not a durable payment operation.
    approvals.delete(proposal);
    order.refunded = true;
    order.version++;
    this.effects++;
    const result = { orderId: order.id, refunded: true as const };
    this.receipts.set(key, { payload, result });
    return { result };
  }
}
export async function runAgent(options: {
  actor: Actor;
  runId: string;
  model: Model;
  ledger: Ledger;
  approvals: Set<string>;
  maxTurns: number;
  signal: AbortSignal;
}) {
  const { actor, runId, model, ledger, approvals, maxTurns, signal } = options;
  if (!short(runId) || !Number.isSafeInteger(maxTurns) || maxTurns < 1 || maxTurns > 10)
    throw new Error('Invalid run bounds');
  const history: unknown[] = [];
  for (let turn = 0; turn < maxTurns; turn++) {
    signal.throwIfAborted();
    const action = parseAction(await model(history, signal));
    signal.throwIfAborted();
    if (action.kind === 'final')
      return { status: 'completed' as const, text: action.text, history };
    const result = ledger.execute(actor, runId, action, approvals);
    if (result.pause)
      return { status: 'approval_required' as const, proposal: result.pause, history };
    history.push({ callId: action.id, name: action.name, result: result.result });
  }
  return { status: 'budget_exhausted' as const, history };
}
