// The wall view's math, with no page in it (stage 5, D-157…D-160). Loaded with /site/wall.js on a tap.
//  - Photo way (from dm-t1's "Calibrate size"): two taps on something of known length give inches per photo pixel;
//    the piece is drawn width ÷ that many pixels wide.
//  - Live way (from AR-WALLE's public/model.mjs): a USDZ built here, meters, anchored to a vertical plane, a front with
//    the picture, four sides and a back in the side colour, a soft shadow in the half-inch gap behind it. ZIP_STORED
//    with 64-byte aligned payloads, as AR Quick Look wants.
(function (root) {
  var M = 0.0254; // meters per inch

  function toInches(v, unit) {
    return unit === 'cm' ? v / 2.54 : v;
  }

  /** Inches per photo pixel from two points (photo pixels) and the real distance between them. */
  function calibrate(a, b, realInches) {
    var d = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(realInches > 0)) throw new Error('length');
    if (d < 4) throw new Error('close');
    return realInches / d;
  }

  /** The piece's size in photo pixels. */
  function placed(widthIn, heightIn, inPerPx) {
    return {w: widthIn / inPerPx, h: heightIn / inPerPx};
  }

  /** The average colour of a picture's outer ring (RGBA bytes), as #rrggbb: the colour of the piece's sides. */
  function edgeColor(data, w, h) {
    var r = 0,
      g = 0,
      b = 0,
      n = 0,
      ring = Math.max(1, Math.round(Math.min(w, h) * 0.02));
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
        var i = (y * w + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    if (!n) return '#747474';
    var hex = function (v) {
      return ('0' + Math.round(v / n).toString(16)).slice(-2);
    };
    return '#' + hex(r) + hex(g) + hex(b);
  }

  // ---- USDZ (AR-WALLE's builder, one piece) ----
  var tuple = function (a) {
    return '(' + a.join(', ') + ')';
  };
  var linear = function (c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  function mesh(name, faces, mat, uv) {
    var pts = [];
    faces.forEach(function (f) {
      f.forEach(function (p) {
        pts.push([p[0], p[2], -p[1]]);
      });
    });
    return (
      'def Mesh "' +
      name +
      '" (prepend apiSchemas = ["MaterialBindingAPI"]) {\n' +
      ' uniform token subdivisionScheme = "none"\n bool doubleSided = false\n' +
      ' int[] faceVertexCounts = [' +
      faces
        .map(function () {
          return 4;
        })
        .join(',') +
      ']\n' +
      ' int[] faceVertexIndices = [' +
      pts
        .map(function (_, i) {
          return i;
        })
        .join(',') +
      ']\n' +
      ' point3f[] points = [' +
      pts.map(tuple).join(',') +
      ']\n' +
      (uv ? ' texCoord2f[] primvars:st = [(0,0),(1,0),(1,1),(0,1)] (interpolation = "faceVarying")\n' : '') +
      ' rel material:binding = </Artwork/Looks/' +
      mat +
      '>\n }'
    );
  }
  function quad(name, l, b, r, t, z, mat, uv) {
    return mesh(
      name,
      [
        [
          [l, b, z],
          [r, b, z],
          [r, t, z],
          [l, t, z],
        ],
      ],
      mat,
      uv !== false,
    );
  }
  function material(name, color, texture, alpha) {
    var path = '</Artwork/Looks/' + name;
    return (
      'def Material "' +
      name +
      '" {\n token outputs:surface.connect = ' +
      path +
      '/Surface.outputs:surface>\n' +
      ' def Shader "Surface" {\n uniform token info:id = "UsdPreviewSurface"\n' +
      ' color3f inputs:diffuseColor = ' +
      tuple(color) +
      '\n' +
      (texture ? ' color3f inputs:diffuseColor.connect = ' + path + '/Texture.outputs:rgb>\n' : '') +
      (alpha ? ' float inputs:opacity.connect = ' + path + '/Texture.outputs:a>\n' : '') +
      ' float inputs:roughness = 1\n float inputs:metallic = 0\n token outputs:surface\n }\n' +
      (texture
        ? ' def Shader "UV" { uniform token info:id = "UsdPrimvarReader_float2"\n token inputs:varname = "st"\n' +
          ' float2 outputs:result\n }\n def Shader "Texture" {\n uniform token info:id = "UsdUVTexture"\n' +
          ' asset inputs:file = @' +
          texture +
          '@\n token inputs:sourceColorSpace = "sRGB"\n' +
          ' token inputs:wrapS = "clamp"\n token inputs:wrapT = "clamp"\n' +
          ' float2 inputs:st.connect = ' +
          path +
          '/UV.outputs:result>\n float3 outputs:rgb\n float outputs:a\n }\n'
        : '') +
      ' }'
    );
  }

  /** The USD text for one piece: {widthIn, heightIn, depthIn, color '#rrggbb', texture 'art.jpeg', shadow}. */
  function scene(p) {
    var l = (-p.widthIn / 2) * M,
      r = (p.widthIn / 2) * M,
      b = (-p.heightIn / 2) * M,
      t = (p.heightIn / 2) * M;
    var back = 0.5 * M,
      front = (p.depthIn + 0.5) * M; // half an inch off the wall
    var side = [1, 3, 5].map(function (c) {
      return linear(parseInt(p.color.slice(c, c + 2), 16));
    });
    var geo = [
      quad('Front', l, b, r, t, front, 'Image'),
      mesh(
        'Panel',
        [
          [
            [r, b, back],
            [l, b, back],
            [l, t, back],
            [r, t, back],
          ],
          [
            [l, b, back],
            [r, b, back],
            [r, b, front],
            [l, b, front],
          ],
          [
            [r, t, back],
            [l, t, back],
            [l, t, front],
            [r, t, front],
          ],
          [
            [l, t, back],
            [l, b, back],
            [l, b, front],
            [l, t, front],
          ],
          [
            [r, b, back],
            [r, t, back],
            [r, t, front],
            [r, b, front],
          ],
        ],
        'Side',
      ),
    ];
    var mats = [material('Image', [1, 1, 1], p.texture), material('Side', side)];
    if (p.shadow) {
      var pad = Math.max(2 * M, Math.min(p.widthIn, p.heightIn) * M * 0.08);
      geo.push(quad('Shadow', l - pad + M, b - pad - 1.25 * M, r + pad + M, t + pad - 1.25 * M, 0.25 * M, 'Shadow'));
      mats.push(material('Shadow', [0, 0, 0], 'shadow.png', true));
    }
    return (
      '#usda 1.0\n(defaultPrim = "Artwork"\n metersPerUnit = 1\n upAxis = "Y"\n' +
      ' customLayerData = { dictionary Apple = { int preferredIblVersion = 2 } })\n' +
      'def Xform "Artwork" (prepend apiSchemas = ["Preliminary_AnchoringAPI"]\n kind = "component") {\n' +
      ' uniform token preliminary:anchoring:type = "plane"\n' +
      ' uniform token preliminary:planeAnchoring:alignment = "vertical"\n ' +
      geo.join('\n') +
      '\n def Scope "Looks" {\n ' +
      mats.join('\n') +
      '\n }\n}'
    );
  }

  var table = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = (c >>> 8) ^ table[(c ^ bytes[i]) & 255];
    return (c ^ 0xffffffff) >>> 0;
  }

  /** ZIP_STORED, payloads aligned to 64 bytes, first entry the USD layer. entries: [[name, Uint8Array]]. */
  function zip(entries) {
    var enc = new TextEncoder(),
      chunks = [],
      central = [],
      offset = 0;
    entries.forEach(function (e) {
      var name = enc.encode(e[0]),
        data = e[1],
        crc = crc32(data);
      var pad = (64 - ((offset + 30 + name.length) % 64)) % 64;
      if (pad > 0 && pad < 4) pad += 64;
      var h = new Uint8Array(30 + name.length + pad),
        v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true);
      v.setUint32(22, data.length, true);
      v.setUint16(26, name.length, true);
      v.setUint16(28, pad, true);
      h.set(name, 30);
      if (pad) {
        v.setUint16(30 + name.length, 0x1986, true);
        v.setUint16(32 + name.length, pad - 4, true);
      }
      var c = new Uint8Array(46 + name.length),
        cv = new DataView(c.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      c.set(name, 46);
      chunks.push(h, data);
      central.push(c);
      offset += h.length + data.length;
    });
    var size = central.reduce(function (s, c) {
        return s + c.length;
      }, 0),
      end = new Uint8Array(22),
      ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, size, true);
    ev.setUint32(16, offset, true);
    var all = chunks.concat(central, [end]),
      total = all.reduce(function (s, c) {
        return s + c.length;
      }, 0),
      out = new Uint8Array(total),
      at = 0;
    all.forEach(function (c) {
      out.set(c, at);
      at += c.length;
    });
    return out;
  }

  /** The USDZ bytes: the layer, the picture (JPEG bytes) and, when asked, the shadow (PNG bytes). */
  function usdz(p, jpeg, shadowPng) {
    var enc = new TextEncoder();
    var s = {
      widthIn: p.widthIn,
      heightIn: p.heightIn,
      depthIn: p.depthIn,
      color: p.color,
      texture: 'art.jpeg',
      shadow: !!shadowPng,
    };
    var entries = [
      ['model.usda', enc.encode(scene(s))],
      ['art.jpeg', jpeg],
    ];
    if (shadowPng) entries.push(['shadow.png', shadowPng]);
    return zip(entries);
  }

  /** The piece's size in inches from the button's data, or null without a width and height. Depth 1.5 in if empty (D-159). */
  function pieceSize(d) {
    var w = parseFloat(d.w),
      h = parseFloat(d.h),
      dp = parseFloat(d.d),
      u = d.unit === 'cm' ? 'cm' : 'in';
    if (!(w > 0) || !(h > 0)) return null;
    return {widthIn: toInches(w, u), heightIn: toInches(h, u), depthIn: dp > 0 ? toInches(dp, u) : 1.5};
  }

  var api = {
    calibrate: calibrate,
    placed: placed,
    edgeColor: edgeColor,
    scene: scene,
    zip: zip,
    crc32: crc32,
    usdz: usdz,
    pieceSize: pieceSize,
    toInches: toInches,
    METERS_PER_INCH: M,
  };
  root.StudioWallCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
