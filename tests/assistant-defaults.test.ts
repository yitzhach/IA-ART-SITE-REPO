import {expect, it, vi} from 'vitest';
import {assistantDefaults, fillAssistantDefaults, fillBody, firstName} from '../src/lib/assistant-defaults';
import {TOPICS, fromFields, toFields, usageLine} from '../src/lib/assistant-form';

it('first word of the site name', () => {
  expect(firstName('Isaac Anderson Art')).toBe('Isaac');
  expect(firstName('  ')).toBeUndefined();
  expect(firstName(undefined)).toBeUndefined();
});
it('defaults with a name', () => {
  const d = assistantDefaults('Isaac Anderson Art');
  expect(d.artistName).toBe('Isaac');
  expect(d.greeting).toBe("I'm Isaac's studio assistant, an AI. Ask about any piece, size, colour or commission.");
  expect(d.replyTime).toBe('Isaac usually replies within a day.');
  expect(d.budgetCents).toBe(1000);
  expect(d.suggestions).toEqual([
    "What's available now?",
    'Something blue for a living room',
    'How do commissions work?',
  ]);
  expect(Object.keys(d.answers).sort()).toEqual(
    ['commissionPrice', 'commissionTimeline', 'deposit', 'shipping', 'trade', 'visits'].sort(),
  );
  expect(d.answers.trade).toBe('Yes, Isaac offers trade terms for designers and architects; ask for them.');
  expect(d.answers.visits).toBe('Studio visits are by appointment; ask Isaac to arrange one.');
});
it('defaults without a name omit it', () => {
  const d = assistantDefaults(undefined);
  expect('artistName' in d).toBe(false);
  expect(d.greeting).toBe("I'm the studio's assistant, an AI. Ask about any piece, size, colour or commission.");
});
it('never overwrites an existing assistant; keeps the rest of meta', () => {
  expect(fillBody({version: 1, meta: {site: {name: 'A B', assistant: {enabled: false}}}})).toBeNull();
  const b = fillBody({version: 1, meta: {other: 1, site: {name: 'Isaac Anderson Art', phone: '+1'}}})!;
  expect(b.meta.other).toBe(1);
  expect((b.meta.site as any).phone).toBe('+1');
  expect((b.meta.site as any).assistant.artistName).toBe('Isaac');
});
it('fills once with one PATCH using the version; silent on error', async () => {
  const patch = vi.fn(async () => ({}));
  const get = vi.fn(async () => ({version: 5, meta: {site: {name: 'Isaac Anderson Art'}}}));
  expect(await fillAssistantDefaults({get, patch} as never)).toBe(true);
  expect(patch).toHaveBeenCalledTimes(1);
  expect((patch.mock.calls[0] as unknown[])[2]).toBe(5);
  const bad = vi.fn(async () => {
    throw new Error('x');
  });
  expect(await fillAssistantDefaults({get: bad, patch} as never)).toBe(false);
  expect(await fillAssistantDefaults({get, patch: bad} as never)).toBe(false);
});

it('form: fourteen friendly topics', () => {
  expect(TOPICS).toHaveLength(14);
  expect(TOPICS.find(t => t.key === 'trade')?.label).toBe('Trade / designer pricing');
});
it('form: dollars become cents, blanks are dropped', () => {
  const f = toFields({budgetCents: 1250, answers: {shipping: 'Flat rate'}, suggestions: ['a']});
  expect(f.budgetDollars).toBe('12.50');
  expect(f.suggestions).toEqual(['a', '', '']);
  const r = fromFields({...f, budgetDollars: '$20'}) as {value: any};
  expect(r.value.budgetCents).toBe(2000);
  expect(r.value.suggestions).toEqual(['a']);
  expect(r.value.answers).toEqual({shipping: 'Flat rate'});
  expect(r.value.enabled).toBe(true);
  expect('error' in fromFields({...f, budgetDollars: 'lots'})).toBe(true);
});
it('usage line', () => {
  expect(usageLine({month: 'm', turns: 312, spentCents: 42, budgetCents: 1000, capped: false})).toBe(
    '$0.42 of $10.00 this month, 312 answers',
  );
});
