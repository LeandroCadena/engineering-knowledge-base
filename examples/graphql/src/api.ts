import { buildSchema, graphql, GraphQLError, type GraphQLFieldResolver } from 'graphql';
import DataLoader from 'dataloader';
export const schema = buildSchema(`
 type User { id: ID!, name: String! }
 type Order { id: ID!, title: String!, customer: User }
 type Query { orders(first: Int! = 10): [Order!]!, order(id: ID!): Order }
 type Mutation { renameOrder(id: ID!, title: String!): Order }
`);
type Order = { id: string; tenant: string; customerId: string; title: string };
export function fixture() {
  const orders: Order[] = [
    { id: 'one', tenant: 'a', customerId: 'alice', title: 'Book' },
    { id: 'two', tenant: 'a', customerId: 'alice', title: 'Pen' },
    { id: 'hidden', tenant: 'b', customerId: 'bob', title: 'Private' },
  ];
  const users = [
    { id: 'alice', tenant: 'a', name: 'Alice' },
    { id: 'bob', tenant: 'b', name: 'Bob' },
  ];
  let batches = 0;
  const run = async (
    source: string,
    tenant: string | undefined,
    variableValues?: Record<string, unknown>,
  ) => {
    // Trusted context is supplied by the fixture, not operation variables.
    const allowed = () => {
      if (!tenant)
        throw new GraphQLError('Unauthenticated', { extensions: { code: 'UNAUTHENTICATED' } });
    };
    const customer = new DataLoader<string, { id: string; name: string } | null>(async (keys) => {
      batches++;
      return keys.map((id) => {
        const u = users.find((x) => x.id === id && x.tenant === tenant);
        return u ? { id: u.id, name: u.name } : null;
      });
    });
    const find = (id: string) => orders.find((o) => o.id === id && o.tenant === tenant) ?? null;
    const root = {
      orders: ({ first }: { first: number }) => {
        allowed();
        if (first < 1 || first > 20) throw new GraphQLError('Page size must be 1..20');
        return orders.filter((o) => o.tenant === tenant).slice(0, first);
      },
      order: ({ id }: { id: string }) => {
        allowed();
        return find(id);
      },
      renameOrder: ({ id, title }: { id: string; title: string }) => {
        allowed();
        if (!title.trim() || title.length > 100) throw new GraphQLError('Invalid title');
        const order = find(id);
        if (!order) return null;
        order.title = title.trim();
        return order;
      },
    };
    const fieldResolver: GraphQLFieldResolver<unknown, unknown> = (source, args, context, info) => {
      if (info.parentType.name === 'Order' && info.fieldName === 'customer')
        return customer.load((source as Order).customerId);
      const value = (source as Record<string, unknown>)[info.fieldName];
      return typeof value === 'function' ? value(args, context, info) : value;
    };
    return graphql({
      schema,
      source,
      rootValue: root,
      contextValue: { tenant },
      variableValues,
      fieldResolver,
    });
  };
  return { run, batches: () => batches };
}
