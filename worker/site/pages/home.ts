// Home: name and tagline, the hero photo, collections, a few available works, "the work, closely", the three
// rooms, and the way to start a conversation. A section or place the studio hasn't filled in is left out.
import {blocks} from '../format';
import {html, raw, type Raw} from '../html';
import {place, type PageCtx, type Render} from '../page';
import {picture} from '../picture';
import {
  CARD_SIZES,
  HERO_SIZES,
  WIDE_SIZES,
  conversation,
  firstSentence,
  frame,
  photo,
  photoAlt,
  pageOf,
  prose,
  sectionOf,
  workCard,
} from './parts';
import type {SiteSection} from '../types';

const ROOM_LINKS = ['/works', '/works', '/commissions'];
/** The full-bleed hero is drawn the width of the window. */
const BLEED_SIZES = '100vw';
const PANE_SIZES = '(min-width: 1240px) 400px, (min-width: 760px) 33vw, 72vw';
const ROOM_SIZES = '(min-width: 1240px) 400px, (min-width: 760px) 33vw, 78vw';
const CLOSELY_SIZES = '(min-width: 1240px) 700px, (min-width: 760px) 58vw, 100vw';

export const render: Render = async ctx => {
  const p = pageOf(ctx, 'home');
  const [collections, list] = await Promise.all([ctx.data.collections(), ctx.data.works()]);
  const hero = place(ctx, 'home.hero')[0];
  const sec = (k: string) => sectionOf(p, k);

  const tiles = collections.items.map(c => {
    const cover = list.items.find(w => w.collection === c.name && w.images[0])?.images[0];
    const href = `/works?${new URLSearchParams({collection: c.name})}`;
    return html`<li>
      <a class="card tile" href="${href}">
        ${cover ? picture(cover, {sizes: CARD_SIZES, alt: ''}) : raw('<div class="blank"></div>')}
        <span class="meta"
          ><span class="ttl">${c.name}</span
          ><span class="no">${c.count} ${c.count === 1 ? 'work' : 'works'}</span></span
        >
      </a>
    </li>`;
  });
  const gallery = sec('gallery');
  const available = list.items.filter(w => w.status === 'available').slice(0, 6);

  const objects = ['home.object-1', 'home.object-2'].flatMap(name => {
    const ph = place(ctx, name)[0];
    const s = p?.sections?.find(x => x.place === name);
    return ph || s
      ? [
          html`<article class="split">
            ${ph ? html`<div>${photo(ph, WIDE_SIZES)}</div>` : ''}
            <div class="prose">${s?.heading ? html`<h3>${s.heading}</h3>` : ''}${prose(s?.body)}</div>
          </article>`,
        ]
      : [];
  });
  const closely = sec('work-closely');

  const rooms = ['room-1', 'room-2', 'room-3'].flatMap((k, i) => {
    const s = sec(k);
    if (!s) return [];
    const ph = place(ctx, s.place ?? 'home.rooms')[i];
    return [
      html`<li>
        <a class="card tile" href="${ROOM_LINKS[i]}">
          ${ph ? picture(ph, {sizes: CARD_SIZES, alt: ph.altText ?? ph.title}) : raw('<div class="blank"></div>')}
          <span class="meta"
            ><span class="ttl">${s.heading}</span>${s.body ? html`<span class="sz">${s.body}</span>` : ''}</span
          >
        </a>
      </li>`,
    ];
  });
  const proof = sec('proof');
  const lead = sec('commission-lead');
  const contact = sec('contact');

  const o = ctx.template.options;
  if (o.heroFirst) {
    // A look that leads with the photograph (Gallery): the same words, links and sections in the same order,
    // written with the template's options (pane, frames, closelyRoles, proofChips).
    const pane = !!o.pane;
    const frames = !!o.frames;
    const tileRow = frames
      ? collections.items.map(c => {
          const cover = list.items.find(w => w.collection === c.name && w.images[0])?.images[0];
          const href = `/works?${new URLSearchParams({collection: c.name})}`;
          return html`<li>
            <a class="card tile" href="${href}"
              >${frame(cover, {sizes: PANE_SIZES, alt: ''})}<span class="meta"
                ><span class="ttl">${c.name}</span
                ><span class="no">${c.count} ${c.count === 1 ? 'work' : 'works'}</span></span
              ></a
            >
          </li>`;
        })
      : tiles;
    const roomRow = frames
      ? ['room-1', 'room-2', 'room-3'].flatMap((k, i) => {
          const s = sec(k);
          if (!s) return [];
          const ph = place(ctx, s.place ?? 'home.rooms')[i];
          return [
            html`<li>
              <a class="card tile" href="${ROOM_LINKS[i]}"
                >${frame(ph, {cls: 'r-43', sizes: ROOM_SIZES, alt: ph ? (ph.altText ?? ph.title) : ''})}<span
                  class="meta"
                  ><span class="ttl">${s.heading}</span>${s.body ? html`<span class="sz">${s.body}</span>` : ''}</span
                ></a
              >
            </li>`,
          ];
        })
      : rooms;
    const entries = o.closelyRoles ? closelyEntries(ctx, p?.sections, frames) : objects;
    const gallerySec = tiles.length
      ? html`<section class="${pane ? 'pane' : ''}" aria-labelledby="gallery-h">
          <div class="${pane ? 'wrap' : ''}">
            <div class="pane-h">
              <h2 id="gallery-h">${gallery?.heading ?? 'Gallery'}</h2>
              ${gallery?.body ? html`<div class="prose">${prose(gallery.body)}</div>` : ''}
            </div>
            <ul class="grid tiles">
              ${tileRow}
            </ul>
          </div>
        </section>`
      : '';
    const items = blocks(proof?.body);
    const rest = html`${
      available.length
        ? html`<section aria-labelledby="avail-h">
            <h2 id="avail-h">Available works</h2>
            <ul class="grid">
              ${available.map((w, i) => workCard(w, i + 1, frames))}
            </ul>
            <p class="more"><a class="btn alt" href="/works?status=available">See all available works</a></p>
          </section>`
        : ''
    }
    ${
      entries.length
        ? html`<section class="closely" aria-labelledby="closely-h">
            <h2 id="closely-h">${closely?.heading ?? 'The work, closely'}</h2>
            ${entries}
          </section>`
        : ''
    }
    ${
      roomRow.length
        ? html`<section class="rooms" aria-labelledby="rooms-h">
            <h2 class="sr" id="rooms-h">Explore</h2>
            <ul class="grid tiles">
              ${roomRow}
            </ul>
          </section>`
        : ''
    }
    ${
      proof?.body
        ? o.proofChips
          ? html`<section aria-labelledby="proof-h">
              <div class="seen">
                <h2 class="seen-h" id="proof-h">${proof.heading ?? 'Seen in'}</h2>
                ${items.map(b =>
                  'p' in b
                    ? html`<p>${b.p}</p>`
                    : html`<ul class="seen-l">
                        ${b.list.map(i => html`<li>${i}</li>`)}
                      </ul>`,
                )}
              </div>
            </section>`
          : html`<section aria-labelledby="proof-h">
              <h2 id="proof-h">${proof.heading ?? 'Seen in'}</h2>
              <div class="prose">${prose(proof.body)}</div>
            </section>`
        : ''
    }
    ${conversation(ctx, contact)}`;
    const top: Raw = html`${
        hero
          ? html`<div class="hero">
              ${
                frames
                  ? frame(hero, {cls: 'r-hero', sizes: BLEED_SIZES, alt: hero.altText ?? hero.title, eager: true})
                  : picture(hero, {sizes: BLEED_SIZES, alt: hero.altText ?? hero.title, eager: true})
              }
            </div>`
          : ''
      }
      <div class="wrap">${lead?.body ? html`<p class="note">${lead.body}</p>` : ''}</div>
      <div class="wrap intro intro-home">
        <h1 class="sr">${ctx.studio.name}</h1>
        ${ctx.studio.tagline ? html`<p class="tag">${ctx.studio.tagline}</p>` : ''}
        ${p?.lede || ctx.studio.description ? html`<p class="desc">${p?.lede ?? ctx.studio.description}</p>` : ''}
      </div>`;
    return {
      title: ctx.studio.name,
      description: firstSentence(p?.lede ?? ctx.studio.description),
      body: pane
        ? html`${top}${gallerySec}
            <div class="wrap">${rest}</div>`
        : html`${top}
            <div class="wrap">${gallerySec}${rest}</div>`,
      image: hero ?? null,
      preload: hero ?? null,
      preloadSizes: BLEED_SIZES,
    };
  }

  const body: Raw = html` <div class="wrap intro intro-home">
      <h1>${ctx.studio.name}</h1>
      ${ctx.studio.tagline ? html`<p class="tag">${ctx.studio.tagline}</p>` : ''}
      ${p?.lede || ctx.studio.description ? html`<p class="prose">${p?.lede ?? ctx.studio.description}</p>` : ''}
    </div>
    ${hero ? html`<div class="hero">${picture(hero, {sizes: HERO_SIZES, alt: hero.altText ?? hero.title, eager: true})}</div>` : ''}
    <div class="wrap">
      ${lead?.body ? html`<p class="note">${lead.body}</p>` : ''}
      ${
        tiles.length
          ? html`<section aria-labelledby="gallery-h">
              <h2 id="gallery-h">${gallery?.heading ?? 'Gallery'}</h2>
              ${gallery?.body ? html`<div class="prose">${prose(gallery.body)}</div>` : ''}
              <ul class="grid tiles">
                ${tiles}
              </ul>
            </section>`
          : ''
      }
      ${
        available.length
          ? html`<section aria-labelledby="avail-h">
              <h2 id="avail-h">Available works</h2>
              <ul class="grid">
                ${available.map((w, i) => workCard(w, i + 1))}
              </ul>
              <p><a class="btn alt" href="/works?status=available">See all available works</a></p>
            </section>`
          : ''
      }
      ${
        objects.length
          ? html`<section aria-labelledby="closely-h">
              <h2 id="closely-h">${closely?.heading ?? 'The work, closely'}</h2>
              ${objects}
            </section>`
          : ''
      }
      ${
        rooms.length
          ? html`<section aria-labelledby="rooms-h">
              <h2 class="sr" id="rooms-h">Explore</h2>
              <ul class="grid tiles">
                ${rooms}
              </ul>
            </section>`
          : ''
      }
      ${
        proof?.body
          ? html`<section aria-labelledby="proof-h">
              <h2 id="proof-h">${proof.heading ?? 'Seen in'}</h2>
              <div class="prose">${prose(proof.body)}</div>
            </section>`
          : ''
      }
      ${conversation(ctx, contact)}
    </div>`;
  return {
    title: ctx.studio.name,
    description: firstSentence(p?.lede ?? ctx.studio.description),
    body,
    image: hero ?? null,
    preload: hero ?? null,
  };
};

