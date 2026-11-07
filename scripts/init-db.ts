import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const directUri = process.env.MONGODB_DIRECT_URI || 'mongodb://127.0.0.1:27017/?directConnection=true';
  const address = new URL(directUri);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname)) throw new Error('Database initialization is restricted to this computer');
  const memberHost = `${address.hostname}:${address.port || '27017'}`;
  const client = new MongoClient(directUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect(); const admin = client.db('admin');
    const hello = await admin.command({ hello: 1 });
    if (!hello.setName) {
      try { await admin.command({ replSetInitiate: { _id: 'pharmacy-rs', members: [{ _id: 0, host: memberHost }] } }); }
      catch (error: any) { if (error.codeName !== 'AlreadyInitialized') throw error; }
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      const state = await admin.command({ hello: 1 });
      if (state.isWritablePrimary && state.setName === 'pharmacy-rs') { console.log('Local pharmacy-rs is ready.'); return; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Replica set did not become ready');
  } finally { await client.close(); }
}
main().catch(() => { console.error('Database setup failed. Ensure local mongod is running with --replSet pharmacy-rs at MONGODB_DIRECT_URI and provide admin credentials there if required. No data was deleted.'); process.exitCode = 1; });
