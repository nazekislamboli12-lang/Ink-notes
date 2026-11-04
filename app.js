// app.js — screens: notebooks, pages, editor, settings, export
import { Editor, PALETTE, rasterPage, uid, esc } from './editor.js';
import { db, saveAsset, getAsset, loadAssets, exportAll, importAll } from './db.js';
import { readNotes, buildElements, testKey, DEFAULT_MODEL, AIError } from './ai.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');

/* ---------- icons ---------- */
const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  star: '<polygon points="12 2.8 14.9 8.9 21.5 9.7 16.6 14.2 17.9 20.8 12 17.5 6.1 20.8 7.4 14.2 2.5 9.7 9.1 8.9"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',
  text: '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
  pen: '<path d="M4 20l1-4L16 5a2.1 2.1 0 013 3L8 19z"/><path d="M14 7l3 3"/>',
  arrow: '<path d="M5 19L19 5M9 5h10v10"/>',
  line: '<path d="M5 19L19 5"/>',
  circle: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  brace: '<path d="M16 4c-3 0-4 1-4 3v3c0 1.5-1 2-3 2 2 0 3 .5 3 2v3c0 2 1 3 4 3"/>',
  hand: '<path d="M9 12V5.5a1.5 1.5 0 013 0V11m0-6a1.5 1.5 0 013 0v6m0-4.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-4.5-2L4 14.5a1.5 1.5 0 012.3-1.9L9 15"/>',
  select: '<path d="M6 3l13 7-6 2-2 6z"/>',
  zin: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5M8 11h6M11 8v6"/>',
  zout: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.5-4.5M8 11h6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M5 12.5l5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M14 6l-6 6 6 6"/>',
  right: '<path d="M10 6l6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  flip: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z"/>',
  book: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  bold: '<path d="M7 4h6a3.5 3.5 0 010 7H7zM7 11h7a3.5 3.5 0 010 7H7z"/>',
};
const ic = (name, size = 22) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- settings ---------- */
const SKEY = 'inknotes.settings';
function loadSettings() {
  const d = { apiKey: '', model: DEFAULT_MODEL, typedBlack: true, fixTypos: false };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return d; }
}
function saveSettings() {
  try { localStorage.setItem(SKEY, JSON.stringify(S.settings)); } catch (e) { toast('Could not save settings on this browser'); }
}

/* ---------- state ---------- */
const S = { settings: loadSettings(), ed: null, onBack: null, page: null, draft: false, nb: null, saveT: 0, thumbT: 0 };

/* ---------- small ui helpers ---------- */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

function modal(html, { bottom = false, dismiss = true } = {}) {
  const root = $('#modal-root');
  const el = document.createElement('div');
  el.className = 'scrim' + (bottom ? ' bottom' : '');
  el.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(el);
  const close = () => el.remove();
  if (dismiss) el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
  return { el, close, q: (s) => el.querySelector(s) };
}

function ask({ title, label, value = '', multiline = false, ok = 'Save', allowEmpty = false }) {
  return new Promise((res) => {
    const m = modal(`<h2>${esc(title)}</h2>${label ? `<label for="ask-in">${esc(label)}</label>` : ''}
      ${multiline ? `<textarea id="ask-in"></textarea>` : `<input id="ask-in" type="text">`}
      <div class="row"><button class="btn" data-a="cancel">Cancel</button><button class="btn primary" data-a="ok">${esc(ok)}</button></div>`);
    const inp = m.q('#ask-in');
    inp.value = value;
    setTimeout(() => { inp.focus(); inp.select && inp.select(); }, 30);
    const done = (v) => { m.close(); res(v); };
    m.el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      if (a.dataset.a === 'cancel') done(null);
      if (a.dataset.a === 'ok') { const v = inp.value; if (!v.trim() && !allowEmpty) return inp.focus(); done(v); }
    });
    m.el.addEventListener('pointerdown', (e) => { if (e.target === m.el) res(null); });
    if (!multiline) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') m.q('[data-a=ok]').click(); });
  });
}

function confirmBox(title, msg, okLabel = 'Delete', danger = true) {
  return new Promise((res) => {
    const m = modal(`<h2>${esc(title)}</h2><p>${esc(msg)}</p>
      <div class="row"><button class="btn" data-a="no">Cancel</button><button class="btn primary ${danger ? 'danger' : ''}" data-a="yes">${esc(okLabel)}</button></div>`);
    m.el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (a) { m.close(); res(a.dataset.a === 'yes'); }
    });
    m.el.addEventListener('pointerdown', (e) => { if (e.target === m.el) res(false); });
  });
}

