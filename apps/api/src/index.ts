import 'dotenv/config';
import mongoose from 'mongoose';
import pino from 'pino';
import { z } from 'zod';
import { createApp } from './app';
import { initializeIndexes } from './models';

async function main() {
  const config = z.object({ MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/pharmacy?replicaSet=pharmacy-rs'), API_TOKEN: z.string().min(32), PORT: z.coerce.number().int().min(0).max(65535).default(5000), UI_ORIGIN: z.string().url().optional(), HOST: z.string().default('127.0.0.1') }).parse(process.env);
  const logger = pino();
  mongoose.set('bufferCommands', false);
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName || !hello.isWritablePrimary) throw new Error('A writable local MongoDB replica set is required. Run npm run db:init.');
  await initializeIndexes();
  const origin = config.UI_ORIGIN || (process.env.WEB_PORT ? `http://localhost:${process.env.WEB_PORT}` : undefined);
  const server = createApp({ token: config.API_TOKEN, origin, logger }).listen(config.PORT, config.HOST, () => logger.info({ address: server.address() }, 'Local pharmacy API ready'));
  let closing = false;
  const stop = () => {
    if (closing) return; closing = true;
    const timeout = setTimeout(() => { server.closeAllConnections(); void mongoose.disconnect().finally(() => process.exit(1)); }, 15000); timeout.unref();
    server.close(() => { clearTimeout(timeout); void mongoose.disconnect().finally(() => process.exit(0)); });
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(error => { console.error('API startup failed:', error instanceof z.ZodError ? 'Check API_TOKEN (32+ characters), PORT and environment configuration.' : error.message?.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[redacted database URI]')); process.exitCode = 1; });
