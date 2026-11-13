// /privacy and /terms (card F, D-175): the artist's own words from Site → Pages, shown only once saved. The Site
// screen starts each as a draft prefilled from what the site really keeps and the saved return and shipping terms;
// a draft never shows.
import {NotFound} from '../data';
import {html} from '../html';
import {savedPage} from '../optional';
import type {Render} from '../page';
import {pageDescription, sectionBlock, titleBlock} from './parts';

const page =
  (key: 'privacy' | 'terms', fallback: string): Render =>
  async ctx => {
    const p = savedPage(ctx.studio, key);
    if (!p) throw new NotFound(`/${key}`);
    return {
      title: p.title?.trim() || fallback,
      description: pageDescription(p),
      body: html`<div class="wrap">
        ${titleBlock(p.title?.trim() || fallback, p.lede)}${(p.sections ?? []).map(s => sectionBlock(ctx, s))}
      </div>`,
    };
  };

export const privacy = page('privacy', 'Privacy');
export const terms = page('terms', 'Terms');
