import {describe, expect, it} from 'vitest';
import {parseCaption, parsePage} from '../scripts/import/parse-pages.mjs';
import {cluster, dhashFromGrey, hamming} from '../scripts/import/group.mjs';
import {assemble} from '../scripts/import/assemble.mjs';
import {runImport, type ImportApi, type ImportDeps} from '../src/import/run';
import type {Manifest, ManifestWork} from '../src/import/types';

const card = (id: string, label: string, caption: string, sold = false) =>
  `<div data-i="0"><div class="m-card-img" style="position:relative"><image-slot id="${id}" label="${label}" hires-target="${id}-hi" src="images/${id}.webp"></image-slot>` +
  (sold ? `<div style="position:absolute"><span style="font:500 13px">Sold</span></div>` : '') +
  `</div><div><button><span>i</span></button><span style="x">${label}</span><span style="y">${caption}</span></div></div>`;

describe('page parser', () => {
  it('reads title, size and Sold from an Available card', () => {
    const html = `<section>${card('available-2', 'No. 002', 'Green Horizon, 34 × 48 in', true)}${card('available-3', 'No. 003', '[Title, size, year]')}</section>`;
    const [a, b] = parsePage(html, 'available.html');
    expect(a).toMatchObject({
      id: 'available-2',
      collection: null,
      number: 2,
      title: 'Green Horizon',
      width: 34,
      height: 48,
      sizeUnit: 'in',
      sold: true,
    });
    expect(b).toMatchObject({id: 'available-3', sold: false, caption: '[Title, size, year]'});
    expect(b!.title).toBeUndefined();
  });
  it('treats the page placeholder as nothing and handles missing units and nbsp', () => {
    expect(parseCaption('[Title, size, year]')).toBeNull();
    expect(parseCaption('Embedded Brass Bar, 16 x 28')).toEqual({title: 'Embedded Brass Bar', width: 16, height: 28});
    expect(parseCaption('Embedded Steel Base, 18 x 27&nbsp;')).toEqual({
      title: 'Embedded Steel Base',
      width: 18,
      height: 27,
    });
    expect(parseCaption('Quiet, 20 × 30 cm, 2024')).toEqual({
      title: 'Quiet',
      width: 20,
      height: 30,
      sizeUnit: 'cm',
      year: 2024,
    });
  });
  it('ignores hidden loader slots and reference slots, and does not leak Sold into the next card', () => {
    const html =
      card('abstract-1', 'No. 001', '[Title, size, year]') +
      card('abstract-2', 'No. 002', '[Title, size, year]') +
      `</section><span>Sold</span><image-slot id="abstract-1-full" shape="rect"></image-slot><image-slot id="ref-2" label="Reference — 2"></image-slot>`;
    const slots = parsePage(html, 'collection-abstract.html');
    expect(slots.map(s => [s.id, s.collection, s.sold])).toEqual([
      ['abstract-1', 'abstract', false],
      ['abstract-2', 'abstract', false],
    ]);
  });
});

describe('grouping', () => {
  const grey = (f: (i: number) => number) => Uint8Array.from({length: 72}, (_, i) => f(i));
  const a = dhashFromGrey(grey(i => (i * 37) % 251));
  const b = dhashFromGrey(grey(i => (i % 9) * 20));
  const file = (path: string, hash: string, width = 100, height = 150, bytes = 10) => ({
    path,
    hash,
    width,
    height,
    bytes,
  });
  it('merges identical hashes and keeps different ones apart', () => {
    expect(hamming(a, b)).toBeGreaterThan(6);
    const c = cluster([file('images/x.webp', a), file('images/x-full.webp', a, 200, 300), file('images/y.webp', b)]);
    expect(c.map(g => g.members.map(m => m.path))).toEqual([
      ['images/x-full.webp', 'images/x.webp'],
      ['images/y.webp'],
    ]);
    expect(c[0]!.reasons).toHaveLength(1);
  });
  it('does not merge when the shape differs, however alike the hash', () => {
    expect(cluster([file('images/x.webp', a), file('images/y.webp', a, 190, 100)])).toHaveLength(2);
  });
  it('assemble keeps the largest file, merges the same piece across pages and takes page text', () => {
    const slots = [
      ...parsePage(card('abstract-7', 'No. 007', '[Title, size, year]'), 'collection-abstract.html'),
      ...parsePage(card('available-1', 'No. 001', 'Green Horizon, 34 × 48 in', true), 'available.html'),
    ];
    const files = [
      file('images/abstract-7.webp', a, 100, 150, 5),
      file('images/abstract-7-full.webp', a, 400, 600, 50),
      file('images/available-1.webp', a, 200, 300, 9),
      file('images/hero.webp', b),
    ];
    const {works, skipped} = assemble({files, slots, sha: 'abc'});
    expect(works).toHaveLength(1);
    expect(works[0]).toMatchObject({
      key: 'abstract-7',
      title: 'Green Horizon',
      titleFrom: 'page',
      collection: 'abstract',
      status: 'sold',
      width: 34,
    });
    expect(works[0]!.source.path).toBe('images/abstract-7-full.webp');
    expect(works[0]!.source.url).toBe(
      'https://raw.githubusercontent.com/yitzhach/IA-ART-Claude-Code/abc/images/abstract-7-full.webp',
    );
    expect(works[0]!.mergedBecause.length).toBeGreaterThan(0);
    expect(skipped.map(s => s.path)).toEqual(['images/hero.webp']);
  });
});

