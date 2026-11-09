import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../dist/api.js';
const plain = (value) => JSON.parse(JSON.stringify(value));
test('variables and selection sets determine the returned representation', async () => {
  const api = fixture();
  const r = await api.run('query($id:ID!){ order(id:$id){ title } }', 'a', { id: 'one' });
  assert.deepEqual(plain(r), { data: { order: { title: 'Book' } } });
});
test('schema validation rejects unknown fields before resolver work', async () => {
  const api = fixture();
  const r = await api.run('{ orders { secret } }', 'a');
  assert.ok(r.errors?.length);
  assert.equal(api.batches(), 0);
  assert.equal(r.data, undefined);
});
test('non-null list failure bubbles to the root when identity is missing', async () => {
  const r = await fixture().run('{ orders { id } }', undefined);
  assert.equal(r.data, null);
  assert.equal(r.errors[0].extensions.code, 'UNAUTHENTICATED');
  assert.deepEqual(r.errors[0].path, ['orders']);
});
test('unauthorized nullable object is absent without exposing another tenant', async () => {
  const r = await fixture().run('{ order(id:"hidden"){ title } }', 'a');
  assert.deepEqual(plain(r), { data: { order: null } });
});
test('request scoped DataLoader batches and deduplicates shared customer reads', async () => {
  const api = fixture();
  const r = await api.run('{ orders(first:2){ id customer { name } } }', 'a');
  assert.equal(r.errors, undefined);
  assert.equal(api.batches(), 1);
  assert.equal(r.data.orders[0].customer.name, 'Alice');
  assert.equal(r.data.orders[1].customer.name, 'Alice');
  await api.run('{ orders { customer { name } } }', 'a');
  assert.equal(api.batches(), 2);
});
test('page limits reject oversized demand even when types validate', async () => {
  const r = await fixture().run('{ orders(first:10000){ id } }', 'a');
  assert.equal(r.data, null);
  assert.match(r.errors[0].message, /Page size/);
});
test('mutation fields run serially and preserve the final title', async () => {
  const api = fixture();
  const r = await api.run(
    'mutation{ first:renameOrder(id:"one",title:"First"){title} second:renameOrder(id:"one",title:"Second"){title} }',
    'a',
  );
  assert.equal(r.errors, undefined);
  assert.equal(r.data.first.title, 'First');
  assert.equal(r.data.second.title, 'Second');
  assert.equal((await api.run('{order(id:"one"){title}}', 'a')).data.order.title, 'Second');
});
test('nullable mutation error permits an unrelated sibling result', async () => {
  const r = await fixture().run(
    'mutation{ bad:renameOrder(id:"one",title:""){title} good:renameOrder(id:"two",title:"Valid"){title} }',
    'a',
  );
  assert.equal(r.data.bad, null);
  assert.equal(r.data.good.title, 'Valid');
  assert.deepEqual(r.errors[0].path, ['bad']);
});
test('a valid mutation cannot modify another tenant through a supplied ID', async () => {
  const api = fixture();
  const rejected = await api.run(
    'mutation($id:ID!){ renameOrder(id:$id,title:"Changed"){title} }',
    'a',
    { id: 'hidden' },
  );
  assert.deepEqual(plain(rejected), { data: { renameOrder: null } });
  const owner = await api.run('{ order(id:"hidden"){title} }', 'b');
  assert.equal(owner.data.order.title, 'Private');
});
