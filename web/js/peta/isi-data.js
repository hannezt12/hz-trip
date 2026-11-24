/* HZ Trip - Isi data per master: layar ringan untuk mengisi Varietas, Status tanaman dan Bulan tanam banyak blok sekaligus. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function esc(t) { return HA.esc(t); }
  function fh(v) { return v.toFixed(2).replace('.', ','); }

  function svg(p) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
  var ICO = {
    vr: svg('<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>'),
    um: svg('<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>'),
    st: svg('<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/>'),
    lay: svg('<path d="M12 2.5l9 4.8-9 4.8-9-4.8z"/><path d="M3 12l9 4.8 9-4.8"/><path d="M3 16.7l9 4.8 9-4.8"/>'),
    ed: svg('<path d="M3 21l1.2-4.2L14.5 6.5l3 3L7.2 19.8z"/><path d="M19 3v5M16.5 5.5h5"/>'),
    sh: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>')
  };
  var MS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function fgOf(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return '#fff'; var n = parseInt(m[1], 16), l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 150 ? '#000' : '#fff'; }

  function open(m, back, opts) {
    if (!HA.lyb || !HA.masterMembers) return;
    var mem = HA.masterMembers(m), list = mem.in.concat(mem.man, mem.pend), pendSet = {};
    mem.pend.forEach(function (b) { pendSet[b.id] = 1; });
    if (!list.length) { HA.toast('Belum ada blok Terkonfirmasi di master ini'); return; }
    var old = document.getElementById('idEd'); if (old) old.remove();
    var va = HA.lyb.by('varietas'), st = HA.lyb.by('status'), BN = HA.lyb.BN;
    // geometri datar (meter-ish)
    var la0 = 0, n0 = 0; list.forEach(function (b) { b.pts.forEach(function (p) { la0 += p[0]; n0++; }); }); la0 /= n0;
    var kx = Math.cos(la0 * Math.PI / 180), G = list.map(function (b) {
      var q = b.pts.map(function (p) { return [p[1] * kx * 111320, -p[0] * 110540]; }), x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18;
      q.forEach(function (v) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); });
      return { b: b, q: q, x0: x0, x1: x1, y0: y0, y1: y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    });
    var BX0 = 1e18, BX1 = -1e18, BY0 = 1e18, BY1 = -1e18; G.forEach(function (g) { BX0 = Math.min(BX0, g.x0); BX1 = Math.max(BX1, g.x1); BY0 = Math.min(BY0, g.y0); BY1 = Math.max(BY1, g.y1); });
    var HS = (function () { var a = G.map(function (g) { return Math.min(g.x1 - g.x0, g.y1 - g.y0); }).sort(function (x, y) { return x - y; }); return Math.max(2, a[Math.floor(a.length / 2)] / 8); })();
    var byId = {}; list.forEach(function (b) { byId[b.id] = b; });
    var ch = {}, hist = ['{}'], hi = 0, sel = {}, mode = 'tap', lay = { v: true, s: true, t: true }, view = !!(opts && opts.mode === 'lihat'), LS = S.settings.lihat || {}, fillM = LS.fill === 'umur' ? 'umur' : 'var', V = { s: 1, tx: 0, ty: 0 }, rect = null;
    var VF = { s: LS.s !== false, t: LS.t !== false, n: LS.n !== false, j: !!LS.j }, F = { v: {}, u: {}, s: {} }, openP = null, infoId = null, accOpen = false, AH = {};
    var LN = []; (HA.linesList ? HA.linesList() : []).forEach(function (ln) { var q = (ln.pts || []).map(function (p) { return [p[1] * kx * 111320, -p[0] * 110540]; }); if (q.some(function (p) { return p[0] > BX0 - 40 && p[0] < BX1 + 40 && p[1] > BY0 - 40 && p[1] < BY1 + 40; })) LN.push({ q: q, t: ln.type, w: +ln.w || 2 }); });
    list.forEach(function (b) { AH[b.id] = window.HzBlok && HzBlok.areaHa ? HzBlok.areaHa(b.pts) : 0; });
    var el = document.createElement('div'); el.id = 'idEd'; el.className = 'idEd' + (view ? ' idv' : '');
    el.innerHTML = '<div class="idh"><div class="seg idvo" id="idFs"><button data-f="var">' + ICO.vr + '<span>Varietas</span></button><button data-f="umur">' + ICO.um + '<span>Umur</span></button></div><button class="btn sm idvo" id="idAcB" aria-label="Lapisan">' + ICO.lay + '<span>Lapisan ▾</span></button><b class="idt idev">Isi data · ' + esc(m.name) + '</b><span class="idvo" style="flex:1"></span><button class="ib idx" id="idBk" aria-label="Tutup">' + ICO.x + '</button></div>' +
      '<div class="idb idev"><div class="seg" id="idMd"><button data-m="tap" class="on">Ketuk</button><button data-m="area">Area</button></div><button class="btn sm" id="idBl">Belum diisi</button><input type="text" id="idQ" placeholder="Nama blok…" style="flex:1;min-width:0"><button class="btn sm" id="idQb">Pilih</button>' + (opts && opts.mode ? '<button class="btn sm" id="idVw">Lihat</button>' : '') + '</div>' +
      '<div class="idc" id="idC"><canvas id="idCv"></canvas><div class="idn" id="idN"></div>' +
      '<div class="idac idvo" id="idAc" style="display:none"><label><input type="checkbox" data-k="s"> Status</label><label><input type="checkbox" data-k="t"> Bulan tanam</label><label><input type="checkbox" data-k="n"> Nomor blok</label><label><input type="checkbox" data-k="j"> Jalan &amp; drainase</label></div>' +
      '<div class="idtabs idvo" id="idTb"><button class="locbtn idtab" data-k="um" aria-label="Umur">' + ICO.um + '<i class="idtx" data-x="um"></i></button><button class="locbtn idtab" data-k="var" aria-label="Varietas">' + ICO.vr + '<i class="idtx" data-x="var"></i></button><button class="locbtn idtab" data-k="st" aria-label="Status">' + ICO.st + '<i class="idtx" data-x="st"></i></button></div>' +
      '<div class="idpn idvo" id="idPl" style="display:none"><div class="idplh"><b id="idPt"></b><button class="ib" id="idPx" aria-label="Tutup panel">' + ICO.x + '</button></div><div class="idpsm" id="idPs"></div><div class="idpls" id="idPr"></div></div>' +
      '<div class="idfab idvo" id="idFab"><button class="locbtn" id="idEdt" aria-label="Isi data">' + ICO.ed + '</button><button class="locbtn" id="idBg" aria-label="Bagikan">' + ICO.sh + '</button></div></div>' +
      '<div class="idbt idvo" id="idBt"></div>' +
      '<div class="idl idev"><label><input type="checkbox" id="idLv" checked> Varietas</label><label><input type="checkbox" id="idLs" checked> Status</label><label><input type="checkbox" id="idLt" checked> Bulan tanam</label></div>' +
      '<div class="idf idev"><button class="btn sm" id="idNo">Kosongkan pilihan</button><button class="btn pri" id="idGo" style="flex:1">Isi data (0)</button></div>' +
      '<details class="idd idev"><summary>RINGKASAN (ha)</summary><div id="idT"></div></details>' +
      '<div class="idin idvo" id="idIn"></div>';
    document.body.appendChild(el);
    var $e = function (id) { return el.querySelector('#' + id); }, cv = $e('idCv'), C = $e('idC'), ctx = cv.getContext('2d'), DPR = window.devicePixelRatio || 1;
    function cl(o) { return JSON.parse(JSON.stringify(o)); }
    function eff(b) {
      var c = ch[b.id], ly = {}, k; for (k in (b.ly || {})) ly[k] = b.ly[k];
      if (c) { if (c.v !== undefined) { if (c.v) ly.varietas = c.v; else delete ly.varietas; } if (c.s !== undefined) { if (c.s) ly.status = c.s; else delete ly.status; } }
      return { id: b.id, name: b.name, pts: b.pts, ly: ly, tn: c && c.t !== undefined ? c.t : b.tn };
    }
    var E = {}; function reff() { E = {}; list.forEach(function (b) { E[b.id] = eff(b); }); }
    function nSel() { return Object.keys(sel).length; }
    function dirty() { return Object.keys(ch).length > 0; }
    function fit() { var w = C.clientWidth, h = C.clientHeight, s = Math.min((w - 16) / Math.max(1, BX1 - BX0), (h - 16) / Math.max(1, BY1 - BY0)); V.f = s; V.s = s; V.tx = (w - (BX1 - BX0) * s) / 2 - BX0 * s; V.ty = (h - (BY1 - BY0) * s) / 2 - BY0 * s; }
    function clampV() {
      var w = C.clientWidth, h = C.clientHeight, M = 0.2, mw = (BX1 - BX0) * V.s, mh = (BY1 - BY0) * V.s, a, lo, hi;
      lo = (1 - M) * w - mw; hi = M * w; a = BX0 * V.s + V.tx; a = lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, a)); V.tx = a - BX0 * V.s;
      lo = (1 - M) * h - mh; hi = M * h; a = BY0 * V.s + V.ty; a = lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, a)); V.ty = a - BY0 * V.s;
    }
    function size() { var w = C.clientWidth, h = C.clientHeight; cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    var PC = {};
    function pattern(pat, col, ps) {
      if (!pat || pat === 'none') return null; var T = Math.max(4, Math.min(80, Math.round(HS * V.s * (ps > 0 ? ps : 1)))), k = pat + col + T; if (PC[k] !== undefined) return PC[k];
      var c = document.createElement('canvas'); c.width = c.height = T; var x = c.getContext('2d'); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = Math.max(1.2, T / 7);
      if (pat === 'd1' || pat === 'x') { x.beginPath(); x.moveTo(0, T); x.lineTo(T, 0); x.stroke(); }
      if (pat === 'd2' || pat === 'x') { x.beginPath(); x.moveTo(0, 0); x.lineTo(T, T); x.stroke(); }
      if (pat === 'h') { x.beginPath(); x.moveTo(0, T / 2); x.lineTo(T, T / 2); x.stroke(); }
      if (pat === 'v') { x.beginPath(); x.moveTo(T / 2, 0); x.lineTo(T / 2, T); x.stroke(); }
      if (pat === 'dot') { x.beginPath(); x.arc(T / 2, T / 2, Math.max(1, T / 6), 0, 7); x.fill(); }
      return (PC[k] = ctx.createPattern(c, 'repeat'));
    }
    function sym(x, y, r, sy) {
      if (!sy) return; ctx.save(); ctx.lineWidth = Math.max(1.5, r * 0.35); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#000';
      function dot(a, b) { ctx.beginPath(); ctx.arc(a, b, r * 0.3, 0, 7); ctx.stroke(); ctx.fill(); }
      if (sy === 'P+') { ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.5; ctx.beginPath(); ctx.moveTo(x - r * 0.42, y); ctx.lineTo(x + r * 0.42, y); ctx.moveTo(x, y - r * 0.42); ctx.lineTo(x, y + r * 0.42); ctx.stroke(); ctx.strokeStyle = '#d32f2f'; ctx.lineWidth = r * 0.3; ctx.stroke(); }
      else if (sy === 'R1') dot(x, y); else if (sy === 'R2') { dot(x - r * .45, y); dot(x + r * .45, y); } else if (sy === 'R3') { dot(x - r * .7, y); dot(x, y); dot(x + r * .7, y); }
      else if (sy === 'D4') { dot(x - r * .4, y - r * .4); dot(x + r * .4, y - r * .4); dot(x - r * .4, y + r * .4); dot(x + r * .4, y + r * .4); }
      else if (sy === 'D5') { dot(x - r * .5, y - r * .5); dot(x + r * .5, y - r * .5); dot(x, y); dot(x - r * .5, y + r * .5); dot(x + r * .5, y + r * .5); }
      else { ctx.font = 'bold ' + (r * 1.6) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.strokeText(sy, x, y); ctx.fillText(sy, x, y); }
      ctx.restore();
    }
    var raf = 0; function draw() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; paint(); }); }
    function paint() {
      var w = cv.width, h = cv.height; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#f3efe2'; ctx.fillRect(0, 0, w, h); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var cw = C.clientWidth, chh = C.clientHeight;
      G.forEach(function (g) {
        var sx0 = g.x0 * V.s + V.tx, sx1 = g.x1 * V.s + V.tx, sy0 = g.y0 * V.s + V.ty, sy1 = g.y1 * V.s + V.ty; if (sx1 < 0 || sy1 < 0 || sx0 > cw || sy0 > chh) return;
        var e = E[g.b.id], vi = (view ? fillM : 'var') === 'var' && lay.v && va ? HA.lyb.of(e, 'varietas') : null, ub = view && fillM === 'umur' ? HA.lyb.umBucket(e) : -1, fd = view && fAny() && !fMatch(e), si = (view ? VF.s : lay.s) && st ? HA.lyb.of(e, 'status') : null, mo = (view ? VF.t : lay.t) ? HA.lyb.bulanOf(e) : 0; ctx.globalAlpha = fd ? 0.22 : 1;
        ctx.beginPath(); g.q.forEach(function (p, i) { var X = p[0] * V.s + V.tx, Y = p[1] * V.s + V.ty; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath();
        ctx.fillStyle = vi ? (vi.col || '#999') : (ub >= 0 ? HA.lyb.umCol(ub) : '#e8e2d0'); ctx.fill();
        if (vi && vi.pat && vi.pat !== 'none') { var pt = pattern(vi.pat, vi.pc || '#000000', vi.ps); if (pt) { ctx.fillStyle = pt; ctx.fill(); } }
        if (sel[g.b.id]) { ctx.fillStyle = 'rgba(33,120,255,.35)'; ctx.fill(); }
        ctx.lineJoin = 'round'; ctx.strokeStyle = mo ? HA.lyb.bulanCol(mo) : '#555'; ctx.lineWidth = mo ? 3.5 : 0.8; if (pendSet[g.b.id]) ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
        if (sel[g.b.id]) { ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 2; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); }
        var bw = sx1 - sx0, bh = sy1 - sy0, cx = g.cx * V.s + V.tx, cy = g.cy * V.s + V.ty;
        if (si && bw > 16 && bh > 16) sym(cx, cy + (bw > 44 ? 6 : 0), Math.min(10, bw / 4), si.sym);
        if ((view ? VF.n : true) && bw > 40 && bh > 22) { ctx.font = '600 ' + Math.min(13, bw / 6) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#1f4e9e'; ctx.strokeText(String(g.b.name), cx, cy - 8); ctx.fillText(String(g.b.name), cx, cy - 8); }
        ctx.globalAlpha = 1;
      });
      if (view && VF.j) { ctx.lineJoin = 'round'; ctx.lineCap = 'butt'; LN.forEach(function (l) { ctx.strokeStyle = l.t === 'drain' ? '#2b8fd6' : '#b9a36b'; ctx.globalAlpha = 0.9; ctx.lineWidth = Math.max(1.2, l.w * V.s); ctx.beginPath(); l.q.forEach(function (p, i) { var X = p[0] * V.s + V.tx, Y = p[1] * V.s + V.ty; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); }); ctx.globalAlpha = 1; }
      if (rect) { ctx.strokeStyle = '#1565c0'; ctx.fillStyle = 'rgba(21,101,192,.15)'; ctx.lineWidth = 1.5; ctx.fillRect(Math.min(rect.x0, rect.x1), Math.min(rect.y0, rect.y1), Math.abs(rect.x1 - rect.x0), Math.abs(rect.y1 - rect.y0)); ctx.strokeRect(Math.min(rect.x0, rect.x1), Math.min(rect.y0, rect.y1), Math.abs(rect.x1 - rect.x0), Math.abs(rect.y1 - rect.y0)); }
    }
    function inPoly(px, py, q) { var ins = false, i, j; for (i = 0, j = q.length - 1; i < q.length; j = i++) { if ((q[i][1] > py) !== (q[j][1] > py) && px < (q[j][0] - q[i][0]) * (py - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) ins = !ins; } return ins; }
    function hit(sx, sy) { var wx = (sx - V.tx) / V.s, wy = (sy - V.ty) / V.s, i; for (i = G.length - 1; i >= 0; i--) { var g = G[i]; if (wx < g.x0 || wx > g.x1 || wy < g.y0 || wy > g.y1) continue; if (inPoly(wx, wy, g.q)) return g.b; } return null; }
    function info() {
      $e('idGo').textContent = 'Isi data (' + nSel() + ')'; var one = nSel() === 1 ? byId[Object.keys(sel)[0]] : null; $e('idN').textContent = (one ? one.name + ' · ' + (HA.lyb.txt(one) || 'belum diisi') + ' · ' : '') + nSel() + ' dipilih dari ' + list.length + ' blok' + (mem.pend.length ? ' · garis putus = perbatasan belum diputuskan' : '');
    }
    function tables() {
      reff(); var D = HA.ktData(list.map(function (b) { return E[b.id]; }), { tabs: ['var', 'bt', 'st'] }), h = '';
      D.tabs.forEach(function (t) {
        h += '<div class="idtt">' + esc(t.title) + '</div><table class="idtb"><tr><th>Nama</th>' + (t.kind === 'pcrc' ? '<th>PC</th><th>RC</th><th>Total</th><th>%</th>' : '<th>ha</th><th>%</th>') + '</tr>';
        t.rows.forEach(function (g) { var pc = g.tot ? g.tot / D.tot * 100 : 0; h += '<tr><td>' + esc(g.r.name) + '</td>' + (t.kind === 'pcrc' ? '<td>' + (g.pc ? fh(g.pc) : '-') + '</td><td>' + (g.rc ? fh(g.rc) : '-') + '</td>' : '') + '<td>' + fh(g.tot) + '</td><td>' + fh(pc) + '</td></tr>'; });
        h += '</table>';
      });
      $e('idT').innerHTML = h + '<div class="muted" style="margin-top:6px">Total ' + fh(D.tot) + ' ha</div>';
    }
    function refresh() { reff(); info(); if (view) btRender(); draw(); }
    var tt = 0; function tabLater() { clearTimeout(tt); tt = setTimeout(tables, 150); }
    function commit() { var j = JSON.stringify(ch); if (j === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(j); hi = hist.length - 1; refresh(); tabLater(); }
    // gestur
    var ptr = {}, g0 = null;
    function np() { return Object.keys(ptr).length; }
    function d2() { var k = Object.keys(ptr), a = ptr[k[0]], b = ptr[k[1]]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
    function pos(e) { var r = C.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    C.addEventListener('pointerdown', function (e) {
      var p = pos(e); ptr[e.pointerId] = p; try { C.setPointerCapture(e.pointerId); } catch (er) {}
      if (np() === 1) { g0 = { m: mode, sx: p.x, sy: p.y, tx: V.tx, ty: V.ty, moved: false }; if (mode === 'area') rect = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; }
      else if (np() === 2) { var q = d2(); g0 = { m: 'zoom', d: q.d, s: V.s, mx: q.mx, my: q.my, tx: V.tx, ty: V.ty }; rect = null; draw(); }
    });
    C.addEventListener('pointermove', function (e) {
      if (!ptr[e.pointerId] || !g0) return; var p = pos(e); ptr[e.pointerId] = p;
      if (g0.m === 'zoom' && np() >= 2) { var q = d2(), ns = Math.min((V.f || 1) * 40, Math.max((V.f || 0.05) * 0.8, g0.s * q.d / g0.d)), wx = (g0.mx - g0.tx) / g0.s, wy = (g0.my - g0.ty) / g0.s; V.s = ns; V.tx = q.mx - wx * ns; V.ty = q.my - wy * ns; clampV(); draw(); return; }
      if (np() !== 1) return; var dx = p.x - g0.sx, dy = p.y - g0.sy; if (Math.abs(dx) + Math.abs(dy) > 5) g0.moved = true;
      if (g0.m === 'tap') { if (g0.moved) { V.tx = g0.tx + dx; V.ty = g0.ty + dy; clampV(); draw(); } }
      else if (g0.m === 'area') { rect.x1 = p.x; rect.y1 = p.y; draw(); }
    });
    function up(e) {
      var p = pos(e); if (!ptr[e.pointerId]) return; delete ptr[e.pointerId]; if (!g0) return;
      if (g0.m === 'zoom') { if (np() < 2) { g0 = null; ptr = {}; } return; }
      if (g0.m === 'tap' && !g0.moved) { var b = hit(p.x, p.y); if (b) { if (view) { if (!infoId) openInfo(b.id); } else if (sel[b.id]) delete sel[b.id]; else sel[b.id] = 1; info(); draw(); } }
      else if (g0.m === 'area' && rect) {
        if (Math.abs(rect.x1 - rect.x0) < 6 && Math.abs(rect.y1 - rect.y0) < 6) { var b2 = hit(p.x, p.y); if (b2) { if (sel[b2.id]) delete sel[b2.id]; else sel[b2.id] = 1; } }
        else { var xa = (Math.min(rect.x0, rect.x1) - V.tx) / V.s, xb = (Math.max(rect.x0, rect.x1) - V.tx) / V.s, ya = (Math.min(rect.y0, rect.y1) - V.ty) / V.s, yb = (Math.max(rect.y0, rect.y1) - V.ty) / V.s; G.forEach(function (g) { if (g.cx >= xa && g.cx <= xb && g.cy >= ya && g.cy <= yb) sel[g.b.id] = 1; }); }
        rect = null; info(); draw();
      }
      g0 = null;
    }
    C.addEventListener('pointerup', up); C.addEventListener('pointercancel', up);
    // kontrol
    $e('idMd').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-m]'); if (!b) return; mode = b.getAttribute('data-m'); el.querySelectorAll('#idMd button').forEach(function (x) { x.classList.toggle('on', x === b); }); };
    ['v', 's', 't'].forEach(function (k) { $e('idL' + k).onchange = function () { lay[k] = this.checked; draw(); }; });
    $e('idBl').onclick = function () { var n = 0; list.forEach(function (b) { var e = E[b.id]; if (!HA.lyb.of(e, 'varietas') || !HA.lyb.of(e, 'status') || !HA.lyb.bulanOf(e)) { sel[b.id] = 1; n++; } }); info(); draw(); HA.toast(n ? n + ' blok belum lengkap dipilih' : 'Semua blok sudah lengkap'); };
    $e('idQb').onclick = function () { var q = $e('idQ').value.trim().toLowerCase(), n = 0; if (!q) return; list.forEach(function (b) { if (String(b.name).toLowerCase().indexOf(q) >= 0) { sel[b.id] = 1; n++; } }); info(); draw(); HA.toast(n + ' blok dipilih'); };
    var FK = { var: 'v', um: 'u', st: 's' }, TT = { var: 'Varietas', um: 'Umur', st: 'Status tanaman' };
    function fN(k) { return Object.keys(F[FK[k]]).length; }
    function fAny() { return fN('var') + fN('um') + fN('st') > 0; }
    function fMatch(e, skip) {
      var v, u, t;
      if (skip !== 'var' && fN('var')) { v = HA.lyb.of(e, 'varietas'); if (!v || !F.v[v.id]) return false; }
      if (skip !== 'um' && fN('um')) { u = HA.lyb.umBucket(e); if (u < 0 || !F.u[u]) return false; }
      if (skip !== 'st' && fN('st')) { t = HA.lyb.of(e, 'status'); if (!t || !F.s[t.id]) return false; }
      return true;
    }
    function saveL() { S.settings.lihat = { fill: fillM, s: VF.s, t: VF.t, n: VF.n, j: VF.j }; HA.saveSettings(); }
    function syncCb() {
      el.querySelectorAll('#idFs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === fillM); });
      el.querySelectorAll('#idAc input').forEach(function (c) { c.checked = !!VF[c.getAttribute('data-k')]; });
      el.querySelectorAll('.idtab').forEach(function (b) { var k = b.getAttribute('data-k'); b.classList.toggle('on', fN(k) > 0); b.classList.toggle('op', openP === k); });
    }
    function bha(b) { return AH[b.id] || 0; }
    function btRender() {
      var n = 0, ha = 0, ta = 0; list.forEach(function (b) { ta += bha(b); if (!fAny() || fMatch(E[b.id])) { n++; ha += bha(b); } });
      $e('idBt').innerHTML = (fAny() ? '<b>' + n + ' dari ' + list.length + ' blok</b> · ' + fh(ha) + ' ha cocok' : '<b>' + esc(m.name) + '</b> · ' + list.length + ' blok · ' + fh(ta) + ' ha') + '<span style="flex:1"></span><span class="muted">Rincian ▴</span>';
    }
    function keyOf(k, e) { if (k === 'var') { var v = HA.lyb.of(e, 'varietas'); return v ? v.id : null; } if (k === 'st') { var t = HA.lyb.of(e, 'status'); return t ? t.id : null; } var u = HA.lyb.umBucket(e); return u < 0 ? null : u; }
    function plRender() {
      var k = openP, pl = $e('idPl'); if (!k) { pl.style.display = 'none'; syncCb(); return; }
      var cnt = {}, rows = [], Fm = F[FK[k]], names = [];
      var oth = ['var', 'um', 'st'].some(function (x) { return x !== k && fN(x) > 0; });
      list.forEach(function (b) { if (!fMatch(E[b.id], k)) return; var kk = keyOf(k, E[b.id]); if (kk !== null) cnt[kk] = (cnt[kk] || 0) + 1; });
      if (k === 'var' && va) rows = va.items.map(function (x) { return { key: x.id, label: x.name, col: x.col || '#999', n: cnt[x.id] || 0 }; });
      else if (k === 'um') { var L = HA.lyb.umLabels(); rows = [0, 1, 2, 3, 4].map(function (i) { return { key: String(i), label: L[i], col: HA.lyb.umCol(i), n: cnt[i] || 0 }; }); }
      else if (k === 'st' && st) rows = st.items.map(function (x) { return { key: x.id, label: x.name, it: x, n: cnt[x.id] || 0 }; });
      rows.forEach(function (r) { if (Fm[r.key]) names.push(r.label); });
      if (oth) rows = rows.filter(function (r) { return r.n > 0 || Fm[r.key]; });
      $e('idPt').innerHTML = ICO[k === 'var' ? 'vr' : k] + ' ' + esc(TT[k]);
      $e('idPs').innerHTML = '<span>' + (names.length ? '<b>Terpilih:</b> ' + esc(names.join(', ')) : 'Ketuk untuk memfilter blok') + '</span>' + (names.length ? '<button class="btn sm" id="idPc" aria-label="Kosongkan pilihan">✕</button>' : '');
      $e('idPr').innerHTML = rows.map(function (r) {
        var bx = r.it ? '<div class="idpb" style="background:var(--card2,#2a2f3a)"><span style="display:flex;align-items:center;gap:6px">' + HA.lyb.prevSvg(st, r.it) + esc(r.label) + '</span><small>' + r.n + '</small></div>' : '<div class="idpb" style="background:' + r.col + ';color:' + fgOf(r.col) + '"><span>' + esc(r.label) + '</span><small>' + r.n + '</small></div>';
        return '<div class="idpw" data-key="' + esc(String(r.key)) + '"><span class="iddot' + (Fm[r.key] ? ' on' : '') + '"></span>' + bx + '</div>';
      }).join('') || '<div class="muted" style="padding:8px">Belum ada isi.</div>';
      pl.style.display = 'flex'; syncCb();
    }
    function openPanel(k) { if (infoId) return; openP = k; $e('idAc').style.display = 'none'; accOpen = false; plRender(); }
    function closePanel() { openP = null; plRender(); }
    function filt() { syncCb(); btRender(); draw(); if (openP) plRender(); }
    $e('idPr').onclick = function (e) { var w = e.target.closest && e.target.closest('.idpw'); if (!w || !openP) return; var key = w.getAttribute('data-key'), Fm = F[FK[openP]]; if (Fm[key]) delete Fm[key]; else Fm[key] = 1; filt(); };
    $e('idPs').onclick = function (e) { if (e.target.closest && e.target.closest('#idPc') && openP) { F[FK[openP]] = {}; filt(); } };
    $e('idPx').onclick = closePanel;
    // tiga tombol kanan: 1x = jadi 100% dan bisa digeser, 2x atau geser ke kiri = buka panel
    var tabT = 0, lastTap = { k: '', t: 0 }, solK = null;
    function solid(k) { solK = k; el.querySelectorAll('.idtab').forEach(function (b) { b.classList.toggle('sol', b.getAttribute('data-k') === k); }); clearTimeout(tabT); if (k) tabT = setTimeout(function () { solid(null); }, 4000); }
    el.querySelectorAll('.idtab').forEach(function (b) {
      var k = b.getAttribute('data-k'), x0 = 0, dn = false, did = false;
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); dn = true; did = false; x0 = e.clientX; try { b.setPointerCapture(e.pointerId); } catch (er) {} });
      b.addEventListener('pointermove', function (e) { if (!dn || did) return; if (e.clientX - x0 < -22) { did = true; solid(k); openPanel(k); } });
      b.addEventListener('pointerup', function (e) {
        e.stopPropagation(); if (!dn) return; dn = false; if (did) return;
        var hz = document.elementFromPoint(e.clientX, e.clientY); if (hz && hz.closest && hz.closest('.idtx') && b.classList.contains('on')) { F[FK[k]] = {}; filt(); return; }
        var now = Date.now(); if (lastTap.k === k && now - lastTap.t < 420) { lastTap = { k: '', t: 0 }; solid(k); openPanel(k); } else { lastTap = { k: k, t: now }; solid(k); }
      });
      b.addEventListener('pointercancel', function () { dn = false; });
    });
    ['idTb', 'idPl', 'idFab', 'idAc'].forEach(function (id) { $e(id).addEventListener('pointerdown', function (e) { e.stopPropagation(); }); });
    // akordion lapisan
    $e('idAcB').onclick = function () { if (infoId) return; accOpen = !accOpen; $e('idAc').style.display = accOpen ? 'flex' : 'none'; if (accOpen && openP) closePanel(); };
    $e('idAc').onchange = function (e) { var c = e.target, k = c.getAttribute && c.getAttribute('data-k'); if (!k) return; VF[k] = c.checked; if (k === 's' && !c.checked) F.s = {}; saveL(); filt(); };
    $e('idFs').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-f]'); if (!b) return; fillM = b.getAttribute('data-f'); saveL(); syncCb(); draw(); };
    // panel informasi bawah
    function infoRows(b) {
      var e = E[b.id], v = HA.lyb.of(e, 'varietas'), t = HA.lyb.of(e, 'status'), um = HA.lyb.umurM(e), tn = /^(\d{4})-(\d{2})$/.exec(e.tn || '');
      return [['No blok', b.name], ['Luas', fh(bha(b)) + ' ha'], ['Varietas', v ? v.name : '-'], ['Status', t ? t.name : '-'], ['Umur', um >= 0 ? um + ' bulan' : '-'], ['Bulan tanam', tn ? MS3[+tn[2] - 1] + ' ' + tn[1] : '-']];
    }
    function infoRender() {
      var box = $e('idIn'), h;
      if (infoId === 'sum') {
        var rs = list.filter(function (b) { return !fAny() || fMatch(E[b.id]); });
        h = '<div class="idinh"><b>' + (fAny() ? rs.length + ' dari ' + list.length + ' blok cocok' : esc(m.name) + ' · ' + list.length + ' blok') + '</b><button class="ib" id="idIx" aria-label="Tutup">' + ICO.x + '</button></div><div style="overflow-x:auto"><table class="idtb"><tr><th>Blok</th><th>ha</th><th>Varietas</th><th>Status</th><th>Umur</th><th>Tanam</th></tr>' +
          rs.map(function (b) { var r = infoRows(b); return '<tr><td>' + esc(String(r[0][1])) + '</td><td>' + fh(bha(b)) + '</td><td>' + esc(r[2][1]) + '</td><td>' + esc(r[3][1]) + '</td><td>' + esc(r[4][1].replace(' bulan', ' bln')) + '</td><td>' + esc(r[5][1]) + '</td></tr>'; }).join('') + '</table></div>';
      } else {
        var b = byId[infoId]; h = '<div class="idinh"><b>Blok ' + esc(String(b.name)) + '</b><button class="ib" id="idIx" aria-label="Tutup">' + ICO.x + '</button></div>' + infoRows(b).map(function (r) { return '<div class="idkv"><span class="muted">' + esc(r[0]) + '</span><b>' + esc(String(r[1])) + '</b></div>'; }).join('');
      }
      box.innerHTML = h; box.style.display = 'block'; box.querySelector('#idIx').onclick = closeInfo;
    }
    function openInfo(id) { infoId = id; closePanel(); accOpen = false; $e('idAc').style.display = 'none'; sel = {}; if (id !== 'sum') sel[id] = 1; el.classList.add('idlock'); infoRender(); draw(); }
    function closeInfo() { infoId = null; sel = {}; el.classList.remove('idlock'); $e('idIn').style.display = 'none'; draw(); }
    $e('idBt').onclick = function () { if (!infoId) openInfo('sum'); };
    function applyV() { el.classList.toggle('idv', view); if (!view) { if (infoId) closeInfo(); openP = null; plRender(); accOpen = false; $e('idAc').style.display = 'none'; } mode = 'tap'; el.querySelectorAll('#idMd button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-m') === 'tap'); }); size(); fit(); if (view) { reff(); btRender(); syncCb(); if (openP) plRender(); } draw(); }
    function toView() { view = true; sel = {}; applyV(); info(); }
    if (view) { syncCb(); btRender(); }
    $e('idEdt').onclick = function () { if (infoId) return; view = false; sel = {}; applyV(); info(); };
    if ($e('idVw')) $e('idVw').onclick = function () { if (dirty()) { HA.toast('Simpan atau buang perubahan dulu'); return; } toView(); };
    $e('idBg').onclick = function () { if (infoId) return; if (HA.shareLihat) HA.shareLihat(m, { fill: fillM, s: VF.s, t: VF.t, n: VF.n, j: VF.j }); };
    $e('idNo').onclick = function () { sel = {}; info(); draw(); };
    function dlg(html, wire) { var q = document.createElement('div'); q.className = 'lyq'; q.innerHTML = '<div class="lyqc">' + html + '</div>'; el.appendChild(q); wire(q, function () { q.remove(); }); }
    $e('idGo').onclick = function () {
      if (!nSel()) { HA.toast('Pilih blok dulu'); return; }
      var cur = { v: {}, s: {}, t: {} }, ids0 = Object.keys(sel);
      ids0.forEach(function (id) { var b = byId[id], vv = (b.ly || {}).varietas || '', ss = (b.ly || {}).status || '', tt = b.tn || ''; cur.v[vv] = (cur.v[vv] || 0) + 1; cur.s[ss] = (cur.s[ss] || 0) + 1; cur.t[tt] = (cur.t[tt] || 0) + 1; });
      function top(o) { var k = '', n = -1; Object.keys(o).forEach(function (x) { if (o[x] > n) { n = o[x]; k = x; } }); return k; }
      var cv = top(cur.v), cs = top(cur.s), ct = top(cur.t), mixed = Object.keys(cur.v).length > 1 || Object.keys(cur.s).length > 1 || Object.keys(cur.t).length > 1;
      var yNow = new Date().getFullYear(), tm = /^(\d{4})-(\d{2})$/.exec(ct || ''), tY = tm ? +tm[1] : yNow, tMo = tm ? +tm[2] : 0;
      var vSel = cv || null, vT = false, sT = false, tT = false, MS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      function vrow(val, name, it) { return '<button type="button" class="idpr" data-v="' + esc(val) + '">' + (it ? HA.lyb.prevSvg(va, it) : '<span class="idsw0"></span>') + '<span>' + esc(name) + '</span></button>'; }
      var sopt = '<option value="">(kosongkan)</option>' + (st ? st.items.map(function (x) { return '<option value="' + esc(x.id) + '"' + (cs === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') : '');
      var yopt = ''; for (var yy = yNow - 6; yy <= yNow; yy++) yopt += '<option value="' + yy + '"' + (yy === tY ? ' selected' : '') + '>' + yy + '</option>';
      if (tY < yNow - 6) yopt = '<option value="' + tY + '" selected>' + tY + '</option>' + yopt;
      var mb = ''; for (var mi = 1; mi <= 12; mi++) mb += '<button type="button" class="idmo" data-mo="' + mi + '"><i style="background:' + HA.lyb.bulanCol(mi) + '"></i>' + MS[mi - 1] + '</button>';
      dlg('<div class="st">ISI DATA ' + nSel() + ' BLOK</div>' + (mixed ? '<div class="muted" style="margin-top:4px">Data blok beragam. Yang tampil: yang terbanyak.</div>' : '') + '<div class="h" style="margin-top:8px">VARIETAS</div><div class="idpl" id="fdVl">' + vrow('', '(kosongkan)') + (va ? va.items.map(function (x) { return vrow(x.id, x.name, x); }).join('') : '') + '</div><div class="h" style="margin-top:8px">STATUS TANAMAN</div><select id="fdS" style="width:100%">' + sopt + '</select><div class="h" style="margin-top:8px">BULAN TANAM</div><div class="row" style="gap:6px"><select id="fdY" style="flex:1;min-width:0">' + yopt + '</select><button type="button" class="btn sm" id="fdTc">Kosongkan</button></div><div class="idmg" id="fdM">' + mb + '</div><button class="btn pri" id="fdO" style="width:100%;margin-top:8px">Terapkan</button>', function (q, c) {
        var tClr = false;
        function mark() { q.querySelectorAll('.idpr').forEach(function (b) { b.classList.toggle('on', vSel !== null && b.getAttribute('data-v') === vSel); }); q.querySelectorAll('.idmo').forEach(function (b) { b.classList.toggle('on', !tClr && +b.getAttribute('data-mo') === tMo); }); } mark();
        q.querySelector('#fdVl').onclick = function (e) { var b = e.target.closest && e.target.closest('.idpr'); if (!b) return; vSel = b.getAttribute('data-v'); vT = true; mark(); };
        q.querySelector('#fdS').onchange = function () { sT = true; };
        q.querySelector('#fdY').onchange = function () { tY = +this.value; if (tMo) tT = true; };
        q.querySelector('#fdM').onclick = function (e) { var b = e.target.closest && e.target.closest('.idmo'); if (!b) return; tMo = +b.getAttribute('data-mo'); tClr = false; tT = true; mark(); };
        q.querySelector('#fdTc').onclick = function () { tClr = true; tMo = 0; tT = true; mark(); };
        q.onclick = function (e) { if (e.target === q) c(); };
        q.querySelector('#fdO').onclick = function () {
          var v = vSel, s = q.querySelector('#fdS').value, t = tClr ? '' : (tMo ? tY + '-' + ('0' + tMo).slice(-2) : '');
          if (!vT && !sT && !tT) { HA.toast('Belum ada yang diubah'); return; }
          c(); var ids = Object.keys(sel);
          dlg('<div class="st">SIMPAN ' + ids.length + ' BLOK?</div><div class="muted" style="margin:8px 0">Data langsung tersimpan ke blok.</div><div class="idrow"><button class="btn" id="cfN">Batal</button><button class="btn pri" id="cfY">Simpan</button></div>', function (q2, c2) {
            q2.querySelector('#cfN').onclick = c2;
            q2.querySelector('#cfY').onclick = function () {
              c2(); var n = 0;
              ids.forEach(function (id) { var b = byId[id]; if (!b) return; var chg = false;
                if (vT && HA.lyb.set(b, 'varietas', v)) chg = true; if (sT && HA.lyb.set(b, 'status', s)) chg = true;
                if (tT) { if (t) { if (b.tn !== t) { b.tn = t; chg = true; } } else if (b.tn) { delete b.tn; chg = true; } }
                if (chg) n++; });
              HA.saveSettings(); sel = {}; HA.toast(n + ' blok disimpan'); refresh(); tabLater();
            };
          });
        };
      });
    };
    function closeEd() { HA.idBack = null; clearTimeout(tt); el.remove(); }
    function batal() {
      if (!dirty()) { closeEd(); if (back) back(); return; }
      dlg('<div class="st">BUANG PERUBAHAN?</div><div class="muted" style="margin:8px 0">' + Object.keys(ch).length + ' blok berubah dan belum disimpan.</div><button class="btn" id="bX" style="width:100%">Lanjut mengisi</button><button class="btn pri" id="bB" style="width:100%;margin-top:6px;background:var(--r);border-color:var(--r)">Buang</button>', function (q, c) { q.querySelector('#bX').onclick = c; q.querySelector('#bB').onclick = function () { c(); closeEd(); if (back) back(); }; });
    }
    $e('idBk').onclick = function () { if (view) { closeEd(); if (back) back(); } else batal(); };
    HA.idBack = function () {
      if (!document.getElementById('idEd')) return false;
      var q = el.querySelector('.lyq'); if (q) { q.remove(); return true; }
      if (view) { if (infoId) { closeInfo(); return true; } if (openP) { closePanel(); return true; } if (accOpen) { accOpen = false; $e('idAc').style.display = 'none'; return true; } closeEd(); if (back) back(); return true; }
      if (opts && opts.mode) { if (dirty()) { dlg('<div class="st">BUANG PERUBAHAN?</div><div class="muted" style="margin:8px 0">' + Object.keys(ch).length + ' blok berubah dan belum disimpan.</div><button class="btn" id="bX" style="width:100%">Lanjut mengisi</button><button class="btn pri" id="bB" style="width:100%;margin-top:6px;background:var(--r);border-color:var(--r)">Buang</button>', function (q2, c) { q2.querySelector('#bX').onclick = c; q2.querySelector('#bB').onclick = function () { c(); ch = {}; toView(); }; }); } else toView(); return true; }
      batal(); return true;
    };
    window.addEventListener('resize', function () { if (document.getElementById('idEd')) { size(); draw(); } });
    setTimeout(function () { size(); fit(); reff(); info(); paint(); tables(); }, 30);
    window.__hzLihat = function () { return view; }; window.__hzIsi = { F: F, state: function () { return { openP: openP, infoId: infoId, fillM: fillM, VF: VF }; } };
  }
  HA.isiData = open;
})();
