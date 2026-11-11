// The site's own "not found" page.
import {html} from '../html';
import type {Page} from '../page';

export const notFound = (): Page => ({
  status: 404,
  title: 'Not found',
  noindex: true,
  body: html`<div class="wrap">
    <section class="intro notfound">
      <p class="eyebrow">404</p>
      <h1>Not found</h1>
      <p class="lede">That page isn't here.</p>
      <p class="btns"><a class="btn" href="/works">See the works</a><a class="btn alt" href="/">Go home</a></p>
    </section>
  </div>`,
});
