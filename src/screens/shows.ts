// Shows (D-182): every show, and for each one its page on the site: the details, the address and words, the booth
// photos and the works shown. Shows from the Show Tracker appear here too; this screen adds the page on top.
import './shows.css';
import {mount} from '../components/mount';
import {pickPhotos} from '../components/pick-photos';
import {picture} from '../components/picture';
import {createWork, isConflict, listAll, plainError, publishWork, updateWork} from '../lib/artworks';
import {prepareImage} from '../lib/images';
import {
  addWorkToShow,
  changedShowFields,
  createShow,
  getShow,
  listAllShows,
  pageOf,
  readShowFields,
  removeWorkFromShow,
  setShowPage,
  shortDates,
  SLUG_RULE,
  sortShows,
  todayLocal,
  updateShow,
  type ShowFields,
  type StudioShow,
  type StudioShowDetail,
} from '../lib/shows';
import {attachToArtwork, uploadPrepared} from '../lib/upload';
import {navigate, type Params} from '../router';
import type {Artwork} from '../types';
import {chip, confirmDialog, h, toast} from '../ui';

const titleOf = (a: Artwork) => a.title || 'Untitled';
let uidN = 0;
const uid = (p: string) => `${p}-${++uidN}`;

export async function render(el: HTMLElement, params: Params): Promise<void> {
  if (params.id) return detail(el, params.id);
  return list(el);
}

// ------------------------------------------------------------------ the list

async function list(el: HTMLElement): Promise<void> {
  mount(el, h('h1', null, 'Shows'), h('p', {class: 'muted'}, 'Loading…'));
  let shows: StudioShow[];
  try {
    shows = await listAllShows();
  } catch (e) {
    mount(
      el,
      h('h1', null, 'Shows'),
      h('p', {class: 'err', role: 'alert'}, plainError(e, "Couldn't load your shows. Check your connection.")),
    );
    return;
  }
  const rows = sortShows(shows, todayLocal()).map(s => {
    const page = pageOf(s);
    return h(
      'li',
      null,
      h(
        'a',
        {class: 'card show-item', href: `/studio/shows/${encodeURIComponent(s.id)}`},
        h(
          'span',
          {class: 'show-item-top'},
          h('strong', null, s.name),
          page.published ? chip('On your site', true) : null,
          s.status === 'cancelled' ? chip('Cancelled') : null,
        ),
        h(
          'span',
          {class: 'muted'},
          [shortDates(s.startsOn, s.endsOn), s.city, s.booth ? `Booth ${s.booth}` : null].filter(Boolean).join(' · '),
        ),
      ),
    );
  });
  mount(
    el,
    h('h1', null, 'Shows'),
    h(
      'p',
      {class: 'muted'},
      'Each show can have its own page on your site, with booth photos and the works you brought, so people who saw you there can find you again.',
    ),
    addForm(),
    rows.length
      ? h('ul', {class: 'plain show-list'}, rows)
      : h('p', {class: 'card empty muted'}, 'No shows yet. Add one above, or from the Show Tracker.'),
  );
}

/** One labelled input; `read()` gives what was typed. */
function input(label: string, value: string | null, type = 'text', hint?: string) {
  const id = uid('show');
  const control = h('input', {id, type, autocomplete: 'off'});
  control.value = value ?? '';
  const err = h('p', {class: 'field-err', role: 'alert', hidden: true});
  const el = h(
    'div',
    {class: 'field'},
    h('label', {for: id}, label),
    control,
    hint ? h('p', {class: 'hint'}, hint) : null,
    err,
  );
  return {
    el,
    control,
    read: () => control.value,
    fail(msg: string) {
      err.textContent = msg;
      err.hidden = false;
      control.setAttribute('aria-invalid', 'true');
      control.focus();
    },
    ok() {
      err.hidden = true;
      control.removeAttribute('aria-invalid');
    },
  };
}

