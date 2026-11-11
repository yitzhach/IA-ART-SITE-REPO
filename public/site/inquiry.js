// "Add to inquiry": a list of works kept in this browser, and a small bar to Text or Email the studio about them.
// The studio's name, phone and email come from the <body> data attributes the layout writes.
(function () {
  var K = 'inquiry';
  var ds = document.body.dataset;
  var list = [];
  try {
    list = JSON.parse(localStorage.getItem(K) || '[]');
    if (!Array.isArray(list)) list = [];
  } catch (e) {}
  function save() {
    try {
      localStorage.setItem(K, JSON.stringify(list));
    } catch (e) {}
  }
  function has(url) {
    return list.some(function (w) {
      return w.url === url;
    });
  }
  var bar, count, sms, mail;
  function msg() {
    var lines = list.map(function (w) {
      return w.title + '\n' + w.url;
    });
    return ['Hello ' + ds.name + ", I'm interested in " + list.length + (list.length === 1 ? ' work.' : ' works.')]
      .concat(lines)
      .join('\n');
  }
  function link(text) {
    var a = document.createElement('a');
    a.textContent = text;
    bar.appendChild(a);
    return a;
  }
  function draw() {
    if (!list.length) {
      if (bar) bar.hidden = true;
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'inq-bar';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Your inquiry');
      count = document.createElement('span');
      bar.appendChild(count);
      if (ds.phone) sms = link('Text');
      if (ds.email) mail = link('Email');
      var c = document.createElement('button');
      c.type = 'button';
      c.textContent = 'Clear';
      c.addEventListener('click', function () {
        list = [];
        save();
        draw();
        sync();
      });
      bar.appendChild(c);
      document.body.appendChild(bar);
      document.body.style.paddingBottom = '72px';
    }
    bar.hidden = false;
    var n = list.length + (list.length === 1 ? ' work' : ' works');
    count.textContent = 'Inquiry: ' + n;
    var body = encodeURIComponent(msg());
    if (sms) sms.href = 'sms:' + ds.phone + '?&body=' + body;
    if (mail) mail.href = 'mailto:' + ds.email + '?subject=' + encodeURIComponent('About ' + n) + '&body=' + body;
    if (sms) sms.setAttribute('aria-label', 'Text about ' + n);
    if (mail) mail.setAttribute('aria-label', 'Email about ' + n);
  }
  var buttons = [].slice.call(document.querySelectorAll('[data-inquiry]'));
  function sync() {
    buttons.forEach(function (b) {
      var on = has(b.getAttribute('data-url'));
      b.textContent = on ? 'In your inquiry ✓' : 'Add to inquiry';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  buttons.forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-url');
      if (has(url))
        list = list.filter(function (w) {
          return w.url !== url;
        });
      else list.push({title: b.getAttribute('data-title'), url: url});
      save();
      sync();
      draw();
    });
  });
  sync();
  draw();
})();
