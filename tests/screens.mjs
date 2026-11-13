// Screenshots + no-sideways-scroll check of every owner screen, against mocked /v1 and /assistant.
// Run: npm run test:screens  (builds first; set SKIP_BUILD=1 to reuse dist/).
import {execSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdirSync, readFileSync, existsSync, statSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {extname, join, normalize} from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const out = join(root, 'test-results', 'screens');
if (!process.env.SKIP_BUILD) execSync('npm run build', {cwd: root, stdio: 'inherit'});
mkdirSync(out, {recursive: true});

// ---- tiny PNG maker
const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};
function png(w, h, [r1, g1, b1], [r2, g2, b2]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = (x / w + y / h) / 2;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r1 + (r2 - r1) * t;
      raw[o + 1] = g1 + (g2 - g1) * t;
      raw[o + 2] = b1 + (b2 - b1) * t;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- fixtures
const palettes = [
  [
    [168, 74, 36],
    [240, 200, 150],
  ],
  [
    [30, 60, 110],
    [150, 190, 220],
  ],
  [
    [40, 90, 60],
    [200, 220, 170],
  ],
  [
    [90, 40, 90],
    [230, 170, 200],
  ],
];
const sizesPx = [
  [800, 1000],
  [1000, 800],
  [900, 900],
  [800, 1200],
];
const now = '2026-11-01T10:00:00.000Z';
const base = i => ({
  studioId: 'S1',
  createdAt: `2026-10-0${i + 1}T10:00:00.000Z`,
  updatedAt: now,
  createdBy: 'U1',
  actorType: 'user',
  version: 1,
  deletedAt: null,
  meta: {},
  inventoryCode: 'IA-' + i,
  currency: 'USD',
  sizeUnit: 'in',
  depth: null,
  editionSize: null,
  slug: null,
  palette: [],
  tags: [],
  collection: null,
  draftedFields: [],
  public: false,
  publishedAt: null,
  description: '',
  medium: '',
  year: null,
  width: null,
  height: null,
  priceCents: null,
  status: 'available',
});
const titles = [
  'Harbour at Dusk',
  'Red Study No. 4',
  'Quiet Field',
  'Figure in Blue',
  'Stone and Salt',
  'Morning Light',
  'A Very Long Title for a Painting That Keeps Going',
  'Small Sketch',
];
const works = titles.map((title, i) => {
  const [a, b] = palettes[i % 4];
  const [pw, ph] = sizesPx[i % 4];
  const img = {
    id: `F${i}`,
    name: `p${i}.jpg`,
    contentType: 'image/jpeg',
    size: 1000,
    kind: 'photo',
    status: 'ready',
    entityType: 'artwork',
    entityId: `W${i}`,
    locked: false,
    position: 0,
    altText: i % 2 ? 'A calm painting in soft colours' : null,
    ...base(i),
    meta: {pixels: {width: pw, height: ph}},
  };
  const w = {...base(i), id: `W${i}`, title, primaryFileId: `F${i}`, _img: img, _col: [a, b]};
  if (i < 3)
    Object.assign(w, {
      public: true,
      publishedAt: now,
      slug: 'work-' + i,
      width: 24,
      height: 36,
      priceCents: 120000 + i * 5000,
      medium: 'Oil on canvas',
      year: 2024,
      collection: i === 1 ? 'Abstract' : 'Figurative',
      palette: [
        {hex: '#a34a24', share: 4000},
        {hex: '#f0c896', share: 3000},
        {hex: '#2a3a4a', share: 3000},
      ],
    });
  if (i === 2) w.status = 'sold';
  if (i >= 3)
    Object.assign(w, {
      description: 'Soft layers of colour settle into a quiet scene, edges left loose on purpose.',
      tags: ['landscape', 'quiet', 'blue'],
      collection: 'Figurative',
      draftedFields: ['description', 'tags', 'collection', 'altText'],
    });
  if (i === 4) Object.assign(w, {width: 12, height: 12, priceCents: 40000});
  return w;
});
// two site photos (public, so they are not drafts): kept out of the works list, offered first by the Site picker
for (const [i, title] of [
  [8, 'Studio wall'],
  [9, 'Hands in plaster'],
]) {
  const img = {
    ...works[0]._img,
    ...base(i),
    id: `F${i}`,
    entityId: `SP${i}`,
    meta: {pixels: {width: 1000, height: 800}},
  };
  works.push({
    ...base(i),
    id: `SP${i}`,
    title,
    kind: 'site_photo',
    public: true,
    publishedAt: now,
    status: 'not_for_sale',
    primaryFileId: `F${i}`,
    meta: {importedFrom: {key: `sp-${i}`, page: 'site-photo'}},
    _img: img,
    _col: palettes[i % 4],
  });
}
const siteSettings = () => ({
  studioId: 'S1',
  version: 3,
  currency: 'USD',
  timezone: 'America/Los_Angeles',
  meta: {
    voice: 'v',
    siteImport: {sha: 'x', keys: [], siteStep: 'x'},
    site: {
      name: 'Isaac Anderson',
      tagline: 'Revelation in the midst of decay.',
      description:
        'Site-specific sculptural work in cement and plaster — for private collections, commercial, interior and exterior.',
      phone: '+15555550100',
      email: 'studio@example.com',
      hours: {from: '09:00', to: '18:00'},
      pages: {
        home: {
          title: 'Isaac Anderson',
          lede: 'Site-specific sculptural work in cement and plaster.',
          sections: [
            {key: 'gallery', heading: 'Gallery', body: 'Site-specific work, framed by project type.'},
            {key: 'room-1', heading: 'Images', body: 'Residential + commercial', place: 'home.rooms'},
            {
              key: 'collections',
              heading: 'Collections',
              body: 'A partial index.\n\n• No. 014 · Abstract\n• No. 009 · Figurative',
            },
          ],
        },
        commissions: {title: 'Commissions', lede: 'Developed with architects, designers and collectors.'},
        process: {title: 'Process', sections: [{key: 'surface', heading: 'Surface', body: 'Building the surface.'}]},
      },
      photos: {
        'home.hero': ['SP8', 'W0', 'SP9'],
        'home.rooms': ['W1'],
        'about.studio': ['SP9'],
        'process.surface': ['W3'],
      },
    },
  },
});
const clean = ({_img, _col, ...w}) => w;
const detail = w => ({...clean(w), images: [w._img]});

// ---- static server
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
};
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let f = join(dist, p);
  if (!f.startsWith(dist) || !existsSync(f) || statSync(f).isDirectory()) f = join(dist, 'index.html');
  res.writeHead(200, {'content-type': types[extname(f)] ?? 'application/octet-stream'});
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---- mocks
const meBody = {
  user: {id: 'U1', email: 'isaac@example.com', name: 'Isaac'},
  memberships: [{studioId: 'S1', studioName: 'Booth Studio', role: 'owner', clientId: null}],
  activeStudioId: 'S1',
  hasPassword: false,
};
async function mock(page, {signedIn = true} = {}) {
  const auth = {signedIn};
  const state = works.map(w => ({...w})); // fresh per page
  const lw = (i, st = 'available') => ({
    id: `W${i}`,
    slug: `work-${i}`,
    title: titles[i],
    status: st,
    priceCents: i === 2 ? null : 120000,
    currency: 'USD',
  });
  const lead = (o, i) => ({
    id: `L${i}`,
    version: 1,
    kind: 'inquiry',
    source: 'chat',
    status: 'new',
    name: null,
    email: null,
    phone: null,
    note: null,
    works: [lw(0)],
    fileIds: [],
    clientId: null,
    threadId: null,
    expiresAt: null,
    createdAt: '2026-11-12T16:00:00Z',
    updatedAt: '2026-11-12T16:00:00Z',
    ...o,
  });
  const leads = [
    lead(
      {
        kind: 'hold',
        name: 'Ann Rivera',
        email: 'ann@example.com',
        phone: '+19495550123',
        note: 'We love the blue. Can you hold it until Friday?',
        works: [lw(1)],
        fileIds: ['F1', 'F2'],
        threadId: 'T1',
      },
      1,
    ),
    lead(
      {
        status: 'held',
        kind: 'hold',
        phone: '+19495550199',
        works: [lw(0, 'reserved')],
        expiresAt: '2026-11-14T20:00:00Z',
      },
      2,
    ),
    lead({email: 'designer-with-a-very-long-address@example-studio.com', works: [lw(0), lw(1), lw(2)]}, 3),
  ];
  const leadChat = [
    {role: 'user', text: 'Something blue for a living room?', works: [], at: now},
    {role: 'assistant', text: 'Figure in Blue is 30 x 40 in, available now.', works: ['W1'], at: now},
  ];
  let settings = siteSettings();
  const json = (route, body, status = 200) =>
    route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
  await page.route(
    u => u.origin !== origin,
    r =>
      r.request().url().includes('fonts.googleapis')
        ? r.fulfill({status: 200, contentType: 'text/css', body: ''})
        : r.abort(),
  );
  await page.route('**/mock-img/**', r => {
    const m = /F(\d+)/.exec(r.request().url());
    const [a, b] = palettes[Number(m?.[1] ?? 0) % 4];
    return r.fulfill({status: 200, contentType: 'image/png', body: png(96, 120, a, b)});
  });
  await page.route('**/assistant/**', r => json(r, {status: 'drafting'}, 202));
  await page.route('**/v1/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/v1', '');
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    if (path === '/auth/password/login') {
      auth.signedIn = true;
      return json(route, meBody);
    }
    if (path === '/me')
      return auth.signedIn
        ? json(route, {
            user: {id: 'U1', email: 'isaac@example.com', name: 'Isaac'},
            memberships: [
              {
                studioId: 'S1',
                studioName: 'Isaac Anderson Art',
                studioSlug: 'isaac-anderson-art-abc123',
                role: 'owner',
                clientId: null,
              },
            ],
            activeStudioId: 'S1',
            hasPassword: false,
          })
        : json(route, {error: {code: 'unauthorized', message: 'Sign in'}}, 401);
    if (path === '/site/counts')
      return json(route, {
        days: 30,
        from: '2026-10-15',
        totals: {view: 1240, ask: 31, wall: 12, inquiry: 9, question: 22, lead: 4, order: 1},
        topWorks: [{id: 'W1', title: 'Lifted Up', slug: 'lifted-up', view: 310, ask: 4, wall: 3, inquiry: 2}],
      });
    if (path === '/settings' && method === 'GET') return json(route, settings);
    if (path === '/settings' && method === 'PATCH') {
      if (Number(req.headers()['if-match']) !== settings.version)
        return json(route, {error: {code: 'conflict', message: 'Changed'}}, 409);
      if (body.meta?.site?.phone && !/^\+?[0-9]{7,15}$/.test(body.meta.site.phone))
        return json(
          route,
          {
            error: {
              code: 'bad_request',
              message: 'Invalid',
              details: {issues: [{path: ['meta', 'site', 'phone'], message: 'Not a phone number'}]},
            },
          },
          400,
        );
      settings = {...settings, ...body, version: settings.version + 1};
      return json(route, settings);
    }
    if (path === '/artworks' && method === 'GET')
      return json(route, {items: state.filter(w => !w.deletedAt).map(clean), nextCursor: null});
    if (path === '/artworks' && method === 'POST') {
      const w = {...base(8), ...body, id: 'WNEW', _img: null, _col: palettes[0]};
      state.push(w);
      return json(route, clean(w), 201);
    }
    if (path === '/artworks/collections')
      return json(route, {
        items: [
          {name: 'Abstract', count: 1},
          {name: 'Figurative', count: 6},
        ],
      });
    let m = /^\/artworks\/([^/]+)\/(publish|unpublish)$/.exec(path);
    if (m) {
      const w = state.find(x => x.id === m[1]);
      Object.assign(w, {
        public: m[2] === 'publish',
        publishedAt: now,
        draftedFields: [],
        slug: 'x',
        version: w.version + 1,
      });
      return json(route, clean(w));
    }
    m = /^\/artworks\/([^/]+)$/.exec(path);
    if (m) {
      const w = state.find(x => x.id === m[1]);
      if (!w) return json(route, {error: {code: 'not_found', message: 'Not found'}}, 404);
      if (method === 'PATCH') Object.assign(w, body, {version: w.version + 1});
      if (method === 'DELETE') w.deletedAt = now;
      return method === 'DELETE'
        ? route.fulfill({status: 204})
        : json(route, w._img ? detail(w) : {...clean(w), images: []});
    }
    m = /^\/files\/([^/]+)\/download-url$/.exec(path);
    if (m)
      return json(route, {
        url: `${origin}/mock-img/${m[1]}-${url.searchParams.get('width')}.png`,
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      });
    if (path === '/leads' && method === 'GET') return json(route, {items: leads});
    if (path === '/site/assistant-usage')
      return json(route, {month: '2026-11', turns: 312, spentCents: 42, budgetCents: 1000, capped: false});
    m = /^\/leads\/([^/]+)$/.exec(path);
    if (m && method === 'GET') {
      const l = leads.find(x => x.id === m[1]);
      return l ? json(route, {...l, chat: leadChat}) : json(route, {error: {code: 'not_found', message: 'No'}}, 404);
    }
    m = /^\/leads\/([^/]+)\/(approve-hold|decline|close)$/.exec(path);
    if (m && method === 'POST') {
      const l = leads.find(x => x.id === m[1]);
      if (Number(req.headers()['if-match']) !== l.version)
        return json(route, {error: {code: 'conflict', message: 'Changed'}}, 409);
      const status = {'approve-hold': 'held', decline: 'declined', close: 'closed'}[m[2]];
      Object.assign(l, {status, version: l.version + 1, expiresAt: status === 'held' ? '2026-11-14T20:00:00Z' : null});
      return json(route, l);
    }
    if (path.startsWith('/files/')) return json(route, {id: 'x', version: 2});
    return json(route, {error: {code: 'not_found', message: 'Not found'}}, 404);
  });
  return state;
}

