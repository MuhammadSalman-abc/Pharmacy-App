import { z } from 'zod';

export const MAX_QUANTITY = 1_000_000_000;
export const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const quantity = z.number().int().nonnegative().max(MAX_QUANTITY);
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid medicine ID');
const fields = {
  name: z.string().trim().min(1).max(160),
  barcode: z.string().trim().max(100).optional(),
  form: z.enum(['Tablet', 'Capsule', 'Injection', 'Syrup', 'Drops', 'Cream', 'Other']),
  strength: z.number().finite().nonnegative().max(1_000_000),
  strengthUnit: z.enum(['mg', 'ml', 'g', 'mcg', 'IU', '%']),
  minimumStock: quantity,
  retailPricePaisa: amount,
  wholesalePricePaisa: amount,
};
export const createMedicine = z.object({ ...fields, quantity, totalPurchasePaisa: amount.default(0) }).strict();
export const editMedicine = z.object({ ...fields, archived: z.boolean() }).partial().strict().refine(x => Object.keys(x).length > 0, 'Provide at least one field');
export const restock = z.object({ quantity: quantity.positive(), totalPurchasePaisa: amount, note: z.string().trim().max(500).default('') }).strict();
export const adjustment = z.object({ delta: z.number().int().min(-MAX_QUANTITY).max(MAX_QUANTITY).refine(n => n !== 0), note: z.string().trim().min(1).max(500) }).strict();
export const checkout = z.object({ requestId: z.string().uuid(), priceMode: z.enum(['retail', 'wholesale']), items: z.array(z.object({ medicineId: objectId, quantity: quantity.positive() }).strict()).min(1).max(200) }).strict();
export const pagination = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), search: z.string().trim().max(160).default('') }).strict();
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date');
export const salesListQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), from: calendarDate.optional(), to: calendarDate.optional() }).strict().refine(value => !value.from || !value.to || value.from <= value.to, 'Start date must be on or before end date');
export type Checkout = z.infer<typeof checkout>;
