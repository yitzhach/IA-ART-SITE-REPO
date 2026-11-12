// Buying (stage 4, D-144…D-154). Four places, each only where its element is:
//  - a piece page: "Add to cart" shows when the studio's checkout is on (the server decides which pieces can be bought);
//  - /buy/{slug}: the old one-piece address puts the piece in the cart and goes on to /cart;
//  - /cart: each piece, shipping from the studio's calculator (never worked out here), the offer, then the order form;
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
  var open = function (c) {
    return c && c.enabled && c.methods.length > 0;
  };

  // ---------------------------------------------------------------- the cart: slugs and a ZIP, in this browser only
  var KEY = 'studio-cart:' + (ds.slug || '');
  var memory = {works: [], zip: ''};
  function loadCart() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && Array.isArray(v.works))
        return {
          works: v.works
            .filter(function (x) {
              return typeof x === 'string' && /^[a-z0-9-]{1,120}$/.test(x);
            })
            .slice(0, 10),
          zip: typeof v.zip === 'string' ? v.zip : '',
        };
    } catch (e) {}
    return memory;
  }
  function saveCart(cart) {
    memory = cart;
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch (e) {}
  }
  function addToCart(slug) {
    var cart = loadCart();
    if (cart.works.indexOf(slug) < 0 && cart.works.length < 10) cart.works.push(slug);
    saveCart(cart);
  }
  function removeFromCart(slug) {
    var cart = loadCart();
    cart.works = cart.works.filter(function (x) {
      return x !== slug;
    });
    saveCart(cart);
  }

  // ---------------------------------------------------------------- the piece page's Add to cart
  var buyLink = document.querySelector('[data-buy]');
  if (buyLink)
    checkout().then(
      function (c) {
        if (!open(c)) return;
        var slug = buyLink.getAttribute('data-piece');
        if (loadCart().works.indexOf(slug) >= 0) {
          buyLink.textContent = 'In your cart: view it';
          buyLink.setAttribute('href', '/cart');
        } else
          buyLink.addEventListener('click', function (ev) {
            ev.preventDefault();
            addToCart(slug);
            location.assign('/cart');
          });
        buyLink.hidden = false;
      },
      function () {},
    );

  // ---------------------------------------------------------------- /buy/{slug}: into the cart
  var box = document.getElementById('buy');
  if (box)
    checkout().then(
      function (c) {
        if (!open(c)) return noCheckout(box);
        addToCart(box.dataset.piece);
        location.replace('/cart');
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

  // ---------------------------------------------------------------- /cart
  var cartBox = document.getElementById('cart');
  if (cartBox)
    checkout().then(
      function (c) {
        if (!open(c)) return noCheckout(cartBox);
        drawCart(cartBox, c, null);
      },
      function () {
        noCheckout(cartBox);
      },
    );

  var pieces = {}; // slug → the public piece (title, price, picture), read once
  function piece(slug) {
    if (pieces[slug]) return Promise.resolve(pieces[slug]);
    return json('/artworks/' + encodeURIComponent(slug)).then(
      function (w) {
        return (pieces[slug] = w);
      },
      function () {
        return (pieces[slug] = {slug: slug, title: 'A piece that is no longer on the site', images: [], gone: true});
      },
    );
  }
  function thumb(w) {
    var img = w.images && w.images[0];
    var size =
      img &&
      (img.sizes.filter(function (z) {
        return z.width === 480;
      })[0] ||
        img.sizes[0]);
    return size ? el('img', {src: size.url, alt: img.altText || w.title, width: 96, loading: 'lazy'}) : null;
  }

  function drawCart(root, c, notice) {
    var cart = loadCart();
    root.hidden = false;
    if (!cart.works.length) {
      root.replaceChildren(
        el('p', {class: 'empty', text: 'Your cart is empty.'}),
        el('p', {class: 'btns'}, [el('a', {class: 'btn', href: '/works', text: 'See the works'})]),
      );
      return;
    }
    var body = {works: cart.works};
    if (/^\d{5}$/.test(cart.zip)) body.zip = cart.zip;
    Promise.all([
      Promise.all(cart.works.map(piece)),
      json('/shipping/quote', {method: 'POST', body: JSON.stringify(body)}),
    ]).then(
      function (got) {
        renderCart(root, c, cart, got[1], notice);
      },
      function (e) {
        root.replaceChildren(el('p', {class: 'err', role: 'alert', text: e.message}));
      },
    );
  }

  function renderCart(root, c, cart, q, notice) {
    var cur = 'USD';
    var lineOf = {};
    q.lines.forEach(function (l) {
      lineOf[l.slug] = l;
    });
    var why = {};
    q.blocked.forEach(function (b) {
      why[b.slug] = b.why;
    });
    q.quote.forEach(function (s) {
      why[s] = 'Ships by quote. Ask and the artist will reply with shipping.';
    });
    var list = el(
      'ul',
      {class: 'cart-list'},
      cart.works.map(function (slug) {
        var w = pieces[slug] || {slug: slug, title: slug, images: []};
        var l = lineOf[slug];
        var ship = !l
          ? null
          : l.chargedCents === 0
            ? l.baseCents && l.coveredCents
              ? 'Shipping: free with your cart (' + money(l.baseCents, cur) + ' off)'
              : 'Shipping: free'
            : 'Shipping: ' +
              money(l.chargedCents, cur) +
              (l.estimate ? ' (estimate to your ZIP)' : '') +
              (l.coveredCents ? ', ' + money(l.coveredCents, cur) + ' off' : '');
        var remove = el('button', {
          class: 'btn alt sm',
          type: 'button',
          text: 'Remove',
          on: {
            click: function () {
              removeFromCart(slug);
              drawCart(root, c, null);
            },
          },
        });
        return el('li', {class: 'cart-item'}, [
          w.gone ? null : el('a', {href: '/works/' + slug}, [thumb(w)]),
          el('div', {}, [
            w.gone ? el('strong', {text: w.title}) : el('a', {href: '/works/' + slug}, [el('strong', {text: w.title})]),
            w.priceCents ? el('br') : null,
            w.priceCents ? money(w.priceCents, cur) : null,
            ship ? el('br') : null,
            ship,
            why[slug] ? el('p', {class: 'err', text: why[slug]}) : null,
            remove,
          ]),
        ]);
      }),
    );

    var zip = el('input', {
      name: 'zip',
      id: 'c-zip',
      inputmode: 'numeric',
      autocomplete: 'postal-code',
      maxlength: '5',
      value: cart.zip || '',
    });
    var zipForm = el('form', {class: 'cart-zip', novalidate: true}, [
      el('label', {class: 'field', for: 'c-zip'}, [
        el('span', {text: 'Your ZIP code, for the shipping estimate'}),
        zip,
      ]),
      el('p', {class: 'btns'}, [el('button', {class: 'btn alt', type: 'submit', text: 'Work out shipping'})]),
    ]);
    zipForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = zip.value.trim();
      if (!/^\d{5}$/.test(v)) {
        zip.focus();
        return;
      }
      var k = loadCart();
      k.zip = v;
      saveCart(k);
      drawCart(root, c, null);
    });
    var large = q.lines.some(function (l) {
      return l.estimate;
    });

    var kids = [list];
    if (notice) kids.unshift(el('p', {class: 'err', role: 'alert', text: notice}));
    if (q.needsZip || large) kids.push(zipForm);
    if (q.nudge && q.nudge.kind !== 'quote') kids.push(el('p', {class: 'note-line', text: q.nudge.text}));
    if (q.suggestions.length)
      kids.push(
        el(
          'ul',
          {class: 'cart-list cart-suggest'},
          q.suggestions.map(function (s) {
            return el('li', {class: 'cart-item'}, [
              s.image
                ? el('a', {href: '/works/' + s.slug}, [el('img', {src: s.image, alt: s.title, width: 96})])
                : null,
              el('div', {}, [
                el('a', {href: '/works/' + s.slug}, [el('strong', {text: s.title})]),
                el('br'),
                money(s.priceCents, cur),
                el('button', {
                  class: 'btn alt sm',
                  type: 'button',
                  text: 'Add to cart',
                  on: {
                    click: function () {
                      addToCart(s.slug);
                      drawCart(root, c, null);
                    },
                  },
                }),
              ]),
            ]);
          }),
        ),
      );

    if (!q.ok) {
      if (!q.needsZip)
        kids.push(
          el('p', {
            class: 'empty',
            text: 'Remove the pieces marked above to check out, or ask the artist about them.',
          }),
        );
      kids.push(el('p', {class: 'btns'}, [el('a', {class: 'btn alt', href: '/works', text: 'Keep looking'})]));
      var contact = document.querySelector('.buy-contact');
      if (contact && !q.needsZip) contact.hidden = false;
      root.replaceChildren.apply(root, kids);
      return;
    }

    var tax = Math.round((q.subtotalCents * c.taxBps) / 10000);
    var rows = [
      [cart.works.length > 1 ? 'Pieces' : 'Piece', money(q.subtotalCents, cur)],
      ['Shipping (US)', q.shippingCents ? money(q.shippingCents, cur) : 'Free'],
    ];
    if (q.coveredCents) rows.push(['Shipping covered', '−' + money(q.coveredCents, cur)]);
    if (tax) rows.push(['Sales tax', money(tax, cur)]);
    rows.push(['Total', money(q.totalCents + tax, cur)]);
    kids.push(
      orderForm(c, cart, q, rows, function (msg) {
        drawCart(root, c, msg);
      }),
    );
    kids.push(el('p', {class: 'btns'}, [el('a', {class: 'btn alt', href: '/works', text: 'Keep looking'})]));
    root.replaceChildren.apply(root, kids);
  }

  function orderForm(c, cart, q, rows, again) {
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
          'The pieces are set aside for you for ' +
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
        value: cart.zip || null,
      }),
    ]);
    var cardNote = el('p', {
      class: 'sheet-small',
      text: "Square's secure page takes your card and your shipping address. The pieces are set aside for 30 minutes while you pay.",
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
      go.textContent = isCard ? 'Continue to card payment' : 'Set them aside and email me how to pay';
    }
    methods.addEventListener('change', sync);
    sync();
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.hidden = true;
      var m = method();
      // The shipping the visitor saw goes back: if it changed, the studio says so and nothing is set aside (D-151).
      var body = {works: cart.works, method: m, shippingCents: q.shippingCents};
      if (/^\d{5}$/.test(cart.zip)) body.zip = cart.zip;
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
          saveCart({works: [], zip: cart.zip});
          if (o.method === 'card' && o.checkoutUrl) location.assign(o.checkoutUrl);
          else location.assign('/thanks/' + o.id);
        },
        function (e) {
          if (e.status === 409) return again(e.message);
          go.disabled = false;
          sync();
          err.textContent = e.message;
          err.hidden = false;
        },
      );
    });
    return form;
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
