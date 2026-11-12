// Form pieces shared by Add, the work screen and Review. Each field can be read back, or says what is wrong.
import {
  addTags,
  centsToDollars,
  parseDollars,
  parseNumber,
  parseYear,
  removeTag,
  STATUS_LABELS,
} from '../lib/work-logic';
import {mergePiece, pieceFields, TIER_LABELS, type ArtworkShipping} from '../lib/shipping-logic';
import type {Artwork} from '../types';
import {h} from '../ui';

export const INVALID: unique symbol = Symbol('invalid');
export interface Field<T> {
  el: HTMLElement;
  /** The value, or INVALID (and an inline message) when it is not usable. */
  read(): T | typeof INVALID;
  focus(): void;
}

let counter = 0;
const uid = (p: string) => `${p}-${++counter}`;

function wrap(label: string, control: HTMLElement, id: string, hint?: string | Node | null) {
  const err = h('p', {class: 'field-err', role: 'alert', hidden: true});
  const el = h(
    'div',
    {class: 'field'},
    h('label', {for: id}, label),
    control,
    hint ? h('p', {class: 'hint'}, hint) : null,
    err,
  );
  const fail = (msg: string): typeof INVALID => {
    err.textContent = msg;
    err.hidden = false;
    control.setAttribute('aria-invalid', 'true');
    return INVALID;
  };
  const ok = () => {
    err.hidden = true;
    control.removeAttribute('aria-invalid');
  };
  return {el, fail, ok};
}

export function textField(
  label: string,
  value: string,
  o: {required?: boolean; multiline?: boolean; rows?: number; placeholder?: string; hint?: string} = {},
): Field<string> {
  const id = uid('f');
  const control = o.multiline
    ? h('textarea', {id, rows: o.rows ?? 5, placeholder: o.placeholder})
    : h('input', {id, type: 'text', placeholder: o.placeholder, autocomplete: 'off'});
  control.value = value;
  const w = wrap(label, control, id, o.hint);
  return {
    el: w.el,
    read() {
      const v = control.value.trim();
      if (o.required && !v) return w.fail('Please give it a title.');
      w.ok();
      return v;
    },
    focus: () => control.focus(),
  };
}

export function yearField(value: number | null): Field<number | null> {
  const id = uid('f');
  const control = h('input', {id, type: 'text', inputmode: 'numeric', maxlength: 4, placeholder: 'e.g. 2024'});
  control.value = value == null ? '' : String(value);
  const w = wrap('Year', control, id);
  return {
    el: w.el,
    read() {
      const v = parseYear(control.value);
      if (v === undefined) return w.fail('Use a four-digit year, like 2024.');
      w.ok();
      return v;
    },
    focus: () => control.focus(),
  };
}

export function priceField(cents: number | null): Field<number | null> {
  const id = uid('f');
  const control = h('input', {id, type: 'text', inputmode: 'decimal', placeholder: 'e.g. 1200', autocomplete: 'off'});
  control.value = centsToDollars(cents);
  const w = wrap('Price (US dollars)', control, id);
  return {
    el: w.el,
    read() {
      const v = parseDollars(control.value);
      if (v === undefined) return w.fail('Use numbers only, like 1200 or 1200.50.');
      w.ok();
      return v;
    },
    focus: () => control.focus(),
  };
}

export function numberField(label: string, value: number | null, hint?: string): Field<number | null> {
  const id = uid('f');
  const control = h('input', {id, type: 'text', inputmode: 'numeric', autocomplete: 'off'});
  control.value = value == null ? '' : String(value);
  const w = wrap(label, control, id, hint);
  return {
    el: w.el,
    read() {
      const v = parseNumber(control.value);
      if (v === undefined || (v !== null && !Number.isInteger(v))) return w.fail('Use a whole number.');
      w.ok();
      return v;
    },
    focus: () => control.focus(),
  };
}

export interface Size {
  width: number | null;
  height: number | null;
  depth: number | null;
  sizeUnit: 'in' | 'cm';
}

