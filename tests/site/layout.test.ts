import {beforeEach, describe, expect, it} from 'vitest';
import {CSS} from '../../worker/site/plaster';
import {versionLine} from '../../worker/site/format';
import {site} from '../../worker/site/index';
import {env, fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('layout', () => {
  it('has the skip link, header nav, theme switch, footer contact and hours', async () => {
    const {text} = await get('/works');
    expect(text).toContain('<a class="skip" href="#main">');
    expect(text).toMatch(/<a href="\/works"\s+aria-current="page">Works<\/a>/);
    expect(text).toMatch(/<button class="theme-switch" type="button" hidden/);
    expect(text).toContain('<script src="/site/theme.js"></script>');
    // Text and Call lead to the contact sheet (a one-question page without scripts); the number is never in the HTML.
    expect(text).toMatch(/<a href="\/contact" data-contact="sms">Text<\/a>/);
    expect(text).toMatch(/<a href="\/contact" data-contact="tel">Call<\/a>/);
    expect(text).toMatch(/<a class="ask-btn" href="\/ask" data-ask>Ask<\/a>/);
    expect(text).not.toContain('sms:');
    expect(text).not.toContain('tel:');
    expect(text).toContain('Calls 9am–6pm Pacific time');
    expect(text).toContain('rel="preload" as="font" type="font/woff2" href="/fonts/bodoni-700.woff2"');
    for (const f of ['archivo-400', 'archivo-600', 'plexmono-400']) {
      expect(text).toContain(`rel="preload" as="font" type="font/woff2" href="/fonts/${f}.woff2"`);
    }
    expect(text).toContain('href="/favicon-32.png"');
    expect(text).not.toContain('data-phone');
    expect(text).toContain('data-slug="test-studio-abc123"');
    expect(text).toMatch(/data-pa="[^"]+" data-pb="[^"]+"/);
  });
  it('has no inline scripts or handlers besides JSON-LD', async () => {
    for (const p of ['/', '/works', '/works/work-1', '/about']) {
      const {text} = await get(p);
      const inline = [...text.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter(m => !m[1]!.includes('ld+json'));
      expect(inline, p).toEqual([]);
      expect(text, p).not.toMatch(/\son[a-z]+=/);
    }
  });
  it('the template is lean and has both themes', () => {
    expect(CSS.length).toBeLessThan(12 * 1024);
    expect(CSS).toContain('prefers-color-scheme:dark');
    expect(CSS).toContain('[data-theme=dark]');
    expect(CSS).not.toContain('fonts.googleapis');
  });
  it('one h1 on every page', async () => {
    for (const p of ['/', '/works', '/works/work-1', '/commissions', '/process', '/about', '/nope']) {
      const {text} = await get(p);
      expect(text.match(/<h1[\s>]/g)?.length, p).toBe(1);
    }
  });
  it("the footer names the deploy: its time in the studio's time zone and the version id", async () => {
    const v = {id: '8ad56c05-1111-2222-3333-444455556666', timestamp: '2026-11-13T14:32:05Z'};
    expect(versionLine(v, 'America/Los_Angeles')).toBe('2026-11-13 06:32 PST · 8ad56c05');
    expect(versionLine(v, 'America/New_York')).toBe('2026-11-13 09:32 EST · 8ad56c05');
    // Evening in the studio is already tomorrow in UTC: the date is the studio's.
    expect(versionLine({...v, timestamp: '2026-07-04T02:05:00Z'}, 'America/Los_Angeles')).toBe(
      '2026-07-03 19:05 PDT · 8ad56c05',
    );
    expect(versionLine(v, 'Not/AZone')).toBe('2026-11-13 14:32 UTC · 8ad56c05');
    expect(versionLine({id: v.id}, 'America/Los_Angeles')).toBe('8ad56c05');
    expect(versionLine({id: v.id, timestamp: 'nonsense'}, 'America/Los_Angeles')).toBe('8ad56c05');
    expect(versionLine(undefined, 'America/Los_Angeles')).toBeNull();

    const res = await site(new Request('https://site.test/works'), {...env, CF_VERSION_METADATA: v});
    expect(await res.text()).toContain('<p class="ftr-ver">Version 2026-11-13 06:32 PST · 8ad56c05</p>');
    // Without a deploy (tests, a local run) the line is left out.
    expect((await get('/works')).text).not.toContain('class="ftr-ver"');
  });
  it('a studio without phone or email still renders', async () => {
    fixture.studio.phone = null;
    fixture.studio.email = null;
    fixture.studio.hours = null;
    const r = await get('/');
    expect(r.status).toBe(200);
    expect(r.text).not.toContain('sms:');
  });
});
