// editor.js — the page renderer + the editable canvas (SVG based, no libraries)

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
  (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

const n = (v) => Math.round(v * 100) / 100;
export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------- shapes ---------- */

function bracePath(el) {
  const { x, y, w, h } = el;
  const o = el.orient || (h >= w ? 'left' : 'down');
  const vertical = o === 'left' || o === 'right';
  const L = vertical ? h : w; // length along the spine
  const D = vertical ? w : h; // depth of the brace
  const r = Math.max(1, Math.min(L / 4, D * 1.1));
  // path in local (a = along, d = depth) coordinates, point of the brace at d = 0
  const pts = [
    ['M', 0, D],
    ['Q', 0, D / 2, r, D / 2],
    ['L', L / 2 - r, D / 2],
    ['Q', L / 2, D / 2, L / 2, 0],
    ['Q', L / 2, D / 2, L / 2 + r, D / 2],
    ['L', L - r, D / 2],
    ['Q', L, D / 2, L, D],
  ];
  const map = (a, d) => {
    if (o === 'left') return [x + d, y + a];
    if (o === 'right') return [x + D - d, y + a];
    if (o === 'up') return [x + a, y + d];
    return [x + a, y + D - d];
  };
  return pts
    .map((p) => {
      const cmd = p[0];
      const out = [];
      for (let i = 1; i < p.length; i += 2) {
        const [px, py] = map(p[i], p[i + 1]);
        out.push(n(px) + ' ' + n(py));
      }
      return cmd + ' ' + out.join(' ');
    })
    .join(' ');
}

function penPath(pts) {
  if (!pts.length) return '';
  let d = 'M ' + n(pts[0][0]) + ' ' + n(pts[0][1]);
  for (let i = 1; i < pts.length; i++) d += ' L ' + n(pts[i][0]) + ' ' + n(pts[i][1]);
  return d;
}

export function elementSVG(el) {
  const c = el.color || '#1a1a1a';
  const sw = el.sw || 4;
  switch (el.type) {
    case 'text': {
      const size = el.size || 32;
      const lh = size * 1.25;
      const lines = String(el.text || '').split('\n');
      const ts = lines
        .map((ln, i) => `<tspan x="${n(el.x)}" y="${n(el.y + size * 0.9 + i * lh)}">${esc(ln) || '&#8203;'}</tspan>`)
        .join('');
      return `<text font-family="${FONT}" font-size="${n(size)}" font-weight="${el.bold ? 700 : 400}" fill="${c}" xml:space="preserve">${ts}</text>`;
    }
    case 'line':
      return `<line x1="${n(el.x1)}" y1="${n(el.y1)}" x2="${n(el.x2)}" y2="${n(el.y2)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case 'arrow': {
      const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
      const hl = Math.max(14, sw * 5);
      const hw = hl * 0.5;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const bx = el.x2 - cs * hl * 0.8, by = el.y2 - sn * hl * 0.8;
      const p1 = [el.x2 - cs * hl - sn * hw, el.y2 - sn * hl + cs * hw];
      const p2 = [el.x2 - cs * hl + sn * hw, el.y2 - sn * hl - cs * hw];
      return (
        `<line x1="${n(el.x1)}" y1="${n(el.y1)}" x2="${n(bx)}" y2="${n(by)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<polygon points="${n(el.x2)},${n(el.y2)} ${n(p1[0])},${n(p1[1])} ${n(p2[0])},${n(p2[1])}" fill="${c}" stroke="${c}" stroke-width="1" stroke-linejoin="round"/>`
      );
    }
    case 'ellipse':
      return `<ellipse cx="${n(el.x + el.w / 2)}" cy="${n(el.y + el.h / 2)}" rx="${n(el.w / 2)}" ry="${n(el.h / 2)}" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
    case 'rect':
      return `<rect x="${n(el.x)}" y="${n(el.y)}" width="${n(el.w)}" height="${n(el.h)}" rx="6" fill="none" stroke="${c}" stroke-width="${sw}"/>`;
    case 'brace':
      return `<path d="${bracePath(el)}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'pen':
      if (el.pts.length === 1)
        return `<circle cx="${n(el.pts[0][0])}" cy="${n(el.pts[0][1])}" r="${sw / 2}" fill="${c}"/>`;
      return `<path d="${penPath(el.pts)}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    default:
      return '';
  }
}

// extra invisible, fatter shapes so thin strokes are easy to tap in the editor
function hitSVG(el) {
  const hs = Math.max(26, (el.sw || 4) + 20);
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
    case 'pen':
      return el.pts.length > 1 ? `<path d="${penPath(el.pts)}" ${st}/>` : `<circle cx="${n(el.pts[0][0])}" cy="${n(el.pts[0][1])}" r="${hs / 2}" fill="transparent" pointer-events="all"/>`;
    default:
      return '';
  }
}

// Full page as a standalone SVG string (used for thumbnails and PDF export)
export function pageSVG(page, assets, scale = 1) {
  const bg = page.bg && assets.get(page.bg);
  let inner = `<rect width="${page.w}" height="${page.h}" fill="#ffffff"/>`;
  if (bg)
    inner += `<image href="${bg}" xlink:href="${bg}" x="0" y="0" width="${page.w}" height="${page.h}" preserveAspectRatio="xMidYMid meet"/>`;
  inner += page.elements.map(elementSVG).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${Math.round(page.w * scale)}" height="${Math.round(page.h * scale)}" viewBox="0 0 ${page.w} ${page.h}">${inner}</svg>`
  );
}

