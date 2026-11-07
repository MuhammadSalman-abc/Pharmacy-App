// Disposable local UI QA server. Never connects to the application's configured database.
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import mongoose from 'mongoose';
import { createApp } from '../apps/api/src/app';
import { initializeIndexes } from '../apps/api/src/models';
import { CatalogService } from '../apps/api/src/services';

async function main() {
  const db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(db.getUri('disposable_ui_qa'));
  await initializeIndexes();
  for (const [name, quantity, minimumStock, form, strength, strengthUnit] of [
    ['Panadol', 100, 10, 'Tablet', 500, 'mg'], ['Amoxil', 8, 15, 'Capsule', 250, 'mg'], ['Brufen', 5, 10, 'Tablet', 400, 'mg'], ['Ceftriaxone', 0, 5, 'Injection', 1, 'g'], ['ORS', 12, 15, 'Other', 20, 'g'], ['Calpol', 7, 10, 'Syrup', 120, 'ml']
  ] as const) {
    await CatalogService.create({ name, barcode: `QA-${name}`, form, strength, strengthUnit, quantity, minimumStock, totalPurchasePaisa: quantity * 1000, retailPricePaisa: 1500, wholesalePricePaisa: 1200 });
  }
  const server = createApp({ token: 'disposable-ui-test-token-32-characters', origin: 'http://127.0.0.1:3000' }).listen(5001, '127.0.0.1', () => console.log('Disposable QA API on 127.0.0.1:5001. Data is temporary.'));
  const stop = () => { server.close(() => { void mongoose.disconnect().then(() => db.stop()).then(() => process.exit(0)); }); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
