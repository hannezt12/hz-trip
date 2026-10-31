/* HZ Trip - lintasan peta, peta mini, tombol lokasi */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, E = HA.E, COL = HA.COL, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function renderHistory() { return HA.renderHistory.apply(this, arguments); }
  function cachedLayerClass() { return HA.cachedLayerClass.apply(this, arguments); }
  function demButtons() { return HA.demButtons.apply(this, arguments); }
  function slopeTap() { return HA.slopeTap.apply(this, arguments); }
  function batRedraw() { return HA.batRedraw.apply(this, arguments); }
  function blocksList() { return HA.blocksList.apply(this, arguments); }
  function blockAt() { return HA.blockAt.apply(this, arguments); }
  function closeBlockPop() { return HA.closeBlockPop.apply(this, arguments); }
  function openBlockPop() { return HA.openBlockPop.apply(this, arguments); }
  function syncOverlays() { return HA.syncOverlays.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.ensureMap = ensureMap;
  HA.zoomInd = zoomInd;
  HA.setBase = setBase;
  HA.setTiles = setTiles;
  HA.drawTrips = drawTrips;
  HA.openMini = openMini;
  HA.refreshMini = refreshMini;
  HA.closeMini = closeMini;
  HA.locStop = locStop;
  HA.locStart = locStart;
  HA.makeLocate = makeLocate;

  // ---------- lintasan (peta) ----------
  HA.map = null;
  var tileLayer = null;
  HA.trackLayer = null;
  HA.fitted = false;
  HA.mapSel = -1;
  HA.mapKeep = false;
  HA.mapKind = 'all';
  HA.TILES = {
    sat: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Esri World Imagery'],
    osm: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; OpenStreetMap']
  };
  function ensureMap() {
    if (HA.map) return true;
    if (!window.L) return false;
    HA.map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([-4.95, 105.2], 14);
    HA.trackLayer = L.layerGroup().addTo(HA.map);
    bindPins(HA.map, function () { return [HA.trackLayer]; });
    setTiles();
    makeLocate(HA.map);
    demButtons(HA.map);
    return true;
  }
  // foto satelit hanya ada sampai zoom tertentu: di atasnya gambar diperbesar (maxNativeZoom), peta tetap bisa di-zoom sampai 22
  function tileOpts(md) { return { maxZoom: 22, maxNativeZoom: md === 'sat' ? (S.settings.satNative || 17) : 19, attribution: HA.TILES[md][1] }; }
  function zoomInd(m) {
    var C = L.Control.extend({ options: { position: 'topleft' }, onAdd: function () {
      var e = L.DomUtil.create('div', 'zind leaflet-control');
      function u() { e.textContent = 'zoom ' + m.getZoom(); }
      m.on('zoomend', u); u(); return e;
    } });
    new C().addTo(m);
  }
  function setBase(m, force) {
    if (!m) return;
    if (m._base) { m.removeLayer(m._base); m._base = null; }
    var md = force || (S.settings.mapMode === 'sat' ? 'sat' : 'osm');
    if (HA.TILES[md]) m._base = new (cachedLayerClass())(HA.TILES[md][0], tileOpts(md)).addTo(m);
  }
  function setTiles() {
    if (!HA.map) return;
    setBase(HA.map);
    syncOverlays(HA.map);
    if (HA.DM.syncMode) HA.DM.syncMode();
    batRedraw();
    document.querySelectorAll('#mapSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-map') === S.settings.mapMode); });
  }
  function gapText(g) { return 'Berhenti ' + T.hm(g.from) + '–' + T.hm(g.to) + ' (' + T.durText((g.to - g.from) / 1000) + ')'; }
  // Ketuk pin: label tampil dengan garis tipis ke pin. Beberapa pin yang berdekatan tampil bersamaan, berurutan menurut jam.
  function bindPins(m, groupFn) {
    var box = document.createElement('div');
    box.className = 'pinbox';
    box.innerHTML = '<svg class="pinsvg"></svg>';
    m.getContainer().appendChild(box);
    var svg = box.firstChild, cur = null;
    function clear() { cur = null; svg.innerHTML = ''; Array.prototype.slice.call(box.querySelectorAll('.pinl')).forEach(function (e) { e.remove(); }); }
    function place() {
      if (!cur) return;
      var sz = m.getSize(), lines = '';
      cur.forEach(function (c) {
        var p = m.latLngToContainerPoint(c.pin.ll), x = p.x + c.dx, y = p.y + c.dy;
        c.el.style.left = x + 'px'; c.el.style.top = y + 'px';
        var ax = c.dx >= 0 ? x : x + c.w, ay = y + c.h / 2;
        if (c.pin.dot) lines += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4"/>';
        lines += '<line x1="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) + '" x2="' + ax.toFixed(1) + '" y2="' + ay.toFixed(1) + '"/>';
      });
      svg.innerHTML = lines;
      svg.setAttribute('width', sz.x); svg.setAttribute('height', sz.y);
    }
    function show(list, at) {
      clear();
      var sz = m.getSize(), cx = 0, cy = 0;
      list.sort(function (p, q) { return p.t - q.t; });
      list.forEach(function (p) { var c = m.latLngToContainerPoint(p.ll); cx += c.x; cy += c.y; });
      cx /= list.length; cy /= list.length;
      var right = cx < sz.x / 2, n = list.length, GAP = 34;
      cur = list.map(function (p, i) {
        var el = document.createElement('div'); el.className = 'pinl';
        el.innerHTML = '<i style="background:' + p.col + '"></i>' + (p.html || esc(p.txt));
        el.onclick = function (e) { e.stopPropagation(); clear(); };
        box.appendChild(el);
        var w = el.offsetWidth, h = el.offsetHeight, pc = m.latLngToContainerPoint(p.ll);
        var ty = cy + (i - (n - 1) / 2) * GAP - h / 2, tx = right ? cx + 52 : cx - 52 - w;
        tx = Math.max(6, Math.min(sz.x - w - 6, tx)); ty = Math.max(6, Math.min(sz.y - h - 6, ty));
        return { el: el, pin: p, w: w, h: h, dx: tx - pc.x, dy: ty - pc.y };
      });
      place();
    }
    m._pinInfo = function (ll, html) { show([{ ll: ll, html: html, txt: '', col: '#4DA3FF', t: 0, dot: true }]); };
    m.on('click', function (e) {
      if (m._lakeDraw) { m._lakeDraw.tap(e.latlng); return; }
      if (m._slopeOn) { slopeTap(m, e); return; }
      if (HA.DM.prev || HA.DM.edit) return;
      if (m === HA.map && !HA.PB.open && S.settings.blkOn !== false && blocksList().length) { var bb = blockAt(e.latlng); if (bb) { clear(); openBlockPop(bb); return; } else if (HA.DM.pop) closeBlockPop(); }
      var grp = groupFn(), pins = [];
      (grp || []).forEach(function (g) { (g._pins || []).forEach(function (p) { pins.push(p); }); });
      var near = pins.filter(function (p) { return m.latLngToContainerPoint(p.ll).distanceTo(e.containerPoint) <= 26; });
      if (!near.length) { clear(); return; }
      // buang pin kembar persis (jam dan teks sama)
      var seen = {}; near = near.filter(function (p) { var k = p.txt + '|' + p.ll.join(','); if (seen[k]) return false; seen[k] = 1; return true; });
      show(near);
    });
    m.on('move zoom', place);
    m.on('dragstart zoomstart', function () { /* label ikut peta */ });
    m._pinClear = clear;
  }
  // Gambar trek ke satu peta. faint = trip lain pada hari itu digambar samar sebagai pembanding.
  function drawTrips(group, pts, trips, sel, faint) {
    var bounds = [];
    group._pins = [];
    function dot(lat, lng, col, rad, tip, ts) {
      L.circleMarker([lat, lng], { radius: rad, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1, interactive: false }).addTo(group);
      group._pins.push({ ll: [lat, lng], txt: tip, col: col, t: ts || 0 });
    }
    trips.forEach(function (x, i) {
      var dimmed = sel >= 0 && sel !== i;
      if (dimmed && !faint) return;
      var t = x.t, tk = E.trackOf(pts, t);
      tk.runs.forEach(function (r) {
        var ll = r.pts.map(function (p) { return [p.lat, p.lng]; });
        if (dimmed) L.polyline(ll, { color: '#7C8C94', weight: 3, opacity: 0.55, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(group);
        else { L.polyline(ll, { color: COL[r.z], weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(group); bounds = bounds.concat(ll); }
      });
      if (dimmed) return;
      tk.gaps.forEach(function (g) {
        var la = [g.a.lat, g.a.lng], lb = [g.b.lat, g.b.lng];
        L.polyline([la, lb], { color: COL.s, weight: 4, opacity: 0.95, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(group);
        dot(la[0], la[1], COL.s, 6, gapText(g), g.from);
        dot(lb[0], lb[1], COL.s, 6, gapText(g), g.to);
      });
      dot(t.startLat, t.startLng, '#3FD07A', 7, 'Mulai ' + T.hm(t.start), t.start);
      dot(t.endLat, t.endLng, '#FF5B50', 7, 'Selesai ' + T.hm(t.end), t.end);
      dot(t.maxLat, t.maxLng, '#F5C518', 8, 'Tercepat ' + Math.round(t.max) + ' km/j (' + T.hm(t.maxT) + ')', t.maxT);
    });
    return bounds;
  }

  // ---------- peta mini di Riwayat (hanya lihat) ----------
  HA.mini = null;
  function openMini(i) {
    if (!window.L) { toast('Peta tidak tersedia'); return; }
    S.mini = { day: S.hDay, i: i, key: '' };
    $('miniWrap').style.display = 'block';
    if (!HA.mini) {
      HA.mini = L.map('miniMap', { zoomControl: false, preferCanvas: true, attributionControl: false }).setView([-4.95, 105.2], 14);
      setTimeout(function () { if (HA.mini && HA.mini._tr) bindPins(HA.mini, function () { return [HA.mini._tr]; }); }, 0);
      HA.mini._tr = L.layerGroup().addTo(HA.mini);
    }
    HA.mini.invalidateSize();
    setBase(HA.mini);
    syncOverlays(HA.mini);
    renderHistory();
    setTimeout(function () {
      var m = $('main'), w = $('miniWrap');
      m.scrollTop += w.getBoundingClientRect().top - m.getBoundingClientRect().top - 4;
      if (HA.mini) HA.mini.invalidateSize();
    }, 40);
  }
  function refreshMini() {
    if (!S.mini) return;
    if (!HA.mini || S.mini.day !== S.hDay || S.mini.i >= S.hTrips.length) { closeMini(true); return; }
    var x = S.hTrips[S.mini.i], t = x.t, key = t.start + '-' + t.end;
    HA.mini._tr.clearLayers();
    var b = drawTrips(HA.mini._tr, S.hPts || [], S.hTrips, S.mini.i, true);
    $('miniT').textContent = 'Trip ' + (S.mini.i + 1) + ' · ' + T.hm(t.start) + '–' + T.hm(t.end) + ' · ' + T.km1(t.km) + ' km';
    if (b.length && S.mini.key !== key) { S.mini.key = key; HA.mini.invalidateSize(); HA.mini.fitBounds(b, { padding: [28, 28], maxZoom: 18 }); }
  }
  function closeMini(noRender) {
    var was = !!S.mini;
    S.mini = null;
    $('miniWrap').style.display = 'none';
    if (HA.mini) { try { HA.mini.remove(); } catch (e) {} HA.mini = null; }
    if (was && !noRender) renderHistory();
  }

  // ---------- tombol lokasi saya (tropong) ----------
  var LOC_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>';
  function locStop(m) {
    var st = m && m._loc; if (!st) return;
    if (st.id !== null) { try { navigator.geolocation.clearWatch(st.id); } catch (e) {} st.id = null; }
    if (st.dot) { m.removeLayer(st.dot); st.dot = null; }
    if (st.acc) { m.removeLayer(st.acc); st.acc = null; }
    st.follow = false; st.pos = null; if (st.btn) st.btn.classList.remove('on');
  }
  function locStart(m) {
    var st = m && m._loc; if (!st || st.id !== null) return;
    if (!navigator.geolocation) { toast('Lokasi tidak tersedia di perangkat ini'); return; }
    st.id = navigator.geolocation.watchPosition(function (p) {
      if (!m._container) return;
      var ll = [p.coords.latitude, p.coords.longitude], first = !st.pos;
      st.pos = ll;
      if (!st.acc) st.acc = L.circle(ll, { radius: p.coords.accuracy || 20, color: '#4DA3FF', weight: 1, fillColor: '#4DA3FF', fillOpacity: 0.15, interactive: false }).addTo(m);
      else { st.acc.setLatLng(ll); st.acc.setRadius(p.coords.accuracy || 20); }
      if (!st.dot) st.dot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#4285F4', fillOpacity: 1, interactive: false, className: 'locdot' }).addTo(m);
      else st.dot.setLatLng(ll);
      if (st.want) { st.want = false; st.follow = true; if (st.btn) st.btn.classList.add('on'); m.setView(ll, Math.max(m.getZoom(), 17)); }
      else if (st.follow) m.panTo(ll, { animate: true });
    }, function (e) {
      if (st.want) { st.want = false; toast(e && e.code === 1 ? 'Izin lokasi belum diberikan' : 'Lokasi belum didapat. Pastikan GPS menyala.'); }
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
  }
  function makeLocate(m) {
    if (m._loc) return;
    var st = m._loc = { id: null, dot: null, acc: null, pos: null, follow: false, want: false, btn: null };
    var Ctl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        var b = L.DomUtil.create('button', 'locbtn leaflet-control');
        b.type = 'button'; b.setAttribute('aria-label', 'Posisi saya'); b.innerHTML = LOC_SVG;
        L.DomEvent.disableClickPropagation(b);
        b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        b.onclick = function () {
          if (st.id === null) locStart(m);
          if (st.pos) { st.follow = true; b.classList.add('on'); m.setView(st.pos, Math.max(m.getZoom(), 17)); }
          else { st.want = true; toast('Mencari posisi…'); }
        };
        st.btn = b;
        return b;
      }
    });
    new Ctl().addTo(m);
    m.on('dragstart', function () { st.follow = false; if (st.btn) st.btn.classList.remove('on'); });
    m.on('unload', function () { locStop(m); });
    locStart(m);
  }
})();
