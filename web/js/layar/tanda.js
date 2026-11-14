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
    brush: ic('<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-4 2-4 4 0 2-1 3-2 4 3 1 8 1 8-4"/>'),
    trash: ic('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
    hand: ic('<path d="M8 13V6a1.5 1.5 0 0 1 3 0v6"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.5L8 13"/>'),
    tidy: ic('<path d="M4 20L15 9"/><path d="M14 4l1-2 1 2 2 1-2 1-1 2-1-2-2-1zM19 12l.7-1.4L21 10l-1.3-.6L19 8l-.7 1.4L17 10l1.3.6z"/>'),
    edit: ic('<path d="M4 20l1-4 11-11 3 3-11 11z"/><path d="M14 7l3 3"/>'),
    redo: ic('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
    check: ic('<path d="M5 12l5 5 9-10"/>'),
    eye: ic('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    save: ic('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
    search: ic('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>'),
    share: ic('<circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M8 11l8-4M8 13l8 4"/>'),
    menu: ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    mark: ic('<path d="m15 5 4 4"/><path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13"/><path d="m8 6 2-2"/><path d="m2 22 5.5-1.5L21.17 6.83a2.82 2.82 0 0 0-4-4L3.5 16.5Z"/><path d="m18 11 .5.5"/>'),
    gear: ic('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
    rect: ic('<rect x="4" y="6" width="16" height="12" rx="1.5"/>'),
    shapes: ic('<rect x="3" y="3" width="9" height="9" rx="1.5"/><circle cx="16.5" cy="16.5" r="4.5"/>'),
    copy: ic('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
    cross: ic('<circle cx="12" cy="12" r="6.5"/><path d="M12 2v7M12 15v7M2 12h7M15 12h7"/>'),
    move: ic('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
    split: ic('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15c5-6 9 2 18-6"/>'),
    hash: ic('<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>'),
    tag: ic('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>')
  };
  function tb(id, icon, label, on, extra) { return '<button class="tbtn' + (on ? ' on' : '') + '" ' + (id ? 'id="' + id + '" ' : '') + (extra || '') + '>' + icon + '<span>' + label + '</span></button>'; }
  function ti(id, icon, label, extra, cls) { return '<button type="button" class="tdbi' + (cls ? ' ' + cls : '') + '" ' + (id ? 'id="' + id + '" ' : '') + 'aria-label="' + label + '" title="' + label + '" ' + (extra || '') + '>' + icon + '</button>'; }
  HA.IC = IC; HA.tb = tb; HA.ti = ti;
  var TD = { on: false, tool: null, D: null, lay: null, ed: null, wk: null, bound: false, prevFollow: null, hud: null, sel: null };

  // ---------- penyimpanan terpisah ----------
  function defCats() { return [{ id: 'c1', name: 'Pemupukan', col: PAL[5][1], subs: [] }, { id: 'c2', name: 'Spraying', col: PAL[4][1], subs: [] }, { id: 'c3', name: 'Tebang', col: PAL[0][1], subs: [] }, { id: 'c4', name: 'Kebakaran', col: PAL[1][1], subs: [] }]; }
  function data() {
    if (TD.D) return TD.D;
    var d = null; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.items)) d = { v: 2, cats: defCats(), items: [], brush: { cat: 'c1', sub: null }, seq: 1 };
    if (!Array.isArray(d.cats) || !d.cats.length) d.cats = defCats();
    var oldN = ['Perlu cek', 'Dalam pekerjaan', 'Selesai', 'Catatan'];
    if (d.cats.length === 4 && d.cats.every(function (c, i) { return c.name === oldN[i]; }) && !d.items.some(function (x) { return x.cat; })) d.cats = defCats();
    d.cats.forEach(function (c) { if (!Array.isArray(c.subs)) c.subs = []; });
    if (!d.brush) d.brush = {};
    var bk = null; d.cats.forEach(function (c) { if (c.id === d.brush.cat) bk = c; });
    if (!bk) { var bc2 = d.cats[0]; if (d.brush.col) d.cats.forEach(function (c) { if (String(c.col).toLowerCase() === String(d.brush.col).toLowerCase()) bc2 = c; }); d.brush = { cat: bc2.id, sub: null, op: d.brush.op }; }
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
    HS.i = j; setItems(HS.s[j]);
    if (TD.selIt) { var sid = TD.selIt.id; TD.selIt = null; TD.D.items.forEach(function (x) { if (x.id === sid) TD.selIt = x; }); }
    if (TD.del) TD.del = {};
    drawAll(); if (HA.BT) HA.BT.refresh(); barMain();
  }
  HA.tandaHsInit = hsInit; HA.tandaSetItems = setItems;
  function catOf(id) { var r = null; data().cats.forEach(function (c) { if (c.id === id) r = c; }); return r; }
  function subOf(c, id) { var r = null; if (c && id) c.subs.forEach(function (s) { if (s.id === id) r = s; }); return r; }
  function colOf(it) { var c = it.cat ? catOf(it.cat) : null; if (c) { var s = subOf(c, it.sub); return s && s.col ? s.col : c.col; } return it.col || PAL[0][1]; }
  function brush() {
    var b = data().brush, c = catOf(b.cat) || data().cats[0], s = subOf(c, b.sub);
    var bo = (typeof b.op === 'number') ? b.op : 0.35;
    return { cat: c.id, sub: s ? s.id : null, col: null, color: s && s.col ? s.col : c.col, name: c.name + (s ? ' / ' + s.name : ''), op: bo };
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function todayISO() { var t = new Date(); return t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()); }
  function dateOf(it) { if (it.date && /^\d{4}-\d{2}-\d{2}$/.test(it.date)) return it.date; var t = new Date(it.ts || Date.now()); return t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()); }
  function fmtD8(iso) { var a = String(iso).split('-'); return a.length === 3 ? a[2] + '-' + a[1] + '-' + a[0].slice(2) : String(iso); }
  function touch(it) { if (it) it.mod = Date.now(); }
  function uid(p) { var d = data(); d.seq = (d.seq || 1) + 1; return p + Date.now().toString(36) + d.seq; }
  function opOf(it) { var v = it.op; return (typeof v === 'number' && v >= 0.05 && v <= 0.95) ? v : 0.35; }
  function addItem(it) { if (it.cat && it.sub === undefined) it.sub = brush().sub; if (!it.date) it.date = todayISO(); it.mod = Date.now(); data().items.push(it); return it; }
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
    data().items.slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); }).forEach(function (it) {
      if (TD.ed && TD.ed.item && TD.ed.item.id === it.id) return;
      var col = colOf(it), l, hc = null;
      if (TD.del && TD.del[it.id]) hc = '#FF2D55'; else if (TD.selIt && TD.selIt.id === it.id) hc = '#FFFFFF';
      if (hc) {
        if (it.t === 'pt') L.circleMarker(it.pts[0], { radius: 14, color: hc, weight: 3, fill: false, interactive: false }).addTo(TD.lay);
        else if (it.t === 'ln') L.polyline(it.pts, { color: hc, weight: 11, opacity: 0.9, interactive: false }).addTo(TD.lay);
        else L.polygon(it.pts, { color: hc, weight: 7, fill: false, interactive: false }).addTo(TD.lay);
      }
      if (it.t === 'pt') l = L.circleMarker(it.pts[0], { radius: 8, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 });
      else if (it.t === 'ln') l = L.polyline(it.pts, { color: col, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' });
      else l = L.polygon(it.pts, { color: col, weight: 2.5, fillColor: col, fillOpacity: opOf(it) });
      if (it.name) l.bindTooltip(esc(it.name), { permanent: true, direction: 'center', className: 'mktip' });
      l.on('click', function (ev) {
        if (TD.tool || TD.ed || TD.wk) { return; }
        if (!TD.blk) return;
        L.DomEvent.stopPropagation(ev);
        if (TD.selIt && TD.selIt.id === it.id && HA.BT && HA.BT.history) { HA.BT.history([ev.latlng.lat, ev.latlng.lng]); return; }
        selectItem(it);
      });
      l.addTo(TD.lay);
    });
    if (HA.BT && TD.blk) HA.BT.refresh();
  }
  HA.tandaSelect = function (it) { selectItem(it); };
  function selectItem(it) { TD.selIt = it; TD.palOpen = false; drawAll(); barMain(); }
  function fitItem(it) { var m = map(); if (!m) return; if (it.t === 'pt') m.setView(it.pts[0], Math.max(m.getZoom(), 18), { animate: false }); else m.fitBounds(L.latLngBounds(it.pts), { padding: [40, 40], maxZoom: 19, animate: false }); }

  // ---------- mode marking ----------
  function setOverlays(on) {
    var m = map(); if (!m) return;
    m._forceOvl = on;
    if (HA.syncOverlays) HA.syncOverlays(m);
  }
  function modeOn() {
    if (!HA.spShow) return;
    TD.on = true; TD.blk = null; TD.bm = null; TD.selIt = null; TD.del = null; TD.palOpen = false; data();
    HA.spShow('map');
    var m = map();
    if (!m) { setTimeout(modeOn, 300); return; }
    if (TD.prevFollow == null) TD.prevFollow = HA.SP.follow;
    HA.SP.follow = false; HA.SP.autoPaused = true;
    if (!TD.bound) { m.on('click', onMapClick); TD.bound = true; }
    setOverlays(false); ensureLay(); drawAll(); strokeBind();
    $('spBar').style.display = 'none'; $('tdBar').style.display = 'flex'; if ($('spTanda')) $('spTanda').classList.add('on');
    if (HA.BT) HA.BT.enter();
    barMain(); if (!HA.BT) hud('');
    setTimeout(draftOffer, 700);
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
    edCancel(); if (HA.BT) HA.BT.leave(); TD.tool = null; TD.selIt = null; TD.del = null; TD.palOpen = false; lockMap(false); TD.on = false;
    if (TD.lay) { TD.lay.clearLayers(); }
    setOverlays(false);
    $('tdBar').style.display = 'none'; $('spBar').style.display = ''; if ($('spTanda')) $('spTanda').classList.remove('on'); hud('');
    if (TD.prevFollow != null) { HA.SP.follow = TD.prevFollow; TD.prevFollow = null; }
    HA.SP.autoPaused = false;
    if (HA.spBtns) HA.spBtns();
  }
  function hud(t) { var h = $('tdHud'); if (!h) return; h.textContent = t || ''; h.style.display = t ? 'block' : 'none'; }

  // ---------- bilah bawah ----------
  var TOOLS = [['pt', 'pin', 'Titik'], ['ln', 'line', 'Garis'], ['pg', 'poly', 'Area'], ['wk', 'walk', 'Walking']];
  function barMain() {
    if (TD.sp) { spBar(); return; }
    if (HA.BT) { HA.BT.bar(); return; }
    var b = brush();
    bar().innerHTML = '<div class="tdr">' + TOOLS.map(function (t) { return tb(null, IC[t[1]], t[2], TD.tool === t[0], 'data-t="' + t[0] + '"'); }).join('') + '</div>' +
      '<div class="tdr">' + tb('tdBr', '<i class="cdot" style="background:' + b.color + '"></i>', b.name) + tb('tdLs', IC.list, 'Daftar') + tb('tdXm', IC.close, 'Tutup') + '</div>';
    bar().querySelectorAll('[data-t]').forEach(function (e) { e.onclick = function () { pickTool(e.getAttribute('data-t')); }; });
    $('tdBr').onclick = function () { colorSheet(function (v) { var d = data(); d.brush = { cat: null, col: v.col }; save(); barMain(); }); };
    $('tdLs').onclick = function () { listSheet(); };
    $('tdXm').onclick = modeOff;
    if (TD.tool === 'pt') hud('Ketuk peta untuk menaruh titik'); 
  }
  HA.tandaBar = barMain;
  // tombol Back Android: panel -> gambar -> keluar blok -> keluar marking -> Spidometer
  HA.tandaBack = function () {
    var pv = $('tdPrev'); if (pv) { pv.remove(); return true; }
    if (HA.BT && HA.BT.back && HA.BT.back()) return true;
    if (!TD.on) return false;
    if (TD.wk) { toast('Hentikan walking dulu'); return true; }
    if (TD.sp) { spClear(); TD.tool = null; hud(''); barMain(); return true; }
    if (TD.ed && !TD.ed.item && TD.ed.pts.length) { edCancel(); TD.tool = null; barMain(); return true; }
    if (HA.BT && TD.blk) { HA.BT.exit(); return true; }
    modeOff(); return true;
  };
  function pickTool(t) {
    spClear(); if (TD.ed) edCancel();
    TD.selIt = null; TD.palOpen = false; TD.shpOpen = false;
    if (t === 'wk') { TD.tool = null; TD.del = null; wkStart(); return; }
    if (t === 'del') { var on = TD.tool !== 'del'; TD.tool = on ? 'del' : null; TD.del = on ? {} : null; drawAll(); barMain(); return; }
    TD.del = null;
    TD.tool = TD.tool === t ? null : t;
    if (TD.tool === 'rc') { edStart('pg', null); TD.ed.rect = true; rectInit(); return; }
    if (TD.tool === 'bl') { if (!TD.blk) { TD.tool = null; toast('Pilih blok dulu'); return; } edStart('ln', null); TD.ed.split = true; edBar(); edStatus(); return; }
    if (TD.tool === 'ln' || TD.tool === 'pg') { edStart(TD.tool, null); return; }
    drawAll(); barMain(); if (!TD.tool) hud('');
  }
  HA.tandaPick = pickTool;

  // ---------- gambar dan edit bentuk (titik sudut bisa digeser, ditambah, dihapus) ----------
  function vIcon(mid) { return L.divIcon({ className: 'tdv', html: '<i class="' + (mid ? 'mid' : '') + '"></i>', iconSize: mid ? [18, 18] : [28, 28], iconAnchor: mid ? [9, 9] : [14, 14] }); }
  function clonePts(a) { return a.map(function (p) { return [p[0], p[1]]; }); }
  function lockMap(on) {
    var m = map(); if (!m) return; var c = m.getContainer();
    if (on) { m.dragging.disable(); c.style.touchAction = 'none'; }
    else { if (!m.dragging.enabled()) m.dragging.enable(); c.style.touchAction = ''; }
  }
  function edStart(kind, item) {
    edCancel();
    TD.selIt = null; TD.palOpen = false;
    TD.ed = { h: [], red: [], pan: false, kind: kind, item: item, pts: item ? clonePts(item.pts) : [], vm: [], shape: null };
    lockMap(!item);
    drawAll(); edRender(); edBar();
  }
  var KEYD = 'hz_tanda_dr';
  function draftSave() { var e = TD.ed; if (!e || e.item || !TD.blk || !e.pts.length) return; try { localStorage.setItem(KEYD, JSON.stringify({ bid: TD.blk.id, kind: e.kind, rect: !!e.rect, split: !!e.split, pts: e.pts, t: Date.now() })); } catch (x) {} }
  function draftClear() { try { localStorage.removeItem(KEYD); } catch (x) {} }
  function draftOffer() {
    var d = null; try { d = JSON.parse(localStorage.getItem(KEYD) || 'null'); } catch (x) {}
    if (!d || !TD.on || TD.ed || !HA.BT || !HA.BT.byId) return;
    draftClear();
    if (Date.now() - d.t > 86400000 || !d.pts || !d.pts.length) return;
    var b = HA.BT.byId(d.bid); if (!b) return;
    askConfirm('Lanjutkan gambar terakhir?', 'Ada ' + (d.kind === 'ln' ? 'garis' : 'area') + ' di blok ' + b.name + ' yang belum selesai saat aplikasi tertutup.', 'Lanjutkan', function () {
      HA.BT.pick(b, true); TD.tool = d.split ? 'bl' : (d.rect ? 'rc' : (d.kind === 'ln' ? 'ln' : 'pg'));
      edStart(d.kind, null); TD.ed.rect = !!d.rect; TD.ed.split = !!d.split; TD.ed.pts = d.pts; edRender(); edBar();
    });
  }
  function edPush() { var e = TD.ed; if (!e) return; e.h.push(clonePts(e.pts)); if (e.h.length > 60) e.h.shift(); e.red = []; }
  function edMin() { return TD.ed.kind === 'ln' ? 2 : 3; }
  function edStatus() {
    var e = TD.ed; if (!e) return;
    if (e.pan) { hud('Geser peta aktif. Ketuk Geser lagi untuk menggambar'); return; }
    if (e.split) { hud(e.pts.length < 2 ? 'Gambar garis pembelah dari tepi ke tepi blok, boleh tidak lurus' : 'Garis ' + fmtM(lenLL(e.pts, false)) + ' · ketuk Belah'); return; }
    if (e.kind === 'ln') hud(e.pts.length < 2 ? 'Seret jari di peta, atau ketuk untuk menambah titik' : 'Garis ' + fmtM(lenLL(e.pts, false)));
    else if (e.pts.length < 3) hud('Lingkari bagian blok dengan jari, atau ketuk titik sudut');
    else { var P = HzBlok.proj(e.pts[0][0], e.pts[0][1]); hud('Area ' + fmtHa(HzBlok.areaHa(e.pts)) + ' ha · ' + fmtM(lenXY(e.pts.map(P.xy), true))); }
  }
  function edShape() {
    var e = TD.ed, m = map(), col = e.item ? colOf(e.item) : brush().color, op = e.item ? opOf(e.item) : brush().op;
    if (e.shape) { m.removeLayer(e.shape); e.shape = null; }
    if (e.pts.length >= 2) e.shape = (e.kind === 'pg' && e.pts.length >= 3 ? L.polygon(e.pts, { color: col, weight: 3, fillColor: col, fillOpacity: op, interactive: false }) : L.polyline(e.pts, { color: col, weight: 4, interactive: false })).addTo(m);
  }
  function edRender() {
    var e = TD.ed, m = map(); if (!e) return;
    e.vm.forEach(function (x) { m.removeLayer(x); }); e.vm = [];
    edShape();
    var closed = e.kind === 'pg';
    e.pts.forEach(function (p, i) {
      var mk = L.marker(p, { icon: vIcon(false), draggable: true, keyboard: false, zIndexOffset: 800 }).addTo(m);
      mk.on('dragstart', function () { edPush(); });
      mk.on('drag', function () { var ll = mk.getLatLng(); e.pts[i] = [ll.lat, ll.lng]; edShape(); edStatus(); });
      mk.on('dragend', function () { edRender(); });
      mk.on('click', function (ev) { L.DomEvent.stopPropagation(ev); if (e.pts.length > edMin()) { edPush(); e.pts.splice(i, 1); edRender(); } else toast('Titik minimal ' + edMin()); });
      mk._p = p; e.vm.push(mk);
      var j = i + 1; if (j >= e.pts.length) { if (!closed || e.pts.length < 3) return; j = 0; }
      var q = e.pts[j], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], mm = L.marker(mid, { icon: vIcon(true), keyboard: false, zIndexOffset: 700 }).addTo(m);
      mm.on('click', function (ev) { L.DomEvent.stopPropagation(ev); edPush(); e.pts.splice(i + 1, 0, mid); edRender(); });
      mm._p = mid; e.vm.push(mm);
    });
    if (e.rect && e.pts.length) {
      var cx = 0, cy = 0; e.pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= e.pts.length; cy /= e.pts.length;
      var hm = L.marker([cx, cy], { icon: L.divIcon({ className: 'tdv tdm', html: '<i>' + IC.move + '</i>', iconSize: [44, 44], iconAnchor: [22, 22] }), draggable: true, keyboard: false, zIndexOffset: 900 }).addTo(m), base = null;
      hm.on('dragstart', function () { edPush(); base = clonePts(e.pts); });
      hm.on('drag', function () {
        var ll = hm.getLatLng(), dl = ll.lat - cx, dg = ll.lng - cy;
        e.pts = base.map(function (p) { return [p[0] + dl, p[1] + dg]; });
        e.vm.forEach(function (x) { if (x._p) x.setLatLng([x._p[0] + dl, x._p[1] + dg]); });
        edShape(); edStatus();
      });
      hm.on('dragend', function () { edRender(); });
      e.vm.push(hm);
    }
    edStatus(); draftSave();
  }
  function edUndo() { var e = TD.ed; if (!e) return; if (!e.h.length) { toast('Tidak ada yang diurungkan'); return; } e.red.push(clonePts(e.pts)); e.pts = e.h.pop(); edRender(); }
  function edRedo() { var e = TD.ed; if (!e) return; if (!e.red.length) { toast('Tidak ada yang diulang'); return; } e.h.push(clonePts(e.pts)); e.pts = e.red.pop(); edRender(); }

  // ---------- Rapikan: buang titik berlebih dan getaran jari ----------
  function tidyPts(pts, kind) {
    if (pts.length < 4) return pts;
    var P = HzBlok.proj(pts[0][0], pts[0][1]), xy = pts.map(P.xy), bb = [1e9, 1e9, -1e9, -1e9];
    xy.forEach(function (q) { bb[0] = Math.min(bb[0], q[0]); bb[1] = Math.min(bb[1], q[1]); bb[2] = Math.max(bb[2], q[0]); bb[3] = Math.max(bb[3], q[1]); });
    var ext = Math.hypot(bb[2] - bb[0], bb[3] - bb[1]), tol = Math.max(0.6, Math.min(3, ext * 0.02));
    var ring = kind === 'pg' ? xy.concat([xy[0]]) : xy, keep = dpSimplify(ring, tol);
    if (kind === 'pg') keep = keep.filter(function (i) { return i < xy.length; });
    var out = keep.map(function (i) { return pts[i]; });
    return out.length < (kind === 'ln' ? 2 : 3) ? pts : out;
  }
  function edTidy() {
    var e = TD.ed; if (!e) return;
    var n0 = e.pts.length, out = tidyPts(e.pts, e.kind);
    if (out.length >= n0) { toast(n0 < 4 ? 'Belum ada yang perlu dirapikan' : 'Sudah rapi'); return; }
    edPush(); e.pts = clonePts(out); edRender(); toast('Dirapikan: ' + n0 + ' → ' + out.length + ' titik');
  }
  function itemTidy(it) {
    var n0 = it.pts.length, out = tidyPts(it.pts, it.t);
    if (out.length >= n0) { toast(n0 < 4 ? 'Belum ada yang perlu dirapikan' : 'Sudah rapi'); return; }
    it.pts = clonePts(out); touch(it); save(); drawAll(); barMain(); toast('Dirapikan: ' + n0 + ' → ' + out.length + ' titik');
  }

  // ---------- gambar dengan jari (seret di peta) ----------
  function rectInit() {
    var e = TD.ed, m = map(); if (!e || !m) return;
    var c = m.getCenter(), g = m.getBounds(), cl = [c.lat, c.lng];
    if (TD.blk && TD.blk.pts && HA.BT && !HA.BT.inside(cl)) { var sa = 0, so = 0, k = TD.blk.pts.length; TD.blk.pts.forEach(function (p) { sa += p[0]; so += p[1]; }); cl = [sa / k, so / k]; }
    var h = (g.getNorth() - g.getSouth()) / 4, w = (g.getEast() - g.getWest()) / 4;
    e.pts = [[cl[0] - h, cl[1] - w], [cl[0] + h, cl[1] - w], [cl[0] + h, cl[1] + w], [cl[0] - h, cl[1] + w]];
    lockMap(false); edRender(); edBar(); toast('Geser kotak atau sudutnya, lalu Simpan');
  }
  function strokeBind() {
    var m = map(); if (!m || TD.sb === m) return; TD.sb = m;
    var c = m.getContainer(), st = null, live = null;
    function ll(ev) { var q = m.mouseEventToLatLng(ev); return [q.lat, q.lng]; }
    function clearLive() { if (live) { try { m.removeLayer(live); } catch (e) {} live = null; } }
    function can(ev) {
      var e = TD.ed; if (!e || e.item || e.pan || TD.wk) return false;
      if (e.rect) return false;
      var t = ev.target; if (t && t.closest && t.closest('.tdv,.leaflet-control,button')) return false;
      return true;
    }
    c.addEventListener('pointerdown', function (ev) {
      if (st && ev.pointerId !== st.id) { st = null; clearLive(); return; }
      if (!can(ev)) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      st = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, pts: [ll(ev)], moved: false };
    });
    c.addEventListener('pointermove', function (ev) {
      if (!st || ev.pointerId !== st.id) return;
      if (!st.moved) { if (Math.hypot(ev.clientX - st.x, ev.clientY - st.y) < 10) return; st.moved = true; }
      st.pts.push(ll(ev));
      if (!live) live = L.polyline([], { color: brush().color, weight: 4, opacity: 0.9, interactive: false, dashArray: TD.ed && TD.ed.kind === 'pg' ? '6 5' : null }).addTo(m);
      live.setLatLngs(st.pts);
    });
    c.addEventListener('pointerup', function (ev) {
      if (!st || ev.pointerId !== st.id) return;
      var s = st; st = null; clearLive();
      if (s.moved) { TD.stroked = Date.now(); strokeDone(s.pts); }
    });
    c.addEventListener('pointercancel', function (ev) { if (st && ev.pointerId === st.id) { st = null; clearLive(); } });
  }
  function strokeDone(raw) {
    var e = TD.ed; if (!e || e.item) return;
    var arr = raw.filter(function (p) { return !TD.blk || !HA.BT || HA.BT.inside(p); });
    if (arr.length < 2) { toast('Gambar di dalam batas blok'); return; }
    var P = HzBlok.proj(arr[0][0], arr[0][1]), keep = dpSimplify(arr.map(P.xy), 0.4);
    arr = keep.map(function (i) { return arr[i]; });
    var first = e.pts.length === 0;
    if (first && e.kind === 'ln' && lenLL(arr, false) < 1.5) return;
    edPush(); e.pts = e.pts.concat(arr); edRender();
    if (first && e.pts.length >= edMin()) edDone();
  }

  // ---------- palet warna (akordeon) ----------
  function inkOn(hex) { var h = String(hex).replace('#', ''); if (h.length !== 6) return '#fff'; var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111' : '#fff'; }
  function boxesHtml(selId, withGear) {
    var d = data();
    return '<div class="tdKw"><div class="tdKs">' + d.cats.map(function (c) { return '<button type="button" class="tdk' + (c.id === selId ? ' on' : '') + '" data-cat="' + c.id + '" style="background:' + c.col + ';color:' + inkOn(c.col) + '">' + esc(c.name) + '</button>'; }).join('') + '</div>' +
      '</div>';
  }
  function circlesHtml(cc, selSub) {
    if (!cc || !cc.subs.length) return '';
    return '<div class="tdSb">' + cc.subs.map(function (s, i) { var c0 = s.col || cc.col; return '<button type="button" class="tdsc' + (selSub === s.id ? ' on' : '') + '" data-cat="' + cc.id + '" data-sub="' + s.id + '" style="background:' + c0 + ';color:' + inkOn(c0) + '" aria-label="' + esc(s.name) + '">' + (i + 1) + '</button>'; }).join('') + '</div>';
  }
  function palHtml(cur, op, showOp) {
    if (!TD.palOpen) return '';
    var cc = cur && cur.cat ? catOf(cur.cat) : null;
    return '<div class="tdPal">' + boxesHtml(cc ? cc.id : null, true) + circlesHtml(cc, cur ? cur.sub : null) +
      (showOp ? '<div class="tdOp"><span>Isi warna</span><input type="range" id="tdOpR" min="10" max="90" step="5" value="' + Math.round(op * 100) + '"><b id="tdOpV">' + Math.round(op * 100) + '%</b></div>' : '') + '</div>';
  }
  function palWire(onSel, onOp) {
    var bx = bar();
    bx.querySelectorAll('.tdk').forEach(function (e) { e.onclick = function () { onSel(e.getAttribute('data-cat'), null); }; });
    bx.querySelectorAll('.tdsc').forEach(function (e) {
      e.onclick = function () {
        var cid = e.getAttribute('data-cat'), sid = e.getAttribute('data-sub'), c = catOf(cid), sb = subOf(c, sid), was = e.classList.contains('on');
        if (sb && !was) toast(c.name + ' / ' + (sb.name || 'Sub'));
        onSel(cid, was ? null : sid);
      };
    });
    var ks = bx.querySelector('.tdKs'), on = ks && ks.querySelector('.tdk.on');
    if (ks && on) ks.scrollLeft = on.offsetLeft - (ks.clientWidth - on.offsetWidth) / 2;
    var r = $('tdOpR');
    if (r) { r.oninput = function () { $('tdOpV').textContent = r.value + '%'; onOp(+r.value / 100, false); }; r.onchange = function () { onOp(+r.value / 100, true); }; }
  }
  HA.tandaPalHtml = palHtml; HA.tandaPalWire = palWire;
  function katBtn() { return tb('tdKt', IC.tag, 'Kategori', !!TD.palOpen); }
  function katWire(fn) { if ($('tdKt')) $('tdKt').onclick = function () { TD.palOpen = !TD.palOpen; fn(); }; }
  HA.tandaKatBtn = katBtn; HA.tandaKatWire = katWire;
  HA.tandaSetBrush = function (c, sb) { var d = data(); d.brush.cat = c; d.brush.sub = sb || null; save(); };

  function edBar() {
    var e = TD.ed, bb = brush(), col = e.item ? colOf(e.item) : bb.color, op = e.item ? opOf(e.item) : bb.op, cur = e.item ? { cat: e.item.cat, sub: e.item.sub } : { cat: bb.cat, sub: bb.sub };
    bar().innerHTML = palHtml(cur, op, e.kind === 'pg') + '<div class="tdr">' + katBtn() + (e.rect ? '' : tb('tdTy', IC.tidy, 'Rapikan')) + (e.item || e.rect ? '' : tb('tdPn', IC.hand, 'Geser', e.pan)) + '</div>' +
      '<div class="tdr tdr2">' + ti('tdUr', IC.undo, 'Urung') + ti('tdRd', IC.redo, 'Ulang') + tb('tdBt', IC.close, 'Batal') + tb('tdOk', IC.check, e.split ? 'Belah' : 'Selesai', true) + '</div>';
    $('tdUr').onclick = edUndo; $('tdRd').onclick = edRedo; if ($('tdTy')) $('tdTy').onclick = edTidy; katWire(edBar);
    if ($('tdPn')) $('tdPn').onclick = function () { e.pan = !e.pan; lockMap(!e.pan); edStatus(); edBar(); };
    $('tdBt').onclick = function () { edCancel(); TD.tool = null; barMain(); };
    $('tdOk').onclick = edDone;
    palWire(function (cid, sid) {
      if (e.item) { e.item.cat = cid; e.item.sub = sid; e.item.col = null; touch(e.item); } else { var d = data(); d.brush.cat = cid; d.brush.sub = sid; }
      save(); edShape(); edBar();
    }, function (v, fin) {
      if (e.item) e.item.op = v; else data().brush.op = v;
      edShape(); if (fin) save();
    });
  }
  function edCancel() {
    spClear(); var e = TD.ed, m = map(); if (!e) return;
    e.vm.forEach(function (x) { m.removeLayer(x); }); if (e.shape) m.removeLayer(e.shape);
    TD.ed = null; lockMap(false); hud(''); draftClear(); drawAll();
  }
  function edDone() {
    var e = TD.ed; if (!e) return;
    if (e.pts.length < edMin()) { toast(e.kind === 'ln' ? 'Garis butuh minimal 2 titik' : 'Area butuh minimal 3 titik'); return; }
    if (e.split) { splitGo(); return; }
    var msg;
    if (e.item) { e.item.pts = e.pts; e.item.t = e.kind; if (e.item.full) { e.item.full = false; e.item.bid = null; } touch(e.item); msg = 'Bentuk diperbarui'; }
    else {
      var b = brush(), it = { id: newId(), t: e.kind, pts: e.pts, cat: b.cat, col: b.col, name: '', note: '', ts: Date.now() };
      if (e.kind === 'pg') it.op = b.op;
      addItem(it); e.item = it; msg = (e.kind === 'ln' ? 'Garis ' : 'Area ') + 'tersimpan';
    }
    var it2 = e.item, st = statOf(it2);
    save(); draftClear(); TD.ed = null; lockMap(false); hud(''); edCleanup(e); drawAll();
    toast(msg + ' · ' + statText(it2, st).replace('\n', ' · '));
    TD.tool = null;
    if (e.reopen) { itemSheet(it2); barMain(); return; }
    selectItem(it2);
  }
  // ---------- Belah: garis tepi ke tepi membagi blok, ketuk bagian yang diwarnai ----------
  function spClear() { if (TD.sp) { try { map().removeLayer(TD.sp.grp); } catch (x) {} TD.sp = null; } }
  function splitGo() {
    var e = TD.ed, blk = TD.blk; if (!e || !blk || !HA.tandaSplit) return;
    var r = HA.tandaSplit(blk.pts, e.pts); if (r.err) { toast(r.err); return; }
    var line = clonePts(e.pts); edCleanup(e); TD.ed = null; draftClear(); lockMap(false);
    var m = map(), b = brush(), grp = L.layerGroup().addTo(m);
    r.parts.forEach(function (p, i) {
      var pg = L.polygon(p, { color: b.color, weight: 3, fillColor: b.color, fillOpacity: 0.3 }).addTo(grp);
      pg.bindTooltip(fmtHa(HzBlok.areaHa(p)) + ' ha', { permanent: true, direction: 'center', className: 'mktip' });
      pg.on('click', function (ev) { L.DomEvent.stopPropagation(ev); spPick(i); });
    });
    L.polyline(r.line, { color: '#fff', weight: 2, dashArray: '6 5', interactive: false }).addTo(grp);
    TD.sp = { grp: grp, parts: r.parts, line: line }; TD.tool = 'bl';
    hud(r.parts.length + ' bagian · ketuk bagian yang mau diwarnai'); barMain();
  }
  function spPick(i) {
    var s = TD.sp; if (!s) return; var p = s.parts[i], b = brush();
    var it = { id: newId(), t: 'pg', pts: p, cat: b.cat, col: b.col, name: '', note: '', op: b.op, ts: Date.now() };
    addItem(it); save(); spClear(); TD.tool = null; drawAll();
    toast('Area tersimpan · ' + statText(it, statOf(it)).replace('\n', ' · '));
    selectItem(it);
  }
  function spBar() {
    bar().innerHTML = '<div class="tdr">' + tb('spBk', IC.back, 'Ubah garis') + tb('spCn', IC.close, 'Batal') + '</div>';
    $('spBk').onclick = function () { var ln = TD.sp ? TD.sp.line : []; spClear(); edStart('ln', null); TD.ed.split = true; TD.ed.pts = ln; edRender(); edBar(); };
    $('spCn').onclick = function () { spClear(); TD.tool = null; hud(''); barMain(); };
  }
  function edCleanup(e) { var m = map(); e.vm.forEach(function (x) { m.removeLayer(x); }); if (e.shape) { m.removeLayer(e.shape); e.shape = null; } }

  // ---------- mode Hapus (pilih banyak, satu konfirmasi) dan bilah tanda terpilih ----------
  function distSeg(p, a, b) { var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0; return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); }
  function itemDist(it, pt, m) {
    var pp = it.pts.map(function (q) { return m.latLngToContainerPoint(q); }), best = 1e9, i;
    if (it.t === 'pt') return pt.distanceTo(pp[0]);
    for (i = 0; i < pp.length - 1; i++) best = Math.min(best, distSeg(pt, pp[i], pp[i + 1]));
    if (it.t === 'pg') {
      best = Math.min(best, distSeg(pt, pp[pp.length - 1], pp[0]));
      if (pipXY(pt.x, pt.y, pp.map(function (q) { return [q.x, q.y]; }))) { var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pp.forEach(function (q) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }); best = Math.min(best, 1 + (x1 - x0) * (y1 - y0) / 1e6); }
    }
    return best;
  }
  function delTap(ll) {
    var m = map(), pt = m.latLngToContainerPoint(ll), best = null, bd = 1e9;
    var its = (HA.BT && TD.blk && HA.BT.itemsOf) ? HA.BT.itemsOf(TD.blk) : data().items;
    its.forEach(function (it) { var d = itemDist(it, pt, m); if (d < bd) { bd = d; best = it; } });
    if (best && bd <= 22) { TD.del = TD.del || {}; if (TD.del[best.id]) delete TD.del[best.id]; else TD.del[best.id] = 1; drawAll(); barMain(); }
    else toast('Tidak ada tanda di sini');
  }
  function subBar() {
    var bx = bar(); if (!bx) return false;
    if (TD.tool === 'del') {
      var n = Object.keys(TD.del || {}).length;
      bx.innerHTML = '<div class="tdr">' + tb('dlX', IC.close, 'Batal') + tb('dlGo', IC.trash, n ? 'Hapus (' + n + ')' : 'Hapus', n > 0) + '</div>';
      $('dlX').onclick = function () { TD.tool = null; TD.del = null; drawAll(); barMain(); };
      $('dlGo').onclick = function () {
        if (!n) { toast('Ketuk tanda yang mau dihapus'); return; }
        askConfirm('Hapus ' + n + ' tanda?', 'Bisa diurungkan dengan tombol Urung.', 'Hapus', function () {
          var ids = TD.del || {}, d = data(); d.items = d.items.filter(function (x) { return !ids[x.id]; });
          TD.tool = null; TD.del = null; save(); drawAll(); if (HA.BT) HA.BT.refresh(); barMain(); toast(n + ' tanda dihapus');
        });
      };
      hud(n ? n + ' tanda dipilih' : 'Ketuk tanda yang mau dihapus');
      return true;
    }
    if (TD.selIt) {
      var it = TD.selIt, col = colOf(it);
      bx.innerHTML = palHtml({ cat: it.cat, sub: it.sub }, opOf(it), it.t === 'pg') + '<div class="tdr">' + (it.t === 'pt' ? '' : tb('siTy', IC.tidy, 'Rapikan')) + tb('siSh', IC.edit, it.t === 'pt' ? 'Geser' : 'Bentuk') + tb('siDt', IC.list, 'Detail') + katBtn() + '</div>' +
        '<div class="tdr tdr2">' + ti('tdUn', IC.undo, 'Urung') + ti('tdRe', IC.redo, 'Ulang') + ti('siDl', IC.trash, 'Hapus', '', 'dn') + tb('siOk', IC.check, 'Selesai', true) + '</div>';
      if ($('siTy')) $('siTy').onclick = function () { itemTidy(it); };
      $('siSh').onclick = function () { TD.selIt = null; TD.palOpen = false; if (it.t === 'pt') { TD.tool = null; pointMove(it); } else { TD.tool = null; edStart(it.t, it); fitItem(it); } };
      $('siDt').onclick = function () { itemSheet(it); };
      $('siDl').onclick = function () { askConfirm('Hapus tanda ini?', 'Bisa diurungkan dengan tombol Urung.', 'Hapus', function () { var d = data(); d.items = d.items.filter(function (x) { return x.id !== it.id; }); TD.selIt = null; save(); drawAll(); if (HA.BT) HA.BT.refresh(); barMain(); }); };
      $('siOk').onclick = function () { TD.selIt = null; TD.palOpen = false; drawAll(); barMain(); };
      $('tdUn').onclick = function () { hsGo(-1); }; $('tdRe').onclick = function () { hsGo(1); }; katWire(barMain);
      palWire(function (cid, sid) { it.cat = cid; it.sub = sid; it.col = null; touch(it); save(); drawAll(); barMain(); }, function (v, fin) { it.op = v; drawAll(); if (fin) save(); });
      hud((it.name ? it.name + ' · ' : '') + (it.t === 'pt' ? 'Titik' : statText(it, statOf(it)).replace('\n', ' · ')));
      return true;
    }
    return false;
  }
  HA.tandaSubBar = subBar;

  function onMapClick(ev) {
    if (!TD.on) return;
    if (TD.stroked && Date.now() - TD.stroked < 450) return;
    var ll = [ev.latlng.lat, ev.latlng.lng];
    if (TD.wk || TD.sp) return;
    if (TD.tool === 'del') { delTap(ev.latlng); return; }
    if (TD.selIt && !TD.ed) { TD.selIt = null; TD.palOpen = false; drawAll(); barMain(); }
    if (HA.BT && HA.BT.tap(ll)) return;
    if (TD.ed && TD.ed.rect) return;
    if (TD.ed) { edPush(); TD.ed.pts.push(ll); edRender(); return; }
    if (TD.tool === 'pt') {
      var b = brush(), it = { id: newId(), t: 'pt', pts: [ll], cat: b.cat, col: b.col, name: '', note: '', ts: Date.now() };
      addItem(it); save(); drawAll(); toast('Titik ditambah'); return;
    }
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
  // ---------- daftar blok per kategori (ikon label) ----------
  var CL = { cat: null, sub: null, blk: null };
  var collId = new Intl.Collator('id', { numeric: true });
  function catList() {
    var d = data(); if (!catOf(CL.cat)) { CL.cat = d.cats[0].id; CL.sub = null; CL.blk = null; }
    var cc = catOf(CL.cat); if (CL.sub && !subOf(cc, CL.sub)) CL.sub = null;
    var ents = [];
    if (HA.BT && HA.BT.itemsOf) blks().forEach(function (b) {
      if (!b.conf || !b.pts || b.pts.length < 3) return;
      var its = HA.BT.itemsOf(b).filter(function (it) { return it.cat === CL.cat && (!CL.sub || it.sub === CL.sub); });
      if (its.length) ents.push({ b: b, its: its });
    });
    ents.sort(function (x, y) { return collId.compare(String(x.b.name), String(y.b.name)); });
    var sel = null; ents.forEach(function (x) { if (CL.blk != null && String(x.b.id) === String(CL.blk)) sel = x; });
    if (!sel) CL.blk = null;
    var det = '';
    if (sel) {
      var ha = 0, lj = 0, lm = 0, np = 0, nl = 0, na = 0, ds = {};
      sel.its.forEach(function (it) { var st = statOf(it); ds[dateOf(it)] = 1; if (it.t === 'pt') np++; else if (it.t === 'ln') nl++; else { na++; ha += st.ha; lj += st.n; lm += st.lm; } });
      var dl = Object.keys(ds).sort().map(fmtD8).join(', ');
      det = '<div class="card tdDet"><b>Blok ' + esc(String(sel.b.name)) + '</b> <span class="muted">· ' + fmtHa(HzBlok.areaHa(sel.b.pts)) + ' ha</span>' +
        '<div>Tanggal: ' + esc(dl) + '</div><div>Tanda: ' + sel.its.length + ' (' + [np ? np + ' titik' : '', nl ? nl + ' garis' : '', na ? na + ' area' : ''].filter(Boolean).join(', ') + ')</div>' +
        (na ? '<div>Luas tanda: ' + fmtHa(ha) + ' ha</div><div>Lajur: ' + ribu(lj) + ' · Panjang lajur: ' + ribu(lm) + ' m</div>' : '') + '</div>' +
        '<button class="btn pri" id="clGo" style="width:100%;margin-top:8px">Buka blok di peta</button>';
    }
    var rb = '<div class="tdRb">' + d.cats.map(function (c) { return '<button type="button" class="tdrb' + (c.id === CL.cat ? ' on' : '') + '" data-cat="' + c.id + '" style="background:' + c.col + ';color:' + inkOn(c.col) + '">' + esc(c.name) + '</button>'; }).join('') + '</div>';
    var lpH = '';
    if (CL.lp === CL.cat) {
      lpH = '<div class="card tdLp"><div class="tdLr"><i class="cdot" style="background:' + cc.col + '"></i><b>' + esc(cc.name) + '</b><button type="button" class="btn sm" id="lpEd">Edit</button><button type="button" class="btn sm" id="lpDl">Hapus</button></div>' +
        (cc.subs.length ? cc.subs.map(function (s) { return '<div class="tdLr tdLs2"><i class="cdot" style="background:' + (s.col || cc.col) + '"></i><span>' + esc(s.name || 'Sub') + '</span><button type="button" class="btn sm" data-se="' + s.id + '">Edit</button><button type="button" class="btn sm" data-sd="' + s.id + '">Hapus</button></div>'; }).join('') : '<div class="muted" style="padding:4px 0">Belum ada sub-kategori.</div>') + '</div>';
    }
    openSheet('<div class="grab"></div>' + rb + '<div class="muted tdHint">Tahan lama sebuah kategori untuk Edit atau Hapus</div>' + lpH + circlesHtml(cc, CL.sub) +
      '<div class="h" style="margin-top:10px">BLOK (' + ents.length + ')</div>' +
      (ents.length ? '<div class="tdBl">' + ents.map(function (x) { return '<button type="button" class="tdbc' + (sel && x === sel ? ' on' : '') + '" data-b="' + esc(String(x.b.id)) + '">' + esc(String(x.b.name)) + '</button>'; }).join('') + '</div>' : '<div class="card muted">Belum ada blok yang memakai kategori ini.</div>') +
      det + '<button class="btn" id="clX" style="width:100%;margin-top:8px">Tutup</button>');
    var sh = $('sheet');
    sh.querySelectorAll('.tdrb').forEach(function (e) {
      var tm = null, cid = e.getAttribute('data-cat');
      function cl() { if (tm) { clearTimeout(tm); tm = null; } }
      e.addEventListener('pointerdown', function () { CL.fired = false; cl(); tm = setTimeout(function () { tm = null; CL.fired = true; CL.cat = cid; CL.sub = null; CL.blk = null; CL.lp = cid; catList(); }, 500); });
      ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach(function (n) { e.addEventListener(n, function (ev) { if (n === 'pointermove' && ev.pointerType !== 'mouse') return; if (n !== 'pointermove') cl(); }); });
      e.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
      e.onclick = function () { if (CL.fired) { CL.fired = false; return; } CL.cat = cid; CL.sub = null; CL.blk = null; CL.lp = null; catList(); };
    });
    sh.querySelectorAll('.tdsc').forEach(function (e) {
      e.onclick = function () {
        var sid = e.getAttribute('data-sub'), c = catOf(CL.cat), sb = subOf(c, sid);
        if (CL.sub === sid) CL.sub = null; else { CL.sub = sid; if (sb) toast(c.name + ' / ' + (sb.name || 'Sub')); }
        CL.blk = null; catList();
      };
    });
    sh.querySelectorAll('.tdbc').forEach(function (e) { e.onclick = function () { var id = e.getAttribute('data-b'); CL.blk = CL.blk != null && String(CL.blk) === id ? null : id; catList(); }; });
    if ($('lpEd')) $('lpEd').onclick = function () { askConfirm('Edit kategori ' + cc.name + '?', 'Nama dan warna diubah di halaman pengelola.', 'Edit', function () { catPage(); }); };
    if ($('lpDl')) $('lpDl').onclick = function () {
      if (d.cats.length <= 1) { toast('Minimal ada satu kategori'); return; }
      var n = d.items.filter(function (x) { return x.cat === cc.id; }).length;
      askConfirm('Hapus kategori ' + cc.name + '?', (n ? n + ' tanda tetap ada, warnanya dipertahankan tanpa kategori.' : 'Kategori ini belum dipakai.'), 'Hapus', function () {
        d.items.forEach(function (x) { if (x.cat === cc.id) { x.col = colOf(x); x.cat = null; x.sub = null; } });
        d.cats = d.cats.filter(function (x) { return x !== cc; });
        if (d.brush.cat === cc.id) { d.brush.cat = d.cats[0].id; d.brush.sub = null; }
        CL.lp = null; CL.cat = d.cats[0].id; CL.sub = null; CL.blk = null; save(); drawAll(); if (HA.BT) HA.BT.refresh(); catList();
      });
    };
    sh.querySelectorAll('[data-se]').forEach(function (e) { e.onclick = function () { askConfirm('Edit sub-kategori?', 'Nama dan warna diubah di halaman pengelola.', 'Edit', function () { catPage(); }); }; });
    sh.querySelectorAll('[data-sd]').forEach(function (e) {
      e.onclick = function () {
        var sid = e.getAttribute('data-sd'), sb = subOf(cc, sid); if (!sb) return;
        var n = d.items.filter(function (x) { return x.cat === cc.id && x.sub === sid; }).length;
        askConfirm('Hapus sub-kategori ' + (sb.name || 'Sub') + '?', (n ? n + ' tanda tetap ada tanpa sub-kategori.' : 'Sub-kategori ini belum dipakai.'), 'Hapus', function () {
          d.items.forEach(function (x) { if (x.cat === cc.id && x.sub === sid) x.sub = null; });
          cc.subs = cc.subs.filter(function (x) { return x.id !== sid; });
          if (d.brush.sub === sid) d.brush.sub = null;
          if (CL.sub === sid) CL.sub = null;
          save(); drawAll(); if (HA.BT) HA.BT.refresh(); catList();
        });
      };
    });
    if ($('clGo')) $('clGo').onclick = function () { var b = sel.b; closeSheet(); if (HA.BT) HA.BT.pick(b, true); };
    $('clX').onclick = function () { CL.lp = null; closeSheet(); };
  }
  HA.tandaCatList = catList;
  // ---------- halaman kategori ----------
  function catPage() {
    var d = data(), ex = null, foc = null;
    function norm() { d.cats.forEach(function (c, i) { if (!String(c.name).trim()) c.name = 'Kategori ' + (i + 1); c.subs.forEach(function (s, j) { if (!String(s.name).trim()) s.name = 'Sub ' + (j + 1); }); }); }
    function sw() { return '<div class="tdCs tdCw">' + PAL.map(function (c) { return '<button type="button" class="tdc" data-pc="' + c[1] + '" style="background:' + c[1] + '" aria-label="' + c[0] + '"></button>'; }).join('') + '</div>'; }
    function draw() {
      openSheet('<div class="grab"></div><div class="st">KATEGORI</div><div class="muted" style="margin-bottom:8px">Nama dan warna bebas diubah. Sub-kategori ikut warna kategori, tapi warnanya boleh diganti.</div><div id="kgL">' + d.cats.map(function (c) {
        var h = '<div class="kgc"><div class="kgr"><button type="button" class="kgd" data-pk="c:' + c.id + '" style="background:' + c.col + '" aria-label="Warna"></button><input type="text" maxlength="30" placeholder="Nama kategori" data-nc="' + c.id + '" value="' + esc(c.name) + '"><button type="button" class="ib" data-dc="' + c.id + '" aria-label="Hapus">' + IC.trash + '</button></div>' +
          '<div class="kgst"><span>Gaya</span><div class="kgg" data-gs="' + c.id + '"><button type="button" data-g="isi"' + (c.style === 'garis' ? '' : ' class="on"') + '>Isi</button><button type="button" data-g="garis"' + (c.style === 'garis' ? ' class="on"' : '') + '>Garis tepi</button></div><span>Tebal</span><input type="range" min="1" max="8" step="1" data-gw="' + c.id + '" value="' + (c.w || 3) + '"><b>' + (c.w || 3) + '</b></div>';
        if (ex === 'c:' + c.id) h += sw();
        c.subs.forEach(function (s) {
          var k = 's:' + c.id + ':' + s.id;
          h += '<div class="kgr kgs"><button type="button" class="kgd" data-pk="' + k + '" style="background:' + (s.col || c.col) + '" aria-label="Warna"></button><input type="text" maxlength="30" placeholder="Nama sub-kategori" data-ns="' + c.id + ':' + s.id + '" value="' + esc(s.name) + '"><button type="button" class="ib" data-ds="' + c.id + ':' + s.id + '" aria-label="Hapus">' + IC.trash + '</button></div>';
          if (ex === k) h += sw() + (s.col ? '<button type="button" class="btn sm" data-rs="' + c.id + ':' + s.id + '" style="margin:0 0 6px 2rem">Ikut warna kategori</button>' : '');
        });
        return h + '<button type="button" class="kga" data-as="' + c.id + '">+ Sub-kategori</button></div>';
      }).join('') + '</div><button class="btn" id="kgA" style="width:100%;margin-top:10px">+ Kategori baru</button><button class="btn pri" id="kgX" style="width:100%;margin-top:8px">Selesai</button>');
      var sh = $('sheet');
      sh.querySelectorAll('[data-gs] button').forEach(function (e) { e.onclick = function () { var c = catOf(e.parentNode.getAttribute('data-gs')); if (c) { c.style = e.getAttribute('data-g'); save(); draw(); } }; });
      sh.querySelectorAll('[data-gw]').forEach(function (e) { e.oninput = function () { var c = catOf(e.getAttribute('data-gw')); if (c) { c.w = +e.value; if (e.nextSibling) e.nextSibling.textContent = e.value; save(); } }; });
      sh.querySelectorAll('[data-nc]').forEach(function (e) { e.oninput = function () { var c = catOf(e.getAttribute('data-nc')); if (c) { c.name = e.value; save(); } }; });
      sh.querySelectorAll('[data-ns]').forEach(function (e) { e.oninput = function () { var a = e.getAttribute('data-ns').split(':'), s = subOf(catOf(a[0]), a[1]); if (s) { s.name = e.value; save(); } }; });
      sh.querySelectorAll('[data-pk]').forEach(function (e) { e.onclick = function () { var k = e.getAttribute('data-pk'); ex = ex === k ? null : k; draw(); }; });
      sh.querySelectorAll('[data-pc]').forEach(function (e) {
        e.onclick = function () {
          var a = (ex || '').split(':'), col = e.getAttribute('data-pc'), c = catOf(a[1]);
          if (a[0] === 'c' && c) c.col = col; else if (a[0] === 's') { var s = subOf(c, a[2]); if (s) s.col = col; }
          ex = null; save(); draw();
        };
      });
      sh.querySelectorAll('[data-rs]').forEach(function (e) { e.onclick = function () { var a = e.getAttribute('data-rs').split(':'), s = subOf(catOf(a[0]), a[1]); if (s) { s.col = null; ex = null; save(); draw(); } }; });
      sh.querySelectorAll('[data-as]').forEach(function (e) { e.onclick = function () { var c = catOf(e.getAttribute('data-as')), s = { id: uid('s'), name: '', col: null }; c.subs.push(s); foc = 'ns:' + c.id + ':' + s.id; save(); draw(); }; });
      sh.querySelectorAll('[data-dc]').forEach(function (e) {
        e.onclick = function () {
          var c = catOf(e.getAttribute('data-dc')); if (!c) return;
          if (d.cats.length <= 1) { toast('Minimal ada satu kategori'); return; }
          var n = d.items.filter(function (x) { return x.cat === c.id; }).length;
          function go() {
            d.items.forEach(function (x) { if (x.cat === c.id) { x.col = colOf(x); x.cat = null; x.sub = null; } });
            d.cats = d.cats.filter(function (x) { return x !== c; });
            if (d.brush.cat === c.id) { d.brush.cat = d.cats[0].id; d.brush.sub = null; }
            save(); draw();
          }
          if (n) askConfirm('Hapus kategori ' + c.name + '?', n + ' tanda tetap ada, warnanya dipertahankan tanpa kategori.', 'Hapus', go); else go();
        };
      });
      sh.querySelectorAll('[data-ds]').forEach(function (e) {
        e.onclick = function () {
          var a = e.getAttribute('data-ds').split(':'), c = catOf(a[0]); if (!c) return;
          d.items.forEach(function (x) { if (x.cat === c.id && x.sub === a[1]) x.sub = null; });
          c.subs = c.subs.filter(function (x) { return x.id !== a[1]; });
          if (d.brush.sub === a[1]) d.brush.sub = null;
          save(); draw();
        };
      });
      $('kgA').onclick = function () { var c = { id: uid('k'), name: '', style: 'garis', w: 3, col: (function () { var u = {}; d.cats.forEach(function (x) { u[String(x.col).toLowerCase()] = 1; }); var f = PAL.filter(function (x) { return !u[x[1].toLowerCase()]; })[0]; return (f || PAL[d.cats.length % PAL.length])[1]; })(), subs: [] }; d.cats.push(c); foc = 'nc:' + c.id; save(); draw(); };
      $('kgX').onclick = function () { norm(); save(); closeSheet(); TD.palOpen = false; drawAll(); if (HA.BT) HA.BT.refresh(); if (TD.on) { if (TD.ed) edBar(); else barMain(); } if (HA.KM) HA.KM.sync(); };
      if (foc) { var fe = sh.querySelector('[data-' + foc.split(':')[0] + '="' + foc.slice(foc.indexOf(':') + 1) + '"]'); foc = null; if (fe) { try { fe.focus(); } catch (x) {} } }
    }
    draw();
  }
  HA.tandaCatPage = catPage;
  // ---------- panel satu tanda ----------
  function typeName(t) { return t === 'pt' ? 'TITIK' : (t === 'ln' ? 'GARIS' : 'AREA'); }
  function catSelHtml(it) {
    var d = data(), c = it.cat ? catOf(it.cat) : null;
    return '<select id="tiCa">' + (c ? '' : '<option value="">Tanpa kategori</option>') + d.cats.map(function (x) { return '<option value="' + x.id + '"' + (c && x.id === c.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<select id="tiSb"' + (c && c.subs.length ? '' : ' disabled') + '><option value="">Tanpa sub</option>' + (c ? c.subs.map(function (x) { return '<option value="' + x.id + '"' + (it.sub === x.id ? ' selected' : '') + '>' + esc(x.name || 'Sub') + '</option>'; }).join('') : '') + '</select>';
  }
  function itemSheet(it) {
    var st = statOf(it), c = it.cat ? catOf(it.cat) : null;
    var lines = it.t === 'pt' ? it.pts[0][0].toFixed(6) + ', ' + it.pts[0][1].toFixed(6) : statText(it, st);
    openSheet('<div class="grab"></div><div class="st">' + typeName(it.t) + (it.full ? ' · BLOK UTUH' : '') + '</div>' +
      '<div class="bnm"><input type="text" id="tiN" maxlength="40" placeholder="Nama (boleh kosong)" value="' + esc(it.name || '') + '"></div>' +
      '<div class="card" style="white-space:pre-line">' + esc(lines) + '</div>' +
      '<div class="h" style="margin-top:10px">KATEGORI</div><div class="tdsel"><i class="cdot" style="background:' + colOf(it) + '"></i>' + catSelHtml(it) + '</div>' +
      '<div class="h" style="margin-top:10px">TANGGAL</div><div class="bnm"><input type="date" id="tiDt" value="' + dateOf(it) + '"></div>' +
      '<div class="h" style="margin-top:10px">CATATAN</div><div class="bnm"><input type="text" id="tiNt" maxlength="120" value="' + esc(it.note || '') + '"></div>' +
      '<div class="opts" style="margin-top:10px"><button class="opt" id="tiZ">Zoom ke sini</button>' + (it.t !== 'pt' ? '<button class="opt" id="tiE">Edit bentuk</button>' : '<button class="opt" id="tiE">Geser titik</button>') + (it.t === 'ln' && it.pts.length >= 3 ? '<button class="opt" id="tiV">Jadikan area</button>' : '') + (it.t === 'pg' ? '<button class="opt" id="tiV">Jadikan garis</button>' : '') + '</div>' +
      '<button class="btn" id="tiD" style="width:100%;margin-top:10px">Hapus</button><button class="btn pri" id="tiX" style="width:100%;margin-top:8px">Selesai</button>');
    function keep() { it.name = $('tiN').value.trim(); it.note = $('tiNt').value.trim(); var dv = $('tiDt').value; if (/^\d{4}-\d{2}-\d{2}$/.test(dv)) it.date = dv; touch(it); save(); drawAll(); }
    $('tiX').onclick = function () { keep(); closeSheet(); };
    $('tiCa').onchange = function () { keep(); it.cat = $('tiCa').value; it.sub = null; it.col = null; touch(it); save(); drawAll(); itemSheet(it); };
    $('tiSb').onchange = function () { keep(); it.sub = $('tiSb').value || null; touch(it); save(); drawAll(); itemSheet(it); };
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
    var h = function (ev) { m.off('click', h); it.pts = [[ev.latlng.lat, ev.latlng.lng]]; touch(it); save(); TD.tool = null; TD.selIt = it; drawAll(); barMain(); };
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
    function sidOf(it) { return 'c' + colOf(it).replace('#', '') + 'o' + Math.round(opOf(it) * 100); }
    all.forEach(function (it) { cols[sidOf(it)] = { c: colOf(it), a: ('0' + Math.round(opOf(it) * 255).toString(16)).slice(-2) }; });
    var x = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + xe(title || ('Marking HZ Trip ' + stamp())) + '</name>';
    Object.keys(cols).forEach(function (id) {
      var c = cols[id].c, pa = cols[id].a;
      x += '<Style id="' + id + '"><IconStyle><color>' + kmlCol(c, 'ff') + '</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.9</scale></LabelStyle><LineStyle><color>' + kmlCol(c, 'ff') + '</color><width>3</width></LineStyle><PolyStyle><color>' + kmlCol(c, pa) + '</color></PolyStyle></Style>';
    });
    function ring(pts) { var a = pts.map(function (p) { return (+p[1]).toFixed(7) + ',' + (+p[0]).toFixed(7) + ',0'; }); a.push(a[0]); return a.join(' '); }
    function pm(it) {
      var st = statOf(it), c = it.cat ? catOf(it.cat) : null, col = colOf(it);
      if (it.boundary) return '<Placemark><name>' + xe(it.name || '') + '</name><description>Batas blok</description><Style><LineStyle><color>ff00d6ff</color><width>2.5</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style><ExtendedData><Data name="hz_type"><value>blk</value></Data></ExtendedData><Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>' + ring(it.pts) + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>';
      var s = '<Placemark><name>' + xe(it.name || '') + '</name><description>' + xe(statText(it, st).replace('\n', ' | ') + (it.note ? ' | ' + it.note : '')) + '</description><styleUrl>#' + sidOf(it) + '</styleUrl>' +
        '<ExtendedData><Data name="hz_type"><value>' + it.t + '</value></Data><Data name="hz_cat"><value>' + xe(c ? c.name : '') + '</value></Data><Data name="hz_sub"><value>' + xe((function () { var q = c ? subOf(c, it.sub) : null; return q ? q.name : ''; })()) + '</value></Data><Data name="hz_date"><value>' + dateOf(it) + '</value></Data><Data name="hz_col"><value>' + col + '</value></Data>' + (it.t === 'pg' ? '<Data name="hz_op"><value>' + Math.round(opOf(it) * 100) + '</value></Data>' : '') + '<Data name="hz_note"><value>' + xe(it.note || '') + '</value></Data>' + (it.full ? '<Data name="hz_bid"><value>' + xe(it.bid) + '</value></Data>' : '') + '</ExtendedData>';
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
        d.items.push({ id: newId(), t: t === 'Point' ? 'pt' : (t === 'LineString' ? 'ln' : 'pg'), pts: pts, cat: cat ? cat.id : null, col: cat ? null : color, name: name, note: ext.hz_note || '', date: /^\d{4}-\d{2}-\d{2}$/.test(ext.hz_date || '') ? ext.hz_date : todayISO(), ts: Date.now() }); if (t === 'Polygon' && ext.hz_op && isFinite(+ext.hz_op)) d.items[d.items.length - 1].op = Math.max(0.1, Math.min(0.9, +ext.hz_op / 100)); added++;
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
    PR.title = defTitle || '';
    openSheet('<div class="grab"></div><div class="st">CETAK MARKING</div>' +
      '<div class="h">JUDUL</div><input type="text" id="mpT" maxlength="60" placeholder="Kosong" value="' + esc(PR.title) + '" style="width:100%">' +
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
      return buildMarkPdf(items, Object.assign({}, PR, { buf: blk ? bufM() : 0, groups: [{ title: PR.title, items: items, blk: blk || null }] }));
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
  function ckName(it) { var c = it.cat ? catOf(it.cat) : null; return c ? c.name : 'Tanpa kategori'; }
  HA.tandaCk = ck; HA.tandaCatKey = ck;
  HA.tandaCatInfo = function (it) { var c = it.cat ? catOf(it.cat) : null; return { name: c ? c.name : 'Tanpa kategori', col: c ? c.col : colOf(it) }; };
  function tabKey(it) { return ck(it) + '|' + (it.sub || '') + '|' + dateOf(it); }
  function tabName(it) { var c = it.cat ? catOf(it.cat) : null; if (!c) return 'Tanpa kategori'; var s = subOf(c, it.sub); return c.name + (s ? ' / ' + s.name : ''); }
  function catIdx(it) { var r = 99, sx = 0; data().cats.forEach(function (c, i) { if (c.id === it.cat) { r = i; if (it.sub) c.subs.forEach(function (s, j) { if (s.id === it.sub) sx = j + 1; }); } }); return r * 100 + sx; }
  function pageBox(items, blk, o) {
    var allp = []; items.forEach(function (it) { it.pts.forEach(function (p) { allp.push(p); }); }); if (blk) blk.pts.forEach(function (p) { allp.push(p); });
    var mb = bboxOf(allp);
    if (blk && o.buf) { var lc0 = (mb[0] + mb[2]) / 2, dl = o.buf / 111320, dg = o.buf / (111320 * Math.cos(lc0 * Math.PI / 180)); mb = [mb[0] - dl, mb[1] - dg, mb[2] + dl, mb[3] + dg]; }
    return mb;
  }
  HA.tandaPageBox = pageBox; HA.tandaPal = PAL; HA.tandaCatOf = catOf; HA.tandaColOf = colOf; HA.tandaColorName = colorName;
  function buildMarkPdf(itemsAll, o) {
    var objs = [], ver = (document.querySelector('.ver') ? (document.querySelector('.ver').textContent.match(/Versi\s*([\d.]+)/) || [])[1] : '') || '';
    function add(b) { objs.push(b); return objs.length; }
    function stream(dict, dt) { return '<< ' + dict + ' /Length ' + dt.length + ' >>\nstream\n' + dt + '\nendstream'; }
    var dd = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; }, tgl = p2(dd.getDate()) + '-' + p2(dd.getMonth() + 1) + '-' + String(dd.getFullYear()).slice(2);
    var cat = add(''), pages = add(''), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2o = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var gsM = {};
    function gsFor(op) { var k = Math.round(op * 100); if (!gsM[k]) gsM[k] = add('<< /Type /ExtGState /ca ' + (k / 100) + ' /CA 1 >>'); return k; }
    var res0 = '<< /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2o + ' 0 R >>';
    var usedGs = {};
    var groups = o.groups || [{ title: o.title, items: itemsAll }];
    function page(items, ttlText, blk, img, catName) {
    var mb = pageBox(items, blk, o), hasImg = !!img;
    var latc = (mb[0] + mb[2]) / 2, kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 111320;
    var mw = Math.max(50, (mb[3] - mb[1]) * kx), mh = Math.max(50, (mb[2] - mb[0]) * ky), PW = 595.28, PH = 841.89, M = 24;
    var trow = {}, tord = [], anyPL = false;
    items.forEach(function (it) {
      var k = tabKey(it), st0 = statOf(it);
      if (!trow[k]) { trow[k] = { name: tabName(it), col: colOf(it), date: dateOf(it), ord: catIdx(it), ha: 0, lj: 0, lm: 0, pt: 0, m: 0 }; tord.push(k); }
      var r0 = trow[k];
      if (it.t === 'pt') { r0.pt++; anyPL = true; } else if (it.t === 'ln') { r0.m += st0.m; anyPL = true; } else { r0.ha += st0.ha; r0.lj += st0.n; r0.lm += st0.lm; }
    });
    tord.sort(function (a, b) { var p = trow[a], q = trow[b]; return (p.ord - q.ord) || (p.name < q.name ? -1 : (p.name > q.name ? 1 : 0)) || (p.date < q.date ? -1 : (p.date > q.date ? 1 : 0)); });
    var custom = asc((ttlText || '').trim()), ttl = blk ? 'Blok ' + asc(blk.name) : (custom || 'Marking HZ Trip'), subT = blk ? [asc(catName || ''), custom].filter(Boolean).join(' \u00B7 ') : '';
    var HH = subT ? 40 : 26, TRH = Math.max(14, Math.min(26, 330 / (tord.length + 1))), TH = TRH * (tord.length + 1) + 16;
    var ya = M + TH + 10, yb = PH - M - HH, fw = PW - 2 * M, fh = yb - ya, sc = Math.min(fw / (mw * 1.1), fh / (mh * 1.1)), offx = (fw - mw * sc) / 2, offy = (fh - mh * sc) / 2;
    var X = function (lng) { return M + offx + (lng - mb[1]) * kx * sc; }, Y = function (lat) { return ya + offy + (lat - mb[0]) * ky * sc; };
    var lngAt = function (x) { return mb[1] + (x - M - offx) / (kx * sc); }, latAt = function (y) { return mb[0] + (y - ya - offy) / (ky * sc); };
    var c = [], info = [], imN = 0;
    if (hasImg) { imN = add(stream('/Type /XObject /Subtype /Image /Width ' + img.w + ' /Height ' + img.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', img.data)); c.push('q ' + f2((mb[3] - mb[1]) * kx * sc) + ' 0 0 ' + f2((mb[2] - mb[0]) * ky * sc) + ' ' + f2(X(mb[1])) + ' ' + f2(Y(mb[0])) + ' cm /Im' + imN + ' Do Q'); }
    c.push('0 g BT /F2 16 Tf ' + f2(M) + ' ' + f2(PH - M - 14) + ' Td (' + pe(ttl) + ') Tj ET');
    if (subT) c.push('0 g BT /F1 11 Tf ' + f2(M) + ' ' + f2(PH - M - 30) + ' Td (' + pe(subT) + ') Tj ET');
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
    var fits = [];
    items.forEach(function (it) {
      var col = colOf(it), st = statOf(it), lab = [];
      if (o.nama && it.name) lab.push(asc(it.name));
      if (o.nilai) { if (it.t === 'pg') lab.push(fmtHa(st.ha) + ' ha'); else if (it.t === 'ln') lab.push(fmtM(st.m)); }
      var q = bboxOf(it.pts), bw = (q[3] - q[1]) * kx * sc, bh = (q[2] - q[0]) * ky * sc, wmax = 1; lab.forEach(function (t) { wmax = Math.max(wmax, t.length); });
      info.push({ it: it, col: col, st: st, lab: lab, x0: X(q[1]), x1: X(q[3]), y0: Y(q[0]), y1: Y(q[2]) });
      if (it.t === 'pg' && lab.length) fits.push(Math.min(bw * 0.84 / (Math.max(3, wmax) * 0.52), bh * 0.7 / (lab.length * 1.15)));
    });
    fits.sort(function (a, b) { return a - b; });
    var fsU = Math.max(4, Math.min(11, fits.length ? fits[Math.floor(fits.length * 0.25)] : 8)); if ({ s: 1, m: 1, l: 1 }[o.fs]) fsU = { s: 5, m: 7.5, l: 11 }[o.fs];
    // bentuk
    info.forEach(function (n) {
      var it = n.it, s = '', i;
      if (it.t === 'pg') { it.pts.forEach(function (p, i2) { s += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i2 ? ' l ' : ' m '); }); usedGs[gsFor(opOf(it))] = 1; c.push('q /G' + gsFor(opOf(it)) + ' gs ' + rgb(n.col) + ' rg ' + s + 'h f Q ' + rgb(n.col) + ' RG 1.3 w ' + s + 'h S'); }
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
        var w = t.length * fsU * 0.52, x = align === 'l' ? cx : cx - w / 2, yb = top - i * fsU * 1.15;
        c.push('q 1 g ' + f2(x - 2) + ' ' + f2(yb - fsU * 0.25) + ' ' + f2(w + 4) + ' ' + f2(fsU * 1.15) + ' re f Q');
        c.push('0 g BT /F1 ' + f2(fsU) + ' Tf ' + f2(x) + ' ' + f2(yb) + ' Td (' + pe(t) + ') Tj ET');
      });
    });
    // skala dan panah utara
    var L0 = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].filter(function (v) { return v * sc < fw * 0.25; }).pop() || 10, bx = PW / 2 - L0 * sc / 2, by = ya + 16;
    if (hasImg) c.push('1 g ' + f2(bx - 8) + ' ' + f2(by - 8) + ' ' + f2(L0 * sc + 16) + ' 28 re f 0 g');
    c.push('0 G 1 w ' + f2(bx) + ' ' + f2(by) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by) + ' l S ' + f2(bx) + ' ' + f2(by - 4) + ' m ' + f2(bx) + ' ' + f2(by + 4) + ' l S ' + f2(bx + L0 * sc) + ' ' + f2(by - 4) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by + 4) + ' l S');
    c.push('BT /F1 8 Tf ' + f2(bx) + ' ' + f2(by + 7) + ' Td (' + (L0 >= 1000 ? (L0 / 1000) + ' km' : L0 + ' m') + ') Tj ET');
    var nx0 = PW - M - 24, ny0 = yb - 52;
    if (hasImg) c.push('1 g ' + f2(nx0 - 12) + ' ' + f2(ny0 - 14) + ' 24 46 re f 0 g');
    c.push('1 w ' + f2(nx0) + ' ' + f2(ny0) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l S ' + f2(nx0 - 5) + ' ' + f2(ny0 + 20) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l ' + f2(nx0 + 5) + ' ' + f2(ny0 + 20) + ' l S');
    c.push('BT /F2 9 Tf ' + f2(nx0 - 3) + ' ' + f2(ny0 - 10) + ' Td (U) Tj ET');
    // tabel perlakuan per blok
    var W = PW - 2 * M, dW = 58, hW = 46, lW = 44, mW = 82, pW = anyPL ? 84 : 0, c0W = W - dW - hW - lW - mW - pW, ty0 = M + TH, ncR = tord.length + 1;
    var bnd = [M, M + c0W, M + c0W + dW, M + c0W + dW + hW, M + c0W + dW + hW + lW, M + c0W + dW + hW + lW + mW]; if (anyPL) bnd.push(M + W);
    var fsT = Math.min(10, TRH * 0.5 + 1.5), i2;
    function cut(t, n) { t = asc(t); return t.length > n ? t.slice(0, Math.max(1, n - 1)) + '.' : t; }
    function txc(x, yb0, t, bold, fz) { c.push('0 g BT /' + (bold ? 'F2' : 'F1') + ' ' + f2(fz) + ' Tf ' + f2(x) + ' ' + f2(yb0) + ' Td (' + pe(t) + ') Tj ET'); }
    c.push('1 g ' + f2(M) + ' ' + f2(M) + ' ' + f2(W) + ' ' + f2(TH) + ' re f');
    c.push('0.9 g ' + f2(M) + ' ' + f2(ty0 - TRH) + ' ' + f2(W) + ' ' + f2(TRH) + ' re f');
    c.push('0 G 0.7 w ' + f2(M) + ' ' + f2(ty0 - TRH * ncR) + ' ' + f2(W) + ' ' + f2(TRH * ncR) + ' re S');
    for (i2 = 1; i2 < ncR; i2++) c.push('0.5 w ' + f2(M) + ' ' + f2(ty0 - TRH * i2) + ' m ' + f2(M + W) + ' ' + f2(ty0 - TRH * i2) + ' l S');
    for (i2 = 1; i2 < bnd.length; i2++) c.push('0.5 w ' + f2(bnd[i2]) + ' ' + f2(ty0) + ' m ' + f2(bnd[i2]) + ' ' + f2(ty0 - TRH * ncR) + ' l S');
    var hb = ty0 - TRH + (TRH - 8) / 2 + 1, hd = [blk ? asc(blk.name) + ' (' + fmtHa(HzBlok.areaHa(blk.pts)) + ' ha)' : 'Kategori', 'Tanggal', 'Ha', 'Lajur', 'Panjang lajur (m)'];
    if (anyPL) hd.push('Titik / garis');
    hd.forEach(function (h, i) { txc(bnd[i] + 4 + (i === 0 ? 0 : 0), hb, i === 0 ? cut(h, Math.floor((c0W - 8) / 4.4)) : h, true, 8); });
    tord.forEach(function (k, i) {
      var r = trow[k], rowBot = ty0 - TRH * (i + 2), bs = Math.min(TRH - 6, 20), tb0 = rowBot + (TRH - fsT) / 2 + 1;
      c.push(rgb(r.col) + ' rg 0 G 0.8 w ' + f2(M + 4) + ' ' + f2(rowBot + (TRH - bs) / 2) + ' ' + f2(bs) + ' ' + f2(bs) + ' re B');
      txc(M + 4 + bs + 6, tb0, cut(r.name, Math.floor((c0W - bs - 14) / (fsT * 0.52))), false, fsT);
      txc(bnd[1] + 4, tb0, fmtD8(r.date), false, fsT);
      txc(bnd[2] + 4, tb0, r.ha ? fmtHa(r.ha) : '-', false, fsT);
      txc(bnd[3] + 4, tb0, r.lj ? ribu(r.lj) : '-', false, fsT);
      txc(bnd[4] + 4, tb0, r.lm ? ribu(r.lm) : '-', false, fsT);
      if (anyPL) txc(bnd[5] + 4, tb0, cut((r.pt ? r.pt + ' titik' : '') + (r.pt && r.m ? ', ' : '') + (r.m ? fmtM(r.m) : '') || '-', 16), false, fsT);
    });
    txc(M, M + 5, 'Dicetak ' + tgl + ' | HZ Trip ' + ver, false, 8);
    var cs = add(stream('', c.join('\n')));
    var corners = [[M, ya], [M, yb], [PW - M, yb], [PW - M, ya]], lp = [0, 0, 0, 1, 1, 1, 1, 0], gp = [];
    corners.forEach(function (q) { gp.push(latAt(q[1]).toFixed(7), lngAt(q[0]).toFixed(7)); });
    var vp = '/VP [ << /Type /Viewport /Name (Peta) /BBox [' + f2(M) + ' ' + f2(ya) + ' ' + f2(PW - M) + ' ' + f2(yb) + '] /Measure << /Type /Measure /Subtype /GEO /Bounds [0 0 0 1 1 1 1 0] /GPTS [' + gp.join(' ') + '] /LPTS [' + lp.join(' ') + '] /GCS << /Type /GEOGCS /WKT (GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]) /EPSG 4326 >> /PDU [/M /DEG /DEG] >> >> ]';
    var pg = add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + f2(PW) + ' ' + f2(PH) + '] /Resources ' + (function () { var res = res0 + ' /ExtGState << ' + Object.keys(usedGs).map(function (k) { return '/G' + k + ' ' + gsM[k] + ' 0 R'; }).join(' ') + ' >>' + (imN ? ' /XObject << /Im' + imN + ' ' + imN + ' 0 R >>' : '') + ' >>'; return res; })() + ' /Contents ' + cs + ' 0 R ' + vp + ' >>');
    return pg;
    }
    function sumPages() {
      var rows = [];
      groups.forEach(function (g) {
        var m = {}, ord = [], bn = g.blk ? asc(g.blk.name) : '-';
        g.items.forEach(function (it) {
          var k = tabKey(it), st0 = statOf(it);
          if (!m[k]) { m[k] = { blk: bn, name: tabName(it), col: colOf(it), date: dateOf(it), ord: catIdx(it), ha: 0, lm: 0, pt: 0, m: 0 }; ord.push(k); }
          var r = m[k]; if (it.t === 'pt') r.pt++; else if (it.t === 'ln') r.m += st0.m; else { r.ha += st0.ha; r.lm += st0.lm; }
        });
        ord.sort(function (a, b) { var p = m[a], q = m[b]; return (p.ord - q.ord) || (p.date < q.date ? -1 : (p.date > q.date ? 1 : 0)); });
        if (!ord.length) rows.push({ blk: bn, name: '(tanpa tanda)', col: '#FFFFFF', date: '', ha: 0, lm: 0, pt: 0, m: 0, first: true });
        ord.forEach(function (k, i) { m[k].first = i === 0; rows.push(m[k]); });
      });
      var PW = 595.28, PH = 841.89, M = 24, W = PW - 2 * M, per = 40, RH = 18, np = Math.max(1, Math.ceil(rows.length / per)), ids = [], s, pi;
      var bnd = [M, M + 90, M + 270, M + 335, M + 395, M + 475, M + W];
      function cut2(tx, n) { tx = asc(tx); return tx.length > n ? tx.slice(0, Math.max(1, n - 1)) + '.' : tx; }
      for (pi = 0; pi < np; pi++) {
        var c = [], part = rows.slice(pi * per, (pi + 1) * per), yTop = PH - M - 56, nr = part.length + 1;
        c.push('0 g BT /F2 16 Tf ' + f2(M) + ' ' + f2(PH - M - 14) + ' Td (Ringkasan marking' + (np > 1 ? ' ' + (pi + 1) + '/' + np : '') + ') Tj ET');
        var nbk = {}; groups.forEach(function (g) { if (g.blk) nbk[g.blk.id] = 1; });
        c.push('0 g BT /F1 11 Tf ' + f2(M) + ' ' + f2(PH - M - 32) + ' Td (' + Object.keys(nbk).length + ' blok) Tj ET');
        c.push('0.9 g ' + f2(M) + ' ' + f2(yTop - RH) + ' ' + f2(W) + ' ' + f2(RH) + ' re f');
        c.push('0 G 0.7 w ' + f2(M) + ' ' + f2(yTop - RH * nr) + ' ' + f2(W) + ' ' + f2(RH * nr) + ' re S');
        var j;
        for (j = 1; j < nr; j++) c.push((j > 1 && part[j - 1].first ? '1.1' : '0.4') + ' w ' + f2(M) + ' ' + f2(yTop - RH * j) + ' m ' + f2(M + W) + ' ' + f2(yTop - RH * j) + ' l S');
        for (j = 1; j < bnd.length - 1; j++) c.push('0.4 w ' + f2(bnd[j]) + ' ' + f2(yTop) + ' m ' + f2(bnd[j]) + ' ' + f2(yTop - RH * nr) + ' l S');
        function tx(x, yb, str, bold, fz) { c.push('0 g BT /' + (bold ? 'F2' : 'F1') + ' ' + fz + ' Tf ' + f2(x) + ' ' + f2(yb) + ' Td (' + pe(str) + ') Tj ET'); }
        ['Blok', 'Kategori', 'Tanggal', 'Ha', 'Panjang lajur (m)', 'Titik / garis'].forEach(function (h, i) { tx(bnd[i] + 4, yTop - RH + 6, h, true, 8); });
        part.forEach(function (r, i) {
          var rb = yTop - RH * (i + 2), tb0 = rb + 6;
          if (r.first) tx(bnd[0] + 4, tb0, cut2(r.blk, 18), true, 9);
          c.push(rgb(r.col) + ' rg 0 G 0.8 w ' + f2(bnd[1] + 4) + ' ' + f2(rb + 3) + ' 12 12 re B');
          tx(bnd[1] + 20, tb0, cut2(r.name, 34), false, 9);
          tx(bnd[2] + 4, tb0, r.date ? fmtD8(r.date) : '-', false, 9);
          tx(bnd[3] + 4, tb0, r.ha ? fmtHa(r.ha) : '-', false, 9);
          tx(bnd[4] + 4, tb0, r.lm ? ribu(r.lm) : '-', false, 9);
          tx(bnd[5] + 4, tb0, cut2((r.pt ? r.pt + ' titik' : '') + (r.pt && r.m ? ', ' : '') + (r.m ? fmtM(r.m) : '') || '-', 14), false, 9);
        });
        tx(M, M + 5, 'Dicetak ' + tgl + ' | HZ Trip ' + ver, false, 8);
        var cs0 = add(stream('', c.join('\n')));
        ids.push(add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + f2(PW) + ' ' + f2(PH) + '] /Resources ' + res0 + ' >> /Contents ' + cs0 + ' 0 R >>'));
      }
      if (o.meta) o.meta.sumPages = np;
      return ids;
    }
    var kids = (o.summary && groups.length > 1 ? sumPages() : []).concat(groups.map(function (g) { return page(g.items, g.title, g.blk, g.img, g.cat); }));
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
  function pdfPreview(bytes, onPrint, o) {
    o = o || {};
    var old = $('tdPrev'); if (old) old.remove();
    var el = document.createElement('div'); el.id = 'tdPrev';
    el.innerHTML = '<div class="tpb"><b>Preview</b><span class="muted" id="tpInfo">ketuk gambar untuk memperbesar</span></div>' +
      (o.labels ? '<div class="tpc" id="tpCh">' + o.labels.map(function (l, i) { return '<button type="button" data-p="' + i + '">' + esc(l) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="tpw"><canvas id="tpCv"></canvas><div id="tpMsg" class="muted">Menyusun preview…</div></div>' +
      (o.actions ? '<div class="tpa" id="tpAc">' + o.actions.map(function (a, i) { return '<button type="button" class="btn" data-a="' + i + '">' + esc(a.label) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="tpf"><button class="btn" id="tpBack">Kembali</button><button class="btn pri" id="tpGo">' + esc(o.go || 'Cetak PDF') + '</button></div>';
    document.body.appendChild(el);
    var doc = null, cur = 0, off = o.off || 0;
    function close() { el.remove(); }
    $('tpBack').onclick = function () { close(); if (o.onBack) o.onBack(); };
    $('tpCv').onclick = function () { var c = $('tpCv'), w0 = parseFloat(c.getAttribute('data-w') || c.style.width), z = c.getAttribute('data-z') === '1'; c.setAttribute('data-w', w0); c.style.width = (z ? w0 : w0 * 2.6) + 'px'; c.setAttribute('data-z', z ? '0' : '1'); };
    $('tpGo').onclick = function () { close(); onPrint(); };
    function show(n) {
      cur = n; if (!doc) return;
      el.querySelectorAll('#tpCh button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-p') === n); });
      el.querySelectorAll('#tpAc button').forEach(function (b) { b.disabled = n < off; });
      $('tpMsg').style.display = ''; $('tpMsg').textContent = 'Menyusun preview…';
      doc.getPage(n + 1).then(function (pg) {
        var wcss = Math.min(window.innerWidth - 16, 900), v0 = pg.getViewport({ scale: 1 }), sc = wcss / v0.width * (window.devicePixelRatio || 1) * 1.6, v = pg.getViewport({ scale: sc }), cv = $('tpCv');
        cv.width = v.width; cv.height = v.height; cv.style.width = wcss + 'px'; cv.setAttribute('data-w', wcss); cv.setAttribute('data-z', '0');
        return pg.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise;
      }).then(function () { if ($('tpMsg')) $('tpMsg').style.display = 'none'; var w = el.querySelector('.tpw'); if (w) w.scrollTop = 0; }).catch(function (e) { if ($('tpMsg')) $('tpMsg').textContent = 'Preview tidak tersedia (' + (e && e.message || e) + '). Anda tetap bisa mencetak.'; });
    }
    el.querySelectorAll('#tpCh button').forEach(function (b) { b.onclick = function () { show(+b.getAttribute('data-p')); }; });
    el.querySelectorAll('#tpAc button').forEach(function (b) { b.onclick = function () { var a = o.actions[+b.getAttribute('data-a')]; if (a && cur >= off) { close(); a.fn(cur - off); } }; });
    var u8 = new Uint8Array(bytes.length); for (var i = 0; i < bytes.length; i++) u8[i] = bytes.charCodeAt(i) & 255;
    loadPdfJs().then(function (lib) { return lib.getDocument({ data: u8 }).promise; }).then(function (d) {
      doc = d; $('tpInfo').textContent = d.numPages + ' halaman · ketuk gambar untuk memperbesar';
      show(o.labels ? Math.min(off, d.numPages - 1) : 0);
    }).catch(function (e) { $('tpMsg').textContent = 'Preview tidak tersedia (' + (e && e.message || e) + '). Anda tetap bisa mencetak.'; });
  }

  // ---------- pasang ----------
  function init() {
    if (!$('spTanda')) return;
    $('spTanda').onclick = function () { if (TD.on) modeOff(); else modeOn(); };
  }
  HA.TD = TD; HA.tandaData = data; HA.tandaStat = statOf; HA.tandaTabName = function (it) { return tabName(it); }; HA.tandaU = { dateOf: dateOf, d8: fmtD8, ha: fmtHa, ribu: ribu, m: fmtM };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
