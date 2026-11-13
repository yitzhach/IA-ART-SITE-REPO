// /works/{slug}/spec (card C): one printable page for a designer's file, laid out like the certificate: picture,
// title, size in both units, medium, year, price or "Price on request", and how to reach the studio. The phone
// number stays off it, as everywhere on the site (the contact sheet guards it); the email and the piece's address go on.
import {NotFound} from '../data';
import {availability, sizeLine} from '../format';
import {html} from '../html';
import type {Render} from '../page';
import {picture} from '../picture';

export const spec: Render = async (ctx, {slug}) => {
  const w = await ctx.data.work(slug!);
  if (!w) throw new NotFound(slug);
  const a = availability(w);
  const size = sizeLine(w);
  const c = w.images[0];
  const url = `${ctx.url.origin}/works/${w.slug}`;
  const s = ctx.studio;
  const row = (k: string, v: string | number | null | undefined) =>
    v === null || v === undefined || v === ''
      ? ''
      : html`<dt>${k}</dt>
          <dd>${v}</dd>`;
  return {
    title: `Spec sheet: ${w.title}`,
    description: `Spec sheet for ${w.title} by ${s.name}.`,
    noindex: true,
    canonical: `/works/${w.slug}/spec`,
    styles: ['/site/collector.css'],
    scripts: ['/site/collector.js'],
    body: html`<div class="wrap cert-wrap">
      <p class="no-print"><a href="/works/${w.slug}">← ${w.title}</a></p>
      <article class="cert spec" aria-labelledby="spec-h">
        <p class="eyebrow">${s.name} · Spec sheet</p>
        <h1 id="spec-h">${w.title}</h1>
        ${c ? picture(c, {sizes: '(min-width: 700px) 600px, 100vw', alt: c.altText ?? w.title, eager: true}) : ''}
        <dl>
          ${row('Size', size)} ${row('Medium', w.medium)} ${row('Year', w.year)}
          ${row('Edition', w.editionSize ? `Edition of ${w.editionSize}` : null)} ${row('Price', a.price ?? a.label)}
          ${row('Contact', s.email)}
          <dt>Online</dt>
          <dd>${url}</dd>
        </dl>
      </article>
      <p class="no-print">
        <button class="btn" type="button" data-print hidden>Print or save as PDF</button>
      </p>
    </div>`,
  };
};
