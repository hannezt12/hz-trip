/* HZ Trip: data ketinggian (DEM) untuk kontur, info lereng, dan profil ketinggian.
 * Sumber: kotak ketinggian "terrarium" (PNG, ketinggian = R*256 + G + B/256 - 32768 meter).
 * Kotak disimpan di cache yang sama dengan kotak peta (store.get / store.put), jadi bisa dipakai tanpa internet
 * setelah area itu pernah dibuka. */
(function (root) {
  'use strict';
  var URL_T = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  var mem = new Map(), pend = {}, fail = {}, store = null, MAXMEM = 90;

  function setStore(s) { store = s; }
  function urlOf(z, x, y) { return URL_T.replace('{z}', z).replace('{x}', x).replace('{y}', y); }

  function decode(blob) {
    return createImageBitmap(blob).then(function (bm) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 256;
      var cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(bm, 0, 0); if (bm.close) bm.close();
      var d = cx.getImageData(0, 0, 256, 256).data, out = new Float32Array(65536), i;
      for (i = 0; i < 65536; i++) out[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
      return out;
    });
  }
  function loadTile(z, x, y) {
    var n = Math.pow(2, z);
    x = ((x % n) + n) % n;
    if (y < 0 || y >= n) return Promise.resolve(null);
    var k = z + '/' + x + '/' + y;
    if (mem.has(k)) { var v = mem.get(k); mem.delete(k); mem.set(k, v); return Promise.resolve(v); }
    if (pend[k]) return pend[k];
    if (fail[k] && Date.now() - fail[k] < 60000) return Promise.resolve(null);
    var u = urlOf(z, x, y);
    var p = (store ? store.get(u) : Promise.resolve(null)).then(function (blob) {
      if (blob) return blob;
      return fetch(u, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('http'); return r.blob(); }).then(function (b) { if (store) store.put(u, b); return b; });
    }).then(decode).then(function (arr) {
      mem.set(k, arr);
      while (mem.size > MAXMEM) mem.delete(mem.keys().next().value);
      delete pend[k]; return arr;
    }).catch(function () { fail[k] = Date.now(); delete pend[k]; return null; });
    pend[k] = p;
    return p;
  }

  function pxy(lat, lng, z) {
    var n = 256 * Math.pow(2, z), s = Math.sin(lat * Math.PI / 180);
    return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  }
  function pix(z, ix, iy) {
    var n = Math.pow(2, z), tx = Math.floor(ix / 256), ty = Math.floor(iy / 256);
    tx = ((tx % n) + n) % n;
    var t = mem.get(z + '/' + tx + '/' + ty);
    if (!t) return NaN;
    return t[(iy - ty * 256) * 256 + (((ix % 256) + 256) % 256)];
  }
  // ketinggian (m) di satu titik; NaN bila kotaknya belum dimuat (panggil ensure dulu)
  function elev(lat, lng, z) {
    var p = pxy(lat, lng, z), fx = p[0] - 0.5, fy = p[1] - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    var a = pix(z, x0, y0), b = pix(z, x0 + 1, y0), c = pix(z, x0, y0 + 1), d = pix(z, x0 + 1, y0 + 1);
    return (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + d * ax) * ay;
  }
  // muat semua kotak yang dibutuhkan titik-titik (pts: [[lat,lng],...]); hasil: {total, ok}
  function ensure(z, pts) {
    var need = {}, list = [];
    pts.forEach(function (q) {
      var p = pxy(q[0], q[1], z), X, Y;
      [-1, 1].forEach(function (dx) {
        [-1, 1].forEach(function (dy) {
          X = Math.floor((p[0] + dx) / 256); Y = Math.floor((p[1] + dy) / 256);
          var k = X + '/' + Y;
          if (!need[k]) { need[k] = 1; list.push([X, Y]); }
        });
      });
    });
    var ok = 0, i = 0;
    function worker() {
      if (i >= list.length) return Promise.resolve();
      var c = list[i++];
      return loadTile(z, c[0], c[1]).then(function (t) { if (t) ok++; return worker(); });
    }
    var ws = [];
    for (var w = 0; w < Math.min(6, list.length); w++) ws.push(worker());
    return Promise.all(ws).then(function () { return { total: list.length, ok: ok }; });
  }

  // ---------- info lereng di satu titik ----------
  function info(lat, lng) {
    var Z = 14, d = 30, dLat = d / 111320, dLng = dLat / Math.cos(lat * Math.PI / 180);
    var P = [[lat, lng], [lat + dLat, lng], [lat - dLat, lng], [lat, lng + dLng], [lat, lng - dLng]];
    return ensure(Z, P).then(function () {
      var e0 = elev(lat, lng, Z), n = elev(P[1][0], P[1][1], Z), s = elev(P[2][0], P[2][1], Z), e = elev(P[3][0], P[3][1], Z), w = elev(P[4][0], P[4][1], Z);
      if (!isFinite(e0) || !isFinite(n) || !isFinite(s) || !isFinite(e) || !isFinite(w)) return null;
      var gx = (e - w) / (2 * d), gy = (n - s) / (2 * d), pct = 100 * Math.hypot(gx, gy);
      var down = (Math.atan2(-gx, -gy) * 180 / Math.PI + 360) % 360;
      return { h: e0, pct: pct, down: down };
    });
  }

  // ---------- profil ketinggian sepanjang jalur ----------
  function hav(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  // pts: [[lat,lng],...] -> titik tiap `step` meter
  function resample(pts, step) {
    var out = { lat: [], lng: [], d: [] }, acc = 0, next = 0, i;
    if (!pts.length) return out;
    out.lat.push(pts[0][0]); out.lng.push(pts[0][1]); out.d.push(0);
    next = step;
    for (i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], seg = hav(a, b);
      if (seg <= 0) continue;
      while (acc + seg >= next) {
        var f = (next - acc) / seg;
        out.lat.push(a[0] + (b[0] - a[0]) * f); out.lng.push(a[1] + (b[1] - a[1]) * f); out.d.push(next);
        next += step;
      }
      acc += seg;
    }
    if (acc - out.d[out.d.length - 1] > step * 0.25) { var l = pts[pts.length - 1]; out.lat.push(l[0]); out.lng.push(l[1]); out.d.push(acc); }
    return out;
  }
  function smooth(a, win) {
    var h = Math.floor(win / 2), out = a.slice(), i, j;
    for (i = 0; i < a.length; i++) { var s = 0, c = 0; for (j = Math.max(0, i - h); j <= Math.min(a.length - 1, i + h); j++) { s += a[j]; c++; } out[i] = s / c; }
    return out;
  }
  function climbOf(e, thr) {
    var up = 0, down = 0, ref = e[0], i;
    for (i = 1; i < e.length; i++) {
      var dv = e[i] - ref;
      if (dv >= thr) { up += dv; ref = e[i]; } else if (dv <= -thr) { down -= dv; ref = e[i]; }
    }
    return { up: up, down: down };
  }
  // pts: [[lat,lng],...]; hasil {d,e,lat,lng,up,down,min,max,km} atau null bila data ketinggian tidak tersedia
  function profile(pts, step) {
    var Z = 14, rs = resample(pts, step || 50);
    if (rs.lat.length < 2) return Promise.resolve(null);
    var coords = rs.lat.map(function (la, i) { return [la, rs.lng[i]]; });
    return ensure(Z, coords).then(function () {
      var e = coords.map(function (c) { return elev(c[0], c[1], Z); }), bad = 0, i;
      e.forEach(function (v) { if (!isFinite(v)) bad++; });
      if (bad > e.length * 0.3) return null;
      var last = NaN;
      for (i = 0; i < e.length; i++) { if (isFinite(e[i])) last = e[i]; else if (isFinite(last)) e[i] = last; }
      for (i = e.length - 1; i >= 0; i--) { if (isFinite(e[i])) last = e[i]; else e[i] = last; }
      var es = smooth(e, 5), cl = climbOf(es, 2), mn = Infinity, mx = -Infinity;
      es.forEach(function (v) { if (v < mn) mn = v; if (v > mx) mx = v; });
      return { d: rs.d, e: es, lat: rs.lat, lng: rs.lng, up: cl.up, down: cl.down, min: mn, max: mx, km: rs.d[rs.d.length - 1] / 1000 };
    });
  }

  // ---------- lapisan kontur (kanvas) ----------
  var LC = null;
  function layerClass() {
    if (LC) return LC;
    var PAD = 0.25, S = 8;
    LC = L.Layer.extend({
      initialize: function (o) { this.o = o || {}; this._id = 0; },
      onAdd: function (map) {
        if (!map.getPane('demPane')) { var p = map.createPane('demPane'); p.style.zIndex = 260; p.style.pointerEvents = 'none'; }
        var c = this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated');
        c.style.pointerEvents = 'none';
        map.getPane('demPane').appendChild(c);
        this._update();
      },
      onRemove: function () { this._id++; L.DomUtil.remove(this._canvas); this._canvas = null; },
      getEvents: function () { return { moveend: this._update, resize: this._update, viewreset: this._update, zoomanim: this._animZoom }; },
      _animZoom: function (e) {
        var m = this._map, scale = m.getZoomScale(e.zoom, this._zoom), viewHalf = m.getSize().multiplyBy(0.5 + PAD),
          cur = m.project(this._center, e.zoom), off = viewHalf.multiplyBy(-scale).add(cur).subtract(m._getNewPixelOrigin(e.center, e.zoom));
        L.DomUtil.setTransform(this._canvas, off, scale);
      },
      redraw: function () { if (this._canvas) this._update(); },
      _update: function () {
        if (!this._canvas || !this._map) return;
        var m = this._map, size = m.getSize(), min = m.containerPointToLayerPoint(size.multiplyBy(-PAD)).round(), sz = size.multiplyBy(1 + PAD * 2).round();
        this._min = min; this._center = m.getCenter(); this._zoom = m.getZoom();
        this._canvas.width = sz.x; this._canvas.height = sz.y;
        L.DomUtil.setPosition(this._canvas, min);
        this._draw();
      },
      _draw: function () {
        var me = this, c = this._canvas, m = this._map, id = ++this._id;
        if (!c || !m) return;
        var w = c.width, h = c.height, min = this._min, zoom = m.getZoom();
        var zd = Math.max(10, Math.min(14, Math.round(zoom - 2.5)));
        var pts = [], x, y;
        for (y = 0; y <= h; y += 128) for (x = 0; x <= w; x += 128) { var ll = m.layerPointToLatLng(L.point(min.x + x, min.y + y)); pts.push([ll.lat, ll.lng]); }
        var ll2 = m.layerPointToLatLng(L.point(min.x + w, min.y + h)); pts.push([ll2.lat, ll2.lng]);
        ensure(zd, pts).then(function (r) {
          if (id !== me._id || !me._canvas) return;
          if (r.ok < r.total && me.o.onMissing) me.o.onMissing(r);
          me._render(zd);
        });
      },
      _render: function (zd) {
        var c = this._canvas, m = this._map, min = this._min, ctx = c.getContext('2d'), w = c.width, h = c.height;
        ctx.clearRect(0, 0, w, h);
        var cols = Math.ceil(w / S) + 1, rows = Math.ceil(h / S) + 1, g = new Float32Array(cols * rows), i, j, mn = Infinity, mx = -Infinity;
        for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
          var ll = m.layerPointToLatLng(L.point(min.x + i * S, min.y + j * S)), v = elev(ll.lat, ll.lng, zd);
          g[j * cols + i] = v;
          if (isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
        }
        if (!isFinite(mn)) return;
        // haluskan 2x (rata-rata 3x3, abaikan NaN)
        for (var pass = 0; pass < 2; pass++) {
          var g2 = new Float32Array(g.length);
          for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
            var s = 0, n = 0;
            for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
              var ii = i + di, jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
              var vv = g[jj * cols + ii]; if (isFinite(vv)) { s += vv; n++; }
            }
            g2[j * cols + i] = n ? s / n : NaN;
          }
          g = g2;
        }
        var I = this.o.step ? this.o.step(m.getZoom()) : 5, col = this.o.color ? this.o.color() : ['rgba(255,214,128,.8)', 'rgba(255,190,70,1)', 'rgba(0,0,0,.65)'];
        var k0 = Math.ceil(mn / I), k1 = Math.floor(mx / I), minor = [], major = [], labels = [], k;
        function lerp(a, b, L1) { return (L1 - a) / (b - a); }
        for (k = k0; k <= k1; k++) {
          var Lv = k * I, isMajor = k % 5 === 0, arr = isMajor ? major : minor, placed = [];
          for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
            var a = g[j * cols + i], b = g[j * cols + i + 1], cc = g[(j + 1) * cols + i + 1], d = g[(j + 1) * cols + i];
            if (!(isFinite(a) && isFinite(b) && isFinite(cc) && isFinite(d))) continue;
            var lo = Math.min(a, b, cc, d), hi = Math.max(a, b, cc, d);
            if (Lv < lo || Lv > hi) continue;
            var idx = (a >= Lv ? 8 : 0) | (b >= Lv ? 4 : 0) | (cc >= Lv ? 2 : 0) | (d >= Lv ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            var x0 = i * S, y0 = j * S;
            var T = [x0 + lerp(a, b, Lv) * S, y0], R = [x0 + S, y0 + lerp(b, cc, Lv) * S], B = [x0 + lerp(d, cc, Lv) * S, y0 + S], Lf = [x0, y0 + lerp(a, d, Lv) * S];
            var segs;
            switch (idx) {
              case 1: case 14: segs = [[Lf, B]]; break;
              case 2: case 13: segs = [[B, R]]; break;
              case 3: case 12: segs = [[Lf, R]]; break;
              case 4: case 11: segs = [[T, R]]; break;
              case 6: case 9: segs = [[T, B]]; break;
              case 7: case 8: segs = [[T, Lf]]; break;
              case 5: segs = ((a + b + cc + d) / 4 >= Lv) ? [[T, Lf], [B, R]] : [[T, R], [Lf, B]]; break;
              default: segs = ((a + b + cc + d) / 4 >= Lv) ? [[T, R], [Lf, B]] : [[T, Lf], [B, R]];
            }
            segs.forEach(function (sg) { arr.push(sg); });
            if (isMajor && (i + j) % 6 === 0) {
              var px = (segs[0][0][0] + segs[0][1][0]) / 2, py = (segs[0][0][1] + segs[0][1][1]) / 2, near = false;
              for (var q = 0; q < placed.length; q++) if (Math.abs(placed[q][0] - px) < 150 && Math.abs(placed[q][1] - py) < 90) { near = true; break; }
              if (!near && px > 20 && py > 20 && px < w - 40 && py < h - 20) { placed.push([px, py]); labels.push([px, py, String(Lv)]); }
            }
          }
        }
        ctx.lineCap = 'round';
        function strokeSegs(arr2, style, wd) {
          if (!arr2.length) return;
          ctx.beginPath();
          arr2.forEach(function (sg) { ctx.moveTo(sg[0][0], sg[0][1]); ctx.lineTo(sg[1][0], sg[1][1]); });
          ctx.strokeStyle = style; ctx.lineWidth = wd; ctx.stroke();
        }
        strokeSegs(minor, col[0], 1);
        strokeSegs(major, col[1], 2);
        ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        labels.forEach(function (lb) {
          ctx.lineWidth = 3; ctx.strokeStyle = col[2]; ctx.strokeText(lb[2], lb[0], lb[1]);
          ctx.fillStyle = col[1]; ctx.fillText(lb[2], lb[0], lb[1]);
        });
      }
    });
    return LC;
  }
  function contours(o) { return new (layerClass())(o); }

  root.HzDem = { setStore: setStore, ensure: ensure, elev: elev, info: info, profile: profile, resample: resample, contours: contours, hav: hav };
})(window);
