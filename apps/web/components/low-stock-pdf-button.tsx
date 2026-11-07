'use client';
import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { Connection } from '../lib/api';

export function LowStockPdfButton({ connection, onError }: { connection: Connection; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${connection.url}/stock/low/report.pdf`, { headers: { Authorization: `Bearer ${connection.token}` }, cache: 'no-store', signal: AbortSignal.timeout(60000) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || 'PDF download failed. Check your local server connection.');
      }
      if (!response.headers.get('Content-Type')?.includes('application/pdf')) throw new Error('Server did not return a PDF report.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `MediStock-Kam-Stock-${new Date().toLocaleDateString('en-CA')}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <button className="button secondary" disabled={busy || !connection.token} onClick={() => void download()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Download size={16}/>} {busy ? 'Creating PDF…' : 'Download PDF'}</button>;
}
