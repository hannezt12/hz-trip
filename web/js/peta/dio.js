/* HZ Trip v0.27.32 - tema 2.5D (pastel claymation): warna blok menurut umur, blok membulat, bendera kategori,
 * papan tanda titik, label kartun. Aktif bila HA.reliefOn() (Lapisan > 2.5D). Hanya tampilan; data tidak berubah. */
(function () {
  'use strict';
  var HA = window.HzApp; if (!HA || !HA.ok || typeof L === 'undefined') return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hx(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { var A = hx(a), B = hx(b), o = A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }); return '#' + o.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  var SOIL = '#B98F63', SAND = '#E3D6B8', G_LO = '#B9E08C', G_HI = '#2F6B2E', OLD = '#7A7340', STRIPE = '#A9C98A';
  // hamparan kosong kartun: rumpun rumput kecil di tempat yang belum ada poligon (letak tetap menurut koordinat)
  function hash(a, b) { var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function pip(lat, lng, pts) {
    var ins = false, i, j;
    for (i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][0] > lat) !== (pts[j][0] > lat) && lng < (pts[j][1] - pts[i][1]) * (lat - pts[i][0]) / (pts[j][0] - pts[i][0]) + pts[i][1]) ins = !ins;
    return ins;
  }
  function covered(lat, lng) {
    var polys = (HA.blocksList ? HA.blocksList() : []).concat(HA.lakesList ? HA.lakesList() : []), k, p;
    for (k = 0; k < polys.length; k++) {
      p = polys[k].pts; if (!p || p.length < 3) continue;
      var s = 90, n = -90, w = 180, e = -180, i;
      for (i = 0; i < p.length; i++) { if (p[i][0] < s) s = p[i][0]; if (p[i][0] > n) n = p[i][0]; if (p[i][1] < w) w = p[i][1]; if (p[i][1] > e) e = p[i][1]; }
      if (lat < s - 0.00008 || lat > n + 0.00008 || lng < w - 0.00008 || lng > e + 0.00008) continue;
      if (pip(lat, lng, p)) return true;
    }
    return false;
  }
  HA.dioGround = function () {
    var G = L.GridLayer.extend({
      createTile: function (c) {
        var t = L.DomUtil.create('canvas', 'leaflet-tile'), sz = this.getTileSize(), m = this._map, z = c.z, ctx;
        t.width = sz.x; t.height = sz.y;
        if (z < 15) return t;
        ctx = t.getContext('2d');
        var nw = m.unproject(L.point(c.x * sz.x, c.y * sz.y), z), se = m.unproject(L.point((c.x + 1) * sz.x, (c.y + 1) * sz.y), z), STEP = 0.00042, la0 = Math.floor(se.lat / STEP) - 1, la1 = Math.ceil(nw.lat / STEP) + 1, lo0 = Math.floor(nw.lng / STEP) - 1, lo1 = Math.ceil(se.lng / STEP) + 1, i, j;
        for (j = la0; j <= la1; j++) for (i = lo0; i <= lo1; i++) {
          if (hash(i, j) < 0.35) continue;
          var lat = (j + hash(i + 7, j + 3)) * STEP, lng = (i + hash(i + 11, j + 5)) * STEP;
          if (covered(lat, lng)) continue;
          var pt = m.project(L.latLng(lat, lng), z), x = pt.x - c.x * sz.x, y = pt.y - c.y * sz.y, s = 0.8 + hash(i + 2, j + 9) * 0.5;
          if (x < -20 || y < -20 || x > sz.x + 20 || y > sz.y + 20) continue;
          ctx.lineCap = 'round'; ctx.lineWidth = 2.6 * s; ctx.strokeStyle = '#9FBF73';
          ctx.beginPath(); ctx.moveTo(x - 5 * s, y + 3 * s); ctx.lineTo(x - 7 * s, y - 5 * s); ctx.moveTo(x, y + 3 * s); ctx.lineTo(x, y - 8 * s); ctx.moveTo(x + 5 * s, y + 3 * s); ctx.lineTo(x + 7 * s, y - 5 * s); ctx.stroke();
          ctx.lineWidth = 2.2 * s; ctx.strokeStyle = '#C6DB9A'; ctx.beginPath(); ctx.moveTo(x, y + 3 * s); ctx.lineTo(x - 2 * s, y - 4 * s); ctx.stroke();
        }
        return t;
      }
    });
    return new G({ tileSize: 256, updateWhenIdle: true, keepBuffer: 4 });
  };
  var gSig = '';
  HA.dioGroundRefresh = function () {
    var m = HA.map; if (!m || !m._relief || !m._relief.redraw) return;
    var sg = (HA.blocksList ? HA.blocksList() : []).concat(HA.lakesList ? HA.lakesList() : []).reduce(function (s, o) { return s + (o.pts ? o.pts.length + o.pts[0][0] * 1000 + o.pts[0][1] : 0); }, 0).toFixed(5);
    if (sg !== gSig) { gSig = sg; m._relief.redraw(); }
  };
  HA.dioOn = function () { return !!(HA.reliefOn && HA.reliefOn()); };
  // jenis tampilan blok: soil (kosong), young (1-2 bln, tanah + garis hijau pudar), grow, old, none
  function kind(b) {
    var m = HA.lyb && HA.lyb.umurM ? HA.lyb.umurM(b) : -1;
    if (m < 0) return b && b.cy ? { k: 'soil', fill: SOIL } : { k: 'none', fill: SAND };
    if (m <= 2) return { k: 'young', fill: SOIL };
    if (m >= 13) return { k: 'old', fill: OLD };
    return { k: 'grow', fill: mix(G_LO, G_HI, (Math.min(12, Math.max(3, m)) - 3) / 9) };
  }
  HA.dioKind = kind;
  HA.dioRowOk = function (b) { var k = kind(b).k; return k === 'grow' || k === 'old'; };
  // label: nomor blok (maks 6 karakter) dan luas 3 karakter ("9.0", 10 ha ke atas tanpa desimal)
  function luasTxt(b) { var a = HzBlok.areaHa(b.pts); return a >= 10 ? String(Math.round(a)) : (Math.round(a * 10) / 10).toFixed(1); }
  HA.dioLabel = function (b) { return '<b>' + esc(String(b.name).replace(/\s+/g, '').slice(0, 6)) + '</b><small>' + esc(luasTxt(b)) + '</small>'; };
  // bendera kategori siklus berjalan: satu bendera per kategori, berbaris di tepi atas (terjauh dari pembaca), tumpuk maks 50%
  function flagSvg(col) {
    return '<svg width="20" height="26" viewBox="0 0 20 26"><path d="M4 24V3" stroke="#5b4630" stroke-width="2.4" stroke-linecap="round"/><path d="M4.6 3.6c4-2 7 2 11 .2v8c-4 1.8-7-2-11-.2z" fill="' + col + '" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }
  function flags(g, b) {
    if (!HA.BT || !HA.BT.itemsOf || !HA.tandaCatInfo) return;
    var seen = {}, cols = [];
    HA.BT.itemsOf(b).slice().sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); }).forEach(function (it) {
      if (it.t !== 'pg' || !it.cat || seen[it.cat]) return; seen[it.cat] = 1; var inf = HA.tandaCatInfo(it); if (!inf.nocat) cols.push(inf.col);
    });
    if (!cols.length) return;
    var s = 90, n = -90, w = 180, e = -180, i;
    b.pts.forEach(function (p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; });
    var y = n - (n - s) * 0.16, xs = [];
    for (i = 0; i < b.pts.length; i++) {
      var a = b.pts[i], c = b.pts[(i + 1) % b.pts.length];
      if ((a[0] - y) * (c[0] - y) < 0) xs.push(a[1] + (y - a[0]) / (c[0] - a[0]) * (c[1] - a[1]));
    }
    if (xs.length < 2) return;
    xs.sort(function (p, q) { return p - q; });
    var x = (xs[0] + xs[xs.length - 1]) / 2 + (xs[xs.length - 1] - xs[0]) * 0.12;
    var html = '<div class="dioFl">' + cols.slice(0, 8).map(function (c2) { return '<span>' + flagSvg(c2) + '</span>'; }).join('') + '</div>';
    L.marker([y, x], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'dioFlW', html: html, iconSize: [0, 0] }) }).addTo(g);
  }
  // satu blok: isi menurut umur, tepi tebal membulat, larikan (blok muda), label, bendera
  HA.dioBlock = function (g, b, withLabel) {
    var kd = kind(b), rim = mix(kd.fill, '#FFFFFF', 0.4);
    var l = L.polygon(b.pts, { color: rim, weight: 7, lineJoin: 'round', lineCap: 'round', fillColor: kd.fill, fillOpacity: 1, interactive: false });
    if (withLabel) l.bindTooltip(HA.dioLabel(b), { permanent: true, direction: 'center', className: 'lktip dio' });
    l.addTo(g);
    if (kd.k === 'young' && HA.addStripes) HA.addStripes(g, b.pts, +b.dir || 0, Math.max(7, (+b.sp || 2) * 4), STRIPE, 3.5, 0.95);
    if (withLabel) flags(g, b);
  };
  // papan penunjuk jalan untuk tanda titik (tiang di titik asli, nama maks 8 karakter)
  HA.dioSign = function (it, col, interactive) {
    var nm = String(it.name || '').slice(0, 8);
    var html = '<div class="dioSg"><i style="background:' + esc(col || '#E0627C') + '"></i><span>' + esc(nm) + '</span><b></b></div>';
    return L.marker(it.pts[0], { interactive: interactive !== false, keyboard: false, icon: L.divIcon({ className: 'dioSgW', html: html, iconSize: [0, 0] }) });
  };
})();
