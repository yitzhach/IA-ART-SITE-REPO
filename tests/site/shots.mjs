// Pictures of the public pages for a look by eye: 390×844 and 1280×900, light and dark, full page, from the local
// copy of the site (serve.mjs, fake data). Fails if a page scrolls sideways. A last pass with scripts off checks the
// content is still there. Run: node tests/site/shots.mjs   → test-results/site-shots/
import {mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {start} from './serve.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const out = join(new URL('../..', import.meta.url).pathname, 'test-results', 'site-shots');
mkdirSync(out, {recursive: true});

const PAGES = ['/', '/works', '/works/work-1', '/commissions', '/process', '/about'];
const SIZES = [
  [390, 844],
  [1280, 900],
];
const name = p => (p === '/' ? 'home' : p.slice(1).replace(/\//g, '_'));

const server = await start(Number(process.env.PORT ?? 8796));
const browser = await chromium.launch();
const problems = [];
try {
  for (const [width, height] of SIZES)
    for (const colorScheme of ['light', 'dark']) {
      const ctx = await browser.newContext({viewport: {width, height}, colorScheme});
      const page = await ctx.newPage();
      for (const p of PAGES) {
        await page.goto(server.url + p, {waitUntil: 'networkidle'});
        await page.evaluate(async () => {
          // bring lazy pictures in before the full-page picture
          for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
            scrollTo(0, y);
            await new Promise(r => setTimeout(r, 40));
          }
          scrollTo(0, 0);
          await document.fonts.ready;
        });
        await page.waitForLoadState('networkidle');
        const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        if (w[0] > w[1]) problems.push(`${p} at ${width}px ${colorScheme}: scrollWidth ${w[0]} > ${w[1]}`);
        await page.screenshot({path: join(out, `${name(p)}-${width}-${colorScheme}.png`), fullPage: true});
      }
      await ctx.close();
    }
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, javaScriptEnabled: false});
  const page = await ctx.newPage();
  for (const p of PAGES) {
    await page.goto(server.url + p, {waitUntil: 'networkidle'});
    const r = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent?.trim(),
      text: document.querySelector('main')?.innerText.length ?? 0,
      contact: ['Text', 'Email', 'Call'].every(t => [...document.querySelectorAll('a')].some(a => a.textContent === t)),
      hiddenShown: [...document.querySelectorAll('[hidden]')].some(e => getComputedStyle(e).display !== 'none'),
    }));
    if (!r.h1 || r.text < 100 || !r.contact || r.hiddenShown)
      problems.push(`${p} without scripts: ${JSON.stringify(r)}`);
    await page.screenshot({path: join(out, `${name(p)}-390-noscript.png`), fullPage: true});
  }
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`ok: ${PAGES.length * 5} pictures in ${out}`);
