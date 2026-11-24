// Shows (D-182): the artist's shows and each one's page on the site. The show itself is the Show Tracker's record;
// its page (published or not, address, words, booth photos) lives in the show's meta and changes only through the
// show.set_page action, which the assistant may never run.
import {get, patch, post} from '../api';

export type ShowStatus = 'planned' | 'applied' | 'accepted' | 'declined' | 'done' | 'cancelled';

export interface ShowPage {
  published: boolean;
  slug: string;
  description: string | null;
  photos: string[];
}

export interface StudioShow {
  id: string;
  version: number;
  name: string;
  venue: string | null;
  city: string | null;
  startsOn: string | null;
  endsOn: string | null;
  booth: string | null;
  status: ShowStatus;
  meta: {publicPage?: ShowPage; url?: string} & Record<string, unknown>;
}

export interface ShowArtworkRow {
  id: string;
  artworkId: string;
  outcome: 'brought' | 'sold' | 'returned';
}
export type StudioShowDetail = StudioShow & {artworks: ShowArtworkRow[]};

/** What the add form and the details card send: the show's own fields. */
export type ShowFields = Pick<StudioShow, 'name' | 'venue' | 'city' | 'startsOn' | 'endsOn' | 'booth'>;

const enc = encodeURIComponent;

/** Every show, newest first (pages through the whole list). */
export async function listAllShows(): Promise<StudioShow[]> {
  const out: StudioShow[] = [];
  let cursor: string | null = null;
  do {
    const page: {items: StudioShow[]; nextCursor: string | null} = await get(
      `/shows?limit=200${cursor ? '&cursor=' + enc(cursor) : ''}`,
    );
    out.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}
export const getShow = (id: string) => get<StudioShowDetail>(`/shows/${enc(id)}`);
export const createShow = (f: ShowFields) => post<StudioShow>('/shows', {...f, status: 'accepted'});
export const updateShow = (s: StudioShow, f: Partial<ShowFields>) =>
  patch<StudioShow>(`/shows/${enc(s.id)}`, f, s.version);
export const setShowPage = (s: StudioShow, change: Partial<ShowPage>) =>
  post<StudioShow>('/actions/show.set_page', {showId: s.id, version: s.version, ...change});
export const addWorkToShow = (showId: string, artworkId: string) =>
  post<unknown>('/actions/show.add_artwork', {showId, artworkId});
export const removeWorkFromShow = (showId: string, artworkId: string) =>
  post<unknown>('/actions/show.remove_artwork', {showId, artworkId});

/** The address studio-api gives a show's page until the artist picks one: the name and the year. */
export function showSlug(name: string, startsOn: string | null): string {
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'show';
  const year = startsOn?.slice(0, 4);
  return year && /^\d{4}$/.test(year) && !base.endsWith(year) ? `${base}-${year}` : base;
}

export const SLUG_RULE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The show's page as it stands, or what it would be before the artist ever saved one. */
export function pageOf(s: Pick<StudioShow, 'name' | 'startsOn' | 'meta'>): ShowPage {
  const p = s.meta?.publicPage;
  return {
    published: p?.published ?? false,
    slug: p?.slug ?? showSlug(s.name, s.startsOn),
    description: p?.description ?? null,
    photos: p?.photos ?? [],
  };
}

/** Coming shows first (soonest first), then past ones (latest first); undated shows last. */
export function sortShows<T extends Pick<StudioShow, 'startsOn' | 'endsOn' | 'name'>>(list: T[], today: string): T[] {
  const last = (s: T) => s.endsOn ?? s.startsOn ?? '';
  const coming = list.filter(s => last(s) && last(s) >= today);
  const past = list.filter(s => last(s) && last(s) < today);
  const undated = list.filter(s => !last(s));
  const by = (k: (s: T) => string, dir: 1 | -1) => (a: T, b: T) => dir * k(a).localeCompare(k(b));
  return [
    ...coming.sort(by(s => s.startsOn ?? last(s), 1)),
    ...past.sort(by(last, -1)),
    ...undated.sort(by(s => s.name, 1)),
  ];
}

/** "Dec 2 – 6, 2026" for a row in the list. */
export function shortDates(startsOn: string | null, endsOn: string | null): string {
  const fmt = (d: string, year: boolean) => {
    const [y, m, day] = d.split('-').map(Number);
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(m ?? 1) - 1];
    return `${mo} ${day}${year ? `, ${y}` : ''}`;
  };
  if (!startsOn) return endsOn ? fmt(endsOn, true) : 'No dates yet';
  if (!endsOn || endsOn === startsOn) return fmt(startsOn, true);
  return startsOn.slice(0, 4) === endsOn.slice(0, 4)
    ? `${fmt(startsOn, false)} – ${fmt(endsOn, true)}`
    : `${fmt(startsOn, true)} – ${fmt(endsOn, true)}`;
}

/** The form's typed values as the API's fields, or the first thing wrong with them. */
export function readShowFields(v: {
  name: string;
  venue: string;
  city: string;
  startsOn: string;
  endsOn: string;
  booth: string;
}): {ok: true; fields: ShowFields} | {ok: false; field: keyof typeof v; message: string} {
  const t = (s: string) => s.trim() || null;
  const name = v.name.trim();
  if (!name) return {ok: false, field: 'name', message: 'Give the show a name.'};
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (v.startsOn && !day.test(v.startsOn)) return {ok: false, field: 'startsOn', message: 'Pick a start date.'};
  if (v.endsOn && !day.test(v.endsOn)) return {ok: false, field: 'endsOn', message: 'Pick an end date.'};
  if (v.startsOn && v.endsOn && v.endsOn < v.startsOn)
    return {ok: false, field: 'endsOn', message: 'The last day is before the first.'};
  return {
    ok: true,
    fields: {
      name,
      venue: t(v.venue),
      city: t(v.city),
      startsOn: v.startsOn || null,
      endsOn: v.endsOn || null,
      booth: t(v.booth),
    },
  };
}

/** Only the fields that changed, so a save never sends what the Show Tracker may have changed meanwhile. */
export function changedShowFields(before: ShowFields, after: ShowFields): Partial<ShowFields> {
  const out: Partial<ShowFields> = {};
  for (const k of Object.keys(after) as (keyof ShowFields)[]) {
    if ((before[k] ?? null) !== (after[k] ?? null)) (out as Record<string, unknown>)[k] = after[k];
  }
  return out;
}

/** Today as YYYY-MM-DD on this device. */
export const todayLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
