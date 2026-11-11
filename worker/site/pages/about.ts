// About: the studio's words in order, with the enquiries address as an email link, then how to start a conversation.
import {html} from '../html';
import type {Render} from '../page';
import {conversation, isEmail, pageDescription, pageOf, sectionBlock, splitClose, titleBlock} from './parts';

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
  return {
    title: 'About',
    description: pageDescription(p),
    nav: 'about',
    body: html`<div class="wrap">
      ${titleBlock(p?.title ?? ctx.studio.name, p?.lede)}${sections}${conversation(ctx, closer)}
    </div>`,
  };
};
