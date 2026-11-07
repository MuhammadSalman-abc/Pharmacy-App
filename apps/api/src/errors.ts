export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function safeMoney(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new AppError(400, 'AMOUNT_OVERFLOW', 'Amount exceeds supported precision');
  return value;
}