/** The six fields of a show, shared by the add form and the details card. */
function showInputs(s: Partial<ShowFields> = {}) {
  const f = {
    name: input('Show name', s.name ?? null, 'text', 'As the fair calls it, like Red Dot Miami.'),
    startsOn: input('First day', s.startsOn ?? null, 'date'),
    endsOn: input('Last day', s.endsOn ?? null, 'date'),
    city: input('City', s.city ?? null),
    venue: input('Venue', s.venue ?? null),
    booth: input('Booth', s.booth ?? null),
  };
  const read = (): ShowFields | null => {
    Object.values(f).forEach(x => x.ok());
    const r = readShowFields({
      name: f.name.read(),
      venue: f.venue.read(),
      city: f.city.read(),
      startsOn: f.startsOn.read(),
      endsOn: f.endsOn.read(),
      booth: f.booth.read(),
    });
    if (!r.ok) {
      f[r.field].fail(r.message);
      return null;
    }
    return r.fields;
  };
  const els = [
    f.name.el,
    h('div', {class: 'show-dates'}, f.startsOn.el, f.endsOn.el),
    f.city.el,
    f.venue.el,
    f.booth.el,
  ];
  return {els, read};
}

function addForm(): HTMLElement {
  const fields = showInputs();
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const save = h('button', {class: 'primary', type: 'submit'}, 'Add the show');
  const form = h('form', {class: 'show-add'}, ...fields.els, h('div', {class: 'row'}, save), msg);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.hidden = true;
    const f = fields.read();
    if (!f) return;
    save.disabled = true;
    try {
      const s = await createShow(f);
      navigate(`/studio/shows/${encodeURIComponent(s.id)}`);
    } catch (err) {
      msg.textContent = plainError(err, "The show wasn't added. Try again.");
      msg.hidden = false;
      save.disabled = false;
    }
  });
  return h('details', {class: 'card show-add-card'}, h('summary', null, h('strong', null, 'Add a show')), form);
}

// ------------------------------------------------------------------ one show

interface State {
  show: StudioShowDetail;
  works: Artwork[];
  /** What was typed on cards that weren't saved yet, kept when the screen redraws. */
  drafts: Record<string, string>;
}

async function detail(el: HTMLElement, id: string): Promise<void> {
  mount(el, h('p', {class: 'crumb'}, h('a', {href: '/studio/shows'}, '← Shows')), h('p', {class: 'muted'}, 'Loading…'));
  const st: State = {show: null as unknown as StudioShowDetail, works: [], drafts: {}};
  const load = async () => {
    const [show, works] = await Promise.all([getShow(id), listAll()]);
    st.show = show;
    st.works = works;
  };
  const draw = () => {
    mount(
      el,
      h('p', {class: 'crumb'}, h('a', {href: '/studio/shows'}, '← Shows')),
      h('h1', null, st.show.name),
      pageCard(st, redo),
      photosCard(st, redo),
      worksCard(st, redo),
      detailsCard(st, redo),
    );
  };
  /** Reload and redraw after a change; a message (if any) shows as a toast. */
  async function redo(message?: string): Promise<void> {
    try {
      await load();
    } catch (e) {
      toast(plainError(e, "Couldn't reload this show."));
      return;
    }
    draw();
    if (message) toast(message);
  }
  try {
    await load();
  } catch (e) {
    mount(
      el,
      h('p', {class: 'crumb'}, h('a', {href: '/studio/shows'}, '← Shows')),
      h('p', {class: 'err', role: 'alert'}, plainError(e, "Couldn't load this show. Check your connection.")),
    );
    return;
  }
  draw();
}

type Redo = (message?: string) => Promise<void>;

/** A save that reloads on a conflict (someone changed the show elsewhere) and says so. */
async function saving(
  btn: HTMLButtonElement,
  msg: HTMLElement,
  redo: Redo,
  run: () => Promise<unknown>,
  done: string,
): Promise<boolean> {
  btn.disabled = true;
  msg.hidden = true;
  try {
    await run();
    await redo(done);
    return true;
  } catch (e) {
    if (isConflict(e)) {
      await redo('This show changed on another device, so it reloaded. Try again.');
      return false;
    }
    msg.textContent = plainError(e, "That wasn't saved. Try again.");
    msg.hidden = false;
    btn.disabled = false;
    return false;
  }
}

