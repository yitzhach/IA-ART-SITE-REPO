// /p/{token}: a page a visitor made from the pieces the assistant suggested (D-131, D-141): a title, the question and
// the pieces that are still public. Read only and unlisted (noindex). Not kept by the edge cache.
import {html} from '../html';
import type {Render} from '../page';
import {buttons, titleBlock, workCard} from './parts';

export const render: Render = async (ctx, {token}) => {
  const p = await ctx.data.visitorPage(token!);
  return {
    title: p.title,
    description: p.question ?? p.title,
    noindex: true,
    styles: ['/site/ask.css'],
    canonical: `/p/${p.token}`,
    body: html`<div class="wrap">
      ${titleBlock(p.title)} ${p.question ? html`<p class="lede made-q">${p.question}</p>` : ''}
      ${
        p.works.length
          ? html`<ul class="grid">
              ${p.works.map((w, i) => workCard(w, i + 1))}
            </ul>`
          : html`<p class="empty">These pieces are no longer shown on the site.</p>`
      }
      ${buttons(ctx)}
    </div>`,
  };
};
