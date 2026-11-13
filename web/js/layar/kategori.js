/* HZ Trip v0.16.0 - mode Kategori di Lintasan: tombol Satelit/Peta dan Lintasan/Kategori, tanda per tanggal (Harian) atau per rentang. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function $() { return HA.$.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  var KM = HA.KM = { mode: 'lintasan', range: false, from: '', to: '', lay: null };
  function map() { return HA.map; }
  function items() { try { return HA.tandaData().items || []; } catch (e) { return []; } }
  function dateOf(it) { return HA.tandaU.dateOf(it); }
  function visible() {
    return items().filter(function (it) {
      var d = dateOf(it);
      return KM.range ? ((!KM.from || d >= KM.from) && (!KM.to || d <= KM.to)) : d === S.mapDay;
    });
  }
  function opOf(it) { var v = it.op; return (typeof v === 'number' && v >= 0.05 && v <= 0.95) ? v : 0.35; }
  function draw() {
    var m = map(); if (!m) return;
    if (KM.lay) { try { m.removeLayer(KM.lay); } catch (e) {} KM.lay = null; }
    if (KM.mode !== 'kategori') return;
    var list = visible(), g = KM.lay = L.layerGroup().addTo(m);
    list.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); }).forEach(function (it) {
      var col = HA.tandaColOf(it);
      if (it.t === 'pt') L.circleMarker(it.pts[0], { radius: 8, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1, interactive: false }).addTo(g);
      else if (it.t === 'ln') L.polyline(it.pts, { color: col, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g);
      else L.polygon(it.pts, { color: col, weight: 2.5, fillColor: col, fillOpacity: opOf(it), interactive: false }).addTo(g);
    });
    var n = list.length;
    $('katInfo').textContent = n ? n + ' tanda' + (KM.range ? '' : ' pada tanggal ini') : (KM.range ? 'Tidak ada tanda pada rentang ini.' : 'Belum ada tanda pada tanggal ini.');
  }
  function syncUi() {
    var kat = KM.mode === 'kategori', v = $('v-lintasan');
    v.classList.toggle('kat', kat);
    $('katBar').style.display = kat ? 'block' : 'none';
    $('katRng').style.display = kat && KM.range ? 'flex' : 'none';
    v.classList.toggle('katR', kat && KM.range);
    $('mapMode').textContent = kat ? 'Kategori' : 'Lintasan';
    Array.prototype.forEach.call($('katSeg').children, function (b) { b.classList.toggle('on', (b.getAttribute('data-r') === '1') === KM.range); });
    $('katFrom').value = KM.from; $('katTo').value = KM.to;
    $('katFrom').max = $('katTo').max = S.today;
  }
  function setMode(m, quiet) {
    if (m === KM.mode) return;
    var map_ = map();
    KM.mode = m;
    if (m === 'kategori') {
      if (HA.PB && HA.PB.open && HA.pbClose) HA.pbClose();
      if (map_ && HA.trackLayer) map_.removeLayer(HA.trackLayer);
      if (map_ && map_._pinClear) map_._pinClear();
      if (!KM.from) { var d = new Date(); d.setDate(d.getDate() - 30); KM.from = iso(d); KM.to = S.today; }
    } else if (map_ && HA.trackLayer) map_.addLayer(HA.trackLayer);
    syncUi(); draw();
    if (!quiet) toast(m === 'kategori' ? 'Mode Kategori: tanda tampil per tanggal' : 'Mode Lintasan');
  }
  KM.setMode = setMode; KM.sync = function () { if (KM.mode === 'kategori') { syncUi(); draw(); } };
  // dipanggil setelah tanda baru disimpan: tampilkan tanggalnya di mode Kategori
  KM.show = function (date) {
    if (date) { S.mapDay = date; KM.range = false; if (HA.renderMap) HA.renderMap(false); }
    if (KM.mode !== 'kategori') setMode('kategori', true); else { syncUi(); draw(); }
  };
  KM.toggleBase = function () {
    S.settings.mapMode = S.settings.mapMode === 'sat' ? 'osm' : 'sat';
    HA.saveSettings && HA.saveSettings();
    HA.setTiles(); if (HA.mini) { HA.setBase(HA.mini); HA.syncOverlays(HA.mini); }
    toast(S.settings.mapMode === 'sat' ? 'Mode Satelit' : 'Mode Peta');
  };
  function wire() {
    if (!$('mapMode')) return;
    $('mapBase').onclick = KM.toggleBase;
    $('mapMode').onclick = function () { setMode(KM.mode === 'kategori' ? 'lintasan' : 'kategori'); };
    $('katSeg').onclick = function (e) {
      var r = e.target.getAttribute && e.target.getAttribute('data-r'); if (r === null || r === undefined) return;
      KM.range = r === '1'; syncUi(); draw();
    };
    $('katFrom').onchange = function () { KM.from = this.value; if (KM.to && KM.from > KM.to) KM.to = KM.from; syncUi(); draw(); };
    $('katTo').onchange = function () { KM.to = this.value; if (KM.from && KM.to < KM.from) KM.from = KM.to; syncUi(); draw(); };
    // Putar hanya untuk lintasan: menekannya di mode Kategori kembali ke mode Lintasan
    var po = HA.pbOpen;
    HA.pbOpen = function () { if (KM.mode === 'kategori') setMode('lintasan', true); return po.apply(this, arguments); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
