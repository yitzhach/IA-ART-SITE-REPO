// One work: big cover, the facts, how to ask about it (Text / Email / Call with the piece written in), more
// pictures that open in a lightbox, and the neighbours. All text comes from the studio's record, escaped.
import {colourNames, colourPhrase} from '../colours';
import {NotFound} from '../data';
import {availability, buyable, clip, shippingLine, sizeLine} from '../format';
import {html, type Raw} from '../html';
import type {Render} from '../page';
import {picture, sizeUrl} from '../picture';
import type {PublicArtwork} from '../types';
import {COVER_SIZES, contactLinks, firstSentence, prose} from './parts';
import {abs, artistRef, breadcrumbs, UNIT_CODE} from '../schema';

const AVAIL: Record<string, string> = {
  available: 'https://schema.org/InStock',
  reserved: 'https://schema.org/LimitedAvailability',
  sold: 'https://schema.org/SoldOut',
};

function jsonLd(w: PublicArtwork, origin: string, price: string | null): object {
  const url = `${origin}/works/${w.slug}`;
  const dim = (v: number | null) =>
    v && v > 0
      ? {'@type': 'QuantitativeValue', value: v, unitCode: UNIT_CODE[w.sizeUnit], unitText: w.sizeUnit}
      : undefined;
  const offers =
    w.status === 'sold'
      ? {'@type': 'Offer', availability: AVAIL.sold}
      : price && w.priceCents !== null && w.currency
        ? {
            '@type': 'Offer',
            price: (w.priceCents / 100).toFixed(2),
            priceCurrency: w.currency,
            availability: AVAIL.available,
            url,
          }
        : undefined;
  // Every picture of the piece, each with its words, so image search and answer engines can describe it.
  const images = w.images.flatMap(i => {
    const src = sizeUrl(i, 1600);
    if (!src) return [];
    const largest = [...i.sizes].sort((a, b) => b.width - a.width)[0];
    return [
      {
        '@type': 'ImageObject',
        contentUrl: abs(origin, src),
        ...(i.altText ? {caption: i.altText} : {}),
        ...(largest && i.aspectRatio ? {width: largest.width, height: Math.round(largest.width / i.aspectRatio)} : {}),
        creator: artistRef(origin),
      },
    ];
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'VisualArtwork',
    '@id': `${url}#artwork`,
    name: w.title,
    url,
    mainEntityOfPage: url,
    image: images.length ? images : undefined,
    artform: w.collection === 'Sculptural' ? 'Sculpture' : undefined,
    artMedium: w.medium ?? undefined,
    width: dim(w.width),
    height: dim(w.height),
    depth: dim(w.depth),
    dateCreated: w.year ? String(w.year) : undefined,
    color: colourNames(w.palette).join(', ') || undefined,
    keywords: w.tags.length ? w.tags.join(', ') : undefined,
    genre: w.collection ?? undefined,
    artEdition: w.editionSize && w.editionSize > 1 ? String(w.editionSize) : undefined,
    description: w.description ? firstSentence(w.description, 500) : undefined,
    creator: artistRef(origin),
    offers,
  };
}

/** The page's description: what the piece is and who made it first (that is what a search result or an AI answer
 * quotes), then its own first words. */
export function pieceDescription(w: PublicArtwork, artist: string): string {
  // "Cement, plaster" reads as "cement, plaster" mid-sentence; "Venetian plaster" or "UV ink" keep their capitals.
  const medium = w.medium && /^[A-Z][a-z]/.test(w.medium) ? w.medium[0]!.toLowerCase() + w.medium.slice(1) : w.medium;
  const what = [medium, sizeLine(w)?.replace(/ \(.*\)$/, '')].filter(Boolean).join(', ');
  const lead = `${w.title} by ${artist}${what ? `, ${what}` : ''}${w.status === 'sold' ? ' (sold)' : ''}.`;
  return clip(w.description ? `${lead} ${w.description}` : lead, 160);
}

/** "See it on your wall" (stage 5, D-157): only with scripts, only for a piece with a width, a height and a picture. */
function wallButton(w: PublicArtwork, cover: PublicArtwork['images'][number] | undefined): Raw | '' {
  const ok = (v: number | null) => typeof v === 'number' && v > 0;
  const img = cover ? sizeUrl(cover, 1600) : null;
  if (!ok(w.width) || !ok(w.height) || !img) return '';
  return html`<button
    class="btn alt"
    type="button"
    hidden
    data-js
    data-wall
    data-piece="${w.slug}"
    data-title="${w.title}"
    data-w="${w.width}"
    data-h="${w.height}"
    data-d="${w.depth ?? ''}"
    data-unit="${w.sizeUnit}"
    data-img="${img}"
  >
    See it on your wall
  </button>`;
}

export const render: Render = async (ctx, {slug}) => {
  const [w, list] = await Promise.all([ctx.data.work(slug!), ctx.data.works()]);
  if (!w) throw new NotFound(slug);
  const url = `${ctx.canonicalOrigin}/works/${w.slug}`;
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
  const facts: [string, string | number | Raw][] = [];
  // Said in words on the page, not only in the data: many answer engines read only what a visitor sees.
  facts.push(['Artist', html`<a href="/about">${ctx.studio.name}</a>`]);
  if (size) facts.push(['Size', size]);
  if (w.medium) facts.push(['Medium', w.medium]);
  if (w.year) facts.push(['Year', w.year]);
  const colours = colourPhrase(colourNames(w.palette));
  if (colours) facts.push(['Colors', colours]);
  const ship = w.status === 'available' && a.price ? shippingLine(w) : null;
  if (ship) facts.push(['Shipping', ship]);
  if (w.collection)
    facts.push([
      'Collection',
      html`<a href="/works?collection=${encodeURIComponent(w.collection)}">${w.collection}</a>`,
    ]);

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
                  ${more.map(i => html`<li>${lb(i, '(min-width: 900px) 20vw, 40vw', false)}</li>`)}
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
            ${wallButton(w, cover)}
            <button class="btn alt" type="button" hidden data-inquiry data-title="${w.title}" data-url="${url}">
              Add to inquiry
            </button>
          </p>
          <p class="spec-link"><a href="/works/${w.slug}/spec">Spec sheet</a> for designers: one page to print</p>
        </div>
      </article>
    </div>
    ${
      prev || next
        ? html`<nav class="band endband" aria-label="More works">
            <div class="wrap">
              <p class="eyebrow">More works</p>
              <div class="prevnext">
                ${prev ? html`<a href="/works/${prev.slug}" rel="prev">← ${prev.title}</a>` : html`<span></span>`}
                ${next ? html`<a href="/works/${next.slug}" rel="next">${next.title} →</a>` : ''}
              </div>
            </div>
          </nav>`
        : ''
    }`;

  return {
    title: w.title,
    description: pieceDescription(w, ctx.studio.name),
    image: cover ?? null,
    preload: cover ?? null,
    // The price (.avail strong) is set in Bodoni 500, which no other page shows above the fold.
    fonts: ['/fonts/bodoni-500.woff2'],
    body,
    nav: 'works',
    jsonLd: [
      jsonLd(w, ctx.canonicalOrigin, a.price),
      breadcrumbs(ctx.canonicalOrigin, [
        ['Works', '/works'],
        ...(w.collection
          ? ([[w.collection, `/works?collection=${encodeURIComponent(w.collection)}`]] as [string, string][])
          : []),
        [w.title, `/works/${w.slug}`],
      ]),
    ],
    scripts: ['/site/lightbox.js', '/site/buy.js'],
  };
};
