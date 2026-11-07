import { ClientSession, FilterQuery } from 'mongoose';
import { Medicine, Sale, StockMovement } from './models';
import { MAX_QUANTITY } from '../../../packages/contracts';

export const catalogRepository = {
  create: async (data: Record<string, unknown>, session: ClientSession) => (await Medicine.create([data], { session }))[0],
  get: (id: string, session?: ClientSession) => Medicine.findById(id).session(session ?? null),
  edit: (id: string, data: Record<string, unknown>) => Medicine.findByIdAndUpdate(id, data, { new: true, runValidators: true }),
  async list(filter: FilterQuery<any>, page: number, limit: number) {
    const [data, total] = await Promise.all([Medicine.find(filter).sort({ normalizedName: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(), Medicine.countDocuments(filter)]);
    return { data, meta: { page, limit, total } };
  }
};
export const inventoryRepository = {
  lowStockReport: () => Medicine.find({ archived: false, $expr: { $lte: ['$quantity', '$minimumStock'] } }).sort({ quantity: 1, normalizedName: 1, _id: 1 }).lean(),
  async summary() {
    const [result] = await Medicine.aggregate([
      { $match: { archived: false } },
      { $group: { _id: null, totalUnits: { $sum: '$quantity' } } }
    ]);
    return { totalUnits: result?.totalUnits || 0 };
  },
  change: (id: string, delta: number, session: ClientSession) => Medicine.findOneAndUpdate({ _id: id, archived: false, quantity: { $gte: Math.max(0, -delta), $lte: MAX_QUANTITY - Math.max(0, delta) } }, { $inc: { quantity: delta } }, { new: true, session }),
  restoreSaleUnits: (id: string, quantity: number, session: ClientSession) => Medicine.findOneAndUpdate({ _id: id, quantity: { $lte: MAX_QUANTITY - quantity } }, { $inc: { quantity } }, { new: true, session }),
  record: (data: Record<string, unknown>, session: ClientSession) => StockMovement.create([data], { session })
};
export const salesRepository = {
  byRequest: (requestId: string, session?: ClientSession) => Sale.findOne({ requestId }).session(session ?? null),
  create: async (data: Record<string, unknown>, session: ClientSession) => (await Sale.create([data], { session }))[0],
  get: (id: string) => Sale.findById(id).lean(),
  markVoided: (id: string, session: ClientSession) => Sale.findOneAndUpdate({ _id: id, voidedAt: null }, { $set: { voidedAt: new Date() } }, { new: true, session }),
  async list(page: number, limit: number, from?: Date, to?: Date) {
    const dateFilter = from || to ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {};
    const match = { ...dateFilter };
    const activeMatch = { ...match, voidedAt: null };
    const [data, total, [summary], daily] = await Promise.all([
      Sale.find(match).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Sale.countDocuments(match),
      Sale.aggregate([{ $match: activeMatch }, { $group: { _id: null, totalPaisa: { $sum: '$totalPaisa' }, invoices: { $sum: 1 }, units: { $sum: { $sum: '$items.quantity' } } } }]),
      Sale.aggregate([{ $match: activeMatch }, { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: 'Asia/Karachi' } }, totalPaisa: { $sum: '$totalPaisa' }, invoices: { $sum: 1 }, units: { $sum: { $sum: '$items.quantity' } } } }, { $sort: { _id: -1 } }])
    ]);
    return { data, meta: { page, limit, total, summary: summary ?? { totalPaisa: 0, invoices: 0, units: 0 }, daily } };
  }
};
