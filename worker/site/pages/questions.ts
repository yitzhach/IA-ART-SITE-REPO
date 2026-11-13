// Questions: the answers the artist saved for the assistant (Site → Assistant → Answers), one question each, with
// FAQPage data. Only saved answers show; with none the page is not found (and the footer and sitemap leave it out).
import {NotFound} from '../data';
import {html} from '../html';
import {savedAnswers} from '../optional';
import type {Render} from '../page';
import {conversation, firstSentence, prose, titleBlock} from './parts';

export const render: Render = async ctx => {
  const answers = savedAnswers(await ctx.data.assistant());
  if (!answers.length) throw new NotFound('/questions');
  return {
    title: 'Questions',
    description: firstSentence(`Answers from ${ctx.studio.name}: ${answers.map(a => a.q).join(' ')}`),
    body: html`<div class="wrap">
      ${titleBlock('Questions', `Answers from ${ctx.studio.name}. Anything else, just ask.`)}
      ${answers.map(
        a =>
          html`<section aria-labelledby="q-${a.key}">
            <h2 id="q-${a.key}">${a.q}</h2>
            <div class="prose">${prose(a.a)}</div>
          </section>`,
      )}
      ${conversation(ctx)}
    </div>`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: answers.map(a => ({
          '@type': 'Question',
          name: a.q,
          acceptedAnswer: {'@type': 'Answer', text: a.a},
        })),
      },
    ],
  };
};
