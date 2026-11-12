// Stage 5 (D-157…D-160): the wall view's math. Gate: size within 2% on measured test photos; the AR model's front is
// the record's size in meters.
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {describe, expect, it} from 'vitest';

const g: any = {};
new Function('globalThis', readFileSync('public/site/wall-core.js', 'utf8'))(g);
const W = g.StudioWallCore;

/** A test photo: a wall with a tape-measure bar of `refIn` inches drawn `ppi` pixels per inch, from (x0, y0). */
async function testPhoto(ppi: number, refIn: number, x0: number, y0: number, angleDeg = 0) {
  const w = 1600,
    h = 1200;
  const len = refIn * ppi,
    a = (angleDeg * Math.PI) / 180;
  const x1 = x0 + len * Math.cos(a),
    y1 = y0 + len * Math.sin(a);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#d8d2c4"/>
    <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#c33" stroke-width="6"/></svg>`;
  const jpeg = await sharp(Buffer.from(svg)).jpeg().toBuffer();
  return {
    jpeg,
    ends: [
      {x: x0, y: y0},
      {x: x1, y: y1},
    ],
  };
}

/** Finds the red bar's two ends in the decoded photo, as a visitor's taps would (the extreme red pixels). */
async function findEnds(jpeg: Buffer) {
  const {data, info} = await sharp(jpeg).raw().toBuffer({resolveWithObject: true});
  const red: {x: number; y: number}[] = [];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i]! > 150 && data[i + 1]! < 90 && data[i + 2]! < 90) red.push({x, y});
    }
  // The two red pixels farthest apart along the bar.
  const c = red.reduce((s, p) => ({x: s.x + p.x / red.length, y: s.y + p.y / red.length}), {x: 0, y: 0});
  let far = red[0]!;
  for (const p of red) if (Math.hypot(p.x - c.x, p.y - c.y) > Math.hypot(far.x - c.x, far.y - c.y)) far = p;
  let other = red[0]!;
  for (const p of red)
    if (Math.hypot(p.x - far.x, p.y - far.y) > Math.hypot(other.x - far.x, other.y - far.y)) other = p;
  return [far, other] as const;
}

describe('the photo way: true size from two taps', () => {
  const cases = [
    {ppi: 12, refIn: 36, x0: 200, y0: 900, angle: 0, piece: [40, 30]},
    {ppi: 7.5, refIn: 80, x0: 300, y0: 100, angle: 90, piece: [48, 60]},
    {ppi: 20, refIn: 11, x0: 500, y0: 600, angle: 30, piece: [16, 20]},
    {ppi: 9, refIn: 60, x0: 100, y0: 1100, angle: -12, piece: [30, 40]},
  ];
  for (const k of cases)
    it(`${k.refIn} in reference at ${k.ppi} px/in (${k.angle}°): the piece is within 2%`, async () => {
      const {jpeg} = await testPhoto(k.ppi, k.refIn, k.x0, k.y0, k.angle);
      const [a, b] = await findEnds(jpeg);
      const inPerPx = W.calibrate(a, b, k.refIn);
      const {w, h} = W.placed(k.piece[0], k.piece[1], inPerPx);
      expect(Math.abs(w / (k.piece[0]! * k.ppi) - 1)).toBeLessThan(0.02);
      expect(Math.abs(h / (k.piece[1]! * k.ppi) - 1)).toBeLessThan(0.02);
    });

  it('a tap off by 4 px on a short reference still lands within 2% when the reference spans 400 px', () => {
    const inPerPx = W.calibrate({x: 100, y: 100}, {x: 504, y: 100}, 36); // 400 px drawn, 4 px slip
    expect(Math.abs(W.placed(36, 36, inPerPx).w / 400 - 1)).toBeLessThan(0.02);
  });

  it('refuses a missing length and two taps on the same spot', () => {
    expect(() => W.calibrate({x: 0, y: 0}, {x: 100, y: 0}, 0)).toThrow('length');
    expect(() => W.calibrate({x: 0, y: 0}, {x: 2, y: 2}, 10)).toThrow('close');
  });
});

