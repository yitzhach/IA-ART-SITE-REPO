import {afterEach, describe, expect, it, vi} from 'vitest';
import {draftAt, draftingNow, markDrafting, requestDraft, waitForDraft} from '../src/lib/assistant';
import type {ArtworkDetail} from '../src/types';

afterEach(() => vi.unstubAllGlobals());
const work = (at?: string) => ({id: 'W', meta: at ? {draft: {at}} : {}}) as unknown as ArtworkDetail;

describe('asking for a draft', () => {
  const stub = (status: number) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', {status})),
    );
  it('202 started', async () => {
    stub(202);
    expect(await requestDraft('W')).toBe('started');
  });
  it('503 unavailable', async () => {
    stub(503);
    expect(await requestDraft('W')).toBe('unavailable');
  });
  it('other errors fail quietly', async () => {
    stub(500);
    expect(await requestDraft('W')).toBe('failed');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    expect(await requestDraft('W')).toBe('failed');
  });
});

describe('waiting for it', () => {
  it('reads meta.draft.at', () => {
    expect(draftAt(work('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00Z');
    expect(draftAt(work())).toBeNull();
  });
  it('returns the work once the draft time changes', async () => {
    let t = 0;
    const answers = [work('A'), work('A'), work('B')];
    const load = vi.fn(async () => answers.shift()!);
    markDrafting('W', 'A', 0);
    const got = await waitForDraft('W', 'A', {now: () => t, sleep: async ms => void (t += ms), load});
    expect(draftAt(got!)).toBe('B');
    expect(load).toHaveBeenCalledTimes(3);
    expect(draftingNow('W')).toBeUndefined();
  });
  it('gives up after 90 seconds', async () => {
    let t = 0;
    const load = vi.fn(async () => work('A'));
    const got = await waitForDraft('W', 'A', {now: () => t, sleep: async ms => void (t += ms), load});
    expect(got).toBeNull();
    expect(load).toHaveBeenCalledTimes(30);
  });
  it('stops when the person leaves', async () => {
    const load = vi.fn(async () => work('A'));
    expect(await waitForDraft('W', 'A', {sleep: async () => {}, load, keepGoing: () => false})).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
  it('a first draft (none before) is noticed too', async () => {
    const got = await waitForDraft('W', null, {sleep: async () => {}, load: async () => work('A')});
    expect(draftAt(got!)).toBe('A');
  });
});