function pageCard(st: State, redo: Redo): HTMLElement {
  const s = st.show;
  const page = pageOf(s);
  const live = page.published;
  const slug = input(
    'Page address',
    st.drafts.slug ?? page.slug,
    'text',
    `${location.host}/shows/… Lower case letters, numbers and hyphens.`,
  );
  slug.control.addEventListener('input', () => (st.drafts.slug = slug.read()));
  const textId = uid('show');
  const words = h('textarea', {id: textId, rows: 5});
  words.value = st.drafts.description ?? page.description ?? '';
  words.addEventListener('input', () => (st.drafts.description = words.value));
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});

  const read = () => {
    slug.ok();
    const v = slug.read().trim().toLowerCase();
    if (!SLUG_RULE.test(v) || v.length > 80) {
      slug.fail('Use lower case letters, numbers and single hyphens, like red-dot-miami-2026.');
      return null;
    }
    return {slug: v, description: words.value.trim() || null};
  };
  const save = h('button', {type: 'button'}, 'Save');
  save.addEventListener('click', async () => {
    const v = read();
    if (!v) return;
    const ok = await saving(save, msg, redo, () => setShowPage(s, v), 'Saved');
    if (ok) {
      delete st.drafts.slug;
      delete st.drafts.description;
    }
  });
  const toggle = h(
    'button',
    {type: 'button', class: live ? '' : 'primary'},
    live ? 'Take off my site' : 'Put on my site',
  );
  toggle.addEventListener('click', async () => {
    const v = read();
    if (!v) return;
    if (!live) {
      const sure = await confirmDialog(
        'This show gets its own page on your site, with its booth photos and the public works shown, and a Shows link in the menu.',
        'Put it on my site',
        'Cancel',
      );
      if (!sure) return;
    }
    const ok = await saving(
      toggle,
      msg,
      redo,
      () => setShowPage(s, {...v, published: !live}),
      live ? 'Taken off your site' : 'On your site',
    );
    if (ok) {
      delete st.drafts.slug;
      delete st.drafts.description;
    }
  });
  const hidden = page.photos.filter(id => {
    const a = st.works.find(w => w.id === id);
    return a && !a.public;
  }).length;
  return h(
    'section',
    {class: 'card', 'aria-labelledby': 'show-page-h'},
    h('h2', {id: 'show-page-h'}, 'Page on your site'),
    live
      ? h(
          'p',
          null,
          chip('On your site', true),
          ' ',
          h(
            'a',
            {href: `/shows/${page.slug}`, target: '_blank', rel: 'noopener'},
            `${location.host}/shows/${page.slug}`,
          ),
        )
      : h('p', {class: 'muted'}, 'Not on your site yet. Nothing here is public until you put it on.'),
    slug.el,
    h(
      'div',
      {class: 'field'},
      h('label', {for: textId}, 'About the show (optional)'),
      words,
      h('p', {class: 'hint'}, 'A line or two for the page, like what you brought or where the booth was.'),
    ),
    hidden
      ? h('p', {class: 'muted'}, `${hidden} booth photo${hidden === 1 ? ' isn’t' : 's aren’t'} public, so not shown.`)
      : null,
    h('div', {class: 'row'}, toggle, save),
    msg,
  );
}

