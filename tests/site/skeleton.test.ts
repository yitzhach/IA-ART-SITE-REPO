import {beforeEach, describe, expect, it} from 'vitest';
import {get, reset} from './fake-api';

beforeEach(reset);

describe('site skeleton', () => {
  it('serves each page', async () => {
    for (const p of ['/', '/works', '/works/work-1', '/commissions', '/process', '/about']) {
      const r = await get(p);
      expect(r.status, p).toBe(200);
      expect(r.res.headers.get('content-type')).toContain('text/html');
      expect(r.text).toContain('<title>');
    }
  });
  it('a missing work or address is the site 404', async () => {
    expect((await get('/works/no-such-work')).status).toBe(404);
    expect((await get('/nothing-here')).status).toBe(404);
  });
  it('robots.txt keeps /studio out', async () =>
    expect((await get('/robots.txt')).text).toContain('Disallow: /studio'));
  it('only GET and HEAD', async () => expect((await get('/', {method: 'POST'})).status).toBe(405));
});
