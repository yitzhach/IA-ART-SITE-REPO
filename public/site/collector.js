// Collectors and followers (stage 6, D-163…D-165). Only where its element is:
//  - /c/{token}: tells the studio this browser opened the page (it then sees, and may buy, first-look work); when the
//    studio sells online, each first-look piece gets Add to cart (kept here for the cart, since it has no public page);
//  - /c/{token}/certificate/{n}: Print;
//  - /follow, /follow/{show}: email → six-digit code → the follower's own page;
//  - /f/{token}: Stop following.
(function () {
  var ds = document.body.dataset;
  var slug = ds.slug || '';
  var API = '/v1/public/studios/' + encodeURIComponent(slug);
  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {accept: 'application/json', 'content-type': 'application/json'},
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.text().then(function (t) {
        var d = null;
        try {
          d = t ? JSON.parse(t) : null;
        } catch (e) {}
        if (!r.ok) throw new Error((d && d.error && d.error.message) || 'Something went wrong. Please try again.');
        return d;
      });
    });
  }
  function q(sel, root) {
    return (root || document).querySelector(sel);
  }

  var page = q('[data-collector]');
  if (page) {
    var token = page.getAttribute('data-collector');
    post('/collectors/' + encodeURIComponent(token) + '/visit').then(
      function () {
        var buys = document.querySelectorAll('[data-fl]');
        if (!buys.length) return;
        fetch(API + '/checkout', {credentials: 'same-origin', headers: {accept: 'application/json'}})
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (c) {
            if (!c || !c.enabled || !c.methods || !c.methods.length) return;
            [].forEach.call(buys, function (b) {
              b.hidden = false;
              b.addEventListener('click', function () {
                var s = b.getAttribute('data-fl');
                var t = b.getAttribute('data-thumb');
                try {
                  localStorage.setItem(
                    'studio-fl:' + slug + ':' + s,
                    JSON.stringify({
                      title: b.getAttribute('data-title'),
                      images: t ? [{altText: null, sizes: [{width: 480, url: t}]}] : [],
                    }),
                  );
                  var key = 'studio-cart:' + slug;
                  var cart = JSON.parse(localStorage.getItem(key) || 'null') || {works: [], zip: ''};
                  if (!Array.isArray(cart.works)) cart.works = [];
                  if (cart.works.indexOf(s) < 0 && cart.works.length < 10) cart.works.push(s);
                  localStorage.setItem(key, JSON.stringify(cart));
                } catch (e) {}
                location.assign('/cart');
              });
            });
          })
          .catch(function () {});
      },
      function () {},
    );
  }

  var print = q('[data-print]');
  if (print) {
    print.hidden = false;
    print.addEventListener('click', function () {
      window.print();
    });
  }

  var form = q('[data-follow]');
  if (form) {
    form.hidden = false;
    var msg = q('.follow-msg', form);
    var email = form.elements.email;
    var show = form.getAttribute('data-show') || undefined;
    var say = function (t) {
      msg.textContent = t;
    };
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      say('Sending…');
      post('/follow/email-code', {
        email: email.value.trim(),
        showId: show,
        website: form.elements.website.value || undefined,
      }).then(
        function () {
          q('.code-step', form).hidden = false;
          say('We emailed you a code. It lasts 15 minutes.');
          form.elements.code.focus();
        },
        function (e) {
          say(e.message);
        },
      );
    });
    q('[data-verify]', form).addEventListener('click', function () {
      say('Checking…');
      post('/follow/verify', {email: email.value.trim(), code: form.elements.code.value.trim(), showId: show}).then(
        function (d) {
          location.assign(d.path);
        },
        function (e) {
          say(e.message);
        },
      );
    });
  }

  var fol = q('[data-follower]');
  var stop = q('[data-stop]');
  if (fol && stop) {
    stop.hidden = false;
    stop.addEventListener('click', function () {
      post('/followers/' + encodeURIComponent(fol.getAttribute('data-follower')) + '/stop').then(
        function () {
          location.reload();
        },
        function (e) {
          q('.follow-msg').textContent = e.message;
        },
      );
    });
  }
})();
