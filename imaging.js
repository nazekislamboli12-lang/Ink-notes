// imaging.js — cut an illustration out of a photo and remove the whiteboard/paper background,
// so only the ink stays (with its real colors).

export function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not open that image.'));
    i.src = src;
  });
}

function dilate(data, w, h, r) {
  // per-channel maximum filter (keeps the bright background, removes dark ink)
  const tmp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let m = 0;
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const v = data[(y * w + xx) * 4 + c];
          if (v > m) m = v;
        }
        tmp[(y * w + x) * 4 + c] = m;
      }
      tmp[(y * w + x) * 4 + 3] = 255;
    }
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let m = 0;
        for (let dy = -r; dy <= r; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          const v = tmp[(yy * w + x) * 4 + c];
          if (v > m) m = v;
        }
        out[(y * w + x) * 4 + c] = m;
      }
      out[(y * w + x) * 4 + 3] = 255;
    }
  return out;
}

// returns a canvas with the ink on a transparent background
function cleanInk(src) {
  const w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h);
  const f = Math.max(3, Math.round(Math.max(w, h) / 90));
  const sw = Math.max(1, Math.ceil(w / f)), sh = Math.max(1, Math.ceil(h / f));
  const small = document.createElement('canvas');
  small.width = sw; small.height = sh;
  const sctx = small.getContext('2d');
  sctx.drawImage(src, 0, 0, sw, sh);
  const sd = sctx.getImageData(0, 0, sw, sh);
  const dil = dilate(sd.data, sw, sh, 3);
  sctx.putImageData(new ImageData(dil, sw, sh), 0, 0);
  const big = document.createElement('canvas');
  big.width = w; big.height = h;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, w, h);
  const bg = bctx.getImageData(0, 0, w, h).data;
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    const br = Math.max(bg[i], 1), bgc = Math.max(bg[i + 1], 1), bb = Math.max(bg[i + 2], 1);
    const cr = Math.min(1, px[i] / br), cg = Math.min(1, px[i + 1] / bgc), cb = Math.min(1, px[i + 2] / bb);
    const L = 0.299 * cr + 0.587 * cg + 0.114 * cb;
    let a = (1 - L) / 0.55;
    if (a < 0.16) a = 0;
    else a = Math.min(1, a);
    if (a === 0) { px[i + 3] = 0; continue; }
    px[i] = Math.max(0, Math.min(255, ((cr - (1 - a)) / a) * 255));
    px[i + 1] = Math.max(0, Math.min(255, ((cg - (1 - a)) / a) * 255));
    px[i + 2] = Math.max(0, Math.min(255, ((cb - (1 - a)) / a) * 255));
    px[i + 3] = Math.round(a * 255);
  }
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').putImageData(d, 0, 0);
  return out;
}

// box and whiteBoxes are in PHOTO pixels: {x,y,w,h}. whiteBoxes are painted over (typed labels).
export async function cropClean(photoSrc, box, whiteBoxes = [], maxSide = 1000) {
  const img = await loadImg(photoSrc);
  const x = Math.max(0, Math.round(box.x)), y = Math.max(0, Math.round(box.y));
  const w = Math.max(4, Math.min(img.naturalWidth - x, Math.round(box.w)));
  const h = Math.max(4, Math.min(img.naturalHeight - y, Math.round(box.h)));
  const sc = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(4, Math.round(w * sc)), ch = Math.max(4, Math.round(h * sc));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, x, y, w, h, 0, 0, cw, ch);
  ctx.fillStyle = '#fff';
  for (const b of whiteBoxes) {
    const bx = (b.x - x) * sc, by = (b.y - y) * sc;
    ctx.fillRect(bx, by, b.w * sc, b.h * sc);
  }
  const raw = c.toDataURL('image/jpeg', 0.9);
  const clean = cleanInk(c).toDataURL('image/png');
  return { raw, clean, w: cw, h: ch };
}

/* ---------- exact tracing: turn the ink in a part of the photo into vector shapes (no AI) ---------- */

function loops(mask, w, h) {
  // directed pixel-border edges with the ink on the right-hand side; joined into closed loops
  const next = new Map(); // "x,y" -> list of [x2,y2,inkpixelIndex]
  const add = (x1, y1, x2, y2, pi) => {
    const k = x1 + ',' + y1;
    if (!next.has(k)) next.set(k, []);
    next.get(k).push([x2, y2, pi]);
  };
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      const pi = y * w + x;
      if (!on(x, y - 1)) add(x, y, x + 1, y, pi);
      if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1, pi);
      if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1, pi);
      if (!on(x - 1, y)) add(x, y + 1, x, y, pi);
    }
  const out = [];
  for (const [k0, list0] of next) {
    while (list0.length) {
      const [sx, sy] = k0.split(',').map(Number);
      const pts = [[sx, sy]], px = [];
      let cx = sx, cy = sy, first = list0.pop();
      let e = first;
      for (;;) {
        px.push(e[2]);
        cx = e[0]; cy = e[1];
        if (cx === sx && cy === sy) break;
        pts.push([cx, cy]);
        const lst = next.get(cx + ',' + cy);
        if (!lst || !lst.length) break;
        e = lst.length > 1 ? lst.shift() : lst.pop();
        if (pts.length > 200000) break;
      }
      if (cx === sx && cy === sy && pts.length >= 4) out.push({ pts, px });
    }
  }
  return out;
}

