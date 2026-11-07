import mongoose, { ClientSession } from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { adjustment, Checkout, createMedicine, editMedicine, MAX_QUANTITY, restock } from '../../../packages/contracts';
import { AppError, safeMoney } from './errors';
import { catalogRepository as catalog, inventoryRepository as inventory, salesRepository as sales } from './repositories';

export async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try { return (await session.withTransaction(() => work(session), { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } })) as T; }
  finally { await session.endSession(); }
}
function unitCost(total: number, quantity: number) {
  if (!quantity && total) throw new AppError(400, 'INVALID_PURCHASE', 'Purchase total requires a positive quantity');
  return quantity ? Number((BigInt(total) + BigInt(Math.floor(quantity / 2))) / BigInt(quantity)) : 0;
}
export const CatalogService = {
  create(input: z.infer<typeof createMedicine>) {
    return transaction(async session => {
      const { totalPurchasePaisa, ...fields } = input;
      const record = await catalog.create({ ...fields, barcode: fields.barcode || undefined, normalizedName: fields.name.toLowerCase(), purchasePricePaisa: unitCost(totalPurchasePaisa, fields.quantity) }, session);
      await inventory.record({ medicineId: record._id, delta: input.quantity, reason: 'opening', totalPurchasePaisa }, session);
      return record;
    });
  },
  async edit(id: string, input: z.infer<typeof editMedicine>) {
    const { barcode, ...fields } = input;
    const updates: Record<string, unknown> = { $set: { ...fields, ...(fields.name ? { normalizedName: fields.name.toLowerCase() } : {}), ...(barcode ? { barcode } : {}) } };
    if (barcode === '') updates.$unset = { barcode: 1 };
    const record = await catalog.edit(id, updates);
    if (!record) throw new AppError(404, 'NOT_FOUND', 'Medicine not found');
    return record;
  }
};
export const InventoryService = {
  async change(id: string, delta: number, session: ClientSession, reason: string, extra: Record<string, unknown> = {}) {
    const record = await inventory.change(id, delta, session);
    if (!record) {
      const current = await catalog.get(id, session);
      if (!current) throw new AppError(404, 'NOT_FOUND', 'Medicine not found');
      if (current.archived) throw new AppError(409, 'STOCK_CONFLICT', `${current.name} is archived and cannot be sold.`);
      if (delta < 0) throw new AppError(409, 'STOCK_CONFLICT', `${current.name}: stock mein sirf ${current.quantity} units available hain. Aapne ${-delta} units enter kiye hain. Quantity kam karein.`);
      throw new AppError(409, 'STOCK_CONFLICT', `${current.name}: adding ${delta} units would exceed the supported stock limit.`);
    }
    await inventory.record({ medicineId: id, delta, reason, ...extra }, session);
    return record;
  },
  restock(id: string, input: z.infer<typeof restock>) {
    return transaction(async session => {
      const record = await this.change(id, input.quantity, session, 'restock', { note: input.note, totalPurchasePaisa: input.totalPurchasePaisa });
      record.purchasePricePaisa = unitCost(input.totalPurchasePaisa, input.quantity);
      await record.save({ session });
      return record;
    });
  },
  adjust(id: string, input: z.infer<typeof adjustment>) { return transaction(session => this.change(id, input.delta, session, 'adjustment', { note: input.note })); }
};
export const SalesService = {
  async checkout(input: Checkout) {
    const merged = new Map<string, number>();
    for (const line of input.items) {
      const id = line.medicineId.toLowerCase();
      const count = (merged.get(id) || 0) + line.quantity;
      if (count > MAX_QUANTITY) throw new AppError(400, 'INVALID_QUANTITY', 'Combined quantity exceeds supported limit');
      merged.set(id, count);
    }
    const items = [...merged].sort(([a], [b]) => a.localeCompare(b));
    const fingerprint = createHash('sha256').update(JSON.stringify({ mode: input.priceMode, items })).digest('hex');
    const sameRequest = (existing: any) => {
      if (existing.fingerprint !== fingerprint) throw new AppError(409, 'REQUEST_ID_REUSED', 'This request ID belongs to a different sale');
      return { sale: existing, replayed: true, stockUpdates: [] as { medicineId: string; quantity: number }[] };
    };
    try {
      return await transaction(async session => {
        const existing = await sales.byRequest(input.requestId, session);
        if (existing) return sameRequest(existing);
        const saleId = new mongoose.Types.ObjectId();
        const lines = [];
        const stockUpdates: { medicineId: string; quantity: number }[] = [];
        let totalPaisa = 0;
        for (const [id, quantity] of items) {
          const medicine = await InventoryService.change(id, -quantity, session, 'sale', { saleId });
          stockUpdates.push({ medicineId: id, quantity: medicine.quantity });
          const unitPricePaisa = input.priceMode === 'wholesale' ? medicine.wholesalePricePaisa : medicine.retailPricePaisa;
          const lineTotal = safeMoney(unitPricePaisa * quantity);
          totalPaisa = safeMoney(totalPaisa + lineTotal);
          lines.push({ medicineId: id, nameSnapshot: medicine.name, strengthSnapshot: `${medicine.strength} ${medicine.strengthUnit}`, quantity, unitPricePaisa, totalPaisa: lineTotal });
        }
        const sale = await sales.create({ _id: saleId, requestId: input.requestId, fingerprint, invoiceNumber: `INV-${randomUUID()}`, priceMode: input.priceMode, items: lines, totalPaisa }, session);
        return { sale, replayed: false, stockUpdates };
      });
    } catch (error: any) {
      if (error.code === 11000) { const existing = await sales.byRequest(input.requestId); if (existing) return sameRequest(existing); }
      throw error;
    }
  },
  async void(id: string) {
    return transaction(async session => {
      const sale = await sales.markVoided(id, session);
      if (!sale) {
        const existing = await sales.get(id);
        if (!existing) throw new AppError(404, 'NOT_FOUND', 'Invoice not found');
        throw new AppError(409, 'SALE_ALREADY_VOIDED', 'This sale was already deleted and its stock was restored.');
      }
      for (const line of sale.items) {
        const medicine = await inventory.restoreSaleUnits(String(line.medicineId), line.quantity, session);
        if (!medicine) throw new AppError(409, 'STOCK_CONFLICT', `Cannot restore ${line.nameSnapshot}: the stock limit would be exceeded.`);
        await inventory.record({ medicineId: medicine._id, saleId: sale._id, delta: line.quantity, reason: 'sale_void', note: `Deleted invoice ${sale.invoiceNumber}` }, session);
      }
      return sale;
    });
  }
};
