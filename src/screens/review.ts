import {h} from '../ui';
import type {Params} from '../router';

// Placeholder: a later task replaces this with the real screen. Keep the signature.
export function render(el: HTMLElement, _params: Params): void {
  el.replaceChildren(h('h1', null, 'Review drafts'));
}
