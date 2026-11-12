// A local copy of the public site for checks and pictures: the site's Worker code with the fake studio-api
// (tests/site/fake-api.ts), plus the built files in public/ and made-up WebP pictures. Never real data.
// Run: node tests/site/serve.mjs [port]   (default 8790). Import { start } to use it from another script.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';

const root = new URL('../..', import.meta.url).pathname;
const TYPES = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

async function load() {
  const outDir = join(root, 'test-results', 'site-serve');
  mkdirSync(outDir, {recursive: true});
  const outfile = join(outDir, 'site.mjs');
  await build({
    stdin: {contents: "export * from './tests/site/fake-api.ts';", resolveDir: root, loader: 'ts'},
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
    logLevel: 'error',
    loader: {'.json': 'json'},
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}

const pictures = new Map();
async function picture(id, width) {
  const key = `${id}/${width}`;
  if (!pictures.has(key)) {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const hue = h % 360;
    const height = Math.round(width * 1.25);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},25%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},30%,30%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    pictures.set(key, await sharp(Buffer.from(svg)).webp({quality: 70}).toBuffer());
  }
  return pictures.get(key);
}

export async function start(port = 8790) {
  const mod = await load();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      const img = /^\/v1\/public\/studios\/[^/]+\/images\/([A-Z0-9]+)\/(480|960|1600)\.webp$/.exec(url.pathname);
      if (img) {
        res.writeHead(200, {'content-type': 'image/webp', 'cache-control': 'public, max-age=86400'});
        return res.end(await picture(img[1], Number(img[2])));
      }
      const file = normalize(join(root, 'public', url.pathname));
      if (file.startsWith(join(root, 'public')) && extname(file) && existsSync(file)) {
        res.writeHead(200, {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'public, max-age=86400',
        });
        return res.end(readFileSync(file));
      }
      if (url.pathname.startsWith('/v1/') && req.method === 'GET') {
        const a = await mod.api.fetch(`https://studio-api${url.pathname}${url.search}`);
        res.writeHead(a.status, {'content-type': 'application/json'});
        return res.end(await a.text());
      }
      if (url.pathname === '/ask/chat' && req.method === 'POST') {
        const w = mod.fixture.works[0];
        res.writeHead(200, {'content-type': 'application/json'});
        return res.end(
          JSON.stringify({
            threadId: 'T1',
            text: 'Here is one that fits.',
            works: [
              {
                slug: w.slug,
                title: w.title,
                medium: w.medium,
                year: w.year,
                width: w.width,
                height: w.height,
                depth: null,
                sizeUnit: w.sizeUnit,
                status: w.status,
                priceCents: w.priceCents,
                currency: w.currency,
                collection: w.collection,
                tags: [],
                palette: [],
                blurb: null,
                image: w.images[0].sizes[0].url,
              },
            ],
            replies: ['Tell me more'],
            askArtist: false,
            limited: null,
          }),
        );
      }
      const r = await mod.get(url.pathname + url.search, {method: req.method});
      const headers = Object.fromEntries(r.res.headers);
      res.writeHead(r.status, headers);
      res.end(r.text);
    } catch (e) {
      res.writeHead(500);
      res.end(String(e?.stack ?? e));
    }
  });
  await new Promise(ok => server.listen(port, ok));
  return {
    url: `http://localhost:${port}`,
    close: () => new Promise(ok => server.close(ok)),
    fixture: () => mod.fixture,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await start(Number(process.argv[2] ?? 8790));
  console.log(`Site with test data: ${s.url}`);
}
