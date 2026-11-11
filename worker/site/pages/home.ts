// Home: name and tagline, the hero photo, collections, a few available works, "the work, closely", the three
// rooms, and the way to start a conversation. A section or place the studio hasn't filled in is left out.
import {html, raw, type Raw} from '../html';
import {place, type Render} from '../page';
import {picture} from '../picture';
import {
  CARD_SIZES,
  HERO_SIZES,
  WIDE_SIZES,
  conversation,
  firstSentence,
  photo,
  pageOf,
  prose,
  sectionOf,
  workCard,
} from './parts';

const ROOM_LINKS = ['/works', '/works', '/commissions'];

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
