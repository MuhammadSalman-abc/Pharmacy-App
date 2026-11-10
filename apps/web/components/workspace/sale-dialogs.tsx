'use client';

import { Plus, Printer, Trash2, TriangleAlert } from 'lucide-react';
import { money, Sale } from '../../lib/api';

export function SaleReceipt({ sale }: { sale: Sale }) {
  return <div className="receipt"><div className="receipt-brand"><Plus size={26}/><b>MediStock</b></div><h2>{sale.voidedAt ? 'Sale deleted' : 'Sale completed'}</h2><p>{sale.voidedAt ? 'This invoice is retained for history; its quantity was restored to stock.' : 'Sale saved — stock quantity automatically minus ho gayi hai.'}</p><p className="invoice-id">{sale.invoiceNumber}</p><p>{new Date(sale.createdAt).toLocaleString('en-PK')} · {sale.priceMode}</p><table><thead><tr><th>Medicine</th><th>Qty</th><th>Amount</th></tr></thead><tbody>{sale.items.map((item, index) => <tr key={`${item.medicineId}-${index}`}><td><strong>{item.nameSnapshot}</strong><small>{item.strengthSnapshot} · {money(item.unitPricePaisa)} each</small></td><td>{item.quantity}</td><td>{money(item.totalPaisa)}</td></tr>)}</tbody></table><div className="receipt-total">Total <b>{money(sale.totalPaisa)}</b></div><button className="button primary no-print" onClick={() => window.print()}><Printer size={17}/> Print invoice</button></div>;
}

export function DeleteSaleDialog({ sale, busy, onCancel, onConfirm }: { sale: Sale; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="delete-sale-dialog"><div className="delete-sale-warning"><TriangleAlert size={20}/><p>This invoice history will remain marked as deleted. Its sold quantity will be returned to stock, and its amount will be removed from date-wise net sales.</p></div><div className="delete-sale-details"><span>{sale.invoiceNumber}</span><b>{money(sale.totalPaisa)}</b><small>{sale.items.map(line => `${line.nameSnapshot} × ${line.quantity}`).join(' · ')}</small></div><div className="form-actions"><button className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="button danger" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : 'Delete sale'} <Trash2 size={15}/></button></div></div>;
}
