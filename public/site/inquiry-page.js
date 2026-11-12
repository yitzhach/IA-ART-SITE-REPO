// /inquiry: the list like a cart (picture, title, size, price or "price on request", Remove, a note) and what to do with
// it: Email the studio (the contact sheet's form), Text / Call (the contact sheet), Download a one-page sheet as PDF
// (the browser's print), PNG or JPEG (drawn on a canvas; the pictures are same-origin, so it is never tainted).
(function () {
  var root = document.getElementById('inq');
  var Inq = window.StudioInquiry;
  if (!root || !Inq) return;
  var ds = document.body.dataset;
  var API = '/v1/public/studios/' + encodeURIComponent(ds.slug || '');
  var byslug = {};
  var loaded = false;
  var phone = ds.pa ? ds.pa.split('').reverse().join('') + (ds.pb || '').split('').reverse().join('') : '';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  var num = function (n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); };
  function sizeText(w) {
    if (!w || !(w.height > 0) || !(w.width > 0)) return '';
    var d = [w.height, w.width];
    if (w.depth > 0) d.push(w.depth);
    return d.map(num).join(' × ') + ' ' + w.sizeUnit;
  }
  function priceText(w) {
    if (!w) return '';
    if (w.status === 'sold') return 'Sold';
    if (w.status === 'reserved') return 'Reserved';
    if (w.status !== 'available') return '';
    if (w.priceCents === null || w.priceCents === undefined || !w.currency) return 'Price on request';
    try {
      return new Intl.NumberFormat('en-US', {style: 'currency', currency: w.currency, maximumFractionDigits: w.priceCents % 100 ? 2 : 0}).format(w.priceCents / 100);
    } catch (e) {
      return 'Price on request';
    }
  }
  var rows = function () {
    return Inq.list().map(function (w) {
      var d = byslug[w.slug] || null;
      return {title: (d && d.title) || w.title, url: w.url, slug: w.slug, image: d && d.image, size: sizeText(d), price: d ? priceText(d) : '', listed: !loaded || !!d};
    });
  };

  function link(text, kind, href, cls) {
    var a = el('a', cls || 'btn alt', text);
    a.href = href;
    a.setAttribute('data-contact', kind);
    a.setAttribute('data-about', 'list');
    return a;
  }
  function button(text, cls, fn) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function draw() {
    var list = rows();
    root.textContent = '';
    if (!list.length) {
      var p = el('p', 'empty', 'Nothing added yet. On a piece, tap “Add to inquiry”, or add pieces from the assistant’s answers.');
      root.appendChild(p);
      var a = el('a', 'btn', 'See the works');
      a.href = '/works';
      var bt = el('p', 'btns');
      bt.appendChild(a);
      root.appendChild(bt);
      return;
    }
    var ul = el('ul', 'inq-list');
    list.forEach(function (r) {
      var li = el('li', 'inq-item');
      if (r.image) {
        var img = el('img');
        img.src = r.image;
        img.alt = r.title;
        img.width = 84;
        img.height = 105;
        img.loading = 'lazy';
        li.appendChild(img);
      } else li.appendChild(el('div', 'blank'));
      var info = el('div');
      var t = el('a', 'ttl', r.title);
      t.href = '/works/' + r.slug;
      info.appendChild(t);
      if (r.size) info.appendChild(el('span', 'sz', r.size));
      var pr = r.listed ? r.price : 'No longer listed';
      if (pr) info.appendChild(el('span', 'sz', pr));
      var rm = el('button', null, 'Remove');
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Remove ' + r.title);
      rm.addEventListener('click', function () { Inq.remove(r); });
      info.appendChild(rm);
      li.appendChild(info);
      ul.appendChild(li);
    });
    root.appendChild(ul);

    var label = el('label', 'field');
    label.appendChild(el('span', null, 'Note for the studio (optional)'));
    var note = el('textarea');
    note.rows = 3;
    note.maxLength = 3000;
    note.value = Inq.note();
    note.addEventListener('input', function () { Inq.note(note.value); });
    label.appendChild(note);
    root.appendChild(label);

    var send = el('p', 'btns');
    send.appendChild(link('Email', 'email', ds.email ? 'mailto:' + ds.email : '/contact', 'btn'));
    if (phone) {
      send.appendChild(link('Text', 'sms', '/contact'));
      send.appendChild(link('Call', 'tel', '/contact'));
    }
    root.appendChild(send);
    root.appendChild(el('h2', null, 'Download'));
    root.appendChild(el('p', 'sz', 'A one-page sheet of this list to send to the studio or to a client.'));
    var dl = el('p', 'btns');
    dl.appendChild(button('PDF', 'btn alt', printSheet));
    dl.appendChild(button('PNG', 'btn alt', function () { picture('image/png', 'png'); }));
    dl.appendChild(button('JPEG', 'btn alt', function () { picture('image/jpeg', 'jpg'); }));
    root.appendChild(dl);
  }

  // ---- PDF: a print-only copy of the list; the print stylesheet hides everything else.
  function printSheet() {
    var old = document.querySelector('.print-sheet');
    if (old) old.remove();
    var s = el('section', 'print-sheet');
    s.appendChild(el('h1', null, ds.name + ': inquiry'));
    var ul = el('ul');
    rows().forEach(function (r) {
      var li = el('li');
      if (r.image) {
        var img = el('img');
        img.src = r.image;
        img.alt = '';
        li.appendChild(img);
      }
      li.appendChild(el('p', 't', r.title));
      if (r.size) li.appendChild(el('p', null, r.size));
      li.appendChild(el('p', null, r.listed ? r.price || 'Price on request' : 'Price on request'));
      ul.appendChild(li);
    });
    s.appendChild(ul);
    var n = Inq.note();
    if (n) s.appendChild(el('p', null, n));
    s.appendChild(el('p', null, [ds.name, ds.email, phone].filter(Boolean).join(' · ')));
    document.body.appendChild(s);
    document.body.classList.add('printing');
    var done = function () {
      document.body.classList.remove('printing');
      s.remove();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(function () { window.print(); }, 50);
  }

  // ---- PNG / JPEG: the same sheet drawn on a canvas (A4 at 150 dpi) and saved with <a download>.
  function loadImage(src) {
    return new Promise(function (ok) {
      if (!src) return ok(null);
      var i = new Image();
      i.onload = function () { ok(i); };
      i.onerror = function () { ok(null); };
      i.src = src;
    });
  }
  function wrap(ctx, text, max) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function picture(type, ext) {
    var list = rows();
    Promise.all(list.map(function (r) { return loadImage(r.image); })).then(function (imgs) {
      var W = 1240, H = 1754, M = 70;
      var c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, W, H);
      x.fillStyle = '#1a1814';
      x.textBaseline = 'top';
      x.font = '700 46px "Bodoni Moda", Georgia, serif';
      x.fillText(ds.name.toUpperCase(), M, M);
      x.font = '400 24px Archivo, system-ui, sans-serif';
      x.fillStyle = '#5c564c';
      x.fillText('Inquiry · ' + list.length + (list.length === 1 ? ' work' : ' works'), M, M + 62);
      var top = M + 120, bottom = H - 190;
      var cols = list.length <= 2 ? 2 : list.length <= 6 ? 3 : list.length <= 12 ? 4 : 5;
      var rowsN = Math.ceil(list.length / cols);
      var gap = 28, cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = (bottom - top - gap * (rowsN - 1)) / rowsN;
      var textH = 96, fs = cw > 300 ? 24 : 18;
      list.forEach(function (r, i) {
        var cx = M + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (ch + gap);
        var ih = ch - textH, im = imgs[i];
        x.fillStyle = '#edeae3';
        x.fillRect(cx, cy, cw, ih);
        if (im) {
          var k = Math.min(cw / im.naturalWidth, ih / im.naturalHeight);
          var w = im.naturalWidth * k, h = im.naturalHeight * k;
          x.drawImage(im, cx + (cw - w) / 2, cy + (ih - h) / 2, w, h);
        }
        x.fillStyle = '#1a1814';
        x.font = '700 ' + fs + 'px Archivo, system-ui, sans-serif';
        var ty = cy + ih + 8;
        wrap(x, r.title, cw).slice(0, 2).forEach(function (l) { x.fillText(l, cx, ty); ty += fs + 4; });
        x.font = '400 ' + (fs - 2) + 'px Archivo, system-ui, sans-serif';
        x.fillStyle = '#5c564c';
        var detail = [r.size, r.listed ? r.price || 'Price on request' : 'Price on request'].filter(Boolean).join('  ·  ');
        x.fillText(detail, cx, ty);
      });
      x.strokeStyle = '#d6cfc2';
      x.beginPath();
      x.moveTo(M, H - 150);
      x.lineTo(W - M, H - 150);
      x.stroke();
      x.fillStyle = '#1a1814';
      x.font = '400 26px Archivo, system-ui, sans-serif';
      x.fillText([ds.name, ds.email, phone].filter(Boolean).join('   ·   '), M, H - 120);
      var n = Inq.note();
      if (n) {
        x.fillStyle = '#5c564c';
        x.font = '400 20px Archivo, system-ui, sans-serif';
        x.fillText(n.replace(/\s+/g, ' ').slice(0, 110), M, H - 76);
      }
      c.toBlob(function (blob) {
        if (!blob) return;
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'inquiry.' + ext;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      }, type, 0.92);
    });
  }

  draw();
  Inq.onChange(draw);
  fetch(API + '/digest')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) return;
      loaded = true;
      d.works.forEach(function (w) { byslug[w.slug] = w; });
      draw();
    })
    .catch(function () {});
})();
