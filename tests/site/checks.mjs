// The public site's gate checks, against the local copy of the site (tests/site/serve.mjs, fake data):
//  a. scripts off: every page has a title, an h1, text, and the Text / Email / Call links
//  b. 390x844, light and dark: no sideways scroll
//  c. budgets: script bytes <= 50 KB, the above-the-fold picture <= 200 KB
//  d. Lighthouse (mobile): performance, accessibility, best-practices, seo >= 95; LCP <= 2000 ms
// Run: npm run test:site. Reports go to test-results/site-checks/. Exit 1 on any failure.
import {spawn} from 'node:child_process';
import {mkdirSync, readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {start} from './serve.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = new URL('../..', import.meta.url).pathname;
const out = join(root, 'test-results', 'site-checks');
mkdirSync(out, {recursive: true});

const PAGES = ['/', '/works', '/works/work-1', '/commissions', '/process', '/about', '/ask', '/inquiry', '/contact'];
const LH_PAGES = ['/', '/works', '/works/work-1'];
const SCRIPT_BUDGET = 50 * 1024;
const IMAGE_BUDGET = 200 * 1024;
const LH_MIN = 95;
const LCP_MAX = 2000;
// Audits that cannot pass on localhost for reasons that do not apply in production (skipped by id, not by category).
const LOCALHOST_SKIP = new Set([]);

const rows = [];
const record = (page, check, value, ok, note = '') => rows.push({page, check, value: String(value), ok, note});

const server = await start(Number(process.env.SITE_CHECKS_PORT ?? 8791));
const browser = await chromium.launch();
try {
  const titles = [...new Set(server.fixture().works.map(w => w.title))].slice(0, 4);

  // a. scripts off
  {
    const ctx = await browser.newContext({javaScriptEnabled: false, viewport: {width: 390, height: 844}});
    const page = await ctx.newPage();
    for (const p of PAGES) {
      const res = await page.goto(server.url + p);
      const title = await page.title();
      const h1 = await page.locator('h1').count();
      const text = (await page.locator('body').innerText()).trim().length;
      const links = await Promise.all(
        ['a[data-contact="sms"]', 'a[href^="mailto:"]', 'a[data-contact="tel"]'].map(sel => page.locator(sel).count()),
      );
      record(p, 'no-JS: status 200', res.status(), res.status() === 200);
      record(p, 'no-JS: title', title ? 'yes' : 'none', !!title);
      record(p, 'no-JS: h1', h1, h1 >= 1);
      record(p, 'no-JS: visible text (chars)', text, text > 100);
      record(
        p,
        'no-JS: Text/Email/Call links',
        links.join('/'),
        links.every(n => n > 0),
      );
      if (p === '/works') {
        const body = await page.locator('body').innerText();
        const missing = titles.filter(t => !body.includes(t));
        record(
          p,
          'no-JS: lists the work titles',
          missing.length ? `missing ${missing.join(', ')}` : `${titles.length} found`,
          !missing.length,
        );
      }
    }
    await ctx.close();
  }

  // a2. scripts on: Ask opens the sheet (focus kept inside, no sideways scroll), a question gets cards, Esc closes;
  // the inquiry list shows the piece; the number only appears after a tap.
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, colorScheme: scheme});
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(server.url + '/works/work-1');
    const before = await page.evaluate(() => document.documentElement.outerHTML.includes('15551234567'));
    record('/works/work-1', 'number not in the page', before ? 'found' : 'absent', !before);
    await page.locator('.ask-btn').click();
    await page.waitForSelector('.sheet [role=dialog], .sheet', {timeout: 5000}).catch(() => {});
    await page.waitForSelector('.chat-log .msg', {timeout: 5000}).catch(() => {});
    const open = await page.locator('[role=dialog]').count();
    record('/works/work-1', `sheet opens (${scheme})`, open, open === 1);
    await page.locator('#q').fill('something green');
    await page.locator('.sheet-ask button[type=submit]').click();
    await page.waitForSelector('.acard', {timeout: 5000}).catch(() => {});
    const cards = await page.locator('.acard').count();
    record('/works/work-1', `answer shows a card (${scheme})`, cards, cards === 1);
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    record('/works/work-1', `sheet: no sideways scroll (${scheme})`, sw.join('<='), sw[0] <= sw[1]);
    await page.locator('.acard .add').click();
    const stored = await page.evaluate(() => localStorage.getItem('inquiry'));
    record(
      '/works/work-1',
      `add to inquiry (${scheme})`,
      stored ? 'stored' : 'empty',
      !!stored && stored.includes('work-1'),
    );
    await page.locator('.sheet-btns button', {hasText: 'Ask Isaac'}).first().click();
    await page.locator('.sheet-btns button', {hasText: 'Text'}).click();
    await page.waitForSelector('.the-number', {timeout: 3000}).catch(() => {});
    const sms = await page.locator('.sheet a[href^="sms:"]').count();
    record('/works/work-1', `Text shows number and sms link after a tap (${scheme})`, sms, sms === 1);
    await page.keyboard.press('Escape');
    const closed = await page.locator('[role=dialog]').count();
    record('/works/work-1', `Esc closes the sheet (${scheme})`, closed, closed === 0);
    await page.goto(server.url + '/inquiry');
    await page.waitForSelector('.inq-item', {timeout: 5000}).catch(() => {});
    const items = await page.locator('.inq-item').count();
    record('/inquiry', `list shows the piece (${scheme})`, items, items === 1);
    const sw2 = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    record('/inquiry', `390px ${scheme}: no sideways scroll`, sw2.join('<='), sw2[0] <= sw2[1]);
    record('(scripts)', `no page errors (${scheme})`, errors.length, errors.length === 0, errors[0] ?? '');
    await ctx.close();
  }

  // b + c. 390x844, light and dark; budgets
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: {width: 390, height: 844},
      colorScheme: scheme,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    for (const p of PAGES) {
      let scriptBytes = 0;
      const pending = [];
      const onResponse = r => {
        if (r.request().resourceType() !== 'script') return;
        pending.push(
          r.body().then(
            b => (scriptBytes += b.length),
            () => {},
          ),
        );
      };
      page.on('response', onResponse);
      await page.addInitScript(() => {
        window.__lcp = null;
        new PerformanceObserver(l => {
          const e = l.getEntries().at(-1);
          window.__lcp = {url: e.url || '', tag: e.element?.tagName ?? '', time: e.startTime};
        }).observe({type: 'largest-contentful-paint', buffered: true});
      });
      await page.goto(server.url + p, {waitUntil: 'load'});
      await page.waitForTimeout(400);
      await Promise.all(pending);
      page.off('response', onResponse);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
        lcp: window.__lcp,
      }));
      record(p, `390px ${scheme}: no sideways scroll`, `${m.sw}<=${m.iw}`, m.sw <= m.iw);
      if (scheme === 'light') {
        record(
          p,
          'script bytes',
          `${(scriptBytes / 1024).toFixed(1)} KB`,
          scriptBytes <= SCRIPT_BUDGET,
          `budget ${SCRIPT_BUDGET / 1024} KB`,
        );
        let imgBytes = 0;
        let note = 'LCP is not a picture';
        if (m.lcp?.url) {
          const r = await page.request.get(m.lcp.url);
          imgBytes = (await r.body()).length;
          note = m.lcp.url.split('/').slice(-2).join('/');
        }
        record(
          p,
          'LCP picture bytes',
          imgBytes ? `${(imgBytes / 1024).toFixed(1)} KB` : '-',
          imgBytes <= IMAGE_BUDGET,
          note,
        );
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

// d. Lighthouse
function run(cmd, args, env, timeout = 240000) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, {env, stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.on('data', d => (stderr += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('close', status => {
      clearTimeout(timer);
      resolve({status, stderr});
    });
  });
}
const chrome = chromium.executablePath();
for (const p of LH_PAGES) {
  const name = (p === '/' ? 'home' : p.slice(1).replace(/\//g, '-')) + '.json';
  const file = join(out, `lighthouse-${name}`);
  // Async, not spawnSync: the site's server runs in this process and must keep answering Lighthouse.
  const r = await run(
    'npx',
    [
      '-y',
      'lighthouse@12.8.2',
      server.url + p,
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox',
      '--output=json',
      `--output-path=${file}`,
    ],
    {...process.env, CHROME_PATH: chrome},
  );
  if (r.status !== 0 || !existsSync(file)) {
    record(p, 'lighthouse ran', 'failed', false, (r.stderr || '').trim().split('\n').slice(-2).join(' '));
    continue;
  }
  const lh = JSON.parse(readFileSync(file, 'utf8'));
  for (const [id, c] of Object.entries(lh.categories)) {
    const score = Math.round((c.score ?? 0) * 100);
    const failing = c.auditRefs
      .map(a => lh.audits[a.id])
      .filter(
        a =>
          a.score !== null &&
          a.score < 1 &&
          a.scoreDisplayMode !== 'informative' &&
          a.scoreDisplayMode !== 'notApplicable' &&
          a.scoreDisplayMode !== 'manual',
      )
      .map(a => a.id);
    const onlySkipped = failing.length > 0 && failing.every(a => LOCALHOST_SKIP.has(a));
    record(p, `lighthouse ${id}`, score, score >= LH_MIN || onlySkipped, failing.slice(0, 4).join(', '));
  }
  const lcp = Math.round(lh.audits['largest-contentful-paint'].numericValue);
  record(p, 'lighthouse LCP (ms)', lcp, lcp <= LCP_MAX);
}
await server.close();

// e. table
const w = k => Math.max(...rows.map(r => r[k].length), k.length);
const [wp, wc, wv] = [w('page'), w('check'), w('value')];
console.log(`\n${'page'.padEnd(wp)}  ${'check'.padEnd(wc)}  ${'value'.padEnd(wv)}  result  note`);
for (const r of rows)
  console.log(
    `${r.page.padEnd(wp)}  ${r.check.padEnd(wc)}  ${r.value.padEnd(wv)}  ${(r.ok ? 'ok' : 'FAIL').padEnd(6)}  ${r.note}`,
  );
const failed = rows.filter(r => !r.ok).length;
console.log(`\n${rows.length - failed}/${rows.length} checks passed`);
process.exit(failed ? 1 : 0);
