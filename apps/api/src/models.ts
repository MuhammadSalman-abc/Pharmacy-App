import mongoose, { Schema } from 'mongoose';
import { MAX_QUANTITY } from '../../../packages/contracts';

const integer = (min = 0, max = Number.MAX_SAFE_INTEGER) => ({ type: Number, required: true, min, max, validate: Number.isSafeInteger });
const medicine = new Schema({
  name: { type: String, required: true }, normalizedName: { type: String, required: true, index: true }, barcode: String,
  form: { type: String, required: true }, strength: { type: Number, required: true }, strengthUnit: { type: String, required: true },
  quantity: integer(0, MAX_QUANTITY), minimumStock: integer(0, MAX_QUANTITY), purchasePricePaisa: integer(), retailPricePaisa: integer(), wholesalePricePaisa: integer(),
  archived: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });
medicine.index({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: 'string' } } });
const line = new Schema({ medicineId: { type: Schema.Types.ObjectId, required: true }, nameSnapshot: String, strengthSnapshot: String, quantity: integer(1), unitPricePaisa: integer(), totalPaisa: integer() }, { _id: false });
const sale = new Schema({ requestId: { type: String, required: true, unique: true }, fingerprint: { type: String, required: true }, invoiceNumber: { type: String, required: true, unique: true }, priceMode: String, items: [line], totalPaisa: integer(), voidedAt: Date }, { timestamps: true, versionKey: false });
sale.index({ createdAt: -1, _id: -1 });
const movement = new Schema({ medicineId: { type: Schema.Types.ObjectId, required: true }, saleId: Schema.Types.ObjectId, delta: integer(-MAX_QUANTITY, MAX_QUANTITY), reason: { type: String, enum: ['opening', 'restock', 'sale', 'sale_void', 'adjustment'], required: true }, note: String, totalPurchasePaisa: Number }, { timestamps: true, versionKey: false });
movement.index({ medicineId: 1, createdAt: -1 });
export const Medicine = mongoose.model('Medicine', medicine);
export const Sale = mongoose.model('Sale', sale);
export const StockMovement = mongoose.model('StockMovement', movement);
export async function initializeIndexes() { await Promise.all([Medicine.init(), Sale.init(), StockMovement.init()]); }