// ---- runImport with a fake studio ----
interface Fake {
  works: Record<string, any>;
  files: number;
  calls: string[];
  api: ImportApi;
  deps: (extra?: Partial<ImportDeps>) => ImportDeps;
}
const mk = (n: number): ManifestWork => ({
  key: `abstract-${n}`,
  title: `Abstract No. ${n}`,
  titleFrom: 'made',
  collection: 'abstract',
  ...(n === 2 ? {status: 'sold' as const, width: 30, height: 40, sizeUnit: 'in' as const} : {}),
  source: {
    path: `images/abstract-${n}.webp`,
    url: `https://x/abstract-${n}.webp`,
    pixels: {width: 1, height: 1},
    bytes: 1,
  },
  alsoFrom: [],
  mergedBecause: [],
  importedFrom: `collection-abstract.html#abstract-${n}`,
});
const manifest = (n: number): Manifest => ({
  sha: 'sha1',
  generatedAt: '',
  works: Array.from({length: n}, (_, i) => mk(i + 1)),
  skipped: [],
  voice: 'Our voice.',
});

function fake(opts: {failKey?: string} = {}): Fake {
  const f: Fake = {works: {}, files: 0, calls: [], api: null as never, deps: null as never};
  let settings = {version: 1, meta: {} as Record<string, unknown>};
  let seq = 0;
  const attached: Record<string, string> = {};
  f.api = {
    async get<T>(path: string) {
      f.calls.push('GET ' + path);
      if (path.startsWith('/artworks?'))
        return {items: Object.values(f.works).map(w => ({...w})), nextCursor: null} as T;
      if (path === '/settings') return structuredClone(settings) as T;
      const id = decodeURIComponent(path.split('/')[2]!);
      return {...f.works[id], images: attached[id] ? [{id: attached[id]}] : []} as T;
    },
    async post<T>(path: string, body?: any) {
      f.calls.push('POST ' + path);
      if (path.includes('publish')) throw new Error('publish must never be called');
      const w = {
        id: 'W' + ++seq,
        version: 1,
        primaryFileId: null,
        description: '',
        palette: body.palette,
        meta: body.meta,
        ...body,
      };
      f.works[w.id] = w;
      return w as T;
    },
    async patch<T>(path: string, body: any, version: number) {
      f.calls.push('PATCH ' + path);
      if (path === '/settings') {
        expect(version).toBe(settings.version);
        settings = {version: settings.version + 1, meta: body.meta};
        return settings as T;
      }
      const id = decodeURIComponent(path.split('/')[2]!);
      expect(version).toBe(f.works[id].version);
      Object.assign(f.works[id], body, {version: version + 1});
      return f.works[id] as T;
    },
  };
  f.deps = (extra = {}) => ({
    manifest: manifest(3),
    drafts: {},
    api: f.api,
    fetchImage: async url => {
      if (opts.failKey && url.includes(opts.failKey)) throw new Error('The old site did not answer.');
      return new Blob([url]);
    },
    prepare: async (_b: Blob, name: string) => ({name, palette: [{hex: '#112233', share: 10000}]}),
    upload: async () => ({id: 'F' + ++f.files}),
    attach: async (fileId: string, artworkId: string) => {
      attached[artworkId] = fileId;
    },
    draft: async (id: string, prepared?: any) => {
      f.calls.push('DRAFT ' + id + (prepared ? ' prepared' : ''));
      f.works[id].meta = {...f.works[id].meta, draft: {at: 'now'}};
      if (prepared) f.works[id].description = prepared.description ?? '';
      return 'started';
    },
    ...extra,
  });
  return f;
}

