import { Failure, parseEvent, seconds, verify } from './auth.js';
export class Receiver {
  constructor(client, db, trusted, now = seconds) {
    this.client = client;
    this.inbox = db.collection('inbox');
    this.accounts = db.collection('accounts');
    this.trusted = trusted;
    this.now = now;
  }
  async accept(envelope, body, { failAfterInsert = false } = {}) {
    const context = verify(envelope, body, this.trusted, this.now());
    const event = parseEvent(body);
    const acceptedAt = new Date(this.now() * 1000);
    const record = {
      ...context,
      ...event,
      acceptedAt,
      expiresAt: new Date(acceptedAt.getTime() + 86400000),
    };
    try {
      await this.client.withSession(async (session) =>
        session.withTransaction(
          async () => {
            await this.inbox.insertOne(record, { session });
            if (failAfterInsert) throw new Failure(503, 'injected_failure');
            const changed = await this.accounts.updateOne(
              { _id: event.accountId, source: context.source },
              { $inc: { creditedMinor: event.amountMinor } },
              { session },
            );
            if (changed.matchedCount !== 1) throw new Failure(403, 'account_not_permitted');
          },
          {
            readPreference: 'primary',
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            maxCommitTimeMS: 5000,
          },
        ),
      );
      return { duplicate: false };
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Only the inbox identity insert can violate uniqueness in this write set.
      const existing = await this.inbox.findOne(
        { source: context.source, eventId: context.eventId },
        { readConcern: { level: 'majority' } },
      );
      if (!existing) throw error;
      if (existing.fingerprint !== context.fingerprint)
        throw new Failure(409, 'event_identity_conflict');
      return { duplicate: true };
    }
  }
}
