// /c/{token}: a collector's own page (stage 6, D-163…D-168), reached only by its private link: the works they own with
// their certificates, the studio's care notes, their commission's stage, and first look at new work before the public
// site. /c/{token}/certificate/{number}: one work's certificate, laid out to print (the phone's own Print or Save as
// PDF). Both unlisted (noindex) and never kept by the edge cache; a stopped link shows the not-found page.
import {sizeLine} from '../format';
import {html, raw, type Raw} from '../html';
import type {PageCtx, Render} from '../page';
import {picture} from '../picture';
import type {CommissionStage, PublicCollectorPage, PublicFirstLookWork, PublicOwnedWork} from '../types';
import {buttons, CARD_SIZES, chip, prose, titleBlock} from './parts';
import {NotFound} from '../data';

export const STAGES: [CommissionStage, string][] = [
  ['surface', 'Surface'],
  ['layering', 'Layering'],
  ['color', 'Color'],
  ['erosion', 'Erosion'],
  ['finished', 'Finished'],
];

/** "November 19" for a first look's end, in the studio's time zone. */
export function dayOf(iso: string, timeZone?: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-US', {month: 'long', day: 'numeric', timeZone: timeZone || 'UTC'}).format(
      new Date(iso),
    );
  } catch {
    return iso.slice(0, 10);
  }
}

const cover = (w: {images: PublicOwnedWork['images']; title: string}) => {
  const c = w.images[0];
  return c ? picture(c, {sizes: CARD_SIZES, alt: c.altText ?? w.title}) : raw('<div class="blank"></div>');
};

function ownedCard(token: string, w: PublicOwnedWork): Raw {
  const size = sizeLine(w)?.replace(/ \(.*\)$/, '');
  return html`<li>
    <a class="card" href="/c/${token}/certificate/${w.certificate}">
      ${cover(w)}
      <span class="meta">
        <span class="ttl">${w.title}</span>
        <span class="sz">${[w.year, w.medium].filter(Boolean).join(' · ')}</span>
        ${size ? html`<span class="sz">${size}</span>` : ''}
        <span class="chip">Certificate ${w.certificate}</span>
      </span>
    </a>
  </li>`;
}

/** A first-look work: its picture and facts; Add to cart (shown by collector.js when the studio sells online) and
 * the contact buttons, since its public page doesn't exist yet. */
export function firstLookCard(ctx: PageCtx, w: PublicFirstLookWork): Raw {
  const size = sizeLine(w)?.replace(/ \(.*\)$/, '');
  const thumb = w.images[0]?.sizes.find(s => s.width === 480)?.url ?? '';
  return html`<li class="fl-item">
    <div class="card">
      ${cover(w)}
      <span class="meta">
        <span class="ttl">${w.title}</span>
        ${size ? html`<span class="sz">${size}</span>` : ''}${chip(w)}
        <span class="sz">On the public site ${dayOf(w.publicFrom, ctx.studio.timezone)}</span>
      </span>
    </div>
    ${
      w.status === 'available' && w.priceCents !== null
        ? html`<button
            class="btn fl-buy"
            type="button"
            hidden
            data-fl="${w.slug}"
            data-title="${w.title}"
            data-thumb="${thumb}"
          >
            Add to cart
          </button>`
        : ''
    }
  </li>`;
}

function commissionBlock(c: PublicCollectorPage['commissions'][number]): Raw {
  const at = STAGES.findIndex(([k]) => k === c.stage);
  return html`<article class="commission">
    <h3>${c.title}</h3>
    ${c.size ? html`<p class="sz">${c.size}</p>` : ''}
    <ol class="stages">
      ${STAGES.map(
        ([key, label], i) =>
          html`<li class="${i < at ? 'done' : i === at ? 'now' : ''}" ${i === at ? raw('aria-current="step"') : ''}>
            <b>${label}</b>${c.notes[key] ? html`<span>${c.notes[key]}</span>` : ''}
          </li>`,
      )}
    </ol>
    ${c.status === 'done' ? html`<p class="note-line">Finished.</p>` : ''}
  </article>`;
}

