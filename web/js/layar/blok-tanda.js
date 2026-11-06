/* HZ Trip - Marking per blok: pilih blok, lembar blok (satelit dipotong poligon + sekeliling), bagikan */
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
  var BT = HA.BT = { pick: pick, open: openBlock, close: closeBlock, inside: inside, refresh: refresh, share: share, bufPoly: bufPoly };
  var cur = null, bm = null, bmMode = 'sat', bufPts = [], bounds = null, outLay = null, myDot = null, pos = null, collator = new Intl.Collator('id', { numeric: true });
  var ST = { q: '', f: 'all', m: '', sel: null, shown: 120 };

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
    var a = 0, b = 0; it.pts.forEach(function (p) { a += p[0]; b += p[1]; }); return [a / it.pts.length, b / it.pts.length];
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

  // ---------- layar 1: pilih blok ----------
  function ensurePick() {
    if ($('blPick')) return;
    var el = document.createElement('div'); el.id = 'blPick'; el.className = 'blov'; el.style.display = 'none';
    el.innerHTML = '<div class="blTop"><button class="ib" id="bpBack" aria-label="Kembali">' + IC.back + '</button><div class="blTtl"><b>Pilih blok</b><small id="bpSub"></small></div><button class="ib txt" id="bpFree">Peta bebas</button></div>' +
      '<div class="bpTools"><input type="search" id="bpQ" placeholder="Cari nama blok" autocomplete="off"><div class="seg" id="bpF"><button data-v="all" class="on">Semua</button><button data-v="mk">Ada tanda</button></div><select id="bpM"></select></div>' +
      '<div id="bpList"></div><div id="bpSel" style="display:none"></div>';
    document.body.appendChild(el);
    $('bpBack').onclick = function () { el.style.display = 'none'; };
    $('bpFree').onclick = function () { el.style.display = 'none'; HA.tandaFree(); };
    $('bpQ').oninput = function () { ST.q = this.value.trim().toLowerCase(); ST.shown = 120; drawList(); };
    $('bpF').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-v]'); if (!b) return; ST.f = b.getAttribute('data-v'); ST.shown = 120; $('bpF').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); drawList(); };
    $('bpM').onchange = function () { ST.m = this.value; ST.shown = 120; drawList(); };
  }
  var LST = [], CNT = {};
  function pick() {
    if (HA.spShow) HA.spShow('map');
    ensurePick(); ST.sel = null;
    var el = $('blPick'); el.style.display = 'flex';
    LST = blocks(); LST._mm = null; CNT = countsAll(LST);
    LST.forEach(function (b) { var bb = bbox(b.pts); b._c = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]; b._d = pos ? dist(pos, b._c) : null; });
    var ms = (S.settings.masters || []);
    $('bpM').innerHTML = '<option value="">Semua master</option>' + ms.map(function (m) { return '<option value="' + m.id + '"' + (String(ST.m) === String(m.id) ? ' selected' : '') + '>' + esc(m.name) + '</option>'; }).join('');
    $('bpM').style.display = ms.length ? '' : 'none';
    drawList(); selBar();
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { pos = [p.coords.latitude, p.coords.longitude]; LST.forEach(function (b) { b._d = dist(pos, b._c); }); if (el.style.display !== 'none' && !ST.sel) drawList(); }, function () {}, { timeout: 7000, maximumAge: 60000, enableHighAccuracy: false });
  }
  function inMaster(b, mid) {
    LST._mm = LST._mm || {};
    if (!LST._mm[mid]) {
      var m = null; (S.settings.masters || []).forEach(function (x) { if (String(x.id) === String(mid)) m = x; });
      var ids = {}; if (m && HA.masterMembers) { var r = HA.masterMembers(m); r.in.concat(r.man).forEach(function (x) { ids[String(x.id)] = 1; }); }
      LST._mm[mid] = ids;
    }
    return !!LST._mm[mid][String(b.id)];
  }
  function drawList() {
    var rows = LST.filter(function (b) {
      if (ST.q && String(b.name).toLowerCase().indexOf(ST.q) < 0) return false;
      if (ST.f === 'mk' && !CNT[b.id]) return false;
      if (ST.m && !inMaster(b, ST.m)) return false;
      return true;
    });
    rows.sort(function (a, b) { if (a._d != null && b._d != null) return a._d - b._d; return collator.compare(String(a.name), String(b.name)); });
    $('bpSub').textContent = rows.length + ' blok terkonfirmasi' + (pos ? ' · terdekat dulu' : '');
    var show = rows.slice(0, ST.shown);
    $('bpList').innerHTML = show.length ? show.map(function (b) {
      var n = CNT[b.id] || 0, on = ST.sel && ST.sel[b.id];
      return '<button class="bprow' + (on ? ' on' : '') + '" data-id="' + esc(String(b.id)) + '">' + (ST.sel ? '<span class="bpck">' + (on ? '✓' : '') + '</span>' : '') + '<span class="bpi"><b>' + esc(String(b.name)) + '</b><small>' + fmtHa(HzBlok.areaHa(b.pts)) + ' ha · ' + (n ? n + ' tanda' : 'belum ada tanda') + (b._d != null ? ' · ' + fmtD(b._d) : '') + '</small></span>' + (ST.sel ? '' : HA.CHEV) + '</button>';
    }).join('') + (rows.length > show.length ? '<button class="bprow more" id="bpMore">Tampilkan semua (' + rows.length + ')</button>' : '') : '<div class="muted" style="padding:1.5rem;text-align:center">Tidak ada blok terkonfirmasi yang cocok.</div>';
    if ($('bpMore')) $('bpMore').onclick = function () { ST.shown = 100000; drawList(); };
    $('bpList').querySelectorAll('.bprow[data-id]').forEach(function (e) {
      var id = e.getAttribute('data-id'), t = null, long = false;
      function find() { return LST.filter(function (b) { return String(b.id) === id; })[0]; }
      e.addEventListener('pointerdown', function () { long = false; t = setTimeout(function () { long = true; if (!ST.sel) ST.sel = {}; ST.sel[id] = true; if (navigator.vibrate) try { navigator.vibrate(15); } catch (x) {} drawList(); selBar(); }, 450); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { e.addEventListener(ev, function () { clearTimeout(t); }); });
      e.onclick = function () {
        if (long) { long = false; return; }
        if (ST.sel) { if (ST.sel[id]) delete ST.sel[id]; else ST.sel[id] = true; if (!Object.keys(ST.sel).length) ST.sel = null; drawList(); selBar(); return; }
        var b = find(); if (b) openBlock(b);
      };
    });
  }
  function selBar() {
    var box = $('bpSel'); if (!box) return;
    if (!ST.sel) { box.style.display = 'none'; return; }
    var n = Object.keys(ST.sel).length;
    box.style.display = 'flex';
    box.innerHTML = '<span><b>' + n + '</b> blok dipilih</span><button class="btn pri" id="bsGo">Bagikan</button><button class="btn" id="bsX">Batal</button>';
    $('bsX').onclick = function () { ST.sel = null; drawList(); selBar(); };
    $('bsGo').onclick = function () { var l = LST.filter(function (b) { return ST.sel[b.id]; }); share(l); };
  }

  // ---------- layar 3: lembar blok ----------
  function ensureSheet() {
    if ($('blSheet')) return;
    var el = document.createElement('div'); el.id = 'blSheet'; el.className = 'blov'; el.style.display = 'none';
    el.innerHTML = '<div class="blTop"><button class="ib" id="blBack" aria-label="Kembali">' + IC.back + '</button><div class="blTtl"><b id="blNm"></b><small id="blSub"></small></div><button class="ib" id="blShare" aria-label="Bagikan">' + IC.print + '</button></div>' +
      '<div class="blMapW"><div id="blMap"></div><div id="blHud"></div><div id="blWarn" style="display:none"></div>' +
      '<div class="blFab"><button class="fab" id="blUndo" aria-label="Urung">' + IC.undo + '</button><button class="fab" id="blLay" aria-label="Satelit atau peta">' + IC.layers + '</button><button class="fab" id="blLoc" aria-label="Posisi saya">' + IC.loc + '</button></div></div>' +
      '<div id="blNav"><button class="ib" id="blPrev" aria-label="Sebelumnya">' + IC.prev + '</button><span id="blNavT"></span><button class="ib" id="blNext" aria-label="Berikutnya">' + IC.next + '</button></div><div id="blBar"></div>';
    document.body.appendChild(el);
    $('blBack').onclick = closeBlock;
    $('blShare').onclick = function () { share([cur]); };
    $('blUndo').onclick = function () { HA.tandaUndo(); };
    $('blLay').onclick = function () { bmMode = bmMode === 'sat' ? 'osm' : 'sat'; applyBase(); toast(bmMode === 'sat' ? 'Mode satelit' : 'Mode peta'); };
    $('blLoc').onclick = function () { locate(false); };
    $('blPrev').onclick = function () { step(-1); };
    $('blNext').onclick = function () { step(1); };
  }
  function applyBase() {
    if (!bm) return;
    HA.setBase(bm, bmMode);
    if (bm._base && bounds) { bm._base.options.bounds = bounds; bm._base.redraw(); }
    if (bm._base && bm._base.bringToBack) bm._base.bringToBack();
    if (bm._base) bm._base.once('load', function () { setTimeout(function () { if (cur) checkCache(); }, 500); });
    applyClip();
  }
  function applyClip() {
    if (!bm || !bufPts.length) return;
    var pane = bm.getPane('tilePane'), q = bufPts.map(function (p) { return bm.latLngToLayerPoint(p); });
    pane.style.clipPath = 'polygon(' + q.map(function (a) { return a.x.toFixed(1) + 'px ' + a.y.toFixed(1) + 'px'; }).join(',') + ')';
  }
  function openBlock(b) {
    if (TD.on && !TD.blk) { HA.tandaEdCancel(); }
    ensureSheet();
    $('blPick').style.display = 'none';
    var el = $('blSheet'); el.style.display = 'flex';
    TD.on = true; TD.tool = null; TD.blk = b; HA.tandaData();
    if (!bm) {
      bm = L.map('blMap', { zoomControl: false, attributionControl: false, preferCanvas: true, maxZoom: 22, zoomSnap: 0.5, zoomDelta: 1, inertia: true });
      bm.on('click', function (ev) { HA.tandaClick(ev); });
      bm.on('zoomend viewreset', applyClip);
      bm.getContainer().style.background = '#fff';
      outLay = L.layerGroup().addTo(bm);
    }
    TD.bm = bm; TD.barBlock = barBlock;
    bm._forceOvl = true;
    setup(b);
    setTimeout(function () { bm.invalidateSize(); setup(b, true); if (HA.syncOverlays) HA.syncOverlays(bm); }, 60);
  }
  function setup(b, soft) {
    cur = b; TD.blk = b; TD.bm = bm;
    var buf = HA.tandaBufM();
    bufPts = bufPoly(b.pts, buf);
    var bb = bbox(bufPts); bounds = L.latLngBounds([[bb[0], bb[1]], [bb[2], bb[3]]]);
    outLay.clearLayers();
    blocks().forEach(function (o) {
      if (o.id === b.id) return;
      var ob = bbox(o.pts); if (ob[2] < bb[0] || ob[0] > bb[2] || ob[3] < bb[1] || ob[1] > bb[3]) return;
      L.polygon(o.pts, { color: '#fff', weight: 1.2, opacity: 0.85, dashArray: '5 4', fill: false, interactive: false }).addTo(outLay);
    });
    L.polygon(b.pts, { color: '#FFE600', weight: 1.8, fill: false, interactive: false }).addTo(outLay);
    bm.setMaxBounds(bounds.pad(0.3));
    if (!soft) bm.fitBounds(bounds, { animate: false, padding: [6, 6] });
    applyBase();
    HA.tandaDraw();
    barBlock(); title(); navUpdate(); checkCache();
  }
  function title() {
    var n = itemsOf(cur).length;
    $('blNm').textContent = 'Blok ' + cur.name; $('blSub').textContent = n ? n + ' tanda · ' + fmtHa(HzBlok.areaHa(cur.pts)) + ' ha' : 'Belum ada tanda · ' + fmtHa(HzBlok.areaHa(cur.pts)) + ' ha';
  }
  function refresh() { if (cur && TD.blk) { title(); navUpdate(); } }
  function marked() {
    var l = blocks(), c = countsAll(l);
    return l.filter(function (b) { return c[b.id] > 0 || (cur && b.id === cur.id && false); }).sort(function (a, b) { return collator.compare(String(a.name), String(b.name)); });
  }
  function navUpdate() {
    var m = marked(), i = -1; m.forEach(function (b, k) { if (b.id === cur.id) i = k; });
    $('blNavT').textContent = m.length ? (i >= 0 ? (i + 1) + ' dari ' + m.length + ' blok bertanda' : m.length + ' blok bertanda') : 'Belum ada blok bertanda';
    $('blPrev').disabled = $('blNext').disabled = !m.length || (m.length === 1 && i === 0);
    BT._m = m; BT._i = i;
  }
  function step(d) {
    var m = BT._m || [], i = BT._i; if (!m.length) return;
    var k = i < 0 ? (d > 0 ? 0 : m.length - 1) : (i + d + m.length) % m.length;
    if (TD.wk) { toast('Hentikan walking dulu'); return; }
    HA.tandaEdCancel(); TD.tool = null; setup(m[k]);
  }
  function closeBlock() {
    if (TD.wk) { toast('Hentikan walking dulu'); return; }
    HA.tandaEdCancel(); TD.tool = null; TD.on = false; TD.blk = null; TD.bm = null; HA.tandaHud('');
    if (outLay) outLay.clearLayers();
    var w = $('blWarn'); if (w) w.style.display = 'none';
    $('blSheet').style.display = 'none';
    cur = null; pick();
  }
  function barBlock() {
    var b = HA.tandaBrush ? HA.tandaBrush() : { color: '#FF6A00', name: 'Oranye' };
    $('blBar').innerHTML = '<button class="big" id="blHere">' + IC.loc + '<span>Tandai di posisi saya</span></button>' +
      '<div class="tdr">' + tb(null, IC.pin, 'Titik', TD.tool === 'pt', 'data-t="pt"') + tb(null, IC.line, 'Garis', TD.tool === 'ln', 'data-t="ln"') + tb(null, IC.poly, 'Area', TD.tool === 'pg', 'data-t="pg"') + tb(null, IC.walk, 'Walking', false, 'data-t="wk"') + tb('blCol', '<i class="cdot" style="background:' + b.color + '"></i>', 'Warna') + tb('blLs', IC.list, 'Daftar') + '</div>';
    $('blBar').querySelectorAll('[data-t]').forEach(function (e) { e.onclick = function () { HA.tandaPick(e.getAttribute('data-t')); }; });
    $('blCol').onclick = function () { HA.tandaColor(function (v) { var d = HA.tandaData(); d.brush = { cat: null, col: v.col }; HA.tandaSave(); barBlock(); }); };
    $('blLs').onclick = function () { HA.tandaList(itemsOf(cur)); };
    $('blHere').onclick = function () { locate(true); };
    if (TD.tool === 'pt') HA.tandaHud('Ketuk di dalam blok untuk menaruh titik'); else if (!TD.tool && !TD.ed) HA.tandaHud('');
  }
  function locate(add) {
    if (!navigator.geolocation) { toast('GPS tidak tersedia'); return; }
    toast('Mencari posisi…');
    navigator.geolocation.getCurrentPosition(function (p) {
      var ll = [p.coords.latitude, p.coords.longitude];
      if (myDot) { try { myDot.remove(); } catch (e) {} }
      myDot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2F80FF', fillOpacity: 1, interactive: false }).addTo(bm);
      if (!add) { if (inside(ll) || bounds.contains(ll)) bm.panTo(ll); else toast('Posisi Anda di luar area blok'); return; }
      if (!inside(ll)) { toast('Posisi Anda di luar blok ini'); return; }
      var b = HA.tandaBrush(), it = { id: HA.tandaNewId(), t: 'pt', pts: [ll], cat: null, col: b.col, name: '', note: '', ts: Date.now() };
      HA.tandaAdd(it); HA.tandaDraw(); refresh(); toast('Titik ditandai (±' + Math.round(p.coords.accuracy || 0) + ' m)');
    }, function (e) { toast(e && e.code === 1 ? 'Izin lokasi ditolak' : 'Posisi belum ditemukan'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 });
  }

  // ---------- notifikasi citra satelit ----------
  function tileList() {
    var z = S.settings.satNative || 17, out = [], x0, x1, y0, y1;
    var a = bm.project(bounds.getNorthWest(), z), c = bm.project(bounds.getSouthEast(), z);
    x0 = Math.floor(a.x / 256); x1 = Math.floor(c.x / 256); y0 = Math.floor(a.y / 256); y1 = Math.floor(c.y / 256);
    for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) out.push(L.Util.template(HA.TILES.sat[0], { x: x, y: y, z: z, s: 'a', r: '' }));
    return out;
  }
  function checkCache() {
    var w = $('blWarn'); w.style.display = 'none';
    var urls = tileList(), id = cur.id;
    if (urls.length > 120) return;
    Promise.all(urls.map(function (u) { return HA.TC.get(u).then(function (b) { return b ? null : u; }).catch(function () { return null; }); })).then(function (r) {
      if (!cur || cur.id !== id) return;
      var miss = r.filter(Boolean); BT._miss = miss;
      if (!miss.length) return;
      w.style.display = 'flex';
      w.innerHTML = '<span>Citra satelit blok ini belum tersimpan (' + miss.length + ' dari ' + urls.length + ' kotak). Tanpa internet gambar bisa kosong atau buram.</span><button class="btn sm pri" id="blDl">' + IC.down + '<span>Unduh ≈ ' + Math.max(0.1, miss.length * 0.03).toFixed(1).replace('.', ',') + ' MB</span></button>';
      $('blDl').onclick = function () { download(miss); };
    });
  }
  function download(miss) {
    var w = $('blWarn'), i = 0, done = 0, fail = 0, run = 0;
    w.innerHTML = '<span id="blDp">Mengunduh 0/' + miss.length + '…</span>';
    function nx() {
      if (i >= miss.length) { if (run === 0) fin(); return; }
      var u = miss[i++]; run++;
      fetch(u, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('x'); return r.blob(); }).then(function (b) { HA.TC.put(u, b); done++; }).catch(function () { fail++; }).then(function () { run--; if ($('blDp')) $('blDp').textContent = 'Mengunduh ' + (done + fail) + '/' + miss.length + '…'; nx(); });
    }
    function fin() {
      toast(fail ? 'Selesai, ' + fail + ' kotak gagal (cek internet)' : 'Citra satelit tersimpan');
      if (bm && bm._base) bm._base.redraw();
      checkCache();
    }
    for (var k = 0; k < 4; k++) nx();
  }
  BT.cacheMissing = function () { return (BT._miss || []).length; };

  // ---------- bagikan: PDF atau KML untuk satu atau beberapa blok ----------
  var SH = { fmt: 'pdf', title: '', nama: true, nilai: true, fs: 'a' };
  function stamp() { var t = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()); }
  function share(list) {
    var many = list.length > 1, n = 0; list.forEach(function (b) { n += itemsOf(b).length; });
    var def = many ? 'Marking ' + list.length + ' blok' : 'Blok ' + list[0].name;
    openSheet('<div class="grab"></div><div class="st">BAGIKAN ' + (many ? list.length + ' BLOK' : 'BLOK ' + esc(String(list[0].name)).toUpperCase()) + '</div>' +
      '<div class="muted" style="margin-bottom:8px">' + n + ' tanda' + (n ? '' : ' · blok akan dicetak tanpa tanda') + '</div>' +
      '<div class="h">FORMAT (PILIH SATU)</div><div class="seg" id="shF"><button data-v="pdf"' + (SH.fmt === 'pdf' ? ' class="on"' : '') + '>PDF</button><button data-v="kml"' + (SH.fmt === 'kml' ? ' class="on"' : '') + '>KML</button></div>' +
      '<div class="h" style="margin-top:10px">JUDUL</div><input type="text" id="shT" maxlength="60" placeholder="' + esc(def) + '" value="' + esc(SH.title) + '" style="width:100%">' +
      '<div id="shP"><div class="h" style="margin-top:10px">SEKELILING BLOK DI PDF</div><div class="seg" id="shB">' + [10, 15, 20].map(function (v) { return '<button data-v="' + v + '"' + (HA.tandaBufM() === v ? ' class="on"' : '') + '>' + v + ' m</button>'; }).join('') + '</div>' +
      '<div class="plist" style="margin-top:8px"><label><input type="checkbox" id="shN"' + (SH.nama ? ' checked' : '') + '> Nama tanda</label><label><input type="checkbox" id="shV"' + (SH.nilai ? ' checked' : '') + '> Nilai (ha atau meter)</label></div>' +
      '<div class="h" style="margin-top:10px">UKURAN TEKS</div><div class="seg" id="shS">' + [['a', 'Otomatis'], ['s', 'Kecil'], ['m', 'Sedang'], ['l', 'Besar']].map(function (o) { return '<button data-v="' + o[0] + '"' + (SH.fs === o[0] ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="muted" id="shK" style="margin-top:10px;display:none">KML berisi batas blok dan tanda persis di dalam blok, tanpa tambahan sekeliling.</div>' +
      '<button class="btn" id="shPv" style="width:100%;margin-top:12px">Preview</button><button class="btn pri" id="shGo" style="width:100%;margin-top:8px;height:52px">Bagikan</button><button class="btn" id="shX" style="width:100%;margin-top:8px">Tutup</button>');
    function sync() { $('shP').style.display = SH.fmt === 'pdf' ? '' : 'none'; $('shK').style.display = SH.fmt === 'kml' ? '' : 'none'; $('shPv').style.display = SH.fmt === 'pdf' ? '' : 'none'; }
    function seg(id, f) { $(id).onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-v]'); if (!b) return; f(b.getAttribute('data-v')); $(id).querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); }; }
    seg('shF', function (v) { SH.fmt = v; sync(); });
    seg('shB', function (v) { S.settings.tdBuf = +v; HA.saveSettings(); });
    seg('shS', function (v) { SH.fs = v; });
    sync();
    function grab() { SH.title = $('shT').value.trim(); SH.nama = $('shN').checked; SH.nilai = $('shV').checked; }
    function pdfBytes() {
      grab();
      var groups = list.map(function (b) { return { title: SH.title ? (many ? SH.title + ' - ' + b.name : SH.title) : 'Blok ' + b.name, items: itemsOf(b), blk: b }; });
      return HA.tandaBuildPdf([], { nama: SH.nama, nilai: SH.nilai, blk: true, fs: SH.fs, pos: 'c', buf: HA.tandaBufM(), groups: groups });
    }
    function kmlText() {
      grab();
      var groups = list.map(function (b) { var its = itemsOf(b).slice(); its.unshift({ id: 'blk' + b.id, t: 'pg', pts: b.pts, name: 'Blok ' + b.name, boundary: true, col: '#FFE600' }); return { name: 'Blok ' + b.name, items: its }; });
      var all = []; groups.forEach(function (g) { g.items.forEach(function (i) { all.push(i); }); });
      return HA.tandaKml(all, SH.title || def, groups);
    }
    var fname = function (ext) { return (many ? 'Marking_' + list.length + 'blok' : 'Blok_' + String(list[0].name).replace(/[^A-Za-z0-9]+/g, '_')) + '_' + stamp() + '.' + ext; };
    $('shX').onclick = closeSheet;
    $('shPv').onclick = function () { var b = pdfBytes(); HA.pdfPreview(b, function () { HA.saveFile(fname('pdf'), btoa(b), 'application/pdf'); }); };
    $('shGo').onclick = function () {
      if (SH.fmt === 'pdf') { var b = pdfBytes(); HA.saveFile(fname('pdf'), btoa(b), 'application/pdf'); }
      else HA.saveFile(fname('kml'), HA.textB64(kmlText()), 'application/vnd.google-earth.kml+xml');
    };
  }
})();
