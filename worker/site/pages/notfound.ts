// The site's own "not found" and "something went wrong" pages.
import {html} from '../html';
import type {Page} from '../page';

export const notFound = (): Page => ({
  status: 404,
  title: 'Not found',
  noindex: true,
  body: html`<section class="notfound">
    <h1>Not found</h1>
    <p>That page isn't here. <a href="/works">See the works</a> or <a href="/">go home</a>.</p>
  </section>`,
});
