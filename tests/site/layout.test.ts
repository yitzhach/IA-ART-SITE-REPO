import {beforeEach, describe, expect, it} from 'vitest';
import {CSS} from '../../worker/site/plaster';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('layout', () => {
  it('has the skip link, header nav, theme switch, footer contact and hours', async () => {
    const {text} = await get('/works');
    expect(text).toContain('<a class="skip" href="#main">');
    expect(text).toMatch(/<a href="\/works"\s+aria-current="page">Works<\/a>/);
    expect(text).toMatch(/<button class="theme-switch" type="button" hidden/);
    expect(text).toContain('<script src="/site/theme.js"></script>');
    expect(text).toContain('href="sms:+15551234567?&amp;body=');
    expect(text).toContain('href="tel:+15551234567"');
    expect(text).toContain('Calls 9am–6pm Pacific time');
    expect(text).toContain('rel="preload" as="font" type="font/woff2" href="/fonts/bodoni-700.woff2"');
    for (const f of ['archivo-400', 'archivo-600', 'plexmono-400']) {
      expect(text).toContain(`rel="preload" as="font" type="font/woff2" href="/fonts/${f}.woff2"`);
    }
    expect(text).toContain('href="/favicon-32.png"');
    expect(text).toContain('data-phone="+15551234567"');
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
  it('a studio without phone or email still renders', async () => {
    fixture.studio.phone = null;
    fixture.studio.email = null;
    fixture.studio.hours = null;
    const r = await get('/');
    expect(r.status).toBe(200);
    expect(r.text).not.toContain('sms:');
  });
});
