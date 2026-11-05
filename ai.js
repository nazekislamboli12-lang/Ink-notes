// ai.js — reads a photo of handwritten notes with Google's Gemini API (free key) and turns the answer
// into editable page elements: text (with rotation + ink color), arrows, curves, circles, braces,
// and illustrations (cut out of the photo so they are copied exactly).

import { uid, measureText } from './editor.js';
import { cropClean } from './imaging.js';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACKS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

export class AIError extends Error {
  constructor(message, fatal = false) { super(message); this.fatal = fatal; }
}

function buildPrompt(settings) {
  return `You convert a photo of handwritten notes (a whiteboard or paper) into elements of an editable digital page. Reproduce the page layout as EXACTLY as you can.

COORDINATES: every number is on a 0-1000 grid laid over the photo. x goes across the width, y goes down the height, (0,0) is the top-left corner and (1000,1000) the bottom-right. Boxes are [ymin, xmin, ymax, xmax]. Points are [y, x].

Reply with ONLY JSON, no other text: {"page_title": "short title or empty", "elements": [ ... ]}

ELEMENT TYPES
1. {"type":"text","box_2d":[ymin,xmin,ymax,xmax],"text":"...","color":"#rrggbb","rotation":0,"unsure":false}
   - box_2d = a tight box around the visible handwriting. Give one element per separate label or line group. Lines stacked in the same block share one element, with \\n between the lines.
   - rotation = clockwise degrees needed to make the text read normally: 0 for normal horizontal writing; 90 for a word written vertically that reads from top to bottom; 270 for a word written vertically that reads from bottom to top; 180 for upside down; any other angle for slanted writing. box_2d is still the visible area of the writing as it appears in the photo.
   - color = the real ink color you see, as a hex code (blue ink, red ink, green ink, black ink...). Never leave it as a default guess.
2. {"type":"arrow","from":[y,x],"to":[y,x],"color":"#rrggbb"}  a straight arrow, the head is at "to".
3. {"type":"line","from":[y,x],"to":[y,x],"color":"#rrggbb"}  a straight line with no head.
4. {"type":"curve","points":[[y,x],[y,x],...],"head":true,"color":"#rrggbb"}  a curved or bent arrow, a bracket, a loop or a squiggle: 4 to 14 points along the stroke in drawing order. head=true if the stroke ends with an arrow head.
5. {"type":"ellipse","box_2d":[...],"color":"#rrggbb"}  a circle or oval drawn around something.
6. {"type":"rect","box_2d":[...],"color":"#rrggbb"}  a drawn box.
7. {"type":"brace","box_2d":[...],"orient":"left","color":"#rrggbb"}  a curly brace; orient is the direction the pointed tip faces: left, right, up or down.
8. {"type":"drawing","box_2d":[...],"description":"short description"}  ANY pictorial illustration, diagram, sketch or figure: a drawn plant, flower, leaf, cell, organ, animal, microscope view, graph, map and so on. The box must tightly contain the WHOLE drawing, including its own internal lines, shading and the pointer lines that go to its labels. Do NOT also output the drawing's internal strokes as arrows, lines or curves. The words that label a drawing are separate text elements (they are cut out of the drawing automatically).
   Simple arrows, circles, boxes and braces that connect or mark words are NOT drawings: use types 2-7 for those.

RULES
- Transcribe exactly what is written. Do not rephrase, summarize, expand, reorder, translate or add anything. Keep the writer's wording, capitalization and punctuation.${
    settings.fixTypos
      ? ' You may fix clear spelling typos only (never change meaning, numbers or wording).'
      : ' Do not correct spelling or dates.'
  }
- Be exhaustive: include every piece of writing, every arrow, circle, brace and every illustration that belongs to the notes.
- Positions and sizes must match the photo closely.
- Ignore everything that is not part of the notes: the wall, screws, glare, pictures or stickers stuck below the board, signatures and doodles by someone else.
- If a word is hard to read, give your best reading and set "unsure": true on that text element.
- Write text in the same language and script as the photo. Check marks and crosses can be text such as "✓" and "✗".`;
}

