// The small script every page loads: shows what needs scripts, and opens the Ask / contact sheet on a tap. The sheet
// itself (/site/ask.js) is loaded only then, so a page that is just read carries no chat code.
(function () {
  [].forEach.call(document.querySelectorAll('[data-js]'), function (e) {
    e.hidden = false;
  });
  var loading = null;
  function load() {
    if (window.StudioSheet) return Promise.resolve();
    if (!loading)
      loading = new Promise(function (ok, no) {
        var s = document.createElement('script');
        s.src = '/site/ask.js';
        s.onload = ok;
        s.onerror = function () {
          loading = null;
          no(new Error('sheet'));
        };
        document.head.appendChild(s);
      });
    return loading;
  }
  // "See it on your wall" (stage 5): its two scripts load on the tap, so a piece page that is only read carries none.
  var wall = null;
  function add(src) {
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = no;
      document.head.appendChild(s);
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-wall]');
    if (!t || e.defaultPrevented) return;
    e.preventDefault();
    if (!wall)
      wall = add('/site/wall-core.js').then(function () {
        return add('/site/wall.js');
      });
    wall.then(
      function () {
        window.StudioWall.open(t);
      },
      function () {
        wall = null;
      },
    );
  });
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target.closest && e.target.closest('[data-ask],[data-contact]');
    if (!t) return;
    e.preventDefault();
    load().then(
      function () {
        window.StudioSheet.open(t);
      },
      function () {
        // The sheet could not load: do what the link did without scripts.
        if (t.href) location.href = t.href;
      },
    );
  });
})();
