// Leads: what visitors sent from the site. A list (open by default) and one lead's page (D-133, D-140).
import './leads.css';
import {mount} from '../components/mount';
import {isConflict, plainError} from '../lib/artworks';
import {refreshLeadBadge, setNewLeads} from '../lib/lead-badge';
import {
  getLead,
  heldUntil,
  kindLabel,
  leadButtons,
  leadWho,
  listLeads,
  mailtoHref,
  piecesLabel,
  priceLabel,
  runLeadAction,
  smsHref,
  statusLabel,
  telHref,
  when,
  countNew,
  type Lead,
  type LeadDetail,
} from '../lib/leads';
import {pictureUrl} from '../lib/pictures';
import {STATUS_LABELS} from '../lib/work-logic';
import type {Params} from '../router';
import {confirmDialog, h, toast} from '../ui';

let showAll = false;

export async function render(el: HTMLElement, params: Params): Promise<void> {
  return params.id ? detail(el, params.id) : list(el, params);
}

const failure = (el: HTMLElement, title: string, e: unknown, again: () => void) =>
  mount(
    el,
    h('h1', null, title),
    h('p', {class: 'err', role: 'alert'}, plainError(e, "Couldn't load this. Check your connection and try again.")),
    h('button', {onclick: again}, 'Try again'),
  );

// ---- list
async function list(el: HTMLElement, params: Params): Promise<void> {
  mount(el, h('h1', null, 'Leads'), h('p', {class: 'muted'}, 'Loading…'));
  let leads: Lead[];
  try {
    leads = await listLeads(showAll ? 'all' : 'open');
  } catch (e) {
    return failure(el, 'Leads', e, () => list(el, params));
  }
  if (!showAll) setNewLeads(countNew(leads));
  const pill = (label: string, all: boolean) =>
    h(
      'button',
      {
        class: 'pill',
        'aria-pressed': showAll === all ? 'true' : 'false',
        onclick: () => {
          showAll = all;
          void list(el, params);
        },
      },
      label,
    );
  mount(
    el,
    h('h1', null, 'Leads'),
    h('div', {class: 'chips filters', role: 'group', 'aria-label': 'Show'}, pill('Open', false), pill('All', true)),
    leads.length
      ? h('div', {class: 'lead-list'}, leads.map(row))
      : h(
          'div',
          {class: 'card empty'},
          h('h2', null, showAll ? 'No leads yet' : 'Nothing waiting'),
          h(
            'p',
            {class: 'muted'},
            showAll
              ? 'When a visitor sends you an inquiry or asks for a hold, it shows up here.'
              : 'New inquiries and hold requests show up here.',
          ),
        ),
  );
}

function row(l: Lead): HTMLElement {
  const held = heldUntil(l);
  return h(
    'a',
    {class: 'lead-row', href: `/studio/leads/${encodeURIComponent(l.id)}`},
    h(
      'div',
      {class: 'lead-top'},
      h('strong', {class: 'lead-who'}, leadWho(l)),
      h('span', {class: l.status === 'new' ? 'chip accent' : 'chip'}, statusLabel(l)),
    ),
    h('div', {class: 'muted'}, `${kindLabel(l.kind)} · ${piecesLabel(l.works.length)} · ${when(l.createdAt)}`),
    held ? h('div', {class: 'lead-held'}, held) : null,
  );
}

