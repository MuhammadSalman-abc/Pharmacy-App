'use client';

import { CheckCircle2, Database, ShieldCheck } from 'lucide-react';
import { OFFLINE_MODE, defaultApiUrl } from '../lib/api';
import { offlineStore } from '../lib/offline-store';
import { forgetConnection, rememberConnection } from '../lib/connection-storage';
import { usePharmacyWorkspace } from '../hooks/use-pharmacy-workspace';
import { MedicineForm } from '../components/medicines/medicine-form';
import { DeleteMedicine } from '../components/medicines/delete-medicine';
import { LowStockPdfButton } from '../components/medicines/low-stock-pdf-button';
import { AddMedicineView, RestockForm } from '../components/workspace/medicine-views';
import { DashboardView } from '../components/workspace/dashboard-view';
import { DemandListView } from '../components/workspace/demand-list-view';
import { InventoryView } from '../components/workspace/inventory-view';
import { PointOfSaleView } from '../components/workspace/point-of-sale-view';
import { SalesHistoryView } from '../components/workspace/sales-history-view';
import { SettingsView } from '../components/workspace/settings-view';
import { DeleteSaleDialog, SaleReceipt } from '../components/workspace/sale-dialogs';
import { Modal } from '../components/workspace/ui';
import { PageHeading, Sidebar, Topbar, WorkspaceFooter } from '../components/workspace/navigation';
import './sales-history.css';
import './pos-multiple.css';

