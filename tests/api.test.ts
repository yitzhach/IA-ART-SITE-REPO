import {afterEach, expect, it, vi} from 'vitest';
import {ApiError, del, get, patch} from '../src/api';

afterEach(() => vi.unstubAllGlobals());
const stub = (res: Response) => {
  const f = vi.fn(async () => res);
  vi.stubGlobal('fetch', f);
  return f;
};

it('sends If-Match and credentials on patch', async () => {
  const f = stub(new Response('{"ok":1}', {status: 200}));
  await patch('/works/1', {title: 'x'}, 3);
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/v1/works/1');
  expect((init.headers as Record<string, string>)['if-match']).toBe('3');
  expect(init.credentials).toBe('include');
});
it('sends If-Match on del', async () => {
  const f = stub(new Response(null, {status: 204}));
  await del('/works/1', 7);
  expect(((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)['if-match']).toBe(
    '7',
  );
});
it('throws ApiError from the error body', async () => {
  stub(new Response('{"error":{"code":"conflict","message":"stale","details":{"a":1}}}', {status: 409}));
  const e: any = await get('/works/1').catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ApiError);
  expect([e.status, e.code, e.message]).toEqual([409, 'conflict', 'stale']);
});
