'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, Connection, defaultApiUrl, List, Medicine, OFFLINE_MODE, Sale, SaleTotals } from '../lib/api';
import { MedicineDemand, offlineStore } from '../lib/offline-store';
import { forgetConnection, rememberConnection, restoreConnection } from '../lib/connection-storage';
import { CartLine, WorkspaceView } from '../components/workspace/types';

export function usePharmacyWorkspace() {
  const [view, setView] = useState<WorkspaceView>('dashboard');
  const [connection, setConnection] = useState<Connection>({ url: 'http://127.0.0.1:5000/api', token: 'offline-local-storage-mode-enabled' });
  const [ready, setReady] = useState(false), [online, setOnline] = useState(OFFLINE_MODE);
  const [theme, setTheme] = useState<'light'|'dark'>('light');
  const [items, setItems] = useState<Medicine[]>([]), [invoices, setInvoices] = useState<Sale[]>([]);
  const [counts, setCounts] = useState({ medicines: 0, low: 0, sales: 0 });
  const [stockUnits, setStockUnits] = useState(0);
  const [total, setTotal] = useState(0), [page, setPage] = useState(1), [search, setSearch] = useState('');
  const [salesFrom, setSalesFrom] = useState(''), [salesTo, setSalesTo] = useState('');
  const [salesSummary, setSalesSummary] = useState<SaleTotals>({ totalPaisa: 0, invoices: 0, units: 0 });
  const [dailySales, setDailySales] = useState<{_id:string;totalPaisa:number;invoices:number;units:number}[]>([]);
  const [demands, setDemands] = useState<MedicineDemand[]>([]);
  const [demandError, setDemandError] = useState('');
  const [medicinePrefill, setMedicinePrefill] = useState<{name:string;form?:string;strength?:string}|null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const loadVersion = useRef(0);
  const [cart, setCart] = useState<CartLine[]>([]), [mode, setMode] = useState<'retail'|'wholesale'>('retail');
  const [saving, setSaving] = useState(false), [pendingSale, setPendingSale] = useState(false);
  const checkoutId = useRef<string | null>(null);
  const [edit, setEdit] = useState<Medicine | null>(null), [restock, setRestock] = useState<Medicine | null>(null), [receipt, setReceipt] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState<Medicine | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null), [saleDeleteBusy, setSaleDeleteBusy] = useState(false);
  const [clock, setClock] = useState('');
  const navigate = (next: WorkspaceView) => { setView(next); setPage(1); setSearch(''); setError(''); setEdit(null); };
  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (OFFLINE_MODE) { setReady(true); setOnline(true); setClock(new Date().toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })); return; }
    setConnection(current => ({ ...current, url: defaultApiUrl }));
    const saved = restoreConnection();
    if (saved) setConnection(saved);
    const savedTheme = localStorage.getItem('medistock-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
    setReady(true); setClock(new Date().toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  function toggleTheme() { const next = theme === 'light' ? 'dark' : 'light'; localStorage.setItem('medistock-theme', next); setTheme(next); }
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);
  const load = useCallback(async (signal?: AbortSignal, quiet = false) => {
    if ((!connection.token && !OFFLINE_MODE) || view === 'settings' || view === 'add') return;
    const version = ++loadVersion.current;
    const stale = () => signal?.aborted || version !== loadVersion.current;
    if (!quiet) setLoading(true);
    try {
      if (OFFLINE_MODE) {
        const [catalog, low, sales, stock] = await Promise.all([
          offlineStore.request<List<Medicine>>(connection, '/medicines?limit=1', { signal }),
          offlineStore.request<List<Medicine>>(connection, '/stock/low?limit=1', { signal }),
          offlineStore.request<List<Sale>>(connection, `/sales?${new URLSearchParams({page:String(view==='sales'?page:1),limit:String(view==='sales'?12:5),...(view==='sales'&&salesFrom?{from:salesFrom}:{}),...(view==='sales'&&salesTo?{to:salesTo}:{})})}`, {signal}),
          offlineStore.request<{data:{totalUnits:number}}>(connection, '/stock/summary', {signal})
        ]);
        const path=view==='low'||view==='dashboard'?'/stock/low':'/medicines';
        const params=new URLSearchParams({page:String(page),limit:view==='dashboard'?'5':view==='pos'?'24':'10'});if(search&&path==='/medicines')params.set('search',search);
        const result=view==='sales'?null:await offlineStore.request<List<Medicine>>(connection,`${path}?${params}`,{signal});
        if(stale())return;
        if(result){setItems(result.data);setTotal(result.meta.total);setCart(current=>current.map(line=>{const latest=result.data.find(m=>m._id===line.medicine._id);return latest?{...line,medicine:latest}:line;}));}
        else {setTotal(sales.meta.total);setSalesSummary(sales.meta.summary||{totalPaisa:0,invoices:0,units:0});setDailySales(sales.meta.daily||[]);}
        setCounts({medicines:catalog.meta.total,low:low.meta.total,sales:sales.meta.summary?.invoices??sales.meta.total});setInvoices(sales.data);setStockUnits(stock.data.totalUnits);setLoadError('');setOnline(true);return;
      }
      await api<{data:{ready:boolean}}>(connection, '/health', { signal });
      const [catalog, low, sales, stock] = await Promise.all([
        api<List<Medicine>>(connection, '/medicines?limit=1', { signal }),
        api<List<Medicine>>(connection, '/stock/low?limit=1', { signal }),
        api<List<Sale>>(connection, `/sales?${new URLSearchParams({ page: String(view === 'sales' ? page : 1), limit: String(view === 'sales' ? 12 : 5), ...(view === 'sales' && salesFrom ? { from: salesFrom } : {}), ...(view === 'sales' && salesTo ? { to: salesTo } : {}) })}`, { signal }),
        api<{data:{totalUnits:number}}>(connection, '/stock/summary', { signal })
      ]);
      if (view !== 'sales') {
        const path = view === 'low' || view === 'dashboard' ? '/stock/low' : '/medicines';
        const params = new URLSearchParams({ page: String(page), limit: view === 'dashboard' ? '5' : view === 'pos' ? '24' : '10' });
        if (search && path === '/medicines') params.set('search', search);
        const result = await api<List<Medicine>>(connection, `${path}?${params}`, { signal });
        if (stale()) return;
        setItems(result.data); setTotal(result.meta.total);
        setCart(current => current.map(line => { const latest = result.data.find(m => m._id === line.medicine._id); return latest ? { ...line, medicine: latest } : line; }));
      } else { setTotal(sales.meta.total); setSalesSummary(sales.meta.summary || { totalPaisa: 0, invoices: 0, units: 0 }); setDailySales(sales.meta.daily || []); }
      if (stale()) return;
      setCounts({ medicines: catalog.meta.total, low: low.meta.total, sales: sales.meta.summary?.invoices ?? sales.meta.total }); setInvoices(sales.data);
      setStockUnits(stock.data.totalUnits);
      setLoadError(''); setOnline(true);
    } catch (e) { if (stale()) return; setOnline(false); setLoadError((e as Error).message); }
    finally { if (!stale()) setLoading(false); }
  }, [connection, view, page, search, salesFrom, salesTo]);
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), search ? 250 : 0); return () => { clearTimeout(timer); controller.abort(); }; }, [load, search]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible' && !saving) void load(undefined, true); }, 5000); return () => clearInterval(timer); }, [load, saving]);
  const loadDemands = useCallback(async () => {
    try { const result = await offlineStore.request<{data:MedicineDemand[]}>(connection, '/demands'); setDemands(result.data); setDemandError(''); }
    catch (e) { setDemandError((e as Error).message); }
  }, [connection]);
  useEffect(() => { if (view === 'demands') void loadDemands(); }, [view, loadDemands]);
  async function saveDemand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    try { await offlineStore.request(connection, '/demands', {method:'POST',body:JSON.stringify({name:values.get('demandName'),form:values.get('demandForm'),strength:values.get('demandStrength'),quantity:Number(values.get('demandQuantity')),note:values.get('demandNote')})}); form.reset(); setNotice('Medicine demand list mein save ho gayi.'); await loadDemands(); }
    catch(e) { setDemandError((e as Error).message); }
  }
  async function deleteDemand(demand: MedicineDemand) {
    try { await offlineStore.request(connection, `/demands/${demand._id}`, {method:'DELETE'}); setNotice(`${demand.name} demand list se remove ho gayi.`); await loadDemands(); }
    catch(e) { setDemandError((e as Error).message); }
  }
  async function addLowStockDemand(medicine: Medicine) {
    const quantity = Math.max(1, medicine.minimumStock - medicine.quantity);
    try {
      await offlineStore.request(connection, '/demands', {method:'POST',body:JSON.stringify({name:medicine.name,form:medicine.form,strength:`${medicine.strength} ${medicine.strengthUnit}`,quantity,note:`Kam stock: ${medicine.quantity} units baqi (minimum ${medicine.minimumStock})`})});
      await loadDemands(); setNotice(`${medicine.name} ki stock demand list mein add ho gayi.`);
    } catch(e) { setDemandError((e as Error).message); setError((e as Error).message); }
  }
  function addDemandToCatalog(demand: MedicineDemand) { setMedicinePrefill({name:demand.name,form:demand.form||undefined,strength:demand.strength||undefined}); setView('add'); setPage(1); setSearch(''); setError(''); }
  function addToCart(medicine: Medicine) {
    if (pendingSale || saving) return;
    const old = cart.find(x => x.medicine._id === medicine._id);
    if ((old?.quantity || 0) >= medicine.quantity) return setError(`${medicine.name}: sirf ${medicine.quantity} units available hain. Isse zyada sell nahi kar sakte.`);
    setCart(current => old ? current.map(x => x.medicine._id === medicine._id ? { ...x, quantity: x.quantity + 1 } : x) : [...current, { medicine, quantity: 1 }]); checkoutId.current = null;
  }
  async function scanBarcode(value: string) {
    if (!value.trim() || pendingSale || saving) return;
    try {
      const result = OFFLINE_MODE ? await offlineStore.request<List<Medicine>>(connection, `/medicines?search=${encodeURIComponent(value.trim())}&limit=100`) : await api<List<Medicine>>(connection, `/medicines?search=${encodeURIComponent(value.trim())}&limit=100`);
      const exact = result.data.find(m => m.barcode === value.trim());
      if (exact) { addToCart(exact); setSearch(''); }
      else setNotice('No exact barcode match. Select a medicine from the search results.');
    } catch (e) { setError((e as Error).message); }
  }
  const unitPrice = (m: Medicine) => mode === 'retail' ? m.retailPricePaisa : m.wholesalePricePaisa;
  const cartTotal = cart.reduce((sum, x) => sum + unitPrice(x.medicine) * x.quantity, 0);
  const invalidCart = cart.some(x => !Number.isSafeInteger(x.quantity) || x.quantity < 1 || x.quantity > x.medicine.quantity);
  async function completeSale() {
    if (!cart.length || saving) return;
    if (!pendingSale && invalidCart) { setError('Sale complete nahi hui. Har medicine ki quantity available stock ke andar rakhein.'); return; }
    checkoutId.current ??= crypto.randomUUID(); setSaving(true); setPendingSale(true); setError('');
    try {
      const result = OFFLINE_MODE ? await offlineStore.request<{data:Sale;meta:{stockUpdates?:{medicineId:string;quantity:number}[]}}>(connection, '/sales', { method: 'POST', body: JSON.stringify({ requestId: checkoutId.current, priceMode: mode, items: cart.map(x => ({ medicineId: x.medicine._id, quantity: x.quantity })) }) }) : await api<{data:Sale;meta:{stockUpdates?:{medicineId:string;quantity:number}[]}}>(connection, '/sales', { method: 'POST', body: JSON.stringify({ requestId: checkoutId.current, priceMode: mode, items: cart.map(x => ({ medicineId: x.medicine._id, quantity: x.quantity })) }) });
      ++loadVersion.current;
      const updates = result.meta.stockUpdates || [];
      setItems(current => current.map(m => { const update = updates.find(x => x.medicineId === m._id); return update ? { ...m, quantity: update.quantity } : m; }));
      setReceipt(result.data); setCart([]); checkoutId.current = null; setPendingSale(false);
      setNotice(`Sale complete. ${OFFLINE_MODE?'Phone ke local database mein save ho gayi. ':''}${updates.map(x => `${result.data.items.find(i => i.medicineId === x.medicineId)?.nameSnapshot || 'Medicine'}: ab ${x.quantity} units baqi hain`).join(' · ') || 'Stock updated.'}`); await load();
    } catch (e) {
      setError((e as Error).message);
      // Keep the cart and request ID after an uncertain network result: retry the exact checkout.
      if (e instanceof ApiError && !['CONNECTION_FAILED', 'DATABASE_UNAVAILABLE', 'INTERNAL_ERROR'].includes(e.code)) { setPendingSale(false); checkoutId.current = null; }
    } finally { setSaving(false); }
  }
  async function deleteSale() {
    if (!deletingSale || saleDeleteBusy) return;
    setSaleDeleteBusy(true); setError('');
    try {
      if(OFFLINE_MODE) await offlineStore.request<{data:Sale}>(connection, `/sales/${deletingSale._id}`, { method: 'DELETE' });
      else await api<{data:Sale}>(connection, `/sales/${deletingSale._id}`, { method: 'DELETE' });
      const deleted = deletingSale;
      setDeletingSale(null);
      setNotice(`Invoice ${deleted.invoiceNumber.slice(0, 12)} delete ho gaya; uski quantity stock mein wapas add kar di.`);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaleDeleteBusy(false); }
  }
  const pages = Math.max(1, Math.ceil(total / (view === 'pos' ? 24 : view === 'sales' ? 12 : 10)));
  const connected = OFFLINE_MODE || Boolean(connection.token) && online;

  return {
    view, navigate, connection, setConnection, ready, online, setOnline, theme, toggleTheme, items, setItems, invoices, setInvoices, counts, setCounts, stockUnits,
    total, setTotal, page, setPage, search, setSearch, salesFrom, setSalesFrom, salesTo, setSalesTo, salesSummary, dailySales,
    demands, demandError, setDemandError, medicinePrefill, setMedicinePrefill,
    loading, error, setError, notice, setNotice, loadError,
    cart, setCart, mode, setMode, saving, pendingSale, setPendingSale, checkoutId, edit, setEdit,
    restock, setRestock, receipt, setReceipt, deleting, setDeleting, deleteBusy, setDeleteBusy,
    deletingSale, setDeletingSale, saleDeleteBusy, clock, pages, connected, loadVersion,
    load, loadDemands, saveDemand, deleteDemand, addLowStockDemand, addDemandToCatalog,
    addToCart, scanBarcode, unitPrice, cartTotal, invalidCart, completeSale, deleteSale
  };
}
