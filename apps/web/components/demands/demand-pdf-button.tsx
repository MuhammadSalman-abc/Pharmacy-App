'use client';
import { Download } from 'lucide-react';
import { useState } from 'react';
import type { MedicineDemand } from '../../lib/offline-store';

function cell(value: string, width: number) {
  const ascii = value.replace(/[^\x20-\x7E]/g, '?').replace(/[()\\]/g, '\\$&');
  return ascii.length > width ? `${ascii.slice(0, width - 3)}...` : ascii;
}

function makePdf(rows: MedicineDemand[]) {
  const pages: string[][] = [];
  for (let start = 0; start < rows.length; start += 29) pages.push(rows.slice(start, start + 29).map((row, i) => {
    const y = 710 - i * 21;
    return [
      `BT /F1 9 Tf 38 ${y} Td (${cell(row.name, 26)}) Tj ET`,
      `BT /F1 9 Tf 205 ${y} Td (${cell(row.form, 13)}) Tj ET`,
      `BT /F1 9 Tf 300 ${y} Td (${cell(row.strength, 18)}) Tj ET`,
      `BT /F1 9 Tf 410 ${y} Td (${row.quantity}) Tj ET`,
      `BT /F1 9 Tf 452 ${y} Td (${cell(row.note || '-', 24)}) Tj ET`,
      `0.88 w 38 ${y - 8} m 557 ${y - 8} l S`
    ].join('\n');
  }));
  const streams = pages.map((page, i) => [
    'BT /F1 18 Tf 38 792 Td (MediStock - Medicine Demand List) Tj ET',
    `BT /F1 9 Tf 38 774 Td (Generated: ${cell(new Date().toLocaleString('en-PK'), 42)}) Tj ET`,
    `BT /F1 9 Tf 490 774 Td (Page ${i + 1} / ${pages.length}) Tj ET`,
    'BT /F1 9 Tf 38 739 Td (Medicine) Tj ET',
    'BT /F1 9 Tf 205 739 Td (Type) Tj ET',
    'BT /F1 9 Tf 300 739 Td (Strength) Tj ET',
    'BT /F1 9 Tf 410 739 Td (Qty) Tj ET',
    'BT /F1 9 Tf 452 739 Td (Note) Tj ET',
    '0.88 w 38 728 m 557 728 l S',
    page.join('\n'),
    `BT /F1 9 Tf 38 44 Td (Total demand lines: ${rows.length}) Tj ET`
  ].join('\n'));
  const fontId = 3, firstPageId = 4;
  const objects = [
    '<</Type /Catalog /Pages 2 0 R>>',
    `<</Type /Pages /Kids [${pages.map((_, i) => `${firstPageId + i * 2} 0 R`).join(' ')}] /Count ${pages.length}>>`,
    '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>'
  ];
  pages.forEach((_, i) => {
    const pageId = firstPageId + i * 2, contentId = pageId + 1;
    objects.push(`<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 ${fontId} 0 R>>>> /Contents ${contentId} 0 R>>`);
    const stream = streams[i];
    objects.push(`<</Length ${stream.length}>> stream\n${stream}\nendstream`);
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer <</Size ${offsets.length} /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function DemandPdfButton({ demands, onError }: { demands: MedicineDemand[]; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  function download() {
    if (!demands.length || busy) return;
    setBusy(true);
    try {
      const url = URL.createObjectURL(makePdf(demands));
      const link = document.createElement('a');
      link.href = url;
      link.download = `MediStock-Demand-List-${new Date().toLocaleDateString('en-CA')}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { onError((error as Error).message || 'PDF could not be created.'); }
    finally { setBusy(false); }
  }
  return <button className="button secondary" onClick={download} disabled={!demands.length || busy} title={!demands.length ? 'Demand list khali hai' : 'Demand list PDF download karein'}><Download size={15}/>{busy ? 'Preparing PDF…' : 'Download PDF'}</button>;
}