export function sizeField(v: Size): Field<Size> {
  const part = (label: string, val: number | null) => {
    const id = uid('s');
    const input = h('input', {id, type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': label});
    input.value = val == null ? '' : String(val);
    return {input, el: h('div', {class: 'size-part'}, h('label', {for: id}, label), input)};
  };
  const w = part('Width', v.width),
    ht = part('Height', v.height),
    d = part('Depth', v.depth);
  const unitId = uid('u');
  const unit = h(
    'select',
    {id: unitId, 'aria-label': 'Inches or centimetres'},
    h('option', {value: 'in'}, 'inches'),
    h('option', {value: 'cm'}, 'centimetres'),
  );
  unit.value = v.sizeUnit;
  const box = wrap(
    'Size',
    h(
      'div',
      {class: 'size-grid'},
      w.el,
      ht.el,
      d.el,
      h('div', {class: 'size-part'}, h('label', {for: unitId}, 'Unit'), unit),
    ),
    uid('x'),
  );
  // The wrapper's label points at a hidden id; make it a plain caption instead.
  box.el.querySelector('label')?.removeAttribute('for');
  return {
    el: box.el,
    read() {
      const vals = [w.input, ht.input, d.input].map(i => parseNumber(i.value));
      if (vals.some(x => x === undefined)) return box.fail('Use numbers only, like 24 or 24.5.');
      box.ok();
      return {
        width: vals[0] as number | null,
        height: vals[1] as number | null,
        depth: vals[2] as number | null,
        sizeUnit: unit.value as 'in' | 'cm',
      };
    },
    focus: () => w.input.focus(),
  };
}

const CHOOSABLE: Artwork['status'][] = ['available', 'reserved', 'sold', 'not_for_sale'];

export function statusField(value: Artwork['status']): Field<Artwork['status']> {
  const id = uid('f');
  const options = [...CHOOSABLE, ...(CHOOSABLE.includes(value) ? [] : [value])];
  const control = h(
    'select',
    {id},
    options.map(s => h('option', {value: s}, STATUS_LABELS[s])),
  );
  control.value = value;
  const w = wrap('Status', control, id);
  return {el: w.el, read: () => control.value as Artwork['status'], focus: () => control.focus()};
}

/** Collection: a text box with the studio's existing collections as tap-to-fill chips. */
export function collectionField(value: string | null, suggestions: string[]): Field<string | null> {
  const id = uid('f');
  const control = h('input', {id, type: 'text', autocomplete: 'off', placeholder: 'e.g. Abstract'});
  control.value = value ?? '';
  const chips = suggestions.length
    ? h(
        'div',
        {class: 'chips tight'},
        suggestions.map(name =>
          h(
            'button',
            {
              type: 'button',
              class: 'pill',
              onclick: () => {
                control.value = name;
              },
            },
            name,
          ),
        ),
      )
    : null;
  const w = wrap('Collection', control, id);
  if (chips) w.el.append(chips);
  return {
    el: w.el,
    read: () => control.value.trim() || null,
    focus: () => control.focus(),
  };
}

/** Tags as chips you can add to and remove from. */
export function tagField(initial: string[]): Field<string[]> {
  let tags = [...initial];
  const id = uid('f');
  const list = h('div', {class: 'chips tight'});
  const input = h('input', {id, type: 'text', autocomplete: 'off', placeholder: 'Add a tag', enterkeyhint: 'done'});
  const draw = () => {
    list.replaceChildren(
      ...tags.map(t =>
        h(
          'span',
          {class: 'tag'},
          t,
          h(
            'button',
            {
              type: 'button',
              class: 'tag-x',
              'aria-label': `Remove ${t}`,
              onclick: () => {
                tags = removeTag(tags, t);
                draw();
              },
            },
            '×',
          ),
        ),
      ),
    );
  };
  const commit = () => {
    if (!input.value.trim()) return;
    tags = addTags(tags, input.value);
    input.value = '';
    draw();
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    }
  });
  input.addEventListener('blur', commit);
  draw();
  const w = wrap(
    'Tags',
    h(
      'div',
      {class: 'tag-box'},
      list,
      h('div', {class: 'tag-add'}, input, h('button', {type: 'button', onclick: commit}, 'Add')),
    ),
    id,
  );
  return {
    el: w.el,
    read() {
      commit();
      return [...tags];
    },
    focus: () => input.focus(),
  };
}

/** Puts the small "drafted by the assistant" note under a field's label. */
export function markDrafted<T>(f: Field<T>): Field<T> {
  f.el.querySelector('label')?.after(h('span', {class: 'drafted'}, 'drafted by the assistant'));
  return f;
}

/** Shipping (D-146): the tier Isaac picks (never guessed), a pinned price, the weight, crated or quoted. */
export function shippingField(value: ArtworkShipping | null): Field<ArtworkShipping | null> {
  const f = pieceFields(value);
  const tierId = uid('f');
  const tier = h(
    'select',
    {id: tierId},
    h('option', {value: ''}, 'Not set: can’t be bought online'),
    ([1, 2, 3, 4] as const).map(t => h('option', {value: String(t)}, `${t} · ${TIER_LABELS[t]}`)),
  );
  tier.value = f.tier;
  const centsId = uid('f');
  const cents = h('input', {id: centsId, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'None'});
  cents.value = f.cents;
  const weightId = uid('f');
  const weight = h('input', {
    id: weightId,
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    placeholder: 'Not known',
  });
  weight.value = f.weightLb;
  const check = (label: string, on: boolean) => {
    const i = h('input', {type: 'checkbox', id: uid('f')});
    i.checked = on;
    return {i, row: h('label', {class: 'check', for: i.id}, i, ' ', label)};
  };
  const crated = check('Ships crated', f.crated);
  const quote = check('Always quote this one', f.customQuote);
  const t = wrap(
    'Shipping tier',
    tier,
    tierId,
    'Tiers 1 and 2 have a set price. Large pieces get an estimate from the buyer’s ZIP; tier 4 needs a quote.',
  );
  const c = wrap(
    'Shipping price (dollars)',
    cents,
    centsId,
    'Set it to sell a quoted piece online at this price, or to fix a large piece’s price instead of the estimate.',
  );
  const w = wrap(
    'Weight of the piece (pounds)',
    weight,
    weightId,
    'Packing is added. Helps the estimate for heavy pieces.',
  );
  const el = h('div', {class: 'field-group'}, t.el, c.el, w.el, crated.row, quote.row);
  return {
    el,
    read() {
      c.ok();
      w.ok();
      const r = mergePiece(value, {
        tier: tier.value,
        cents: cents.value,
        weightLb: weight.value,
        crated: crated.i.checked,
        customQuote: quote.i.checked,
      });
      if ('error' in r) return (r.field === 'cents' ? c : w).fail(r.error);
      return r.value;
    },
    focus: () => tier.focus(),
  };
}
