import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import request from 'supertest';
import pino from 'pino';
import { createApp } from '../apps/api/src/app';
import { initializeIndexes, Medicine, Sale, StockMovement } from '../apps/api/src/models';
import { inventoryRepository } from '../apps/api/src/repositories';
import { createLowStockPdf } from '../apps/api/src/low-stock-pdf';

const token = 'integration-test-token-with-at-least-32-characters';
const app = createApp({ token, origin: 'http://127.0.0.1:3000', logger: pino({ enabled: false }) });
let db: MongoMemoryReplSet;
const api = () => request(app);
const auth = { Authorization: `Bearer ${token}` };
let counter = 0;
const medicineInput = (overrides = {}) => ({ name: `Medicine ${++counter}`, form: 'Tablet', strength: 500, strengthUnit: 'mg', quantity: 100, minimumStock: 10, totalPurchasePaisa: 15000, retailPricePaisa: 200, wholesalePricePaisa: 175, ...overrides });
async function medicine(overrides = {}) {
  const response = await api().post('/api/medicines').set(auth).send(medicineInput(overrides));
  assert.equal(response.status, 201, JSON.stringify(response.body)); return response.body.data;
}
const sale = (id: string, quantity: number, requestId = randomUUID()) => ({ requestId, priceMode: 'retail', items: [{ medicineId: id, quantity }] });

before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(db.getUri('pharmacy_test'));
  await initializeIndexes();
}, { timeout: 1800000 });
after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

test('token, origin, validation and strict edit boundaries', async () => {
  assert.equal((await api().get('/api/medicines')).status, 401);
  assert.equal((await api().get('/api/medicines').set(auth).set('Origin', 'https://example.com')).status, 403);
  assert.equal((await api().get('/api/health').set(auth)).body.data.ready, true);
  assert.equal((await api().post('/api/medicines').set(auth).send(medicineInput({ quantity: 1.5 }))).status, 400);
  assert.equal((await api().get('/api/medicines?limit=1000').set(auth)).status, 400);
  const m = await medicine();
  assert.equal((await api().patch(`/api/medicines/${m._id}`).set(auth).send({ quantity: 999 })).status, 400);
  assert.equal((await api().post('/api/sales').set(auth).send(sale(m._id, -2))).status, 400);
  assert.equal((await api().get('/api/sales/bad-id').set(auth)).status, 400);
});

test('opening stock, literal search, barcode uniqueness and rounding', async () => {
  const m = await medicine({ name: 'Literal[Tablets]', barcode: 'ABC-001', quantity: 3, totalPurchasePaisa: 100 });
  assert.equal(m.purchasePricePaisa, 33);
  const found = await api().get('/api/medicines').query({ search: 'literal[' }).set(auth);
  assert.equal(found.body.data[0]._id, m._id);
  assert.equal((await api().get('/api/medicines?search=ABC-001').set(auth)).body.data[0]._id, m._id);
  assert.equal(await StockMovement.countDocuments({ medicineId: m._id, reason: 'opening' }), 1);
  assert.equal((await api().post('/api/medicines').set(auth).send(medicineInput({ barcode: 'ABC-001' }))).status, 409);
  await medicine({ barcode: '' }); await medicine({ barcode: '' });
  assert.equal((await api().patch(`/api/medicines/${m._id}`).set(auth).send({ barcode: '' })).status, 200);
  await medicine({ barcode: 'ABC-001' });
});

