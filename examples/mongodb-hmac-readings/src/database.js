import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

export async function fixtureDatabase() {
  const repl = await MongoMemoryReplSet.create({
    binary: { version: '8.0.17' },
    replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' },
    instanceOpts: [
      { args: ['--nounixsocket', '--setParameter', 'diagnosticDataCollectionEnabled=false'] },
    ],
  });
  const client = new MongoClient(repl.getUri(), {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    waitQueueTimeoutMS: 5000,
    maxPoolSize: 5,
  });
  try {
    await client.connect();
    const db = client.db('webhook_fixture');
    return {
      client,
      db,
      async close() {
        try {
          await client.close();
        } finally {
          await repl.stop();
        }
      },
    };
  } catch (error) {
    await client.close();
    await repl.stop();
    throw error;
  }
}

export async function schema(db) {
  await db.createCollection('accounts', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['_id', 'source', 'creditedMinor'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'string' },
          source: { bsonType: 'string' },
          creditedMinor: {
            bsonType: ['int', 'long', 'double'],
            minimum: 0,
            maximum: 9000000000000,
          },
        },
      },
    },
  });
  await db.createCollection('inbox', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        additionalProperties: false,
        required: [
          'source',
          'eventId',
          'fingerprint',
          'accountId',
          'amountMinor',
          'acceptedAt',
          'expiresAt',
        ],
        properties: {
          _id: { bsonType: 'objectId' },
          source: { bsonType: 'string' },
          eventId: { bsonType: 'string' },
          fingerprint: { bsonType: 'string' },
          accountId: { bsonType: 'string' },
          amountMinor: { bsonType: ['int', 'long', 'double'], minimum: 1, maximum: 1000000 },
          acceptedAt: { bsonType: 'date' },
          expiresAt: { bsonType: 'date' },
        },
      },
    },
  });
  const inbox = db.collection('inbox');
  await inbox.createIndex({ source: 1, eventId: 1 }, { unique: true, name: 'event_identity' });
  await inbox.createIndex({ source: 1, acceptedAt: -1, _id: -1 }, { name: 'source_time' });
  await inbox.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'event_retention' });
  await db.collection('accounts').insertMany([
    { _id: 'account-a', source: 'provider-a', creditedMinor: 0 },
    { _id: 'account-b', source: 'provider-b', creditedMinor: 0 },
  ]);
}
