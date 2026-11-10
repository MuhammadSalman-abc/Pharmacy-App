'use client';

import { ArrowRight, ArrowUpRight, Package, PackagePlus, ShieldCheck, ShoppingBag, ShoppingCart, TriangleAlert } from 'lucide-react';
import { Connection, Medicine, Sale } from '../../lib/api';
import { CustomerSearch } from '../medicines/customer-search';
import { InventoryTable } from './inventory-table';
import { Empty, SalesTable, Stat } from './ui';

type Props = {
  connection: Connection;
  counts: { medicines: number; low: number; sales: number };
  stockUnits: number;
  medicines: Medicine[];
  invoices: Sale[];
  loading: boolean;
  onConnect: () => void;
  onSelect: (medicine: Medicine) => void;
  onNewSale: () => void;
  onShowLowStock: () => void;
  onAddMedicine: () => void;
  onRestock: (medicine: Medicine) => void;
  onInvoice: (sale: Sale) => void;
};

export function DashboardView(props: Props) {
  const { connection, counts, stockUnits, medicines, invoices, loading } = props;
  return <>
    <CustomerSearch connection={connection} onConnect={props.onConnect} onSelect={props.onSelect}/>
    <section className="stat-grid">
      <Stat label="Total medicines" value={counts.medicines} icon={Package} sub="Active medicines in your catalog"/>
      <Stat label="Needs attention" value={counts.low} icon={TriangleAlert} sub="Medicines running low on stock" amber/>
      <Stat label="Completed sales" value={counts.sales} icon={ShoppingBag} sub="All saved invoices"/>
      <Stat label="Available stock units" value={stockUnits} icon={PackagePlus} sub="Remaining units after sales and restocking"/>
    </section>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h2><span className="tiny-dot"/>Stock needs attention</h2><p>Stay a step ahead of an empty shelf.</p></div><button className="text-button" onClick={props.onShowLowStock}>View all <ArrowRight size={15}/></button></div>
        <InventoryTable medicines={medicines} compact loading={loading} emptyText="Medicines at or below their minimum will appear here." onRestock={props.onRestock}/>
      </section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>A good day starts here</h2><p>Your everyday actions, one click away.</p></div></div>
        <button onClick={props.onNewSale} className="quick-sale"><ShoppingCart size={24}/><strong>Make a new sale</strong><span>Search, add to cart, complete.</span><span className="quick-arrow"><ArrowUpRight size={20}/></span></button>
        <button className="quick-link" onClick={props.onAddMedicine}><span className="section-icon"><PackagePlus size={20}/></span><span><b>Add a medicine</b><small>Grow your medicine catalog</small></span><ArrowRight size={17}/></button>
        <div className="tip"><ShieldCheck size={18}/><p><b>Offline by design.</b> Your work is saved on this computer. Keep a regular database backup.</p></div>
      </section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent sales</h2><p>A record of your latest completed transactions.</p></div></div><SalesTable sales={invoices} open={props.onInvoice} loading={loading}/></section>
  </>;
}
