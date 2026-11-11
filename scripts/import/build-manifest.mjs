#!/usr/bin/env node
// Builds src/import/manifest.json from a checkout of the current site (offline; no network, no database).
// Usage: node scripts/import/build-manifest.mjs [--site /path/to/IA-ART-Claude-Code] [--previews /tmp/claude-0/import-previews]
// See scripts/import/README.md.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {parsePage, visibleBlocks} from './parse-pages.mjs';
import {dhashFromGrey} from './group.mjs';
import {assemble} from './assemble.mjs';

const SHA = 'f89c3f0dc94a1c909cb96b099a1c56e060129078';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const site = path.resolve(arg('--site', '/home/user/IA-ART-Claude-Code'));
const previews = arg('--previews', '/tmp/claude-0/import-previews');
const out = path.join(root, 'src/import/manifest.json');

try {
  const head = execFileSync('git', ['-C', site, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  if (head !== SHA) console.warn(`Warning: ${site} is at ${head}, but the manifest is pinned to ${SHA}.`);
} catch {
  console.warn(`Warning: could not read the git commit of ${site}.`);
}

const PAGES = [
  'collection-abstract.html',
  'collection-figurative.html',
  'collection-sculptural.html',
  'available.html',
];
const slots = PAGES.flatMap(p => parsePage(fs.readFileSync(path.join(site, p), 'utf8'), p));

// library.state.json: an item counts only if its file is in the repo.
const skipped = [];
const library = JSON.parse(fs.readFileSync(path.join(site, 'library.state.json'), 'utf8'));
for (const it of library.items ?? []) {
  const rel = `images/${it.f}`;
  if (fs.existsSync(path.join(site, rel))) {
    slots.push({
      id: it.f.replace(/\.webp$/, ''),
      page: 'library.state.json',
      collection: null,
      number: 0,
      title: it.t || undefined,
      year: it.y ? Number(it.y) : undefined,
      medium: it.mat || undefined,
    });
  } else skipped.push({path: rel, reason: `library item "${it.t}": its file is not in the repo`});
}

const SKIP_REASONS = [
  [/^hero-/, 'hero (banner) image, not a work'],
  [/^process-/, 'process photo, not a work'],
  [/^insitu-/, 'a work installed in a room, not a work'],
  [/^about-/, 'about-page photo, not a work'],
  [/^ref-/, 'reference image on the Available page, not a work'],
  [/^shows?-/, 'art-show photo, not a work'],
  [/^thumb-/, 'thumbnail on the gallery page, not a work'],
  [/^commission-/, 'commissions-page photo, not a work'],
  [/^library/, 'image-library placeholder, not a work'],
  [/^object-/, 'object detail image on the gallery page, not a work'],
];
const isWorkFile = f => /^(abstract|figurative|sculptural|available)-\d+(-hi|-full)?\.webp$/.test(f);
const imageDir = path.join(site, 'images');
const names = fs
  .readdirSync(imageDir)
  .filter(f => f.endsWith('.webp'))
  .sort();
const files = [];
for (const f of names) {
  const rel = `images/${f}`;
  const libraryFile = slots.some(s => s.page === 'library.state.json' && `${s.id}.webp` === f);
  if (!isWorkFile(f) && !libraryFile) {
    const why = SKIP_REASONS.find(([re]) => re.test(f))?.[1] ?? 'not a collection or Available image';
    skipped.push({path: rel, reason: why});
    continue;
  }
  const file = path.join(imageDir, f);
  const meta = await sharp(file).metadata();
  const grey = await sharp(file).greyscale().resize(9, 8, {fit: 'fill'}).raw().toBuffer();
  files.push({
    path: rel,
    hash: dhashFromGrey(grey),
    width: meta.width,
    height: meta.height,
    bytes: fs.statSync(file).size,
  });
}

const {works, skipped: orphans} = assemble({files, slots, sha: SHA});
skipped.push(...orphans);
skipped.sort((a, b) => a.path.localeCompare(b.path));

// A style sample: the site's own copy from process.html and commissions.html, ~1,500 characters.
function voiceSample() {
  const blocks = ['process.html', 'commissions.html'].flatMap(p =>
    visibleBlocks(fs.readFileSync(path.join(site, p), 'utf8')).filter(
      b => b.length > 60 && !b.includes('{{') && !/^(Something went wrong|Thank you —|©)/.test(b),
    ),
  );
  let text = '';
  for (const b of blocks) {
    if (text.length + b.length + 1 > 1500) break;
    text += (text ? '\n' : '') + b;
  }
  return text;
}

const manifest = {sha: SHA, generatedAt: new Date().toISOString(), works, skipped, voice: voiceSample()};
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
const drafts = path.join(root, 'src/import/drafts.json');
if (!fs.existsSync(drafts)) fs.writeFileSync(drafts, '{}\n');

// Previews for the assistant's descriptions: not committed.
fs.mkdirSync(previews, {recursive: true});
for (const w of works)
  await sharp(path.join(site, w.source.path))
    .resize({width: 800, withoutEnlargement: true})
    .jpeg({quality: 80})
    .toFile(path.join(previews, `${w.key}.jpg`));

const merges = works.filter(w => w.alsoFrom.length);
console.log(`${works.length} works, ${skipped.length} skipped, ${merges.length} works made from several pictures.`);
console.log(`Wrote ${path.relative(root, out)} and ${works.length} previews in ${previews}.`);
