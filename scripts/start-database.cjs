const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');
require('dotenv').config({ quiet: true });

async function main() {
  const uri = process.env.MONGODB_DIRECT_URI || 'mongodb://127.0.0.1:27018/?directConnection=true';
  const address = new URL(uri);
  if (!['127.0.0.1', 'localhost'].includes(address.hostname)) throw new Error('Only a local database is supported by this launcher.');
  const port = address.port || '27018';
  const folder = path.resolve(__dirname, '../.local/pharmacy-db');
  const logFolder = path.resolve(__dirname, '../.local/logs');
  async function connect() {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 800 });
    try { await client.connect(); return client; } catch { await client.close(); return null; }
  }
  let client = await connect();
  if (!client) {
    const binary = process.env.MONGOD_PATH || 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
    if (!fs.existsSync(binary)) throw new Error('MongoDB not found. Set MONGOD_PATH in .env to your installed mongod.exe.');
    fs.mkdirSync(folder, { recursive: true }); fs.mkdirSync(logFolder, { recursive: true });
    const child = spawn(binary, ['--dbpath', folder, '--replSet', 'pharmacy-rs', '--bind_ip', '127.0.0.1', '--port', port, '--logpath', path.join(logFolder, 'mongodb.log'), '--logappend'], { detached: true, windowsHide: true, stdio: 'ignore' });
    let launchError;
    child.on('error', error => { launchError = error; }); child.unref();
    for (let attempt = 0; attempt < 30 && !client; attempt++) {
      if (launchError) throw new Error('Could not launch MongoDB. Check MONGOD_PATH.');
      await new Promise(resolve => setTimeout(resolve, 500)); client = await connect();
    }
  }
  if (!client) throw new Error('Database did not start. See .local/logs/mongodb.log.');
  try {
    const admin = client.db('admin'); let hello = await admin.command({ hello: 1 });
    if (!hello.setName) {
      const options = await admin.command({ getCmdLineOpts: 1 });
      if (options.parsed?.replication?.replSet !== 'pharmacy-rs' && options.parsed?.replication?.replSetName !== 'pharmacy-rs') throw new Error('This port belongs to a different MongoDB. It was left unchanged.');
      const configuredPath = options.parsed?.storage?.dbPath;
      if (!configuredPath || path.resolve(configuredPath).toLowerCase() !== folder.toLowerCase()) throw new Error('Database path differs from the pharmacy folder. It was left unchanged.');
      try { await admin.command({ replSetInitiate: { _id: 'pharmacy-rs', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } }); }
      catch (error) { if (error.codeName !== 'AlreadyInitialized') throw error; }
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      hello = await admin.command({ hello: 1 });
      if (hello.setName === 'pharmacy-rs' && hello.isWritablePrimary) { console.log(`Pharmacy MongoDB ready on this computer (port ${port}).`); return; }
      if (hello.setName && hello.setName !== 'pharmacy-rs') throw new Error('A different replica set uses this port. It was left unchanged.');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Replica set is not ready. See .local/logs/mongodb.log.');
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[database address]')); process.exitCode = 1; });
