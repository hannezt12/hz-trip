/* HZ Trip - Isi data per master: layar ringan untuk mengisi Varietas, Status tanaman dan Bulan tanam banyak blok sekaligus. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function esc(t) { return HA.esc(t); }
  function fh(v) { return v.toFixed(2).replace('.', ','); }

  function open(m, back) {
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
    var ch = {}, hist = ['{}'], hi = 0, sel = {}, mode = 'tap', lay = { v: true, s: true, t: true }, V = { s: 1, tx: 0, ty: 0 }, rect = null;
    var el = document.createElement('div'); el.id = 'idEd'; el.className = 'idEd';
    el.innerHTML = '<div class="idh"><b class="idt">Isi data · ' + esc(m.name) + '</b><button class="btn sm" id="idBk">Tutup</button></div>' +
      '<div class="idb"><div class="seg" id="idMd"><button data-m="tap" class="on">Ketuk</button><button data-m="area">Area</button></div><button class="btn sm" id="idBl">Belum diisi</button><input type="text" id="idQ" placeholder="Nama blok…" style="flex:1;min-width:0"><button class="btn sm" id="idQb">Pilih</button></div>' +
      '<div class="idc" id="idC"><canvas id="idCv"></canvas><div class="idn" id="idN"></div></div>' +
      '<div class="idl"><label><input type="checkbox" id="idLv" checked> Varietas</label><label><input type="checkbox" id="idLs" checked> Status</label><label><input type="checkbox" id="idLt" checked> Bulan tanam</label></div>' +
      '<div class="idf"><button class="btn sm" id="idNo">Kosongkan pilihan</button><button class="btn pri" id="idGo" style="flex:1">Isi data (0)</button></div>' +
      '<details class="idd"><summary>RINGKASAN (ha)</summary><div id="idT"></div></details>';
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
    function fit() { var w = C.clientWidth, h = C.clientHeight, s = Math.min((w - 16) / Math.max(1, BX1 - BX0), (h - 16) / Math.max(1, BY1 - BY0)); V.s = s; V.tx = (w - (BX1 - BX0) * s) / 2 - BX0 * s; V.ty = (h - (BY1 - BY0) * s) / 2 - BY0 * s; }
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
        var e = E[g.b.id], vi = lay.v && va ? HA.lyb.of(e, 'varietas') : null, si = lay.s && st ? HA.lyb.of(e, 'status') : null, mo = lay.t ? HA.lyb.bulanOf(e) : 0;
        ctx.beginPath(); g.q.forEach(function (p, i) { var X = p[0] * V.s + V.tx, Y = p[1] * V.s + V.ty; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath();
        ctx.fillStyle = vi ? (vi.col || '#999') : '#e8e2d0'; ctx.fill();
        if (vi && vi.pat && vi.pat !== 'none') { var pt = pattern(vi.pat, vi.pc || '#000000', vi.ps); if (pt) { ctx.fillStyle = pt; ctx.fill(); } }
        if (sel[g.b.id]) { ctx.fillStyle = 'rgba(33,120,255,.35)'; ctx.fill(); }
        ctx.lineJoin = 'round'; ctx.strokeStyle = mo ? HA.lyb.bulanCol(mo) : '#555'; ctx.lineWidth = mo ? 3.5 : 0.8; if (pendSet[g.b.id]) ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
        if (sel[g.b.id]) { ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 2; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]); }
        var bw = sx1 - sx0, bh = sy1 - sy0, cx = g.cx * V.s + V.tx, cy = g.cy * V.s + V.ty;
        if (si && bw > 16 && bh > 16) sym(cx, cy + (bw > 44 ? 6 : 0), Math.min(10, bw / 4), si.sym);
        if (bw > 40 && bh > 22) { ctx.font = '600 ' + Math.min(13, bw / 6) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#1f4e9e'; ctx.strokeText(String(g.b.name), cx, cy - 8); ctx.fillText(String(g.b.name), cx, cy - 8); }
      });
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
    function refresh() { reff(); info(); draw(); }
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
      if (g0.m === 'zoom' && np() >= 2) { var q = d2(), ns = Math.max(0.05, g0.s * q.d / g0.d), wx = (g0.mx - g0.tx) / g0.s, wy = (g0.my - g0.ty) / g0.s; V.s = ns; V.tx = q.mx - wx * ns; V.ty = q.my - wy * ns; draw(); return; }
      if (np() !== 1) return; var dx = p.x - g0.sx, dy = p.y - g0.sy; if (Math.abs(dx) + Math.abs(dy) > 5) g0.moved = true;
      if (g0.m === 'tap') { if (g0.moved) { V.tx = g0.tx + dx; V.ty = g0.ty + dy; draw(); } }
      else if (g0.m === 'area') { rect.x1 = p.x; rect.y1 = p.y; draw(); }
    });
    function up(e) {
      var p = pos(e); if (!ptr[e.pointerId]) return; delete ptr[e.pointerId]; if (!g0) return;
      if (g0.m === 'zoom') { if (np() < 2) { g0 = null; ptr = {}; } return; }
      if (g0.m === 'tap' && !g0.moved) { var b = hit(p.x, p.y); if (b) { if (sel[b.id]) delete sel[b.id]; else sel[b.id] = 1; info(); draw(); } }
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
    $e('idBk').onclick = batal;
    HA.idBack = function () { if (!document.getElementById('idEd')) return false; var q = el.querySelector('.lyq'); if (q) { q.remove(); return true; } batal(); return true; };
    window.addEventListener('resize', function () { if (document.getElementById('idEd')) { size(); draw(); } });
    setTimeout(function () { size(); fit(); reff(); info(); paint(); tables(); }, 30);
  }
  HA.isiData = open;
})();
