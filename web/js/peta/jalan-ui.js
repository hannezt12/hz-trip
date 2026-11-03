/* HZ Trip - jalan bantu dan drainase: garis global yang memotong row. Tanpa daftar; diatur dengan mengetuk garis di peta. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function $() { return HA.$.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function lines() { return S.settings.lines || (S.settings.lines = []); }
  HA.linesList = lines;
  HA.drawLines = drawLines;
  HA.lineEdit = lineEdit;
  HA.lineChanged = changed;
  HA.closeLinePop = closeLinePop;
  var NAME = { road: 'Jalan bantu', drain: 'Drainase' };
  function lenM(pts) { var t = 0, i; for (i = 0; i + 1 < pts.length; i++) t += HA.segM(pts[i], pts[i + 1]); return t; }
  function kontur() { return S.settings.rowMode === 'kontur'; }
  function colorOf(ln) { return ln.type === 'drain' ? (kontur() ? '#5EE0FF' : '#6F8296') : '#C2AD83'; }
  function mpp() { var z = HA.map.getZoom(), la = HA.map.getCenter().lat; return 156543.03 * Math.cos(la * Math.PI / 180) / Math.pow(2, z); }
  function wpx(w) { return Math.max(2, w / mpp()); }
  function changed() {
    HA.CUTM = {}; saveSettings();
    if (HA.RC) { HA.RC.rows = {}; HA.RC.dep = {}; }
    if (HA.drawRows) HA.drawRows(true);
  }

  var layer = null, zbound = false, pop = null;
  function closeLinePop() { if (pop && HA.map) { try { HA.map.closePopup(pop); } catch (e) {} } pop = null; }
  function drawLines() {
    if (!HA.map) return;
    if (layer) { HA.map.removeLayer(layer); layer = null; }
    if (!zbound) { zbound = true; HA.map.on('zoomend', function () { if (!HA.map._lineEd) drawLines(); }); }
    if (S.settings.linesOn === false || !lines().length || HA.map._lineEd) return;
    var g = L.layerGroup();
    lines().forEach(function (ln) {
      if (!ln.pts || ln.pts.length < 2) return;
      L.polyline(ln.pts, { color: colorOf(ln), weight: wpx(+ln.w || 2), opacity: kontur() && ln.type === 'drain' ? .8 : .7, lineCap: 'butt', lineJoin: 'round', interactive: false }).addTo(g);
      // area ketuk lebar (sekitar satu jari), garis dipilih lebih dulu daripada blok di bawahnya
      var hit = L.polyline(ln.pts, { color: '#000', weight: Math.max(wpx(+ln.w || 2), 30), opacity: 0, lineCap: 'round', bubblingMouseEvents: false, interactive: true }).addTo(g);
      hit.on('click', function (e) {
        L.DomEvent.stop(e);
        if (HA.map._lakeDraw || HA.DM.edit || HA.DM.pdir) { HA.map.fire('click', { latlng: e.latlng, layerPoint: e.layerPoint, containerPoint: e.containerPoint, originalEvent: e.originalEvent }); return; }
        linePop(ln, e.latlng);
      });
    });
    g.addTo(HA.map); layer = g;
  }

  function linePop(ln, ll) {
    HA.closeAll();
    var d = document.createElement('div');
    d.innerHTML = '<div style="font-weight:600;margin-bottom:6px">' + NAME[ln.type] + ' · ' + Math.round(lenM(ln.pts)) + ' m</div>' +
      '<label class="lew" style="margin-bottom:8px">Lebar <input type="number" inputmode="decimal" step="0.1" min="0.5" max="30" value="' + ln.w + '"> m</label>' +
      '<div style="display:flex;gap:6px"><button type="button" class="lpb" data-k="e">Edit</button><button type="button" class="lpb dng" data-k="d">Hapus</button></div>';
    var inp = d.querySelector('input');
    inp.onchange = function () { var v = parseFloat(String(inp.value).replace(',', '.')); if (v >= 0.5 && v <= 30) { ln.w = v; changed(); } else inp.value = ln.w; };
    d.querySelector('[data-k=e]').onclick = function () { closeLinePop(); lineEdit(ln); };
    d.querySelector('[data-k=d]').onclick = function () {
      closeLinePop();
      askConfirm('Hapus ' + NAME[ln.type].toLowerCase() + ' ini?', 'Row di blok yang dilewati dihitung ulang tanpa garis ini.', 'Hapus', function () { var i = lines().indexOf(ln); if (i >= 0) lines().splice(i, 1); changed(); });
    };
    pop = L.popup({ closeButton: true, autoPan: false, className: 'linepop', minWidth: 170 }).setLatLng(ll).setContent(d).openOn(HA.map);
  }

  // editor: hanya 2 titik
  function lineEdit(ln) {
    if (!HA.map) return;
    HA.closeAll();
    var P = [ln.pts[0].slice(), ln.pts[ln.pts.length - 1].slice()], g = L.layerGroup().addTo(HA.map), pl = null, bar = document.createElement('div'), mk = [];
    HA.map._lineEd = true; if (layer) { HA.map.removeLayer(layer); layer = null; }
    HA.map._lakeDraw = { tap: function () {} };
    bar.className = 'lkbar bot';
    bar.innerHTML = '<span id="leT"></span><button type="button" id="leC">Batal</button><button type="button" class="pri" id="leOk">Simpan</button>';
    HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar);
    function icon(n) { return L.divIcon({ className: '', html: '<div class="tpm"><b>' + n + '</b><div class="d"></div><div class="h"></div></div>', iconSize: [56, 80], iconAnchor: [28, 24] }); }
    function upd() {
      if (pl) { g.removeLayer(pl); pl = null; }
      pl = L.polyline(P, { color: colorOf(ln), weight: wpx(+ln.w || 2), opacity: .6, lineCap: 'butt', interactive: false }).addTo(g);
      var len = lenM(P), t = $('leT'); if (t) t.textContent = NAME[ln.type] + ' · ' + Math.round(len) + ' m · geser kedua titik';
      if ($('leOk')) $('leOk').disabled = len < 5;
    }
    P.forEach(function (p, k) {
      var m = L.marker(p, { draggable: true, icon: icon(k + 1), zIndexOffset: 900 }).addTo(g);
      m.on('drag', function (e) { var q = e.target.getLatLng(); P[k] = [q.lat, q.lng]; upd(); });
      mk.push(m);
    });
    function end() { HA.map._lakeDraw = null; HA.map._lineEd = false; HA.map.removeLayer(g); bar.remove(); drawLines(); }
    $('leC').onclick = end;
    $('leOk').onclick = function () { ln.pts = P.map(function (p) { return [+p[0].toFixed(6), +p[1].toFixed(6)]; }); end(); changed(); toast('Tersimpan. Row dihitung ulang'); };
    upd();
  }
})();
