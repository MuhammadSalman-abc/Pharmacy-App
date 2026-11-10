import { Medicine } from '../../lib/api';
import { WorkspaceView } from './navigation';

export type { WorkspaceView };
export type CartLine = { medicine: Medicine; quantity: number };
export type DailySales = { _id: string; totalPaisa: number; invoices: number; units: number };
