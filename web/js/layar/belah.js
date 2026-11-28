// Belah blok: garis tidak rata dari tepi ke tepi membagi poligon blok menjadi beberapa bagian
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : global;
  var HA = root.HzApp = root.HzApp || {};
  var EPS = 1e-9;

  function segInt(p, p2, q, q2) {
    var rx = p2[0] - p[0], ry = p2[1] - p[1], sx = q2[0] - q[0], sy = q2[1] - q[1], den = rx * sy - ry * sx;
    if (Math.abs(den) < EPS) return null;
    var t = ((q[0] - p[0]) * sy - (q[1] - p[1]) * sx) / den, u = ((q[0] - p[0]) * ry - (q[1] - p[1]) * rx) / den;
    if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return null;
    return { t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)), pt: [p[0] + t * rx, p[1] + t * ry] };
  }
  function pip(pt, poly) {
    var ins = false, i, j;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if ((poly[i][1] > pt[1]) !== (poly[j][1] > pt[1]) && pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) ins = !ins;
    }
    return ins;
  }
  function areaXY(p) { var a = 0, i, n = p.length; for (i = 0; i < n; i++) { var q = p[(i + 1) % n]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; }
  function dseg(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return { d: Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)), u: t }; }
  function onEdge(poly, p) {
    var best = null, n = poly.length, i;
    for (i = 0; i < n; i++) { var r = dseg(p, poly[i], poly[(i + 1) % n]); if (!best || r.d < best.d - 1e-9) best = { i: i, u: r.u, d: r.d }; }
    return best && best.d < 0.15 ? best : null;
  }
  function dedupe(p) {
    var o = []; p.forEach(function (q) { var l = o[o.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.02) o.push(q); });
    if (o.length > 1 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) <= 0.02) o.pop();
    return o;
  }
  // belah satu poligon dengan satu potongan garis (c[0] dan c[last] ada di tepi poligon)
  function splitPoly(poly, C) {
    var a = onEdge(poly, C[0]), b = onEdge(poly, C[C.length - 1]), n = poly.length;
    if (!a || !b) return null;
    var cA, cB, k, A = C.slice(), B = C.slice().reverse();
    if (a.i === b.i) { cA = a.u > b.u ? 0 : n; cB = b.u > a.u ? 0 : n; }
    else { cA = ((a.i - b.i) % n + n) % n; cB = ((b.i - a.i) % n + n) % n; }
    for (k = 0; k < cA; k++) A.push(poly[(b.i + 1 + k) % n]);
    for (k = 0; k < cB; k++) B.push(poly[(a.i + 1 + k) % n]);
    A = dedupe(A); B = dedupe(B);
    if (A.length < 3 || B.length < 3) return null;
    return [A, B];
  }
  // poly, line: [[x,y],...] dalam meter. Hasil: { parts } atau { err }
  function splitGeom(poly, line, maxExt) {
    maxExt = maxExt == null ? 30 : maxExt;
    if (line.length < 2) return { err: 'Garis butuh minimal 2 titik' };
    var L = line.map(function (p) { return [p[0], p[1]]; }), n = poly.length, i, j;
    function extend(atEnd) {
      var e = atEnd ? L[L.length - 1] : L[0], pr = atEnd ? L[L.length - 2] : L[1];
      if (!pip(e, poly) && !onEdge(poly, e)) return true;
      var dx = e[0] - pr[0], dy = e[1] - pr[1], l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      var far = [e[0] + dx * maxExt, e[1] + dy * maxExt], best = null;
      if (onEdge(poly, e) && !pip([e[0] + dx * 0.3, e[1] + dy * 0.3], poly)) return true;
      for (i = 0; i < n; i++) { var h = segInt(e, far, poly[i], poly[(i + 1) % n]); if (h && h.t > 1e-6 && (!best || h.t < best.t)) best = h; }
      if (!best) return false;
      if (atEnd) L.push(best.pt); else L.unshift(best.pt);
      return true;
    }
    if (!extend(true) || !extend(false)) return { err: 'Ujung garis harus sampai tepi blok (maks ' + maxExt + ' m dari tepi)' };
    var xs = [];
    for (j = 0; j < L.length - 1; j++) for (i = 0; i < n; i++) {
      var h2 = segInt(L[j], L[j + 1], poly[i], poly[(i + 1) % n]);
      if (h2) xs.push({ s: j + h2.t, pt: h2.pt, j: j, t: h2.t });
    }
    xs.sort(function (p, q) { return p.s - q.s; });
    var cl = []; xs.forEach(function (x) { var l = cl[cl.length - 1]; if (!l || Math.hypot(l.pt[0] - x.pt[0], l.pt[1] - x.pt[1]) > 0.05) cl.push(x); });
    if (cl.length < 2) return { err: 'Garis belum memotong blok' };
    function ptAfter(x) { var j2 = x.j, nx = L[j2 + 1], d = Math.hypot(nx[0] - x.pt[0], nx[1] - x.pt[1]) || 1, st = Math.min(0.3, d / 2); return [x.pt[0] + (nx[0] - x.pt[0]) / d * st, x.pt[1] + (nx[1] - x.pt[1]) / d * st]; }
    var start = pip(ptAfter(cl[0]), poly) ? 0 : 1, chords = [], k;
    for (k = start; k + 1 < cl.length; k += 2) {
      var c = [cl[k].pt], jj;
      for (jj = cl[k].j + 1; jj <= cl[k + 1].j; jj++) c.push(L[jj]);
      c.push(cl[k + 1].pt); chords.push(dedupeLine(c));
    }
    if (!chords.length) return { err: 'Garis belum memotong blok' };
    var parts = [poly.slice()];
    chords.forEach(function (C) {
      for (var q = 0; q < parts.length; q++) {
        var r = splitPoly(parts[q], C);
        if (r) { parts.splice(q, 1, r[0], r[1]); break; }
      }
    });
    parts = parts.filter(function (p) { return areaXY(p) > 1; });
    if (parts.length < 2) return { err: 'Garis tidak membagi blok' };
    return { parts: parts, line: L };
  }
  function dedupeLine(p) { var o = []; p.forEach(function (q) { var l = o[o.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.02) o.push(q); }); return o; }
  HA.splitGeom = splitGeom;
  // blokLL, lineLL: [[lat,lng],...]
  HA.tandaSplit = function (blokLL, lineLL) {
    var P = root.HzBlok.proj(blokLL[0][0], blokLL[0][1]);
    var r = splitGeom(blokLL.map(P.xy), lineLL.map(P.xy), 30);
    if (r.err) return r;
    return { parts: r.parts.map(function (p) { return p.map(function (q) { return P.ll(q[0], q[1]); }); }), line: r.line.map(function (q) { return P.ll(q[0], q[1]); }) };
  };
  if (typeof module !== 'undefined') module.exports = { splitGeom: splitGeom, areaXY: areaXY };
})();
