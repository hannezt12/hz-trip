/* HZ Trip - jalan bantu dan drainase (garis global yang memotong row) */
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
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function nf() { return HA.nf.apply(this, arguments); }
  function lines() { return S.settings.lines || (S.settings.lines = []); }
  HA.linesList = lines;
  HA.drawLines = drawLines;
  HA.renderLineTab = renderLineTab;
  HA.lineEdit = lineEdit;
  var DEF = { road: 3, drain: 1.5 };
  function typeName(t) { return t === 'drain' ? 'Drainase' : 'Jalan bantu'; }
  function lenM(pts) { var t = 0, i; for (i = 0; i + 1 < pts.length; i++) t += HA.segM(pts[i], pts[i + 1]); return t; }
  function kontur() { return S.settings.rowMode === 'kontur'; }
  function colorOf(ln) { return ln.type === 'drain' ? (kontur() ? '#5EE0FF' : '#6F8296') : '#C2AD83'; }
  function mpp() { var z = HA.map.getZoom(), la = HA.map.getCenter().lat; return 156543.03 * Math.cos(la * Math.PI / 180) / Math.pow(2, z); }
  function wpx(w) { return Math.max(2, w / mpp()); }

  var layer = null, zbound = false;
  function drawLines() {
    if (!HA.map) return;
    if (layer) { HA.map.removeLayer(layer); layer = null; }
    if (!zbound) { zbound = true; HA.map.on('zoomend', function () { if (!HA.map._lineEd) drawLines(); }); }
    if (S.settings.linesOn === false || !lines().length) return;
    var g = L.layerGroup();
    lines().forEach(function (ln) {
      if (!ln.pts || ln.pts.length < 2) return;
      L.polyline(ln.pts, { color: colorOf(ln), weight: wpx(+ln.w || 2), opacity: kontur() && ln.type === 'drain' ? .8 : .7, lineCap: 'butt', lineJoin: 'round', interactive: false }).addTo(g);
    });
    g.addTo(HA.map); layer = g;
  }

  function blocksOf(ln) {
    var out = [];
    HA.blocksList().forEach(function (b) {
      if (!b.pts || b.pts.length < 3) return;
      var q = HA.lineBB(ln), bb = HA.bbHit ? null : null, hit = false;
      HA.sampleLine(ln, 4, function (la, lo) { if (!hit && llPipB({ lat: la, lng: lo }, b)) hit = true; });
      if (hit) out.push(b);
    });
    return out;
  }
  function llPipB(ll, b) {
    var p = b.pts, i, j, c = false;
    for (i = 0, j = p.length - 1; i < p.length; j = i++) {
      if (((p[i][0] > ll.lat) !== (p[j][0] > ll.lat)) && (ll.lng < (p[j][1] - p[i][1]) * (ll.lat - p[i][0]) / (p[j][0] - p[i][0]) + p[i][1])) c = !c;
    }
    return c;
  }
  function inAnyBlock(la, lo) {
    var bl = HA.blocksList(), i; for (i = 0; i < bl.length; i++) if (bl[i].pts && bl[i].pts.length > 2 && llPipB({ lat: la, lng: lo }, bl[i])) return true; return false;
  }
  function changed() {
    HA.CUTM = {}; saveSettings();
    if (HA.RC) { HA.RC.rows = {}; HA.RC.dep = {}; }
    if (HA.drawRows) HA.drawRows(true);
  }

  function renderLineTab(box) {
    var ls = lines();
    box.innerHTML = (ls.length ? ls.map(function (ln, i) {
      var bl = blocksOf(ln).map(function (b) { return HA.blkLabel ? HA.blkLabel(b) : b.name; });
      return '<div class="card"><div class="dprow" style="margin-top:0"><input type="text" data-ln="' + i + '" value="' + esc(ln.name) + '" maxlength="30"><input type="number" inputmode="decimal" step="0.1" min="0.5" max="30" data-lw="' + i + '" value="' + ln.w + '" style="width:4.5rem"><span class="muted">m</span></div>' +
        '<div class="muted" style="margin-top:6px">' + typeName(ln.type) + ' · ' + nf(lenM(ln.pts), 0) + ' m' + (bl.length ? ' · melewati ' + bl.length + ' blok: ' + esc(bl.slice(0, 6).join(', ')) + (bl.length > 6 ? '…' : '') : ' · belum melewati blok') + '</div>' +
        '<div class="dprow"><button class="btn sm" data-lv="' + i + '">Lihat</button><button class="btn sm" data-le="' + i + '">Edit</button><button class="btn sm" data-ld="' + i + '">Hapus</button></div></div>';
    }).join('') : '<div class="card muted">Belum ada jalan bantu atau drainase.</div>') +
      '<div class="muted" style="margin-top:10px">Garis ini memotong row di semua blok yang dilewatinya: row sejajar kehilangan lajur, row yang melintang jadi lebih pendek. Luas tanam di popup blok sudah dikurangi luas jalan dan drainase.</div>' +
      '<div class="dprow" style="margin-top:12px"><button class="btn pri" id="lnNewR" style="height:50px">+ Jalan bantu</button><button class="btn pri" id="lnNewD" style="height:50px">+ Drainase</button></div>';
    box.querySelectorAll('input[data-ln]').forEach(function (inp) { inp.onchange = function () { var l = lines()[+inp.getAttribute('data-ln')]; if (l) { l.name = inp.value.trim() || l.name; saveSettings(); } }; });
    box.querySelectorAll('input[data-lw]').forEach(function (inp) { inp.onchange = function () { var l = lines()[+inp.getAttribute('data-lw')], v = parseFloat(String(inp.value).replace(',', '.')); if (l && v >= 0.5 && v <= 30) { l.w = v; changed(); } else if (l) inp.value = l.w; }; });
    box.querySelectorAll('[data-lv]').forEach(function (b) { b.onclick = function () { var l = lines()[+b.getAttribute('data-lv')]; if (l) { HA.mapKeep = true; go('lintasan'); setTimeout(function () { HA.map.fitBounds(L.latLngBounds(l.pts), { padding: [40, 40], maxZoom: 18 }); }, 700); } }; });
    box.querySelectorAll('[data-le]').forEach(function (b) { b.onclick = function () { var l = lines()[+b.getAttribute('data-le')]; if (l) { HA.mapKeep = true; go('lintasan'); setTimeout(function () { lineEdit(l, l.type); }, 700); } }; });
    box.querySelectorAll('[data-ld]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-ld'), l = lines()[i]; if (!l) return; askConfirm('Hapus "' + l.name + '"?', 'Row di blok yang dilewati dihitung ulang tanpa garis ini.', 'Hapus', function () { lines().splice(i, 1); changed(); renderLineTab(box); }); }; });
    $('lnNewR').onclick = function () { HA.mapKeep = true; go('lintasan'); setTimeout(function () { lineEdit(null, 'road'); }, 700); };
    $('lnNewD').onclick = function () { HA.mapKeep = true; go('lintasan'); setTimeout(function () { lineEdit(null, 'drain'); }, 700); };
  }

  function lineEdit(ln, type) {
    if (!HA.map) return;
    var P = ln ? ln.pts.map(function (p) { return [p[0], p[1]]; }) : [], mk = [], sel = -1, w = ln ? +ln.w : DEF[type], g = L.layerGroup().addTo(HA.map), pl = null, bar = document.createElement('div');
    HA.map._lineEd = true; if (layer) { HA.map.removeLayer(layer); layer = null; }
    bar.className = 'lkbar bot';
    bar.innerHTML = '<span id="leT"></span><label class="lew">Lebar <input type="number" inputmode="decimal" step="0.1" min="0.5" max="30" id="leW" value="' + w + '"> m</label>' +
      '<button type="button" id="leC">Batal</button><button type="button" id="leA">+ Titik</button><button type="button" id="leR">− Titik</button><button type="button" id="leX">Perpanjang</button><button type="button" class="pri" id="leOk" disabled>Simpan</button>';
    HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar);
    function icon(n) { return L.divIcon({ className: '', html: '<div class="tpm"><b>' + n + '</b><div class="d"></div><div class="h"></div></div>', iconSize: [56, 80], iconAnchor: [28, 24] }); }
    function build() {
      mk.forEach(function (m) { g.removeLayer(m); }); mk = [];
      P.forEach(function (p, k) {
        var m = L.marker(p, { draggable: true, icon: icon(k + 1), zIndexOffset: 900 }).addTo(g);
        m.on('dragstart', function () { sel = k; });
        m.on('drag', function (e) { var q = e.target.getLatLng(); P[k] = [q.lat, q.lng]; sel = k; upd(true); });
        mk.push(m);
      });
      upd();
    }
    function upd(keep) {
      if (pl) { g.removeLayer(pl); pl = null; }
      var t = $('leT'); if (!t) return;
      if (P.length >= 2) pl = L.polyline(P, { color: colorOf({ type: type }), weight: wpx(w), opacity: .6, lineCap: 'butt', interactive: false }).addTo(g);
      var len = P.length >= 2 ? lenM(P) : 0;
      t.textContent = P.length < 2 ? (P.length ? 'Ketuk titik kedua di ujung lainnya' : 'Ketuk titik pertama di ujung ' + typeName(type).toLowerCase()) : typeName(type) + ' · ' + Math.round(len) + ' m · geser titik bila perlu';
      $('leOk').disabled = P.length < 2 || len < 5; $('leA').disabled = P.length < 2; $('leR').disabled = P.length <= 2; $('leX').disabled = P.length < 2;
    }
    function end() { HA.map._lakeDraw = null; HA.map._lineEd = false; HA.map.removeLayer(g); bar.remove(); drawLines(); }
    HA.map._lakeDraw = { tap: function (ll) { if (P.length < 2) { P.push([ll.lat, ll.lng]); build(); } } };
    $('leW').onchange = function () { var v = parseFloat(String($('leW').value).replace(',', '.')); if (v >= 0.5 && v <= 30) w = v; else $('leW').value = w; upd(); };
    $('leC').onclick = end;
    $('leA').onclick = function () {
      var k = 0, best = -1, i;
      for (i = 0; i + 1 < P.length; i++) { var d = HA.segM(P[i], P[i + 1]); if (d > best) { best = d; k = i; } }
      P.splice(k + 1, 0, [(P[k][0] + P[k + 1][0]) / 2, (P[k][1] + P[k + 1][1]) / 2]); build();
    };
    $('leR').onclick = function () { if (P.length <= 2) return; P.splice(sel >= 0 && sel < P.length ? sel : P.length - 1, 1); sel = -1; build(); };
    $('leX').onclick = function () {
      var n = 0;
      [0, 1].forEach(function (side) {
        var a = side ? P[P.length - 1] : P[0], b = side ? P[P.length - 2] : P[1], k = Math.cos(a[0] * Math.PI / 180), dy = (a[0] - b[0]) * 111320, dx = (a[1] - b[1]) * 111320 * k, d = Math.hypot(dx, dy);
        if (d < 1) return;
        var ux = dx / d, uy = dy / d, s, last = null, out = 0;
        if (inAnyBlock(a[0], a[1])) out = 0;
        for (s = 2; s <= 3000; s += 2) {
          var la = a[0] + uy * s / 111320, lo = a[1] + ux * s / (111320 * k), inb = inAnyBlock(la, lo);
          if (inb) { last = [la, lo]; out = 0; } else { out += 2; if (out > 30) break; }
        }
        if (last) { if (side) P.push(last); else P.unshift(last); n++; }
      });
      if (n) build(); else toast('Tidak ada blok di ujung garis ini');
    };
    $('leOk').onclick = function () {
      if (P.length < 2) return;
      var v = parseFloat(String($('leW').value).replace(',', '.')); if (v >= 0.5 && v <= 30) w = v;
      if (ln) { ln.pts = P.map(function (p) { return [p[0], p[1]]; }); ln.w = w; }
      else { var c = lines().filter(function (x) { return x.type === type; }).length + 1; lines().push({ id: 'l' + Date.now().toString(36), type: type, name: typeName(type) + ' ' + c, w: w, pts: P.map(function (p) { return [p[0], p[1]]; }) }); }
      end(); changed(); toast('Tersimpan. Row dihitung ulang');
    };
    build();
  }
})();