function dp(pts, eps) { // Douglas-Peucker on a closed loop
  if (pts.length < 8) return pts;
  const open = pts.concat([pts[0]]);
  const keep = new Uint8Array(open.length);
  keep[0] = keep[open.length - 1] = 1;
  const st = [[0, open.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let md = 0, mi = -1;
    const [x1, y1] = open[a], [x2, y2] = open[b];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((open[i][0] - x1) * dy - (open[i][1] - y1) * dx) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  const r = [];
  for (let i = 0; i < open.length - 1; i++) if (keep[i]) r.push(open[i]);
  return r.length >= 3 ? r : pts;
}

const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');

// box + whiteBoxes in PHOTO pixels. Returns {w,h (px of the sample), shapes:[{pts:[[x,y]..px], color, hole}]} or null
export async function traceInk(photoSrc, box, whiteBoxes = [], maxSide = 900) {
  const img = await loadImg(photoSrc);
  const x = Math.max(0, Math.round(box.x)), y = Math.max(0, Math.round(box.y));
  const w = Math.max(4, Math.min(img.naturalWidth - x, Math.round(box.w)));
  const h = Math.max(4, Math.min(img.naturalHeight - y, Math.round(box.h)));
  const sc = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(4, Math.round(w * sc)), ch = Math.max(4, Math.round(h * sc));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, x, y, w, h, 0, 0, cw, ch);
  ctx.fillStyle = '#fff';
  for (const b of whiteBoxes) ctx.fillRect((b.x - x) * sc, (b.y - y) * sc, b.w * sc, b.h * sc);
  const ink = cleanInk(c).getContext('2d').getImageData(0, 0, cw, ch).data;
  // group the ink pixels by color (dark ink, red, blue, green, ...) and trace each color on its own,
  // so a colored circle touching a black line keeps its own color
  const cls = new Int8Array(cw * ch).fill(-1);
  const counts = new Map();
  for (let i = 0; i < cw * ch; i++) {
    if (ink[i * 4 + 3] <= 100) continue;
    const r = ink[i * 4], g = ink[i * 4 + 1], b = ink[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let c = 0;
    if (mx > 0 && (mx - mn) / mx > 0.38 && mx - mn > 40) {
      let hh;
      if (mx === r) hh = ((g - b) / (mx - mn) + 6) % 6; else if (mx === g) hh = (b - r) / (mx - mn) + 2; else hh = (r - g) / (mx - mn) + 4;
      c = 1 + (Math.floor((hh * 60 + 20) / 40) % 9);
    }
    cls[i] = c;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const total = [...counts.values()].reduce((p, q) => p + q, 0);
  if (total < 12) return null;
  const minArea = Math.max(5, cw * ch * 0.00003);
  const shapes = [];
  for (const [c, cnt] of counts) {
    if (cnt < 12) continue;
    const mask = new Uint8Array(cw * ch);
    for (let i = 0; i < cw * ch; i++) if (cls[i] === c) mask[i] = 1;
    for (const lp of loops(mask, cw, ch)) {
      let a = 0;
      for (let i = 0; i < lp.pts.length; i++) { const [x1, y1] = lp.pts[i], [x2, y2] = lp.pts[(i + 1) % lp.pts.length]; a += x1 * y2 - x2 * y1; }
      a /= 2;
      if (Math.abs(a) < minArea) continue;
      let r = 0, g = 0, b = 0;
      for (const p of lp.px) { r += ink[p * 4]; g += ink[p * 4 + 1]; b += ink[p * 4 + 2]; }
      const m = Math.max(1, lp.px.length);
      shapes.push({ pts: dp(lp.pts, 0.9), area: Math.abs(a), hole: a < 0, color: '#' + hex2(r / m) + hex2(g / m) + hex2(b / m) });
    }
  }
  if (!shapes.length) return null;
  shapes.sort((p, q) => q.area * (q.hole ? 1.000001 : 1) - p.area * (p.hole ? 1.000001 : 1));
  return { w: cw, h: ch, shapes: shapes.slice(0, 700) };
}
