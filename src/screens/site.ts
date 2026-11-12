// The owner's Site screen: contact details, the words on each page, and which photos go where.
// Everything is saved into settings.meta.site through PATCH /v1/settings (the whole meta is sent back, only `site` changed).
import './site.css';
import {get, patch} from '../api';
import {picture} from '../components/picture';
import {mount} from '../components/mount';
import {runSiteImportInto} from '../import/site-ui';
import {TOPICS, fromFields, toFields, usageLine, type Assistant, type Usage} from '../lib/assistant-form';
import * as checkoutForm from '../lib/checkout-form';
import {isConflict, listAll, plainError, publishWork} from '../lib/artworks';
import {
  PAGES,
  PLACES,
  compact,
  issuesByField,
  tidyPhone,
  toggleSelection,
  zoneOptions,
  type PageKey,
  type PlaceInfo,
} from '../lib/site-logic';
import type {Params} from '../router';
import type {Artwork} from '../types';
import {confirmDialog, h, toast, type Child} from '../ui';

interface Section {
  key?: string;
  heading?: string;
  body?: string;
  place?: string;
}
interface Page {
  title?: string;
  lede?: string;
  sections?: Section[];
}
interface Site {
  name?: string;
  tagline?: string;
  description?: string;
  phone?: string;
  email?: string;
  hours?: {from: string; to: string};
  pages?: Partial<Record<PageKey, Page>>;
  photos?: Record<string, string[]>;
  assistant?: Assistant;
  checkout?: checkoutForm.Checkout;
}
interface Settings {
  version: number;
  timezone?: string;
  meta: Record<string, unknown> & {site?: Site; siteImport?: {siteStep?: string}};
}
interface State {
  settings: Settings;
  slug: string | null;
  artworks: Artwork[];
}

let uidN = 0;
const uid = (p: string) => `${p}-${++uidN}`;

async function load(): Promise<State> {
  const [settings, me, artworks] = await Promise.all([
    get<Settings>('/settings'),
    get<{activeStudioId: string | null; memberships: {studioId: string; studioSlug?: string}[]}>('/me'),
    listAll(),
  ]);
  const slug = me.memberships.find(m => m.studioId === me.activeStudioId)?.studioSlug ?? null;
  return {settings: {...settings, meta: settings.meta ?? {}}, slug, artworks};
}

function autosize(ta: HTMLTextAreaElement): void {
  ta.style.height = 'auto';
  if (ta.scrollHeight) ta.style.height = ta.scrollHeight + 2 + 'px';
}
function textarea(value: string, rows = 2): HTMLTextAreaElement {
  const ta = h('textarea', {rows, id: uid('t')});
  ta.value = value;
  ta.addEventListener('input', () => autosize(ta));
  requestAnimationFrame(() => autosize(ta));
  return ta;
}

/** One form's fields, their messages next to them, and the Save button's status line. */
function makeForm() {
  const errs = new Map<string, HTMLElement>();
  const general = h('p', {class: 'err', role: 'alert', hidden: true});
  const status = h('p', {class: 'muted save-status', 'aria-live': 'polite'});
  const controls = new Map<string, HTMLElement>();
  const bind = (key: string, err: HTMLElement, control: HTMLElement) => {
    errs.set(key, err);
    controls.set(key, control);
  };
  const field = (label: string, control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, key: string) => {
    if (!control.id) control.id = uid('f');
    const err = h('p', {class: 'field-err', hidden: true});
    bind(key, err, control);
    return h('div', {class: 'field'}, h('label', {for: control.id}, label), control, err);
  };
  const clear = () => {
    general.hidden = true;
    for (const [k, err] of errs) {
      err.hidden = true;
      controls.get(k)?.removeAttribute('aria-invalid');
    }
  };
  const show = (issues: Record<string, string>, fallback: string) => {
    let general_ = Object.keys(issues).length === 0;
    for (const [key, msg] of Object.entries(issues)) {
      const err = errs.get(key);
      if (err) {
        err.textContent = msg;
        err.hidden = false;
        controls.get(key)?.setAttribute('aria-invalid', 'true');
      } else general_ = true;
    }
    if (general_) {
      general.textContent = fallback;
      general.hidden = false;
    }
    const first = [...errs].find(([, e]) => !e.hidden);
    (first ? controls.get(first[0]) : null)?.focus();
  };
  return {errs, general, status, field, bind, clear, show};
}
type Form = ReturnType<typeof makeForm>;

