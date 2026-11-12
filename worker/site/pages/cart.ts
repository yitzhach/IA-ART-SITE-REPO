// /cart: the visitor's cart and checkout (stage 4, D-146…D-154). The cart lives in the visitor's browser; the page is
// a shell that public/site/buy.js fills: each piece, shipping from the studio's one calculator (a ZIP box for large
// pieces), the offer's nudge and suggestions, then the order form. Never cached, never indexed.
import {html} from '../html';
import type {Render} from '../page';
import {buttons, titleBlock} from './parts';

export const render: Render = async ctx => ({
  title: 'Your cart',
  description: 'Your cart.',
  noindex: true,
  canonical: '/cart',
  styles: ['/site/ask.css'],
  scripts: ['/site/buy.js'],
  body: html`<div class="wrap buy">
    ${titleBlock('Your cart')}
    <div id="cart" data-js hidden><p class="note-line">Looking at your cart…</p></div>
    <noscript><p class="empty">The cart needs scripts. You can still reach the studio:</p></noscript>
    <div class="buy-contact" hidden>${buttons(ctx)}</div>
  </div>`,
});
