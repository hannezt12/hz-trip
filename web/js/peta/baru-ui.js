/* HZ Trip - buat baru (blok, danau, drainase, jalan bantu), Ukur, daftar tekan-lama, satu panel terbuka */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  HA.drawStart = drawStart;
  HA.measureStart = measureStart;
  HA.lpList = lpList;
  HA.closeAll = closeAll;
  HA.lakeName = lakeName;
  HA.drawFlow = drawFlow;
  var DEF = { road: 3, drain: 1.5 };
  var NAMES = { master: 'Master', blok: 'Blok', danau: 'Danau', drain: 'Drainase', road: 'Jalan bantu' };

  // ---------- hanya satu panel terbuka ----------
  function closeAll(keep) {
    keep = keep || {};
    if (!keep.panel && HA.DM && HA.DM.closePanel) HA.DM.closePanel();
    if (!keep.pop && HA.closeBlockPop && HA.DM && HA.DM.pop) HA.closeBlockPop();
    if (!keep.sheet && $('sheet').classList.contains('on')) { HA.onSheetClose = null; closeSheet(); }
    if (HA.closeLinePop) HA.closeLinePop();
    if (HA.DM && HA.DM.sync) HA.DM.sync();
  }

  function fmtLen(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2).replace('.', ',') + ' km'; }
  function fmtArea(m) { return m < 10000 ? Math.round(m) + ' m²' : (m / 10000).toFixed(2).replace('.', ',') + ' ha'; }
  function flat(pts, closed) {
    var R = Math.PI / 180, kx = 111320 * Math.cos(pts[0][0] * R), ky = 111320, xy = pts.map(function (p) { return [(p[1] - pts[0][1]) * kx, (p[0] - pts[0][0]) * ky]; }), len = 0, ar = 0, i;
    for (i = 0; i < xy.length - 1; i++) len += Math.hypot(xy[i + 1][0] - xy[i][0], xy[i + 1][1] - xy[i][1]);
    if (closed && xy.length > 2) { len += Math.hypot(xy[0][0] - xy[xy.length - 1][0], xy[0][1] - xy[xy.length - 1][1]); for (i = 0; i < xy.length; i++) { var p = xy[i], q = xy[(i + 1) % xy.length]; ar += p[0] * q[1] - q[0] * p[1]; } }
    return { len: len, area: Math.abs(ar) / 2 };
  }
  function bigIcon(n) { return L.divIcon({ className: '', html: '<div class="tpm"><b>' + n + '</b><div class="d"></div><div class="h"></div></div>', iconSize: [56, 80], iconAnchor: [28, 24] }); }
  function barHtml(inner) { return '<span id="nbT"></span>' + inner; }
  function mkBar(inner) {
    var bar = document.createElement('div'); bar.className = 'lkbar bot'; bar.innerHTML = barHtml(inner);
    HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar); return bar;
  }

  // ---------- buat baru: pilih jenis lalu gambar ----------
  function drawStart() {
    if (!HA.map || !window.HzDem) { toast('Buka peta dulu'); return; }
    if (S.view !== 'lintasan') { HA.mapKeep = true; go('lintasan'); setTimeout(drawStart, 800); return; }
    HA.pbStopForEdit(); closeAll(); HA.map._slopeOn = false;
    if (HA.map._lakeDraw) { toast('Selesaikan dulu yang sedang digambar'); return; }
    var bar = mkBar('<button type="button" data-t="blok" class="pri">Blok</button><button type="button" data-t="danau" class="pri">Danau</button><button type="button" data-t="drain" class="pri">Drainase</button><button type="button" data-t="road" class="pri">Jalan bantu</button><button type="button" id="nbX">Batal</button>');
    $('nbT').textContent = 'Buat apa?';
    $('nbX').onclick = function () { bar.remove(); };
    bar.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { bar.remove(); drawFlow(b.getAttribute('data-t')); }; });
  }
  function drawFlow(type) {
    var poly = type === 'blok' || type === 'danau' || type === 'master', pts = [], redo = [], g = L.layerGroup().addTo(HA.map), pl = null, pl0 = null, mk = [], busy = false;
    function normalBar() { return '<button type="button" id="nbU">Urungkan</button><button type="button" id="nbR">Ulangi</button><button type="button" id="nbC">Batal</button>' + (type === 'blok' && window.HzWalk ? '<button type="button" id="nbW">Walking</button>' : '') + '<button type="button" class="pri" id="nbOk">Simpan</button>'; }
    var bar = mkBar(normalBar());
    var pa = null, pb = null, WK = null;
    function pathOf() { return poly && pts.length > 2 ? pts.concat([pts[0]]) : pts; }
    function upd() {
      g.clearLayers(); mk = []; pa = pb = null;
      if (pts.length > 1) {
        pa = L.polyline(pathOf(), { color: '#06202B', weight: 6, opacity: .55, interactive: false }).addTo(g);
        pb = L.polyline(pathOf(), { color: HA.NEON, weight: 3, interactive: false }).addTo(g);
      }
      pts.forEach(function (p, k) {
        var m = L.marker(p, { draggable: true, icon: poly ? L.divIcon({ className: '', html: '<div class="vx"></div>', iconSize: [26, 26] }) : bigIcon(k + 1), zIndexOffset: poly ? 500 : 900 }).addTo(g);
        m.on('drag', function (e) { var q = e.target.getLatLng(); pts[k] = [q.lat, q.lng]; if (pa) { pa.setLatLngs(pathOf()); pb.setLatLngs(pathOf()); } text(); });
        m.on('dragend', function () { upd(); });
        mk.push(m);
      });
      text();
      $('nbU').disabled = !pts.length; $('nbR').disabled = !redo.length;
    }
    function text() {
      var t = $('nbT'); if (!t) return;
      if (poly) {
        var s = NAMES[type] + ' · ' + pts.length + ' titik';
        if (pts.length > 2) s += ' · ' + fmtArea(flat(pts, true).area);
        t.textContent = pts.length < 3 ? s + ' · ketuk minimal 3 titik' : s + ' · geser titik bila perlu';
      } else {
        t.textContent = pts.length < 2 ? NAMES[type] + ' · ketuk ' + (pts.length ? 'titik kedua' : 'titik pertama') : NAMES[type] + ' · ' + fmtLen(flat(pts, false).len) + ' · geser titik bila perlu';
      }
    }
    function end() { if (WK) walkCleanup(); HA.map._lakeDraw = null; HA.map.removeLayer(g); bar.remove(); }
    var drawTap = function (ll) {
      if (WK) return;
      if (!poly && pts.length >= 2) { toast('Garis cukup 2 titik. Geser titiknya bila perlu'); return; }
      pts.push([+ll.lat.toFixed(6), +ll.lng.toFixed(6)]); redo = []; upd();
    };
    HA.map._lakeDraw = { tap: function (ll) { drawTap(ll); } };
    function bindBar() {
      $('nbU').onclick = function () { if (pts.length) { redo.push(pts.pop()); upd(); } };
      $('nbR').onclick = function () { if (redo.length) { pts.push(redo.pop()); upd(); } };
      $('nbC').onclick = end;
      if ($('nbW')) $('nbW').onclick = walkStart;
      $('nbOk').onclick = save;
    }
    // ---------- mode Walking (hanya blok): jalan kaki mengelilingi batas, titik dibuat tiap 2 m ----------
    var RING = { g: '#35D07F', y: '#FFD84D', r: '#FF5A4D' };
    function walkStart() {
      WK = { w: HzWalk.create({}), n: 0, timer: null, g: L.layerGroup().addTo(HA.map), acc: null, cur: null, screen: false, vis: null };
      WK.w.seed(pts);
      g.clearLayers();
      var a = document.createElement('div'); a.className = 'wkAcc'; a.innerHTML = '<b id="wkA">Akurasi …</b><small id="wkI"></small>';
      HA.map.getContainer().appendChild(a); WK.acc = a;
      bar.innerHTML = barHtml('<button type="button" id="wkP">Jeda</button><button type="button" id="wkF">+ Titik</button><button type="button" id="wkU">Urung 10 m</button><button type="button" id="wkS">Layar</button><button type="button" class="pri" id="wkOk">Selesai</button>');
      $('wkP').onclick = function () { if (WK.w.isPaused()) { WK.w.resume(); this.textContent = 'Jeda'; } else { WK.w.pause(); this.textContent = 'Lanjut'; } wkDraw(); };
      $('wkF').onclick = function () { if (WK.w.addHere()) { wkDraw(); toast('Titik ditandai di posisi Anda'); } else toast('Posisi belum didapat'); };
      $('wkU').onclick = function () { WK.w.undo(10); wkDraw(); };
      $('wkS').onclick = function () { WK.screen = !WK.screen; this.classList.toggle('on', WK.screen); HA.Plug.keepScreen({ on: WK.screen }).catch(function () {}); toast(WK.screen ? 'Layar tetap menyala' : 'Layar boleh mati (hemat baterai)'); };
      $('wkOk').onclick = walkFinish;
      HA.Plug.walkStart().then(function () {
        WK.timer = setInterval(walkPoll, 1000);
        WK.vis = function () { if (!document.hidden) walkPoll(); };
        document.addEventListener('visibilitychange', WK.vis);
        toast('Walking mulai. Berjalan di sepanjang batas blok');
      }).catch(function (e) { toast('Walking gagal: ' + (e && e.message || e)); walkCleanup(true); });
      wkDraw();
    }
    function walkPoll() {
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
        wkDraw();
        if (WK.cur && HA.map && !HA.map.getBounds().pad(-0.3).contains([WK.cur.lat, WK.cur.lng])) HA.map.panTo([WK.cur.lat, WK.cur.lng], { animate: true });
      }).catch(function () { if (WK) WK.busy = false; });
    }
    function wkDraw() {
      if (!WK) return;
      WK.g.clearLayers();
      var P = WK.w.points(), i;
      for (i = 1; i < P.length; i++) {
        var seg = [[P[i - 1].lat, P[i - 1].lng], [P[i].lat, P[i].lng]];
        if (P[i].g) L.polyline(seg, { color: '#FF8A00', weight: 3, dashArray: '6 6', interactive: false }).addTo(WK.g);
        else { L.polyline(seg, { color: '#06202B', weight: 6, opacity: .55, interactive: false }).addTo(WK.g); L.polyline(seg, { color: HA.NEON, weight: 3, interactive: false }).addTo(WK.g); }
      }
      if (P.length > 2) L.polyline([[P[P.length - 1].lat, P[P.length - 1].lng], [P[0].lat, P[0].lng]], { color: HA.NEON, weight: 2, opacity: .6, dashArray: '3 7', interactive: false }).addTo(WK.g);
      P.forEach(function (p) {
        L.circleMarker([p.lat, p.lng], { radius: p.f ? 8 : 6, color: RING[HzWalk.accClass(p.acc)], weight: 4, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(WK.g);
      });
      var c = WK.cur;
      if (c) {
        L.circle([c.lat, c.lng], { radius: Math.max(c.acc, 1), color: '#4DA3FF', weight: 1, fillColor: '#4DA3FF', fillOpacity: 0.12, interactive: false }).addTo(WK.g);
        L.circleMarker([c.lat, c.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#2F80FF', fillOpacity: 1, interactive: false }).addTo(WK.g);
        var cl = HzWalk.accClass(c.acc), el = $('wkA');
        if (el) { el.textContent = 'Akurasi ±' + Math.round(c.acc) + ' m'; el.style.color = RING[cl]; }
      }
      var t = $('nbT'); if (t) t.textContent = 'Walking' + (WK.w.isPaused() ? ' dijeda' : '') + ' · ' + fmtLen(WK.w.length()) + ' · ' + P.length + ' titik';
      var inf = $('wkI'); if (inf) inf.textContent = (c ? (Date.now() - c.t < 5000 ? '' : 'posisi terakhir ' + Math.round((Date.now() - c.t) / 1000) + ' dtk lalu') : 'menunggu GPS…');
    }
    function walkCleanup(keepBar) {
      if (!WK) return;
      clearInterval(WK.timer); if (WK.vis) document.removeEventListener('visibilitychange', WK.vis);
      try { HA.Plug.walkStop().catch(function () {}); HA.Plug.keepScreen({ on: false }).catch(function () {}); } catch (e) {}
      if (WK.acc) WK.acc.remove();
      HA.map.removeLayer(WK.g);
      WK = null;
      if (keepBar) { bar.innerHTML = barHtml(normalBar()); bindBar(); upd(); }
    }
    function walkFinish() {
      var P = WK.w.points(), L0 = HzWalk.dist;
      function done() {
        pts = P.map(function (p) { return [+p.lat.toFixed(6), +p.lng.toFixed(6)]; }); redo = [];
        walkCleanup(true);
        toast(pts.length >= 3 ? 'Walking selesai. Rapikan titik bila perlu lalu Simpan' : 'Jalur masih kurang dari 3 titik. Tambah titik manual');
      }
      if (P.length >= 3 && L0(P[P.length - 1], P[0]) > 30) {
        askConfirm('Tutup dari ujung ke awal?', 'Titik terakhir masih ' + Math.round(L0(P[P.length - 1], P[0])) + ' m dari titik awal. Bagian ini akan disambung garis lurus.', 'Tutup', done);
      } else done();
    }
    function save() {
      if (busy) return;
      if (poly && pts.length < 3) { toast('Minimal 3 titik'); return; }
      if (!poly && (pts.length < 2 || flat(pts, false).len < 5)) { toast('Titik masih terlalu dekat, geser salah satu'); return; }
      var P = pts.map(function (p) { return [+(+p[0]).toFixed(6), +(+p[1]).toFixed(6)]; });
      if (type === 'blok') {
        var b = { id: Date.now(), src: 'manual', name: 'Blok ' + HA.nextBlockNo(), pts: P, ovId: null, dir: null, sp: null, margin: 0, conf: false, note: '' };
        HA.blocksList().push(b); S.settings.blkOn = true; saveSettings(); end(); HA.drawBlocks(); HA.openBlockPop(b); HA.openBlockEdit(b);
      } else if (type === 'master') {
        end(); HA.masterCreated(P);
      } else if (type === 'danau') {
        busy = true; toast('Menghitung…');
        HzDem.lakeLevel(P).then(function (lv) {
          busy = false;
          if (lv === null) { toast('Data ketinggian belum tersedia di area ini'); return; }
          var lk = { id: Date.now(), name: 'Danau ' + (HA.lakesList().length + 1), pts: P, level: lv };
          HA.lakesList().push(lk); S.settings.lakesOn = true; saveSettings(); end(); HA.applyLakes(); HA.demRedraw();
          HzDem.measure(lk.pts, true).then(function (m) { lk.m = m; saveSettings(); }).catch(function () {});
          lakeName(lk);
        }).catch(function () { busy = false; toast('Gagal menghitung danau'); });
      } else {
        HA.linesList().push({ id: 'l' + Date.now().toString(36), type: type, w: DEF[type], pts: P });
        end(); if (type === 'drain') S.settings.lakesOn = true; else S.settings.linesOn = true; HA.lineChanged(); toast(NAMES[type] + ' tersimpan. Ketuk garis untuk ubah lebar atau hapus');
      }
    };
    bindBar();
    upd();
  }
  // panel nama setelah simpan (danau); blok memakai panel Edit Blok
  function lakeName(lk) {
    openSheet('<div class="grab"></div><div class="bth"><div class="st">DANAU</div><button class="btn pri" id="lnX">Selesai</button></div>' +
      '<div class="bnm"><input type="text" id="lnN" maxlength="30" value="' + esc(lk.name) + '"></div>');
    $('sheet').classList.add('cmp'); $('scrim').classList.remove('on');
    $('lnN').onchange = function () { lk.name = $('lnN').value.trim() || lk.name; saveSettings(); HA.applyLakes(); };
    $('lnX').onclick = function () { lk.name = $('lnN').value.trim() || lk.name; saveSettings(); HA.applyLakes(); closeSheet(); if (S.view === 'data') HA.renderData(); };
  }

  // ---------- Ukur: bidik + titik, hasil P/L/K di kanan atas, tutup poligon lalu Simpan ----------
  var UK_TIPS = {
    P: 'Panjang garis yang kamu ukur titik demi titik. Tutup di titik pertama untuk membentuk area.',
    L: 'Luas area. Satukan garis menjadi poligon untuk membuat blok baru atau menandai kategori. Tombol Simpan muncul setelah poligon tertutup.',
    K: 'Keliling, panjang seluruh sisi poligon. Berguna untuk memperkirakan jalan atau pagar di sekeliling area.'
  };
  function ukRibu(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function ukPip(pt, poly) {
    var x = pt[1], y = pt[0], ins = false, i, j;
    for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][1], yi = poly[i][0], xj = poly[j][1], yj = poly[j][0];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  // titik potong ruas AB dan CD (lat,lng); null bila tidak memotong
  function ukSeg(a, b, c, d) {
    var r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], den = r0 * s1 - r1 * s0;
    if (Math.abs(den) < 1e-14) return null;
    var t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den, u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return [a[0] + t * r0, a[1] + t * r1];
  }
  function ukCross(P, Q) {
    for (var i = 0; i < P.length; i++) { var a = P[i], b = P[(i + 1) % P.length];
      for (var j = 0; j < Q.length; j++) if (ukSeg(a, b, Q[j], Q[(j + 1) % Q.length])) return true; }
    return false;
  }
  function measureStart() {
    if (!HA.map) return;
    if (S.view !== 'lintasan') { HA.mapKeep = true; go('lintasan'); setTimeout(measureStart, 800); return; }
    HA.pbStopForEdit(); closeAll();
    if (HA.map._lakeDraw) { toast('Selesaikan dulu yang sedang digambar'); return; }
    var map = HA.map, box = map.getContainer(), g = L.layerGroup().addTo(map);
    var pts = [], closed = null, tail = null; // closed: {k:'t'} ditutup di titik awal | {k:'x', j, I, n} garis menyilang
    var ms = { last: 0, rapid: 0, snap: null, ign: 0 };
    var cross = document.createElement('div'); cross.className = 'mzx'; cross.innerHTML = '<i></i><i></i>'; box.appendChild(cross);
    var add = document.createElement('button'); add.type = 'button'; add.className = 'mzAdd'; add.setAttribute('aria-label', 'Tambah titik'); add.textContent = '+'; box.appendChild(add);
    L.DomEvent.disableClickPropagation(add); add.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    var card = document.createElement('div'); card.className = 'mzR';
    card.innerHTML = ['P', 'L', 'K'].map(function (k) { return '<div class="mzRow" data-k="' + k + '"><span class="mzL">' + k + '<i class="mzI" data-k="' + k + '" role="button" aria-label="Info ' + k + '">i</i></span><span class="mzV" id="mz' + k + '">–</span></div>'; }).join('');
    box.appendChild(card); L.DomEvent.disableClickPropagation(card);
    var sv = document.createElement('button'); sv.type = 'button'; sv.className = 'mzSave'; sv.textContent = 'Simpan'; sv.style.display = 'none'; box.appendChild(sv); L.DomEvent.disableClickPropagation(sv);
    var tip = document.createElement('div'); tip.className = 'mzTip'; tip.style.display = 'none'; box.appendChild(tip); L.DomEvent.disableClickPropagation(tip);
    var undo = document.createElement('div'); undo.className = 'mzUndo'; undo.style.display = 'none'; box.appendChild(undo); L.DomEvent.disableClickPropagation(undo);
    var tipT = null, undoT = null;
    function hideTip() { tip.style.display = 'none'; clearTimeout(tipT); document.removeEventListener('pointerdown', onDoc, true); }
    function onDoc(e) { if (!(e.target.closest && e.target.closest('.mzI'))) hideTip(); }
    card.onclick = function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (!k || !e.target.classList.contains('mzI')) return;
      var was = tip.style.display !== 'none' && tip.getAttribute('data-k') === k; hideTip(); if (was) return;
      tip.setAttribute('data-k', k); tip.textContent = UK_TIPS[k]; tip.style.display = 'block';
      tip.style.top = (card.offsetTop + card.offsetHeight + 8) + 'px';
      clearTimeout(tipT); tipT = setTimeout(hideTip, 6000); setTimeout(function () { document.addEventListener('pointerdown', onDoc, true); }, 0);
    };
    function place() {
      var mb = (HA.DM && HA.DM.main && HA.DM.main.getBoundingClientRect().width) ? HA.DM.main : (map._loc && map._loc.btn), cr = box.getBoundingClientRect();
      if (mb) { var r = mb.getBoundingClientRect(); if (r.width) { add.style.left = Math.round(r.left - cr.left + (r.width - add.offsetWidth) / 2) + 'px'; add.style.top = Math.round(r.top - cr.top - add.offsetHeight - 14) + 'px'; add.style.right = 'auto'; add.style.bottom = 'auto'; return; } }
      add.style.right = '0.6rem'; add.style.bottom = '9rem'; add.style.left = 'auto'; add.style.top = 'auto';
    }
    function poly() { if (!closed) return null; return closed.k === 'x' ? [closed.I].concat(pts.slice(closed.j + 1, closed.n - 1)) : pts.slice(); }
    function nearFirst() {
      if (closed || pts.length < 3) return false;
      var a = map.latLngToContainerPoint(map.getCenter()), b = map.latLngToContainerPoint(L.latLng(pts[0][0], pts[0][1]));
      return Math.hypot(a.x - b.x, a.y - b.y) <= 24;
    }
    function upd() {
      g.clearLayers();
      var c = map.getCenter(), cp = [c.lat, c.lng], snap = nearFirst(), pl = poly(), i;
      var line = closed && closed.k === 'x' ? pts.slice(closed.j + 1, closed.n - 1) : pts;
      if (closed && closed.k === 'x') {
        var tl = pts.slice(0, closed.j + 1).concat([closed.I]); if (tl.length > 1) L.polyline(tl, { color: '#FFD84D', weight: 3, opacity: .35, dashArray: '4 8', interactive: false }).addTo(g);
        L.polyline([closed.I, pts[closed.n - 1]], { color: '#FFD84D', weight: 3, opacity: .35, dashArray: '4 8', interactive: false }).addTo(g);
      }
      if (pl) L.polygon(pl, { stroke: false, fillColor: '#FFD84D', fillOpacity: .28, interactive: false }).addTo(g);
      var main = pl ? pl.concat([pl[0]]) : pts;
      if (main.length > 1) {
        L.polyline(main, { color: '#06202B', weight: 6, opacity: .55, interactive: false }).addTo(g);
        L.polyline(main, { color: '#FFD84D', weight: 3, interactive: false }).addTo(g);
      }
      if (!closed && pts.length) L.polyline([pts[pts.length - 1], cp], { color: '#FFFFFF', weight: 2, opacity: .9, dashArray: '2 7', interactive: false }).addTo(g);
      if (!closed && pts.length >= 3) L.polyline([pts[pts.length - 1], pts[0]], { color: '#FF8A00', weight: 3, opacity: .95, dashArray: '6 8', interactive: false }).addTo(g);
      (pl || pts).forEach(function (p, k) {
        var first = !pl && k === 0 && pts.length >= 3;
        L.circleMarker(p, { radius: first && snap ? 10 : 5, color: first && snap ? '#fff' : '#06202B', weight: first && snap ? 3 : 2, fillColor: '#FFD84D', fillOpacity: 1, interactive: false }).addTo(g);
      });
      // hasil
      var len = pts.length ? flat(closed ? line : pts.concat([cp]), false).len : 0;
      $('mzP').textContent = pts.length ? fmtLen(len) : '–';
      if (pl && pl.length >= 3) { var f = flat(pl, true); $('mzL').textContent = ukRibu(f.area) + ' m² / ' + (f.area / 10000).toFixed(3).replace('.', ',') + ' ha'; $('mzK').textContent = fmtLen(f.len); }
      else { $('mzL').textContent = '–'; $('mzK').textContent = '–'; }
      sv.style.display = closed ? '' : 'none';
      card.classList.toggle('shut', !!closed);
      sv.style.top = (card.offsetTop + card.offsetHeight + 8) + 'px';
    }
    function setClosed(c) { var was = !!closed; closed = c; if (c && !was) toast('Simpan blok baru'); }
    function addPt() {
      if (closed) { toast('Poligon sudah tertutup. Tekan Back untuk membukanya lagi'); return; }
      if (nearFirst()) { setClosed({ k: 't' }); upd(); return; }
      var c = map.getCenter(), p = [c.lat, c.lng]; pts.push(p);
      var n = pts.length;
      if (n >= 4) {
        var A = pts[n - 2], B = pts[n - 1];
        for (var j = 0; j <= n - 4; j++) { var I = ukSeg(A, B, pts[j], pts[j + 1]); if (I) { setClosed({ k: 'x', j: j, I: I, n: n }); break; } }
      }
      upd();
    }
    function popPt() {
      if (closed && closed.k === 't') { closed = null; }
      if (pts.length) pts.pop();
      if (closed && pts.length < closed.n) closed = null;
      upd();
    }
    function showUndo(snapPts) {
      undo.innerHTML = '<span>Semua titik dihapus</span><button type="button">Urung</button>'; undo.style.display = 'flex';
      undo.querySelector('button').onclick = function () { pts = snapPts.map(function (p) { return p.slice(); }); closed = null; undo.style.display = 'none'; clearTimeout(undoT); upd(); };
      clearTimeout(undoT); undoT = setTimeout(function () { undo.style.display = 'none'; }, 4000);
    }
    function end() {
      hideTip(); clearTimeout(undoT);
      map.off('move', upd); window.removeEventListener('resize', place);
      map._lakeDraw = null; HA.ukurBack = null; map.removeLayer(g);
      cross.remove(); add.remove(); card.remove(); sv.remove(); tip.remove(); undo.remove();
    }
    // tombol Back Android: 1x hapus titik terakhir, 3x cepat (jeda <= 300 ms) hapus semua, lagi = keluar
    HA.ukurBack = function () {
      var now = Date.now();
      if (now < ms.ign) return true;
      if (now - ms.last <= 300) ms.rapid++; else { ms.rapid = 1; ms.snap = pts.map(function (p) { return p.slice(); }); }
      ms.last = now;
      if (ms.rapid >= 3) {
        ms.rapid = 0; ms.ign = now + 1000; hideTip();
        var had = ms.snap && ms.snap.length;
        pts = []; closed = null; upd();
        if (had) showUndo(ms.snap);
        return true;
      }
      if (!pts.length) { end(); return true; }
      popPt(); return true;
    };
    function ask2(title, msg, ok, fn) {
      openSheet('<div class="grab"></div><div class="st">' + esc(title) + '</div><div class="muted" style="margin:6px 0 14px">' + esc(msg) + '</div>' +
        '<div class="row"><button class="btn" id="ukNo" style="flex:1;height:50px">Batal</button><button class="btn pri" id="ukYes" style="flex:1;height:50px">' + esc(ok) + '</button></div>');
      $('ukNo').onclick = closeSheet; $('ukYes').onclick = function () { closeSheet(); fn(); };
    }
    function newBlock(P) {
      end();
      var b = { id: Date.now(), src: 'manual', name: 'Blok ' + HA.nextBlockNo(), pts: P, ovId: null, dir: null, sp: null, margin: 0, conf: false, note: '' };
      HA.blocksList().push(b); S.settings.blkOn = true; saveSettings(); HA.drawBlocks(); HA.openBlockPop(b); HA.openBlockEdit(b);
    }
    function doSave() {
      var pl = poly(); if (!pl || pl.length < 3) return;
      var P = pl.map(function (p) { return [+(+p[0]).toFixed(6), +(+p[1]).toFixed(6)]; });
      if (flat(P, true).area < 1) { toast('Area terlalu kecil'); return; }
      var inside = null, inUn = null, touch = [];
      HA.blocksList().forEach(function (b) {
        if (!b.pts || b.pts.length < 3) return;
        var all = P.every(function (p) { return ukPip(p, b.pts); }) && !ukCross(P, b.pts);
        if (all) { if (b.conf) { if (!inside) inside = b; } else if (!inUn) inUn = b; return; }
        if (ukCross(P, b.pts) || P.some(function (p) { return ukPip(p, b.pts); }) || b.pts.some(function (q) { return ukPip(q, P); })) touch.push(b);
      });
      if (inside) {
        var br = HA.tandaBrush ? HA.tandaBrush() : { cat: null, col: '#FF8A00', op: 0.35 };
        end();
        HA.tandaAdd({ id: HA.tandaNewId(), t: 'pg', pts: P, cat: br.cat, col: br.col, op: br.op, name: '', note: '', ts: Date.now() });
        toast('Tanda area tersimpan di ' + inside.name + '. Lihat di Marking (SpidoMap)');
        return;
      }
      if (inUn) { ask2('Di dalam ' + inUn.name, 'Blok ini belum terkonfirmasi, jadi tidak bisa diberi tanda kategori. Buat blok baru dari area ini?', 'Blok baru', function () { newBlock(P); }); return; }
      if (touch.length) {
        var nm = touch.slice(0, 3).map(function (b) { return b.name; }).join(', ') + (touch.length > 3 ? ' +' + (touch.length - 3) : '');
        ask2('Menimpa blok ' + nm, 'Area ini bertumpuk dengan blok yang sudah ada. Tetap simpan sebagai blok baru?', 'Tetap simpan', function () { newBlock(P); }); return;
      }
      newBlock(P);
    }
    map._lakeDraw = { tap: function () {} };
    map.on('move', upd); window.addEventListener('resize', place);
    add.onclick = addPt; sv.onclick = doSave;
    place(); setTimeout(place, 300); upd();
    toast('Geser peta, ketuk + untuk titik. Back = urung titik');
  }

  // ---------- daftar biasa: ketuk = lihat, tekan lama = Edit / Hapus / Pilih banyak ----------
  // o: { items:[{id,title,sub}], empty, onTap(id), onEdit(id), actions(id)->[{label,fn,danger}], onDelete(ids), delTitle(ids), delMsg(ids), rerender() }
  var SEL = {};
  function lpList(box, key, o) {
    var sel = SEL[key] || null;
    function draw() {
      sel = SEL[key] || null;
      box.innerHTML = (sel ? '<div class="lpbar"><b>' + sel.length + ' dipilih</b><span style="flex:1"></span><button class="btn sm" id="lpAll">Semua</button>' + (o.multi || []).map(function (m, i) { return '<button class="btn sm" id="lpM' + i + '"' + (sel.length ? '' : ' disabled') + '>' + esc(m.label) + '</button>'; }).join('') + '<button class="btn sm danger" id="lpDel"' + (sel.length ? '' : ' disabled') + '>Hapus</button><button class="btn sm" id="lpDone">Selesai</button></div>' : '') +
        (o.items.length ? o.items.map(function (it) {
          var on = sel && sel.indexOf(String(it.id)) >= 0;
          return '<div class="lpi' + (on ? ' on' : '') + '" data-id="' + esc(String(it.id)) + '">' + (sel ? '<i class="lpc">' + (on ? '✓' : '') + '</i>' : '') + '<div class="nm"><b>' + esc(it.title) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</div></div>';
        }).join('') : '<div class="card muted">' + esc(o.empty || 'Belum ada.') + '</div>') +
        (o.items.length && !sel ? '<div class="muted" style="margin:6px 2px">Ketuk untuk melihat. Tekan lama untuk edit, hapus, atau pilih banyak.</div>' : '');
      if (sel) {
        $('lpDone').onclick = function () { SEL[key] = null; draw(); };
        $('lpAll').onclick = function () { SEL[key] = sel.length === o.items.length ? [] : o.items.map(function (x) { return String(x.id); }); draw(); };
        $('lpDel').onclick = function () { var ids = sel.slice(); delIds(ids); };
        (o.multi || []).forEach(function (m, i) { var e = $('lpM' + i); if (e) e.onclick = function () { var ids = sel.slice(); SEL[key] = null; draw(); m.fn(ids); }; });
      }
    }
    function delIds(ids) {
      askConfirm(o.delTitle ? o.delTitle(ids) : 'Hapus ' + ids.length + ' data?', o.delMsg ? o.delMsg(ids) : 'Data dihapus dari aplikasi.', 'Hapus', function () { SEL[key] = null; o.onDelete(ids); });
    }
    function menu(id) {
      var it = o.items.filter(function (x) { return String(x.id) === id; })[0]; if (!it) return;
      var acts = (o.actions ? o.actions(id) : []) || [];
      openSheet('<div class="grab"></div><div class="st">' + esc(it.title) + '</div>' +
        (o.onEdit ? '<button class="btn" id="lmE" style="width:100%;margin-top:8px;height:48px">Edit</button>' : '') +
        acts.map(function (a, i) { return '<button class="btn" data-a="' + i + '" style="width:100%;margin-top:8px;height:48px">' + esc(a.label) + '</button>'; }).join('') +
        '<button class="btn" id="lmP" style="width:100%;margin-top:8px;height:48px">Pilih banyak</button>' +
        '<button class="btn" id="lmD" style="width:100%;margin-top:8px;height:48px;color:var(--r)">Hapus</button>' +
        '<button class="btn" id="lmX" style="width:100%;margin-top:8px">Tutup</button>');
      $('lmX').onclick = closeSheet;
      if (o.onEdit) $('lmE').onclick = function () { closeSheet(); o.onEdit(id); };
      $('sheet').querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { var a = acts[+b.getAttribute('data-a')]; closeSheet(); a.fn(id); }; });
      $('lmP').onclick = function () { closeSheet(); SEL[key] = [id]; draw(); };
      $('lmD').onclick = function () { closeSheet(); delIds([id]); };
    }
    draw();
    var timer = null, fired = false, sx = 0, sy = 0;
    function clr() { if (timer) { clearTimeout(timer); timer = null; } }
    box.onpointerdown = function (e) {
      var row = e.target.closest && e.target.closest('.lpi'); if (!row) return;
      fired = false; sx = e.clientX; sy = e.clientY; clr();
      timer = setTimeout(function () { timer = null; fired = true; try { if (navigator.vibrate) navigator.vibrate(20); } catch (x) {} var id = row.getAttribute('data-id'); if (SEL[key]) { return; } menu(id); }, 480);
    };
    box.onpointermove = function (e) { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clr(); };
    box.onpointerup = clr; box.onpointercancel = clr; box.onpointerleave = clr;
    box.oncontextmenu = function (e) { if (e.target.closest && e.target.closest('.lpi')) e.preventDefault(); };
    box.onclick = function (e) {
      if (fired) { fired = false; return; }
      var row = e.target.closest && e.target.closest('.lpi'); if (!row) return;
      var id = row.getAttribute('data-id');
      if (SEL[key]) { var i = SEL[key].indexOf(id); if (i >= 0) SEL[key].splice(i, 1); else SEL[key].push(id); draw(); return; }
      if (o.onTap) o.onTap(id);
    };
  }
})();
