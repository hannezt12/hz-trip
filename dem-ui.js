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
      lakesOn: ic('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
      shpOn: ic('<path d="M5 17l3-10 9 3 2 8z"/><circle cx="5" cy="17" r="1.5"/><circle cx="8" cy="7" r="1.5"/><circle cx="17" cy="10" r="1.5"/>'),
      batDesa: ic('<path d="M4 7l5-3 6 3 5-2v12l-5 2-6-3-5 3z"/><path d="M9 4v13M15 7v13"/>'),
      batKec: ic('<path d="M3 5h18v14H3z"/><path d="M3 12h18M12 5v14"/>'),
      draw: ic('<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>'),
      batCfg: ic('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'),
      blkOn: ic('<path d="M3 4h8v8H3zM13 4h8v5h-8zM13 11h8v9h-8zM3 14h8v6H3z"/>'),
      rowOn: ic('<path d="M5 4l-2 16M10 4L8 20M15 4l-2 16M20 4l-2 16"/>'),
      detect: ic('<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 8h8v8H8z"/>'),
      dataGo: ic('<path d="M5 5h14M5 12h14M5 19h14"/>')
    };
    function tile(id, label, st, badge) { return '<button type="button" class="tile' + (st ? ' st' : '') + '" data-t="' + id + '">' + IC[id] + '<span>' + label + '</span>' + (badge ? '<i class="tbd" id="bd_' + id + '"></i>' : '') + '</button>'; }
    panel.innerHTML = '<div class="tt">LAPISAN</div><div class="tgrid">' + tile('contour', 'Kontur', 1) + tile('slopeLayer', 'Lereng', 1) + tile('hach', 'Arsiran', 1) + tile('v3d', '3D', 1) + tile('slopeTap', 'Info lereng', 1) + tile('prof', 'Profil', 1) + '</div>' +
      '<div class="tseg" id="tHk"><button type="button" data-k="down">Arah turun</button><button type="button" data-k="row">Searah kontur</button></div>' +
      '<div class="tseg" id="tHs"><button type="button" data-s="detail">Detail</button><button type="button" data-s="umum">Umum</button></div>' +
      '<div class="tt" style="margin-top:6px">SUMBER DATA</div><div class="tgrid">' + tile('useNas', 'DEMNAS', 1) + tile('useFree', 'DEM gratis', 1) + '</div><div class="tnote" id="tNasSub"></div>' +
      '<div class="tt">TAMPIL</div><div class="tgrid">' + tile('blkOn', 'Blok', 1, 1) + tile('rowOn', 'Arah row', 1) + tile('lakesOn', 'Danau', 1, 1) + tile('shpOn', 'Gambar', 1, 1) + tile('batDesa', 'Desa', 1) + tile('batKec', 'Kecamatan', 1) + '</div>' +
      '<div class="tseg" id="tRm"><button type="button" data-m="datar">Datar</button><button type="button" data-m="kontur">Kontur</button></div>' +
      '<div class="tt">ALAT</div><div class="tgrid">' + tile('draw', 'Gambar baru') + tile('detect', 'Impor blok') + tile('batCfg', 'Atur batas') + tile('dataGo', 'Data peta') + '</div>';
    function state(id) {
      return id === 'contour' ? !!S.settings.contour : id === 'slopeLayer' ? !!S.settings.slopeLayer : id === 'hach' ? !!S.settings.hach : id === 'slopeTap' ? !!m._slopeOn :
        id === 'blkOn' ? S.settings.blkOn !== false : id === 'rowOn' ? !!S.settings.rowOn : id === 'shpOn' ? S.settings.shapesOn !== false : id === 'batDesa' ? !!(S.settings.bat && S.settings.bat.desa) : id === 'batKec' ? !!(S.settings.bat && S.settings.bat.kec) : id === 'v3d' ? HA.V3.on : id === 'useNas' ? S.settings.useNas !== false : id === 'useFree' ? S.settings.useFree !== false : id === 'lakesOn' ? S.settings.lakesOn !== false : !!S.profOpen;
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
    panel.onclick = function (e) {
      var k = e.target.closest && e.target.closest('#tHk button');
      if (k) { S.settings.hachKind = k.getAttribute('data-k'); saveSettings(); if (!S.settings.hach) setHach(true); else if (HA.DM.hach) HA.DM.hach.redraw(); sync(); return; }
      var rm = e.target.closest && e.target.closest('#tRm button');
      if (rm) { S.settings.rowMode = rm.getAttribute('data-m'); saveSettings(); drawRows(); sync(); return; }
      var sm = e.target.closest && e.target.closest('#tHs button');
      if (sm) { S.settings.hachSmooth = sm.getAttribute('data-s'); saveSettings(); if (!S.settings.hach) setHach(true); else if (HA.DM.hach) HA.DM.hach.redraw(); sync(); return; }
      var b = e.target.closest && e.target.closest('.tsw, .tbtn, .tile'); if (!b) return;
      var id = b.getAttribute('data-t');
      if (id === 'draw') { closeP(); drawStart(); return; }
      if (id === 'detect') { closeP(); S.dpTab = 'blok'; go('data'); return; }
      if (id === 'blkOn') { S.settings.blkOn = S.settings.blkOn === false; saveSettings(); if (S.settings.blkOn === false) closeBlockPop(); drawBlocks(); sync(); return; }
      if (id === 'rowOn') { S.settings.rowOn = !S.settings.rowOn; saveSettings(); drawRows(true); sync(); return; }
      if (id === 'dataGo') { closeP(); go('data'); return; }
      if (id === 'lakes') { closeP(); openLakes(); return; }
      if (id === 'shapes') { closeP(); openShapes(); return; }
      if (id === 'shpOn') { S.settings.shapesOn = S.settings.shapesOn === false; saveSettings(); applyShapes(); sync(); return; }
      if (id === 'batCfg') { closeP(); openBat(); return; }
      if (id === 'batDesa' || id === 'batKec') { var bb = batSet(); bb[id === 'batDesa' ? 'desa' : 'kec'] = !bb[id === 'batDesa' ? 'desa' : 'kec']; saveSettings(); batRedraw(); sync(); return; }
      if (id === 'contour') setContour(!S.settings.contour);
      else if (id === 'slopeLayer') setSlopeLayer(!S.settings.slopeLayer);
      else if (id === 'hach') setHach(!S.settings.hach);
      else if (id === 'v3d') {
        if (S.settings.mapMode !== 'osm') { toast('3D hanya tersedia di mode Peta (bukan Satelit)'); return; }
        if (HA.V3.on) close3d(); else open3d();
      }
      else if (id === 'useNas') setSource('nas', S.settings.useNas === false);
      else if (id === 'useFree') setSource('free', S.settings.useFree === false);
      else if (id === 'lakesOn') { S.settings.lakesOn = S.settings.lakesOn === false; saveSettings(); applyLakes(); demRedraw(); }
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
        b.onclick = function () { var open = panel.style.display === 'none'; panel.style.display = open ? 'block' : 'none'; b.classList.toggle('open', open); sync(); };
        HA.DM.main = b; closeP = function () { panel.style.display = 'none'; b.classList.remove('open'); }; HA.DM.closePanel = closeP; return b;
      }
    });
    new Ctl().addTo(m);
    // tombol lama dipertahankan sebagai penampung status (tidak tampil)
    HA.DM.btnL = document.createElement('button'); HA.DM.btnS = document.createElement('button'); HA.DM.btnK = document.createElement('button'); HA.DM.btnP = document.createElement('button');
    if (window.HzBatas && !HA.DM.bat) HA.DM.bat = HzBatas.attach(m, batCfg, toast);
    zoomInd(m);
    if (window.HzDem) HzDem.setSources(S.settings.useNas !== false, S.settings.useFree !== false);
    applyLakes(); drawShapes(); drawBlocks(); drawRows();
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
