// Stub: replaced by card C. Keeps the router compiling.
import {NotFound} from '../data';
import {html} from '../html';
import type {Render} from '../page';

export const render: Render = async (ctx, {slug}) => {
  const w = await ctx.data.work(slug!);
  if (!w) throw new NotFound(slug);
  return {title: w.title, body: html`<h1>${w.title}</h1>`};
};
