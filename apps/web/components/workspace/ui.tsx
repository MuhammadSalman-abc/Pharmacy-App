'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, ClipboardList, X, type LucideIcon } from 'lucide-react';
import { money, Sale } from '../../lib/api';

export function Stat({ label, value, icon: Icon, sub, amber = false }: { label: string; value: number; icon: LucideIcon; sub: string; amber?: boolean }) {
  return <article className={`stat-card ${amber ? 'attention' : ''}`}><div><span>{label}</span><span className="stat-icon"><Icon size={19}/></span></div><strong>{value.toLocaleString()}</strong><p>{sub}</p></article>;
}

export function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="empty-state"><span><Icon size={26} strokeWidth={1.5}/></span><h3>{title}</h3><p>{text}</p></div>;
}

export function Pager({ page, pages, total, loading, setPage }: { page: number; pages: number; total: number; loading: boolean; setPage: (n: number) => void }) {
  return <div className="pagination"><span>{loading ? 'Updating…' : `${total.toLocaleString()} records`} · Page {page} of {pages}</span><div><button aria-label="Previous page" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17}/></button><button aria-label="Next page" disabled={loading || page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17}/></button></div></div>;
}

export function SalesTable({ sales, open, onDelete, loading }: { sales: Sale[]; open: (sale: Sale) => void; onDelete?: (sale: Sale) => void; loading: boolean }) {
  return <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Date & time</th><th>Pricing</th><th>Total</th><th>Status</th><th/></tr></thead><tbody>{sales.map(sale => <tr key={sale._id} className={sale.voidedAt ? 'voided-sale-row' : ''}><td><div className="medicine-cell"><span className="invoice-icon"><ClipboardList size={18}/></span><strong title={sale.invoiceNumber}>{sale.invoiceNumber.slice(0, 12).toUpperCase()}</strong></div></td><td>{new Date(sale.createdAt).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td className="capitalize">{sale.priceMode}</td><td><b>{money(sale.totalPaisa)}</b></td><td><span className={`badge ${sale.voidedAt ? 'red' : 'green'}`}><i/>{sale.voidedAt ? 'Deleted' : 'Completed'}</span></td><td><div className="sales-row-actions"><button className="text-button" onClick={() => open(sale)}>View invoice <ArrowUpRight size={14}/></button>{onDelete && !sale.voidedAt && <button className="delete-row-button" disabled={loading} onClick={() => onDelete(sale)}><span aria-hidden="true">×</span>Delete</button>}</div></td></tr>)}</tbody></table>{!sales.length && <Empty icon={ClipboardList} title={loading ? 'Loading invoices…' : 'A fresh start'} text="Your completed sales will appear here. Every sale is saved with its invoice."/>}</div>;
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="modal" onKeyDown={event => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}><div className="modal-heading no-print"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={21}/></button></div>{children}</div></div>;
}
