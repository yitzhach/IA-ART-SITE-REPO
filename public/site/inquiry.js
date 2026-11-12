// The inquiry list kept in this browser (localStorage 'inquiry': [{title, url, slug}]; entries from before the slug was
// stored still work, the slug is read from /works/{slug}), the "Add to inquiry" buttons, and the small bar that links to
// /inquiry. Exposes window.StudioInquiry for the sheet and the /inquiry page.
(function () {
  var K = 'inquiry';
  var N = 'inquiry-note';
  var ds = document.body.dataset;
  var listeners = [];
  function slugOf(url) {
    var m = /\/works\/([a-z0-9]+(?:-[a-z0-9]+)*)/.exec(url || '');
    return m ? m[1] : '';
  }
  function read() {
    try {
      var l = JSON.parse(localStorage.getItem(K) || '[]');
      if (!Array.isArray(l)) return [];
      return l
        .filter(function (w) {
          return w && typeof w.title === 'string' && typeof w.url === 'string';
        })
        .map(function (w) {
          return {title: w.title, url: w.url, slug: w.slug || slugOf(w.url)};
        });
    } catch (e) {
      return [];
    }
  }
  var list = read();
  function key(w) {
    return w.slug || w.url;
  }
  function save() {
    try {
      localStorage.setItem(K, JSON.stringify(list));
    } catch (e) {}
    listeners.forEach(function (f) {
      f();
    });
  }
  var api = {
    list: function () {
      return list.slice();
    },
    has: function (w) {
      return list.some(function (x) {
        return key(x) === key(w);
      });
    },
    add: function (w) {
      var item = {title: w.title, url: w.url, slug: w.slug || slugOf(w.url)};
      if (!api.has(item)) list.push(item);
      save();
    },
    remove: function (w) {
      list = list.filter(function (x) {
        return key(x) !== key(w);
      });
      save();
    },
    clear: function () {
      list = [];
      save();
    },
    onChange: function (f) {
      listeners.push(f);
    },
    note: function (v) {
      try {
        if (v === undefined) return localStorage.getItem(N) || '';
        localStorage.setItem(N, v);
      } catch (e) {}
      return v || '';
    },
  };
  window.StudioInquiry = api;
  window.addEventListener('storage', function (e) {
    if (e.key !== K) return;
    list = read();
    listeners.forEach(function (f) {
      f();
    });
  });

  // "Add to inquiry" on a piece page.
  var buttons = [].slice.call(document.querySelectorAll('[data-inquiry]'));
  function itemOf(b) {
    var url = b.getAttribute('data-url');
    return {title: b.getAttribute('data-title'), url: url, slug: slugOf(url)};
  }
  function sync() {
    buttons.forEach(function (b) {
      var on = api.has(itemOf(b));
      b.textContent = on ? 'In your inquiry ✓' : 'Add to inquiry';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  buttons.forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      var it = itemOf(b);
      if (api.has(it)) api.remove(it);
      else api.add(it);
    });
  });

  // The bar: the count (a link to /inquiry), Text and Email (the contact sheet, with the list written in), Clear.
  var bar, count;
  function link(text, kind, href) {
    var a = document.createElement('a');
    a.textContent = text;
    a.href = href;
    a.setAttribute('data-contact', kind);
    a.setAttribute('data-about', 'list');
    bar.appendChild(a);
  }
  function draw() {
    var onPage = location.pathname.replace(/\/+$/, '') === '/inquiry';
    if (!list.length || onPage) {
      if (bar) bar.hidden = true;
      document.body.style.paddingBottom = '';
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'inq-bar';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Your inquiry');
      count = document.createElement('a');
      count.href = '/inquiry';
      bar.appendChild(count);
      if (ds.pa) link('Text', 'sms', '/contact');
      if (ds.email) link('Email', 'email', 'mailto:' + ds.email);
      var c = document.createElement('button');
      c.type = 'button';
      c.textContent = 'Clear';
      c.addEventListener('click', function () {
        api.clear();
      });
      bar.appendChild(c);
      document.body.appendChild(bar);
    }
    bar.hidden = false;
    document.body.style.paddingBottom = '72px';
    count.textContent = 'Inquiry: ' + list.length + (list.length === 1 ? ' work' : ' works');
  }
  api.onChange(sync);
  api.onChange(draw);
  sync();
  draw();
})();
