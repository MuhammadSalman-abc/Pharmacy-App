'use client';

import { ChevronRight, ClipboardList, Database, LayoutDashboard, ListChecks, Moon, Package, Plus, RefreshCw, Settings, ShieldCheck, ShoppingCart, Sun, TriangleAlert, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

export type WorkspaceView = 'dashboard' | 'inventory' | 'add' | 'pos' | 'low' | 'sales' | 'demands' | 'settings';
export const titles: Record<WorkspaceView, [string, string]> = {
  dashboard: ['Your pharmacy, at a glance', 'A clear view of your inventory and recent activity.'],
  inventory: ['Medicine inventory', 'Every medicine. Every unit. All in one place.'],
  add: ['Add a medicine', 'Build your catalog with accurate stock and pricing.'],
  pos: ['Point of sale', 'Find a medicine, create a sale, and keep stock up to date.'],
  low: ['Low stock / Kam Stock', 'A little attention now keeps your shelves ready.'],
  sales: ['Sales history', 'Every completed sale, with its original invoice.'],
  demands: ['Medicine demand list', 'Record customer requests, then add new medicines to your catalog.'],
  settings: ['Workspace settings', 'Connect securely to the server on this computer.']
};
const navigation = [
  { key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { key: 'inventory', label: 'Medicines', icon: Package },
  { key: 'demands', label: 'Demand list', icon: ListChecks },
  { key: 'pos', label: 'Point of sale', icon: ShoppingCart },
  { key: 'low', label: 'Kam Stock', icon: TriangleAlert },
  { key: 'sales', label: 'Sales history', icon: ClipboardList }
] as const;

export function Sidebar({ view, connected, demandCount, cartCount, lowCount, onNavigate, onAddMedicine }: {
  view: WorkspaceView; connected: boolean; demandCount: number; cartCount: number; lowCount: number;
  onNavigate: (view: WorkspaceView) => void; onAddMedicine: () => void;
}) {
  return <aside className="sidebar"><a className="brand" href="#" onClick={event => { event.preventDefault(); onNavigate('dashboard'); }}><span className="brand-mark"><Plus strokeWidth={3} size={28}/></span><div>MediStock<span>PHARMACY WORKSPACE</span></div></a><div className="workspace-tag"><span className="workspace-avatar">P</span><div>My Pharmacy<small>Local workspace</small></div><ShieldCheck size={17}/></div><div className="nav-label">WORKSPACE</div><nav>{navigation.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => onNavigate(key)} className={view === key ? 'active' : ''}><Icon size={19}/>{label}{key === 'low' && lowCount > 0 && <span className="nav-count">{lowCount}</span>}{key === 'demands' && demandCount > 0 && <span className="nav-count">{demandCount}</span>}{key === 'pos' && cartCount > 0 && <span className="nav-count">{cartCount}</span>}</button>)}</nav><button className="add-sidebar" onClick={onAddMedicine}><Plus size={18}/> Add medicine</button><div className="sidebar-bottom"><div className="offline-card"><WifiOff size={18}/><div>Built for offline work<small>Your data stays on this computer.</small></div></div><button className={view === 'settings' ? 'active' : ''} onClick={() => onNavigate('settings')}><Settings size={18}/> Settings & connection</button><div className="local-status"><span className={connected ? 'status-dot' : 'status-dot disconnected'}/>{connected ? 'Local server connected' : 'Server not connected'}<span>v0.1</span></div></div></aside>;
}

export function Topbar({ view, theme, onToggleTheme }: { view: WorkspaceView; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  return <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={13}/><b>{view === 'dashboard' ? 'Overview' : titles[view][0]}</b></div><div className="topbar-right"><span className="offline-label"><Database size={14}/> Local storage</span><button className="theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}<span>{theme === 'light' ? 'Dark' : 'Light'}</span></button><span className="avatar">PH</span></div></header>;
}

export function PageHeading({ view, clock, onNavigate, onRefresh, onAddMedicine, onPdf, loading }: {
  view: WorkspaceView; clock: string; onNavigate: (view: WorkspaceView) => void;
  onRefresh: () => void; onAddMedicine: () => void; onPdf: () => ReactNode; loading: boolean;
}) {
  return <div className="page-title"><div><div className="eyebrow">PHARMACY MANAGEMENT</div><h1>{titles[view][0]}</h1><p>{titles[view][1]}</p></div><div className="title-actions">{view === 'dashboard' ? <><span className="date-label">{clock}</span><button className="button primary" onClick={() => onNavigate('pos')}><Plus size={17}/> New sale</button></> : view === 'inventory' || view === 'low' ? <>{view === 'low' && onPdf()}<button className="button secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''}/>Refresh</button><button className="button primary" onClick={onAddMedicine}><Plus size={17}/>Add medicine</button></> : null}</div></div>;
}

export function WorkspaceFooter({ offline }: { offline: boolean }) {
  return <footer><span>MediStock <i/> Pharmacy workspace</span><span><ShieldCheck size={13}/> {offline ? 'Data saved on this phone' : 'Designed to work offline'}</span></footer>;
}