export async function rasterPage(page, assets, scale = 1, type = 'image/jpeg', q = 0.92) {
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

/* ---------- geometry helpers ---------- */

function bboxOf(el) {
  switch (el.type) {
    case 'line':
    case 'arrow':
      return {
        x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2),
        w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1),
      };
    case 'ellipse':
    case 'rect':
    case 'brace':
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case 'pen': {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const [x, y] of el.pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    default:
      return null;
  }
}

function moveEl(el, o, dx, dy) {
  if (el.type === 'text') { el.x = o.x + dx; el.y = o.y + dy; }
  else if (el.type === 'line' || el.type === 'arrow') { el.x1 = o.x1 + dx; el.y1 = o.y1 + dy; el.x2 = o.x2 + dx; el.y2 = o.y2 + dy; }
  else if (el.type === 'pen') el.pts = o.pts.map(([x, y]) => [x + dx, y + dy]);
  else { el.x = o.x + dx; el.y = o.y + dy; }
}

const TOOLS_DRAW = ['pen', 'arrow', 'line', 'ellipse', 'rect', 'brace'];

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
    this.showFlags = true;
    this.hist = [];
    this.hi = -1;
    this.style = { color: '#3db8e8', sw: 4, size: 36, textColor: '#1a1a1a' };
    this.assets = new Map();
    this._raf = 0;
    this.svg.addEventListener('pointerdown', (e) => this.onDown(e));
    this.svg.addEventListener('pointermove', (e) => this.onMove(e));
    this.svg.addEventListener('pointerup', (e) => this.onUp(e));
    this.svg.addEventListener('pointercancel', (e) => this.onUp(e, true));
    this.svg.addEventListener('dblclick', (e) => {
      const g = e.target.closest && e.target.closest('.el');
      if (g && this.tool === 'select') { this.select(g.dataset.id); this.editSelectedText(); }
    });
    this.svg.addEventListener('contextmenu', (e) => e.preventDefault());
    this._keys = (e) => this.onKey(e);
    document.addEventListener('keydown', this._keys);
  }

  destroy() {
    document.removeEventListener('keydown', this._keys);
  }

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
    this.svg.style.width = Math.round(this.zoom * 100) + '%';
    this.svg.style.aspectRatio = `${this.page.w} / ${this.page.h}`;
  }
  setZoom(z) {
    this.zoom = Math.max(0.5, Math.min(4, z));
    this.applyZoom();
    this.render();
  }
  fit() { this.setZoom(1); this.scroll.scrollTo(0, 0); }

  setTool(t) {
    this.tool = t;
    this.svg.dataset.tool = t;
    this.svg.style.touchAction = t === 'hand' ? 'auto' : 'none';
    if (t !== 'select') this.sel = null;
    this.render();
    this.hooks.onTool && this.hooks.onTool(t);
    this.hooks.onSelect && this.hooks.onSelect(this.getSel());
  }
  setShowRef(v) { this.showRef = v; this.render(); }

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
      inner += `<image href="${this.refSrc}" x="0" y="0" width="${p.w}" height="${p.h}" preserveAspectRatio="none" opacity="0.4" pointer-events="none"/>`;
    inner += p.elements.map((el) => `<g class="el" data-id="${el.id}">${elementSVG(el)}${hitSVG(el)}</g>`).join('');
    inner += '<g class="over"></g>';
    this.svg.setAttribute('viewBox', `0 0 ${p.w} ${p.h}`);
    this.svg.innerHTML = inner;
    this.decorate();
  }

  decorate() {
    const p = this.page;
    const over = this.svg.querySelector('.over');
    const rect = this.svg.getBoundingClientRect();
    this.k = rect.width ? p.w / rect.width : 1; // page units per screen px
    // text boxes: invisible hit area + "unsure" highlight
    for (const el of p.elements) {
      if (el.type !== 'text') continue;
      const g = this.svg.querySelector(`.el[data-id="${el.id}"]`);
      if (!g) continue;
      let b;
      try { b = g.querySelector('text').getBBox(); } catch (e) { continue; }
      el._b = { x: b.x, y: b.y, w: b.width, h: b.height };
      const pad = 4;
      let pre = '';
      if (el.flag && this.showFlags)
        pre += `<rect class="flag" x="${n(b.x - pad)}" y="${n(b.y - pad)}" width="${n(b.width + 2 * pad)}" height="${n(b.height + 2 * pad)}" rx="6" fill="#ffd84d" opacity="0.55" pointer-events="none"/>`;
      pre += `<rect x="${n(b.x - pad)}" y="${n(b.y - pad)}" width="${n(b.width + 2 * pad)}" height="${n(b.height + 2 * pad)}" fill="transparent" pointer-events="all"/>`;
      g.insertAdjacentHTML('afterbegin', pre);
    }
    // selection frame + handles
    const el = this.getSel();
    if (!el) return;
    const k = this.k;
    const bb = el.type === 'text' ? el._b : bboxOf(el);
    if (!bb) return;
    const pad = 8 * k;
    let h = `<rect x="${n(bb.x - pad)}" y="${n(bb.y - pad)}" width="${n(bb.w + 2 * pad)}" height="${n(bb.h + 2 * pad)}" fill="none" stroke="#2b7de9" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    const hr = 9 * k;
    const dot = (name, x, y) =>
      `<circle data-h="${name}" cx="${n(x)}" cy="${n(y)}" r="${n(hr)}" fill="#fff" stroke="#2b7de9" stroke-width="2" vector-effect="non-scaling-stroke" style="cursor:pointer"/>`;
    if (el.type === 'line' || el.type === 'arrow') h += dot('p1', el.x1, el.y1) + dot('p2', el.x2, el.y2);
    else if (el.type === 'ellipse' || el.type === 'rect' || el.type === 'brace')
      h += dot('nw', el.x, el.y) + dot('ne', el.x + el.w, el.y) + dot('sw', el.x, el.y + el.h) + dot('se', el.x + el.w, el.y + el.h);
    over.innerHTML = h;
  }

  /* --- history --- */
  commit() {
    const s = JSON.stringify(this.page.elements, (k, v) => (k === '_b' ? undefined : v));
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

  /* --- pointer handling --- */
  pt(e) {
    const r = this.svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * this.page.w) / r.width, y: ((e.clientY - r.top) * this.page.h) / r.height };
  }

  onDown(e) {
    if (this.tool === 'hand') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { this.svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = this.pt(e);
    const d = (this.drag = { start: p, mode: 'none', moved: false, t0: Date.now() });
    const t = this.tool;
    if (t === 'select') {
      const hd = e.target.closest && e.target.closest('[data-h]');
      const el = this.getSel();
      if (hd && el) { d.mode = 'handle'; d.h = hd.dataset.h; d.orig = clone(el); d.el = el; return; }
      const g = e.target.closest && e.target.closest('.el');
      if (g) {
        const again = this.sel === g.dataset.id;
        d.wasSelected = again;
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
    } else if (TOOLS_DRAW.includes(t)) {
      const s = this.style;
      let el;
      if (t === 'pen') el = { id: uid(), type: 'pen', pts: [[p.x, p.y]], color: s.color, sw: s.sw };
      else if (t === 'arrow' || t === 'line') el = { id: uid(), type: t, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: s.color, sw: s.sw };
      else el = { id: uid(), type: t, x: p.x, y: p.y, w: 0, h: 0, color: s.color, sw: s.sw };
      this.page.elements.push(el);
      d.mode = 'draw';
      d.el = el;
      this.schedule();
    }
  }

  onMove(e) {
    const d = this.drag;
    if (!d || d.mode === 'none') return;
    const p = this.pt(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 3 * (this.k || 1)) d.moved = true;
    if (d.mode === 'move' && d.moved) {
      moveEl(d.el, d.orig, dx, dy);
    } else if (d.mode === 'handle') {
      const el = d.el;
      if (el.type === 'line' || el.type === 'arrow') {
        if (d.h === 'p1') { el.x1 = p.x; el.y1 = p.y; } else { el.x2 = p.x; el.y2 = p.y; }
      } else {
        const o = d.orig;
        let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (d.h.includes('w')) x1 = p.x; else x2 = p.x;
        if (d.h.includes('n')) y1 = p.y; else y2 = p.y;
        el.x = Math.min(x1, x2); el.y = Math.min(y1, y2);
        el.w = Math.abs(x2 - x1); el.h = Math.abs(y2 - y1);
      }
      d.moved = true;
    } else if (d.mode === 'draw') {
      const el = d.el;
      if (el.type === 'pen') {
        const last = el.pts[el.pts.length - 1];
        if (Math.hypot(p.x - last[0], p.y - last[1]) > 2 * (this.k || 1)) el.pts.push([p.x, p.y]);
      } else if (el.type === 'arrow' || el.type === 'line') {
        let x2 = p.x, y2 = p.y;
        if (e.shiftKey) { if (Math.abs(x2 - el.x1) > Math.abs(y2 - el.y1)) y2 = el.y1; else x2 = el.x1; }
        el.x2 = x2; el.y2 = y2;
      } else {
        el.x = Math.min(d.start.x, p.x); el.y = Math.min(d.start.y, p.y);
        el.w = Math.abs(p.x - d.start.x); el.h = Math.abs(p.y - d.start.y);
      }
    }
    this.schedule();
  }

  onUp(e, cancelled) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    try { this.svg.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (d.mode === 'text' && !cancelled && !d.moved) {
      const p = d.start;
      this.hooks.askText && this.hooks.askText('', (txt) => txt && this.addText(txt, p.x, p.y));
    } else if (d.mode === 'draw') {
      const el = d.el;
      const k = this.k || 1;
      let ok = true;
      if (cancelled) ok = false;
      else if (el.type === 'arrow' || el.type === 'line') ok = Math.hypot(el.x2 - el.x1, el.y2 - el.y1) > 12 * k;
      else if (el.type === 'ellipse' || el.type === 'rect') ok = el.w > 12 * k && el.h > 12 * k;
      else if (el.type === 'brace') {
        ok = Math.max(el.w, el.h) > 20 * k;
        if (ok) { // give the brace some depth if the drag was almost a straight line
          const vertical = el.h >= el.w;
          if (vertical && el.w < 24) { el.w = 28; } else if (!vertical && el.h < 24) { el.h = 28; }
          el.orient = vertical ? 'left' : 'down';
        }
      }
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
    const el = { id: uid(), type: 'text', x, y, text, size: size || this.style.size, color: this.style.textColor };
    this.page.elements.push(el);
    this.commit();
    this.tool = 'select';
    this.hooks.onTool && this.hooks.onTool('select');
    this.svg.style.touchAction = 'none';
    this.select(el.id);
  }
  addElements(els) {
    this.page.elements.push(...els);
    this.commit();
    this.render();
  }
  editSelectedText() {
    const el = this.getSel();
    if (!el || el.type !== 'text') return;
    this.hooks.askText && this.hooks.askText(el.text, (txt) => {
      if (txt === null || txt === undefined) return;
      if (txt === '') return this.deleteSel();
      el.text = txt;
      this.commit();
      this.render();
    });
  }
  updateSel(props) {
    const el = this.getSel();
    if (!el) return;
    Object.assign(el, props);
    this.render();
  }
  commitSel() { this.commit(); }
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
    delete c._b;
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