function photosCard(st: State, redo: Redo): HTMLElement {
  const s = st.show;
  const page = pageOf(s);
  const byId = new Map(st.works.map(a => [a.id, a] as const));
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const status = h('p', {class: 'muted', role: 'status'});
  const say = (t: string) => (status.textContent = t);

  const savePhotos = async (ids: string[], done: string) => {
    try {
      await setShowPage(s, {photos: ids});
      await redo(done);
    } catch (e) {
      if (isConflict(e)) return void (await redo('This show changed on another device, so it reloaded. Try again.'));
      msg.textContent = plainError(e, "The photos weren't saved. Try again.");
      msg.hidden = false;
    }
  };

  const thumbs = h(
    'div',
    {class: 'thumbs'},
    page.photos.map(id => {
      const a = byId.get(id);
      return h(
        'div',
        {class: 'thumb'},
        a?.primaryFileId
          ? picture({id: a.primaryFileId, meta: {}}, 480, {ratio: '1 / 1', cover: true, alt: titleOf(a)})
          : picture(null, 480, {ratio: '1 / 1'}),
        h(
          'button',
          {
            type: 'button',
            class: 'thumb-x',
            'aria-label': `Take ${a ? titleOf(a) : 'this photo'} off the page`,
            onclick: () =>
              savePhotos(
                page.photos.filter(x => x !== id),
                'Photo taken off the page',
              ),
          },
          '×',
        ),
      );
    }),
  );

  const fileId = uid('show-photos');
  const files = h('input', {id: fileId, type: 'file', accept: 'image/*', multiple: true, class: 'visually-hidden'});
  files.addEventListener('change', async () => {
    const picked = [...(files.files ?? [])];
    files.value = '';
    if (!picked.length) return;
    msg.hidden = true;
    const added: string[] = [];
    let failed = '';
    for (const [i, file] of picked.entries()) {
      const n = `${i + 1} of ${picked.length}`;
      try {
        say(`Preparing photo ${n}…`);
        const prepared = await prepareImage(file, file.name || `booth-${i + 1}.jpg`);
        let work = await createWork({title: `${s.name} booth`, kind: 'site_photo', status: 'not_for_sale'});
        say(`Uploading photo ${n}…`);
        const rec = await uploadPrepared(prepared, 'photo', (d, t) =>
          say(`Uploading photo ${n}… ${Math.round((d / t) * 100)}%`),
        );
        await attachToArtwork(rec.id, work.id);
        work = await updateWork(work.id, {primaryFileId: rec.id, palette: prepared.palette ?? []}, work.version);
        // A booth photo is only ever shown on this show's page; it never joins the works list.
        await publishWork(work.id, work.version);
        added.push(work.id);
      } catch (e) {
        failed = `Photo ${n} didn't make it. ${plainError(e, 'Check your connection.')}`;
        break;
      }
    }
    say('');
    if (added.length)
      await savePhotos([...page.photos, ...added], `${added.length} photo${added.length === 1 ? '' : 's'} added`);
    if (failed) {
      msg.textContent = failed;
      msg.hidden = false;
    }
  });

  const choose = h('button', {type: 'button'}, 'Choose from my photos');
  choose.addEventListener('click', async () => {
    const ids = await pickPhotos(
      {label: `${s.name}: booth photos`, multi: true},
      page.photos,
      st.works,
      'Tap the photos in the order you want them on the page.',
    );
    if (!ids) return;
    const toPublish = ids.map(id => byId.get(id)).filter((a): a is Artwork => !!a && !a.public);
    if (toPublish.length) {
      const works = toPublish.filter(a => a.kind !== 'site_photo').length;
      const sure = await confirmDialog(
        `${toPublish.length === 1 ? 'This photo isn’t' : `These ${toPublish.length} photos aren’t`} public yet. ${
          works ? 'Works you choose also join the works on your site. ' : ''
        }Make ${toPublish.length === 1 ? 'it' : 'them'} public?`,
        'Make public',
        'Cancel',
      );
      if (!sure) return;
      for (const a of toPublish) {
        try {
          await publishWork(a.id, a.version);
        } catch (e) {
          msg.textContent = `${titleOf(a)}: ${plainError(e, 'it could not be made public')}`;
          msg.hidden = false;
          return;
        }
      }
    }
    await savePhotos(ids, 'Booth photos saved');
  });

  return h(
    'section',
    {class: 'card', 'aria-labelledby': 'show-photos-h'},
    h('h2', {id: 'show-photos-h'}, 'Booth photos'),
    page.photos.length ? thumbs : h('p', {class: 'muted'}, 'No booth photos yet.'),
    h('div', {class: 'row'}, files, h('label', {class: 'btn primary', for: fileId}, 'Add photos'), choose),
    h('p', {class: 'hint'}, 'Photos you add here show only on this show’s page, once it’s on your site.'),
    status,
    msg,
  );
}

