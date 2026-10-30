/* HZ Trip - tampilan 3D */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var E = HA.E, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function fmt1() { return HA.fmt1.apply(this, arguments); }
  function shapeItems() { return HA.shapeItems.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.close3d = close3d;
  HA.open3d = open3d;
  HA.slopeTap = slopeTap;

  // ---------- tampilan 3D (jaring permukaan, hanya mode Peta) ----------
  HA.V3 = { pdf: true, tex: null, moving: false, on: false, g: null, yaw: -30, pitch: 52, zoom: 1, exag: 3, color: 'h', ptr: {}, pd: 0, q: null, trk: [], busy: 0 };
  var ZCOL = { g: '#3FD07A', y: '#F5C518', r: '#FF5B50', s: '#9E9E9E' };
  function close3d() {
    var el = $('v3d'); if (el) el.remove();
    HA.V3.on = false; HA.V3.g = null; HA.V3.busy++;
    if (HA.map) HA.map.getContainer().classList.remove('v3on');
    if (HA.DM.sync) HA.DM.sync();
  }
  function open3d(keep) {
    if (!HA.map || !window.HzDem) return;
    if (S.settings.mapMode !== 'osm') { toast('Tampilan 3D hanya di mode Peta'); return; }
    var c = HA.map.getContainer(), el = $('v3d'), bd = HA.map.getBounds(), b = { s: bd.getSouth(), w: bd.getWest(), n: bd.getNorth(), e: bd.getEast() };
    if (keep && HA.V3.g) b = HA.V3.g.b;
    if (!el) {
      el = document.createElement('div'); el.id = 'v3d'; el.className = 'v3d';
      el.innerHTML = '<canvas id="v3c"></canvas><div class="v3bar"><div class="tseg" id="v3col"><button type="button" data-c="h">Ketinggian</button><button type="button" data-c="s">Kemiringan</button></div>' +
        '<label class="v3x">Tinggi &times;<b id="v3xv">' + HA.V3.exag + '</b><input type="range" id="v3x" min="1" max="20" step="0.5" value="' + HA.V3.exag + '"></label>' +
        '<div class="v3b2"><button type="button" id="v3p">Peta PDF</button><button type="button" id="v3r">Atur ulang</button><button type="button" id="v3q">Tutup</button></div></div><div class="v3leg" id="v3leg"></div><div class="v3msg" id="v3msg">Menghitung…</div>';
      c.appendChild(el); L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el);
      c.classList.add('v3on'); HA.V3.on = true;
      $('v3q').onclick = close3d;
      $('v3p').onclick = function () { HA.V3.pdf = !HA.V3.pdf; this.classList.toggle('on', HA.V3.pdf && !!HA.V3.tex); draw3d(true); };
      $('v3r').onclick = function () { HA.V3.yaw = -30; HA.V3.pitch = 52; HA.V3.zoom = 1; draw3d(true); };
      $('v3x').oninput = function () { HA.V3.exag = +this.value; $('v3xv').textContent = HA.V3.exag; prep3d(); HA.V3.moving = true; draw3d(); clearTimeout(HA.V3.wt); HA.V3.wt = setTimeout(function () { HA.V3.moving = false; draw3d(true); }, 250); };
      $('v3col').onclick = function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-c'); if (!k) return; HA.V3.color = k; document.querySelectorAll('#v3col button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-c') === k); }); prep3d(); draw3d(); };
      var cv = $('v3c');
      cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); HA.V3.ptr[e.pointerId] = [e.clientX, e.clientY]; HA.V3.pd = 0; HA.V3.moving = true; });
      cv.addEventListener('pointermove', function (e) {
        var p = HA.V3.ptr[e.pointerId]; if (!p) return;
        var ids = Object.keys(HA.V3.ptr);
        if (ids.length >= 2) {
          var o = HA.V3.ptr[ids[0] === String(e.pointerId) ? ids[1] : ids[0]], d0 = Math.hypot(p[0] - o[0], p[1] - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]);
          if (d0 > 10) HA.V3.zoom = Math.max(0.5, Math.min(5, HA.V3.zoom * d1 / d0));
        } else { HA.V3.yaw += (e.clientX - p[0]) * 0.4; HA.V3.pitch = Math.max(12, Math.min(88, HA.V3.pitch - (e.clientY - p[1]) * 0.3)); }
        HA.V3.ptr[e.pointerId] = [e.clientX, e.clientY]; draw3d();
      });
      function up(e) { delete HA.V3.ptr[e.pointerId]; if (!Object.keys(HA.V3.ptr).length) { HA.V3.moving = false; setTimeout(function () { draw3d(true); }, 0); } }
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', function (e) { e.preventDefault(); HA.V3.zoom = Math.max(0.5, Math.min(5, HA.V3.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); HA.V3.moving = true; draw3d(); clearTimeout(HA.V3.wt); HA.V3.wt = setTimeout(function () { HA.V3.moving = false; draw3d(true); }, 220); }, { passive: false });
    }
    document.querySelectorAll('#v3col button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-c') === HA.V3.color); });
    $('v3msg').style.display = 'block'; $('v3msg').textContent = 'Menghitung…';
    var id = ++HA.V3.busy;
    HzDem.sampleGrid(b, 70).then(function (g) {
      if (id !== HA.V3.busy || !HA.V3.on) return;
      if (!isFinite(g.mn)) { $('v3msg').textContent = 'Data ketinggian belum tersedia di area ini (butuh internet)'; return; }
      HA.V3.g = g; $('v3msg').style.display = 'none';
      prep3d(); draw3d();
    });
    if (HA.DM.sync) HA.DM.sync();
  }
  // warna dan bayangan tiap kotak + titik jalur (dihitung ulang saat mode atau tinggi berubah)
  function prep3d() {
    var g = HA.V3.g; if (!g) return;
    var cols = g.cols, rows = g.rows, nq = (cols - 1) * (rows - 1), col = new Uint8ClampedArray(nq * 3), ok = new Uint8Array(nq), i, j, ex = HA.V3.exag, lx = -0.5, ly = 0.45, lz = 0.74;
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
      var q = j * (cols - 1) + i, e00 = g.z[j * cols + i], e10 = g.z[j * cols + i + 1], e01 = g.z[(j + 1) * cols + i], e11 = g.z[(j + 1) * cols + i + 1];
      if (!(e00 === e00 && e10 === e10 && e01 === e01 && e11 === e11)) continue;
      var gx = ((e10 + e11) - (e00 + e01)) / (2 * g.dx), gy = ((e00 + e10) - (e01 + e11)) / (2 * g.dy), pct = 100 * Math.hypot(gx, gy);
      var t = HA.V3.color === 'h' ? (g.mx > g.mn ? ((e00 + e10 + e01 + e11) / 4 - g.mn) / (g.mx - g.mn) : 0.5) : pct / 15, rgb = HzDem.gradRGB(t);
      var nx = -gx * ex, ny = -gy * ex, nl = Math.sqrt(nx * nx + ny * ny + 1), sh = 0.68 + 0.42 * Math.max(0, (nx * lx + ny * ly + lz) / nl);
      col[q * 3] = rgb[0] * sh; col[q * 3 + 1] = rgb[1] * sh; col[q * 3 + 2] = rgb[2] * sh; ok[q] = 1;
    }
    HA.V3.q = { col: col, ok: ok };
    // peta PDF: ambil gambar lapisan yang sedang tampil di peta, lalu petakan tiap titik jaring ke piksel gambar itu
    HA.V3.tex = null;
    var ovs = (HA.map._ovl || []).filter(function (l) { return l && l._canvas && l._min; });
    if (ovs.length) {
      var l0 = ovs[0], snap = document.createElement('canvas'); snap.width = l0._canvas.width; snap.height = l0._canvas.height;
      var sx = snap.getContext('2d');
      ovs.forEach(function (l) { sx.globalAlpha = parseFloat(l._canvas.style.opacity || 1); sx.drawImage(l._canvas, 0, 0); });
      var TX = new Float32Array(cols * rows), TY = new Float32Array(cols * rows);
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
        var lp = HA.map.latLngToLayerPoint([g.b.n - j * (g.b.n - g.b.s) / (rows - 1), g.b.w + i * (g.b.e - g.b.w) / (cols - 1)]);
        TX[j * cols + i] = lp.x - l0._min.x; TY[j * cols + i] = lp.y - l0._min.y;
      }
      HA.V3.tex = { cv: snap, TX: TX, TY: TY };
    }
    var pb = $('v3p'); if (pb) { pb.style.display = HA.V3.tex ? '' : 'none'; pb.classList.toggle('on', HA.V3.pdf && !!HA.V3.tex); }
    // jalur trip (warna menurut kecepatan)
    HA.V3.trk = [];
    var v = S.mapView, zmid = (g.mn + g.mx) / 2, md = Math.max(g.W, g.H), lift = md * 0.004 / Math.max(1, ex) * 1;
    if (v && v.trips) {
      v.trips.forEach(function (x, ti) {
        if (v.sel >= 0 && ti !== v.sel) return;
        E.trackOf(v.pts, x.t).runs.forEach(function (r) {
          var pts = [];
          r.pts.forEach(function (p) {
            if (p.lat < g.b.s || p.lat > g.b.n || p.lng < g.b.w || p.lng > g.b.e) return;
            var e = HzDem.elev(p.lat, p.lng, g.zd); if (e !== e) return;
            pts.push([(p.lng - (g.b.w + g.b.e) / 2) * g.kx, (p.lat - (g.b.s + g.b.n) / 2) * g.ky, e]);
          });
          if (pts.length > 1) HA.V3.trk.push({ c: ZCOL[r.z] || '#fff', pts: pts, lift: lift });
        });
      });
    }
    HA.V3.shp = [];
    shapeItems().forEach(function (s) {
      var P = s.pts, N = s.closed ? P.length : P.length - 1, runs = [], cur = [], k, t, full = true;
      function add(lat, lng) {
        var e = (lat < g.b.s || lat > g.b.n || lng < g.b.w || lng > g.b.e) ? NaN : HzDem.elev(lat, lng, g.zd);
        if (e !== e) { full = false; if (cur.length > 1) runs.push(cur); cur = []; return; }
        cur.push([(lng - (g.b.w + g.b.e) / 2) * g.kx, (lat - (g.b.s + g.b.n) / 2) * g.ky, e]);
      }
      for (k = 0; k < N; k++) {
        var p0 = P[k], p1 = P[(k + 1) % P.length], st = Math.max(1, Math.ceil(Math.hypot((p1[1] - p0[1]) * g.kx, (p1[0] - p0[0]) * g.ky) / Math.max(1, g.dx * 0.7)));
        for (t = 0; t < st; t++) add(p0[0] + (p1[0] - p0[0]) * t / st, p0[1] + (p1[1] - p0[1]) * t / st);
      }
      if (!s.closed) add(P[P.length - 1][0], P[P.length - 1][1]);
      if (cur.length > 1) runs.push(cur);
      if (!runs.length) return;
      var cl = 0, cg = 0; P.forEach(function (q) { cl += q[0]; cg += q[1]; }); cl /= P.length; cg /= P.length;
      var le = (cl < g.b.s || cl > g.b.n || cg < g.b.w || cg > g.b.e) ? NaN : HzDem.elev(cl, cg, g.zd);
      HA.V3.shp.push({ c: s.color, runs: runs, closed: s.closed && full, label: s.label, lp: le === le ? [(cg - (g.b.w + g.b.e) / 2) * g.kx, (cl - (g.b.s + g.b.n) / 2) * g.ky, le] : null, lift: lift });
    });
    var leg = $('v3leg');
    if (leg) leg.innerHTML = HA.V3.color === 'h' ? '<span>' + Math.round(g.mn) + ' mdpl</span><i class="gbar" style="background:' + HzDem.GRAD_CSS + '"></i><span>' + Math.round(g.mx) + ' mdpl</span>' : '<span>0%</span><i class="gbar" style="background:' + HzDem.GRAD_CSS + '"></i><span>15%+</span>';
  }
  function draw3d(withTex) {
    var g = HA.V3.g, cv = $('v3c'); if (!g || !cv || !HA.V3.q) return;
    var useTex = !!(withTex && HA.V3.pdf && HA.V3.tex && !HA.V3.moving);
    var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0F1519'; ctx.fillRect(0, 0, w, h);
    var yaw = HA.V3.yaw * Math.PI / 180, pt = HA.V3.pitch * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pt), sp = Math.sin(pt);
    var zmid = (g.mn + g.mx) / 2, ex = HA.V3.exag, sc = Math.min(w, h) * 0.95 * HA.V3.zoom / Math.hypot(g.W, g.H), cols = g.cols, rows = g.rows, n = cols * rows;
    var SX = new Float32Array(n), SY = new Float32Array(n), DP = new Float32Array(n), i, j;
    function proj(x, y, z, o, k) { var x1 = x * cy - y * sy, y1 = x * sy + y * cy; o[0] = w / 2 + x1 * sc; o[1] = h * 0.52 - (y1 * sp + z * cp) * sc; o[2] = y1 * cp - z * sp; }
    var tmp = [0, 0, 0];
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var k = j * cols + i, z = g.z[k];
      if (z !== z) { SX[k] = NaN; continue; }
      proj(i * g.dx - g.W / 2, g.H / 2 - j * g.dy, (z - zmid) * ex, tmp);
      SX[k] = tmp[0]; SY[k] = tmp[1]; DP[k] = tmp[2];
    }
    var order = [], ok = HA.V3.q.ok, col = HA.V3.q.col, q, dep = new Float32Array((cols - 1) * (rows - 1));
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
      q = j * (cols - 1) + i; if (!ok[q]) continue;
      var a = j * cols + i; dep[q] = (DP[a] + DP[a + 1] + DP[a + cols] + DP[a + cols + 1]) / 4; order.push(q);
    }
    order.sort(function (p1, p2) { return dep[p2] - dep[p1]; });
    ctx.lineJoin = 'round'; ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(0,0,0,.32)';
    for (var oi = 0; oi < order.length; oi++) {
      q = order[oi]; var qj = Math.floor(q / (cols - 1)), qi = q - qj * (cols - 1), a0 = qj * cols + qi;
      ctx.fillStyle = 'rgb(' + (col[q * 3] | 0) + ',' + (col[q * 3 + 1] | 0) + ',' + (col[q * 3 + 2] | 0) + ')';
      ctx.beginPath(); ctx.moveTo(SX[a0], SY[a0]); ctx.lineTo(SX[a0 + 1], SY[a0 + 1]); ctx.lineTo(SX[a0 + cols + 1], SY[a0 + cols + 1]); ctx.lineTo(SX[a0 + cols], SY[a0 + cols]); ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (useTex) {
        var T = HA.V3.tex, ta = a0, tb = a0 + 1, tc = a0 + cols, td = a0 + cols + 1;
        var ux = T.TX[tb] - T.TX[ta], uy = T.TY[tb] - T.TY[ta], vx = T.TX[tc] - T.TX[ta], vy = T.TY[tc] - T.TY[ta], det = ux * vy - uy * vx;
        if (Math.abs(det) > 1e-6) {
          var Sux = SX[a0 + 1] - SX[a0], Suy = SY[a0 + 1] - SY[a0], Svx = SX[a0 + cols] - SX[a0], Svy = SY[a0 + cols] - SY[a0];
          var m11 = (Sux * vy - Svx * uy) / det, m12 = (Suy * vy - Svy * uy) / det, m21 = (-Sux * vx + Svx * ux) / det, m22 = (-Suy * vx + Svy * ux) / det;
          var bx0 = Math.floor(Math.min(T.TX[ta], T.TX[tb], T.TX[tc], T.TX[td])), by0 = Math.floor(Math.min(T.TY[ta], T.TY[tb], T.TY[tc], T.TY[td])),
              bx1 = Math.ceil(Math.max(T.TX[ta], T.TX[tb], T.TX[tc], T.TX[td])), by1 = Math.ceil(Math.max(T.TY[ta], T.TY[tb], T.TY[tc], T.TY[td]));
          bx0 = Math.max(0, bx0); by0 = Math.max(0, by0); bx1 = Math.min(T.cv.width, bx1); by1 = Math.min(T.cv.height, by1);
          if (bx1 > bx0 && by1 > by0) {
            ctx.setTransform(m11 * dpr, m12 * dpr, m21 * dpr, m22 * dpr, (SX[a0] - m11 * T.TX[ta] - m21 * T.TY[ta]) * dpr, (SY[a0] - m12 * T.TX[ta] - m22 * T.TY[ta]) * dpr);
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(T.cv, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }
        }
      }
    }
    // jalur
    HA.V3.trk.forEach(function (tr) {
      ctx.beginPath();
      tr.pts.forEach(function (p, idx) { proj(p[0], p[1], (p[2] - zmid) * ex + tr.lift * 6, tmp); if (idx) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); });
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = tr.c; ctx.lineWidth = 2.6; ctx.stroke();
    });
    (HA.V3.shp || []).forEach(function (s) {
      ctx.beginPath();
      s.runs.forEach(function (r) { r.forEach(function (p, idx) { proj(p[0], p[1], (p[2] - zmid) * ex + s.lift * 4, tmp); if (idx) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); }); });
      if (s.closed) { ctx.closePath(); ctx.globalAlpha = 0.2; ctx.fillStyle = s.c; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4.4; ctx.stroke();
      ctx.strokeStyle = s.c; ctx.lineWidth = 2; ctx.stroke();
      if (s.lp) {
        proj(s.lp[0], s.lp[1], (s.lp[2] - zmid) * ex + s.lift * 8, tmp);
        ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(s.label, tmp[0], tmp[1]); ctx.fillStyle = s.c; ctx.fillText(s.label, tmp[0], tmp[1]);
      }
    });
    // kompas (arah utara)
    var cx0 = w - 34, cy0 = 140; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2;
    var nx = -sy * 16, ny = -(cy * sp) * 16;
    ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + nx, cy0 + ny); ctx.stroke();
    ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('U', cx0 + nx * 1.5, cy0 + ny * 1.5);
  }
  function slopeLine(tag, r) {
    return (tag ? '<small>' + tag + '</small> ' : '') + '<b>' + Math.round(r.h) + ' mdpl</b> · ' + (r.pct < 0.5 ? 'datar' : 'lereng ' + fmt1(r.pct) + '% ' + HA.ARROW.replace('DEG', Math.round(r.down)));
  }
  function slopeTap(m, e) {
    if (!window.HzDem) return;
    var ll = e.latlng, both = S.settings.useNas !== false && S.settings.useFree !== false;
    if (!both) {
      HzDem.info(ll.lat, ll.lng).then(function (r) {
        if (!r) { toast(S.settings.useNas === false ? 'Data ketinggian belum tersedia (butuh internet)' : 'Titik ini di luar area DEMNAS'); return; }
        m._pinInfo([ll.lat, ll.lng], '<div>' + slopeLine('', r) + '</div>');
      });
      return;
    }
    Promise.all([HzDem.info(ll.lat, ll.lng, 'nas'), HzDem.info(ll.lat, ll.lng, 'free')]).then(function (r) {
      var a = r[0], b = r[1];
      if (!a && !b) { toast('Data ketinggian belum tersedia (butuh internet)'); return; }
      var t = [];
      if (a) t.push(slopeLine('DEMNAS', a));
      if (b) t.push(slopeLine('DEM gratis', b));
      if (a && b) t.push('<small>Selisih ' + Math.round(Math.abs(a.h - b.h)) + ' m · ' + fmt1(Math.abs(a.pct - b.pct)) + '% kemiringan</small>');
      m._pinInfo([ll.lat, ll.lng], '<div style="line-height:1.35">' + t.join('<br>') + '</div>');
    });
  }
})();
