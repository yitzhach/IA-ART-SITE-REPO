// Bits shared by the pages: plain text → HTML (never inserted raw), contact buttons, picture links, work cards.
import {mailHref, smsHref, telHref, type About} from '../contact';
import {availability, blocks, sizeLine} from '../format';
import {html, raw, type Raw} from '../html';
import {picture} from '../picture';
import type {PageCtx} from '../page';
import type {PublicArtwork, PublicImage, PublicSitePhoto, SitePage, SitePageKey, SiteSection} from '../types';

/** The `sizes` of the above-the-fold picture; the layout's preload must say the same. */
export const HERO_SIZES = '100vw';
export const COVER_SIZES = '(min-width: 900px) 58vw, 100vw';
export const CARD_SIZES = '(min-width: 1100px) 25vw, (min-width: 760px) 33vw, 50vw';
export const WIDE_SIZES = '(min-width: 1240px) 600px, (min-width: 760px) 50vw, 100vw';

export const prose = (body: string | undefined | null): Raw =>
  html`${blocks(body).map(b => ('p' in b ? html`<p>${b.p}</p>` : html`<ul>${b.list.map(i => html`<li>${i}</li>`)}</ul>`))}`;

export const pageOf = (ctx: PageCtx, key: SitePageKey): SitePage | undefined => ctx.studio.pages[key];
export const sectionOf = (p: SitePage | undefined, key: string): SiteSection | undefined =>
  p?.sections?.find(s => s.key === key);

/** Text / Email / Call as plain links; a missing phone or email leaves that link out. */
export function buttons(ctx: PageCtx, about: About = {}): Raw {
  const s = ctx.studio;
  const sms = smsHref(s, about);
  const mail = mailHref(s, about);
  const tel = telHref(s);
  if (!sms && !mail && !tel) return html``;
  return html`<p class="btns">
    ${sms && html`<a class="btn" href="${sms}">Text</a>`}${mail && html`<a class="btn alt" href="${mail}">Email</a>`}${tel && html`<a class="btn alt" href="${tel}">Call</a>`}
  </p>`;
}

/** The closing "Start a conversation" block; `sec` gives its own words when the page has them. */
export function conversation(ctx: PageCtx, sec?: SiteSection): Raw {
  return html`<section class="convo" aria-labelledby="convo-h">
    <h2 id="convo-h">${sec?.heading || 'Start a conversation'}</h2>
    <div class="prose">${prose(sec?.body)}</div>
    ${buttons(ctx)}
  </section>`;
}

export const photoAlt = (p: PublicSitePhoto) => p.altText ?? p.title;

/** A site photo; one that is a public work links to it. */
export function photo(p: PublicSitePhoto, sizes: string, eager = false): Raw {
  const img = picture(p, {sizes, alt: photoAlt(p), eager});
  return p.workSlug ? html`<a href="/works/${p.workSlug}">${img}</a>` : img;
}

export const indexNo = (n: number) => `No. ${String(n).padStart(2, '0')}`;

/** The chip on a card: the price (only when the studio shows one), Price on request, Sold, Reserved. */
export function chip(w: PublicArtwork): Raw {
  const a = availability(w);
  if (w.status === 'sold') return html`<span class="chip">Sold</span>`;
  if (w.status === 'reserved') return html`<span class="chip">Reserved</span>`;
  if (w.status !== 'available') return html``;
  return a.price ? html`<span class="chip price">${a.price}</span>` : html`<span class="chip">${a.label}</span>`;
}

export function workCard(w: PublicArtwork, n: number): Raw {
  const cover: PublicImage | undefined = w.images[0];
  const size = sizeLine(w)?.replace(/ \(.*\)$/, '');
  return html`<li>
    <a class="card" href="/works/${w.slug}">
      ${cover ? picture(cover, {sizes: CARD_SIZES, alt: cover.altText ?? w.title}) : raw('<div class="blank"></div>')}
      <span class="meta">
        <span class="no"><b>${indexNo(n)}</b>${w.collection ? ` · ${w.collection}` : ''}</span>
        <span class="ttl">${w.title}</span>
        ${size ? html`<span class="sz">${size}</span>` : ''}${chip(w)}
      </span>
    </a>
  </li>`;
}

export const isEmail = (s: string | undefined) => !!s && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s.trim());

export const firstSentence = (s: string | undefined | null, max = 160) =>
  (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const CLOSERS = ['inquire', 'contact', 'close'];

/** Splits a page's sections into the ones shown in order and the closing one that carries the contact buttons. */
export function splitClose(p: SitePage | undefined): {rest: SiteSection[]; closer?: SiteSection} {
  const all = p?.sections ?? [];
  const at = all.map(s => s.key).findLastIndex(k => !!k && CLOSERS.includes(k));
  return at < 0 ? {rest: all} : {rest: all.filter((_, i) => i !== at), closer: all[at]};
}

/** One section: its photo (if it has a place) beside or above its heading and words. */
export function sectionBlock(ctx: PageCtx, s: SiteSection, sizes = WIDE_SIZES): Raw {
  const ph = s.place ? place(ctx, s.place)[0] : undefined;
  const id = s.key ? `s-${s.key}` : undefined;
  const text = s.key?.includes('caption')
    ? html`<p class="caption">${s.body}</p>`
    : html`${s.heading ? html`<h2 id="${id}">${s.heading}</h2>` : ''}<div class="prose">${prose(s.body)}</div>`;
  if (!ph) return html`<section ${id && s.heading ? html`aria-labelledby="${id}"` : ''}>${text}</section>`;
  return html`<section class="split" ${id && s.heading ? html`aria-labelledby="${id}"` : ''}>
    <div>${photo(ph, sizes)}</div>
    <div>${text}</div>
  </section>`;
}

/** The title block every text page starts with. */
export const titleBlock = (title: string, lede?: string): Raw =>
  html`<div class="intro"><h1>${title}</h1>${lede ? html`<p class="lede">${lede}</p>` : ''}</div>`;

export const pageDescription = (p: SitePage | undefined): string =>
  firstSentence(p?.lede ?? p?.sections?.find(s => s.body)?.body);
