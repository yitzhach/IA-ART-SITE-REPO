import {beforeEach, describe, expect, it} from 'vitest';
import {fixture, get, reset} from './fake-api';

beforeEach(reset);

describe('commissions, process, about', () => {
  it('commissions: title, lede, intro photo, numbered steps, start-a-commission buttons', async () => {
    const {text} = await get('/commissions');
    expect(text).toContain('<title>Commissions — Test Studio</title>');
    expect(text).toMatch(/<h1>Commissions<\/h1>/);
    expect(text).toContain('COMM1');
    expect(text).toMatch(/<span class="n">01<\/span>\s*<div class="prose">\s*<h3>Consultation<\/h3>/);
    expect(text).toContain('Start a commission');
    expect(text.match(/class="btn" href="sms:/g)?.length).toBe(1);
    expect(text).toMatch(/aria-current="page">Commissions/);
  });
  it('process: hero, five stages numbered 01–05 with photos, closing block', async () => {
    const {text} = await get('/process');
    expect(text).toMatch(/<h1>Process<\/h1>/);
    expect(text).toContain('PROC0');
    for (const n of ['01', '02', '03', '04', '05']) expect(text).toContain(`<span class="n">${n}</span>`);
    for (const id of ['PROC1', 'PROC2', 'PROC3', 'PROC4', 'PROC5']) expect(text).toContain(id);
    expect(text).toContain('Start a conversation');
    expect(text).toContain('Let&#39;s connect');
    expect(text).toContain('<li>Wood panel</li>');
  });
  it('about: studio photo, enquiries as an email link, start block', async () => {
    const {text} = await get('/about');
    expect(text).toContain('<title>About — Test Studio</title>');
    expect(text).toContain('ABOUT1');
    expect(text).toMatch(/<a href="mailto:[^"]+@gmail\.com">[^<]+@gmail\.com<\/a>/);
    expect(text).toContain('Start a commission');
  });
  it('words are never inserted as HTML', async () => {
    fixture.studio.pages.about!.sections![0]!.body = '<img src=x onerror=alert(1)>';
    const {text} = await get('/about');
    expect(text).not.toContain('<img src=x');
    expect(text).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('missing page, sections or places → title and contact block, no crash', async () => {
    fixture.studio.pages = {};
    fixture.places = {};
    for (const [p, h] of [
      ['/commissions', 'Commissions'],
      ['/process', 'Process'],
      ['/about', 'Test Studio'],
    ]) {
      const r = await get(p!);
      expect(r.status, p).toBe(200);
      expect(r.text).toContain(`<h1>${h}</h1>`);
      expect(r.text).toContain('Start a conversation');
    }
    fixture.studio.pages = {process: {sections: [{key: 'surface', place: 'process.nope'}, {}]}};
    expect((await get('/process')).status).toBe(200);
  });
});
