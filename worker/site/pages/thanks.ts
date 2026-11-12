// /thanks/{id}: after buying (stage 4, D-144). Square sends the buyer back here; Venmo and Zelle buyers come straight
// here. public/site/buy.js reads their own order (the visitor cookie decides whose) and says where it stands. Unlisted.
import {html} from '../html';
import type {Render} from '../page';
import {buttons, titleBlock} from './parts';

export const render: Render = async (ctx, {id}) => ({
  title: 'Your order',
  description: 'Your order.',
  noindex: true,
  canonical: `/thanks/${id}`,
  styles: ['/site/ask.css'],
  scripts: ['/site/buy.js'],
  body: html`<div class="wrap buy">
    ${titleBlock('Your order')}
    <div id="thanks" data-js hidden data-order="${id!}"><p class="note-line">Looking up your order…</p></div>
    <noscript><p class="empty">Your order details need scripts. The studio has emailed you.</p></noscript>
    ${buttons(ctx)}
  </div>`,
});
