// Orders: what visitors bought from the site (D-144, D-145). Open ones by default: a Venmo or Zelle payment to watch
// for (Mark paid sells the piece), a paid piece to ship (Add tracking emails the buyer), or a payment to refund.
import './leads.css';
import {mount} from '../components/mount';
import {isConflict, plainError} from '../lib/artworks';
import {when} from '../lib/leads';
import {
  addressLines,
  listOrders,
  methodLabel,
  needsYou,
  orderButtons,
  runOrderAction,
  statusLabel,
  itemLines,
  totalLine,
  type Order,
  type OrderButton,
} from '../lib/orders';
import type {Params} from '../router';
import {confirmDialog, h, toast} from '../ui';

let showAll = false;

export async function render(el: HTMLElement, params: Params): Promise<void> {
  mount(el, h('h1', null, 'Orders'), h('p', {class: 'muted'}, 'Loading…'));
  let orders: Order[];
  try {
    orders = await listOrders(showAll ? 'all' : 'open');
  } catch (e) {
    mount(
      el,
      h('h1', null, 'Orders'),
      h('p', {class: 'err', role: 'alert'}, plainError(e, "Couldn't load this. Check your connection and try again.")),
      h('button', {onclick: () => render(el, params)}, 'Try again'),
    );
    return;
  }
  const pill = (label: string, all: boolean) =>
    h(
      'button',
      {
        class: 'pill',
        'aria-pressed': showAll === all ? 'true' : 'false',
        onclick: () => {
          showAll = all;
          void render(el, params);
        },
      },
      label,
    );
  mount(
    el,
    h('h1', null, 'Orders'),
    h('div', {class: 'chips filters', role: 'group', 'aria-label': 'Show'}, pill('Open', false), pill('All', true)),
    orders.length
      ? h(
          'div',
          {class: 'lead-list'},
          orders.map(o => card(o, () => render(el, params))),
        )
      : h(
          'div',
          {class: 'card empty'},
          h('h2', null, showAll ? 'No orders yet' : 'Nothing waiting'),
          h(
            'p',
            {class: 'muted'},
            'When someone buys a piece on your site, it shows up here. Turn on checkout in Site → Checkout.',
          ),
        ),
  );
}

function card(o: Order, redraw: () => Promise<void>): HTMLElement {
  const msg = h('p', {class: 'err', role: 'alert', hidden: true});
  const ship = shipForm(o, msg, redraw);
  const buttons = orderButtons(o).map(b => button(o, b, msg, redraw, ship));
  const addr = addressLines(o);
  return h(
    'section',
    {class: 'card order'},
    h(
      'div',
      {class: 'lead-top'},
      h('strong', {class: 'lead-who'}, o.title),
      h('span', {class: needsYou(o) ? 'chip accent' : 'chip'}, statusLabel(o)),
    ),
    h('p', {class: 'muted'}, `${o.code} · ${methodLabel(o.method)} · ${when(o.createdAt)}`),
    itemLines(o).length
      ? h(
          'ul',
          {class: 'order-items'},
          itemLines(o).map(l => h('li', null, l)),
        )
      : null,
    h('p', null, totalLine(o)),
    o.status === 'awaiting_payment' && o.expiresAt
      ? h(
          'p',
          {class: 'lead-held'},
          `Set aside until ${new Date(o.expiresAt).toLocaleString([], {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}`,
        )
      : null,
    o.conflict
      ? h(
          'p',
          {class: 'err'},
          'They paid, but the piece had already sold or was set aside for someone else. Refund them, or offer another piece.',
        )
      : null,
    o.buyerName || o.buyerEmail || o.buyerPhone
      ? h('p', null, [o.buyerName, o.buyerEmail, o.buyerPhone].filter(Boolean).join(' · '))
      : null,
    addr.length ? h('p', {class: 'lead-note'}, addr.join('\n')) : null,
    o.shippedAt
      ? h('p', {class: 'muted'}, `Shipped ${when(o.shippedAt)}: ${o.carrier ?? ''} ${o.tracking ?? ''}`)
      : null,
    buttons.length ? h('div', {class: 'row'}, buttons) : null,
    ship.el,
    msg,
  );
}

function shipForm(o: Order, msg: HTMLElement, redraw: () => Promise<void>) {
  const carrier = h('input', {
    type: 'text',
    autocomplete: 'off',
    'aria-label': 'Carrier',
    placeholder: 'USPS, UPS, FedEx',
  });
  const tracking = h('input', {
    type: 'text',
    autocomplete: 'off',
    'aria-label': 'Tracking number',
    placeholder: 'Tracking number',
  });
  const save = h('button', {class: 'primary', type: 'submit'}, 'Save and email the buyer');
  const el = h('form', {class: 'ship-form', hidden: true}, carrier, tracking, save);
  el.addEventListener('submit', async ev => {
    ev.preventDefault();
    msg.hidden = true;
    if (!carrier.value.trim() || !tracking.value.trim()) {
      msg.textContent = 'Add the carrier and the tracking number.';
      msg.hidden = false;
      return;
    }
    save.setAttribute('disabled', '');
    try {
      await runOrderAction(o, 'ship', {carrier: carrier.value.trim(), tracking: tracking.value.trim()});
      toast('Shipped. The buyer has the tracking number.');
      await redraw();
    } catch (e) {
      save.removeAttribute('disabled');
      fail(e, msg, redraw);
    }
  });
  return {el, open: () => ((el.hidden = false), carrier.focus())};
}

function fail(e: unknown, msg: HTMLElement, redraw: () => Promise<void>) {
  if (isConflict(e)) {
    void redraw().then(() => toast('This order changed. Here is the latest.'));
    return;
  }
  msg.textContent = plainError(e, "That didn't work. Check your connection and try again.");
  msg.hidden = false;
}

function button(o: Order, b: OrderButton, msg: HTMLElement, redraw: () => Promise<void>, ship: {open: () => void}) {
  const btn = h(
    'button',
    {
      class: b.primary ? 'primary big' : 'big',
      type: 'button',
      onclick: async () => {
        msg.hidden = true;
        if (b.action === 'ship') return ship.open();
        if (b.confirm && !(await confirmDialog(b.confirm, b.label))) return;
        btn.setAttribute('disabled', '');
        try {
          await runOrderAction(o, b.action);
          toast(
            b.action === 'mark-paid'
              ? 'Marked paid. The piece is sold.'
              : b.action === 'extend'
                ? 'More time given.'
                : 'Order cancelled.',
          );
          await redraw();
        } catch (e) {
          btn.removeAttribute('disabled');
          fail(e, msg, redraw);
        }
      },
    },
    b.label,
  );
  return btn;
}
