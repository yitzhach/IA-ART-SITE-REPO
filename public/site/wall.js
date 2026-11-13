// "See it on your wall" (stage 5, D-157…D-160). Loaded on the tap with /site/wall-core.js. Two ways:
//  - Live, through the camera, where Safari has AR Quick Look: a USDZ built here at the piece's true size, pinch
//    locked (#allowsContentScaling=0), opened from an a[rel=ar] whose only child is an image (as Apple asks).
//  - On a photo of the wall, on any device: the photo stays in this browser; two taps on something of known length set
//    the scale; the piece is drawn at true size and drags into place; Save picture keeps the composite.
// Nothing is sent anywhere: the only request is the piece's own picture, from this site.
(function () {
  var C = window.StudioWallCore;
  var AR = false;
  try {
    AR = document.createElement('a').relList.supports('ar');
  } catch (e) {}
  var back = null,
    opener = null,
    urls = [],
    cleanup = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function button(text, cls, fn) {
    var b = el('button', cls || 'btn', text);
    b.type = 'button';
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function css(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }
  function url(blob) {
    var u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  }
  function fmt(v) {
    return String(Math.round(v * 10) / 10);
  }
  /** Height first, as the piece page writes sizes. */
  function dims(size) {
    return fmt(size.heightIn) + ' in high × ' + fmt(size.widthIn) + ' in wide';
  }
  function loadImage(src) {
    return new Promise(function (ok, no) {
      var i = new Image();
      i.decoding = 'async';
      i.onload = function () {
        ok(i);
      };
      i.onerror = function () {
        no(new Error('picture'));
      };
      i.src = src;
    });
  }
  function toBlob(canvas, type, q) {
    return new Promise(function (ok, no) {
      canvas.toBlob(
        function (b) {
          b ? ok(b) : no(new Error('canvas'));
        },
        type,
        q,
      );
    });
  }

  function close() {
    if (!back) return;
    cleanup.forEach(function (f) {
      f();
    });
    cleanup = [];
    back.remove();
    back = null;
    document.documentElement.classList.remove('sheet-open');
    // Quick Look may still be reading the model: let go of the files a little later.
    var old = urls;
    urls = [];
    setTimeout(function () {
      old.forEach(URL.revokeObjectURL);
    }, 120000);
    if (opener) opener.focus();
  }

  // ---- live ----
  /** A picture of a button (Quick Look wants an image as the link's only child), in the page's own colours. */
  function buttonImage(text) {
    var probe = el('span', 'btn');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    var cs = getComputedStyle(probe);
    var bg = cs.backgroundColor,
      fg = cs.color,
      font = cs.fontWeight + ' 15px ' + cs.fontFamily;
    probe.remove();
    var s = 2,
      w = 300,
      h = 52,
      c = document.createElement('canvas');
    c.width = w * s;
    c.height = h * s;
    var x = c.getContext('2d');
    x.scale(s, s);
    x.fillStyle = bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#1a1814';
    x.fillRect(0, 0, w, h);
    x.fillStyle = fg || '#edeae3';
    x.font = font;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 1);
    return {src: c.toDataURL('image/png'), w: w, h: h};
  }

  function shadowPng() {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.shadowColor = 'rgba(0,0,0,0.45)';
    x.shadowBlur = 28;
    x.shadowOffsetX = 1000;
    x.fillRect(-1000 + 36, 36, 184, 184);
    return toBlob(c, 'image/png');
  }

  function buildLive(d, size) {
    return loadImage(d.img).then(function (img) {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      var small = document.createElement('canvas');
      small.width = small.height = 64;
      var sx = small.getContext('2d');
      sx.drawImage(img, 0, 0, 64, 64);
      var color = C.edgeColor(sx.getImageData(0, 0, 64, 64).data, 64, 64);
      return Promise.all([toBlob(c, 'image/jpeg', 0.92), shadowPng()]).then(function (b) {
        return Promise.all([b[0].arrayBuffer(), b[1].arrayBuffer()]).then(function (ab) {
          var bytes = C.usdz(
            {widthIn: size.widthIn, heightIn: size.heightIn, depthIn: size.depthIn, color: color},
            new Uint8Array(ab[0]),
            new Uint8Array(ab[1]),
          );
          return new Blob([bytes], {type: 'model/vnd.usdz+zip'});
        });
      });
    });
  }

  function live(main, d, size) {
    var box = el('div', 'wall-live');
    var status = el('p', 'sheet-small', 'Getting it ready…');
    status.setAttribute('role', 'status');
    box.appendChild(status);
    main.appendChild(box);
    buildLive(d, size).then(
      function (blob) {
        if (!back) return;
        var a = document.createElement('a');
        a.rel = 'ar';
        a.className = 'wall-ar';
        a.href = url(blob) + '#allowsContentScaling=0';
        a.setAttribute('download', 'on-my-wall.usdz');
        var pic = buttonImage('Open the live view');
        var i = new Image(pic.w, pic.h);
        i.src = pic.src;
        i.alt = 'Open the live view';
        a.appendChild(i);
        box.insertBefore(a, status);
        status.textContent =
          'Point your camera at the wall and move it slowly until the piece appears. It shows at its true size, ' +
          dims(size) +
          '.';
      },
      function () {
        status.textContent = 'The live view couldn’t be made just now. The photo way below still works.';
      },
    );
  }

  // ---- photo ----
  function photo(main, d, size) {
    var sec = el('div', 'wall-photo');
    var intro = el(
      'p',
      'sheet-small',
      'Take a photo straight at the wall, or choose one. It stays on your device and isn’t sent anywhere.',
    );
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.className = 'wall-file';
    input.id = 'wall-file';
    var pick = el('label', 'btn', 'Choose or take a photo');
    pick.htmlFor = 'wall-file';
    pick.tabIndex = 0;
    pick.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    var pickRow = el('p', 'sheet-btns');
    pickRow.appendChild(pick);
    sec.appendChild(intro);
    sec.appendChild(input);
    sec.appendChild(pickRow);
    main.appendChild(sec);

    var stage, wallImg, line, marks, piece, say, lenRow, tools;
    var pts = [],
      inPerPx = 0,
      pos = null,
      art = null;
    var pieceImg = loadImage(d.img); // the same picture the page shows, from this site

    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      loadImage(url(f)).then(start, function () {
        intro.textContent = 'That photo couldn’t be opened here. Try a JPEG or a photo straight from the camera.';
      });
    });

    function scale() {
      return wallImg.getBoundingClientRect().width / wallImg.naturalWidth;
    }
    function toPhoto(e) {
      var r = wallImg.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * wallImg.naturalWidth,
        y: ((e.clientY - r.top) / r.height) * wallImg.naturalHeight,
      };
    }
    function draw() {
      if (!stage) return;
      var s = scale();
      marks.forEach(function (m, i) {
        var p = pts[i];
        m.hidden = !p;
        if (p) m.style.transform = 'translate(' + p.x * s + 'px,' + p.y * s + 'px)';
      });
      if (pts.length === 2) {
        line.hidden = false;
        line.setAttribute('x1', pts[0].x * s);
        line.setAttribute('y1', pts[0].y * s);
        line.setAttribute('x2', pts[1].x * s);
        line.setAttribute('y2', pts[1].y * s);
      } else line.hidden = true;
      if (inPerPx && pos) {
        var z = C.placed(size.widthIn, size.heightIn, inPerPx);
        piece.hidden = false;
        piece.style.width = z.w * s + 'px';
        piece.style.height = z.h * s + 'px';
        piece.style.transform = 'translate(' + (pos.x - z.w / 2) * s + 'px,' + (pos.y - z.h / 2) * s + 'px)';
        piece.dataset.w = String(z.w * s);
        piece.dataset.h = String(z.h * s);
      } else piece.hidden = true;
    }
    var frame = 0;
    function later() {
      if (!frame)
        frame = requestAnimationFrame(function () {
          frame = 0;
          draw();
        });
    }

    function start(img) {
      if (stage) stage.remove();
      if (tools) tools.remove();
      pts = [];
      inPerPx = 0;
      pos = null;
      sec.removeChild(intro);
      pickRow.remove();
      stage = el('div', 'wall-stage');
      wallImg = img;
      wallImg.className = 'wall-img';
      wallImg.alt = 'Your wall';
      stage.appendChild(wallImg);
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'wall-svg');
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      svg.appendChild(line);
      stage.appendChild(svg);
      piece = el('div', 'wall-piece');
      piece.hidden = true;
      piece.tabIndex = 0;
      piece.setAttribute('role', 'img');
      piece.setAttribute('aria-label', d.title + ', drag to move');
      pieceImg.then(function (p) {
        art = p;
        piece.style.backgroundImage = 'url("' + p.src + '")';
      });
      stage.appendChild(piece);
      marks = [0, 1].map(function (i) {
        var m = el('span', 'wall-mark');
        m.hidden = true;
        m.setAttribute('aria-hidden', 'true');
        drag(m, function (p) {
          pts[i] = p;
          if (inPerPx && lenRow) measure(true);
        });
        stage.appendChild(m);
        return m;
      });
      drag(piece, function (p, from, at) {
        pos = {x: at.x + p.x - from.x, y: at.y + p.y - from.y};
      });
      piece.addEventListener('keydown', function (e) {
        var k = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key];
        if (!k || !pos) return;
        e.preventDefault();
        var step = (e.shiftKey ? 6 : 1) / inPerPx; // an inch, or six
        pos = {x: pos.x + k[0] * step, y: pos.y + k[1] * step};
        later();
      });
      stage.addEventListener('click', function (e) {
        if (pts.length >= 2 || e.target !== wallImg) return;
        pts.push(toPhoto(e));
        step();
        draw();
      });
      say = el('p', 'wall-say');
      say.setAttribute('role', 'status');
      sec.appendChild(say);
      sec.appendChild(stage);
      tools = el('div', 'wall-tools');
      sec.appendChild(tools);
      var onResize = later;
      window.addEventListener('resize', onResize);
      cleanup.push(function () {
        window.removeEventListener('resize', onResize);
      });
      step();
      draw();
    }

    function step() {
      tools.textContent = '';
      lenRow = null;
      if (pts.length === 0) {
        say.textContent =
          'Tap one end of something on the wall you know the length of: a door frame, a sheet of paper, a tape measure.';
      } else if (pts.length === 1) {
        say.textContent = 'Now tap the other end.';
      } else {
        say.textContent = 'How long is it? (A standard US door is 80 in tall; letter paper is 11 in long.)';
        lenRow = el('div', 'wall-len');
        var n = document.createElement('input');
        n.type = 'number';
        n.inputMode = 'decimal';
        n.min = '0';
        n.step = 'any';
        n.id = 'wall-len';
        n.setAttribute('aria-label', 'Length');
        var u = document.createElement('select');
        u.setAttribute('aria-label', 'Unit');
        ['in', 'cm'].forEach(function (v) {
          var o = el('option', '', v);
          o.value = v;
          u.appendChild(o);
        });
        if (d.unit === 'cm') u.value = 'cm';
        lenRow.appendChild(n);
        lenRow.appendChild(u);
        lenRow.appendChild(
          button('Place the piece', 'btn', function () {
            measure(false);
          }),
        );
        n.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') measure(false);
        });
        tools.appendChild(lenRow);
        tools.appendChild(button('Start over', 'linkbtn', reset));
        lenRow.n = n;
        lenRow.u = u;
        n.focus();
      }
    }
    function reset() {
      pts = [];
      inPerPx = 0;
      pos = null;
      step();
      draw();
    }
    function measure(quiet) {
      var v = parseFloat(lenRow.n.value);
      try {
        inPerPx = C.calibrate(pts[0], pts[1], C.toInches(v, lenRow.u.value));
      } catch (e) {
        if (!quiet)
          say.textContent =
            e.message === 'close'
              ? 'Those two taps are too close together. Start over and tap farther apart.'
              : 'Type the length first.';
        return;
      }
      if (!pos) pos = {x: wallImg.naturalWidth / 2, y: wallImg.naturalHeight / 2};
      if (!quiet) placedTools(v, lenRow.u.value);
      later();
    }
    function placedTools(v, unit) {
      say.textContent = d.title + ' at its true size, ' + dims(size) + '. Drag it where you like.';
      var keep = lenRow;
      tools.textContent = '';
      lenRow = keep; // the marks can still be dragged; the length stays
      var row = el('p', 'sheet-btns');
      row.appendChild(button('Save picture', 'btn', save));
      row.appendChild(button('Measure again', 'btn alt', reset));
      tools.appendChild(row);
      tools.appendChild(
        el('p', 'sheet-small', 'Measured from ' + fmt(v) + ' ' + unit + '. Drag the dots to fine-tune.'),
      );
    }

    /** Pointer drag for a mark or the piece: fn(pointNow, pointAtStart, valueAtStart). */
    function drag(node, fn) {
      node.addEventListener('pointerdown', function (e) {
        if (node === piece && !pos) return;
        e.preventDefault();
        e.stopPropagation();
        node.setPointerCapture(e.pointerId);
        var from = toPhoto(e),
          at = pos ? {x: pos.x, y: pos.y} : null;
        node.classList.add('held');
        function move(ev) {
          fn(toPhoto(ev), from, at);
          later();
        }
        function up() {
          node.classList.remove('held');
          node.removeEventListener('pointermove', move);
          node.removeEventListener('pointerup', up);
          node.removeEventListener('pointercancel', up);
        }
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerup', up);
        node.addEventListener('pointercancel', up);
      });
      node.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    function save() {
      if (!art) return;
      var W = wallImg.naturalWidth,
        H = wallImg.naturalHeight,
        k = Math.min(1, 4096 / Math.max(W, H));
      var c = document.createElement('canvas');
      c.width = Math.round(W * k);
      c.height = Math.round(H * k);
      var x = c.getContext('2d');
      x.drawImage(wallImg, 0, 0, c.width, c.height);
      var z = C.placed(size.widthIn, size.heightIn, inPerPx);
      x.save();
      x.shadowColor = 'rgba(0,0,0,0.35)';
      x.shadowBlur = (0.8 / inPerPx) * k;
      x.shadowOffsetX = (0.4 / inPerPx) * k;
      x.shadowOffsetY = (0.6 / inPerPx) * k;
      x.drawImage(art, (pos.x - z.w / 2) * k, (pos.y - z.h / 2) * k, z.w * k, z.h * k);
      x.restore();
      toBlob(c, 'image/jpeg', 0.9).then(function (b) {
        var name = 'on-my-wall.jpg';
        var file = typeof File === 'function' ? new File([b], name, {type: 'image/jpeg'}) : null;
        if (file && navigator.canShare && navigator.canShare({files: [file]}))
          navigator.share({files: [file], title: d.title}).catch(function () {});
        else {
          var a = el('a');
          a.href = url(b);
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      });
    }
  }

  // A count only (card G): no cookie, nothing about the visitor; the browser sends it when it can.
  function tell(kind, work) {
    try {
      var b = JSON.stringify(work ? {kind: kind, work: work} : {kind: kind});
      if (navigator.sendBeacon) navigator.sendBeacon('/count', new Blob([b], {type: 'application/json'}));
    } catch (e) { /* a count is never worth an error */ }
  }

  function open(btn) {
    if (back) return;
    var d = btn.dataset,
      size = C.pieceSize(d);
    if (!size) return;
    tell('wall', d.piece);
    opener = btn;
    css('/site/ask.css');
    css('/site/wall.css');
    back = el('div', 'sheet-back');
    var sheet = el('div', 'sheet wall-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'wall-h');
    var hdr = el('div', 'sheet-hdr');
    var h = el('h2', '', 'See it on your wall');
    h.id = 'wall-h';
    var x = button('×', 'sheet-x', close);
    x.setAttribute('aria-label', 'Close');
    hdr.appendChild(h);
    hdr.appendChild(x);
    var main = el('div', 'sheet-main');
    main.appendChild(el('p', 'sheet-note', d.title + ' · ' + dims(size)));
    sheet.appendChild(hdr);
    sheet.appendChild(main);
    back.appendChild(sheet);
    back.addEventListener('click', function (e) {
      if (e.target === back) close();
    });
    function key(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', key);
    cleanup.push(function () {
      document.removeEventListener('keydown', key);
    });
    if (AR) {
      main.appendChild(el('h3', 'wall-way', 'Live, through your camera'));
      live(main, d, size);
      main.appendChild(el('h3', 'wall-way', 'Or on a photo of your wall'));
    }
    photo(main, d, size);
    document.body.appendChild(back);
    document.documentElement.classList.add('sheet-open');
    x.focus();
  }

  // build is the live way's model maker, exposed so the site checks can open the USDZ it makes in any browser.
  window.StudioWall = {open: open, close: close, ar: AR, build: buildLive};
})();
