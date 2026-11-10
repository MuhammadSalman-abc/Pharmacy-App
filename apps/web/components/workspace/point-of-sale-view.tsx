'use client';

import { ArrowRight, CheckCircle2, LoaderCircle, Plus, Pill, Search, ShieldCheck, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import { Medicine, money } from '../../lib/api';
import { Empty, Pager } from './ui';

type CartLine = { medicine: Medicine; quantity: number };
type Props = {
  medicines: Medicine[];
  total: number;
  search: string;
  page: number;
  pages: number;
  loading: boolean;
  saving: boolean;
  pendingSale: boolean;
  connected: boolean;
  mode: 'retail' | 'wholesale';
  cart: CartLine[];
  cartTotal: number;
  invalidCart: boolean;
  unitPrice: (medicine: Medicine) => number;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  onScan: (value: string) => void;
  onAdd: (medicine: Medicine) => void;
  onModeChange: (mode: 'retail' | 'wholesale') => void;
  onQuantityChange: (medicineId: string, quantity: number) => void;
  onRemove: (medicineId: string) => void;
  onCheckout: () => void;
};

export function PointOfSaleView(props: Props) {
  return <div className="pos-layout">
    <section className="panel pos-products">
      <div className="table-toolbar"><div className="search-input"><Search size={18}/><input autoFocus aria-label="Search or scan medicine" value={props.search} onChange={event => { props.setSearch(event.target.value); props.setPage(1); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); props.onScan(event.currentTarget.value); } }} placeholder="Search medicine name or scan barcode…"/></div></div>
      <div className="catalog-heading"><span>{props.total} medicines available to browse</span><span>Price per unit</span></div>
      <div className="product-grid">{props.medicines.map(medicine => <button key={medicine._id} className="product-card" disabled={!medicine.quantity || props.saving || props.pendingSale || !props.connected} onClick={() => props.onAdd(medicine)}><div className="product-top"><span className="medicine-icon"><Pill size={21}/></span><span className={medicine.quantity <= medicine.minimumStock ? 'product-stock warn' : 'product-stock'}>{medicine.quantity} left</span></div><strong>{medicine.name}</strong><small>{medicine.form} · {medicine.strength} {medicine.strengthUnit}</small><div className="product-bottom"><b>{money(props.unitPrice(medicine))}</b><span><Plus size={15}/>Add</span></div></button>)}</div>
      {!props.medicines.length && <Empty icon={Search} title="Find the right medicine" text={props.search ? 'No matches. Try the beginning of the medicine name or its exact barcode.' : 'Your available medicine catalog will appear here.'}/>}
      <Pager page={props.page} pages={props.pages} total={props.total} loading={props.loading} setPage={props.setPage}/>
    </section>
    <section className="panel basket">
      <div className="panel-heading"><div><h2>Sale basket <span className="basket-count">{props.cart.length}</span></h2><p>Add all the customer’s medicines here; one bill will include them all.</p></div><ShoppingBag size={20}/></div>
      <div className="price-toggle"><button disabled={props.saving || props.pendingSale} className={props.mode === 'retail' ? 'selected' : ''} onClick={() => props.onModeChange('retail')}>Retail</button><button disabled={props.saving || props.pendingSale} className={props.mode === 'wholesale' ? 'selected' : ''} onClick={() => props.onModeChange('wholesale')}>Wholesale</button></div>
      <div className="cart-lines">{props.cart.length ? props.cart.map(line => <div className="cart-line" key={line.medicine._id}><div className="cart-line-title"><b>{line.medicine.name}</b><button disabled={props.saving || props.pendingSale} className="icon-button" aria-label={`Remove ${line.medicine.name}`} onClick={() => props.onRemove(line.medicine._id)}><Trash2 size={15}/></button></div><small>{line.medicine.strength} {line.medicine.strengthUnit} · {money(props.unitPrice(line.medicine))} / unit</small><div className="cart-line-bottom"><input aria-label={`Quantity for ${line.medicine.name}`} type="number" min="1" max={line.medicine.quantity} step="1" disabled={props.saving || props.pendingSale} aria-invalid={!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > line.medicine.quantity} value={line.quantity || ''} onChange={event => props.onQuantityChange(line.medicine._id, Number(event.target.value))}/><b>{money(props.unitPrice(line.medicine) * line.quantity)}</b></div><p className="cart-stock-info">Available: <b>{line.medicine.quantity} units</b>{line.quantity >= 1 && line.quantity <= line.medicine.quantity ? ` · Sale ke baad ${line.medicine.quantity - line.quantity} baqi` : ''}</p>{(!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > line.medicine.quantity) && <p role="alert" className="quantity-error">{line.quantity > line.medicine.quantity ? `${line.medicine.name}: sirf ${line.medicine.quantity} available hain. Aapne ${line.quantity} enter kiye hain. Stock available nahi hai.` : 'Quantity kam az kam 1 poora unit honi chahiye.'}</p>}</div>) : <Empty icon={ShoppingBag} title="Your basket is waiting" text="Choose a medicine on the left to start a new sale."/>}</div>
      <div className="basket-summary"><div><span>Total units</span><b>{props.cart.reduce((sum, line) => sum + line.quantity, 0)}</b></div><div className="grand-total"><span>Grand total</span><strong>{money(props.cartTotal)}</strong></div>{props.pendingSale && !props.saving && <p className="retry-note">The previous result could not be confirmed. Retry this same checkout to safely recover its invoice.</p>}<button className="button primary checkout" onClick={props.onCheckout} disabled={!props.cart.length || props.saving || !props.connected || (!props.pendingSale && props.invalidCart)}>{props.saving ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>} {props.saving ? 'Completing sale…' : props.pendingSale ? 'Retry same checkout' : 'Complete sale'}<ArrowRight size={17}/></button><small><ShieldCheck size={12}/> Stock updates only after a successful sale.</small></div>
    </section>
  </div>;
}
