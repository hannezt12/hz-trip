/* HZ Trip - Walking di Lintasan (v0.19.1): berjalan di lapangan, app membaca konteksnya.
 * Tepi ke tepi di dalam blok = bentuk tanda (bagian A, B, ...); tertutup di luar blok = blok baru;
 * selain itu = tanda titik berisi jarak ke tepi blok. Bagian tanpa kategori disimpan sebagai draf. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !window.HzWalk) return;
  var S = HA.S, WK = null, PV = null, TOL = 8;
  var COLS = ['#4DA3FF', '#FF8A3D', '#35D07F', '#C77DFF', '#FFD84D', '#FF5A8A', '#3DD6D0', '#A0C43D'];
  var RING = { g: '#35D07F', y: '#FFD84D', r: '#FF5A4D' };
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function fmtLen(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2).replace('.', ',') + ' km'; }
  function ha(m2) { return (m2 / 10000).toFixed(2).replace('.', ',') + ' ha'; }
  function drafs() { if (!S.settings.wkDraf) S.settings.wkDraf = []; return S.settings.wkDraf; }
  function prj(ref) {
    var kx = 111320 * Math.cos(ref[0] * Math.PI / 180), ky = 110540;
    return { xy: function (p) { return [(p[1] - ref[1]) * kx, (p[0] - ref[0]) * ky]; }, ll: function (q) { return [ref[0] + q[1] / ky, ref[1] + q[0] / kx]; } };
  }
  function areaXY(r) { var a = 0, i, n = r.length; for (i = 0; i < n; i++) { var q = r[(i + 1) % n]; a += r[i][0] * q[1] - q[0] * r[i][1]; } return Math.abs(a) / 2; }
  function areaLL(ring) { var P = prj(ring[0]); return areaXY(ring.map(P.xy)); }
  function pip(pt, poly) {
    var x = pt[1], y = pt[0], ins = false, i, j;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][1], yi = poly[i][0], xj = poly[j][1], yj = poly[j][0];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  function edgeDist(b, p) { // meter dari titik ke tepi poligon blok
    var P = prj(p), q = [0, 0], best = Infinity, n = b.pts.length, i, xy = b.pts.map(P.xy);
    for (i = 0; i < n; i++) {
      var a = xy[i], c = xy[(i + 1) % n], dx = c[0] - a[0], dy = c[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
    }
    return best;
  }
  function near(p, m) { // blok yang kotak batasnya (+m) memuat titik
    var d = m / 111320, out = [];
    HA.blocksList().forEach(function (b) {
      if (!b.pts || b.pts.length < 3) return;
      var a = 90, z = -90, c = 180, e = -180;
      b.pts.forEach(function (q) { if (q[0] < a) a = q[0]; if (q[0] > z) z = q[0]; if (q[1] < c) c = q[1]; if (q[1] > e) e = q[1]; });
      if (p[0] >= a - d && p[0] <= z + d && p[1] >= c - d && p[1] <= e + d) out.push(b);
    });
    return out;
  }
  function label(i) { return i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + i % 26); }
  function today() { return S.mapDay || S.today; }

  // ---------- rekam ----------
  function start() {
    var map = HA.map; if (!map) return;
    if (S.view !== 'lintasan') { HA.mapKeep = true; HA.go('lintasan'); setTimeout(start, 800); return; }
    if (WK) return;
    if (map._lakeDraw) { toast('Selesaikan dulu yang sedang digambar'); return; }
    HA.pbStopForEdit(); HA.closeAll();
    WK = { w: HzWalk.create({}), n: 0, timer: null, g: L.layerGroup().addTo(map), cur: null, screen: false, vis: null, busy: false };
    var a = document.createElement('div'); a.className = 'wkAcc'; a.innerHTML = '<b id="wkA">Akurasi …</b><small id="wkI"></small>';
    map.getContainer().appendChild(a); WK.acc = a;
    var bar = document.createElement('div'); bar.className = 'lkbar bot';
    bar.innerHTML = '<span id="nbT"></span>' + (HA.titikActive && HA.titikActive() ? '<button type="button" id="wkT">+ Tanda</button>' : '') + '<button type="button" id="wkP">Jeda</button><button type="button" id="wkU">Urung 10 m</button><button type="button" id="wkS">Layar</button><button type="button" class="pri" id="wkOk">Selesai</button>';
    map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar); WK.bar = bar;
    if ($('wkT')) $('wkT').onclick = function () { var c = WK.cur; if (!c) { toast('Posisi belum didapat'); return; } if (c.acc > 30) toast('Akurasi ±' + Math.round(c.acc) + ' m kurang baik'); if (HA.titikAdd([c.lat, c.lng])) WK.tk = (WK.tk || 0) + 1; };
    $('wkP').onclick = function () { if (WK.w.isPaused()) { WK.w.resume(); this.textContent = 'Jeda'; } else { WK.w.pause(); this.textContent = 'Lanjut'; } draw(); };
    $('wkU').onclick = function () { WK.w.undo(10); draw(); };
    $('wkS').onclick = function () { WK.screen = !WK.screen; this.classList.toggle('on', WK.screen); HA.Plug.keepScreen({ on: WK.screen }).catch(function () {}); toast(WK.screen ? 'Layar tetap menyala' : 'Layar boleh mati (hemat baterai)'); };
    $('wkOk').onclick = finish;
    HA.ukurBack = function () { askConfirm('Hentikan Walking?', 'Rekaman jalur dibuang.', 'Buang', function () { cleanup(); }); return true; };
    HA.Plug.walkStart().then(function () {
      WK.timer = setInterval(poll, 1000);
      WK.vis = function () { if (!document.hidden) poll(); };
      document.addEventListener('visibilitychange', WK.vis);
      toast('Walking mulai. Berjalan di dalam blok, tepi ke tepi');
    }).catch(function (e) { toast('Walking gagal: ' + (e && e.message || e)); cleanup(); });
    draw();
  }
  function poll() {
    if (!WK || WK.busy) return;
    WK.busy = true;
    HA.Plug.walkRead({ from: WK.n }).then(function (r) {
      if (!WK) return;
      WK.busy = false; WK.n = r.n;
      (r.text || '').split('\n').forEach(function (ln) {
        if (!ln) return;
        var q = ln.split(','), f = { t: +q[0], lat: +q[1], lng: +q[2], acc: +q[3] };
        if (isFinite(f.lat) && isFinite(f.lng)) { WK.cur = f; WK.w.fix(f); }
      });
      draw();
      if (WK.cur && !HA.map.getBounds().pad(-0.3).contains([WK.cur.lat, WK.cur.lng])) HA.map.panTo([WK.cur.lat, WK.cur.lng], { animate: true });
    }).catch(function () { if (WK) WK.busy = false; });
  }
  function draw() {
    if (!WK) return;
    WK.g.clearLayers();
    var P = WK.w.points(), i;
    for (i = 1; i < P.length; i++) {
      var seg = [[P[i - 1].lat, P[i - 1].lng], [P[i].lat, P[i].lng]];
      if (P[i].g) L.polyline(seg, { color: '#FF8A00', weight: 3, dashArray: '6 6', interactive: false }).addTo(WK.g);
      else { L.polyline(seg, { color: '#06202B', weight: 6, opacity: .55, interactive: false }).addTo(WK.g); L.polyline(seg, { color: HA.NEON, weight: 3, interactive: false }).addTo(WK.g); }
    }
    if (P.length) L.circleMarker([P[0].lat, P[0].lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#35D07F', fillOpacity: 1, interactive: false }).addTo(WK.g);
    var c = WK.cur;
    if (c) {
      L.circle([c.lat, c.lng], { radius: Math.max(c.acc, 1), color: '#4DA3FF', weight: 1, fillColor: '#4DA3FF', fillOpacity: 0.12, interactive: false }).addTo(WK.g);
      L.circleMarker([c.lat, c.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#2F80FF', fillOpacity: 1, interactive: false }).addTo(WK.g);
      var el = $('wkA'); if (el) { el.textContent = 'Akurasi ±' + Math.round(c.acc) + ' m'; el.style.color = RING[HzWalk.accClass(c.acc)]; }
    }
    var t = $('nbT'); if (t) t.textContent = 'Walking' + (WK.w.isPaused() ? ' dijeda' : '') + ' · ' + fmtLen(WK.w.length()) + ' · ' + P.length + ' titik';
    var inf = $('wkI'); if (inf) inf.textContent = c ? (Date.now() - c.t < 5000 ? '' : 'posisi terakhir ' + Math.round((Date.now() - c.t) / 1000) + ' dtk lalu') : 'menunggu GPS…';
  }
  function cleanup() {
    if (!WK) return;
    clearInterval(WK.timer); if (WK.vis) document.removeEventListener('visibilitychange', WK.vis);
    try { HA.Plug.walkStop().catch(function () {}); HA.Plug.keepScreen({ on: false }).catch(function () {}); } catch (e) {}
    if (WK.acc) WK.acc.remove(); if (WK.bar) WK.bar.remove();
    HA.map.removeLayer(WK.g); WK = null; HA.ukurBack = null;
  }

  // ---------- pratinjau di peta ----------
  function pvClear() { if (PV) { HA.map.removeLayer(PV); PV = null; } }
  function pvShow(parts) { // parts: [{ring,label,draf}]
    pvClear(); PV = L.layerGroup().addTo(HA.map);
    parts.forEach(function (p, i) {
      var col = COLS[i % COLS.length];
      L.polygon(p.ring, { color: col, weight: 3, fillColor: col, fillOpacity: .3, dashArray: p.draf ? '6 6' : null, interactive: false }).addTo(PV);
      var cy = 0, cx = 0; p.ring.forEach(function (q) { cy += q[0]; cx += q[1]; }); cy /= p.ring.length; cx /= p.ring.length;
      L.marker([cy, cx], { interactive: false, icon: L.divIcon({ className: '', html: '<div style="min-width:26px;height:26px;border-radius:13px;background:' + col + ';color:#06202B;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff">' + esc(p.label) + '</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(PV);
    });
  }
  function ink(hex) { var h = String(hex).replace('#', ''); if (h.length !== 6) return '#fff'; var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#06202B' : '#fff'; }
  function chips(cats, id) {
    return '<div class="tdKs" data-row="' + id + '"><button type="button" class="tdk on" data-cat="" style="background:transparent;color:var(--tx)">—</button>' + cats.map(function (c) { return '<button type="button" class="tdk" data-cat="' + c.id + '" style="background:' + c.col + ';color:' + ink(c.col) + '">' + esc(c.name) + '</button>'; }).join('') + '</div>';
  }
  function bindChips(box, pick) {
    box.onclick = function (e) {
      var bt = e.target.closest && e.target.closest('button[data-cat]'); if (!bt) return;
      var row = bt.parentNode; Array.prototype.forEach.call(row.children, function (x) { x.classList.toggle('on', x === bt); });
      pick(row.getAttribute('data-row'), bt.getAttribute('data-cat') || null);
    };
  }
  function dateVal(def) { var v = $('wkDate') ? $('wkDate').value : ''; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : def; }
  function dateField() { return '<label class="ukDt">Tanggal<input type="date" id="wkDate" value="' + today() + '" max="' + S.today + '"></label>'; }
  function newTanda(t, pts, cat, dt, note) {
    var br = HA.tandaBrush(), it = { id: HA.tandaNewId(), t: t, pts: pts, cat: cat, sub: cat === br.cat ? br.sub : null, col: null, op: br.op, name: '', note: note || '', ts: Date.now(), date: dt, src: 'walk' };
    HA.tandaAdd(it); return it.id;
  }

  // ---------- selesai: baca konteks ----------
  function finish() {
    var P = WK.w.points().map(function (p) { return [+p.lat.toFixed(6), +p.lng.toFixed(6)]; });
    var tk = WK.tk || 0;
    if (P.length < 2) { if (tk) { cleanup(); toast('Walking selesai · ' + tk + ' tanda titik'); return; } toast('Jalur masih terlalu pendek'); return; }
    cleanup();
    var A = P[0], Z = P[P.length - 1], pr = prj(A), dAZ = Math.hypot.apply(null, [pr.xy(Z)[0], pr.xy(Z)[1]]);
    // 1. tertutup (kembali ke awal)
    if (P.length >= 4 && dAZ <= TOL) { closedCase(P); return; }
    // 2. tepi ke tepi
    var cand = near(A, 40).filter(function (b) { return near(Z, 40).indexOf(b) >= 0; }), hit = null;
    cand.forEach(function (b) {
      if (hit) return;
      var mid = P[Math.floor(P.length / 2)];
      if (edgeDist(b, A) <= TOL && edgeDist(b, Z) <= TOL && dAZ > TOL && (pip(mid, b.pts) || pip(P[Math.floor(P.length / 3)], b.pts))) hit = b;
    });
    if (hit) { splitCase(hit, P); return; }
    if (tk) { toast('Walking selesai · ' + tk + ' tanda titik'); return; }
    pointCase(P, null);
  }
  function closedCase(P) {
    var pr = prj(P[0]), sub = [P.map(pr.xy)], parts = [], tot = areaXY(sub[0]), anyBlk = false;
    HA.blocksList().forEach(function (b) {
      if (!b.pts || b.pts.length < 3) return;
      var mp; try { mp = polygonClipping.intersection(sub, [b.pts.map(pr.xy)]); } catch (e) { return; }
      (mp || []).forEach(function (poly) {
        var r = poly[0]; if (!r || r.length < 4) return;
        var ar = areaXY(r.slice(0, r.length - 1)); if (ar < 1 || ar < tot * 0.01) return;
        anyBlk = true;
        if (b.conf) parts.push({ b: b, ring: r.slice(0, r.length - 1).map(pr.ll).map(function (q) { return [+q[0].toFixed(7), +q[1].toFixed(7)]; }), area: ar });
      });
    });
    if (!anyBlk) {
      if (tot < 20) { toast('Area terlalu kecil'); return; }
      var b = { id: Date.now(), src: 'manual', name: 'Blok ' + HA.nextBlockNo(), pts: P.slice(0, P.length), ovId: null, dir: null, sp: null, margin: 0, conf: false, note: '' };
      HA.blocksList().push(b); S.settings.blkOn = true; HA.saveSettings(); HA.drawBlocks(); HA.openBlockPop(b); HA.openBlockEdit(b);
      toast('Walking tertutup di luar blok: blok baru dibuat'); return;
    }
    if (!parts.length) { toast('Area menimpa blok yang belum terkonfirmasi. Konfirmasi blok dulu'); return; }
    sortParts(parts); partsPanel(parts, 'Area tertutup · ' + parts.length + ' bagian');
  }
  function splitCase(b, P) {
    if (!b.conf) { toast('Blok ' + b.name + ' belum terkonfirmasi. Konfirmasi blok dulu di Edit Blok'); return; }
    var r = HA.tandaSplit(b.pts, P);
    if (r.err) { pointCase(P, r.err); return; }
    var parts = r.parts.map(function (ring) { return { b: b, ring: ring.map(function (q) { return [+q[0].toFixed(7), +q[1].toFixed(7)]; }), area: areaLL(ring) }; });
    sortParts(parts); partsPanel(parts, b.name + ' · ' + parts.length + ' bagian');
  }
  function sortParts(parts) {
    parts.forEach(function (p) { var s = 0, t = 0; p.ring.forEach(function (q) { s += q[0]; t += q[1]; }); p.cy = s / p.ring.length; p.cx = t / p.ring.length; });
    parts.sort(function (a, b) { return Math.abs(a.cy - b.cy) > 0.00004 ? b.cy - a.cy : a.cx - b.cx; });
    parts.forEach(function (p, i) { p.label = label(i); });
  }
  function fit(ring) { try { HA.map.fitBounds(L.latLngBounds(ring), { padding: [40, 40], maxZoom: 19 }); } catch (e) {} }

  // ---------- panel bagian A, B, ... ----------
  function partsPanel(parts, title, note) {
    var d = HA.tandaData(), sel = {};
    pvShow(parts); fit([].concat.apply([], parts.map(function (p) { return p.ring; })));
    openSheet('<div class="grab"></div><div class="st">' + esc(title) + '</div><div class="muted" style="margin:4px 0 8px">' + esc(note || 'Pilih kategori tiap bagian. Bagian bertanda — disimpan sebagai draf.') + '</div>' +
      parts.map(function (p, i) { return '<div class="ukRw" style="display:block"><div style="display:flex;justify-content:space-between"><b style="color:' + COLS[i % COLS.length] + '">Bagian ' + esc(p.label) + '</b><span>' + ha(p.area) + (parts.length > 1 && p.b ? ' · ' + esc(p.b.name) : '') + '</span></div>' + chips(d.cats, i) + '</div>'; }).join('') +
      dateField() + '<div class="row" style="margin-top:12px"><button class="btn" id="wkNo" style="flex:1;height:50px">Batal</button><button class="btn" id="wkDr" style="flex:1;height:50px">Simpan dulu</button><button class="btn pri" id="wkYes" style="flex:1;height:50px">Simpan</button></div>');
    HA.onSheetClose = pvClear;
    bindChips($('sheet'), function (row, cat) { sel[row] = cat; });
    $('wkNo').onclick = function () { HA.onSheetClose = null; pvClear(); closeSheet(); };
    function commit(useSel) {
      var dt = dateVal(today()), ids = [], dids = [], nt = 0, nd = 0;
      parts.forEach(function (p, i) {
        var cat = useSel ? sel[i] : null;
        if (cat) { ids.push(newTanda('pg', p.ring, cat, dt)); nt++; }
        else { var dr = { id: 'd' + Date.now() + '_' + i, bid: p.b ? p.b.id : null, bn: p.b ? p.b.name : '', ring: p.ring, label: p.label, date: dt, ts: Date.now() }; drafs().push(dr); dids.push(dr.id); nd++; }
      });
      HA.saveSettings(); HA.onSheetClose = null; pvClear();
      result(nt, nd, ids, dids, parts, dt);
    }
    $('wkDr').onclick = function () { commit(false); };
    $('wkYes').onclick = function () { commit(true); };
  }
  function result(nt, nd, ids, dids, parts, dt) {
    HA.KM && HA.KM.show && HA.KM.show(dt);
    var bl = []; parts.forEach(function (p) { if (p.b && bl.indexOf(p.b) < 0 && p.b.conf) bl.push(p.b); });
    openSheet('<div class="grab"></div><div class="st">Walking tersimpan</div><div class="muted" style="margin:6px 0 12px">' + nt + ' tanda' + (nd ? ' · ' + nd + ' draf (buka lagi lewat tile Walking)' : '') + '</div>' +
      '<div class="row"><button class="btn" id="wkBg" style="flex:1;height:50px"' + (nt ? '' : ' disabled') + '>Bagikan</button><button class="btn" id="wkHp" style="flex:1;height:50px;color:var(--r)">Hapus</button><button class="btn pri" id="wkX" style="flex:1;height:50px">Tutup</button></div>');
    $('wkX').onclick = closeSheet;
    $('wkBg').onclick = function () { closeSheet(); if (HA.BT && HA.BT.share && bl.length) HA.BT.share(bl); };
    $('wkHp').onclick = function () {
      closeSheet();
      askConfirm('Hapus hasil Walking ini?', nt + ' tanda dan ' + nd + ' draf dari Walking ini dihapus.', 'Hapus', function () { delTanda(ids); delDraf(dids); toast('Hasil Walking dihapus'); HA.KM && HA.KM.show && HA.KM.show(dt); });
    };
  }
  function delTanda(ids) {
    var it = HA.tandaData().items;
    ids.forEach(function (id) { for (var i = it.length - 1; i >= 0; i--) if (it[i].id === id) it.splice(i, 1); });
    HA.tandaSave();
  }
  function delDraf(ids) { var a = drafs(); ids.forEach(function (id) { for (var i = a.length - 1; i >= 0; i--) if (a[i].id === id) a.splice(i, 1); }); HA.saveSettings(); }

  // ---------- tanda titik ----------
  function pointCase(P, why) {
    var Z = P[P.length - 1], bs = near(Z, 300), best = null, bd = Infinity;
    bs.forEach(function (b) { var e = edgeDist(b, Z), ins = pip(Z, b.pts); if (ins || e <= 300) { var k = ins ? e : e + 1000; if (k < bd) { bd = k; best = { b: b, e: e, ins: ins }; } } });
    if (!best) { toast((why ? why + '. ' : '') + 'Titik di luar blok mana pun'); return; }
    if (!best.b.conf) { toast('Blok ' + best.b.name + ' belum terkonfirmasi. Konfirmasi blok dulu'); return; }
    var d = HA.tandaData(), cat = null, jar = Math.round(best.e), note = 'Jarak ke tepi blok: ' + jar + ' m' + (best.ins ? '' : ' (di luar blok)');
    pvClear(); PV = L.layerGroup().addTo(HA.map);
    L.circleMarker(Z, { radius: 9, color: '#fff', weight: 3, fillColor: '#FFD84D', fillOpacity: 1, interactive: false }).addTo(PV);
    L.polyline(P, { color: HA.NEON, weight: 3, interactive: false }).addTo(PV);
    openSheet('<div class="grab"></div><div class="st">Tanda titik · ' + esc(best.b.name) + '</div><div class="muted" style="margin:4px 0 8px">' + esc((why ? why + '. ' : 'Jalur tidak berakhir di tepi blok. ') + note + '.') + '</div>' + chips(d.cats, 0) + dateField() +
      '<div class="row" style="margin-top:12px"><button class="btn" id="wkNo" style="flex:1;height:50px">Batal</button><button class="btn pri" id="wkYes" style="flex:1;height:50px">Simpan</button></div>');
    HA.onSheetClose = pvClear;
    bindChips($('sheet'), function (row, c) { cat = c; });
    $('wkNo').onclick = function () { HA.onSheetClose = null; pvClear(); closeSheet(); };
    $('wkYes').onclick = function () {
      if (!cat) { toast('Pilih kategori dulu'); return; }
      var dt = dateVal(today()); HA.onSheetClose = null; pvClear(); closeSheet();
      var id = newTanda('pt', [Z], cat, dt, note);
      toast('Tanda titik tersimpan · ' + note); HA.KM && HA.KM.show && HA.KM.show(dt);
      void id;
    };
  }

  // ---------- draf ----------
  function drafList() {
    var a = drafs();
    pvShow(a.map(function (x) { return { ring: x.ring, label: x.label, draf: true }; }));
    openSheet('<div class="grab"></div>' + (HA.listTabs ? HA.listTabs('drf') : '') + '<div class="st">Draf Walking (' + a.length + ')</div><div id="wkDl"></div><div class="row" style="margin-top:10px"><button class="btn" id="wkDx" style="flex:1;height:48px">Tutup</button><button class="btn pri" id="wkDn" style="flex:1;height:48px">Mulai Walking</button></div>');
    HA.onSheetClose = pvClear;
    $('wkDx').onclick = function () { HA.onSheetClose = null; pvClear(); closeSheet(); };
    $('wkDn').onclick = function () { HA.onSheetClose = null; pvClear(); closeSheet(); start(); };
    HA.lpList($('wkDl'), 'wkdraf', {
      items: a.map(function (x) { return { id: x.id, title: (x.bn || 'Area') + ' · bagian ' + x.label, sub: ha(areaLL(x.ring)) + ' · ' + x.date }; }),
      empty: 'Belum ada draf.',
      onTap: function (id) { var x = a.filter(function (q) { return q.id === id; })[0]; if (x) drafOne(x); },
      delTitle: function (ids) { return 'Hapus ' + ids.length + ' draf?'; },
      delMsg: function () { return 'Draf dihapus dari aplikasi.'; },
      onDelete: function (ids) { delDraf(ids); drafList(); }
    });
  }
  function drafOne(x) {
    var d = HA.tandaData(), cat = null;
    pvShow([{ ring: x.ring, label: x.label, draf: false }]); fit(x.ring);
    openSheet('<div class="grab"></div><div class="st">Draf ' + esc((x.bn || 'Area') + ' · bagian ' + x.label) + '</div><div class="muted" style="margin:4px 0 8px">' + ha(areaLL(x.ring)) + ' · ' + esc(x.date) + '. Pilih kategori lalu Simpan.</div>' + chips(d.cats, 0) +
      '<div class="row" style="margin-top:12px"><button class="btn" id="wkNo" style="flex:1;height:50px">Kembali</button><button class="btn" id="wkHp" style="flex:1;height:50px;color:var(--r)">Hapus</button><button class="btn pri" id="wkYes" style="flex:1;height:50px">Simpan</button></div>');
    HA.onSheetClose = pvClear;
    bindChips($('sheet'), function (row, c) { cat = c; });
    $('wkNo').onclick = function () { HA.onSheetClose = null; pvClear(); drafList(); };
    $('wkHp').onclick = function () { askConfirm('Hapus draf ini?', 'Draf dihapus dari aplikasi.', 'Hapus', function () { delDraf([x.id]); pvClear(); drafList(); }); };
    $('wkYes').onclick = function () {
      if (!cat) { toast('Pilih kategori dulu'); return; }
      HA.onSheetClose = null; pvClear(); newTanda('pg', x.ring, cat, x.date); delDraf([x.id]); toast('Draf disimpan sebagai tanda'); HA.KM && HA.KM.show && HA.KM.show(x.date);
      if (drafs().length) drafList(); else closeSheet();
    };
  }

  HA.walkStart = function () { start(); };
  HA.drafOpen = drafList; HA.walkPvClear = pvClear;
  HA.walkActive = function () { return !!WK; };
  HA._wk = { analyze: function (P) { return { closed: P.length >= 4 && Math.hypot.apply(null, prj(P[0]).xy(P[P.length - 1])) <= TOL }; }, finishWith: function (P) { WK = { w: { points: function () { return P.map(function (p) { return { lat: p[0], lng: p[1] }; }); } }, timer: null, g: L.layerGroup(), acc: null, bar: null }; finish(); } };
})();
