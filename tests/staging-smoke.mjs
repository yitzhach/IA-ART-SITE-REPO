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
  for (const p of ['/', '/works', '/commissions', '/process', '/about', '/ask', '/inquiry', '/contact']) {
    const html = await (await page.request.get(base + p)).text();
    if (html.replace(/\D/g, '').includes(phone)) bad.push(p);
  }
  if (bad.length) throw new Error(`whole number in ${bad.join(', ')}`);
  return 'checked 8 pages';
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

await check('no script errors on any page', async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});

await browser.close();
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} smoke checks passed`);
process.exit(failed ? 1 : 0);
