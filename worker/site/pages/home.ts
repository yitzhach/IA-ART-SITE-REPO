// Home: name and tagline, the hero photo, collections, a few available works, "the work, closely", the three
// rooms, and the way to start a conversation. A section or place the studio hasn't filled in is left out.
import {html, raw, type Raw} from '../html';
import {place, type Render} from '../page';
import {picture} from '../picture';
import {
  CARD_SIZES,
  COVER_SIZES,
  HERO_SIZES,
  conversation,
  firstSentence,
  indexNo,
  photo,
  pageOf,
  prose,
  sectionOf,
  workCard,
} from './parts';

const ROOM_SIZES = '(min-width: 760px) 40vw, 60vw';

const ROOM_LINKS = ['/works', '/works', '/commissions'];

export const render: Render = async ctx => {
  const p = pageOf(ctx, 'home');
  const [collections, list] = await Promise.all([ctx.data.collections(), ctx.data.works()]);
  // Up to five hero photos cross-fade; the first is the still one.
  const heroes = place(ctx, 'home.hero').slice(0, 5);
  const hero = heroes[0];
  const sec = (k: string) => sectionOf(p, k);

  const tiles = collections.items.map((c, i) => {
    const cover = list.items.find(w => w.collection === c.name && w.images[0])?.images[0];
    const href = `/works?${new URLSearchParams({collection: c.name})}`;
    return html`<li>
      <a class="card" href="${href}">
        ${cover ? picture(cover, {sizes: i ? CARD_SIZES : COVER_SIZES, alt: ''}) : raw('<div class="blank"></div>')}
        <span class="no"><b>${indexNo(i + 1)}</b> · ${c.count} ${c.count === 1 ? 'work' : 'works'}</span>
        <span class="ttl">${c.name}</span>
      </a>
    </li>`;
  });
  const gallery = sec('gallery');
  const available = list.items.filter(w => w.status === 'available').slice(0, 6);

  const objects = ['home.object-1', 'home.object-2'].flatMap(name => {
    const ph = place(ctx, name)[0];
    const s = p?.sections?.find(x => x.place === name);
    return ph || s ? [{ph, s}] : [];
  });
  const closely = sec('work-closely');

  const rooms = ['room-1', 'room-2', 'room-3'].flatMap((k, i) => {
    const s = sec(k);
    if (!s) return [];
    const ph = place(ctx, s.place ?? 'home.rooms')[i];
    return [
      html`<li ${ph?.aspectRatio ? html`style="--r:${ph.aspectRatio}"` : ''}>
        <a href="${ROOM_LINKS[i]}">
          ${ph ? picture(ph, {sizes: ROOM_SIZES, alt: ph.altText ?? ph.title}) : raw('<div class="blank"></div>')}
          <span class="ov"
            ><span class="ttl">${s.heading}</span>${s.body ? html`<span class="sz">${s.body}</span>` : ''}</span
          >
        </a>
      </li>`,
    ];
  });
  const proof = sec('proof');
  const lead = sec('commission-lead');
  const contact = sec('contact');

  const name = ctx.studio.name;
  // The name fills the content width: one line from 760 px (--n letters), its longest word on phones (--w).
  const longest = Math.max(...name.split(/\s+/).map(x => x.length), 1);
  const statement = p?.lede ?? ctx.studio.description;

  const body: Raw = html`<section class="hero">
      ${
        hero
          ? html`<div class="hero-img${heroes.length > 1 ? ` xf xf-${heroes.length}` : ''}">
              ${heroes.map((h, i) => picture(h, {sizes: HERO_SIZES, alt: i ? '' : (h.altText ?? h.title), eager: !i}))}
            </div>`
          : ''
      }
      <div class="hero-txt">
        <div class="wrap">
          <div class="hero-title" style="--n:${name.length};--w:${longest}">
            <h1>${name}</h1>
            ${ctx.studio.tagline ? html`<p class="tag">${ctx.studio.tagline}</p>` : ''}
          </div>
        </div>
      </div>
    </section>
    ${
      statement || lead?.body
        ? html`<div class="wrap sec">
            ${statement ? html`<p class="big">${statement}</p>` : ''}
            ${lead?.body ? html`<p class="note">${lead.body}</p>` : ''}
          </div>`
        : ''
    }
    ${
      tiles.length
        ? html`<section class="sec ruled" aria-labelledby="gallery-h">
            <div class="wrap rule">
              <div class="sec-head">
                <h2 id="gallery-h">${gallery?.heading ?? 'Gallery'}</h2>
                ${gallery?.body ? html`<div class="prose">${prose(gallery.body)}</div>` : ''}
              </div>
              <ul class="salon">
                ${tiles}
              </ul>
            </div>
          </section>`
        : ''
    }
    ${
      available.length
        ? html`<section class="wrap sec rule" aria-labelledby="avail-h">
            <div class="sec-head"><h2 id="avail-h">Available works</h2></div>
            <ul class="wall">
              ${available.map((w, i) => workCard(w, i + 1))}
            </ul>
            <p class="more"><a class="btn alt" href="/works?status=available">See all available works</a></p>
          </section>`
        : ''
    }
    ${
      objects.length
        ? html`<section class="sec ruled" aria-labelledby="closely-h">
            <div class="wrap rule">
              <div class="sec-head"><h2 id="closely-h">${closely?.heading ?? 'The work, closely'}</h2></div>
            </div>
            ${objects.map(
              ({ph, s}, i) =>
                html`<article class="obj${i % 2 ? ' flip' : ''}">
                  ${ph ? html`<div class="obj-img">${photo(ph, COVER_SIZES)}</div>` : ''}
                  <div class="obj-txt">${s?.heading ? html`<h3>${s.heading}</h3>` : ''}${prose(s?.body)}</div>
                </article>`,
            )}
          </section>`
        : ''
    }
    ${
      rooms.length || proof?.body
        ? html`<div class="wrap sec rule">
            ${
              rooms.length
                ? html`<section aria-labelledby="rooms-h">
                    <h2 class="sr" id="rooms-h">Explore</h2>
                    <ul class="rooms">
                      ${rooms}
                    </ul>
                  </section>`
                : ''
            }
            ${
              proof?.body
                ? html`<section class="proof" aria-labelledby="proof-h">
                    <h2 id="proof-h">${proof.heading ?? 'Seen in'}</h2>
                    <div class="prose">${prose(proof.body)}</div>
                  </section>`
                : ''
            }
          </div>`
        : ''
    }
    <div class="wrap">${conversation(ctx, contact)}</div>`;
  return {
    title: ctx.studio.name,
    description: firstSentence(p?.lede ?? ctx.studio.description),
    body,
    image: hero ?? null,
    preload: hero ?? null,
  };
};
