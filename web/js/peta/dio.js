/* HZ Trip v0.27.32 - tema 2.5D (pastel claymation): warna blok menurut umur, blok membulat, bendera kategori,
 * papan tanda titik, label kartun. Aktif bila HA.reliefOn() (Lapisan > 2.5D). Hanya tampilan; data tidak berubah. */
(function () {
  'use strict';
  var HA = window.HzApp; if (!HA || !HA.ok || typeof L === 'undefined') return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hx(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { var A = hx(a), B = hx(b), o = A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }); return '#' + o.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  var SOIL = '#B98F63', SAND = '#E3D6B8', G_LO = '#B9E08C', G_HI = '#2F6B2E', OLD = '#7A7340', STRIPE = '#A9C98A';
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
  HA.dioLabel = function (b) { return '<b>' + esc(String(b.name).slice(0, 6)) + '</b><small>' + esc(luasTxt(b)) + '</small>'; };
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
