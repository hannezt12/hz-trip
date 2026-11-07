/* HZ Trip - Tanda (marking) dan Walking di SpidoMap. Penyimpanan sendiri (hz_tanda), terpisah dari blok dan pengaturan. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function saveFile() { return HA.saveFile.apply(this, arguments); }
  function textB64() { return HA.textB64.apply(this, arguments); }
  HA.tandaFree = function () { modeOn(); }; HA.tandaBrush = function () { return brush(); }; HA.tandaSave = function () { save(); }; HA.tandaClick = function (ev) { onMapClick(ev); }; HA.tandaEdCancel = function () { edCancel(); }; HA.tandaDraw = function () { drawAll(); }; HA.tandaUndo = undoLast; HA.tandaColor = colorSheet; HA.tandaList = function (o) { listSheet(o); }; HA.tandaHud = function (t) { hud(t); }; HA.tandaNewId = function () { return newId(); }; HA.tandaAdd = function (it) { addItem(it); save(); }; HA.tandaInit = init;
  HA.pdfPreview = pdfPreview;

  var KEY = 'hz_tanda', KEYW = 'hz_tanda_wk';
  var PAL = [['Oranye', '#FF6A00'], ['Merah', '#E5484D'], ['Magenta', '#E635B0'], ['Kuning', '#FFD60A'], ['Cyan', '#00C2D1'], ['Biru', '#2F6BFF'], ['Putih', '#FFFFFF'], ['Hitam', '#111111']];
  function colorName(h) { var r = 'Warna lain'; PAL.forEach(function (c) { if (c[1].toLowerCase() === String(h).toLowerCase()) r = c[0]; }); return r; }
  function ic(p, fill) { return '<svg width="24" height="24" viewBox="0 0 24 24" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="' + (fill ? 'none' : 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  var IC = {
    pin: ic('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>'),
    line: ic('<path d="M4 18l5-9 5 6 6-10"/><circle cx="4" cy="18" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="14" cy="15" r="1.5"/><circle cx="20" cy="5" r="1.5"/>'),
    poly: ic('<path d="M5 7l9-3 5 8-4 8H6z"/><circle cx="5" cy="7" r="1.4"/><circle cx="14" cy="4" r="1.4"/><circle cx="19" cy="12" r="1.4"/><circle cx="15" cy="20" r="1.4"/><circle cx="6" cy="20" r="1.4"/>'),
    block: ic('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>'),
    walk: ic('<path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>', true),
    list: ic('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    undo: ic('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    loc: ic('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>'),
    print: ic('<path d="M7 9V3h10v6"/><path d="M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><rect x="7" y="14" width="10" height="7"/>'),
    layers: ic('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
    down: ic('<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18"/><path d="M12 11v8M9 16l3 3 3-3"/>'),
    back: ic('<path d="M15 5l-7 7 7 7"/>'),
    next: ic('<path d="M9 5l7 7-7 7"/>'),
    prev: ic('<path d="M15 5l-7 7 7 7"/>'),
    close: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
    redo: ic('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
    check: ic('<path d="M5 12l5 5 9-10"/>'),
    eye: ic('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    save: ic('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
    search: ic('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>'),
    share: ic('<circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M8 11l8-4M8 13l8 4"/>')
  };
  function tb(id, icon, label, on, extra) { return '<button class="tbtn' + (on ? ' on' : '') + '" ' + (id ? 'id="' + id + '" ' : '') + (extra || '') + '>' + icon + '<span>' + label + '</span></button>'; }
  HA.IC = IC; HA.tb = tb;
  var TD = { on: false, tool: null, D: null, lay: null, ed: null, wk: null, bound: false, prevFollow: null, hud: null, sel: null };

  // ---------- penyimpanan terpisah ----------
  function defCats() { return [{ id: 'c1', name: 'Perlu cek', col: PAL[0][1] }, { id: 'c2', name: 'Dalam pekerjaan', col: PAL[2][1] }, { id: 'c3', name: 'Selesai', col: PAL[3][1] }, { id: 'c4', name: 'Catatan', col: PAL[4][1] }]; }
  function data() {
    if (TD.D) return TD.D;
    var d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.items)) d = { v: 1, cats: defCats(), items: [], brush: { cat: 'c1', col: null }, seq: 1 };
    if (!Array.isArray(d.cats)) d.cats = defCats();
    if (!d.brush) d.brush = { cat: null, col: PAL[0][1] };
    if (d.brush.cat) { var bc = null; d.cats.forEach(function (c) { if (c.id === d.brush.cat) bc = c; }); d.brush = { cat: null, col: bc ? bc.col : PAL[0][1] }; }
    TD.D = d; return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(TD.D)); } catch (e) { toast('Gagal menyimpan marking'); } hsPush(); }
  // riwayat urung/ulang (hanya saat satu blok dipilih)
  var HS = null;
  function hsInit(on) { HS = on ? { s: [JSON.stringify(data().items)], i: 0 } : null; }
  function hsPush() { if (!HS) return; var s = JSON.stringify(TD.D.items); if (s === HS.s[HS.i]) return; HS.s.length = HS.i + 1; HS.s.push(s); HS.i++; if (HS.s.length > 80) { HS.s.shift(); HS.i--; } }
  function setItems(str) { TD.D.items = JSON.parse(str); try { localStorage.setItem(KEY, JSON.stringify(TD.D)); } catch (e) {} drawAll(); }
  function hsGo(d) {
    if (!HS) return; var j = HS.i + d;
    if (j < 0 || j >= HS.s.length) { toast(d < 0 ? 'Tidak ada yang diurungkan' : 'Tidak ada yang diulang'); return; }
    HS.i = j; setItems(HS.s[j]); if (HA.BT) HA.BT.refresh(); barMain();
  }
  HA.tandaHsInit = hsInit; HA.tandaSetItems = setItems;
  function catOf(id) { var r = null; data().cats.forEach(function (c) { if (c.id === id) r = c; }); return r; }
  function colOf(it) { var c = it.cat ? catOf(it.cat) : null; return c ? c.col : (it.col || PAL[0][1]); }
  function brush() {
    var b = data().brush, c = b.cat ? catOf(b.cat) : null;
    if (c) return { cat: c.id, col: null, color: c.col, name: c.name };
    var cl = b.col || PAL[0][1];
    return { cat: null, col: cl, color: cl, name: colorName(cl) };
  }
  function addItem(it) { data().items.push(it); return it; }
  function undoLast() { if (TD.ed) edUndo(); else hsGo(-1); }
  function redoLast() { if (TD.ed) edRedo(); else hsGo(1); }
  HA.tandaRedo = redoLast;
  function newId() { var d = data(); d.seq = (d.seq || 1) + 1; return 't' + Date.now().toString(36) + d.seq; }

  // ---------- geometri dan hitungan ----------
  function fmtHa(v) { return v.toFixed(2).replace('.', ','); }
  function ribu(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmtM(v) { return ribu(v) + ' m'; }
  function lenXY(xy, closed) { var s = 0, i, n = xy.length; for (i = 1; i < n; i++) s += Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]); if (closed && n > 2) s += Math.hypot(xy[0][0] - xy[n - 1][0], xy[0][1] - xy[n - 1][1]); return s; }
  function lenLL(pts, closed) { if (pts.length < 2) return 0; var P = HzBlok.proj(pts[0][0], pts[0][1]); return lenXY(pts.map(P.xy), closed); }
  function bboxOf(pts) { var s = 90, w = 180, n = -90, e = -180; pts.forEach(function (p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; }); return [s, w, n, e]; }
  function bbHit(a, b) { return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]); }
  function pipXY(x, y, xy) { var ins = false, i, j; for (i = 0, j = xy.length - 1; i < xy.length; j = i++) { if ((xy[i][1] > y) !== (xy[j][1] > y) && x < (xy[j][0] - xy[i][0]) * (y - xy[i][1]) / (xy[j][1] - xy[i][1]) + xy[i][0]) ins = !ins; } return ins; }
  // panjang ruas a-b yang berada di dalam poligon xy
  function insideLen(a, b, xy) {
    var ts = [0, 1], dx = b[0] - a[0], dy = b[1] - a[1], n = xy.length, i, tot = 0;
    for (i = 0; i < n; i++) {
      var c = xy[i], d = xy[(i + 1) % n], ex = d[0] - c[0], ey = d[1] - c[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      var t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / den, u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort(function (p, q) { return p - q; });
    var L = Math.hypot(dx, dy);
    for (i = 0; i + 1 < ts.length; i++) {
      var tm = (ts[i] + ts[i + 1]) / 2;
      if (pipXY(a[0] + dx * tm, a[1] + dy * tm, xy)) tot += (ts[i + 1] - ts[i]) * L;
    }
    return tot;
  }
  var rcache = {};
  function rowsOf(b) {
    var k = [b.id, b.dir, b.sp, b.margin, b.pts.length, b.pts[0][0], b.pts[0][1], (HA.cutsFor ? (HA.cutsFor(b) || []).length : 0)].join('|');
    if (!rcache[k]) { var ks = Object.keys(rcache); if (ks.length > 60) delete rcache[ks[0]]; try { rcache[k] = HzBlok.rowsStraight(b.pts, b.dir, +(b.sp || S.settings.rowSp || 1.5), +b.margin || 0, HA.cutsFor ? HA.cutsFor(b) : []); } catch (e) { rcache[k] = null; } }
    return rcache[k];
  }
  function blks() { try { return HA.blocksList() || []; } catch (e) { return []; } }
  function statOf(it) {
    if (it.t === 'pt') return {};
    if (it.t === 'ln') return { m: lenLL(it.pts, false) };
    var P = HzBlok.proj(it.pts[0][0], it.pts[0][1]), xy = it.pts.map(P.xy), r = { ha: HzBlok.areaHa(it.pts), m: lenXY(xy, true), n: 0, lm: 0 }, bb = bboxOf(it.pts);
    if (it.full && it.bid != null) {
      var fb = null; blks().forEach(function (b) { if (String(b.id) === String(it.bid)) fb = b; });
      if (fb && fb.conf && fb.dir != null) { var fr = rowsOf(fb); if (fr) { r.n = fr.n; r.lm = fr.total; return r; } }
    }
    var seen = {};
    blks().forEach(function (b) {
      if (!b.conf || b.dir == null || !b.pts || b.pts.length < 3) return;
      if (!bbHit(bboxOf(b.pts), bb)) return;
      var rr = rowsOf(b); if (!rr) return;
      rr.lines.forEach(function (sg, i) {
        var a = P.xy(sg[0]), c = P.xy(sg[1]), L = insideLen(a, c, xy);
        if (L > 0.3) { r.lm += L; seen[b.id + ':' + rr.lk[i]] = 1; }
      });
    });
    r.n = Object.keys(seen).length; return r;
  }
  function statText(it, st) {
    if (it.t === 'pt') return 'Titik';
    if (it.t === 'ln') return fmtM(st.m);
    var s = fmtHa(st.ha) + ' ha · keliling ' + fmtM(st.m);
    if (st.n > 0) s += '\n' + ribu(st.n) + ' lajur · ' + fmtM(st.lm);
    return s;
  }
  function dpSimplify(xy, tol) {
    if (xy.length < 3) return xy.map(function (_, i) { return i; });
    var keep = {}, st = [[0, xy.length - 1]]; keep[0] = 1; keep[xy.length - 1] = 1;
    while (st.length) {
      var r = st.pop(), a = xy[r[0]], b = xy[r[1]], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, md = 0, mi = -1, i;
      for (i = r[0] + 1; i < r[1]; i++) {
        var t = l2 ? Math.max(0, Math.min(1, ((xy[i][0] - a[0]) * dx + (xy[i][1] - a[1]) * dy) / l2)) : 0, d = Math.hypot(xy[i][0] - (a[0] + t * dx), xy[i][1] - (a[1] + t * dy));
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol && mi > 0) { keep[mi] = 1; st.push([r[0], mi], [mi, r[1]]); }
    }
    return Object.keys(keep).map(Number).sort(function (p, q) { return p - q; });
  }

  // ---------- peta: lapisan tanda ----------
  function map() { return HA.SP && HA.SP.map; }
  function bar() { return $('tdBar'); }
  function ensureLay() { if (TD.lay && TD.layMap !== map()) { try { TD.lay.remove(); } catch (e) {} TD.lay = null; } if (!TD.lay && map()) { TD.lay = L.layerGroup().addTo(map()); TD.layMap = map(); } return TD.lay; }
  function drawAll() {
    var m = map(); if (!m || !TD.on) return;
    ensureLay().clearLayers();
    data().items.forEach(function (it) {
      if (TD.ed && TD.ed.item && TD.ed.item.id === it.id) return;
      var col = colOf(it), l;
      if (it.t === 'pt') l = L.circleMarker(it.pts[0], { radius: 8, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 });
      else if (it.t === 'ln') l = L.polyline(it.pts, { color: col, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' });
      else l = L.polygon(it.pts, { color: col, weight: 2.5, fillColor: col, fillOpacity: 0.35 });
      if (it.name) l.bindTooltip(esc(it.name), { permanent: true, direction: 'center', className: 'lktip' });
      l.on('click', function (ev) { if (TD.tool || TD.ed || TD.wk) { return; } L.DomEvent.stopPropagation(ev); itemSheet(it); });
      l.addTo(TD.lay);
    });
    if (HA.BT && TD.blk) HA.BT.refresh();
  }
  function fitItem(it) { var m = map(); if (!m) return; if (it.t === 'pt') m.setView(it.pts[0], Math.max(m.getZoom(), 18), { animate: false }); else m.fitBounds(L.latLngBounds(it.pts), { padding: [40, 40], maxZoom: 19, animate: false }); }

  // ---------- mode marking ----------
  function setOverlays(on) {
    var m = map(); if (!m) return;
    m._forceOvl = on;
    if (HA.syncOverlays) HA.syncOverlays(m);
  }
  function modeOn() {
    if (!HA.spShow) return;
    TD.on = true; TD.blk = null; TD.bm = null; data();
    HA.spShow('map');
    var m = map();
    if (!m) { setTimeout(modeOn, 300); return; }
    if (TD.prevFollow == null) TD.prevFollow = HA.SP.follow;
    HA.SP.follow = false; HA.SP.autoPaused = true;
    if (!TD.bound) { m.on('click', onMapClick); TD.bound = true; }
    setOverlays(true); ensureLay(); drawAll();
    $('spBar').style.display = 'none'; $('tdBar').style.display = 'flex'; $('spTanda').classList.add('on');
    if (HA.BT) HA.BT.enter();
    barMain(); if (!HA.BT) hud('');
    // jika ada draf walking yang belum disimpan
    var dr = null; try { dr = JSON.parse(localStorage.getItem(KEYW) || 'null'); } catch (e) {}
    if (dr && dr.pts && dr.pts.length > 1 && !TD.wk) {
      askConfirm('Ada rekaman walking yang belum disimpan', dr.pts.length + ' titik tercatat. Simpan sebagai garis marking?', 'Simpan', function () { wkFinish(dr.pts); });
    }
  }
  function modeOff() {
    if (TD.wk) { toast('Hentikan walking dulu'); return; }
    if (HA.BT) HA.BT.exit(modeOffNow); else modeOffNow();
  }
  HA.tandaOff = modeOff;
  function modeOffNow() {
    edCancel(); if (HA.BT) HA.BT.leave(); TD.tool = null; TD.on = false;
    if (TD.lay) { TD.lay.clearLayers(); }
    setOverlays(false);
    $('tdBar').style.display = 'none'; $('spBar').style.display = ''; $('spTanda').classList.remove('on'); hud('');
    if (TD.prevFollow != null) { HA.SP.follow = TD.prevFollow; TD.prevFollow = null; }
    HA.SP.autoPaused = false;
    if (HA.spBtns) HA.spBtns();
  }
  function hud(t) { var h = $('tdHud'); if (!h) return; h.textContent = t || ''; h.style.display = t ? 'block' : 'none'; }

  // ---------- bilah bawah ----------
  var TOOLS = [['pt', 'pin', 'Titik'], ['ln', 'line', 'Garis'], ['pg', 'poly', 'Area'], ['wk', 'walk', 'Walking']];
  function barMain() {
    if (HA.BT) { HA.BT.bar(); return; }
    var b = brush();
    bar().innerHTML = '<div class="tdr">' + TOOLS.map(function (t) { return tb(null, IC[t[1]], t[2], TD.tool === t[0], 'data-t="' + t[0] + '"'); }).join('') + '</div>' +
      '<div class="tdr">' + tb('tdBr', '<i class="cdot" style="background:' + b.color + '"></i>', b.name) + tb('tdLs', IC.list, 'Daftar') + tb('tdXm', IC.close, 'Tutup') + '</div>';
    bar().querySelectorAll('[data-t]').forEach(function (e) { e.onclick = function () { pickTool(e.getAttribute('data-t')); }; });
    $('tdBr').onclick = function () { colorSheet(function (v) { var d = data(); d.brush = { cat: null, col: v.col }; save(); barMain(); }); };
    $('tdLs').onclick = function () { listSheet(); };
    $('tdXm').onclick = modeOff;
    if (TD.tool === 'pt') hud('Ketuk peta untuk menaruh titik'); else if (TD.tool === 'bl') hud('Ketuk di dalam blok untuk mewarnai utuh');
  }
  HA.tandaBar = barMain;
  function pickTool(t) {
    if (TD.ed) edCancel();
    if (t === 'wk') { TD.tool = null; wkStart(); return; }
    TD.tool = TD.tool === t ? null : t;
    if (TD.tool === 'ln' || TD.tool === 'pg') { edStart(TD.tool, null); return; }
    barMain(); if (!TD.tool) hud('');
  }
  HA.tandaPick = pickTool;

  // ---------- gambar dan edit bentuk (titik sudut bisa digeser, ditambah, dihapus) ----------
  function vIcon(mid) { return L.divIcon({ className: 'tdv', html: '<i class="' + (mid ? 'mid' : '') + '"></i>', iconSize: mid ? [18, 18] : [28, 28], iconAnchor: mid ? [9, 9] : [14, 14] }); }
  function edStart(kind, item) {
    edCancel();
    TD.ed = { red: [], kind: kind, item: item, pts: item ? item.pts.map(function (p) { return [p[0], p[1]]; }) : [], vm: [], shape: null };
    drawAll(); edRender(); edBar();
  }
  function edMin() { return TD.ed.kind === 'ln' ? 2 : 3; }
  function edStatus() {
    var e = TD.ed; if (!e) return;
    if (e.kind === 'ln') hud(e.pts.length < 2 ? 'Ketuk peta untuk menambah titik' : 'Garis ' + fmtM(lenLL(e.pts, false)));
    else if (e.pts.length < 3) hud('Ketuk peta untuk menambah titik sudut');
    else { var P = HzBlok.proj(e.pts[0][0], e.pts[0][1]); hud('Area ' + fmtHa(HzBlok.areaHa(e.pts)) + ' ha · ' + fmtM(lenXY(e.pts.map(P.xy), true))); }
  }
  function edShape() {
    var e = TD.ed, m = map(), col = e.item ? colOf(e.item) : brush().color;
    if (e.shape) { m.removeLayer(e.shape); e.shape = null; }
    if (e.pts.length >= 2) e.shape = (e.kind === 'pg' && e.pts.length >= 3 ? L.polygon(e.pts, { color: col, weight: 3, fillColor: col, fillOpacity: 0.3, interactive: false }) : L.polyline(e.pts, { color: col, weight: 4, interactive: false })).addTo(m);
  }
  function edRender() {
    var e = TD.ed, m = map(); if (!e) return;
    e.vm.forEach(function (x) { m.removeLayer(x); }); e.vm = [];
    edShape();
    var closed = e.kind === 'pg';
    e.pts.forEach(function (p, i) {
      var mk = L.marker(p, { icon: vIcon(false), draggable: true, keyboard: false, zIndexOffset: 800 }).addTo(m);
      mk.on('drag', function () { var ll = mk.getLatLng(); e.pts[i] = [ll.lat, ll.lng]; edShape(); edStatus(); });
      mk.on('dragend', function () { edRender(); });
      mk.on('click', function (ev) { L.DomEvent.stopPropagation(ev); if (e.pts.length > edMin()) { e.pts.splice(i, 1); edRender(); } else toast('Titik minimal ' + edMin()); });
      e.vm.push(mk);
      var j = i + 1; if (j >= e.pts.length) { if (!closed || e.pts.length < 3) return; j = 0; }
      var q = e.pts[j], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], mm = L.marker(mid, { icon: vIcon(true), keyboard: false, zIndexOffset: 700 }).addTo(m);
      mm.on('click', function (ev) { L.DomEvent.stopPropagation(ev); e.pts.splice(i + 1, 0, mid); edRender(); });
      e.vm.push(mm);
    });
    edStatus();
  }
  function edUndo() { var e = TD.ed; if (!e || !e.pts.length) { toast('Tidak ada titik untuk diurungkan'); return; } e.red.push(e.pts.pop()); edRender(); }
  function edRedo() { var e = TD.ed; if (!e || !e.red.length) { toast('Tidak ada yang diulang'); return; } e.pts.push(e.red.pop()); edRender(); }
  function edBar() {
    var e = TD.ed;
    bar().innerHTML = '<div class="tdr">' + tb('tdUr', IC.undo, 'Urung') + tb('tdRd', IC.redo, 'Ulang') + tb('tdOk', IC.check, 'Simpan bentuk', true) + tb('tdBt', IC.close, 'Batal') + '</div>' +
      '<div class="tdr"><button class="tbtn wide" id="tdCl"><i class="cdot" style="background:' + (e.item ? colOf(e.item) : brush().color) + '"></i><span>Warna: ' + esc(e.item ? colorName(colOf(e.item)) : brush().name) + '</span></button></div>';
    $('tdUr').onclick = edUndo; $('tdRd').onclick = edRedo;
    $('tdBt').onclick = function () { edCancel(); TD.tool = null; barMain(); };
    $('tdOk').onclick = edDone;
    $('tdCl').onclick = function () { colorSheet(function (v) { if (e.item) { e.item.cat = null; e.item.col = v.col; } else { var d = data(); d.brush = { cat: null, col: v.col }; } save(); edShape(); edBar(); }); };
  }
  function edCancel() {
    var e = TD.ed, m = map(); if (!e) return;
    e.vm.forEach(function (x) { m.removeLayer(x); }); if (e.shape) m.removeLayer(e.shape);
    TD.ed = null; hud(''); drawAll();
  }
  function edDone() {
    var e = TD.ed; if (!e) return;
    if (e.pts.length < edMin()) { toast(e.kind === 'ln' ? 'Garis butuh minimal 2 titik' : 'Area butuh minimal 3 titik'); return; }
    var d = data(), msg;
    if (e.item) { e.item.pts = e.pts; e.item.t = e.kind; if (e.item.full) { e.item.full = false; e.item.bid = null; } msg = 'Bentuk diperbarui'; }
    else {
      var b = brush(), it = { id: newId(), t: e.kind, pts: e.pts, cat: b.cat, col: b.col, name: '', note: '', ts: Date.now() };
      addItem(it); e.item = it; msg = (e.kind === 'ln' ? 'Garis ' : 'Area ') + 'tersimpan';
    }
    var it2 = e.item, st = statOf(it2);
    save(); TD.ed = null; hud(''); edCleanup(e); drawAll();
    toast(msg + ' · ' + statText(it2, st).replace('\n', ' · '));
    if (e.reopen) { itemSheet(it2); TD.tool = null; barMain(); return; }
    TD.tool = null; barMain();
  }
  function edCleanup(e) { var m = map(); e.vm.forEach(function (x) { m.removeLayer(x); }); if (e.shape) { m.removeLayer(e.shape); e.shape = null; } }

  function onMapClick(ev) {
    if (!TD.on) return;
    var ll = [ev.latlng.lat, ev.latlng.lng];
    if (TD.wk) return;
    if (HA.BT && HA.BT.tap(ll)) return;
    if (TD.ed) { TD.ed.pts.push(ll); TD.ed.red = []; edRender(); return; }
    if (TD.tool === 'pt') {
      var b = brush(), it = { id: newId(), t: 'pt', pts: [ll], cat: b.cat, col: b.col, name: '', note: '', ts: Date.now() };
      addItem(it); save(); drawAll(); toast('Titik ditambah'); return;
    }
    if (TD.wk) return;
  }
  function markBlock(ll) {
    var hit = null, ha0 = 1e18;
    blks().forEach(function (b) {
      if (!b.pts || b.pts.length < 3) return;
      var bb = bboxOf(b.pts); if (ll[0] < bb[0] || ll[0] > bb[2] || ll[1] < bb[1] || ll[1] > bb[3]) return;
      var P = HzBlok.proj(ll[0], ll[1]), xy = b.pts.map(P.xy);
      if (pipXY(0, 0, xy)) { var a = HzBlok.areaHa(b.pts); if (a < ha0) { ha0 = a; hit = b; } }
    });
    if (!hit) { toast('Tidak ada blok di titik itu'); return; }
    var dup = data().items.filter(function (i) { return i.full && String(i.bid) === String(hit.id); })[0];
    if (dup) { toast('Blok ' + hit.name + ' sudah ditandai'); itemSheet(dup); return; }
    var b = brush(), it = { id: newId(), t: 'pg', pts: hit.pts.map(function (p) { return [p[0], p[1]]; }), cat: b.cat, col: b.col, name: String(hit.name || ''), note: '', bid: hit.id, full: true, ts: Date.now() };
    addItem(it); save(); drawAll();
    var st = statOf(it); toast('Blok ' + it.name + ' · ' + statText(it, st).replace('\n', ' · '));
  }

  // ---------- kategori dan warna ----------
  function swatches(id, sel) { return PAL.map(function (c) { return '<button class="tdsw' + (sel && sel.toLowerCase() === c[1].toLowerCase() ? ' on' : '') + '" data-col="' + c[1] + '" title="' + c[0] + '" style="background:' + c[1] + '"><span>' + c[0] + '</span></button>'; }).join(''); }
  function colorSheet(onPick, back, cur) {
    openSheet('<div class="grab"></div><div class="st">WARNA TANDA</div><div class="tdsws" id="tdPal">' + swatches('p', cur || brush().color) + '</div><button class="btn" id="tdCx" style="width:100%;margin-top:12px">Tutup</button>');
    $('sheet').querySelectorAll('#tdPal [data-col]').forEach(function (e) { e.onclick = function () { closeSheet(); onPick({ cat: null, col: e.getAttribute('data-col') }); }; });
    $('tdCx').onclick = function () { closeSheet(); if (back) back(); };
  }
  var catSheet = colorSheet;
  // ---------- panel satu tanda ----------
  function typeName(t) { return t === 'pt' ? 'TITIK' : (t === 'ln' ? 'GARIS' : 'AREA'); }
  function itemSheet(it) {
    var st = statOf(it), c = it.cat ? catOf(it.cat) : null;
    var lines = it.t === 'pt' ? it.pts[0][0].toFixed(6) + ', ' + it.pts[0][1].toFixed(6) : statText(it, st);
    openSheet('<div class="grab"></div><div class="st">' + typeName(it.t) + (it.full ? ' · BLOK UTUH' : '') + '</div>' +
      '<div class="bnm"><input type="text" id="tiN" maxlength="40" placeholder="Nama (boleh kosong)" value="' + esc(it.name || '') + '"></div>' +
      '<div class="card" style="white-space:pre-line">' + esc(lines) + '</div>' +
      '<div class="h" style="margin-top:10px">WARNA</div><button class="btn tdbr" id="tiC" style="width:100%"><i style="background:' + colOf(it) + '"></i>' + esc(colorName(colOf(it))) + '</button>' +
      '<div class="h" style="margin-top:10px">CATATAN</div><div class="bnm"><input type="text" id="tiNt" maxlength="120" value="' + esc(it.note || '') + '"></div>' +
      '<div class="opts" style="margin-top:10px"><button class="opt" id="tiZ">Zoom ke sini</button>' + (it.t !== 'pt' ? '<button class="opt" id="tiE">Edit bentuk</button>' : '<button class="opt" id="tiE">Geser titik</button>') + (it.t === 'ln' && it.pts.length >= 3 ? '<button class="opt" id="tiV">Jadikan area</button>' : '') + (it.t === 'pg' ? '<button class="opt" id="tiV">Jadikan garis</button>' : '') + '</div>' +
      '<button class="btn" id="tiD" style="width:100%;margin-top:10px">Hapus</button><button class="btn pri" id="tiX" style="width:100%;margin-top:8px">Selesai</button>');
    function keep() { it.name = $('tiN').value.trim(); it.note = $('tiNt').value.trim(); save(); drawAll(); }
    $('tiX').onclick = function () { keep(); closeSheet(); };
    $('tiC').onclick = function () { keep(); colorSheet(function (v) { it.cat = null; it.col = v.col; save(); drawAll(); itemSheet(it); }, function () { itemSheet(it); }, colOf(it)); };
    $('tiZ').onclick = function () { keep(); closeSheet(); fitItem(it); };
    $('tiE').onclick = function () {
      keep(); closeSheet();
      if (it.t === 'pt') { TD.tool = null; pointMove(it); return; }
      TD.tool = null; edStart(it.t, it); TD.ed.reopen = true; fitItem(it);
    };
    if ($('tiV')) $('tiV').onclick = function () {
      keep();
      if (it.t === 'ln') { it.t = 'pg'; it.full = false; it.bid = null; } else { it.t = 'ln'; it.pts = it.pts.concat([it.pts[0]]); it.full = false; it.bid = null; }
      save(); drawAll(); itemSheet(it);
    };
    $('tiD').onclick = function () { askConfirm('Hapus tanda ini?', 'Tidak bisa dibatalkan.', 'Hapus', function () { var d = data(); d.items = d.items.filter(function (x) { return x !== it; }); save(); drawAll(); closeSheet(); }); };
  }
  function pointMove(it) {
    var m = map(); toast('Ketuk lokasi baru untuk titik ini');
    TD.tool = 'mv';
    var h = function (ev) { m.off('click', h); it.pts = [[ev.latlng.lat, ev.latlng.lng]]; save(); TD.tool = null; drawAll(); barMain(); };
    setTimeout(function () { m.on('click', h); }, 50);
  }

  // ---------- daftar dan ringkasan ----------
  function summary(list) {
    var d = data(), g = {}, order = [];
    (list || d.items).forEach(function (it) {
      var c = it.cat ? catOf(it.cat) : null, k = c ? c.id : 'x' + colOf(it).toLowerCase();
      if (!g[k]) { g[k] = { name: c ? c.name : colorName(colOf(it)), col: colOf(it), n: 0, pt: 0, ha: 0, lj: 0, lm: 0, m: 0 }; order.push(k); }
      var r = g[k], st = statOf(it); r.n++;
      if (it.t === 'pt') r.pt++; else if (it.t === 'ln') r.m += st.m; else { r.ha += st.ha; r.lj += st.n; r.lm += st.lm; }
    });
    return order.map(function (k) { return g[k]; });
  }
  function sumLine(r) { var a = []; if (r.pt) a.push(r.pt + ' titik'); if (r.m) a.push(fmtM(r.m) + ' garis'); if (r.ha) a.push(fmtHa(r.ha) + ' ha'); if (r.lj) a.push(ribu(r.lj) + ' lajur · ' + fmtM(r.lm)); return a.join(' · ') || '-'; }
  function listSheet(only) {
    var d = data(), src = only || d.items, sm = summary(src);
    openSheet('<div class="grab"></div><div class="st">DAFTAR MARKING</div>' +
      (sm.length ? '<div class="h">RINGKASAN</div>' + sm.map(function (r) { return '<div class="tdli"><i class="tdd" style="background:' + r.col + '"></i><b>' + esc(r.name) + '</b> <span class="muted">· ' + r.n + ' · ' + esc(sumLine(r)) + '</span></div>'; }).join('') +
        '<div class="h" style="margin-top:12px">TANDA</div><div id="tdIt">' + src.slice().reverse().map(function (it) { var st = statOf(it); return '<button class="tdli tdb" data-i="' + it.id + '"><i class="tdd" style="background:' + colOf(it) + '"></i><b>' + esc(it.name || typeName(it.t)) + '</b> <span class="muted">· ' + esc(statText(it, st).replace('\n', ' · ')) + '</span></button>'; }).join('') + '</div>' : '<div class="card muted">Belum ada tanda. Pilih alat lalu ketuk peta.</div>') +
      '<div class="opts" style="margin-top:12px"><button class="opt" id="tlK">Ekspor KML</button><button class="opt" id="tlI">Impor KML</button><button class="opt" id="tlP">Cetak PDF</button></div>' +
      (src.length ? '<button class="btn" id="tlD" style="width:100%;margin-top:10px">Hapus semua tanda</button>' : '') + '<button class="btn pri" id="tlX" style="width:100%;margin-top:8px">Tutup</button>');
    $('tlX').onclick = closeSheet;
    $('sheet').querySelectorAll('#tdIt [data-i]').forEach(function (e) { e.onclick = function () { var it = data().items.filter(function (x) { return x.id === e.getAttribute('data-i'); })[0]; if (it) { closeSheet(); fitItem(it); itemSheet(it); } }; });
    $('tlK').onclick = function () { if (!src.length) { toast('Belum ada tanda'); return; } closeSheet(); saveFile('Marking_HZTrip_' + stamp() + '.kml', textB64(buildKml(src)), 'application/vnd.google-earth.kml+xml'); };
    $('tlI').onclick = importPick;
    $('tlP').onclick = function () { if (!src.length) { toast('Belum ada tanda'); return; } printSheet(src); };
    if ($('tlD')) $('tlD').onclick = function () { askConfirm('Hapus semua tanda' + (only ? ' di blok ini' : '') + '?', src.length + ' tanda dihapus.', 'Hapus', function () { var ids = {}; src.forEach(function (x) { ids[x.id] = 1; }); d.items = d.items.filter(function (x) { return !ids[x.id]; }); save(); drawAll(); closeSheet(); if (HA.BT) HA.BT.refresh(); }); };
  }
  function stamp() { var t = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()); }

  // ---------- KML (tukar dengan Google Earth, Avenza, QField) ----------
  function xe(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kmlCol(hex, a) { var h = hex.replace('#', ''); return a + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); }
  function buildKml(listItems, title, groupsIn) {
    var d = data(), cols = {}, all = listItems || d.items;
    all.forEach(function (it) { cols[colOf(it)] = 1; });
    var x = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + xe(title || ('Marking HZ Trip ' + stamp())) + '</name>';
    Object.keys(cols).forEach(function (c) {
      var id = 'c' + c.replace('#', '');
      x += '<Style id="' + id + '"><IconStyle><color>' + kmlCol(c, 'ff') + '</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.9</scale></LabelStyle><LineStyle><color>' + kmlCol(c, 'ff') + '</color><width>3</width></LineStyle><PolyStyle><color>' + kmlCol(c, '66') + '</color></PolyStyle></Style>';
    });
    function ring(pts) { var a = pts.map(function (p) { return (+p[1]).toFixed(7) + ',' + (+p[0]).toFixed(7) + ',0'; }); a.push(a[0]); return a.join(' '); }
    function pm(it) {
      var st = statOf(it), c = it.cat ? catOf(it.cat) : null, col = colOf(it);
      if (it.boundary) return '<Placemark><name>' + xe(it.name || '') + '</name><description>Batas blok</description><Style><LineStyle><color>ff00d6ff</color><width>2.5</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style><ExtendedData><Data name="hz_type"><value>blk</value></Data></ExtendedData><Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>' + ring(it.pts) + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>';
      var s = '<Placemark><name>' + xe(it.name || '') + '</name><description>' + xe(statText(it, st).replace('\n', ' | ') + (it.note ? ' | ' + it.note : '')) + '</description><styleUrl>#c' + col.replace('#', '') + '</styleUrl>' +
        '<ExtendedData><Data name="hz_type"><value>' + it.t + '</value></Data><Data name="hz_cat"><value>' + xe(c ? c.name : '') + '</value></Data><Data name="hz_col"><value>' + col + '</value></Data><Data name="hz_note"><value>' + xe(it.note || '') + '</value></Data>' + (it.full ? '<Data name="hz_bid"><value>' + xe(it.bid) + '</value></Data>' : '') + '</ExtendedData>';
      if (it.t === 'pt') s += '<Point><coordinates>' + (+it.pts[0][1]).toFixed(7) + ',' + (+it.pts[0][0]).toFixed(7) + ',0</coordinates></Point>';
      else if (it.t === 'ln') s += '<LineString><tessellate>1</tessellate><coordinates>' + it.pts.map(function (p) { return (+p[1]).toFixed(7) + ',' + (+p[0]).toFixed(7) + ',0'; }).join(' ') + '</coordinates></LineString>';
      else s += '<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>' + ring(it.pts) + '</coordinates></LinearRing></outerBoundaryIs></Polygon>';
      return s + '</Placemark>';
    }
    var groups = {}, order = [];
    if (groupsIn) groupsIn.forEach(function (g) { x += '<Folder><name>' + xe(g.name) + '</name>' + g.items.map(pm).join('') + '</Folder>'; });
    else {
      all.forEach(function (it) { var c = it.cat ? catOf(it.cat) : null, k = c ? c.name : colorName(colOf(it)); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(it); });
      order.forEach(function (k) { x += '<Folder><name>' + xe(k) + '</name>' + groups[k].map(pm).join('') + '</Folder>'; });
    }
    return x + '</Document></kml>';
  }
  function nearestPal(hex) {
    var h = hex.replace('#', ''), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16), best = PAL[0][1], bd = 1e9;
    PAL.forEach(function (c) { var q = c[1].replace('#', ''), dd = Math.pow(r - parseInt(q.slice(0, 2), 16), 2) + Math.pow(g - parseInt(q.slice(2, 4), 16), 2) + Math.pow(b - parseInt(q.slice(4, 6), 16), 2); if (dd < bd) { bd = dd; best = c[1]; } });
    return best;
  }
  function kmlToHex(k) { k = (k || '').trim(); if (k.length !== 8) return null; return '#' + k.slice(6, 8) + k.slice(4, 6) + k.slice(2, 4); }
  function importKml(txt) {
    var doc = new DOMParser().parseFromString(txt, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) { toast('Berkas KML tidak terbaca'); return; }
    var d = data(), added = 0, styles = {};
    function kids(el, tag) { var o = []; for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeName === tag || el.childNodes[i].localName === tag) o.push(el.childNodes[i]); return o; }
    function first(el, tag) { var l = el.getElementsByTagName(tag); return l.length ? l[0] : null; }
    Array.prototype.forEach.call(doc.getElementsByTagName('Style'), function (st) {
      var id = st.getAttribute('id'); if (!id) return;
      var cn = first(st, 'IconStyle') || first(st, 'LineStyle') || first(st, 'PolyStyle'); var c = cn && first(cn, 'color');
      var hx = c ? kmlToHex(c.textContent) : null; if (hx) styles['#' + id] = hx;
    });
    function coords(el) { return (el.textContent || '').trim().split(/\s+/).map(function (s) { var a = s.split(','); return [parseFloat(a[1]), parseFloat(a[0])]; }).filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); }); }
    Array.prototype.forEach.call(doc.getElementsByTagName('Placemark'), function (pm) {
      var ext = {}; Array.prototype.forEach.call(pm.getElementsByTagName('Data'), function (x) { var v = first(x, 'value'); ext[x.getAttribute('name')] = v ? v.textContent : ''; });
      if (ext.hz_type === 'blk') return;
      var nm = first(pm, 'name'), name = nm ? nm.textContent.trim() : '', su = first(pm, 'styleUrl'), hx = ext.hz_col || (su && styles[su.textContent.trim()]) || null;
      var par = pm.parentNode, fold = par && par.nodeName === 'Folder' ? (first(par, 'name') || {}).textContent : '';
      var color = hx ? (ext.hz_col ? hx : nearestPal(hx)) : PAL[0][1], cat = null;
      var geoms = []; ['Point', 'LineString', 'Polygon'].forEach(function (t) { Array.prototype.forEach.call(pm.getElementsByTagName(t), function (g) { geoms.push([t, g]); }); });
      geoms.forEach(function (g) {
        var t = g[0], el = g[1], pts;
        if (t === 'Polygon') { var ob = first(el, 'outerBoundaryIs'); var cc = ob && first(ob, 'coordinates'); pts = cc ? coords(cc) : []; if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop(); }
        else { var c2 = first(el, 'coordinates'); pts = c2 ? coords(c2) : []; }
        if (t === 'Point' && pts.length >= 1) pts = [pts[0]];
        var min = t === 'Point' ? 1 : (t === 'LineString' ? 2 : 3); if (pts.length < min) return;
        d.items.push({ id: newId(), t: t === 'Point' ? 'pt' : (t === 'LineString' ? 'ln' : 'pg'), pts: pts, cat: cat ? cat.id : null, col: cat ? null : color, name: name, note: ext.hz_note || '', ts: Date.now() }); added++;
      });
    });
    save(); drawAll();
    toast(added ? added + ' tanda diimpor' : 'Tidak ada titik, garis, atau area di berkas itu');
    if (added) { var all = []; d.items.forEach(function (i) { i.pts.forEach(function (p) { all.push(p); }); }); if (all.length && map()) map().fitBounds(L.latLngBounds(all), { padding: [30, 30], maxZoom: 19, animate: false }); }
  }
  function importPick() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.kml,.xml,application/vnd.google-earth.kml+xml,text/xml';
    inp.onchange = function () { var f = inp.files && inp.files[0]; if (!f) return; closeSheet(); f.text().then(importKml).catch(function () { toast('Gagal membaca berkas'); }); };
    inp.click();
  }
  HA.tandaImportKml = importKml; HA.tandaKml = buildKml;

  // ---------- walking ----------
  function wkStart() {
    if (TD.wk) return;
    if (!navigator.geolocation) { toast('GPS tidak tersedia'); return; }
    var m = map(), b = brush();
    TD.wk = { pts: [], last: null, line: L.polyline([], { color: b.color, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(m), dot: null, t0: Date.now(), id: null, saveT: 0, lock: null };
    TD.wk.id = navigator.geolocation.watchPosition(wkFix, function (e) { toast(e && e.code === 1 ? 'Izin lokasi ditolak' : 'Posisi belum ditemukan'); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    try { HA.Plug.keepScreen({ on: true }).catch(function () {}); } catch (e) {}
    if (navigator.wakeLock && !HA.native) navigator.wakeLock.request('screen').then(function (l) { if (TD.wk) TD.wk.lock = l; }).catch(function () {});
    wkBar(); hud('Walking dimulai · menunggu GPS');
  }
  function wkFix(p) {
    var w = TD.wk; if (!w) return;
    var c = p.coords, ll = [c.latitude, c.longitude];
    w.last = ll;
    var m = map();
    if (!w.dot) w.dot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2F80FF', fillOpacity: 1, interactive: false }).addTo(m); else w.dot.setLatLng(ll);
    if (c.accuracy != null && c.accuracy > 30) { hud('Walking · sinyal lemah (±' + Math.round(c.accuracy) + ' m)'); return; }
    var prev = w.pts.length ? w.pts[w.pts.length - 1] : null;
    if (prev) { var P = HzBlok.proj(prev[0], prev[1]), q = P.xy(ll); if (Math.hypot(q[0], q[1]) < 2.5) { wkHud(); return; } }
    w.pts.push(ll); w.line.addLatLng(ll);
    if (w.pts.length === 1 || !m.getBounds().pad(-0.2).contains(ll)) m.panTo(ll, { animate: false });
    wkHud();
    if (Date.now() - w.saveT > 4000) { w.saveT = Date.now(); try { localStorage.setItem(KEYW, JSON.stringify({ pts: w.pts, t0: w.t0 })); } catch (e) {} }
  }
  function wkHud() { var w = TD.wk; if (!w) return; hud('Walking · ' + fmtM(lenLL(w.pts, false)) + ' · ' + w.pts.length + ' titik'); }
  function wkBar() {
    bar().innerHTML = '<div class="tdr">' + tb('wkPt', IC.pin, 'Titik di sini') + tb('wkSt', '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>', 'Stop', true) + '</div>';
    $('wkPt').onclick = function () {
      var w = TD.wk; if (!w || !w.last) { toast('Posisi belum ditemukan'); return; }
      if (TD.blk && HA.BT && !HA.BT.inside(w.last)) { toast('Posisi Anda di luar blok ini'); return; }
      var b = brush(), it = { id: newId(), t: 'pt', pts: [[w.last[0], w.last[1]]], cat: b.cat, col: b.col, name: '', note: '', ts: Date.now() };
      addItem(it); save(); drawAll(); toast('Titik ditambah di posisi Anda');
    };
    $('wkSt').onclick = wkStop;
  }
  function wkStop() {
    var w = TD.wk; if (!w) return;
    try { navigator.geolocation.clearWatch(w.id); } catch (e) {}
    try { if (w.lock) w.lock.release(); } catch (e) {}
    try { HA.Plug.keepScreen({ on: false }).catch(function () {}); } catch (e) {}
    var m = map(); if (w.line) m.removeLayer(w.line); if (w.dot) m.removeLayer(w.dot);
    var pts = w.pts; TD.wk = null;
    try { localStorage.removeItem(KEYW); } catch (e) {}
    barMain(); hud('');
    if (pts.length < 2) { toast('Jejak terlalu pendek, tidak disimpan'); return; }
    wkFinish(pts);
  }
  function wkFinish(pts) {
    var P = HzBlok.proj(pts[0][0], pts[0][1]), xy = pts.map(P.xy), keep = dpSimplify(xy, 1.5), out = keep.map(function (i) { return [+pts[i][0].toFixed(7), +pts[i][1].toFixed(7)]; });
    if (out.length < 2) { toast('Jejak terlalu pendek, tidak disimpan'); return; }
    var b = brush(), t = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var it = { id: newId(), t: 'ln', pts: out, cat: b.cat, col: b.col, name: 'Walking ' + p2(t.getDate()) + '/' + p2(t.getMonth() + 1) + ' ' + p2(t.getHours()) + '.' + p2(t.getMinutes()), note: '', ts: Date.now() };
    addItem(it); save(); try { localStorage.removeItem(KEYW); } catch (e) {}
    if (TD.on) { drawAll(); fitItem(it); } itemSheet(it);
  }

  // ---------- cetak marking (PDF ber-geo) dengan preview ----------
  var PR = { title: '', nama: true, nilai: true, blk: true, fs: 'a', pos: 'c', cats: null };
  function printSheet(listItems, defTitle, blk) {
    var d = data(), src = listItems || d.items, ks = [], seen = {};
    src.forEach(function (it) { var k = ck(it); if (!seen[k]) { seen[k] = 1; ks.push([k, ckName(it), colOf(it)]); } });
    PR.cats = {}; ks.forEach(function (k) { PR.cats[k[0]] = true; });
    if (defTitle != null) PR.title = defTitle;
    openSheet('<div class="grab"></div><div class="st">CETAK MARKING</div>' +
      '<div class="h">JUDUL</div><input type="text" id="mpT" maxlength="60" placeholder="Kosong = Marking HZ Trip" value="' + esc(PR.title) + '" style="width:100%">' +
      '<div class="h" style="margin-top:10px">WARNA YANG DICETAK</div><div class="plist">' + ks.map(function (k) { return '<label><input type="checkbox" data-k="' + k[0] + '" checked> <i class="tdd" style="background:' + k[2] + '"></i>' + esc(k[1]) + '</label>'; }).join('') + '</div>' +
      '<div class="h" style="margin-top:10px">ISI PETA</div><div class="plist"><label><input type="checkbox" id="mpN"' + (PR.nama ? ' checked' : '') + '> Nama tanda</label><label><input type="checkbox" id="mpV"' + (PR.nilai ? ' checked' : '') + '> Nilai (ha atau meter)</label><label><input type="checkbox" id="mpB"' + (PR.blk ? ' checked' : '') + '> Garis blok terkonfirmasi sebagai latar</label></div>' +
      '<div class="h" style="margin-top:10px">UKURAN TEKS</div><div class="seg" id="mpF">' + [['a', 'Otomatis'], ['s', 'Kecil'], ['m', 'Sedang'], ['l', 'Besar']].map(function (o) { return '<button data-v="' + o[0] + '"' + (PR.fs === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div class="h" style="margin-top:10px">POSISI TEKS</div><div class="seg" id="mpP">' + [['c', 'Tengah'], ['t', 'Atas'], ['b', 'Bawah']].map(function (o) { return '<button data-v="' + o[0] + '"' + (PR.pos === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div>' +
      '<button class="btn" id="mpPv" style="width:100%;margin-top:12px">Preview</button><button class="btn pri" id="mpGo" style="width:100%;margin-top:8px;height:52px">Cetak PDF</button><button class="btn" id="mpX" style="width:100%;margin-top:8px">Kembali</button>');
    function grab() {
      PR.title = $('mpT').value; PR.nama = $('mpN').checked; PR.nilai = $('mpV').checked; PR.blk = $('mpB').checked;
      $('sheet').querySelectorAll('[data-k]').forEach(function (e) { PR.cats[e.getAttribute('data-k')] = e.checked; });
    }
    function seg(id, key) { $(id).onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-v]'); if (!b) return; PR[key] = b.getAttribute('data-v'); $(id).querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); }; }
    seg('mpF', 'fs'); seg('mpP', 'pos');
    $('mpX').onclick = function () { grab(); if (listItems) closeSheet(); else listSheet(); };
    function build() {
      grab();
      var items = src.filter(function (it) { return PR.cats[ck(it)] !== false; });
      if (!items.length) { toast('Pilih minimal satu warna yang berisi tanda'); return null; }
      return buildMarkPdf(items, Object.assign({}, PR, { buf: blk ? bufM() : 0, groups: [{ title: PR.title || (blk ? String(blk.name) : ''), items: items, blk: blk || null }] }));
    }
    $('mpPv').onclick = function () { var b = build(); if (b) pdfPreview(b, function () { saveFile('Marking_HZTrip_' + stamp() + '.pdf', btoa(b), 'application/pdf'); }); };
    $('mpGo').onclick = function () { var b = build(); if (b) saveFile('Marking_HZTrip_' + stamp() + '.pdf', btoa(b), 'application/pdf'); };
  }
  function bufM() { var v = +S.settings.tdBuf; return (v === 10 || v === 20) ? v : 15; }
  HA.tandaPrint = printSheet; HA.tandaBuildPdf = buildMarkPdf; HA.tandaBufM = bufM;

  function asc(t) { return String(t == null ? '' : t).replace(/[^\x20-\x7E]/g, '?'); }
  function pe(t) { return asc(t).replace(/([\\()])/g, '\\$1'); }
  function f2(v) { return (Math.round(v * 100) / 100).toString(); }
  function rgb(hex) { var h = hex.replace('#', ''); return f2(parseInt(h.slice(0, 2), 16) / 255) + ' ' + f2(parseInt(h.slice(2, 4), 16) / 255) + ' ' + f2(parseInt(h.slice(4, 6), 16) / 255); }
  function ck(it) { return it.cat ? it.cat : 'x' + colOf(it).toLowerCase(); }
  function ckName(it) { var c = it.cat ? catOf(it.cat) : null; return c ? c.name : colorName(colOf(it)); }
  HA.tandaCk = ck;
  function pageBox(items, blk, o) {
    var allp = []; items.forEach(function (it) { it.pts.forEach(function (p) { allp.push(p); }); }); if (blk) blk.pts.forEach(function (p) { allp.push(p); });
    var mb = bboxOf(allp);
    if (blk && o.buf) { var lc0 = (mb[0] + mb[2]) / 2, dl = o.buf / 111320, dg = o.buf / (111320 * Math.cos(lc0 * Math.PI / 180)); mb = [mb[0] - dl, mb[1] - dg, mb[2] + dl, mb[3] + dg]; }
    return mb;
  }
  HA.tandaPageBox = pageBox; HA.tandaPal = PAL; HA.tandaColOf = colOf; HA.tandaColorName = colorName;
  function buildMarkPdf(itemsAll, o) {
    var objs = [], ver = (document.querySelector('.ver') ? (document.querySelector('.ver').textContent.match(/Versi\s*([\d.]+)/) || [])[1] : '') || '';
    function add(b) { objs.push(b); return objs.length; }
    function stream(dict, dt) { return '<< ' + dict + ' /Length ' + dt.length + ' >>\nstream\n' + dt + '\nendstream'; }
    var dd = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; }, tgl = p2(dd.getDate()) + '-' + p2(dd.getMonth() + 1) + '-' + dd.getFullYear();
    var cat = add(''), pages = add(''), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2o = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'), gs = add('<< /Type /ExtGState /ca 0.35 /CA 1 >>');
    var res = '<< /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2o + ' 0 R >> /ExtGState << /G1 ' + gs + ' 0 R >> >>';
    var groups = o.groups || [{ title: o.title, items: itemsAll }];
    function page(items, ttlText, blk, img) {
    var mb = pageBox(items, blk, o), hasImg = !!img;
    var latc = (mb[0] + mb[2]) / 2, kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 111320;
    var mw = Math.max(50, (mb[3] - mb[1]) * kx), mh = Math.max(50, (mb[2] - mb[0]) * ky), land = mw >= mh, PW = land ? 1190.55 : 841.89, PH = land ? 841.89 : 1190.55, M = 24;
    var fw = PW - 2 * M, fh = PH - 2 * M - 8, sc = Math.min(fw / (mw * 1.1), fh / (mh * 1.1)), offx = (fw - mw * sc) / 2, offy = (fh - mh * sc) / 2;
    var X = function (lng) { return M + offx + (lng - mb[1]) * kx * sc; }, Y = function (lat) { return M + offy + (lat - mb[0]) * ky * sc; };
    var lngAt = function (x) { return mb[1] + (x - M - offx) / (kx * sc); }, latAt = function (y) { return mb[0] + (y - M - offy) / (ky * sc); };
    var c = [], info = [];
    var ttl = asc(ttlText || 'Marking HZ Trip'), imN = 0;
    if (hasImg) { imN = add(stream('/Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', img.data)); c.push('q ' + f2((mb[3] - mb[1]) * kx * sc) + ' 0 0 ' + f2((mb[2] - mb[0]) * ky * sc) + ' ' + f2(X(mb[1])) + ' ' + f2(Y(mb[0])) + ' cm /Im' + imN + ' Do Q'); }
    c.push('0 g BT /F2 14 Tf ' + f2(PW / 2 - ttl.length * 14 * 0.56 / 2) + ' ' + f2(PH - 18) + ' Td (' + pe(ttl) + ') Tj ET');
    // latar: garis blok terkonfirmasi yang bersinggungan dengan area cetak
    if (o.blk) {
      var ex = [mb[0] - (mb[2] - mb[0]) * 0.1, mb[1] - (mb[3] - mb[1]) * 0.1, mb[2] + (mb[2] - mb[0]) * 0.1, mb[3] + (mb[3] - mb[1]) * 0.1], cnt = 0;
      c.push(hasImg ? '1 G 0.9 w [3 2] 0 d' : '0.62 G 0.4 w');
      blks().forEach(function (b) {
        if (cnt > 1500 || !b.conf || !b.pts || b.pts.length < 3 || !bbHit(bboxOf(b.pts), ex)) return; cnt++;
        var s = ''; b.pts.forEach(function (p, i) { s += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i ? ' l ' : ' m '); }); c.push(s + 'h S');
      });
      if (hasImg) c.push('[] 0 d');
    }
    if (blk) { var bs = ''; blk.pts.forEach(function (p, i) { bs += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i ? ' l ' : ' m '); }); c.push(hasImg ? '1 0.9 0 RG 2.2 w ' + bs + 'h S' : '0 G 1.6 w ' + bs + 'h S'); }
    var cols = {}, fits = [];
    items.forEach(function (it) {
      var col = colOf(it), st = statOf(it), lab = [];
      if (o.nama && it.name) lab.push(asc(it.name));
      if (o.nilai) { if (it.t === 'pg') lab.push(fmtHa(st.ha) + ' ha'); else if (it.t === 'ln') lab.push(fmtM(st.m)); }
      var q = bboxOf(it.pts), bw = (q[3] - q[1]) * kx * sc, bh = (q[2] - q[0]) * ky * sc, wmax = 1; lab.forEach(function (t) { wmax = Math.max(wmax, t.length); });
      info.push({ it: it, col: col, st: st, lab: lab, x0: X(q[1]), x1: X(q[3]), y0: Y(q[0]), y1: Y(q[2]) });
      if (it.t === 'pg' && lab.length) fits.push(Math.min(bw * 0.84 / (Math.max(3, wmax) * 0.52), bh * 0.7 / (lab.length * 1.15)));
      var k = ck(it); if (!cols[k]) cols[k] = { name: ckName(it), col: col, n: 0, pt: 0, m: 0, ha: 0, lj: 0, lm: 0 };
      var r = cols[k]; r.n++; if (it.t === 'pt') r.pt++; else if (it.t === 'ln') r.m += st.m; else { r.ha += st.ha; r.lj += st.n; r.lm += st.lm; }
    });
    fits.sort(function (a, b) { return a - b; });
    var fsU = Math.max(4, Math.min(11, fits.length ? fits[Math.floor(fits.length * 0.25)] : 8)); if ({ s: 1, m: 1, l: 1 }[o.fs]) fsU = { s: 5, m: 7.5, l: 11 }[o.fs];
    // bentuk
    info.forEach(function (n) {
      var it = n.it, s = '', i;
      if (it.t === 'pg') { it.pts.forEach(function (p, i2) { s += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i2 ? ' l ' : ' m '); }); c.push('q /G1 gs ' + rgb(n.col) + ' rg ' + s + 'h f Q ' + rgb(n.col) + ' RG 1.3 w ' + s + 'h S'); }
      else if (it.t === 'ln') { it.pts.forEach(function (p, i2) { s += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i2 ? ' l ' : ' m '); }); c.push(rgb(n.col) + ' RG 2.4 w 1 J 1 j ' + s + 'S 0 J 0 j'); }
      else { var px = X(it.pts[0][1]), py = Y(it.pts[0][0]), r = 4.2, k = r * 0.5523; c.push(rgb(n.col) + ' rg 1 G 0.9 w ' + f2(px + r) + ' ' + f2(py) + ' m ' + f2(px + r) + ' ' + f2(py + k) + ' ' + f2(px + k) + ' ' + f2(py + r) + ' ' + f2(px) + ' ' + f2(py + r) + ' c ' + f2(px - k) + ' ' + f2(py + r) + ' ' + f2(px - r) + ' ' + f2(py + k) + ' ' + f2(px - r) + ' ' + f2(py) + ' c ' + f2(px - r) + ' ' + f2(py - k) + ' ' + f2(px - k) + ' ' + f2(py - r) + ' ' + f2(px) + ' ' + f2(py - r) + ' c ' + f2(px + k) + ' ' + f2(py - r) + ' ' + f2(px + r) + ' ' + f2(py - k) + ' ' + f2(px + r) + ' ' + f2(py) + ' c B'); }
    });
    // teks
    c.push('0 g 0 G');
    info.forEach(function (n) {
      var it = n.it, lab = n.lab; if (!lab.length) return;
      var cx, cy, align = 'c';
      if (it.t === 'pg') {
        var ip = (o.pos === 't' ? HA.poiBand(it.pts, kx, ky, 0.55, 0.95) : (o.pos === 'b' ? HA.poiBand(it.pts, kx, ky, 0.05, 0.45) : null)) || HA.poi(it.pts, kx, ky); cx = X(ip[1]); cy = Y(ip[0]);
      } else if (it.t === 'ln') {
        var P = HzBlok.proj(it.pts[0][0], it.pts[0][1]), xy = it.pts.map(P.xy), tot = lenXY(xy, false), half = tot / 2, acc = 0, k;
        cx = X(it.pts[0][1]); cy = Y(it.pts[0][0]);
        for (k = 1; k < xy.length; k++) { var sg = Math.hypot(xy[k][0] - xy[k - 1][0], xy[k][1] - xy[k - 1][1]); if (acc + sg >= half) { var f = sg ? (half - acc) / sg : 0; cx = X(it.pts[k - 1][1] + (it.pts[k][1] - it.pts[k - 1][1]) * f); cy = Y(it.pts[k - 1][0] + (it.pts[k][0] - it.pts[k - 1][0]) * f); break; } acc += sg; }
        cy += (o.pos === 'b' ? -1 : 1) * (fsU * 0.9 + 3);
      } else { cx = X(it.pts[0][1]) + 7; cy = Y(it.pts[0][0]) + (o.pos === 't' ? fsU : (o.pos === 'b' ? -fsU : 0)); align = 'l'; }
      var tot2 = lab.length * fsU * 1.15, top = cy + tot2 / 2 - fsU * 0.85;
      lab.forEach(function (t, i) {
        var w = t.length * fsU * 0.52, x = align === 'l' ? cx : cx - w / 2;
        c.push('BT /F1 ' + f2(fsU) + ' Tf ' + (hasImg ? '1 1 1 RG ' + f2(Math.max(1, fsU * 0.28)) + ' w 2 Tr ' : '') + f2(x) + ' ' + f2(top - i * fsU * 1.15) + ' Td (' + pe(t) + ') Tj ET');
      });
    });
    // skala dan panah utara
    var L0 = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].filter(function (v) { return v * sc < fw * 0.25; }).pop() || 10, bx = PW / 2 - L0 * sc / 2, by = M + 16;
    if (hasImg) c.push('1 g ' + f2(bx - 8) + ' ' + f2(by - 8) + ' ' + f2(L0 * sc + 16) + ' 28 re f 0 g');
    c.push('0 G 1 w ' + f2(bx) + ' ' + f2(by) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by) + ' l S ' + f2(bx) + ' ' + f2(by - 4) + ' m ' + f2(bx) + ' ' + f2(by + 4) + ' l S ' + f2(bx + L0 * sc) + ' ' + f2(by - 4) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by + 4) + ' l S');
    c.push('BT /F1 8 Tf ' + f2(bx) + ' ' + f2(by + 7) + ' Td (' + (L0 >= 1000 ? (L0 / 1000) + ' km' : L0 + ' m') + ') Tj ET');
    var nx0 = PW - M - 24, ny0 = PH - M - 52;
    if (hasImg) c.push('1 g ' + f2(nx0 - 12) + ' ' + f2(ny0 - 14) + ' 24 46 re f 0 g');
    c.push('1 w ' + f2(nx0) + ' ' + f2(ny0) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l S ' + f2(nx0 - 5) + ' ' + f2(ny0 + 20) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l ' + f2(nx0 + 5) + ' ' + f2(ny0 + 20) + ' l S');
    c.push('BT /F2 9 Tf ' + f2(nx0 - 3) + ' ' + f2(ny0 - 10) + ' Td (U) Tj ET');
    // legenda tabel: kategori, jumlah, luas, lajur, meter
    var rows = Object.keys(cols).map(function (k) { return cols[k]; });
    var tt = { pt: 0, m: 0, ha: 0, lj: 0, lm: 0, n: 0 }; rows.forEach(function (r) { tt.pt += r.pt; tt.m += r.m; tt.ha += r.ha; tt.lj += r.lj; tt.lm += r.lm; tt.n += r.n; });
    var CW = [112, 30, 48, 40, 56, 56], LW = CW.reduce(function (a, b) { return a + b; }, 0), RH = 13, nR = rows.length + 3, LH = RH * nR, G = 10;
    var cands = [[PW - M - G - LW, M + G], [M + G, M + G], [M + G, PH - M - G - LH - 6]];
    function overlap(cd) { var n = 0; info.forEach(function (q) { if (q.x1 > cd[0] - 6 && q.x0 < cd[0] + LW + 6 && q.y1 > cd[1] - 6 && q.y0 < cd[1] + LH + 6) n++; }); return n; }
    var best = cands[0], bo = overlap(best); cands.forEach(function (cd) { var v = overlap(cd); if (v < bo) { bo = v; best = cd; } });
    var lx = best[0], ly = best[1];
    c.push('1 g 0.5 w ' + f2(lx) + ' ' + f2(ly) + ' ' + f2(LW) + ' ' + f2(LH) + ' re f 0 g 0 G ' + f2(lx) + ' ' + f2(ly) + ' ' + f2(LW) + ' ' + f2(LH) + ' re S');
    function cell(ci, ri, txt, bold) { var x0 = lx + 4; for (var q = 0; q < ci; q++) x0 += CW[q]; c.push('BT /' + (bold ? 'F2' : 'F1') + ' 7.5 Tf ' + f2(x0 + (ci === 0 && ri > 0 && ri <= rows.length ? 12 : 0)) + ' ' + f2(ly + LH - RH * (ri + 1) + 4) + ' Td (' + pe(txt) + ') Tj ET'); }
    ['Kategori', 'Jml', 'Ha', 'Lajur', 'Lajur m', 'Garis m'].forEach(function (h, i) { cell(i, 0, h, true); });
    rows.forEach(function (r, i) {
      var ri = i + 1, ty = ly + LH - RH * (ri + 1);
      c.push('0.5 w ' + f2(lx) + ' ' + f2(ty + RH) + ' m ' + f2(lx + LW) + ' ' + f2(ty + RH) + ' l S ' + rgb(r.col) + ' rg ' + f2(lx + 4) + ' ' + f2(ty + 3.5) + ' 7 6 re f 0 g');
      cell(0, ri, r.name.length > 22 ? r.name.slice(0, 21) + '.' : r.name); cell(1, ri, String(r.n)); cell(2, ri, r.ha ? fmtHa(r.ha) : '-'); cell(3, ri, r.lj ? ribu(r.lj) : '-'); cell(4, ri, r.lm ? ribu(r.lm) : '-'); cell(5, ri, r.m ? ribu(r.m) : '-');
    });
    var tr = rows.length + 1;
    c.push('0.5 w ' + f2(lx) + ' ' + f2(ly + LH - RH * (tr)) + ' m ' + f2(lx + LW) + ' ' + f2(ly + LH - RH * tr) + ' l S');
    cell(0, tr, 'Total', true); cell(1, tr, String(tt.n), true); cell(2, tr, tt.ha ? fmtHa(tt.ha) : '-', true); cell(3, tr, tt.lj ? ribu(tt.lj) : '-', true); cell(4, tr, tt.lm ? ribu(tt.lm) : '-', true); cell(5, tr, tt.m ? ribu(tt.m) : '-', true);
    c.push('0.5 w ' + f2(lx) + ' ' + f2(ly + RH) + ' m ' + f2(lx + LW) + ' ' + f2(ly + RH) + ' l S BT /F1 7 Tf ' + f2(lx + 4) + ' ' + f2(ly + 3.5) + ' Td (' + pe('Dicetak ' + tgl + ' | HZ Trip ' + ver) + ') Tj ET');
    var cs = add(stream('', c.join('\n')));
    var corners = [[M, M], [M, PH - M], [PW - M, PH - M], [PW - M, M]], lp = [0, 0, 0, 1, 1, 1, 1, 0], gp = [];
    corners.forEach(function (q) { gp.push(latAt(q[1]).toFixed(7), lngAt(q[0]).toFixed(7)); });
    var vp = '/VP [ << /Type /Viewport /Name (Peta) /BBox [' + f2(M) + ' ' + f2(M) + ' ' + f2(PW - M) + ' ' + f2(PH - M) + '] /Measure << /Type /Measure /Subtype /GEO /Bounds [0 0 0 1 1 1 1 0] /GPTS [' + gp.join(' ') + '] /LPTS [' + lp.join(' ') + '] /GCS << /Type /GEOGCS /WKT (GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]) /EPSG 4326 >> /PDU [/M /DEG /DEG] >> >> ]';
    var pg = add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + f2(PW) + ' ' + f2(PH) + '] /Resources ' + (imN ? res.replace(/ >>$/, ' /XObject << /Im' + imN + ' ' + imN + ' 0 R >> >>') : res) + ' /Contents ' + cs + ' 0 R ' + vp + ' >>');
    return pg;
    }
    var kids = groups.map(function (g) { return page(g.items, g.title, g.blk, g.img); });
    objs[cat - 1] = '<< /Type /Catalog /Pages ' + pages + ' 0 R >>';
    objs[pages - 1] = '<< /Type /Pages /Count ' + kids.length + ' /Kids [' + kids.map(function (k) { return k + ' 0 R'; }).join(' ') + '] >>';
    var out = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', offs = [];
    objs.forEach(function (b, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + b + '\nendobj\n'; });
    var xr = out.length; out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offs.forEach(function (of) { out += ('0000000000' + of).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R >>\nstartxref\n' + xr + '\n%%EOF\n';
    return out;
  }
  HA.tandaPdf = function () { return buildMarkPdf(data().items, PR.cats ? Object.assign({}, PR) : { nama: true, nilai: true, blk: true, fs: 'a', pos: 'c' }); };

  // ---------- preview PDF (dirender pdf.js, sama dengan hasil cetak) ----------
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'vendor/pdf.min.js';
      s.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = function () { rej(new Error('Pustaka PDF tidak ditemukan')); };
      document.head.appendChild(s);
    });
  }
  function pdfThumb(bytes, cv, wcss, maxH) {
    var u8 = new Uint8Array(bytes.length); for (var i = 0; i < bytes.length; i++) u8[i] = bytes.charCodeAt(i) & 255;
    var np = 1;
    return loadPdfJs().then(function (lib) { return lib.getDocument({ data: u8 }).promise; }).then(function (doc) { np = doc.numPages; return doc.getPage(1); }).then(function (pg) {
      var v0 = pg.getViewport({ scale: 1 }), sc = wcss / v0.width * (window.devicePixelRatio || 1) * 1.5, v = pg.getViewport({ scale: sc });
      cv.width = v.width; cv.height = v.height; cv.style.width = Math.min(wcss, (maxH || 1e5) * v.width / v.height) + 'px'; cv.style.height = 'auto';
      return pg.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise.then(function () { return np; });
    });
  }
  HA.pdfThumb = pdfThumb;
  function pdfPreview(bytes, onPrint) {
    var old = $('tdPrev'); if (old) old.remove();
    var el = document.createElement('div'); el.id = 'tdPrev';
    el.innerHTML = '<div class="tpb"><b>Preview</b><span class="muted" id="tpInfo">ketuk gambar untuk memperbesar</span></div><div class="tpw"><canvas id="tpCv"></canvas><div id="tpMsg" class="muted">Menyusun preview…</div></div><div class="tpf"><button class="btn" id="tpBack">Kembali</button><button class="btn pri" id="tpGo">Cetak PDF</button></div>';
    document.body.appendChild(el);
    $('tpBack').onclick = function () { el.remove(); };
    $('tpCv').onclick = function () { var c = $('tpCv'), w0 = parseFloat(c.getAttribute('data-w') || c.style.width), z = c.getAttribute('data-z') === '1'; c.setAttribute('data-w', w0); c.style.width = (z ? w0 : w0 * 2.6) + 'px'; c.setAttribute('data-z', z ? '0' : '1'); };
    $('tpGo').onclick = function () { el.remove(); onPrint(); };
    var u8 = new Uint8Array(bytes.length); for (var i = 0; i < bytes.length; i++) u8[i] = bytes.charCodeAt(i) & 255;
    loadPdfJs().then(function (lib) { return lib.getDocument({ data: u8 }).promise; }).then(function (doc) {
      $('tpInfo').textContent = doc.numPages + ' halaman · ketuk gambar untuk memperbesar';
      return doc.getPage(1);
    }).then(function (pg) {
      var wcss = Math.min(window.innerWidth - 16, 900), v0 = pg.getViewport({ scale: 1 }), sc = wcss / v0.width * (window.devicePixelRatio || 1) * 1.6, v = pg.getViewport({ scale: sc }), cv = $('tpCv');
      cv.width = v.width; cv.height = v.height; cv.style.width = wcss + 'px';
      return pg.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise;
    }).then(function () { $('tpMsg').style.display = 'none'; }).catch(function (e) { $('tpMsg').textContent = 'Preview tidak tersedia (' + (e && e.message || e) + '). Anda tetap bisa mencetak.'; });
  }

  // ---------- pasang ----------
  function init() {
    if (!$('spTanda')) return;
    $('spTanda').onclick = function () { if (TD.on) modeOff(); else modeOn(); };
  }
  HA.TD = TD; HA.tandaData = data; HA.tandaStat = statOf;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