describe('the piece’s size from the page', () => {
  it('reads inches and centimetres; no depth is 1.5 in (D-159); no size is none', () => {
    expect(W.pieceSize({w: '40', h: '30', d: '2', unit: 'in'})).toEqual({widthIn: 40, heightIn: 30, depthIn: 2});
    const cm = W.pieceSize({w: '101.6', h: '76.2', d: '', unit: 'cm'});
    expect(cm.widthIn).toBeCloseTo(40, 6);
    expect(cm.heightIn).toBeCloseTo(30, 6);
    expect(cm.depthIn).toBe(1.5);
    expect(W.pieceSize({w: '', h: '30', unit: 'in'})).toBeNull();
  });
  it('the sides take the picture’s edge colour', () => {
    const w = 10,
      h = 10,
      px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) px.set([0x20, 0x40, 0x60, 255], i * 4);
    expect(W.edgeColor(px, w, h)).toBe('#204060');
  });
});

/** Reads a stored ZIP: names, payload offsets, CRCs. */
function unzip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset);
  const out: {name: string; at: number; data: Uint8Array; crc: number}[] = [];
  let p = 0;
  while (v.getUint32(p, true) === 0x04034b50) {
    const size = v.getUint32(p + 18, true),
      n = v.getUint16(p + 26, true),
      extra = v.getUint16(p + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 30, p + 30 + n));
    const at = p + 30 + n + extra;
    out.push({name, at, data: bytes.subarray(at, at + size), crc: v.getUint32(p + 14, true)});
    p = at + size;
  }
  return out;
}

describe('the live way: the USDZ AR Quick Look opens', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9]);
  const bytes = W.usdz({widthIn: 40, heightIn: 30, depthIn: 1.5, color: '#747474'}, jpeg, png);
  const files = unzip(bytes);

  it('is a stored ZIP, the layer first, every payload on a 64-byte boundary, CRCs right', () => {
    expect(files.map(f => f.name)).toEqual(['model.usda', 'art.jpeg', 'shadow.png']);
    for (const f of files) {
      expect(f.at % 64).toBe(0);
      expect(f.crc).toBe(W.crc32(f.data));
    }
    expect(files[1]!.data).toEqual(jpeg);
  });

  it('the front is the piece’s true size in meters (within 0.1%), on a vertical plane, half an inch off the wall', () => {
    const usda = new TextDecoder().decode(files[0]!.data);
    expect(usda).toContain('metersPerUnit = 1');
    expect(usda).toContain('preliminary:planeAnchoring:alignment = "vertical"');
    const front = /def Mesh "Front"[\s\S]*?point3f\[\] points = \[(.*?)\]\n/.exec(usda)![1]!;
    const pts = [...front.matchAll(/\(([^)]+)\)/g)].map(m => m[1]!.split(',').map(Number));
    const xs = pts.map(p => p[0]!),
      zs = pts.map(p => p[2]!),
      ys = pts.map(p => p[1]!);
    const width = Math.max(...xs) - Math.min(...xs),
      height = Math.max(...zs) - Math.min(...zs);
    expect(Math.abs(width / (40 * 0.0254) - 1)).toBeLessThan(0.001);
    expect(Math.abs(height / (30 * 0.0254) - 1)).toBeLessThan(0.001);
    expect(ys.every(y => Math.abs(y - 2 * 0.0254) < 1e-9)).toBe(true); // 1.5 in deep + 0.5 in gap
  });

  it('without a shadow there is no shadow file or mesh', () => {
    const f = unzip(W.usdz({widthIn: 10, heightIn: 10, depthIn: 1, color: '#ffffff'}, jpeg, null));
    expect(f.map(x => x.name)).toEqual(['model.usda', 'art.jpeg']);
    expect(new TextDecoder().decode(f[0]!.data)).not.toContain('Shadow');
  });
});
