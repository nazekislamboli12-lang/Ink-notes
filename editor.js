// editor.js — page renderer + editable canvas (SVG, no libraries)
// Supports: text (rotatable), pen / curved arrows, arrows, lines, circles, boxes, braces,
// images (illustrations), two-finger pinch zoom + pan, rotate handle, undo/redo.

export const VERSION = '4';
export const FONT = "Roboto,'Segoe UI',system-ui,-apple-system,'Noto Sans',Arial,sans-serif";
export const PALETTE = [
  ['Black', '#1a1a1a'],
  ['Light blue', '#3db8e8'],
  ['Blue', '#1f55d6'],
  ['Red', '#d93a3a'],
  ['Green', '#2faa6a'],
  ['Orange', '#f08a24'],
  ['Purple', '#8b5cf6'],
];

export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const n = (v) => Math.round(v * 100) / 100;
export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clone = (o) => JSON.parse(JSON.stringify(o));
const rad = (d) => (d * Math.PI) / 180;

let _mc;
export function measureText(text, size, bold) {
  _mc = _mc || document.createElement('canvas').getContext('2d');
  _mc.font = `${bold ? 700 : 400} ${size}px ${FONT}`;
  const lines = String(text).split('\n');
  let w = 0;
  for (const l of lines) w = Math.max(w, _mc.measureText(l).width);
  return { w: Math.max(w, size * 0.6), h: lines.length * size * 1.25 };
}

function rotPt(p, c, deg) {
  const a = rad(deg), cs = Math.cos(a), sn = Math.sin(a);
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cs - dy * sn, y: c.y + dx * sn + dy * cs };
}

/* ---------- geometry ---------- */

export function bboxOf(el) {
  switch (el.type) {
    case 'text': {
      let w = el.bw, h = el.bh;
      if (!(w > 0) || !(h > 0)) { const m = measureText(el.text || '', el.size || 32, el.bold); w = m.w; h = m.h; }
      return { x: el.x, y: el.y, w, h };
    }
    case 'line':
    case 'arrow':
      return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
    case 'ellipse':
    case 'rect':
    case 'brace':
    case 'image':
    case 'sketch':
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case 'pen': {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const [x, y] of el.pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
      const p = (el.sw || 4) / 2;
      return { x: x1 - p, y: y1 - p, w: x2 - x1 + 2 * p, h: y2 - y1 + 2 * p };
    }
    default:
      return null;
  }
}
const centerOf = (el) => { const b = bboxOf(el); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };
const canRotate = (el) => el.type !== 'line' && el.type !== 'arrow';

function bracePath(el) {
  const { x, y, w, h } = el;
  const o = el.orient || (h >= w ? 'left' : 'down');
  const vertical = o === 'left' || o === 'right';
  const L = vertical ? h : w;
  const D = vertical ? w : h;
  const r = Math.max(1, Math.min(L / 4, D * 1.1));
  const pts = [
    ['M', 0, D], ['Q', 0, D / 2, r, D / 2], ['L', L / 2 - r, D / 2], ['Q', L / 2, D / 2, L / 2, 0],
    ['Q', L / 2, D / 2, L / 2 + r, D / 2], ['L', L - r, D / 2], ['Q', L, D / 2, L, D],
  ];
  const map = (a, d) => {
    if (o === 'left') return [x + d, y + a];
    if (o === 'right') return [x + D - d, y + a];
    if (o === 'up') return [x + a, y + d];
    return [x + a, y + D - d];
  };
  return pts.map((p) => {
    const out = [];
    for (let i = 1; i < p.length; i += 2) { const [px, py] = map(p[i], p[i + 1]); out.push(n(px) + ' ' + n(py)); }
    return p[0] + ' ' + out.join(' ');
  }).join(' ');
}

function closedPath(pts) {
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const L = pts.length;
  const s0 = m(pts[L - 1], pts[0]);
  let d = `M ${n(s0[0])} ${n(s0[1])}`;
  for (let i = 0; i < L; i++) {
    const c = pts[i], e2 = m(pts[i], pts[(i + 1) % L]);
    d += ` Q ${n(c[0])} ${n(c[1])} ${n(e2[0])} ${n(e2[1])}`;
  }
  return d + ' Z';
}

