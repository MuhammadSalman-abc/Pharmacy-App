'use client';

import { Search, TriangleAlert, X } from 'lucide-react';
import { Medicine } from '../../lib/api';
import { InventoryTable } from './inventory-table';
import { Pager } from './ui';

type Props = {
  view: 'inventory' | 'low';
  medicines: Medicine[];
  countLow: number;
  search: string;
  total: number;
  page: number;
  pages: number;
  loading: boolean;
  saving: boolean;
  pendingSale: boolean;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  onRestock: (medicine: Medicine) => void;
  onEdit: (medicine: Medicine) => void;
  onDelete: (medicine: Medicine) => void;
  onDemand: (medicine: Medicine) => void;
};

export function InventoryView(props: Props) {
  const isLow = props.view === 'low';
  return <section className="panel">
    {isLow && <div className="low-explainer"><TriangleAlert size={20}/><span><b>{props.countLow} medicines need attention</b><small>Yeh alert sirf tab aata hai jab remaining quantity medicine ki low-stock limit tak pohanchti hai. Example: limit 10 ho to 10 ya kam par alert.</small></span></div>}
    <div className="table-toolbar">{!isLow ? <div className="search-input"><Search size={18}/><input aria-label="Search medicines" value={props.search} onChange={event => { props.setSearch(event.target.value); props.setPage(1); }} placeholder="Search medicine name or scan exact barcode…"/>{props.search && <button aria-label="Clear search" onClick={() => props.setSearch('')}><X size={15}/></button>}</div> : <span className="muted">Prioritize these medicines on your next stock order.</span>}<span className="result-count">{props.total} medicines</span></div>
    <InventoryTable medicines={props.medicines} loading={props.loading} onRestock={props.onRestock} onEdit={props.onEdit} onDelete={props.onDelete} onDemand={props.onDemand} deleteDisabled={props.saving || props.pendingSale}/>
    <Pager page={props.page} pages={props.pages} total={props.total} loading={props.loading} setPage={props.setPage}/>
  </section>;
}