export async function render(el: HTMLElement, _params: Params): Promise<void> {
  mount(el, h('h1', null, 'Site'), h('p', {class: 'muted'}, 'Loading your site…'));
  let S: State;
  try {
    S = await load();
  } catch (e) {
    mount(
      el,
      h('h1', null, 'Site'),
      h('p', {class: 'err', role: 'alert'}, plainError(e, "Couldn't load your site settings. Check your connection.")),
      h('button', {onclick: () => render(el, _params)}, 'Try again'),
    );
    return;
  }

  const draw = () => mount(el, ...screen(S, reload));
  const reload = async (message?: string) => {
    try {
      S = await load();
    } catch {
      /* keep what is shown */
    }
    draw();
    if (message) toast(message);
  };

  /** Saves a changed `site` (and maybe the time zone). True when saved. */
  async function persist(form: Form, site: Site, timezone?: string): Promise<boolean> {
    form.clear();
    form.status.textContent = 'Saving…';
    try {
      const next = await patch<Settings>(
        '/settings',
        {meta: {...S.settings.meta, site}, ...(timezone ? {timezone} : {})},
        S.settings.version,
      );
      S.settings = next?.version ? {...next, meta: next.meta ?? {}} : await get<Settings>('/settings');
      form.status.textContent = 'Saved.';
      toast('Saved');
      return true;
    } catch (e) {
      form.status.textContent = '';
      if (isConflict(e)) {
        await reload('Changed elsewhere — reloaded');
        return false;
      }
      const issues = (e as {status?: number}).status === 400 ? issuesByField(e) : {};
      form.show(issues, plainError(e, "Couldn't save. Check your connection and try again."));
      return false;
    }
  }

  const currentSite = (): Site => structuredClone(S.settings.meta.site ?? {});
  const screen = (st: State, redo: (m?: string) => Promise<void>): Child[] => {
    const site = st.settings.meta.site ?? {};
    const needsImport =
      !st.settings.meta.siteImport?.siteStep &&
      !st.settings.meta.site &&
      st.artworks.some(a => (a.meta as {importedFrom?: unknown})?.importedFrom);
    return [
      h('h1', null, 'Site'),
      needsImport ? importCard(redo) : null,
      addressCard(st),
      contactCard(st.settings, site, persist, currentSite),
      assistantCard(site.assistant, persist, currentSite),
      checkoutCard(site.checkout, persist, currentSite),
      h('h2', null, 'Pages'),
      h('p', {class: 'muted'}, 'The words on each page of your site. Each page saves on its own.'),
      ...PAGES.map(p => pageCard(p.key, p.label, site.pages?.[p.key], persist, currentSite)),
      h('h2', null, 'Photos'),
      h('p', {class: 'muted'}, 'Which pictures go where. A photo only shows on your site while it is public.'),
      photosCard(
        st,
        persist,
        currentSite,
        () => st.artworks,
        a => (st.artworks = a),
      ),
    ];
  };
  draw();
}

// ---- Your site
function addressCard(st: State): HTMLElement {
  return h(
    'section',
    {class: 'card site-card', 'aria-labelledby': 'site-your'},
    h('h2', {id: 'site-your'}, 'Your site'),
    h('p', {class: 'muted'}, 'Public address: ', h('strong', null, location.host)),
    st.slug ? slugLine(st.slug) : null,
    h('div', {class: 'row'}, h('a', {class: 'btn primary', href: '/'}, 'Open your site')),
  );
}

