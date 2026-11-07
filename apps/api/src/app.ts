import express, { ErrorRequestHandler, RequestHandler } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import pino from 'pino';
import * as contracts from '../../../packages/contracts';
import { AppError } from './errors';
import { catalogRepository, inventoryRepository, salesRepository } from './repositories';
import { CatalogService, InventoryService, SalesService } from './services';
import { createLowStockPdf } from './low-stock-pdf';

export function createApp(options: { token: string; origin?: string; logger?: pino.Logger }) {
  const app = express();
  const logger = options.logger ?? pino({ redact: ['authorization', 'token', 'password'] });
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    const requestId = randomUUID(); res.locals.requestId = requestId; res.setHeader('X-Request-ID', requestId);
    const start = Date.now();
    res.on('finish', () => logger.info({ requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start }, 'request'));
    next();
  });
  app.use((req, res, next) => {
    if (req.headers.origin) {
      if (!options.origin || req.headers.origin !== options.origin) return next(new AppError(403, 'ORIGIN_DENIED', 'Origin not allowed'));
      res.setHeader('Access-Control-Allow-Origin', options.origin); res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') || '');
    const expected = Buffer.from(options.token);
    if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return next(new AppError(401, 'UNAUTHORIZED', 'Valid local API token required'));
    next();
  });
  app.use(express.json({ limit: '128kb' }));
  app.get('/api/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ data: { ready: mongoose.connection.readyState === 1 } }));
  app.use('/api', (_req, _res, next) => mongoose.connection.readyState === 1 ? next() : next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Local database is unavailable')));
  const id = (value: unknown) => contracts.objectId.parse(value);
  const wrap = (handler: RequestHandler) => handler;
  app.get('/api/stock/summary', async (_req, res) => res.json({ data: await inventoryRepository.summary() }));
  app.get('/api/stock/low/report.pdf', async (_req, res) => {
    const rows = await inventoryRepository.lowStockReport();
    const pdf = await createLowStockPdf(rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="MediStock-Kam-Stock.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdf);
  });
  app.get('/api/medicines', wrap(async (req, res) => {
    const p = contracts.pagination.parse(req.query);
    const escaped = p.search.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    res.json(await catalogRepository.list({ archived: false, ...(escaped ? { $or: [{ normalizedName: { $regex: `^${escaped}` } }, { barcode: p.search }] } : {}) }, p.page, p.limit));
  }));
  app.post('/api/medicines', async (req, res) => res.status(201).json({ data: await CatalogService.create(contracts.createMedicine.parse(req.body)) }));
  app.patch('/api/medicines/:id', async (req, res) => res.json({ data: await CatalogService.edit(id(req.params.id), contracts.editMedicine.parse(req.body)) }));
  app.post('/api/medicines/:id/restock', async (req, res) => res.json({ data: await InventoryService.restock(id(req.params.id), contracts.restock.parse(req.body)) }));
  app.post('/api/medicines/:id/adjustments', async (req, res) => res.json({ data: await InventoryService.adjust(id(req.params.id), contracts.adjustment.parse(req.body)) }));
  app.get('/api/stock/low', async (req, res) => { const p = contracts.pagination.parse(req.query); res.json(await catalogRepository.list({ archived: false, $expr: { $lte: ['$quantity', '$minimumStock'] } }, p.page, p.limit)); });
  app.post('/api/sales', async (req, res) => { const result = await SalesService.checkout(contracts.checkout.parse(req.body)); res.status(result.replayed ? 200 : 201).json({ data: result.sale, meta: { replayed: result.replayed, stockUpdates: result.stockUpdates } }); });
  app.get('/api/sales', async (req, res) => {
    const p = contracts.salesListQuery.parse(req.query);
    const from = p.from ? new Date(`${p.from}T00:00:00.000+05:00`) : undefined;
    const to = p.to ? new Date(`${p.to}T23:59:59.999+05:00`) : undefined;
    res.json(await salesRepository.list(p.page, p.limit, from, to));
  });
  app.get('/api/sales/:id', async (req, res) => { const sale = await salesRepository.get(id(req.params.id)); if (!sale) throw new AppError(404, 'NOT_FOUND', 'Invoice not found'); res.json({ data: sale }); });
  app.delete('/api/sales/:id', async (req, res) => { res.json({ data: await SalesService.void(id(req.params.id)) }); });
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found')));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    let status = 500, code = 'INTERNAL_ERROR', message = 'Unexpected server error';
    let fields;
    if (error instanceof ZodError) { status = 400; code = 'VALIDATION_ERROR'; message = 'Check the supplied fields'; fields = error.flatten(); }
    else if (error instanceof AppError) ({ status, code, message } = error);
    else if (error.code === 11000) { status = 409; code = 'DUPLICATE_RECORD'; message = 'Barcode or unique record already exists'; }
    else if (error.type === 'entity.parse.failed') { status = 400; code = 'INVALID_JSON'; message = 'Malformed JSON body'; }
    else if (error.type === 'entity.too.large') { status = 413; code = 'BODY_TOO_LARGE'; message = 'Request body too large'; }
    else if (error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError') { status = 503; code = 'DATABASE_UNAVAILABLE'; message = 'Local database is unavailable'; }
    if (status >= 500) logger.error({ requestId: res.locals.requestId, errorType: error.name, code }, 'request failed');
    res.status(status).json({ error: { code, message, fields, requestId: res.locals.requestId } });
  };
  app.use(errors); return app;
}
