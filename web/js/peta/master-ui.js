/* HZ Trip - Master blok: poligon kawasan (berdiri sendiri) untuk cetak PDF ber-geo. Tampilan blok di app tidak dibatasi master. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  HA.renderMaster = renderMaster;
  HA.masterCreated = masterCreated;
  HA.readHzBlok = readHzBlok;
  HA.restoreHzBlok = restoreHzBlok;
  HA.masterMembers = members;
  HA.masterPdf = buildPdfBytes;

  function masters() { return S.settings.masters || (S.settings.masters = []); }
  function blocks() { return HA.blocksList(); }
  function fmtHa(v) { return v.toFixed(2).replace('.', ','); }
  function idset(a) { var o = {}; (a || []).forEach(function (i) { o[String(i)] = 1; }); return o; }
  function nat(a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'id', { numeric: true }); }

  // ---------- geometri ----------
  function pip(ll, pts) { var i, j, c = false; for (i = 0, j = pts.length - 1; i < pts.length; j = i++) { if (((pts[i][0] > ll[0]) !== (pts[j][0] > ll[0])) && (ll[1] < (pts[j][1] - pts[i][1]) * (ll[0] - pts[i][0]) / (pts[j][0] - pts[i][0]) + pts[i][1])) c = !c; } return c; }
  function segX(a, b, c, d) {
    function o(p, q, r) { return (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]); }
    var o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
  }
  function bbox(pts) { var s = 90, w = 180, n = -90, e = -180; pts.forEach(function (p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; }); return [s, w, n, e]; }
  function rel(b, mp, mbb) {
    var q = bbox(b.pts); if (q[0] > mbb[2] || q[2] < mbb[0] || q[1] > mbb[3] || q[3] < mbb[1]) return 'out';
    var n = b.pts.length, m = mp.length, i, j, cross = false, allIn = true, anyIn = false;
    for (i = 0; i < n; i++) { if (pip(b.pts[i], mp)) anyIn = true; else allIn = false; }
    for (i = 0; i < n && !cross; i++) { var a1 = b.pts[i], a2 = b.pts[(i + 1) % n]; for (j = 0; j < m; j++) { if (segX(a1, a2, mp[j], mp[(j + 1) % m])) { cross = true; break; } } }
    if (allIn && !cross) return 'in';
    if (anyIn || cross) return 'edge';
    for (j = 0; j < m; j++) if (pip(mp[j], b.pts)) return 'edge';
    return 'out';
  }
  // blok terkonfirmasi: in = seluruhnya di dalam poligon; man = di perbatasan, dimasukkan manual; skip = di perbatasan, tidak; pend = di perbatasan, belum diputuskan
  function members(m) {
    var mbb = bbox(m.pts), r = { in: [], man: [], pend: [], skip: [] }, inc = idset(m.inc), exc = idset(m.exc);
    blocks().forEach(function (b) {
      if (!b.conf || !b.pts || b.pts.length < 3) return;
      var k = rel(b, m.pts, mbb);
      if (k === 'in') r.in.push(b);
      else if (k === 'edge') { var id = String(b.id); if (inc[id]) r.man.push(b); else if (exc[id]) r.skip.push(b); else r.pend.push(b); }
    });
    ['in', 'man', 'pend', 'skip'].forEach(function (k) { r[k].sort(nat); });
    return r;
  }
  function haOf(list) { var t = 0; list.forEach(function (b) { try { t += HzBlok.areaHa(b.pts); } catch (e) {} }); return t; }

  // ---------- daftar master (Data peta > Master) ----------
  function mById(id) { return masters().filter(function (m) { return String(m.id) === String(id); })[0]; }
  function renderMaster(box) {
    var ms = masters(); ms.forEach(function (m, i) { if (m.id == null) m.id = Date.now() + i; });
    box.innerHTML = '<button class="btn pri" id="mkNew" style="width:100%;height:50px">Buat master baru</button><div id="mkList" style="margin-top:10px"></div>' +
      '<div class="muted" style="margin:8px 2px">Master = poligon kawasan untuk cetak PDF. Hanya blok Terkonfirmasi yang seluruh bentuknya ada di dalam poligon yang tercetak; blok di perbatasan Han putuskan sendiri. Tampilan blok di peta tidak dibatasi master.</div>';
    $('mkNew').onclick = function () { HA.mapKeep = true; go('lintasan'); setTimeout(function () { HA.closeAll(); HA.drawFlow('master'); }, 800); };
    HA.lpList($('mkList'), 'master', {
      items: ms.map(function (m) {
        var mem = members(m), n = mem.in.length + mem.man.length;
        return { id: m.id, title: m.name, sub: n + ' blok · ' + fmtHa(haOf(mem.in.concat(mem.man))) + ' ha' + (mem.man.length ? ' · ' + mem.man.length + ' manual' : '') + (mem.pend.length ? ' · ' + mem.pend.length + ' perlu diatur' : '') };
      }),
      empty: 'Belum ada master. Tekan "Buat master baru" lalu gambar poligon kawasan.',
      onTap: function (id) { var m = mById(id); if (m) viewMaster(m); },
      actions: function (id) {
        var m = mById(id); if (!m) return [];
        return [
          { label: 'Cetak PDF', fn: function () { cetak(m); } },
          { label: 'Atur blok perbatasan', fn: function () { aturSheet(m); } },
          { label: 'Edit batas', fn: function () { editBatas(m); } },
          { label: 'Ganti nama', fn: function () { nameSheet(m, false); } }
        ];
      },
      delTitle: function (ids) { return ids.length === 1 ? 'Hapus master ini?' : 'Hapus ' + ids.length + ' master?'; },
      delMsg: function () { return 'Hanya master yang dihapus. Blok tidak berubah.'; },
      onDelete: function (ids) { var set = idset(ids); S.settings.masters = masters().filter(function (m) { return !set[String(m.id)]; }); saveSettings(); HA.renderData(); }
    });
  }
  function needMap(fn) {
    var was = S.view === 'lintasan' && !!HA.map, n = 0; HA.mapKeep = true; if (!was) go('lintasan');
    (function tick() { if (HA.map && (was || n > 2)) { HA.closeAll(); fn(); return; } if (++n < 30) setTimeout(tick, 300); })();
  }
  function viewMaster(m) {
    needMap(function () {
      HA.map.fitBounds(L.latLngBounds(m.pts), { padding: [40, 40] });
      var pl = L.polygon(m.pts, { color: '#FF9F1C', weight: 3, dashArray: '8 5', fillOpacity: 0.05, interactive: false }).addTo(HA.map);
      setTimeout(function () { try { HA.map.removeLayer(pl); } catch (e) {} }, 12000);
    });
  }
  function editBatas(m) {
    needMap(function () {
      HA.map.fitBounds(L.latLngBounds(m.pts), { padding: [40, 40] });
      HA.editPoly(m.pts, true, function (res) {
        if (res) { m.pts = res.map(function (p) { return [+(+p[0]).toFixed(6), +(+p[1]).toFixed(6)]; }); saveSettings(); }
        S.dpTab = 'master'; go('data');
      });
    });
  }
  function masterCreated(P) {
    var m = { id: Date.now(), name: 'Master ' + (masters().length + 1), pts: P, inc: [], exc: [] };
    masters().push(m); saveSettings(); nameSheet(m, true);
  }
  function nameSheet(m, isNew) {
    openSheet('<div class="grab"></div><div class="bth"><div class="st">MASTER</div><button class="btn pri" id="mnX">Simpan</button></div>' +
      '<div class="bnm"><input type="text" id="mnN" maxlength="40" value="' + esc(m.name) + '"></div>' +
      '<div class="muted" style="margin-top:8px">Nama dipakai di judul PDF dan nama berkas, mis. "Divisi 1 Selatan".</div>');
    $('mnX').onclick = function () { m.name = $('mnN').value.trim() || m.name; saveSettings(); closeSheet(); S.dpTab = 'master'; go('data'); };
  }

  // ---------- blok perbatasan: putuskan satu per satu ----------
  function aturSheet(m) {
    function draw() {
      var mem = members(m), rows = mem.pend.concat(mem.man, mem.skip).sort(nat), inc = idset(m.inc), exc = idset(m.exc);
      openSheet('<div class="grab"></div><div class="bth"><div class="st">PERBATASAN · ' + esc(m.name) + '</div><button class="btn pri" id="atX">Selesai</button></div>' +
        '<div class="muted" style="margin:6px 0">Blok Terkonfirmasi yang sebagian keluar dari poligon. Pilih Masuk atau Tidak; ketuk lagi untuk membatalkan.</div>' +
        (rows.length ? rows.map(function (b) {
          var id = String(b.id), st = inc[id] ? 1 : exc[id] ? 2 : 0;
          return '<div class="lpi" style="gap:6px"><div class="nm"><b>' + esc(b.name) + '</b><small>' + fmtHa(HzBlok.areaHa(b.pts)) + ' ha' + (st ? '' : ' · belum diputuskan') + '</small></div>' +
            '<button class="btn sm' + (st === 1 ? ' pri' : '') + '" data-id="' + esc(id) + '" data-v="1">Masuk</button><button class="btn sm' + (st === 2 ? ' pri' : '') + '" data-id="' + esc(id) + '" data-v="2">Tidak</button></div>';
        }).join('') : '<div class="card muted">Tidak ada blok Terkonfirmasi di perbatasan master ini.</div>'));
      $('atX').onclick = function () { closeSheet(); S.dpTab = 'master'; if (S.view === 'data') HA.renderData(); };
      $('sheet').querySelectorAll('button[data-v]').forEach(function (x) {
        x.onclick = function () {
          var id = x.getAttribute('data-id'), v = x.getAttribute('data-v'), cur = inc[id] ? '1' : exc[id] ? '2' : '0', nx = cur === v ? '0' : v;
          m.inc = (m.inc || []).filter(function (i) { return String(i) !== id; }); m.exc = (m.exc || []).filter(function (i) { return String(i) !== id; });
          if (nx === '1') m.inc.push(id); else if (nx === '2') m.exc.push(id);
          saveSettings(); draw();
        };
      });
    }
    draw();
  }

  // ---------- cetak ----------
  function cetak(m) {
    var mem = members(m);
    if (!mem.in.length && !mem.man.length) { toast('Belum ada blok Terkonfirmasi yang seluruhnya di dalam master ini'); return; }
    if (mem.pend.length) { askConfirm(mem.pend.length + ' blok perbatasan belum diputuskan', 'Blok itu tidak ikut tercetak. Tetap cetak sekarang?', 'Cetak', function () { run(m, mem); }); return; }
    run(m, mem);
  }
  function run(m, mem) {
    toast('Menyusun PDF…');
    var list = mem.in.concat(mem.man).sort(nat), lj = {}, i = 0;
    (function nx() {
      if (i >= list.length) {
        var bytes = buildPdfBytes(m, list, lj, mem), d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
        var fn = 'Master_' + m.name.replace(/[^\w\-]+/g, '_') + '_' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.pdf';
        HA.saveFile(fn, btoa(bytes), 'application/pdf'); return;
      }
      var b = list[i++];
      if (b.dir != null) { try { var r = HzBlok.rowsStraight(b.pts, b.dir, +(b.sp || S.settings.rowSp || 1.5), +b.margin || 0, HA.cutsFor(b)); lj[b.id] = r.n; } catch (e) {} }
      if (i % 25 === 0) setTimeout(nx, 0); else nx();
    })();
  }

  // ---------- penulis PDF minimal ----------
  function asc(t) { return String(t == null ? '' : t).replace(/[^\x20-\x7E]/g, '?'); }
  function pe(t) { return asc(t).replace(/([\\()])/g, '\\$1'); }
  function f2(v) { return (Math.round(v * 100) / 100).toString(); }
  function jsonAscii(o) { return JSON.stringify(o).replace(/[\u0080-￿]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); }); }
  function interior(pts) {
    var c = [0, 0], i, n = pts.length; pts.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; }); c[0] /= n; c[1] /= n;
    // garis datar (lintang tetap) melewati pusat; ambil selang terpanjang di dalam bentuk
    var xs = [], j;
    for (i = 0, j = n - 1; i < n; j = i++) { var a = pts[i], b = pts[j]; if ((a[0] > c[0]) !== (b[0] > c[0])) xs.push(a[1] + (c[0] - a[0]) * (b[1] - a[1]) / (b[0] - a[0])); }
    xs.sort(function (p, q) { return p - q; });
    var best = null; for (i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
    return best ? [c[0], (best[0] + best[1]) / 2] : c;
  }
  function buildPdfBytes(m, list, lj, mem) {
    var objs = [], ver = (document.querySelector('.ver') ? (document.querySelector('.ver').textContent.match(/Versi\s*([\d.]+)/) || [])[1] : '') || '';
    function add(b) { objs.push(b); return objs.length; }
    function stream(dict, data) { return '<< ' + dict + ' /Length ' + data.length + ' >>\nstream\n' + data + '\nendstream'; }
    var d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; }, tgl = p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear();
    var cat = add(''), pages = add(''), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2o = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var data = { hzblok: 1, app: 'HZ Trip', ver: ver, tgl: tgl, master: { name: m.name, pts: m.pts }, blocks: list.map(function (b) { return { id: b.id, name: b.name, src: b.src || 'manual', pts: b.pts, dir: b.dir == null ? null : b.dir, sp: b.sp == null ? null : b.sp, margin: b.margin || 0, conf: !!b.conf, note: b.note || '', guide: b.guide || null }; }) };
    var js = jsonAscii(data), emb = add(stream('/Type /EmbeddedFile /Subtype /application#2Fjson /Params << /Size ' + js.length + ' >>', js));
    var fsp = add('<< /Type /Filespec /F (hzblok.json) /UF (hzblok.json) /EF << /F ' + emb + ' 0 R /UF ' + emb + ' 0 R >> /AFRelationship /Data /Desc (Data blok HZ Trip) >>');
    var kids = [], res = '<< /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2o + ' 0 R >> >>';
    // ---- halaman peta (A3) ----
    var allp = m.pts.slice(); list.forEach(function (b) { b.pts.forEach(function (p) { allp.push(p); }); });
    var mb = bbox(allp), latc = (mb[0] + mb[2]) / 2, kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 111320;
    var mw = Math.max(50, (mb[3] - mb[1]) * kx), mh = Math.max(50, (mb[2] - mb[0]) * ky), land = mw >= mh, PW = land ? 1190.55 : 841.89, PH = land ? 841.89 : 1190.55, M = 24;
    var fw = PW - 2 * M, fh = PH - 2 * M, sc = Math.min(fw / (mw * 1.04), fh / (mh * 1.04)), offx = (fw - mw * sc) / 2, offy = (fh - mh * sc) / 2;
    function X(lng) { return M + offx + (lng - mb[1]) * kx * sc; }
    function Y(lat) { return M + offy + (lat - mb[0]) * ky * sc; }
    function lngAt(x) { return mb[1] + (x - M - offx) / (kx * sc); }
    function latAt(y) { return mb[0] + (y - M - offy) / (ky * sc); }
    var c = [];
    c.push('0 0 0 RG 0 0 0 rg 0.6 w');
    list.forEach(function (b) {
      var s = '';
      b.pts.forEach(function (p, i) { s += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i ? ' l ' : ' m '); });
      c.push(s + 'h S');
    });
    var s0 = ''; m.pts.forEach(function (p, i) { s0 += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i ? ' l ' : ' m '); });
    c.push('1.4 w [7 4] 0 d ' + s0 + 'h S [] 0 d 0.6 w');
    list.forEach(function (b) {
      var q = bbox(b.pts), bw = (q[3] - q[1]) * kx * sc, bh = (q[2] - q[0]) * ky * sc, nm = asc(b.name), ar = fmtHa(HzBlok.areaHa(b.pts)) + ' ha';
      var fs = Math.min(10, bw * 0.84 / (Math.max(3, nm.length) * 0.56), bh * 0.42); if (fs < 2.4) return;
      var ip = interior(b.pts), cx = X(ip[1]), cy = Y(ip[0]), w1 = nm.length * fs * 0.55;
      c.push('BT /F2 ' + f2(fs) + ' Tf ' + f2(cx - w1 / 2) + ' ' + f2(cy + fs * 0.15) + ' Td (' + pe(nm) + ') Tj ET');
      var fa = fs * 0.82; if (bh >= fs * 2.6 && bw >= ar.length * fa * 0.55) c.push('BT /F1 ' + f2(fa) + ' Tf ' + f2(cx - ar.length * fa * 0.55 / 2) + ' ' + f2(cy - fa * 1.05) + ' Td (' + pe(ar) + ') Tj ET');
    });
    var tot = haOf(list);
    c.push('BT /F2 15 Tf ' + f2(M + 10) + ' ' + f2(PH - M - 24) + ' Td (' + pe('Master: ' + m.name) + ') Tj ET');
    c.push('BT /F1 9 Tf ' + f2(M + 10) + ' ' + f2(PH - M - 38) + ' Td (' + pe(list.length + ' blok terkonfirmasi - ' + fmtHa(tot) + ' ha - dicetak ' + tgl + ' - HZ Trip ' + ver) + ') Tj ET');
    var L0 = [100, 200, 500, 1000, 2000, 5000].filter(function (v) { return v * sc < fw * 0.25; }).pop() || 100, bx = M + 14, by = M + 18;
    c.push('1 w ' + f2(bx) + ' ' + f2(by) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by) + ' l S ' + f2(bx) + ' ' + f2(by - 4) + ' m ' + f2(bx) + ' ' + f2(by + 4) + ' l S ' + f2(bx + L0 * sc) + ' ' + f2(by - 4) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by + 4) + ' l S');
    c.push('BT /F1 8 Tf ' + f2(bx) + ' ' + f2(by + 7) + ' Td (' + (L0 >= 1000 ? (L0 / 1000) + ' km' : L0 + ' m') + ') Tj ET');
    var nx0 = PW - M - 24, ny0 = PH - M - 46;
    c.push('1 w ' + f2(nx0) + ' ' + f2(ny0) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l S ' + f2(nx0 - 5) + ' ' + f2(ny0 + 20) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l ' + f2(nx0 + 5) + ' ' + f2(ny0 + 20) + ' l S');
    c.push('BT /F2 9 Tf ' + f2(nx0 - 3) + ' ' + f2(ny0 - 10) + ' Td (U) Tj ET');
    var cs = add(stream('', c.join('\n')));
    var corners = [[M, M], [M, PH - M], [PW - M, PH - M], [PW - M, M]], lp = [0, 0, 0, 1, 1, 1, 1, 0], gp = [];
    corners.forEach(function (q) { gp.push(latAt(q[1]).toFixed(7), lngAt(q[0]).toFixed(7)); });
    var vp = '/VP [ << /Type /Viewport /Name (Peta) /BBox [' + f2(M) + ' ' + f2(M) + ' ' + f2(PW - M) + ' ' + f2(PH - M) + '] /Measure << /Type /Measure /Subtype /GEO /Bounds [0 0 0 1 1 1 1 0] /GPTS [' + gp.join(' ') + '] /LPTS [' + lp.join(' ') + '] /GCS << /Type /GEOGCS /WKT (GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]) /EPSG 4326 >> /PDU [/M /DEG /DEG] >> >> ]';
    kids.push(add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + f2(PW) + ' ' + f2(PH) + '] /Resources ' + res + ' /Contents ' + cs + ' 0 R ' + vp + ' >>'));
    // ---- halaman tabel (A4) ----
    var PER = 46, np = Math.max(1, Math.ceil(list.length / PER)), k, totLj = 0;
    list.forEach(function (b) { totLj += lj[b.id] || 0; });
    for (k = 0; k < np; k++) {
      var t = [], y = 790;
      t.push('0 g BT /F2 13 Tf 40 810 Td (' + pe('Master: ' + m.name + ' - daftar blok') + ') Tj ET');
      t.push('BT /F1 8 Tf 40 797 Td (' + pe('Dicetak ' + tgl + ' - HZ Trip ' + ver + ' - halaman ' + (k + 1) + '/' + np) + ') Tj ET');
      y = 778;
      t.push('BT /F2 9 Tf 40 ' + y + ' Td (No) Tj 80 0 Td (Blok) Tj 150 0 Td (Luas ha) Tj 90 0 Td (Arah) Tj 80 0 Td (Lajur) Tj ET 0.5 w 40 ' + (y - 4) + ' m 460 ' + (y - 4) + ' l S');
      y -= 17;
      list.slice(k * PER, k * PER + PER).forEach(function (b, i) {
        t.push('BT /F1 9 Tf 40 ' + y + ' Td (' + (k * PER + i + 1) + ') Tj 80 0 Td (' + pe(b.name) + ') Tj 150 0 Td (' + fmtHa(HzBlok.areaHa(b.pts)) + ') Tj 90 0 Td (' + (b.dir == null ? '-' : Math.round(b.dir) + ' deg') + ') Tj 80 0 Td (' + (lj[b.id] != null ? lj[b.id] : '-') + ') Tj ET');
        y -= 15;
      });
      if (k === np - 1) t.push('0.5 w 40 ' + (y + 11) + ' m 460 ' + (y + 11) + ' l S BT /F2 9 Tf 40 ' + (y - 2) + ' Td (Total) Tj 80 0 Td (' + list.length + ' blok) Tj 150 0 Td (' + fmtHa(tot) + ') Tj 170 0 Td (' + totLj + ') Tj ET');
      var ts = add(stream('', t.join('\n')));
      kids.push(add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 595.28 841.89] /Resources ' + res + ' /Contents ' + ts + ' 0 R >>'));
    }
    objs[cat - 1] = '<< /Type /Catalog /Pages ' + pages + ' 0 R /Names << /EmbeddedFiles << /Names [(hzblok.json) ' + fsp + ' 0 R] >> >> /AF [' + fsp + ' 0 R] >>';
    objs[pages - 1] = '<< /Type /Pages /Count ' + kids.length + ' /Kids [' + kids.map(function (i) { return i + ' 0 R'; }).join(' ') + '] >>';
    var out = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n', offs = [];
    objs.forEach(function (b, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + b + '\nendobj\n'; });
    var xr = out.length; out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offs.forEach(function (o) { out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R >>\nstartxref\n' + xr + '\n%%EOF\n';
    return out;
  }

  // ---------- baca data blok dari PDF buatan HZ Trip, dan pulihkan ----------
  function readHzBlok(file) {
    return file.arrayBuffer().then(function (buf) {
      var txt = new TextDecoder('latin1').decode(buf), i = txt.indexOf('{"hzblok":1'); if (i < 0) return null;
      var e = txt.indexOf('\nendstream', i); if (e < 0) return null;
      try { var d = JSON.parse(txt.slice(i, e).trim()); return d && d.hzblok === 1 && Array.isArray(d.blocks) ? d : null; } catch (x) { return null; }
    }).catch(function () { return null; });
  }
  function nk(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function restoreHzBlok(d) {
    var have = {}, ids = {}, add = 0, skip = 0, k = 0;
    blocks().forEach(function (b) { have[nk(b.name)] = 1; ids[String(b.id)] = 1; });
    d.blocks.forEach(function (b) {
      if (!b || !b.pts || b.pts.length < 3 || !b.name) return;
      if (have[nk(b.name)]) { skip++; return; }
      var nb = { id: b.id, src: b.src || 'manual', name: String(b.name), pts: b.pts, ovId: null, dir: b.dir == null ? null : b.dir, sp: b.sp == null ? null : b.sp, margin: +b.margin || 0, conf: !!b.conf, note: b.note || '' };
      if (b.guide) nb.guide = b.guide;
      if (nb.id == null || ids[String(nb.id)]) nb.id = Date.now() + (k++);
      ids[String(nb.id)] = 1; have[nk(nb.name)] = 1; blocks().push(nb); add++;
    });
    var mAdded = false;
    if (d.master && d.master.pts && d.master.pts.length >= 3 && !masters().some(function (m) { return nk(m.name) === nk(d.master.name); })) {
      masters().push({ id: Date.now() + 99999, name: String(d.master.name || 'Master'), pts: d.master.pts, inc: [], exc: [] }); mAdded = true;
    }
    if (add) S.settings.blkOn = true;
    saveSettings(); if (HA.drawBlocks) HA.drawBlocks(); if (HA.drawRows) HA.drawRows();
    return { added: add, skipped: skip, master: mAdded };
  }
})();
