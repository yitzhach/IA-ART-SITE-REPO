import {describe, expect, it, vi} from 'vitest';
import {ApiError} from '../src/api';
import {createPictureLoader} from '../src/lib/pictures';

const link = (url: string, at: number) => ({url, expiresAt: new Date(at).toISOString()});

describe('picture links', () => {
  it('caches until a minute before expiry, then asks again', async () => {
    let t = 0;
    const fetchLink = vi.fn(async (id: string, w: number) =>
      link(`/p/${id}/${w}/${fetchLink.mock.calls.length}`, 15 * 60_000),
    );
    const load = createPictureLoader(fetchLink, () => t);
    const a = await load('F1', 480);
    t = 13 * 60_000;
    expect(await load('F1', 480)).toBe(a);
    expect(fetchLink).toHaveBeenCalledTimes(1);
    t = 14.5 * 60_000; // inside the last minute
    expect(await load('F1', 480)).not.toBe(a);
    expect(fetchLink).toHaveBeenCalledTimes(2);
  });
  it('shares one request between callers asking at once', async () => {
    const fetchLink = vi.fn(async () => link('/p', Date.now() + 900_000));
    const load = createPictureLoader(fetchLink);
    await Promise.all([load('F', 480), load('F', 480), load('F', 480)]);
    expect(fetchLink).toHaveBeenCalledTimes(1);
  });
  it('keeps sizes apart', async () => {
    const fetchLink = vi.fn(async (_: string, w: number) => link('/p' + w, Date.now() + 900_000));
    const load = createPictureLoader(fetchLink);
    expect(await load('F', 480)).toBe('/p480');
    expect(await load('F', 960)).toBe('/p960');
  });
  it('falls back to 480 when the size is missing', async () => {
    const fetchLink = vi.fn(async (_: string, w: number) => {
      if (w !== 480) throw new ApiError(404, 'not_found', 'no');
      return link('/small', Date.now() + 900_000);
    });
    const load = createPictureLoader(fetchLink);
    expect(await load('F', 1600)).toBe('/small');
  });
  it('does not hide other errors', async () => {
    const load = createPictureLoader(async () => {
      throw new ApiError(500, 'x', 'boom');
    });
    await expect(load('F', 480)).rejects.toThrow('boom');
  });
  it('runs at most 6 requests at once', async () => {
    let running = 0,
      peak = 0;
    const release: (() => void)[] = [];
    const fetchLink = async (id: string) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise<void>(r => release.push(r));
      running--;
      return link('/' + id, Date.now() + 900_000);
    };
    const load = createPictureLoader(fetchLink);
    const all = Promise.all(Array.from({length: 15}, (_, i) => load('F' + i, 480)));
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      release.splice(0).forEach(r => r());
    }
    await all;
    expect(peak).toBe(6);
  });
});
