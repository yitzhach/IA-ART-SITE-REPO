// A smoke test of a deployed site (Site 3.0 stage 3): a phone-sized Chromium against the real Workers, the real
// assistant and the real catalogue. Run by Art-Talk-Back's "Deploy staging" after it deploys (input `smoke`), where the
// runner can reach workers.dev. It asks the assistant two questions (a fraction of a cent) and sends no leads, so no
// email reaches the studio. Usage: node tests/staging-smoke.mjs https://studio-site-staging.example.workers.dev
import {mkdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!/^https:\/\//.test(base)) throw new Error('Give the site address, e.g. https://studio-site-staging.…workers.dev');
const out = 'smoke-shots';
mkdirSync(out, {recursive: true});

const results = [];
const check = async (name, fn) => {
  const t = Date.now();
  try {
    const detail = await fn();
    results.push({name, ok: true, ms: Date.now() - t, detail: detail ?? ''});
    console.log(`PASS  ${name}${detail ? `: ${detail}` : ''}`);
  } catch (e) {
    results.push({name, ok: false, ms: Date.now() - t, detail: String(e?.message ?? e).slice(0, 500)});
    console.log(`FAIL  ${name}: ${String(e?.message ?? e).slice(0, 500)}`);
  }
};

const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
const ctx = await browser.newContext({
  viewport: {width: 390, height: 844},
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

/** Sends a question in the open sheet and waits for a new assistant message; returns it. */
async function askSheet(q) {
  const before = await page.locator('.msg.user').count();
  await page.fill('#q', q);
  await page.press('#q', 'Enter');
  try {
    // The sheet shows "…" (.dots) while it waits, then redraws the log with the answer.
    await page.waitForFunction(
      n => document.querySelectorAll('.msg.user').length > n && !document.querySelector('.sheet .dots'),
      before,
      {timeout: 45000},
    );
  } catch {
    const sheet = (
      await page
        .locator('.sheet')
        .innerText()
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .slice(0, 600);
    throw new Error(`no answer within 45 s; the sheet shows: ${sheet}`);
  }
  return page.locator('.msg.assistant').last();
}

let slug = '';
let phone = '';
await check('home page loads with Ask in the header', async () => {
  const res = await page.goto(base + '/', {waitUntil: 'load'});
  if (res.status() !== 200) throw new Error(`status ${res.status()}`);
  slug = await page.getAttribute('body', 'data-slug');
  if (!slug) throw new Error('no data-slug on <body>');
  await page.locator('[data-ask]').first().waitFor({state: 'visible', timeout: 10000});
  return `studio ${slug}`;
});

await check('the assistant is on', async () => {
  const r = await page.request.get(`${base}/v1/public/studios/${slug}/assistant`);
  const a = await r.json();
  if (!a.available) throw new Error(`available=false: ${JSON.stringify(a).slice(0, 200)}`);
  return `artist "${a.artistName}", ${Object.keys(a.answers || {}).length} answers`;
});

await check('the phone number is never whole in a page', async () => {
  const s = await (await page.request.get(`${base}/v1/public/studios/${slug}`)).json();
  phone = (s.phone || '').replace(/\D/g, '');
  if (!phone) return 'no phone set';
  const bad = [];
  for (const p of ['/', '/works', '/commissions', '/process', '/about', '/ask', '/inquiry', '/contact', '/llms.txt']) {
    const html = await (await page.request.get(base + p)).text();
    if (html.replace(/\D/g, '').includes(phone)) bad.push(p);
  }
  if (bad.length) throw new Error(`whole number in ${bad.join(', ')}`);
  return 'checked 9 pages';
});

let answered = false;
await check('Ask: a real answer with cards from the catalogue', async () => {
  await page.locator('[data-ask]').first().click();
  await page.locator('#q').waitFor({timeout: 10000});
  const answer = await askSheet('Something blue for a living room?');
  const text = await answer.locator('p').first().innerText();
  const cards = answer.locator('.acard');
  if (!(await cards.count())) throw new Error(`no cards; it said "${text.slice(0, 300)}"`);
  const titles = await cards.locator('.ttl').allInnerTexts();
  await page.screenshot({path: `${out}/ask-answer.png`});
  answered = true;
  return `"${text.slice(0, 160)}" → ${titles.join(', ')}`;
});

await check('every card links to a real piece', async () => {
  if (!answered) throw new Error('no answer to check');
  const hrefs = await page
    .locator('.msg.assistant')
    .last()
    .locator('.acard a')
    .evaluateAll(as => as.map(a => a.getAttribute('href')));
  for (const h of hrefs) {
    const r = await page.request.get(base + h);
    if (r.status() !== 200) throw new Error(`${h} → ${r.status()}`);
  }
  return `${hrefs.length} pieces`;
});

await check('Open these as a page', async () => {
  if (!answered) throw new Error('no answer to make a page from');
  await page.locator('.msg.assistant:has(.acard)').last().getByRole('button', {name: 'Open these as a page'}).click();
  const link = page.locator('.made a').last();
  await link.waitFor({timeout: 15000});
  const href = await link.getAttribute('href');
  const r = await page.request.get(base + new URL(href, base).pathname);
  const html = await r.text();
  if (r.status() !== 200 || !/noindex/.test(html)) throw new Error(`${href} → ${r.status()}`);
  return new URL(href, base).pathname;
});

await check('a question it cannot answer offers Text, Email and Call', async () => {
  const last = await askSheet('Do you install the pieces in my home in Denver?');
  const text = await last.locator('p').first().innerText();
  const buttons = await last.getByRole('button').allInnerTexts();
  await page.screenshot({path: `${out}/ask-handoff.png`});
  if (!buttons.some(b => /text|email|call|send/i.test(b)))
    throw new Error(`no contact buttons; said "${text.slice(0, 200)}"`);
  return `"${text.slice(0, 160)}"`;
});

await check('Text shows the number only after a tap', async () => {
  if (!phone) return 'no phone set';
  const last = page.locator('.msg.assistant').last();
  const before = (await page.locator('.sheet').innerText()).replace(/\D/g, '');
  if (before.includes(phone)) throw new Error('number visible before the tap');
  await last.getByRole('button', {name: 'Text'}).first().click();
  const n = page.locator('.the-number');
  await n.waitFor({timeout: 5000});
  if (!(await n.innerText()).replace(/\D/g, '').includes(phone.slice(-7))) throw new Error('wrong number shown');
  const href = await page.locator('a[href^="sms:"]').first().getAttribute('href');
  return href.slice(0, 40) + '…';
});

await check('Add to inquiry, then /inquiry lists it', async () => {
  await page.keyboard.press('Escape');
  await page.goto(base + '/works', {waitUntil: 'load'});
  const first = await page
    .locator('a[href^="/works/"]')
    .evaluateAll(as => as.map(a => a.getAttribute('href')).find(h => /^\/works\/[a-z0-9-]+$/.test(h)));
  await page.goto(base + first, {waitUntil: 'load'});
  const add = page.locator('[data-inquiry]').first();
  await add.waitFor({state: 'visible', timeout: 10000});
  await add.click();
  await page.goto(base + '/inquiry', {waitUntil: 'load'});
  await page.getByRole('button', {name: 'PNG'}).waitFor({timeout: 15000});
  await page.screenshot({path: `${out}/inquiry.png`, fullPage: true});
  return first;
});

for (const kind of ['PNG', 'JPEG']) {
  await check(`Download the inquiry sheet as ${kind}`, async () => {
    const [dl] = await Promise.all([
      page.waitForEvent('download', {timeout: 30000}),
      page.getByRole('button', {name: kind}).click(),
    ]);
    const path = `${out}/${dl.suggestedFilename()}`;
    await dl.saveAs(path);
    const {statSync} = await import('node:fs');
    const size = statSync(path).size;
    if (size < 5000) throw new Error(`only ${size} bytes`);
    return `${dl.suggestedFilename()}, ${Math.round(size / 1024)} KB`;
  });
}

await check('See it on your wall: true size within 2% on a test photo, and the live model builds', async () => {
  // Stage 5. Uses a made-up wall photo (never a real one) with a 36 in bar drawn 12 px to the inch.
  await page.goto(base + '/works', {waitUntil: 'load'});
  const hrefs = await page
    .locator('a[href^="/works/"]')
    .evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')).filter(h => /^\/works\/[a-z0-9-]+$/.test(h)))]);
  let found = null;
  for (const h of hrefs.slice(0, 12)) {
    await page.goto(base + h, {waitUntil: 'load'});
    if (await page.locator('[data-wall]').count()) {
      found = h;
      break;
    }
  }
  if (!found) throw new Error('no piece with a size and a picture among the first 12');
  const b = await page.locator('[data-wall]').evaluate(e => ({...e.dataset}));
  const live = await page.evaluate(async () => {
    const d = document.querySelector('[data-wall]');
    d.click();
    for (let i = 0; i < 50 && !window.StudioWall; i++) await new Promise(r => setTimeout(r, 100));
    const blob = await window.StudioWall.build(d.dataset, window.StudioWallCore.pieceSize(d.dataset));
    return blob.size;
  });
  const sharp = (await import('sharp')).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="100%" height="100%" fill="#d8d2c4"/><line x1="200" y1="900" x2="632" y2="900" stroke="#c33" stroke-width="6"/></svg>`;
  await page.setInputFiles('#wall-file', {
    name: 'wall.jpg',
    mimeType: 'image/jpeg',
    buffer: await sharp(Buffer.from(svg)).jpeg().toBuffer(),
  });
  await page.waitForFunction(() => document.querySelector('.wall-img')?.complete, null, {timeout: 10000});
  await page.locator('.wall-img').scrollIntoViewIfNeeded();
  const box = await page.locator('.wall-img').boundingBox();
  const s = box.width / 1600;
  await page.mouse.click(box.x + 200 * s, box.y + 900 * s);
  await page.mouse.click(box.x + 632 * s, box.y + 900 * s);
  await page.locator('#wall-len').fill('36');
  await page.locator('.wall-len button').click();
  await page.waitForSelector('.wall-piece:not([hidden])', {timeout: 5000});
  const pb = await page.locator('.wall-piece').boundingBox();
  const size = await page.evaluate(d => window.StudioWallCore.pieceSize(d), b);
  const err = Math.abs(pb.width / (size.widthIn * 12 * s) - 1);
  await page.screenshot({path: `${out}/wall.png`, fullPage: false});
  if (err >= 0.02) throw new Error(`width off by ${(err * 100).toFixed(2)}%`);
  await page.keyboard.press('Escape');
  return `${found}: ${(err * 100).toFixed(2)}% off, model ${Math.round(live / 1024)} KB`;
});

// Stage 6: following and collector links (no code is sent and no collector is made here).
await check('Follow the studio: the footer links to it and its form shows', async () => {
  await page.goto(base + '/works', {waitUntil: 'load'});
  if (!(await page.locator('footer a[href="/follow"]').count())) throw new Error('no footer link to /follow');
  const res = await page.goto(base + '/follow', {waitUntil: 'load'});
  if (res.status() !== 200) throw new Error(`status ${res.status()}`);
  await page.locator('[data-follow] input[type=email]').waitFor({state: 'visible', timeout: 10000});
  await page.screenshot({path: `${out}/follow.png`, fullPage: false});
  return 'form shown';
});

await check('AI search: robots.txt names the crawlers, llms.txt and the About Person (card E)', async () => {
  const robots = await (await page.request.get(base + '/robots.txt')).text();
  for (const a of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot'])
    if (!robots.includes(`User-agent: ${a}`)) throw new Error(`robots.txt doesn't name ${a}`);
  const llms = await page.request.get(base + '/llms.txt');
  if (llms.status() !== 200) throw new Error(`llms.txt status ${llms.status()}`);
  const t = await llms.text();
  if (!t.startsWith('# ') || !t.includes('/works)')) throw new Error(`llms.txt starts: ${t.slice(0, 120)}`);
  const about = await (await page.request.get(base + '/about')).text();
  if (!/"@type":"Person"/.test(about)) throw new Error('no Person data on /about');
  return `${t.split('\n').filter(l => l.startsWith('- [')).length} links in llms.txt`;
});

await check('a made-up collector link shows nothing', async () => {
  const fake = 'smokeTestNotARealLink0000';
  const res = await page.goto(`${base}/c/${fake}`, {waitUntil: 'load'});
  if (res.status() !== 404) throw new Error(`page status ${res.status()}`);
  const api = await page.request.get(`${base}/v1/public/studios/${slug}/collectors/${fake}`);
  if (api.status() !== 404) throw new Error(`api status ${api.status()}`);
  return '404';
});

await check('no script errors on any page', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});

await browser.close();
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} smoke checks passed`);
process.exit(failed ? 1 : 0);