test('sale, low stock threshold, restock and audit history', async () => {
  const m = await medicine({ quantity: 17 });
  const response = await api().post('/api/sales').set(auth).send(sale(m._id, 7));
  assert.equal(response.status, 201);
  assert.equal(response.body.data.totalPaisa, 1400);
  assert.deepEqual(response.body.meta.stockUpdates, [{ medicineId: m._id, quantity: 10 }]);
  assert.equal((await Medicine.findById(m._id))?.quantity, 10);
  assert((await api().get('/api/stock/low').set(auth)).body.data.some((x: any) => x._id === m._id));
  const restocked = await api().post(`/api/medicines/${m._id}/restock`).set(auth).send({ quantity: 25, totalPurchasePaisa: 2500 });
  assert.equal(restocked.body.data.quantity, 35);
  assert.equal(restocked.body.data.purchasePricePaisa, 100);
  assert(!(await api().get('/api/stock/low').set(auth)).body.data.some((x: any) => x._id === m._id));
  assert.equal(await StockMovement.countDocuments({ medicineId: m._id }), 3);
  assert.equal((await api().get(`/api/sales/${response.body.data._id}`).set(auth)).body.data.items[0].nameSnapshot, m.name);
});

test('duplicate lines merge and retry is idempotent; changed payload conflicts', async () => {
  const m = await medicine();
  const payload = { ...sale(m._id, 2), items: [{ medicineId: m._id, quantity: 2 }, { medicineId: m._id, quantity: 3 }] };
  const first = await api().post('/api/sales').set(auth).send(payload);
  const again = await api().post('/api/sales').set(auth).send(payload);
  assert.equal(again.status, 200); assert.equal(again.body.meta.replayed, true);
  assert.equal(first.body.data._id, again.body.data._id);
  assert.equal(first.body.data.items.length, 1);
  assert.equal((await Medicine.findById(m._id))?.quantity, 95);
  assert.equal((await api().post('/api/sales').set(auth).send({ ...payload, items: [{ medicineId: m._id, quantity: 1 }] })).status, 409);
});

test('100 available versus 120 requested returns a clear stock error without changing inventory', async () => {
  const m = await medicine({ quantity: 100 });
  const payload = sale(m._id, 120);
  const response = await api().post('/api/sales').set(auth).send(payload);
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'STOCK_CONFLICT');
  assert(response.body.error.message.includes(m.name));
  assert(response.body.error.message.includes('100'));
  assert(response.body.error.message.includes('120'));
  assert.equal((await Medicine.findById(m._id))?.quantity, 100);
  assert.equal(await Sale.countDocuments({ requestId: payload.requestId }), 0);
});