/** "Site name: <slug>" with Copy: Isaac pastes it once when the live site is set up. */
function slugLine(slug: string): HTMLElement {
  const code = h('code', {class: 'slug', id: 'site-slug'}, slug);
  const selectIt = () => {
    const r = document.createRange();
    r.selectNodeContents(code);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  };
  const copy = h(
    'button',
    {
      type: 'button',
      class: 'small',
      'aria-describedby': 'site-slug',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(slug);
          toast('Copied');
        } catch {
          selectIt();
          toast('Selected — tap Copy in the menu');
        }
      },
    },
    'Copy',
  );
  return h(
    'div',
    {class: 'slug-line'},
    h('p', null, h('span', {class: 'muted'}, 'Site name: '), code),
    copy,
    h(
      'a',
      {class: 'small-link', href: `/v1/public/studios/${encodeURIComponent(slug)}`, target: '_blank', rel: 'noopener'},
      'What the public sees',
    ),
  );
}

function importCard(redo: (m?: string) => Promise<void>): HTMLElement {
  const box = h('div', {class: 'site-step'});
  const btn = h(
    'button',
    {
      class: 'primary',
      type: 'button',
      onclick: async () => {
        btn.setAttribute('disabled', '');
        await runSiteImportInto(box);
        btn.removeAttribute('disabled');
        await redo();
      },
    },
    'Bring in the words and photos',
  );
  return h(
    'section',
    {class: 'card site-card'},
    h('h2', null, 'Start from your old site'),
    h('p', null, 'Fill in the words and photos from your current website. Nothing you wrote here is overwritten.'),
    h('div', {class: 'row'}, btn),
    box,
  );
}

// ---- Contact
type Persist = (form: Form, site: Site, timezone?: string) => Promise<boolean>;

function contactCard(settings: Settings, site: Site, persist: Persist, current: () => Site): HTMLElement {
  const form = makeForm();
  const text = (v: string | undefined, o: Record<string, string> = {}) => {
    const i = h('input', {type: 'text', autocomplete: 'off', ...o});
    i.value = v ?? '';
    return i;
  };
  const name = text(site.name),
    tagline = text(site.tagline),
    phone = text(site.phone, {type: 'tel', inputmode: 'tel', autocomplete: 'tel'}),
    email = text(site.email, {type: 'email', inputmode: 'email', autocomplete: 'email'});
  const description = textarea(site.description ?? '', 3);
  const from = text(site.hours?.from, {type: 'time'}),
    to = text(site.hours?.to, {type: 'time'});
  const zone = h(
    'select',
    {id: uid('f')},
    zoneOptions(settings.timezone).map(z => h('option', {value: z.value}, z.label)),
  );
  zone.value = settings.timezone ?? 'America/Los_Angeles';

  const hoursErr = h('p', {class: 'field-err', hidden: true});
  form.bind('hours', hoursErr, from);
  form.bind('hours.from', hoursErr, from);
  form.bind('hours.to', hoursErr, to);
  const button = h('button', {class: 'primary', type: 'submit'}, 'Save contact details');

  const el = h(
    'form',
    {class: 'card site-card', novalidate: true, 'aria-labelledby': 'site-contact'},
    h('h2', {id: 'site-contact'}, 'Contact'),
    form.field('Name', name, 'name'),
    form.field('Tagline', tagline, 'tagline'),
    form.field('Description', description, 'description'),
    form.field('Phone', phone, 'phone'),
    form.field('Email', email, 'email'),
    h(
      'div',
      {class: 'field'},
      h('p', {class: 'label-like', id: 'hours-l'}, 'Call hours'),
      h(
        'div',
        {class: 'two', role: 'group', 'aria-labelledby': 'hours-l'},
        h('div', null, h('label', {for: (from.id ||= uid('f'))}, 'From'), from),
        h('div', null, h('label', {for: (to.id ||= uid('f'))}, 'To'), to),
      ),
      hoursErr,
    ),
    form.field('Time zone', zone, 'timezone'),
    form.general,
    h('div', {class: 'row'}, button, form.status),
  );
  el.addEventListener('submit', async ev => {
    ev.preventDefault();
    form.clear();
    if (!!from.value !== !!to.value) {
      form.show({hours: 'Fill in both times, or leave both empty.'}, '');
      return;
    }
    const next = current();
    const fields = {
      name: name.value.trim(),
      tagline: tagline.value.trim(),
      description: description.value.trim(),
      phone: tidyPhone(phone.value),
      email: email.value.trim(),
    };
    for (const k of ['name', 'tagline', 'description', 'phone', 'email'] as const) delete next[k];
    Object.assign(next, compact(fields));
    if (from.value && to.value) next.hours = {from: from.value, to: to.value};
    else delete next.hours;
    button.setAttribute('disabled', '');
    const tz = zone.value !== settings.timezone ? zone.value : undefined;
    const ok = await persist(form, next, tz);
    button.removeAttribute('disabled');
    if (ok) phone.value = next.phone ?? '';
  });
  return el;
}

