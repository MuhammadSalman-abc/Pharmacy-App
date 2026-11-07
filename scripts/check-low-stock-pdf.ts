import { mkdir, writeFile } from 'node:fs/promises';
import { createLowStockPdf, LowStockRow } from '../apps/api/src/low-stock-pdf';

async function main() {
  const rows: LowStockRow[] = Array.from({ length: 18 }, (_, index) => ({
    name: index === 7 ? 'Long medicine name for checking wrapped text and readable report rows across multiple pages' : ['Panadol', 'Amoxil', 'Brufen', 'Ceftriaxone', 'Calpol', 'Voren'][index % 6],
    barcode: `QA-TEST-${String(index + 1).padStart(4, '0')}`, form: index % 2 ? 'Injection' : 'Tablet', strength: 500, strengthUnit: 'mg', quantity: index % 8, minimumStock: 10, retailPricePaisa: 125050
  }));
  await mkdir('tmp/pdfs', { recursive: true });
  await writeFile('tmp/pdfs/low-stock-layout-check.pdf', await createLowStockPdf(rows, new Date('2026-11-02T10:00:00+05:00')));
  console.log('Created isolated fixture report: tmp/pdfs/low-stock-layout-check.pdf');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
