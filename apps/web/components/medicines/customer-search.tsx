'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, Pill, Search, ShoppingCart, X } from 'lucide-react';
import { api, Connection, List, Medicine, money, OFFLINE_MODE } from '../../lib/api';
import { offlineStore } from '../../lib/offline-store';

export function CustomerSearch({ connection, onSelect, onConnect }: { connection: Connection; onSelect: (medicine: Medicine) => void; onConnect: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Medicine[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (!query.trim() || (!connection.token&&!OFFLINE_MODE)) { setResults([]); setTotal(0); setBusy(false); return; }
    setBusy(true); setError(''); setResults([]);
    const timer = setTimeout(async () => {
      try {
        const path=`/medicines?search=${encodeURIComponent(query.trim())}&limit=10`;
        const result = OFFLINE_MODE ? await offlineStore.request<List<Medicine>>(connection,path,{signal:controller.signal}) : await api<List<Medicine>>(connection,path,{ signal: controller.signal });
        if (!controller.signal.aborted) { setResults(result.data); setTotal(result.meta.total); }
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, connection, revision]);

  return <section className="customer-search panel" aria-labelledby="customer-search-title">
    <div className="customer-search-heading"><span className="customer-search-icon"><Search size={23}/></span><div><h2 id="customer-search-title">Customer ke liye medicine search karein</h2><p>Naam likhein → quantity aur price dekhein → sale mein add karein.</p></div><span className="search-live-label">LIVE STOCK SEARCH</span></div>
    <form className="customer-search-bar" onSubmit={e => { e.preventDefault(); if (connection.token||OFFLINE_MODE) setRevision(n => n + 1); else onConnect(); }}>
      <div className="search-input"><Search size={21}/><input aria-label="Customer medicine search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Medicine ka naam likhein ya barcode scan karein…"/>{query && <button type="button" aria-label="Clear customer search" onClick={() => { setQuery(''); setError(''); }}><X size={17}/></button>}</div>
      <button className="button primary" type="submit">{busy ? <LoaderCircle size={17} className="spin"/> : <Search size={17}/>}Search medicine</button>
    </form>
    {!query.trim() && <p className="customer-search-hint">Misal: Panadol, Amoxil ya medicine ka exact barcode. Stock dekhne ke liye sale complete karna zaroori nahi.</p>}
    {query.trim() && !connection.token && !OFFLINE_MODE && <div className="customer-search-message">Medicine search ke liye local backend connect karein. <button className="text-button" onClick={onConnect}>Connect server <ArrowRight size={14}/></button></div>}
    {error && <div role="alert" className="customer-search-message search-error">{error}</div>}
    {query.trim() && (connection.token||OFFLINE_MODE) && !error && <div aria-live="polite" aria-busy={busy}>
      {busy ? <div className="customer-search-message"><LoaderCircle size={16} className="spin"/>Searching medicines…</div> : !results.length ? <div className="customer-search-message">Is naam ki medicine nahi mili. Naam ki spelling ya barcode check karein.</div> : <>
        <div className="customer-result-count">{total} matching medicines{total > 10 ? ' · Showing the first 10. Type more letters to narrow your search.' : ''}</div>
        <div className="table-scroll"><table><thead><tr><th>Medicine / strength</th><th>Available quantity</th><th>Retail price / unit</th><th>Status</th><th>Sale</th></tr></thead><tbody>{results.map(m => <tr key={m._id}>
          <td><div className="medicine-cell"><span className="medicine-icon"><Pill size={19}/></span><div><strong>{m.name}</strong><small>{m.form} · {m.strength} {m.strengthUnit}</small></div></div></td>
          <td><b className="stock-number">{m.quantity.toLocaleString()}</b><span className="cell-unit"> units</span></td><td>{money(m.retailPricePaisa)}</td>
          <td><span className={`badge ${m.quantity === 0 ? 'red' : m.quantity <= m.minimumStock ? 'amber' : 'green'}`}><i/>{m.quantity === 0 ? 'Khatam / Out of stock' : m.quantity <= m.minimumStock ? 'Kam stock' : 'Available'}</span></td>
          <td><button className="button secondary" disabled={m.quantity === 0} onClick={() => onSelect(m)} aria-label={`Add ${m.name} to sale`}><ShoppingCart size={15}/>{m.quantity === 0 ? 'Unavailable' : 'Add to sale'}</button></td>
        </tr>)}</tbody></table></div>
      </>}
    </div>}
  </section>;
}