function smoothPath(pts, closed) {
  if (closed && pts.length > 2) return closedPath(pts);
  if (pts.length === 2) return `M ${n(pts[0][0])} ${n(pts[0][1])} L ${n(pts[1][0])} ${n(pts[1][1])}`;
  let d = `M ${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${n(pts[i][0])} ${n(pts[i][1])} ${n(mx)} ${n(my)}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L ${n(l[0])} ${n(l[1])}`;
}

function headSVG(x2, y2, ang, sw, c) {
  const hl = Math.max(14, sw * 5), hw = hl * 0.5;
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const p1 = [x2 - cs * hl - sn * hw, y2 - sn * hl + cs * hw];
  const p2 = [x2 - cs * hl + sn * hw, y2 - sn * hl - cs * hw];
  return `<polygon points="${n(x2)},${n(y2)} ${n(p1[0])},${n(p1[1])} ${n(p2[0])},${n(p2[1])}" fill="${c}" stroke="${c}" stroke-width="1" stroke-linejoin="round"/>`;
}

/* ---------- drawing an element as SVG ---------- */

export function elementSVG(el, assets) {
  const c = el.color || '#1a1a1a';
  const sw = el.sw || 4;
  switch (el.type) {
    case 'text': {
      const size = el.size || 32;
      const lh = size * 1.25;
      const lines = String(el.text || '').split('\n');
      const ts = lines.map((ln, i) => `<tspan x="${n(el.x)}" y="${n(el.y + size * 0.9 + i * lh)}">${esc(ln) || '&#8203;'}</tspan>`).join('');
      return `<text font-family="${FONT}" font-size="${n(size)}" font-weight="${el.bold ? 700 : 400}" fill="${c}" xml:space="preserve">${ts}</text>`;
    }
    case 'line':
      return `<line x1="${n(el.x1)}" y1="${n(el.y1)}" x2="${n(el.x2)}" y2="${n(el.y2)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case 'arrow': {
      const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
      const hl = Math.max(14, sw * 5);
      const bx = el.x2 - Math.cos(ang) * hl * 0.8, by = el.y2 - Math.sin(ang) * hl * 0.8;
      return `<line x1="${n(el.x1)}" y1="${n(el.y1)}" x2="${n(bx)}" y2="${n(by)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` + headSVG(el.x2, el.y2, ang, sw, c);
    }
    case 'ellipse':
      return `<ellipse cx="${n(el.x + el.w / 2)}" cy="${n(el.y + el.h / 2)}" rx="${n(el.w / 2)}" ry="${n(el.h / 2)}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
    case 'rect':
      return `<rect x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" rx="6" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
    case 'brace':
      return `<path d="${bracePath(el)}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'pen': {
      if (el.pts.length === 1) return `<circle cx="${n(el.pts[0][0])}" cy="${n(el.pts[0][1])}" r="${sw / 2}" fill="${c}"/>`;
      let s = `<path d="${smoothPath(el.pts, el.closed)}" fill="${el.fill || 'none'}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (el.head && el.pts.length >= 2) {
        const l = el.pts[el.pts.length - 1];
        let k = el.pts.length - 2, p = el.pts[k];
        while (k > 0 && Math.hypot(l[0] - p[0], l[1] - p[1]) < 8) { k--; p = el.pts[k]; }
        s += headSVG(l[0], l[1], Math.atan2(l[1] - p[1], l[0] - p[0]), sw, c);
      }
      return s;
    }
    case 'sketch':
      return sketchPens(el).map((p) => elementSVG(p)).join('');
    case 'image': {
      const src = assets && assets.get(el.clean === false ? el.raw : el.asset);
      if (!src) return `<rect x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" fill="#eef1f6" stroke="#b9c2d0" stroke-dasharray="8 6"/>`;
      return `<image href="${src}" xlink:href="${src}" x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" preserveAspectRatio="none"/>`;
    }
    default:
      return '';
  }
}