// ---- Assistant (the visitor chat: D-125, D-126, D-130, D-136)
function assistantCard(saved: Assistant | undefined, persist: Persist, current: () => Site): HTMLElement {
  const form = makeForm();
  const f = toFields(saved);
  const text = (v: string, o: Record<string, string> = {}) => {
    const i = h('input', {type: 'text', autocomplete: 'off', ...o});
    i.value = v;
    return i;
  };
  const artist = text(f.artistName),
    reply = text(f.replyTime),
    budget = text(f.budgetDollars, {inputmode: 'decimal'});
  const greeting = textarea(f.greeting, 3);
  const sugs = f.suggestions.map(s => text(s));
  const answers = TOPICS.map(t => ({key: t.key, label: t.label, el: textarea(f.answers[t.key] ?? '', 2)}));
  const on = h('input', {type: 'checkbox', id: uid('f'), class: 'switch'});
  on.checked = f.enabled;

  const usage = h('p', {class: 'muted', 'aria-live': 'polite'});
  get<Usage>('/site/assistant-usage').then(
    u => (usage.textContent = usageLine(u)),
    () => (usage.hidden = true),
  );

  const sugErr = h('p', {class: 'field-err', hidden: true});
  sugs.forEach((el, i) => {
    form.bind(`assistant.suggestions.${i}`, sugErr, el);
  });
  form.bind('assistant.suggestions', sugErr, sugs[0]!);
  const answersErr = h('p', {class: 'field-err', hidden: true});
  form.bind('assistant.answers', answersErr, answers[0]!.el);
  const button = h('button', {class: 'primary', type: 'submit'}, 'Save the assistant');

  const el = h(
    'form',
    {class: 'card site-card', novalidate: true, 'aria-labelledby': 'site-assistant'},
    h('h2', {id: 'site-assistant'}, 'Assistant'),
    h('p', {class: 'muted'}, 'The chat on your site. It answers from your works and from the words below.'),
    usage,
    h('div', {class: 'switch-row'}, on, h('label', {for: on.id}, 'Chat is on')),
    form.field('Your name (what the assistant calls you)', artist, 'assistant.artistName'),
    form.field('Greeting', greeting, 'assistant.greeting'),
    h(
      'div',
      {class: 'field'},
      h('p', {class: 'label-like'}, 'Three suggested questions'),
      ...sugs.map((i, n) => {
        i.setAttribute('aria-label', `Suggested question ${n + 1}`);
        return i;
      }),
      sugErr,
    ),
    form.field('Reply-time line', reply, 'assistant.replyTime'),
    form.field('Monthly budget (dollars)', budget, 'assistant.budgetCents'),
    h('h3', null, 'Answers'),
    h('p', {class: 'muted'}, 'Leave a topic empty and the assistant hands that question to you.'),
    ...answers.map(a => form.field(a.label, a.el, `assistant.answers.${a.key}`)),
    answersErr,
    form.general,
    h('div', {class: 'row'}, button, form.status),
  );
  el.addEventListener('submit', async ev => {
    ev.preventDefault();
    form.clear();
    const r = fromFields({
      enabled: on.checked,
      artistName: artist.value,
      greeting: greeting.value,
      suggestions: sugs.map(i => i.value),
      replyTime: reply.value,
      budgetDollars: budget.value,
      answers: Object.fromEntries(answers.map(a => [a.key, a.el.value])),
    });
    if ('error' in r) {
      form.show({'assistant.budgetCents': r.error}, r.error);
      return;
    }
    const next = current();
    next.assistant = r.value;
    button.setAttribute('disabled', '');
    await persist(form, next);
    button.removeAttribute('disabled');
  });
  return el;
}

