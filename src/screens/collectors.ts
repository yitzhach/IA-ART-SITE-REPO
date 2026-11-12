// Collectors (stage 6, D-163…D-168). The list: everyone who bought, inquired or followed, newest first; Add a
// collector; Email followers about first look; each show's QR code. One collector: their link (copy, email, stop),
// the works they own with certificate numbers, and their commissions on the five-stage line.
import './leads.css';
import './collectors.css';
import {mount} from '../components/mount';
import {isConflict, listAll, plainError} from '../lib/artworks';
import {when} from '../lib/leads';
import {
  addCollector,
  addCommission,
  announceFirstLook,
  CARE_DRAFT,
  getSettings,
  saveCare,
  deleteCommission,
  emailInvite,
  getCollector,
  linkUrl,
  listCollectors,
  listFollowers,
  listShows,
  makeLink,
  nextStage,
  qrSvg,
  setOwner,
  showFollowUrl,
  STAGES,
  stageLabel,
  stopLink,
  updateCommission,
  type CollectorDetail,
  type CollectorSummary,
  type Commission,
  type Show,
} from '../lib/collectors';
import type {Params} from '../router';
import {confirmDialog, h, toast} from '../ui';

export async function render(el: HTMLElement, params: Params): Promise<void> {
  if (params.id) return detail(el, params.id);
  return list(el);
}

const failed = (el: HTMLElement, title: string, e: unknown, retry: () => void) =>
  mount(
    el,
    h('h1', null, title),
    h('p', {class: 'err', role: 'alert'}, plainError(e, "Couldn't load this. Check your connection and try again.")),
    h('button', {onclick: retry}, 'Try again'),
  );

// ------------------------------------------------------------------ the list

async function list(el: HTMLElement): Promise<void> {
  mount(el, h('h1', null, 'Collectors'), h('p', {class: 'muted'}, 'Loading…'));
  let people: CollectorSummary[];
  let followers: Awaited<ReturnType<typeof listFollowers>>;
  try {
    [people, followers] = await Promise.all([listCollectors(), listFollowers()]);
  } catch (e) {
    return failed(el, 'Collectors', e, () => void list(el));
  }
  const following = followers.filter(f => f.verifiedAt && !f.unsubscribedAt);
  mount(
    el,
    h('h1', null, 'Collectors'),
    addForm(id => void detail(el, id, true)),
    people.length
      ? h(
          'div',
          {class: 'lead-list'},
          people.map(p =>
            h(
              'a',
              {class: 'card lead collector-row', href: `/studio/collectors/${p.id}`},
              h(
                'div',
                {class: 'lead-top'},
                h('strong', {class: 'lead-who'}, p.name),
                p.link ? h('span', {class: 'chip accent'}, 'Has a link') : null,
              ),
              h(
                'p',
                {class: 'muted'},
                [
                  p.workCount ? `${p.workCount} work${p.workCount === 1 ? '' : 's'}` : null,
                  p.commissionCount ? `${p.commissionCount} commission${p.commissionCount === 1 ? '' : 's'}` : null,
                  p.following ? 'Follows' : null,
                  p.email,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Nothing yet',
              ),
            ),
          ),
        )
      : h(
          'div',
          {class: 'card empty'},
          h('h2', null, 'No collectors yet'),
          h('p', {class: 'muted'}, 'People who buy, ask about a piece or follow show up here. Add past buyers above.'),
        ),
    firstLookCard(),
    careCard(),
    h(
      'section',
      {class: 'card'},
      h('h2', null, `Followers (${following.length})`),
      following.length
        ? h(
            'ul',
            {class: 'plain'},
            following
              .slice(0, 50)
              .map(f => h('li', null, `${f.email}${f.showName ? ` · from ${f.showName}` : ''} · ${when(f.createdAt)}`)),
          )
        : h('p', {class: 'muted'}, 'Anyone can follow from the footer of your site or a show’s QR code below.'),
    ),
    showsCard(),
  );
}

function addForm(opened: (id: string) => void): HTMLElement {
  const name = h('input', {
    type: 'text',
    autocomplete: 'off',
    'aria-label': 'Name',
    placeholder: 'Name',
    required: true,
  });
  const email = h('input', {
    type: 'email',
    autocomplete: 'off',
    'aria-label': 'Email',
    placeholder: 'Email (optional)',
  });
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const save = h('button', {class: 'primary', type: 'submit'}, 'Add');
  const form = h('form', {class: 'card add-collector'}, h('h2', null, 'Add a collector'), name, email, save, msg);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    msg.hidden = true;
    if (!name.value.trim()) {
      msg.textContent = 'Add their name.';
      msg.hidden = false;
      return;
    }
    save.setAttribute('disabled', '');
    try {
      const c = await addCollector(name.value.trim(), email.value.trim() || null);
      history.pushState(null, '', `/studio/collectors/${c.id}`);
      opened(c.id);
    } catch (e) {
      save.removeAttribute('disabled');
      msg.textContent = plainError(e, "Couldn't add them. Check the email and try again.");
      msg.hidden = false;
    }
  });
  return form;
}