export const render: Render = async (ctx, {token}) => {
  const p = await ctx.data.collectorPage(token!);
  const commissions = p.commissions.filter(c => c.status !== 'cancelled');
  return {
    title: 'Your collection',
    description: `Your collection with ${p.studioName}.`,
    noindex: true,
    canonical: `/c/${token}`,
    styles: ['/site/collector.css'],
    scripts: ['/site/collector.js'],
    body: html`<div class="wrap collector" data-collector="${token}">
      ${titleBlock(`Hello, ${p.firstName}`, `Your collection with ${p.studioName}. This page is yours: keep the link.`)}
      <section aria-labelledby="own-h">
        <h2 id="own-h">Your collection</h2>
        ${
          p.works.length
            ? html`<p class="note-line">Tap a piece for its certificate.</p>
                <ul class="grid">
                  ${p.works.map(w => ownedCard(token!, w))}
                </ul>`
            : html`<p class="empty">The pieces you own will show here once the studio adds them.</p>`
        }
      </section>
      ${
        commissions.length
          ? html`<section aria-labelledby="comm-h">
              <h2 id="comm-h">Your commission${commissions.length > 1 ? 's' : ''}</h2>
              ${commissions.map(commissionBlock)}
            </section>`
          : ''
      }
      ${
        p.firstLook.length
          ? html`<section aria-labelledby="fl-h">
              <h2 id="fl-h">First look</h2>
              <p class="note-line">New work, here before it reaches the public site.</p>
              <ul class="grid fl">
                ${p.firstLook.map(w => firstLookCard(ctx, w))}
              </ul>
            </section>`
          : ''
      }
      ${
        p.care
          ? html`<section aria-labelledby="care-h">
              <h2 id="care-h">Caring for your work</h2>
              <div class="prose">${prose(p.care)}</div>
            </section>`
          : ''
      }
      <section aria-labelledby="ask-h">
        <h2 id="ask-h">Questions?</h2>
        ${buttons(ctx)}
      </section>
    </div>`,
  };
};

/** /c/{token}/certificate/{number} */
export const certificate: Render = async (ctx, {token, number}) => {
  const p = await ctx.data.collectorPage(token!);
  const w = p.works.find(x => x.certificate === number);
  if (!w) throw new NotFound(number!);
  const size = sizeLine(w);
  const c = w.images[0];
  return {
    title: `Certificate ${w.certificate}`,
    description: `Certificate of authenticity for ${w.title}.`,
    noindex: true,
    canonical: `/c/${token}/certificate/${w.certificate}`,
    styles: ['/site/collector.css'],
    scripts: ['/site/collector.js'],
    body: html`<div class="wrap cert-wrap">
      <p class="no-print"><a href="/c/${token}">← Your collection</a></p>
      <article class="cert" aria-labelledby="cert-h">
        <p class="eyebrow">Certificate of authenticity</p>
        <h1 id="cert-h">${w.title}</h1>
        ${c ? picture(c, {sizes: '(min-width: 700px) 600px, 100vw', alt: c.altText ?? w.title, eager: true}) : ''}
        <dl>
          ${
            w.year
              ? html`<dt>Year</dt>
                  <dd>${w.year}</dd>`
              : ''
          }
          ${
            w.medium
              ? html`<dt>Medium</dt>
                  <dd>${w.medium}</dd>`
              : ''
          }
          ${
            size
              ? html`<dt>Size</dt>
                  <dd>${size}</dd>`
              : ''
          }
          <dt>Certificate</dt>
          <dd>${w.certificate}</dd>
          ${
            w.soldOn
              ? html`<dt>Acquired</dt>
                  <dd>${w.soldOn}</dd>`
              : ''
          }
        </dl>
        <p>This is an original work by ${p.studioName}, made by hand by the artist.</p>
        <p class="sign">Signed <span class="line"></span></p>
      </article>
      <p class="no-print">
        <button class="btn" type="button" data-print hidden>Print or save as PDF</button>
      </p>
    </div>`,
  };
};

export type {PublicCollectorPage};
