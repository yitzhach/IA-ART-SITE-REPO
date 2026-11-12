// /inquiry: the visitor's list, like a cart. The list lives in this browser (localStorage), so the page is a shell that
// public/site/inquiry-page.js fills in. Without scripts it says so and points to /contact.
import {html} from '../html';
import type {Render} from '../page';
import {buttons, titleBlock} from './parts';

export const render: Render = async ctx => ({
  title: 'Your inquiry',
  description: 'The pieces you added, ready to send to the studio.',
  noindex: true,
  styles: ['/site/ask.css'],
  scripts: ['/site/inquiry-page.js'],
  body: html`<div class="wrap">
    ${titleBlock('Your inquiry', 'The pieces you added, ready to send to the studio.')}
    <noscript>
      <p class="empty">
        The inquiry list needs scripts to keep your pieces. You can still reach the studio from the
        <a href="/contact">contact page</a>.
      </p>
      ${buttons(ctx)}
    </noscript>
    <div id="inq" data-js hidden></div>
  </div>`,
});