function worksCard(st: State, redo: Redo): HTMLElement {
  const s = st.show;
  const byId = new Map(st.works.map(a => [a.id, a] as const));
  const here = new Set(s.artworks.map(r => r.artworkId));
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const act = async (run: () => Promise<unknown>, done: string) => {
    msg.hidden = true;
    try {
      await run();
      await redo(done);
    } catch (e) {
      msg.textContent = plainError(e, "That wasn't saved. Try again.");
      msg.hidden = false;
    }
  };
  const rows = s.artworks.map(r => {
    const a = byId.get(r.artworkId);
    const name = a ? titleOf(a) : 'A work';
    return h(
      'li',
      {class: 'show-work'},
      h(
        'div',
        {class: 'site-thumb'},
        a?.primaryFileId
          ? picture({id: a.primaryFileId, meta: {}}, 480, {ratio: '1 / 1', cover: true, alt: name})
          : picture(null, 480, {ratio: '1 / 1'}),
      ),
      h(
        'span',
        {class: 'show-work-name'},
        a ? h('a', {href: `/studio/works/${encodeURIComponent(a.id)}`}, name) : name,
        r.outcome === 'sold' ? chip('Sold here') : null,
        a && !a.public ? h('small', {class: 'muted'}, ' · not public, so not on the page') : null,
      ),
      r.outcome === 'sold'
        ? null
        : h(
            'button',
            {
              type: 'button',
              class: 'small',
              'aria-label': `Take ${name} off this show`,
              onclick: () => act(() => removeWorkFromShow(s.id, r.artworkId), `${name} taken off`),
            },
            'Remove',
          ),
    );
  });
  const choices = st.works
    .filter(a => a.kind !== 'site_photo' && a.status !== 'archived' && !here.has(a.id))
    .sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
  const pick = h(
    'select',
    {'aria-label': 'A work you brought'},
    h('option', {value: ''}, choices.length ? 'Choose a work…' : 'Every work is already here'),
    choices.map(a => h('option', {value: a.id}, titleOf(a) + (a.public ? '' : ' (not public)'))),
  );
  const add = h('button', {type: 'button', disabled: !choices.length}, 'Add');
  add.addEventListener('click', () => {
    if (!pick.value) return void pick.focus();
    const name = pick.selectedOptions[0]?.textContent ?? 'The work';
    void act(() => addWorkToShow(s.id, pick.value), `${name.replace(/ \(not public\)$/, '')} added`);
  });
  return h(
    'section',
    {class: 'card', 'aria-labelledby': 'show-works-h'},
    h('h2', {id: 'show-works-h'}, 'Works shown'),
    rows.length
      ? h('ul', {class: 'plain show-works'}, rows)
      : h('p', {class: 'muted'}, 'No works yet. Add the ones you brought.'),
    h('div', {class: 'row'}, pick, add),
    h('p', {class: 'hint'}, 'Only public works appear on the page. This is the same list as the Show Tracker’s.'),
    msg,
  );
}

function detailsCard(st: State, redo: Redo): HTMLElement {
  const s = st.show;
  const fields = showInputs(s);
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const save = h('button', {type: 'submit'}, 'Save details');
  const form = h('form', null, ...fields.els, h('div', {class: 'row'}, save), msg);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = fields.read();
    if (!f) return;
    const change = changedShowFields(s, f);
    if (!Object.keys(change).length) return toast('Nothing changed');
    await saving(save, msg, redo, () => updateShow(s, change), 'Details saved');
  });
  return h(
    'section',
    {class: 'card', 'aria-labelledby': 'show-details-h'},
    h('h2', {id: 'show-details-h'}, 'Show details'),
    form,
  );
}
