/* HZ Trip - baca berkas Google Timeline (JSON) menjadi titik GPS. Tanpa DOM, bisa diuji di Node.
 * Format yang dikenali: (1) ekspor Timeline di ponsel (semanticSegments / rawSignals / array segmen),
 * (2) Takeout lama Records.json (locations), (3) Takeout lama Semantic Location History (timelineObjects). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HzGoogle = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  function num(x) { var n = +x; return isFinite(n) ? n : null; }
  // "-5.1234°, 105.1234°" atau "geo:-5.1,105.1"
  function latLng(s) {
    if (!s) return null;
    if (typeof s === 'object') {
      if (s.latitudeE7 != null) return [s.latitudeE7 / 1e7, s.longitudeE7 / 1e7];
      if (s.latE7 != null) return [s.latE7 / 1e7, s.lngE7 / 1e7];
      if (s.latitude != null) return [+s.latitude, +s.longitude];
      return null;
    }
    var m = String(s).replace(/[°−]/g, function (c) { return c === '−' ? '-' : ''; }).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    return m ? [+m[1], +m[2]] : null;
  }
  function tms(x) {
    if (x == null) return null;
    if (typeof x === 'number') return x > 1e12 ? x : x * 1000;
    if (/^\d{12,}$/.test(String(x))) return +x;
    var t = Date.parse(x);
    return isFinite(t) ? t : null;
  }
  function ok(la, lo) { return la != null && lo != null && isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !(la === 0 && lo === 0); }

  function parse(text) {
    var root = typeof text === 'string' ? JSON.parse(text) : text;
    var pts = [], fmt = '?';
    function add(t, ll, acc, v) { if (t != null && ll && ok(ll[0], ll[1])) pts.push({ t: t, lat: ll[0], lng: ll[1], acc: acc == null ? 30 : acc, v: v == null ? null : v }); }

    function segments(arr) {
      arr.forEach(function (s) {
        var st = tms(s.startTime), en = tms(s.endTime);
        if (s.timelinePath) {
          s.timelinePath.forEach(function (q) {
            var t = tms(q.time);
            if (t == null && st != null && q.durationMinutesOffsetFromStartTime != null) t = st + (+q.durationMinutesOffsetFromStartTime) * 60000;
            add(t, latLng(q.point), 30);
          });
        }
        if (s.activity) {
          var a = s.activity, p0 = latLng(a.start && (a.start.latLng || a.start)), p1 = latLng(a.end && (a.end.latLng || a.end));
          add(st, p0, 30);
          // tanpa jalur terinci: titik perkiraan lurus tiap menit dari awal ke akhir (hanya untuk perpindahan nyata)
          if (!s.timelinePath && st != null && en != null && p0 && p1 && en - st >= 120000 && en - st <= 6 * 3600000) {
            for (var tt = st + 60000; tt < en; tt += 60000) {
              var f = (tt - st) / (en - st);
              add(tt, [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f], 40);
            }
          }
          add(en, p1, 30);
        }
        if (s.visit && s.visit.topCandidate) {
          var pl = latLng(s.visit.topCandidate.placeLocation && (s.visit.topCandidate.placeLocation.latLng || s.visit.topCandidate.placeLocation));
          add(st, pl, 30, 0); add(en, pl, 30, 0);
        }
      });
    }
    if (Array.isArray(root)) { fmt = 'segmen'; segments(root); }
    if (root && root.semanticSegments) { fmt = 'timeline-ponsel'; segments(root.semanticSegments); }
    if (root && root.rawSignals) {
      root.rawSignals.forEach(function (r) {
        var p = r.position; if (!p) return;
        add(tms(p.timestamp), latLng(p.LatLng || p.latLng), num(p.accuracyMeters), num(p.speedMetersPerSecond));
      });
    }
    if (root && root.locations) {
      fmt = 'records';
      root.locations.forEach(function (l) { add(tms(l.timestamp != null ? l.timestamp : l.timestampMs), latLng(l), num(l.accuracy), num(l.velocity)); });
    }
    if (root && root.timelineObjects) {
      fmt = 'riwayat-lama';
      root.timelineObjects.forEach(function (o) {
        var a = o.activitySegment, v = o.placeVisit;
        if (a) {
          var d = a.duration || {}, st = tms(d.startTimestamp || d.startTimestampMs), en = tms(d.endTimestamp || d.endTimestampMs);
          var path = (a.simplifiedRawPath && a.simplifiedRawPath.points) || [];
          path.forEach(function (q) { add(tms(q.timestamp || q.timestampMs), latLng(q), num(q.accuracyMeters)); });
          add(st, latLng(a.startLocation), 30); add(en, latLng(a.endLocation), 30);
        }
        if (v && v.location) {
          var dv = v.duration || {};
          var pl = latLng(v.location);
          add(tms(dv.startTimestamp || dv.startTimestampMs), pl, 30, 0); add(tms(dv.endTimestamp || dv.endTimestampMs), pl, 30, 0);
        }
      });
    }
    pts.sort(function (a, b) { return a.t - b.t; });
    var out = [];
    pts.forEach(function (p) { var l = out[out.length - 1]; if (l && Math.abs(l.t - p.t) < 1000) return; out.push(p); });
    return { pts: out, fmt: fmt };
  }

  function dist(a, b) {
    var R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  // kecepatan (m/s) tiap titik bila belum ada: jarak / selisih waktu ke titik sebelumnya (maks 10 menit), kalau tidak ada pakai titik berikutnya
  function withSpeed(pts) {
    var n = pts.length, res = [];
    function seg(i, j) { var dt = (pts[j].t - pts[i].t) / 1000; if (dt <= 0 || dt > 600) return null; return Math.min(dist(pts[i], pts[j]) / dt, 42); }
    for (var i = 0; i < n; i++) {
      var v = pts[i].v;
      if (v == null) { v = i > 0 ? seg(i - 1, i) : null; if (v == null && i < n - 1) v = seg(i, i + 1); if (v == null) v = 0; }
      res.push({ t: pts[i].t, lat: pts[i].lat, lng: pts[i].lng, acc: pts[i].acc, v: v });
    }
    return res;
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // satu baris CSV HZ Trip; kolom ke-6 = 2 menandai titik dari Google
  function line(p) { return p.t + ',' + p.lat.toFixed(6) + ',' + p.lng.toFixed(6) + ',' + p.v.toFixed(2) + ',' + Math.round(p.acc) + ',2'; }
  // kelompokkan per hari (tanggal lokal); dari/ke = 'YYYY-MM-DD' (opsional, termasuk)
  function byDay(pts, from, to) {
    var days = {};
    withSpeed(pts).forEach(function (p) {
      var d = ymd(p.t);
      if ((from && d < from) || (to && d > to)) return;
      (days[d] = days[d] || []).push(p);
    });
    return days;
  }
  // gabungkan ke teks CSV hari yang sudah ada; titik Google dilewati bila ada titik asli dalam +-gap detik
  function mergeDay(existingText, gpts, gapSec) {
    var ex = [], lines = existingText ? existingText.split('\n').filter(function (l) { return l; }) : [];
    lines.forEach(function (l) { var t = +l.split(',')[0]; if (isFinite(t)) ex.push(t); });
    ex.sort(function (a, b) { return a - b; });
    var g = (gapSec || 180) * 1000, add = [];
    gpts.forEach(function (p) {
      var lo = 0, hi = ex.length;
      while (lo < hi) { var m = (lo + hi) >> 1; if (ex[m] < p.t - g) lo = m + 1; else hi = m; }
      if (lo < ex.length && ex[lo] <= p.t + g) return;
      add.push(p);
    });
    var all = lines.map(function (l) { return { t: +l.split(',')[0], s: l }; }).concat(add.map(function (p) { return { t: p.t, s: line(p) }; }));
    all.sort(function (a, b) { return a.t - b.t; });
    return { text: all.map(function (x) { return x.s; }).join('\n') + '\n', added: add.length };
  }
  return { parse: parse, withSpeed: withSpeed, byDay: byDay, mergeDay: mergeDay, ymd: ymd, line: line };
});