function firstLookCard(): HTMLElement {
  const msg = h('p', {class: 'muted', role: 'status'});
  const btn = h(
    'button',
    {
      class: 'big',
      type: 'button',
      onclick: async () => {
        if (
          !(await confirmDialog(
            'Email your followers and collectors about the works in first look that haven’t been announced yet?',
            'Send the email',
          ))
        )
          return;
        btn.setAttribute('disabled', '');
        try {
          const r = await announceFirstLook();
          msg.textContent = `Sent about ${r.works} work${r.works === 1 ? '' : 's'} (${r.emailed} email${r.emailed === 1 ? '' : 's'}).`;
        } catch (e) {
          msg.textContent = plainError(e, "Couldn't send. Try again.");
        }
        btn.removeAttribute('disabled');
      },
    },
    'Email followers about first look',
  );
  return h(
    'section',
    {class: 'card'},
    h('h2', null, 'First look'),
    h(
      'p',
      {class: 'muted'},
      'Open a work and tap Start first look: collectors and followers see it for 7 days before your public site. Then send one email here.',
    ),
    btn,
    msg,
  );
}

function careCard(): HTMLElement {
  const text = h('textarea', {rows: 8, 'aria-label': 'Care notes'});
  const note = h('p', {class: 'muted'}, 'Loading…');
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const save = h('button', {class: 'primary', type: 'button', disabled: true}, 'Save care notes');
  getSettings().then(
    s => {
      const saved = s.meta.site?.collectors?.care ?? '';
      text.value = saved || CARE_DRAFT;
      note.textContent = saved
        ? 'Shown on every collector’s page.'
        : 'A draft from your Process page. Edit it, then save. Nothing shows on collectors’ pages until you do.';
      save.removeAttribute('disabled');
      save.onclick = async () => {
        msg.hidden = true;
        save.setAttribute('disabled', '');
        try {
          await saveCare(await getSettings(), text.value);
          toast('Care notes saved.');
          note.textContent = 'Shown on every collector’s page.';
        } catch (e) {
          msg.textContent = plainError(e, "Couldn't save. Try again.");
          msg.hidden = false;
        }
        save.removeAttribute('disabled');
      };
    },
    e => {
      note.textContent = plainError(e, 'Couldn’t load your settings.');
    },
  );
  return h('section', {class: 'card'}, h('h2', null, 'Care notes'), note, text, h('div', {class: 'row'}, save), msg);
}

function showsCard(): HTMLElement {
  const box = h('div', null, h('p', {class: 'muted'}, 'Loading your shows…'));
  listShows().then(
    shows => {
      box.replaceChildren(
        ...(shows.length
          ? shows.slice(0, 30).map(showRow)
          : [h('p', {class: 'muted'}, 'Shows you add in the Show Tracker get a QR code here.')]),
      );
    },
    () => box.replaceChildren(h('p', {class: 'muted'}, 'Couldn’t load your shows.')),
  );
  return h(
    'section',
    {class: 'card'},
    h('h2', null, 'Show QR codes'),
    h('p', {class: 'muted'}, 'Print one for your booth. A scan opens a follow page for that show.'),
    box,
  );
}

