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

  // ---------- Ukur (tidak disimpan) ----------
  function measureStart() {
    if (!HA.map) return;
    if (S.view !== 'lintasan') { HA.mapKeep = true; go('lintasan'); setTimeout(measureStart, 800); return; }
    HA.pbStopForEdit(); closeAll();
    if (HA.map._lakeDraw) { toast('Selesaikan dulu yang sedang digambar'); return; }
    // gaya Google Maps: bidik + di tengah layar, geser peta lalu ketuk tombol + (di kiri tombol Posisi saya)
    var pts = [], g = L.layerGroup().addTo(HA.map), box = HA.map.getContainer();
    var bar = mkBar('<button type="button" id="mU">Urungkan</button><button type="button" id="mC">Hapus semua</button><button type="button" class="pri" id="mX">Tutup</button>');
    bar.style.bottom = '5.25rem';
    var cross = document.createElement('div'); cross.className = 'mzx'; cross.innerHTML = '<i></i><i></i>'; box.appendChild(cross);
    var add = document.createElement('button'); add.type = 'button'; add.className = 'mzAdd'; add.setAttribute('aria-label', 'Tambah titik'); add.textContent = '+'; box.appendChild(add);
    L.DomEvent.disableClickPropagation(add); add.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    function place() {
      var lb = HA.map._loc && HA.map._loc.btn, cr = box.getBoundingClientRect();
      if (lb) { var r = lb.getBoundingClientRect(); if (r.width) { add.style.left = Math.round(r.left - cr.left - add.offsetWidth - 10) + 'px'; add.style.top = Math.round(r.top - cr.top - (add.offsetHeight - r.height) / 2) + 'px'; add.style.right = 'auto'; add.style.bottom = 'auto'; return; } }
      add.style.right = '4.5rem'; add.style.bottom = '5rem'; add.style.left = 'auto'; add.style.top = 'auto';
    }
    function upd() {
      g.clearLayers();
      var c = HA.map.getCenter(), all = pts.concat([[c.lat, c.lng]]);
      if (pts.length) {
        var path = all.length > 2 ? all.concat([all[0]]) : all;
        L.polyline(path, { color: '#06202B', weight: 6, opacity: .55, interactive: false }).addTo(g);
        L.polyline(path, { color: '#FFD84D', weight: 3, interactive: false }).addTo(g);
      }
      pts.forEach(function (p) { L.circleMarker(p, { radius: 5, color: '#06202B', weight: 2, fillColor: '#FFD84D', fillOpacity: 1, interactive: false }).addTo(g); });
      var t = $('nbT'); if (!t) return;
      if (!pts.length) { t.textContent = 'Ukur · geser peta, ketuk + untuk titik pertama'; return; }
      var f = flat(all, false), s = 'Jarak ' + fmtLen(f.len);
      if (all.length > 2) s += ' · keliling ' + fmtLen(flat(all, true).len) + ' · luas ' + fmtArea(flat(all, true).area);
      t.textContent = s;
    }
    function end() { HA.map.off('move', upd); window.removeEventListener('resize', place); HA.map._lakeDraw = null; HA.map.removeLayer(g); bar.remove(); cross.remove(); add.remove(); }
    HA.map._lakeDraw = { tap: function () {} };
    HA.map.on('move', upd); window.addEventListener('resize', place);
    add.onclick = function () { var c = HA.map.getCenter(); pts.push([c.lat, c.lng]); upd(); };
    $('mU').onclick = function () { pts.pop(); upd(); };
    $('mC').onclick = function () { pts = []; upd(); };
    $('mX').onclick = end;
    place(); upd();
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
