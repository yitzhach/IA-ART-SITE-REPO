// The public site's gate checks, against the local copy of the site (tests/site/serve.mjs, fake data):
//  a. scripts off: every page has a title, an h1, text, and the Text / Email / Call links
//  b. 390x844, light and dark: no sideways scroll
//  c. budgets: script bytes <= 50 KB, the above-the-fold picture <= 200 KB
//  d. Lighthouse (mobile): performance, accessibility, best-practices, seo >= 95; LCP <= 2000 ms
// Run: npm run test:site. Reports go to test-results/site-checks/. Exit 1 on any failure.
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {start} from './serve.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = new URL('../..', import.meta.url).pathname;
const out = join(root, 'test-results', 'site-checks');
mkdirSync(out, {recursive: true});

const PAGES = ['/', '/works', '/works/work-1', '/commissions', '/process', '/about'];
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
      const links = await Promise.all(['sms:', 'mailto:', 'tel:'].map(s => page.locator(`a[href^="${s}"]`).count()));
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
const chrome = chromium.executablePath();
for (const p of LH_PAGES) {
  const name = (p === '/' ? 'home' : p.slice(1).replace(/\//g, '-')) + '.json';
  const file = join(out, `lighthouse-${name}`);
  const r = spawnSync(
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
    {env: {...process.env, CHROME_PATH: chrome}, encoding: 'utf8', timeout: 240000},
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
