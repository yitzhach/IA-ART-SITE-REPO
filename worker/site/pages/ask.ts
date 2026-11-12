// /ask: the assistant's page without scripts: the greeting, a plain search over the catalogue digest (a GET form, `?q=`)
// and ways to reach the artist. With scripts, "Ask" opens the chat sheet instead (public/site/ask.js).
import {sizeLine} from '../format';
import {html, raw, type Raw} from '../html';
import type {Render} from '../page';
import type {DigestWork} from '../types';
import {chip, contactLinks, titleBlock} from './parts';

/** Works whose title, collection, tags or medium contain every word of `q` (the sheet's search does the same). */
export function searchDigest(works: DigestWork[], q: string): DigestWork[] {
  const words = q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (!words.length) return [];
  return works.filter(w => {
    const hay = [w.title, w.collection, w.medium, ...w.tags].filter(Boolean).join(' ').toLowerCase();
    return words.every(x => hay.includes(x));
  });
}

/** A work from the digest as a card: picture, title, size, price or "price on request"; links to the piece. */
export function digestCard(w: DigestWork): Raw {
  const size = sizeLine(w)?.replace(/ \(.*\)$/, '');
  return html`<li>
    <a class="card" href="/works/${w.slug}">
      ${w.image ? html`<img src="${w.image}" width="480" height="600" alt="${w.title}" loading="lazy" decoding="async" />` : raw('<div class="blank"></div>')}
      <span class="meta">
        <span class="ttl">${w.title}</span>
        ${size ? html`<span class="sz">${size}</span>` : ''}${chip(w)}
      </span>
    </a>
  </li>`;
}

const SHOWN = 48;

export const render: Render = async ctx => {
  const q = (ctx.url.searchParams.get('q') ?? '').slice(0, 100).trim();
  const [assistant, digest] = await Promise.all([ctx.data.assistant(), q ? ctx.data.digest().catch(() => null) : null]);
  const artist = assistant?.artistName ?? ctx.studio.name;
  const hits = digest ? searchDigest(digest.works, q) : [];
  const links = contactLinks(ctx.studio, {}, ['btn', 'btn alt', 'btn alt']);
  const body = html`<div class="wrap">
    ${titleBlock('Ask', assistant?.greeting ?? `Looking for something? Search the works, or ask ${artist}.`)}
    ${
      assistant?.available
        ? html`<p class="btns">
            <button class="btn" type="button" hidden data-js data-ask>Chat with the studio assistant</button>
          </p>`
        : ''
    }
    ${assistant && !assistant.available ? html`<p class="note-line">The chat is resting right now. You can search the works or write to ${artist}.</p>` : ''}
    <form class="search" method="get" action="/ask" role="search">
      <label for="q">Search the works</label>
      <div class="search-row">
        <input
          id="q"
          name="q"
          type="search"
          value="${q}"
          maxlength="100"
          placeholder="a colour, a collection, a material"
          autocomplete="off"
        />
        <button class="btn" type="submit">Search</button>
      </div>
    </form>
    ${
      !q
        ? ''
        : !digest
          ? html`<p class="empty">Search isn't available just now. Try the <a href="/works">works</a>.</p>`
          : hits.length
            ? html`<p class="count">${hits.length} ${hits.length === 1 ? 'work matches' : 'works match'} "${q}"</p>
                <ul class="grid top">
                  ${hits.slice(0, SHOWN).map(digestCard)}
                </ul>`
            : html`<p class="empty">Nothing matches "${q}". Try one word, or ask ${artist} below.</p>`
    }
    <section class="convo" aria-labelledby="ask-h">
      <h2 id="ask-h">Ask ${artist}</h2>
      <p>${assistant?.replyTime ?? `${artist} replies personally.`}</p>
      ${links.length ? html`<p class="btns">${links}</p>` : ''}
    </section>
  </div>`;
  return {
    title: q ? `Search: ${q}` : 'Ask',
    description: 'Search the works or ask the studio.',
    body,
    canonical: '/ask',
    noindex: !!q,
  };
};
