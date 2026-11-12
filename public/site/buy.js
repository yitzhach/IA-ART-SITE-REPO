// Buying (stage 4, D-144). Three places, each only where its element is:
//  - a piece page: the Buy button shows when the studio's checkout is on and the piece is small enough;
//  - /buy/{slug}: the form (card goes on to Square's own page; Venmo / Zelle sets the piece aside and says how to pay);
//  - /thanks/{id}: the buyer's own order, read with the visitor cookie (waits for Square's confirmation when needed).
(function () {
  var ds = document.body.dataset;
  var API = '/v1/public/studios/' + encodeURIComponent(ds.slug || '');
  var LABEL = {card: 'Card', venmo: 'Venmo', zelle: 'Zelle'};

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'on')
        Object.keys(v).forEach(function (n) {
          e.addEventListener(n, v[n]);
        });
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    });
    (kids || []).forEach(function (c) {
      if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function money(cents, currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: cents % 100 ? 2 : 0,
      }).format(cents / 100);
    } catch (e) {
      return '$' + (cents / 100).toFixed(2);
    }
  }
  function json(path, opts) {
    return fetch(
      API + path,
      Object.assign(
        {credentials: 'same-origin', headers: {accept: 'application/json', 'content-type': 'application/json'}},
        opts || {},
      ),
    ).then(function (r) {
      return r.text().then(function (t) {
        var d = null;
        try {
          d = t ? JSON.parse(t) : null;
        } catch (e) {
          d = null;
        }
        if (!r.ok)
          throw {
            status: r.status,
            message: (d && d.error && d.error.message) || 'Something went wrong. Please try again.',
          };
        return d;
      });
    });
  }
  var checkout = function () {
    return json('/checkout');
  };
  var fits = function (c, inches) {
    return c && c.enabled && c.methods.length > 0 && Number(inches) <= c.smallMaxInches;
  };

  // ---------------------------------------------------------------- the piece page's Buy button
  var buyLink = document.querySelector('[data-buy]');
  if (buyLink)
    checkout().then(
      function (c) {
        if (fits(c, buyLink.getAttribute('data-inches'))) buyLink.hidden = false;
      },
      function () {},
    );

  // ---------------------------------------------------------------- /buy/{slug}
  var box = document.getElementById('buy');
  if (box)
    checkout().then(
      function (c) {
        drawForm(box, c);
      },
      function () {
        noCheckout(box);
      },
    );

  function noCheckout(root) {
    root.hidden = false;
    root.replaceChildren(
      el('p', {class: 'empty', text: "Buying here isn't open right now. You can still reach the studio:"}),
    );
    var contact = document.querySelector('.buy-contact');
    if (contact) contact.hidden = false;
  }

  function drawForm(root, c) {
    if (!fits(c, root.dataset.inches)) return noCheckout(root);
    var price = Number(root.dataset.price),
      cur = root.dataset.currency;
    var tax = Math.round((price * c.taxBps) / 10000);
    var total = price + c.shippingCents + tax;
    var rows = [
      ['Piece', money(price, cur)],
      ['Shipping (US)', c.shippingCents ? money(c.shippingCents, cur) : 'Free'],
    ];
    if (tax) rows.push(['Sales tax', money(tax, cur)]);
    rows.push(['Total', money(total, cur)]);
    var f = {};
    function field(label, name, type, attrs) {
      var input = el('input', Object.assign({name: name, id: 'b-' + name, type: type}, attrs || {}));
      f[name] = input;
      return el('label', {class: 'field', for: 'b-' + name}, [el('span', {text: label}), input]);
    }
    var methods = el('fieldset', {class: 'buy-methods'}, [el('legend', {text: 'Pay with'})]);
    c.methods.forEach(function (m, i) {
      var r = el('input', {type: 'radio', name: 'method', value: m, id: 'b-m-' + m, checked: i === 0});
      methods.appendChild(el('label', {class: 'buy-method', for: 'b-m-' + m}, [r, ' ' + LABEL[m]]));
    });
    var manual = el('div', {class: 'buy-manual'}, [
      el('p', {
        class: 'sheet-small',
        text:
          'The piece is set aside for you for ' +
          c.manualHoldHours +
          ' hours while you pay. You get an email with how to pay.',
      }),
      field('Your name', 'name', 'text', {autocomplete: 'name', maxlength: '120', required: true}),
      field('Email', 'email', 'email', {autocomplete: 'email', maxlength: '200', required: true}),
      field('Phone (optional)', 'phone', 'tel', {autocomplete: 'tel', maxlength: '24'}),
      field('Street address', 'line1', 'text', {autocomplete: 'address-line1', maxlength: '200', required: true}),
      field('Apartment, suite (optional)', 'line2', 'text', {autocomplete: 'address-line2', maxlength: '200'}),
      field('City', 'city', 'text', {autocomplete: 'address-level2', maxlength: '100', required: true}),
      field('State', 'state', 'text', {autocomplete: 'address-level1', maxlength: '50', required: true}),
      field('ZIP code', 'postalCode', 'text', {
        autocomplete: 'postal-code',
        inputmode: 'numeric',
        maxlength: '10',
        required: true,
      }),
    ]);
    var cardNote = el('p', {
      class: 'sheet-small',
      text: "Square's secure page takes your card and your shipping address. The piece is set aside for 30 minutes while you pay.",
    });
    var trap = el('label', {class: 'hp', 'aria-hidden': 'true'}, [
      'Website ',
      el('input', {name: 'website', tabindex: '-1', autocomplete: 'off'}),
    ]);
    var err = el('p', {class: 'err', role: 'alert', hidden: true});
    var go = el('button', {class: 'btn', type: 'submit', text: 'Continue'});
    var form = el('form', {class: 'buy-form', novalidate: true}, [
      el(
        'dl',
        {class: 'facts buy-total'},
        [].concat.apply(
          [],
          rows.map(function (r) {
            return [el('dt', {text: r[0]}), el('dd', {text: r[1]})];
          }),
        ),
      ),
      methods,
      cardNote,
      manual,
      trap,
      c.returns ? el('p', {class: 'sheet-small', text: 'Returns: ' + c.returns}) : null,
      err,
      el('p', {class: 'btns'}, [go]),
    ]);
    var method = function () {
      var r = form.querySelector('input[name=method]:checked');
      return r ? r.value : c.methods[0];
    };
    function sync() {
      var isCard = method() === 'card';
      manual.hidden = isCard;
      cardNote.hidden = !isCard;
      go.textContent = isCard ? 'Continue to card payment' : 'Set it aside and email me how to pay';
    }
    methods.addEventListener('change', sync);
    sync();
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.hidden = true;
      var m = method();
      var body = {work: root.dataset.piece, method: m};
      var trapValue = form.querySelector('input[name=website]').value;
      if (trapValue) body.website = trapValue;
      if (m !== 'card') {
        var v = function (n) {
          return f[n].value.trim();
        };
        var missing = ['name', 'email', 'line1', 'city', 'state', 'postalCode'].filter(function (n) {
          return !v(n);
        });
        if (missing.length) {
          err.textContent = 'Please fill in your name, email and shipping address.';
          err.hidden = false;
          f[missing[0]].focus();
          return;
        }
        body.name = v('name');
        body.email = v('email');
        if (v('phone')) body.phone = v('phone');
        body.address = {line1: v('line1'), city: v('city'), state: v('state'), postalCode: v('postalCode')};
        if (v('line2')) body.address.line2 = v('line2');
      }
      go.disabled = true;
      go.textContent = 'One moment…';
      json('/visitor/orders', {method: 'POST', body: JSON.stringify(body)}).then(
        function (o) {
          if (o.method === 'card' && o.checkoutUrl) location.assign(o.checkoutUrl);
          else location.assign('/thanks/' + o.id);
        },
        function (e) {
          go.disabled = false;
          sync();
          err.textContent = e.message;
          err.hidden = false;
        },
      );
    });
    root.replaceChildren(form);
    root.hidden = false;
  }

  // ---------------------------------------------------------------- /thanks/{id}
  var thanks = document.getElementById('thanks');
  if (thanks) {
    var tries = 0;
    var look = function () {
      json('/visitor/orders/' + encodeURIComponent(thanks.dataset.order)).then(
        function (o) {
          drawOrder(thanks, o);
          if (o.status === 'pending' && ++tries < 40) setTimeout(look, 3000);
        },
        function (e) {
          thanks.hidden = false;
          thanks.replaceChildren(
            el('p', {
              class: 'empty',
              text:
                e.status === 404
                  ? "This order isn't in this browser. The studio has your email if you paid."
                  : e.message,
            }),
          );
        },
      );
    };
    look();
  }

  function drawOrder(root, o) {
    var total = money(o.totalCents, o.currency);
    var kids = [el('p', {class: 'note-line', text: 'Order ' + o.code})];
    var piece = o.slug ? el('a', {href: '/works/' + o.slug, text: o.title}) : document.createTextNode(o.title);
    if (o.status === 'paid' || o.status === 'refunded') {
      kids.push(el('p', {class: 'lede'}, ['Thank you. ', piece, o.shippedAt ? ' is on its way.' : ' is yours.']));
      kids.push(
        el('p', {
          text: o.shippedAt
            ? 'The tracking number is in your email.'
            : 'Your payment of ' + total + ' arrived. The studio will email you when it ships.',
        }),
      );
    } else if (o.status === 'pending') {
      kids.push(el('p', {class: 'lede', text: 'Waiting for Square to confirm your payment…'}));
      kids.push(
        el('p', {
          class: 'sheet-small',
          text:
            tries >= 39
              ? "It's taking a while. If you paid, you'll get an email from the studio."
              : 'This page updates by itself.',
        }),
      );
      if (o.checkoutUrl)
        kids.push(el('p', {}, [el('a', {class: 'btn alt', href: o.checkoutUrl, text: 'Back to the payment page'})]));
    } else if (o.status === 'awaiting_payment') {
      var to =
        o.method === 'venmo' ? 'Venmo to ' + (o.payTo && o.payTo.venmo) : 'Zelle to ' + (o.payTo && o.payTo.zelle);
      var by = o.expiresAt
        ? new Date(o.expiresAt).toLocaleString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '';
      kids.push(el('p', {class: 'lede'}, [piece, ' is set aside for you' + (by ? ' until ' + by : '') + '.']));
      kids.push(el('p', {class: 'the-number', text: total}));
      kids.push(
        el('p', {
          text:
            'Send it by ' +
            to +
            ', with ' +
            o.code +
            ' in the note. The same steps are in your email. The studio confirms when it arrives.',
        }),
      );
    } else {
      kids.push(el('p', {class: 'lede'}, ['This order ended without a payment. ', piece, ' may still be available.']));
    }
    if (o.returns && o.status !== 'expired' && o.status !== 'cancelled')
      kids.push(el('p', {class: 'sheet-small', text: 'Returns: ' + o.returns}));
    root.replaceChildren.apply(root, kids);
    root.hidden = false;
  }
})();
