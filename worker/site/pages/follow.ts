// Following the studio (stage 6): /follow (from the footer) and /follow/{showId} (a show's QR code) ask for an email and
// a six-digit code (collector.js does both steps); /f/{token} is a follower's own page: first look while they follow,
// and Stop following. All unlisted and never kept by the edge cache.
import {html} from '../html';
import type {Render} from '../page';
import {firstLookCard} from './collector';
import {titleBlock} from './parts';

const form = (showId?: string) =>
  html`<form class="follow-form" data-follow data-show="${showId ?? ''}" hidden>
      <label class="field" for="follow-email">Your email</label>
      <input id="follow-email" name="email" type="email" autocomplete="email" required maxlength="200" />
      <input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button class="btn" type="submit">Send me a code</button>
      <div class="code-step" hidden>
        <label class="field" for="follow-code">The six-digit code we emailed you</label>
        <input
          id="follow-code"
          name="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern="[0-9]{6}"
          maxlength="6"
        />
        <button class="btn" type="button" data-verify>Follow</button>
      </div>
      <p class="follow-msg" role="status" aria-live="polite"></p>
    </form>
    <noscript><p class="empty">Following needs scripts turned on.</p></noscript>`;

export const render: Render = async ctx => ({
  title: 'Follow the studio',
  description: `See new work from ${ctx.studio.name} before it reaches the site.`,
  noindex: true,
  canonical: '/follow',
  styles: ['/site/collector.css'],
  scripts: ['/site/collector.js'],
  body: html`<div class="wrap follow">
    ${titleBlock('Follow the studio', 'New work comes to followers first, by email, before the public site.')} ${form()}
  </div>`,
});

export const show: Render = async (ctx, {id}) => {
  const s = await ctx.data.show(id!);
  const where = [s.venue, s.city].filter(Boolean).join(', ');
  return {
    title: `Follow the studio · ${s.name}`,
    description: `Thanks for stopping by at ${s.name}. Follow ${ctx.studio.name} to see new work first.`,
    noindex: true,
    canonical: `/follow/${s.id}`,
    styles: ['/site/collector.css'],
    scripts: ['/site/collector.js'],
    body: html`<div class="wrap follow">
      ${titleBlock(`Thanks for stopping by`, `${s.name}${where ? ` · ${where}` : ''}`)}
      <p>Leave your email to see new work first, before it reaches the public site. Stop any time.</p>
      ${form(s.id)}
    </div>`,
  };
};

export const follower: Render = async (ctx, {token}) => {
  const p = await ctx.data.followerPage(token!);
  return {
    title: 'You follow the studio',
    description: `New work from ${p.studioName}, first.`,
    noindex: true,
    canonical: `/f/${token}`,
    styles: ['/site/collector.css'],
    scripts: ['/site/collector.js'],
    body: html`<div class="wrap collector" data-follower="${token}">
      ${
        p.following
          ? html`${titleBlock('You follow the studio', `New work comes to ${p.email} first.`)}
              ${
                p.firstLook.length
                  ? html`<section aria-labelledby="fl-h">
                      <h2 id="fl-h">First look</h2>
                      <ul class="grid fl">
                        ${p.firstLook.map(w => firstLookCard(ctx, w))}
                      </ul>
                    </section>`
                  : html`<p class="empty">Nothing new right now. You'll get an email when there is.</p>`
              }
              <p><button class="btn alt" type="button" data-stop hidden>Stop following</button></p>
              <p class="follow-msg" role="status" aria-live="polite"></p>`
          : html`${titleBlock('You stopped following', `No more emails to ${p.email}.`)}
              <p><a class="btn alt" href="/follow">Follow again</a></p>`
      }
    </div>`,
  };
};
