// The piece page's pictures, large: tap a picture to open it (1600 size), Esc / the close button / a tap closes,
// arrows step through. Without scripts each picture is a plain link to its large size.
(function () {
  var links = [].slice.call(document.querySelectorAll('a[data-lb]'));
  if (!links.length) return;
  var box, img, at, opener;
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function show(n) {
    at = (n + links.length) % links.length;
    img.src = links[at].href;
    img.alt = links[at].getAttribute('data-alt') || '';
  }
  function close() {
    if (!box) return;
    document.removeEventListener('keydown', key);
    box.remove();
    box = null;
    document.documentElement.classList.remove('lb-open');
    if (opener) opener.focus();
  }
  function key(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(at + 1);
    else if (e.key === 'ArrowLeft') show(at - 1);
    else if (e.key === 'Tab') {
      var bs = [].slice.call(box.querySelectorAll('button'));
      var i = bs.indexOf(document.activeElement);
      e.preventDefault();
      bs[(i + (e.shiftKey ? bs.length - 1 : 1)) % bs.length].focus();
    }
  }
  function button(cls, label, text, fn) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      fn();
    });
    box.appendChild(b);
    return b;
  }
  function open(n) {
    opener = links[n];
    box = el('div', 'lb');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Picture');
    img = el('img');
    box.appendChild(img);
    var x = button('x', 'Close', '×', close);
    if (links.length > 1) {
      button('pv', 'Previous picture', '‹', function () {
        show(at - 1);
      });
      button('nx', 'Next picture', '›', function () {
        show(at + 1);
      });
    }
    box.addEventListener('click', close);
    show(n);
    document.body.appendChild(box);
    document.documentElement.classList.add('lb-open');
    document.addEventListener('keydown', key);
    x.focus();
  }
  links.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      open(i);
    });
  });
})();
