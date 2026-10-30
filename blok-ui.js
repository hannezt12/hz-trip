/* HZ Trip - blok kebun dan impor blok */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function renderData() { return HA.renderData.apply(this, arguments); }
  function nf() { return HA.nf.apply(this, arguments); }
  function ovList() { return HA.ovList.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.blocksList = blocksList;
  HA.renderBlkInfo = renderBlkInfo;
  HA.blkStatus = blkStatus;
  HA.blkLabel = blkLabel;
  HA.nextBlockNo = nextBlockNo;
  HA.bbHit = bbHit;
  HA.blockAt = blockAt;
  HA.drawBlocks = drawBlocks;
  HA.drawRows = drawRows;
  HA.closeBlockPop = closeBlockPop;
  HA.openBlockPop = openBlockPop;
  HA.openBlockEdit = openBlockEdit;
  HA.renderBlokTab = renderBlokTab;

  // ---------- blok kebun ----------
  HA.BLK_COL = { none: '#9AA5AD', set: '#7FD8FF', conf: '#B79CFF' };
  HA.RC = { guide: {}, rows: {}, dep: {} };
  function blocksList() { return S.settings.blocks || (S.settings.blocks = []); }
  function isScanBlk(b) { return b.src === 'scan' || (!b.src && /^Blok \d+$/.test(b.name || '') && !b.luasCat); }
  function delScanBlocks() {
    var n = blocksList().filter(isScanBlk).length;
    S.settings.blocks = blocksList().filter(function (b) { return !isScanBlk(b); });
    HA.RC.rows = {}; HA.RC.dep = {}; HA.RC.guide = {}; saveSettings(); closeBlockPop(); drawBlocks(); drawRows(); return n;
  }
  function renderBlkInfo() { var e = $('blkInfo'); if (e) e.textContent = blocksList().length ? blocksList().length + ' blok tersimpan.' : 'Belum ada blok.'; }
  function blkStatus(b) { return b.dir == null ? 'none' : (b.conf ? 'conf' : 'set'); }
  function blkStatusText(b) { return { none: 'arah belum diatur', set: 'arah diatur', conf: 'terkonfirmasi' }[blkStatus(b)]; }
  function blkSp(b) { return +(b.sp || S.settings.rowSp || 1.5); }
  function blkHa(b) { return HzBlok.areaHa(b.pts); }
  function blkLabel(b) { return b.name + ' · ' + nf(blkHa(b), 1) + ' ha'; }
  function nextBlockNo() { var mx = 0; blocksList().forEach(function (b) { var m = /(\d+)\s*$/.exec(b.name || ''); if (m) mx = Math.max(mx, +m[1]); }); return mx + 1; }
  function bSig(b) { return b.pts.reduce(function (s, p) { return s + p[0] * 1.3 + p[1] * 0.7; }, 0).toFixed(6) + '|' + b.pts.length; }
  function llPip(ll, pts) {
    var ins = false, i, j;
    for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if ((pts[i][0] > ll.lat) !== (pts[j][0] > ll.lat) && ll.lng < (pts[j][1] - pts[i][1]) * (ll.lat - pts[i][0]) / (pts[j][0] - pts[i][0]) + pts[i][1]) ins = !ins;
    }
    return ins;
  }
  function bbOf(b) {
    if (b._bb) return b._bb;
    var s = 90, w = 180, n = -90, e = -180; b.pts.forEach(function (p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; });
    try { Object.defineProperty(b, '_bb', { value: [s, w, n, e], enumerable: false, writable: true, configurable: true }); } catch (x) {}
    return [s, w, n, e];
  }
  function bbHit(b, bd) { var q = bbOf(b); return !(q[2] < bd.getSouth() || q[0] > bd.getNorth() || q[3] < bd.getWest() || q[1] > bd.getEast()); }
  function blockAt(ll) {
    var best = null, ba = Infinity;
    blocksList().forEach(function (b) { var q = bbOf(b); if (ll.lat < q[0] || ll.lat > q[2] || ll.lng < q[1] || ll.lng > q[3]) return; if (llPip(ll, b.pts)) { var ar = blkHa(b); if (ar < ba) { ba = ar; best = b; } } });
    return best;
  }
  function drawBlocks() {
    if (!HA.map) return;
    if (HA.DM.blkLayer) { HA.map.removeLayer(HA.DM.blkLayer); HA.DM.blkLayer = null; }
    var all = blocksList();
    if (S.settings.blkOn === false || !all.length) return;
    var z = HA.map.getZoom(); if (z < 15) return;
    // pengaman: kalau penggambaran sebelumnya tidak selesai (macet lalu aplikasi ditutup paksa), blok dimatikan
    if (all.length > 150) {
      var bad = null; try { bad = localStorage.getItem('hz_bd'); } catch (e) {}
      if (bad === '1') { try { localStorage.removeItem('hz_bd'); } catch (e) {} S.settings.blkOn = false; saveSettings(); toast('Blok dimatikan karena aplikasi sempat macet. Nyalakan lagi lewat Alat peta > Blok.'); return; }
      try { localStorage.setItem('hz_bd', '1'); } catch (e) {}
      setTimeout(function () { try { localStorage.removeItem('hz_bd'); } catch (e) {} }, 60);
    }
    var bd = HA.map.getBounds(), vis = all.filter(function (b) { return bbHit(b, bd); }), g = L.layerGroup(), cc = HA.map.getCenter();
    if (vis.length > 120) { vis.sort(function (p, q) { var a1 = bbOf(p), b1 = bbOf(q); return Math.hypot((a1[0] + a1[2]) / 2 - cc.lat, (a1[1] + a1[3]) / 2 - cc.lng) - Math.hypot((b1[0] + b1[2]) / 2 - cc.lat, (b1[1] + b1[3]) / 2 - cc.lng); }); vis = vis.slice(0, 120); }
    var lab = z >= 16 ? vis.slice(0, 40) : [];
    vis.forEach(function (b) {
      var st = blkStatus(b), l = L.polygon(b.pts, { color: HA.BLK_COL[st], weight: 1.3, dashArray: st === 'none' ? '4 4' : null, fillOpacity: 0.05, interactive: false });
      if (lab.indexOf(b) >= 0) l.bindTooltip(esc(blkLabel(b)), { permanent: true, direction: 'center', className: 'lktip' });
      l.addTo(g);
    });
    g.addTo(HA.map); HA.DM.blkLayer = g;
  }
  // hitung row satu blok (di-cache). mode: 'datar' | 'kontur'
  function computeRows(b, mode) {
    var sp = blkSp(b), mg = +b.margin || 0, key;
    if (mode === 'datar') {
      if (b.dir == null) return Promise.resolve(null);
      key = ['d', bSig(b), b.dir, sp, mg].join('|');
      if (!HA.RC.rows[key]) HA.RC.rows[key] = HzBlok.rowsStraight(b.pts, b.dir, sp, mg);
      return Promise.resolve(HA.RC.rows[key]);
    }
    var gk = bSig(b), gp = b.guide ? Promise.resolve({ guide: b.guide }) : (HA.RC.guide[gk] || (HA.RC.guide[gk] = HzBlok.guideFromDem(b.pts)));
    key = ['k', gk, b.guide ? JSON.stringify(b.guide).length : 'a', sp, mg].join('|');
    if (HA.RC.rows[key]) return Promise.resolve(HA.RC.rows[key]);
    return gp.then(function (g) { var r = HzBlok.rowsContour(b.pts, g.guide, sp, mg); r.guide = g.guide; HA.RC.rows[key] = r; return r; }).catch(function (e) { delete HA.RC.guide[gk]; throw e; });
  }
  function computeDep(b) {
    var thr = +S.settings.depThr || 0.3, key = bSig(b) + '|' + thr;
    return HA.RC.dep[key] || (HA.RC.dep[key] = HzBlok.depressions(b.pts, thr).catch(function (e) { delete HA.RC.dep[key]; throw e; }));
  }
  function thinStep(sp) {
    var mpp = 156543.03 * Math.cos(HA.map.getCenter().lat * Math.PI / 180) / Math.pow(2, HA.map.getZoom());
    return Math.max(1, Math.ceil(4 / (sp / mpp)));
  }
  function drawRowsInto(g, b, mode, res, dep) {
    if (res && res.lines.length) {
      var k = thinStep(blkSp(b)), ls = k > 1 ? res.lines.filter(function (_, i) { return i % k === 0; }) : res.lines;
      L.polyline(ls, { color: '#FFFFFF', weight: 0.8, opacity: 0.9, interactive: false, smoothFactor: 0.5 }).addTo(g);
    }
    if (dep && mode === 'kontur') dep.list.forEach(function (d) {
      L.polygon(d.poly, { color: '#5EE0FF', weight: 1, fillColor: '#5EE0FF', fillOpacity: 0.38, interactive: false }).bindTooltip('cekung ' + nf(d.depth, 1) + ' m', { permanent: HA.map.getZoom() >= 17, direction: 'center', className: 'lktip' }).addTo(g);
    });
  }
  // lapisan Arah row untuk semua blok yang tampak
  function drawRows(hint) {
    if (!HA.map) return;
    if (HA.DM.rowLayer) { HA.map.removeLayer(HA.DM.rowLayer); HA.DM.rowLayer = null; }
    HA.DM.rowSeq = (HA.DM.rowSeq || 0) + 1;
    if (!S.settings.rowOn || S.settings.blkOn === false || !blocksList().length) return;
    if (HA.map.getZoom() < 16) { if (hint) toast('Dekatkan peta (zoom 16 ke atas) untuk melihat row'); return; }
    var mode = S.settings.rowMode || 'datar', id = HA.DM.rowSeq, bd = HA.map.getBounds(), g = L.layerGroup().addTo(HA.map), vis;
    HA.DM.rowLayer = g;
    vis = blocksList().filter(function (b) { return bbHit(b, bd) && (mode === 'kontur' || b.dir != null); }).slice(0, mode === 'kontur' ? 4 : 30);
    if (mode === 'kontur' && vis.length) toast('Menghitung row kontur…');
    var i = 0;
    (function nx() {
      if (id !== HA.DM.rowSeq || i >= vis.length) return;
      var b = vis[i++];
      Promise.all([computeRows(b, mode), mode === 'kontur' ? computeDep(b).catch(function () { return null; }) : Promise.resolve(null)]).then(function (r) {
        if (id !== HA.DM.rowSeq) return; drawRowsInto(g, b, mode, r[0], r[1]);
      }).catch(function (e) { if (id === HA.DM.rowSeq) toast(b.name + ': ' + (e && e.message || e)); }).then(nx);
    })();
  }
  function closeBlockPop() {
    if (HA.DM.pop) { HA.DM.pop.remove(); HA.DM.pop = null; }
    if (HA.DM.popLayer && HA.map) { HA.map.removeLayer(HA.DM.popLayer); HA.DM.popLayer = null; }
    HA.DM.popId = null; HA.DM.popSeq = (HA.DM.popSeq || 0) + 1;
  }
  function downText(ang) { return ang < 30 ? 'searah lereng, rawan erosi' : ang < 60 ? 'miring terhadap lereng' : 'memotong lereng'; }
  function openBlockPop(b) {
    if (!HA.map) return;
    closeBlockPop(); HA.DM.popId = b.id;
    var mode = S.settings.rowMode || 'datar', id = HA.DM.popSeq, el = document.createElement('div');
    el.className = 'blkpop'; HA.map.getContainer().appendChild(el); HA.DM.pop = el; L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el);
    var PEN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19z"/></svg>';
    el.innerHTML = '<div class="bh"><b>' + esc(b.name) + '</b><button type="button" class="ib2" id="bpE" aria-label="Edit blok">' + PEN + '</button><button type="button" class="ib2" id="bpX" aria-label="Tutup">✕</button></div>' +
      '<div class="bl">' + nf(blkHa(b), 2) + ' ha' + (b.luasCat ? ' (tercatat ' + nf(+b.luasCat, 2) + ')' : '') + ' · ' + (b.dir == null ? 'arah row belum diatur' : 'arah ' + Math.round(b.dir) + '° · jarak ' + nf(blkSp(b), 2) + ' m') + ' · <small>' + blkStatusText(b) + '</small></div>' +
      '<div class="bl" id="bpR">Menghitung…</div><div class="bl" id="bpA"></div><div class="bl" id="bpD"></div>' + (b.note ? '<div class="bl"><small>' + esc(b.note) + '</small></div>' : '') +
      '<div class="tseg" id="bpM"><button type="button" data-m="datar">Datar</button><button type="button" data-m="kontur">Kontur</button></div>' +
      (mode === 'kontur' ? '<div class="tseg"><button type="button" id="bpG">Edit garis pedoman</button>' + (b.guide ? '<button type="button" id="bpG0">Atur ulang pedoman</button>' : '') + '</div>' : '');
    el.querySelectorAll('#bpM button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-m') === mode); });
    $('bpX').onclick = closeBlockPop;
    $('bpE').onclick = function () { openBlockEdit(b); };
    $('bpM').onclick = function (e) { var m = e.target.getAttribute && e.target.getAttribute('data-m'); if (!m) return; S.settings.rowMode = m; saveSettings(); drawRows(); if (HA.DM.sync) HA.DM.sync(); openBlockPop(b); };
    if ($('bpG')) $('bpG').onclick = function () { editGuide(b); };
    if ($('bpG0')) $('bpG0').onclick = function () { delete b.guide; saveSettings(); openBlockPop(b); };
    var lay = L.layerGroup().addTo(HA.map); HA.DM.popLayer = lay;
    var depP = computeDep(b).catch(function () { return null; });
    computeRows(b, mode).then(function (r) {
      if (id !== HA.DM.popSeq || !$('bpR')) return;
      if (!r) $('bpR').innerHTML = 'Ketuk ikon pensil untuk mengatur arah row.';
      else $('bpR').innerHTML = '<b>≈ ' + r.n.toLocaleString('id-ID') + ' row</b>' + (mode === 'kontur' ? ' mengikuti kontur' : '') + ' · rata-rata ' + Math.round(r.avg) + ' m · total ' + nf(r.total / 1000, 2) + ' km' + (mode === 'kontur' ? '<br><small>perkiraan dari garis pedoman dan jarak row</small>' : '');
      depP.then(function (d) { if (id === HA.DM.popSeq) drawRowsInto(lay, b, mode, r, d); });
    }).catch(function (e) { if (id === HA.DM.popSeq && $('bpR')) $('bpR').textContent = String(e && e.message || e); });
    if (b.dir != null && window.HzDem) {
      var c0 = HzBlok.proj(b.pts[0][0], b.pts[0][1]), cx = 0, cy = 0; b.pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= b.pts.length; cy /= b.pts.length; void c0;
      HzDem.info(cx, cy).then(function (r) { if (id !== HA.DM.popSeq || !r || !$('bpA')) return; if (r.pct < 1) { $('bpA').textContent = 'Lereng di tengah blok hampir datar (' + nf(r.pct, 1) + '%)'; return; } var an = HzBlok.angleToSlope(b.dir, r.down); $('bpA').innerHTML = 'Lereng ' + nf(r.pct, 1) + '% · row ' + Math.round(an) + '° terhadap arah turun (' + downText(an) + ')'; }).catch(function () {});
    }
    depP.then(function (d) {
      if (id !== HA.DM.popSeq || !$('bpD')) return;
      if (!d) { $('bpD').innerHTML = '<small>Cekungan: data ketinggian belum tersedia</small>'; return; }
      if (!d.list.length) { $('bpD').innerHTML = 'Cekungan: tidak terdeteksi <small>(≥ ' + nf(+S.settings.depThr || 0.3, 1) + ' m)</small>'; return; }
      var tot = 0; d.list.forEach(function (x) { tot += x.area; });
      $('bpD').innerHTML = '<b>Cekungan: ' + d.list.length + '</b> · terdalam ' + nf(d.list[0].depth, 1) + ' m · total ' + Math.round(tot).toLocaleString('id-ID') + ' m²<br><small>potensi genangan (water lock), cek di lapangan · data ±' + Math.round(d.res) + ' m</small>';
    });
  }
  // penyunting titik poligon / garis
  HA.NEON = '#00D4FF';
  function editPoly(pts, closed, done) {
    var work = pts.map(function (p) { return p.slice(); }), mode = 'geser', g = L.layerGroup().addTo(HA.map), bar = document.createElement('div'), under = null, shape = null, min = closed ? 3 : 2;
    HA.DM.edit = true; bar.className = 'lkbar bot';
    bar.innerHTML = '<span id="epT"></span><div class="tseg" style="flex:1 1 100%;margin:0"><button type="button" data-m="geser">Geser</button><button type="button" data-m="tambah">+ Titik</button><button type="button" data-m="hapus">− Titik</button></div><button type="button" id="epOk" class="pri">Simpan</button><button type="button" id="epNo">Batal</button>';
    HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar);
    var hint = { geser: 'Seret titik untuk menggeser posisinya', tambah: 'Ketuk dekat sisi untuk menambah titik', hapus: 'Ketuk sebuah titik untuk menghapusnya' };
    function info() { $('epT').textContent = work.length + ' titik · ' + hint[mode]; bar.querySelectorAll('.tseg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-m') === mode); }); }
    function ico() { return L.divIcon({ className: '', html: '<div class="vx"></div>', iconSize: [26, 26] }); }
    function rebuild() {
      g.clearLayers();
      var o1 = { color: '#06202B', weight: 6, opacity: 0.55, interactive: false, fill: false }, o2 = { color: HA.NEON, weight: 2.6, fillColor: HA.NEON, fillOpacity: closed ? 0.08 : 0, interactive: false };
      under = (closed ? L.polygon(work, o1) : L.polyline(work, o1)).addTo(g);
      shape = (closed ? L.polygon(work, o2) : L.polyline(work, o2)).addTo(g);
      work.forEach(function (p, i) {
        var mk = L.marker(p, { draggable: mode === 'geser', icon: ico(), zIndexOffset: 500 }).addTo(g);
        mk.on('drag', function (e) { var ll = e.target.getLatLng(); work[i] = [ll.lat, ll.lng]; shape.setLatLngs(work); under.setLatLngs(work); });
        mk.on('click', function (e) {
          L.DomEvent.stop(e);
          if (mode !== 'hapus') return;
          if (work.length <= min) { toast('Minimal ' + min + ' titik, tidak bisa dihapus lagi'); return; }
          work.splice(i, 1); rebuild();
        });
      });
      info();
    }
    function segDist(pp, a, b) {
      var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((pp.x - a.x) * dx + (pp.y - a.y) * dy) / l2)) : 0;
      return Math.hypot(pp.x - (a.x + t * dx), pp.y - (a.y + t * dy));
    }
    function onClick(e) {
      if (mode !== 'tambah') return;
      var cp = HA.map.latLngToContainerPoint(e.latlng), best = -1, bd = Infinity, n = work.length, ne = closed ? n : n - 1, k;
      for (k = 0; k < ne; k++) { var d = segDist(cp, HA.map.latLngToContainerPoint(work[k]), HA.map.latLngToContainerPoint(work[(k + 1) % n])); if (d < bd) { bd = d; best = k; } }
      if (best < 0) return;
      work.splice(best + 1, 0, [e.latlng.lat, e.latlng.lng]); rebuild();
    }
    HA.map.on('click', onClick);
    bar.querySelector('.tseg').onclick = function (e) { var m = e.target.getAttribute && e.target.getAttribute('data-m'); if (m) { mode = m; rebuild(); } };
    function end(res) { HA.map.off('click', onClick); g.remove(); bar.remove(); HA.DM.edit = false; done(res); }
    $('epOk').onclick = function () { end(work.map(function (p) { return [+p[0].toFixed(6), +p[1].toFixed(6)]; })); };
    $('epNo').onclick = function () { end(null); };
    rebuild();
  }
  function needMap(pts, fn) {
    if (S.view === 'lintasan' && HA.map) { fn(); return; }
    HA.mapKeep = true; go('lintasan');
    setTimeout(function () { if (HA.map && pts) HA.map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 19 }); fn(); }, 900);
  }
  function editGuide(b) {
    var g0 = b.guide;
    function go2(gd) {
      var P = HzBlok.proj(gd[0][0], gd[0][1]), xy = gd.map(P.xy), simp = HzBlok._t.dpRing ? null : null; void simp;
      // sederhanakan agar mudah diedit (±30 titik)
      var tol = 1, cur = gd;
      while (cur.length > 35 && tol < 60) { cur = (function (t) { var o = [], keep = new Array(gd.length).fill(false); keep[0] = keep[gd.length - 1] = true; (function rec(i0, i1) { var best = -1, bi = -1, a = xy[i0], c = xy[i1], dx = c[0] - a[0], dy = c[1] - a[1], l2 = dx * dx + dy * dy, i; for (i = i0 + 1; i < i1; i++) { var tt = l2 ? Math.max(0, Math.min(1, ((xy[i][0] - a[0]) * dx + (xy[i][1] - a[1]) * dy) / l2)) : 0, d = Math.hypot(xy[i][0] - a[0] - tt * dx, xy[i][1] - a[1] - tt * dy); if (d > best) { best = d; bi = i; } } if (best > t) { keep[bi] = true; rec(i0, bi); rec(bi, i1); } })(0, gd.length - 1); gd.forEach(function (p, i) { if (keep[i]) o.push(p); }); return o; })(tol); tol *= 1.6; }
      closeBlockPop();
      editPoly(cur, false, function (res) { if (res) { b.guide = res; saveSettings(); } openBlockPop(b); drawRows(); });
    }
    if (g0) { go2(g0); return; }
    computeRows(b, 'kontur').then(function (r) { if (r && r.guide) go2(r.guide); }).catch(function (e) { toast(String(e && e.message || e)); });
  }
  function openBlockEdit(b) {
    var sg = HzBlok.suggestDir(b.pts);
    openSheet('<div class="grab"></div><div class="st">EDIT BLOK</div>' +
      '<input type="text" id="beN" maxlength="40" value="' + esc(b.name) + '" style="margin-top:6px">' +
      '<div class="muted" style="margin-top:8px">Arah row (° dari utara, 0–179)</div>' +
      '<div class="row" style="gap:6px"><button class="btn" data-d="-5" style="width:48px">−5</button><button class="btn" data-d="-1" style="width:48px">−1</button><input type="number" id="beD" min="0" max="359" step="1" value="' + (b.dir == null ? '' : Math.round(b.dir * 10) / 10) + '" placeholder="belum" style="text-align:center"><button class="btn" data-d="1" style="width:48px">+1</button><button class="btn" data-d="5" style="width:48px">+5</button></div>' +
      '<div class="row" style="margin-top:6px;gap:6px"><button class="btn" id="beS" style="flex:1">Pakai saran ' + sg + '°</button><button class="btn" id="beP" style="flex:1">Ketuk 2 titik</button></div>' +
      '<div class="row" style="margin-top:10px;gap:8px"><div style="flex:1"><div class="muted">Jarak row (m)</div><input type="number" id="beJ" step="0.05" min="0.5" max="5" value="' + blkSp(b) + '"></div><div style="flex:1"><div class="muted">Kurangi tepi (m)</div><input type="number" id="beM" step="0.5" min="0" max="50" value="' + (b.margin || 0) + '"></div></div>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="beC"' + (b.conf ? ' checked' : '') + '> Arah sudah dicek (terkonfirmasi)</label>' +
      '<textarea id="beT" rows="2" maxlength="200" placeholder="Catatan (varietas, R&D, dll.)" style="margin-top:8px;width:100%">' + esc(b.note || '') + '</textarea>' +
      '<div class="row" style="margin-top:10px;gap:6px"><button class="btn" id="beB" style="flex:1">Edit batas</button><button class="btn" id="beD2" style="flex:1;color:var(--r)">Hapus</button></div>' +
      '<button class="btn pri" id="beX" style="width:100%;margin-top:8px">Selesai</button>');
    function live() { saveSettings(); drawBlocks(); if (HA.DM.pop && HA.DM.popId === b.id) openBlockPop(b); if (S.settings.rowOn) drawRows(); }
    function setDir(v) { b.dir = v == null ? null : ((v % 180) + 180) % 180; if (b.dir == null) b.conf = false; $('beD').value = b.dir == null ? '' : Math.round(b.dir * 10) / 10; if (b.dir == null) $('beC').checked = false; live(); }
    $('beN').onchange = function () { b.name = $('beN').value.trim() || b.name; live(); };
    $('beD').onchange = function () { var v = $('beD').value; setDir(v === '' ? null : +v); };
    $('sheet').querySelectorAll('button[data-d]').forEach(function (x) { x.onclick = function () { setDir((b.dir == null ? sg : b.dir) + (+x.getAttribute('data-d'))); }; });
    $('beS').onclick = function () { setDir(sg); };
    $('beJ').onchange = function () { var v = +$('beJ').value; b.sp = v >= 0.5 && v <= 5 ? Math.round(v * 100) / 100 : null; live(); };
    $('beM').onchange = function () { b.margin = Math.max(0, +$('beM').value || 0); live(); };
    $('beC').onchange = function () { if ($('beC').checked && b.dir == null) { $('beC').checked = false; toast('Atur arah row dulu'); return; } b.conf = $('beC').checked; live(); };
    $('beT').onchange = function () { b.note = $('beT').value.trim(); live(); };
    $('beP').onclick = function () {
      closeSheet();
      needMap(b.pts, function () {
        var p1 = null, bar = document.createElement('div'); bar.className = 'lkbar'; bar.innerHTML = '<span id="lkT">Ketuk titik awal di satu lajur</span><button type="button" id="lkC">Batal</button>'; HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar);
        function end() { HA.map._lakeDraw = null; bar.remove(); }
        HA.map._lakeDraw = { tap: function (ll) { if (!p1) { p1 = [ll.lat, ll.lng]; $('lkT').textContent = 'Ketuk titik kedua di lajur yang sama (jauh dari titik pertama)'; return; } var d = HzBlok.bearing(p1, [ll.lat, ll.lng]); end(); b.dir = Math.round((d % 180) * 10) / 10; saveSettings(); drawBlocks(); openBlockPop(b); openBlockEdit(b); } };
        $('lkC').onclick = function () { end(); openBlockEdit(b); };
      });
    };
    $('beB').onclick = function () { closeSheet(); needMap(b.pts, function () { closeBlockPop(); editPoly(b.pts, true, function (res) { if (res) { b.pts = res; delete b._bb; saveSettings(); } drawBlocks(); drawRows(); openBlockPop(b); openBlockEdit(b); }); }); };
    $('beD2').onclick = function () { askConfirm('Hapus "' + b.name + '"?', 'Blok dihapus dari peta. Peta PDF tidak terpengaruh.', 'Hapus', function () { var i = blocksList().indexOf(b); if (i >= 0) blocksList().splice(i, 1); saveSettings(); closeBlockPop(); closeSheet(); drawBlocks(); drawRows(); if (S.view === 'data') renderData(); }); };
    $('beX').onclick = function () { closeSheet(); if (S.view === 'data') renderData(); };
    if (S.view === 'lintasan' && HA.map && !HA.DM.pop) openBlockPop(b);
  }
  // ---------- deteksi blok dari peta PDF ----------
  function detCfg() { return S.settings.dt || (S.settings.dt = { thr: 190, close: 1, minHa: 1 }); }
  function renderBlokTab(box) {
    var bl = blocksList(), cfg = detCfg(), ovs = ovList().map(function (o, i) { return { o: o, i: i }; }).filter(function (x) { return x.o.cal; });
    var conf = bl.filter(function (b) { return b.conf; }).length, set = bl.filter(function (b) { return b.dir != null; }).length;
    var PG = 30, q = (S.blkQ || '').toLowerCase(), fl = q ? bl.filter(function (b) { return (b.name || '').toLowerCase().indexOf(q) >= 0; }) : bl, pages = Math.max(1, Math.ceil(fl.length / PG)), pg = Math.min(Math.max(0, S.blkPg || 0), pages - 1);
    S.blkPg = pg;
    var listHtml = '<div class="row" style="gap:6px"><input type="text" id="bkQ" placeholder="Cari no blok (mis. 12 BS)" value="' + esc(S.blkQ || '') + '"><button class="btn sm" id="bkQb">Cari</button></div>' +
      (fl.length ? fl.slice(pg * PG, pg * PG + PG).map(function (b) { var i = bl.indexOf(b); return '<div class="card"><div class="dprow" style="margin-top:0"><div class="nm"><b>' + esc(b.name) + '</b><small>' + nf(blkHa(b), 1) + ' ha · ' + (b.dir == null ? 'arah belum diatur' : 'arah ' + Math.round(b.dir) + '° · ' + nf(blkSp(b), 2) + ' m') + ' · ' + blkStatusText(b) + '</small></div><button class="btn sm" data-bv="' + i + '">Lihat</button><button class="btn sm" data-be="' + i + '">Edit</button></div></div>'; }).join('') +
        '<div class="row" style="margin-top:10px;gap:6px;align-items:center"><button class="btn sm" id="bkPv"' + (pg ? '' : ' disabled') + '>‹</button><div class="muted" style="flex:1;text-align:center">Hal ' + (pg + 1) + ' / ' + pages + ' · ' + fl.length + ' blok</div><button class="btn sm" id="bkNx"' + (pg < pages - 1 ? '' : ' disabled') + '>›</button></div>' +
        (bl.filter(isScanBlk).length ? '<button class="btn" id="bkScan" style="width:100%;margin-top:12px;color:var(--r)">Hapus blok hasil deteksi (' + bl.filter(isScanBlk).length + ')</button>' : '') + '<button class="btn" id="bkAll" style="width:100%;margin-top:12px;color:var(--r)">Hapus semua blok</button>'
        : '<div class="card muted">' + (bl.length ? 'Tidak ada yang cocok.' : 'Belum ada.') + '</div>');
    box.innerHTML = '<div class="card"><div class="muted">' + (bl.length ? bl.length + ' blok · ' + set + ' sudah diatur arahnya · ' + conf + ' terkonfirmasi' : 'Belum ada blok.') + '</div></div>' +
      '<div class="h">IMPOR DARI LOGBOOK.HZ</div><div class="card">' +
      (ovs.length ? '<select id="lgOv">' + ovs.map(function (x) { return '<option value="' + x.i + '">' + esc(x.o.name) + '</option>'; }).join('') + '</select>' +
        '<button class="btn pri" id="lgGo" style="width:100%;margin-top:10px;height:48px">Pilih berkas blok (.json)</button><input type="file" id="lgFile" accept=".json,application/json" style="display:none">' +
        '<div class="muted" style="margin-top:8px">Berkas dibuat oleh tombol Ekspor blok di Logbook.HZ (tab Peta). Peta PDF yang dipilih harus gambar peta yang sama dengan yang dipakai di Logbook.HZ. Blok ditampilkan dulu untuk diperiksa. Blok yang namanya sudah ada hanya diperbarui bentuknya, arah row tetap.</div>'
        : '<div class="muted">Belum ada peta PDF yang dikalibrasi. Tambahkan di tab PDF.</div>') + '</div>' +
      '<div class="h">JARAK ROW BAWAAN</div><div class="card"><div class="row"><input type="number" id="rwSp" step="0.05" min="0.5" max="5" value="' + (S.settings.rowSp || 1.5) + '"><span class="muted" style="padding:0 8px">m</span></div>' +
      '<div class="muted" style="margin-top:8px">Batas kedalaman cekungan (m)</div><input type="number" id="depT" step="0.1" min="0.1" max="3" value="' + (S.settings.depThr || 0.3) + '"></div>' +
      '<div class="h">DAFTAR BLOK</div>' + listHtml;
    function bq() { S.blkQ = $('bkQ').value.trim(); S.blkPg = 0; renderBlokTab(box); }
    if ($('bkQ')) { $('bkQ').onchange = bq; $('bkQb').onclick = bq; }
    if ($('bkPv')) $('bkPv').onclick = function () { S.blkPg = Math.max(0, (S.blkPg || 0) - 1); renderBlokTab(box); };
    if ($('bkNx')) $('bkNx').onclick = function () { S.blkPg = (S.blkPg || 0) + 1; renderBlokTab(box); };
    if ($('lgGo')) {
      $('lgGo').onclick = function () { $('lgFile').value = ''; $('lgFile').click(); };
      $('lgFile').onchange = function () { if (this.files && this.files[0]) importLoghz(this.files[0], +$('lgOv').value); };
    }
    $('rwSp').onchange = function () { var v = +this.value; if (v >= 0.5 && v <= 5) { S.settings.rowSp = v; saveSettings(); HA.RC.rows = {}; } };
    $('depT').onchange = function () { var v = +this.value; if (v >= 0.1 && v <= 3) { S.settings.depThr = v; saveSettings(); HA.RC.dep = {}; } };
    box.querySelectorAll('[data-bv]').forEach(function (x) { x.onclick = function () { var b = blocksList()[+x.getAttribute('data-bv')]; if (b) needMap(b.pts, function () { HA.map.fitBounds(L.latLngBounds(b.pts), { padding: [50, 50], maxZoom: 19 }); openBlockPop(b); }); }; });
    box.querySelectorAll('[data-be]').forEach(function (x) { x.onclick = function () { var b = blocksList()[+x.getAttribute('data-be')]; if (b) openBlockEdit(b); }; });
    if ($('bkScan')) $('bkScan').onclick = function () { askConfirm('Hapus blok hasil deteksi?', bl.filter(isScanBlk).length + ' blok hasil deteksi otomatis dihapus. Blok dari Logbook.HZ dan blok gambar sendiri tidak terhapus.', 'Hapus', function () { toast(delScanBlocks() + ' blok dihapus'); renderData(); }); };
    if ($('bkAll')) $('bkAll').onclick = function () { askConfirm('Hapus semua blok?', bl.length + ' blok dihapus dari aplikasi. Peta PDF tidak terpengaruh.', 'Hapus', function () { S.settings.blocks = []; saveSettings(); closeBlockPop(); drawBlocks(); drawRows(); renderData(); }); };
  }
  function importLoghz(file, idx) {
    var o = ovList()[idx]; if (!o || !o.cal) { toast('Pilih peta yang sudah dikalibrasi'); return; }
    file.text().then(function (t) {
      var d; try { d = JSON.parse(t); } catch (e) { throw new Error('Bukan berkas JSON'); }
      if (!d || d.app !== 'loghz-blok' || !d.blocks) throw new Error('Bukan berkas blok dari Logbook.HZ');
      if (d.imgW && d.imgH) {
        var rr = (d.imgW / d.imgH) / (o.W / o.H);
        if (Math.abs(rr - 1) > 0.03) toast('Peringatan: rasio gambar berbeda (Logbook ' + d.imgW + '×' + d.imgH + ', PDF ' + o.W + '×' + o.H + '). Periksa letak blok di peta.');
      }
      var toLL = HzOverlay.toLLFn(HzOverlay.affOf(o));
      var res = d.blocks.filter(function (b) { return b && b.points && b.points.length >= 3; }).map(function (b) {
        var lu = parseFloat(String(b.luas == null ? '' : b.luas).replace(',', '.'));
        return { name: String(b.label || '').trim(), luas: isFinite(lu) ? lu : null, on: true, pts: b.points.map(function (p) { var l = toLL(p.x / 100 * o.W, p.y / 100 * o.H); return [+l.lat.toFixed(7), +l.lng.toFixed(7)]; }) };
      });
      if (!res.length) throw new Error('Tidak ada blok di berkas');
      res.sort(function (p, q) { return p.name < q.name ? -1 : p.name > q.name ? 1 : 0; });
      detectPreview(res, o);
    }).catch(function (e) { toast('Impor gagal: ' + (e && e.message || e)); });
  }
  function detectPreview(res, o) {
    var all = []; res.forEach(function (r) { r.pts.forEach(function (p) { all.push(p); }); });
    needMap(all, function () {
      if (HA.DM.closePanel) HA.DM.closePanel();
      closeBlockPop();
      var g = L.layerGroup().addTo(HA.map), bar = document.createElement('div'), polys = [];
      HA.DM.prev = true; bar.className = 'lkbar'; HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar);
      function cnt() { return res.filter(function (r) { return r.on; }).length; }
      function paint() { polys.forEach(function (pl, i) { pl.setStyle({ color: res[i].on ? '#FFD84D' : '#777', dashArray: res[i].on ? null : '4 4', fillOpacity: res[i].on ? 0.15 : 0.03 }); }); $('lkT').textContent = cnt() + ' dari ' + res.length + ' blok dipilih. Ketuk blok untuk batal pilih.'; $('dpSave').textContent = 'Simpan (' + cnt() + ')'; }
      bar.innerHTML = '<span id="lkT"></span><button type="button" id="dpSave" class="pri">Simpan</button><button type="button" id="dpAgain">Ulang</button><button type="button" id="dpNo">Batal</button>';
      res.forEach(function (r, i) { var pl = L.polygon(r.pts, { weight: 2, interactive: true }).addTo(g); if (r.name) pl.bindTooltip(esc(r.name), { permanent: true, direction: 'center', className: 'lktip' }); pl.on('click', function (e) { L.DomEvent.stop(e); r.on = !r.on; paint(); }); polys.push(pl); });
      function end() { g.remove(); bar.remove(); HA.DM.prev = false; }
      $('dpSave').onclick = function () {
        var n = nextBlockNo(), k = 0, up = 0;
        res.forEach(function (r) {
          if (!r.on) return;
          var ex = r.name ? blocksList().filter(function (b) { return b.name.toLowerCase() === r.name.toLowerCase(); })[0] : null;
          if (ex) { ex.pts = r.pts; delete ex._bb; ex.ovId = o.id; if (r.luas) ex.luasCat = r.luas; up++; return; }
          blocksList().push({ id: Date.now() + k, src: r.name ? 'loghz' : 'scan', name: r.name || 'Blok ' + (n + k), pts: r.pts, ovId: o.id, dir: null, sp: null, margin: 0, conf: false, note: '', luasCat: r.luas || null }); k++;
        });
        HA.RC.rows = {}; HA.RC.dep = {}; HA.RC.guide = {};
        S.settings.blkOn = true; saveSettings(); end(); drawBlocks(); drawRows(); toast(k + ' blok baru' + (up ? ', ' + up + ' diperbarui' : '') + ' disimpan'); S.dpTab = 'blok'; go('data');
        var old = blocksList().filter(isScanBlk).length;
        if (old && res.some(function (r) { return r.name; })) setTimeout(function () { askConfirm('Hapus ' + old + ' blok hasil deteksi lama?', 'Blok hasil deteksi otomatis (Blok 1, 2, …) bertumpuk dengan blok dari Logbook.HZ. Blok dari Logbook dan blok yang kamu gambar sendiri tidak terhapus.', 'Hapus', function () { toast(delScanBlocks() + ' blok deteksi dihapus'); renderData(); }); }, 400);
      };
      $('dpAgain').onclick = function () { end(); S.dpTab = 'blok'; go('data'); };
      $('dpNo').onclick = end;
      paint();
    });
  }
})();
