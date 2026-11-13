// Visitors (card G): the Site screen's counts, in words.
import {describe, expect, it} from 'vitest';
import {visitorSummary, type SiteCounts} from '../src/lib/site-logic';

const zero = {view: 0, ask: 0, wall: 0, inquiry: 0, question: 0, lead: 0, order: 0};
const counts = (over: Partial<SiteCounts> = {}): SiteCounts => ({
  days: 30,
  from: '2026-10-15',
  totals: zero,
  topWorks: [],
  ...over,
});

describe('visitorSummary', () => {
  it('says when nothing is counted yet, and still lists every total', () => {
    const v = visitorSummary(counts());
    expect(v.empty).toBe(true);
    expect(v.totals.map(t => t.label)).toEqual([
      'Pieces viewed',
      'Ask opened',
      'Questions asked',
      'Tried on a wall',
      'Added to an inquiry',
      'Inquiries and holds sent',
      'Orders started',
    ]);
    expect(v.top).toEqual([]);
  });

  it('writes numbers with thousands and the pieces seen most in words', () => {
    const v = visitorSummary(
      counts({
        totals: {...zero, view: 1240, lead: 1},
        topWorks: [
          {id: 'a', title: 'Lifted Up', slug: 'lifted-up', view: 310, ask: 1, wall: 0, inquiry: 2},
          {id: 'b', title: 'Strata', slug: 'strata', view: 1, ask: 0, wall: 1, inquiry: 0},
          {id: 'c', title: 'Nothing yet', slug: null, view: 0, ask: 0, wall: 0, inquiry: 0},
        ],
      }),
    );
    expect(v.empty).toBe(false);
    expect(v.totals[0]).toEqual({label: 'Pieces viewed', n: '1,240'});
    expect(v.top).toEqual(['Lifted Up: 310 views, 2 inquiries, 1 question opened', 'Strata: 1 view, 1 wall try']);
  });
});
