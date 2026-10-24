/* HZ Trip - peta milik sendiri (PDF) yang ditimpa di atas peta.
 * PDF diubah jadi kotak-kotak gambar beresolusi tinggi (beberapa tingkat zoom) dan disimpan di ponsel (IndexedDB).
 * Dipasang ke titik koordinat lewat kalibrasi 2-3 titik acuan. Digambar lewat lapisan canvas buatan sendiri
 * (bisa diputar/diskalakan), hanya kotak yang terlihat yang dimuat sehingga ringan. */
(function (root) {
  'use strict';
  var DBN = 'hzover', ST = 'tiles', TS = 1024;
  var dbp = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function putTile(key, blob) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).put(blob, key);
        tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function getTile(key) {
    return db().then(function (d) {
      return new Promise(function (res) {
        var q = d.transaction(ST, 'readonly').objectStore(ST).get(key);
        q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); };
      });
    });
  }
  function delOverlay(id) {
    return db().then(function (d) {
      return new Promise(function (res) {
        var tx = d.transaction(ST, 'readwrite');
        tx.objectStore(ST).delete(IDBKeyRange.bound(id + '|', id + '|￿'));
        tx.oncomplete = function () { res(); }; tx.onerror = function () { res(); };
      });
    });
  }

  // dialog konfirmasi sendiri (di atas layar kalibrasi/setel/bersihkan)
  function cfm(title, msg, okLabel, fn) {
    var d = document.createElement('div');
    d.className = 'cfm';
    d.innerHTML = '<div><b></b><p></p><div class="row"><button class="btn" data-n="1">Batal</button><button class="btn pri" data-y="1" style="background:var(--r);border-color:var(--r);color:#fff"></button></div></div>';
    d.querySelector('b').textContent = title; d.querySelector('p').textContent = msg; d.querySelector('[data-y]').textContent = okLabel;
    d.onclick = function (e) {
      if (e.target.getAttribute('data-y')) { d.remove(); fn(); }
      else if (e.target.getAttribute('data-n') || e.target === d) d.remove();
    };
    document.body.appendChild(d);
  }

  // ---------- impor PDF ----------
  function loadPdfJs() {
    if (root.pdfjsLib) return Promise.resolve(root.pdfjsLib);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'vendor/pdf.min.js';
      s.onload = function () { root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(root.pdfjsLib); };
      s.onerror = function () { rej(new Error('Pustaka PDF tidak ditemukan')); };
      document.head.appendChild(s);
    });
  }
  function levelsFor(W, H) {
    var out = [], lv = 0;
    for (;;) {
      var d = Math.pow(2, lv), w = Math.ceil(W / d), h = Math.ceil(H / d);
      out.push({ w: w, h: h, cols: Math.ceil(w / TS), rows: Math.ceil(h / TS) });
      if (Math.max(w, h) <= TS) break;
      lv++;
    }
    return out;
  }
  // Buka PDF: daftar layer (kalau ada), pratinjau, dan proses impor.
  function openPdf(file) {
    var lib0;
    return loadPdfJs().then(function (lib) {
      lib0 = lib;
      return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; });
    }).then(function (doc) {
      return doc.getOptionalContentConfig().catch(function () { return null; }).then(function (cfg) {
        var groups = cfg && cfg.getGroups ? cfg.getGroups() : null, layers = [];
        if (groups) Object.keys(groups).forEach(function (id) { layers.push({ id: id, name: String(groups[id].name || id), on: groups[id].visible !== false }); });
        function apply(hidden) { if (cfg) layers.forEach(function (l) { cfg.setVisibility(l.id, !(hidden && hidden[l.id])); }); }
        var h = {
          numPages: doc.numPages, layers: layers,
          preview: function (canvas, pageNo, hidden, maxPx) {
            apply(hidden);
            return doc.getPage(Math.min(Math.max(1, pageNo || 1), doc.numPages)).then(function (page) {
              var v1 = page.getViewport({ scale: 1 }), sc = maxPx / Math.max(v1.width, v1.height), vp = page.getViewport({ scale: sc });
              canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
              var cx = canvas.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, canvas.width, canvas.height);
              return page.render({ canvasContext: cx, viewport: vp, background: '#ffffff', optionalContentConfigPromise: cfg ? Promise.resolve(cfg) : undefined }).promise;
            });
          },
          // penampil layar penuh: cubit / seret / ketuk dua kali; dirender ulang tajam di zoom saat ini
          viewer: function (pageNo, hidden, title) {
            apply(hidden);
            return doc.getPage(Math.min(Math.max(1, pageNo || 1), doc.numPages)).then(function (page) {
              var v1 = page.getViewport({ scale: 1 }), el = document.createElement('div');
              el.id = 'pdfZoom';
              el.innerHTML = '<div class="cal-h"><b>' + (title || 'Periksa gambar') + '</b><button class="btn sm" id="pzOk">Tutup</button></div><div class="pzs"><canvas></canvas></div><div class="pzh">Cubit untuk zoom · seret untuk geser · ketuk dua kali untuk perbesar</div>';
              document.body.appendChild(el);
              var st = el.querySelector('.pzs'), cv = el.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
              var SW = st.clientWidth, SH = st.clientHeight, fit = Math.min(SW / v1.width, SH / v1.height);
              var V = { z: fit, x: (SW - v1.width * fit) / 2, y: (SH - v1.height * fit) / 2 }, R = null, task = null, tm = null, ptr = {}, lastTap = 0, dead = false;
              function clamp() {
                V.z = Math.max(fit * 0.8, Math.min(fit * 80, V.z));
                var pw = v1.width * V.z, ph = v1.height * V.z;
                V.x = pw <= SW ? (SW - pw) / 2 : Math.min(SW * 0.5, Math.max(SW * 0.5 - pw, V.x));
                V.y = ph <= SH ? (SH - ph) / 2 : Math.min(SH * 0.5, Math.max(SH * 0.5 - ph, V.y));
              }
              function css() {
                if (!R) return;
                var k = V.z / R.z;
                cv.style.transform = 'translate(' + (V.x - R.x * k) + 'px,' + (V.y - R.y * k) + 'px) scale(' + k + ')';
              }
              function render() {
                if (dead) return;
                if (task) { try { task.cancel(); } catch (e) {} task = null; }
                apply(hidden);
                var off = document.createElement('canvas'); off.width = Math.round(SW * dpr); off.height = Math.round(SH * dpr);
                var cx = off.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, off.width, off.height);
                var snap = { z: V.z, x: V.x, y: V.y };
                var vp = page.getViewport({ scale: snap.z * dpr, offsetX: snap.x * dpr, offsetY: snap.y * dpr });
                task = page.render({ canvasContext: cx, viewport: vp, background: '#ffffff', optionalContentConfigPromise: cfg ? Promise.resolve(cfg) : undefined });
                var tk = task;
                tk.promise.then(function () {
                  if (dead || task !== tk) return;
                  cv.width = off.width; cv.height = off.height; cv.getContext('2d').drawImage(off, 0, 0);
                  cv.style.width = SW + 'px'; cv.style.height = SH + 'px';
                  R = snap; css();
                }, function () {});
              }
              function later() { clearTimeout(tm); tm = setTimeout(function () { if (!Object.keys(ptr).length) render(); }, 180); }
              function pos(e) { var r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
              function zoomAt(px, py, nz) {
                nz = Math.max(fit * 0.8, Math.min(fit * 80, nz));
                V.x = px - (px - V.x) * nz / V.z; V.y = py - (py - V.y) * nz / V.z; V.z = nz; clamp(); css();
              }
              st.addEventListener('pointerdown', function (e) {
                try { st.setPointerCapture(e.pointerId); } catch (er) {}
                ptr[e.pointerId] = pos(e);
                if (Object.keys(ptr).length === 1) {
                  var now = Date.now();
                  if (now - lastTap < 300) { var p = pos(e); zoomAt(p.x, p.y, V.z > fit * 1.5 ? fit : V.z * 3); later(); lastTap = 0; } else lastTap = now;
                }
                e.preventDefault();
              });
              st.addEventListener('pointermove', function (e) {
                if (!ptr[e.pointerId]) return;
                var o = ptr[e.pointerId], n = pos(e), ids = Object.keys(ptr);
                if (ids.length === 1) { V.x += n.x - o.x; V.y += n.y - o.y; clamp(); css(); }
                else {
                  var oid = ids.filter(function (k) { return +k !== e.pointerId; })[0], q = ptr[oid];
                  var d0 = Math.hypot(o.x - q.x, o.y - q.y), d1 = Math.hypot(n.x - q.x, n.y - q.y);
                  var mx0 = (o.x + q.x) / 2, my0 = (o.y + q.y) / 2, mx1 = (n.x + q.x) / 2, my1 = (n.y + q.y) / 2;
                  if (d0 > 8) zoomAt(mx0, my0, V.z * d1 / d0);
                  V.x += mx1 - mx0; V.y += my1 - my0; clamp(); css();
                }
                ptr[e.pointerId] = n; e.preventDefault();
              });
              function up(e) { delete ptr[e.pointerId]; later(); }
              st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
              st.addEventListener('wheel', function (e) { var p = pos(e); zoomAt(p.x, p.y, V.z * (e.deltaY < 0 ? 1.25 : 0.8)); later(); e.preventDefault(); }, { passive: false });
              function close() { dead = true; clearTimeout(tm); if (task) { try { task.cancel(); } catch (e) {} } el.remove(); }
              el.querySelector('#pzOk').onclick = close;
              render();
              return { close: close };
            });
          },
          close: function () { try { doc.destroy(); } catch (e) {} },
          // opt: { name, page, longSide, hidden:{id:true} }
          run: function (opt, onProg) {
            var id = 'p' + Date.now().toString(36), bytes = 0;
            apply(opt.hidden);
            return doc.getPage(Math.min(Math.max(1, opt.page || 1), doc.numPages)).then(function (page) {
              var v1 = page.getViewport({ scale: 1 });
              var full = (opt.longSide || 9000) / Math.max(v1.width, v1.height);
              var W = Math.round(v1.width * full), H = Math.round(v1.height * full);
              var levels = levelsFor(W, H), total = 0, done = 0;
              levels.forEach(function (l) { total += l.cols * l.rows; });
              var jobs = [];
              levels.forEach(function (l, lv) { for (var ty = 0; ty < l.rows; ty++) for (var tx = 0; tx < l.cols; tx++) jobs.push([lv, tx, ty]); });
              var cv = document.createElement('canvas'), ctx = cv.getContext('2d');
              function next(k) {
                if (k >= jobs.length) return Promise.resolve();
                var j = jobs[k], lv = j[0], tx = j[1], ty = j[2], l = levels[lv];
                var tw = Math.min(TS, l.w - tx * TS), th = Math.min(TS, l.h - ty * TS);
                cv.width = tw; cv.height = th;
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tw, th);
                var vp = page.getViewport({ scale: full / Math.pow(2, lv), offsetX: -tx * TS, offsetY: -ty * TS });
                return page.render({ canvasContext: ctx, viewport: vp, background: '#ffffff', optionalContentConfigPromise: cfg ? Promise.resolve(cfg) : undefined }).promise.then(function () {
                  // PNG (tajam, cocok untuk garis); kalau terlalu besar (berisi foto) pakai JPEG
                  return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('Gagal membuat gambar')); }, 'image/png'); }).then(function (b) {
                    if (b.size <= 700000) return b;
                    return new Promise(function (res, rej) { cv.toBlob(function (b2) { b2 ? res(b2) : rej(new Error('Gagal membuat gambar')); }, 'image/jpeg', 0.86); });
                  });
                }).then(function (blob) {
                  bytes += blob.size;
                  return putTile(id + '|' + lv + '|' + tx + '|' + ty, blob);
                }).then(function () {
                  done++;
                  if (onProg) onProg(done / total);
                  return new Promise(function (r) { setTimeout(r, 0); }).then(function () { return next(k + 1); });
                });
              }
              return next(0).then(function () {
                return { id: id, name: opt.name || 'Peta', W: W, H: H, levels: levels, cal: null, on: true, bytes: bytes, edit: { keyBg: true, tol: 6, boost: 100, solid: true, sharp: 60, crop: null, erase: [] } };
              });
            }).catch(function (e) { delOverlay(id); throw e; });
          }
        };
        return h;
      });
    });
  }
  function importPdf(file, opt, onProg) {
    return openPdf(file).then(function (h) { return h.run(opt, onProg).then(function (m) { h.close(); return m; }, function (e) { h.close(); throw e; }); });
  }

  // ---------- kalibrasi: gambar (u,v) -> meter proyeksi EPSG:3857 ----------
  function worldOf(c) { var q = L.CRS.EPSG3857.project(L.latLng(c.lat, c.lng)); return { u: c.u, v: c.v, X: q.x, Y: q.y }; }
  function sim2(a, b) {
    // bilangan kompleks: p = (u, -v); dunia = a + c * (p - pa)
    var dpx = b.u - a.u, dpy = -(b.v - a.v), dX = b.X - a.X, dY = b.Y - a.Y, den = dpx * dpx + dpy * dpy;
    if (den < 1e-9) return null;
    var cr = (dX * dpx + dY * dpy) / den, ci = (dY * dpx - dX * dpy) / den;
    // X = Xa + cr*du + ci*dv ; Y = Ya + ci*du - cr*dv
    return { A: cr, B: ci, C: a.X - cr * a.u - ci * a.v, D: ci, E: -cr, F: a.Y - ci * a.u + cr * a.v };
  }
  function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }
  function aff3(P) {
    var M = [[P[0].u, P[0].v, 1], [P[1].u, P[1].v, 1], [P[2].u, P[2].v, 1]], d = det3(M);
    if (Math.abs(d) < 1e-6) return null;
    function sol(k) {
      var r = [];
      for (var c = 0; c < 3; c++) {
        var m = [M[0].slice(), M[1].slice(), M[2].slice()];
        for (var i = 0; i < 3; i++) m[i][c] = P[i][k];
        r.push(det3(m) / d);
      }
      return r;
    }
    var x = sol('X'), y = sol('Y');
    return { A: x[0], B: x[1], C: x[2], D: y[0], E: y[1], F: y[2] };
  }
  // cal: [{u,v,lat,lng}] -> {A..F} atau null
  function affineOf(cal) {
    if (!cal || cal.length < 2) return null;
    var P = cal.map(worldOf);
    if (P.length >= 3) { var a = aff3(P.slice(0, 3)); if (a) return a; }
    return sim2(P[0], P[1]);
  }
  function toLLFn(af) {
    return function (u, v) {
      return L.CRS.EPSG3857.unproject(L.point(af.A * u + af.B * v + af.C, af.D * u + af.E * v + af.F));
    };
  }
  // selisih (meter di tanah) titik ke-3 terhadap prediksi dari titik 1-2
  function residual(cal) {
    if (!cal || cal.length < 3) return null;
    var P = cal.map(worldOf), s = sim2(P[0], P[1]);
    if (!s) return null;
    var X = s.A * P[2].u + s.B * P[2].v + s.C, Y = s.D * P[2].u + s.E * P[2].v + s.F;
    return Math.sqrt(Math.pow(X - P[2].X, 2) + Math.pow(Y - P[2].Y, 2)) * Math.cos(cal[2].lat * Math.PI / 180);
  }
  function info(cal) {
    var af = affineOf(cal);
    if (!af) return null;
    var sc = Math.sqrt(af.A * af.A + af.D * af.D) * Math.cos(cal[0].lat * Math.PI / 180);
    var rot = Math.atan2(af.D, af.A) * 180 / Math.PI;
    return { mpp: sc, rot: rot };
  }

  // latar kertas -> transparan: alpha = kegelapan piksel (0 = putih); warna dikembalikan seperti sebelum bercampur putih
  var scratch = null;
  function keyOut(bm, ed) {
    if (!scratch) scratch = document.createElement('canvas');
    var w = bm.width, h = bm.height;
    scratch.width = w; scratch.height = h;
    var c = scratch.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, w, h); c.drawImage(bm, 0, 0);
    var im = c.getImageData(0, 0, w, h), d = im.data, t = Math.min(0.9, (ed.tol || 0) / 100), inv = 1 / (1 - t), bo = (ed.boost || 100) / 100;
    if (ed.solid) {
      // garis hitam pekat: kegelapan dipertegas jadi satu warna (hitam); tepi halus tipis, bayangan abu-abu hilang
      var sh = ed.sharp == null ? 60 : ed.sharp, ww = 0.6 * (1 - sh / 100) + 0.06, mid = Math.max(0.15, 0.5 - (bo - 1) * 0.15);
      var lo = Math.max(t, mid - ww / 2), hi = Math.max(lo + 0.02, lo + ww);
      for (var j = 0; j < d.length; j += 4) {
        var r2 = d[j], g2 = d[j + 1], b2 = d[j + 2], m2 = r2 < g2 ? (r2 < b2 ? r2 : b2) : (g2 < b2 ? g2 : b2), a0 = (255 - m2) / 255;
        if (a0 <= lo) { d[j + 3] = 0; continue; }
        var q = (a0 - lo) / (hi - lo); if (q > 1) q = 1;
        d[j] = d[j + 1] = d[j + 2] = 0; d[j + 3] = q * q * (3 - 2 * q) * 255;
      }
      c.putImageData(im, 0, 0);
      bm.close();
      return createImageBitmap(scratch);
    }
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2], m = r < g ? (r < b ? r : b) : (g < b ? g : b), a = (255 - m) / 255;
      if (a <= t) { d[i + 3] = 0; continue; }
      d[i] = 255 - (255 - r) / a; d[i + 1] = 255 - (255 - g) / a; d[i + 2] = 255 - (255 - b) / a;
      var a2 = (a - t) * inv * bo; d[i + 3] = (a2 > 1 ? 1 : a2) * 255;
    }
    c.putImageData(im, 0, 0);
    bm.close();
    return createImageBitmap(scratch);
  }

  // ---------- lapisan canvas ----------
  var LayerCls = null;
  function layerClass() {
    if (LayerCls) return LayerCls;
    var PAD = 0.3;
    LayerCls = L.Layer.extend({
      initialize: function (meta, opts) {
        this.meta = meta; this.opts = opts || {};
        this._bm = {}; this._ord = []; this._pend = {}; this._raf = 0;
        this._toLL = opts.toLL; this._sig = this._sigNow();
      },
      _sigNow: function () { var e = this.meta.edit; return e && e.keyBg ? (e.tol + '|' + (e.boost || 100) + '|' + (e.solid ? 's' + (e.sharp == null ? 60 : e.sharp) : 'n')) : '0'; },
      _flush: function () {
        for (var k in this._bm) { try { this._bm[k].close(); } catch (e) {} }
        this._bm = {}; this._ord = []; this._pend = {};
      },
      setToLL: function (fn) { this._toLL = fn; if (this._map) this._draw(); },
      setOpacity: function (o) { this.opts.opacity = o; if (this._canvas) this._canvas.style.opacity = o; },
      onAdd: function (map) {
        if (!map.getPane('ovlPane')) { var p = map.createPane('ovlPane'); p.style.zIndex = 250; p.style.pointerEvents = 'none'; }
        var c = this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated');
        c.style.pointerEvents = 'none';
        c.style.opacity = this.opts.opacity == null ? 1 : this.opts.opacity;
        map.getPane('ovlPane').appendChild(c);
        this._update();
      },
      onRemove: function () {
        L.DomUtil.remove(this._canvas); this._canvas = null;
        for (var k in this._bm) { try { this._bm[k].close(); } catch (e) {} }
        this._bm = {}; this._ord = []; this._pend = {};
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
      },
      getEvents: function () { return { moveend: this._update, resize: this._update, viewreset: this._update, zoomanim: this._animZoom }; },
      _animZoom: function (e) {
        var m = this._map, scale = m.getZoomScale(e.zoom, this._zoom),
          viewHalf = m.getSize().multiplyBy(0.5 + PAD),
          cur = m.project(this._center, e.zoom),
          off = viewHalf.multiplyBy(-scale).add(cur).subtract(m._getNewPixelOrigin(e.center, e.zoom));
        L.DomUtil.setTransform(this._canvas, off, scale);
      },
      _update: function () {
        if (!this._canvas || !this._map) return;
        var m = this._map, size = m.getSize(), min = m.containerPointToLayerPoint(size.multiplyBy(-PAD)).round(), sz = size.multiplyBy(1 + PAD * 2).round();
        this._min = min; this._center = m.getCenter(); this._zoom = m.getZoom();
        this._canvas.width = sz.x; this._canvas.height = sz.y;
        L.DomUtil.setPosition(this._canvas, min);
        this._draw();
      },
      _redraw: function () {
        var me = this;
        if (me._raf) return;
        me._raf = requestAnimationFrame(function () { me._raf = 0; if (me._canvas) me._draw(); });
      },
      _need: function (key) {
        var me = this;
        if (this._pend[key]) return;
        this._pend[key] = 1;
        var sig = this._sig, ed = this.meta.edit;
        getTile(this.meta.id + '|' + key).then(function (blob) {
          if (!blob || !me._canvas) { delete me._pend[key]; return null; }
          return createImageBitmap(blob).then(function (bm) { return sig !== '0' && ed ? keyOut(bm, ed) : bm; });
        }).then(function (bm) {
          if (!bm) return;
          if (sig !== me._sig) { try { bm.close(); } catch (e) {} return; }
          delete me._pend[key];
          if (!me._canvas) { bm.close(); return; }
          me._bm[key] = bm; me._ord.push(key);
          while (me._ord.length > 48) { var o = me._ord.shift(); try { me._bm[o].close(); } catch (e) {} delete me._bm[o]; }
          me._redraw();
        }).catch(function () { delete me._pend[key]; });
      },
      _draw: function () {
        var c = this._canvas, m = this._map, meta = this.meta;
        if (!c || !m || !this._toLL) return;
        var ctx = c.getContext('2d');
        var sg = this._sigNow();
        if (sg !== this._sig) { this._flush(); this._sig = sg; }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        var min = this._min, W = meta.W, H = meta.H, me = this;
        function pt(u, v) { var p = m.latLngToLayerPoint(me._toLL(u, v)); return { x: p.x - min.x, y: p.y - min.y }; }
        var p0 = pt(0, 0), p1 = pt(W, 0), p2 = pt(0, H);
        var sx = Math.hypot(p1.x - p0.x, p1.y - p0.y) / W, sy = Math.hypot(p2.x - p0.x, p2.y - p0.y) / H, s = Math.max(sx, sy);
        if (!isFinite(s) || s <= 0) return;
        var maxLv = meta.levels.length - 1;
        var lv = Math.min(maxLv, Math.max(0, Math.floor(Math.log(1 / s) / Math.LN2)));
        var drawn = {};
        function drawLevel(L1, force) {
          var l = meta.levels[L1];
          var ax = (p1.x - p0.x) / l.w, ay = (p1.y - p0.y) / l.w, bx = (p2.x - p0.x) / l.h, by = (p2.y - p0.y) / l.h;
          ctx.setTransform(ax, ay, bx, by, p0.x, p0.y);
          var allOk = true;
          for (var ty = 0; ty < l.rows; ty++) for (var tx = 0; tx < l.cols; tx++) {
            var x0 = tx * TS, y0 = ty * TS, x1 = Math.min(l.w, x0 + TS), y1 = Math.min(l.h, y0 + TS);
            var xs = [x0, x1, x0, x1], ys = [y0, y0, y1, y1], mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
            for (var q = 0; q < 4; q++) {
              var X = ax * xs[q] + bx * ys[q] + p0.x, Y = ay * xs[q] + by * ys[q] + p0.y;
              if (X < mnx) mnx = X; if (X > mxx) mxx = X; if (Y < mny) mny = Y; if (Y > mxy) mxy = Y;
            }
            if (mxx < 0 || mxy < 0 || mnx > c.width || mny > c.height) continue;
            var key = L1 + '|' + tx + '|' + ty, bm = me._bm[key];
            if (bm) ctx.drawImage(bm, x0, y0, x1 - x0 + 0.6, y1 - y0 + 0.6);
            else { allOk = false; me._need(key); }
          }
          return allOk;
        }
        // lapis kasar dulu sebagai cadangan selagi kotak halus dimuat
        if (lv < maxLv) drawLevel(maxLv, true);
        if (lv < maxLv - 1 || lv === maxLv) { /* tidak perlu lapis tengah */ }
        drawLevel(lv, false);
        // pangkas & hapus kotak (koordinat piksel gambar penuh)
        var ed = meta.edit;
        if (ed && (ed.crop || (ed.erase && ed.erase.length))) {
          ctx.setTransform((p1.x - p0.x) / W, (p1.y - p0.y) / W, (p2.x - p0.x) / H, (p2.y - p0.y) / H, p0.x, p0.y);
          ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
          var cut = [];
          if (ed.crop) {
            var q = ed.crop;
            cut.push([-2, -2, W + 4, q.y0 + 2], [-2, q.y1, W + 4, H - q.y1 + 2], [-2, q.y0, q.x0 + 2, q.y1 - q.y0], [q.x1, q.y0, W - q.x1 + 2, q.y1 - q.y0]);
          }
          (ed.erase || []).forEach(function (r) { cut.push([r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0]); });
          cut.forEach(function (r) { ctx.fillRect(r[0], r[1], r[2], r[3]); });
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    });
    return LayerCls;
  }
  function makeLayer(meta, opts) { return new (layerClass())(meta, opts); }

  // ---------- layar kalibrasi ----------
  // ctx: { base(map) -> lapisan dasar, center:[lat,lng], toast(msg), onSave(cal), opacity }
  function calibrate(meta, cx) {
    var cal = (meta.cal || []).slice(0, 0), step = 0; // step: 0=gambar1,1=peta1,2=gambar2,3=peta2,4=tinjau,5=gambar3,6=peta3
    var el = document.createElement('div');
    el.id = 'calUI';
    el.innerHTML = '<div class="cal-h"><b id="calT"></b><button class="btn sm" id="calX">Tutup</button></div>' +
      '<div class="cal-s" id="calS"></div>' +
      '<div class="cal-geo" id="calGeo"><input id="calLL" placeholder="Ke koordinat, mis. -4.95, 105.20"><button class="btn sm" id="calGo">Ke sana</button></div>' +
      '<div class="cal-m"><div id="calImg" class="cal-map"></div><div id="calMap" class="cal-map"></div><div class="cal-cross" id="calCross"><i></i><b></b></div></div>' +
      '<div class="cal-o" id="calO"><span>Transparansi</span><input type="range" id="calOp" min="20" max="100" value="70"></div>' +
      '<div class="cal-b" id="calB"></div>';
    document.body.appendChild(el);
    function $(id) { return el.querySelector('#' + id); }

    var imgMap = L.map($('calImg'), { crs: L.CRS.Simple, minZoom: -8, maxZoom: 3, zoomControl: false, attributionControl: false, zoomSnap: 0.25, preferCanvas: true });
    var imgLayer = makeLayer(meta, { toLL: function (u, v) { return L.latLng(-v, u); } }).addTo(imgMap);
    imgMap.fitBounds([[-meta.H, 0], [0, meta.W]]);
    var geoMap = null, geoLayer = null, imgMk = L.layerGroup().addTo(imgMap), geoMk = null;

    function ensureGeo() {
      if (geoMap) return;
      geoMap = L.map($('calMap'), { zoomControl: false, attributionControl: false, preferCanvas: true, maxZoom: 19 });
      cx.base(geoMap);
      if (cx.locate) cx.locate(geoMap);
      geoMap.setView(cx.center || [-4.95, 105.2], 16);
      geoMk = L.layerGroup().addTo(geoMap);
    }
    function mk(group, ll, n) { L.circleMarker(ll, { radius: 9, color: '#fff', weight: 2, fillColor: '#FF5B50', fillOpacity: 1 }).bindTooltip(String(n), { permanent: true, direction: 'center', className: 'cal-tip' }).addTo(group); }
    function refreshOverlay() {
      var af = affineOf(cal);
      if (!af) { if (geoLayer) { geoMap.removeLayer(geoLayer); geoLayer = null; } return; }
      if (!geoLayer) geoLayer = makeLayer(meta, { toLL: toLLFn(af), opacity: $('calOp').value / 100 }).addTo(geoMap);
      else geoLayer.setToLL(toLLFn(af));
    }
    var ZH = ['GAMBAR', 'PETA', 'GAMBAR', 'PETA', 'TINJAU', 'GAMBAR', 'PETA'];
    function show() {
      var geo = (step === 1 || step === 3 || step === 4 || step === 6);
      $('calImg').style.display = geo ? 'none' : 'block';
      $('calMap').style.display = geo ? 'block' : 'none';
      $('calCross').style.display = step === 4 ? 'none' : 'block';
      $('calGeo').style.display = (step === 1 || step === 3 || step === 6) ? 'flex' : 'none';
      $('calO').style.display = step === 4 ? 'flex' : 'none';
      if (geo) { ensureGeo(); geoMap.invalidateSize(); } else imgMap.invalidateSize();
      var n = step === 0 || step === 1 ? 1 : (step === 2 || step === 3 ? 2 : 3);
      var t, s, b = '';
      if (step === 4) {
        var inf = info(cal), res = residual(cal);
        t = 'Periksa hasil';
        s = 'Gambar kini menimpa peta satelit. Geser transparansi, zoom ke beberapa tempat dan cek apakah jalan/blok pas.' +
          (inf ? '<br>Skala ± ' + inf.mpp.toFixed(2).replace('.', ',') + ' m per piksel · putaran ' + inf.rot.toFixed(1).replace('.', ',') + '°' : '') +
          (res !== null ? '<br>Selisih titik 3 dari perkiraan titik 1–2: <b>' + res.toFixed(1).replace('.', ',') + ' m</b>' : '');
        b = '<button class="btn" id="cRe">Ulangi</button>' + (cal.length < 3 ? '<button class="btn" id="cAdd">+ Titik 3</button>' : '') + '<button class="btn pri" id="cOk">Simpan</button>';
      } else {
        t = 'Titik ' + n + ' · ' + ZH[step];
        if (!geo) s = 'Geser/zoom <b>GAMBAR</b> sampai tanda + tepat di atas suatu titik jelas (perempatan jalan, sudut blok, jembatan). ' + (n === 2 ? 'Pilih titik yang <b>jauh</b> dari titik 1.' : (n === 3 ? 'Pilih titik yang tidak segaris dengan titik 1–2.' : ''));
        else s = 'Sekarang geser <b>PETA SATELIT</b> sampai tanda + berada di titik yang <b>sama</b>. Atau ketik koordinatnya di kotak atas.';
        b = '<button class="btn" id="cBack">' + (step === 0 ? 'Batal' : 'Kembali') + '</button><button class="btn pri" id="cSet">' + (geo ? 'Pasang titik ' + n : 'Titik ini →') + '</button>';
      }
      $('calT').textContent = t; $('calS').innerHTML = s; $('calB').innerHTML = b;
    }
    function close() {
      try { imgMap.remove(); } catch (e) {}
      try { if (geoMap) geoMap.remove(); } catch (e) {}
      el.remove();
    }
    function setPoint() {
      var n = step === 0 || step === 1 ? 0 : (step === 2 || step === 3 ? 1 : 2);
      if (step === 0 || step === 2 || step === 5) {
        var c = imgMap.getCenter();
        cal[n] = { u: c.lng, v: -c.lat };
        step++;
      } else {
        var g = geoMap.getCenter();
        cal[n].lat = g.lat; cal[n].lng = g.lng;
        mk(imgMk, L.latLng(-cal[n].v, cal[n].u), n + 1);
        mk(geoMk, g, n + 1);
        step = n === 0 ? 2 : 4;
        if (step === 4) refreshOverlay();
      }
      show();
    }
    el.onclick = function (e) {
      var id = e.target.id;
      if (id === 'calX') { close(); }
      else if (id === 'cSet') setPoint();
      else if (id === 'cBack') {
        if (step === 0) { close(); return; }
        if (step === 1 || step === 3 || step === 6) { step--; cal.length = Math.max(0, (step === 0 ? 0 : step === 2 ? 1 : 2)); }
        else if (step === 2) { step = 1; }
        else if (step === 5) { step = 4; cal.length = 2; }
        show();
      }
      else if (id === 'cRe') { cfm('Ulangi dari awal?', 'Titik acuan yang sudah dipasang dihapus.', 'Ulangi', function () { cal = []; imgMk.clearLayers(); if (geoMk) geoMk.clearLayers(); refreshOverlay(); step = 0; show(); }); }
      else if (id === 'cAdd') { step = 5; show(); }
      else if (id === 'cOk') { cx.onSave(cal.slice()); close(); }
      else if (id === 'calGo') {
        var m = $('calLL').value.match(/-?\d+(?:[.,]\d+)?/g);
        if (m && m.length >= 2) { var la = parseFloat(m[0].replace(',', '.')), ln = parseFloat(m[1].replace(',', '.')); if (isFinite(la) && isFinite(ln) && Math.abs(la) <= 85 && Math.abs(ln) <= 180) { ensureGeo(); geoMap.setView([la, ln], 19); return; } }
        cx.toast('Format: -4.95, 105.20');
      }
    };
    $('calOp').oninput = function () { if (geoLayer) geoLayer.setOpacity(this.value / 100); };
    show();
    return { close: close };
  }

  // ---------- setel lapisan (geser/cubit/putar + tombol halus) ----------
  function affOf(meta) { return meta.aff || affineOf(meta.cal); }
  function infoAff(af, lat) {
    var cu = Math.hypot(af.A, af.D), cv = Math.hypot(af.B, af.E), k = Math.cos(lat * Math.PI / 180);
    return { mpp: (cu + cv) / 2 * k, rot: Math.atan2(af.D, af.A) * 180 / Math.PI, ratio: cu / cv };
  }
  function mulT(af, a0, a1, cr, ci) {
    // dunia' = a1 + c * (dunia - a0)
    var M = [[cr * af.A - ci * af.D, cr * af.B - ci * af.E], [ci * af.A + cr * af.D, ci * af.B + cr * af.E]];
    var tx = af.C - a0.x, ty = af.F - a0.y;
    return { A: M[0][0], B: M[0][1], D: M[1][0], E: M[1][1], C: a1.x + cr * tx - ci * ty, F: a1.y + ci * tx + cr * ty };
  }
  function scaleAxes(af, p, sx, sy) {
    var det = af.A * af.E - af.B * af.D;
    if (Math.abs(det) < 1e-12) return af;
    var dx = p.x - af.C, dy = p.y - af.F;
    var qu = (af.E * dx - af.B * dy) / det, qv = (-af.D * dx + af.A * dy) / det;
    var n = { A: af.A * sx, B: af.B * sy, D: af.D * sx, E: af.E * sy };
    n.C = p.x - (n.A * qu + n.B * qv); n.F = p.y - (n.D * qu + n.E * qv);
    return n;
  }
  // cx: { base(map), locate(map), extra(map), center, opacity, onOpacity(v), toast, onSave(af) }
  function tune(meta, cx) {
    var af = Object.assign({}, affOf(meta)), initial = Object.assign({}, af);
    var reset = meta.cal && affineOf(meta.cal) ? affineOf(meta.cal) : initial;
    var hist = [], fine = true, target = 'all', mode = 'img', op = cx.opacity == null ? 0.8 : cx.opacity;
    var el = document.createElement('div');
    el.id = 'tuneUI';
    el.innerHTML = '<div class="cal-h"><b>Setel lapisan</b><span style="display:flex;gap:8px"><button class="btn sm" id="tClean">Bersihkan</button><button class="btn sm" id="tNo">Batal</button></span></div>' +
      '<div class="seg tseg" id="tMode"><button data-m="img" class="on">Geser gambar</button><button data-m="map">Geser peta</button></div>' +
      '<div class="cal-s" id="tInfo"></div>' +
      '<div class="cal-m"><div id="tMap" class="cal-map"></div><div class="cal-cross" id="tCross"><i></i><b></b></div></div>' +
      '<div class="tpanel" id="tPanel"><button class="btn sm tfold" id="tFold">Kontrol ▾</button><div id="tCtl">' +
      '<div class="trow"><span>Putar</span><button class="btn" data-a="rl">⟲</button><button class="btn" data-a="rr">⟳</button><span>Skala</span><button class="btn" data-a="sm">−</button><button class="btn" data-a="sp">+</button></div>' +
      '<div class="trow"><span>Geser</span><button class="btn" data-a="gl">◀</button><button class="btn" data-a="gu">▲</button><button class="btn" data-a="gd">▼</button><button class="btn" data-a="gr">▶</button></div>' +
      '<div class="trow"><span>Langkah</span><div class="seg" id="tStep"><button data-v="1" class="on">Halus</button><button data-v="0">Kasar</button></div><span>Skala</span><div class="seg" id="tTgt"><button data-v="all" class="on">Semua</button><button data-v="w">Lebar</button><button data-v="h">Tinggi</button></div></div>' +
      '<div class="trow"><span>Transparansi</span><input type="range" id="tOp" min="20" max="100" value="' + Math.round(op * 100) + '"></div></div>' +
      '<div class="cal-b"><button class="btn" id="tUndo">Urungkan</button><button class="btn" id="tReset">Reset</button><button class="btn pri" id="tOk">Simpan</button></div></div>';
    document.body.appendChild(el);
    function $(id) { return el.querySelector('#' + id); }
    var map = L.map($('tMap'), { zoomControl: false, attributionControl: false, preferCanvas: true, maxZoom: 19, zoomSnap: 0.25 });
    cx.base(map);
    if (cx.locate) cx.locate(map);
    var c0 = cx.center || (function () { var q = L.CRS.EPSG3857.unproject(L.point(af.A * meta.W / 2 + af.B * meta.H / 2 + af.C, af.D * meta.W / 2 + af.E * meta.H / 2 + af.F)); return [q.lat, q.lng]; })();
    map.setView(c0, 17);
    var layer = makeLayer(meta, { toLL: toLLFn(af), opacity: op }).addTo(map);
    if (cx.extra) cx.extra(map);
    var raf = 0;
    function info() {
      var c = map.getCenter(), i = infoAff(af, c.lat);
      $('tInfo').innerHTML = 'Skala ' + i.mpp.toFixed(3).replace('.', ',') + ' m/piksel · putaran ' + i.rot.toFixed(2).replace('.', ',') + '° · lebar/tinggi ' + i.ratio.toFixed(4).replace('.', ',') +
        '<br>Tanda + = pusat putar &amp; skala. ' + (mode === 'img' ? 'Seret 1 jari = geser, 2 jari = cubit &amp; putar.' : 'Mode ini hanya menggeser/zoom peta.');
    }
    function apply(n, noHist) {
      if (!noHist) { hist.push(af); if (hist.length > 60) hist.shift(); }
      af = n;
      layer.setToLL(toLLFn(af));
      info();
    }
    function sched(n) { af = n; if (!raf) raf = requestAnimationFrame(function () { raf = 0; layer.setToLL(toLLFn(af)); info(); }); }
    function W(x, y) { var q = L.CRS.EPSG3857.project(map.containerPointToLatLng(L.point(x, y))); return { x: q.x, y: q.y }; }
    function ctr() { var s = map.getSize(); return W(s.x / 2, s.y / 2); }
    function k() { return 1 / Math.cos(map.getCenter().lat * Math.PI / 180); } // meter tanah -> meter dunia
    function stepV() { return fine ? { rot: 0.1, sc: 0.001, sh: 1 } : { rot: 1, sc: 0.01, sh: 10 }; }
    function act(a, first) {
      var p = ctr(), v = stepV(), n;
      if (a === 'rl' || a === 'rr') { var th = (a === 'rl' ? 1 : -1) * v.rot * Math.PI / 180; n = mulT(af, p, p, Math.cos(th), Math.sin(th)); }
      else if (a === 'sm' || a === 'sp') {
        var f = a === 'sp' ? 1 + v.sc : 1 / (1 + v.sc);
        n = target === 'all' ? mulT(af, p, p, f, 0) : scaleAxes(af, p, target === 'w' ? f : 1, target === 'h' ? f : 1);
      } else {
        var d = v.sh * k(), dx = a === 'gl' ? -d : (a === 'gr' ? d : 0), dy = a === 'gu' ? d : (a === 'gd' ? -d : 0);
        n = mulT(af, p, { x: p.x + dx, y: p.y + dy }, 1, 0);
      }
      if (first) { hist.push(af); if (hist.length > 60) hist.shift(); }
      af = n; layer.setToLL(toLLFn(af)); info();
    }
    // tombol dengan ulang saat ditahan
    $('tCtl').addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'), t1, t2;
      act(a, true);
      t1 = setTimeout(function () { t2 = setInterval(function () { act(a, false); }, 80); }, 400);
      function stop() { clearTimeout(t1); clearInterval(t2); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); }
      window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
      e.preventDefault();
    });
    $('tStep').onclick = function (e) { var v = e.target.getAttribute('data-v'); if (v === null) return; fine = v === '1'; this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === e.target); }); };
    $('tTgt').onclick = function (e) { var v = e.target.getAttribute('data-v'); if (v === null) return; target = v; this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === e.target); }); };
    $('tOp').oninput = function () { op = this.value / 100; layer.setOpacity(op); };
    $('tOp').onchange = function () { if (cx.onOpacity) cx.onOpacity(op); };
    $('tFold').onclick = function () { var c = $('tCtl'), h = c.style.display === 'none'; c.style.display = h ? 'block' : 'none'; this.textContent = 'Kontrol ' + (h ? '▾' : '▴'); map.invalidateSize(); };
    // mode
    var ptrs = {}, cont = map.getContainer();
    function setMode(m) {
      mode = m;
      $('tMode').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === m); });
      var on = m === 'map';
      ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'boxZoom'].forEach(function (h) { if (map[h]) on ? map[h].enable() : map[h].disable(); });
      cont.style.touchAction = on ? '' : 'none';
      info();
    }
    $('tMode').onclick = function (e) { var m = e.target.getAttribute('data-m'); if (m) setMode(m); };
    function pos(e) { var r = cont.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cont.addEventListener('pointerdown', function (e) {
      if (mode !== 'img' || e.target.closest('.locbtn')) return;
      var first = !Object.keys(ptrs).length;
      ptrs[e.pointerId] = pos(e);
      if (first) { hist.push(af); if (hist.length > 60) hist.shift(); }
      try { cont.setPointerCapture(e.pointerId); } catch (er) {}
      e.preventDefault();
    });
    cont.addEventListener('pointermove', function (e) {
      if (mode !== 'img' || !ptrs[e.pointerId]) return;
      var ids = Object.keys(ptrs), old = ptrs[e.pointerId], cur = pos(e), n;
      if (ids.length === 1) {
        var a0 = W(old.x, old.y), a1 = W(cur.x, cur.y);
        n = mulT(af, a0, a1, 1, 0);
      } else {
        var oid = ids.filter(function (i) { return +i !== e.pointerId; })[0], o = ptrs[oid];
        var a0 = W(o.x, o.y), b0 = W(old.x, old.y), b1 = W(cur.x, cur.y);
        var dx0 = b0.x - a0.x, dy0 = b0.y - a0.y, dx1 = b1.x - a0.x, dy1 = b1.y - a0.y, den = dx0 * dx0 + dy0 * dy0;
        if (den < 1e-9) return;
        var cr = (dx1 * dx0 + dy1 * dy0) / den, ci = (dy1 * dx0 - dx1 * dy0) / den;
        n = mulT(af, a0, a0, cr, ci); // dua jari: titik jari lain tetap
      }
      ptrs[e.pointerId] = cur;
      sched(n);
      e.preventDefault();
    });
    function up(e) { delete ptrs[e.pointerId]; }
    cont.addEventListener('pointerup', up); cont.addEventListener('pointercancel', up);
    $('tUndo').onclick = function () { if (hist.length) { af = hist.pop(); layer.setToLL(toLLFn(af)); info(); } else if (cx.toast) cx.toast('Tidak ada yang diurungkan'); };
    $('tReset').onclick = function () { cfm('Kembali ke hasil kalibrasi?', 'Geser, putar, dan skala yang Anda setel dibatalkan.', 'Reset', function () { apply(Object.assign({}, reset)); }); };
    function close() { try { map.remove(); } catch (e) {} el.remove(); }
    $('tNo').onclick = close;
    $('tClean').onclick = function () { clean(meta, { onChange: function () { layer._draw(); }, onDone: function () { if (cx.onClean) cx.onClean(); } }); };
    $('tOk').onclick = function () { cx.onSave(Object.assign({}, af)); close(); };
    setMode('img');
    return { close: close };
  }

  // ---------- bersihkan gambar (latar, pangkas, hapus kotak) ----------
  // cx: { onChange(), onDone(edit) }
  function clean(meta, cx) {
    var ed0 = JSON.stringify(meta.edit || null);
    if (!meta.edit) meta.edit = { keyBg: false, tol: 6, boost: 100, solid: false, sharp: 60, crop: null, erase: [] };
    var ed = meta.edit; if (!ed.erase) ed.erase = []; if (ed.boost == null) ed.boost = 100; if (ed.tol == null) ed.tol = 6; if (ed.sharp == null) ed.sharp = 60;
    var hist = [], mode = 'pan', drag = null;
    var el = document.createElement('div');
    el.id = 'cleanUI';
    el.innerHTML = '<div class="cal-h"><b>Bersihkan gambar</b><button class="btn sm" id="kNo">Batal</button></div>' +
      '<div class="seg tseg" id="kMode"><button data-m="pan" class="on">Geser</button><button data-m="crop">Pangkas</button><button data-m="erase">Hapus kotak</button></div>' +
      '<div class="cal-s" id="kHelp"></div>' +
      '<div class="cal-m"><div id="kMap" class="cal-map" style="background:#C9D3CF"></div></div>' +
      '<div class="tpanel"><div class="trow"><label style="display:flex;align-items:center;gap:8px;flex:1;color:var(--tx3)"><input type="checkbox" id="kKey" style="width:20px;height:20px"> Hapus latar kertas</label></div>' +
      '<div class="trow"><label style="display:flex;align-items:center;gap:8px;flex:1;color:var(--tx3)"><input type="checkbox" id="kSolid" style="width:20px;height:20px"> Garis hitam pekat</label></div>' +
      '<div class="trow"><span>Bersihkan noda</span><input type="range" id="kSharp" min="0" max="100" step="5" value="60"><b id="kSharpV" style="min-width:34px;color:var(--tx3)"></b></div>' +
      '<div class="trow"><span>Toleransi</span><input type="range" id="kTol" min="0" max="40" value="6"><b id="kTolV" style="min-width:34px;color:var(--tx3)"></b></div>' +
      '<div class="trow"><span>Tebal garis</span><input type="range" id="kBoost" min="100" max="300" step="10" value="100"><b id="kBoostV" style="min-width:34px;color:var(--tx3)"></b></div>' +
      '<div class="trow" id="kBoxes" style="flex-wrap:wrap"></div>' +
      '<div class="cal-b"><button class="btn" id="kUndo">Urungkan</button><button class="btn" id="kClr">Reset bersih</button><button class="btn pri" id="kOk">Selesai</button></div></div>';
    document.body.appendChild(el);
    function $(id) { return el.querySelector('#' + id); }
    var map = L.map($('kMap'), { crs: L.CRS.Simple, minZoom: -8, maxZoom: 5, zoomControl: true, attributionControl: false, zoomSnap: 0.25, preferCanvas: true });
    var layer = makeLayer(meta, { toLL: function (u, v) { return L.latLng(-v, u); } }).addTo(map);
    map.fitBounds([[-meta.H, 0], [0, meta.W]]);
    var shapes = L.layerGroup().addTo(map), temp = null;
    function ll(u, v) { return L.latLng(-v, u); }
    function rect(r, st) { return L.rectangle([ll(r.x0, r.y0), ll(r.x1, r.y1)], st); }
    function snap() { hist.push(JSON.stringify(ed)); if (hist.length > 40) hist.shift(); }
    function redraw() {
      layer._draw();
      shapes.clearLayers();
      if (ed.crop) rect(ed.crop, { color: '#2F7CF6', weight: 2, dashArray: '8 6', fill: false, interactive: false }).addTo(shapes);
      ed.erase.forEach(function (r) { rect(r, { color: '#FF5B50', weight: 1.5, dashArray: '5 4', fillColor: '#FF5B50', fillOpacity: 0.12, interactive: false }).addTo(shapes); });
      $('kKey').checked = !!ed.keyBg;
      $('kTol').value = ed.tol; $('kTolV').textContent = ed.tol + '%';
      $('kBoost').value = ed.boost; $('kBoostV').textContent = ed.boost + '%';
      $('kSolid').checked = !!ed.solid; $('kSharp').value = ed.sharp; $('kSharpV').textContent = ed.sharp + '%';
      $('kTol').disabled = $('kBoost').disabled = $('kSolid').disabled = !ed.keyBg;
      $('kSharp').disabled = !ed.keyBg || !ed.solid;
      var h = '';
      if (ed.crop) h += '<button class="btn sm" data-x="crop">× Pangkas</button>';
      ed.erase.forEach(function (r, i) { h += '<button class="btn sm" data-x="' + i + '">× Kotak ' + (i + 1) + '</button>'; });
      $('kBoxes').innerHTML = h || '<span style="color:var(--tx2)">Belum ada pangkas / kotak hapus.</span>';
      if (cx.onChange) cx.onChange();
    }
    function help() {
      $('kHelp').innerHTML = mode === 'pan' ? 'Geser dan zoom gambar untuk memeriksa. Garis biru = batas pangkas, kotak merah = bagian yang dihapus.' :
        (mode === 'crop' ? '<b>Pangkas:</b> seret satu kotak di sekitar bagian yang <b>dipertahankan</b>. Di luar kotak dibuang (tepi, judul, legenda).' :
          '<b>Hapus kotak:</b> seret kotak di atas teks atau gambar yang tidak diinginkan. Bisa berkali-kali.');
    }
    function setMode(m) {
      mode = m;
      $('kMode').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === m); });
      var on = m === 'pan';
      // saat pangkas / hapus kotak: satu jari menggambar, dua jari (cubit) tetap bisa zoom dan menggeser
      ['dragging', 'doubleClickZoom', 'boxZoom'].forEach(function (k) { if (map[k]) on ? map[k].enable() : map[k].disable(); });
      ['touchZoom', 'scrollWheelZoom'].forEach(function (k) { if (map[k]) map[k].enable(); });
      map.getContainer().style.touchAction = on ? '' : 'none';
      help();
    }
    $('kMode').onclick = function (e) { var m = e.target.getAttribute('data-m'); if (m) setMode(m); };
    var cont = map.getContainer();
    function pt(e) { var r = cont.getBoundingClientRect(), c = map.containerPointToLatLng(L.point(e.clientX - r.left, e.clientY - r.top)); return { u: Math.max(0, Math.min(meta.W, c.lng)), v: Math.max(0, Math.min(meta.H, -c.lat)), x: e.clientX, y: e.clientY }; }
    var downN = {};
    function dropDrag() { drag = null; if (temp) { shapes.removeLayer(temp); temp = null; } }
    cont.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.leaflet-control')) return;
      downN[e.pointerId] = 1;
      if (Object.keys(downN).length > 1) { dropDrag(); return; }
      if (mode === 'pan' || drag) return;
      drag = pt(e); drag.id = e.pointerId;
      try { cont.setPointerCapture(e.pointerId); } catch (er) {}
      e.preventDefault();
    });
    cont.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var q = pt(e);
      if (temp) { shapes.removeLayer(temp); temp = null; }
      temp = rect({ x0: Math.min(drag.u, q.u), y0: Math.min(drag.v, q.v), x1: Math.max(drag.u, q.u), y1: Math.max(drag.v, q.v) }, { color: mode === 'crop' ? '#2F7CF6' : '#FF5B50', weight: 2, fillOpacity: 0.1, interactive: false }).addTo(shapes);
      e.preventDefault();
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var q = pt(e), d = drag; drag = null;
      if (temp) { shapes.removeLayer(temp); temp = null; }
      if (e.type === 'pointercancel') return;
      if (Math.abs(q.x - d.x) < 10 || Math.abs(q.y - d.y) < 10) return;
      var r = { x0: Math.round(Math.min(d.u, q.u)), y0: Math.round(Math.min(d.v, q.v)), x1: Math.round(Math.max(d.u, q.u)), y1: Math.round(Math.max(d.v, q.v)) };
      snap();
      if (mode === 'crop') ed.crop = r; else ed.erase.push(r);
      redraw();
    }
    cont.addEventListener('pointerup', function (e) { var multi = Object.keys(downN).length > 1; delete downN[e.pointerId]; if (multi) { dropDrag(); return; } end(e); });
    cont.addEventListener('pointercancel', function (e) { delete downN[e.pointerId]; end(e); });
    $('kSolid').onchange = function () { snap(); ed.solid = this.checked; redraw(); };
    $('kSharp').oninput = function () { ed.sharp = +this.value; $('kSharpV').textContent = ed.sharp + '%'; layer._draw(); if (cx.onChange) cx.onChange(); };
    $('kSharp').onchange = function () { snap(); };
    $('kKey').onchange = function () { snap(); ed.keyBg = this.checked; redraw(); };
    $('kTol').oninput = function () { ed.tol = +this.value; $('kTolV').textContent = ed.tol + '%'; layer._draw(); if (cx.onChange) cx.onChange(); };
    $('kTol').onchange = function () { snap(); };
    $('kBoost').oninput = function () { ed.boost = +this.value; $('kBoostV').textContent = ed.boost + '%'; layer._draw(); if (cx.onChange) cx.onChange(); };
    $('kBoost').onchange = function () { snap(); };
    $('kBoxes').onclick = function (e) {
      var x = e.target.getAttribute('data-x'); if (x === null) return;
      cfm(x === 'crop' ? 'Hapus pangkas?' : 'Hapus kotak ' + (+x + 1) + '?', x === 'crop' ? 'Batas pangkas dibuang; seluruh gambar tampil lagi.' : 'Bagian yang tadi dihapus tampil lagi.', 'Hapus', function () {
        snap();
        if (x === 'crop') ed.crop = null; else ed.erase.splice(+x, 1);
        redraw();
      });
    };
    $('kUndo').onclick = function () { if (!hist.length) return; var o = JSON.parse(hist.pop()); ed.keyBg = o.keyBg; ed.tol = o.tol; ed.boost = o.boost; ed.solid = o.solid; ed.sharp = o.sharp == null ? 60 : o.sharp; ed.crop = o.crop; ed.erase = o.erase; redraw(); };
    $('kClr').onclick = function () { cfm('Reset bersih?', 'Hapus latar, garis pekat, pangkas, dan semua kotak hapus dibatalkan.', 'Reset', function () { snap(); ed.keyBg = false; ed.solid = false; ed.sharp = 60; ed.crop = null; ed.erase = []; ed.tol = 6; ed.boost = 100; redraw(); }); };
    function close() { try { map.remove(); } catch (e) {} el.remove(); }
    $('kNo').onclick = function () { meta.edit = JSON.parse(ed0); if (cx.onChange) cx.onChange(); close(); };
    $('kOk').onclick = function () { close(); if (cx.onDone) cx.onDone(meta.edit); };
    setMode('pan'); redraw();
    return { close: close };
  }

  root.HzOverlay = { openPdf: openPdf, clean: clean, affOf: affOf, infoAff: infoAff, tune: tune, importPdf: importPdf, delOverlay: delOverlay, makeLayer: makeLayer, affineOf: affineOf, toLLFn: toLLFn, info: info, residual: residual, calibrate: calibrate, TS: TS };
})(window);
