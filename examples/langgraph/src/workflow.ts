import {
  StateGraph,
  StateSchema,
  ReducedValue,
  MemorySaver,
  START,
  END,
  interrupt,
} from '@langchain/langgraph';
import * as z from 'zod';
export const State = new StateSchema({
  operationId: z.string(),
  draft: z.string(),
  approved: z.boolean().nullable().default(null),
  status: z.enum(['draft', 'published', 'rejected']).default('draft'),
  log: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (left: string[], right: string[]) => left.concat(right) },
  ),
});
export class Publisher {
  private receipts = new Map<string, string>();
  effects = 0;
  publish(id: string, draft: string) {
    const prior = this.receipts.get(id);
    if (prior !== undefined) {
      if (prior !== draft) throw new Error('Operation payload conflict');
      return;
    }
    this.receipts.set(id, draft);
    this.effects++;
  }
}
export function createWorkflow(
  checkpointer: MemorySaver,
  publisher: Publisher,
  beforeApproval: () => void = () => {},
) {
  return new StateGraph(State)
    .addNode('prepare', (state) => ({ draft: state.draft.trim(), log: ['prepared'] }))
    .addNode('approval', (state) => {
      beforeApproval(); // instrumentation demonstrates re-entry, never a business effect
      const decision: unknown = interrupt({ operationId: state.operationId, draft: state.draft });
      if (typeof decision !== 'boolean') throw new Error('Invalid approval decision');
      return { approved: decision, log: [decision ? 'approved' : 'rejected'] };
    })
    .addNode('publish', (state) => {
      publisher.publish(state.operationId, state.draft);
      return { status: 'published' as const, log: ['published'] };
    })
    .addNode('reject', () => ({ status: 'rejected' as const }))
    .addEdge(START, 'prepare')
    .addEdge('prepare', 'approval')
    .addConditionalEdges('approval', (state) => (state.approved ? 'publish' : 'reject'), [
      'publish',
      'reject',
    ])
    .addEdge('publish', END)
    .addEdge('reject', END)
    .compile({ checkpointer });
}
