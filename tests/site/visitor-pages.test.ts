// Stage 3 pages without scripts: /ask (search), /p/{token} (a made page), /contact (the one-question check), /inquiry,
// and the rule that the studio's phone number is never whole in any page's HTML (D-133).
import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('/ask without scripts', () => {
  it('shows the greeting, a GET search form and the contact links', async () => {
    const {text, status, res} = await get('/ask');
    expect(status).toBe(200);
    expect(text).toContain('Hello, I am the studio assistant, an AI.');
    expect(text).toMatch(/<form class="search" method="get" action="\/ask"/);
    expect(text).toMatch(/name="q"/);
    expect(text).toContain('Ask Isaac');
    expect(text).toMatch(/data-contact="sms"/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
  it('lists the works that match every word, as cards with size and price', async () => {
    fixture.works[0]!.tags = ['texture', 'green'];
    const {text} = await get('/ask?q=strata+GREEN');
    expect(text).toContain('1 work matches');
    expect(text).toMatch(/<a class="card" href="\/works\/work-1">/);
    expect(text).toContain('36 × 24 in');
    expect(text).toContain('$4,800');
    expect(text).not.toContain('href="/works/work-2"');
    expect(text).toContain('<meta name="robots" content="noindex">');
  });
  it('matches title, collection and medium; says price on request and sold', async () => {
    const byCollection = await get('/ask?q=sculptural');
    expect(byCollection.text).toMatch(/href="\/works\/work-5"/);
    const medium = await get('/ask?q=cement');
    expect(medium.text).toContain('Price on request');
    expect(medium.text).toContain('Sold');
  });
  it('says so when nothing matches, and escapes what was typed', async () => {
    const {text} = await get('/ask?q=%3Cqqq%20onload%3D1%3E');
    expect(text).toContain('Nothing matches');
    expect(text).not.toContain('<qqq');
    expect(text).toContain('&lt;qqq');
  });
  it('still searches when the chat is off, and says it is resting', async () => {
    fixture.assistantAvailable = false;
    const {text} = await get('/ask?q=strata');
    expect(text).toContain('The chat is resting');
    expect(text).toMatch(/href="\/works\/work-1"/);
    expect(text).not.toContain('Chat with the studio assistant');
  });
  it('works when the assistant route fails', async () => {
    const orig = fixture.works;
    fixture.assistantAvailable = false;
    const r = await get('/ask');
    expect(r.status).toBe(200);
    fixture.works = orig;
  });
});

describe('/p/{token}', () => {
  it('renders the made page: title, the question, the pieces, noindex', async () => {
    fixture.pages['tok_ABC-123xyz'] = {
      title: 'Green pieces',
      question: 'Which ones are green?',
      works: ['work-1', 'work-3'],
    };
    const {text, status, res} = await get('/p/tok_ABC-123xyz');
    expect(status).toBe(200);
    expect(text).toContain('<meta name="robots" content="noindex">');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(text).toMatch(/<h1>Green pieces<\/h1>/);
    expect(text).toContain('Which ones are green?');
    expect(text).toContain('href="/works/work-1"');
    expect(text).toContain('href="/works/work-3"');
    expect(text).toContain('$4,800');
  });
  it('is the 404 page for an unknown token', async () => {
    const r = await get('/p/nope-nope-nope');
    expect(r.status).toBe(404);
    expect(r.text).toContain('<h1>Not found</h1>');
    expect(r.text).toContain('noindex');
  });
  it('escapes the title and question', async () => {
    fixture.pages['tok_xss_123'] = {title: '<b>Hi</b>', question: '<script>x()</script>', works: ['work-1']};
    const {text} = await get('/p/tok_xss_123');
    expect(text).not.toContain('<b>Hi');
    expect(text).not.toContain('<script>x()');
  });
});

describe('/contact without scripts', () => {
  it('asks one question and does not show the number', async () => {
    const {text, res} = await get('/contact');
    expect(text).toMatch(/<form class="search" method="get" action="\/contact"/);
    expect(text).toMatch(/<input type="hidden" name="i" value="\d"/);
    expect(text).not.toContain('5551234567');
    expect(text).not.toMatch(/href="(sms|tel):/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
  it('a right answer shows the number and sms:/tel: links, never stored', async () => {
    const r = await get('/contact?i=0&a=7');
    expect(r.text).toContain('+15551234567');
    expect(r.text).toMatch(/href="sms:\+15551234567\?&amp;body=/);
    expect(r.text).toContain('href="tel:+15551234567"');
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    const word = await get('/contact?i=0&a=%20Seven%20');
    expect(word.text).toContain('href="tel:+15551234567"');
  });
  it('a wrong answer asks again and shows nothing', async () => {
    const r = await get('/contact?i=0&a=8');
    expect(r.text).toContain("That wasn't it");
    expect(r.text).not.toContain('5551234567');
    const bad = await get('/contact?i=99&a=7');
    expect(bad.text).not.toContain('5551234567');
    const empty = await get('/contact?a=');
    expect(empty.text).not.toContain('5551234567');
  });
  it('writes the piece into the message', async () => {
    const r = await get('/contact?i=0&a=7&w=work-1');
    const sms = /href="(sms:[^"]+)"/.exec(r.text)![1]!.replace(/&amp;/g, '&');
    const msg = decodeURIComponent(sms.split('body=')[1]!);
    expect(msg).toContain('Strata');
    expect(msg).toContain('https://site.test/works/work-1');
  });
  it('a studio without a phone offers email only', async () => {
    fixture.studio.phone = null;
    const r = await get('/contact');
    expect(r.status).toBe(200);
    expect(r.text).toContain('mailto:studio@example.com');
  });
});

describe('/inquiry', () => {
  it('without scripts says the list needs scripts and offers /contact', async () => {
    const {text} = await get('/inquiry');
    expect(text).toMatch(/<noscript>[\s\S]*needs scripts[\s\S]*href="\/contact"[\s\S]*<\/noscript>/);
    expect(text).toContain('/site/inquiry-page.js');
    expect(text).toContain('<div id="inq"');
  });
});

describe('the phone number is never whole in any page', () => {
  const PAGES = [
    '/',
    '/works',
    '/works/work-1',
    '/works/work-2',
    '/commissions',
    '/process',
    '/about',
    '/ask',
    '/ask?q=strata',
    '/inquiry',
    '/contact',
    '/contact?i=0&a=8',
    '/p/tok_ABC-123xyz',
    '/p/not-a-page',
    '/no-such-page',
  ];
  it('no digits run, no sms:/tel: link, no data-phone', async () => {
    fixture.pages['tok_ABC-123xyz'] = {title: 'T', question: null, works: ['work-1']};
    for (const p of PAGES) {
      const {text} = await get(p);
      const digits = text.replace(/\D/g, '');
      expect(digits, p).not.toContain('5551234567');
      expect(text, p).not.toContain('+15551234567');
      expect(text, p).not.toMatch(/(sms|tel):/);
      expect(text, p).not.toContain('data-phone');
    }
  });
  it('the halves are reversed, so each alone is not the number either', async () => {
    const {text} = await get('/');
    const pa = /data-pa="([^"]+)"/.exec(text)![1]!;
    const pb = /data-pb="([^"]+)"/.exec(text)![1]!;
    const rev = (t: string) => [...t].reverse().join('');
    expect(rev(pa) + rev(pb)).toBe('+15551234567');
    expect(pa + pb).not.toBe('+15551234567');
  });
});

describe('Ask in the header and on a piece', () => {
  it('every page has the Ask link to /ask; a piece has Ask about this piece and, if available, a hold button', async () => {
    for (const p of ['/', '/works', '/about', '/inquiry']) {
      expect((await get(p)).text, p).toMatch(/<a class="ask-btn" href="\/ask" data-ask>Ask<\/a>/);
    }
    const avail = await get('/works/work-1');
    expect(avail.text).toContain('Ask about this piece');
    expect(avail.text).toMatch(/<button[^>]*data-hold[^>]*data-piece="work-1"/);
    const sold = await get('/works/work-2');
    expect(sold.text).toContain('Ask about this piece');
    expect(sold.text).not.toContain('data-hold');
  });
  it('the page carries the studio slug for the sheet, and loads the sheet only on demand', async () => {
    const {text} = await get('/works/work-1');
    expect(text).toContain('data-slug="test-studio-abc123"');
    expect(text).toContain('/site/site.js');
    expect(text).not.toContain('/site/ask.js');
  });
});
