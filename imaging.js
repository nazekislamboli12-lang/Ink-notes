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
