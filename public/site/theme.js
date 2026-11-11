// Applies the saved light/dark choice before paint; shows the switch, which toggles and remembers it.
(function () {
  var d = document.documentElement;
  try {
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') d.setAttribute('data-theme', t);
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.querySelector('.theme-switch');
    if (!b) return;
    var cur = function () {
      return d.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    };
    var label = function () {
      b.setAttribute('aria-label', cur() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    };
    b.hidden = false;
    label();
    b.addEventListener('click', function () {
      var n = cur() === 'dark' ? 'light' : 'dark';
      d.setAttribute('data-theme', n);
      try {
        localStorage.setItem('theme', n);
      } catch (e) {}
      label();
    });
  });
})();
