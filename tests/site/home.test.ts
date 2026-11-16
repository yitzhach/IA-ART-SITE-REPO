import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('home', () => {
  it('name, tagline, hero preloaded, collections, available works, objects, rooms, contact', async () => {
    const {text, status} = await get('/');
    expect(status).toBe(200);
    expect(text).toContain('<title>Test Studio — Revelation in the midst of decay.</title>');
    expect(text).toMatch(/<h1>Test Studio<\/h1>/);
    expect(text).toMatch(/rel="preload"\s+as="image"/);
    expect(text).toMatch(/imagesrcset="[^"]*HERO1/);
    expect(text).toMatch(/fetchpriority="high"/);
    expect(text).toContain('href="/works?collection=Abstract"');
    expect(text).toContain('href="/works?collection=Figurative"');
    expect(text).toContain('Strata');
    expect(text).toContain('$4,800');
    expect(text).not.toContain('Upper Limit'); // sold: not among available works
    expect(text).toContain('The work, closely');
    expect(text).toContain('href="/works/work-1"'); // object photo with a workSlug
    expect(text).toContain('Start a conversation');
    expect(text).toContain('Residential + commercial');
  });
  it('gallery wall: header on the hero, cross-fading hero photos, works on the wall, dark closing', async () => {
    const {text} = await get('/');
    expect(text).toContain('<header class="site-hdr over">');
    expect(text).toContain('class="hero-img xf xf-2"'); // two hero photos in the fixture
    expect(text).toMatch(/imagesizes="100vw"/);
    expect(text).toContain('<ul class="wall">');
    expect(text).toContain('<ul class="salon">');
    expect(text).toContain('style="--r:1.33"'); // a room as wide as its shape
    expect(text).toContain('<footer class="site-ftr band">');
    expect((await get('/works')).text).toContain('<header class="site-hdr">');
  });
  it('no hero photo: the header stays above the page', async () => {
    fixture.places = {};
    const {text} = await get('/');
    expect(text).toContain('<header class="site-hdr">');
    expect(text).not.toContain('class="hero-img');
  });
  it('one works() call for covers and available works', async () => {
    await get('/');
    expect(fixture.calls.filter(c => c.includes('/artworks')).length).toBe(1);
  });
  it('the fixture title with <script> is escaped', async () => {
    fixture.works[4]!.status = 'available';
    const {text} = await get('/');
    expect(text).not.toContain('<script>alert');
  });
  it('missing sections and places are left out quietly', async () => {
    fixture.places = {};
    fixture.studio.pages = {};
    const r = await get('/');
    expect(r.status).toBe(200);
    expect(r.text).toContain('<h1>Test Studio</h1>');
    expect(r.text).toContain('Start a conversation');
  });
});