/** "The work, closely" with roles (the template's `closelyRoles`): the entry's heading as a small label (its number in
 * the accent), its first paragraph as the large sentence, the rest as small text, its list as hairline rows. With no
 * photo the words sit left and the rows right. */
function closelyEntries(ctx: PageCtx, sections: SiteSection[] | undefined, frames: boolean): Raw[] {
  return ['home.object-1', 'home.object-2'].flatMap(name => {
    const ph = place(ctx, name)[0];
    const s = sections?.find(x => x.place === name);
    if (!ph && !s) return [];
    const parts = blocks(s?.body);
    const paras = parts.flatMap(b => ('p' in b ? [b.p] : []));
    const rows = parts.flatMap(b => ('list' in b ? b.list : []));
    const no = /^(No\.\s*\d+)(.*)$/s.exec(s?.heading ?? '');
    const label = s?.heading ? html`<h3 class="lab">${no ? html`<b>${no[1]}</b>${no[2]}` : s.heading}</h3>` : '';
    const words = html`${label}${paras.map((t, i) => (i === 0 ? html`<p class="it">${t}</p>` : html`<p class="sm">${t}</p>`))}`;
    const spec = rows.length
      ? html`<ul class="spec">
          ${rows.map(r => html`<li>${r}</li>`)}
        </ul>`
      : '';
    const pic = ph
      ? frames
        ? frame(ph, {
            cls: 'r-closely',
            sizes: CLOSELY_SIZES,
            alt: photoAlt(ph),
            href: ph.workSlug ? `/works/${ph.workSlug}` : undefined,
          })
        : photo(ph, CLOSELY_SIZES)
      : null;
    return [
      pic
        ? html`<article class="split">
            <div>${pic}</div>
            <div>${words}${spec}</div>
          </article>`
        : html`<article class="split text">
            <div>${words}</div>
            ${spec}
          </article>`,
    ];
  });
}
