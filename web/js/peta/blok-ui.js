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
    HA.RC.rows = {}; HA.RC.dep = {}; HA.RC.guide = {}; HzBlok.cache.clear(); saveSettings(); closeBlockPop(); drawBlocks(); drawRows(); return n;
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
  // ---------- jalan bantu dan drainase yang melewati blok (garis pemotong row) ----------
  function linesList() { return S.settings.lines || (S.settings.lines = []); }
  function lineBB(ln) {
    var s0 = 90, w = 180, n = -90, e = -180; ln.pts.forEach(function (p) { if (p[0] < s0) s0 = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; });
    return [s0, w, n, e];
  }
  function segM(a, b) { var k = Math.cos(a[0] * Math.PI / 180); return Math.hypot((b[0] - a[0]) * 111320, (b[1] - a[1]) * 111320 * k); }
  // titik cuplikan tiap step meter sepanjang garis
  function sampleLine(ln, step, fn) {
    var i, acc = 0;
    for (i = 0; i + 1 < ln.pts.length; i++) {
      var a = ln.pts[i], b = ln.pts[i + 1], L = segM(a, b), t = acc;
      while (t <= L) { var f = L ? t / L : 0; fn(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); t += step; }
      acc = t - L;
    }
  }
  HA.CUTM = HA.CUTM || {};
  function cutsFor(b) {
    var all = linesList(); if (!all.length || !b.pts) return null;
    var key = bSig(b) + '|' + (HA.LV || 0), hit = HA.CUTM[key]; if (hit !== undefined) return hit;
    var bb = bbOf(b), pad = 0.0003, out = [];
    all.forEach(function (ln) {
      if (!ln.pts || ln.pts.length < 2 || !(+ln.w > 0)) return;
      var q = lineBB(ln); if (q[2] < bb[0] - pad || q[0] > bb[2] + pad || q[3] < bb[1] - pad || q[1] > bb[3] + pad) return;
      var inside = false;
      sampleLine(ln, 3, function (la, lo) { if (!inside && llPip({ lat: la, lng: lo }, b.pts)) inside = true; });
      if (inside) out.push({ id: ln.id, type: ln.type, w: +ln.w, pts: ln.pts });
    });
    if (Object.keys(HA.CUTM).length > 400) HA.CUTM = {};
    return (HA.CUTM[key] = out.length ? out : null);
  }
  function cutSig(cuts) {
    if (!cuts || !cuts.length) return '';
    return cuts.map(function (c) { return c.id + ':' + c.w + ':' + c.pts.length + ':' + c.pts.reduce(function (s0, p) { return s0 + p[0] * 1.1 + p[1] * 0.9; }, 0).toFixed(6); }).join(';');
  }
  function cutSuffix(b) { var sg = cutSig(cutsFor(b)); return sg ? '|c' + sg : ''; }
  // luas yang tertutup jalan/drainase di dalam blok (m2, perkiraan)
  function cutArea(b, cuts) {
    var tot = 0;
    (cuts || []).forEach(function (c) { var n = 0; sampleLine(c, 1, function (la, lo) { if (llPip({ lat: la, lng: lo }, b.pts)) n++; }); tot += n * c.w; });
    return tot;
  }
  HA.cutsFor = cutsFor; HA.cutArea = cutArea; HA.lineBB = lineBB; HA.sampleLine = sampleLine; HA.segM = segM;
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
  // ---------- hasil hitung: memori (cepat) + simpanan IndexedDB (awet), dihitung di Worker ----------
  function bid(b) { return String(b.id != null ? b.id : b.name); }
  function gSig(b) { return b.guide ? b.guide.length + ':' + b.guide.reduce(function (s, p) { return s + p[0] * 1.1 + p[1] * 0.9; }, 0).toFixed(6) : 'a'; }
  function rowKey(b) { return ['k', bSig(b), gSig(b), blkSp(b), +b.margin || 0].join('|') + cutSuffix(b); }
  function humpThr() { return +S.settings.humpThr || 1; }
  function depKey(b) { return [bSig(b), +S.settings.depThr || 0.3, humpThr(), 'v2'].join('|'); }
  function rcPut(map, key, val) { map[key] = val; var ks = Object.keys(map); if (ks.length > 80) delete map[ks[0]]; }
  // hitung row satu blok (di-cache). mode: 'datar' | 'kontur'; bg = pekerjaan latar (tidak menyerobot antrean)
  function computeRows(b, mode, bg) {
    var sp = blkSp(b), mg = +b.margin || 0, key;
    if (mode === 'datar') {
      if (b.dir == null) return Promise.resolve(null);
      key = ['d', bSig(b), b.dir, sp, mg].join('|') + cutSuffix(b);
      if (!HA.RC.rows[key]) rcPut(HA.RC.rows, key, HzBlok.rowsStraight(b.pts, b.dir, sp, mg, cutsFor(b)));
      return Promise.resolve(HA.RC.rows[key]);
    }
    key = rowKey(b);
    if (HA.RC.rows[key]) return Promise.resolve(HA.RC.rows[key]);
    var ck = bid(b) + '\u0001r|' + key;
    return HzBlok.cache.get(ck).then(function (hit) {
      if (hit) { rcPut(HA.RC.rows, key, hit); return hit; }
      return HzBlok.konturJob(b.pts, b.guide || null, sp, mg, bid(b) + '|' + key, !bg, cutsFor(b)).then(function (r) {
        rcPut(HA.RC.rows, key, r); HzBlok.cache.put(bid(b), 'r', ck, r); return r;
      });
    });
  }
  function computeDep(b, bg) {
    var thr = +S.settings.depThr || 0.3, key = depKey(b);
    if (HA.RC.dep[key]) return Promise.resolve(HA.RC.dep[key]);
    var ck = bid(b) + '\u0001d|' + key;
    return HzBlok.cache.get(ck).then(function (hit) {
      if (hit) { rcPut(HA.RC.dep, key, hit); return hit; }
      return HzBlok.depJob(b.pts, thr, bid(b) + '|' + key, !bg, humpThr()).then(function (r) {
        rcPut(HA.RC.dep, key, r); HzBlok.cache.put(bid(b), 'd', ck, r); return r;
      });
    });
  }
  // hanya mengintip hasil yang sudah tersimpan (tidak menghitung)
  function peek(map, ck, key) {
    if (map[key]) return Promise.resolve(map[key]);
    return HzBlok.cache.get(ck).then(function (hit) { if (hit) rcPut(map, key, hit); return hit; });
  }
  function peekRows(b) { var k = rowKey(b); return peek(HA.RC.rows, bid(b) + '\u0001r|' + k, k); }
  function peekDep(b) { var k = depKey(b); return peek(HA.RC.dep, bid(b) + '\u0001d|' + k, k); }
  function thinStep(sp) {
    var mpp = 156543.03 * Math.cos(HA.map.getCenter().lat * Math.PI / 180) / Math.pow(2, HA.map.getZoom());
    return Math.max(1, Math.ceil(4 / (sp / mpp)));
  }
  function kDens() { var d = +S.settings.kDens; return d === 1 || d === 3 ? d : 2; }
  function shownLines(b, res, mode) {
    var k = thinStep(blkSp(b)) * (mode === 'kontur' ? kDens() : 1);
    if (k <= 1) return res.lines;
    // ditipiskan menurut nomor lajur (bukan urutan di daftar), supaya semua lengan blok C/U ditipiskan sama rata
    if (res.lk && res.lk.length === res.lines.length) return res.lines.filter(function (_, i) { var q = res.lk[i] % k; return (q < 0 ? q + k : q) === 0; });
    return res.lines.filter(function (_, i) { return i % k === 0; });
  }
  function mPerPx() { return 156543.03 * Math.cos(HA.map.getCenter().lat * Math.PI / 180) / Math.pow(2, HA.map.getZoom()); }
  // panah kecil (tanda ">") di sepanjang garis, menunjuk arah turun air. Jarang dan tipis supaya peta tidak ramai.
  function drawArrows(g, lines, flow) {
    if (!flow || !flow.a || !lines || !lines.length) return;
    var mpp = mPerPx(), gap = 110 * mpp, L0 = 7 * mpp, out = [], cap = 150, R = Math.PI / 180;
    function bearingAt(lat, lng) {
      var i = Math.round((lng - flow.w) / (flow.e - flow.w) * (flow.cols - 1)), j = Math.round((flow.n - lat) / (flow.n - flow.s) * (flow.rows - 1));
      if (i < 0 || j < 0 || i >= flow.cols || j >= flow.rows) return -1;
      return flow.a[j * flow.cols + i];
    }
    function chevron(lat, lng, br) {
      var cl = Math.cos(lat * R) || 1;
      function pt(dir, m) { var rr = dir * R; return [lat + m * Math.cos(rr) / 111320, lng + m * Math.sin(rr) / (111320 * cl)]; }
      var tip = pt(br, L0 * 0.5), c = [lat + (tip[0] - lat), lng + (tip[1] - lng)];
      var l1 = [tip[0] + L0 * Math.cos((br + 150) * R) / 111320, tip[1] + L0 * Math.sin((br + 150) * R) / (111320 * cl)];
      var l2 = [tip[0] + L0 * Math.cos((br - 150) * R) / 111320, tip[1] + L0 * Math.sin((br - 150) * R) / (111320 * cl)];
      void c; return [l1, tip, l2];
    }
    var tot = 0; // panjang total garis tampak; jarak panah diperlebar bila jumlahnya akan melewati batas, supaya merata di seluruh blok
    lines.forEach(function (ln) { for (var q0 = 1; q0 < ln.length; q0++) tot += Math.hypot((ln[q0][0] - ln[q0 - 1][0]) * 111320, (ln[q0][1] - ln[q0 - 1][1]) * 111320 * (Math.cos(ln[q0][0] * R) || 1)); });
    gap = Math.max(gap, tot / (cap * 0.9));
    lines.forEach(function (ln, li) {
      if (out.length >= cap || ln.length < 2) return;
      var acc = gap * ((li * 0.37) % 1), prev = ln[0], q, d, m, f;
      for (q = 1; q < ln.length && out.length < cap; q++) {
        var cur = ln[q], cl2 = Math.cos(prev[0] * R) || 1;
        d = Math.hypot((cur[0] - prev[0]) * 111320, (cur[1] - prev[1]) * 111320 * cl2);
        if (d > 0) {
          m = acc;
          while (m + 0 <= d && out.length < cap) {
            f = m / d; var lat = prev[0] + (cur[0] - prev[0]) * f, lng = prev[1] + (cur[1] - prev[1]) * f, br = bearingAt(lat, lng);
            if (br >= 0) out.push(chevron(lat, lng, br));
            m += gap;
          }
          acc = m - d;
        }
        prev = cur;
      }
    });
    if (out.length) L.polyline(out, { color: '#FFFFFF', weight: 1.7, opacity: 1, interactive: false, lineCap: 'round', lineJoin: 'round', smoothFactor: 0 }).addTo(g);
  }
  function drawDepInto(g, dep) {
    if (!dep) return;
    dep.list.forEach(function (d) {
      L.polygon(d.poly, { color: '#5EE0FF', weight: 1, fillColor: '#5EE0FF', fillOpacity: 0.38, interactive: false }).bindTooltip(nf(d.depth, 1) + 'm', { permanent: HA.map.getZoom() >= 17, direction: 'center', className: 'lktip' }).addTo(g);
    });
    (dep.hump || []).forEach(function (d) {
      L.polygon(d.poly, { color: '#FFB020', weight: 1, fillColor: '#FFB020', fillOpacity: 0.34, interactive: false }).bindTooltip(nf(d.depth, 1) + 'm', { permanent: HA.map.getZoom() >= 17, direction: 'center', className: 'lktip' }).addTo(g);
    });
  }
  function drawRowsInto(g, b, mode, res, dep) {
    var ls = null;
    if (res && res.lines.length) {
      ls = shownLines(b, res, mode);
      L.polyline(ls, { color: '#FFFFFF', weight: 0.8, opacity: 0.9, interactive: false, smoothFactor: 0.5 }).addTo(g);
    }
    if (dep && mode === 'kontur') {
      drawDepInto(g, dep);
      if (ls && dep.flow) drawArrows(g, ls, dep.flow);
    }
  }
  // blok yang row-nya sudah tersimpan tetapi cekung/cembung belum dihitung (versi lama): dihitung pelan di latar, lalu digambar ulang
  function fillDepBg(list, id) {
    HA.DM.depBg = true; var ok = 0, k = 0;
    HA.RC.depFail = HA.RC.depFail || {};
    (function nx() {
      if (k >= list.length) { HA.DM.depBg = false; if (ok && id === HA.DM.rowSeq) drawRows(); return; }
      var b = list[k++], key = depKey(b);
      if (HA.RC.depFail[key]) { setTimeout(nx, 0); return; }
      computeDep(b, true).then(function (r) { if (r) ok++; }).catch(function () { HA.RC.depFail[key] = 1; }).then(function () { setTimeout(nx, 60); });
    })();
  }

  // ---------- kontur seluruh area: cekungan dan cembung per petak z16, hasil disimpan (IDB) ----------
  function tileXY(lat, lng, z) { var n = Math.pow(2, z), r = lat * Math.PI / 180; return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]; }
  function tileBB(x, y, z) { var n = Math.pow(2, z); function la(yy) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * 180 / Math.PI; } return [la(y + 1), x / n * 360 - 180, la(y), (x + 1) / n * 360 - 180]; }
  function hashStr(t) { var h = 5381, i; for (i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function lakeSig() { return hashStr((S.settings.lakesOn === false ? '0' : '1') + (S.settings.lakes || []).map(function (l) { return l.pts.length + ':' + (l.level == null ? '' : l.level) + ':' + (l.pts[0] ? l.pts[0][0] : 0); }).join(',')); }
  function areaDep(x, y) {
    var bb = tileBB(x, y, 16), bd = L.latLngBounds([[bb[0], bb[1]], [bb[2], bb[3]]]), bl = blocksList().filter(function (b) { return bbHit(b, bd); });
    if (!bl.length) return Promise.resolve(null);
    var thr = +S.settings.depThr || 0.3, key = ['a', x, y, hashStr(bl.map(bSig).join(',')), lakeSig(), thr, humpThr(), 'v1'].join('|');
    function keep(r) {
      var out = { list: [], hump: [] };
      function inside(d) {
        var cy = 0, cx = 0; d.poly.forEach(function (p) { cy += p[0]; cx += p[1]; }); cy /= d.poly.length; cx /= d.poly.length;
        if (cy < bb[0] || cy >= bb[2] || cx < bb[1] || cx >= bb[3]) return false;
        return bl.some(function (b) { return llPip({ lat: cy, lng: cx }, b.pts); });
      }
      (r.list || []).forEach(function (d) { if (inside(d)) out.list.push(d); });
      (r.hump || []).forEach(function (d) { if (inside(d)) out.hump.push(d); });
      return out;
    }
    if (HA.RC.dep[key]) return Promise.resolve(HA.RC.dep[key]);
    var ck = 'area\u0001' + key;
    return HzBlok.cache.get(ck).then(function (hit) {
      if (hit) { rcPut(HA.RC.dep, key, hit); return hit; }
      var dLat = 50 / 111320, dLng = 50 / (111320 * Math.cos(bb[0] * Math.PI / 180)), rect = [[bb[0] - dLat, bb[1] - dLng], [bb[2] + dLat, bb[1] - dLng], [bb[2] + dLat, bb[3] + dLng], [bb[0] - dLat, bb[3] + dLng]];
      return HzBlok.depJob(rect, thr, 'area|' + key, false, humpThr()).then(function (r) {
        var out = keep(r); rcPut(HA.RC.dep, key, out); HzBlok.cache.put('area:' + x + ':' + y, 'd', ck, out); return out;
      });
    });
  }
  function drawArea(g, id) {
    var bd = HA.map.getBounds(), a = tileXY(bd.getNorth(), bd.getWest(), 16), c = tileXY(bd.getSouth(), bd.getEast(), 16), list = [], x, y;
    for (x = a[0]; x <= c[0]; x++) for (y = a[1]; y <= c[1]; y++) list.push([x, y]);
    if (list.length > 12) { if (!HA.DM.areaTip) { HA.DM.areaTip = 1; toast('Dekatkan peta sedikit untuk kontur area'); } return; }
    var i = 0, told = false, popB = HA.DM.popId != null ? blocksList().filter(function (b) { return b.id === HA.DM.popId; })[0] : null;
    (function nx() {
      if (id !== HA.DM.rowSeq || i >= list.length) return;
      var t = list[i++];
      var tm = setTimeout(function () { if (!told && id === HA.DM.rowSeq) { told = true; toast('Menghitung kontur area… hanya sekali, lalu tersimpan'); } }, 700);
      areaDep(t[0], t[1]).then(function (r) {
        clearTimeout(tm);
        if (id !== HA.DM.rowSeq || !r) return;
        var d2 = { list: r.list, hump: r.hump };
        if (popB) { d2 = { list: r.list.filter(function (d) { return !llPip({ lat: d.poly[0][0], lng: d.poly[0][1] }, popB.pts); }), hump: r.hump.filter(function (d) { return !llPip({ lat: d.poly[0][0], lng: d.poly[0][1] }, popB.pts); }) }; }
        drawDepInto(g, d2);
      }).catch(function () { clearTimeout(tm); }).then(function () { setTimeout(nx, 40); });
    })();
  }
  // lapisan Arah row. Datar: semua blok yang tampak. Kontur: hanya blok yang hasilnya sudah tersimpan
  // (blok lain dihitung saat diketuk atau lewat "Siapkan kontur"), digambar satu per satu supaya tidak macet.
  function drawRows(hint) {
    if (!HA.map) return;
    if (HA.drawLines) HA.drawLines();
    if (HA.drawLakes) HA.drawLakes();
    if (HA.DM.rowLayer) { HA.map.removeLayer(HA.DM.rowLayer); HA.DM.rowLayer = null; }
    HA.DM.rowSeq = (HA.DM.rowSeq || 0) + 1;
    if (!S.settings.rowOn || S.settings.blkOn === false || !blocksList().length) return;
    if (HA.map.getZoom() < 16) { if (hint) toast('Perbesar peta ke zoom 16 untuk melihat ' + ((S.settings.rowMode || 'datar') === 'kontur' ? 'kontur' : 'row')); return; }
    var mode = S.settings.rowMode || 'datar', id = HA.DM.rowSeq, bd = HA.map.getBounds(), cc = HA.map.getCenter(), g = L.layerGroup().addTo(HA.map), vis, i = 0, miss = 0, need = [];
    HA.DM.rowLayer = g;
    if (mode === 'kontur') drawArea(g, id);
    vis = blocksList().filter(function (b) { return bbHit(b, bd) && (mode === 'kontur' || b.dir != null); });
    vis.sort(function (p, q) { var a1 = bbOf(p), b1 = bbOf(q); return Math.hypot((a1[0] + a1[2]) / 2 - cc.lat, (a1[1] + a1[3]) / 2 - cc.lng) - Math.hypot((b1[0] + b1[2]) / 2 - cc.lat, (b1[1] + b1[3]) / 2 - cc.lng); });
    vis = vis.slice(0, mode === 'kontur' ? 40 : 30);
    function fin() {
      if (id !== HA.DM.rowSeq) return;
      if (need.length && !HA.DM.depBg) fillDepBg(need.slice(0, 6), id);
      HA.DM.rowTipMode = mode;
    }
    (function nx() {
      if (id !== HA.DM.rowSeq) return;
      if (i >= vis.length) { fin(); return; }
      var b = vis[i++];
      if (b.id === HA.DM.popId) { setTimeout(nx, 0); return; }
      if (mode === 'datar') {
        computeRows(b, 'datar').then(function (r) { if (id === HA.DM.rowSeq && b.id !== HA.DM.popId) drawRowsInto(g, b, 'datar', r, null); }).then(function () { setTimeout(nx, 0); });
        return;
      }
      Promise.all([peekRows(b), peekDep(b)]).then(function (r) {
        if (id !== HA.DM.rowSeq) return;
        if (!r[0]) miss++; else { if (!r[1] || !r[1].hump) need.push(b); if (b.id !== HA.DM.popId) drawRowsInto(g, b, 'kontur', r[0], r[1] && r[1].hump ? { list: [], hump: [], flow: r[1].flow } : null); }
      }).catch(function () {}).then(function () { setTimeout(nx, 0); });
    })();
  }
  // soft = dibuka ulang oleh openBlockPop (status lipat dipertahankan)
  function closeBlockPop(soft) {
    if (soft !== true) HA.DM.bpFold = false;
    if (HA.DM.pop) { HA.DM.pop.remove(); HA.DM.pop = null; }
    if (HA.DM.popLayer && HA.map) { HA.map.removeLayer(HA.DM.popLayer); HA.DM.popLayer = null; }
    HA.DM.popId = null; HA.DM.popSeq = (HA.DM.popSeq || 0) + 1;
    if (S.settings.rowOn && HA.map) drawRows();
  }
  function downText(ang) { return ang < 30 ? 'searah lereng, rawan erosi' : ang < 60 ? 'miring terhadap lereng' : 'memotong lereng'; }
  function applyFold() {
    var el = HA.DM.pop; if (!el) return;
    el.classList.toggle('fold', !!HA.DM.bpFold);
    var t = el.querySelector('#bpT'); if (t) t.setAttribute('aria-expanded', HA.DM.bpFold ? 'false' : 'true');
  }
  function openBlockPop(b) {
    if (!HA.map) return;
    if (HA.DM.closePanel) HA.DM.closePanel(); if (HA.closeLinePop) HA.closeLinePop();
    if (HA.DM.popId != null && HA.DM.popId !== b.id && !$('sheet').classList.contains('on')) HA.DM.bpFold = false;
    closeBlockPop(true); HA.DM.popId = b.id;
    var sumR = '', sumD = '';
    var mode = S.settings.rowMode || 'datar', id = HA.DM.popSeq, el = document.createElement('div');
    el.className = 'blkpop' + (HA.DM.bpFold ? ' fold' : ''); HA.map.getContainer().appendChild(el); HA.DM.pop = el; L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el);
    var PEN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19z"/></svg>';
    el.innerHTML = '<div class="bh"><b>' + esc(b.name) + '<small class="bha"> · ' + nf(blkHa(b), 2) + ' ha</small></b><button type="button" class="ib2" id="bpE" aria-label="Edit blok">' + PEN + '</button><button type="button" class="ib2" id="bpT" aria-label="Lipat atau buka panel" aria-expanded="' + (HA.DM.bpFold ? 'false' : 'true') + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button><button type="button" class="ib2" id="bpX" aria-label="Tutup">✕</button></div>' +
      '<div class="bs" id="bpS"></div><div id="bpBody">' +
      '<div class="bl">' + nf(blkHa(b), 2) + ' ha' + (b.luasCat ? ' (tercatat ' + nf(+b.luasCat, 2) + ')' : '') + ' · ' + (b.dir == null ? 'arah row belum diatur' : 'arah ' + Math.round(b.dir) + '° · jarak ' + nf(blkSp(b), 2) + ' m') + ' · <small>' + blkStatusText(b) + '</small></div>' +
      '<div class="bl" id="bpR">Menghitung…</div><div class="bl" id="bpA"></div><div class="bl" id="bpD"></div><div class="bl" id="bpH"></div><div class="bl" id="bpL"></div>' + (b.note ? '<div class="bl"><small>' + esc(b.note) + '</small></div>' : '') +
      '<div class="tseg" id="bpM"><button type="button" data-m="datar">Datar</button><button type="button" data-m="kontur">Kontur</button></div>' +
      (mode === 'kontur' ? '<div class="tseg" id="bpK"><button type="button" data-k="1">Rapat</button><button type="button" data-k="2">Sedang</button><button type="button" data-k="3">Jarang</button></div><div class="tseg"><button type="button" id="bpG">Edit garis pedoman</button>' + (b.guide ? '<button type="button" id="bpG0">Atur ulang pedoman</button>' : '') + '</div>' : '') + '</div>';
    el.querySelectorAll('#bpM button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-m') === mode); });
    $('bpX').onclick = function () { closeBlockPop(); };
    $('bpT').onclick = function () { HA.DM.bpFold = !HA.DM.bpFold; applyFold(); };
    function updSum() { var e = $('bpS'); if (e) e.textContent = [sumR, sumD].filter(Boolean).join(' · '); }
    $('bpE').onclick = function () { openBlockEdit(b); };
    $('bpM').onclick = function (e) { var m = e.target.getAttribute && e.target.getAttribute('data-m'); if (!m) return; S.settings.rowMode = m; saveSettings(); drawRows(); if (HA.DM.sync) HA.DM.sync(); openBlockPop(b); };
    if ($('bpK')) {
      $('bpK').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-k') === kDens()); });
      $('bpK').onclick = function (e) { var k = +(e.target.getAttribute && e.target.getAttribute('data-k')); if (!k) return; S.settings.kDens = k; saveSettings(); drawRows(); openBlockPop(b); };
    }
    if ($('bpG')) $('bpG').onclick = function () { editGuide(b); };
    if ($('bpG0')) $('bpG0').onclick = function () { delete b.guide; saveSettings(); openBlockPop(b); };
    var lay = L.layerGroup().addTo(HA.map); HA.DM.popLayer = lay;
    (function () {
      var cs = cutsFor(b); if (!cs || !$('bpL')) return;
      var ia = cutArea(b, cs) / 10000, nJ = cs.filter(function (c) { return c.type !== 'drain'; }).length, nD = cs.length - nJ;
      $('bpL').innerHTML = (nJ ? 'Jalan bantu ' + nJ : '') + (nJ && nD ? ' · ' : '') + (nD ? 'Drainase ' + nD : '') + ' · <b>luas tanam ' + nf(Math.max(0, blkHa(b) - ia), 2) + ' ha</b> <small>(blok ' + nf(blkHa(b), 2) + ' ha, tertutup ' + nf(ia, 2) + ' ha)</small>';
    })();
    if (mode === 'kontur') $('bpR').textContent = 'Menghitung kontur… (beberapa detik, aplikasi tetap bisa dipakai)';
    var rowsP = computeRows(b, mode), rowsRes = null;
    // cekungan dihitung setelah row selesai, supaya garis tampil lebih dulu
    var depP = rowsP.catch(function () { return null; }).then(function () { return computeDep(b); }).catch(function () { return null; });
    rowsP.then(function (r) {
      if (id !== HA.DM.popSeq || !$('bpR')) return;
      rowsRes = r; sumR = r ? (r.lk ? r.n.toLocaleString('id-ID') + ' lajur' : '≈' + r.n.toLocaleString('id-ID') + ' garis') : 'arah row belum diatur'; updSum();
      if (!r) $('bpR').innerHTML = 'Ketuk ikon pensil untuk mengatur arah row.';
      else { $('bpR').innerHTML = (r.lk ? '<b>' + r.n.toLocaleString('id-ID') + ' lajur</b>' : '<b>≈ ' + r.n.toLocaleString('id-ID') + ' garis</b> <small>(kontur lama; bersihkan dan siapkan ulang untuk jumlah lajur)</small>') + (mode === 'kontur' ? ' mengikuti kontur' : '') + ' · rata-rata ' + Math.round(r.avg) + ' m · total ' + nf(r.total / 1000, 2) + ' km' + (mode === 'kontur' ? '<br><small>perkiraan dari garis pedoman dan jarak row</small>' : ''); drawRowsInto(lay, b, mode, r, null); }
    }).catch(function (e) { if (id === HA.DM.popSeq && $('bpR')) $('bpR').textContent = String(e && e.message || e); });
    if (S.settings.rowOn) drawRows();
    if (b.dir != null && window.HzDem) {
      var c0 = HzBlok.proj(b.pts[0][0], b.pts[0][1]), cx = 0, cy = 0; b.pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= b.pts.length; cy /= b.pts.length; void c0;
      HzDem.info(cx, cy).then(function (r) { if (id !== HA.DM.popSeq || !r || !$('bpA')) return; if (r.pct < 1) { $('bpA').textContent = 'Lereng di tengah blok hampir datar (' + nf(r.pct, 1) + '%)'; return; } var an = HzBlok.angleToSlope(b.dir, r.down); $('bpA').innerHTML = 'Lereng ' + nf(r.pct, 1) + '% · row ' + Math.round(an) + '° terhadap arah turun (' + downText(an) + ')'; }).catch(function () {});
    }
    depP.then(function (d) {
      if (id !== HA.DM.popSeq || !$('bpD')) return;
      if (d && mode === 'kontur') { drawDepInto(lay, d); if (rowsRes && d.flow) drawArrows(lay, shownLines(b, rowsRes, mode), d.flow); }
      sumD = d ? (d.list.length ? d.list.length + ' cekungan' : 'tanpa cekungan') + (d.hump && d.hump.length ? ' · ' + d.hump.length + ' cembung' : '') : ''; updSum();
      if (d && $('bpH')) {
        if (d.hump && d.hump.length) { var th = 0; d.hump.forEach(function (x) { th += x.area; }); $('bpH').innerHTML = '<b>Cembung: ' + d.hump.length + '</b> · tertinggi +' + nf(d.hump[0].depth, 1) + ' m dari sekitar · total ' + Math.round(th).toLocaleString('id-ID') + ' m²<br><small>bagian yang lebih tinggi, air mengalir menjauh. Panah di garis = arah turun air</small>'; }
        else $('bpH').innerHTML = 'Cembung: tidak terdeteksi <small>(≥ ' + nf(humpThr(), 1) + ' m)</small>';
      }
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
    if (HA.DM.closePanel) HA.DM.closePanel(); if (HA.closeLinePop) HA.closeLinePop(); if ($('sheet').classList.contains('on')) { HA.onSheetClose = null; closeSheet(); }
    HA.DM.edit = true; bar.className = 'lkbar bot';
    bar.innerHTML = '<span id="epT"></span><div class="tseg" style="flex:1 1 100%;margin:0"><button type="button" data-m="geser">Geser</button><button type="button" data-m="tambah">+ Titik</button><button type="button" data-m="hapus">− Titik</button></div><button type="button" id="epNo">Batal</button><button type="button" id="epOk" class="pri">Simpan</button>';
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
    HA.pbStopForEdit();
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
  // Ketuk 2 titik di satu lajur untuk menentukan arah row. Titik besar, bisa digeser; titik tampil di atas jari supaya tidak tertutup.
  function tapDir(b) {
    var P = [null, null], mk = [null, null], line = null, g = L.layerGroup().addTo(HA.map), bar = document.createElement('div'), ang = null;
    if (HA.DM.closePanel) HA.DM.closePanel(); if (HA.closeLinePop) HA.closeLinePop();
    HA.DM.pdir = true; closeBlockPop(true); HA.DM.popId = b.id;
    bar.className = 'lkbar bot'; bar.innerHTML = '<span id="tdT">Ketuk titik pertama di satu lajur</span><button type="button" id="tdC">Batal</button><button type="button" class="pri" id="tdOk" disabled>Pakai</button>';
    HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar);
    function icon(n) { return L.divIcon({ className: '', html: '<div class="tpm"><b>' + n + '</b><div class="d"></div><div class="h"></div></div>', iconSize: [56, 80], iconAnchor: [28, 24] }); }
    function upd() {
      var t = $('tdT'); if (!t) return;
      if (line) { g.removeLayer(line); line = null; }
      if (P[0] && P[1]) {
        line = L.polyline([P[0], P[1]], { color: '#00D4FF', weight: 2.5, dashArray: '6 5', interactive: false }).addTo(g);
        var m = HzBlok.proj(P[0][0], P[0][1]).xy(P[1]), dist = Math.hypot(m[0], m[1]);
        if (dist < 5) { ang = null; t.textContent = 'Titik terlalu dekat. Geser salah satu titik lebih jauh'; }
        else { ang = Math.round((HzBlok.bearing(P[0], P[1]) % 180) * 10) / 10; t.textContent = 'Arah ' + ang + '° · jarak ' + Math.round(dist) + ' m · geser titik bila perlu'; }
      } else t.textContent = P[0] ? 'Ketuk titik kedua di lajur yang sama (jauh dari titik pertama)' : 'Ketuk titik pertama di satu lajur';
      $('tdOk').disabled = ang == null;
    }
    function put(k, ll) {
      P[k] = [ll.lat, ll.lng];
      mk[k] = L.marker(P[k], { draggable: true, icon: icon(k + 1), zIndexOffset: 900 }).addTo(g);
      mk[k].on('drag', function (e) { var q = e.target.getLatLng(); P[k] = [q.lat, q.lng]; upd(); });
      upd();
    }
    function end() { HA.map._lakeDraw = null; HA.DM.pdir = false; HA.map.removeLayer(g); bar.remove(); }
    HA.map._lakeDraw = { tap: function (ll) { if (!P[0]) put(0, ll); else if (!P[1]) put(1, ll); } };
    $('tdC').onclick = function () { end(); openBlockEdit(b); };
    $('tdOk').onclick = function () { if (ang == null) return; end(); b.dir = ang; saveSettings(); drawBlocks(); openBlockPop(b); openBlockEdit(b); };
    setTimeout(function () { fitBlockVisible(b, false); }, 60);
  }
  // posisikan peta supaya blok terlihat di bagian yang tidak tertutup panel
  function fitBlockVisible(b, anim) {
    return; // v0.11.1: peta tidak berpindah atau zoom sendiri saat edit
    if (S.view !== 'lintasan' || !HA.map || !b.pts || b.pts.length < 3) return;
    var mr = HA.map.getContainer().getBoundingClientRect(), sh = $('sheet').getBoundingClientRect(), top = 24, bot = 24;
    if ($('sheet').classList.contains('on')) bot = Math.max(24, mr.bottom - sh.top + 12);
    else if (HA.map._lakeDraw) bot = 96;
    if (HA.DM.pop) top = HA.DM.pop.offsetTop + HA.DM.pop.offsetHeight + 12;
    if (mr.height - top - bot < 120) return;
    HA.map.fitBounds(L.latLngBounds(b.pts), { paddingTopLeft: [24, top], paddingBottomRight: [24, bot], maxZoom: 19, animate: !!anim });
  }
  function openBlockEdit(b) {
    HA.pbStopForEdit(); if (HA.DM.closePanel) HA.DM.closePanel(); if (HA.closeLinePop) HA.closeLinePop();
    HA.DM.bpFold = true;
    var sg = HzBlok.suggestDir(b.pts), inMap = S.view === 'lintasan' && !!HA.map;
    function dirStat(d) { try { var r = HzBlok.rowsStraight(b.pts, d, blkSp(b), +b.margin || 0, cutsFor(b)); return r.n.toLocaleString('id-ID') + ' lajur · ' + Math.round(r.avg) + ' m'; } catch (e) { return ''; } }
    openSheet('<div class="grab"></div><div class="bth"><div class="st">EDIT BLOK</div><button class="btn pri" id="beX">Selesai</button></div>' +
      '<div class="bnm"><input type="text" id="beN" maxlength="40" value="' + esc(b.name) + '"><label><input type="checkbox" id="beC"' + (b.conf ? ' checked' : '') + '> Terkonfirmasi</label></div>' +
      '<div class="muted" style="margin-top:8px">Arah row (° dari utara, 0–179)</div>' +
      '<div class="row bedir"><button class="btn" data-d="-5">−5</button><button class="btn" data-d="-1">−1</button><input type="number" id="beD" min="0" max="359" step="1" value="' + (b.dir == null ? '' : Math.round(b.dir * 10) / 10) + '" placeholder="arah"><button class="btn" data-d="1">+1</button><button class="btn" data-d="5">+5</button><button class="btn sgb" id="beS"></button></div>' +
      '<div class="row" style="margin-top:6px;gap:6px"><button class="btn" id="beP" style="flex:1">Ketuk 2 titik</button><button class="btn" id="beB" style="flex:1">Edit batas</button></div>' +
      '<button class="btn" id="beMo" style="width:100%;margin-top:8px">Lainnya ▾</button>' +
      '<div class="bmore" id="beMore"><div class="row" style="margin-top:10px;gap:8px"><div style="flex:1"><div class="muted">Jarak row (m)</div><input type="number" id="beJ" step="0.05" min="0.5" max="5" value="' + blkSp(b) + '"></div><div style="flex:1"><div class="muted">Kurangi tepi (m)</div><input type="number" id="beM" step="1" min="0" max="50" value="' + (+b.margin || 0) + '"></div></div>' +
      '<textarea id="beT" rows="2" maxlength="200" placeholder="Catatan (varietas, R&D, dll.)" style="margin-top:8px;width:100%">' + esc(b.note || '') + '</textarea>' +
      '<div class="row" style="margin-top:10px;gap:6px"><button class="btn" id="beD2" style="flex:1;color:var(--r)">Hapus</button></div></div>');
    if (inMap) { $('scrim').classList.remove('on'); $('sheet').classList.add('cmp'); }
    $('beMo').onclick = function () { var m = $('beMore'), on = !m.classList.contains('on'); m.classList.toggle('on', on); $('beMo').textContent = on ? 'Lainnya ▴' : 'Lainnya ▾'; if (on) $('sheet').scrollTop = $('sheet').scrollHeight; setTimeout(function () { fitBlockVisible(b, true); }, 60); };
    function live() { saveSettings(); drawBlocks(); if (HA.DM.pop && HA.DM.popId === b.id) openBlockPop(b); if (S.settings.rowOn) drawRows(); }
    function setDir(v) { b.dir = v == null ? null : ((v % 180) + 180) % 180; if (b.dir == null) b.conf = false; $('beD').value = b.dir == null ? '' : Math.round(b.dir * 10) / 10; if (b.dir == null) $('beC').checked = false; live(); }
    $('beN').onchange = function () { b.name = $('beN').value.trim() || b.name; live(); };
    $('beD').onchange = function () { var v = $('beD').value; setDir(v === '' ? null : +v); };
    $('sheet').querySelectorAll('button[data-d]').forEach(function (x) { x.onclick = function () { setDir((b.dir == null ? sg : b.dir) + (+x.getAttribute('data-d'))); }; });
    var lg = (sg + 90) % 180, nextSg = 0; // 0 = berikutnya terpendek, 1 = terjauh
    function sgLabel() { var d = nextSg ? lg : sg; $('beS').innerHTML = (nextSg ? 'Terjauh ' : 'Terpendek ') + d + '°<small>' + dirStat(d) + '</small>'; }
    $('beS').onclick = function () { setDir(nextSg ? lg : sg); nextSg = nextSg ? 0 : 1; sgLabel(); };
    sgLabel();
    $('beJ').onchange = function () { var v = +$('beJ').value; b.sp = v >= 0.5 && v <= 5 ? Math.round(v * 100) / 100 : null; live(); };
    $('beM').onchange = function () { b.margin = Math.max(0, +$('beM').value || 0); live(); };
    $('beC').onchange = function () { if ($('beC').checked && b.dir == null) { $('beC').checked = false; toast('Atur arah row dulu'); return; } b.conf = $('beC').checked; live(); };
    $('beT').onchange = function () { b.note = $('beT').value.trim(); live(); };
    $('beP').onclick = function () { HA.onSheetClose = null; closeSheet(); needMap(b.pts, function () { tapDir(b); }); };
    $('beB').onclick = function () { HA.onSheetClose = null; closeSheet(); needMap(b.pts, function () { closeBlockPop(); editPoly(b.pts, true, function (res) { if (res) { b.pts = res; delete b._bb; saveSettings(); } drawBlocks(); drawRows(); openBlockPop(b); openBlockEdit(b); }); }); };
    $('beD2').onclick = function () { askConfirm('Hapus "' + b.name + '"?', 'Blok dihapus dari peta. Peta PDF tidak terpengaruh.', 'Hapus', function () { var i = blocksList().indexOf(b); if (i >= 0) blocksList().splice(i, 1); HzBlok.cache.del(bid(b)); saveSettings(); closeBlockPop(); closeSheet(); drawBlocks(); drawRows(); if (S.view === 'data') renderData(); }); };
    $('beX').onclick = function () { closeSheet(); if (S.view === 'data') renderData(); };
    HA.onSheetClose = function () { HA.DM.bpFold = false; applyFold(); };
    if (S.view === 'lintasan' && HA.map) { if (!HA.DM.pop) openBlockPop(b); else applyFold(); setTimeout(function () { fitBlockVisible(b, true); }, 80); }
  }
  // ---------- deteksi blok dari peta PDF ----------
  function detCfg() { return S.settings.dt || (S.settings.dt = { thr: 190, close: 1, minHa: 1 }); }
  function blockById(id) { var l = blocksList(), i; for (i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i]; return null; }
  function renderBlokTab(box) {
    var bl = blocksList(), cfg = detCfg(), ovs = ovList().map(function (o, i) { return { o: o, i: i }; }).filter(function (x) { return x.o.cal; });
    var conf = bl.filter(function (b) { return b.conf; }).length, set = bl.filter(function (b) { return b.dir != null; }).length;
    var PG = 30, q = (S.blkQ || '').toLowerCase(), fl = q ? bl.filter(function (b) { return (b.name || '').toLowerCase().indexOf(q) >= 0; }) : bl, pages = Math.max(1, Math.ceil(fl.length / PG)), pg = Math.min(Math.max(0, S.blkPg || 0), pages - 1);
    S.blkPg = pg;
    var listHtml = '<div class="row" style="gap:6px"><input type="text" id="bkQ" placeholder="Cari no blok (mis. 12 BS)" value="' + esc(S.blkQ || '') + '"><button class="btn sm" id="bkQb">Cari</button></div>' +
      (fl.length ? '<div id="bkList" style="margin-top:8px"></div>' +
        '<div class="row" style="margin-top:10px;gap:6px;align-items:center"><button class="btn sm" id="bkPv"' + (pg ? '' : ' disabled') + '>‹</button><div class="muted" style="flex:1;text-align:center">Hal ' + (pg + 1) + ' / ' + pages + ' · ' + fl.length + ' blok</div><button class="btn sm" id="bkNx"' + (pg < pages - 1 ? '' : ' disabled') + '>›</button></div>' +
        (bl.filter(isScanBlk).length ? '<button class="btn" id="bkScan" style="width:100%;margin-top:12px;color:var(--r)">Hapus blok hasil deteksi (' + bl.filter(isScanBlk).length + ')</button>' : '')
        : '<div class="card muted">' + (bl.length ? 'Tidak ada yang cocok.' : 'Belum ada.') + '</div>');
    box.innerHTML = '<div class="card"><div class="muted">' + (bl.length ? bl.length + ' blok · ' + set + ' sudah diatur arahnya · ' + conf + ' terkonfirmasi' : 'Belum ada blok.') + '</div></div>' +
      (S.settings.shiftBackup ? '<div class="card"><div class="muted">Blok terakhir digeser. Posisi lama masih tersimpan.</div><button class="btn" id="shUn" style="width:100%;margin-top:8px">Urungkan geser terakhir</button></div>' : '') +
      '<div class="h">IMPOR DARI LOGBOOK.HZ</div><div class="card">' +
      (ovs.length ? '<select id="lgOv">' + ovs.map(function (x) { return '<option value="' + x.i + '">' + esc(x.o.name) + '</option>'; }).join('') + '</select>' +
        '<button class="btn pri" id="lgGo" style="width:100%;margin-top:10px;height:48px">Pilih berkas blok (.json)</button><input type="file" id="lgFile" accept=".json,application/json" style="display:none">' +
        '<div class="muted" style="margin-top:8px">Berkas dibuat oleh tombol Ekspor blok di Logbook.HZ (tab Peta). Peta PDF yang dipilih harus gambar peta yang sama dengan yang dipakai di Logbook.HZ. Blok ditampilkan dulu untuk diperiksa. Hanya blok baru yang ditambahkan. Blok yang namanya sudah ada di HZ Trip dilewati dan tidak diubah sama sekali.</div>'
        : '<div class="muted">Belum ada peta PDF yang dikalibrasi. Tambahkan di tab PDF.</div>') + '</div>' +
      '<div class="h">JARAK ROW BAWAAN</div><div class="card"><div class="row"><input type="number" id="rwSp" step="0.05" min="0.5" max="5" value="' + (S.settings.rowSp || 1.5) + '"><span class="muted" style="padding:0 8px">m</span></div>' +
      '<div class="muted" style="margin-top:8px">Batas kedalaman cekungan (m)</div><input type="number" id="depT" step="0.1" min="0.1" max="3" value="' + (S.settings.depThr || 0.3) + '">' +
      '<div class="muted" style="margin-top:8px">Batas tinggi cembung (m)</div><input type="number" id="humpT" step="0.1" min="0.3" max="5" value="' + (S.settings.humpThr || 1) + '"></div>' +
      (bl.length ? '<div class="h">KONTUR TERSIMPAN</div><div class="card"><div class="muted" id="kcInfo">Memeriksa…</div>' +
        '<button class="btn" id="kcGo" style="width:100%;margin-top:10px;height:46px">Siapkan kontur semua blok</button>' +
        '<button class="btn" id="kcClr" style="width:100%;margin-top:8px">Bersihkan kontur tersimpan</button>' +
        '<div class="muted" style="margin-top:8px">Kontur dihitung sekali lalu disimpan. Selama bentuk blok, garis pedoman dan jarak row tidak berubah, hasilnya langsung tampil. Proses berjalan satu blok demi satu di latar dan bisa dihentikan.</div></div>' : '') +
      '<div class="h">DAFTAR BLOK</div>' + listHtml;
    function bq() { S.blkQ = $('bkQ').value.trim(); S.blkPg = 0; renderBlokTab(box); }
    if ($('bkQ')) { $('bkQ').onchange = bq; $('bkQb').onclick = bq; }
    if ($('bkPv')) $('bkPv').onclick = function () { S.blkPg = Math.max(0, (S.blkPg || 0) - 1); renderBlokTab(box); };
    if ($('bkNx')) $('bkNx').onclick = function () { S.blkPg = (S.blkPg || 0) + 1; renderBlokTab(box); };
    if ($('lgGo')) {
      $('lgGo').onclick = function () { $('lgFile').value = ''; $('lgFile').click(); };
      $('lgFile').onchange = function () { if (this.files && this.files[0]) importLoghz(this.files[0], +$('lgOv').value); };
    }
    if ($('kcGo')) kcWire(bl);
    $('rwSp').onchange = function () { var v = +this.value; if (v >= 0.5 && v <= 5) { S.settings.rowSp = v; saveSettings(); HA.RC.rows = {}; } };
    if ($('humpT')) $('humpT').onchange = function () { var v = +this.value; if (v >= 0.3 && v <= 5) { S.settings.humpThr = v; saveSettings(); HA.RC.dep = {}; } };
    $('depT').onchange = function () { var v = +this.value; if (v >= 0.1 && v <= 3) { S.settings.depThr = v; saveSettings(); HA.RC.dep = {}; } };
    if ($('bkList')) HA.lpList($('bkList'), 'blok', {
      items: fl.slice(pg * PG, pg * PG + PG).map(function (b) { return { id: b.id, title: b.name, sub: nf(blkHa(b), 1) + ' ha · ' + (b.dir == null ? 'arah belum diatur' : 'arah ' + Math.round(b.dir) + '° · ' + nf(blkSp(b), 2) + ' m') + ' · ' + blkStatusText(b) }; }),
      onTap: function (id) { var b = blockById(id); if (b) needMap(b.pts, function () { HA.map.fitBounds(L.latLngBounds(b.pts), { padding: [50, 50], maxZoom: 19 }); openBlockPop(b); }); },
      onEdit: function (id) { var b = blockById(id); if (b) needMap(b.pts, function () { openBlockEdit(b); }); },
      multi: [{ label: 'Geser', fn: function (ids) { var ok = ids.filter(function (i) { var b = blockById(i); return b && !b.conf; }); if (!ok.length) { toast('Blok terkonfirmasi tidak bisa digeser'); return; } if (ok.length < ids.length) toast((ids.length - ok.length) + ' blok terkonfirmasi dilewati'); HA.closeAll(); HA.shiftStart(ok); } }],
      delTitle: function (ids) { return ids.length === 1 ? 'Hapus blok ini?' : 'Hapus ' + ids.length + ' blok?'; },
      delMsg: function () { return 'Blok dihapus dari peta. Peta PDF tidak terpengaruh.'; },
      onDelete: function (ids) {
        var set = {}; ids.forEach(function (i) { set[i] = 1; });
        S.settings.blocks = blocksList().filter(function (b) { if (set[String(b.id)]) { HzBlok.cache.del(bid(b)); return false; } return true; });
        saveSettings(); closeBlockPop(); drawBlocks(); drawRows(); toast(ids.length + ' blok dihapus'); renderData();
      }
    });
    if ($('shUn')) $('shUn').onclick = function () { askConfirm('Urungkan geser?', 'Posisi blok yang tadi digeser dikembalikan seperti sebelum digeser. Perubahan bentuk setelahnya pada blok yang sama ikut hilang.', 'Urungkan', function () { HA.shiftUndo(); renderData(); }); };
    if ($('bkScan')) $('bkScan').onclick = function () { askConfirm('Hapus blok hasil deteksi?', bl.filter(isScanBlk).length + ' blok hasil deteksi otomatis dihapus. Blok dari Logbook.HZ dan blok gambar sendiri tidak terhapus.', 'Hapus', function () { toast(delScanBlocks() + ' blok dihapus'); renderData(); }); };
    if (false) $('bkAll').onclick = function () { askConfirm('Hapus semua blok?', bl.length + ' blok dihapus dari aplikasi. Peta PDF tidak terpengaruh.', 'Hapus', function () { S.settings.blocks = []; HA.RC.rows = {}; HA.RC.dep = {}; HzBlok.cache.clear(); saveSettings(); closeBlockPop(); drawBlocks(); drawRows(); renderData(); }); };
  }
  // siapkan kontur semua blok, satu per satu (latar), bisa dihentikan
  function kcInfo(n) { var e = $('kcInfo'); if (e) e.textContent = n + ' dari ' + blocksList().length + ' blok sudah dihitung kontur-nya.'; }
  function kcWire(bl) {
    HzBlok.cache.count().then(kcInfo);
    function lbl(t) { var e = $('kcGo'); if (e) e.textContent = t; }
    if (S.kcRun) lbl('Hentikan (' + S.kcRun.i + ' / ' + S.kcRun.n + ')');
    $('kcClr').onclick = function () { HzBlok.cache.clear().then(function () { HA.RC.rows = {}; HA.RC.dep = {}; kcInfo(0); drawRows(); toast('Kontur tersimpan dibersihkan'); }); };
    $('kcGo').onclick = function () {
      if (S.kcRun) { S.kcRun.stop = true; lbl('Menghentikan…'); return; }
      var run = S.kcRun = { stop: false, i: 0, n: bl.length, fail: 0, seqFail: 0 }, list = bl.slice();
      (function nx() {
        if (run.stop || run.i >= list.length || run.seqFail >= 5) {
          S.kcRun = null; lbl('Siapkan kontur semua blok');
          toast(run.seqFail >= 5 ? 'Dihentikan: data ketinggian tidak tersedia (butuh internet atau DEMNAS)' : (run.stop ? 'Dihentikan' : 'Selesai' + (run.fail ? ', ' + run.fail + ' blok gagal' : '')));
          HzBlok.cache.count().then(kcInfo); drawRows(); return;
        }
        var b = list[run.i++];
        lbl('Hentikan (' + run.i + ' / ' + run.n + ')');
        computeRows(b, 'kontur', true).then(function () { run.seqFail = 0; return computeDep(b, true).catch(function () {}); })
          .catch(function () { run.fail++; run.seqFail++; })
          .then(function () { if (run.i % 10 === 0) HzBlok.cache.count().then(kcInfo); setTimeout(nx, 0); });
      })();
    };
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
    // blok yang sudah ada di HZ Trip tidak pernah ditimpa: dilewati (nama dicocokkan tanpa spasi/huruf besar)
    function nk(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function sudahAda(r) { return !!r.name && blocksList().some(function (b) { return nk(b.name) === nk(r.name); }); }
    res.forEach(function (r) { r.exists = sudahAda(r); if (r.exists) r.on = false; });
    needMap(all, function () {
      if (HA.DM.closePanel) HA.DM.closePanel();
      closeBlockPop();
      var g = L.layerGroup().addTo(HA.map), bar = document.createElement('div'), polys = [];
      HA.DM.prev = true; bar.className = 'lkbar'; HA.map.getContainer().appendChild(bar); L.DomEvent.disableClickPropagation(bar);
      function cnt() { return res.filter(function (r) { return r.on; }).length; }
      function paint() { polys.forEach(function (pl, i) { pl.setStyle({ color: res[i].on ? '#FFD84D' : '#777', dashArray: res[i].on ? null : '4 4', fillOpacity: res[i].on ? 0.15 : 0.03 }); }); var ex = res.filter(function (r) { return r.exists; }).length; $('lkT').textContent = cnt() + ' blok baru dipilih' + (ex ? ', ' + ex + ' sudah ada (dilewati, tidak diubah)' : '') + '. Ketuk blok untuk batal pilih.'; $('dpSave').textContent = 'Simpan (' + cnt() + ')'; }
      bar.innerHTML = '<span id="lkT"></span><button type="button" id="dpSave" class="pri">Simpan</button><button type="button" id="dpAgain">Ulang</button><button type="button" id="dpNo">Batal</button>';
      res.forEach(function (r, i) { var pl = L.polygon(r.pts, { weight: 2, interactive: true }).addTo(g); if (r.name) pl.bindTooltip(esc(r.name) + (r.exists ? ' · sudah ada' : ''), { permanent: true, direction: 'center', className: 'lktip' }); pl.on('click', function (e) { L.DomEvent.stop(e); if (r.exists) { toast('Blok ini sudah ada di HZ Trip dan tidak diubah'); return; } r.on = !r.on; paint(); }); polys.push(pl); });
      function end() { g.remove(); bar.remove(); HA.DM.prev = false; }
      $('dpSave').onclick = function () {
        var n = nextBlockNo(), k = 0, up = 0;
        res.forEach(function (r) {
          if (!r.on) return;
          if (sudahAda(r)) { up++; return; }
          blocksList().push({ id: Date.now() + k, src: r.name ? 'loghz' : 'scan', name: r.name || 'Blok ' + (n + k), pts: r.pts, ovId: o.id, dir: null, sp: null, margin: 0, conf: false, note: '', luasCat: r.luas || null }); k++;
        });
        HA.RC.rows = {}; HA.RC.dep = {}; HA.RC.guide = {};
        S.settings.blkOn = true; saveSettings(); end(); drawBlocks(); drawRows(); toast(k + ' blok baru disimpan' + (up || res.some(function (r) { return r.exists; }) ? ', ' + (up + res.filter(function (r) { return r.exists; }).length) + ' sudah ada (dilewati)' : '')); S.dpTab = 'blok'; go('data');
        var old = blocksList().filter(isScanBlk).length;
        if (old && res.some(function (r) { return r.name; })) setTimeout(function () { askConfirm('Hapus ' + old + ' blok hasil deteksi lama?', 'Blok hasil deteksi otomatis (Blok 1, 2, …) bertumpuk dengan blok dari Logbook.HZ. Blok dari Logbook dan blok yang kamu gambar sendiri tidak terhapus.', 'Hapus', function () { toast(delScanBlocks() + ' blok deteksi dihapus'); renderData(); }); }, 400);
      };
      $('dpAgain').onclick = function () { end(); S.dpTab = 'blok'; go('data'); };
      $('dpNo').onclick = end;
      paint();
    });
  }
})();