function parseJSON(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (e) { /* try to find the object */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new AIError('The AI answer could not be understood. Try again.');
}

async function post(model, key, body, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(`${ENDPOINT}${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new AIError('The AI took too long. Try again.');
    throw new AIError('Could not reach the AI. Check your internet connection.');
  } finally {
    clearTimeout(timer);
  }
}

function friendly(status, msg) {
  if (status === 400 && /api key/i.test(msg)) return new AIError('Your API key is not valid. Check it in Settings.', true);
  if (status === 429) return new AIError('The free AI limit is reached for now (too many photos too fast, or the daily limit). Wait a minute, or try again later.');
  if (status === 403) return new AIError('This key is not allowed to use that model. ' + msg);
  if (status === 404) return new AIError('That model name is not available. Change it in Settings.');
  return new AIError(`AI error (${status}): ${msg}`);
}

export async function readNotes(dataUrl, settings, onStatus) {
  const key = (settings.apiKey || '').trim();
  if (!key) throw new AIError('Add your free Gemini API key in Settings first.', true);
  const m = /^data:(.+?);base64,(.*)$/.exec(dataUrl);
  if (!m) throw new AIError('Could not read that photo.', true);
  const body = {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(settings) }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };
  const first = (settings.model || DEFAULT_MODEL).trim();
  const models = [first, ...FALLBACKS.filter((x) => x !== first)];
  let lastErr = null;
  for (const model of models) {
    onStatus && onStatus(`Reading your notes with ${model}…`);
    try {
      const res = await post(model, key, body, 150000);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = friendly(res.status, (json.error && json.error.message) || res.statusText);
        if (err.fatal) throw err;
        lastErr = err;
        continue;
      }
      const parts = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
      const text = (parts || []).map((p) => p.text || '').join('');
      if (!text) { lastErr = new AIError('The AI returned nothing. Try again.'); continue; }
      return { data: parseJSON(text), model };
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
    }
  }
  throw lastErr || new AIError('The AI could not read this photo.');
}

export async function testKey(settings) {
  const key = (settings.apiKey || '').trim();
  if (!key) throw new AIError('Type your key first.');
  const model = (settings.model || DEFAULT_MODEL).trim();
  const res = await post(model, key, { contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }] }, 30000);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw friendly(res.status, (json.error && json.error.message) || res.statusText);
  return model;
}

/* ---------- turn the AI answer into page elements ---------- */

const NAMED = {
  black: '#1a1a1a', blue: '#1f55d6', lightblue: '#3db8e8', red: '#d93a3a', green: '#2faa6a', purple: '#8b5cf6',
  orange: '#f08a24', brown: '#8a5a2b', pink: '#e0558f', yellow: '#d4a600', gray: '#666666', grey: '#666666',
};
function color(c, fallback = '#1a1a1a') {
  if (typeof c !== 'string') return fallback;
  const s = c.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return NAMED[s.replace(/[\s_-]/g, '')] || fallback;
}
const num = (v, d = NaN) => (typeof v === 'number' && isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function box(b) {
  if (!Array.isArray(b) || b.length < 4) return null;
  const [y1, x1, y2, x2] = b.map(Number);
  if (![y1, x1, y2, x2].every(isFinite)) return null;
  const ymin = clamp(Math.min(y1, y2), 0, 1000), ymax = clamp(Math.max(y1, y2), 0, 1000);
  const xmin = clamp(Math.min(x1, x2), 0, 1000), xmax = clamp(Math.max(x1, x2), 0, 1000);
  if (xmax - xmin < 1 || ymax - ymin < 1) return null;
  return { x: xmin, y: ymin, w: xmax - xmin, h: ymax - ymin };
}
function pt(p) {
  if (!Array.isArray(p) || p.length < 2) return null;
  const y = num(+p[0]), x = num(+p[1]);
  return isFinite(x) && isFinite(y) ? { x: clamp(x, 0, 1000), y: clamp(y, 0, 1000) } : null;
}

function textElement(e, b, page, settings) {
  const sx = page.w / 1000, sy = page.h / 1000;
  const W = b.w * sx, H = b.h * sy;
  let rot = num(+e.rotation, 0) % 360;
  if (rot > 180) rot -= 360;
  if (rot <= -180) rot += 360;
  const text = String(e.text == null ? '' : e.text);
  const lines = text.split('\n').length;
  const th = (a) => Math.abs(a * Math.PI / 180);
  const c = Math.abs(Math.cos(th(rot))), s = Math.abs(Math.sin(th(rot)));
  let L, T; // run length and thickness of the unrotated text block
  if (Math.abs(c * c - s * s) > 0.3) {
    L = (W * c - H * s) / (c * c - s * s);
    T = (H * c - W * s) / (c * c - s * s);
  } else { L = Math.hypot(W, H) * 0.8; T = Math.hypot(W, H) * 0.25; }
  if (!(L > 4) || !(T > 4)) { L = Math.max(W, H); T = Math.min(W, H); }
  const sizeH = (T / lines) / 1.22;
  const m100 = measureText(text, 100, false);
  const sizeW = (100 * L) / Math.max(1, m100.w);
  const size = clamp(Math.min(sizeH * 1.06, sizeW), 10, 160);
  const m = measureText(text, size, false);
  const cx = b.x * sx + W / 2, cy = b.y * sy + H / 2;
  return {
    id: uid(), type: 'text', x: cx - m.w / 2, y: cy - m.h / 2, text, size, bw: m.w, bh: m.h,
    rot: Math.abs(rot) < 1 ? 0 : rot,
    color: settings.forceBlack ? '#1a1a1a' : color(e.color), bold: false, flag: !!e.unsure,
  };
}

export async function buildElements(data, page, settings, photo) {
  // photo = {dataUrl, w, h} (the picture that was sent to the AI)
  const sx = page.w / 1000, sy = page.h / 1000;
  const list = Array.isArray(data && data.elements) ? data.elements : [];
  const back = [], front = [], newAssets = [];
  const textBoxes = []; // in 0-1000 units, to cut labels out of the drawings
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const col = color(e.color, '#3db8e8');
    switch (e.type) {
      case 'text': {
        const b = box(e.box_2d);
        if (!b || !String(e.text == null ? '' : e.text).trim()) break;
        front.push(textElement(e, b, page, settings));
        textBoxes.push(b);
        break;
      }
      case 'arrow':
      case 'line': {
        const a = pt(e.from), z = pt(e.to);
        if (!a || !z) break;
        front.push({ id: uid(), type: e.type, x1: a.x * sx, y1: a.y * sy, x2: z.x * sx, y2: z.y * sy, color: col, sw: 3.5 });
        break;
      }
      case 'curve': {
        const pts = (Array.isArray(e.points) ? e.points : []).map(pt).filter(Boolean);
        if (pts.length < 2) break;
        front.push({ id: uid(), type: 'pen', pts: pts.map((p) => [p.x * sx, p.y * sy]), color: col, sw: 3.5, head: !!e.head });
        break;
      }
      case 'ellipse':
      case 'rect':
      case 'brace': {
        const b = box(e.box_2d);
        if (!b) break;
        const el = { id: uid(), type: e.type, x: b.x * sx, y: b.y * sy, w: b.w * sx, h: b.h * sy, color: col, sw: 3.5 };
        if (e.type === 'brace') {
          const o = ['left', 'right', 'up', 'down'].includes(e.orient) ? e.orient : el.h >= el.w ? 'left' : 'down';
          el.orient = o;
        }
        front.push(el);
        break;
      }
      case 'drawing': {
        const b = box(e.box_2d);
        if (!b || !photo) break;
        // pad a little
        const px = 6;
        const pad = { x: Math.max(0, b.x - 5), y: Math.max(0, b.y - 5) };
        pad.w = Math.min(1000, b.x + b.w + 5) - pad.x;
        pad.h = Math.min(1000, b.y + b.h + 5) - pad.y;
        back.push({ pad, desc: String(e.description || '') });
        break;
      }
      default:
        break;
    }
  }
  const images = [];
  for (const d of back) {
    const kx = photo.w / 1000, ky = photo.h / 1000;
    const crop = { x: d.pad.x * kx, y: d.pad.y * ky, w: d.pad.w * kx, h: d.pad.h * ky };
    const whites = textBoxes
      .filter((t) => t.x < d.pad.x + d.pad.w && t.x + t.w > d.pad.x && t.y < d.pad.y + d.pad.h && t.y + t.h > d.pad.y)
      .map((t) => ({ x: t.x * kx - 4, y: t.y * ky - 4, w: t.w * kx + 8, h: t.h * ky + 8 }));
    try {
      const r = await cropClean(photo.dataUrl, crop, whites);
      const aId = uid(), rId = uid();
      newAssets.push({ id: aId, data: r.clean }, { id: rId, data: r.raw });
      images.push({ id: uid(), type: 'image', x: d.pad.x * sx, y: d.pad.y * sy, w: d.pad.w * sx, h: d.pad.h * sy, asset: aId, raw: rId, clean: true, rot: 0, desc: d.desc });
    } catch (err) { /* skip this drawing */ }
  }
  return { elements: [...images, ...front], assets: newAssets };
}
