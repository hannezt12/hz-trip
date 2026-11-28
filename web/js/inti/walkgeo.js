/* HZ Trip - jalur Walking untuk blok baru (tanpa DOM, bisa diuji di Node).
 * Semua titik dicatat; titik baru dibuat tiap bergeser >= 2 m (atau >= setengah akurasi bila akurasi buruk, agar GPS yang bergoyang
 * saat diam tidak menumpuk titik). Jalur lurus dirapikan (hanya ujung/belokan), titik paksa dan ujung rantai selalu dipertahankan. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HzWalk = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var R = Math.PI / 180;
  function dist(a, b) {
    var kx = 111320 * Math.cos(((a.lat + b.lat) / 2) * R), dx = (b.lng - a.lng) * kx, dy = (b.lat - a.lat) * 111320;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function accClass(acc) { return acc <= 8 ? 'g' : (acc <= 15 ? 'y' : 'r'); }

  // Douglas-Peucker pada rantai titik {lat,lng,f}; titik f (paksa) selalu dipertahankan
  function dp(chain, tol) {
    var n = chain.length;
    if (n < 3) return chain.slice();
    var lat0 = chain[0].lat, kx = 111320 * Math.cos(lat0 * R), xy = chain.map(function (p) { return [(p.lng - chain[0].lng) * kx, (p.lat - lat0) * 111320]; });
    var keep = new Array(n); keep[0] = keep[n - 1] = true;
    for (var i = 0; i < n; i++) if (chain[i].f) keep[i] = true;
    var stack = [[0, n - 1]];
    while (stack.length) {
      var s = stack.pop(), a = s[0], b = s[1];
      if (b <= a + 1) continue;
      var ax = xy[a][0], ay = xy[a][1], bx = xy[b][0], by = xy[b][1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, md = -1, mi = -1;
      for (var k = a + 1; k < b; k++) {
        var d;
        if (L2 === 0) d = Math.hypot(xy[k][0] - ax, xy[k][1] - ay);
        else { var t = Math.max(0, Math.min(1, ((xy[k][0] - ax) * dx + (xy[k][1] - ay) * dy) / L2)); d = Math.hypot(xy[k][0] - (ax + t * dx), xy[k][1] - (ay + t * dy)); }
        if (d > md) { md = d; mi = k; }
      }
      if (md > tol) { keep[mi] = true; stack.push([a, mi], [mi, b]); }
      else {
        // ada titik paksa di dalam rentang ini: pecah di titik paksa pertama agar tetap dipertahankan
        for (var q = a + 1; q < b; q++) if (chain[q].f) { stack.push([a, q], [q, b]); break; }
      }
    }
    var out = [];
    for (var j = 0; j < n; j++) if (keep[j]) out.push(chain[j]);
    return out;
  }

  function create(o) {
    o = o || {};
    var step = o.step || 2, tol = o.tol || 1.5;
    var raw = [], paused = false, gapNext = false, lastFix = null;
    var W = {
      seed: function (pts) { // titik manual yang sudah ada = titik paksa tanpa akurasi (dianggap baik)
        raw = (pts || []).map(function (p) { return { lat: p[0], lng: p[1], acc: 0, f: true, g: false }; });
      },
      fix: function (f) { // {lat,lng,acc,t}; true bila titik baru dicatat
        lastFix = f;
        if (paused) return false;
        var last = raw[raw.length - 1];
        if (!last) { raw.push({ lat: f.lat, lng: f.lng, acc: f.acc, f: false, g: false }); return true; }
        var thr = Math.max(step, 0.5 * (f.acc || 0));
        if (gapNext || dist(last, f) >= thr) {
          raw.push({ lat: f.lat, lng: f.lng, acc: f.acc, f: false, g: gapNext });
          gapNext = false;
          return true;
        }
        return false;
      },
      pause: function () { paused = true; },
      resume: function () { paused = false; if (raw.length) gapNext = true; },
      isPaused: function () { return paused; },
      addHere: function () { // titik paksa di posisi terakhir
        if (!lastFix) return false;
        var last = raw[raw.length - 1];
        if (last && dist(last, lastFix) < 0.5) { last.f = true; return true; }
        raw.push({ lat: lastFix.lat, lng: lastFix.lng, acc: lastFix.acc, f: true, g: gapNext });
        gapNext = false;
        return true;
      },
      undo: function (m) { // hapus jalur terakhir sepanjang m meter (minimal satu titik)
        var rem = m || 10;
        while (raw.length) {
          var p = raw.pop(), q = raw[raw.length - 1];
          if (!q) break;
          rem -= dist(p, q);
          if (rem <= 0) break;
        }
        gapNext = false;
        return raw.length;
      },
      length: function () { var s = 0; for (var i = 1; i < raw.length; i++) if (!raw[i].g) s += dist(raw[i - 1], raw[i]); return s; },
      count: function () { return raw.length; },
      last: function () { return lastFix; },
      rawPoints: function () { return raw.slice(); },
      // titik hasil rapi, berurutan; g = segmen menuju titik ini adalah celah (garis lurus yang belum dirapikan)
      points: function () {
        var out = [], chain = [];
        function flush() { if (chain.length) { var d = dp(chain, tol); for (var i = 0; i < d.length; i++) out.push(d[i]); chain = []; } }
        raw.forEach(function (p, i) {
          if (p.g && chain.length) { flush(); }
          chain.push(p);
        });
        flush();
        // tandai g hanya pada titik pertama setiap rantai baru
        return out.map(function (p) { return { lat: p.lat, lng: p.lng, acc: p.acc, f: p.f, g: p.g }; });
      }
    };
    return W;
  }
  return { create: create, dp: dp, dist: dist, accClass: accClass };
});