// invisible, fatter shapes so thin strokes are easy to tap in the editor
function hitSVG(el) {
  const hs = Math.max(30, (el.sw || 4) + 24);
  const st = `fill="none" stroke="transparent" stroke-width="${hs}" pointer-events="stroke" stroke-linecap="round"`;
  switch (el.type) {
    case 'line':
    case 'arrow':
      return `<line x1="${n(el.x1)}" y1="${n(el.y1)}" x2="${n(el.x2)}" y2="${n(el.y2)}" ${st}/>`;
    case 'ellipse':
      return `<ellipse cx="${n(el.x + el.w / 2)}" cy="${n(el.y + el.h / 2)}" rx="${n(el.w / 2)}" ry="${n(el.h / 2)}" ${st}/>`;
    case 'rect':
      return `<rect x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" ${st}/>`;
    case 'brace':
      return `<path d="${bracePath(el)}" ${st}/>`;
    case 'sketch':
      return `<rect x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" fill="transparent" pointer-events="all"/>`;
    case 'pen':
      return el.pts.length > 1 ? `<path d="${smoothPath(el.pts, el.closed)}" ${st}/>` : `<circle cx="${n(el.pts[0][0])}" cy="${n(el.pts[0][1])}" r="${hs / 2}" fill="transparent" pointer-events="all"/>`;
    default:
      return '';
  }
}

function groupAttrs(el) {
  if (!el.rot || !canRotate(el)) return '';
  const c = centerOf(el);
  return ` transform="rotate(${n(el.rot)} ${n(c.x)} ${n(c.y)})"`;
}

export function elementGroup(el, assets, edit) {
  const body = elementSVG(el, assets);
  if (!body) return '';
  return `<g class="el" data-id="${el.id}"${groupAttrs(el)}>${body}${edit ? hitSVG(el) : ''}</g>`;
}

export function pageSVG(page, assets, scale = 1) {
  const bg = page.bg && assets.get(page.bg);
  let inner = `<rect width="${page.w}" height="${page.h}" fill="#ffffff"/>`;
  if (bg) inner += `<image href="${bg}" xlink:href="${bg}" x="0" y="0" width="${page.w}" height="${page.h}" preserveAspectRatio="xMidYMid meet"/>`;
  inner += page.elements.map((el) => elementGroup(el, assets, false)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${Math.round(page.w * scale)}" height="${Math.round(page.h * scale)}" viewBox="0 0 ${page.w} ${page.h}">${inner}</svg>`
  );
}

