// The privacy and terms drafts in Site → Pages (card F): only what the platform really keeps, and the artist's own
// return and shipping terms.
import {describe, expect, it} from 'vitest';
import {LEGAL_PAGES, PAGES, PAGE_DRAFTS, pageDraft} from '../src/lib/site-logic';

const all = (d: ReturnType<typeof pageDraft>) =>
  [d!.title, d!.lede, ...d!.sections.flatMap(s => [s.heading, s.body])].join('\n');

describe('pageDraft', () => {
  it('privacy: the sv cookie for a year, the chats, inquiries, follows and orders, and how to ask', () => {
    const t = all(pageDraft('privacy', {email: 'studio@example.com'}));
    for (const w of ['cookie named sv', 'lasts one year', 'assistant', 'inquiry', 'follow the studio', 'order'])
      expect(t).toContain(w);
    expect(t).toContain('email me at studio@example.com');
    expect(t).toContain('never sees your card number');
    // No promise the platform doesn't keep: no number of days for anything (the cookie's year is in words).
    expect(t.replace('studio@example.com', '')).not.toMatch(/\d/);
  });

  it('privacy without an email points at the contact details', () => {
    expect(all(pageDraft('privacy', {}))).toContain('write to me from the contact details on this site');
  });

  it('terms: the return terms shown before paying, the saved shipping and deposit answers, the hold', () => {
    const t = all(
      pageDraft('terms', {
        checkout: {returns: 'Returns within 14 days.', manualHoldHours: 72},
        assistant: {answers: {shipping: 'Crated, insured, by courier.', deposit: 'Half up front.', returns: 'x'}},
      }),
    );
    expect(t).toContain('Returns within 14 days.');
    expect(t).not.toContain('\nx\n');
    expect(t).toContain('Crated, insured, by courier.');
    expect(t).toContain('Half up front.');
    expect(t).toContain('held for you for 72 hours');
  });

  it('terms with nothing saved: the studio defaults, and no Commissions section', () => {
    const d = pageDraft('terms', {})!;
    const t = all(d);
    expect(t).toContain('Returns within 7 days of delivery');
    expect(t).toContain('quote within two working days');
    expect(t).toContain('held for you for 48 hours');
    expect(d.sections.map(s => s.heading)).not.toContain('Commissions');
  });

  it('the other pages keep their drafts; privacy and terms are listed as pages and as legal drafts', () => {
    expect(pageDraft('trade', {})).toEqual(PAGE_DRAFTS.trade);
    expect(pageDraft('home', {})).toBeUndefined();
    expect(PAGES.map(p => p.key)).toEqual(expect.arrayContaining(['privacy', 'terms']));
    expect(LEGAL_PAGES).toEqual(['privacy', 'terms']);
  });
});
