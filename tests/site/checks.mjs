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

const PAGES = [
  '/',
  '/works',
  '/works/work-1',
  '/commissions',
  '/process',
  '/about',
  '/questions',
  '/ask',
  '/inquiry',
  '/contact',
];
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
    // Listen: a stand-in for the browser's voice that records what it is asked to say.
    await ctx.addInitScript(() => {
      const said = (window.__said = []);
      const fake = {speak: u => said.push(u.text), cancel: () => said.push('(stop)')};
      Object.defineProperty(window, 'speechSynthesis', {configurable: true, get: () => fake});
      window.SpeechSynthesisUtterance = function (text) {
        this.text = text;
      };
    });
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
    {
      const listen = page.locator('.msg.assistant .listen').last();
      const answer = await page.locator('.msg.assistant').last().locator('p').first().innerText();
      await listen.click();
      const said = await page.evaluate(() => window.__said.filter(t => t !== '(stop)'));
      const label = await listen.innerText();
      const ok = said.length === 1 && said[0] === answer && label === 'Stop';
      record(
        '/works/work-1',
        `Listen reads the answer aloud (${scheme})`,
        `${said.length} said, button "${label}"`,
        ok,
      );
      await listen.click();
      const after = await page.evaluate(() => window.__said);
      const label2 = await listen.innerText();
      record(
        '/works/work-1',
        `Stop ends it (${scheme})`,
        `button "${label2}"`,
        after[after.length - 1] === '(stop)' && after.filter(t => t !== '(stop)').length === 1 && label2 === 'Listen',
      );
    }
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

  // a3. See it on your wall (stage 5, gate: size within 2%, smooth on a phone). A made-up wall photo with a 36 in
  // bar drawn 12 px to the inch; two taps on its ends and "36" must draw work-1 (24 × 36 in) 288 × 432 photo pixels.
  {
    const sharp = (await import('sharp')).default;
    const PPI = 12,
      A = {x: 200, y: 900},
      B = {x: 200 + 36 * PPI, y: 900};
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="100%" height="100%" fill="#d8d2c4"/><line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="#c33" stroke-width="6"/></svg>`;
    const photo = await sharp(Buffer.from(svg)).jpeg().toBuffer();
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true});
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(server.url + '/works/work-1');
    await page.locator('[data-wall]').click();
    await page.waitForSelector('.wall-sheet', {timeout: 5000}).catch(() => {});
    record(
      '/works/work-1',
      'wall: sheet opens',
      await page.locator('.wall-sheet').count(),
      (await page.locator('.wall-sheet').count()) === 1,
    );
    await page.setInputFiles('#wall-file', {name: 'wall.jpg', mimeType: 'image/jpeg', buffer: photo});
    await page
      .waitForFunction(() => document.querySelector('.wall-img')?.complete, null, {timeout: 5000})
      .catch(() => {});
    const box = await page.locator('.wall-img').boundingBox();
    const s = box ? box.width / 1600 : 0;
    if (box) {
      await page.locator('.wall-img').scrollIntoViewIfNeeded();
      const b2 = await page.locator('.wall-img').boundingBox();
      await page.mouse.click(b2.x + A.x * s, b2.y + A.y * s);
      await page.mouse.click(b2.x + B.x * s, b2.y + B.y * s);
    }
    await page.locator('#wall-len').fill('36');
    await page.locator('.wall-len button').click();
    await page.waitForSelector('.wall-piece:not([hidden])', {timeout: 3000}).catch(() => {});
    const pb = await page.locator('.wall-piece').boundingBox();
    const ew = 24 * PPI * s,
      eh = 36 * PPI * s;
    const errW = pb ? Math.abs(pb.width / ew - 1) : 1,
      errH = pb ? Math.abs(pb.height / eh - 1) : 1;
    record('/works/work-1', 'wall: piece width within 2%', `${(errW * 100).toFixed(2)}%`, errW < 0.02);
    record('/works/work-1', 'wall: piece height within 2%', `${(errH * 100).toFixed(2)}%`, errH < 0.02);
    // Smooth: drag the piece with the CPU slowed 4× (a mid-range phone) and time the frames.
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
    await page.evaluate(() => {
      window.__frames = [];
      const tick = t => {
        window.__frames.push(t);
        if (window.__frames.length < 400) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (pb) {
      const cx = pb.x + pb.width / 2,
        cy = pb.y + pb.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 80, cy + 60, {steps: 60});
      await page.mouse.move(cx - 60, cy - 40, {steps: 60});
      await page.mouse.up();
    }
    const gaps = await page.evaluate(() => window.__frames.slice(1).map((t, i) => t - window.__frames[i]));
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
    const sorted = [...gaps].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 999;
    record(
      '/works/work-1',
      'wall: drag frames p95 at 4× slower CPU (ms)',
      p95.toFixed(1),
      p95 <= 34,
      `${gaps.length} frames`,
    );
    const moved = await page.locator('.wall-piece').boundingBox();
    record(
      '/works/work-1',
      'wall: the piece moves',
      moved && pb ? `${Math.round(moved.x - pb.x)} px` : '-',
      !!moved && !!pb && Math.abs(moved.x - pb.x) > 20,
    );
    const [dl] = await Promise.all([
      page.waitForEvent('download', {timeout: 8000}).catch(() => null),
      page.locator('.wall-tools button', {hasText: 'Save picture'}).click(),
    ]);
    const saved = dl ? readFileSync(await dl.path()) : null;
    record(
      '/works/work-1',
      'wall: Save picture gives a JPEG',
      saved ? `${saved.length} B` : 'none',
      !!saved && saved[0] === 0xff && saved[1] === 0xd8,
    );
    // The live way's model, made from the piece's WebP in this browser: a USDZ with the layer first and a JPEG.
    const usdz = await page
      .evaluate(async () => {
        const b = document.querySelector('[data-wall]').dataset;
        const blob = await window.StudioWall.build(b, window.StudioWallCore.pieceSize(b));
        const u = new Uint8Array(await blob.arrayBuffer());
        const name = new TextDecoder().decode(u.subarray(30, 30 + new DataView(u.buffer).getUint16(26, true)));
        return {size: u.length, first: name, jpeg: new TextDecoder('latin1').decode(u).includes('art.jpeg')};
      })
      .catch(e => ({error: String(e)}));
    record(
      '/works/work-1',
      'wall: live model builds (USDZ, layer first)',
      JSON.stringify(usdz),
      usdz.first === 'model.usda' && usdz.jpeg,
    );
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    record('/works/work-1', 'wall: no sideways scroll', sw.join('<='), sw[0] <= sw[1]);
    record('(scripts)', 'wall: no page errors', errors.length, errors.length === 0, errors[0] ?? '');
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
  // Three runs, scored on the one with the median LCP (Lighthouse's own advice for run-to-run variance: the same build
  // measured 1.65 s and 2.1 s on different runners).
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const file = join(out, `lighthouse-${i}-${name}`);
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
      break;
    }
    runs.push(JSON.parse(readFileSync(file, 'utf8')));
  }
  if (runs.length < 3) continue;
  const lcpOf = lh => lh.audits['largest-contentful-paint'].numericValue;
  const lh = [...runs].sort((a, b) => lcpOf(a) - lcpOf(b))[1];
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
  // When it fails, say where the time went (LCP phases), so a slow run can be told from a slower page.
  const phases = (lh.audits['lcp-breakdown-insight']?.details?.items ?? [])
    .flatMap(i => i.items ?? [i])
    .filter(i => i && (i.subpart || i.phase || i.label) && typeof (i.duration ?? i.timing) === 'number')
    .map(i => `${i.subpart ?? i.phase ?? i.label} ${Math.round(i.duration ?? i.timing)}`)
    .join(', ');
  if (lcp > LCP_MAX) {
    // What the page asked for, in order, and which element was the LCP: enough to see what holds it back.
    const el = lh.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet;
    console.log(`LCP-DEBUG ${p} element: ${el}`);
    for (const r of lh.audits['network-requests']?.details?.items ?? [])
      console.log(
        `LCP-DEBUG ${p} ${r.resourceType} ${r.priority} ${Math.round(r.networkRequestTime)}-${Math.round(r.networkEndTime)} ${r.transferSize} ${r.url.replace(server.url, '')}`,
      );
  }
  record(
    p,
    'lighthouse LCP (ms), median of 3',
    lcp,
    lcp <= LCP_MAX,
    runs.map(x => Math.round(lcpOf(x))).join(' / ') + (lcp > LCP_MAX && phases ? ` · ${phases}` : ''),
  );
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
