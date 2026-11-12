// One work: big cover, the facts, how to ask about it (Text / Email / Call with the piece written in), more
// pictures that open in a lightbox, and the neighbours. All text comes from the studio's record, escaped.
import {NotFound} from '../data';
import {availability, buyable, shippingLine, sizeLine} from '../format';
import {html, type Raw} from '../html';
import type {Render} from '../page';
import {picture, sizeUrl} from '../picture';
import type {PublicArtwork} from '../types';
import {COVER_SIZES, contactLinks, firstSentence, prose} from './parts';

const AVAIL: Record<string, string> = {
  available: 'https://schema.org/InStock',
  reserved: 'https://schema.org/LimitedAvailability',
  sold: 'https://schema.org/SoldOut',
};

function jsonLd(w: PublicArtwork, origin: string, studioName: string, price: string | null): object {
  const abs = (u: string | null) => (u ? new URL(u, origin).toString() : undefined);
  const dim = (v: number | null) =>
    v && v > 0 ? {'@type': 'QuantitativeValue', value: v, unitText: w.sizeUnit} : undefined;
  const cover = w.images[0];
  const offers =
    w.status === 'sold'
      ? {'@type': 'Offer', availability: AVAIL.sold}
      : price && w.priceCents !== null && w.currency
        ? {
            '@type': 'Offer',
            price: (w.priceCents / 100).toFixed(2),
            priceCurrency: w.currency,
            availability: AVAIL.available,
            url: `${origin}/works/${w.slug}`,
          }
        : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'VisualArtwork',
    name: w.title,
    url: `${origin}/works/${w.slug}`,
    image: cover ? abs(sizeUrl(cover, 960)) : undefined,
    artform: w.collection === 'Sculptural' ? 'Sculpture' : undefined,
    artMedium: w.medium ?? undefined,
    width: dim(w.width),
    height: dim(w.height),
    depth: dim(w.depth),
    dateCreated: w.year ? String(w.year) : undefined,
    description: w.description ? firstSentence(w.description, 500) : undefined,
    creator: {'@type': 'Person', name: studioName},
    offers,
  };
}

export const render: Render = async (ctx, {slug}) => {
  const [w, list] = await Promise.all([ctx.data.work(slug!), ctx.data.works()]);
  if (!w) throw new NotFound(slug);
  const url = `${ctx.url.origin}/works/${w.slug}`;
  const about = {subject: w.title, lines: [url], slug: w.slug, url};
  const links = contactLinks(ctx.studio, about, ['btn', 'btn alt', 'btn alt']);
  const a = availability(w);
  const size = sizeLine(w);
  const cover = w.images[0];
  const more = w.images.slice(1);
  const at = list.items.findIndex(x => x.slug === w.slug);
  const prev = at > 0 ? list.items[at - 1] : undefined;
  const next = at >= 0 ? list.items[at + 1] : undefined;

  const lb = (img: NonNullable<typeof cover>, sizes: string, eager: boolean): Raw => {
    const full = sizeUrl(img, 1600);
    return html`<a href="${full}" data-lb data-alt="${img.altText ?? w.title}"
      >${picture(img, {sizes, alt: img.altText ?? w.title, eager})}</a
    >`;
  };
  const facts: [string, string | number][] = [];
  if (size) facts.push(['Size', size]);
  if (w.medium) facts.push(['Medium', w.medium]);
  if (w.year) facts.push(['Year', w.year]);
  const ship = w.status === 'available' && a.price ? shippingLine(w) : null;
  if (ship) facts.push(['Shipping', ship]);
  if (w.collection) facts.push(['Collection', w.collection]);

  const availability_ =
    w.status === 'sold'
      ? html`<a href="/commissions">${a.label}</a>`
      : a.price
        ? html`<strong>${a.price}</strong> ${a.label}`
        : a.label;

  const body = html`<div class="wrap">
    <article class="piece">
      <div class="piece-media">
        ${cover ? lb(cover, COVER_SIZES, true) : ''}
        ${
          more.length
            ? html`<ul class="pics">
                ${more.map(i => html`<li>${lb(i, '(min-width: 900px) 28vw, 50vw', false)}</li>`)}
              </ul>`
            : ''
        }
      </div>
      <div class="piece-info">
        <p class="eyebrow">${w.collection ?? 'Work'}</p>
        <h1>${w.title}</h1>
        ${
          facts.length
            ? html`<dl class="facts">
                ${facts.map(
                  ([k, v]) =>
                    html`<dt>${k}</dt>
                      <dd>${v}</dd>`,
                )}
              </dl>`
            : ''
        }
        <p class="avail">${availability_}</p>
        <div class="prose">${prose(w.description)}</div>
        <p class="btns">
          ${
            buyable(w)
              ? html`<a class="btn" href="/buy/${w.slug}" hidden data-buy data-piece="${w.slug}">Add to cart</a>`
              : ''
          }${links}<a
            class="btn alt"
            href="/ask?piece=${w.slug}"
            data-ask
            data-piece="${w.slug}"
            data-title="${w.title}"
            data-status="${w.status}"
            >Ask about this piece</a
          >${
            w.status === 'available'
              ? html`<button
                  class="btn alt"
                  type="button"
                  hidden
                  data-js
                  data-ask
                  data-hold
                  data-piece="${w.slug}"
                  data-title="${w.title}"
                  data-status="${w.status}"
                >
                  Hold for 48 hours
                </button>`
              : ''
          }
          <button class="btn alt" type="button" hidden data-inquiry data-title="${w.title}" data-url="${url}">
            Add to inquiry
          </button>
        </p>
      </div>
    </article>
    ${
      prev || next
        ? html`<nav class="prevnext" aria-label="More works">
            ${prev ? html`<a href="/works/${prev.slug}" rel="prev">← ${prev.title}</a>` : html`<span></span>`}
            ${next ? html`<a href="/works/${next.slug}" rel="next">${next.title} →</a>` : ''}
          </nav>`
        : ''
    }
  </div>`;

  return {
    title: w.title,
    description: w.description
      ? firstSentence(w.description)
      : [w.title, [w.medium, size].filter(Boolean).join(', ')].filter(Boolean).join(' — ').slice(0, 160),
    image: cover ?? null,
    preload: cover ?? null,
    body,
    nav: 'works',
    jsonLd: [jsonLd(w, ctx.url.origin, ctx.studio.name, a.price)],
    scripts: ['/site/lightbox.js', '/site/buy.js'],
  };
};
