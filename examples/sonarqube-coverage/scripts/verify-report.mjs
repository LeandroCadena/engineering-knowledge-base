import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const report = await readFile('coverage/lcov.info', 'utf8');
const records = report.split('end_of_record').filter((r) => r.includes('SF:'));
assert.equal(records.length, 1, 'Unexpected coverage scope');
const record = records[0];
assert.match(record, /SF:(?:.*[/\\])?src[/\\]shipping\.mjs/);
for (const [found, hit] of [
  ['LF', 'LH'],
  ['FNF', 'FNH'],
  ['BRF', 'BRH'],
]) {
  const count = (key) => Number(record.match(new RegExp(`^${key}:(\\d+)$`, 'm'))?.[1]);
  assert(count(found) > 0, `Missing ${found}`);
  assert.equal(count(hit), count(found), `Uncovered ${found}`);
}
console.log('LCOV scope, lines, functions and branches verified');