// ---- run
const browser = await chromium.launch();
const sizes = [
  [390, 844],
  [1280, 800],
];
const themes = ['light', 'dark'];
const failures = [];
const check = (ok, msg) => ok || (failures.push(msg), console.error('FAIL', msg));

const screens = [
  {name: 'signin', path: '/studio', signedIn: false, ready: 'text=Studio sign-in'},
  {name: 'works', path: '/studio/works', ready: '.work-card >> nth=7'},
  {
    name: 'add',
    path: '/studio/add',
    ready: 'text=Take or choose photos',
    prep: async page => {
      await page.setInputFiles('#photos', [
        {name: 'a.png', mimeType: 'image/png', buffer: png(60, 60, [168, 74, 36], [240, 200, 150])},
        {name: 'b.png', mimeType: 'image/png', buffer: png(60, 60, [30, 60, 110], [150, 190, 220])},
      ]);
      await page.fill('input[type=text]', 'Evening Walk');
    },
  },
  {name: 'work', path: '/studio/works/W3', ready: '.cover-btn img'},
  {name: 'work-public', path: '/studio/works/W1', ready: 'text=Public since'},
  {name: 'review', path: '/studio/review', ready: '.review-head'},
  {name: 'leads', path: '/studio/leads', ready: '.lead-row'},
  {name: 'lead-hold', path: '/studio/leads/L1', ready: '.lead-pic img'},
  {name: 'lead-held', path: '/studio/leads/L2', ready: 'text=Decline (put back on sale)'},
  {name: 'site', path: '/studio/site', ready: '.place .site-thumb img'},
  {
    name: 'site-page-open',
    path: '/studio/site',
    ready: '#page-home summary',
    prep: async page => {
      await page.click('#page-home summary');
    },
  },
  {
    name: 'site-picker',
    path: '/studio/site',
    ready: '.place button',
    prep: async page => {
      await page.click('button[aria-label="Change Home — top picture"]');
      await page.waitForSelector('dialog.sheet .pick img');
      await page.waitForTimeout(300);
    },
  },
];

