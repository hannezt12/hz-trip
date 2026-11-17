/* HZ Trip v0.16.3 - Ketuk isi: ketuk di dalam blok terkonfirmasi = tandai dengan kategori aktif; Tandai blok penuh */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.KM) return;
  var KM = HA.KM, S = HA.S;
  function $(i) { return document.getElementById(i); }
  KM.fillTap = false;
  var WKN = ['Pagi', 'Siang', 'Sore', 'Malam'];
  HA.WK = WKN;
  HA.wkAuto = function (date) { if (date !== S.today) return ''; var h = new Date().getHours(); return h >= 5 && h < 11 ? 'Pagi' : h >= 11 && h < 15 ? 'Siang' : h >= 15 && h < 18 ? 'Sore' : 'Malam'; };
  function fillDate() { return (!KM.range && !KM.all) ? (S.mapDay || S.today) : S.today; }
  function pip(x, y, r) { var ins = false, i, j; for (i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) ins = !ins; } return ins; }
  function area(r) { var a = 0, i, j; for (i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
  // bagian blok yang terpotong jalan bantu / drainase dan berisi titik ketuk; null = seluruh blok
  function pieceAt(b, ll) {
    var cuts = HA.cutsFor ? HA.cutsFor(b) : null, pb = b.pb && b.pb.a && b.pb.b ? b.pb : null;
    if ((!cuts || !cuts.length) && !pb) return null;
    if (typeof polygonClipping === 'undefined') return null;
    var ref = b.pts[0], kx = 111320 * Math.cos(ref[0] * Math.PI / 180), ky = 110540;
    function xy(p) { return [(p[1] - ref[1]) * kx, (p[0] - ref[0]) * ky]; }
    function back(q) { return [+(ref[0] + q[1] / ky).toFixed(7), +(ref[1] + q[0] / kx).toFixed(7)]; }
    var ring = b.pts.map(xy), clips = [], geom = [ring], t = xy([ll.lat, ll.lng]);
    ring.push(ring[0]);
    if (pb) {
      // batasi ke sisi pembatas yang diketuk (A kiri a→b, B kanan)
      var pa = xy(pb.a), pq = xy(pb.b), dx0 = pq[0] - pa[0], dy0 = pq[1] - pa[1], L0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1, ux = dx0 / L0, uy = dy0 / L0, BIG = 20000;
      var sd = HA.pbSide(b, ll.lat, ll.lng) === 0 ? 1 : -1, nx0 = -uy * sd * BIG, ny0 = ux * sd * BIG;
      var hp = [[pa[0] - ux * BIG, pa[1] - uy * BIG], [pq[0] + ux * BIG, pq[1] + uy * BIG], [pq[0] + ux * BIG + nx0, pq[1] + uy * BIG + ny0], [pa[0] - ux * BIG + nx0, pa[1] - uy * BIG + ny0]];
      hp.push(hp[0]);
      try { geom = polygonClipping.intersection([ring], [hp]); } catch (e) { return null; }
    }
    (cuts || []).forEach(function (c) {
      var h = (c.w || 1) / 2;
      for (var i = 0; i + 1 < c.pts.length; i++) {
        var p = xy(c.pts[i]), q = xy(c.pts[i + 1]), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy); if (L < 0.01) continue;
        var nx = -dy / L * h, ny = dx / L * h;
        clips.push([[[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny], [p[0] + nx, p[1] + ny]]]);
      }
    });
    var mp; try { mp = clips.length ? polygonClipping.difference(geom, clips) : (pb ? geom : null); } catch (e) { return null; }
    if (!mp) return null;
    var parts = mp.filter(function (poly) { return poly[0] && poly[0].length >= 4 && area(poly[0]) > 20; });
    if (!pb && parts.length < 2) return null;
    var hit = parts.filter(function (poly) { return pip(t[0], t[1], poly[0]); })[0];
    if (!hit) return pb ? false : null;
    return hit[0].slice(0, hit[0].length - 1).map(back);
  }
  // tandai blok (seluruh atau satu bagian). Kembali true bila tanda ditambah.
  KM.fillBlock = function (b, ring) {
    if (!b || !b.conf) { HA.toast('Ketuk di dalam blok terkonfirmasi'); return false; }
    var br = HA.tandaBrush(), dt = fillDate(), pts = ring || b.pts.map(function (p) { return [p[0], p[1]]; });
    var sig = ring ? ring[0][0] + ',' + ring[0][1] : 'full';
    var dup = HA.tandaData().items.filter(function (i) { return String(i.bid) === String(b.id) && i.cat === br.cat && (i.sub || null) === (br.sub || null) && HA.tandaU.dateOf(i) === dt && (i.fsig || 'full') === sig; })[0];
    if (dup) { HA.toast('Blok ' + b.name + ' sudah ditandai ' + br.name + ' pada ' + HA.tandaU.d8(dt)); return false; }
    var it = { id: HA.tandaNewId(), t: 'pg', pts: pts, cat: br.cat, sub: br.sub || null, name: String(b.name || ''), note: '', bid: b.id, full: !ring, fsig: sig, date: dt, wk: HA.wkAuto(dt), ts: Date.now() };
    HA.tandaAdd(it); HA.tandaSave();
    var st = HA.tandaStat(it);
    HA.toast('Blok ' + b.name + ' · ' + br.name + ' · ' + HA.tandaU.ha(st.ha) + ' ha' + (ring ? ' (bagian)' : ''));
    if (KM.sync) KM.sync();
    return true;
  };
  function onClick(e) {
    if (!KM.fillTap || KM.mode !== 'kategori' || !HA.map) return;
    var mc = HA.map.getContainer(); if (!mc.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.leaflet-control, .toolpanel, .locbtn, .blkpop, #katSrch, .fgPanel, button, .mzCard')) return;
    var pn = document.querySelector('.toolpanel'); if (pn && pn.style.display !== 'none') return;
    if (HA.DM && HA.DM.edit) return;
    e.stopPropagation(); e.preventDefault();
    var ll = HA.map.mouseEventToLatLng(e), b = HA.blockAt(ll);
    if (!b) { HA.toast('Tidak ada blok di titik itu'); return; }
    var pc = b.conf ? pieceAt(b, ll) : null;
    if (pc === false) { HA.toast('Ketuk di salah satu sisi pembatas, bukan di garisnya'); return; }
    if (KM.pendAdd) KM.pendAdd(b, pc); else KM.fillBlock(b, pc);
  }
  document.addEventListener('click', onClick, true);
  KM.fillDate = fillDate; KM.pieceAt = pieceAt;
  KM.toggleFill = function () {
    if (KM.mode !== 'kategori') { HA.toast('Ketuk isi hanya di mode Kategori'); return; }
    KM.fillTap = !KM.fillTap;
    HA.toast(KM.fillTap ? 'Ketuk isi aktif: ketuk blok untuk menandai ' + HA.tandaBrush().name : 'Ketuk isi mati');
    if (KM.sync) KM.sync();
  };
})();
