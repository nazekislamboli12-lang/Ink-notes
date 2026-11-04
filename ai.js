// ai.js — reads a photo of handwritten notes with Google's Gemini API (free key) and
// turns the answer into editable page elements.

import { uid } from './editor.js';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACKS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

export class AIError extends Error {
  constructor(message, fatal = false) { super(message); this.fatal = fatal; }
}

function buildPrompt(settings) {
  return `You convert a photo of handwritten notes (a whiteboard or paper) into drawing elements for an editable digital page.

COORDINATES: x and y are both numbers from 0 to 1000. (0,0) is the top-left corner of the photo and (1000,1000) the bottom-right. x is measured across the photo's width and y down its height.

Reply with ONLY JSON, no other text, shaped like:
{"page_title": "short title or empty string", "elements": [ ... ]}

ELEMENT TYPES
- {"type":"text","x":..,"y":..,"h":..,"text":"...","color":"black","bold":false,"unsure":false}
    x,y = top-left corner of the written text. h = height of ONE line of handwriting (same 0-1000 vertical units).
    Put words that sit on the same line together. Use \\n between stacked lines of the same block. Keep separate labels as separate elements so each stays where it was written.
- {"type":"arrow","x1":..,"y1":..,"x2":..,"y2":..,"color":"blue"}   (x2,y2 is the arrow head)
- {"type":"line","x1":..,"y1":..,"x2":..,"y2":..,"color":"blue"}   (no arrow head)
- {"type":"ellipse","x":..,"y":..,"w":..,"h":..,"color":"blue"}    (a circle/oval drawn around words; give its bounding box)
- {"type":"rect","x":..,"y":..,"w":..,"h":..,"color":"blue"}       (a drawn box)
- {"type":"brace","x":..,"y":..,"w":..,"h":..,"orient":"left","color":"blue"}   (a curly brace; its bounding box; orient = the direction the brace's point faces: left, right, up or down)
Colors allowed: black, blue, red, green, purple, orange. Use the ink color you see.

RULES
- Transcribe exactly what is written. Do not rephrase, summarize, expand, reorder, translate or add anything. Keep the writer's wording, capitalization and punctuation.${
    settings.fixTypos
      ? ' You may fix clear spelling typos only (never change meaning, numbers or wording).'
      : ' Do not correct spelling or dates.'
  }
- Keep the layout faithful: similar positions, sizes and groupings as in the photo.
- Draw every arrow, circle, brace, box and line that is part of the notes. Check marks and crosses can be text elements such as "✓" and "✗".
- Ignore everything that is not part of the notes: the wall, screws, glare, pictures or stickers stuck below the board, signatures and doodles.
- If a word is hard to read, give your best reading and set "unsure": true for that text element.
- Write text in the same language and script as the photo.`;
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
      const res = await post(model, key, body, 120000);
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

const INK = {
  black: '#1a1a1a', blue: '#3db8e8', red: '#d93a3a', green: '#2faa6a', purple: '#8b5cf6', orange: '#f08a24',
};
const TEXT_BLUE = '#1f55d6';
const num = (v, d = NaN) => (typeof v === 'number' && isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function buildElements(data, page, settings) {
  const sx = page.w / 1000, sy = page.h / 1000;
  const out = [];
  const list = Array.isArray(data && data.elements) ? data.elements : [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const cname = String(e.color || 'black').toLowerCase();
    const shapeColor = INK[cname] || INK.black;
    switch (e.type) {
      case 'text': {
        const x = num(e.x), y = num(e.y);
        const text = String(e.text == null ? '' : e.text);
        if (!isFinite(x) || !isFinite(y) || !text.trim()) break;
        const h = num(e.h, 35);
        const color = settings.typedBlack === false ? (cname === 'blue' ? TEXT_BLUE : shapeColor) : INK.black;
        out.push({
          id: uid(), type: 'text', x: clamp(x * sx, 0, page.w), y: clamp(y * sy, 0, page.h), text,
          size: clamp(h * sy * 0.8, 14, 110), color, bold: !!e.bold, flag: !!e.unsure,
        });
        break;
      }
      case 'arrow':
      case 'line': {
        const [x1, y1, x2, y2] = [num(e.x1), num(e.y1), num(e.x2), num(e.y2)];
        if (![x1, y1, x2, y2].every(isFinite)) break;
        out.push({ id: uid(), type: e.type, x1: x1 * sx, y1: y1 * sy, x2: x2 * sx, y2: y2 * sy, color: shapeColor, sw: 3.5 });
        break;
      }
      case 'ellipse':
      case 'rect':
      case 'brace': {
        const [x, y, w, h] = [num(e.x), num(e.y), num(e.w), num(e.h)];
        if (![x, y, w, h].every(isFinite) || w <= 0 || h <= 0) break;
        const el = { id: uid(), type: e.type, x: x * sx, y: y * sy, w: w * sx, h: h * sy, color: shapeColor, sw: 3.5 };
        if (e.type === 'brace') {
          const o = ['left', 'right', 'up', 'down'].includes(e.orient) ? e.orient : el.h >= el.w ? 'left' : 'down';
          el.orient = o;
          if ((o === 'left' || o === 'right') && el.w < 24) { if (o === 'right') el.x -= 24 - el.w; el.w = 24; }
          if ((o === 'up' || o === 'down') && el.h < 24) { if (o === 'down') el.y -= 24 - el.h; el.h = 24; }
        }
        out.push(el);
        break;
      }
      default:
        break;
    }
  }
  return out;
}
