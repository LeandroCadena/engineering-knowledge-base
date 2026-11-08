import { randomBytes } from 'node:crypto';
import { fixtureDatabase, schema } from './database.js';
import { Receiver } from './processor.js';
import { seconds, sign } from './auth.js';
const fixture = await fixtureDatabase();
try {
  await schema(fixture.db);
  const secret = randomBytes(32);
  const trusted = new Map([['demo', { secret, source: 'provider-a' }]]);
  const body = Buffer.from('{"accountId":"account-a","amountMinor":10}');
  const envelope = { keyId: 'demo', timestamp: String(seconds()), eventId: 'demo-event' };
  envelope.signature = sign(envelope, body, secret);
  const receiver = new Receiver(fixture.client, fixture.db, trusted);
  console.log('First:', await receiver.accept(envelope, body));
  console.log('Retry:', await receiver.accept(envelope, body));
  console.log(
    'Credited minor units:',
    (await fixture.db.collection('accounts').findOne({ _id: 'account-a' })).creditedMinor,
  );
} finally {
  await fixture.close();
}