// ---- Checkout (buying on the site: D-144)
function checkoutCard(saved: checkoutForm.Checkout | undefined, persist: Persist, current: () => Site): HTMLElement {
  const form = makeForm();
  const f = checkoutForm.toFields(saved);
  const text = (v: string, o: Record<string, string> = {}) => {
    const i = h('input', {type: 'text', autocomplete: 'off', ...o});
    i.value = v;
    return i;
  };
  const toggle = (checked: boolean, label: string) => {
    const i = h('input', {type: 'checkbox', id: uid('f'), class: 'switch'});
    i.checked = checked;
    return {i, row: h('div', {class: 'switch-row'}, i, h('label', {for: i.id}, label))};
  };
  const on = toggle(f.enabled, 'Buying on the site is on');
  const card = toggle(f.card, 'Cards through Square');
  const venmo = text(f.venmo, {placeholder: '@Your-Name'}),
    zelle = text(f.zelle, {placeholder: 'Email or phone'}),
    shipping = text(f.shipping, {inputmode: 'decimal'}),
    small = text(f.smallMax, {inputmode: 'decimal'}),
    tax = text(f.taxPercent, {inputmode: 'decimal', placeholder: 'None'}),
    hold = text(f.holdHours, {inputmode: 'numeric'});
  const returns = textarea(f.returns, 3);
  const button = h('button', {class: 'primary', type: 'submit'}, 'Save checkout');
  const el = h(
    'form',
    {class: 'card site-card', novalidate: true, 'aria-labelledby': 'site-checkout'},
    h('h2', {id: 'site-checkout'}, 'Checkout'),
    h(
      'p',
      {class: 'muted'},
      'A Buy button on priced, available pieces up to the size below. Larger pieces keep the inquiry and a shipping quote. Venmo and Zelle orders sell only when you tap Mark paid on Orders.',
    ),
    on.row,
    card.row,
    form.field('Venmo name (empty: no Venmo)', venmo, 'checkout.venmo'),
    form.field('Zelle email or phone (empty: no Zelle)', zelle, 'checkout.zelle'),
    form.field('Shipping for a small piece (dollars, US only)', shipping, 'checkout.shippingCents'),
    form.field('Small means up to (inches, longest side)', small, 'checkout.smallMaxInches'),
    form.field('Sales tax (percent)', tax, 'checkout.taxBps'),
    form.field('Venmo and Zelle orders hold the piece (hours)', hold, 'checkout.manualHoldHours'),
    form.field('Returns (shown before paying)', returns, 'checkout.returns'),
    form.general,
    h('div', {class: 'row'}, button, form.status),
  );
  const keys: Record<keyof checkoutForm.CheckoutFields, string> = {
    enabled: 'checkout.enabled',
    card: 'checkout.card',
    venmo: 'checkout.venmo',
    zelle: 'checkout.zelle',
    shipping: 'checkout.shippingCents',
    smallMax: 'checkout.smallMaxInches',
    returns: 'checkout.returns',
    taxPercent: 'checkout.taxBps',
    holdHours: 'checkout.manualHoldHours',
  };
  el.addEventListener('submit', async ev => {
    ev.preventDefault();
    form.clear();
    const r = checkoutForm.fromFields({
      enabled: on.i.checked,
      card: card.i.checked,
      venmo: venmo.value,
      zelle: zelle.value,
      shipping: shipping.value,
      smallMax: small.value,
      returns: returns.value,
      taxPercent: tax.value,
      holdHours: hold.value,
    });
    if ('error' in r) {
      form.show({[keys[r.field]]: r.error}, r.error);
      return;
    }
    const next = current();
    next.checkout = r.value;
    button.setAttribute('disabled', '');
    await persist(form, next);
    button.removeAttribute('disabled');
  });
  return el;
}

