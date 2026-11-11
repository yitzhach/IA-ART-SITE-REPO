// Stub: replaced by its card (see the task card). Keeps the router compiling.
import {html} from '../html';
import type {Render} from '../page';

export const render: Render = async ctx => ({title: 'commissions', body: html`<h1>${ctx.studio.name}</h1>`});