function showRow(s: Show): HTMLElement {
  const url = showFollowUrl(s.id);
  const pic = h('div', {class: 'qr', hidden: true});
  const open = h(
    'button',
    {
      type: 'button',
      onclick: () => {
        if (!pic.hidden) return void (pic.hidden = true);
        // The QR code is our own SVG (dark squares only), drawn as an image so no markup is ever parsed.
        const img = h('img', {
          src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(url))}`,
          alt: `QR code for ${s.name}`,
          width: 240,
          height: 240,
        });
        pic.replaceChildren(img, h('p', {class: 'muted'}, url));
        pic.hidden = false;
      },
    },
    'QR code',
  );
  return h(
    'div',
    {class: 'show-row'},
    h('p', null, h('strong', null, s.name), s.city ? ` · ${s.city}` : '', s.startsOn ? ` · ${s.startsOn}` : ''),
    open,
    pic,
  );
}

// ------------------------------------------------------------------ one collector

async function detail(el: HTMLElement, id: string, fresh = false): Promise<void> {
  if (!fresh)
    mount(
      el,
      h('p', {class: 'crumb'}, h('a', {href: '/studio/collectors'}, '← Collectors')),
      h('p', {class: 'muted'}, 'Loading…'),
    );
  let c: CollectorDetail;
  try {
    c = await getCollector(id);
  } catch (e) {
    return failed(el, 'Collector', e, () => void detail(el, id));
  }
  const redraw = () => detail(el, id, true);
  mount(
    el,
    h('p', {class: 'crumb'}, h('a', {href: '/studio/collectors'}, '← Collectors')),
    h('h1', null, c.name),
    h('p', {class: 'muted'}, [c.email, c.phone, c.following ? 'Follows the studio' : null].filter(Boolean).join(' · ')),
    linkCard(c, redraw),
    worksCard(c, redraw),
    commissionsCard(c, redraw),
  );
}

function linkCard(c: CollectorDetail, redraw: () => Promise<void>): HTMLElement {
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const act = (
    label: string,
    fn: () => Promise<unknown>,
    done: string,
    opts: {primary?: boolean; ask?: string} = {},
  ) => {
    const b = h(
      'button',
      {
        class: opts.primary ? 'primary big' : 'big',
        type: 'button',
        onclick: async () => {
          msg.hidden = true;
          if (opts.ask && !(await confirmDialog(opts.ask, label))) return;
          b.setAttribute('disabled', '');
          try {
            await fn();
            toast(done);
            await redraw();
          } catch (e) {
            b.removeAttribute('disabled');
            msg.textContent = plainError(e, "That didn't work. Try again.");
            msg.hidden = false;
          }
        },
      },
      label,
    );
    return b;
  };
  if (!c.link)
    return h(
      'section',
      {class: 'card'},
      h('h2', null, 'Their page'),
      h(
        'p',
        {class: 'muted'},
        'A private link to a page with the works they own, certificates, care notes and first look.',
      ),
      h(
        'div',
        {class: 'row'},
        act('Make their link', () => makeLink(c.id), 'Their link is ready.', {primary: true}),
      ),
      msg,
    );
  const url = linkUrl(c.link.path);
  const copy = h(
    'button',
    {
      class: 'primary big',
      type: 'button',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast('Copied. Paste it in a text or email to them.');
        } catch {
          toast('Copy didn’t work here. Press and hold the link to copy it.');
        }
      },
    },
    'Copy their link',
  );
  return h(
    'section',
    {class: 'card'},
    h('h2', null, 'Their page'),
    h('p', null, h('a', {href: url, target: '_blank', rel: 'noopener'}, url)),
    c.link.invitedAt ? h('p', {class: 'muted'}, `Invite emailed ${when(c.link.invitedAt)}`) : null,
    h(
      'div',
      {class: 'row'},
      copy,
      c.email
        ? act('Email their invite', () => emailInvite(c.id), 'Invite sent.', {
            ask: `Email ${c.email} the link to their page?`,
          })
        : null,
      act('Stop this link', () => stopLink(c.id), 'The link stopped working.', {
        ask: 'Stop this link? It stops working at once. You can make a new one.',
      }),
    ),
    c.email ? null : h('p', {class: 'muted'}, 'Add their email to send the invite from here.'),
    msg,
  );
}

function worksCard(c: CollectorDetail, redraw: () => Promise<void>): HTMLElement {
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const pick = h('select', {'aria-label': 'A work they own'}, h('option', {value: ''}, 'Loading works…'));
  listAll().then(
    works => {
      const mine = new Set(c.works.map(w => w.id));
      pick.replaceChildren(
        h('option', {value: ''}, 'Choose a work…'),
        ...works
          .filter(w => !mine.has(w.id) && w.kind !== 'site_photo' && w.status !== 'reserved' && w.status !== 'archived')
          .sort((a, b) => a.title.localeCompare(b.title))
          .map(w => h('option', {value: w.id}, `${w.title}${w.status === 'sold' ? ' (sold)' : ''}`)),
      );
    },
    () => pick.replaceChildren(h('option', {value: ''}, 'Couldn’t load works')),
  );
  const add = h(
    'button',
    {
      type: 'button',
      onclick: async () => {
        msg.hidden = true;
        if (!pick.value) return;
        const label = pick.selectedOptions[0]?.textContent ?? 'this work';
        if (
          !(await confirmDialog(`Record that ${c.name} owns ${label}? An unsold work is marked sold to them.`, 'Yes'))
        )
          return;
        add.setAttribute('disabled', '');
        try {
          await setOwner(pick.value, c.id);
          toast('Added to their collection.');
          await redraw();
        } catch (e) {
          add.removeAttribute('disabled');
          msg.textContent = plainError(e, "That didn't work. Try again.");
          msg.hidden = false;
        }
      },
    },
    'Add',
  );
  return h(
    'section',
    {class: 'card'},
    h('h2', null, 'Works they own'),
    c.works.length
      ? h(
          'ul',
          {class: 'plain'},
          c.works.map(w =>
            h(
              'li',
              null,
              h('a', {href: `/studio/works/${w.id}`}, w.title),
              ` · ${w.year ?? ''} · Certificate ${w.certificate}`,
            ),
          ),
        )
      : h('p', {class: 'muted'}, 'None yet.'),
    h('div', {class: 'row'}, pick, add),
    msg,
  );
}

function commissionsCard(c: CollectorDetail, redraw: () => Promise<void>): HTMLElement {
  const title = h('input', {type: 'text', 'aria-label': 'Title', placeholder: 'Title, e.g. Blue heron at dusk'});
  const size = h('input', {type: 'text', 'aria-label': 'Size', placeholder: 'Size, e.g. 24 × 36 in'});
  const price = h('input', {type: 'text', inputmode: 'decimal', 'aria-label': 'Price', placeholder: 'Price in $'});
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const form = h(
    'form',
    {class: 'commission-new'},
    h('h3', null, 'Start a commission'),
    title,
    size,
    price,
    h('button', {class: 'primary', type: 'submit'}, 'Start'),
    msg,
  );
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    msg.hidden = true;
    const p = price.value.trim().replace(/[$,]/g, '');
    if (!title.value.trim() || (p && !/^\d+(\.\d{1,2})?$/.test(p))) {
      msg.textContent = title.value.trim() ? 'The price is a number, like 4000.' : 'Give it a title.';
      msg.hidden = false;
      return;
    }
    try {
      await addCommission(c.id, title.value.trim(), size.value.trim() || null, p ? Math.round(Number(p) * 100) : null);
      toast('Commission started.');
      await redraw();
    } catch (e) {
      msg.textContent = plainError(e, "Couldn't start it. Try again.");
      msg.hidden = false;
    }
  });
  return h(
    'section',
    {class: 'card'},
    h('h2', null, 'Commissions'),
    h('p', {class: 'muted'}, 'They see the stage and your notes on their page, never the price.'),
    c.commissions.map(m => commissionRow(m, redraw)),
    form,
  );
}

function commissionRow(m: Commission, redraw: () => Promise<void>): HTMLElement {
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const note = h('textarea', {
    rows: 2,
    'aria-label': `Note for ${stageLabel(m.stage)}`,
    placeholder: `A note for ${stageLabel(m.stage)}`,
  });
  note.value = m.notes[m.stage] ?? '';
  const run = async (p: Parameters<typeof updateCommission>[1], done: string) => {
    msg.hidden = true;
    try {
      await updateCommission(m, p);
      toast(done);
      await redraw();
    } catch (e) {
      if (isConflict(e)) return void redraw().then(() => toast('This changed elsewhere. Here is the latest.'));
      msg.textContent = plainError(e, "That didn't work. Try again.");
      msg.hidden = false;
    }
  };
  const next = nextStage(m.stage);
  return h(
    'div',
    {class: 'commission-row'},
    h('p', null, h('strong', null, m.title), m.size ? ` · ${m.size}` : '', m.status !== 'open' ? ` · ${m.status}` : ''),
    h(
      'ol',
      {class: 'stage-line'},
      STAGES.map(([k, label]) =>
        h('li', {class: k === m.stage ? 'now' : '', 'aria-current': k === m.stage ? 'step' : null}, label),
      ),
    ),
    note,
    h(
      'div',
      {class: 'row'},
      h(
        'button',
        {type: 'button', onclick: () => run({notes: {...m.notes, [m.stage]: note.value.trim()}}, 'Note saved.')},
        'Save note',
      ),
      next && m.status === 'open'
        ? h(
            'button',
            {
              class: 'primary',
              type: 'button',
              onclick: () =>
                run({stage: next, notes: {...m.notes, [m.stage]: note.value.trim()}}, `Moved to ${stageLabel(next)}.`),
            },
            `Move to ${stageLabel(next)}`,
          )
        : null,
      m.status === 'open' && !next
        ? h(
            'button',
            {class: 'primary', type: 'button', onclick: () => run({status: 'done'}, 'Marked finished.')},
            'Mark finished',
          )
        : null,
      h(
        'button',
        {
          class: 'danger',
          type: 'button',
          onclick: async () => {
            if (!(await confirmDialog(`Delete the commission “${m.title}”?`, 'Delete'))) return;
            try {
              await deleteCommission(m);
              toast('Deleted.');
              await redraw();
            } catch (e) {
              msg.textContent = plainError(e, "Couldn't delete it. Try again.");
              msg.hidden = false;
            }
          },
        },
        'Delete',
      ),
    ),
    msg,
  );
}
