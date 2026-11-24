// About: the studio's words in order, with the enquiries address as an email link, then how to start a conversation.
import {html} from '../html';
import type {Render} from '../page';
import {conversation, isEmail, pageDescription, pageOf, sectionBlock, splitClose, titleBlock} from './parts';
import {artistRef, breadcrumbs} from '../schema';

export const render: Render = async ctx => {
  const p = pageOf(ctx, 'about');
  const {rest, closer} = splitClose(p);
  const sections = rest.map(s => {
    const addr = s.body?.trim();
    if (s.key === 'enquiries' && isEmail(addr))
      return html`<section aria-labelledby="s-enquiries">
        <h2 id="s-enquiries">${s.heading ?? 'Enquiries'}</h2>
        <p><a href="mailto:${addr}">${addr}</a></p>
      </section>`;
    return sectionBlock(ctx, s);
  });
  const origin = ctx.canonicalOrigin;
  return {
    title: 'About',
    // The artist (the Person every page carries, D-181) is this page's subject: search engines and AI answers read it
    // as the artist's profile.
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url: `${origin}/about`,
        name: `About ${ctx.studio.name}`,
        ...(pageDescription(p) ? {description: pageDescription(p)} : {}),
        mainEntity: artistRef(origin),
      },
      breadcrumbs(origin, [['About', '/about']]),
    ],
    description: pageDescription(p),
    nav: 'about',
    body: html`<div class="wrap">
      ${titleBlock(p?.title ?? ctx.studio.name, p?.lede)}${sections}${conversation(ctx, closer)}
    </div>`,
  };
};
