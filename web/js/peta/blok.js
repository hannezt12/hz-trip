/* HZ Trip: blok kebun (deteksi dari gambar PDF, arah row, jumlah row, cekungan) */
(function HZB(root) {
  'use strict';
  var R = Math.PI / 180;

  // ---------- geometri dasar ----------
  function proj(lat0, lng0) {
    var kx = 111320 * Math.cos(lat0 * R), ky = 111320;
    return { kx: kx, ky: ky, xy: function (p) { return [(p[1] - lng0) * kx, (p[0] - lat0) * ky]; }, ll: function (x, y) { return [+(lat0 + y / ky).toFixed(7), +(lng0 + x / kx).toFixed(7)]; } };
  }
  function cen(pts) { var a = 0, b = 0; pts.forEach(function (p) { a += p[0]; b += p[1]; }); return [a / pts.length, b / pts.length]; }
  function polyArea(xy) { var s = 0, i; for (i = 0; i < xy.length; i++) { var p = xy[i], q = xy[(i + 1) % xy.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s) / 2; }
  function pip(x, y, xy) {
    var ins = false, i, j;
    for (i = 0, j = xy.length - 1; i < xy.length; j = i++) {
      var xi = xy[i][0], yi = xy[i][1], xj = xy[j][0], yj = xy[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }
  function distEdge(x, y, xy) {
    var best = Infinity, i;
    for (i = 0; i < xy.length; i++) {
      var a = xy[i], b = xy[(i + 1) % xy.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
      var d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)); if (d < best) best = d;
    }
    return best;
  }
  function areaHa(pts) { var P = proj(pts[0][0], pts[0][1]); return polyArea(pts.map(P.xy)) / 10000; }

  // arah saran: sisi panjang persegi pembatas terkecil (derajat dari utara, 0..179)
  function suggestDir(pts) {
    var P = proj(pts[0][0], pts[0][1]), xy = pts.map(P.xy), best = null, i;
    for (i = 0; i < xy.length; i++) {
      var a = xy[i], b = xy[(i + 1) % xy.length], th = Math.atan2(b[0] - a[0], b[1] - a[1]);
      var ux = Math.sin(th), uy = Math.cos(th), vx = Math.cos(th), vy = -Math.sin(th), u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      xy.forEach(function (p) { var u = p[0] * ux + p[1] * uy, v = p[0] * vx + p[1] * vy; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; });
      var A = (u1 - u0) * (v1 - v0);
      if (!best || A < best.A) best = { A: A, th: th, long: (u1 - u0) >= (v1 - v0) };
    }
    var d = best.th / R; if (!best.long) d += 90;
    return Math.round(((d % 180) + 180) % 180);
  }
  function bearing(a, b) { var P = proj(a[0], a[1]), q = P.xy(b); return ((Math.atan2(q[0], q[1]) / R) % 360 + 360) % 360; }
  // sudut antara arah row dan arah turun lereng (0 = searah lereng, 90 = memotong lereng)
  function angleToSlope(rowDir, downDir) {
    var d = Math.abs(((rowDir - downDir) % 180 + 180) % 180); return d > 90 ? 180 - d : d;
  }

  // ---------- row lurus ----------
  function rowsStraight(pts, dir, sp, margin) {
    margin = margin || 0;
    var c = cen(pts), P = proj(c[0], c[1]), poly = pts.map(P.xy), th = dir * R, dx = Math.sin(th), dy = Math.cos(th), nx = Math.cos(th), ny = -Math.sin(th);
    var off = poly.map(function (p) { return p[0] * nx + p[1] * ny; }), mn = Math.min.apply(null, off), mx = Math.max.apply(null, off), N = poly.length;
    var segs = [], total = 0, n = 0, o, i;
    for (o = mn + Math.max(sp / 2, margin); o < mx - margin + 1e-9; o += sp) {
      var ts = [];
      for (i = 0; i < N; i++) {
        var j = (i + 1) % N, oa = off[i], ob = off[j];
        if ((oa < o) !== (ob < o)) { var f = (o - oa) / (ob - oa); ts.push((poly[i][0] + f * (poly[j][0] - poly[i][0])) * dx + (poly[i][1] + f * (poly[j][1] - poly[i][1])) * dy); }
      }
      ts.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < ts.length; i += 2) {
        var t0 = ts[i] + margin, t1 = ts[i + 1] - margin;
        if (t1 - t0 < 1) continue;
        segs.push([P.ll(nx * o + dx * t0, ny * o + dy * t0), P.ll(nx * o + dx * t1, ny * o + dy * t1)]);
        total += t1 - t0; n++;
      }
    }
    return { lines: segs, n: n, total: total, avg: n ? total / n : 0, width: mx - mn };
  }

  // ---------- marching squares umum ----------
  var CASES = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], null, [[0, 2]], [[3, 2]], [[2, 3]], [[0, 2]], null, [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], []];
  function msCell(z0, z1, z2, z3, L) {
    var idx = (z0 >= L ? 1 : 0) | (z1 >= L ? 2 : 0) | (z2 >= L ? 4 : 0) | (z3 >= L ? 8 : 0);
    if (idx === 5) return ((z0 + z1 + z2 + z3) / 4 >= L) ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
    if (idx === 10) return ((z0 + z1 + z2 + z3) / 4 >= L) ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
    return CASES[idx];
  }
  // pos kunci tepi: [x,y] pecahan sel
  function edgeInfo(i, j, e, cols, z0, z1, z2, z3, L) {
    if (e === 0) return [2 * (j * cols + i), i + (L - z0) / (z1 - z0), j];
    if (e === 1) return [2 * (j * cols + i + 1) + 1, i + 1, j + (L - z1) / (z2 - z1)];
    if (e === 2) return [2 * ((j + 1) * cols + i), i + (L - z3) / (z2 - z3), j + 1];
    return [2 * (j * cols + i) + 1, i, j + (L - z0) / (z3 - z0)];
  }
  // sambung ruas {a:id,b:id} menjadi rantai titik, pos: Map id -> [x,y]
  function chain(segs, pos) {
    var adj = new Map(), out = [], used = new Uint8Array(segs.length), k;
    segs.forEach(function (s, i) { [s[0], s[1]].forEach(function (id) { var l = adj.get(id); if (l) l.push(i); else adj.set(id, [i]); }); });
    function other(s, id) { return s[0] === id ? s[1] : s[0]; }
    function walk(start, id) {
      var pts = [pos.get(id)], cur = id, guard = 0;
      for (;;) {
        var l = adj.get(cur), nx = -1, q;
        for (q = 0; q < l.length; q++) if (!used[l[q]]) { nx = l[q]; break; }
        if (nx < 0 || guard++ > 5000000) break;
        used[nx] = 1; cur = other(segs[nx], cur); pts.push(pos.get(cur));
      }
      return pts;
    }
    for (k = 0; k < segs.length; k++) {
      if (used[k]) continue;
      used[k] = 1;
      var fwd = walk(0, segs[k][1]), back = walk(0, segs[k][0]);
      back.reverse();
      out.push(back.concat(fwd));
    }
    return out;
  }
  // garis ketinggian pada level L dari grid z (cols x rows) -> rantai titik grid [x,y]
  function isoChains(z, cols, rows, L) {
    var segs = [], pos = new Map(), i, j;
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
      var z0 = z[j * cols + i], z1 = z[j * cols + i + 1], z2 = z[(j + 1) * cols + i + 1], z3 = z[(j + 1) * cols + i];
      if (!(z0 === z0 && z1 === z1 && z2 === z2 && z3 === z3)) continue;
      var cs = msCell(z0, z1, z2, z3, L); if (!cs) continue;
      cs.forEach(function (c) {
        var A = edgeInfo(i, j, c[0], cols, z0, z1, z2, z3, L), B = edgeInfo(i, j, c[1], cols, z0, z1, z2, z3, L);
        pos.set(A[0], [A[1], A[2]]); pos.set(B[0], [B[1], B[2]]); segs.push([A[0], B[0]]);
      });
    }
    return chain(segs, pos);
  }
  function chainLen(ch, f) { var s = 0, i; for (i = 1; i < ch.length; i++) s += Math.hypot((ch[i][0] - ch[i - 1][0]) * f[0], (ch[i][1] - ch[i - 1][1]) * f[1]); return s; }

  // ---------- jejak tepi topeng (untuk deteksi blok dan cekungan) ----------
  // comp: Int32Array label; id: label yang dilacak; hasil: loop terluar [[x,y],...] dalam koordinat sudut piksel
  function traceMask(lab, w, h, id, x0, y0, x1, y1) {
    var E = new Map(), x, y, W1 = w + 1;
    function add(a, b) { var l = E.get(a); if (l) l.push(b); else E.set(a, [b]); }
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      if (lab[y * w + x] !== id) continue;
      if (y === 0 || lab[(y - 1) * w + x] !== id) add(y * W1 + x, y * W1 + x + 1);
      if (x === w - 1 || lab[y * w + x + 1] !== id) add(y * W1 + x + 1, (y + 1) * W1 + x + 1);
      if (y === h - 1 || lab[(y + 1) * w + x] !== id) add((y + 1) * W1 + x + 1, (y + 1) * W1 + x);
      if (x === 0 || lab[y * w + x - 1] !== id) add((y + 1) * W1 + x, y * W1 + x);
    }
    var best = null, bestA = -1;
    var keys = Array.from(E.keys()), ki;
    for (ki = 0; ki < keys.length; ki++) {
      var s = keys[ki], l = E.get(s);
      if (!l || !l.length) continue;
      var loop = [], cur = s, guard = 0;
      for (;;) {
        var nl = E.get(cur); if (!nl || !nl.length) break;
        var nx = nl.pop(); loop.push([cur % W1, Math.floor(cur / W1)]); cur = nx;
        if (cur === s || guard++ > 4000000) break;
      }
      if (loop.length > 3) { var a = polyArea(loop); if (a > bestA) { bestA = a; best = loop; } }
    }
    return best;
  }
  function dp(pts, tol) {
    if (pts.length < 3) return pts.slice();
    var keep = new Uint8Array(pts.length), st = [[0, pts.length - 1]]; keep[0] = keep[pts.length - 1] = 1;
    while (st.length) {
      var r = st.pop(), a = pts[r[0]], b = pts[r[1]], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, md = -1, mi = -1, i;
      for (i = r[0] + 1; i < r[1]; i++) {
        var p = pts[i], d;
        if (l2) { var t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); } else d = Math.hypot(p[0] - a[0], p[1] - a[1]);
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol) { keep[mi] = 1; st.push([r[0], mi], [mi, r[1]]); }
    }
    return pts.filter(function (_, i) { return keep[i]; });
  }
  function dpRing(ring, tol) {
    if (ring.length < 5) return ring;
    var far = 0, fd = -1, i;
    for (i = 1; i < ring.length; i++) { var d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > fd) { fd = d; far = i; } }
    var A = dp(ring.slice(0, far + 1), tol), B = dp(ring.slice(far).concat([ring[0]]), tol);
    return A.concat(B.slice(1, -1));
  }

  // ---------- deteksi blok dari gambar ----------
  // img: {w,h,data:Uint8ClampedArray RGBA}; opt: {thr, close, minPx, maxFrac}
  function detect(img, opt) {
    var w = img.w, h = img.h, d = img.data, thr = opt.thr || 190, rc = Math.max(0, opt.close == null ? 1 : opt.close), n = w * h, i, x, y;
    var ink = new Uint8Array(n);
    for (i = 0; i < n; i++) { var o = i * 4, lum = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]; ink[i] = (d[o + 3] > 20 && lum < thr) ? 1 : 0; }
    if (rc > 0) { // pelebaran garis (menutup celah kecil), dua lintasan terpisah
      var t1 = new Uint8Array(n), k;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var v = 0; for (k = -rc; k <= rc && !v; k++) { var xx = x + k; if (xx >= 0 && xx < w && ink[y * w + xx]) v = 1; } t1[y * w + x] = v; }
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var v2 = 0; for (k = -rc; k <= rc && !v2; k++) { var yy = y + k; if (yy >= 0 && yy < h && t1[yy * w + x]) v2 = 1; } ink[y * w + x] = v2; }
    }
    var lab = new Int32Array(n), comps = [], q = new Int32Array(n), id = 0;
    for (i = 0; i < n; i++) {
      if (ink[i] || lab[i]) continue;
      id++; var qh = 0, qt = 0, cnt = 0, bx0 = w, by0 = h, bx1 = 0, by1 = 0, border = false;
      q[qt++] = i; lab[i] = id;
      while (qh < qt) {
        var c = q[qh++], cx = c % w, cy = (c - cx) / w; cnt++;
        if (cx < bx0) bx0 = cx; if (cx > bx1) bx1 = cx; if (cy < by0) by0 = cy; if (cy > by1) by1 = cy;
        if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) border = true;
        if (cx > 0 && !ink[c - 1] && !lab[c - 1]) { lab[c - 1] = id; q[qt++] = c - 1; }
        if (cx < w - 1 && !ink[c + 1] && !lab[c + 1]) { lab[c + 1] = id; q[qt++] = c + 1; }
        if (cy > 0 && !ink[c - w] && !lab[c - w]) { lab[c - w] = id; q[qt++] = c - w; }
        if (cy < h - 1 && !ink[c + w] && !lab[c + w]) { lab[c + w] = id; q[qt++] = c + w; }
      }
      comps.push({ id: id, n: cnt, border: border, b: [bx0, by0, bx1, by1] });
    }
    var out = [], minPx = opt.minPx || 400, maxPx = (opt.maxFrac || 0.4) * n;
    comps.forEach(function (c) {
      if (c.border || c.n < minPx || c.n > maxPx) return;
      var ring = traceMask(lab, w, h, c.id, c.b[0], c.b[1], c.b[2], c.b[3]);
      if (!ring) return;
      ring = dpRing(ring, opt.tol || 1.3);
      if (ring.length >= 3) out.push({ px: ring, n: c.n });
    });
    return out;
  }

  // ---------- cekungan (potensi genangan) ----------
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) {
    var k = this.k, v = this.v, i = k.length; k.push(key); v.push(val);
    while (i > 0) { var p = (i - 1) >> 1; if (k[p] <= k[i]) break; var tk = k[p], tv = v[p]; k[p] = k[i]; v[p] = v[i]; k[i] = tk; v[i] = tv; i = p; }
  };
  Heap.prototype.pop = function () {
    var k = this.k, v = this.v, topK = k[0], topV = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv; var i = 0, n = k.length;
      for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < n && k[l] < k[m]) m = l; if (r < n && k[r] < k[m]) m = r; if (m === i) break; var tk = k[m], tv = v[m]; k[m] = k[i]; v[m] = v[i]; k[i] = tk; v[i] = tv; i = m; }
    }
    return [topK, topV];
  };
  // isi cekungan (priority-flood): kembalikan kedalaman tiap sel
  function fillDepth(z, cols, rows) {
    var n = cols * rows, fill = new Float32Array(n), seen = new Uint8Array(n), hp = new Heap(), i, j;
    function seed(idx) { if (seen[idx]) return; seen[idx] = 1; var v = z[idx]; fill[idx] = v === v ? v : -1e9; hp.push(fill[idx], idx); }
    for (i = 0; i < cols; i++) { seed(i); seed((rows - 1) * cols + i); }
    for (j = 0; j < rows; j++) { seed(j * cols); seed(j * cols + cols - 1); }
    for (i = 0; i < n; i++) if (z[i] !== z[i]) seed(i);
    while (hp.k.length) {
      var t = hp.pop(), c = t[1], cx = c % cols, cy = (c - cx) / cols, dj, di;
      for (dj = -1; dj <= 1; dj++) for (di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        var nx = cx + di, ny = cy + dj; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var ni = ny * cols + nx; if (seen[ni]) continue;
        seen[ni] = 1; var zv = z[ni]; fill[ni] = Math.max(zv === zv ? zv : -1e9, t[0]); hp.push(fill[ni], ni);
      }
    }
    var dep = new Float32Array(n);
    for (i = 0; i < n; i++) dep[i] = z[i] === z[i] ? Math.max(0, fill[i] - z[i]) : 0;
    return dep;
  }
  function bboxOf(pts, padM) {
    var s = Infinity, n = -Infinity, w = Infinity, e = -Infinity, c = cen(pts);
    pts.forEach(function (p) { s = Math.min(s, p[0]); n = Math.max(n, p[0]); w = Math.min(w, p[1]); e = Math.max(e, p[1]); });
    var dLat = padM / 111320, dLng = padM / (111320 * Math.cos(c[0] * R));
    return { s: s - dLat, n: n + dLat, w: w - dLng, e: e + dLng };
  }
  // murni (jalan di Worker): g = grid ketinggian, b = kotak, lake = topeng sel danau (atau null)
  function depCalc(pts, g, b, thr, lake) {
    var c = cen(pts), P = proj(c[0], c[1]), xy = pts.map(P.xy);
    if (!isFinite(g.mn)) throw new Error('Data ketinggian belum tersedia di area ini (butuh internet)');
    var cols = g.cols, rows = g.rows, dep = fillDepth(g.z, cols, rows), lab = new Int32Array(cols * rows), i, j, id = 0, comps = [], st = [];
    function cellLL(i2, j2) { return [b.n - j2 * (b.n - b.s) / (rows - 1), b.w + i2 * (b.e - b.w) / (cols - 1)]; }
    function ok(i2, j2) {
      var k = j2 * cols + i2; if (dep[k] < thr) return false;
      if (lake && lake[k]) return false;
      var ll = cellLL(i2, j2), q = P.xy(ll); return pip(q[0], q[1], xy);
    }
    var okm = new Uint8Array(cols * rows);
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) okm[j * cols + i] = ok(i, j) ? 1 : 0;
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var k0 = j * cols + i; if (!okm[k0] || lab[k0]) continue;
      id++; st.push(k0); lab[k0] = id; var cnt = 0, md = 0, sx = 0, sy = 0, bx0 = cols, by0 = rows, bx1 = 0, by1 = 0;
      while (st.length) {
        var c0 = st.pop(), cx = c0 % cols, cy = (c0 - cx) / cols, di, dj; cnt++; if (dep[c0] > md) md = dep[c0]; sx += cx; sy += cy;
        if (cx < bx0) bx0 = cx; if (cx > bx1) bx1 = cx; if (cy < by0) by0 = cy; if (cy > by1) by1 = cy;
        for (dj = -1; dj <= 1; dj++) for (di = -1; di <= 1; di++) {
          var nx = cx + di, ny = cy + dj; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          var nk = ny * cols + nx; if (okm[nk] && !lab[nk]) { lab[nk] = id; st.push(nk); }
        }
      }
      comps.push({ id: id, n: cnt, depth: md, cx: sx / cnt, cy: sy / cnt, bb: [bx0, by0, bx1, by1] });
    }
    var out = [];
    comps.forEach(function (cp) {
      if (cp.n < 2) return;
      var ring = traceMask(lab, cols, rows, cp.id, cp.bb[0], cp.bb[1], cp.bb[2], cp.bb[3]); if (!ring) return;
      function gl(p) { var ll = cellLL(p[0] - 0.5, p[1] - 0.5); return [+ll[0].toFixed(7), +ll[1].toFixed(7)]; }
      var cc = cellLL(cp.cx, cp.cy);
      out.push({ area: cp.n * g.dx * g.dy, depth: cp.depth, c: cc, poly: ring.map(gl) });
    });
    out.sort(function (p, q) { return q.depth - p.depth; });
    return { list: out, res: Math.max(g.dx, g.dy) };
  }
  function lakeMaskOf(HZ, b, g) {
    if (!HZ.inLake) return null;
    var m = new Uint8Array(g.cols * g.rows), any = false, i, j;
    for (j = 0; j < g.rows; j++) for (i = 0; i < g.cols; i++) {
      if (HZ.inLake(b.n - j * (b.n - b.s) / (g.rows - 1), b.w + i * (b.e - b.w) / (g.cols - 1))) { m[j * g.cols + i] = 1; any = true; }
    }
    return any ? m : null;
  }
  // pts: poligon blok; thr: kedalaman minimum (m)  (versi langsung, utas utama)
  function depressions(pts, thr) {
    var HZ = root.HzDem; if (!HZ) return Promise.reject(new Error('Data ketinggian tidak tersedia'));
    var b = bboxOf(pts, 40);
    return HZ.sampleGrid(b, 170).then(function (g) { return depCalc(pts, g, b, thr, lakeMaskOf(HZ, b, g)); });
  }

  // ---------- row mengikuti kontur (garis pedoman + garis sejajar berjarak tetap) ----------
  function smooth(ch, k) {
    var o = ch.slice(), t, i;
    for (t = 0; t < k; t++) { var nx = o.slice(); for (i = 1; i < o.length - 1; i++) nx[i] = [(o[i - 1][0] + o[i][0] + o[i + 1][0]) / 3, (o[i - 1][1] + o[i][1] + o[i + 1][1]) / 3]; o = nx; }
    return o;
  }
  // murni (jalan di Worker): garis pedoman = kontur median ketinggian di dalam blok
  function guideCalc(pts, g, b) {
    var c = cen(pts), P = proj(c[0], c[1]), xy = pts.map(P.xy);
    if (!isFinite(g.mn)) throw new Error('Data ketinggian belum tersedia di area ini (butuh internet)');
    var cols = g.cols, rows = g.rows, vals = [], i, j;
    function cellLL(x, y) { return [b.n - y * (b.n - b.s) / (rows - 1), b.w + x * (b.e - b.w) / (cols - 1)]; }
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) { var v = g.z[j * cols + i]; if (v === v) { var q = P.xy(cellLL(i, j)); if (pip(q[0], q[1], xy)) vals.push(v); } }
    if (vals.length < 4) throw new Error('Blok terlalu kecil untuk data ketinggian');
    vals.sort(function (p, q) { return p - q; });
    var L = vals[vals.length >> 1], chs = isoChains(g.z, cols, rows, L), best = null, bl = -1;
    chs.forEach(function (ch) {
      var ll = ch.map(function (p) { return cellLL(p[0], p[1]); }), inside = 0, k;
      for (k = 1; k < ll.length; k++) { var q0 = P.xy(ll[k]); if (pip(q0[0], q0[1], xy)) inside += Math.hypot(ll[k][0] - ll[k - 1][0], ll[k][1] - ll[k - 1][1]); }
      if (inside > bl) { bl = inside; best = ll; }
    });
    if (!best || best.length < 3) throw new Error('Garis pedoman tidak ditemukan (lereng terlalu datar)');
    return { guide: smooth(best, 2), level: L };
  }
  function guideFromDem(pts) {
    var HZ = root.HzDem; if (!HZ) return Promise.reject(new Error('Data ketinggian tidak tersedia'));
    var b = bboxOf(pts, 15);
    return HZ.sampleGrid(b, 200).then(function (g) { return guideCalc(pts, g, b); });
  }
  var MAXCELL = 40000;
  function rowsContour(pts, guide, sp, margin) {
    margin = margin || 0;
    var c = cen(pts), P = proj(c[0], c[1]), xy = pts.map(P.xy), gx = guide.map(P.xy), i, j, k;
    var bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    xy.forEach(function (p) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]); });
    // ukuran sel: cukup halus untuk jarak row, tapi jumlah sel dibatasi supaya ringan
    var cellM = Math.max(sp * 1.25, Math.sqrt(((bx1 - bx0) + 2 * sp) * ((by1 - by0) + 2 * sp) / MAXCELL)), step = cellM * 0.8, gp = [], gt = [];
    for (i = 0; i < gx.length - 1; i++) {
      var dx = gx[i + 1][0] - gx[i][0], dy = gx[i + 1][1] - gx[i][1], L = Math.hypot(dx, dy), m = Math.max(1, Math.ceil(L / step));
      for (j = 0; j < m; j++) { gp.push([gx[i][0] + dx * j / m, gx[i][1] + dy * j / m]); gt.push(L ? [dx / L, dy / L] : [1, 0]); }
    }
    gp.push(gx[gx.length - 1]); gt.push(gt[gt.length - 1] || [1, 0]);
    var x0 = bx0 - cellM, y0 = by0 - cellM, x1 = bx1 + cellM, y1 = by1 + cellM;
    var cols = Math.ceil((x1 - x0) / cellM) + 1, rows = Math.ceil((y1 - y0) / cellM) + 1;
    if (cols * rows > MAXCELL * 3) throw new Error('Blok terlalu besar untuk mode kontur');
    // sarang untuk pencarian titik terdekat
    var B = cellM * 10, bc = Math.ceil((x1 - x0) / B) + 1, br = Math.ceil((y1 - y0) / B) + 1, bk = new Array(bc * br);
    gp.forEach(function (p, idx) { var bi = Math.floor((p[0] - x0) / B), bj = Math.floor((p[1] - y0) / B); if (bi < 0 || bj < 0 || bi >= bc || bj >= br) return; var key = bj * bc + bi; (bk[key] || (bk[key] = [])).push(idx); });
    var NC = cols * rows, dist = new Float32Array(NC), inside = new Uint8Array(NC), need = new Uint8Array(NC);
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) inside[j * cols + i] = pip(x0 + i * cellM, y0 + j * cellM, xy) ? 1 : 0;
    // jarak hanya dihitung di sel dalam blok dan tetangganya
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      if (!inside[j * cols + i]) continue;
      var dj2, di2; for (dj2 = -1; dj2 <= 1; dj2++) for (di2 = -1; di2 <= 1; di2++) { var ni = i + di2, nj = j + dj2; if (ni >= 0 && nj >= 0 && ni < cols && nj < rows) need[nj * cols + ni] = 1; }
    }
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      if (!need[j * cols + i]) continue;
      var px = x0 + i * cellM, py = y0 + j * cellM, bi = Math.floor((px - x0) / B), bj = Math.floor((py - y0) / B), best = Infinity, bidx = -1, r;
      for (r = 0; r < Math.max(bc, br); r++) {
        if (bidx >= 0 && (r - 1) * B > best) break;
        for (var jj = bj - r; jj <= bj + r; jj++) for (var ii = bi - r; ii <= bi + r; ii++) {
          if (r && jj > bj - r && jj < bj + r && ii > bi - r && ii < bi + r) continue;
          if (ii < 0 || jj < 0 || ii >= bc || jj >= br) continue;
          var lst = bk[jj * bc + ii]; if (!lst) continue;
          for (k = 0; k < lst.length; k++) { var q = gp[lst[k]], dd = Math.hypot(px - q[0], py - q[1]); if (dd < best) { best = dd; bidx = lst[k]; } }
        }
      }
      var sgn = 1; if (bidx >= 0) { var tq = gt[bidx], qq = gp[bidx]; sgn = (tq[0] * (py - qq[1]) - tq[1] * (px - qq[0])) >= 0 ? 1 : -1; }
      dist[j * cols + i] = best * sgn;
    }
    // garis sejajar: level k*sp
    var levels = new Map();
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
      var a = j * cols + i; if (!(inside[a] || inside[a + 1] || inside[a + cols] || inside[a + cols + 1])) continue;
      var z0 = dist[a], z1 = dist[a + 1], z2 = dist[a + cols + 1], z3 = dist[a + cols], mn = Math.min(z0, z1, z2, z3), mx = Math.max(z0, z1, z2, z3);
      for (k = Math.ceil(mn / sp); k <= Math.floor(mx / sp); k++) {
        var Lv = k * sp;
        var cs = msCell(z0, z1, z2, z3, Lv); if (!cs) continue;
        var lv = levels.get(k); if (!lv) { lv = { segs: [], pos: new Map() }; levels.set(k, lv); }
        cs.forEach(function (cc) {
          var A = edgeInfo(i, j, cc[0], cols, z0, z1, z2, z3, Lv), Bq = edgeInfo(i, j, cc[1], cols, z0, z1, z2, z3, Lv);
          lv.pos.set(A[0], [A[1], A[2]]); lv.pos.set(Bq[0], [Bq[1], Bq[2]]); lv.segs.push([A[0], Bq[0]]);
        });
      }
    }
    var lines = [], total = 0, n = 0;
    levels.forEach(function (lv) {
      chain(lv.segs, lv.pos).forEach(function (ch) {
        // potong di dalam blok (dan di luar margin tepi)
        var cur = [], pts2 = ch.map(function (p) { return [x0 + p[0] * cellM, y0 + p[1] * cellM]; });
        function flush() {
          if (cur.length > 1) {
            var len = 0, t; for (t = 1; t < cur.length; t++) len += Math.hypot(cur[t][0] - cur[t - 1][0], cur[t][1] - cur[t - 1][1]);
            if (len >= 3) { lines.push(dp(cur, 0.25).map(function (p) { return P.ll(p[0], p[1]); })); total += len; n++; }
          }
          cur = [];
        }
        pts2.forEach(function (p) { if (pip(p[0], p[1], xy) && (margin <= 0 || distEdge(p[0], p[1], xy) >= margin)) cur.push(p); else flush(); });
        flush();
      });
    });
    return { lines: lines, n: n, total: total, avg: n ? total / n : 0 };
  }

  // ---------- pekerja latar (Web Worker), cadangan di utas utama ----------
  var JOBS = { w: null, q: [], cur: null, nid: 0, off: false }, FL = new Map();
  function konturCalc(a) {
    var guide = a.guide;
    if (!guide) guide = guideCalc(a.pts, a.gg, a.gb).guide;
    var r = rowsContour(a.pts, guide, a.sp, a.margin); r.guide = guide; return r;
  }
  function depJobCalc(a) { return depCalc(a.pts, a.g, a.b, a.thr, a.lake); }
  var KIND = { kontur: konturCalc, dep: depJobCalc };
  function workerSrc() {
    return '(' + HZB.toString() + ')(self);\nself.onmessage=function(e){var d=e.data;try{var r=self.HzBlok._k[d.kind](d.args);self.postMessage({id:d.id,ok:true,r:r});}catch(x){self.postMessage({id:d.id,ok:false,msg:String(x&&x.message||x)});}};';
  }
  function mkWorker() {
    if (JOBS.off || typeof Worker === 'undefined' || typeof Blob === 'undefined' || !root.URL || !root.URL.createObjectURL) return null;
    try {
      var w = new Worker(root.URL.createObjectURL(new Blob([workerSrc()], { type: 'application/javascript' })));
      w.onmessage = function (e) { done(e.data); };
      w.onerror = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        JOBS.off = true; try { w.terminate(); } catch (x) {} JOBS.w = null;
        if (JOBS.cur) runMain(JOBS.cur); else pump();
      };
      return w;
    } catch (x) { JOBS.off = true; return null; }
  }
  function done(d) {
    var j = JOBS.cur; if (!j || j.id !== d.id) return;
    JOBS.cur = null; if (d.ok) j.res(d.r); else j.rej(new Error(d.msg));
    pump();
  }
  function runMain(j) {
    setTimeout(function () {
      var out, err; try { out = KIND[j.kind](j.args); } catch (x) { err = x; }
      JOBS.cur = null; if (err) j.rej(err); else j.res(out);
      pump();
    }, 0);
  }
  function pump() {
    if (JOBS.cur || !JOBS.q.length) return;
    var j = JOBS.q.shift(); JOBS.cur = j;
    var w = JOBS.w || (JOBS.w = mkWorker());
    if (!w) { runMain(j); return; }
    try { w.postMessage({ id: j.id, kind: j.kind, args: j.args }); } catch (x) { JOBS.off = true; JOBS.w = null; runMain(j); }
  }
  function job(kind, args, front) {
    return new Promise(function (res, rej) {
      var j = { id: ++JOBS.nid, kind: kind, args: args, res: res, rej: rej };
      if (front) JOBS.q.unshift(j); else JOBS.q.push(j);
      pump();
    });
  }
  // satu perhitungan bersama per kunci (popup dan lapisan tidak menghitung dobel)
  function once(key, fn) {
    if (FL.has(key)) return FL.get(key);
    var p = fn().then(function (r) { FL.delete(key); return r; }, function (e) { FL.delete(key); throw e; });
    FL.set(key, p); return p;
  }
  // row kontur: guide = garis pedoman manual (atau null = otomatis dari data ketinggian)
  function konturJob(pts, guide, sp, margin, key, front) {
    return once('k|' + key, function () {
      if (guide) return job('kontur', { pts: pts, guide: guide, sp: sp, margin: margin }, front);
      var HZ = root.HzDem; if (!HZ) return Promise.reject(new Error('Data ketinggian tidak tersedia'));
      var b = bboxOf(pts, 15);
      return HZ.sampleGrid(b, 200).then(function (g) { return job('kontur', { pts: pts, guide: null, gg: g, gb: b, sp: sp, margin: margin }, front); });
    });
  }
  function depJob(pts, thr, key, front) {
    return once('d|' + key, function () {
      var HZ = root.HzDem; if (!HZ) return Promise.reject(new Error('Data ketinggian tidak tersedia'));
      var b = bboxOf(pts, 40);
      return HZ.sampleGrid(b, 170).then(function (g) { return job('dep', { pts: pts, g: g, b: b, thr: thr, lake: lakeMaskOf(HZ, b, g) }, front); });
    });
  }

  // ---------- simpanan hasil (IndexedDB hzblk): kunci = id blok + tanda tangan bentuk/jarak ----------
  var CDB = null;
  function cdb() {
    if (CDB) return CDB;
    CDB = new Promise(function (res, rej) {
      try {
        var r = root.indexedDB.open('hzblk', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('c'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (x) { rej(x); }
    });
    CDB.catch(function () { CDB = null; });
    return CDB;
  }
  function cget(key) {
    return cdb().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction('c').objectStore('c').get(key);
        q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  // simpan; entri lama blok yang sama dengan jenis sama (r/d) dibuang
  function cput(id, kind, key, val) {
    return cdb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction('c', 'readwrite'), st = tx.objectStore('c'), pre = id + '\u0001' + kind + '|';
        var cur = st.openCursor(root.IDBKeyRange.bound(pre, pre + '\uffff'));
        cur.onsuccess = function () { var c = cur.result; if (c) { if (c.key !== key) c.delete(); c.continue(); } else st.put(val, key); };
        tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); };
      });
    }).catch(function () { return false; });
  }
  function cdel(id) {
    return cdb().then(function (db) { return new Promise(function (res) { var tx = db.transaction('c', 'readwrite'); tx.objectStore('c').delete(root.IDBKeyRange.bound(id + '\u0001', id + '\u0002')); tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); }; }); }).catch(function () { return false; });
  }
  function cclear() {
    return cdb().then(function (db) { return new Promise(function (res) { var tx = db.transaction('c', 'readwrite'); tx.objectStore('c').clear(); tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); }; }); }).catch(function () { return false; });
  }
  // jumlah blok yang kontur-nya tersimpan
  function ccount() {
    return cdb().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction('c').objectStore('c').getAllKeys();
        q.onsuccess = function () { var n = 0; (q.result || []).forEach(function (k) { if (String(k).indexOf('\u0001r|') > 0) n++; }); res(n); };
        q.onerror = function () { res(0); };
      });
    }).catch(function () { return 0; });
  }

  root.HzBlok = {
    proj: proj, pip: pip, areaHa: areaHa, suggestDir: suggestDir, bearing: bearing, angleToSlope: angleToSlope,
    rowsStraight: rowsStraight, rowsContour: rowsContour, guideFromDem: guideFromDem, depressions: depressions, detect: detect,
    konturJob: konturJob, depJob: depJob, _k: KIND,
    cache: { get: cget, put: cput, del: cdel, clear: cclear, count: ccount },
    _t: { isoChains: isoChains, fillDepth: fillDepth, traceMask: traceMask, dpRing: dpRing, msCell: msCell }
  };
})(typeof window !== 'undefined' ? window : globalThis);
