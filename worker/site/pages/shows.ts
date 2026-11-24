// Shows (D-182): every show the artist published a page for, newest first, and one page per show with its booth
// photos and the works it brought. Each show page is its own address, title and ExhibitionEvent, so someone searching
// for the show can find the artist. Nothing here needs a script.
import {html, type Raw} from '../html';
import {NotFound} from '../data';
import type {Render} from '../page';
import {picture, sizeUrl} from '../picture';
import type {PublicShowDetail, PublicShowSummary} from '../types';
import {artistRef, breadcrumbs} from '../schema';
import {CARD_SIZES, conversation, firstSentence, photo, prose, workCard} from './parts';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "December 2–6, 2026", "November 30 – December 2, 2026", "December 30, 2026 – January 2, 2027"; '' with no date. */
export function showDates(startsOn: string | null, endsOn: string | null): string {
  const a = startsOn ? DAY.exec(startsOn) : null;
  const b = endsOn ? DAY.exec(endsOn) : null;
  const part = (m: RegExpExecArray) => ({y: m[1]!, mo: MONTHS[Number(m[2]) - 1] ?? '', d: String(Number(m[3]))});
  if (!a) return b ? `${part(b).mo} ${part(b).d}, ${part(b).y}` : '';
  const s = part(a);
  if (!b || endsOn === startsOn) return `${s.mo} ${s.d}, ${s.y}`;
  const e = part(b);
  if (s.y !== e.y) return `${s.mo} ${s.d}, ${s.y} – ${e.mo} ${e.d}, ${e.y}`;
  if (s.mo !== e.mo) return `${s.mo} ${s.d} – ${e.mo} ${e.d}, ${e.y}`;
  return `${s.mo} ${s.d}–${e.d}, ${e.y}`;
}

/** The year the show starts, when the name doesn't already say it: "Red Dot Miami" → "Red Dot Miami 2026". */
export function showTitle(s: Pick<PublicShowSummary, 'name' | 'startsOn' | 'endsOn'>): string {
  const year = (s.startsOn ?? s.endsOn ?? '').slice(0, 4);
  return /^\d{4}$/.test(year) && !s.name.includes(year) ? `${s.name} ${year}` : s.name;
}

/** "Mana Wynwood, Miami" (the city left out when the venue or the name already names it). */
export function showPlace(s: Pick<PublicShowSummary, 'name' | 'venue' | 'city'>): string {
  const city = s.city && !(s.venue ?? '').includes(s.city) ? s.city : null;
  return [s.venue, city].filter(Boolean).join(', ');
}

const boothLine = (s: Pick<PublicShowSummary, 'booth'>) =>
  s.booth ? `Booth ${s.booth.replace(/^booth\s*/i, '')}` : '';

/** Today in the studio's time zone, as YYYY-MM-DD. */
function today(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(
      new Date(),
    );
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function showCard(s: PublicShowSummary): Raw {
  const bits = [showDates(s.startsOn, s.endsOn), showPlace(s), boothLine(s)].filter(Boolean);
  const count = s.workCount ? `${s.workCount} ${s.workCount === 1 ? 'work' : 'works'} shown` : '';
  return html`<li>
    <a class="card" href="/shows/${s.slug}">
      ${s.cover ? picture(s.cover, {sizes: CARD_SIZES, alt: s.cover.altText ?? showTitle(s)}) : html`<div class="blank"></div>`}
      <span class="meta">
        <span class="ttl">${showTitle(s)}</span>
        ${bits.length ? html`<span class="sz">${bits.join(' · ')}</span>` : ''}
        ${count ? html`<span class="no">${count}</span>` : ''}
      </span>
    </a>
  </li>`;
}

export const render: Render = async ctx => {
  const {items} = await ctx.data.showPages();
  const now = today(ctx.studio.timezone);
  const upcoming = items.filter(s => (s.endsOn ?? s.startsOn ?? '') >= now).reverse();
  const past = items.filter(s => !upcoming.includes(s));
  const name = ctx.studio.name;
  const origin = ctx.canonicalOrigin;
  const group = (id: string, heading: string, list: PublicShowSummary[]) =>
    list.length
      ? html`<section aria-labelledby="${id}">
          <h2 id="${id}">${heading}</h2>
          <ul class="wall top">
            ${list.map(showCard)}
          </ul>
        </section>`
      : '';
  const cities = [...new Set(items.map(s => s.city).filter((c): c is string => !!c))].slice(0, 4);
  return {
    title: 'Shows',
    nav: 'shows',
    description: firstSentence(
      `Art fairs and shows where ${name} has exhibited${cities.length ? `, from ${cities.join(', ')}` : ''}: booth photos and the works shown at each.`,
    ),
    image: items.find(s => s.cover)?.cover ?? null,
    body: html`<div class="wrap">
      <div class="intro">
        <p class="eyebrow">In person</p>
        <h1>Shows</h1>
        <p class="lede">Where to see the work, and what was shown at each fair.</p>
      </div>
      ${
        items.length
          ? html`${group('upcoming-h', 'Coming up', upcoming)}${group('past-h', 'Past shows', past)}`
          : html`<p class="empty">No shows listed yet. <a href="/works">See the works</a>.</p>`
      }
    </div>`,
    jsonLd: items.length
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Shows — ${name}`,
            itemListElement: items.map((s, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${origin}/shows/${s.slug}`,
              name: showTitle(s),
            })),
          },
        ]
      : [],
  };
};