for (const [w, h] of sizes)
  for (const colorScheme of themes) {
    const ctx = await browser.newContext({viewport: {width: w, height: h}, colorScheme, deviceScaleFactor: 1});
    for (const s of screens) {
      const page = await ctx.newPage();
      await mock(page, {signedIn: s.signedIn !== false});
      page.on('pageerror', e => check(false, `${s.name} ${w} ${colorScheme}: page error ${e.message}`));
      await page.goto(origin + s.path);
      try {
        await page.waitForSelector(s.ready, {timeout: 10000});
        if (s.name !== 'signin' && s.name !== 'add')
          await page.waitForSelector('.pic img, .pic-note, .work-card', {timeout: 5000}).catch(() => {});
        await page.waitForTimeout(400);
        await s.prep?.(page);
        await page.waitForTimeout(200);
      } catch (e) {
        check(false, `${s.name} ${w} ${colorScheme}: screen did not appear (${e.message.split('\n')[0]})`);
      }
      await page.screenshot({path: join(out, `${s.name}-${w}-${colorScheme}.png`), fullPage: true});
      const m = await page.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: innerWidth}));
      check(m.sw <= m.iw, `${s.name} ${w} ${colorScheme}: sideways scroll (${m.sw} > ${m.iw})`);
      await page.close();
    }
    await ctx.close();
  }