export async function rasterPage(page, assets, scale = 1) {
  const svg = pageSVG(page, assets, scale);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not draw the page'));
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = Math.round(page.w * scale);
    c.height = Math.round(page.h * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// a sketch = many strokes saved relative to its box (0..1); turn them into absolute pen strokes
export function sketchPens(el) {
  return (el.strokes || []).map((s) => {
    const p = { id: el.id + 's', type: 'pen', pts: s.pts.map(([u, v]) => [el.x + u * el.w, el.y + v * el.h]), color: s.color || '#1a1a1a', sw: s.sw || 3.5 };
    if (s.closed) p.closed = true;
    if (s.fill) p.fill = s.fill;
    return p;
  });
}

function moveEl(el, o, dx, dy) {
  if (el.type === 'line' || el.type === 'arrow') { el.x1 = o.x1 + dx; el.y1 = o.y1 + dy; el.x2 = o.x2 + dx; el.y2 = o.y2 + dy; }
  else if (el.type === 'pen') el.pts = o.pts.map(([x, y]) => [x + dx, y + dy]);
  else { el.x = o.x + dx; el.y = o.y + dy; }
}

const TOOLS_DRAW = ['pen', 'curve', 'arrow', 'line', 'ellipse', 'rect', 'brace'];

/* ---------- the editor ---------- */

export class Editor {
  constructor(host, hooks) {
    this.host = host;
    this.hooks = hooks || {};
    host.innerHTML = `<div class="ed-scroll"><svg class="ed-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg></div>`;
    this.scroll = host.querySelector('.ed-scroll');
    this.svg = host.querySelector('.ed-svg');
    this.tool = 'select';
    this.sel = null;
    this.zoom = 1;
    this.showRef = false;
    this.refOpacity = 0.4;
    this.showFlags = true;
    this.hist = [];
    this.hi = -1;
    this.style = { color: '#3db8e8', sw: 4, size: 36, textColor: '#1a1a1a' };
    this.assets = new Map();
    this.ptrs = new Map();
    this.gest = false;
    this.drag = null;
    this._raf = 0;
    const s = this.scroll;
    s.addEventListener('pointerdown', (e) => this.onDown(e));
    s.addEventListener('pointermove', (e) => this.onMove(e));
    s.addEventListener('pointerup', (e) => this.onUp(e));
    s.addEventListener('pointercancel', (e) => this.onUp(e, true));
    s.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      this.zoomAt(this.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY, true);
    }, { passive: false });
    this.svg.addEventListener('dblclick', (e) => {
      const g = e.target.closest && e.target.closest('.el');
      if (g && this.tool === 'select') { this.select(g.dataset.id); this.editSelectedText(); }
    });
    this.scroll.addEventListener('contextmenu', (e) => e.preventDefault());
    this._keys = (e) => this.onKey(e);
    document.addEventListener('keydown', this._keys);
  }

  destroy() { document.removeEventListener('keydown', this._keys); }

  load(page, assets, refSrc) {
    this.page = page;
    this.assets = assets;
    this.refSrc = refSrc || null;
    this.sel = null;
    this.hist = [JSON.stringify(page.elements)];
    this.hi = 0;
    this.applyZoom();
    this.render();
    this.setTool(this.tool);
  }

  /* --- view --- */
  applyZoom() {
    this.svg.style.width = Math.round(this.zoom * 1000) / 10 + '%';
    this.svg.style.aspectRatio = `${this.page.w} / ${this.page.h}`;
  }
  // zoom keeping the page point under (cx, cy) fixed on screen
  zoomAt(z, cx, cy, doRender) {
    z = Math.max(0.4, Math.min(6, z));
    const r = this.svg.getBoundingClientRect();
    const fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
    this.zoom = z;
    this.svg.style.width = Math.round(z * 1000) / 10 + '%';
    const r2 = this.svg.getBoundingClientRect();
    this.scroll.scrollLeft += r2.left + fx * r2.width - cx;
    this.scroll.scrollTop += r2.top + fy * r2.height - cy;
    if (doRender) this.render();
  }
  setZoom(z) {
    const r = this.scroll.getBoundingClientRect();
    this.zoomAt(z, r.left + r.width / 2, r.top + r.height / 2, true);
  }
  fit() { this.zoom = 1; this.applyZoom(); this.scroll.scrollTo(0, 0); this.render(); }

  canCropHere() { return !!(this.hooks.canCrop && this.hooks.canCrop()); }
  setTool(t) {
    if (t === 'crop' && !this.canCropHere()) t = 'select';
    this.tool = t;
    this.svg.dataset.tool = t;
    if (t !== 'select') this.sel = null;
    this.cropBox = null;
    this.render();
    this.hooks.onTool && this.hooks.onTool(t);
    this.hooks.onSelect && this.hooks.onSelect(this.getSel());
  }
  setShowRef(v) { this.showRef = v; this.render(); }
  setRefOpacity(v) { this.refOpacity = v; this.render(); }

  getSel() { return this.sel ? this.page.elements.find((e) => e.id === this.sel) || null : null; }
  select(id) {
    this.sel = id;
    this.render();
    this.hooks.onSelect && this.hooks.onSelect(this.getSel());
  }

  /* --- render --- */
  schedule() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); });
  }

  render() {
    if (!this.page) return;
    const p = this.page;
    let inner = `<rect width="${p.w}" height="${p.h}" fill="#fff"/>`;
    const bg = p.bg && this.assets.get(p.bg);
    if (bg) inner += `<image href="${bg}" x="0" y="0" width="${p.w}" height="${p.h}" preserveAspectRatio="xMidYMid meet" pointer-events="none"/>`;
    if (this.showRef && this.refSrc)
      inner += `<image href="${this.refSrc}" x="0" y="0" width="${p.w}" height="${p.h}" preserveAspectRatio="none" opacity="${this.refOpacity}" pointer-events="none"/>`;
    inner += p.elements.map((el) => elementGroup(el, this.assets, true)).join('');
    inner += '<g class="over"></g>';
    this.svg.setAttribute('viewBox', `0 0 ${p.w} ${p.h}`);
    this.svg.innerHTML = inner;
    this.decorate();
  }

  decorate() {
    const p = this.page;
    const over = this.svg.querySelector('.over');
    const rect = this.svg.getBoundingClientRect();
    this.k = rect.width ? p.w / rect.width : 1; // page units per screen pixel
    for (const el of p.elements) {
      if (el.type !== 'text') continue;
      const g = this.svg.querySelector(`.el[data-id="${el.id}"]`);
      if (!g) continue;
      let b;
      try { b = g.querySelector('text').getBBox(); } catch (e) { continue; }
      el.bw = b.width; el.bh = b.height;
      const pad = 4;
      let pre = '';
      if (el.flag && this.showFlags)
        pre += `<rect x="${n(b.x - pad)}" y="${n(b.y - pad)}" width="${n(b.width + 2 * pad)}" height="${n(b.height + 2 * pad)}" rx="6" fill="#ffd84d" opacity="0.55" pointer-events="none"/>`;
      pre += `<rect x="${n(b.x - pad)}" y="${n(b.y - pad)}" width="${n(b.width + 2 * pad)}" height="${n(b.height + 2 * pad)}" fill="transparent" pointer-events="all"/>`;
      g.insertAdjacentHTML('afterbegin', pre);
    }
    let h = '';
    const k = this.k;
    if (this.cropBox) {
      const c = this.cropBox;
      h += `<rect x="${n(c.x)}" y="${n(c.y)}" width="${n(c.w)}" height="${n(c.h)}" fill="rgba(43,125,233,.15)" stroke="#2b7de9" stroke-width="2" stroke-dasharray="8 5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    const el = this.getSel();
    if (el) {
      const bb = bboxOf(el);
      if (bb) {
        const c = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
        const rot = canRotate(el) ? el.rot || 0 : 0;
        const pad = 6 * k;
        const hr = 11 * k;
        const dot = (name, x, y, fill = '#fff') =>
          `<circle data-h="${name}" cx="${n(x)}" cy="${n(y)}" r="${n(hr)}" fill="${fill}" stroke="#2b7de9" stroke-width="2.5" vector-effect="non-scaling-stroke" style="cursor:pointer"/>`;
        h += `<g transform="rotate(${n(rot)} ${n(c.x)} ${n(c.y)})">`;
        h += `<rect x="${n(bb.x - pad)}" y="${n(bb.y - pad)}" width="${n(bb.w + 2 * pad)}" height="${n(bb.h + 2 * pad)}" fill="none" stroke="#2b7de9" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
        if (el.type === 'line' || el.type === 'arrow') {
          h += '</g>' + dot('p1', el.x1, el.y1) + dot('p2', el.x2, el.y2);
        } else {
          const top = bb.y - pad - 34 * k;
          h += `<line x1="${n(c.x)}" y1="${n(bb.y - pad)}" x2="${n(c.x)}" y2="${n(top)}" stroke="#2b7de9" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
          h += dot('rot', c.x, top, '#2b7de9');
          if (el.type === 'text') h += dot('ts', bb.x + bb.w + pad, bb.y + bb.h + pad);
          else if (el.type === 'ellipse' || el.type === 'rect' || el.type === 'brace' || el.type === 'image' || el.type === 'sketch')
            h += dot('nw', bb.x, bb.y) + dot('ne', bb.x + bb.w, bb.y) + dot('sw', bb.x, bb.y + bb.h) + dot('se', bb.x + bb.w, bb.y + bb.h);
          h += '</g>';
        }
      }
    }
    over.innerHTML = h;
  }

  /* --- history --- */
  snapshot() { return JSON.stringify(this.page.elements); }
  commit() {
    const s = this.snapshot();
    if (s === this.hist[this.hi]) return;
    this.hist = this.hist.slice(0, this.hi + 1);
    this.hist.push(s);
    if (this.hist.length > 80) this.hist.shift();
    this.hi = this.hist.length - 1;
    this.hooks.onChange && this.hooks.onChange();
    this.hooks.onHistory && this.hooks.onHistory();
  }
  undo() { if (this.hi > 0) { this.hi--; this.restore(); } }
  redo() { if (this.hi < this.hist.length - 1) { this.hi++; this.restore(); } }
  restore() {
    this.page.elements = JSON.parse(this.hist[this.hi]);
    if (!this.getSel()) this.sel = null;
    this.render();
    this.hooks.onSelect && this.hooks.onSelect(this.getSel());
    this.hooks.onChange && this.hooks.onChange();
    this.hooks.onHistory && this.hooks.onHistory();
  }
  canUndo() { return this.hi > 0; }
  canRedo() { return this.hi < this.hist.length - 1; }

  /* --- pointer handling (one finger = tool, two fingers = zoom + move the view) --- */
  pt(e) {
    const r = this.svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * this.page.w) / r.width, y: ((e.clientY - r.top) * this.page.h) / r.height };
  }

  cancelDrag() {
    const d = this.drag;
    if (!d) return;
    if (d.mode === 'draw') this.page.elements = this.page.elements.filter((x) => x !== d.el);
    else if ((d.mode === 'move' || d.mode === 'handle') && d.el && d.orig) {
      for (const k of Object.keys(d.el)) delete d.el[k];
      Object.assign(d.el, clone(d.orig));
    }
    this.drag = null;
    this.cropBox = null;
    this.render();
  }

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.scroll.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (this.ptrs.size >= 2) {
      this.cancelDrag();
      this.gest = true;
      const [a, b] = [...this.ptrs.values()];
      const r = this.svg.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.g = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: this.zoom, mid0: mid, fx: (mid.x - r.left) / r.width, fy: (mid.y - r.top) / r.height, l0: this.scroll.scrollLeft, t0: this.scroll.scrollTop };
      return;
    }
    if (this.gest) return;
    e.preventDefault();
    const onSvg = this.svg.contains(e.target);
    if (!onSvg || this.tool === 'hand') {
      this.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, l: this.scroll.scrollLeft, t: this.scroll.scrollTop };
      return;
    }
    const p = this.pt(e);
    const d = (this.drag = { start: p, mode: 'none', moved: false, t0: Date.now() });
    const t = this.tool;
    if (t === 'select') {
      const hd = e.target.closest && e.target.closest('[data-h]');
      const el = this.getSel();
      if (hd && el) {
        d.mode = 'handle'; d.h = hd.dataset.h; d.orig = clone(el); d.el = el;
        d.c0 = centerOf(el);
        if (d.h === 'ts') d.r0 = Math.max(1, Math.hypot(p.x - d.c0.x, p.y - d.c0.y));
        return;
      }
      const g = e.target.closest && e.target.closest('.el');
      if (g) {
        d.wasSelected = this.sel === g.dataset.id;
        this.sel = g.dataset.id;
        d.el = this.getSel();
        d.orig = clone(d.el);
        d.mode = 'move';
        this.render();
        this.hooks.onSelect && this.hooks.onSelect(d.el);
      } else if (this.sel) {
        this.select(null);
      }
    } else if (t === 'text') {
      d.mode = 'text';
    } else if (t === 'crop') {
      d.mode = 'crop';
    } else if (TOOLS_DRAW.includes(t)) {
      const s = this.style;
      let el;
      if (t === 'pen' || t === 'curve') el = { id: uid(), type: 'pen', pts: [[p.x, p.y]], color: s.color, sw: s.sw, head: t === 'curve' };
      else if (t === 'arrow' || t === 'line') el = { id: uid(), type: t, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: s.color, sw: s.sw };
      else el = { id: uid(), type: t, x: p.x, y: p.y, w: 0, h: 0, color: s.color, sw: s.sw };
      this.page.elements.push(el);
      d.mode = 'draw';
      d.el = el;
      this.schedule();
    }
  }

  onMove(e) {
    if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.gest) {
      if (this.ptrs.size >= 2 && this.g) {
        const [a, b] = [...this.ptrs.values()];
        const g = this.g;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const z = Math.max(0.4, Math.min(6, g.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0)));
        this.zoom = z;
        this.svg.style.width = Math.round(z * 1000) / 10 + '%';
        const r2 = this.svg.getBoundingClientRect();
        this.scroll.scrollLeft += r2.left + g.fx * r2.width - mid.x;
        this.scroll.scrollTop += r2.top + g.fy * r2.height - mid.y;
      }
      return;
    }
    const d = this.drag;
    if (!d) return;
    if (d.mode === 'pan') {
      this.scroll.scrollLeft = d.l - (e.clientX - d.sx);
      this.scroll.scrollTop = d.t - (e.clientY - d.sy);
      return;
    }
    if (d.mode === 'none') return;
    const p = this.pt(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 4 * (this.k || 1)) d.moved = true;
    if (d.mode === 'move' && d.moved) {
      moveEl(d.el, d.orig, dx, dy);
    } else if (d.mode === 'handle') {
      this.dragHandle(d, p, e);
      d.moved = true;
    } else if (d.mode === 'draw') {
      const el = d.el;
      if (el.type === 'pen') {
        const last = el.pts[el.pts.length - 1];
        if (Math.hypot(p.x - last[0], p.y - last[1]) > 2.5 * (this.k || 1)) el.pts.push([p.x, p.y]);
      } else if (el.type === 'arrow' || el.type === 'line') {
        let x2 = p.x, y2 = p.y;
        if (e.shiftKey) { if (Math.abs(x2 - el.x1) > Math.abs(y2 - el.y1)) y2 = el.y1; else x2 = el.x1; }
        el.x2 = x2; el.y2 = y2;
      } else {
        el.x = Math.min(d.start.x, p.x); el.y = Math.min(d.start.y, p.y);
        el.w = Math.abs(p.x - d.start.x); el.h = Math.abs(p.y - d.start.y);
      }
    } else if (d.mode === 'crop') {
      this.cropBox = { x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) };
    }
    this.schedule();
  }

  dragHandle(d, p, e) {
    const el = d.el, o = d.orig, c0 = d.c0;
    if (d.h === 'p1' || d.h === 'p2') {
      if (d.h === 'p1') { el.x1 = p.x; el.y1 = p.y; } else { el.x2 = p.x; el.y2 = p.y; }
      return;
    }
    if (d.h === 'rot') {
      let deg = (Math.atan2(p.y - c0.y, p.x - c0.x) * 180) / Math.PI + 90;
      deg = ((deg + 180) % 360 + 360) % 360 - 180;
      const snap = Math.round(deg / 45) * 45;
      if (Math.abs(deg - snap) < 4) deg = snap;
      el.rot = Math.round(deg * 10) / 10;
      return;
    }
    if (d.h === 'ts') {
      const ratio = Math.hypot(p.x - c0.x, p.y - c0.y) / d.r0;
      el.size = Math.max(8, Math.min(320, o.size * ratio));
      const m = measureText(el.text, el.size, el.bold);
      el.bw = m.w; el.bh = m.h;
      el.x = c0.x - m.w / 2; el.y = c0.y - m.h / 2;
      return;
    }
    // corner resize in the element's own (rotated) frame
    const lp = rotPt(p, c0, -(o.rot || 0));
    let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
    const west = d.h.includes('w'), north = d.h.includes('n');
    if (el.type === 'image' || el.type === 'sketch') {
      const ax = west ? x2 : x1, ay = north ? y2 : y1;
      const w = Math.max(10, Math.abs(lp.x - ax));
      const h = (w * o.h) / o.w;
      if (west) { x1 = ax - w; x2 = ax; } else { x1 = ax; x2 = ax + w; }
      if (north) { y1 = ay - h; y2 = ay; } else { y1 = ay; y2 = ay + h; }
    } else {
      if (west) x1 = lp.x; else x2 = lp.x;
      if (north) y1 = lp.y; else y2 = lp.y;
    }
    const nw = Math.max(6, Math.abs(x2 - x1)), nh = Math.max(6, Math.abs(y2 - y1));
    const lc = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    const wc = rotPt(lc, c0, o.rot || 0);
    el.x = wc.x - nw / 2; el.y = wc.y - nh / 2; el.w = nw; el.h = nh;
  }

  onUp(e, cancelled) {
    this.ptrs.delete(e.pointerId);
    try { this.scroll.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (this.gest) {
      if (this.ptrs.size === 0) { this.gest = false; this.g = null; this.render(); }
      else if (this.ptrs.size < 2) { this.g = null; }
      return;
    }
    const d = this.drag;
    this.drag = null;
    if (!d || d.mode === 'pan') return;
    if (d.mode === 'text' && !cancelled && !d.moved) {
      const p = d.start;
      this.hooks.askText && this.hooks.askText('', (txt) => txt && this.addText(txt, p.x, p.y));
    } else if (d.mode === 'crop') {
      const b = this.cropBox;
      this.cropBox = null;
      if (!cancelled && b && b.w > 20 * (this.k || 1) && b.h > 20 * (this.k || 1) && this.hooks.cropRegion) {
        Promise.resolve(this.hooks.cropRegion(b)).then((el) => {
          if (!el) return;
          this.page.elements.unshift(el);
          this.commit();
          this.tool = 'select';
          this.hooks.onTool && this.hooks.onTool('select');
          this.select(el.id);
        });
      }
      this.render();
    } else if (d.mode === 'draw') {
      const el = d.el;
      const k = this.k || 1;
      let ok = true;
      if (cancelled) ok = false;
      else if (el.type === 'arrow' || el.type === 'line') ok = Math.hypot(el.x2 - el.x1, el.y2 - el.y1) > 12 * k;
      else if (el.type === 'ellipse' || el.type === 'rect') ok = el.w > 12 * k && el.h > 12 * k;
      else if (el.type === 'brace') {
        ok = Math.max(el.w, el.h) > 20 * k;
        if (ok) {
          const vertical = el.h >= el.w;
          if (vertical && el.w < 24) el.w = 28; else if (!vertical && el.h < 24) el.h = 28;
          el.orient = vertical ? 'left' : 'down';
        }
      } else if (el.type === 'pen' && el.head && el.pts.length < 3) ok = false;
      if (!ok) this.page.elements = this.page.elements.filter((x) => x !== el);
      else this.commit();
      this.render();
    } else if (d.mode === 'move' || d.mode === 'handle') {
      if (d.moved) this.commit();
      else if (d.mode === 'move' && d.el.type === 'text' && d.wasSelected && Date.now() - d.t0 < 400) this.editSelectedText();
      this.render();
    }
  }

  onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!this.host.isConnected) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) { e.preventDefault(); this.deleteSel(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); }
    else if (e.key === 'Escape') this.select(null);
  }

  /* --- actions --- */
  addText(text, x, y, size) {
    const sz = size || this.style.size;
    const m = measureText(text, sz, false);
    const el = { id: uid(), type: 'text', x, y, text, size: sz, bw: m.w, bh: m.h, color: this.style.textColor, rot: 0 };
    this.page.elements.push(el);
    this.commit();
    this.tool = 'select';
    this.hooks.onTool && this.hooks.onTool('select');
    this.select(el.id);
  }
  addElements(els) {
    this.page.elements.push(...els);
    this.commit();
    this.render();
  }
  retouchText(el, c0) {
    const m = measureText(el.text, el.size || 32, el.bold);
    el.bw = m.w; el.bh = m.h;
    if (el.rot) { el.x = c0.x - m.w / 2; el.y = c0.y - m.h / 2; }
  }
  editSelectedText() {
    const el = this.getSel();
    if (!el || el.type !== 'text') return;
    this.hooks.askText && this.hooks.askText(el.text, (txt) => {
      if (txt === null || txt === undefined) return;
      if (txt === '') return this.deleteSel();
      const c0 = centerOf(el);
      el.text = txt;
      el.flag = false;
      this.retouchText(el, c0);
      this.commit();
      this.render();
    });
  }
  updateSel(props) {
    const el = this.getSel();
    if (!el) return;
    const c0 = el.type === 'text' ? centerOf(el) : null;
    Object.assign(el, props);
    if (el.type === 'text' && ('size' in props || 'bold' in props)) this.retouchText(el, c0);
    this.render();
  }
  commitSel() { this.commit(); }
  rotateSel(delta) {
    const el = this.getSel();
    if (!el || !canRotate(el)) return;
    let r = (el.rot || 0) + delta;
    r = ((r + 180) % 360 + 360) % 360 - 180;
    el.rot = r;
    this.commit();
    this.render();
  }
  ungroupSel() {
    const el = this.getSel();
    if (!el || el.type !== 'sketch') return;
    const i = this.page.elements.indexOf(el);
    const pens = sketchPens(el).map((p) => ({ ...p, id: uid() }));
    this.page.elements.splice(i, 1, ...pens);
    this.sel = null;
    this.commit();
    this.render();
    this.hooks.onSelect && this.hooks.onSelect(null);
  }
  deleteSel() {
    if (!this.sel) return;
    this.page.elements = this.page.elements.filter((e) => e.id !== this.sel);
    this.sel = null;
    this.commit();
    this.render();
    this.hooks.onSelect && this.hooks.onSelect(null);
  }
  duplicateSel() {
    const el = this.getSel();
    if (!el) return;
    const c = clone(el);
    c.id = uid();
    moveEl(c, el, 30, 30);
    this.page.elements.push(c);
    this.commit();
    this.select(c.id);
  }
  toFront() {
    const el = this.getSel();
    if (!el) return;
    this.page.elements = this.page.elements.filter((e) => e !== el).concat(el);
    this.commit();
    this.render();
  }
  toBack() {
    const el = this.getSel();
    if (!el) return;
    this.page.elements = [el].concat(this.page.elements.filter((e) => e !== el));
    this.commit();
    this.render();
  }
  flipBrace() {
    const el = this.getSel();
    if (!el || el.type !== 'brace') return;
    const order = ['left', 'up', 'right', 'down'];
    const cur = el.orient || (el.h >= el.w ? 'left' : 'down');
    el.orient = order[(order.indexOf(cur) + 1) % 4];
    this.commit();
    this.render();
  }
}
