/* HZ Trip - Isi blok (ketuk di dalam blok pada peta PDF) dan Geser blok (selaraskan semua blok dengan satelit) */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function $() { return HA.$.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  HA.fillStart = fillStart;
  HA.shiftStart = shiftStart;
  HA.shiftUndo = shiftUndo;
  HA.fillRegion = fillRegion;
  HA.traceOutline = traceOutline;
  HA.dpSimplify = dpSimplify;

  function mkBar(inner) {
    var bar = document.createElement('div'); bar.className = 'lkbar bot'; bar.innerHTML = '<span id="isT"></span>' + inner;
    HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar); return bar;
  }
  function pip(ll, pts) { var i, j, c = false; for (i = 0, j = pts.length - 1; i < pts.length; j = i++) { if (((pts[i][0] > ll[0]) !== (pts[j][0] > ll[0])) && (ll[1] < (pts[j][1] - pts[i][1]) * (ll[0] - pts[i][0]) / (pts[j][0] - pts[i][0]) + pts[i][1])) c = !c; } return c; }

  // ---------- pengisian area (gambar RGBA) ----------
  // data: RGBA, w x h. Mengembalikan { mask(solid, lubang teks ditutup), leak } atau { err }
  function fillRegion(data, w, h, sx, sy, opt) {
    opt = opt || {};
    var thr = opt.thr || 150, n = w * h, blocked = new Uint8Array(n), i, x, y;
    for (i = 0; i < n; i++) { var k = i * 4, lum = 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2]; if (lum < thr && data[k + 3] > 40) blocked[i] = 1; }
    // garis ditebalkan 1 piksel supaya celah halus tidak bocor
    var bl2 = new Uint8Array(blocked);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var p = y * w + x; if (blocked[p]) { if (x > 0) bl2[p - 1] = 1; if (x < w - 1) bl2[p + 1] = 1; if (y > 0) bl2[p - w] = 1; if (y < h - 1) bl2[p + w] = 1; } }
    var st = sy * w + sx;
    if (bl2[st]) { // cari piksel kosong terdekat
      var found = -1, r, dx, dy;
      for (r = 1; r <= 10 && found < 0; r++) for (dy = -r; dy <= r && found < 0; dy++) for (dx = -r; dx <= r; dx++) { var qx = sx + dx, qy = sy + dy; if (qx >= 0 && qy >= 0 && qx < w && qy < h && !bl2[qy * w + qx]) { found = qy * w + qx; break; } }
      if (found < 0) return { err: 'Ketuk di area putih dalam blok, bukan di garis atau teks.' };
      st = found;
    }
    var vis = new Uint8Array(n), q = new Int32Array(n), qh = 0, qt = 0, cnt = 0, leak = false, maxc = opt.max || 2500000;
    var seen = new Uint8Array(n), minc = opt.minc || 4000;
    function flood(s0) {
      vis.fill(0); qh = 0; qt = 0; cnt = 0; leak = false; q[qt++] = s0; vis[s0] = 1;
      while (qh < qt) {
        var c = q[qh++]; cnt++;
        var cx = c % w, cy = (c - cx) / w;
        if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) leak = true;
        if (cnt > maxc) { leak = true; break; }
        if (cx > 0 && !vis[c - 1] && !bl2[c - 1]) { vis[c - 1] = 1; q[qt++] = c - 1; }
        if (cx < w - 1 && !vis[c + 1] && !bl2[c + 1]) { vis[c + 1] = 1; q[qt++] = c + 1; }
        if (cy > 0 && !vis[c - w] && !bl2[c - w]) { vis[c - w] = 1; q[qt++] = c - w; }
        if (cy < h - 1 && !vis[c + w] && !bl2[c + w]) { vis[c + w] = 1; q[qt++] = c + w; }
      }
      for (var j = 0; j < qt; j++) seen[q[j]] = 1;
    }
    flood(st);
    // terkurung di kantong kecil (mis. di dalam angka pada teks nomor blok)? cari titik lain di sekitar ketukan
    if (!leak && cnt < minc) {
      var rr, an, okf = false;
      for (rr = 6; rr <= 160 && !okf; rr += 6) for (an = 0; an < 12 && !okf; an++) {
        var tx = Math.round(sx + rr * Math.cos(an * Math.PI / 6)), ty = Math.round(sy + rr * Math.sin(an * Math.PI / 6));
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        var tp = ty * w + tx; if (bl2[tp] || seen[tp]) continue;
        flood(tp); if (leak || cnt >= minc) okf = true;
      }
      if (!okf) return { err: 'Ketuk di area putih dalam blok, bukan di garis atau teks.' };
    }
    if (leak) return { leak: true, count: cnt };
    // tutup lubang (teks nomor blok): semua yang tidak terhubung ke luar dianggap bagian blok
    var out = new Uint8Array(n); qh = qt = 0;
    function seed(p) { if (!vis[p] && !out[p]) { out[p] = 1; q[qt++] = p; } }
    for (x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (qh < qt) {
      var d = q[qh++], dx2 = d % w, dy2 = (d - dx2) / w;
      if (dx2 > 0) seed(d - 1); if (dx2 < w - 1) seed(d + 1); if (dy2 > 0) seed(d - w); if (dy2 < h - 1) seed(d + w);
    }
    // solid = isian + lubang yang terkurung isian (huruf/angka nomor blok); garis tepi dan sekitarnya tersambung ke luar
    var solid = new Uint8Array(n);
    for (i = 0; i < n; i++) if (!out[i]) solid[i] = 1;
    return { solid: solid, w: w, h: h, count: cnt };
  }
  // jejak tepi luar (pojok piksel). Mengembalikan daftar [x,y] pojok.
  function traceOutline(solid, w, h) {
    var i0 = -1, i;
    for (i = 0; i < w * h; i++) if (solid[i]) { i0 = i; break; }
    if (i0 < 0) return [];
    function S1(x, y) { return x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x] === 1; }
    var x0 = i0 % w, y0 = (i0 - x0) / w, x = x0, y = y0, d = 0, pts = [], guard = 0, maxG = w * h * 4 + 16;
    // d: 0 kanan, 1 bawah, 2 kiri, 3 atas; piksel padat di sisi kanan arah jalan
    do {
      var L, R;
      if (d === 0) { L = S1(x, y - 1); R = S1(x, y); }
      else if (d === 1) { L = S1(x, y); R = S1(x - 1, y); }
      else if (d === 2) { L = S1(x - 1, y); R = S1(x - 1, y - 1); }
      else { L = S1(x - 1, y - 1); R = S1(x, y - 1); }
      if (R && !L) { x += d === 0 ? 1 : d === 2 ? -1 : 0; y += d === 1 ? 1 : d === 3 ? -1 : 0; }
      else if (R && L) { d = (d + 3) % 4; pts.push([x, y]); }
      else { d = (d + 1) % 4; pts.push([x, y]); }
      if (++guard > maxG) break;
    } while (!(x === x0 && y === y0 && d === 0));
    // buang titik ganda berturut-turut
    var o = []; pts.forEach(function (p) { var l = o[o.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) o.push(p); });
    return o;
  }
  function dpSimplify(pts, tol) {
    if (pts.length < 4) return pts.slice();
    var keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    (function rec(a, b) {
      var best = -1, bi = -1, ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, i;
      for (i = a + 1; i < b; i++) {
        var t = l2 ? Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2)) : 0, d = Math.hypot(pts[i][0] - (ax + t * dx), pts[i][1] - (ay + t * dy));
        if (d > best) { best = d; bi = i; }
      }
      if (best > tol) { keep[bi] = 1; rec(a, bi); rec(bi, b); }
    })(0, pts.length - 1);
    return pts.filter(function (_, i) { return keep[i]; });
  }

  // ---------- nama blok dari teks PDF ----------
  var LABC = {};
  function labelsLL(o) {
    if (!o.labels || !o.labels.length) return [];
    var key = o.id + '|' + (o.aff ? JSON.stringify(o.aff) : JSON.stringify(o.cal)); if (LABC[key]) return LABC[key];
    var af = HzOverlay.affOf(o); if (!af) return [];
    var res = o.labels.map(function (l) { var q = L.CRS.EPSG3857.unproject(L.point(af.A * l.u + af.B * l.v + af.C, af.D * l.u + af.E * l.v + af.F)); return { t: l.t, lat: q.lat, lng: q.lng, u: l.u, v: l.v }; });
    LABC = {}; LABC[key] = res; return res;
  }
  function nameFor(poly) {
    var found = [];
    (HA.ovList() || []).forEach(function (o) { if (!o.cal) return; labelsLL(o).forEach(function (l) { if (pip([l.lat, l.lng], poly)) found.push(l); }); });
    if (!found.length) return null;
    found.sort(function (a, b) { return Math.abs(a.v - b.v) > 6 ? a.v - b.v : a.u - b.u; });
    var nm = found.map(function (l) { return l.t; }).join(' ').replace(/\s+/g, ' ').trim();
    return nm.length && nm.length <= 18 ? nm : null;
  }

  // ---------- Isi blok ----------
  function fillStart() {
    if (!HA.map) return;
    if (HA.S.view !== 'lintasan') { HA.mapKeep = true; go('lintasan'); setTimeout(fillStart, 800); return; }
    HA.pbStopForEdit(); HA.closeAll();
    if (HA.map._lakeDraw) { toast('Selesaikan dulu yang sedang digambar'); return; }
    var ovs = HA.ovList().filter(function (o) { return o.cal && o.levels && o.levels.length; });
    if (!ovs.length) { toast('Pasang dan kalibrasi peta PDF dulu (Data peta > PDF)'); return; }
    var o = ovs.filter(function (x) { return x.on !== false; })[0] || ovs[0], made = [], busy = false;
    if (S.settings.mapMode !== 'osm') toast('Tip: ganti ke mode Peta supaya garis blok PDF terlihat');
    var bar = mkBar('<button type="button" id="isU">Urungkan</button><button type="button" class="pri" id="isX">Selesai</button>');
    function text(t) { var e = $('isT'); if (e) e.textContent = t || ('Isi blok · ketuk di dalam blok · ' + made.length + ' blok dibuat'); }
    function end() { HA.map._lakeDraw = null; bar.remove(); }
    $('isX').onclick = end;
    $('isU').onclick = function () {
      var id = made.pop(); if (id == null) return;
      HA.S.settings.blocks = HA.blocksList().filter(function (b) { return b.id !== id; }); saveSettings(); HA.drawBlocks(); HA.drawRows(); text();
    };
    text();
    HA.map._lakeDraw = { tap: function (ll) {
      if (busy) return;
      var af = HzOverlay.affOf(o); if (!af) return;
      if (HA.blocksList().some(function (b) { return b.pts && pip([ll.lat, ll.lng], b.pts); })) { toast('Sudah ada blok di titik ini'); return; }
      var q = L.CRS.EPSG3857.project(L.latLng(ll.lat, ll.lng)), det = af.A * af.E - af.B * af.D;
      var u = (af.E * (q.x - af.C) - af.B * (q.y - af.F)) / det, v = (-af.D * (q.x - af.C) + af.A * (q.y - af.F)) / det;
      if (!(u >= 0 && v >= 0 && u < o.W && v < o.H)) { toast('Titik ini di luar peta PDF'); return; }
      busy = true; text('Mengisi…');
      HzOverlay.regionAt(o, u, v, 1100).then(function (rg) {
        if (!rg) throw new Error('Gambar peta tidak terbaca');
        var sx = Math.round(u - rg.x0), sy = Math.round(v - rg.y0), r = fillRegion(rg.data, rg.w, rg.h, Math.max(0, Math.min(rg.w - 1, sx)), Math.max(0, Math.min(rg.h - 1, sy)));
        if (r.err) throw new Error(r.err);
        if (r.leak) throw new Error('Garis blok tidak tertutup di sekitar sini, isian bocor. Ketuk blok lain, atau gambar manual lewat Buat baru.');
        var ring = traceOutline(r.solid, r.w, r.h);
        if (ring.length < 4) throw new Error('Bentuk blok tidak terbaca');
        var simp = dpSimplify(ring.concat([ring[0]]), 2.2); simp.pop();
        if (simp.length < 3) throw new Error('Bentuk blok terlalu kecil');
        var pts = simp.map(function (p) { var pu = rg.x0 + p[0], pv = rg.y0 + p[1], w2 = L.CRS.EPSG3857.unproject(L.point(af.A * pu + af.B * pv + af.C, af.D * pu + af.E * pv + af.F)); return [+w2.lat.toFixed(6), +w2.lng.toFixed(6)]; });
        var k = Math.cos(pts[0][0] * Math.PI / 180) * 111320, i;
        var A = 0; for (i = 0; i < pts.length; i++) { var p1 = pts[i], p2 = pts[(i + 1) % pts.length]; A += (p1[1] * k) * (p2[0] * 111320) - (p2[1] * k) * (p1[0] * 111320); } A = Math.abs(A) / 2;
        if (A < 300) throw new Error('Area terlalu kecil, ketuk di dalam blok yang lebih besar');
        var nm = nameFor(pts), blk = { id: Date.now(), src: 'manual', name: nm || ('Blok ' + HA.nextBlockNo()), pts: pts, ovId: o.id, dir: null, sp: null, margin: 0, conf: false, note: '' };
        HA.blocksList().push(blk); S.settings.blkOn = true; saveSettings(); made.push(blk.id); HA.drawBlocks(); HA.drawRows();
        toast(blk.name + ' · ' + (A / 10000).toFixed(1).replace('.', ',') + ' ha');
      }).catch(function (e) { toast(String(e && e.message || e)); }).then(function () { busy = false; text(); });
    } };
  }

  // ---------- Geser blok ----------
  function shiftStart() {
    if (!HA.map) return;
    if (S.view !== 'lintasan') { HA.mapKeep = true; go('lintasan'); setTimeout(shiftStart, 800); return; }
    HA.pbStopForEdit(); HA.closeAll();
    if (HA.map._lakeDraw) { toast('Selesaikan dulu yang sedang digambar'); return; }
    var n = HA.blocksList().length; if (!n) { toast('Belum ada blok'); return; }
    var P = [], g = L.layerGroup().addTo(HA.map), bar = mkBar('<button type="button" id="gU">Urungkan</button><button type="button" id="gC">Batal</button><button type="button" class="pri" id="gOk" disabled>Terapkan</button>');
    function icon(k) { var t = k % 2 ? '→' : '●'; return L.divIcon({ className: '', html: '<div class="tpm"><b>' + (Math.floor(k / 2) + 1) + (k % 2 ? '′' : '') + '</b><div class="d"></div><div class="h"></div></div>', iconSize: [56, 80], iconAnchor: [28, 24] }); }
    function hint() {
      var k = P.length;
      return k === 0 ? 'Ketuk titik acuan 1 di blok (posisi sekarang, mis. sudut blok)' : k === 1 ? 'Ketuk tempat yang benar untuk titik 1 (di satelit)' : k === 2 ? 'Selesai bila cukup (geser). Atau ketuk acuan 2 untuk memutar dan menskala' : k === 3 ? 'Ketuk tempat yang benar untuk titik 2' : 'Siap diterapkan';
    }
    function draw() {
      g.clearLayers();
      P.forEach(function (p, k) {
        var m = L.marker(p, { draggable: true, icon: icon(k), zIndexOffset: 900 }).addTo(g);
        m.on('drag', function (e) { var q = e.target.getLatLng(); P[k] = [q.lat, q.lng]; lines(); });
        m.on('dragend', function () { draw(); });
      });
      lines(); $('isT').textContent = hint(); $('gOk').disabled = P.length < 2 || P.length === 3;
    }
    var ln = [];
    function lines() { ln.forEach(function (l) { g.removeLayer(l); }); ln = []; for (var k = 0; k + 1 < P.length; k += 2) ln.push(L.polyline([P[k], P[k + 1]], { color: '#FFD84D', weight: 2.5, dashArray: '5 5', interactive: false }).addTo(g)); }
    function end() { HA.map._lakeDraw = null; HA.map.removeLayer(g); bar.remove(); }
    HA.map._lakeDraw = { tap: function (ll) { if (P.length >= 4) return; P.push([ll.lat, ll.lng]); draw(); } };
    $('gU').onclick = function () { P.pop(); draw(); };
    $('gC').onclick = end;
    $('gOk').onclick = function () {
      var lat0 = P[0][0], k = Math.cos(lat0 * Math.PI / 180), ky = 111320, kx = 111320 * k;
      function xy(p) { return [(p[1] - P[0][1]) * kx, (p[0] - lat0) * ky]; }
      var a1 = [0, 0], b1 = xy(P[1]), c = [1, 0], rot = 0;
      if (P.length === 4) {
        var a2 = xy(P[2]), b2 = xy(P[3]), da = [a2[0] - a1[0], a2[1] - a1[1]], db = [b2[0] - b1[0], b2[1] - b1[1]], den = da[0] * da[0] + da[1] * da[1];
        if (den < 25) { toast('Titik acuan 1 dan 2 terlalu dekat'); return; }
        c = [(db[0] * da[0] + db[1] * da[1]) / den, (db[1] * da[0] - db[0] * da[1]) / den];
        var sc = Math.hypot(c[0], c[1]); rot = Math.atan2(c[1], c[0]) * 180 / Math.PI;
        if (sc < 0.9 || sc > 1.1) { toast('Skala ' + sc.toFixed(2) + ' tidak wajar. Periksa titik acuan'); return; }
      }
      var shift = Math.hypot(b1[0], b1[1]);
      askConfirm('Geser ' + n + ' blok?', 'Semua blok digeser ' + Math.round(shift) + ' m' + (P.length === 4 ? ' dan diputar ' + rot.toFixed(2).replace('.', ',') + '°' : '') + '. Posisi lama disimpan, bisa diurungkan dari Data peta > Blok.', 'Terapkan', function () {
        var bk = { t: Date.now(), blocks: {} };
        function tr(pt) { var x = (pt[1] - P[0][1]) * kx, y = (pt[0] - lat0) * ky, nx = b1[0] + c[0] * x - c[1] * y, ny = b1[1] + c[1] * x + c[0] * y; return [+(lat0 + ny / ky).toFixed(6), +(P[0][1] + nx / kx).toFixed(6)]; }
        HA.blocksList().forEach(function (b) {
          bk.blocks[b.id] = { pts: b.pts, guide: b.guide || null, dir: b.dir == null ? null : b.dir };
          b.pts = b.pts.map(tr); if (b.guide) b.guide = b.guide.map(tr);
          if (rot && b.dir != null) b.dir = (((b.dir - rot) % 180) + 180) % 180;
          delete b._bb;
        });
        S.settings.shiftBackup = bk; HA.CUTM = {}; if (HA.RC) { HA.RC.rows = {}; HA.RC.dep = {}; }
        saveSettings(); end(); HA.closeBlockPop(); HA.drawBlocks(); HA.drawRows(); toast(n + ' blok digeser. Urungkan ada di Data peta > Blok');
      });
    };
    draw();
  }
  function shiftUndo() {
    var bk = S.settings.shiftBackup; if (!bk) return;
    var n = 0; HA.blocksList().forEach(function (b) { var o = bk.blocks[b.id]; if (o) { b.pts = o.pts; if (o.guide) b.guide = o.guide; else delete b.guide; b.dir = o.dir; delete b._bb; n++; } });
    delete S.settings.shiftBackup; HA.CUTM = {}; if (HA.RC) { HA.RC.rows = {}; HA.RC.dep = {}; }
    saveSettings(); HA.drawBlocks(); HA.drawRows(); toast('Geser diurungkan untuk ' + n + ' blok');
  }
})();
