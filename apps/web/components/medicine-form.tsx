'use client';
import { useState } from 'react';
import { ArrowRight, Check, PackagePlus } from 'lucide-react';
import { api, Connection, Medicine, money, toPaisa } from '../lib/api';

export function MedicineForm({ connection, medicine, onSaved, onCancel }: { connection: Connection; medicine?: Medicine; onSaved: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [units, setUnits] = useState(''), [cost, setCost] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const f = new FormData(event.currentTarget);
      const payload = { name: String(f.get('name')).trim(), barcode: String(f.get('barcode')).trim(), form: f.get('form'), strength: Number(f.get('strength')), strengthUnit: f.get('strengthUnit'), minimumStock: Number(f.get('minimumStock')), retailPricePaisa: toPaisa(String(f.get('retail'))), wholesalePricePaisa: toPaisa(String(f.get('wholesale'))), ...(!medicine ? { quantity: Number(f.get('quantity')), totalPurchasePaisa: toPaisa(String(f.get('purchase'))) } : {}) };
      await api(connection, medicine ? `/medicines/${medicine._id}` : '/medicines', { method: medicine ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const estimate = Number(units) > 0 && Number(cost) >= 0 ? money(Math.round(Number(cost) * 100 / Number(units))) : '—';
  return <form className="medicine-form" onSubmit={submit}>
    <div className="section-heading"><span className="section-icon"><PackagePlus size={20}/></span><div><h2>{medicine ? 'Edit medicine' : 'Medicine information'}</h2><p>Keep your catalog accurate, one medicine at a time.</p></div></div>
    {error && <div role="alert" className="error-box">{error}</div>}
    <fieldset disabled={busy}><div className="form-grid">
      <label className="span2">Medicine name <em>*</em><input autoFocus name="name" required maxLength={160} defaultValue={medicine?.name} placeholder="e.g. Panadol"/></label>
      <label>Barcode <small>optional</small><input name="barcode" maxLength={100} defaultValue={medicine?.barcode} placeholder="Scan or enter barcode"/></label>
      <label>Medicine type <em>*</em><select name="form" defaultValue={medicine?.form || 'Tablet'}>{['Tablet','Capsule','Injection','Syrup','Drops','Cream','Other'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Strength <em>*</em><input name="strength" type="number" min="0" max="1000000" step="any" required defaultValue={medicine?.strength ?? ''} placeholder="500"/></label>
      <label>Strength unit<select name="strengthUnit" defaultValue={medicine?.strengthUnit || 'mg'}>{['mg','ml','g','mcg','IU','%'].map(x => <option key={x}>{x}</option>)}</select></label>
    </div><div className="form-divider"><h3>Stock & pricing</h3><p>Enter prices in rupees, per individual sellable unit.</p></div><div className="form-grid">
      {!medicine && <><label>Opening quantity <em>*</em><input name="quantity" type="number" min="0" max="1000000000" step="1" required value={units} onChange={e => setUnits(e.target.value)} placeholder="0"/><small>Tablets, injections, bottles or tubes</small></label>
      <label>Total purchase cost (Rs) <em>*</em><input name="purchase" type="number" min="0" step="0.01" required value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00"/></label>
      <div className="calculated"><small>Calculated purchase / unit</small><strong>{estimate}</strong><span>Rounded to the nearest paisa</span></div></>}
      <label>Retail price / unit (Rs) <em>*</em><input name="retail" type="number" min="0" step="0.01" required defaultValue={medicine ? medicine.retailPricePaisa / 100 : ''} placeholder="0.00"/></label>
      <label>Wholesale price / unit (Rs) <em>*</em><input name="wholesale" type="number" min="0" step="0.01" required defaultValue={medicine ? medicine.wholesalePricePaisa / 100 : ''} placeholder="0.00"/></label>
      <label>Low stock threshold <em>*</em><input name="minimumStock" type="number" min="0" max="1000000000" step="1" required defaultValue={medicine?.minimumStock ?? 10}/><small>Alert when available units reach this limit</small></label>
    </div><div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary" disabled={!connection.token || busy}>{busy ? 'Saving…' : medicine ? 'Save changes' : 'Add medicine'}{medicine ? <Check size={16}/> : <ArrowRight size={16}/>}</button></div></fieldset>
  </form>;
}
