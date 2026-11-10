'use client';

import { ArrowRight, ClipboardPlus, ListChecks, Pill, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { MedicineDemand } from '../../lib/offline-store';
import { DemandPdfButton } from '../demands/demand-pdf-button';
import { Empty } from './ui';

type Props = {
  demands: MedicineDemand[];
  error: string;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  onAddToCatalog: (demand: MedicineDemand) => void;
  onDelete: (demand: MedicineDemand) => void;
  onError: (error: string) => void;
};

export function DemandListView({ demands, error, onSave, onRefresh, onAddToCatalog, onDelete, onError }: Props) {
  return <div className="demand-layout">
    <section className="panel">
      <div className="panel-heading"><div><h2><ClipboardPlus size={18}/> Record a medicine demand</h2><p>Customer ki nayi demand yahan save karein; is se inventory ya stock abhi change nahi hota.</p></div><span className="result-count">{demands.length} saved</span></div>
      <form className="medicine-form" onSubmit={onSave}><fieldset><div className="form-grid">
        <label className="span2">Medicine name <em>*</em><input name="demandName" required maxLength={160} placeholder="e.g. Panadol"/></label>
        <label>Medicine type<select name="demandForm" defaultValue="Tablet">{['Tablet','Capsule','Injection','Syrup','Drops','Cream','Other'].map(form => <option key={form}>{form}</option>)}</select></label>
        <label>Strength <small>optional</small><input name="demandStrength" maxLength={40} placeholder="500 mg / 5 ml"/></label>
        <label>Requested quantity <em>*</em><input name="demandQuantity" type="number" min="1" max="1000000000" step="1" required defaultValue="1"/></label>
        <label className="span2">Note <small>optional</small><input name="demandNote" maxLength={500} placeholder="Customer / supplier note"/></label>
      </div><div className="form-actions"><button className="button primary"><Plus size={17}/>Save demand</button></div></fieldset></form>
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2>Saved demand list</h2><p>New medicine ko inventory mein add karne ke liye “Add to medicines” use karein.</p></div><div className="demand-actions"><DemandPdfButton demands={demands} onError={onError}/><button className="button secondary" onClick={onRefresh}><RefreshCw size={15}/>Refresh</button></div></div>
      {error && <div role="alert" className="error-box">{error}</div>}
      <div className="table-scroll"><table><thead><tr><th>Medicine demand</th><th>Requested quantity</th><th>Note</th><th>Added</th><th>Actions</th></tr></thead><tbody>{demands.map(demand => <tr key={demand._id}><td><div className="medicine-cell"><span className="medicine-icon"><Pill size={18}/></span><div><strong>{demand.name}</strong><small>{[demand.form,demand.strength].filter(Boolean).join(' · ') || 'Details not specified'}</small></div></div></td><td><b>{demand.quantity}</b></td><td>{demand.note || '—'}</td><td>{new Date(demand.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td><div className="row-actions"><button className="text-button" onClick={() => onAddToCatalog(demand)}>Add to medicines <ArrowRight size={14}/></button><button className="delete-row-button" aria-label={`Remove ${demand.name} demand`} onClick={() => onDelete(demand)}><Trash2 size={14}/>Remove</button></div></td></tr>)}</tbody></table>{!demands.length && <Empty icon={ListChecks} title="No saved demands" text="Customer ki new medicine demand upar form se add karein."/>}</div>
    </section>
  </div>;
}
