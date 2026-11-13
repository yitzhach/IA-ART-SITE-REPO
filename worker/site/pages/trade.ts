// /trade, "For designers and architects" (card C): the artist's own page words (Site → Pages), then the trade,
// commission, installation and shipping answers they saved for the assistant. Not found until the page is saved
// (D-175), like the care notes: a draft never shows.
import {NotFound} from '../data';
import {html} from '../html';
import {savedPage, TRADE_TOPICS} from '../optional';
import type {Render} from '../page';
import {conversation, pageDescription, prose, sectionBlock, splitClose, titleBlock} from './parts';

export const render: Render = async ctx => {
  const p = savedPage(ctx.studio, 'trade');
  if (!p) throw new NotFound('/trade');
  const answers = (await ctx.data.assistant())?.answers ?? {};
  const {rest, closer} = splitClose(p);
  const fromAnswers = TRADE_TOPICS.flatMap(t => {
    const a = typeof answers[t.key] === 'string' ? answers[t.key]!.trim() : '';
    return a
      ? [
          html`<section aria-labelledby="t-${t.key}">
            <h2 id="t-${t.key}">${t.heading}</h2>
            <div class="prose">${prose(a)}</div>
          </section>`,
        ]
      : [];
  });
  return {
    title: p.title ?? 'For designers and architects',
    description: pageDescription(p),
    body: html`<div class="wrap">
      ${titleBlock(p.title ?? 'For designers and architects', p.lede)}${rest.map(s => sectionBlock(ctx, s))}
      ${fromAnswers}
      <p>Each piece has a spec sheet to print: open a piece and tap Spec sheet.</p>
      ${conversation(ctx, closer)}
    </div>`,
  };
};
