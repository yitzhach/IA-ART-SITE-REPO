import {h, type Child} from '../ui';

/** Replaces everything inside `el` (children may include null / false, like `h`). */
export function mount(el: Element, ...children: Child[]): void {
  el.replaceChildren(...Array.from(h('div', null, ...children).childNodes));
}