describe('runImport', () => {
  it('makes one draft per work with importedFrom, cover and palette, and never publishes', async () => {
    const f = fake();
    const progress: string[] = [];
    const r = await runImport(f.deps({onProgress: p => progress.push(`${p.index}/${p.total} ${p.title}`)}));
    expect(r).toMatchObject({total: 3, created: 3, failed: [], stopped: false, voiceSet: true});
    const ws = Object.values(f.works);
    expect(ws).toHaveLength(3);
    expect(ws[0].meta.importedFrom).toEqual({
      key: 'abstract-1',
      page: 'collection-abstract.html',
      slot: 'abstract-1',
      file: 'images/abstract-1.webp',
      sha: 'sha1',
    });
    expect(
      ws.every(w => (w.primaryFileId && w.palette.length === 1 && w.status === 'available') || w.status === 'sold'),
    ).toBe(true);
    expect(ws[1]).toMatchObject({status: 'sold', width: 30, height: 40, sizeUnit: 'in'});
    expect(f.calls.some(c => c.includes('publish'))).toBe(false);
    expect(progress[0]).toBe('1/3 Abstract No. 1');
    expect(f.calls.filter(c => c.startsWith('DRAFT'))).toHaveLength(3);
  });
  it('sends prepared words when drafts.json has them', async () => {
    const f = fake();
    await runImport(f.deps({drafts: {'abstract-2': {description: 'Hello'}}}));
    expect(f.calls.filter(c => c.startsWith('DRAFT')).filter(c => c.endsWith('prepared'))).toHaveLength(1);
  });
  it('running it twice adds nothing', async () => {
    const f = fake();
    await runImport(f.deps());
    const before = f.calls.length;
    const again = await runImport(f.deps());
    expect(again).toMatchObject({total: 0, created: 0, alreadyThere: 3, voiceSet: false});
    expect(Object.keys(f.works)).toHaveLength(3);
    expect(f.files).toBe(3);
    expect(
      f.calls.slice(before).filter(c => c.startsWith('POST') || c.startsWith('PATCH') || c.startsWith('DRAFT')),
    ).toEqual([]);
  });
  it('an interrupted work gets its cover on the second run, not a second work', async () => {
    const f = fake();
    const first = await runImport(
      f.deps({
        attach: async () => {
          throw new Error('connection dropped');
        },
      }),
    );
    expect(first.failed).toHaveLength(3);
    expect(Object.values(f.works).every(w => !w.primaryFileId)).toBe(true);
    const second = await runImport(f.deps());
    expect(second).toMatchObject({repaired: 3, created: 0});
    expect(Object.keys(f.works)).toHaveLength(3);
    expect(Object.values(f.works).every(w => w.primaryFileId)).toBe(true);
  });
  it('a failing work does not stop the others', async () => {
    const f = fake({failKey: 'abstract-2'});
    const r = await runImport(f.deps());
    expect(r.created).toBe(2);
    expect(r.failed).toEqual([{key: 'abstract-2', title: 'Abstract No. 2', message: 'The old site did not answer.'}]);
  });
  it('Stop stops between works and the next run carries on', async () => {
    const f = fake();
    const ctl = new AbortController();
    const r = await runImport(f.deps({signal: ctl.signal, onProgress: p => p.index === 2 && ctl.abort()}));
    expect(r.stopped).toBe(true);
    expect(r.created).toBe(2);
    const rest = await runImport(f.deps());
    expect(rest.created).toBe(1);
    expect(Object.keys(f.works)).toHaveLength(3);
  });
  it('sets the voice once and leaves an existing one alone', async () => {
    const f = fake();
    await f.api.patch('/settings', {meta: {voice: 'mine'}}, 1);
    const r = await runImport(f.deps());
    expect(r.voiceSet).toBe(false);
  });
});
