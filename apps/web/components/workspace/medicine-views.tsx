'use client';

import { useState } from 'react';
import { CircleHelp, PackagePlus } from 'lucide-react';
import { api, Connection, Medicine, OFFLINE_MODE, toPaisa } from '../../lib/api';
import { offlineStore } from '../../lib/offline-store';
import { MedicineForm } from '../medicines/medicine-form';

export function AddMedicineView({ connection, prefill, onSaved, onCancel }: { connection: Connection; prefill?: { name: string; form?: string; strength?: string }; onSaved: () => void; onCancel: () => void }) {
  return <div className="form-layout"><section className="panel"><MedicineForm key={prefill?.name || 'new-medicine'} connection={connection} prefill={prefill} onSaved={onSaved} onCancel={onCancel}/></section><aside className="form-guide"><span className="section-icon"><CircleHelp size={21}/></span><h3>A quick guide</h3><p><b>Quantity = sellable units.</b><br/>Count individual tablets, injections, bottles or tubes.</p><p><b>Strength is separate.</b><br/>500 mg describes the medicine, not its available stock.</p><p><b>Set a helpful threshold.</b><br/>The medicine will appear in Kam Stock when its quantity reaches this number.</p></aside></div>;
}

export function RestockForm({ medicine, connection, onSaved }: { medicine: Medicine; connection: Connection; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <form className="restock-form" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const body = JSON.stringify({ quantity: Number(form.get('quantity')), totalPurchasePaisa: toPaisa(String(form.get('total'))), note: String(form.get('note')) });
      if (OFFLINE_MODE) await offlineStore.request(connection, `/medicines/${medicine._id}/restock`, { method: 'POST', body });
      else await api(connection, `/medicines/${medicine._id}/restock`, { method: 'POST', body });
      onSaved();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }}><p className="restock-current">Current quantity <b>{medicine.quantity} units</b></p>{error && <div role="alert" className="error-box">{error}</div>}<fieldset disabled={busy}><label>Units received<input autoFocus name="quantity" type="number" min="1" max="1000000000" step="1" required placeholder="25"/></label><label>Total purchase cost (Rs)<input name="total" type="number" min="0" step="0.01" required placeholder="0.00"/></label><label>Note <small>optional</small><input name="note" maxLength={500} placeholder="Delivery or supplier reference"/></label><button className="button primary" disabled={busy || (!OFFLINE_MODE && !connection.token)}>{busy ? 'Saving…' : 'Receive stock'}<PackagePlus size={17}/></button></fieldset></form>;
}