// ---- a few behaviours (phone, light)
{
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1});
  const page = await ctx.newPage();
  const state = await mock(page);
  await page.goto(origin + '/studio/review');
  await page.waitForSelector('text=1 of 5');
  check((await page.textContent('.missing-line')).startsWith('Missing:'), 'review shows what is missing');
  await page.click('text=Skip');
  await page.waitForSelector('text=2 of 5');
  await page.click('button:has-text("Approve")');
  await page.waitForSelector('text=3 of 5');
  check(state.find(x => x.id === 'W4').public === true, 'approve publishes the draft');

  await page.goto(origin + '/studio/works');
  await page.waitForSelector('.work-card');
  check((await page.locator('.work-card').count()) === 8, 'site photos stay out of the works list');
  await page.click('button.pill:has-text("Site photos")');
  check((await page.locator('.work-card').count()) === 2, 'Site photos chip shows the 2 site photos');
  await page.click('button.pill:has-text("Drafts")');
  check((await page.locator('.work-card').count()) === 4, 'Drafts filter shows the 4 unpublished works');
  await page.click('.work-card >> nth=0');
  await page.waitForSelector('text=Approve and publish');
  check((await page.locator('.drafted').count()) >= 3, 'work screen labels the drafted fields');
  await ctx.close();
}
{
  // Leads: approve sends the version seen, after a confirm, and the lead becomes held.
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await ctx.newPage();
  await mock(page);
  await page.goto(origin + '/studio/leads/L1');
  await page.waitForSelector('button:has-text("Approve hold (48 hours)")');
  check((await page.locator('a[href^="sms:"]').count()) === 1, 'lead shows tap-to-text');
  await page.click('button:has-text("Approve hold (48 hours)")');
  await page.waitForSelector('dialog p:has-text("for 48 hours")');
  await page.click('dialog button.primary');
  await page.waitForSelector('text=Decline (put back on sale)');
  check((await page.textContent('body')).includes('Held until'), 'approved lead says held until');
  await ctx.close();
}
{
  // Site screen: a field error from the API shows next to its field; choosing a draft photo publishes it.
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await ctx.newPage();
  const state = await mock(page);
  await page.goto(origin + '/studio/site');
  await page.waitForSelector('.place');
  // Visitors (card G): counts in words at phone width, with the pieces seen most, and no sideways scroll.
  await page.waitForSelector('.visitor-totals');
  const visitors = await page.textContent('#site-visitors + p + .visitors');
  check(visitors.includes('Pieces viewed') && visitors.includes('1,240'), `visitors card shows views (${visitors})`);
  check(
    visitors.includes('Lifted Up: 310 views, 2 inquiries, 3 wall tries'),
    'visitors card names the piece seen most',
  );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'site screen has no sideways scroll at 390 px',
  );
  await page.fill('input[type=tel]', '12');
  await page.click('button:has-text("Save contact details")');
  await page.waitForSelector('.field-err:not([hidden])');
  check(
    (await page.textContent('.field-err:not([hidden])')).includes('Not a phone number'),
    'site shows the API field error',
  );
  await page.fill('input[type=tel]', '(555) 555-0199');
  await page.click('button:has-text("Save contact details")');
  await page.waitForSelector('.save-status:has-text("Saved")');
  // Links (card E, D-176): a line without an address says so; good lines save as https.
  const linksBox = page.getByLabel('Links (one a line: a name, then the address)');
  await linksBox.fill('Instagram instagram.com/isaac\nMy gallery');
  await page.click('button:has-text("Save contact details")');
  check(
    (await page.textContent('.field-err:not([hidden])')).includes('Line 2 needs an address'),
    'a link line without an address says which line',
  );
  await linksBox.fill('Instagram instagram.com/isaac');
  await page.click('button:has-text("Save contact details")');
  let withLinks = {};
  for (let i = 0; i < 40 && !withLinks.meta?.site?.links; i++) {
    await page.waitForTimeout(100);
    withLinks = await page.evaluate(() => fetch('/v1/settings').then(r => r.json()));
  }
  check(
    JSON.stringify(withLinks.meta?.site?.links) ===
      JSON.stringify([{label: 'Instagram', url: 'https://instagram.com/isaac'}]),
    'saving a link saves it as https',
  );
  await page.click('button[aria-label="Change Commissions — intro"]');
  await page.click('dialog.sheet .pick:has-text("Figure in Blue")');
  await page.click('dialog.sheet button:has-text("Done")');
  await page.click('dialog button:has-text("Show on my site")');
  await page.waitForFunction(() => document.querySelectorAll('.place')[4]?.querySelector('.site-thumb'));
  check(state.find(x => x.id === 'W3').public === true, 'choosing a draft photo publishes it');
  // The trade page (D-175) starts as a draft that isn't saved until Isaac saves it.
  const trade = page.locator('#page-trade');
  check(
    (await page.locator('#page-trade > summary').textContent()).includes('Draft, not on your site'),
    'trade page is a draft',
  );
  const before = await page.evaluate(() => fetch('/v1/settings').then(r => r.json()));
  check(!before.meta?.site?.pages?.trade, 'the trade draft is not saved by opening the screen');
  await page.locator('#page-trade > summary').click();
  await trade.locator('button:has-text("Save For designers and architects")').click();
  await trade.locator('.save-status:has-text("Saved")').waitFor();
  const after = await page.evaluate(() => fetch('/v1/settings').then(r => r.json()));
  check(after.meta?.site?.pages?.trade?.title === 'For designers and architects', 'saving the trade draft saves it');
  // Privacy and terms (card F): drafts, said once to be a starting point and not legal advice, saved only on Save.
  check(
    (await page.locator('#page-privacy > summary').textContent()).includes('Draft, not on your site'),
    'privacy page is a draft',
  );
  await page.locator('#page-privacy > summary').click();
  check(
    (await page.locator('#page-privacy .draft-note').textContent()).includes('not legal advice'),
    'the privacy draft says it is not legal advice',
  );
  check(!after.meta?.site?.pages?.privacy && !after.meta?.site?.pages?.terms, 'privacy and terms drafts are not saved');
  await ctx.close();
}
{
  // Site screen: the site name can be copied; a field error from the API shows next to its field;
  // choosing a draft photo publishes it.
  const ctx = await browser.newContext({
    viewport: {width: 390, height: 844},
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();
  const state = await mock(page);
  await page.goto(origin + '/studio/site');
  await page.waitForSelector('.place');
  check(
    (await page.textContent('.slug-line')).includes('Site name: isaac-anderson-art-abc123'),
    'site shows the site name',
  );
  await page.click('.slug-line button:has-text("Copy")');
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  check(copied === 'isaac-anderson-art-abc123', `Copy puts the site name on the clipboard (${copied})`);
  await page.fill('input[type=tel]', '12');
  await page.click('button:has-text("Save contact details")');
  await page.waitForSelector('.field-err:not([hidden])');
  check(
    (await page.textContent('.field-err:not([hidden])')).includes('Not a phone number'),
    'site shows the API field error',
  );
  await page.fill('input[type=tel]', '(555) 555-0199');
  await page.click('button:has-text("Save contact details")');
  await page.waitForSelector('.save-status:has-text("Saved")');
  await page.click('button[aria-label="Change Commissions — intro"]');
  await page.click('dialog.sheet .pick:has-text("Figure in Blue")');
  await page.click('dialog.sheet button:has-text("Done")');
  await page.click('dialog button:has-text("Show on my site")');
  await page.waitForFunction(() => document.querySelectorAll('.place')[4]?.querySelector('.site-thumb'));
  check(state.find(x => x.id === 'W3').public === true, 'choosing a draft photo publishes it');
  await ctx.close();
}
{
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await ctx.newPage();
  const state = await mock(page);
  state.length = 0; // no works: empty state
  await page.goto(origin + '/studio/works');
  await page.waitForSelector('text=No works yet');
  check(await page.locator('a[href="/studio/import"]').isVisible(), 'empty state links to the import');
  await ctx.close();
}

{
  // Opened signed out: after signing in, links, Add and Back must still work (the router starts either way).
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await ctx.newPage();
  await mock(page, {signedIn: false});
  await page.goto(origin + '/studio/review');
  await page.waitForSelector('text=Studio sign-in');
  await page.click('text=Sign in with password');
  await page.fill('#email', 'isaac@example.com');
  await page.fill('#pw', 'secret');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('.review-head');
  await page.click('nav >> text=Add');
  await page.waitForSelector('text=Take or choose photos');
  await page.goBack();
  await page.waitForSelector('.review-head');
  check(true, '');
  await ctx.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} problem(s)`);
  process.exit(1);
}
console.log('screens ok, pictures in', out);
