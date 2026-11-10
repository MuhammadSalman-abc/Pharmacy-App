'use client';
import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { Connection, OFFLINE_MODE } from '../../lib/api';
import { offlineStore } from '../../lib/offline-store';

export function LowStockPdfButton({ connection, onError }: { connection: Connection; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      if(OFFLINE_MODE){const rows=(await offlineStore.request<{data:import('../../lib/api').Medicine[]}>(connection,'/stock/low?limit=100')).data;const escape=(value:string)=>value.replace(/[()\\]/g,'\\$&');const lines=['MediStock - Kam Stock',`Generated: ${new Date().toLocaleString('en-PK')}`,'','Medicine | Strength | Available | Alert at | Retail/unit',...rows.map(row=>`${row.name} | ${row.strength} ${row.strengthUnit} | ${row.quantity} | ${row.minimumStock} | Rs ${(row.retailPricePaisa/100).toFixed(2)}`)];const commands=lines.map((line,index)=>`BT /F1 ${index<1?16:10} Tf 48 ${790-index*22} Td (${escape(line)}) Tj ET`).join('\n');const stream=commands;const objects=[`1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj`,`2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj`,`3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 842 842] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj`,`4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj`,`5 0 obj <</Length ${stream.length}>> stream\n${stream}\nendstream endobj`];let pdf='%PDF-1.4\n',offsets=[0];for(const object of objects){offsets.push(pdf.length);pdf+=object+'\n';}const xref=pdf.length;pdf+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n `).join('\n')}\ntrailer <</Size ${offsets.length} /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;const blob=new Blob([pdf],{type:'application/pdf'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`MediStock-Kam-Stock-${new Date().toLocaleDateString('en-CA')}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),60000);return;}
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
  return <button className="button secondary" disabled={busy || (!OFFLINE_MODE&&!connection.token)} onClick={() => void download()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Download size={16}/>} {busy ? 'Creating PDF…' : 'Download PDF'}</button>;
}
