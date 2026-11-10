/* HZ Trip - Marking per blok di peta bebas SpidoMap: ketuk/cari blok terkonfirmasi, edit, preview, bagikan */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.TD) return;
  var S = HA.S, TD = HA.TD, IC = HA.IC, tb = HA.tb;
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  var BT = HA.BT = { enter: enter, leave: leave, tap: tap, bar: bar, exit: exit, pick: pick, inside: inside, refresh: function () { chip(); if (cur && !TD.done) { var a = hasAct(); if (a !== lastAct && !TD.ed && !TD.sp && !TD.selIt && TD.tool !== 'del') bar(); } }, share: share, bufPoly: bufPoly, preview: preview, itemsOf: itemsOf, back: function () { var wm = $('spMapWrap'); if (wm && wm.classList.contains('tdmo')) { BT.menuClose(); return true; } var p = $('tdSrch'); if (p && p.style.display !== 'none') { srchClose(); return true; } return false; } };
  var cur = null, collator = new Intl.Collator('id', { numeric: true });

  // ---------- data dan geometri ----------
  function blocks() { try { return (HA.blocksList() || []).filter(function (b) { return b.conf && b.pts && b.pts.length >= 3; }); } catch (e) { return []; } }
  function bbox(pts) { var s = 90, w = 180, n = -90, e = -180; pts.forEach(function (p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; }); return [s, w, n, e]; }
  function pipPts(ll, pts) {
    var P = HzBlok.proj(ll[0], ll[1]), xy = pts.map(P.xy), ins = false, i, j;
    for (i = 0, j = xy.length - 1; i < xy.length; j = i++) if ((xy[i][1] > 0) !== (xy[j][1] > 0) && 0 < (xy[j][0] - xy[i][0]) * (0 - xy[i][1]) / (xy[j][1] - xy[i][1]) + xy[i][0]) ins = !ins;
    return ins;
  }
  function inside(ll) { return !!cur && pipPts(ll, cur.pts); }
  function rep(it) {
    if (it.t === 'pt') return it.pts[0];
    if (it.t === 'ln') return it.pts[Math.floor(it.pts.length / 2)];
    var a = 0, b = 0; it.pts.forEach(function (p) { a += p[0]; b += p[1]; });
    var m = [a / it.pts.length, b / it.pts.length];
    if (it.pts.length < 4 || pipPts(m, it.pts)) return m;
    // bentuk cekung: titik rata-rata bisa di luar bentuk; ambil tengah garis terlebar di lintang itu (pasti di dalam)
    var xs = [], P = it.pts, i, j;
    for (i = 0, j = P.length - 1; i < P.length; j = i++) {
      var yi = P[i][0], yj = P[j][0]; if ((yi > m[0]) !== (yj > m[0])) xs.push(P[i][1] + (m[0] - yi) / (yj - yi) * (P[j][1] - P[i][1]));
    }
    xs.sort(function (x, y) { return x - y; });
    var best = -1, mid = null; for (i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > best) { best = xs[i + 1] - xs[i]; mid = (xs[i] + xs[i + 1]) / 2; }
    return mid === null ? P[0] : [m[0], mid];
  }
  function itemsOf(b) {
    var bb = bbox(b.pts), out = [];
    HA.tandaData().items.forEach(function (it) { var r = rep(it); if (r[0] < bb[0] || r[0] > bb[2] || r[1] < bb[1] || r[1] > bb[3]) return; if (pipPts(r, b.pts)) out.push(it); });
    return out;
  }
  function countsAll(list) {
    var res = {}, its = HA.tandaData().items.map(function (it) { return [it, rep(it)]; });
    list.forEach(function (b) { var bb = bbox(b.pts), n = 0; its.forEach(function (x) { var r = x[1]; if (r[0] < bb[0] || r[0] > bb[2] || r[1] < bb[1] || r[1] > bb[3]) return; if (pipPts(r, b.pts)) n++; }); res[b.id] = n; });
    return res;
  }
  // poligon digeser keluar sejauh d meter (miter dibatasi)
  function bufPoly(pts, d) {
    var P = HzBlok.proj(pts[0][0], pts[0][1]), xy = pts.map(P.xy), n = xy.length, ar = 0, i;
    for (i = 0; i < n; i++) { var a = xy[i], b = xy[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
    var sg = ar > 0 ? 1 : -1, out = [];
    for (i = 0; i < n; i++) {
      var p0 = xy[(i + n - 1) % n], p1 = xy[i], p2 = xy[(i + 1) % n];
      function nm(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [sg * dy / l, -sg * dx / l]; }
      var n1 = nm(p0, p1), n2 = nm(p1, p2), den = 1 + n1[0] * n2[0] + n1[1] * n2[1], f = d / Math.max(den, 0.35), ox = (n1[0] + n2[0]) * f, oy = (n1[1] + n2[1]) * f, l = Math.hypot(ox, oy);
      if (l > d * 3) { ox *= d * 3 / l; oy *= d * 3 / l; }
      out.push(P.ll(p1[0] + ox, p1[1] + oy));
    }
    return out;
  }
  function dist(a, b) { var dx = (a[1] - b[1]) * 111320 * Math.cos((a[0] + b[0]) / 2 * Math.PI / 180), dy = (a[0] - b[0]) * 111320; return Math.hypot(dx, dy); }
  function fmtD(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km'; }
  function fmtHa(v) { return v.toFixed(2).replace('.', ','); }

  // ---------- peta bebas di SpidoMap: blok terkonfirmasi bisa diketuk (zoom 15+), cari lewat kaca pembesar ----------
  var MINZ = 15, blkLay = null, pos = null, bound = false, BL = null, SNAP = null, bmode = 'sat';
  function sp() { return HA.SP && HA.SP.map; }
  function blocksC() { return BL || (BL = blocks()); }
  function hit(ll) {
    var h = null, a0 = 1e18;
    blocksC().forEach(function (b) {
      var q = bbox(b.pts); if (ll[0] < q[0] || ll[0] > q[2] || ll[1] < q[1] || ll[1] > q[3]) return;
      if (pipPts(ll, b.pts)) { var a = HzBlok.areaHa(b.pts); if (a < a0) { a0 = a; h = b; } }
    });
    return h;
  }
  function dirty() { return !!cur && JSON.stringify(HA.tandaData().items) !== SNAP; }
  function ensureTop() {
    if ($('tdTop')) return;
    var w = $('spMapWrap'), el = document.createElement('div'); el.id = 'tdTop'; el.style.display = 'none';
    el.innerHTML = '<button class="tdChip" id="tdChip" style="display:none"></button><span class="tdGap"></span>';
    w.appendChild(el);
    [['tdMenu', '', 'Menu peta', IC.mark], ['tdCat', ' tdmi', 'Kategori', IC.tag], ['tdLay', ' tdmi', 'Satelit atau peta', IC.layers], ['tdSr', ' tdmi', 'Cari blok', IC.search], ['tdNo', ' tdmi', 'Nomor blok', IC.hash]].forEach(function (a) {
      var b = document.createElement('button'); b.id = a[0]; b.className = 'locbtn' + a[1]; b.setAttribute('aria-label', a[2]); b.innerHTML = a[3]; w.appendChild(b);
    });
    var sr = document.createElement('div'); sr.id = 'tdSrch'; sr.style.display = 'none';
    sr.innerHTML = '<div class="tdSq"><input type="search" id="tdQ" placeholder="Cari nama blok" autocomplete="off"><button class="ib" id="tdQx" aria-label="Tutup">' + IC.close + '</button></div><div id="tdSl"></div>';
    w.appendChild(sr);
    var xh = document.createElement('div'); xh.id = 'tdCross'; xh.innerHTML = IC.cross; w.appendChild(xh);
    var co = document.createElement('div'); co.id = 'tdCoord'; co.innerHTML = '<span id="tdCoordT"></span><button type="button" id="tdCopy" aria-label="Salin koordinat">' + IC.copy + '</button>'; w.appendChild(co);
    $('tdCopy').onclick = function () { copyTxt($('tdCoordT').textContent); };
    // satu tombol menu: ketuk untuk membuka, ketuk di luar untuk menutup (tanpa memicu peta)
    var swallow = 0;
    function menuSet(on) { w.classList.toggle('tdmo', on); $('tdMenu').innerHTML = on ? IC.close : IC.mark; }
    BT.menuClose = function () { menuSet(false); };
    function isIn(t) { return !!(t && t.closest && t.closest('#tdMenu,.tdmi')); }
    $('tdMenu').onclick = function (e) { e.stopPropagation(); menuSet(!w.classList.contains('tdmo')); };
    document.addEventListener('pointerdown', function (e) {
      if (!w.classList.contains('tdmo') || isIn(e.target)) return;
      menuSet(false);
      if (w.contains(e.target)) { swallow = Date.now(); e.stopPropagation(); }
    }, true);
    w.addEventListener('click', function (e) { if (swallow && Date.now() - swallow < 700 && !isIn(e.target)) { swallow = 0; e.stopPropagation(); e.preventDefault(); } }, true);
    w.addEventListener('click', function (e) { if (w.classList.contains('tdmo') && isIn(e.target) && !(e.target.closest && e.target.closest('#tdMenu'))) setTimeout(function () { menuSet(false); }, 0); });
    $('tdCat').onclick = function () { HA.tandaCatList(); };
    $('tdNo').onclick = function () { S.settings.tdNoHide = !S.settings.tdNoHide; HA.saveSettings(); drawBlocks(); $('tdNo').classList.toggle('off', !!S.settings.tdNoHide); toast(S.settings.tdNoHide ? 'Nomor blok disembunyikan' : 'Nomor blok tampil'); };
    $('tdSr').onclick = function () { if ($('tdSrch').style.display === 'none') srchOpen(); else srchClose(); };
    $('tdQx').onclick = srchClose;
    $('tdQ').oninput = srchList;
    $('tdLay').onclick = function () { bmode = bmode === 'sat' ? 'osm' : 'sat'; HA.setBase(sp(), bmode); sp()._forceOvl = bmode === 'osm'; if (HA.syncOverlays) HA.syncOverlays(sp()); toast(bmode === 'sat' ? 'Mode satelit' : 'Mode peta + peta PDF'); };
    $('tdChip').onclick = function () { if (!cur) return; if (itemsOf(cur).length) history(null); else zoomBlk(); };
  }
  function copyTxt(t) {
    function ok() { toast('Koordinat disalin'); }
    function fb() { try { var a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); ok(); } catch (e) { toast('Gagal menyalin'); } }
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok, fb); return; } } catch (e) {}
    fb();
  }
  function coordUpd() { var m = sp(); if (!m || !$('tdCoordT')) return; var c = m.getCenter(); $('tdCoordT').textContent = c.lat.toFixed(5) + ', ' + c.lng.toFixed(5); }
  function coordShow() { if (!$('tdCross')) return; var on = TD.on && !cur; $('tdCross').style.display = on ? 'block' : 'none'; $('tdCoord').style.display = on ? 'flex' : 'none'; if (on) coordUpd(); }
  var lastAct = false;
  function hasAct() { return !!cur && (dirty() || itemsOf(cur).length > 0); }
  function chip() {
    var c = $('tdChip'); if (!c) return;
    if (!cur) { c.style.display = 'none'; return; }
    var n = itemsOf(cur).length;
    c.style.display = ''; c.innerHTML = '<b>Blok ' + esc(String(cur.name)) + '</b><small>' + fmtHa(HzBlok.areaHa(cur.pts)) + ' ha · ' + (n ? n + ' tanda' : 'belum ada tanda') + '</small>';
  }
  function zoomBlk() { if (cur) sp().fitBounds(L.latLngBounds(cur.pts), { padding: [40, 40], maxZoom: 20, animate: true }); }
  // Riwayat blok: semua lapisan, terbaru di atas
  function history(ll) {
    if (!cur) return;
    var U = HA.tandaU, P = HzBlok.proj(cur.pts[0][0], cur.pts[0][1]), pxy = ll ? P.xy(ll) : null, bxy = cur.pts.map(P.xy);
    function dseg(p, a, c) { var dx = c[0] - a[0], dy = c[1] - a[1], l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy); }
    function pip(p, poly) { var o = false, i, j; for (i = 0, j = poly.length - 1; i < poly.length; j = i++) { if ((poly[i][1] > p[1]) !== (poly[j][1] > p[1]) && p[0] < (poly[j][0] - poly[i][0]) * (p[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) o = !o; } return o; }
    function hit(it) {
      if (!pxy) return false; var xy = it.pts.map(P.xy), i;
      if (it.t === 'pt') return Math.hypot(xy[0][0] - pxy[0], xy[0][1] - pxy[1]) < 4;
      if (it.t === 'ln') { for (i = 0; i < xy.length - 1; i++) if (dseg(pxy, xy[i], xy[i + 1]) < 4) return true; return false; }
      return pip(pxy, xy);
    }
    var its = itemsOf(cur).slice().sort(function (a, c) { return (c.ts || 0) - (a.ts || 0); });
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    var h = '<div class="grab"></div><div class="st">RIWAYAT BLOK ' + esc(String(cur.name)).toUpperCase() + '</div><div class="muted" style="margin-bottom:6px">' + its.length + ' tanda \u00B7 terbaru di atas \u00B7 ketuk untuk memilih</div>';
    its.forEach(function (it, i) {
      var inf = HA.tandaCatInfo(it), st = HA.tandaStat(it), tt = new Date(it.ts || 0), a = [];
      a.push(U.d8(U.dateOf(it)) + ' ' + p2(tt.getHours()) + '.' + p2(tt.getMinutes()));
      if (it.t === 'pg') { a.push(U.ha(st.ha) + ' ha'); if (st.lm) a.push(U.ribu(st.lm) + ' m lajur'); } else if (it.t === 'ln') a.push(U.ribu(st.m) + ' m garis'); else a.push('titik');
      h += '<button type="button" class="rwR" data-i="' + i + '"><i class="tdd" style="background:' + inf.col + '"></i><span class="lsT"><b>' + esc(HA.tandaTabName(it).replace(/ \/ /, ' / ')) + '</b>' + (it.name ? ' <span class="muted">' + esc(it.name) + '</span>' : '') + '<br><span class="lsS">' + esc(a.join(' \u00B7 ')) + '</span></span>' + (hit(it) ? '<span class="rwH">di titik ini</span>' : '') + '</button>';
    });
    h += '<div class="lsFoot"><button class="btn" id="rwZ">Zoom ke blok</button><button class="btn" id="rwX">Tutup</button></div>';
    openSheet(h);
    document.querySelectorAll('#sheet .rwR').forEach(function (e) { e.onclick = function () { var it = its[+e.getAttribute('data-i')]; closeSheet(); if (it) { HA.tandaSelect(it); } }; });
    $('rwZ').onclick = function () { closeSheet(); zoomBlk(); };
    $('rwX').onclick = closeSheet;
  }
  function hudStatus() {
    if (!TD.on || TD.wk || TD.ed || cur) return;
    HA.tandaHud(sp().getZoom() < MINZ ? 'Perbesar peta (zoom 15+) lalu ketuk blok' : 'Ketuk blok untuk memilih');
  }
  function drawBlocks() {
    if (!blkLay) return;
    blkLay.clearLayers();
    var m = sp(); if (!m || !TD.on || m.getZoom() < MINZ) return;
    var z = m.getZoom(), g = m.getBounds(), bb = [g.getSouth(), g.getWest(), g.getNorth(), g.getEast()], n = 0;
    blocksC().forEach(function (o) {
      if (n > 220) return;
      var q = bbox(o.pts); if (q[2] < bb[0] || q[0] > bb[2] || q[3] < bb[1] || q[1] > bb[3]) return; n++;
      var on = cur && cur.id === o.id;
      var pg = L.polygon(o.pts, { color: on ? '#FFE600' : '#fff', weight: on ? 1.8 : 0.8, opacity: on ? 1 : (cur ? 0.35 : 0.6), fill: false, interactive: false }).addTo(blkLay);
      if (z >= 16 && !S.settings.tdNoHide) pg.bindTooltip(esc(String(o.name)), { permanent: true, direction: 'center', className: 'bkl' + (z >= 17 ? ' bkb' : '') + (z >= 18 ? ' bz' + Math.min(z, 21) : '') });
    });
  }
  function onView() { if (!TD.on) return; drawBlocks(); hudStatus(); }
  function enter() {
    var m = sp(); if (!m) return;
    BL = null; ensureTop(); $('tdNo').classList.toggle('off', !!S.settings.tdNoHide); $('tdTop').style.display = 'flex'; $('spMapWrap').classList.add('tdon');
    if (!blkLay) blkLay = L.layerGroup();
    blkLay.addTo(m);
    if (!bound) { m.on('moveend zoomend', onView); m.on('move', coordUpd); bound = true; }
    cur = null; TD.blk = null; TD.done = false; SNAP = null; HA.tandaHsInit(false);
    bmode = 'sat'; chip(); drawBlocks(); hudStatus();
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { pos = [p.coords.latitude, p.coords.longitude]; }, function () {}, { timeout: 7000, maximumAge: 60000, enableHighAccuracy: false });
  }
  function leave() {
    var m = sp();
    srchClose(); cur = null; TD.blk = null; TD.done = false; SNAP = null; HA.tandaHsInit(false); if (BT.onLeave) BT.onLeave();
    if (blkLay) { blkLay.clearLayers(); if (m) try { m.removeLayer(blkLay); } catch (e) {} }
    if ($('tdTop')) $('tdTop').style.display = 'none';
    if ($('spMapWrap')) { $('spMapWrap').classList.remove('tdon'); $('spMapWrap').classList.remove('tdmo'); } if ($('tdMenu')) $('tdMenu').innerHTML = IC.mark; if ($('tdCross')) { $('tdCross').style.display = 'none'; $('tdCoord').style.display = 'none'; }
    if (m && bmode !== 'sat') { HA.setBase(m, 'sat'); bmode = 'sat'; }
    if (m) { m._forceOvl = false; if (HA.syncOverlays) HA.syncOverlays(m); }
  }
  function select(b, fit) {
    HA.tandaEdCancel(); cur = b; TD.blk = b; TD.tool = null; TD.done = false; TD.selIt = null; TD.del = null; TD.palOpen = false;
    SNAP = JSON.stringify(HA.tandaData().items); HA.tandaHsInit(true);
    if (fit && sp()) sp().fitBounds(L.latLngBounds(b.pts), { padding: [48, 48], maxZoom: 20, animate: false });
    drawBlocks(); chip(); HA.tandaDraw(); HA.tandaBar();
  }
  function deselect() {
    HA.tandaEdCancel(); cur = null; TD.blk = null; TD.tool = null; TD.done = false; TD.selIt = null; TD.del = null; TD.palOpen = false; SNAP = null; HA.tandaHsInit(false);
    drawBlocks(); chip(); HA.tandaDraw(); HA.tandaBar(); hudStatus();
    if (BT.afterDeselect) BT.afterDeselect();
  }
  // keluar dari blok terpilih; bila ada perubahan belum disimpan, tanya dulu
  function exit(then) {
    if (TD.wk) { toast('Hentikan walking dulu'); return; }
    if (!cur || !dirty()) { if (cur) deselect(); if (then) then(); return; }
    var nm = String(cur.name);
    openSheet('<div class="grab"></div><div class="st">BLOK ' + esc(nm).toUpperCase() + '</div><div class="card">Ada perubahan tanda yang belum disimpan.</div>' +
      '<button class="btn pri" id="exS" style="width:100%;margin-top:10px;height:52px">Simpan</button><button class="btn" id="exB" style="width:100%;margin-top:8px">Buang perubahan</button><button class="btn" id="exL" style="width:100%;margin-top:8px">Lanjut edit</button>');
    $('exS').onclick = function () { closeSheet(); toast('Blok ' + nm + ' tersimpan'); deselect(); if (then) then(); };
    $('exB').onclick = function () { closeSheet(); HA.tandaSetItems(SNAP); deselect(); if (then) then(); };
    $('exL').onclick = closeSheet;
  }
  function pick(b, fit) {
    if (cur && cur.id === b.id) { if (fit && sp()) sp().fitBounds(L.latLngBounds(b.pts), { padding: [48, 48], maxZoom: 20, animate: true }); return; }
    if (cur) exit(function () { select(b, fit); }); else select(b, fit);
  }
  // ketukan di peta: true bila sudah ditangani
  function tap(ll) {
    if (!sp() || TD.tool === 'mv') return false;
    if (TD.ed) { if (cur && !inside(ll)) { toast('Ketuk di dalam batas blok'); return true; } return false; }
    if (!cur) {
      var h = hit(ll);
      if (h) select(h, false); else toast(sp().getZoom() < MINZ ? 'Perbesar peta dulu (zoom 15+)' : 'Tidak ada blok terkonfirmasi di sini');
      return true;
    }
    if (TD.tool === 'pt') { if (!inside(ll)) { toast('Ketuk di dalam batas blok'); return true; } return false; }
    if (TD.tool) return false;
    var h2 = hit(ll); if (h2 && h2.id !== cur.id) { pick(h2, false); return true; }
    return false;
  }

  // ---------- pencarian: kaca pembesar, 5 saran ----------
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ''); }
  function srchOpen() { $('tdSrch').style.display = 'block'; $('tdQ').value = ''; srchList(); setTimeout(function () { try { $('tdQ').focus(); } catch (e) {} }, 60); }
  function srchClose() { var s = $('tdSrch'); if (s) { s.style.display = 'none'; try { $('tdQ').blur(); } catch (e) {} } }
  function srchList() {
    var q = norm($('tdQ').value), ref = pos, m = sp();
    if (!ref && m) { var c = m.getCenter(); ref = [c.lat, c.lng]; }
    var l = blocksC().map(function (b) { var q2 = bbox(b.pts); return { b: b, d: ref ? dist(ref, [(q2[0] + q2[2]) / 2, (q2[1] + q2[3]) / 2]) : 0, n: norm(b.name) }; });
    if (q) {
      l = l.filter(function (x) { return x.n.indexOf(q) >= 0; });
      l.sort(function (a, b) { var s1 = a.n.indexOf(q) === 0 ? 0 : 1, s2 = b.n.indexOf(q) === 0 ? 0 : 1; return s1 - s2 || collator.compare(a.n, b.n); });
    } else l.sort(function (a, b) { return a.d - b.d; });
    l = l.slice(0, 5);
    $('tdSl').innerHTML = l.length ? (q ? '' : '<div class="muted tdSh">' + (pos ? 'Terdekat dari posisi Anda' : 'Terdekat dari tengah peta') + '</div>') + l.map(function (x) {
      return '<button class="bprow" data-id="' + esc(String(x.b.id)) + '"><span class="bpi"><b>' + esc(String(x.b.name)) + '</b><small>' + fmtHa(HzBlok.areaHa(x.b.pts)) + ' ha · ' + fmtD(x.d) + '</small></span></button>';
    }).join('') : '<div class="muted" style="padding:0.75rem">Tidak ada blok terkonfirmasi yang cocok.</div>';
    $('tdSl').querySelectorAll('.bprow').forEach(function (e) {
      e.onclick = function () { var id = e.getAttribute('data-id'), b = blocksC().filter(function (o) { return String(o.id) === id; })[0]; srchClose(); if (b) pick(b, true); };
    });
  }

  // ---------- bilah bawah mode marking ----------
  function fit0() { setTimeout(function () { if (sp()) sp().invalidateSize(); }, 60); }
  function bar() {
    var bx = $('tdBar'); if (!bx) return;
    coordShow();
    var b = HA.tandaBrush();
    if (!cur) {
      bx.innerHTML = '<div class="tdr">' + tb('tdWk', IC.walk, 'Walking') + tb('tdLs', IC.list, 'Daftar semua') + tb('tdXm', IC.close, 'Tutup') + '</div>';
      $('tdWk').onclick = function () { HA.tandaPick('wk'); };
      $('tdLs').onclick = function () { if (BT.listOpen) BT.listOpen(); else HA.tandaList(); };
      $('tdXm').onclick = function () { HA.tandaOff(); };
      hudStatus(); fit0(); return;
    }
    if (TD.done) {
      bx.innerHTML = '<div class="tdr">' + tb('tdBk', IC.back, 'Edit') + tb('tdSh', IC.share, 'Bagikan', true) + tb('tdXb', IC.close, 'Tutup') + '</div>';
      $('tdBk').onclick = function () { TD.done = false; bar(); };
      $('tdSh').onclick = function () { HA.tandaSave(); SNAP = JSON.stringify(HA.tandaData().items); share([cur]); };
      $('tdXb').onclick = function () { deselect(); };
      HA.tandaHud(''); fit0(); return;
    }
    if (HA.tandaSubBar && HA.tandaSubBar()) { fit0(); return; }
    var shp = { pt: ['Titik', IC.pin], ln: ['Garis', IC.line], rc: ['Segi empat', IC.rect], bl: ['Belah', IC.split] }, cs = shp[TD.tool];
    var act = hasAct(); lastAct = act;
    bx.innerHTML = HA.tandaPalHtml({ cat: b.cat, sub: b.sub }, b.op, TD.tool === 'pg') +
      (TD.shpOpen ? '<div class="tdr">' + tb(null, IC.pin, 'Titik', TD.tool === 'pt', 'data-t="pt"') + tb(null, IC.line, 'Garis', TD.tool === 'ln', 'data-t="ln"') + tb(null, IC.rect, 'Segi empat', TD.tool === 'rc', 'data-t="rc"') + tb(null, IC.split, 'Belah', TD.tool === 'bl', 'data-t="bl"') + '</div>' : '') +
      '<div class="tdr">' + tb('tdShp', cs ? cs[1] : IC.shapes, cs ? cs[0] : 'Bentuk', !!cs || !!TD.shpOpen) + tb(null, IC.brush, 'Warnai', TD.tool === 'pg', 'data-t="pg"') + tb(null, IC.walk, 'Jalan', !!TD.wk, 'data-t="wk"') + HA.tandaKatBtn() + '</div>' +
      (act ? '<div class="tdr tdr2">' + HA.ti('tdUn', IC.undo, 'Urung') + HA.ti('tdRe', IC.redo, 'Ulang') + HA.ti(null, IC.trash, 'Hapus', 'data-t="del"', 'dn') + tb('tdCn', IC.close, 'Batal') + tb('tdFin', IC.check, 'Selesai', true) + '</div>'
        : '<div class="tdr tdr2">' + tb('tdCn', IC.close, 'Tutup') + '</div>');
    $('tdShp').onclick = function () { TD.shpOpen = !TD.shpOpen; bar(); };
    bx.querySelectorAll('[data-t]').forEach(function (e) { e.onclick = function () { HA.tandaPick(e.getAttribute('data-t')); }; });
    if ($('tdUn')) { $('tdUn').onclick = function () { HA.tandaUndo(); }; $('tdRe').onclick = function () { HA.tandaRedo(); }; }
    HA.tandaKatWire(bar);
    HA.tandaPalWire(function (cid, sid) { HA.tandaSetBrush(cid, sid); bar(); }, function (v, fin) { HA.tandaData().brush.op = v; if (fin) HA.tandaSave(); });
    $('tdCn').onclick = function () {
      if (!dirty()) { deselect(); return; }
      HA.askConfirm('Batalkan perubahan blok ' + cur.name + '?', 'Tanda yang baru ditambah atau diubah di blok ini dibuang.', 'Buang', function () { HA.tandaSetItems(SNAP); deselect(); });
    };
    if ($('tdFin')) $('tdFin').onclick = function () { HA.tandaEdCancel(); TD.tool = null; HA.tandaSave(); SNAP = JSON.stringify(HA.tandaData().items); TD.done = true; toast('Blok ' + cur.name + ' tersimpan \u00B7 ' + itemsOf(cur).length + ' tanda'); bar(); };
    if (!TD.tool) HA.tandaHud('Pilih Bentuk, Warnai, atau Jalan'); else if (TD.tool === 'pt') HA.tandaHud('Ketuk di dalam blok untuk menaruh titik');
    fit0();
  }
  function selItems(b, pre) {
    var a = itemsOf(b); if (!pre) return a; var m = pre[b.id] || {};
    return a.filter(function (it) { var x = m[HA.tandaCatKey(it)]; return !!(x && x[HA.tandaU.dateOf(it)]); });
  }
  function stampD() { var t = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(t.getDate()) + p(t.getMonth() + 1) + String(t.getFullYear()).slice(2); }
  function fseq(base, commit) {
    var o = {}; try { o = JSON.parse(localStorage.getItem('hz_fseq') || '{}'); } catch (e) {}
    var n = (o[base] || 0) + 1;
    if (commit) { var keep = {}, tk = '_' + stampD() + '_'; Object.keys(o).forEach(function (k) { if (k.indexOf(tk) >= 0) keep[k] = o[k]; }); keep[base] = n; try { localStorage.setItem('hz_fseq', JSON.stringify(keep)); } catch (e) {} }
    return n;
  }
  // Kategori_ddmmyy_Nblok_urut.ext
  function fileName(nBlk, names, ext, commit) {
    var nm = names.length === 1 ? (names[0].replace(/[^A-Za-z0-9]+/g, '') || 'Marking') : (names.length ? 'Campur' : 'Marking');
    var base = nm + '_' + stampD() + '_' + nBlk + 'blok';
    return base + '_' + fseq(base, commit) + '.' + ext;
  }
  function catNamesOf(its) { var s = {}, o = []; its.forEach(function (it) { var n = HA.tandaCatInfo(it).name; if (!s[n]) { s[n] = 1; o.push(n); } }); return o; }
  function stampN() { var t = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()); }
  function preview(b) {
    toast('Menyusun preview…');
    BT.buildPdf([{ title: '', items: itemsOf(b), blk: b }], { nama: SH.nama, nilai: SH.nilai, fs: SH.fs }).then(function (bytes) {
      HA.pdfPreview(bytes, function () { HA.saveFile(fileName(1, catNamesOf(itemsOf(b)), 'pdf', true), btoa(bytes), 'application/pdf'); });
    }).catch(function () { toast('Gagal menyusun preview'); });
  }


  // ---------- citra satelit: daftar kotak, cek cache, unduh ----------
  function satZ() { return S.settings.satNative || 17; }
  function tilesFor(bb, z) {
    var C = L.CRS.EPSG3857, a = C.latLngToPoint(L.latLng(bb[2], bb[1]), z), c = C.latLngToPoint(L.latLng(bb[0], bb[3]), z);
    return { a: a, c: c, x0: Math.floor(a.x / 256), x1: Math.floor(c.x / 256), y0: Math.floor(a.y / 256), y1: Math.floor(c.y / 256) };
  }
  function tUrl(x, y, z) { return L.Util.template(HA.TILES.sat[0], { x: x, y: y, z: z, s: 'a', r: '' }); }
  function tileUrls(bb) {
    var z = satZ(), g = tilesFor(bb, z), out = [];
    for (var x = g.x0; x <= g.x1; x++) for (var y = g.y0; y <= g.y1; y++) out.push(tUrl(x, y, z));
    return out;
  }
  function checkUrls(urls) {
    return Promise.all(urls.map(function (u) { return HA.TC.get(u).then(function (b) { return b ? null : u; }).catch(function () { return null; }); })).then(function (r) { return r.filter(Boolean); });
  }
  function mbMB(n) { return Math.max(0.1, n * 0.03).toFixed(1).replace('.', ','); }

  function dl(miss, prog, done) {
    var i = 0, ok = 0, fail = 0, run = 0, fin = false;
    function nx() {
      if (i >= miss.length) { if (run === 0 && !fin) { fin = true; IMGC = {}; done(fail); } return; }
      var u = miss[i++]; run++;
      fetch(u, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('x'); return r.blob(); }).then(function (b) { return HA.TC.put(u, b); }).then(function () { ok++; }).catch(function () { fail++; }).then(function () { run--; prog(ok + fail, miss.length); nx(); });
    }
    if (!miss.length) { done(0); return; }
    for (var k = 0; k < 4; k++) nx();
  }

  // ---------- gambar satelit untuk PDF (tile cache -> JPEG, dipotong poligon + sekeliling) ----------
  var IMGC = {};
  function loadImg(blob) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); res(null); };
      im.src = u;
    });
  }
  function satImage(b, mb, buf) {
    var key = b.id + '|' + buf + '|' + mb.map(function (v) { return v.toFixed(6); }).join(',');
    if (IMGC[key]) return IMGC[key];
    var z = satZ(), g = tilesFor(mb, z), nT = (g.x1 - g.x0 + 1) * (g.y1 - g.y0 + 1);
    if (nT > 400) return (IMGC[key] = Promise.resolve(null));
    var kx = Math.cos((mb[0] + mb[2]) / 2 * Math.PI / 180), mw = (mb[3] - mb[1]) * 111320 * kx, mh = (mb[2] - mb[0]) * 111320, k = 1600 / Math.max(mw, mh, 1), tw = Math.max(16, Math.round(mw * k)), th = Math.max(16, Math.round(mh * k));
    var cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
    var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, tw, th);
    cx.save(); cx.beginPath();
    bufPoly(b.pts, buf).forEach(function (p, i) { var x = (p[1] - mb[1]) / (mb[3] - mb[1]) * tw, y = (mb[2] - p[0]) / (mb[2] - mb[0]) * th; if (i) cx.lineTo(x, y); else cx.moveTo(x, y); });
    cx.closePath(); cx.clip(); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    var sx = tw / (g.c.x - g.a.x), sy = th / (g.c.y - g.a.y), jobs = [], drawn = 0;
    for (var x = g.x0; x <= g.x1; x++) for (var y = g.y0; y <= g.y1; y++) (function (x, y) {
      jobs.push(HA.TC.get(tUrl(x, y, z)).then(function (bl) { return bl ? loadImg(bl) : null; }).then(function (im) {
        if (!im) return; drawn++;
        cx.drawImage(im, (x * 256 - g.a.x) * sx, (y * 256 - g.a.y) * sy, 256 * sx + 1, 256 * sy + 1);
      }).catch(function () {}));
    })(x, y);
    var pr = Promise.all(jobs).then(function () {
      cx.restore();
      if (!drawn) return null;
      var d = cv.toDataURL('image/jpeg', 0.85).split(',')[1];
      return { w: tw, h: th, data: atob(d) };
    }).catch(function () { return null; });
    IMGC[key] = pr; return pr;
  }
  // PDF dengan gambar satelit (asinkron). opts = {nama,nilai,fs,pos}, groups = [{title,items,blk}]
  BT.buildPdf = function (groups, opts) {
    opts = opts || {};
    var buf = HA.tandaBufM(), ex = [], skipped = 0, cats = HA.tandaData().cats.map(function (c) { return c.id; });
    groups.forEach(function (g) {
      if (!g.blk || opts.catSplit === false) { ex.push(g); return; }
      var by = {}, ord = [];
      g.items.forEach(function (it) {
        var valid = it.cat && HA.tandaCatInfo(it).name !== 'Tanpa kategori' && it.pts && it.pts.length >= (it.t === 'pg' ? 3 : (it.t === 'ln' ? 2 : 1));
        if (!valid) { skipped++; return; }
        if (!by[it.cat]) { by[it.cat] = { id: it.cat, cat: HA.tandaCatInfo(it).name, items: [] }; ord.push(by[it.cat]); }
        by[it.cat].items.push(it);
      });
      if (!ord.length) { ex.push({ title: g.title, items: [], blk: g.blk, cat: '' }); return; }
      ord.sort(function (x, y) { return cats.indexOf(x.id) - cats.indexOf(y.id); });
      ord.forEach(function (o) { ex.push({ title: g.title, items: o.items, blk: g.blk, cat: o.cat }); });
    });
    if (opts.meta) opts.meta.pages = ex.map(function (g) { return { blk: g.blk, cat: g.cat || '' }; });
    BT._skipped = skipped;
    return Promise.all(ex.map(function (g) {
      if (!g.blk) return null;
      return satImage(g.blk, HA.tandaPageBox(g.items, g.blk, { buf: buf }), buf);
    })).then(function (imgs) {
      var gs = ex.map(function (g, i) { return { title: g.title, items: g.items, blk: g.blk, img: imgs[i], cat: g.cat }; });
      BT._noImg = gs.filter(function (g) { return g.blk && !g.img; }).length;
      return HA.tandaBuildPdf([], Object.assign({ blk: true, pos: 'c' }, opts, { buf: buf, groups: gs }));
    });
  };

  // ---------- bagikan: PDF atau KML untuk satu atau beberapa blok ----------
  var SH = { fmt: 'pdf', title: '', nama: true, nilai: true, fs: 'a', colMap: {} };
  function stamp() { var t = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()); }
  function share(list, pre) {
    var many = list.length > 1, n = 0, warned = false, seq = 0, tmr = null, miss = [], total = 0;
    SH.title = '';
    var nNoCat = 0;
    list.forEach(function (b) { n += selItems(b, pre).length; selItems(b, pre).forEach(function (it) { if (!it.cat || HA.tandaCatInfo(it).name === 'Tanpa kategori') nNoCat++; }); });
    var def = many ? 'Marking ' + list.length + ' blok' : 'Blok ' + list[0].name;
    // kategori pada blok-blok ini; default hanya kategori tanda yang terakhir diedit
    var cats = [], seenK = {}, lastK = {};
    list.forEach(function (b) {
      var best = null;
      selItems(b, pre).forEach(function (it) {
        var k = HA.tandaCatKey(it);
        if (!seenK[k]) { var inf = HA.tandaCatInfo(it); seenK[k] = { k: k, name: inf.name, col: inf.col, n: 0 }; cats.push(seenK[k]); }
        seenK[k].n++;
        var ts = it.mod || it.ts || 0; if (!best || ts >= best.ts) best = { ts: ts, k: k };
      });
      if (best) lastK[best.k] = 1;
    });
    SH.cats = {}; cats.forEach(function (c) { SH.cats[c.k] = pre ? true : !!lastK[c.k]; });
    function catRows() {
      if (!cats.length) return '<div class="muted">Belum ada tanda.</div>';
      return cats.map(function (c) { return '<label><input type="checkbox" data-k="' + c.k + '"' + (SH.cats[c.k] ? ' checked' : '') + '><i class="tdd" style="background:' + c.col + '"></i>' + esc(c.name) + ' <span class="muted">(' + c.n + ')</span></label>'; }).join('');
    }
    function noCat() { return n > 0 && !cats.some(function (c) { return SH.cats[c.k]; }); }
    openSheet('<div class="grab"></div><div class="st">BAGIKAN ' + (many ? list.length + ' BLOK' : 'BLOK ' + esc(String(list[0].name)).toUpperCase()) + '</div>' +
      '<div class="muted" style="margin-bottom:8px">' + n + ' tanda' + (n ? '' : ' · blok akan dicetak tanpa tanda') + (nNoCat ? ' · ' + nNoCat + ' tanpa kategori tidak ikut PDF' : '') + '</div><div class="muted" style="margin-bottom:8px">PDF: satu halaman per kategori di tiap blok</div>' +
      '<div id="shPvw"><canvas id="shCv"></canvas><div id="shPm" class="muted">Menyusun preview…</div></div><div class="muted" id="shHint" style="text-align:center;margin:4px 0 0">Ketuk gambar untuk mengubah tampilan</div>' +
      '<div id="shW" style="display:none"></div>' +
      '<div class="h" style="margin-top:10px">FORMAT (PILIH SATU)</div><div class="seg" id="shF"><button data-v="pdf"' + (SH.fmt === 'pdf' ? ' class="on"' : '') + '>PDF</button><button data-v="kml"' + (SH.fmt === 'kml' ? ' class="on"' : '') + '>KML</button></div>' +
      '<div class="h" style="margin-top:10px">JUDUL TAMBAHAN (BOLEH KOSONG)</div><input type="text" id="shT" maxlength="60" placeholder="Kosong = hanya nama blok" value="' + esc(SH.title) + '" style="width:100%">' +
      '<div class="h" style="margin-top:10px">KATEGORI YANG DIBAGIKAN</div><div class="plist" id="shCats">' + catRows() + '</div>' +
      '<div id="shEd" style="display:none">' +
      '<div id="shP"><div class="h" style="margin-top:10px">SEKELILING BLOK DI PDF</div><div class="seg" id="shB">' + [10, 15, 20].map(function (v) { return '<button data-v="' + v + '"' + (HA.tandaBufM() === v ? ' class="on"' : '') + '>' + v + ' m</button>'; }).join('') + '</div>' +
      '<div class="plist" style="margin-top:8px"><label><input type="checkbox" id="shN"' + (SH.nama ? ' checked' : '') + '> Nama tanda</label><label><input type="checkbox" id="shV"' + (SH.nilai ? ' checked' : '') + '> Nilai (ha atau meter)</label></div>' +
      '<div class="h" style="margin-top:10px">UKURAN TEKS</div><div class="seg" id="shS">' + [['a', 'Otomatis'], ['s', 'Kecil'], ['m', 'Sedang'], ['l', 'Besar']].map(function (o) { return '<button data-v="' + o[0] + '"' + (SH.fs === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div></div></div>' +
      '<div class="muted" id="shK" style="margin-top:10px;display:none">KML berisi batas blok dan tanda persis di dalam blok, tanpa tambahan sekeliling.</div>' +
      '<button class="btn" id="shPv" style="width:100%;margin-top:12px">Preview layar penuh</button><button class="btn pri" id="shGo" style="width:100%;margin-top:8px;height:52px">Kirim</button><button class="btn" id="shX" style="width:100%;margin-top:8px">Tutup</button>');
    function seg(id, f) { $(id).onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-v]'); if (!b) return; f(b.getAttribute('data-v')); $(id).querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); }; }
    function grab() { SH.title = $('shT').value.trim(); SH.nama = $('shN').checked; SH.nilai = $('shV').checked; }
    function pitems(b) { return selItems(b, pre).filter(function (it) { return SH.cats[HA.tandaCatKey(it)]; }); }
    function groupsOf(ls) { return ls.map(function (b) { return { title: SH.title, items: pitems(b), blk: b }; }); }
    function opts() { return { nama: SH.nama, nilai: SH.nilai, fs: SH.fs }; }
    function pdfBytes() { grab(); return BT.buildPdf(groupsOf(list), opts()); }
    // preview mini: halaman pertama saja
    function thumb() {
      if (SH.fmt !== 'pdf') return;
      grab(); var id = ++seq; $('shPm').style.display = ''; $('shPm').textContent = 'Menyusun preview…';
      BT.buildPdf(groupsOf(list.slice(0, 1)), opts()).then(function (b) {
        if (id !== seq || !$('shCv')) return null;
        return HA.pdfThumb(b, $('shCv'), Math.min(window.innerWidth - 34, 560), window.innerHeight * 0.38).then(function () { if (id === seq && $('shPm')) $('shPm').style.display = 'none'; });
      }).catch(function (e) { if (id === seq && $('shPm')) $('shPm').textContent = 'Preview tidak tersedia (' + (e && e.message || e) + '). Anda tetap bisa membagikan.'; });
    }
    function lazyThumb() { clearTimeout(tmr); tmr = setTimeout(thumb, 450); }
    // cek citra satelit yang belum tersimpan (hanya PDF)
    function warn() {
      var w = $('shW'); if (!w) return;
      if (SH.fmt !== 'pdf') { w.style.display = 'none'; return; }
      var buf = HA.tandaBufM(), set = {}, urls = [];
      list.forEach(function (b) { var bb = HA.tandaPageBox(selItems(b, pre), b, { buf: buf }); tileUrls(bb).forEach(function (u) { if (!set[u]) { set[u] = 1; urls.push(u); } }); });
      total = urls.length;
      if (total > 900) { w.style.display = 'none'; return; }
      checkUrls(urls).then(function (m) {
        if (!$('shW')) return; miss = m;
        if (!m.length) { w.style.display = 'none'; return; }
        w.style.display = 'flex';
        w.innerHTML = '<span>Citra satelit belum tersimpan (' + m.length + ' dari ' + total + ' kotak). Bagian itu akan kosong di PDF.</span><button class="btn sm pri" id="shDl">' + IC.down + '<span>Unduh ≈ ' + mbMB(m.length) + ' MB</span></button>';
        $('shDl').onclick = function () {
          w.innerHTML = '<span id="shDp">Mengunduh 0/' + m.length + '…</span>';
          dl(m, function (a, t) { if ($('shDp')) $('shDp').textContent = 'Mengunduh ' + a + '/' + t + '…'; }, function (fail) {
            toast(fail ? 'Selesai, ' + fail + ' kotak gagal (cek internet)' : 'Citra satelit tersimpan');
            warned = false; warn(); thumb();
          });
        };
      });
    }
    function sync() { $('shEd').querySelector('#shP').style.display = SH.fmt === 'pdf' ? '' : 'none'; $('shK').style.display = SH.fmt === 'kml' ? '' : 'none'; $('shPv').style.display = SH.fmt === 'pdf' ? '' : 'none'; $('shPvw').style.display = $('shHint').style.display = SH.fmt === 'pdf' ? '' : 'none'; if (SH.fmt !== 'pdf') $('shEd').style.display = 'none'; }
    seg('shF', function (v) { SH.fmt = v; sync(); warn(); thumb(); });
    seg('shB', function (v) { S.settings.tdBuf = +v; HA.saveSettings(); warned = false; warn(); thumb(); });
    seg('shS', function (v) { SH.fs = v; thumb(); });
    $('shN').onchange = $('shV').onchange = thumb;
    $('shT').oninput = lazyThumb;
    $('shCats').onchange = function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (k) { SH.cats[k] = e.target.checked; thumb(); } };
    $('shPvw').onclick = function () { var ed = $('shEd'), open = ed.style.display === 'none'; ed.style.display = open ? '' : 'none'; $('shHint').textContent = open ? 'Ketuk gambar lagi untuk menutup pengaturan' : 'Ketuk gambar untuk mengubah tampilan'; if (open) { try { ed.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (x) {} } };
    sync(); warn(); thumb();
    var fname = function (ext, commit) { return fileName(list.length, cats.filter(function (c) { return SH.cats[c.k]; }).map(function (c) { return c.name; }), ext, commit); };
    function kmlText() {
      grab();
      var groups = list.map(function (b) { var its = pitems(b).slice(); its.unshift({ id: 'blk' + b.id, t: 'pg', pts: b.pts, name: 'Blok ' + b.name, boundary: true, col: '#FFE600' }); return { name: 'Blok ' + b.name, items: its }; });
      var all = []; groups.forEach(function (g) { g.items.forEach(function (i) { all.push(i); }); });
      return HA.tandaKml(all, SH.title || def, groups);
    }
    $('shX').onclick = function () { clearTimeout(tmr); seq++; closeSheet(); };
    $('shPv').onclick = function () { if (noCat()) { toast('Centang minimal satu kategori'); return; } var bt = $('shPv'); bt.disabled = true; pdfBytes().then(function (b) { bt.disabled = false; HA.pdfPreview(b, function () { HA.saveFile(fname('pdf', true), btoa(b), 'application/pdf'); }); }).catch(function () { bt.disabled = false; toast('Gagal menyusun PDF'); }); };
    $('shGo').onclick = function () {
      if (noCat()) { toast('Centang minimal satu kategori'); return; }
      if (SH.fmt !== 'pdf') { HA.saveFile(fname('kml', true), HA.textB64(kmlText()), 'application/vnd.google-earth.kml+xml'); return; }
      if (miss.length && !warned) { warned = true; toast('Citra belum lengkap. Unduh dulu, atau ketuk Bagikan lagi untuk lanjut'); return; }
      var bt = $('shGo'); bt.disabled = true; bt.textContent = 'Menyusun PDF…';
      pdfBytes().then(function (b) { bt.disabled = false; bt.textContent = 'Kirim'; HA.saveFile(fname('pdf', true), btoa(b), 'application/pdf'); }).catch(function () { bt.disabled = false; bt.textContent = 'Kirim'; toast('Gagal menyusun PDF'); });
    };
  }
  BT.history = history; BT.byId = function (id) { return blocksC().filter(function (o) { return String(o.id) === String(id); })[0]; }; BT.selItems = selItems; BT.fileName = fileName; BT.catNamesOf = catNamesOf; BT.blocks = blocksC; BT.SH = SH; BT.deselect = deselect; BT.curBlock = function () { return cur; };
})();
