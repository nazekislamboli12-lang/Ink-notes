// db.js — all notes live on your device in IndexedDB (free, no account needed)

const DB_NAME = 'inknotes';
let dbp;

function open() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('notebooks', { keyPath: 'id' });
        const p = d.createObjectStore('pages', { keyPath: 'id' });
        p.createIndex('nb', 'notebookId');
        d.createObjectStore('assets', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    try { out = fn(s); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(out && 'result' in out ? out.result : out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const db = {
  all: (store) => run(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => run(store, 'readonly', (s) => s.get(id)),
  put: (store, val) => run(store, 'readwrite', (s) => s.put(val)),
  del: (store, id) => run(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => run(store, 'readwrite', (s) => s.clear()),
  pagesOf: (nbId) => run('pages', 'readonly', (s) => s.index('nb').getAll(nbId)),
};

/* assets (photos): stored as data URLs */
export async function saveAsset(id, dataUrl) {
  await db.put('assets', { id, data: dataUrl });
  return id;
}
export async function getAsset(id) {
  const a = await db.get('assets', id);
  return a ? a.data : null;
}
export async function loadAssets(page) {
  const m = new Map();
  for (const id of [page.bg, page.ref]) {
    if (id && !m.has(id)) {
      const d = await getAsset(id);
      if (d) m.set(id, d);
    }
  }
  return m;
}

/* backup / restore */
export async function exportAll() {
  const [notebooks, pages, assets] = await Promise.all([db.all('notebooks'), db.all('pages'), db.all('assets')]);
  return { app: 'inknotes', version: 1, exported: new Date().toISOString(), notebooks, pages, assets };
}
export async function importAll(data) {
  if (!data || data.app !== 'inknotes') throw new Error('This is not an Ink Notes backup file.');
  for (const a of data.assets || []) await db.put('assets', a);
  for (const p of data.pages || []) await db.put('pages', p);
  for (const nb of data.notebooks || []) await db.put('notebooks', nb);
  return { notebooks: (data.notebooks || []).length, pages: (data.pages || []).length };
}
