// /contact: Text and Call without scripts. The number stays out of the page until a one-question check is answered
// (D-133); that one response is never stored (`no-store`). With scripts the contact sheet does the same on a tap.
import {contactHref, mailHref, QUESTIONS, rightAnswer, unlockedSmsHref, unlockedTelHref, type About} from '../contact';
import {NotFound} from '../data';
import {html} from '../html';
import type {Render} from '../page';
import {titleBlock} from './parts';

export const render: Render = async ctx => {
  const s = ctx.studio;
  const q = ctx.url.searchParams;
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(q.get('w') ?? '') ? q.get('w')! : '';
  let about: About = {};
  if (slug) {
    const w = await ctx.data.work(slug).catch(e => (e instanceof NotFound ? null : Promise.reject(e)));
    if (w) {
      const url = `${ctx.url.origin}/works/${w.slug}`;
      about = {subject: w.title, lines: [url], slug: w.slug, url};
    }
  }
  const asked = q.has('a');
  const i = Number(q.get('i'));
  const ok = asked && Number.isInteger(i) && rightAnswer(i, q.get('a') ?? '');
  const mail = mailHref(s, about);
  const email = mail ? html`<a class="btn alt" href="${mail}">Email</a>` : '';

  let body;
  if (!s.phone) {
    body = html`<div class="wrap">
      ${titleBlock('Contact', `Write to ${s.name}.`)}
      <p class="btns">${email}</p>
    </div>`;
  } else if (ok) {
    const sms = unlockedSmsHref(s, about)!;
    const tel = unlockedTelHref(s)!;
    body = html`<div class="wrap">
      ${titleBlock('Text or call', `${s.name}${about.subject ? `, about ${about.subject}` : ''}`)}
      <p class="the-number">${s.phone}</p>
      <p class="btns"><a class="btn" href="${sms}">Text</a><a class="btn alt" href="${tel}">Call</a>${email}</p>
    </div>`;
  } else {
    // A wrong answer gets a different question; the first visit a random one.
    const next =
      Number.isInteger(i) && asked
        ? (i + 1 + Math.floor(Math.random() * (QUESTIONS.length - 1))) % QUESTIONS.length
        : Math.floor(Math.random() * QUESTIONS.length);
    body = html`<div class="wrap">
      ${titleBlock('Text or call', 'One quick question, so the number stays out of the reach of spam robots.')}
      <form class="search" method="get" action="${contactHref(about).split('?')[0]}">
        ${slug ? html`<input type="hidden" name="w" value="${slug}" />` : ''}
        <input type="hidden" name="i" value="${next}" />
        ${asked ? html`<p class="err" role="alert">That wasn't it. Try this one.</p>` : ''}
        <label for="a">${QUESTIONS[next]!.q}</label>
        <div class="search-row">
          <input id="a" name="a" type="text" autocomplete="off" autocapitalize="off" required />
          <button class="btn" type="submit">Show the number</button>
        </div>
      </form>
      <p class="btns">${email}</p>
    </div>`;
  }
  return {
    title: 'Contact',
    description: `Text, call or email ${s.name}.`,
    body,
    noindex: true,
    styles: ['/site/ask.css'],
    canonical: '/contact',
  };
};