// ---- Pages
interface Draft extends Section {
  headingEl: HTMLTextAreaElement;
  bodyEl: HTMLTextAreaElement;
  headingErr: HTMLElement;
  bodyErr: HTMLElement;
}

function pageCard(
  key: PageKey,
  label: string,
  page: Page | undefined,
  persist: Persist,
  current: () => Site,
): HTMLElement {
  const form = makeForm();
  const title = h('input', {type: 'text', autocomplete: 'off'});
  title.value = page?.title ?? '';
  const lede = textarea(page?.lede ?? '', 3);
  let drafts: Draft[] = [];
  const list = h('div', {class: 'sections'});

  const makeDraft = (s: Section): Draft => {
    const headingEl = textarea(s.heading ?? '', 1);
    const bodyEl = textarea(s.body ?? '', 3);
    return {
      ...s,
      headingEl,
      bodyEl,
      headingErr: h('p', {class: 'field-err', hidden: true}),
      bodyErr: h('p', {class: 'field-err', hidden: true}),
    };
  };
  const drawList = () => {
    list.replaceChildren(
      ...drafts.map((d, i) => {
        const hid = uid('h');
        const bid = uid('b');
        d.headingEl.id = hid;
        d.bodyEl.id = bid;
        return h(
          'div',
          {class: 'section-edit'},
          h('p', {class: 'section-no'}, `Section ${i + 1}`, d.place ? h('span', {class: 'chip'}, 'has a photo') : null),
          h('label', {for: hid}, 'Heading'),
          d.headingEl,
          d.headingErr,
          h('label', {for: bid}, 'Text'),
          d.bodyEl,
          d.bodyErr,
          h(
            'button',
            {
              type: 'button',
              class: 'small danger',
              onclick: async () => {
                if (
                  !(await confirmDialog(
                    `Remove section ${i + 1}? It is gone once you save this page.`,
                    'Remove',
                    'Keep it',
                  ))
                )
                  return;
                drafts = drafts.filter(x => x !== d);
                drawList();
              },
            },
            `Remove section ${i + 1}`,
          ),
        );
      }),
    );
  };
  drafts = (page?.sections ?? []).map(makeDraft);
  drawList();

  const newHeading = textarea('', 1);
  const newBody = textarea('', 3);
  const nh = uid('h'),
    nb = uid('b');
  newHeading.id = nh;
  newBody.id = nb;
  const addBox = h(
    'details',
    {class: 'add-section'},
    h('summary', null, 'Add a section'),
    h('label', {for: nh}, 'Heading'),
    newHeading,
    h('label', {for: nb}, 'Text'),
    newBody,
    h(
      'button',
      {
        type: 'button',
        onclick: () => {
          if (!newHeading.value.trim() && !newBody.value.trim()) return;
          drafts.push(makeDraft({heading: newHeading.value.trim(), body: newBody.value.trim()}));
          newHeading.value = newBody.value = '';
          drawList();
        },
      },
      'Add to the page',
    ),
  );
  addBox.addEventListener('toggle', () => [newHeading, newBody].forEach(autosize));

  const button = h('button', {class: 'primary', type: 'submit'}, `Save ${label}`);
  const el = h(
    'details',
    {class: 'card site-card page-card', id: `page-${key}`},
    h(
      'summary',
      null,
      h('span', null, label),
      h(
        'small',
        {class: 'muted count'},
        `${page?.sections?.length ?? 0} section${page?.sections?.length === 1 ? '' : 's'}`,
      ),
    ),
    h(
      'form',
      {novalidate: true},
      form.field('Page title', title, `pages.${key}.title`),
      form.field('Opening line', lede, `pages.${key}.lede`),
      list,
      addBox,
      form.general,
      h('div', {class: 'row'}, button, form.status),
    ),
  );
  el.addEventListener('toggle', () => {
    if (el.open) el.querySelectorAll('textarea').forEach(autosize);
  });
  el.querySelector('form')!.addEventListener('submit', async ev => {
    ev.preventDefault();
    form.clear();
    const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim();
    const kept = drafts.filter(d => oneLine(d.headingEl.value) || d.bodyEl.value.trim() || d.key || d.place);
    kept.forEach((d, j) => {
      form.bind(`pages.${key}.sections.${j}.heading`, d.headingErr, d.headingEl);
      form.bind(`pages.${key}.sections.${j}.body`, d.bodyErr, d.bodyEl);
    });
    const sections: Section[] = kept.map(d =>
      compact({key: d.key, place: d.place, heading: oneLine(d.headingEl.value), body: d.bodyEl.value.trim()}),
    );
    const next = current();
    const out: Page = {
      ...compact({title: title.value.trim(), lede: lede.value.trim()}),
      ...(sections.length ? {sections} : {}),
    };
    const pages = {...next.pages};
    if (Object.keys(out).length) pages[key] = out;
    else delete pages[key];
    if (Object.keys(pages).length) next.pages = pages;
    else delete next.pages;
    button.setAttribute('disabled', '');
    const ok = await persist(form, next);
    button.removeAttribute('disabled');
    if (ok) {
      drafts = drafts.filter(d => kept.includes(d));
      drawList();
    }
  });
  return el;
}

