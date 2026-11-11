// Commissions: the studio's words in order, the steps as a numbered sequence, then how to start one.
import {html, type Raw} from '../html';
import type {Render} from '../page';
import type {SiteSection} from '../types';
import {conversation, pageDescription, pageOf, prose, sectionBlock, splitClose, titleBlock} from './parts';

const stepHead = (s: SiteSection, i: number): {n: string; title: string} => {
  const m = /^(\d+)\s*[—–-]\s*(.+)$/.exec(s.heading ?? '');
  return m ? {n: m[1]!, title: m[2]!} : {n: String(i + 1).padStart(2, '0'), title: s.heading ?? ''};
};

export const render: Render = async ctx => {
  const p = pageOf(ctx, 'commissions');
  const {rest, closer} = splitClose(p);
  const out: Raw[] = [];
  for (let i = 0; i < rest.length; i++) {
    const s = rest[i]!;
    if (s.key?.startsWith('step-')) {
      const steps: SiteSection[] = [];
      while (rest[i]?.key?.startsWith('step-')) steps.push(rest[i++]!);
      i--;
      out.push(
        html`<ol class="steps">
          ${steps.map((st, j) => {
            const h = stepHead(st, j);
            return html`<li class="step nophoto">
              <span class="n">${h.n}</span>
              <div class="prose">
                <h3>${h.title}</h3>
                ${prose(st.body)}
              </div>
            </li>`;
          })}
        </ol>`,
      );
    } else if (s.heading && !s.body && !s.place) out.push(html`<h2 class="gap">${s.heading}</h2>`);
    else out.push(sectionBlock(ctx, s));
  }
  return {
    title: 'Commissions',
    description: pageDescription(p),
    nav: 'commissions',
    body: html`<div class="wrap">
      ${titleBlock(p?.title ?? 'Commissions', p?.lede)}${out}${conversation(ctx, closer)}
    </div>`,
  };
};
