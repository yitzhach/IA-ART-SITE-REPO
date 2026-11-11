import {afterEach, expect, it, vi} from 'vitest';
import {attachToArtwork, uploadPrepared} from '../src/lib/upload';
import type {Prepared} from '../src/lib/images';

afterEach(() => vi.unstubAllGlobals());
const prepared: Prepared = {
  original: new Blob(['orig-bytes']),
  contentType: 'image/jpeg',
  name: 'a.jpg',
  pixels: {width: 1200, height: 800},
  sizes: [
    {width: 480, blob: new Blob(['s1'])},
    {width: 960, blob: new Blob(['s22'])},
  ],
  palette: [],
};
const file = {id: 'F1'};
const json = (o: unknown) => new Response(JSON.stringify(o), {status: 200});

it('requests links, PUTs every file, reports progress, returns the file', async () => {
  const puts: string[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      puts.push(url);
      return new Response(null, {status: 204});
    }
    return json({
      file,
      uploadUrl: 'https://u/orig',
      expiresAt: 'x',
      sizeUrls: [
        {width: 480, uploadUrl: '/v1/u/480'},
        {width: 960, uploadUrl: '/v1/u/960'},
      ],
    });
  });
  vi.stubGlobal('fetch', f);
  const prog: number[] = [];
  const r = await uploadPrepared(prepared, 'photo', (d, t) => prog.push(d * 10 + t));
  expect(r).toEqual(file);
  expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toMatchObject({
    size: 10,
    kind: 'photo',
    sizes: [
      {width: 480, size: 2},
      {width: 960, size: 3},
    ],
    pixels: {width: 1200, height: 800},
  });
  expect(puts.sort()).toEqual(['/v1/u/480', '/v1/u/960', 'https://u/orig']);
  expect(prog.at(-1)).toBe(33);
});
it('retries a PUT once on a network error', async () => {
  let n = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method !== 'PUT')
        return json({file, uploadUrl: 'u', expiresAt: 'x', sizeUrls: [{width: 480, uploadUrl: 'a'}]});
      if (n++ === 0) throw new TypeError('network');
      return new Response(null, {status: 204});
    }),
  );
  await uploadPrepared({...prepared, sizes: [prepared.sizes[0]!]});
  expect(n).toBe(3);
});
it('fails on a bad PUT status', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_u: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? new Response('no', {status: 403})
        : json({file, uploadUrl: 'u', expiresAt: 'x', sizeUrls: []}),
    ),
  );
  await expect(uploadPrepared({...prepared, sizes: []})).rejects.toThrow(/403/);
});
it('attaches to an artwork', async () => {
  const f = vi.fn(async () => json(file));
  vi.stubGlobal('fetch', f);
  await attachToArtwork('F1', 'W1');
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/v1/files/F1/attach');
  expect(JSON.parse(init.body as string)).toEqual({entityType: 'artwork', entityId: 'W1'});
});