// ---- Photos
const titleOf = (a: Artwork) => a.title || 'Untitled';

function photosCard(
  st: State,
  persist: Persist,
  current: () => Site,
  getArtworks: () => Artwork[],
  setArtworks: (a: Artwork[]) => void,
): HTMLElement {
  const form = makeForm();
  const byId = () => new Map(getArtworks().map(a => [a.id, a] as const));
  const rows = h('div', {class: 'places'});

  const drawRows = () => {
    const photos = st.settings.meta.site?.photos ?? {};
    const art = byId();
    rows.replaceChildren(
      ...PLACES.map(p => {
        const ids = photos[p.place] ?? [];
        const hidden = ids.filter(id => art.get(id) && !art.get(id)!.public).length;
        return h(
          'div',
          {class: 'place', role: 'group', 'aria-label': p.label},
          h(
            'div',
            {class: 'place-head'},
            h('strong', null, p.label),
            p.multi ? h('span', {class: 'chip'}, 'several') : null,
          ),
          h(
            'div',
            {class: 'thumbs'},
            ids.length
              ? ids.map(id => {
                  const a = art.get(id);
                  return h(
                    'div',
                    {class: 'site-thumb'},
                    a?.primaryFileId
                      ? picture({id: a.primaryFileId, meta: {}}, 480, {ratio: '1 / 1', cover: true, alt: titleOf(a)})
                      : picture(null, 480, {ratio: '1 / 1'}),
                  );
                })
              : [h('span', {class: 'muted'}, 'No photo chosen')],
          ),
          hidden ? h('p', {class: 'muted'}, `${hidden} not public, so not shown.`) : null,
          h(
            'button',
            {type: 'button', class: 'small', onclick: () => choose(p), 'aria-label': `Change ${p.label}`},
            'Change',
          ),
        );
      }),
    );
  };

  async function choose(p: PlaceInfo) {
    const photos = st.settings.meta.site?.photos ?? {};
    const picked = await pickPhotos(p, photos[p.place] ?? [], getArtworks());
    if (!picked) return;
    // a photo shows only while it is public: publish what is not, after asking
    const art = byId();
    const toPublish = picked.map(id => art.get(id)).filter((a): a is Artwork => !!a && !a.public);
    if (toPublish.length) {
      const sure = await confirmDialog(
        toPublish.length === 1
          ? 'This photo will be shown on your site.'
          : `These ${toPublish.length} photos will be shown on your site.`,
        'Show on my site',
        'Cancel',
      );
      if (!sure) return;
    }
    const keep: string[] = [];
    const failed: string[] = [];
    const updated = [...getArtworks()];
    for (const id of picked) {
      const a = art.get(id);
      if (a && !a.public) {
        try {
          const done = await publishWork(a.id, a.version);
          const i = updated.findIndex(x => x.id === a.id);
          if (i >= 0) updated[i] = {...a, ...done, public: true};
        } catch (e) {
          failed.push(`${titleOf(a)}: ${plainError(e, 'it could not be made public')}`);
          continue;
        }
      }
      keep.push(id);
    }
    setArtworks(updated);
    const next = current();
    const all = {...next.photos};
    if (keep.length) all[p.place] = keep;
    else delete all[p.place];
    if (Object.keys(all).length) next.photos = all;
    else delete next.photos;
    const ok = await persist(form, next);
    if (failed.length) {
      form.general.textContent = `Not added: ${failed.join('; ')}`;
      form.general.hidden = false;
    }
    if (ok) drawRows();
  }

  drawRows();
  return h('section', {class: 'card site-card', 'aria-label': 'Photos'}, rows, form.general, form.status);
}

