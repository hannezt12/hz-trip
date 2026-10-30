/* HZ Trip - laman Data peta, gambar dan ukur */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, E = HA.E, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function open3d() { return HA.open3d.apply(this, arguments); }
  function demRedraw() { return HA.demRedraw.apply(this, arguments); }
  function batSet() { return HA.batSet.apply(this, arguments); }
  function batRedraw() { return HA.batRedraw.apply(this, arguments); }
  function openBat() { return HA.openBat.apply(this, arguments); }
  function blocksList() { return HA.blocksList.apply(this, arguments); }
  function blkStatus() { return HA.blkStatus.apply(this, arguments); }
  function blkLabel() { return HA.blkLabel.apply(this, arguments); }
  function nextBlockNo() { return HA.nextBlockNo.apply(this, arguments); }
  function bbHit() { return HA.bbHit.apply(this, arguments); }
  function drawBlocks() { return HA.drawBlocks.apply(this, arguments); }
  function openBlockPop() { return HA.openBlockPop.apply(this, arguments); }
  function openBlockEdit() { return HA.openBlockEdit.apply(this, arguments); }
  function renderBlokTab() { return HA.renderBlokTab.apply(this, arguments); }
  function renderOv() { return HA.renderOv.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.renderData = renderData;
  HA.lakesList = lakesList;
  HA.applyLakes = applyLakes;
  HA.openLakes = openLakes;
  HA.shapesList = shapesList;
  HA.nf = nf;
  HA.drawShapes = drawShapes;
  HA.applyShapes = applyShapes;
  HA.shapeItems = shapeItems;
  HA.openShapes = openShapes;
  HA.drawStart = drawStart;
  HA.tripPts = tripPts;
  HA.climbOfTrip = climbOfTrip;
  HA.climbSeq = climbSeq;
  HA.renderProfile = renderProfile;
  HA.profInit = profInit;

  // ---------- halaman Data peta ----------
  function viewOnMap(pts) {
    HA.mapKeep = true; go('lintasan');
    setTimeout(function () { if (HA.map && pts && pts.length) HA.map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 19 }); }, 900);
  }
  function afterShape() { if (S.view === 'data') { closeSheet(); renderData(); } else openShapes(); }
  function delLake(i) {
    var l = lakesList()[i]; if (!l) return;
    askConfirm('Hapus tanda "' + l.name + '"?', 'Kontur dan arah panah di sekitarnya kembali mengikuti data asli.', 'Hapus', function () { lakesList().splice(i, 1); saveSettings(); applyLakes(); demRedraw(); if (S.view === 'data') renderData(); else openLakes(); });
  }
  function renderData() {
    var tab = S.dpTab || 'danau';
    document.querySelectorAll('#dpTabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
    document.querySelectorAll('.dpp').forEach(function (e) { e.classList.toggle('on', e.id === 'dp-' + tab); });
    var box = $('dp-' + tab);
    if (tab === 'danau') {
      var ls = lakesList();
      box.innerHTML = (ls.length ? ls.map(function (l, i) {
        return '<div class="card"><div class="dprow" style="margin-top:0"><input type="text" data-lk="' + i + '" value="' + esc(l.name) + '" maxlength="30"><button class="btn sm" data-lv="' + i + '">Lihat</button><button class="btn sm danger" data-ld="' + i + '">Hapus</button></div><div class="muted" data-lm="' + i + '" style="margin-top:6px"></div></div>';
      }).join('') : '<div class="card muted">Belum ada tanda danau.</div>') +
        '<div class="muted" style="margin-top:10px">Di dalam tanda, permukaan dianggap datar di bawah tepinya, jadi panah di tepi menunjuk ke dalam. Dipakai oleh kontur, kemiringan, arsiran, Info lereng, dan profil. Matikan dengan ikon Danau di Alat peta.</div>' +
        '<button class="btn pri" id="dpNewL" style="width:100%;margin-top:12px;height:50px">+ Tandai danau baru</button>';
      ls.forEach(function (l, i) {
        function show(m) { var e = box.querySelector('[data-lm="' + i + '"]'); if (e && m && m.area) e.textContent = 'Luas datar ' + fmtArea(m.area) + (m.areaSlope ? ' · permukaan lereng ' + fmtArea(m.areaSlope) : '') + ' · keliling ' + fmtLen(m.flat); }
        if (l.m) show(l.m); else if (window.HzDem) HzDem.measure(l.pts, true).then(function (m) { l.m = m; saveSettings(); show(m); }).catch(function () {});
      });
      box.querySelectorAll('input[data-lk]').forEach(function (inp) { inp.onchange = function () { var l = lakesList()[+inp.getAttribute('data-lk')]; if (l) { l.name = inp.value.trim() || l.name; saveSettings(); drawLakes(); } }; });
      box.querySelectorAll('[data-lv]').forEach(function (b) { b.onclick = function () { var l = lakesList()[+b.getAttribute('data-lv')]; if (l) viewOnMap(l.pts); }; });
      box.querySelectorAll('[data-ld]').forEach(function (b) { b.onclick = function () { delLake(+b.getAttribute('data-ld')); }; });
      $('dpNewL').onclick = function () { HA.mapKeep = true; go('lintasan'); setTimeout(drawStart, 700); };
    } else if (tab === 'gambar') {
      var sh = shapesList();
      box.innerHTML = (sh.length ? sh.map(function (s, i) {
        return '<div class="card"><div class="dprow" style="margin-top:0"><div class="nm"><b>' + esc(s.name) + '</b><small>' + (s.type === 'line' ? 'Garis' : 'Area') + (s.m ? ' · ' + (s.type === 'line' ? fmtLen(s.m.flat) : (s.m.area ? fmtArea(s.m.area) + ' (datar)' + (s.m.areaSlope ? ' · ' + fmtArea(s.m.areaSlope) + ' (lereng)' : '') : '')) : '') + '</small></div><button class="btn sm" data-sv="' + i + '">Lihat</button><button class="btn sm" data-se="' + i + '">Buka</button></div></div>';
      }).join('') : '<div class="card muted">Belum ada gambar.</div>') +
        '<div class="muted" style="margin-top:10px">Garis mengukur panjang. Area menandai wilayah dan mengukur luas (datar dan mengikuti lereng). Tampil di peta dan 3D.</div>' +
        '<button class="btn pri" id="dpNewS" style="width:100%;margin-top:12px;height:50px">+ Gambar baru</button>';
      box.querySelectorAll('[data-sv]').forEach(function (b) { b.onclick = function () { var s = shapesList()[+b.getAttribute('data-sv')]; if (s) viewOnMap(s.pts); }; });
      box.querySelectorAll('[data-se]').forEach(function (b) { b.onclick = function () { openShape(+b.getAttribute('data-se')); }; });
      $('dpNewS').onclick = function () { HA.mapKeep = true; go('lintasan'); setTimeout(drawStart, 700); };
    } else if (tab === 'blok') {
      renderBlokTab(box);
    } else if (tab === 'batas') {
      var bs = batSet(), fi = window.HzBatas ? HzBatas.fileInfo() : [];
      box.innerHTML = '<div class="card"><div class="dprow" style="margin-top:0"><div class="nm"><b>Desa</b><small>' + (bs.desa ? 'tampil di peta' : 'mati') + '</small></div><button class="btn sm" data-bt="desa">' + (bs.desa ? 'Matikan' : 'Nyalakan') + '</button></div>' +
        '<div class="dprow"><div class="nm"><b>Kecamatan</b><small>' + (bs.kec ? 'tampil di peta' : 'mati') + '</small></div><button class="btn sm" data-bt="kec">' + (bs.kec ? 'Matikan' : 'Nyalakan') + '</button></div></div>' +
        '<div class="h">BERKAS IMPOR</div><div class="card">' + (fi.length ? fi.map(function (x, i) { return '<div class="dprow" style="margin-top:' + (i ? 8 : 0) + 'px"><div class="nm"><b>' + esc(x.name) + '</b><small>' + (x.kind === 'desa' ? 'Desa' : 'Kecamatan') + ' · ' + x.n + ' poligon</small></div><button class="btn sm danger" data-bd="' + i + '">Hapus</button></div>'; }).join('') : '<div class="muted">Belum ada berkas.</div>') + '</div>' +
        '<div class="h">LAYANAN ONLINE</div><div class="card"><div class="muted" style="word-break:break-all">' + (bs.base ? esc(bs.base) : 'Belum diatur.') + '</div></div>' +
        '<button class="btn pri" id="dpBat" style="width:100%;margin-top:12px;height:50px">Pengaturan batas wilayah</button>';
      box.querySelectorAll('[data-bt]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-bt'); bs[k] = !bs[k]; saveSettings(); batRedraw(); renderData(); }; });
      box.querySelectorAll('[data-bd]').forEach(function (b) { b.onclick = function () { var x = HzBatas.fileInfo()[+b.getAttribute('data-bd')]; if (x) HzBatas.removeFile(x.kind, x.name).then(function () { batRedraw(); renderData(); }); }; });
      $('dpBat').onclick = openBat;
    } else if (tab === 'pdf') {
      renderOv();
    }
  }
  function lakesList() { return S.settings.lakes || (S.settings.lakes = []); }
  function applyLakes() {
    if (window.HzDem) HzDem.setLakes(S.settings.lakesOn !== false ? lakesList() : []);
    drawLakes();
  }
  function drawLakes() {
    if (!HA.map) return;
    if (HA.DM.lakeLayer) { HA.map.removeLayer(HA.DM.lakeLayer); HA.DM.lakeLayer = null; }
    if (S.settings.lakesOn === false || !lakesList().length) return;
    var g = L.layerGroup();
    lakesList().forEach(function (l) {
      L.polygon(l.pts, { color: '#7FD8FF', weight: 1.2, dashArray: '5 4', fill: false, interactive: false }).bindTooltip(esc(l.name), { permanent: true, direction: 'center', className: 'lktip' }).addTo(g);
    });
    g.addTo(HA.map); HA.DM.lakeLayer = g;
  }
  function openLakes() {
    var ls = lakesList();
    openSheet('<div class="grab"></div><div class="st">DANAU</div>' +
      (ls.length ? ls.map(function (l, i) { return '<div class="row" style="margin-top:8px"><input type="text" data-lk="' + i + '" value="' + esc(l.name) + '" maxlength="30"><button class="btn" data-del="' + i + '" style="flex-shrink:0">Hapus</button></div><div class="muted" data-lm="' + i + '" style="margin-top:2px"></div>'; }).join('') : '<div class="muted" style="margin:8px 0">Belum ada tanda danau.</div>') +
      '<div class="muted" style="margin-top:10px">Di dalam tanda, permukaan dianggap datar di bawah tepinya, jadi panah di tepi menunjuk ke dalam. Dipakai oleh kontur, kemiringan, arsiran, Info lereng, dan profil. Matikan dengan saklar Koreksi danau.</div>' +
      '<button class="btn pri" id="lkNew" style="width:100%;margin-top:12px;height:50px">+ Tandai danau baru</button><button class="btn" id="lkX" style="width:100%;margin-top:8px">Tutup</button>');
    ls.forEach(function (l, i) {
      function show(m) { var e = $('sheet').querySelector('[data-lm="' + i + '"]'); if (e && m && m.area) e.textContent = 'Luas datar ' + fmtArea(m.area) + (m.areaSlope ? ' · permukaan lereng ' + fmtArea(m.areaSlope) : '') + ' · keliling ' + fmtLen(m.flat); }
      if (l.m) show(l.m); else if (window.HzDem) HzDem.measure(l.pts, true).then(function (m) { l.m = m; saveSettings(); show(m); }).catch(function () {});
    });
    $('lkX').onclick = closeSheet;
    $('lkNew').onclick = function () { closeSheet(); lakeStart(); };
    $('sheet').querySelectorAll('input[data-lk]').forEach(function (inp) {
      inp.onchange = function () { var l = lakesList()[+inp.getAttribute('data-lk')]; if (l) { l.name = inp.value.trim() || l.name; saveSettings(); drawLakes(); } };
    });
    $('sheet').querySelectorAll('button[data-del]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-del'), l = lakesList()[i]; if (!l) return;
        askConfirm('Hapus tanda "' + l.name + '"?', 'Kontur dan arah panah di sekitarnya kembali mengikuti data asli.', 'Hapus', function () { lakesList().splice(i, 1); saveSettings(); applyLakes(); demRedraw(); openLakes(); });
      };
    });
  }
  // ---------- gambar dan ukur (garis, area, danau) ----------
  var SHP_COL = ['#00D4FF', '#FF7AD9', '#B79CFF', '#FFFFFF', '#00E5C0'];
  function shapesList() { return S.settings.shapes || (S.settings.shapes = []); }
  function nf(v, d) { return v.toFixed(d).replace('.', ','); }
  function fmtLen(m) { return m < 1000 ? Math.round(m) + ' m' : nf(m / 1000, 2) + ' km'; }
  function fmtArea(m) { return m < 10000 ? Math.round(m) + ' m²' : nf(m / 10000, 2) + ' ha'; }
  function shapeText(s) {
    var m = s.m; if (!m) return s.name;
    return s.name + ' · ' + (s.type === 'line' ? fmtLen(m.flat) : (m.area ? fmtArea(m.area) : ''));
  }
  function flatQ(pts, closed) {
    var R = Math.PI / 180, kx = 111320 * Math.cos(pts[0][0] * R), ky = 111320, xy = pts.map(function (p) { return [(p[1] - pts[0][1]) * kx, (p[0] - pts[0][0]) * ky]; }), len = 0, ar = 0, i;
    for (i = 0; i < xy.length - 1; i++) len += Math.hypot(xy[i + 1][0] - xy[i][0], xy[i + 1][1] - xy[i][1]);
    if (closed && xy.length > 2) { len += Math.hypot(xy[0][0] - xy[xy.length - 1][0], xy[0][1] - xy[xy.length - 1][1]); for (i = 0; i < xy.length; i++) { var p = xy[i], q = xy[(i + 1) % xy.length]; ar += p[0] * q[1] - q[0] * p[1]; } }
    return { len: len, area: Math.abs(ar) / 2 };
  }
  function measureHtml(m, type) {
    if (!m) return '<div class="muted">Menghitung…</div>';
    var h = [];
    function line(k, v) { h.push('<div class="row" style="justify-content:space-between;margin-top:4px"><span class="muted">' + k + '</span><b>' + v + '</b></div>'); }
    function pc(a, b) { return ' (' + (b >= a ? '+' : '−') + nf(Math.abs(b / a - 1) * 100, 1) + '%)'; }
    if (type === 'line') {
      line('Panjang datar', fmtLen(m.flat));
      if (m.slope != null) { line('Panjang mengikuti lereng', fmtLen(m.slope) + pc(m.flat, m.slope)); line('Naik / turun', '+' + Math.round(m.gain) + ' m / −' + Math.round(m.loss) + ' m'); line('Mulai → akhir', Math.round(m.eStart) + ' → ' + Math.round(m.eEnd) + ' mdpl'); }
    } else {
      if (m.area) line('Luas datar', fmtArea(m.area) + ' · ' + Math.round(m.area).toLocaleString('id-ID') + ' m²');
      if (m.areaSlope) { line('Luas permukaan lereng', fmtArea(m.areaSlope) + pc(m.area, m.areaSlope)); line('Kemiringan rata-rata', nf(m.pct, 1) + '%'); }
      line('Keliling datar', fmtLen(m.flat)); if (m.slope != null) line('Keliling mengikuti lereng', fmtLen(m.slope));
      if (m.zmin != null) line('Tinggi', Math.round(m.zmin) + ' – ' + Math.round(m.zmax) + ' mdpl');
    }
    if (m.slope == null) h.push('<div class="muted" style="margin-top:6px">Data ketinggian belum tersedia di area ini (butuh internet), jadi hanya ukuran datar.</div>');
    return h.join('');
  }
  function drawShapes() {
    if (!HA.map) return;
    if (HA.DM.shapeLayer) { HA.map.removeLayer(HA.DM.shapeLayer); HA.DM.shapeLayer = null; }
    if (S.settings.shapesOn === false || !shapesList().length) return;
    var g = L.layerGroup();
    shapesList().forEach(function (s) {
      var o = { color: s.color || '#FF7AD9', weight: 2.2, interactive: false };
      var l = s.type === 'line' ? L.polyline(s.pts, o) : L.polygon(s.pts, Object.assign(o, { fillOpacity: 0.16 }));
      l.bindTooltip(esc(shapeText(s)), { permanent: true, direction: 'center', className: 'lktip' }).addTo(g);
    });
    g.addTo(HA.map); HA.DM.shapeLayer = g;
  }
  function applyShapes() { drawShapes(); if (HA.V3.on) open3d(true); }
  function shapeItems(noBlocks) {
    var out = [];
    if (S.settings.shapesOn !== false) shapesList().forEach(function (s) { out.push({ name: s.name, pts: s.pts, closed: s.type !== 'line', color: s.color || '#FF7AD9', label: shapeText(s) }); });
    if (S.settings.blkOn !== false && !noBlocks && HA.map) { var mbd = HA.map.getBounds(); blocksList().filter(function (b) { return bbHit(b, mbd); }).slice(0, 60).forEach(function (b) { out.push({ name: b.name, pts: b.pts, closed: true, color: HA.BLK_COL[blkStatus(b)], label: blkLabel(b) }); }); }
    if (S.settings.lakesOn !== false) lakesList().forEach(function (l) { out.push({ name: l.name, pts: l.pts, closed: true, color: '#7FD8FF', label: l.name + (l.m && l.m.area ? ' · ' + fmtArea(l.m.area) : '') }); });
    return out;
  }
  function openShapes() {
    var ls = shapesList();
    openSheet('<div class="grab"></div><div class="st">GAMBAR & UKUR</div>' +
      (ls.length ? ls.map(function (s, i) { return '<button class="btn" data-sh="' + i + '" style="width:100%;margin-top:8px;text-align:left;height:auto;padding:8px 12px"><b>' + esc(s.name) + '</b><br><small class="muted">' + (s.type === 'line' ? 'Garis' : 'Area') + (s.m ? ' · ' + (s.type === 'line' ? fmtLen(s.m.flat) : (s.m.area ? fmtArea(s.m.area) : '')) : '') + '</small></button>'; }).join('') : '<div class="muted" style="margin:8px 0">Belum ada gambar.</div>') +
      '<div class="muted" style="margin-top:10px">Ketuk titik di peta. Pilih Garis untuk mengukur panjang, atau Area untuk menandai wilayah dan mengukur luasnya. Danau memakai alat yang sama dan juga mengoreksi ketinggian. Semua tampil di peta dan tampilan 3D.</div>' +
      '<button class="btn pri" id="shNew" style="width:100%;margin-top:12px;height:50px">+ Gambar baru</button><button class="btn" id="shX" style="width:100%;margin-top:8px">Tutup</button>');
    $('shX').onclick = closeSheet;
    $('shNew').onclick = function () { closeSheet(); drawStart(); };
    $('sheet').querySelectorAll('button[data-sh]').forEach(function (b) { b.onclick = function () { openShape(+b.getAttribute('data-sh')); }; });
  }
  function openShape(i) {
    var s = shapesList()[i]; if (!s) return;
    openSheet('<div class="grab"></div><div class="st">' + (s.type === 'line' ? 'GARIS' : 'AREA') + '</div>' +
      '<input type="text" id="shN" maxlength="40" value="' + esc(s.name) + '" style="margin-top:6px">' +
      '<div class="row" id="shC" style="margin-top:8px;gap:8px">' + SHP_COL.map(function (c) { return '<button class="btn" data-c="' + c + '" style="width:44px;height:44px;flex:none;background:' + c + ';border:3px solid ' + (c === s.color ? 'var(--tx)' : 'transparent') + '"></button>'; }).join('') + '</div>' +
      '<div id="shM" style="margin-top:10px"></div>' +
      '<textarea id="shT" rows="2" maxlength="200" placeholder="Catatan (opsional)" style="margin-top:10px;width:100%">' + esc(s.note || '') + '</textarea>' +
      '<div class="row" style="margin-top:10px"><button class="btn" id="shV" style="flex:1">Lihat di peta</button><button class="btn" id="shD" style="flex:1;color:var(--r)">Hapus</button></div>' +
      '<button class="btn" id="shX" style="width:100%;margin-top:8px">Selesai</button>');
    $('shM').innerHTML = measureHtml(s.m, s.type);
    if (!s.m && window.HzDem) HzDem.measure(s.pts, s.type !== 'line').then(function (m) { s.m = m; saveSettings(); if ($('shM')) $('shM').innerHTML = measureHtml(m, s.type); drawShapes(); }).catch(function () {});
    $('shN').onchange = function () { s.name = $('shN').value.trim() || s.name; saveSettings(); applyShapes(); };
    $('shT').onchange = function () { s.note = $('shT').value.trim(); saveSettings(); };
    $('shC').onclick = function (e) { var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (!c) return; s.color = c; saveSettings(); applyShapes(); openShape(i); };
    $('shV').onclick = function () { closeSheet(); if (HA.map) HA.map.fitBounds(L.latLngBounds(s.pts), { padding: [50, 50], maxZoom: 19 }); };
    $('shD').onclick = function () { askConfirm('Hapus "' + s.name + '"?', 'Gambar ini dihapus dari peta dan tampilan 3D.', 'Hapus', function () { shapesList().splice(i, 1); saveSettings(); applyShapes(); afterShape(); }); };
    $('shX').onclick = function () { if (S.view === 'data') afterShape(); else { closeSheet(); openShapes(); } };
  }
  function drawStart() {
    if (!HA.map || !window.HzDem) return;
    if (HA.DM.closePanel) HA.DM.closePanel();
    HA.map._slopeOn = false; if (HA.DM.sync) HA.DM.sync();
    var pts = [], pl = L.polyline([], { color: HA.NEON, weight: 3 }).addTo(HA.map), pl0 = L.polyline([], { color: '#06202B', weight: 6, opacity: 0.55, interactive: false }).addTo(HA.map), mk = L.layerGroup().addTo(HA.map), bar = document.createElement('div');
    bar.className = 'lkbar';
    bar.innerHTML = '<span id="lkT"></span><button type="button" id="lkU">Urung</button><button type="button" id="lkL" class="pri">Garis</button><button type="button" id="lkA" class="pri">Area</button><button type="button" id="lkD" class="pri">Danau</button><button type="button" id="lkB" class="pri">Blok</button><button type="button" id="lkC">Batal</button>';
    HA.map.getContainer().appendChild(bar);
    L.DomEvent.disableClickPropagation(bar);
    function upd() {
      pl.setLatLngs(pts.length > 2 ? pts.concat([pts[0]]) : pts); pl0.setLatLngs(pts.length > 2 ? pts.concat([pts[0]]) : pts); pl.bringToFront();
      var t = 'Ketuk titik di peta (' + pts.length + ')';
      if (pts.length > 1) { var q = flatQ(pts, false); t += ' · garis ' + fmtLen(q.len); if (pts.length > 2) t += ' · area ' + fmtArea(flatQ(pts, true).area); }
      $('lkT').textContent = t;
    }
    function dot(q) { L.circleMarker(q, { radius: 5, color: '#06202B', weight: 2, fillColor: HA.NEON, fillOpacity: 1 }).addTo(mk); }
    function end() { HA.map._lakeDraw = null; HA.map.removeLayer(pl); HA.map.removeLayer(pl0); HA.map.removeLayer(mk); bar.remove(); }
    HA.map._lakeDraw = { tap: function (ll) { var q = [+ll.lat.toFixed(6), +ll.lng.toFixed(6)]; pts.push(q); dot(q); upd(); } };
    $('lkU').onclick = function () { pts.pop(); mk.clearLayers(); pts.forEach(dot); upd(); };
    $('lkC').onclick = end;
    function saveShape(type) {
      var n = shapesList().filter(function (x) { return x.type === type; }).length + 1, p = pts.slice();
      toast('Menghitung…');
      HzDem.measure(p, type === 'area').catch(function () { return null; }).then(function (m) {
        var s = { id: Date.now(), type: type, name: (type === 'line' ? 'Garis ' : 'Area ') + n, pts: p, color: type === 'line' ? '#00D4FF' : '#FF7AD9', note: '', m: m };
        shapesList().push(s); S.settings.shapesOn = true; saveSettings(); end(); applyShapes(); openShape(shapesList().length - 1);
      });
    }
    $('lkB').onclick = function () {
      if (pts.length < 3) { toast('Minimal 3 titik'); return; }
      var b = { id: Date.now(), src: 'manual', name: 'Blok ' + nextBlockNo(), pts: pts.slice(), ovId: null, dir: null, sp: null, margin: 0, conf: false, note: '' };
      blocksList().push(b); S.settings.blkOn = true; saveSettings(); end(); drawBlocks(); openBlockPop(b); openBlockEdit(b);
    };
    $('lkL').onclick = function () { if (pts.length < 2) { toast('Minimal 2 titik'); return; } saveShape('line'); };
    $('lkA').onclick = function () { if (pts.length < 3) { toast('Minimal 3 titik'); return; } saveShape('area'); };
    $('lkD').onclick = function () {
      if (pts.length < 3) { toast('Minimal 3 titik'); return; }
      toast('Menghitung…');
      HzDem.lakeLevel(pts).then(function (lv) {
        if (lv === null) { toast('Data ketinggian belum tersedia di area ini'); return; }
        var n = lakesList().length + 1, lk = { id: Date.now(), name: 'Danau ' + n, pts: pts.slice(), level: lv };
        lakesList().push(lk);
        S.settings.lakesOn = true; saveSettings(); end(); applyLakes(); demRedraw(); openLakes();
        HzDem.measure(lk.pts, true).then(function (m) { lk.m = m; saveSettings(); }).catch(function () {});
      });
    };
    upd();
    toast('Ketuk titik di peta');
  }
  function lakeStart() { drawStart(); }
  function tripPts(pts, t) {
    var out = [];
    E.trackOf(pts, t).runs.forEach(function (r) { r.pts.forEach(function (p) { out.push([p.lat, p.lng]); }); });
    return out;
  }
  // cache hasil naik/turun per trip (kunci: jam mulai-selesai)
  HA.CL = (function () {
    var c = null;
    function load() { if (c) return c; try { c = JSON.parse(localStorage.getItem('hzclimb') || '{}'); } catch (e) { c = {}; } return c; }
    return { clear: function () { c = {}; try { localStorage.removeItem('hzclimb'); } catch (e) {} }, get: function (k) { return load()[k]; }, set: function (k, v) { load()[k] = v; try { localStorage.setItem('hzclimb', JSON.stringify(c)); } catch (e) {} } };
  })();
  function climbOfTrip(t, pts) {
    var k = t.start + '-' + t.end, c = HA.CL.get(k);
    if (c) return Promise.resolve({ up: c[0], down: c[1], min: c[2], max: c[3] });
    if (!window.HzDem) return Promise.resolve(null);
    return HzDem.profile(tripPts(pts, t), 60).then(function (p) {
      if (!p) return null;
      HA.CL.set(k, [Math.round(p.up), Math.round(p.down), Math.round(p.min), Math.round(p.max)]);
      return { up: Math.round(p.up), down: Math.round(p.down), min: Math.round(p.min), max: Math.round(p.max) };
    }).catch(function () { return null; });
  }
  function climbSeq(items, onEach) {
    var i = 0, bad = false;
    function nx() {
      if (i >= items.length || bad) return Promise.resolve();
      var it = items[i++];
      return climbOfTrip(it.t, it.pts).then(function (c) { if (!c) bad = true; else onEach(it, c); return nx(); });
    }
    return nx();
  }
  function hideProf() {
    var b = $('profBox'); if (b) b.style.display = 'none';
    if (HA.DM.mk && HA.map) { HA.map.removeLayer(HA.DM.mk); HA.DM.mk = null; }
    if (HA.map) setTimeout(function () { HA.map.invalidateSize(); }, 50);
  }
  function renderProfile() {
    if (HA.DM.sync) HA.DM.sync();
    if (!S.profOpen) { hideProf(); return; }
    var v = S.mapView, b = $('profBox');
    if (!v || !v.trips || !v.trips.length) { b.style.display = 'block'; $('profS').textContent = 'Belum ada trip pada hari ini.'; $('profCv').style.display = 'none'; $('profR').textContent = ''; setTimeout(function () { HA.map.invalidateSize(); }, 50); return; }
    b.style.display = 'block'; $('profCv').style.display = 'none'; $('profR').textContent = '';
    $('profT').textContent = v.sel >= 0 ? 'Profil ketinggian · trip ' + (v.sel + 1) : 'Profil ketinggian · semua trip';
    $('profS').textContent = 'Menghitung ketinggian…';
    setTimeout(function () { HA.map.invalidateSize(); }, 50);
    var pid = ++HA.DM.pid, list = v.trips.map(function (x) { return x.t; });
    if (v.sel >= 0 && list[v.sel]) list = [list[v.sel]];
    var parts = [];
    (function nx(i) {
      if (i >= list.length) return Promise.resolve();
      return HzDem.profile(tripPts(v.pts, list[i]), 50).then(function (p) { if (p) parts.push(p); return nx(i + 1); });
    })(0).then(function () {
      if (pid !== HA.DM.pid) return;
      if (!parts.length) { $('profS').textContent = 'Data ketinggian belum tersedia. Hubungkan internet sekali, lalu buka lagi.'; return; }
      var pr = { d: [], e: [], lat: [], lng: [], up: 0, down: 0, min: Infinity, max: -Infinity, km: 0, seps: [] }, off = 0;
      parts.forEach(function (p, k) {
        if (k > 0) { off += 150; pr.seps.push(off - 75); }
        p.d.forEach(function (dd, j) { pr.d.push(off + dd); pr.e.push(p.e[j]); pr.lat.push(p.lat[j]); pr.lng.push(p.lng[j]); });
        off += p.d[p.d.length - 1];
        pr.up += p.up; pr.down += p.down; pr.min = Math.min(pr.min, p.min); pr.max = Math.max(pr.max, p.max); pr.km += p.km;
      });
      HA.DM.pr = pr;
      $('profS').innerHTML = 'Terendah <b>' + Math.round(pr.min) + ' m</b> · Tertinggi <b>' + Math.round(pr.max) + ' m</b> · Naik <b>' + Math.round(pr.up) + ' m</b> · Turun <b>' + Math.round(pr.down) + ' m</b> · ' + T.km1(pr.km) + ' km';
      $('profCv').style.display = 'block';
      drawProf(-1);
    }).catch(function () { if (pid === HA.DM.pid) $('profS').textContent = 'Gagal menghitung ketinggian.'; });
  }
  function drawProf(hi) {
    var pr = HA.DM.pr, cv = $('profCv'); if (!pr) return;
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = 100;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var cx = cv.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    var dm = pr.d[pr.d.length - 1] || 1, lo = pr.min, hiE = pr.max, span = Math.max(8, hiE - lo), top = 10, bot = 16;
    function X(dd) { return 4 + dd / dm * (W - 8); }
    function Y(e) { return H - bot - (e - lo) / span * (H - bot - top); }
    var cs = getComputedStyle(document.documentElement), tx2 = cs.getPropertyValue('--tx2') || '#8a97a0';
    cx.beginPath(); cx.moveTo(X(pr.d[0]), H - bot);
    pr.d.forEach(function (dd, i) { cx.lineTo(X(dd), Y(pr.e[i])); });
    cx.lineTo(X(pr.d[pr.d.length - 1]), H - bot); cx.closePath();
    var gr = cx.createLinearGradient(0, top, 0, H - bot); gr.addColorStop(0, 'rgba(77,163,255,.45)'); gr.addColorStop(1, 'rgba(77,163,255,.05)');
    cx.fillStyle = gr; cx.fill();
    cx.beginPath(); pr.d.forEach(function (dd, i) { if (i) cx.lineTo(X(dd), Y(pr.e[i])); else cx.moveTo(X(dd), Y(pr.e[i])); });
    cx.strokeStyle = '#4DA3FF'; cx.lineWidth = 2; cx.lineJoin = 'round'; cx.stroke();
    cx.setLineDash([3, 4]); cx.strokeStyle = tx2; cx.lineWidth = 1;
    pr.seps.forEach(function (s) { cx.beginPath(); cx.moveTo(X(s), top); cx.lineTo(X(s), H - bot); cx.stroke(); });
    cx.setLineDash([]);
    cx.fillStyle = tx2; cx.font = '11px sans-serif'; cx.textBaseline = 'alphabetic';
    cx.textAlign = 'left'; cx.fillText(Math.round(lo) + ' m', 4, H - 3);
    cx.textAlign = 'right'; cx.fillText(Math.round(hiE) + ' m', W - 4, 10);
    cx.textAlign = 'center'; cx.fillText(T.km1(pr.km) + ' km', W / 2, H - 3);
    if (hi >= 0) {
      cx.strokeStyle = '#fff'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(X(pr.d[hi]), top); cx.lineTo(X(pr.d[hi]), H - bot); cx.stroke();
      cx.fillStyle = '#4DA3FF'; cx.beginPath(); cx.arc(X(pr.d[hi]), Y(pr.e[hi]), 5, 0, 7); cx.fill(); cx.lineWidth = 2; cx.strokeStyle = '#fff'; cx.stroke();
    }
  }
  function profHover(ev) {
    var pr = HA.DM.pr; if (!pr || !HA.map) return;
    var cv = $('profCv'), r = cv.getBoundingClientRect(), fx = (ev.clientX - r.left - 4) / Math.max(1, r.width - 8), dm = pr.d[pr.d.length - 1] || 1, tgt = Math.max(0, Math.min(1, fx)) * dm, lo = 0, hi = pr.d.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (pr.d[mid] < tgt) lo = mid + 1; else hi = mid; }
    drawProf(lo);
    var ll = [pr.lat[lo], pr.lng[lo]];
    if (!HA.DM.mk) HA.DM.mk = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#4DA3FF', fillOpacity: 1, interactive: false }).addTo(HA.map); else HA.DM.mk.setLatLng(ll);
    $('profR').textContent = Math.round(pr.e[lo]) + ' m · ' + T.km1(pr.d[lo] / 1000) + ' km dari awal';
  }
  function profInit() {
    var cv = $('profCv');
    $('profX').onclick = function () { S.profOpen = false; renderProfile(); };
    cv.addEventListener('pointerdown', function (e) { try { cv.setPointerCapture(e.pointerId); } catch (er) {} profHover(e); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (e.buttons || e.pointerType === 'touch') profHover(e); });
    cv.addEventListener('pointerup', function () { if (HA.DM.mk && HA.map) { HA.map.removeLayer(HA.DM.mk); HA.DM.mk = null; } drawProf(-1); });
  }
})();
