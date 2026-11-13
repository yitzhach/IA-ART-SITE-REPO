// The Ask / contact sheet (loaded on a tap by site.js). One bottom sheet over the page, three jobs:
//  - chat with the studio's assistant (answers, cards, "open these as a page", keep the chat, hold a piece),
//  - the contact sheet: Text / Call show the number after a tap, Email is a form that sends the studio a lead,
//  - plain search of the catalogue when the chat is off or capped.
// Everything from the server is put on the page with textContent / setAttribute, never as HTML.
(function () {
  if (window.StudioSheet) return;
  var body = document.body;
  var ds = body.dataset;
  var API = '/v1/public/studios/' + encodeURIComponent(ds.slug || '');
  var Inq = window.StudioInquiry || {list: function () { return []; }, has: function () { return false; }, add: function () {}, remove: function () {}, onChange: function () {}, note: function () { return ''; }};
  var MAX_FILES = 5;
  var MAX_BYTES = 8 * 1024 * 1024;

  // ---------------------------------------------------------------- small helpers
  function el(tag, o, kids) {
    var e = document.createElement(tag);
    for (var k in o || {}) {
      var v = o[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'on') for (var ev in v) e.addEventListener(ev, v[ev]);
      else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) {
      if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function btn(text, cls, on) {
    return el('button', {type: 'button', class: cls || 'btn alt', text: text, on: {click: on}});
  }
  function request(path, opts) {
    return fetch(path, opts).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error((j.error && j.error.message) || 'Something went wrong. Please try again.');
          e.status = r.status;
          e.code = j.error && j.error.code;
          throw e;
        }
        return j;
      });
    });
  }
  var rev = function (t) { return t.split('').reverse().join(''); };
  var phone = function () { return ds.pa ? rev(ds.pa) + rev(ds.pb || '') : ''; };
  var num = function (n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); };
  function sizeText(w) {
    if (!(w.height > 0) || !(w.width > 0)) return '';
    var d = [w.height, w.width];
    if (w.depth > 0) d.push(w.depth);
    return d.map(num).join(' × ') + ' ' + w.sizeUnit;
  }
  function priceText(w) {
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
  function search(works, q) {
    var words = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!words.length) return [];
    return works.filter(function (w) {
      var hay = [w.title, w.collection, w.medium].concat(w.tags || []).filter(Boolean).join(' ').toLowerCase();
      return words.every(function (x) { return hay.indexOf(x) >= 0; });
    });
  }
  var itemOf = function (w) { return {title: w.title, slug: w.slug, url: location.origin + '/works/' + w.slug}; };

  // ---------------------------------------------------------------- data (asked once)
  var cache = {};
  function once(name, fn) {
    if (!cache[name]) cache[name] = fn().catch(function (e) { cache[name] = null; throw e; });
    return cache[name];
  }
  var getAssistant = function () { return once('assistant', function () { return request(API + '/assistant'); }); };
  var getDigest = function () { return once('digest', function () { return request(API + '/digest'); }); };
  var known = {}; // slug → DigestWork for every card seen
  function remember(works) { (works || []).forEach(function (w) { known[w.slug] = w; }); }

  // ---------------------------------------------------------------- the sheet frame
  var root, panel, titleEl, main, foot, opener, inerted = [], cssReady;
  function ensureCss() {
    if (!cssReady)
      cssReady = new Promise(function (ok) {
        if (document.querySelector('link[href="/site/ask.css"]')) return ok();
        var l = el('link', {rel: 'stylesheet', href: '/site/ask.css'});
        l.onload = l.onerror = function () { ok(); };
        document.head.appendChild(l);
      });
    return cssReady;
  }
  function focusables() {
    return [].filter.call(panel.querySelectorAll('a[href],button,input,textarea,select,[tabindex]'), function (e) {
      return !e.disabled && e.tabIndex >= 0 && !e.closest('[hidden]') && !e.classList.contains('hp');
    });
  }
  function onKey(e) {
    if (!root) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function frame(from) {
    if (root) return;
    opener = from;
    titleEl = el('h2', {id: 'sheet-h'});
    main = el('div', {class: 'sheet-main'});
    foot = el('div', {class: 'sheet-foot'});
    panel = el('div', {class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-h'}, [
      el('div', {class: 'sheet-hdr'}, [titleEl, el('button', {type: 'button', class: 'sheet-x', 'aria-label': 'Close', text: '×', on: {click: close}})]),
      main,
      foot,
    ]);
    root = el('div', {class: 'sheet-back'}, [panel]);
    root.addEventListener('mousedown', function (e) { if (e.target === root) close(); });
    [].forEach.call(body.children, function (c) {
      if (c.tagName !== 'SCRIPT' && !c.hasAttribute('inert')) { c.setAttribute('inert', ''); inerted.push(c); }
    });
    body.appendChild(root);
    document.documentElement.classList.add('sheet-open');
    document.addEventListener('keydown', onKey, true);
  }
  function close() {
    if (!root) return;
    stopSpeaking();
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    root = null;
    inerted.forEach(function (c) { c.removeAttribute('inert'); });
    inerted = [];
    document.documentElement.classList.remove('sheet-open');
    if (opener && opener.focus && document.contains(opener)) opener.focus();
  }
  var nav = 0;
  function view(title, focusSel) {
    nav++;
    stopSpeaking();
    titleEl.textContent = title;
    main.textContent = '';
    foot.textContent = '';
    main.scrollTop = 0;
    return function focus() {
      var t = focusSel && panel.querySelector(focusSel);
      (t || panel.querySelector('.sheet-x')).focus();
    };
  }

  // ---------------------------------------------------------------- cards
  function cardList(works, onAdd) {
    var ul = el('ul', {class: 'acards'});
    works.forEach(function (w) {
      var item = itemOf(w);
      var add = el('button', {type: 'button', class: 'add', 'data-add': w.slug, text: 'Add to inquiry'});
      add.addEventListener('click', function () {
        if (Inq.has(item)) Inq.remove(item);
        else Inq.add(item);
      });
      var size = sizeText(w);
      var price = priceText(w);
      ul.appendChild(el('li', {class: 'acard'}, [
        el('a', {href: '/works/' + w.slug}, [
          w.image ? el('img', {src: w.image, alt: w.title, width: '480', height: '600', loading: 'lazy'}) : el('div', {class: 'blank'}),
          el('span', {class: 'ttl', text: w.title}),
          size ? el('span', {class: 'sz', text: size}) : null,
          price ? el('span', {class: 'pr', text: price}) : null,
        ]),
        add,
      ]));
    });
    return ul;
  }
  function refreshAdds() {
    [].forEach.call(document.querySelectorAll('[data-add]'), function (b) {
      var on = Inq.has({slug: b.getAttribute('data-add'), url: location.origin + '/works/' + b.getAttribute('data-add')});
      b.textContent = on ? 'In your inquiry ✓' : 'Add to inquiry';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  Inq.onChange(refreshAdds);

  // ---------------------------------------------------------------- contact: Text / Call / Email, and the lead form
  function about(works) {
    var n = ds.name;
    if (!works.length) return {text: 'Hello ' + n + ', ', subject: 'Hello from your site'};
    if (works.length === 1) return {text: 'Hello ' + n + ", I'm interested in " + works[0].title + '.\n' + works[0].url, subject: 'About ' + works[0].title};
    var lines = works.map(function (w) { return w.title + '\n' + w.url; });
    return {text: ['Hello ' + n + ", I'm interested in " + works.length + ' works.'].concat(lines).join('\n'), subject: 'About ' + works.length + ' works'};
  }
  /** "the artist" at the start of a sentence. */
  function cap(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  function artistOf(a) { return (a && a.artistName) || ds.name; }

  /** ctx: {works: [{title, url, slug}], source: 'chat'|'inquiry_list'|'form', threadId, back} */
  function showContact(ctx, reveal) {
    view('Contact ' + ds.name);
    var my = nav;
    getAssistant().catch(function () { return null; }).then(function (a) {
      if (!root || my !== nav) return;
      var artist = artistOf(a);
      titleEl.textContent = 'Contact ' + artist;
      var m = about(ctx.works);
      main.textContent = '';
      if (ctx.works.length)
        main.appendChild(el('p', {class: 'sheet-about', text: 'About: ' + ctx.works.map(function (w) { return w.title; }).join(', ')}));
      var row = el('div', {class: 'sheet-btns'});
      var n = phone();
      if (n) {
        row.appendChild(btn('Text', reveal === 'sms' ? 'btn' : 'btn alt', function () { showContact(ctx, 'sms'); }));
        row.appendChild(btn('Call', reveal === 'tel' ? 'btn' : 'btn alt', function () { showContact(ctx, 'tel'); }));
      }
      row.appendChild(btn('Email', 'btn alt', function () { showLeadForm({kind: 'inquiry', source: ctx.source || 'form', works: ctx.works, threadId: ctx.threadId, artist: artist, back: function () { showContact(ctx); }}); }));
      main.appendChild(row);
      if (n && (reveal === 'sms' || reveal === 'tel')) {
        var href = reveal === 'sms' ? 'sms:' + n + '?&body=' + encodeURIComponent(m.text) : 'tel:' + n;
        main.appendChild(el('p', {class: 'the-number', text: n}));
        main.appendChild(el('a', {class: 'btn', href: href, text: reveal === 'sms' ? 'Open Messages' : 'Call now'}));
      }
      if (ds.email)
        main.appendChild(el('p', {class: 'sheet-small'}, [
          'Or ',
          el('a', {href: 'mailto:' + ds.email + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.text), text: 'open your email app'}),
          '.',
        ]));
      if (ctx.back) foot.appendChild(btn('← Back', 'linkbtn', ctx.back));
      (panel.querySelector('.sheet-btns button') || panel.querySelector('.sheet-x')).focus();
    });
  }

  /** The form that sends a lead. opts: {kind, source, works, threadId, artist, back, hold} */
  function showLeadForm(o) {
    var hold = o.kind === 'hold';
    var focus = view(hold ? 'Hold request' : 'Send to ' + o.artist, '[name=name]');
    var err = el('p', {class: 'err', role: 'alert', hidden: true});
    main.appendChild(el('p', {class: 'sheet-small', text: hold
      ? 'This is a request: ' + o.artist + ' will confirm. Nothing is held until then.'
      : 'Leave your name if you like, and an email or a phone number so ' + o.artist + ' can reply.'}));
    if (o.works.length) main.appendChild(el('p', {class: 'sheet-about', text: 'About: ' + o.works.map(function (w) { return w.title; }).join(', ')}));
    var f = {};
    function field(label, name, type, attrs) {
      var input = el(type === 'textarea' ? 'textarea' : 'input', Object.assign({name: name, id: 'f-' + name}, type === 'textarea' ? {rows: '4', maxlength: '3000'} : {type: type}, attrs || {}));
      f[name] = input;
      return el('label', {class: 'field', for: 'f-' + name}, [el('span', {text: label}), input]);
    }
    var form = el('form', {class: 'sheet-form', novalidate: true});
    form.appendChild(field('Your name (optional)', 'name', 'text', {autocomplete: 'name', maxlength: '120'}));
    form.appendChild(field('Email', 'email', 'email', {autocomplete: 'email', maxlength: '200'}));
    form.appendChild(field('Phone (optional if you gave an email)', 'phone', 'tel', {autocomplete: 'tel', maxlength: '24'}));
    form.appendChild(field(hold ? 'Note (optional)' : 'Note', 'note', 'textarea'));
    if (o.source === 'inquiry_list' && Inq.note()) f.note.value = Inq.note();
    var files = [];
    var fileList = el('ul', {class: 'sheet-files'});
    if (!hold) {
      var pick = el('input', {type: 'file', accept: 'image/*', multiple: true, id: 'f-pic', class: 'sr'});
      var fileErr = el('p', {class: 'err', role: 'alert', hidden: true});
      pick.addEventListener('change', function () {
        fileErr.hidden = true;
        [].forEach.call(pick.files, function (file) {
          if (!/^image\//.test(file.type)) fileErr.textContent = file.name + ' is not a picture.';
          else if (file.size > MAX_BYTES) fileErr.textContent = file.name + ' is over 8 MB.';
          else if (files.length >= MAX_FILES) fileErr.textContent = 'Up to ' + MAX_FILES + ' pictures.';
          else return files.push(file);
          fileErr.hidden = false;
        });
        pick.value = '';
        drawFiles();
      });
      var drawFiles = function () {
        fileList.textContent = '';
        files.forEach(function (file, i) {
          fileList.appendChild(el('li', {}, [file.name + ' ', el('button', {type: 'button', class: 'linkbtn', 'aria-label': 'Remove ' + file.name, text: 'Remove', on: {click: function () { files.splice(i, 1); drawFiles(); }}})]));
        });
      };
      form.appendChild(el('div', {class: 'field'}, [
        el('span', {text: 'Pictures of your own (optional, up to 5, 8 MB each)'}),
        el('label', {class: 'btn alt', for: 'f-pic', text: 'Add pictures'}),
        pick,
        fileErr,
        fileList,
      ]));
    }
    // The hidden trap: out of sight (not just display:none), skipped by keyboards and screen readers, no autofill.
    form.appendChild(el('div', {class: 'hp', 'aria-hidden': 'true'}, [
      el('label', {for: 'f-website', text: 'Leave this empty'}),
      (f.website = el('input', {type: 'text', name: 'website', id: 'f-website', tabindex: '-1', autocomplete: 'off'})),
    ]));
    form.appendChild(err);
    var send = el('button', {type: 'submit', class: 'btn', text: hold ? 'Send request' : 'Send to ' + o.artist});
    form.appendChild(send);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = f.email.value.trim();
      var tel = f.phone.value.trim();
      var fail = function (m) { err.textContent = m; err.hidden = false; };
      if (!email && !tel) return fail('Add an email or a phone number so ' + o.artist + ' can reply.');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('That email does not look right.');
      if (tel && !/^\+?[0-9 ().-]{7,24}$/.test(tel)) return fail('That phone number does not look right.');
      var lead = {kind: o.kind, source: o.source, works: o.works.map(function (w) { return w.slug; }).filter(Boolean), website: f.website.value};
      if (f.name.value.trim()) lead.name = f.name.value.trim();
      if (email) lead.email = email;
      if (tel) lead.phone = tel;
      if (f.note.value.trim()) lead.note = f.note.value.trim();
      if (o.threadId) lead.threadId = o.threadId;
      var init;
      if (files.length) {
        var fd = new FormData();
        fd.append('lead', JSON.stringify(lead));
        files.forEach(function (file) { fd.append('picture', file, file.name); });
        init = {method: 'POST', body: fd};
      } else init = {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(lead)};
      send.disabled = true;
      err.hidden = true;
      request(API + '/visitor/leads', init).then(
        function () {
          if (o.source === 'inquiry_list') Inq.note('');
          var again = view(hold ? 'Request sent' : 'Sent');
          main.appendChild(el('p', {text: hold
            ? 'Thank you. ' + cap(o.artist) + ' will confirm by ' + (email ? 'email' : 'phone') + '. The piece is not held until then.'
            : 'Thank you. ' + cap(o.artist) + ' will reply' + (email || tel ? ' to ' + (email || tel) : '') + '.'}));
          main.appendChild(btn('Done', 'btn', close));
          again();
        },
        function (x) { send.disabled = false; fail(x.message); },
      );
    });
    main.appendChild(form);
    if (o.back) foot.appendChild(btn('← Back', 'linkbtn', o.back));
    focus();
  }

  // ---------------------------------------------------------------- the chat
  var chat = {assistant: null, state: null, fresh: false, piece: null, pieceTitle: '', pieceStatus: '', limited: null, busy: false, lastQuestion: ''};

  function conversationWorks() {
    var seen = {}, out = [];
    (chat.state ? chat.state.messages : []).forEach(function (m) {
      (m.works || []).forEach(function (s) {
        var w = known[s];
        if (w && !seen[s]) { seen[s] = 1; out.push(itemOf(w)); }
      });
    });
    if (chat.piece && !seen[chat.piece]) out.unshift({title: chat.pieceTitle, slug: chat.piece, url: location.origin + '/works/' + chat.piece});
    return out;
  }
  function contactCtx() {
    return {works: conversationWorks(), source: 'chat', threadId: chat.state && chat.state.threadId, back: showChat};
  }
  function artist() { return artistOf(chat.assistant); }
  function sendToArtist() {
    showLeadForm({kind: 'inquiry', source: 'chat', works: conversationWorks(), threadId: chat.state && chat.state.threadId, artist: artist(), back: showChat});
  }
  function holdForm() {
    var w = [{title: chat.pieceTitle, slug: chat.piece, url: location.origin + '/works/' + chat.piece}];
    showLeadForm({kind: 'hold', source: 'chat', works: w, threadId: chat.state && chat.state.threadId, artist: artist(), hold: true, back: showChat});
  }
  function bubble(role, text) {
    return el('div', {class: 'msg ' + role}, [el('p', {text: text})]);
  }
  function artistRow(prominent) {
    var row = el('div', {class: 'sheet-btns' + (prominent ? ' prominent' : '')});
    if (prominent) {
      if (phone()) row.appendChild(btn('Text', 'btn', function () { showContact(contactCtx(), 'sms'); }));
      row.appendChild(btn('Email', 'btn', function () { showContact(contactCtx()); }));
      if (phone()) row.appendChild(btn('Call', 'btn', function () { showContact(contactCtx(), 'tel'); }));
      row.appendChild(btn('Send to ' + artist(), 'btn alt', sendToArtist));
    } else {
      row.appendChild(btn('Ask ' + artist(), 'btn alt sm', function () { showContact(contactCtx()); }));
      row.appendChild(btn('Send to ' + artist(), 'btn alt sm', sendToArtist));
    }
    return row;
  }
  function makePage(question, works, holder, trigger) {
    trigger.disabled = true;
    var words = question.replace(/\s+/g, ' ').trim().split(' ').slice(0, 7).join(' ');
    var payload = {title: (words || 'Pieces from the studio').slice(0, 120), works: works.map(function (w) { return w.slug; }).slice(0, 24)};
    if (question.trim()) payload.question = question.trim().slice(0, 500);
    request(API + '/visitor/pages', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)}).then(
      function (r) {
        var path = r.path || '/p/' + r.token;
        var full = location.origin + path;
        trigger.remove();
        var copy = btn('Copy', 'btn alt sm', function () {
          var done = function () { copy.textContent = 'Copied'; };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(full).then(done, function () { copy.textContent = 'Press and hold the link to copy'; });
          else copy.textContent = 'Press and hold the link to copy';
        });
        holder.appendChild(el('p', {class: 'made'}, [el('a', {href: path, text: full})]));
        holder.appendChild(el('div', {class: 'sheet-btns'}, [copy, el('a', {class: 'btn alt sm', href: path, target: '_blank', rel: 'noopener', text: 'Open'})]));
      },
      function (e) { trigger.disabled = false; holder.appendChild(el('p', {class: 'err', role: 'alert', text: e.message})); },
    );
  }
  // Listen: an answer read aloud by the browser's own voice (speech synthesis), only on a tap; one answer at a time.
  var synth = window.speechSynthesis;
  var canSpeak = !!(synth && window.SpeechSynthesisUtterance);
  var speaking = null; // the Listen button of the answer being read
  function stopSpeaking() {
    if (!canSpeak) return;
    var b = speaking;
    speaking = null;
    if (b) b.textContent = 'Listen';
    synth.cancel();
  }
  function listenBtn(text) {
    var b = el('button', {type: 'button', class: 'linkbtn listen', text: 'Listen'});
    b.addEventListener('click', function () {
      var mine = speaking === b;
      stopSpeaking();
      if (mine) return;
      var u = new window.SpeechSynthesisUtterance(text);
      u.lang = document.documentElement.lang || 'en';
      u.onend = u.onerror = function () {
        if (speaking !== b) return;
        speaking = null;
        b.textContent = 'Listen';
      };
      speaking = b;
      b.textContent = 'Stop';
      synth.speak(u);
    });
    return b;
  }
  if (canSpeak) window.addEventListener('pagehide', stopSpeaking);
  function drawAnswer(log, m, question, isLast) {
    var wrap = el('div', {class: 'msg assistant'}, [el('p', {text: m.text})]);
    if (canSpeak && m.text) wrap.appendChild(listenBtn(m.text));
    var works = (m.works || []).map(function (s) { return typeof s === 'string' ? known[s] : s; }).filter(Boolean);
    if (works.length) {
      wrap.appendChild(cardList(works));
      var holder = el('div', {class: 'made-holder'});
      var t = el('button', {type: 'button', class: 'linkbtn', text: 'Open these as a page'});
      t.addEventListener('click', function () { makePage(question, works, holder, t); });
      holder.appendChild(t);
      wrap.appendChild(holder);
    }
    if (isLast && m.askArtist) wrap.appendChild(artistRow(true));
    log.appendChild(wrap);
    if (isLast && m.replies && m.replies.length) {
      var rep = el('div', {class: 'replies'});
      m.replies.forEach(function (r) { rep.appendChild(btn(r, 'chip-btn', function () { ask(r); })); });
      log.appendChild(rep);
    }
    refreshAdds();
  }
  var log;
  function drawLog() {
    stopSpeaking();
    log.textContent = '';
    var msgs = chat.state ? chat.state.messages : [];
    if (!msgs.length) {
      log.appendChild(bubble('assistant', chat.assistant ? chat.assistant.greeting : 'Hello.'));
      var rep = el('div', {class: 'replies'});
      ((chat.assistant && chat.assistant.suggestions) || []).slice(0, 3).forEach(function (s) { rep.appendChild(btn(s, 'chip-btn', function () { ask(s); })); });
      log.appendChild(rep);
      return;
    }
    var q = '';
    msgs.forEach(function (m, i) {
      if (m.role === 'user') { q = m.text; log.appendChild(bubble('user', m.text)); }
      else drawAnswer(log, m, q, i === msgs.length - 1);
    });
  }
  function ask(text) {
    text = (text || '').trim();
    if (!text || chat.busy) return;
    chat.busy = true;
    chat.lastQuestion = text;
    var fresh = chat.fresh;
    chat.fresh = false;
    if (!chat.state) chat.state = {email: null, threadId: null, messages: []};
    chat.state.messages.push({role: 'user', text: text, works: []});
    drawLog();
    var wait = el('div', {class: 'msg assistant'}, [el('p', {class: 'dots', text: '…', 'aria-label': 'Thinking'})]);
    log.appendChild(wait);
    scrollEnd();
    var payload = {message: text};
    if (fresh) payload.fresh = true;
    if (chat.piece) payload.piece = chat.piece;
    request('/ask/chat', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload)}).then(
      function (r) {
        chat.busy = false;
        remember(r.works);
        chat.state.threadId = r.threadId || chat.state.threadId;
        chat.state.messages.push({role: 'assistant', text: r.text, works: (r.works || []).map(function (w) { return w.slug; }), replies: r.replies, askArtist: r.askArtist});
        if (r.limited) { chat.limited = {kind: r.limited, text: r.text}; showChat(); return; }
        drawLog(); // the newest answer shows its replies and, if asked, the contact buttons
        scrollEnd();
      },
      function (e) {
        chat.busy = false;
        chat.state.messages.pop();
        drawLog();
        log.appendChild(el('p', {class: 'err', role: 'alert', text: e.message}));
        scrollEnd();
      },
    );
  }
  function scrollEnd() { main.scrollTop = main.scrollHeight; }

  function limitedView() {
    var line = chat.limited ? chat.limited.text : 'The chat is resting for now. You can search the works or write to ' + artist() + '.';
    main.appendChild(el('p', {class: 'sheet-note', text: line}));
    var results = el('div', {class: 'sheet-results'});
    var input = el('input', {type: 'search', id: 'sq', placeholder: 'Search: a colour, a collection, a material', 'aria-label': 'Search the works', autocomplete: 'off'});
    input.addEventListener('input', function () {
      var q = input.value.trim();
      results.textContent = '';
      if (!q) return;
      getDigest().then(function (d) {
        var hits = search(d.works, q);
        remember(d.works);
        if (!hits.length) results.appendChild(el('p', {class: 'sheet-small', text: 'Nothing matches. Try one word, or ask ' + artist() + '.'}));
        else results.appendChild(cardList(hits.slice(0, 24)));
        refreshAdds();
      }, function () { results.appendChild(el('p', {class: 'err', text: 'Search is not available just now.'})); });
    });
    main.appendChild(input);
    main.appendChild(results);
    main.appendChild(artistRow(true));
  }

  function showChat() {
    var focus = view(chat.limited || (chat.assistant && !chat.assistant.available) ? 'Search the works' : 'Ask');
    if (chat.limited || (chat.assistant && !chat.assistant.available)) {
      limitedView();
      focus = function () { (panel.querySelector('#sq') || panel.querySelector('.sheet-x')).focus(); };
      focus();
      return;
    }
    log = el('div', {class: 'chat-log', 'aria-live': 'polite'});
    main.appendChild(log);
    drawLog();
    // Always on screen: Ask Isaac, Send to Isaac, (a hold on an available piece), keep / new chat.
    var bar = artistRow(false);
    if (chat.piece && chat.pieceStatus === 'available')
      bar.appendChild(btn('Ask ' + artist() + ' to hold this for 48 hours', 'btn alt sm', holdForm));
    var verified = chat.state && chat.state.email;
    if (verified) bar.appendChild(el('span', {class: 'kept', text: 'Chat kept for ' + chat.state.email}));
    else bar.appendChild(btn('Keep this chat', 'btn alt sm', showKeep));
    bar.appendChild(btn('New chat', 'btn alt sm', function () {
      chat.fresh = true;
      chat.state = {email: chat.state && chat.state.email, threadId: null, messages: []};
      showChat();
    }));
    foot.appendChild(bar);
    var input = el('input', {type: 'text', id: 'q', maxlength: '1000', placeholder: 'Ask about the work…', 'aria-label': 'Your question', autocomplete: 'off'});
    var go = el('button', {type: 'submit', class: 'btn', text: 'Send'});
    var form = el('form', {class: 'sheet-ask'}, [input, go]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = input.value;
      input.value = '';
      ask(t);
    });
    foot.appendChild(form);
    scrollEnd();
    input.focus();
  }

  function showKeep() {
    var focus = view('Keep this chat', '#ke');
    var err = el('p', {class: 'err', role: 'alert', hidden: true});
    var step = 'email';
    var email = '';
    var input = el('input', {id: 'ke', type: 'email', autocomplete: 'email', maxlength: '200', 'aria-label': 'Your email'});
    var label = el('p', {class: 'sheet-small', text: 'Enter your email and we will send a six-digit code. Then this chat opens on any device with that email.'});
    var go = el('button', {type: 'submit', class: 'btn', text: 'Send the code'});
    var form = el('form', {class: 'sheet-ask stack'}, [input, go]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      go.disabled = true;
      var fail = function (x) { go.disabled = false; err.textContent = x.message; err.hidden = false; };
      if (step === 'email') {
        email = input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(new Error('That email does not look right.'));
        request(API + '/visitor/email-code', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({email: email})}).then(function () {
          step = 'code';
          go.disabled = false;
          input.value = '';
          input.type = 'text';
          input.setAttribute('inputmode', 'numeric');
          input.setAttribute('autocomplete', 'one-time-code');
          input.setAttribute('maxlength', '6');
          input.setAttribute('aria-label', 'Six-digit code');
          label.textContent = 'We sent a code to ' + email + '. Enter it here.';
          go.textContent = 'Keep this chat';
          input.focus();
        }, fail);
      } else {
        request(API + '/visitor/email-verify', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({email: email, code: input.value.trim()})}).then(function (s) {
          chat.state = s;
          return loadCards(s).then(showChat);
        }, fail);
      }
    });
    main.appendChild(label);
    main.appendChild(form);
    main.appendChild(err);
    foot.appendChild(btn('← Back', 'linkbtn', showChat));
    focus();
  }

  function loadCards(state) {
    var need = (state.messages || []).some(function (m) { return (m.works || []).length; });
    if (!need) return Promise.resolve();
    return getDigest().then(function (d) { remember(d.works); }, function () {});
  }

  function openChat(from) {
    var d = from.dataset;
    chat.piece = d.piece || null;
    chat.pieceTitle = d.title || '';
    chat.pieceStatus = d.status || '';
    var focus = view('Ask');
    main.appendChild(el('p', {class: 'sheet-small', text: 'One moment…'}));
    var my = nav;
    Promise.all([
      getAssistant().catch(function () { return null; }),
      request(API + '/visitor').catch(function () { return null; }),
    ]).then(function (r) {
      if (!root || my !== nav) return;
      chat.assistant = r[0] || {artistName: ds.name, greeting: 'Hello. Ask about the work, or write to ' + ds.name + '.', suggestions: [], available: false};
      if (r[1] && !chat.state) chat.state = r[1];
      return loadCards(chat.state || {messages: []}).then(function () {
        if (!chat.assistant.available) return getDigest().then(function (dg) { remember(dg.works); }, function () {});
      }).then(function () {
        if (!root || my !== nav) return;
        if (d.hold && chat.piece && chat.pieceStatus === 'available') holdForm();
        else showChat();
      });
    });
    focus();
  }

  // ---------------------------------------------------------------- the entry point
  function open(from) {
    ensureCss().then(function () {
      if (root) close();
      var d = from.dataset;
      frame(from);
      if (d.ask !== undefined) return openChat(from);
      var works = [];
      if (d.about === 'list') works = Inq.list();
      else if (d.url && d.title) works = [{title: d.title, url: d.url, slug: (/\/works\/([^/?#]+)/.exec(d.url) || [])[1] || ''}];
      showContact({works: works, source: d.about === 'list' ? 'inquiry_list' : 'form'}, null);
    });
  }
  window.StudioSheet = {open: open};
})();