/** The picker sheet: site photos first, then works. Resolves the chosen ids in order, or null when cancelled. */
function pickPhotos(p: PlaceInfo, start: string[], artworks: Artwork[]): Promise<string[] | null> {
  return new Promise(resolve => {
    let sel = start.filter(id => artworks.some(a => a.id === id));
    const sitePhotos = artworks.filter(a => a.kind === 'site_photo' && a.status !== 'archived');
    const works = artworks.filter(a => a.kind !== 'site_photo' && a.status !== 'archived');
    const buttons = new Map<string, {btn: HTMLElement; badge: HTMLElement}>();

    const tile = (a: Artwork) => {
      const badge = h('span', {class: 'pick-badge', 'aria-hidden': 'true'});
      const btn = h(
        'button',
        {
          type: 'button',
          class: 'pick',
          'aria-pressed': 'false',
          onclick: () => {
            sel = toggleSelection(sel, a.id, p.multi);
            refresh();
          },
        },
        a.primaryFileId
          ? picture({id: a.primaryFileId, meta: {}}, 480, {ratio: '1 / 1', cover: true})
          : picture(null, 480, {ratio: '1 / 1'}),
        badge,
        h('span', {class: 'pick-title'}, titleOf(a), a.public ? null : h('small', null, ' · not public')),
      );
      buttons.set(a.id, {btn, badge});
      return btn;
    };
    const group = (heading: string, items: Artwork[]) =>
      items.length ? [h('h3', null, heading), h('div', {class: 'pick-grid'}, items.map(tile))] : [];

    const done = h('button', {type: 'button', class: 'primary', onclick: () => finish(sel)}, 'Done');
    const refresh = () => {
      for (const [id, {btn, badge}] of buttons) {
        const at = sel.indexOf(id);
        btn.setAttribute('aria-pressed', at >= 0 ? 'true' : 'false');
        badge.textContent = at >= 0 ? (p.multi ? String(at + 1) : '✓') : '';
      }
      done.textContent = p.multi ? `Done (${sel.length} chosen)` : 'Done';
    };

    const dlg = h(
      'dialog',
      {class: 'sheet', 'aria-label': `Choose photos for ${p.label}`},
      h(
        'div',
        {class: 'sheet-body'},
        h('h2', null, p.label),
        h('p', {class: 'muted'}, p.multi ? 'Tap the photos in the order you want them.' : 'Tap the photo you want.'),
        ...group('Site photos', sitePhotos),
        ...group('Works', works),
        !sitePhotos.length && !works.length ? h('p', {class: 'muted'}, 'No photos yet.') : null,
      ),
      h('div', {class: 'sheet-foot row'}, done, h('button', {type: 'button', onclick: () => finish(null)}, 'Cancel')),
    );
    const finish = (v: string[] | null) => {
      dlg.close?.();
      dlg.remove();
      resolve(v);
    };
    dlg.addEventListener('cancel', () => finish(null));
    refresh();
    document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', '');
  });
}
