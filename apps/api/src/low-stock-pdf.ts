import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type LowStockRow = { name: string; barcode?: string | null; form: string; strength: number; strengthUnit: string; quantity: number; minimumStock: number; retailPricePaisa: number };

export function createLowStockPdf(rows: LowStockRow[], date = new Date()): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true, info: { Title: 'MediStock - Low Stock Report', Author: 'MediStock' } });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const fontFolder = path.join(process.env.WINDIR || 'C:/Windows', 'Fonts');
    const regular = path.join(fontFolder, 'segoeui.ttf'), bold = path.join(fontFolder, 'segoeuib.ttf');
    const normalFont = existsSync(regular) ? regular : 'Helvetica';
    const boldFont = existsSync(bold) ? bold : 'Helvetica-Bold';
    const left = 40, width = doc.page.width - 80;
    const columns = [28, 226, 120, 70, 70, 112, width - 626];
    const labels = ['#', 'Medicine / strength', 'Barcode', 'Available', 'Alert at', 'Retail / unit', 'Status'];
    let y = 0;
    const dateLabel = date.toLocaleString('en-PK', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, dateStyle: 'medium', timeStyle: 'short' });
    function heading() {
      doc.rect(0, 0, doc.page.width, 9).fill('#147d64');
      doc.font(boldFont).fontSize(23).fillColor('#194b3b').text('MediStock', left, 32);
      doc.font(normalFont).fontSize(10).fillColor('#708577').text('PHARMACY INVENTORY REPORT', left, 62);
      doc.font(boldFont).fontSize(17).fillColor('#243e32').text('Low stock / Kam Stock', left, 92);
      doc.font(normalFont).fontSize(9).fillColor('#718575').text(`Generated: ${dateLabel}    |    Medicines needing attention: ${rows.length}`, left, 120);
      doc.text('Includes active medicines with available quantity at or below their alert limit, including zero stock.', left, 137, { width });
      y = 164;
      doc.rect(left, y, width, 29).fill('#eaf3ed');
      let x = left;
      labels.forEach((label, i) => { doc.font(boldFont).fontSize(8).fillColor('#3f6650').text(label, x + 7, y + 9, { width: columns[i] - 14, lineBreak: false }); x += columns[i]; });
      y += 29;
    }
    heading();
    if (!rows.length) {
      doc.font(boldFont).fontSize(14).fillColor('#4d7158').text('No medicines are currently low on stock.', left + 20, y + 36, { width: width - 40 });
      doc.font(normalFont).fontSize(10).fillColor('#869580').text('All active medicines are above their configured minimum stock limits.', left + 20, y + 62, { width: width - 40 });
    }
    rows.forEach((row, index) => {
      const cells = [String(index + 1), `${row.name}\n${row.form} - ${row.strength} ${row.strengthUnit}`, row.barcode || '-', String(row.quantity), String(row.minimumStock), `Rs ${(row.retailPricePaisa / 100).toFixed(2)}`, row.quantity === 0 ? 'Out of stock' : 'Low stock'];
      doc.font(normalFont).fontSize(9);
      const rowHeight = Math.max(45, ...cells.map((cell, i) => { doc.font(i === 1 ? boldFont : normalFont); return doc.heightOfString(cell, { width: columns[i] - 14 }) + 20; }));
      if (y + rowHeight > doc.page.height - 54) { doc.addPage(); heading(); }
      doc.rect(left, y, width, rowHeight).fill(index % 2 ? '#f7faf7' : '#ffffff');
      let x = left;
      cells.forEach((cell, i) => {
        doc.font(i === 1 ? boldFont : normalFont).fontSize(9).fillColor(i === 6 ? (row.quantity === 0 ? '#ae5444' : '#b18437') : '#3e5746');
        doc.text(cell, x + 7, y + 9, { width: columns[i] - 14, height: rowHeight - 16, ellipsis: true }); x += columns[i];
      });
      doc.moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).strokeColor('#e5ece3').lineWidth(0.5).stroke();
      y += rowHeight;
    });
    const pages = doc.bufferedPageRange();
    for (let page = pages.start; page < pages.start + pages.count; page++) {
      doc.switchToPage(page);
      const originalBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const bottom = doc.page.height - 32;
      doc.font(normalFont).fontSize(8).fillColor('#8b9a85').text('MediStock | Local stock report - quantities reflect report generation time.', left, bottom, { width: width - 85, lineBreak: false });
      doc.text(`Page ${page + 1} of ${pages.count}`, left + width - 85, bottom, { width: 85, align: 'right', lineBreak: false });
      doc.page.margins.bottom = originalBottomMargin;
    }
    doc.end();
  });
}
