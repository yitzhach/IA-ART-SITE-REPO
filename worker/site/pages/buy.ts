// /buy/{slug}: the old one-piece address (stage 4, D-144), kept for links already shared. public/site/buy.js puts the
// piece in the cart and goes on to /cart, where buying happens (D-151). A piece that can't be bought says why. Unlisted.
import {NotFound} from '../data';
import {availability, buyable, sizeLine} from '../format';
import {html} from '../html';
import type {Render} from '../page';
import {picture} from '../picture';
import {buttons, titleBlock} from './parts';

export const render: Render = async (ctx, {slug}) => {
  const w = await ctx.data.work(slug!);
  if (!w) throw new NotFound(slug);
  const a = availability(w);
  const size = sizeLine(w);
  const cover = w.images[0];
  const can = buyable(w);
  return {
    title: `Buy ${w.title}`,
    description: `Buy ${w.title}.`,
    noindex: true,
    canonical: `/buy/${w.slug}`,
    styles: ['/site/ask.css'],
    scripts: ['/site/buy.js'],
    body: html`<div class="wrap buy">
      ${titleBlock(`Buy ${w.title}`)}
      <div class="buy-piece">
        ${cover ? html`<a href="/works/${w.slug}">${picture(cover, {sizes: '160px', alt: cover.altText ?? w.title})}</a>` : ''}
        <p>
          <a href="/works/${w.slug}"><strong>${w.title}</strong></a
          ><br />${size ?? ''}${size ? html`<br />` : ''}${a.price ?? a.label}
        </p>
      </div>
      ${
        can
          ? html`<div id="buy" data-js hidden data-piece="${w.slug}">
                <p class="note-line">Adding it to your cart…</p>
              </div>
              <noscript><p class="empty">Buying here needs scripts. You can still reach the studio:</p></noscript>`
          : html`<p class="empty">
              ${
                w.status === 'available'
                  ? 'This piece ships by quote. Send an inquiry and the artist will reply with shipping.'
                  : `This piece is ${a.label.toLowerCase()}.`
              }
            </p>`
      }
      <div class="buy-contact" ${can ? 'hidden' : ''}>
        ${buttons(ctx, {subject: w.title, lines: [`${ctx.url.origin}/works/${w.slug}`], slug: w.slug, url: `${ctx.url.origin}/works/${w.slug}`})}
      </div>
    </div>`,
  };
};
