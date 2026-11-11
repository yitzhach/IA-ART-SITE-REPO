// Shared UI helpers. Data never goes through innerHTML: `h` builds elements and sets text via text nodes.
export type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

/** h('button', {class: 'primary', onclick: fn}, 'Save') — attributes starting with "on" are event listeners. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export const clear = (el: Element) => el.replaceChildren();

/** A small rounded label (status, tag). `accent` highlights it. */
export const chip = (text: string, accent = false) => h('span', {class: accent ? 'chip accent' : 'chip'}, text);

export function toast(message: string, ms = 3500): void {
  const t = h('div', {class: 'toast', role: 'status'}, message);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/** Resolves true if the person confirms. */
export function confirmDialog(message: string, ok = 'OK', cancel = 'Cancel'): Promise<boolean> {
  return new Promise(resolve => {
    const dlg = h('dialog', null, h('p', null, message));
    const done = (v: boolean) => {
      dlg.close?.();
      dlg.remove();
      resolve(v);
    };
    dlg.appendChild(
      h(
        'div',
        {class: 'row'},
        h('button', {class: 'primary', onclick: () => done(true)}, ok),
        h('button', {onclick: () => done(false)}, cancel),
      ),
    );
    dlg.addEventListener('cancel', () => done(false));
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', '');
  });
}
