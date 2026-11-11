import {describe, expect, it} from 'vitest';
import type {ImportApi} from '../src/import/run';
import {buildPlaces, buildProfile, runSiteStep, type SiteText} from '../src/import/site';
import type {Manifest, ManifestWork} from '../src/import/types';
import realText from '../src/import/site-text.json';
import realManifest from '../src/import/manifest.json';

const work = (key: string, path: string, extra: Partial<ManifestWork> = {}): ManifestWork => ({
  key,
  title: key,
  titleFrom: 'made',
  source: {path, url: 'https://x/' + path, pixels: {width: 1, height: 1}, bytes: 1},
  alsoFrom: [],
  mergedBecause: [],
  importedFrom: `site-photo#${key}`,
  ...extra,
});
const manifest: Manifest = {
  sha: 'sha-1',
  generatedAt: '',
  voice: '',
  skipped: [],
  works: [
    work('hero-a', 'images/hero-a.webp', {sitePhoto: true}),
    work('about-studio', 'images/about-studio.webp', {sitePhoto: true, alsoFrom: ['images/show-hero-1.webp']}),
    work('object-9', 'images/object-9-hi.webp', {
      alsoFrom: ['images/object-9.webp'],
      importedFrom: 'collection-x.html#object-9',
    }),
  ],
};
const text: SiteText = {
  sha: 'sha-1',
  profile: {name: 'Isaac', tagline: 'Tag', description: 'Desc', phone: '+19498135258', email: 'a@b.co'},
  pages: {home: {title: 'Home', sections: [{key: 'x', body: 'hi'}]}},
  places: {
    'home.hero': ['images/hero-a.webp', 'images/missing.webp', 'images/hero-a.webp'],
    'about.studio': ['images/show-hero-1.webp', 'images/about-studio.webp'],
    'home.object-1': ['images/object-9.webp'],
    'home.rooms': ['images/nothing.webp'],
  },
};

describe('buildProfile', () => {
  it('takes the profile fields, 9 to 6 hours and the pages as they are', () => {
    const p = buildProfile(text);
    expect(p).toMatchObject({
      name: 'Isaac',
      phone: '+19498135258',
      email: 'a@b.co',
      hours: {from: '09:00', to: '18:00'},
    });
    expect(p.pages).toEqual(text.pages);
    expect(p.pages).not.toBe(text.pages);
    expect(p).not.toHaveProperty('photos');
  });
  it('leaves out empty fields', () => {
    expect(buildProfile({...text, profile: {name: 'X', tagline: ' '}})).toEqual({
      name: 'X',
      hours: {from: '09:00', to: '18:00'},
      pages: text.pages,
    });
  });
  it('builds a profile from the real site text that only has allowed keys', () => {
    const p = buildProfile(realText as unknown as SiteText);
    expect(Object.keys(p).sort()).toEqual(['description', 'email', 'hours', 'name', 'pages', 'phone', 'tagline']);
    expect(Object.keys(p.pages!).every(k => ['home', 'commissions', 'process', 'about'].includes(k))).toBe(true);
  });
});

describe('buildPlaces', () => {
  const arts = [
    {id: 'A1', meta: {importedFrom: {key: 'hero-a'}}},
    {id: 'A2', meta: {importedFrom: {key: 'about-studio'}}},
    {id: 'A3', meta: {importedFrom: {key: 'object-9'}}},
    {id: 'A4', meta: {}},
  ];
  it('matches by source.path or alsoFrom, drops repeats, and lists paths with no artwork', () => {
    const r = buildPlaces(text.places, manifest, arts);
    expect(r.photos).toEqual({'home.hero': ['A1'], 'about.studio': ['A2'], 'home.object-1': ['A3']});
    expect(r.skipped.sort()).toEqual(['images/missing.webp', 'images/nothing.webp']);
  });
  it('skips a path whose artwork was deleted', () => {
    expect(buildPlaces(text.places, manifest, arts.slice(1)).photos).not.toHaveProperty('home.hero');
  });
  it('places every path of the real site text that the real manifest knows', () => {
    const m = realManifest as unknown as Manifest;
    const artworks = m.works.map((w, i) => ({id: 'W' + i, meta: {importedFrom: {key: w.key}}}));
    const r = buildPlaces((realText as unknown as SiteText).places, m, artworks);
    // object-009.webp was never among the old site's image files the import found, so that place stays empty
    expect(r.skipped).toEqual(['images/object-009.webp']);
    expect(Object.keys(r.photos).sort()).toEqual(
      Object.keys(realText.places)
        .filter(p => p !== 'home.object-2')
        .sort(),
    );
    expect(r.photos['home.hero']!.length).toBeGreaterThan(1);
  });
});