export default function Workspace() {
  const workspace = usePharmacyWorkspace();
  const {
    view, navigate, connection, ready, theme, toggleTheme, items, invoices, counts, stockUnits,
    total, page, setPage, search, setSearch, salesFrom, salesTo, salesSummary, dailySales,
    demands, demandError, setDemandError, medicinePrefill, setMedicinePrefill,
    loading, error, setError, notice, setNotice, loadError,
    cart, setCart, mode, saving, pendingSale, checkoutId, edit, setEdit,
    restock, setRestock, receipt, setReceipt, deleting, setDeleting, deleteBusy, setDeleteBusy,
    deletingSale, setDeletingSale, saleDeleteBusy, clock, pages, connected,
    load, loadDemands, saveDemand, deleteDemand, addLowStockDemand, addDemandToCatalog,
    addToCart, scanBarcode, unitPrice, cartTotal, invalidCart, completeSale, deleteSale
  } = workspace;

  return <div className="workspace">
    <Sidebar view={view} connected={connected} demandCount={demands.length} cartCount={cart.length} lowCount={counts.low} onNavigate={navigate} onAddMedicine={() => navigate('add')}/>
    <div className="main-shell">
      <Topbar view={view} theme={theme} onToggleTheme={toggleTheme}/>
      <main>
        <PageHeading view={view} clock={clock} onNavigate={navigate} onRefresh={() => void load()} onAddMedicine={() => navigate('add')} onPdf={() => <LowStockPdfButton connection={connection} onError={setError}/>} loading={loading}/>
        {notice && <div className="toast" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
        {(error || loadError) && <div className="error-box" role="alert"><Database size={17}/><span>{error || loadError}</span>{!OFFLINE_MODE && <button className="text-button" onClick={() => navigate('settings')}>Connection settings</button>}</div>}
        {ready && !connection.token && !OFFLINE_MODE && view !== 'settings' && <div className="connect-banner"><span className="section-icon"><Database size={20}/></span><div><strong>Let’s connect your pharmacy</strong><p>Start your local backend, then connect once to begin managing your medicines.</p></div><button className="button secondary" onClick={() => navigate('settings')}>Connect local server →</button></div>}

        {view === 'dashboard' && <DashboardView connection={connection} counts={counts} stockUnits={stockUnits} medicines={items} invoices={invoices} loading={loading} onConnect={() => navigate('settings')} onSelect={medicine => { if (saving || pendingSale) { setNotice('Finish or retry the current checkout before adding another medicine.'); navigate('pos'); return; } addToCart(medicine); navigate('pos'); }} onNewSale={() => navigate('pos')} onShowLowStock={() => navigate('low')} onAddMedicine={() => navigate('add')} onRestock={setRestock} onInvoice={setReceipt}/>}
        {(view === 'inventory' || view === 'low') && <InventoryView view={view} medicines={items} countLow={counts.low} search={search} total={total} page={page} pages={pages} loading={loading} saving={saving} pendingSale={pendingSale} setSearch={setSearch} setPage={setPage} onRestock={setRestock} onEdit={setEdit} onDelete={setDeleting} onDemand={medicine => void addLowStockDemand(medicine)}/>}
        {view === 'demands' && <DemandListView demands={demands} error={demandError} onSave={saveDemand} onRefresh={() => void loadDemands()} onAddToCatalog={addDemandToCatalog} onDelete={demand => void deleteDemand(demand)} onError={setDemandError}/>}
        {view === 'add' && <AddMedicineView connection={connection} prefill={medicinePrefill || undefined} onSaved={() => { setMedicinePrefill(null); setNotice('Medicine added successfully.'); navigate('inventory'); }} onCancel={() => { setMedicinePrefill(null); navigate('inventory'); }}/ >}
        {view === 'pos' && <PointOfSaleView medicines={items} total={total} search={search} page={page} pages={pages} loading={loading} saving={saving} pendingSale={pendingSale} connected={connected} mode={mode} cart={cart} cartTotal={cartTotal} invalidCart={invalidCart} unitPrice={unitPrice} setSearch={setSearch} setPage={setPage} onScan={value => void scanBarcode(value)} onAdd={addToCart} onModeChange={next => { workspace.setMode(next); checkoutId.current = null; }} onQuantityChange={(medicineId, quantity) => { setCart(current => current.map(line => line.medicine._id === medicineId ? { ...line, quantity } : line)); checkoutId.current = null; }} onRemove={medicineId => { setCart(current => current.filter(line => line.medicine._id !== medicineId)); checkoutId.current = null; }} onCheckout={() => void completeSale()}/>}
        {view === 'sales' && <SalesHistoryView sales={invoices} total={total} page={page} pages={pages} loading={loading} from={salesFrom} to={salesTo} summary={salesSummary} daily={dailySales} onFromChange={value => { workspace.setSalesFrom(value); setPage(1); }} onToChange={value => { workspace.setSalesTo(value); setPage(1); }} onClearDates={() => { workspace.setSalesFrom(''); workspace.setSalesTo(''); setPage(1); }} onRefresh={() => void load()} onOpenInvoice={setReceipt} onDeleteSale={setDeletingSale} setPage={setPage}/>}
        {view === 'settings' && <SettingsView connection={connection} onConnect={config => { rememberConnection(config); workspace.setConnection(config); workspace.setOnline(true); setNotice('Connected to your pharmacy server.'); navigate('dashboard'); }} onDisconnect={() => { forgetConnection(); workspace.setConnection({ url: defaultApiUrl, token: '' }); workspace.setOnline(false); workspace.setItems([]); workspace.setInvoices([]); workspace.setCounts({ medicines: 0, low: 0, sales: 0 }); workspace.setTotal(0); setCart([]); workspace.setPendingSale(false); checkoutId.current = null; }} onExport={async () => { try { const backup = await offlineStore.exportBackup(); const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `medistock-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href); setNotice('Phone data backup download ho gaya.'); } catch (cause) { setError((cause as Error).message); } }} onImport={async file => { try { await offlineStore.importBackup(file); setNotice('Backup phone mein restore ho gaya.'); await load(); } catch (cause) { setError((cause as Error).message); } }}/ >}
        <WorkspaceFooter offline={OFFLINE_MODE}/>
      </main>
    </div>

    {deleting && <Modal title="Delete medicine" close={() => { if (!deleteBusy) setDeleting(null); }}><DeleteMedicine medicine={deleting} connection={connection} onBusy={setDeleteBusy} onCancel={() => setDeleting(null)} onDeleted={() => {
      const removed = deleting; ++workspace.loadVersion.current;
      workspace.setItems(current => current.filter(medicine => medicine._id !== removed._id));
      setCart(current => current.filter(line => line.medicine._id !== removed._id));
      checkoutId.current = null; setDeleting(null); setNotice(`${removed.name} active inventory se delete ho gayi. Purani invoices safe hain.`);
      if (items.length === 1 && page > 1) setPage(page - 1); else void load();
    }}/></Modal>}
    {deletingSale && <Modal title="Delete sale record" close={() => { if (!saleDeleteBusy) setDeletingSale(null); }}><DeleteSaleDialog sale={deletingSale} busy={saleDeleteBusy} onCancel={() => setDeletingSale(null)} onConfirm={() => void deleteSale()}/></Modal>}
    {edit && <Modal title="Edit medicine" close={() => setEdit(null)}><MedicineForm connection={connection} medicine={edit} onSaved={() => { setEdit(null); setNotice('Medicine updated.'); void load(); }} onCancel={() => setEdit(null)}/></Modal>}
    {restock && <Modal title={`Restock ${restock.name}`} close={() => setRestock(null)}><RestockForm medicine={restock} connection={connection} onSaved={() => { setRestock(null); setNotice('Stock received and quantity updated.'); void load(); }}/></Modal>}
    {receipt && <Modal title={receipt.voidedAt ? 'Deleted sale invoice' : 'Sale invoice'} close={() => setReceipt(null)}><SaleReceipt sale={receipt}/></Modal>}
  </div>;
}
