// HTML strings with escaping by default. `html\`<p>${text}</p>\`` escapes `text`; wrap trusted markup in raw().
const ESC: Record<string, string> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
export const escape = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]!);

export class Raw {
  constructor(readonly value: string) {}
  toString() {
    return this.value;
  }
}
export const raw = (s: string) => new Raw(s);

type Part = string | number | null | undefined | false | Raw | Part[];
const flat = (v: Part): string =>
  v === null || v === undefined || v === false
    ? ''
    : Array.isArray(v)
      ? v.map(flat).join('')
      : v instanceof Raw
        ? v.value
        : escape(v);

export function html(strings: TemplateStringsArray, ...values: Part[]): Raw {
  let out = strings[0]!;
  values.forEach((v, i) => (out += flat(v) + strings[i + 1]!));
  return raw(out);
}
