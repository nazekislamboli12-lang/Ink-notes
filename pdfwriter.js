// pdfwriter.js — builds a PDF file from page images. No library needed.
// pages: [{ jpeg: Uint8Array, iw, ih (image pixels), pw, ph (page size in points) }]

export function buildPDF(pages) {
  const enc = new TextEncoder();
  const parts = [];
  let size = 0;
  const offsets = [];
  const add = (d) => {
    const b = typeof d === 'string' ? enc.encode(d) : d;
    parts.push(b);
    size += b.length;
  };
  const begin = (num) => { offsets[num] = size; add(`${num} 0 obj\n`); };
  const end = () => add('\nendobj\n');
  const total = 2 + 3 * pages.length;

  add('%PDF-1.4\n');
  begin(1); add('<< /Type /Catalog /Pages 2 0 R >>'); end();
  begin(2);
  add(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] >>`);
  end();
  pages.forEach((p, i) => {
    const pg = 3 + 3 * i, ct = 4 + 3 * i, im = 5 + 3 * i;
    const pw = p.pw.toFixed(2), ph = p.ph.toFixed(2);
    begin(pg);
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    end();
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    begin(ct);
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    end();
    begin(im);
    add(`<< /Type /XObject /Subtype /Image /Width ${p.iw} /Height ${p.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    add(p.jpeg);
    add('\nendstream');
    end();
  });
  const xref = size;
  let x = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= total; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  x += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  add(x);
  return new Blob(parts, { type: 'application/pdf' });
}
