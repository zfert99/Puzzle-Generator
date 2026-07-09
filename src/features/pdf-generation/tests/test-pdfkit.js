/* eslint-disable @typescript-eslint/no-require-imports */
const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, margin: 50 });
doc.pipe(fs.createWriteStream('output.pdf'));

doc.addPage();
doc.text("Page 1 content");
doc.addPage();
doc.text("Page 2 content");

const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.fontSize(10).text(`Page ${i + 1} of ${range.count}`,
    0,
    doc.page.height - 30,
    { align: 'center', width: doc.page.width, lineBreak: false }
  );
}

doc.end();
console.log("PDF generated. Run 'mutool show output.pdf' or similar to check pages.");