test('concurrent sales cannot oversell and concurrent duplicate request deducts once', async () => {
  const m = await medicine({ quantity: 5 });
  const responses = await Promise.all([api().post('/api/sales').set(auth).send(sale(m._id, 4)), api().post('/api/sales').set(auth).send(sale(m._id, 4))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal((await Medicine.findById(m._id))?.quantity, 1);
  const other = await medicine({ quantity: 10 }); const payload = sale(other._id, 3);
  const duplicates = await Promise.all([api().post('/api/sales').set(auth).send(payload), api().post('/api/sales').set(auth).send(payload)]);
  assert(duplicates.every(r => [200, 201].includes(r.status)));
  assert.equal(await Sale.countDocuments({ requestId: payload.requestId }), 1);
  assert.equal((await Medicine.findById(other._id))?.quantity, 7);
});

test('multi-line failure and injected database failure roll back stock and movements', async () => {
  const a = await medicine(), b = await medicine({ quantity: 0, totalPurchasePaisa: 0 });
  const payload = { ...sale(a._id, 3), items: [{ medicineId: a._id, quantity: 3 }, { medicineId: b._id, quantity: 1 }] };
  assert.equal((await api().post('/api/sales').set(auth).send(payload)).status, 409);
  assert.equal((await Medicine.findById(a._id))?.quantity, 100);
  assert.equal(await Sale.countDocuments({ requestId: payload.requestId }), 0);
  const original = inventoryRepository.record;
  inventoryRepository.record = async () => { throw new Error('injected failure'); };
  try { assert.equal((await api().post('/api/sales').set(auth).send(sale(a._id, 2))).status, 500); }
  finally { inventoryRepository.record = original; }
  assert.equal((await Medicine.findById(a._id))?.quantity, 100);
  assert.equal(await StockMovement.countDocuments({ medicineId: a._id }), 1);
});

test('zero stock alerts, explicit corrections, archival and integer money overflow', async () => {
  const m = await medicine({ quantity: 0, totalPurchasePaisa: 0 });
  assert((await api().get('/api/stock/low').set(auth)).body.data.some((x: any) => x._id === m._id));
  assert.equal((await api().post(`/api/medicines/${m._id}/adjustments`).set(auth).send({ delta: -1, note: 'count correction' })).status, 409);
  assert.equal((await api().post(`/api/medicines/${m._id}/adjustments`).set(auth).send({ delta: 5, note: 'physical count correction' })).body.data.quantity, 5);
  await api().patch(`/api/medicines/${m._id}`).set(auth).send({ archived: true });
  assert.equal((await api().post('/api/sales').set(auth).send(sale(m._id, 1))).status, 409);
  assert(!(await api().get('/api/stock/low').set(auth)).body.data.some((x: any) => x._id === m._id));
  const costly = await medicine({ retailPricePaisa: Number.MAX_SAFE_INTEGER });
  assert.equal((await api().post('/api/sales').set(auth).send(sale(costly._id, 2))).status, 400);
  assert.equal((await Medicine.findById(costly._id))?.quantity, 100);
});

test('deleting archives a medicine but retains its saved invoices and history', async () => {
  const m = await medicine({ name: 'Archive workflow medicine', quantity: 7 });
  const sold = await api().post('/api/sales').set(auth).send(sale(m._id, 1));
  assert.equal(sold.status, 201);
  const before = await api().get('/api/stock/summary').set(auth);
  const removed = await api().patch(`/api/medicines/${m._id}`).set(auth).send({ archived: true });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.archived, true);
  assert.equal((await api().get('/api/medicines').query({ search: m.name }).set(auth)).body.meta.total, 0);
  assert(!(await api().get('/api/stock/low?limit=100').set(auth)).body.data.some((x: any) => x._id === m._id));
  assert.equal((await api().get('/api/stock/summary').set(auth)).body.data.totalUnits, before.body.data.totalUnits - 6);
  assert.equal((await api().get(`/api/sales/${sold.body.data._id}`).set(auth)).body.data.items[0].nameSnapshot, m.name);
  assert.equal(await StockMovement.countDocuments({ medicineId: m._id }), 2);
});

test('low-stock PDF download is authenticated and returns a complete PDF document', async () => {
  assert.equal((await api().get('/api/stock/low/report.pdf')).status, 401);
  const response = await api().get('/api/stock/low/report.pdf').set(auth);
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /application\/pdf/);
  assert.match(response.headers['content-disposition'], /attachment/);
  assert(Buffer.isBuffer(response.body));
  assert.equal(response.body.subarray(0, 5).toString(), '%PDF-');
});

test('PDF pagination has no blank footer pages and supports an empty report', async () => {
  const empty = await createLowStockPdf([]);
  assert.equal((empty.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
  const rows = Array.from({ length: 18 }, (_, index) => ({ name: `Test medicine ${index}`, form: 'Tablet', strength: 500, strengthUnit: 'mg', quantity: 0, minimumStock: 10, retailPricePaisa: 1000 }));
  const report = await createLowStockPdf(rows);
  assert.equal((report.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 3);
});

test('saved state survives database connection restart', async () => {
  const m = await medicine({ name: 'Persistent medicine' });
  const response = await api().post('/api/sales').set(auth).send(sale(m._id, 1));
  const uri = db.getUri('pharmacy_test');
  await mongoose.disconnect();
  assert.equal((await api().get('/api/health').set(auth)).status, 503);
  await mongoose.connect(uri);
  assert.equal((await Medicine.findById(m._id))?.quantity, 99);
  assert.equal((await api().get(`/api/sales/${response.body.data._id}`).set(auth)).status, 200);
});
