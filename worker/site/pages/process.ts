// Process: the five stages as a numbered sequence (01–05), each with its photo.
import {html, type Raw} from '../html';
import {place, type Render} from '../page';
import {
  conversation,
  pageDescription,
  pageOf,
  photo,
  prose,
  sectionBlock,
  splitClose,
  titleBlock,
  WIDE_SIZES,
} from './parts';

const STAGES = ['surface', 'layering', 'color', 'erosion', 'finished'];

export const render: Render = async ctx => {
  const p = pageOf(ctx, 'process');
  const {rest, closer} = splitClose(p);
  const stages = rest.filter(s => s.key && STAGES.includes(s.key));
  const others = rest.filter(s => !stages.includes(s));
  const intro = others.filter(s => s.key === 'intro');
  const after = others.filter(s => s.key !== 'intro');

  const seq: Raw | '' = stages.length
    ? html`<ol class="steps">
        ${stages.map((s, i) => {
          const ph = s.place ? place(ctx, s.place)[0] : undefined;
          return html`<li class="step">
            <span class="n">${String(i + 1).padStart(2, '0')}</span>
            <div class="prose">${s.heading ? html`<h2>${s.heading}</h2>` : ''}${prose(s.body)}</div>
            ${ph ? html`<div>${photo(ph, WIDE_SIZES)}</div>` : ''}
          </li>`;
        })}
      </ol>`
    : '';
  return {
    title: 'Process',
    description: pageDescription(p),
    nav: 'process',
    body: html`<div class="wrap">
      ${titleBlock(p?.title ?? 'Process', p?.lede)}${intro.map(s => sectionBlock(ctx, s))}${seq}
      <div class="after">${after.map(s => sectionBlock(ctx, s))}</div>
      ${conversation(ctx, closer && !closer.heading ? {...closer, heading: 'Start a conversation'} : closer)}
    </div>`,
  };
};
