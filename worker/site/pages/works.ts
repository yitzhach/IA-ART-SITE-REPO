// Works: every public work, newest first, numbered like the old site's index. Filters are plain links
// (collection=, status=); "More" is a link too (cursor=). Nothing here needs a script except the inquiry bar.
import {html, type Raw} from '../html';
import type {Render} from '../page';
import {workCard} from './parts';
import {abs, artistRef, breadcrumbs} from '../schema';

const STATUSES = [
  ['available', 'Available'],
  ['sold', 'Sold'],
] as const;

export const render: Render = async (ctx, _params) => {
  const q = ctx.url.searchParams;
  const {items: cols} = await ctx.data.collections();
  const collection = cols.find(c => c.name === q.get('collection'))?.name;
  const status = STATUSES.find(([k]) => k === q.get('status'))?.[0];
  const cursor = q.get('cursor') || undefined;
  const list = await ctx.data.works({collection, status, cursor});

  const href = (c?: string, s?: string, cur?: string, from?: number) => {
    const qs = new URLSearchParams();
    if (c) qs.set('collection', c);
    if (s) qs.set('status', s);
    if (cur) qs.set('cursor', cur);
    if (cur && from) qs.set('from', String(from));
    return `/works${qs.size ? `?${qs}` : ''}`;
  };
  const link = (label: string, to: string, on: boolean): Raw =>
    html`<li><a href="${to}" ${on ? html`aria-current="true"` : ''}>${label}</a></li>`;
  // The API's cursor is opaque; the More link carries where the numbering goes on.
  const from = Number(q.get('from'));
  const offset = cursor && Number.isInteger(from) && from > 0 && from < 100000 ? from : 0;

  const body = html`<div class="wrap">
    <div class="intro">
      <p class="eyebrow">Index</p>
      <h1>Works</h1>
    </div>
    <nav aria-label="Filter works">
      <ul class="filters">
        <li class="lbl">Collection</li>
        ${link('All', href(undefined, status), !collection)}${cols.map(c => link(c.name, href(c.name, status), c.name === collection))}
      </ul>
      <ul class="filters">
        <li class="lbl">Status</li>
        ${link('All', href(collection), !status)}${STATUSES.map(([k, l]) => link(l, href(collection, k), k === status))}
      </ul>
    </nav>
    ${
      list.items.length
        ? html`<ul class="wall top">
            ${list.items.map((w, i) => workCard(w, offset + i + 1))}
          </ul>`
        : html`<p class="empty">No works match. <a href="/works">See all works</a>.</p>`
    }
    ${list.nextCursor ? html`<p class="more"><a class="btn alt" href="${href(collection, status, list.nextCursor, offset + list.items.length)}" rel="next">More</a></p>` : ''}
  </div>`;
  return {
    title: 'Works',
    description: `Works by ${ctx.studio.name}${collection ? ` — ${collection}` : ''}${status ? `, ${status}` : ''}.`,
    body,
    nav: 'works',
    canonical: href(collection, status, cursor, offset),
    // The works on this page as a list, so a crawler reads the catalogue without following every card.
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        url: abs(ctx.canonicalOrigin, href(collection, status, cursor, offset)),
        name: `Works by ${ctx.studio.name}${collection ? ` — ${collection}` : ''}`,
        author: artistRef(ctx.canonicalOrigin),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: list.items.length,
          itemListElement: list.items.map((w, i) => ({
            '@type': 'ListItem',
            position: offset + i + 1,
            url: `${ctx.canonicalOrigin}/works/${w.slug}`,
            name: w.title,
          })),
        },
      },
      breadcrumbs(ctx.canonicalOrigin, [
        ['Works', '/works'],
        ...(collection ? ([[collection, href(collection)]] as [string, string][]) : []),
      ]),
    ],
  };
};
