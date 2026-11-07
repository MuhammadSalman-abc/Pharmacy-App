export type Medicine = { _id: string; name: string; barcode?: string; form: string; strength: number; strengthUnit: string; quantity: number; minimumStock: number; purchasePricePaisa: number; retailPricePaisa: number; wholesalePricePaisa: number };
export type Sale = { _id: string; invoiceNumber: string; createdAt: string; voidedAt?: string; priceMode: string; totalPaisa: number; items: { medicineId: string; nameSnapshot: string; strengthSnapshot: string; quantity: number; unitPricePaisa: number; totalPaisa: number }[] };
export type SaleTotals = { totalPaisa: number; invoices: number; units: number };
export type List<T> = { data: T[]; meta: { total: number; page: number; limit: number; summary?: SaleTotals; daily?: { _id: string; totalPaisa: number; invoices: number; units: number }[] } };
export type Connection = { url: string; token: string };
export class ApiError extends Error { constructor(message: string, public code: string) { super(message); } }
export async function api<T>(config: Connection, path: string, options: RequestInit = {}): Promise<T> {
  if (!config.token) throw new ApiError('Connect your local server in Settings to continue.', 'NOT_CONNECTED');
  let response: Response;
  try { response = await fetch(`${config.url}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}`, ...options.headers }, signal: options.signal ?? AbortSignal.timeout(12000), cache: 'no-store' }); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new ApiError('Cannot reach the local server. Check that the backend and MongoDB are running.', 'CONNECTION_FAILED'); }
  const body = await response.json();
  if (!response.ok) {
    const fields = Object.entries(body.error?.fields?.fieldErrors ?? {}).map(([name, messages]) => `${name}: ${(messages as string[]).join(', ')}`).join('; ');
    throw new ApiError(fields || body.error?.message || 'Request failed. Please try again.', body.error?.code || 'REQUEST_FAILED');
  }
  return body as T;
}
export const money = (paisa: number) => `Rs ${(paisa / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function toPaisa(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Enter a valid price with no more than two decimal places.');
  const [whole, decimal = ''] = value.split('.');
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Price is too large.');
  return result;
}
