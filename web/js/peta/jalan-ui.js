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
  function fmt(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }
  function ends(ln) { var m = +ln.w || 2; return [+ln.wa > 0 ? +ln.wa : m, +ln.wb > 0 ? +ln.wb : m]; }
  // cincin poligon (lat,lng) untuk garis yang melebar/menyempit dari ujung A ke ujung B
  function taperRing(ln) {
    var e = ends(ln), P = ln.pts, k = Math.cos(P[0][0] * Math.PI / 180) * 111320, i, cum = [0], n = P.length, L1 = [], R1 = [];
    var xy = P.map(function (p) { return [p[1] * k, p[0] * 111320]; });
    for (i = 0; i + 1 < n; i++) cum.push(cum[i] + Math.hypot(xy[i + 1][0] - xy[i][0], xy[i + 1][1] - xy[i][1]));
    var tot = cum[n - 1] || 1;
    for (i = 0; i < n; i++) {
      var a = xy[Math.max(0, i - 1)], b = xy[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, h = (e[0] + (e[1] - e[0]) * cum[i] / tot) / 2;
      L1.push([(xy[i][1] + ny * h) / 111320, (xy[i][0] + nx * h) / k]); R1.push([(xy[i][1] - ny * h) / 111320, (xy[i][0] - nx * h) / k]);
    }
    return L1.concat(R1.reverse());
  }
  function changed() {
    HA.CUTM = {}; saveSettings();
    if (HA.RC) { HA.RC.rows = {}; HA.RC.dep = {}; }
    if (HA.drawRows) HA.drawRows(true);
    if (HA.map && !HA.map._lineEd) drawLines();
  }

  var layer = null, zbound = false, pop = null;
  function closeLinePop() { if (pop && HA.map) { try { HA.map.closePopup(pop); } catch (e) {} } pop = null; }
  function drawLines() {
    if (!HA.map) return;
    if (layer) { HA.map.removeLayer(layer); layer = null; }
    if (!zbound) { zbound = true; HA.map.on('zoomend', function () { if (!HA.map._lineEd) drawLines(); }); }
    if (!lines().length || HA.map._lineEd || HA.map.getZoom() < 15) return;
    var showRoad = S.settings.linesOn !== false, showDrain = S.settings.lakesOn !== false;
    if (!showRoad && !showDrain) return;
    var g = L.layerGroup();
    lines().forEach(function (ln) {
      if (!ln.pts || ln.pts.length < 2) return;
      if (ln.type === 'drain' ? !showDrain : !showRoad) return;
      var ee = ends(ln), tp = Math.abs(ee[0] - ee[1]) > 0.05;
      if (tp) { L.polygon(taperRing(ln), { stroke: false, fillColor: colorOf(ln), fillOpacity: kontur() && ln.type === 'drain' ? .8 : .7, interactive: false }).addTo(g); L.polyline(ln.pts, { color: colorOf(ln), weight: 1.5, opacity: .9, interactive: false }).addTo(g); }
      else L.polyline(ln.pts, { color: colorOf(ln), weight: wpx(+ln.w || 2), opacity: kontur() && ln.type === 'drain' ? .8 : .7, lineCap: 'butt', lineJoin: 'round', interactive: false }).addTo(g);
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
    var d = document.createElement('div'), sel = null;
    function circ(k, lab, v) { return '<button type="button" class="lwc" data-k="' + k + '" style="width:3.4rem;height:3.4rem;border-radius:50%;border:1px solid var(--line);background:none;color:inherit;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;cursor:pointer"><small style="opacity:.7">' + lab + '</small><b>' + fmt(v) + '</b></button>'; }
    function render() {
      var e = ends(ln);
      d.innerHTML = '<div style="font-weight:600;margin-bottom:6px">' + NAME[ln.type] + ' · ' + Math.round(lenM(ln.pts)) + ' m</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:6px">' + circ('a', 'A', e[0]) + circ('t', 'Tengah', (e[0] + e[1]) / 2) + circ('b', 'B', e[1]) + '</div>' +
        '<div class="muted" style="font-size:.75rem;text-align:center;margin-bottom:6px">Lebar (m). A = titik 1, B = titik 2. Ketuk lingkaran untuk mengubah.</div>' +
        '<label class="lew" id="lwL" style="margin-bottom:8px;display:' + (sel ? '' : 'none') + '"><span id="lwT"></span> <input type="number" inputmode="decimal" step="0.1" min="0.5" max="30"> m</label>' +
        '<div style="display:flex;gap:6px"><button type="button" class="lpb" data-k="e">Edit</button><button type="button" class="lpb dng" data-k="d">Hapus</button></div>';
      d.querySelectorAll('.lwc').forEach(function (b) {
        if (b.getAttribute('data-k') === sel) { b.style.borderColor = '#4DA3FF'; b.style.borderWidth = '2px'; }
        b.onclick = function (ev) { ev.stopPropagation(); sel = b.getAttribute('data-k'); render(); var i = d.querySelector('input'); if (i) i.focus(); };
      });
      var inp = d.querySelector('input');
      if (sel) {
        var cur = sel === 'a' ? e[0] : sel === 'b' ? e[1] : (e[0] + e[1]) / 2;
        d.querySelector('#lwT').textContent = sel === 'a' ? 'Lebar A' : sel === 'b' ? 'Lebar B' : 'Lebar semua (Tengah)'; inp.value = Math.round(cur * 100) / 100;
        inp.onchange = function () {
          var v = parseFloat(String(inp.value).replace(',', '.'));
          if (!(v >= 0.5 && v <= 30)) { inp.value = cur; return; }
          if (sel === 't') { ln.w = v; delete ln.wa; delete ln.wb; }
          else {
            var a2 = sel === 'a' ? v : e[0], b2 = sel === 'b' ? v : e[1];
            if (Math.abs(a2 - b2) < 0.05) { ln.w = a2; delete ln.wa; delete ln.wb; } else { ln.wa = a2; ln.wb = b2; ln.w = Math.round((a2 + b2) / 2 * 100) / 100; }
          }
          changed(); render();
        };
      }
      d.querySelector('[data-k=e]').onclick = function () { closeLinePop(); lineEdit(ln); };
      d.querySelector('[data-k=d]').onclick = function () {
        closeLinePop();
        askConfirm('Hapus ' + NAME[ln.type].toLowerCase() + ' ini?', 'Row di blok yang dilewati dihitung ulang tanpa garis ini.', 'Hapus', function () { var i = lines().indexOf(ln); if (i >= 0) lines().splice(i, 1); changed(); });
      };
    }
    render();
    pop = L.popup({ closeButton: true, autoPan: false, className: 'linepop', minWidth: 210 }).setLatLng(ll).setContent(d).openOn(HA.map);
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
