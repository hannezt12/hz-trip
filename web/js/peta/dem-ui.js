/* HZ Trip - kontur, lereng, profil ketinggian */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function zoomInd() { return HA.zoomInd.apply(this, arguments); }
  function close3d() { return HA.close3d.apply(this, arguments); }
  function open3d() { return HA.open3d.apply(this, arguments); }
  function demRedraw() { return HA.demRedraw.apply(this, arguments); }
  function setSource() { return HA.setSource.apply(this, arguments); }
  function batSet() { return HA.batSet.apply(this, arguments); }
  function batCfg() { return HA.batCfg.apply(this, arguments); }
  function batRedraw() { return HA.batRedraw.apply(this, arguments); }
  function openBat() { return HA.openBat.apply(this, arguments); }
  function blocksList() { return HA.blocksList.apply(this, arguments); }
  function drawBlocks() { return HA.drawBlocks.apply(this, arguments); }
  function drawRows() { return HA.drawRows.apply(this, arguments); }
  function closeBlockPop() { return HA.closeBlockPop.apply(this, arguments); }
  function lakesList() { return HA.lakesList.apply(this, arguments); }
  function applyLakes() { return HA.applyLakes.apply(this, arguments); }
  function openLakes() { return HA.openLakes.apply(this, arguments); }
  function shapesList() { return HA.shapesList.apply(this, arguments); }
  function drawShapes() { return HA.drawShapes.apply(this, arguments); }
  function applyShapes() { return HA.applyShapes.apply(this, arguments); }
  function openShapes() { return HA.openShapes.apply(this, arguments); }
  function drawStart() { return HA.drawStart.apply(this, arguments); }
  function renderProfile() { return HA.renderProfile.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.demButtons = demButtons;
  HA.fmt1 = fmt1;

  // ---------- kontur, lereng, profil ketinggian (data ketinggian) ----------
  HA.DM = { prev: false, edit: false, layer: null, btnK: null, btnL: null, btnP: null, pid: 0, mk: null, pr: null, miss: 0 };
  function contourStep(z) {
    var s = S.settings.contourStep || 'auto';
    if (s !== 'auto') return +s;
    var loc = false;
    try { var c = HA.map && HA.map.getCenter(); loc = !!(c && window.HzDem && HzDem.hasLocal(c.lat, c.lng)); } catch (e) {}
    if (loc) return z <= 15 ? 10 : (z === 16 ? 5 : 2);
    return z <= 16 ? 10 : 5;
  }
  function contourColor() {
    return S.settings.mapMode === 'osm' ? ['', '', 'rgba(255,255,255,.9)', 1] : ['', '', 'rgba(0,0,0,.75)', 0];
  }
  function meshWanted() { return false; }
  function legendSync() {
    var m = HA.map; if (!m) return;
    if (HA.DM.leg) { m.removeControl(HA.DM.leg); HA.DM.leg = null; }
    if (!window.HzDem || !(S.settings.slopeLayer || meshWanted())) return;
    var Ctl = L.Control.extend({ options: { position: 'topright' }, onAdd: function () {
      var e = L.DomUtil.create('div', 'slegend leaflet-control');
      e.innerHTML = '<span>0%</span><i class="gbar" style="background:' + HzDem.GRAD_CSS + '"></i><span>15%+</span><em>kemiringan</em>';
      return e; } });
    HA.DM.leg = new Ctl(); HA.DM.leg.addTo(m);
  }
  function syncMode() {
    var osm = S.settings.mapMode === 'osm';
    if (!window.HzDem || !HA.map) return;
    if (meshWanted() && !HA.DM.mesh) {
      HA.DM.mesh = HzDem.meshLayer({ onMissing: function () { if (Date.now() - HA.DM.miss > 20000) { HA.DM.miss = Date.now(); toast('Data ketinggian belum lengkap (butuh internet)'); } } });
      HA.DM.mesh.addTo(HA.map);
    } else if (!meshWanted() && HA.DM.mesh) { HA.map.removeLayer(HA.DM.mesh); HA.DM.mesh = null; }
    if (!osm && HA.V3.on) close3d();
    legendSync(); if (HA.DM.sync) HA.DM.sync();
  }
  function setSlopeLayer(on) {
    S.settings.slopeLayer = !!on; saveSettings();
    if (HA.DM.sync) HA.DM.sync();
    if (!HA.map || !window.HzDem) return;
    if (on && !HA.DM.slope) {
      HA.DM.slope = HzDem.slopeLayer({ onMissing: function () { if (Date.now() - HA.DM.miss > 20000) { HA.DM.miss = Date.now(); toast('Data ketinggian belum lengkap (butuh internet)'); } } });
      HA.DM.slope.addTo(HA.map);
    } else if (!on && HA.DM.slope) { HA.map.removeLayer(HA.DM.slope); HA.DM.slope = null; }
    legendSync();
  }
  function setContour(on) {
    S.settings.contour = !!on; saveSettings();
    if (HA.DM.sync) HA.DM.sync();
    if (!HA.map || !window.HzDem) return;
    if (on && !HA.DM.layer) {
      HA.DM.layer = HzDem.contours({ step: contourStep, color: contourColor, onMissing: function () { if (Date.now() - HA.DM.miss > 20000) { HA.DM.miss = Date.now(); toast('Data ketinggian belum lengkap (butuh internet)'); } } });
      HA.DM.layer.addTo(HA.map);
    } else if (!on && HA.DM.layer) { HA.map.removeLayer(HA.DM.layer); HA.DM.layer = null; }
  }
  var ICO_K = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M2 8c4-4 7 1 11-2s6 0 9 1"/><path d="M2 14c4-4 7 1 11-2s6 0 9 1"/><path d="M2 20c4-4 7 1 11-2s6 0 9 1"/></svg>';
  var ICO_L = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19l7-12 4 7 2-3 5 8z"/><path d="M12 3v3"/></svg>';
  var ICO_S = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18L3 6z"/><path d="M3 14l6 6M3 10l10 10"/></svg>';
  var ICO_P = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M6 16l4-5 3 3 5-7"/></svg>';
  var ICO_T = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>';
  function setHach(on) {
    S.settings.hach = !!on; saveSettings();
    if (!HA.map || !window.HzDem) return;
    if (on && !HA.DM.hach) {
      HA.DM.hach = HzDem.hachLayer({ kind: function () { return S.settings.hachKind || 'down'; }, umum: function () { return S.settings.hachSmooth === 'umum'; }, osm: function () { return S.settings.mapMode === 'osm'; }, onMissing: function () { if (Date.now() - HA.DM.miss > 20000) { HA.DM.miss = Date.now(); toast('Data ketinggian belum lengkap (butuh internet)'); } } });
      HA.DM.hach.addTo(HA.map);
    } else if (!on && HA.DM.hach) { HA.map.removeLayer(HA.DM.hach); HA.DM.hach = null; }
    if (HA.DM.sync) HA.DM.sync();
  }
  function demButtons(m) {
    // satu tombol "Alat peta" yang membuka panel berlabel
    var closeP = function () {};
    var panel = document.createElement('div');
    panel.className = 'toolpanel'; panel.style.display = 'none';
    m.getContainer().appendChild(panel);
    L.DomEvent.disableClickPropagation(panel); L.DomEvent.disableScrollPropagation(panel);
    function row(id, label, sub) { return '<div class="trow"><button type="button" class="tsw" data-t="' + id + '" role="switch"><span class="tl">' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="tk"></span></button></div>'; }
    function ic(p) { return '<svg viewBox="0 0 24 24">' + p + '</svg>'; }
    var IC = {
      contour: ic('<path d="M3 8c3-3 6 2 9-1s6 2 9-1M3 13c3-3 6 2 9-1s6 2 9-1M3 18c3-3 6 2 9-1s6 2 9-1"/>'),
      slopeLayer: ic('<path d="M3 19L21 6v13z"/><path d="M8 19v-3M12 19v-6M16 19v-9"/>'),
      hach: ic('<path d="M4 6l4 3M4 12l4 3M10 5l4 3M10 11l4 3M16 4l4 3M16 10l4 3M4 18l4 3"/>'),
      v3d: ic('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>'),
      slopeTap: ic('<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><path d="M12 8v4M12 14.5v.5"/>'),
      prof: ic('<path d="M3 20h18M4 16l4-5 3 3 4-7 5 6"/>'),
      useNas: ic('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
      useFree: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
      linesOn: ic('<path d="M4 20 L10 4 M14 4 L20 20"/>'),
      wlOn: ic('<path d="M3 8c3-3 6 2 9-1s6 2 9-1"/><ellipse cx="8" cy="15.5" rx="4" ry="2.6"/><circle cx="17" cy="15" r="2.4"/>'),
      lakesOn: ic('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
      shpOn: ic('<path d="M5 17l3-10 9 3 2 8z"/><circle cx="5" cy="17" r="1.5"/><circle cx="8" cy="7" r="1.5"/><circle cx="17" cy="10" r="1.5"/>'),
      fill: ic('<path d="M7 4l9 9-5 5-6-6z"/><path d="M17 15c1.5 2 2 3 0 4s-2-2 0-4z"/>'),
      shift: ic('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
      search: ic('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
      daftar: ic('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
      isi: ic('<path d="M5 3l7 7-6 9-3-3 9-13z"/><path d="M19 14c1.5 2 2 3 2 4a2 2 0 01-4 0c0-1 .5-2 2-4z"/>'),
      measure: ic('<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
      batDesa: ic('<path d="M4 7l5-3 6 3 5-2v12l-5 2-6-3-5 3z"/><path d="M9 4v13M15 7v13"/>'),
      batKec: ic('<path d="M3 5h18v14H3z"/><path d="M3 12h18M12 5v14"/>'),
      draw: ic('<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>'),
      batCfg: ic('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'),
      blkOn: ic('<path d="M3 4h8v8H3zM13 4h8v5h-8zM13 11h8v9h-8zM3 14h8v6H3z"/>'),
      rowOn: ic('<path d="M5 4l-2 16M10 4L8 20M15 4l-2 16M20 4l-2 16"/>'),
      detect: ic('<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 8h8v8H8z"/>'),
      play: ic('<path d="M8 5v14l11-7z"/>'),
      dataGo: ic('<path d="M5 5h14M5 12h14M5 19h14"/>')
    };
    function tile(id, label, st, badge) { return '<button type="button" class="tile' + (st ? ' st' : '') + '" data-t="' + id + '">' + IC[id] + '<span>' + label + '</span>' + (badge ? '<i class="tbd" id="bd_' + id + '"></i>' : '') + '</button>'; }
    var TILES = [['search', 'Cari'], ['daftar', 'Daftar tanda'], ['isi', 'Ketuk isi', 1], ['contour', 'Kontur', 1], ['slopeLayer', 'Lereng', 1], ['hach', 'Arsiran', 1], ['v3d', '3D', 1], ['slopeTap', 'Info lereng', 1], ['prof', 'Profil', 1],
      ['useNas', 'DEMNAS', 1], ['useFree', 'DEM gratis', 1], ['blkOn', 'Blok', 1, 1], ['rowOn', 'Arah row', 1], ['wlOn', 'Water lock', 1], ['lakesOn', 'Danau & drainase', 1, 1], ['linesOn', 'Jalan bantu', 1], ['batDesa', 'Batas', 1], ['play', 'Putar', 1],
      ['draw', 'Buat baru'], ['fill', 'Isi blok'], ['measure', 'Ukur'], ['shift', 'Geser blok']];
    var RARE = { v3d: 1, slopeLayer: 1, hach: 1, slopeTap: 1, prof: 1 };
    function tileShown(id) { var t = S.settings.tileShow || {}; if (t[id] != null) return !!t[id]; return !!(id === 'slopeLayer' ? S.settings.slopeLayer : id === 'hach' ? S.settings.hach : false); }
    HA.DM.rare = [['v3d', '3D'], ['slopeLayer', 'Kemiringan (Lereng)'], ['hach', 'Arsiran'], ['slopeTap', 'Info lereng'], ['prof', 'Profil']]; HA.DM.tileShown = tileShown;
    function orderedTiles() {
      var saved = S.settings.tileOrder || [], byId = {}, out = [];
      TILES.forEach(function (t) { byId[t[0]] = t; });
      saved.forEach(function (id) { if (byId[id]) { out.push(byId[id]); delete byId[id]; } });
      TILES.forEach(function (t) { if (byId[t[0]]) out.push(t); });
      out = out.filter(function (t) { return !RARE[t[0]] || tileShown(t[0]); });
      if (!(HA.KM && HA.KM.mode === 'kategori')) out = out.filter(function (t) { return t[0] !== 'isi'; });
      var si = -1; out.forEach(function (t, i) { if (t[0] === 'search') si = i; }); if (si > 0) out.unshift(out.splice(si, 1)[0]);
      if (HA.KM && HA.KM.mode === 'kategori') { // mode Kategori: Cari lalu alat tanda di depan
        var fr = ['search', 'daftar', 'isi', 'measure', 'draw', 'fill'], front = [], rest = [];
        out.forEach(function (t) { (fr.indexOf(t[0]) >= 0 ? front : rest).push(t); });
        front.sort(function (a, b) { return fr.indexOf(a[0]) - fr.indexOf(b[0]); });
        out = front.concat(rest);
      }
      return out;
    }
    function gridHtml() { return orderedTiles().map(function (t) { return tile(t[0], t[1], t[2], t[3]); }).join(''); }
    panel.innerHTML = '<div class="tseg" id="tRm"><button type="button" data-m="datar">Datar</button><button type="button" data-m="kontur">Kontur</button></div>' +
      '<div class="tgrid" id="tGrid">' + gridHtml() + '</div>' +
      '<div class="tseg" id="tHk"><button type="button" data-k="down">Arah turun</button><button type="button" data-k="row">Searah kontur</button></div>' +
      '<div class="tseg" id="tHs"><button type="button" data-s="detail">Detail</button><button type="button" data-s="umum">Umum</button></div>' +
      '<div class="tnote" id="tNasSub"></div>' +
      '<div class="tarr" id="tArr" style="display:none"><span>Seret ikon untuk menukar posisi</span><div><button type="button" id="taR">Awal</button><button type="button" id="taC">Batal</button><button type="button" class="pri" id="taOk">Simpan</button></div></div>';
    // atur urutan ikon: tahan lama, seret untuk menukar
    var arr = null;
    (function () {
      var grid = panel.querySelector('#tGrid'), timer = null, sx = 0, sy = 0, dragEl = null, pend = null;
      function endArr(save) {
        if (!arr) return;
        if (save) { S.settings.tileOrder = [].map.call(grid.children, function (e) { return e.getAttribute('data-t'); }); saveSettings(); toast('Urutan ikon disimpan'); }
        else { grid.innerHTML = gridHtml(); }
        panel.classList.remove('arr'); $('tArr').style.display = 'none'; arr = null; dragEl = null; sync();
      }
      function startArr() {
        arr = { }; panel.classList.add('arr'); $('tArr').style.display = ''; try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) {}
        $('taOk').onclick = function () { endArr(true); };
        $('taC').onclick = function () { endArr(false); };
        $('taR').onclick = function () { S.settings.tileOrder = []; saveSettings(); grid.innerHTML = gridHtml(); endArr(false); toast('Urutan dikembalikan'); };
        if (pend) { dragEl = pend; dragEl.classList.add('drg'); }
      }
      grid.addEventListener('pointerdown', function (e) {
        var t = e.target.closest && e.target.closest('.tile'); if (!t) return;
        sx = e.clientX; sy = e.clientY; pend = t;
        if (arr) { dragEl = t; t.classList.add('drg'); try { grid.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); return; }
        clearTimeout(timer); timer = setTimeout(function () { timer = null; startArr(); }, 600);
      });
      grid.addEventListener('pointermove', function (e) {
        if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) { clearTimeout(timer); timer = null; }
        if (!arr || !dragEl) return;
        e.preventDefault();
        var el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest && el.closest('.tile');
        if (!t || t === dragEl || t.parentNode !== grid) return;
        var kids = [].slice.call(grid.children), i = kids.indexOf(dragEl), j = kids.indexOf(t);
        if (i < j) grid.insertBefore(dragEl, t.nextSibling); else grid.insertBefore(dragEl, t);
      });
      function up() { clearTimeout(timer); timer = null; if (dragEl) { dragEl.classList.remove('drg'); } dragEl = null; if (arr) HA.DM.tileSwallow = Date.now() + 500; }
      grid.addEventListener('pointerup', up); grid.addEventListener('pointercancel', up);
      grid.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      HA.DM.arranging = function () { return !!arr || Date.now() < (HA.DM.tileSwallow || 0); };
    })();
    function state(id) {
      return id === 'contour' ? !!S.settings.contour : id === 'slopeLayer' ? !!S.settings.slopeLayer : id === 'hach' ? !!S.settings.hach : id === 'slopeTap' ? !!m._slopeOn :
        id === 'blkOn' ? S.settings.blkOn !== false : id === 'wlOn' ? !!(HA.wlOn && HA.wlOn()) : id === 'rowOn' ? !!S.settings.rowOn : id === 'isi' ? !!(HA.KM && HA.KM.fillTap) : id === 'shpOn' ? S.settings.shapesOn !== false : id === 'batDesa' ? !!(S.settings.bat && S.settings.bat.desa) : id === 'play' ? !!HA.PB.open : id === 'batKec' ? !!(S.settings.bat && S.settings.bat.kec) : id === 'v3d' ? HA.V3.on : id === 'useNas' ? S.settings.useNas !== false : id === 'useFree' ? S.settings.useFree !== false : id === 'lakesOn' ? S.settings.lakesOn !== false : id === 'linesOn' ? S.settings.linesOn !== false : !!S.profOpen;
    }
    function sync() {
      var any = false;
      var osmOnly = S.settings.mapMode !== 'osm';
      ['v3d'].forEach(function (t) { var e = panel.querySelector('[data-t=' + t + ']'); if (e) e.classList.toggle('dis', osmOnly); });
      panel.querySelectorAll('.tsw, .tile.st').forEach(function (b) { var on = state(b.getAttribute('data-t')); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); if (on) any = true; });
      var hs = S.settings.hachSmooth || 'detail';
      $('tHk').style.display = $('tHs').style.display = S.settings.hach ? '' : 'none';
      $('tRm').style.display = S.settings.rowOn ? '' : 'none';
      panel.querySelectorAll('#tRm button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === (S.settings.rowMode || 'datar')); });
      if ($('bd_blkOn')) $('bd_blkOn').textContent = blocksList().length || '';
      panel.querySelectorAll('#tHs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === hs); });
      if ($('tNasSub')) $('tNasSub').textContent = 'DEMNAS: ' + (window.HzDem && HzDem.hasAnyLocal() ? 'data impor, ±8 m' : 'belum diimpor (Pengaturan > Peta)') + ' · DEM gratis ±30 m';
      if ($('bd_shpOn')) $('bd_shpOn').textContent = shapesList().length || '';
      if ($('bd_lakesOn')) $('bd_lakesOn').textContent = lakesList().length || '';
      var k = S.settings.hachKind || 'down';
      panel.querySelectorAll('#tHk button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === k); });
      if (HA.DM.main) HA.DM.main.classList.toggle('hason', any);
    }
    HA.DM.sync = sync; HA.DM.syncMode = syncMode;
    HA.DM.orderedTiles = orderedTiles;
    HA.DM.regrid = function () { var g = $('tGrid'); if (g) { g.innerHTML = gridHtml(); sync(); } };
    panel.onclick = function (e) {
      if (e.target.closest && e.target.closest('#tArr')) return;
      if (HA.DM.arranging && HA.DM.arranging()) return;
      var k = e.target.closest && e.target.closest('#tHk button');
      if (k) { S.settings.hachKind = k.getAttribute('data-k'); saveSettings(); if (!S.settings.hach) setHach(true); else if (HA.DM.hach) HA.DM.hach.redraw(); sync(); return; }
      var rm = e.target.closest && e.target.closest('#tRm button');
      if (rm) { S.settings.rowMode = rm.getAttribute('data-m'); saveSettings(); drawRows(); sync(); if (HA.DM.pop && HA.DM.popId != null) { var pb = blocksList().filter(function (o) { return o.id === HA.DM.popId; })[0]; if (pb) HA.openBlockPop(pb, true); } return; }
      var sm = e.target.closest && e.target.closest('#tHs button');
      if (sm) { S.settings.hachSmooth = sm.getAttribute('data-s'); saveSettings(); if (!S.settings.hach) setHach(true); else if (HA.DM.hach) HA.DM.hach.redraw(); sync(); return; }
      var b = e.target.closest && e.target.closest('.tsw, .tbtn, .tile'); if (!b) return;
      var id = b.getAttribute('data-t');
      if (id === 'play') { if (HA.PB.open) HA.pbClose(); else { closeP(); HA.pbOpen(); } sync(); return; }
      if (id === 'daftar') { closeP(); if (HA.BT && HA.BT.listOpen) HA.BT.listOpen(); return; }
      if (id === 'isi') { if (HA.KM && HA.KM.toggleFill) HA.KM.toggleFill(); sync(); return; }
      if (id === 'search') { closeP(); if (HA.KM && HA.KM.openSearch) HA.KM.openSearch(); return; }
      if (id === 'measure' || id === 'draw' || id === 'fill') { if (HA.KM) HA.KM.fillTap = false; }
      if (id === 'measure') { closeP(); HA.measureStart(); return; }
      if (id === 'fill') { closeP(); HA.fillStart(); return; }
      if (id === 'shift') { closeP(); HA.shiftStart(); return; }
      if (id === 'draw') { if (HA.pbLocked('Tutup Putar dulu untuk menggambar')) return; closeP(); drawStart(); return; }
      if (id === 'detect') { closeP(); S.dpTab = 'blok'; go('data'); return; }
      if (id === 'blkOn') { S.settings.blkOn = S.settings.blkOn === false; saveSettings(); if (S.settings.blkOn === false) closeBlockPop(); drawBlocks(); sync(); return; }
      if (id === 'rowOn') { S.settings.rowOn = !S.settings.rowOn; saveSettings(); drawRows(true); sync(); return; }
      if (id === 'dataGo') { closeP(); go('data'); return; }
      if (id === 'lakes') { closeP(); openLakes(); return; }
      if (id === 'shapes') { closeP(); openShapes(); return; }
      if (id === 'shpOn') { S.settings.shapesOn = S.settings.shapesOn === false; saveSettings(); applyShapes(); sync(); return; }
      if (id === 'batCfg') { closeP(); openBat(); return; }
      if (id === 'batDesa') { var bb = batSet(); bb.desa = !bb.desa; bb.kec = false; saveSettings(); batRedraw(); sync(); if (bb.desa && m.getZoom() < 11) toast('Batas tampil mulai zoom 11 (kecamatan) dan zoom 13 (desa)'); return; }
      if (id === 'contour') setContour(!S.settings.contour);
      else if (id === 'slopeLayer') setSlopeLayer(!S.settings.slopeLayer);
      else if (id === 'hach') setHach(!S.settings.hach);
      else if (id === 'v3d') {
        if (S.settings.mapMode !== 'osm') { toast('3D hanya tersedia di mode Peta (bukan Satelit)'); return; }
        if (HA.V3.on) close3d(); else open3d();
      }
      else if (id === 'useNas') setSource('nas', S.settings.useNas === false);
      else if (id === 'useFree') setSource('free', S.settings.useFree === false);
      else if (id === 'linesOn') { S.settings.linesOn = S.settings.linesOn === false; saveSettings(); if (HA.drawLines) HA.drawLines(); sync(); }
      else if (id === 'lakesOn') { S.settings.lakesOn = S.settings.lakesOn === false; saveSettings(); applyLakes(); demRedraw(); if (HA.drawLines) HA.drawLines(); if (HA.RC) HA.RC.dep = {}; if (HA.drawWL) HA.drawWL(); sync(); }
      else if (id === 'wlOn') { S.settings.wlOn = !(HA.wlOn && HA.wlOn()); saveSettings(); if (HA.drawWL) HA.drawWL(true); sync(); }
      else if (id === 'slopeTap') {
        m._slopeOn = !m._slopeOn; if (m._pinClear) m._pinClear();
        toast(m._slopeOn ? 'Ketuk peta untuk info lereng' : 'Mode lereng mati');
      } else if (id === 'prof') { S.profOpen = !S.profOpen; renderProfile(); }
      sync();
    };
    var Ctl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        var b = L.DomUtil.create('button', 'locbtn leaflet-control');
        b.type = 'button'; b.setAttribute('aria-label', 'Alat peta'); b.innerHTML = ICO_T;
        L.DomEvent.disableClickPropagation(b);
        b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        b.onclick = function () { var open = panel.style.display === 'none'; if (open && HA.DM.edit) { toast('Selesaikan atau batalkan edit dulu'); return; } if (open) HA.closeAll({ panel: true }); panel.style.display = open ? 'block' : 'none'; b.classList.toggle('open', open); sync(); };
        HA.DM.main = b; closeP = function () { panel.style.display = 'none'; b.classList.remove('open'); }; HA.DM.closePanel = closeP; return b;
      }
    });
    new Ctl().addTo(m);
    // ketuk di luar panel menutup panel saja (ketukan tidak diteruskan ke peta)
    m.getContainer().addEventListener('click', function (e) {
      if (panel.style.display === 'none') return;
      if (e.target.closest && e.target.closest('.toolpanel, .locbtn')) return;
      closeP(); e.stopPropagation(); e.preventDefault();
    }, true);
    // tombol lama dipertahankan sebagai penampung status (tidak tampil)
    if (S.settings.btnPos) { delete S.settings.btnPos; saveSettings(); }
    HA.DM.btnL = document.createElement('button'); HA.DM.btnS = document.createElement('button'); HA.DM.btnK = document.createElement('button'); HA.DM.btnP = document.createElement('button');
    if (window.HzBatas && !HA.DM.bat) HA.DM.bat = HzBatas.attach(m, batCfg, toast);
    zoomInd(m);
    if (window.HzDem) HzDem.setSources(S.settings.useNas !== false, S.settings.useFree !== false);
    if (S.settings.shapes) { delete S.settings.shapes; saveSettings(); }
    applyLakes(); drawBlocks(); drawRows();
    var rwT = null; m.on('moveend', function () { clearTimeout(rwT); rwT = setTimeout(drawRows, 250); }); var bkT = null; m.on('moveend', function () { clearTimeout(bkT); bkT = setTimeout(drawBlocks, 300); });
    if (S.settings.contour) setContour(true);
    if (S.settings.slopeLayer) setSlopeLayer(true);
    if (S.settings.hach) setHach(true);
    syncMode();
    sync();
  }
  HA.ARROW = '<span style="display:inline-block;transform:rotate(DEGdeg);font-weight:700">&#8593;</span>';
  function fmt1(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
})();