// ---- the step, against a fake studio
function fake(
  init: {site?: unknown; timezone?: string; siteImport?: Record<string, unknown>; publicIds?: string[]} = {},
) {
  const calls: string[] = [];
  const artworks: Record<string, any> = {
    A1: {
      id: 'A1',
      version: 1,
      title: 'Hero A',
      public: false,
      meta: {importedFrom: {key: 'hero-a', page: 'site-photo'}},
    },
    A2: {
      id: 'A2',
      version: 3,
      title: 'About',
      public: true,
      kind: 'site_photo',
      meta: {importedFrom: {key: 'about-studio', page: 'site-photo'}},
    },
    A3: {
      id: 'A3',
      version: 1,
      title: 'Object',
      public: false,
      meta: {importedFrom: {key: 'object-9', page: 'collection-x.html'}},
    },
  };
  let settings: any = {
    version: 5,
    timezone: init.timezone ?? 'America/New_York',
    meta: {
      voice: 'v',
      ...(init.site ? {site: init.site} : {}),
      ...(init.siteImport ? {siteImport: init.siteImport} : {}),
    },
  };
  let failPublish = '';
  const api: ImportApi = {
    async get<T>(path: string) {
      calls.push('GET ' + path);
      if (path === '/settings') return structuredClone(settings) as T;
      return {items: Object.values(artworks).map(a => structuredClone(a)), nextCursor: null} as T;
    },
    async post<T>(path: string, _b?: unknown, version?: number) {
      calls.push('POST ' + path);
      const id = path.split('/')[2]!;
      if (id === failPublish) throw new Error('No web sizes yet.');
      expect(version).toBe(artworks[id].version);
      artworks[id] = {...artworks[id], public: true, version: version! + 1};
      return artworks[id] as T;
    },
    async patch<T>(path: string, body: any, version: number) {
      calls.push('PATCH ' + path);
      if (path === '/settings') {
        expect(version).toBe(settings.version);
        settings = {...settings, ...body, version: settings.version + 1};
        return settings as T;
      }
      const id = path.split('/')[2]!;
      expect(version).toBe(artworks[id].version);
      artworks[id] = {...artworks[id], ...body, version: version + 1};
      return artworks[id] as T;
    },
  };
  return {calls, artworks, api, settings: () => settings, failPublish: (id: string) => (failPublish = id)};
}

describe('runSiteStep', () => {
  it('marks kinds, saves the profile once, publishes placed photos and fixes the time zone', async () => {
    const f = fake();
    const r = await runSiteStep({api: f.api, manifest, text});
    expect(r).toMatchObject({ran: true, kindsMarked: 1, placesSet: 3, published: 2, failed: [], timezoneChanged: true});
    expect(r.skippedPaths.sort()).toEqual(['images/missing.webp', 'images/nothing.webp']);
    // kind marked on the site photo only (A3 is a work; A2 already was one)
    expect(f.artworks.A1.kind).toBe('site_photo');
    expect(f.artworks.A3.kind).toBeUndefined();
    const s = f.settings();
    expect(s.timezone).toBe('America/Los_Angeles');
    expect(s.meta.voice).toBe('v'); // the rest of meta survives
    expect(s.meta.siteImport.siteStep).toBe('sha-1');
    expect(s.meta.site.photos).toEqual({'home.hero': ['A1'], 'about.studio': ['A2'], 'home.object-1': ['A3']});
    expect(s.meta.site.hours).toEqual({from: '09:00', to: '18:00'});
    expect(f.calls.filter(c => c === 'PATCH /settings')).toHaveLength(1);
    // A1 and A3 published, one at a time; A2 was already public
    expect(f.calls.filter(c => c.includes('/publish'))).toEqual([
      'POST /artworks/A1/publish',
      'POST /artworks/A3/publish',
    ]);
    expect(f.artworks.A1.public && f.artworks.A3.public).toBe(true);
  });
  it('a second run changes nothing', async () => {
    const f = fake();
    await runSiteStep({api: f.api, manifest, text});
    const before = f.calls.length;
    const again = await runSiteStep({api: f.api, manifest, text});
    expect(again).toMatchObject({ran: false, reason: 'already-done'});
    expect(f.calls.slice(before)).toEqual(['GET /settings']);
  });
  it('never overwrites a site profile Isaac already has', async () => {
    const mine = {name: 'Mine'};
    const f = fake({site: mine});
    const r = await runSiteStep({api: f.api, manifest, text});
    expect(r).toMatchObject({ran: false, reason: 'has-profile'});
    expect(f.settings().meta.site).toEqual(mine);
    expect(f.calls.filter(c => c.startsWith('PATCH') || c.startsWith('POST'))).toEqual([]);
  });
  it('leaves a time zone someone already chose', async () => {
    const f = fake({timezone: 'America/Denver'});
    const r = await runSiteStep({api: f.api, manifest, text});
    expect(r.timezoneChanged).toBe(false);
    expect(f.settings().timezone).toBe('America/Denver');
  });
  it('lists photos that could not be published and still records the step', async () => {
    const f = fake();
    f.failPublish('A1');
    const r = await runSiteStep({api: f.api, manifest, text});
    expect(r.failed).toEqual([{title: 'Hero A', message: 'No web sizes yet.'}]);
    expect(r.published).toBe(1);
    expect(f.settings().meta.siteImport.siteStep).toBe('sha-1');
  });
});