/** The show as schema.org's ExhibitionEvent: the artist's booth at the show, with the works it featured. */
function eventLd(s: PublicShowDetail, origin: string, artist: string): object {
  const abs = (u: string | null) => (u ? new URL(u, origin).toString() : undefined);
  const url = `${origin}/shows/${s.slug}`;
  const images = [...s.photos, ...s.works.flatMap(w => w.images.slice(0, 1))]
    .slice(0, 6)
    .map(i => abs(sizeUrl(i, 1600)))
    .filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'ExhibitionEvent',
    name: `${artist} at ${showTitle(s)}`,
    url,
    startDate: s.startsOn ?? undefined,
    endDate: s.endsOn ?? s.startsOn ?? undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: s.venue ?? s.name,
      ...(s.city ? {address: {'@type': 'PostalAddress', addressLocality: s.city}} : {}),
    },
    description: s.description
      ? firstSentence(s.description, 500)
      : `${artist}'s booth at ${showTitle(s)}${s.booth ? `, ${boothLine(s).toLowerCase()}` : ''}.`,
    ...(images.length ? {image: images} : {}),
    performer: artistRef(origin),
    organizer: {'@type': 'Organization', name: s.name, ...(s.website ? {url: s.website} : {})},
    ...(s.works.length
      ? {
          workFeatured: s.works.slice(0, 50).map(w => ({
            '@type': 'VisualArtwork',
            name: w.title,
            url: `${origin}/works/${w.slug}`,
          })),
        }
      : {}),
  };
}

export const show: Render = async (ctx, params) => {
  const s = await ctx.data.showPage(params.slug!);
  if (s.slug !== params.slug) throw new NotFound(params.slug!);
  const name = ctx.studio.name;
  const origin = ctx.canonicalOrigin;
  const title = showTitle(s);
  const when = showDates(s.startsOn, s.endsOn);
  const where = showPlace(s);
  const booth = boothLine(s);
  const facts = [when, where, booth].filter(Boolean);
  const top = s.photos[0] ?? s.works[0]?.images[0] ?? null;
  const count = s.works.length ? `${s.works.length} ${s.works.length === 1 ? 'work' : 'works'}` : '';
  const description = firstSentence(
    `${name} at ${title}${where ? `, ${where}` : ''}${when ? `, ${when}` : ''}${booth ? `, ${booth.toLowerCase()}` : ''}. ${
      s.photos.length ? 'Booth photos' : 'The works shown'
    }${s.photos.length && count ? ` and the ${count} shown` : ''}.`,
  );
  const body = html`<div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/shows">Shows</a></nav>
    <div class="intro">
      <p class="eyebrow">Show</p>
      <h1>${title}</h1>
      ${facts.length ? html`<p class="lede">${facts.join(' · ')}</p>` : ''}
    </div>
    ${s.description ? html`<div class="prose">${prose(s.description)}</div>` : ''}
    ${
      s.website
        ? html`<p class="spec-link"><a href="${s.website}" rel="noopener external">${s.name}’s website</a></p>`
        : ''
    }
    ${
      s.photos.length
        ? html`<section aria-labelledby="booth-h">
            <h2 id="booth-h">The booth</h2>
            <ul class="wall top">
              ${s.photos.map((p, i) => html`<li>${photo(p, CARD_SIZES, i === 0)}</li>`)}
            </ul>
          </section>`
        : ''
    }
    ${
      s.works.length
        ? html`<section aria-labelledby="works-h">
            <h2 id="works-h">Works shown</h2>
            <ul class="wall top">
              ${s.works.map((w, i) => workCard(w, i + 1))}
            </ul>
          </section>`
        : ''
    }
    ${conversation(ctx, {heading: 'Saw something at the show?', body: 'Ask about any piece, or one like it.'})}
  </div>`;
  return {
    title: `${title}${s.city && !title.includes(s.city) ? `, ${s.city}` : ''}`,
    nav: 'shows',
    description,
    image: top,
    preload: s.photos[0] ?? null,
    body,
    jsonLd: [
      eventLd(s, origin, name),
      breadcrumbs(origin, [
        ['Shows', '/shows'],
        [title, `/shows/${s.slug}`],
      ]),
    ],
  };
};
