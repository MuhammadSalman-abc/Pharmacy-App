'use client';

import { useState } from 'react';
import { LoaderCircle, Trash2, TriangleAlert } from 'lucide-react';
import { api, Connection, Medicine, OFFLINE_MODE } from '../../lib/api';
import { offlineStore } from '../../lib/offline-store';

export function DeleteMedicine({ medicine, connection, onDeleted, onCancel, onBusy }: { medicine: Medicine; connection: Connection; onDeleted: () => void; onCancel: () => void; onBusy: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy) return;
    setBusy(true); onBusy(true); setError('');
    try {
      // Archive instead of physically deleting invoices' referenced medicine records.
      if(OFFLINE_MODE)await offlineStore.request(connection, `/medicines/${medicine._id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
      else await api(connection, `/medicines/${medicine._id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) });
      onDeleted();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); onBusy(false); }
  }
  return <div className="delete-medicine">
    <span className="delete-symbol"><TriangleAlert size={25}/></span>
    <h3>Delete {medicine.name}?</h3>
    <p>Yeh medicine active inventory, customer search aur Kam Stock list se hat jayegi. Iske baad isay sell nahi kar sakenge.</p>
    <div className="delete-stock"><span>Current available stock</span><b>{medicine.quantity.toLocaleString()} units</b></div>
    <p className="delete-history">Purani sales, invoices aur stock history safe rahengi. Record archive hoga; permanently erase nahi hoga.</p>
    {error && <div role="alert" className="error-box">{error}</div>}
    <div className="delete-actions"><button className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button><button className="button danger" disabled={busy || (!connection.token&&!OFFLINE_MODE)} onClick={() => void remove()}>{busy ? <LoaderCircle size={16} className="spin"/> : <Trash2 size={16}/>} {busy ? 'Deleting…' : 'Yes, delete medicine'}</button></div>
  </div>;
}
