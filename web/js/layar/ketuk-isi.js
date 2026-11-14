/* HZ Trip v0.16.3 - Ketuk isi: ketuk di dalam blok terkonfirmasi = tandai dengan kategori aktif; Tandai blok penuh */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.KM) return;
  var KM = HA.KM, S = HA.S;
  function $(i) { return document.getElementById(i); }
  KM.fillTap = false;
  function fillDate() { return (!KM.range && !KM.all) ? (S.mapDay || S.today) : S.today; }
  function pip(x, y, r) { var ins = false, i, j; for (i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) ins = !ins; } return ins; }
  function area(r) { var a = 0, i, j; for (i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
  // bagian blok yang terpotong jalan bantu / drainase dan berisi titik ketuk; null = seluruh blok
  function pieceAt(b, ll) {
    var cuts = HA.cutsFor ? HA.cutsFor(b) : null; if (!cuts || !cuts.length || typeof polygonClipping === 'undefined') return null;
    var ref = b.pts[0], kx = 111320 * Math.cos(ref[0] * Math.PI / 180), ky = 110540;
    function xy(p) { return [(p[1] - ref[1]) * kx, (p[0] - ref[0]) * ky]; }
    function back(q) { return [+(ref[0] + q[1] / ky).toFixed(7), +(ref[1] + q[0] / kx).toFixed(7)]; }
    var ring = b.pts.map(xy), clips = [];
    cuts.forEach(function (c) {
      var h = (c.w || 1) / 2;
      for (var i = 0; i + 1 < c.pts.length; i++) {
        var p = xy(c.pts[i]), q = xy(c.pts[i + 1]), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy); if (L < 0.01) continue;
        var nx = -dy / L * h, ny = dx / L * h;
        clips.push([[[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny], [p[0] + nx, p[1] + ny]]]);
      }
    });
    if (!clips.length) return null;
    var mp; try { mp = polygonClipping.difference([ring], clips); } catch (e) { return null; }
    var parts = (mp || []).filter(function (poly) { return poly[0] && poly[0].length >= 4 && area(poly[0]) > 20; });
    if (parts.length < 2) return null;
    var t = xy([ll.lat, ll.lng]), hit = parts.filter(function (poly) { return pip(t[0], t[1], poly[0]); })[0];
    if (!hit) return null;
    return hit[0].slice(0, hit[0].length - 1).map(back);
  }
  // tandai blok (seluruh atau satu bagian). Kembali true bila tanda ditambah.
  KM.fillBlock = function (b, ring) {
    if (!b || !b.conf) { HA.toast('Ketuk di dalam blok terkonfirmasi'); return false; }
    var br = HA.tandaBrush(), dt = fillDate(), pts = ring || b.pts.map(function (p) { return [p[0], p[1]]; });
    var sig = ring ? ring[0][0] + ',' + ring[0][1] : 'full';
    var dup = HA.tandaData().items.filter(function (i) { return String(i.bid) === String(b.id) && i.cat === br.cat && (i.sub || null) === (br.sub || null) && HA.tandaU.dateOf(i) === dt && (i.fsig || 'full') === sig; })[0];
    if (dup) { HA.toast('Blok ' + b.name + ' sudah ditandai ' + br.name + ' pada ' + HA.tandaU.d8(dt)); return false; }
    var it = { id: HA.tandaNewId(), t: 'pg', pts: pts, cat: br.cat, sub: br.sub || null, name: String(b.name || ''), note: '', bid: b.id, full: !ring, fsig: sig, date: dt, ts: Date.now() };
    HA.tandaAdd(it); HA.tandaSave();
    var st = HA.tandaStat(it);
    HA.toast('Blok ' + b.name + ' · ' + br.name + ' · ' + HA.tandaU.ha(st.ha) + ' ha' + (ring ? ' (bagian)' : ''));
    if (KM.sync) KM.sync();
    return true;
  };
  function onClick(e) {
    if (!KM.fillTap || KM.mode !== 'kategori' || !HA.map) return;
    var mc = HA.map.getContainer(); if (!mc.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.leaflet-control, .toolpanel, .locbtn, .blkpop, #katSrch, button, .mzCard')) return;
    var pn = document.querySelector('.toolpanel'); if (pn && pn.style.display !== 'none') return;
    if (HA.DM && HA.DM.edit) return;
    e.stopPropagation(); e.preventDefault();
    var ll = HA.map.mouseEventToLatLng(e), b = HA.blockAt(ll);
    if (!b) { HA.toast('Tidak ada blok di titik itu'); return; }
    KM.fillBlock(b, b.conf ? pieceAt(b, ll) : null);
  }
  document.addEventListener('click', onClick, true);
  KM.toggleFill = function () {
    if (KM.mode !== 'kategori') { HA.toast('Ketuk isi hanya di mode Kategori'); return; }
    KM.fillTap = !KM.fillTap;
    HA.toast(KM.fillTap ? 'Ketuk isi aktif: ketuk blok untuk menandai ' + HA.tandaBrush().name : 'Ketuk isi mati');
    if (KM.sync) KM.sync();
  };
})();