function sheet(title, items) {
  const m = modal(
    `<h2>${esc(title)}</h2>` +
      items.map((it, i) => `<button class="opt ${it.danger ? 'danger' : ''}" data-i="${i}">${ic(it.icon)}<span>${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join(''),
    { bottom: true }
  );
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const it = items[+b.dataset.i];
    m.close();
    it.fn();
  });
  return m;
}

function busy(text) {
  const m = modal(`<div class="busy"><div class="spin"></div><p id="busy-t">${esc(text)}</p></div>`, { dismiss: false });
  return { set: (t) => { const p = m.q('#busy-t'); if (p) p.textContent = t; }, hide: m.close };
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeName = (s) => (s || 'notes').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'notes';

/* ---------- navigation (so the phone's Back button works) ---------- */
function enter(push, onBack) {
  if (push) history.pushState({ inkv: 1 }, '');
  S.onBack = onBack;
}
window.addEventListener('popstate', () => {
  const f = S.onBack;
  S.onBack = null;
  if (f) f();
});

/* ---------- data helpers ---------- */
function newPage(nbId, w, h) {
  const now = Date.now();
  return { id: uid(), notebookId: nbId, w: 1200, h: Math.max(600, Math.min(3000, Math.round((1200 * h) / w))), elements: [], bg: null, ref: null, title: '', bookmark: false, created: now, updated: now, thumb: '' };
}
const cleanElements = (els) => JSON.parse(JSON.stringify(els, (k, v) => (k === '_b' ? undefined : v)));

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not open that image.'));
    i.src = src;
  });
}
async function fileToImage(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * sc);
    c.height = Math.round(img.naturalHeight * sc);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL('image/jpeg', 0.86), w: c.width, h: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function makeThumb(page, assets) {
  const c = await rasterPage(page, assets, 0.3);
  return c.toDataURL('image/jpeg', 0.72);
}
async function orderedPages(nb) {
  const pages = await db.pagesOf(nb.id);
  const map = new Map(pages.map((p) => [p.id, p]));
  const out = nb.pageIds.map((id) => map.get(id)).filter(Boolean);
  return out;
}
async function deletePageData(page) {
  for (const id of [page.bg, page.ref]) if (id) await db.del('assets', id);
  await db.del('pages', page.id);
}

/* ======================= HOME ======================= */
const COVERS = ['#2b6fd6', '#1f9d8a', '#c2569b', '#e07a1f', '#7a5af0', '#3a8f3a', '#c2453a'];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

async function renderHome(fromPop) {
  enter(false, null);
  S.nb = null;
  const nbs = (await db.all('notebooks')).sort((a, b) => b.updated - a.updated);
  app.innerHTML = `
    <header class="topbar"><h1>Ink Notes</h1><div class="sp"></div>
      <button class="ib" data-a="bookmarks" aria-label="All bookmarks">${ic('star')}</button>
      <button class="ib" data-a="settings" aria-label="Settings and backup">${ic('sliders')}</button></header>
    <main>${
      nbs.length
        ? `<div class="grid">${nbs.map((nb) => `
          <div class="card"><button class="nb-open" data-open="${nb.id}"><div class="cover" style="background:${COVERS[hash(nb.id) % COVERS.length]}">${ic('book', 44)}</div>
          <div class="meta"><b>${esc(nb.name)}</b><span>${nb.pageIds.length} page${nb.pageIds.length === 1 ? '' : 's'}</span></div></button>
          <button class="ib more" data-more="${nb.id}" aria-label="More for ${esc(nb.name)}">${ic('more')}</button></div>`).join('')}</div>`
        : `<div class="empty">${ic('book', 56)}<h2>Make your first notebook</h2><p>One notebook per subject, for example “Botany”. Then add pages from photos of your handwritten notes.</p></div>`
    }</main>
    <button class="fab" data-a="newnb">${ic('plus')}<span>New notebook</span></button>`;
  app.onclick = async (e) => {
    const t = e.target.closest('[data-a],[data-open],[data-more]');
    if (!t) return;
    if (t.dataset.open) return renderNotebook(t.dataset.open, false, false);
    if (t.dataset.more) return notebookMenu(t.dataset.more);
    const a = t.dataset.a;
    if (a === 'newnb') {
      const name = await ask({ title: 'New notebook', label: 'Name (for example Botany)', ok: 'Create' });
      if (!name) return;
      const nb = { id: uid(), name: name.trim(), pageIds: [], created: Date.now(), updated: Date.now() };
      await db.put('notebooks', nb);
      renderNotebook(nb.id, false);
    } else if (a === 'settings') openSettings();
    else if (a === 'bookmarks') renderBookmarks(false);
  };
}

async function notebookMenu(id) {
  const nb = await db.get('notebooks', id);
  sheet(nb.name, [
    { icon: 'edit', label: 'Rename', fn: async () => { const n = await ask({ title: 'Rename notebook', value: nb.name }); if (n) { nb.name = n.trim(); await db.put('notebooks', nb); S.nb ? renderNotebook(id, true) : renderHome(); } } },
    { icon: 'download', label: 'Save as PDF', fn: () => exportPDF(nb) },
    { icon: 'trash', label: 'Delete notebook', danger: true, fn: async () => {
      if (!(await confirmBox('Delete this notebook?', `“${nb.name}” and all its pages will be removed from this device. A backup file can bring them back.`))) return;
      for (const p of await db.pagesOf(id)) await deletePageData(p);
      await db.del('notebooks', id);
      toast('Notebook deleted');
      renderHome();
    } },
  ]);
}

/* ======================= NOTEBOOK ======================= */
async function renderNotebook(id, fromPop, filter) {
  const nb = await db.get('notebooks', id);
  if (!nb) return renderHome();
  enter(!fromPop, () => renderHome(true));
  S.nb = nb;
  const onlyMarks = filter === undefined ? !!S.filter : filter;
  S.filter = onlyMarks;
  const pages = await orderedPages(nb);
  const shown = pages.filter((p) => !onlyMarks || p.bookmark);
  app.innerHTML = `
    <header class="topbar"><button class="ib" data-a="back" aria-label="Back">${ic('back')}</button>
      <button class="title" data-a="rename" aria-label="Rename notebook">${esc(nb.name)}</button>
      <button class="ib" data-a="pdf" aria-label="Save notebook as PDF">${ic('download')}</button>
      <button class="ib" data-a="menu" aria-label="More">${ic('more')}</button></header>
    <main>
      <div class="chips"><button class="chip" data-a="filter" aria-pressed="${onlyMarks}">${ic('star', 18)} Bookmarked only</button>
        <span class="note" style="align-self:center">${pages.length} page${pages.length === 1 ? '' : 's'}</span></div>
      ${shown.length
        ? `<div class="grid">${shown.map((p) => { const i = pages.indexOf(p); return `
          <div class="pg" data-id="${p.id}">
            <button class="pg-open" data-open="${p.id}" aria-label="Open page ${i + 1}">${p.thumb ? `<img alt="" src="${p.thumb}">` : ''}${p.bookmark ? `<span class="star">${ic('star', 22).replace('fill="none"', 'fill="currentColor"')}</span>` : ''}</button>
            <div class="pg-bar"><span class="lbl">${i + 1}${p.title ? ' · ' + esc(p.title) : ''}</span>
              <button class="ib" data-star="${p.id}" aria-label="Bookmark" aria-pressed="${p.bookmark}">${ic('star', 20)}</button>
              <button class="ib" data-mv="-1" data-id="${p.id}" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>${ic('left', 20)}</button>
              <button class="ib" data-mv="1" data-id="${p.id}" aria-label="Move later" ${i === pages.length - 1 ? 'disabled' : ''}>${ic('right', 20)}</button>
              <button class="ib" data-del="${p.id}" aria-label="Delete page">${ic('trash', 20)}</button></div></div>`; }).join('')}</div>`
        : `<div class="empty">${ic('sparkle', 52)}<h2>${onlyMarks ? 'No bookmarked pages' : 'No pages yet'}</h2><p>${onlyMarks ? 'Tap the star on a page to bookmark it.' : 'Tap “Add page”, then take a photo of your notes and the AI will type them for you.'}</p></div>`}
    </main>
    <button class="fab" data-a="add">${ic('plus')}<span>Add page</span></button>`;

  // make missing thumbnails in the background
  for (const p of shown) if (!p.thumb) makeMissingThumb(p);

  app.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.open) { const p = pages.find((x) => x.id === d.open); return openEditor(p, { parent: (pop) => renderNotebook(id, pop) }); }
    if (d.star) { const p = pages.find((x) => x.id === d.star); p.bookmark = !p.bookmark; await db.put('pages', p); return renderNotebook(id, true); }
    if (d.mv) {
      const i = nb.pageIds.indexOf(d.id), j = i + Number(d.mv);
      if (j < 0 || j >= nb.pageIds.length) return;
      [nb.pageIds[i], nb.pageIds[j]] = [nb.pageIds[j], nb.pageIds[i]];
      await db.put('notebooks', nb);
      return renderNotebook(id, true);
    }
    if (d.del) {
      const p = pages.find((x) => x.id === d.del);
      if (!(await confirmBox('Delete this page?', 'This page will be removed from the notebook.'))) return;
      await deletePageData(p);
      nb.pageIds = nb.pageIds.filter((x) => x !== p.id);
      nb.updated = Date.now();
      await db.put('notebooks', nb);
      return renderNotebook(id, true);
    }
    const a = d.a;
    if (a === 'back') history.back();
    else if (a === 'rename' || a === 'menu') notebookMenu(id);
    else if (a === 'pdf') exportPDF(nb);
    else if (a === 'filter') renderNotebook(id, true, !S.filter);
    else if (a === 'add') addPageSheet();
  };
}

async function makeMissingThumb(p) {
  try {
    const assets = await loadAssets(p);
    p.thumb = await makeThumb(p, assets);
    await db.put('pages', p);
    const img = $(`.pg[data-id="${p.id}"] .pg-open`);
    if (img && !img.querySelector('img')) img.insertAdjacentHTML('afterbegin', `<img alt="" src="${p.thumb}">`);
  } catch (e) { /* ignore */ }
}

function addPageSheet() {
  sheet('Add a page', [
    { icon: 'camera', label: 'Take a photo — AI types it', sub: 'Then you check and fix it before adding', fn: () => $('#file-camera').click() },
    { icon: 'image', label: 'Photo from gallery — AI types it', sub: 'Pick a picture of handwritten notes', fn: () => $('#file-gallery').click() },
    { icon: 'file', label: 'Image or PDF from my files', sub: 'Added as it is — you can write and draw on it', fn: () => $('#file-import').click() },
    { icon: 'plus', label: 'Blank page', fn: addBlankPage },
  ]);
}

async function addBlankPage() {
  const nb = S.nb;
  const page = newPage(nb.id, 1200, 1700);
  await db.put('pages', page);
  nb.pageIds.push(page.id);
  nb.updated = Date.now();
  await db.put('notebooks', nb);
  openEditor(page, { parent: (pop) => renderNotebook(nb.id, pop) });
}

/* ======================= AI: photo -> page ======================= */
async function aiFromFile(file) {
  if (!file || !S.nb) return;
  if (!S.settings.apiKey) {
    toast('Add your free Gemini key first');
    return openSettings();
  }
  const nb = S.nb;
  let b;
  try {
    b = busy('Preparing your photo…');
    const img = await fileToImage(file, 1600);
    b.set('Reading your notes… this can take up to a minute');
    const { data, model } = await readNotes(img.dataUrl, S.settings, (t) => b.set(t));
    const page = newPage(nb.id, img.w, img.h);
    page.elements = buildElements(data, page, S.settings);
    page.title = typeof data.page_title === 'string' ? data.page_title.slice(0, 60) : '';
    page.ref = uid();
    await saveAsset(page.ref, img.dataUrl); // kept so you can lay the photo over the page while checking
    b.hide();
    const assets = new Map([[page.ref, img.dataUrl]]);
    if (!page.elements.length) toast('The AI found no writing. You can still draw or type on this page.');
    openEditor(page, { draft: true, assets, parent: (pop) => renderNotebook(nb.id, pop), model });
  } catch (e) {
    if (b) b.hide();
    const m = modal(`<h2>Could not read that photo</h2><p class="err">${esc(e.message || String(e))}</p>
      <div class="row">${e instanceof AIError && /key/i.test(e.message) ? '<button class="btn" data-a="settings">Open settings</button>' : ''}
      <button class="btn" data-a="close">Close</button><button class="btn primary" data-a="retry">Try again</button></div>`);
    m.el.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-a]');
      if (!a) return;
      m.close();
      if (a.dataset.a === 'retry') aiFromFile(file);
      if (a.dataset.a === 'settings') openSettings();
    });
  }
}

/* ======================= import images / PDFs as pages ======================= */
async function pdfToImages(file, onProgress) {
  const pdfjs = await import('./vendor/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', location.href).href;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress && onProgress(`Opening PDF page ${i} of ${doc.numPages}…`);
    const pg = await doc.getPage(i);
    const v0 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: Math.min(2.5, 1600 / v0.width) });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise;
    out.push({ dataUrl: c.toDataURL('image/jpeg', 0.86), w: c.width, h: c.height });
  }
  return out;
}

async function importFiles(files) {
  if (!files.length || !S.nb) return;
  const nb = S.nb;
  const b = busy('Adding pages…');
  let added = 0;
  try {
    for (const f of files) {
      let imgs;
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) imgs = await pdfToImages(f, (t) => b.set(t));
      else { b.set(`Adding ${f.name}…`); imgs = [await fileToImage(f, 2000)]; }
      for (const im of imgs) {
        const page = newPage(nb.id, im.w, im.h);
        page.bg = uid();
        await saveAsset(page.bg, im.dataUrl);
        page.thumb = await makeThumb(page, new Map([[page.bg, im.dataUrl]]));
        await db.put('pages', page);
        nb.pageIds.push(page.id);
        added++;
      }
    }
    nb.updated = Date.now();
    await db.put('notebooks', nb);
    b.hide();
    toast(`Added ${added} page${added === 1 ? '' : 's'}`);
  } catch (e) {
    b.hide();
    toast('Could not add that file: ' + (e.message || e));
    nb.updated = Date.now();
    await db.put('notebooks', nb);
  }
  renderNotebook(nb.id, true);
}

/* ======================= EDITOR ======================= */
const TOOLS = [
  ['hand', 'Move around'], ['select', 'Select and edit'], ['text', 'Type text'], ['pen', 'Draw'],
  ['arrow', 'Arrow'], ['line', 'Line'], ['circle', 'Circle'], ['rect', 'Box'], ['brace', 'Curly brace'],
];
const TOOL_MAP = { circle: 'ellipse' };

async function openEditor(page, opts = {}) {
  const parent = opts.parent;
  const draft = !!opts.draft;
  const assets = opts.assets || (await loadAssets(page));
  const refSrc = page.ref ? assets.get(page.ref) : null;
  S.page = page;
  S.draft = draft;
  S.assets = assets;
  S.dirty = false;
  enter(true, () => leave());

  async function leave() {
    if (draft) {
      if (!(await confirmBox('Discard this page?', 'The typed page will not be added to your notebook.', 'Discard'))) {
        history.pushState({ inkv: 1 }, '');
        S.onBack = () => leave();
        return;
      }
      for (const id of [page.ref, page.bg]) if (id) await db.del('assets', id);
    } else {
      await flush();
    }
    destroy();
    parent(true);
  }
  function destroy() { if (S.ed) S.ed.destroy(); S.ed = null; }
  const snap = () => ({ ...page, elements: cleanElements(page.elements) });
  async function flush() {
    clearTimeout(S.saveT);
    clearTimeout(S.thumbT);
    if (!S.dirty || draft) return;
    page.updated = Date.now();
    try { page.thumb = await makeThumb(page, assets); } catch (e) { /* keep old */ }
    await db.put('pages', snap());
    S.dirty = false;
  }
  function scheduleSave() {
    S.dirty = true;
    if (draft) return;
    clearTimeout(S.saveT);
    S.saveT = setTimeout(async () => {
      page.updated = Date.now();
      await db.put('pages', snap());
    }, 500);
    clearTimeout(S.thumbT);
    S.thumbT = setTimeout(async () => { try { page.thumb = await makeThumb(page, assets); await db.put('pages', snap()); } catch (e) { /* ignore */ } }, 3000);
  }

  app.innerHTML = `
    <div class="ed-view">
      <header class="topbar">
        <button class="ib" data-a="back" aria-label="Back">${ic('back')}</button>
        <input class="title" id="ptitle" type="text" placeholder="Page title (optional)" aria-label="Page title" maxlength="60">
        <button class="ib" id="bm" data-a="bm" aria-label="Bookmark this page" aria-pressed="false">${ic('star')}</button>
        <button class="ib" id="undo" data-a="undo" aria-label="Undo">${ic('undo')}</button>
        <button class="ib" id="redo" data-a="redo" aria-label="Redo">${ic('redo')}</button>
        <button class="ib" data-a="menu" aria-label="More">${ic('more')}</button>
      </header>
      ${draft ? `<div class="banner"><div><b>Check the page.</b> Compare it with your photo (tap “Show photo”), fix anything wrong, then add it. <mark>Yellow</mark> means the AI was not sure.</div>
        <div class="bn-btns"><button class="btn" data-a="photo" id="photo-btn" aria-pressed="false">${ic('eye', 18)} Show photo</button><button class="btn" data-a="discard">Discard</button><button class="btn primary" data-a="add">${ic('check', 18)} Add to notebook</button></div></div>` : ''}
      <div class="ed-host" id="ed-host"></div>
      <div class="propbar" id="propbar" hidden></div>
      <nav class="toolbar" aria-label="Tools">${TOOLS.map(([t, label]) => `<button class="tool" data-t="${t}" aria-label="${label}" title="${label}" aria-pressed="false">${ic(t)}</button>`).join('')}</nav>
    </div>`;
  $('#ptitle').value = page.title || '';
  $('#bm').setAttribute('aria-pressed', String(!!page.bookmark));
  if (page.bookmark) $('#bm').classList.add('on');

  const host = $('#ed-host');

  function askText(initial, cb) {
    ask({ title: initial ? 'Edit text' : 'Type text', value: initial, multiline: true, ok: initial ? 'Save' : 'Add', allowEmpty: !!initial }).then((v) => cb(v));
  }
  const ed = (S.ed = new Editor(host, {
    onSelect: () => updateProps(),
    onTool: (t) => { document.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === (t === 'ellipse' ? 'circle' : t)))); updateProps(); },
    onChange: () => scheduleSave(),
    onHistory: () => { $('#undo').disabled = !ed.canUndo(); $('#redo').disabled = !ed.canRedo(); },
    askText,
  }));
  host.insertAdjacentHTML('beforeend', `<div class="zoom"><button class="ib" data-a="zin" aria-label="Zoom in">${ic('zin')}</button><button class="ib" data-a="zout" aria-label="Zoom out">${ic('zout')}</button><button class="ib" data-a="fit" aria-label="Fit to screen">${ic('fit')}</button></div>`);
  ed.load(page, assets, refSrc);
  ed.setTool(page.elements.length || draft ? 'select' : 'pen');
  $('#undo').disabled = true;
  $('#redo').disabled = true;

  /* property bar */
  function updateProps() {
    const bar = $('#propbar');
    if (!bar) return;
    const el = ed.getSel();
    const t = ed.tool;
    const drawing = ['pen', 'arrow', 'line', 'ellipse', 'rect', 'brace', 'text'].includes(t);
    if (!el && !drawing) { bar.hidden = true; return; }
    const isText = el ? el.type === 'text' : t === 'text';
    const color = el ? el.color : isText ? ed.style.textColor : ed.style.color;
    const val = isText ? (el ? el.size : ed.style.size) : el ? el.sw : ed.style.sw;
    bar.hidden = false;
    bar.innerHTML = `
      <div class="sw" role="group" aria-label="Color">${PALETTE.map(([name, hex]) => `<button data-c="${hex}" style="background:${hex}" aria-label="${name}" aria-pressed="${hex === color}"></button>`).join('')}</div>
      <label class="range">${isText ? 'Size' : 'Thickness'}<input id="rng" type="range" min="${isText ? 14 : 1}" max="${isText ? 140 : 20}" step="1" value="${Math.round(val)}"></label>
      ${el ? `<div class="acts">
        ${isText ? `<button class="ib" data-p="edit" aria-label="Edit text">${ic('edit')}</button><button class="ib ${el.bold ? 'on' : ''}" data-p="bold" aria-label="Bold" aria-pressed="${!!el.bold}">${ic('bold')}</button>` : ''}
        ${el.type === 'brace' ? `<button class="ib" data-p="flip" aria-label="Turn the brace">${ic('flip')}</button>` : ''}
        <button class="ib" data-p="dup" aria-label="Duplicate">${ic('copy')}</button>
        <button class="ib" data-p="front" aria-label="Bring to front">${ic('front')}</button>
        <button class="ib" data-p="del" aria-label="Delete">${ic('trash')}</button></div>` : ''}`;
  }
  $('#propbar').addEventListener('click', (e) => {
    const c = e.target.closest('[data-c]');
    const p = e.target.closest('[data-p]');
    const el = ed.getSel();
    if (c) {
      const hex = c.dataset.c;
      if (el) { ed.updateSel({ color: hex }); ed.commitSel(); }
      else if (ed.tool === 'text') ed.style.textColor = hex;
      else ed.style.color = hex;
      updateProps();
    } else if (p) {
      const a = p.dataset.p;
      if (a === 'edit') ed.editSelectedText();
      else if (a === 'bold') { ed.updateSel({ bold: !el.bold }); ed.commitSel(); updateProps(); }
      else if (a === 'flip') ed.flipBrace();
      else if (a === 'dup') ed.duplicateSel();
      else if (a === 'front') ed.toFront();
      else if (a === 'del') ed.deleteSel();
    }
  });
  $('#propbar').addEventListener('input', (e) => {
    if (e.target.id !== 'rng') return;
    const v = Number(e.target.value);
    const el = ed.getSel();
    const isText = el ? el.type === 'text' : ed.tool === 'text';
    if (el) ed.updateSel(isText ? { size: v } : { sw: v });
    else if (isText) ed.style.size = v;
    else ed.style.sw = v;
  });
  $('#propbar').addEventListener('change', (e) => { if (e.target.id === 'rng' && ed.getSel()) ed.commitSel(); });

  /* top bar + tools */
  $('#ptitle').addEventListener('input', (e) => { page.title = e.target.value; if (!draft) { page.updated = Date.now(); clearTimeout(S.saveT); S.saveT = setTimeout(() => db.put('pages', snap()), 400); S.dirty = true; } });
  document.querySelector('.toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (b) ed.setTool(TOOL_MAP[b.dataset.t] || b.dataset.t);
  });
  app.onclick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'back') history.back();
    else if (a === 'undo') ed.undo();
    else if (a === 'redo') ed.redo();
    else if (a === 'zin') ed.setZoom(ed.zoom * 1.25);
    else if (a === 'zout') ed.setZoom(ed.zoom / 1.25);
    else if (a === 'fit') ed.fit();
    else if (a === 'bm') {
      page.bookmark = !page.bookmark;
      b.setAttribute('aria-pressed', String(page.bookmark));
      b.classList.toggle('on', page.bookmark);
      if (!draft) { await db.put('pages', snap()); }
      toast(page.bookmark ? 'Bookmarked' : 'Bookmark removed');
    } else if (a === 'photo') {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      b.lastChild.textContent = on ? ' Hide photo' : ' Show photo';
      ed.setShowRef(on);
    } else if (a === 'discard') history.back();
    else if (a === 'add') await addDraft();
    else if (a === 'menu') editorMenu();
  };

  async function addDraft() {
    const nb = await db.get('notebooks', page.notebookId);
    page.updated = Date.now();
    page.thumb = await makeThumb(page, assets);
    await db.put('pages', snap());
    nb.pageIds.push(page.id);
    nb.updated = Date.now();
    await db.put('notebooks', nb);
    S.dirty = false;
    destroy();
    toast('Page added to ' + nb.name);
    S.onBack = () => parent(true);
    history.back(); // return to the notebook view
  }

  function editorMenu() {
    const items = [];
    if (refSrc && !draft) items.push({ icon: 'eye', label: ed.showRef ? 'Hide original photo' : 'Show original photo', fn: () => ed.setShowRef(!ed.showRef) });
    items.push(
      { icon: 'download', label: 'Save this page as an image', fn: async () => { const c = await rasterPage(page, assets, 2, 'image/png'); c.toBlob((bl) => download(bl, safeName(page.title || 'page') + '.png'), 'image/png'); } }
    );
    if (!draft) items.push({ icon: 'trash', label: 'Delete this page', danger: true, fn: async () => {
      if (!(await confirmBox('Delete this page?', 'This cannot be undone.'))) return;
      const nb = await db.get('notebooks', page.notebookId);
      nb.pageIds = nb.pageIds.filter((x) => x !== page.id);
      await db.put('notebooks', nb);
      await deletePageData(page);
      S.dirty = false;
      destroy();
      S.onBack = () => parent(true);
      history.back();
    } });
    sheet('Page', items);
  }
}

/* ======================= BOOKMARKS (all notebooks) ======================= */
async function renderBookmarks(fromPop) {
  enter(!fromPop, () => renderHome(true));
  const nbs = new Map((await db.all('notebooks')).map((n) => [n.id, n]));
  const pages = (await db.all('pages')).filter((p) => p.bookmark && nbs.has(p.notebookId)).sort((a, b) => b.updated - a.updated);
  app.innerHTML = `
    <header class="topbar"><button class="ib" data-a="back" aria-label="Back">${ic('back')}</button><h1>Bookmarks</h1></header>
    <main>${pages.length
      ? `<div class="grid">${pages.map((p) => { const nb = nbs.get(p.notebookId); const n = nb.pageIds.indexOf(p.id) + 1; return `
        <div class="pg"><button class="pg-open" data-open="${p.id}" aria-label="Open ${esc(nb.name)} page ${n}">${p.thumb ? `<img alt="" src="${p.thumb}">` : ''}</button>
        <div class="pg-bar"><span class="lbl">${esc(nb.name)} · ${n}${p.title ? ' · ' + esc(p.title) : ''}</span></div></div>`; }).join('')}</div>`
      : `<div class="empty">${ic('star', 52)}<h2>No bookmarks yet</h2><p>Open a page and tap the star at the top to bookmark it.</p></div>`}</main>`;
  app.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.a === 'back') return history.back();
    if (t.dataset.open) {
      const p = pages.find((x) => x.id === t.dataset.open);
      S.nb = nbs.get(p.notebookId);
      openEditor(p, { parent: (pop) => renderBookmarks(pop) });
    }
  };
}

/* ======================= PDF export ======================= */
async function exportPDF(nb) {
  const b = busy('Making your PDF…');
  try {
    const pages = await orderedPages(nb);
    if (!pages.length) { b.hide(); return toast('This notebook has no pages yet'); }
    const { PDFDocument } = window.PDFLib;
    const doc = await PDFDocument.create();
    let i = 0;
    for (const p of pages) {
      i++;
      b.set(`Page ${i} of ${pages.length}…`);
      const assets = await loadAssets(p);
      const c = await rasterPage(p, assets, 1.6);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      const img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const pw = 595, ph = (595 * p.h) / p.w;
      doc.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
    }
    doc.setTitle(nb.name);
    const bytes = await doc.save();
    b.hide();
    download(new Blob([bytes], { type: 'application/pdf' }), safeName(nb.name) + '.pdf');
    toast('PDF saved');
  } catch (e) {
    b.hide();
    toast('Could not make the PDF: ' + (e.message || e));
  }
}

/* ======================= SETTINGS + BACKUP ======================= */
function openSettings() {
  const s = S.settings;
  const m = modal(`
    <h2>Settings</h2>
    <label for="s-key">Gemini API key (free)</label>
    <input id="s-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your key here">
    <p class="note">Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>. It is saved only on this device.</p>
    <label for="s-model">AI model</label>
    <input id="s-model" type="text" spellcheck="false">
    <p class="note">If a model stops being free or is renamed, the app automatically tries other free ones.</p>
    <label class="check"><input id="s-black" type="checkbox"><span>Type all text in black<br><small class="note">Arrows, circles and braces stay colored.</small></span></label>
    <label class="check"><input id="s-typo" type="checkbox"><span>Let the AI fix obvious spelling typos<br><small class="note">Off keeps your wording exactly as written.</small></span></label>
    <div class="row" style="justify-content:flex-start"><button class="btn" data-a="test">Test my key</button><span id="s-msg" class="note" style="align-self:center"></span></div>
    <hr>
    <h2>Backup</h2>
    <p>Your notes are stored on this device only. Save a backup file now and then, and keep it in Google Drive or email it to yourself.</p>
    <div class="row" style="justify-content:flex-start"><button class="btn" data-a="export">${ic('download', 18)} Save backup</button><button class="btn" data-a="import">Restore backup</button></div>
    <p class="note">Privacy: photos you read with the free Gemini key are sent to Google, and Google’s free tier terms allow using that data to improve its products. Don’t use it for private documents.</p>
    <div class="row"><button class="btn" data-a="close">Close</button><button class="btn primary" data-a="save">Save</button></div>`);
  m.q('#s-key').value = s.apiKey || '';
  m.q('#s-model').value = s.model || DEFAULT_MODEL;
  m.q('#s-black').checked = s.typedBlack !== false;
  m.q('#s-typo').checked = !!s.fixTypos;
  const read = () => ({ apiKey: m.q('#s-key').value.trim(), model: m.q('#s-model').value.trim() || DEFAULT_MODEL, typedBlack: m.q('#s-black').checked, fixTypos: m.q('#s-typo').checked });
  m.el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    const act = a.dataset.a;
    if (act === 'close') m.close();
    else if (act === 'save') { Object.assign(S.settings, read()); saveSettings(); m.close(); toast('Settings saved'); }
    else if (act === 'test') {
      const msg = m.q('#s-msg');
      msg.className = 'note';
      msg.textContent = 'Testing…';
      try { const model = await testKey(read()); msg.textContent = 'Works with ' + model; }
      catch (err) { msg.className = 'err'; msg.textContent = err.message; }
    } else if (act === 'export') {
      const data = await exportAll();
      download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'ink-notes-backup-' + new Date().toISOString().slice(0, 10) + '.json');
      toast('Backup saved');
    } else if (act === 'import') $('#file-backup').click();
  });
}

async function doImportBackup(file) {
  if (!file) return;
  try {
    const r = await importAll(JSON.parse(await file.text()));
    toast(`Restored ${r.notebooks} notebook(s), ${r.pages} page(s)`);
    document.querySelectorAll('.scrim').forEach((x) => x.remove());
    renderHome();
  } catch (e) { toast('Could not restore: ' + (e.message || e)); }
}

/* ======================= start ======================= */
function wireInputs() {
  const reset = (inp, fn) => inp.addEventListener('change', async () => { const f = [...inp.files]; inp.value = ''; if (f.length) await fn(f); });
  reset($('#file-camera'), (f) => aiFromFile(f[0]));
  reset($('#file-gallery'), (f) => aiFromFile(f[0]));
  reset($('#file-import'), (f) => importFiles(f));
  reset($('#file-backup'), (f) => doImportBackup(f[0]));
}

wireInputs();
renderHome();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__ink = { S, db }; // handy for debugging in the browser console
