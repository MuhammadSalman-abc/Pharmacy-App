'use client';

import { CalendarDays, RefreshCw } from 'lucide-react';
import { Sale, SaleTotals, money } from '../../lib/api';
import { Empty, Pager, SalesTable } from './ui';

type DailySales = { _id: string; totalPaisa: number; invoices: number; units: number };
type Props = {
  sales: Sale[]; total: number; page: number; pages: number; loading: boolean;
  from: string; to: string; summary: SaleTotals; daily: DailySales[];
  onFromChange: (value: string) => void; onToChange: (value: string) => void;
  onClearDates: () => void; onRefresh: () => void;
  onOpenInvoice: (sale: Sale) => void; onDeleteSale: (sale: Sale) => void;
  setPage: (page: number) => void;
};

export function SalesHistoryView(props: Props) {
  return <>
    <section className="panel"><div className="panel-heading"><div><h2>Saved invoices</h2><p>{props.total} records · date-wise net sales summary neeche hai</p></div><button className="button secondary" disabled={props.loading} onClick={props.onRefresh}><RefreshCw size={15}/>Refresh</button></div>
      <div className="sales-filter-bar"><label><CalendarDays size={15}/>From<input aria-label="Sales from date" type="date" value={props.from} max={props.to || undefined} onChange={event => props.onFromChange(event.target.value)}/></label><label><CalendarDays size={15}/>To<input aria-label="Sales to date" type="date" value={props.to} min={props.from || undefined} onChange={event => props.onToChange(event.target.value)}/></label><button className="button secondary" onClick={props.onClearDates}>All dates</button><div className="sales-filter-total"><span>Net sale total</span><b>{money(props.summary.totalPaisa)}</b></div></div>
      <SalesTable sales={props.sales} open={props.onOpenInvoice} onDelete={props.onDeleteSale} loading={props.loading}/><Pager page={props.page} pages={props.pages} total={props.total} loading={props.loading} setPage={props.setPage}/>
    </section>
    <section className="panel daily-sales-panel"><div className="panel-heading"><div><h2>Date-wise calculation</h2><p>{props.summary.invoices} completed invoices · {props.summary.units} units sold in selected period</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Completed invoices</th><th>Units sold</th><th>Net sales</th></tr></thead><tbody>{props.daily.map(day => <tr key={day._id}><td>{new Date(`${day._id}T00:00:00+05:00`).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' })}</td><td>{day.invoices}</td><td>{day.units.toLocaleString()}</td><td><b>{money(day.totalPaisa)}</b></td></tr>)}</tbody></table>{!props.daily.length && <Empty icon={CalendarDays} title="No sales in this date range" text="Select another date range to see its daily totals."/>}</div></section>
  </>;
}