// ---- detail
async function detail(el: HTMLElement, id: string): Promise<void> {
  mount(el, h('p', {class: 'muted'}, 'Loading…'));
  let lead: LeadDetail;
  try {
    lead = await getLead(id);
  } catch (e) {
    return failure(el, 'Lead', e, () => detail(el, id));
  }
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const buttons = leadButtons(lead).map(b => {
    const btn = h(
      'button',
      {
        class: b.primary ? 'primary big' : 'big',
        type: 'button',
        onclick: async () => {
          msg.hidden = true;
          if (!(await confirmDialog(b.confirm, b.confirmLabel))) return;
          btn.setAttribute('disabled', '');
          try {
            await runLeadAction(lead, b.action);
            toast(b.done);
            void refreshLeadBadge();
            await detail(el, id);
          } catch (e) {
            if (isConflict(e)) {
              await detail(el, id);
              toast('This lead changed. Here is the latest.');
              return;
            }
            btn.removeAttribute('disabled');
            msg.textContent = plainError(e, "That didn't work. Check your connection and try again.");
            msg.hidden = false;
          }
        },
      },
      b.label,
    );
    return btn;
  });
  const held = heldUntil(lead);
  mount(
    el,
    h('a', {class: 'small-link', href: '/studio/leads'}, '‹ All leads'),
    h('h1', null, leadWho(lead)),
    h('p', {class: 'muted'}, `${kindLabel(lead.kind)} · ${statusLabel(lead)} · ${when(lead.createdAt)}`),
    held ? h('p', {class: 'lead-held'}, held) : null,
    buttons.length ? h('div', {class: 'row'}, buttons) : null,
    msg,
    contactCard(lead),
    piecesCard(lead),
    lead.note
      ? h('section', {class: 'card'}, h('h2', null, 'Their note'), h('p', {class: 'lead-note'}, lead.note))
      : null,
    lead.fileIds.length
      ? h(
          'section',
          {class: 'card'},
          h('h2', null, 'Their pictures'),
          h('div', {class: 'lead-pics'}, lead.fileIds.map(theirPicture)),
        )
      : null,
    lead.chat.length ? chatCard(lead) : null,
  );
}

function contactCard(l: Lead): HTMLElement {
  const link = (href: string, label: string, value: string) =>
    h('a', {class: 'btn big', href}, h('span', null, label), h('small', {class: 'muted'}, value));
  const any = l.email || l.phone;
  return h(
    'section',
    {class: 'card'},
    h('h2', null, 'Reach them'),
    l.name ? h('p', null, l.name) : null,
    any
      ? h(
          'div',
          {class: 'contact'},
          l.email ? link(mailtoHref(l.email), 'Email', l.email) : null,
          l.phone ? link(smsHref(l.phone), 'Text', l.phone) : null,
          l.phone ? link(telHref(l.phone), 'Call', l.phone) : null,
        )
      : h('p', {class: 'muted'}, 'They left no email or phone.'),
  );
}

function piecesCard(l: Lead): HTMLElement {
  return h(
    'section',
    {class: 'card'},
    h('h2', null, l.works.length === 1 ? 'The piece' : 'The pieces'),
    l.works.length
      ? h(
          'ul',
          {class: 'lead-pieces'},
          l.works.map(w =>
            h(
              'li',
              null,
              h(
                'a',
                {href: `/studio/works/${encodeURIComponent(w.id)}`},
                h('strong', null, w.title || 'Untitled'),
                h(
                  'span',
                  {class: 'muted'},
                  ` ${STATUS_LABELS[w.status as keyof typeof STATUS_LABELS] ?? w.status} · ${priceLabel(w)}`,
                ),
              ),
            ),
          ),
        )
      : h('p', {class: 'muted'}, 'No pieces listed.'),
  );
}

/** Their picture: the signed link, shown small; tap to open it full size. */
function theirPicture(fileId: string): HTMLElement {
  const box = h('div', {class: 'lead-pic pic'});
  Promise.all([pictureUrl(fileId, 480), pictureUrl(fileId, 1600)]).then(
    ([small, big]) => {
      box.append(
        h(
          'a',
          {href: big, target: '_blank', rel: 'noopener', 'aria-label': 'Open picture full size'},
          h('img', {src: small, alt: 'Picture from the visitor', loading: 'lazy'}),
        ),
      );
    },
    () => box.append(h('span', {class: 'pic-note'}, "Couldn't load")),
  );
  return box;
}

function chatCard(l: LeadDetail): HTMLElement {
  return h(
    'section',
    {class: 'card'},
    h('h2', null, 'The chat'),
    h(
      'div',
      {class: 'chat'},
      l.chat.map(m =>
        h(
          'p',
          {class: m.role === 'user' ? 'bubble them' : 'bubble bot'},
          h('small', {class: 'muted'}, m.role === 'user' ? leadWho(l) : 'Assistant'),
          h('span', null, m.text),
        ),
      ),
    ),
  );
}
