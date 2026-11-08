import { randomBytes } from 'node:crypto';
import { database } from '../lib/store.ts';
export function seed() {
  const db = database();
  const tokens = {
    admin: randomBytes(24).toString('hex'),
    reader: randomBytes(24).toString('hex'),
  };
  const insert = db.prepare('INSERT INTO sessions VALUES(?,?,?,?)');
  insert.run(tokens.admin, 'user-a', 'admin', Date.now() + 3_600_000);
  insert.run(tokens.reader, 'user-b', 'reader', Date.now() + 3_600_000);
  return tokens;
}
if (!process.env.SEED_QUIET) {
  const tokens = seed();
  console.log(
    'Local-only fixture credentials; set an HttpOnly kb_session cookie on localhost. Expires in one hour.',
  );
  console.log(JSON.stringify(tokens, null, 2));
}
