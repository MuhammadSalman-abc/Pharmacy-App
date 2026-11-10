'use client';

import { useState } from 'react';
import { ArrowDownLeft, Check, CheckCircle2, Database, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react';
import { api, Connection, defaultApiUrl, OFFLINE_MODE } from '../../lib/api';

export function SettingsView({ connection, onConnect, onDisconnect, onExport, onImport }: {
  connection: Connection; onConnect: (connection: Connection) => void; onDisconnect: () => void;
  onExport: () => void; onImport: (file: File) => void;
}) {
  return OFFLINE_MODE ? <OfflineSettings onExport={onExport} onImport={onImport}/> : <ConnectionSettings connection={connection} onConnect={onConnect} onDisconnect={onDisconnect}/>;
}

function ConnectionSettings({ connection, onConnect, onDisconnect }: { connection: Connection; onConnect: (connection: Connection) => void; onDisconnect: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="settings-layout"><section className="panel"><div className="panel-heading"><div><h2>Pharmacy server connection</h2><p>Connect to the pharmacy computer or hosted server.</p></div><Database size={23}/></div><form className="settings-form" onSubmit={async event => {
    event.preventDefault(); setError(''); setBusy(true); const form = new FormData(event.currentTarget);
    try {
      const url = new URL(String(form.get('url')));
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Enter the pharmacy server address, such as http://192.168.1.20:5000/api.');
      const config = { url: url.toString().replace(/\/$/, ''), token: String(form.get('token')).trim() };
      const result = await api<{ data: { ready: boolean } }>(config, '/health');
      if (!result.data.ready) throw new Error('Database is not ready.');
      onConnect(config);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }}>{error && <div role="alert" className="error-box">{error}</div>}<fieldset disabled={busy}><label>API address<input key={connection.url} name="url" type="url" required defaultValue={connection.url || defaultApiUrl}/><small>Same computer: http://127.0.0.1:5000/api · shared Wi-Fi: http://PHARMACY-PC-IP:5000/api</small></label><label>Local API token<input key={connection.token} name="token" type="password" autoComplete="off" required minLength={32} defaultValue={connection.token} placeholder="Paste your pharmacy API token"/><small>Remembered on this phone; keep the token private.</small></label><div className="settings-actions"><button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Check size={17}/>} {busy ? 'Checking connection…' : 'Connect & verify'}</button>{connection.token && <button type="button" className="button secondary" onClick={onDisconnect}><LogOut size={16}/>Disconnect</button>}</div></fieldset></form></section><aside className="form-guide"><span className="section-icon"><ShieldCheck size={21}/></span><h3>Use from your phone</h3><p>Run the pharmacy server on a computer, then connect your phone to the same Wi-Fi.</p><p>Enter that computer’s local IP address with port 5000. This is an installable web app, not a standalone APK; the pharmacy computer must stay on while the phone uses its data.</p></aside></div>;
}

function OfflineSettings({ onExport, onImport }: { onExport: () => void; onImport: (file: File) => void }) {
  return <div className="settings-layout"><section className="panel"><div className="panel-heading"><div><h2>This phone’s offline database</h2><p>No laptop, internet, account or server is needed for daily use.</p></div><Database size={23}/></div><div className="settings-form"><div className="toast"><CheckCircle2 size={18}/>MediStock is saving medicines, sales and stock directly on this phone.</div><button className="button primary" onClick={onExport}><ArrowDownLeft size={17}/>Download data backup</button><label style={{ marginTop: 20 }}>Restore a MediStock backup<input type="file" accept="application/json,.json" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) onImport(file); event.currentTarget.value = ''; }}/></label><small>Keep a backup copy somewhere safe. Clearing browser/app storage can erase locally saved data.</small></div></section><aside className="form-guide"><span className="section-icon"><ShieldCheck size={21}/></span><h3>Private to this phone</h3><p>Everything stays in this phone’s app storage and continues working without internet.</p><p>Use Download data backup regularly. The backup file is needed to move your records to another phone.</p></aside></div>;
}
