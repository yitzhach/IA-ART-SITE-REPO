// /privacy and /terms (card F, D-175): shown, linked and in the sitemap only once saved.
import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

const footer = (t: string) => t.slice(t.indexOf('<nav aria-label="Footer"'));

describe('privacy and terms pages', () => {
  it('not saved: 404, and no footer or sitemap link', async () => {
    delete fixture.studio.pages.privacy;
    delete fixture.studio.pages.terms;
    expect((await get('/privacy')).status).toBe(404);
    expect((await get('/terms')).status).toBe(404);
    const home = (await get('/')).text;
    expect(footer(home)).not.toContain('href="/privacy"');
    expect(footer(home)).not.toContain('href="/terms"');
    const map = (await get('/sitemap.xml')).text;
    expect(map).not.toContain('/privacy<');
    expect(map).not.toContain('/terms<');
  });

  it('a page saved with no words still counts as not saved', async () => {
    fixture.studio.pages.privacy = {title: '  ', sections: [{body: ' '}]};
    expect((await get('/privacy')).status).toBe(404);
  });

  it('saved: the artist’s words, escaped, linked from the footer and listed in the sitemap', async () => {
    fixture.studio.pages.privacy = {
      title: 'Privacy',
      lede: 'What this site keeps.',
      sections: [{heading: 'What this site keeps', body: '• A cookie named sv\n• Your <b>note</b>'}],
    };
    fixture.studio.pages.terms = {title: 'Terms', sections: [{heading: 'Returns', body: 'Within 7 days.'}]};
    const p = await get('/privacy');
    expect(p.status).toBe(200);
    expect(p.text).toContain('<h1');
    expect(p.text).toContain('What this site keeps');
    expect(p.text).toContain('A cookie named sv');
    expect(p.text).toContain('&lt;b&gt;note&lt;/b&gt;');
    expect(p.text).not.toContain('<b>note</b>');
    const t = await get('/terms');
    expect(t.status).toBe(200);
    expect(t.text).toContain('Within 7 days.');
    const f = footer((await get('/works')).text);
    expect(f).toMatch(/href="\/privacy"[^>]*>Privacy</);
    expect(f).toMatch(/href="\/terms"[^>]*>Terms</);
    const map = (await get('/sitemap.xml')).text;
    expect(map).toContain('/privacy</loc>');
    expect(map).toContain('/terms</loc>');
  });
});
