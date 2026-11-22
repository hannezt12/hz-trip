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
  HA.masterMembers = function (m) { return members(m); };
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
    box.innerHTML = '<button class="btn pri" id="mkNew" style="width:100%;height:50px">Buat master baru</button>' + (ms.length ? '<button class="btn" id="mkIsi" style="width:100%;height:50px;margin-top:8px">Isi data (varietas, status, bulan tanam)</button>' : '') + '<div id="mkList" style="margin-top:10px"></div>' +
      '<div class="muted" style="margin:8px 2px">Master = poligon kawasan untuk cetak PDF. Hanya blok Terkonfirmasi yang seluruh bentuknya ada di dalam poligon yang tercetak; blok di perbatasan Han putuskan sendiri. Tampilan blok di peta tidak dibatasi master.</div>';
    if ($('mkIsi')) $('mkIsi').onclick = function () {
      var bk = function () { S.dpTab = 'master'; go('data'); };
      if (ms.length === 1) { HA.isiData(ms[0], bk); return; }
      openSheet('<div class="grab"></div><div class="st">ISI DATA: PILIH MASTER</div>' + ms.map(function (x) { var mm = members(x); return '<button class="btn" data-m="' + esc(String(x.id)) + '" style="width:100%;margin-top:6px;text-align:left">' + esc(x.name) + ' <span class="muted">· ' + (mm.in.length + mm.man.length) + ' blok</span></button>'; }).join('') + '<button class="btn" id="mkIsiX" style="width:100%;margin-top:10px">Batal</button>');
      $('mkIsiX').onclick = closeSheet;
      document.querySelectorAll('#sheet button[data-m]').forEach(function (b) { b.onclick = function () { var m2 = mById(b.getAttribute('data-m')); closeSheet(); if (m2) HA.isiData(m2, bk); }; });
    };
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
          { label: 'Isi data (varietas, status, bulan tanam)', fn: function () { HA.isiData(m, function () { S.dpTab = 'master'; go('data'); }); } },
          { label: 'Cetak (PDF atau KML)', fn: function () { PS.sel = m.id; printPanel(); } },
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
  function aturSheet(m, back) {
    function draw() {
      var mem = members(m), rows = mem.pend.concat(mem.man, mem.skip).sort(nat), inc = idset(m.inc), exc = idset(m.exc);
      openSheet('<div class="grab"></div><div class="bth"><div class="st">PERBATASAN · ' + esc(m.name) + '</div><button class="btn pri" id="atX">Selesai</button></div>' +
        '<button class="btn" id="atVr" style="width:100%">Versi simpanan master</button>' + '<div class="muted" style="margin:6px 0">Blok Terkonfirmasi yang sebagian keluar dari poligon. Pilih Masuk atau Tidak; ketuk lagi untuk membatalkan.</div>' +
        (rows.length ? rows.map(function (b) {
          var id = String(b.id), st = inc[id] ? 1 : exc[id] ? 2 : 0;
          return '<div class="lpi" style="gap:6px"><div class="nm"><b>' + esc(b.name) + '</b><small>' + fmtHa(HzBlok.areaHa(b.pts)) + ' ha' + (st ? '' : ' · belum diputuskan') + '</small></div>' +
            '<button class="btn sm' + (st === 1 ? ' pri' : '') + '" data-id="' + esc(id) + '" data-v="1">Masuk</button><button class="btn sm' + (st === 2 ? ' pri' : '') + '" data-id="' + esc(id) + '" data-v="2">Tidak</button></div>';
        }).join('') : '<div class="card muted">Tidak ada blok Terkonfirmasi di perbatasan master ini.</div>'));
      $('atVr').onclick = function () { if (HA.VM) HA.VM.open(m, function () { aturSheet(m, back); }); };
      $('atX').onclick = function () { closeSheet(); if (back) { back(); return; } S.dpTab = 'master'; if (S.view === 'data') HA.renderData(); };
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

  // ---------- keterangan (lajur tabel di kanan peta Master): Varietas, Bulan tanam, Status ----------
  var KT_ALL = [['var', 'Varietas'], ['bt', 'Bulan tanam'], ['st', 'Status tanaman']];
  function ktCfg() {
    var k = S.settings.kt; if (!k) k = S.settings.kt = { on: false, tabs: ['var', 'bt', 'st'], cols: { pc: true, rc: true, tot: true, pct: true } };
    if (!k.cols) k.cols = { pc: true, rc: true, tot: true, pct: true };
    KT_ALL.forEach(function (a) { if (!k.tabs) k.tabs = []; });
    return k;
  }
  function ktData(list, cfg) {
    var tot = 0, ls = HA.lyb, out = [];
    var haB = list.map(function (b) { var h = 0; try { h = HzBlok.areaHa(b.pts); } catch (e) {} tot += h; return h; });
    function grp(keyF, rowsDef) {
      var m = {}; rowsDef.forEach(function (r) { m[r.k] = { r: r, pc: 0, rc: 0, tot: 0 }; });
      list.forEach(function (b, i) {
        var k = keyF(b), g = m[k] || m['']; if (!g) return; var st = ls.of(b, 'status'), h = haB[i];
        g.tot += h; if (st && st.id === 'pc') g.pc += h; else if (st) g.rc += h;
      });
      return rowsDef.map(function (r) { return m[r.k]; }).filter(function (g) { return g.tot > 0.0001; });
    }
    var va = ls.by('varietas'), st = ls.by('status');
    (cfg.tabs || []).forEach(function (id) {
      if (id === 'var' && va) {
        var defs = va.items.map(function (it) { return { k: it.id, name: it.name, it: it }; }).concat([{ k: '', name: 'Belum diisi' }]);
        out.push({ id: id, title: 'Varietas', kind: 'pcrc', rows: grp(function (b) { var it = ls.of(b, 'varietas'); return it ? it.id : ''; }, defs) });
      } else if (id === 'bt') {
        var defb = ls.BN.map(function (n, i) { return { k: String(i + 1), name: n, col: ls.bulanCol(i + 1) }; }).concat([{ k: '', name: 'Belum diisi' }]);
        out.push({ id: id, title: 'Bulan tanam', kind: 'pcrc', rows: grp(function (b) { var m = ls.bulanOf(b); return m ? String(m) : ''; }, defb) });
      } else if (id === 'st' && st) {
        var defs2 = st.items.map(function (it) { return { k: it.id, name: it.name, sym: it.sym }; }).concat([{ k: '', name: 'Belum diisi' }]);
        var rs = grp(function (b) { var it = ls.of(b, 'status'); return it ? it.id : ''; }, defs2);
        out.push({ id: id, title: 'Status tanaman', kind: 'st', rows: rs });
      }
    });
    return { tot: tot, tabs: out };
  }
  // gambar lajur; kembalikan { ops, w } (w = lebar lajur total pt)
  function ktDraw(list, PW, PH, M, cfg, f2, hide) {
    var D = ktData(list, cfg), cols = cfg.cols || {}, RH = 11, FS = 7.5, cx = PW + 10, y = PH - M, maxX = cx, items = [];
    hide = hide || {};
    var pctF = function (v) { return D.tot > 0 ? (Math.round(v / D.tot * 1000) / 10).toFixed(1).replace('.', ',') + '%' : '-'; };
    var hf = function (v) { return v > 0.0001 ? fmtHa(v) : '-'; };
    var colw = 118, nw = 44;
    D.tabs.forEach(function (t) {
      if (hide['kt:' + t.id]) return;
      var hd = ['Nama'], keys = [], ops = [], bb = [1e9, 1e9, -1e9, -1e9];
      if (t.kind === 'pcrc') { if (cols.pc !== false) { hd.push('PC'); keys.push('pc'); } if (cols.rc !== false) { hd.push('RC'); keys.push('rc'); } if (cols.tot !== false) { hd.push('Total'); keys.push('tot'); } }
      else { hd.push('ha'); keys.push('tot'); }
      if (cols.pct !== false) { hd.push('%'); keys.push('pct'); }
      var tw = colw + keys.length * nw, rows = t.rows.map(function (g) { return { g: g }; }), tt = { pc: 0, rc: 0, tot: 0 };
      t.rows.forEach(function (g) { tt.pc += g.pc; tt.rc += g.rc; tt.tot += g.tot; });
      rows.push({ g: { r: { name: 'Total' }, pc: tt.pc, rc: tt.rc, tot: tt.tot }, bold: true });
      while (rows.length) {
        var avail = Math.floor((y - M - 14 - RH) / RH);
        if (avail < 3 && y < PH - M - 1) { cx = maxX + 8; y = PH - M; continue; }
        var take = rows.splice(0, Math.max(3, Math.min(rows.length, avail)));
        var H = 14 + RH * (take.length + 1), top = y;
        bb[0] = Math.min(bb[0], cx); bb[2] = Math.max(bb[2], cx + tw); bb[3] = Math.max(bb[3], top); bb[1] = Math.min(bb[1], top - H);
        ops.push('0 g BT /F2 9 Tf ' + f2(cx) + ' ' + f2(top - 9) + ' Td (' + pe(t.title) + ') Tj ET');
        var ty = top - 14 - RH;
        ops.push('0.9 g ' + f2(cx) + ' ' + f2(ty) + ' ' + f2(tw) + ' ' + f2(RH) + ' re f 0 g 0.4 w 0 G ' + f2(cx) + ' ' + f2(ty) + ' ' + f2(tw) + ' ' + f2(RH) + ' re S');
        hd.forEach(function (h, i) { ops.push('BT /F2 ' + FS + ' Tf ' + f2(i ? cx + colw + (i - 1) * nw + nw - 3 - h.length * FS * 0.52 : cx + 3) + ' ' + f2(ty + 3) + ' Td (' + pe(h) + ') Tj ET'); });
        take.forEach(function (r, ri) {
          var ry = ty - RH * (ri + 1), g = r.g;
          ops.push('0.4 w 0 G ' + f2(cx) + ' ' + f2(ry) + ' ' + f2(tw) + ' ' + f2(RH) + ' re S');
          var nx = cx + 3;
          if (g.r && g.r.col) { ops.push('q ' + HA.lyb.rgb(g.r.col) + ' rg ' + f2(cx + 2) + ' ' + f2(ry + 2) + ' 12 7 re f 0 G 0.3 w ' + f2(cx + 2) + ' ' + f2(ry + 2) + ' 12 7 re S Q'); nx = cx + 17; }
          else if (g.r && g.r.it) { ops.push(HA.lyb.swatchPdf(g.r.it, cx + 2, ry + 2, 12, 7)); nx = cx + 17; }
          else if (g.r && g.r.sym) {
            if (HA.lyb.isVec(g.r.sym)) ops.push(HA.lyb.symPdf(cx + 9, ry + RH / 2, 8, g.r.sym, 0)); else ops.push('0 g BT /F2 ' + FS + ' Tf ' + f2(cx + 2) + ' ' + f2(ry + 3) + ' Td (' + pe(g.r.sym) + ') Tj ET');
            nx = cx + 19;
          }
          var nm = String(g.r ? g.r.name : ''), maxc = Math.floor((colw - (nx - cx) - 2) / (FS * 0.5)); if (nm.length > maxc) nm = nm.slice(0, Math.max(1, maxc - 1)) + '.';
          ops.push('0 g BT /F' + (r.bold ? 2 : 1) + ' ' + FS + ' Tf ' + f2(nx) + ' ' + f2(ry + 3) + ' Td (' + pe(asc(nm)) + ') Tj ET');
          keys.forEach(function (k, i) {
            var v = k === 'pct' ? pctF(g.tot) : hf(g[k]);
            ops.push('0 g BT /F' + (r.bold ? 2 : 1) + ' ' + FS + ' Tf ' + f2(cx + colw + i * nw + nw - 3 - v.length * FS * 0.52) + ' ' + f2(ry + 3) + ' Td (' + pe(v) + ') Tj ET');
          });
        });
        y = top - H - 8; if (cx + tw > maxX) maxX = cx + tw;
      }
      items.push({ id: t.id, name: t.title, ops: ops.join('\n'), bb: bb });
    });
    return { items: items, w: items.length ? (maxX - PW) + 10 : 0 };
  }

  // ---------- cetak (drawer > Cetak > Master) ----------
  function ribu(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fsNum(v) { var l = { s: 5, m: 7.5, l: 11 }[v]; if (l) return l; var n = parseFloat(v); return isFinite(n) ? n : null; }
  var PS = { sel: null, fmt: 'pdf', map: true, list: false, title: '', paper: 'auto', ori: 'auto', oSk: true, oIn: true, oLg: true, fs: (function () { try { var v = localStorage.getItem('hz_pmfs'); return v && isFinite(parseFloat(v)) ? parseFloat(v) : 'a'; } catch (e) { return 'a'; } })(), pos: 'c', luas: (function () { try { return localStorage.getItem('hz_pmluas') !== '0'; } catch (e) { return true; } })() };
  function ktPanel() {
    var k = ktCfg(), h = '<div class="h">KETERANGAN (lajur tabel di kanan peta)</div><label><input type="checkbox" id="pmKt"' + (k.on ? ' checked' : '') + '> Tampilkan lajur keterangan (kertas dilebarkan ke kanan)</label>';
    if (k.on) {
      var order = (k.tabs || []).slice(); KT_ALL.forEach(function (a) { if (order.indexOf(a[0]) < 0) order.push(a[0]); });
      h += '<div class="lbList" id="pmKtL">' + order.map(function (id, i) {
        var nm = ''; KT_ALL.forEach(function (a) { if (a[0] === id) nm = a[1]; });
        return '<div class="lbRow" style="min-height:2.5rem;align-items:center;gap:6px"><input type="checkbox" data-kt="' + id + '"' + ((k.tabs || []).indexOf(id) >= 0 ? ' checked' : '') + '><span style="flex:1">' + nm + '</span><button class="btn sm" data-ku="' + id + '"' + (i ? '' : ' disabled') + '>\u2191</button><button class="btn sm" data-kd="' + id + '"' + (i < order.length - 1 ? '' : ' disabled') + '>\u2193</button></div>';
      }).join('') + '</div>' +
      '<div class="muted" style="margin:6px 0 2px">Kolom (Varietas dan Bulan tanam)</div><div class="row" style="gap:10px;flex-wrap:wrap">' + [['pc', 'PC'], ['rc', 'RC'], ['tot', 'Total'], ['pct', '%']].map(function (c) { return '<label><input type="checkbox" data-kc="' + c[0] + '"' + (k.cols[c[0]] !== false ? ' checked' : '') + '> ' + c[1] + '</label>'; }).join('') + '</div>' +
      '<div class="muted" style="margin-top:4px">Satuan ha. Urutan tabel bisa diubah dengan tombol panah.</div>';
    }
    return h + '<label style="margin-top:6px"><input type="checkbox" id="pmBt"' + (S.settings.btOn ? ' checked' : '') + '> Garis tepi bulan tanam (warna dan tebal di menu Lapisan)</label><label><input type="checkbox" id="pmHalo"' + (S.settings.halo !== false ? ' checked' : '') + '> Halo teks (garis putih di sekeliling teks)</label>';
  }
  function ktWire(rerender) {
    var k = ktCfg();
    if ($('pmKt')) $('pmKt').onchange = function () { k.on = this.checked; saveSettings(); rerender(); };
    if ($('pmBt')) $('pmBt').onchange = function () { S.settings.btOn = this.checked; saveSettings(); };
    if ($('pmHalo')) $('pmHalo').onchange = function () { S.settings.halo = this.checked; saveSettings(); };
    var L2 = $('pmKtL'); if (!L2) return;
    function order() { var o = (k.ord || k.tabs || []).slice(); KT_ALL.forEach(function (a) { if (o.indexOf(a[0]) < 0) o.push(a[0]); }); return o; }
    L2.onchange = function (e) { var id = e.target.getAttribute && e.target.getAttribute('data-kt'); if (!id) return; var o = order(), on = {}; (k.tabs || []).forEach(function (t) { on[t] = 1; }); on[id] = e.target.checked ? 1 : 0; k.tabs = o.filter(function (t) { return on[t]; }); k.ord = o; saveSettings(); };
    L2.onclick = function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b) return; var u = b.getAttribute('data-ku'), d = b.getAttribute('data-kd'), id = u || d; if (!id) return;
      var o = k.ord || order(), i = o.indexOf(id), j = u ? i - 1 : i + 1; if (j < 0 || j >= o.length) return; var t = o[i]; o[i] = o[j]; o[j] = t; k.ord = o;
      var on = {}; (k.tabs || []).forEach(function (x) { on[x] = 1; }); k.tabs = o.filter(function (x) { return on[x]; }); saveSettings(); rerender();
    };
    $('sheet').querySelectorAll('[data-kc]').forEach(function (e) { e.onchange = function () { k.cols[e.getAttribute('data-kc')] = e.checked; saveSettings(); }; });
  }
  function pdOpen(k) { return PS.open && PS.open[k] ? ' open' : ''; }
  function printPanel() {
    var ms = masters(); ms.forEach(function (m, i) { if (m.id == null) m.id = Date.now() + i; });
    if (!mById(PS.sel)) PS.sel = ms.length ? ms[0].id : null;
    var m = mById(PS.sel), mem = m ? members(m) : null;
    openSheet('<div class="grab"></div><div class="st">CETAK</div>' +
      '<div class="seg" id="pmMode" style="margin:6px 0 10px"><button data-m="trip">Trip</button><button data-m="master" class="on">Master</button><button data-m="laporan">Laporan</button></div>' +
      (ms.length ? tplRow() + '<div class="plist"><div class="h">MASTER</div>' + ms.map(function (x) {
        var mm = members(x), n = mm.in.length + mm.man.length;
        return '<label><input type="radio" name="pmSel" value="' + esc(String(x.id)) + '"' + (String(x.id) === String(PS.sel) ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">· ' + n + ' blok · ' + fmtHa(haOf(mm.in.concat(mm.man))) + ' ha' + (mm.pend.length ? ' · ' + mm.pend.length + ' perlu diatur' : '') + '</span></label>';
      }).join('') +
        '<div class="h">FORMAT (pilih satu)</div><div class="seg" id="pmFmt"><button data-f="pdf"' + (PS.fmt === 'pdf' ? ' class="on"' : '') + '>PDF</button><button data-f="kml"' + (PS.fmt === 'kml' ? ' class="on"' : '') + '>KML</button><button data-f="data"' + (PS.fmt === 'data' ? ' class="on"' : '') + '>Data blok</button></div>' +
        (PS.fmt === 'pdf' ? '<details data-pd="isi"' + pdOpen('isi') + '><summary>ISI PDF</summary><label><input type="checkbox" id="pmMap"' + (PS.map ? ' checked' : '') + '> Peta (satu lembar, ber-geo)</label><label><input type="checkbox" id="pmLuas"' + (PS.luas ? ' checked' : '') + '> Tampilkan luas di peta</label><label><input type="checkbox" id="pmList"' + (PS.list ? ' checked' : '') + '> Daftar blok lengkap</label></details>' +
          (HA.lyb && (HA.lyb.all().some(function (l) { return l.items.length; }) || (HA.obj && HA.obj.objs().length)) ? '<details data-pd="lap"' + pdOpen('lap') + '><summary>LAPISAN BLOK (layer PDF)</summary>' + HA.lyb.all().filter(function (l) { return l.items.length; }).map(function (l) { return '<label><input type="checkbox" data-lyo="' + l.id + '"' + (l.on ? ' checked' : '') + '> ' + esc(l.name) + '</label>'; }).join('') + (HA.obj && HA.obj.objs().length ? '<label><input type="checkbox" data-lyo="__obj"' + (HA.obj.on() ? ' checked' : '') + '> Objek (' + HA.obj.objs().length + ')</label>' : '') + '</details>' : '') +
          '<details data-pd="kr"' + pdOpen('kr') + '><summary>KERTAS DAN ELEMEN</summary><div class="row" style="gap:6px;margin-top:6px"><select id="pmPp" style="flex:1;min-width:0">' + [['auto', 'Otomatis'], ['a4', 'A4'], ['a3', 'A3'], ['a2', 'A2'], ['f4', 'F4']].map(function (x) { return '<option value="' + x[0] + '"' + (PS.paper === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select><select id="pmOr" style="flex:1;min-width:0">' + [['auto', 'Otomatis'], ['p', 'Tegak'], ['l', 'Datar']].map(function (x) { return '<option value="' + x[0] + '"' + (PS.ori === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
          '<label><input type="checkbox" id="pmSk"' + (PS.oSk ? ' checked' : '') + '> Skala</label><label><input type="checkbox" id="pmIn"' + (PS.oIn ? ' checked' : '') + '> Tabel info</label><label><input type="checkbox" id="pmLg"' + (PS.oLg ? ' checked' : '') + '> Legenda lapisan</label></details>' +
          '<details data-pd="kt"' + pdOpen('kt') + '><summary>KETERANGAN, KOLOM, GARIS DAN HALO</summary>' + ktPanel() + '</details>' +
          '<div class="h">JUDUL</div><input type="text" id="pmTtl" maxlength="60" placeholder="Kosong = nama master" value="' + esc(PS.title) + '" style="width:100%">' +
          '<div class="h">UKURAN TEKS NO BLOK (pt)</div><input type="number" id="pmFn" min="1" max="30" step="0.5" inputmode="decimal" placeholder="Otomatis (kosong)" value="' + (fsNum(PS.fs) != null ? fsNum(PS.fs) : '') + '" style="width:100%;text-align:center"><div class="muted" style="margin-top:2px">Kosong = otomatis. Pilihan terakhir tersimpan. Luas ikut ukuran ini.</div>'+
          ''
          : PS.fmt === 'data' ? '<div class="muted" style="margin-top:6px">Satu berkas ringan (Zip berisi .hzblok, tanpa gambar): blok Terkonfirmasi di dalam master ini. Penerima membukanya di HZ Trip; hanya blok baru yang ditambahkan.</div>' : '<div class="muted" style="margin-top:6px">KML berisi bentuk dan posisi blok serta batas master, tanpa luasan.</div>') +
        '</div>' +
        '<div class="muted" id="pmInfo" style="margin-top:8px">' + (mem ? (mem.in.length + mem.man.length) + ' blok akan dicetak' + (mem.pend.length ? ' · ' + mem.pend.length + ' blok perbatasan belum diputuskan' : '') : '') + '</div>' +
        '<button class="btn" id="pmAtur" style="width:100%;margin-top:6px">Atur blok perbatasan</button><button class="btn" id="pmVer" style="width:100%;margin-top:6px">Versi simpanan master</button>' +
        (PS.fmt === 'pdf' && PS.map ? '<button class="btn" id="pmPosB" style="width:100%;margin-top:6px">Atur posisi teks blok</button>' : '') +
        (PS.fmt === 'pdf' ? '<button class="btn" id="pmPrev" style="width:100%;margin-top:8px">Atur tata letak</button>' : '') + '<button class="btn pri" id="pmGo" style="width:100%;margin-top:8px;height:52px">' + (PS.fmt === 'data' ? 'Kirim data blok' : 'Cetak ' + (PS.fmt === 'pdf' ? 'PDF' : 'KML')) + '</button>'
        : '<div class="card muted" style="margin-top:6px">Belum ada master. Buat di Data peta > Master: gambar poligon kawasan, lalu kembali ke sini untuk mencetak.</div>') +
      '<button class="btn" id="pmX" style="width:100%;margin-top:8px">Tutup</button>');
    $('pmX').onclick = closeSheet;
    $('sheet').querySelectorAll('details[data-pd]').forEach(function (d) { d.ontoggle = function () { (PS.open = PS.open || {})[d.getAttribute('data-pd')] = d.open; }; });
    ktWire(printPanel); tplWire(m);
    $('pmMode').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-m]'); if (!b) return; var md = b.getAttribute('data-m'); if (md === 'trip') { closeSheet(); HA.openPrint({ day: S.hDay }); } else if (md === 'laporan' && HA.openLaporan) { closeSheet(); HA.openLaporan(); } };
    if (!ms.length) return;
    $('sheet').querySelectorAll('input[name=pmSel]').forEach(function (r) { r.onchange = function () { PS.sel = r.value; var tid = (S.settings.mTplBy || {})[String(r.value)], tt = tid && tplBy(tid); if (tt) { applySnap(tt.v); S.settings.mTplCur = tt.id; saveSettings(); toast('Template "' + tt.name + '" dipakai'); } printPanel(); }; });
    $('pmFmt').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-f]'); if (b) { PS.fmt = b.getAttribute('data-f'); printPanel(); } };
    if ($('pmPp')) { $('pmPp').onchange = function () { PS.paper = this.value; }; $('pmOr').onchange = function () { PS.ori = this.value; }; $('pmSk').onchange = function () { PS.oSk = this.checked; }; $('pmIn').onchange = function () { PS.oIn = this.checked; }; $('pmLg').onchange = function () { PS.oLg = this.checked; }; }
    if ($('pmLuas')) $('pmLuas').onchange = function () { PS.luas = this.checked; try { localStorage.setItem('hz_pmluas', this.checked ? '1' : '0'); } catch (e) {} };
    if ($('pmTtl')) {
      $('pmTtl').oninput = function () { PS.title = this.value; };
      (function () {
        $('pmFn').onchange = function () { var v = parseFloat(String(this.value).replace(',', '.')); if (isFinite(v)) { v = Math.max(1, Math.min(30, Math.round(v * 2) / 2)); PS.fs = v; this.value = v; } else { PS.fs = 'a'; this.value = ''; } try { localStorage.setItem('hz_pmfs', String(PS.fs)); } catch (e) {} };
        })();
    }
    if ($('pmPrev')) $('pmPrev').onclick = function () {
      if (!PS.map) { toast('Centang Peta untuk mengatur tata letak'); return; }
      closeSheet(); layEd(m, printPanel);
    };
    $('sheet').querySelectorAll('[data-lyo]').forEach(function (e) { e.onchange = function () { var k = e.getAttribute('data-lyo'); if (k === '__obj') S.settings.objOn = e.checked; else HA.lyb.by(k).on = e.checked; saveSettings(); }; });
    if ($('pmMap')) { $('pmMap').onchange = function () { PS.map = this.checked; }; $('pmList').onchange = function () { PS.list = this.checked; }; }
    $('pmAtur').onclick = function () { aturSheet(m, printPanel); };
    $('pmVer').onclick = function () { if (HA.VM) HA.VM.open(m, printPanel); };
    if ($('pmPosB')) $('pmPosB').onclick = function () {
      var mm = members(m), lst = mm.in.concat(mm.man); if (!lst.length) { toast('Belum ada blok yang dicetak'); return; }
      if (HA.lpPos) { closeSheet(); HA.lpPos(m, { list: lst, fs: fsNum(PS.fs) || 4, bw: 1, kNo: true, luas: PS.luas, back: printPanel }); }
    };
    $('pmGo').onclick = function () {
      if (PS.fmt === 'data') {
        var mm2 = members(m), lst2 = mm2.in.concat(mm2.man); if (!lst2.length) { toast('Belum ada blok Terkonfirmasi di master ini'); return; }
        var d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; }, st = p2(d.getDate()) + p2(d.getMonth() + 1) + String(d.getFullYear()).slice(2);
        var data = { hzblok: 1, app: 'HZ Trip', tgl: p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear(), master: { name: m.name, pts: m.pts }, blocks: lst2.map(function (b) { return { id: b.id, name: b.name, src: b.src || 'manual', pts: b.pts, dir: b.dir == null ? null : b.dir, sp: b.sp == null ? null : b.sp, margin: b.margin || 0, conf: !!b.conf, note: b.note || '', guide: b.guide || null, lblOff: b.lblOff || null }; }) };
        HA.saveHzBlokZip('Master_' + String(m.name).replace(/[^\w\-]+/g, '_') + '_' + st, JSON.stringify(data));
        return;
      }
      if (PS.fmt === 'pdf' && !PS.map && !PS.list) { toast('Centang minimal Peta atau Daftar blok'); return; }
      (S.settings.mTplBy = S.settings.mTplBy || {})[String(PS.sel)] = tplCur(); saveSettings();
      cetak(m, PS.fmt, curOpts());
    };
  }
  // ---------- template cetak (setelan hasil cetak) ----------
  function tplList() { return S.settings.mTpl || (S.settings.mTpl = []); }
  function snap() {
    var ly = {}; HA.lyb.all().forEach(function (l) { ly[l.id] = !!l.on; }); ly.__obj = S.settings.objOn !== false;
    var k = ktCfg();
    return { paper: PS.paper, ori: PS.ori, oSk: !!PS.oSk, oIn: !!PS.oIn, oLg: !!PS.oLg, map: !!PS.map, list: !!PS.list, luas: !!PS.luas, fs: PS.fs, pos: PS.pos, ly: ly, bt: !!S.settings.btOn, halo: S.settings.halo !== false,
      kt: { on: !!k.on, tabs: (k.tabs || []).slice(), ord: k.ord ? k.ord.slice() : null, cols: { pc: k.cols.pc !== false, rc: k.cols.rc !== false, tot: k.cols.tot !== false, pct: k.cols.pct !== false } },
      lay: JSON.parse(JSON.stringify(S.settings.mLay || {})) };
  }
  function stdSnap() {
    var ly = {}; HA.lyb.all().forEach(function (l) { ly[l.id] = true; }); ly.__obj = true;
    return { paper: 'auto', ori: 'auto', oSk: true, oIn: true, oLg: true, map: true, list: false, luas: true, fs: 'a', pos: 'c', ly: ly, bt: false, halo: true, kt: { on: false, tabs: ['var', 'bt', 'st'], ord: null, cols: { pc: true, rc: true, tot: true, pct: true } }, lay: {} };
  }
  function applySnap(v) {
    PS.paper = v.paper || 'auto'; PS.ori = v.ori || 'auto'; PS.oSk = v.oSk !== false; PS.oIn = v.oIn !== false; PS.oLg = v.oLg !== false;
    PS.map = v.map !== false; PS.list = !!v.list; PS.luas = v.luas !== false; PS.fs = v.fs == null ? 'a' : v.fs; PS.pos = v.pos || 'c';
    HA.lyb.all().forEach(function (l) { l.on = v.ly && v.ly[l.id] !== undefined ? !!v.ly[l.id] : true; });
    S.settings.objOn = v.ly && v.ly.__obj !== undefined ? !!v.ly.__obj : true;
    S.settings.btOn = !!v.bt; S.settings.halo = v.halo !== false;
    var k = ktCfg(), kv = v.kt || {}; k.on = !!kv.on; k.tabs = (kv.tabs || []).slice(); k.ord = kv.ord ? kv.ord.slice() : null; k.cols = { pc: !kv.cols || kv.cols.pc !== false, rc: !kv.cols || kv.cols.rc !== false, tot: !kv.cols || kv.cols.tot !== false, pct: !kv.cols || kv.cols.pct !== false };
    S.settings.mLay = JSON.parse(JSON.stringify(v.lay || {}));
    try { localStorage.setItem('hz_pmluas', PS.luas ? '1' : '0'); } catch (e) {}
    saveSettings();
  }
  function tplBy(id) { if (id === 'std') return { id: 'std', name: 'Standar', v: stdSnap() }; return tplList().filter(function (t) { return t.id === id; })[0]; }
  function tplCur() { var c = S.settings.mTplCur || 'std'; return tplBy(c) ? c : 'std'; }
  function tplDirty() { var t = tplBy(tplCur()); return t ? JSON.stringify(snap()) !== JSON.stringify(t.v) : false; }
  function tplRow() {
    var cur = tplCur(), dirty = tplDirty();
    return '<div class="h">TEMPLATE</div><div class="row" style="gap:6px"><select id="pmTpl" style="flex:1;min-width:0">' +
      [tplBy('std')].concat(tplList()).map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.name) + (x.id === cur && dirty ? ' (diubah)' : '') + '</option>'; }).join('') +
      '</select><button class="btn sm" id="pmTpS">Simpan baru</button></div><div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" id="pmTpU" style="flex:1"' + (cur === 'std' || !dirty ? ' disabled' : '') + '>Perbarui</button><button class="btn sm" id="pmTpD" style="flex:1"' + (cur === 'std' ? ' disabled' : '') + '>Hapus</button></div>';
  }
  function tplNameSheet(back, done) {
    openSheet('<div class="grab"></div><div class="st">SIMPAN TEMPLATE</div><div class="muted" style="margin:6px 0">Menyimpan setelan cetak sekarang: isi PDF, lapisan, keterangan, dan tata letak.</div><input type="text" id="tpNm" maxlength="30" placeholder="Nama template, mis. A3 tiga tabel" style="width:100%"><button class="btn pri" id="tpOk" style="width:100%;margin-top:10px;height:48px">Simpan</button><button class="btn" id="tpNo" style="width:100%;margin-top:8px">Batal</button>');
    $('tpNm').focus(); $('tpNo').onclick = back;
    $('tpOk').onclick = function () { var n = $('tpNm').value.trim(); if (!n) { toast('Isi nama template'); return; } done(n); };
  }
  function tplWire(m) {
    if (!$('pmTpl')) return;
    function remember(id) { S.settings.mTplCur = id; (S.settings.mTplBy = S.settings.mTplBy || {})[String(PS.sel)] = id; saveSettings(); }
    $('pmTpl').onchange = function () { var t = tplBy(this.value); if (!t) return; applySnap(t.v); remember(t.id); toast('Template "' + t.name + '" dipakai'); printPanel(); };
    $('pmTpS').onclick = function () { tplNameSheet(printPanel, function (n) { var id = 't' + Date.now().toString(36); tplList().push({ id: id, name: n, v: snap() }); remember(id); toast('Template disimpan'); printPanel(); }); };
    $('pmTpU').onclick = function () { var t = tplBy(tplCur()); if (!t || t.id === 'std') return; askConfirm('Perbarui template', 'Timpa "' + t.name + '" dengan setelan sekarang?', 'Perbarui', function () { t.v = snap(); saveSettings(); toast('Template diperbarui'); printPanel(); }); };
    $('pmTpD').onclick = function () { var t = tplBy(tplCur()); if (!t || t.id === 'std') return; askConfirm('Hapus template', 'Hapus template "' + t.name + '"? Setelan cetak sekarang tidak berubah.', 'Hapus', function () { S.settings.mTpl = tplList().filter(function (x) { return x.id !== t.id; }); var by = S.settings.mTplBy || {}; Object.keys(by).forEach(function (k) { if (by[k] === t.id) delete by[k]; }); S.settings.mTplCur = 'std'; saveSettings(); printPanel(); }); };
  }
  function curOpts() { return { paper: PS.paper, ori: PS.ori, oSk: PS.oSk, oIn: PS.oIn, oLg: PS.oLg, map: PS.map, list: PS.list, luas: PS.luas, title: PS.title, fs: PS.fs, pos: PS.pos, lay: S.settings.mLay || {} }; }
  function slug(t) { var r = String(t || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^master-(?=.)/, '').slice(0, 24); return r || 'x'; }
  function pdfName(m) { return 'M-' + slug(m.name) + '-' + (PS.paper && PS.paper !== 'auto' ? PS.paper : 'a3') + '.pdf'; }

  // ---------- editor tata letak (preview yang bisa digeser) ----------
  function prep(m, cb) {
    var mem = members(m);
    if (!mem.in.length && !mem.man.length) { toast('Belum ada blok Terkonfirmasi yang seluruhnya di dalam master ini'); return; }
    var list = mem.in.concat(mem.man).sort(nat), lj = {}, i = 0;
    (function nx() {
      if (i >= list.length) { cb(list, lj, mem); return; }
      var b = list[i++];
      if (b.dir != null) { try { var r = HA.rowsFor(b, b.dir, +(b.sp || S.settings.rowSp || 1.5), +b.margin || 0); lj[b.id] = { n: r.n, total: r.total }; } catch (e) {} }
      if (i % 25 === 0) setTimeout(nx, 0); else nx();
    })();
  }
  function layEd(m, back) {
    toast('Menyiapkan…');
    prep(m, function (list, lj, mem) {
      function cl(o) { return JSON.parse(JSON.stringify(o)); }
      var lay = cl(S.settings.mLay || {}); lay.obj = lay.obj || {}; lay.hide = {}; lay.map = lay.map || {}; lay.mapPos = lay.mapPos || 'c';
      var init = JSON.stringify(lay), hist = [init], hi = 0, out = {}, F = {}, sel = null, zoom = 1, first = 0, busy = false, again = false, SC = 1, bmp = null;
      var old = document.getElementById('lyEd'); if (old) old.remove();
      var el = document.createElement('div'); el.id = 'lyEd'; el.className = 'lyEd';
      el.innerHTML = '<div class="lyh"><button class="btn sm" id="lyBk">Batal</button><button class="btn sm" id="lyUn">Urung</button><div class="seg lyps" id="lyPs"><button data-p="l">Kiri</button><button data-p="c">Tengah</button><button data-p="r">Kanan</button></div><button class="btn pri sm" id="lyGo">Simpan</button></div>' +
        '<div class="lyw" id="lyW"><div class="lyp" id="lyP"></div></div><div class="lymsg" id="lyMsg">Menyiapkan…</div><div class="lyhint">Seret frame. Cubit frame = ubah ukuran. Cubit di ruang kosong = zoom. Posisi peta: Kiri / Tengah / Kanan.</div>';
      document.body.appendChild(el);
      var $e = function (id) { return el.querySelector('#' + id); }, P = $e('lyP'), W = $e('lyW');
      function dirty() { return JSON.stringify(lay) !== init; }
      function snapF() { var o = {}; Object.keys(F).forEach(function (k) { o[k] = [F[k].x0, F[k].y0, F[k].x1, F[k].y1]; }); return o; }
      function setMapPos(p) {
        var mf = F.map; if (!mf) return; var old = lay.mapPos, w = mf.x1 - mf.x0, M0 = out.M || 24, PWp = out.PW, nx = p === 'l' ? M0 : p === 'r' ? PWp - M0 - w : (PWp - w) / 2, dxm = nx - mf.x0;
        Object.keys(F).forEach(function (k) {
          var f = F[k], ww = f.x1 - f.x0; if (k === 'map' || k === 'judul' || (lay.obj[k] && lay.obj[k].x != null)) return;
          if (k.indexOf('kt:') === 0) {
            if (out.paper === 'auto' || !out.paper) { var nowL = (out.OX || 0) < 0, wantL = p === 'r'; if (nowL !== wantL && out.TW) { var dl = wantL ? -(out.TW + PWp + 10) : (out.TW + PWp + 10); f.x0 += dl; f.x1 += dl; } }
            else if ((old === 'l' && p === 'r') || (old === 'r' && p === 'l')) { f.x0 = PWp - f.x1; f.x1 = f.x0 + ww; }
            return;
          }
          f.x0 = Math.max(M0, Math.min(PWp - M0 - ww, f.x0 + dxm)); f.x1 = f.x0 + ww;
        });
        if (out.paper === 'auto' || !out.paper) out.OX = p === 'r' ? -(out.TW || 0) : 0;
        mf.x0 = nx; mf.x1 = nx + w; lay.mapPos = p; delete lay.map.dx; delete lay.map.dy; layout(); push();
      }
      function push() { var j = JSON.stringify({ l: lay, f: snapF(), ox: out.OX || 0 }); if (j === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(j); hi = hist.length - 1; ui(); }
      function ui() {
        $e('lyUn').disabled = hi <= 0;
        el.querySelectorAll('#lyPs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-p') === lay.mapPos); });
      }
      function closeEd() { HA.layBack = null; el.remove(); }
      function dims() { var PWt = (out.PW || 1190) + (out.TW || 0), PH = out.PH || 842, k = Math.max(0.05, 0.8 * (W.clientWidth || 360) / (out.PW || 1190)) * zoom; return { PWt: PWt, PH: PH, k: k, ox: -(out.OX || 0) }; }
      function toU8(b) { var u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i) & 255; return u; }
      function rend(u8, cv) {
        return HA.loadPdfJs().then(function (lib) { return lib.getDocument({ data: u8 }).promise; }).then(function (doc) { return doc.getPage(1); }).then(function (pg) {
          var v0 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: SC = Math.min(2, 1500 / v0.width) });
          cv.width = Math.ceil(v.width); cv.height = Math.ceil(v.height);
          return pg.render({ canvasContext: cv.getContext('2d'), viewport: v, background: 'rgba(0,0,0,0)' }).promise;
        });
      }
      function layout() {
        var d = dims(), ph = d.PH * d.k; P.style.width = (d.PWt * d.k) + 'px'; P.style.height = ph + 'px'; P.style.marginTop = Math.max(0, ((W.clientHeight || 0) - ph) / 2) + 'px';
        Object.keys(F).forEach(function (id) { var f = F[id]; f.el.style.left = ((f.x0 + d.ox) * d.k) + 'px'; f.el.style.top = ((d.PH - f.y1) * d.k) + 'px'; f.el.style.width = ((f.x1 - f.x0) * d.k) + 'px'; f.el.style.height = ((f.y1 - f.y0) * d.k) + 'px'; f.el.classList.toggle('on', sel === id); });
      }
      function frames(cm, co) {
        P.innerHTML = ''; F = {};
        Object.keys(out.rects || {}).forEach(function (id) {
          var r = out.rects[id]; if (r.hid || r.x0 == null) return;
          var f = { id: id, name: r.name, map: !!r.map, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, bw: r.bw, bh: r.bh }, src = r.map ? cm : co;
          var cv = document.createElement('canvas'), w = Math.max(1, Math.round((r.x1 - r.x0) * SC)), h = Math.max(1, Math.round((r.y1 - r.y0) * SC));
          cv.width = w; cv.height = h; try { cv.getContext('2d').drawImage(src, Math.round((r.x0 - (out.OX || 0)) * SC), Math.round(src.height - r.y1 * SC), w, h, 0, 0, w, h); } catch (e) {}
          var d = document.createElement('div'); d.className = 'lyf' + (f.map ? ' lyMap' : ''); d.setAttribute('data-id', id); d.appendChild(cv);
          var sp = document.createElement('span'); sp.textContent = r.name; d.appendChild(sp); P.appendChild(d); f.el = d; F[id] = f;
        });
        layout(); if (!first) { first = 1; hist = [JSON.stringify({ l: lay, f: snapF(), ox: out.OX || 0 })]; hi = 0; } ui();
      }
      function rebuild() {
        if (busy) { again = true; return; } busy = true; $e('lyMsg').style.display = ''; $e('lyMsg').textContent = 'Menyiapkan…';
        setTimeout(function () {
          var o1 = Object.assign({}, curOpts(), { lay: cl(lay), layOut: {}, edNoObj: true }), o2 = Object.assign({}, curOpts(), { lay: cl(lay), layOut: {}, edNoMap: true }), b1, b2;
          try { b1 = buildPdfBytes(m, list, lj, mem, o1); b2 = buildPdfBytes(m, list, lj, mem, o2); } catch (e) { $e('lyMsg').textContent = 'Gagal menyusun: ' + (e && e.message || e); busy = false; return; }
          out = o2.layOut; var cm = document.createElement('canvas'), co = document.createElement('canvas');
          rend(toU8(b1), cm).then(function () { return rend(toU8(b2), co); }).then(function () { frames(cm, co); $e('lyMsg').style.display = 'none'; })
            .catch(function (e) { $e('lyMsg').textContent = 'Preview tidak tersedia (' + (e && e.message || e) + ')'; }).then(function () { busy = false; if (again) { again = false; rebuild(); } });
        }, 20);
      }
      // simpan posisi manual satu frame ke tata letak
      function rec(id) { var f = F[id]; if (!f || f.map) return; lay.obj[id] = { x: f.x0 / out.PW, y: f.y1 / out.PH, s: Math.max(0.3, Math.min(3, (f.x1 - f.x0) / f.bw)) }; }
      // dorong frame lain bila terlalu dekat
      function pushAway(id) {
        var gap = 4, n = 0, again2 = true, d = dims();
        while (again2 && n++ < 4) {
          again2 = false;
          Object.keys(F).forEach(function (k) {
            if (k === id || F[k].map || F[id].map) return; var a = F[id], b = F[k];
            if (a.x0 < b.x1 + gap && a.x1 + gap > b.x0 && a.y0 < b.y1 + gap && a.y1 + gap > b.y0) {
              var px = Math.min(a.x1 + gap - b.x0, b.x1 + gap - a.x0), py = Math.min(a.y1 + gap - b.y0, b.y1 + gap - a.y0), w = b.x1 - b.x0, h = b.y1 - b.y0;
              if (px < py) { var sx = (b.x0 + b.x1) / 2 >= (a.x0 + a.x1) / 2 ? 1 : -1; b.x0 += sx * px; } else { var sy = (b.y0 + b.y1) / 2 >= (a.y0 + a.y1) / 2 ? 1 : -1; b.y0 += sy * py; }
              b.x0 = Math.max(-d.ox, Math.min(d.PWt - d.ox - w, b.x0)); b.y0 = Math.max(0, Math.min(d.PH - h, b.y0)); b.x1 = b.x0 + w; b.y1 = b.y0 + h; rec(k); again2 = true;
            }
          });
        }
      }
      // gestur: seret / cubit
      var ptr = {}, g = null;
      function np() { return Object.keys(ptr).length; }
      function dist() { var k = Object.keys(ptr); if (k.length < 2) return 0; var a = ptr[k[0]], b = ptr[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
      P.addEventListener('pointerdown', function (e) {
        ptr[e.pointerId] = { x: e.clientX, y: e.clientY }; try { P.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault();
        var fe = e.target.closest && e.target.closest('.lyf'), d = dims();
        if (np() === 1) { var id = fe ? fe.getAttribute('data-id') : null; sel = id; layout(); g = { mode: id ? 'drag' : 'pan', id: id, sx: e.clientX, sy: e.clientY, moved: false, sl: W.scrollLeft, st: W.scrollTop, r: id ? { x0: F[id].x0, y0: F[id].y0, x1: F[id].x1, y1: F[id].y1 } : null }; }
        else if (np() === 2) {
          var id2 = g && g.id; if (!id2 && fe) id2 = fe.getAttribute('data-id');
          if (id2) { var f = F[id2]; sel = id2; g = { mode: 'pinch', id: id2, d0: dist(), r: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 }, moved: true }; }
          else g = { mode: 'zoom', d0: dist(), z0: zoom, moved: true };
          if (g.id && F[g.id]) { F[g.id].x0 = g.r.x0; F[g.id].y0 = g.r.y0; F[g.id].x1 = g.r.x1; F[g.id].y1 = g.r.y1; }
        }
      });
      P.addEventListener('pointermove', function (e) {
        if (!ptr[e.pointerId] || !g) return; ptr[e.pointerId] = { x: e.clientX, y: e.clientY }; var d = dims();
        if (g.mode === 'drag' && np() === 1) {
          var dx = e.clientX - g.sx, dy = e.clientY - g.sy; if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true; if (!g.moved) return;
          var f = F[g.id], w = g.r.x1 - g.r.x0, h = g.r.y1 - g.r.y0;
          f.x0 = Math.max(-d.ox, Math.min(d.PWt - d.ox - w, g.r.x0 + dx / d.k)); f.y0 = f.map ? g.r.y0 : Math.max(0, Math.min(d.PH - h, g.r.y0 - dy / d.k)); f.x1 = f.x0 + w; f.y1 = f.y0 + h; layout();
        } else if (g.mode === 'pan' && np() === 1) { W.scrollLeft = g.sl - (e.clientX - g.sx); W.scrollTop = g.st - (e.clientY - g.sy); }
        else if (g.mode === 'pinch' && np() >= 2) {
          var f2 = F[g.id], r = dist() / g.d0, cx = (g.r.x0 + g.r.x1) / 2, cy = (g.r.y0 + g.r.y1) / 2, w2 = (g.r.x1 - g.r.x0) * r, h2 = (g.r.y1 - g.r.y0) * r;
          if (f2.map) { var wmax = g.r.x1 - g.r.x0; if (w2 > wmax) { w2 = wmax; h2 = g.r.y1 - g.r.y0; } if (w2 < wmax * 0.4) { w2 = wmax * 0.4; h2 = (g.r.y1 - g.r.y0) * 0.4; } }
          else { var lo = 0.3 * f2.bw, hi2 = 3 * f2.bw; if (w2 < lo) { h2 *= lo / w2; w2 = lo; } if (w2 > hi2) { h2 *= hi2 / w2; w2 = hi2; } }
          var ax = f2.map && lay.mapPos === 'l' ? g.r.x0 : f2.map && lay.mapPos === 'r' ? g.r.x1 : cx;
          f2.x0 = ax - (ax - g.r.x0) * (w2 / (g.r.x1 - g.r.x0)); f2.x1 = f2.x0 + w2; f2.y0 = cy - h2 / 2; f2.y1 = cy + h2 / 2; layout();
        } else if (g.mode === 'zoom' && np() >= 2) { zoom = Math.max(1, Math.min(5, g.z0 * dist() / g.d0)); layout(); }
      });
      function up(e) {
        if (!ptr[e.pointerId]) return; delete ptr[e.pointerId]; if (!g) return;
        if (g.mode === 'drag' && np() === 0) {
          if (g.moved && !F[g.id].map) { rec(g.id); pushAway(g.id); Object.keys(F).forEach(function (k) { if (lay.obj[k] && lay.obj[k].x != null) rec(k); }); layout(); push(); }
          else if (g.moved && F[g.id].map) { var mf = F[g.id], cxm = (mf.x0 + mf.x1) / 2; setMapPos(cxm < out.PW / 3 ? 'l' : cxm > out.PW * 2 / 3 ? 'r' : 'c'); }
          g = null;
        } else if (g.mode === 'pinch' && np() < 2) {
          var id = g.id, f = F[id]; g = null;
          if (f.map) { var r0 = out.rects.map, cur = lay.map.s > 0 ? lay.map.s : 1; lay.map.s = Math.max(0.4, Math.min(1, cur * (f.x1 - f.x0) / (r0.x1 - r0.x0))); if (Math.abs(lay.map.s - 1) < 0.02) delete lay.map.s; push(); }
          else { rec(id); pushAway(id); layout(); push(); }
          ptr = {};
        } else if (g.mode === 'zoom' && np() < 2) { g = null; ptr = {}; }
        else if (np() === 0) g = null;
      }
      P.addEventListener('pointerup', up); P.addEventListener('pointercancel', up);
      $e('lyPs').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-p]'); if (!b) return; var p = b.getAttribute('data-p'); if (p === lay.mapPos) return; setMapPos(p); };
      $e('lyUn').onclick = function () { if (hi <= 0) return; hi--; var o = JSON.parse(hist[hi]); lay = o.l; out.OX = o.ox || 0; Object.keys(o.f).forEach(function (k) { if (F[k]) { F[k].x0 = o.f[k][0]; F[k].y0 = o.f[k][1]; F[k].x1 = o.f[k][2]; F[k].y1 = o.f[k][3]; } }); layout(); ui(); };
      function dlg(html, wire) { var q = document.createElement('div'); q.className = 'lyq'; q.innerHTML = '<div class="lyqc">' + html + '</div>'; el.appendChild(q); wire(q, function () { q.remove(); }); }
      function batal() {
        if (!dirty()) { closeEd(); if (back) back(); return; }
        dlg('<div class="st">BUANG PERUBAHAN?</div><div class="muted" style="margin:8px 0">Perubahan tata letak belum disimpan.</div><button class="btn" id="lqX" style="width:100%">Lanjut mengedit</button><button class="btn pri" id="lqB" style="width:100%;margin-top:6px;background:var(--r);border-color:var(--r)">Buang</button>', function (q, c) { q.querySelector('#lqX').onclick = c; q.querySelector('#lqB').onclick = function () { c(); closeEd(); if (back) back(); }; });
      }
      $e('lyBk').onclick = batal;
      HA.layBack = function () { if (!document.getElementById('lyEd')) return false; if (el.querySelector('.lyq')) { el.querySelector('.lyq').remove(); return true; } batal(); return true; };
      $e('lyGo').onclick = function () {
        S.settings.mLay = cl(lay); (S.settings.mTplBy = S.settings.mTplBy || {})[String(PS.sel)] = tplCur(); saveSettings();
        closeEd(); cetak(m, 'pdf', curOpts(), true);
      };
      window.addEventListener('resize', function () { if (document.getElementById('lyEd')) layout(); });
      rebuild();
    });
  }
  HA.openPrintMaster = printPanel;
  HA.masterAtur = function (m, back) { return aturSheet(m, back); };
  HA.masterCetak = function () { return cetak.apply(this, arguments); };
  function cetak(m, fmt, opts, prev) {
    var mem = members(m);
    if (!mem.in.length && !mem.man.length) { toast('Belum ada blok Terkonfirmasi yang seluruhnya di dalam master ini'); return; }
    fmt = fmt || 'pdf'; opts = opts || { map: true, list: true };
    if (mem.pend.length) { askConfirm(mem.pend.length + ' blok perbatasan belum diputuskan', 'Blok itu tidak ikut tercetak. Tetap cetak sekarang?', 'Cetak', function () { run(m, mem, fmt, opts, prev); }); return; }
    run(m, mem, fmt, opts, prev);
  }
  function stamp() { var d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()); }
  function run(m, mem, fmt, opts, prev) {
    var list = mem.in.concat(mem.man).sort(nat), lj = {}, i = 0, base = 'Master_' + m.name.replace(/[^\w\-]+/g, '_') + '_' + stamp();
    if (fmt === 'kml') { HA.saveFile(base + '.kml', HA.textB64(buildKml(m, list)), 'application/vnd.google-earth.kml+xml'); return; }
    if (opts && opts.only) { var oid = {}; opts.only.forEach(function (x) { oid[x.id] = 1; }); list = list.filter(function (b) { return oid[b.id]; }); }
    toast('Menyusun PDF…');
    (function nx() {
      if (i >= list.length) {
        var bytes = buildPdfBytes(m, list, lj, mem, opts);
        if (prev && HA.pdfPreview) { HA.pdfPreview(bytes, function () { HA.saveFile(pdfName(m), btoa(bytes), 'application/pdf'); }, { onBack: printPanel }); return; }
        HA.saveFile(pdfName(m), btoa(bytes), 'application/pdf'); return;
      }
      var b = list[i++];
      if (b.dir != null) { try { var r = HA.rowsFor(b, b.dir, +(b.sp || S.settings.rowSp || 1.5), +b.margin || 0); lj[b.id] = { n: r.n, total: r.total }; } catch (e) {} }
      if (i % 25 === 0) setTimeout(nx, 0); else nx();
    })();
  }
  function xe(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function buildKml(m, list) {
    function ring(pts) { var a = pts.map(function (p) { return (+p[1]).toFixed(6) + ',' + (+p[0]).toFixed(6) + ',0'; }); a.push(a[0]); return a.join(' '); }
    var x = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + xe('Master: ' + m.name) + '</name>' +
      '<Style id="blk"><LineStyle><color>ff00d4ff</color><width>1.5</width></LineStyle><PolyStyle><color>2200d4ff</color></PolyStyle></Style>' +
      '<Style id="mst"><LineStyle><color>ff1c9fff</color><width>3</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style><Folder><name>Blok</name>';
    list.forEach(function (b) { x += '<Placemark><name>' + xe(b.name) + '</name><styleUrl>#blk</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>' + ring(b.pts) + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>'; });
    x += '</Folder><Folder><name>Batas master</name><Placemark><name>' + xe(m.name) + '</name><styleUrl>#mst</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>' + ring(m.pts) + '</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Folder></Document></kml>';
    return x;
  }
  HA.masterKml = buildKml;
  HA.ktData = ktData;

  // ---------- penulis PDF minimal ----------
  function asc(t) { return String(t == null ? '' : t).replace(/[^\x20-\x7E]/g, '?'); }
  function pe(t) { return String(t == null ? '' : t).replace(/\u00B1/g, '\x01').replace(/\u2022/g, '\x02').replace(/[^\x20-\x7E\x01\x02]/g, '?').replace(/([\\()])/g, '\\$1').replace(/\x01/g, '\\261').replace(/\x02/g, '\\225'); }
  function rgbc(hex) { var h = String(hex || '#888888').replace('#', ''); if (h.length !== 6) h = '888888'; return f2(parseInt(h.slice(0, 2), 16) / 255) + ' ' + f2(parseInt(h.slice(2, 4), 16) / 255) + ' ' + f2(parseInt(h.slice(4, 6), 16) / 255); }
  function lgBox(leg, fs) { var mx = 0; leg.forEach(function (r) { mx = Math.max(mx, asc(r.txt).length); }); var kf = (fs || 8) / 8; return { kf: kf, RH: 14 * kf, LW: Math.max(90, Math.min(320, (34 + mx * 4.6) * kf)), LH: 14 * kf * leg.length }; }
  HA.lgBox = lgBox;
  function f2(v) { return (Math.round(v * 100) / 100).toString(); }
  function jsonAscii(o) { return JSON.stringify(o).replace(/[\u0080-￿]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); }); }
  function interior(pts) {
    var c = [0, 0], i, n = pts.length; pts.forEach(function (p) { c[0] += p[0]; c[1] += p[1]; }); c[0] /= n; c[1] /= n;
    var xs = [], j;
    for (i = 0, j = n - 1; i < n; j = i++) { var a = pts[i], b = pts[j]; if ((a[0] > c[0]) !== (b[0] > c[0])) xs.push(a[1] + (c[0] - a[0]) * (b[1] - a[1]) / (b[0] - a[0])); }
    xs.sort(function (p, q) { return p - q; });
    var best = null; for (i = 0; i + 1 < xs.length; i += 2) if (!best || xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
    return best ? [c[0], (best[0] + best[1]) / 2] : c;
  }
  // titik paling jauh dari semua tepi (pole of inaccessibility), koordinat meter lokal
  function poi(pts, kx, ky) {
    var P = pts.map(function (p) { return [p[1] * kx, p[0] * ky]; }), n = P.length, i, j;
    function dist(x, y) {
      var ins = false, md = 1e18;
      for (i = 0, j = n - 1; i < n; j = i++) {
        var a = P[i], b = P[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
        var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0, ex = a[0] + t * dx - x, ey = a[1] + t * dy - y, d = ex * ex + ey * ey;
        if (d < md) md = d;
      }
      return (ins ? 1 : -1) * Math.sqrt(md);
    }
    var x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; P.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    var w = x1 - x0, h = y1 - y0, cs = Math.min(w, h) / 2 || 1, best = null, q = [], k, c;
    function mk(x, y, hh) { var d = dist(x, y); return { x: x, y: y, h: hh, d: d, mx: d + hh * 1.4142 }; }
    for (var xx = x0; xx < x1; xx += cs) for (var yy = y0; yy < y1; yy += cs) q.push(mk(xx + cs / 2, yy + cs / 2, cs / 2));
    best = mk((x0 + x1) / 2, (y0 + y1) / 2, 0); q.forEach(function (o) { if (o.d > best.d) best = o; });
    var guard = 0;
    while (q.length && guard++ < 4000) {
      q.sort(function (a, b) { return b.mx - a.mx; }); c = q.shift();
      if (c.d > best.d) best = c;
      if (c.mx - best.d <= 0.5) continue;
      var hh = c.h / 2; for (k = 0; k < 4; k++) q.push(mk(c.x + (k & 1 ? hh : -hh), c.y + (k & 2 ? hh : -hh), hh));
    }
    return [best.y / ky, best.x / kx];
  }
  // titik terbaik di pita tinggi blok (f0..f1 = pecahan dari bawah); null bila tidak ada
  function poiBand(pts, kx, ky, f0, f1) {
    var P = pts.map(function (p) { return [p[1] * kx, p[0] * ky]; }), n = P.length, i, j;
    function dist(x, y) {
      var ins = false, md = 1e18;
      for (i = 0, j = n - 1; i < n; j = i++) {
        var a = P[i], b = P[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
        var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0, ex = a[0] + t * dx - x, ey = a[1] + t * dy - y, d = ex * ex + ey * ey;
        if (d < md) md = d;
      }
      return (ins ? 1 : -1) * Math.sqrt(md);
    }
    var x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; P.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    var w = x1 - x0, h = y1 - y0, N = 60, gi, gj, cells = [], dp = 0;
    for (gi = 0; gi < N; gi++) for (gj = 0; gj < N; gj++) { var x = x0 + (gi + 0.5) / N * w, y = y0 + (gj + 0.5) / N * h, d = dist(x, y); cells.push({ x: x, y: y, d: d }); if (d > dp) dp = d; }
    if (dp <= 0) return null;
    // titik yang masih cukup jauh dari tepi (60% jarak maksimum), diambil yang paling ke atas (f0 >= 0.5) atau paling ke bawah
    var up = f0 >= 0.5, thr = dp * 0.6, best = null;
    var eps = h / 1000; cells.forEach(function (c) { if (c.d < thr) return; if (!best || (up ? c.y > best.y + eps : c.y < best.y - eps) || (Math.abs(c.y - best.y) <= eps && Math.abs(c.x - (x0 + x1) / 2) < Math.abs(best.x - (x0 + x1) / 2) - 1e-6)) best = c; });
    if (!best) return null;
    return [best.y / ky, best.x / kx];
  }
  HA.poi = poi; HA.poiBand = poiBand;
  // poligon dikecilkan ke dalam sejauh d meter (miter dibatasi)
  HA.insetPoly = function (pts, d) {
    var P = HzBlok.proj(pts[0][0], pts[0][1]), xy = pts.map(P.xy), n = xy.length, ar = 0, i;
    for (i = 0; i < n; i++) { var a = xy[i], b = xy[(i + 1) % n]; ar += a[0] * b[1] - b[0] * a[1]; }
    var sg = ar > 0 ? 1 : -1, out = [], dd = -d;
    function nm(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [sg * dy / l, -sg * dx / l]; }
    for (i = 0; i < n; i++) {
      var p0 = xy[(i + n - 1) % n], p1 = xy[i], p2 = xy[(i + 1) % n], n1 = nm(p0, p1), n2 = nm(p1, p2), den = 1 + n1[0] * n2[0] + n1[1] * n2[1], f = dd / Math.max(den, 0.35), ox = (n1[0] + n2[0]) * f, oy = (n1[1] + n2[1]) * f, l = Math.hypot(ox, oy);
      if (l > Math.abs(dd) * 3) { ox *= Math.abs(dd) * 3 / l; oy *= Math.abs(dd) * 3 / l; }
      out.push(P.ll(p1[0] + ox, p1[1] + oy));
    }
    return out;
  };
  function buildPdfBytes(m, list, lj, mem, opts) {
    opts = opts || { map: true, list: true }; lj = lj || {};
    var objs = [], ver = (document.querySelector('.ver') ? (document.querySelector('.ver').textContent.match(/Versi\s*([\d.]+)/) || [])[1] : '') || '';
    function add(b) { objs.push(b); return objs.length; }
    function stream(dict, data) { return '<< ' + dict + ' /Length ' + data.length + ' >>\nstream\n' + data + '\nendstream'; }
    var d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; }, tgl = p2(d.getDate()) + '-' + p2(d.getMonth() + 1) + '-' + d.getFullYear();
    var cat = add(''), pages = add(''), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2o = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var data = { hzblok: 1, app: 'HZ Trip', ver: ver, tgl: tgl, master: { name: m.name, pts: m.pts }, blocks: list.map(function (b) { return { id: b.id, name: b.name, src: b.src || 'manual', pts: b.pts, dir: b.dir == null ? null : b.dir, sp: b.sp == null ? null : b.sp, margin: b.margin || 0, conf: !!b.conf, note: b.note || '', guide: b.guide || null, lblOff: b.lblOff || null }; }) };
    var js = jsonAscii(data), emb = add(stream('/Type /EmbeddedFile /Subtype /application#2Fjson /Params << /Size ' + js.length + ' >>', js));
    var fsp = add('<< /Type /Filespec /F (hzblok.json) /UF (hzblok.json) /EF << /F ' + emb + ' 0 R /UF ' + emb + ' 0 R >> /AFRelationship /Data /Desc (Data blok HZ Trip) >>');
    var gs2 = add('<< /Type /ExtGState /ca 0.8 /CA 1 >>'), gs1 = add('<< /Type /ExtGState /ca 0.4 /CA 1 >>'), kids = [], res = '<< /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2o + ' 0 R >> /ExtGState << /GS1 ' + gs1 + ' 0 R /GS2 ' + gs2 + ' 0 R >> >>', tot = haOf(list);
    var ocgs = [], ocmap = {};
    function L(name, str) { if (opts.layers === false) return str; if (!ocmap[name]) { var o = add('<< /Type /OCG /Name (' + pe(name) + ') >>'); ocmap[name] = { n: o, k: 'L' + (ocgs.length + 1) }; ocgs.push(name); } return '/OC /' + ocmap[name].k + ' BDC ' + str + ' EMC'; }
    var poiC = {}, lapA = (opts.lap === false || !HA.lyb) ? [] : HA.lyb.active(), lapUsed = {};
    (opts.map ? (opts.sheets && opts.sheets.length ? opts.sheets : [null]) : []).forEach(function (sh) {
      var allp = m.pts.slice(); list.forEach(function (b) { b.pts.forEach(function (p) { allp.push(p); }); });
      var mb = bbox(allp), latc = (mb[0] + mb[2]) / 2, kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 111320;
      var mw = Math.max(50, (mb[3] - mb[1]) * kx), mh = Math.max(50, (mb[2] - mb[0]) * ky), PP = { a4: [595.28, 841.89], a3: [841.89, 1190.55], a2: [1190.55, 1683.78], f4: [595.28, 935.43] }, pk = (!sh && opts.paper && PP[opts.paper]) ? opts.paper : 'auto', FIX = pk !== 'auto', pb = FIX ? PP[pk] : PP.a3,
        land = FIX && opts.ori === 'l' ? true : FIX && opts.ori === 'p' ? false : mw >= mh, PW = land ? pb[1] : pb[0], PH = land ? pb[0] : pb[1], M = 24;
      var fw = PW - 2 * M, fh = PH - 2 * M, sc = Math.min(fw / (mw * 1.04), fh / (mh * 1.04)), offx = (fw - mw * sc) / 2, offy = (fh - mh * sc) / 2;
      var X = function (lng) { return M + offx + (lng - mb[1]) * kx * sc; }, Y = function (lat) { return M + offy + (lat - mb[0]) * ky * sc; };
      var lngAt = function (x) { return mb[1] + (x - M - offx) / (kx * sc); }, latAt = function (y) { return mb[0] + (y - M - offy) / (ky * sc); };
      var c = [], infos = [];
      var LAY = (!sh && opts.lay) ? opts.lay : null, lrect = {}, lhide = (LAY && LAY.hide) || {}, kc = ktCfg(), SK = HA.lyb.symK(), MT = { s: 1, tx: 0, ty: 0 }, mapStart = c.length;
      var MP = (LAY && LAY.mapPos) || 'c', AP = {}, resL = 0, resR = 0, kd0 = null;
      if (FIX && !sh && opts.kt !== false && kc.on && (kc.tabs || []).length) {
        kd0 = ktDraw(list, PW, PH, M, kc, f2, lhide);
        var kit = kd0.items, KG = 8, availH = PH - 2 * M, maxW = 1, sumH = 0;
        kit.forEach(function (it) { maxW = Math.max(maxW, it.bb[2] - it.bb[0]); sumH += (it.bb[3] - it.bb[1]); });
        var colsK = MP === 'c' ? [[], []] : [[]];
        kit.forEach(function (it) { var best = 0; if (colsK.length > 1) { var h0 = 0, h1 = 0; colsK[0].forEach(function (q) { h0 += q.bb[3] - q.bb[1]; }); colsK[1].forEach(function (q) { h1 += q.bb[3] - q.bb[1]; }); best = h1 < h0 ? 1 : 0; } colsK[best].push(it); });
        var sK = 1; colsK.forEach(function (cl) { var hh = 0; cl.forEach(function (q) { hh += q.bb[3] - q.bb[1]; }); hh += KG * Math.max(0, cl.length - 1); if (hh > availH) sK = Math.min(sK, availH / hh); });
        sK = Math.max(0.45, Math.min(sK, (colsK.length > 1 ? 0.3 : 0.4) * (PW - 2 * M) / maxW));
        var colW = maxW * sK;
        colsK.forEach(function (cl, ci) {
          var cx0 = (MP === 'r' || (MP === 'c' && ci === 0)) ? M : PW - M - colW, yy = PH - M;
          cl.forEach(function (q) { AP['kt:' + q.id] = { x: cx0, y: yy, s: sK }; yy -= (q.bb[3] - q.bb[1]) * sK + KG; });
        });
        if (MP === 'c') { resL = resR = colW + 10; } else if (MP === 'r') resL = colW + 10; else resR = colW + 10;
      }
      (function () {
        var fwE = PW - 2 * M - resL - resR; sc = Math.min(fwE / (mw * 1.04), fh / (mh * 1.04)); var ax0 = M + resL - M;
        offx = MP === 'l' ? ax0 + mw * sc * 0.02 : MP === 'r' ? ax0 + fwE - mw * sc * 1.02 : ax0 + (fwE - mw * sc) / 2; offy = (fh - mh * sc) / 2;
      })();
      var OCC = null;
      function occBuild() {
        var CS = 5, gw = Math.ceil(PW / CS), gh = Math.ceil(PH / CS), g = new Uint8Array(gw * gh);
        list.forEach(function (b) {
          var q = b.pts.map(function (p) { return [MT.s * X(p[1]) + MT.tx, MT.s * Y(p[0]) + MT.ty]; }), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, i, j, k;
          q.forEach(function (v) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); });
          var ci0 = Math.max(0, Math.floor(x0 / CS)), ci1 = Math.min(gw - 1, Math.floor(x1 / CS)), cj0 = Math.max(0, Math.floor(y0 / CS)), cj1 = Math.min(gh - 1, Math.floor(y1 / CS));
          for (j = cj0; j <= cj1; j++) for (i = ci0; i <= ci1; i++) {
            var px = (i + 0.5) * CS, py = (j + 0.5) * CS, ins = false;
            for (k = 0; k < q.length; k++) { var a1 = q[k], a2 = q[(k + 1) % q.length]; if ((a1[1] > py) !== (a2[1] > py) && px < (a2[0] - a1[0]) * (py - a1[1]) / (a2[1] - a1[1]) + a1[0]) ins = !ins; }
            if (ins) g[j * gw + i] = 1;
          }
        });
        OCC = { CS: CS, gw: gw, gh: gh, g: g, S: null };
      }
      function occInt() { var o = OCC, S2 = new Int32Array((o.gw + 1) * (o.gh + 1)), i, j; for (j = 0; j < o.gh; j++) for (i = 0; i < o.gw; i++) S2[(j + 1) * (o.gw + 1) + i + 1] = o.g[j * o.gw + i] + S2[j * (o.gw + 1) + i + 1] + S2[(j + 1) * (o.gw + 1) + i] - S2[j * (o.gw + 1) + i]; o.S = S2; }
      function occFree(i0, j0, i1, j1) { var o = OCC, w1 = o.gw + 1; i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(o.gw, i1); j1 = Math.min(o.gh, j1); return o.S[j1 * w1 + i1] - o.S[j0 * w1 + i1] - o.S[j1 * w1 + i0] + o.S[j0 * w1 + i0] === 0; }
      function occMark(x0, y0, x1, y1) { var o = OCC, i, j; for (j = Math.max(0, Math.floor(y0 / o.CS)); j <= Math.min(o.gh - 1, Math.floor(y1 / o.CS)); j++) for (i = Math.max(0, Math.floor(x0 / o.CS)); i <= Math.min(o.gw - 1, Math.floor(x1 / o.CS)); i++) o.g[j * o.gw + i] = 1; occInt(); }
      // cari celah kosong (tidak menutupi blok) untuk objek; pref = titik acuan di bingkai peta
      function findGap(bb, pref) {
        if (!OCC) { occBuild(); if (kd0) kd0.items.forEach(function (it) { var a = AP['kt:' + it.id]; if (!a) return; var o2 = OCC, i, j; for (j = Math.floor((a.y - (it.bb[3] - it.bb[1]) * a.s) / o2.CS); j <= Math.floor(a.y / o2.CS); j++) for (i = Math.floor(a.x / o2.CS); i <= Math.floor((a.x + (it.bb[2] - it.bb[0]) * a.s) / o2.CS); i++) if (i >= 0 && j >= 0 && i < o2.gw && j < o2.gh) o2.g[j * o2.gw + i] = 1; }); occInt(); }
        var o = OCC, CS = o.CS, w = bb[2] - bb[0], h = bb[3] - bb[1], mr = lrect.map, fr = { x0: Math.max(M, mr.x0), y0: Math.max(M, mr.y0), x1: Math.min(PW - M, mr.x1), y1: Math.min(PH - M, mr.y1) }, pg = { x0: M, y0: M, x1: PW - M, y1: PH - M }, regs = [fr, pg], ri, si, S3 = [1, 0.85, 0.7, 0.6, 0.5], best = null;
        for (ri = 0; ri < regs.length && !best; ri++) for (si = 0; si < S3.length && !best; si++) {
          var rg = regs[ri], ww = w * S3[si], hh = h * S3[si], bd = 1e18, i, j;
          if (ww > rg.x1 - rg.x0 || hh > rg.y1 - rg.y0) continue;
          for (j = Math.ceil(rg.y0 / CS); (j + Math.ceil(hh / CS)) * CS <= rg.y1; j++) for (i = Math.ceil(rg.x0 / CS); (i + Math.ceil(ww / CS)) * CS <= rg.x1; i++) {
            if (!occFree(i - 1, j - 1, i + Math.ceil(ww / CS) + 1, j + Math.ceil(hh / CS) + 1)) continue;
            var rx = i * CS, ry = j * CS, ax2 = pref[0] === 0 ? rx : pref[0] === 1 ? rx + ww : rx + ww / 2, ay2 = pref[1] === 0 ? ry : pref[1] === 1 ? ry + hh : ry + hh / 2, dd = Math.pow(ax2 - pref[2], 2) + Math.pow(ay2 - pref[3], 2);
            if (dd < bd) { bd = dd; best = { x: rx, y: ry + hh, s: S3[si], w: ww, h: hh }; }
          }
        }
        if (best) occMark(best.x - CS, best.y - best.h - CS, best.x + best.w + CS, best.y + CS);
        return best;
      }
      function ktVis(id) { return !sh && opts.kt !== false && kc.on && (kc.tabs || []).indexOf(id) >= 0 && !lhide['kt:' + id]; }
      // objek tata letak: dibungkus transform (geser dx,dy = pecahan halaman; skala s terhadap sudut kiri-atas) dan layer sendiri
      var AUTOPREF = { panah: function (m2) { return [1, 1, m2.x1, m2.y1]; }, skala: function (m2) { return [2, 0, (m2.x0 + m2.x1) / 2, m2.y0]; }, info: function (m2) { return [1, 0, m2.x1, m2.y0]; }, lgl: function (m2) { return [0, 0, m2.x0, m2.y0]; } };
      function OB(id, nm, bb, ops, layer) {
        if (!ops) return '';
        if (sh) return ops;
        if ((id === 'skala' && opts.oSk === false) || (id === 'info' && opts.oIn === false) || (id === 'lgl' && opts.oLg === false)) return '';
        var gE = LAY && LAY.obj && LAY.obj[id], g = gE || {}, s0 = g.s > 0 ? g.s : 1, ax = bb[0], ay = bb[3], dx = (g.dx || 0) * PW, dy = (g.dy || 0) * PH, ov = null, man = false;
        if (gE && gE.x != null) { ov = { x: gE.x * PW, y: gE.y * PH, s: s0 }; man = true; }
        else if (id.indexOf('kt:') === 0 && AP[id]) ov = AP[id];
        else if (!gE && AUTOPREF[id] && opts.auto !== false && lrect.map) { var gp0 = findGap(bb, AUTOPREF[id](lrect.map)); if (gp0) ov = gp0; }
        else if (gE) man = true;
        if (ov) { s0 = ov.s; dx = ov.x - ax; dy = ov.y - ay; }
        lrect[id] = { name: nm, x0: ax + dx, y1: ay + dy, x1: ax + dx + (bb[2] - bb[0]) * s0, y0: ay + dy - (bb[3] - bb[1]) * s0, hid: !!lhide[id], bw: bb[2] - bb[0], bh: bb[3] - bb[1], man: man };
        if (lhide[id] || opts.edNoObj) return '';
        return L(layer, (s0 === 1 && !dx && !dy) ? ops : 'q ' + f2(s0) + ' 0 0 ' + f2(s0) + ' ' + f2(ax - s0 * ax + dx) + ' ' + f2(ay - s0 * ay + dy) + ' cm\n' + ops + '\nQ');
      }
      var bwPt = opts.bw ? opts.bw * 0.2 : 0.6;
      function rgb(hex) { var h = String(hex || '#888888').replace('#', ''); if (h.length !== 6) h = '888888'; return f2(parseInt(h.slice(0, 2), 16) / 255) + ' ' + f2(parseInt(h.slice(2, 4), 16) / 255) + ' ' + f2(parseInt(h.slice(4, 6), 16) / 255); }
      ((sh ? sh.items : opts.items) || []).forEach(function (it) {
        var path = '', k; it.pts.forEach(function (p, i) { path += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i ? ' l ' : ' m '); });
        if (it.t === 'pt') { var px = X(it.pts[0][1]), py = Y(it.pts[0][0]); c.push(L('Kategori: ' + (it.catName || 'tanda'), 'q ' + rgb(it.col) + ' rg ' + f2(px - 1.5) + ' ' + f2(py - 1.5) + ' 3 3 re f Q')); }
        else if (it.t === 'ln') c.push(L('Kategori: ' + (it.catName || 'tanda'), 'q ' + rgb(it.col) + ' RG ' + f2((it.w || 5) * 0.35) + ' w 1 J ' + path + 'S Q'));
        else if (it.gar) c.push(L('Kategori: ' + (it.catName || 'tanda'), 'q ' + rgb(it.col) + ' RG ' + f2((it.w || 3) * 0.35) + ' w ' + path + 'h S Q'));
        else c.push(L('Kategori: ' + (it.catName || 'tanda'), 'q ' + (opts.sketsa ? '/GS2' : '/GS1') + ' gs ' + rgb(it.col) + ' rg ' + path + 'h f Q'));
      });
      var RW = opts.ringPt || 2.5, dM = RW / sc;
      function sg(pts) { var a2 = 0, i2; for (i2 = 0; i2 < pts.length; i2++) { var p1 = pts[i2], p2 = pts[(i2 + 1) % pts.length]; a2 += p1[1] * p2[0] - p2[1] * p1[0]; } return a2; }
      ((sh && sh.fills) || []).forEach(function (f) {
        var pth = function (pts) { var s2 = ''; pts.forEach(function (p, i2) { s2 += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i2 ? ' l ' : ' m '); }); return s2 + 'h '; };
        var inner = null;
        if (f.mode !== 'full') {
          var q2 = bbox(f.pts);
          if (Math.min((q2[3] - q2[1]) * kx * sc, (q2[2] - q2[0]) * ky * sc) >= RW * 3.2) {
            try { inner = HA.insetPoly(f.pts, dM); var a0 = sg(f.pts), a1 = sg(inner); if (!(a0 * a1 > 0) || Math.abs(a1) > Math.abs(a0) || Math.abs(a1) < Math.abs(a0) * 0.03) inner = null; } catch (e) { inner = null; }
          }
        }
        var nm2 = f.mode === 'full' ? 'Isi blok' : f.mode === 'ring' ? 'Garis tepi' : 'Isi dalam blok';
        if (f.mode === 'full') c.push(L(nm2, 'q ' + rgbc(f.col) + ' rg ' + pth(f.pts) + 'f Q'));
        else if (f.mode === 'ring') c.push(L(nm2, 'q ' + rgbc(f.col) + ' rg ' + pth(f.pts) + (inner ? pth(inner) + 'f*' : 'f') + ' Q'));
        else if (inner) c.push(L(nm2, 'q ' + rgbc(f.col) + ' rg ' + pth(inner) + 'f Q'));
      });
      if (opts.roads !== false && HA.linesList) {
        // jalan bantu dan drainase yang berada di area peta (layer sendiri)
        var rs = [], rn = 0;
        HA.linesList().forEach(function (ln) {
          if (rn > 1500 || !ln.pts || ln.pts.length < 2) return;
          var q = bbox(ln.pts); if (q[2] < mb[0] || q[0] > mb[2] || q[3] < mb[1] || q[1] > mb[3]) return; rn++;
          var pth = '', wd = Math.max(0.5, Math.min(1.5, (+ln.w || 2) * sc));
          ln.pts.forEach(function (p, i) { pth += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i ? ' l ' : ' m '); });
          rs.push(ln.type === 'drain' ? 'q 0.35 G [3 2] 0 d ' + f2(wd) + ' w ' + pth + 'S Q' : 'q 0.55 G ' + f2(wd) + ' w ' + pth + 'S Q');
        });
        if (rs.length) c.push(L('Jalan dan drainase', 'q ' + f2(M) + ' ' + f2(M) + ' ' + f2(fw) + ' ' + f2(fh) + ' re W n\n' + rs.join('\n') + '\nQ'));
      }
      var objU = {};
      if (opts.obj !== false && HA.obj) { var od = HA.obj.drawPdf({ mb: mb, X: X, Y: Y, f2: f2, pe: pe, gs: '/GS1', labels: false }); objU = od.used; if (od.s) c.push(L('Objek', od.s)); }
      c.push('0 0 0 RG 0 0 0 rg ' + f2(bwPt) + ' w');
      var ttl = asc((opts.title || m.name) + (sh && sh.name ? ' - ' + sh.name : '')), tw = ttl.length * 13 * 0.56;
      var ttlOps = 'BT /F2 13 Tf ' + f2(PW / 2 - tw / 2) + ' ' + f2(PH - 17) + ' Td (' + pe(ttl) + ') Tj ET';
      var HSP = 0; if (HA.lyb) { var shs = []; list.forEach(function (b) { var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; b.pts.forEach(function (p) { var vx = X(p[1]), vy = Y(p[0]); x0 = Math.min(x0, vx); x1 = Math.max(x1, vx); y0 = Math.min(y0, vy); y1 = Math.max(y1, vy); }); shs.push(Math.min(x1 - x0, y1 - y0)); }); shs.sort(function (a, b) { return a - b; }); HSP = shs.length ? Math.max(1.8, shs[Math.floor(shs.length / 2)] / 8) : 0; }
      list.forEach(function (b) {
        var s = ''; b.pts.forEach(function (p, i) { s += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i ? ' l ' : ' m '); });
        lapA.forEach(function (lp) {
          if (lp.mode !== 'fill') return; var li = HA.lyb.of(b, lp.id); if (!li) return;
          (lapUsed[lp.id] = lapUsed[lp.id] || {})[li.id] = 1;
          c.push(L('Lapisan: ' + lp.name, HA.lyb.fillPdf(li, b.pts.map(function (p) { return [X(p[1]), Y(p[0])]; }), '/GS1', HSP)));
        });
        if (!sh && opts.bt !== false && HA.lyb.btOn()) { var bm = HA.lyb.bulanOf(b); if (bm) c.push(L('Bulan tanam', 'q ' + s + 'h W n ' + rgbc(HA.lyb.bulanCol(bm)) + ' RG 1 j ' + f2(HA.lyb.btW() * 2) + ' w ' + s + 'h S Q')); }
        c.push(L('Tepi blok', s + 'h S'));
        var q = bbox(b.pts), bw = (q[3] - q[1]) * kx * sc, bh = (q[2] - q[0]) * ky * sc, nm = asc(b.name);
        infos.push({ b: b, nm: nm, ar: fmtHa(HzBlok.areaHa(b.pts)) + ' ha', fit: Math.min(bw * 0.84 / (Math.max(3, nm.length) * 0.56), bh * (opts.luas === false ? 0.7 : 0.42)), x0: X(q[1]), x1: X(q[3]), y0: Y(q[0]), y1: Y(q[2]) });
      });
      // ukuran teks seragam (pt): diatur pengguna; baris: no blok, luas blok, tanggal, luas kategori
      var fits = infos.map(function (o) { return o.fit; }).sort(function (p, q) { return p - q; }), fsU = Math.max(3, Math.min(9, fits[Math.floor(fits.length * 0.25)] || 6)); if ({ s: 1, m: 1, l: 1 }[opts.fs]) fsU = { s: 5, m: 7.5, l: 11 }[opts.fs]; else if (isFinite(parseFloat(opts.fs))) fsU = parseFloat(opts.fs); if (opts.fsPt) fsU = opts.fsPt;
      infos.forEach(function (o) {
        var ip = poiC[o.b.id] || (poiC[o.b.id] = (opts.pos === 't' ? poiBand(o.b.pts, kx, ky, 0.55, 0.95) : (opts.pos === 'b' ? poiBand(o.b.pts, kx, ky, 0.05, 0.45) : null)) || poi(o.b.pts, kx, ky));
        if (o.b.lblOff) ip = [ip[0] + o.b.lblOff[0], ip[1] + o.b.lblOff[1]];
        var cx = X(ip[1]), cy = Y(ip[0]), ls = [], lyr = [];
        if (opts.name !== false) { ls.push(o.nm); lyr.push('Nomor blok dan luas'); }
        if (opts.luas !== false) { ls.push(o.ar); lyr.push('Nomor blok dan luas'); }
        var lf = sh ? sh.lines : opts.lines; if (lf) lf(o.b).forEach(function (t) { ls.push(asc(t.t != null ? t.t : t)); lyr.push(t.l || 'Tanggal dan luas kategori'); });
        lapA.forEach(function (lp) { if (lp.mode !== 'sym') return; var li = HA.lyb.of(o.b, lp.id); if (li) { ls.push(HA.lyb.isVec(li.sym) ? { vec: li.sym } : li.sym); lyr.push('Lapisan: ' + lp.name); (lapUsed[lp.id] = lapUsed[lp.id] || {})[li.id] = 1; } });
        var lh = fsU * 1.15, HALO = S.settings.halo !== false, szS = fsU * 0.9 * SK, hs = ls.map(function (t) { return typeof t === 'object' ? Math.max(lh, szS * 1.15) : lh; });
        var tot2 = 0; hs.forEach(function (h) { tot2 += h; });
        var topY = cy + tot2 / 2, acc = 0;
        ls.forEach(function (t, i) {
          var ti = topY - acc; acc += hs[i];
          if (typeof t === 'object') { c.push(L(lyr[i], HA.lyb.symPdf(cx, ti - hs[i] / 2, szS, t.vec, HALO ? fsU * 0.32 : 0))); return; }
          var tp = 'BT /F1 ' + f2(fsU) + ' Tf ' + f2(cx - t.length * fsU * 0.52 / 2) + ' ' + f2(ti - fsU * 0.85) + ' Td (' + pe(t) + ') Tj ET';
          // biru tinta tua (jadi abu tua di fotokopi) + halo putih tipis; tepi blok tetap hitam
          c.push(L(lyr[i], (HALO ? 'q 1 G 1 j ' + f2(fsU * 0.32) + ' w 1 Tr ' + tp + ' Q ' : '') + 'q 0.122 0.306 0.62 rg 0 Tr ' + tp + ' Q'));
        });
      });
      // peta: satu kelompok (geser/zoom dari tata letak), dipotong di bingkai
      var mapEnd = c.length;
      if (!sh) {
        var mo = (LAY && LAY.map) || {}, mS = mo.s > 0 ? mo.s : 1, mx0 = X(mb[1]), mx1 = X(mb[3]), my0 = Y(mb[0]), my1 = Y(mb[2]);
        if (mo.dx != null || mo.dy != null) { var mdx = (mo.dx || 0) * PW, mdy = (mo.dy || 0) * PH; MT = { s: mS, tx: (PW / 2) * (1 - mS) + mdx, ty: (PH / 2) * (1 - mS) + mdy }; }
        else { var anc = MP === 'l' ? mx0 : MP === 'r' ? mx1 : (mx0 + mx1) / 2; MT = { s: mS, tx: anc * (1 - mS), ty: (my0 + my1) / 2 * (1 - mS) }; }
        var inner = c.splice(mapStart, mapEnd - mapStart).join('\n'); if (opts.edNoMap) inner = '';
        c.splice(mapStart, 0, 'q ' + f2(M) + ' ' + f2(M) + ' ' + f2(fw) + ' ' + f2(fh) + ' re W n q ' + f2(MT.s) + ' 0 0 ' + f2(MT.s) + ' ' + f2(MT.tx) + ' ' + f2(MT.ty) + ' cm\n' + inner + '\nQ Q');
        lrect.map = { name: 'Peta', x0: MT.s * mx0 + MT.tx, y0: MT.s * my0 + MT.ty, x1: MT.s * mx1 + MT.tx, y1: MT.s * my1 + MT.ty, hid: false, map: true };
      }
      c.push(OB('judul', 'Judul', [PW / 2 - tw / 2 - 2, PH - 21, PW / 2 + tw / 2 + 2, PH - 5], ttlOps, 'Judul'));
      // skala dan panah utara
      var scStart = c.length;
      var L0 = [100, 200, 500, 1000, 2000, 5000].filter(function (v) { return v * sc < fw * 0.25; }).pop() || 100, bx = PW / 2 - L0 * sc / 2, by = M + 16;
      c.push('1 w ' + f2(bx) + ' ' + f2(by) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by) + ' l S ' + f2(bx) + ' ' + f2(by - 4) + ' m ' + f2(bx) + ' ' + f2(by + 4) + ' l S ' + f2(bx + L0 * sc) + ' ' + f2(by - 4) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by + 4) + ' l S');
      c.push('BT /F1 8 Tf ' + f2(bx) + ' ' + f2(by + 7) + ' Td (' + (L0 >= 1000 ? (L0 / 1000) + ' km' : L0 + ' m') + ') Tj ET');
      c.push(OB('skala', 'Skala', [bx - 3, by - 6, bx + L0 * sc + 3, by + 16], c.splice(scStart).join('\n'), 'Legenda dan tabel'));
      var nStart = c.length, nx0 = PW - M - 24, ny0 = PH - M - 46;
      c.push('1 w ' + f2(nx0) + ' ' + f2(ny0) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l S ' + f2(nx0 - 5) + ' ' + f2(ny0 + 20) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l ' + f2(nx0 + 5) + ' ' + f2(ny0 + 20) + ' l S');
      c.push('BT /F2 9 Tf ' + f2(nx0 - 3) + ' ' + f2(ny0 - 10) + ' Td (U) Tj ET');
      c.push(OB('panah', 'Panah utara', [nx0 - 9, ny0 - 16, nx0 + 9, ny0 + 30], c.splice(nStart).join('\n'), 'Legenda dan tabel'));
      if (sh && c.length > scStart) c.push(L('Legenda dan tabel', c.splice(scStart).join('\n')));
      // legenda: tabel info (Master: sudut paling kosong; Laporan: kanan bawah), kotak daftar (kiri, bisa digeser), keterangan (kiri bawah)
      var rows = [['Master', m.name.length > 24 ? m.name.slice(0, 23) + '.' : m.name], ['Jumlah blok', String(list.length)], ['Total luas', fmtHa(tot) + ' ha']].concat(opts.dates ? [[opts.datesLbl || 'Tanggal', opts.dates]] : [], [['Dicetak', tgl], ['Versi app', ver]]);
      if (sh && sh.info) rows = rows.concat(sh.info);
      var kf = (opts.lgFs || 8) / 8, fb = f2(8 * kf), lgStart = c.length;
      if (opts.legend !== false) {
        var IW = 190, RH0 = 14, IH = RH0 * rows.length, G = 10;
        var cands = sh ? [[PW - M - G - IW, M + G]] : [[PW - M - G - IW, M + G], [M + G, M + G], [M + G, PH - M - G - IH]];
        var ovl = function (cd) { var n = 0; infos.forEach(function (o) { if (o.x1 > cd[0] - 6 && o.x0 < cd[0] + IW + 6 && o.y1 > cd[1] - 6 && o.y0 < cd[1] + IH + 6) n++; }); return n; };
        var best = cands[0], bo = ovl(best); cands.forEach(function (cd) { var o2 = ovl(cd); if (o2 < bo) { bo = o2; best = cd; } });
        var ix = best[0], iy = best[1], iStart = c.length;
        c.push('1 g 0.5 w ' + f2(ix) + ' ' + f2(iy) + ' ' + f2(IW) + ' ' + f2(IH) + ' re f 0 g ' + f2(ix) + ' ' + f2(iy) + ' ' + f2(IW) + ' ' + f2(IH) + ' re S');
        rows.forEach(function (r, i) {
          var ty = iy + IH - RH0 * (i + 1);
          if (i) c.push('0.5 w ' + f2(ix) + ' ' + f2(ty + RH0) + ' m ' + f2(ix + IW) + ' ' + f2(ty + RH0) + ' l S');
          c.push('BT /F2 8 Tf ' + f2(ix + 5) + ' ' + f2(ty + 4) + ' Td (' + pe(r[0]) + ') Tj ET BT /F1 8 Tf ' + f2(ix + 74) + ' ' + f2(ty + 4) + ' Td (' + pe(r[1]) + ') Tj ET');
        });
        c.push('0.5 w ' + f2(ix + 70) + ' ' + f2(iy) + ' m ' + f2(ix + 70) + ' ' + f2(iy + IH) + ' l S');
        c.push(OB('info', 'Tabel info', [ix, iy, ix + IW, iy + IH], c.splice(iStart).join('\n'), 'Legenda dan tabel'));
        var lgl = sh ? (sh.leg || []) : [];
        if (lgl.length) {
          var bd = lgBox(lgl, opts.lgFs), lgp = opts.lgPos || {}, lx = lgp.x != null ? lgp.x * PW : M + G, ly = lgp.y != null ? PH - lgp.y * PH - bd.LH : PH - (M + 40) - bd.LH;
          lx = Math.max(0, Math.min(PW - bd.LW, lx)); ly = Math.max(0, Math.min(PH - bd.LH, ly));
          c.push('1 g 0.5 w ' + f2(lx) + ' ' + f2(ly) + ' ' + f2(bd.LW) + ' ' + f2(bd.LH) + ' re f 0 g 0 G ' + f2(lx) + ' ' + f2(ly) + ' ' + f2(bd.LW) + ' ' + f2(bd.LH) + ' re S');
          lgl.forEach(function (r, i) {
            var ty = ly + bd.LH - bd.RH * (i + 1);
            if (i) c.push('0.5 w 0 G ' + f2(lx) + ' ' + f2(ty + bd.RH) + ' m ' + f2(lx + bd.LW) + ' ' + f2(ty + bd.RH) + ' l S');
            c.push('q ' + rgbc(r.col) + ' rg ' + f2(lx + 5 * bd.kf) + ' ' + f2(ty + 2 * bd.kf) + ' ' + f2(20 * bd.kf) + ' ' + f2(bd.RH - 4 * bd.kf) + ' re f Q');
            c.push('BT /F1 ' + fb + ' Tf 0 g ' + f2(lx + 31 * bd.kf) + ' ' + f2(ty + 4 * bd.kf) + ' Td (' + pe(r.txt) + ') Tj ET');
          });
        }
        if (sh && sh.keter) {
          sh.keter.forEach(function (r, i) {
            var ty = M + G + (sh.keter.length - 1 - i) * 16;
            if (r.kind === 'ring') c.push('q 0.35 G ' + f2(RW) + ' w ' + f2(M + G + RW / 2) + ' ' + f2(ty + RW / 2) + ' ' + f2(14 - RW) + ' ' + f2(10 - RW) + ' re S Q');
            else c.push('q 0.6 g ' + f2(M + G) + ' ' + f2(ty) + ' 14 10 re f Q');
            c.push('BT /F1 8 Tf 0 g ' + f2(M + G + 20) + ' ' + f2(ty + 2) + ' Td (' + pe(r.txt) + ') Tj ET');
          });
        }
      }
      if (opts.legend !== false) {
        var rowsL = []; lapA.forEach(function (lp) { var u = lapUsed[lp.id]; if (!u) return; if (!sh && ((lp.id === 'status' && ktVis('st')) || (lp.id === 'varietas' && ktVis('var')))) return; rowsL.push({ h: lp.name }); lp.items.forEach(function (it) { if (u[it.id]) rowsL.push({ lp: lp, it: it }); }); });
        if (Object.keys(objU).length) { rowsL.push({ h: 'Objek' }); HA.obj.jenis().forEach(function (j) { if (objU[j.id]) rowsL.push({ oj: j }); }); }
        if (rowsL.length) {
          var RHl = 12, LWl = 140, LHl = rowsL.length * RHl + 6, lx0 = M + 10, ly0 = M + 10 + (sh && sh.keter ? sh.keter.length * 16 + 8 : 0);
          var lStart = c.length; c.push('1 g 0.5 w ' + f2(lx0) + ' ' + f2(ly0) + ' ' + f2(LWl) + ' ' + f2(LHl) + ' re f 0 G ' + f2(lx0) + ' ' + f2(ly0) + ' ' + f2(LWl) + ' ' + f2(LHl) + ' re S');
          rowsL.forEach(function (r, i) {
            var ty = ly0 + LHl - 3 - RHl * (i + 1) + 2;
            if (r.oj) {
              var oj = r.oj, ox = lx0 + 5;
              if (oj.t === 'pg') c.push(HA.lyb.swatchPdf({ col: oj.col, pat: oj.pat, pc: oj.pc }, ox, ty - 1, 18, 9));
              else if (oj.t === 'ln') c.push('q ' + HA.lyb.rgb(oj.col) + ' RG 1.8 w ' + f2(ox) + ' ' + f2(ty + 3) + ' m ' + f2(ox + 18) + ' ' + f2(ty + 3) + ' l S Q');
              else c.push('q ' + HA.lyb.rgb(oj.col) + ' rg ' + f2(ox + 4.5) + ' ' + f2(ty - 1) + ' 9 9 re f Q q 1 g BT /F2 6 Tf ' + f2(ox + 6.5) + ' ' + f2(ty + 1.5) + ' Td (' + pe(String(oj.sym || '').slice(0, 1)) + ') Tj ET Q');
              c.push('0 g BT /F1 8 Tf ' + f2(lx0 + 30) + ' ' + f2(ty) + ' Td (' + pe(oj.name) + ') Tj ET'); return;
            }
            if (r.h) { c.push('0 g BT /F2 8 Tf ' + f2(lx0 + 5) + ' ' + f2(ty) + ' Td (' + pe(r.h) + ') Tj ET'); return; }
            if (r.lp.mode === 'fill') c.push(HA.lyb.swatchPdf(r.it, lx0 + 5, ty - 1, 18, 9)); else if (HA.lyb.isVec(r.it.sym)) c.push(HA.lyb.symPdf(lx0 + 14, ty + 3.5, 8, r.it.sym, 0)); else c.push('0 g BT /F2 9 Tf ' + f2(lx0 + 5) + ' ' + f2(ty) + ' Td (' + pe(r.it.sym) + ') Tj ET');
            c.push('0 g BT /F1 8 Tf ' + f2(lx0 + 30) + ' ' + f2(ty) + ' Td (' + pe(r.it.name) + ') Tj ET');
          });
          c.push(OB('lgl', 'Legenda lapisan', [lx0, ly0, lx0 + LWl, ly0 + LHl], c.splice(lStart).join('\n'), 'Legenda dan tabel'));
        }
      }
      if (sh && opts.layers !== false && opts.legend !== false && c.length > lgStart) { var lgs = c.splice(lgStart).join('\n'); c.push(L('Legenda dan tabel', lgs)); }
      var TWk = 0, LEFTW = 0;
      if (!sh && opts.kt !== false && kc.on && (kc.tabs || []).length) {
        var kd = kd0 || ktDraw(list, PW, PH, M, kc, f2, lhide); TWk = kd0 ? 0 : kd.w;
        if (!kd0 && MP === 'r') { LEFTW = kd.w; kd.items.forEach(function (it) { AP['kt:' + it.id] = { x: -kd.w, y: it.bb[3], s: 1 }; }); }
        kd.items.forEach(function (it) { c.push(OB('kt:' + it.id, it.name, it.bb, it.ops, 'Keterangan')); });
        (kc.tabs || []).forEach(function (id) { if (lhide['kt:' + id]) { var nm = id; KT_ALL.forEach(function (a) { if (a[0] === id) nm = a[1]; }); lrect['kt:' + id] = { name: nm, hid: true }; } });
      }
      if (opts.layOut && !sh) { opts.layOut.rects = lrect; opts.layOut.PW = PW; opts.layOut.PH = PH; opts.layOut.M = M; opts.layOut.TW = TWk; opts.layOut.OX = -LEFTW; opts.layOut.paper = pk; opts.layOut.land = land; }
      var resP = res; if (ocgs.length) resP = res.replace(/ >>$/, ' /Properties << ' + ocgs.map(function (nm) { return '/' + ocmap[nm].k + ' ' + ocmap[nm].n + ' 0 R'; }).join(' ') + ' >> >>');
      var cs = add(stream('', c.join('\n')));
      var corners = [[M, M], [M, PH - M], [PW - M, PH - M], [PW - M, M]], lp = [0, 0, 0, 1, 1, 1, 1, 0], gp = [];
      corners.forEach(function (q) { gp.push(latAt((q[1] - MT.ty) / MT.s).toFixed(7), lngAt((q[0] - MT.tx) / MT.s).toFixed(7)); });
      var vp = '/VP [ << /Type /Viewport /Name (Peta) /BBox [' + f2(M) + ' ' + f2(M) + ' ' + f2(PW - M) + ' ' + f2(PH - M) + '] /Measure << /Type /Measure /Subtype /GEO /Bounds [0 0 0 1 1 1 1 0] /GPTS [' + gp.join(' ') + '] /LPTS [' + lp.join(' ') + '] /GCS << /Type /GEOGCS /WKT (GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]) /EPSG 4326 >> /PDU [/M /DEG /DEG] >> >> ]';
      kids.push(add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [' + f2(-LEFTW) + ' 0 ' + f2(PW + (LEFTW ? 0 : TWk)) + ' ' + f2(PH) + '] /Resources ' + resP + ' /Contents ' + cs + ' 0 R ' + vp + ' >>'));
    });
    (opts.tables || []).forEach(function (tb) {
      var PER = 46, np = Math.max(1, Math.ceil(tb.rows.length / PER)), k;
      for (k = 0; k < np; k++) {
        var t = [], y = 778;
        t.push('0 g BT /F2 13 Tf 40 810 Td (' + pe(tb.title) + ') Tj ET');
        t.push('BT /F1 8 Tf 40 797 Td (' + pe((tb.sub || '') + ' - halaman ' + (k + 1) + '/' + np) + ') Tj ET');
        var hd = 'BT /F2 9 Tf '; tb.cols.forEach(function (cl) { hd += '1 0 0 1 ' + (cl.x + (cl.sw ? 14 : 0)) + ' ' + y + ' Tm (' + pe(cl.h) + ') Tj '; }); t.push(hd + 'ET 0.5 w 40 ' + (y - 4) + ' m 555 ' + (y - 4) + ' l S');
        y -= 17;
        tb.rows.slice(k * PER, k * PER + PER).forEach(function (r) {
          if (r.line) t.push('0.5 w 40 ' + (y + 11) + ' m 555 ' + (y + 11) + ' l S');
          var s2 = 'BT /F' + (r.b ? '2' : '1') + ' 9 Tf ';
          tb.cols.forEach(function (cl, i) { s2 += '1 0 0 1 ' + (cl.x + (cl.sw ? 14 : 0)) + ' ' + y + ' Tm (' + pe(String(r.c[i] == null ? '' : r.c[i]).slice(0, cl.max || 40)) + ') Tj '; });
          t.push(s2 + 'ET');
          if (r.sw) Object.keys(r.sw).forEach(function (i) { t.push('q ' + rgbc(r.sw[i]) + ' rg ' + tb.cols[+i].x + ' ' + (y - 1.5) + ' 9 9 re f Q'); });
          y -= 15;
        });
        var ts2 = add(stream('', t.join('\n')));
        kids.push(add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 595.28 841.89] /Resources ' + res + ' /Contents ' + ts2 + ' 0 R >>'));
      }
    });
    if (opts.list || !opts.map) {
      var PER = 46, np = Math.max(1, Math.ceil(list.length / PER)), k;
      for (k = 0; k < np; k++) {
        var t = [], y = 778;
        t.push('0 g BT /F2 13 Tf 40 810 Td (' + pe('Master: ' + m.name + ' - daftar blok') + ') Tj ET');
        t.push('BT /F1 8 Tf 40 797 Td (' + pe('Dicetak ' + tgl + ' - HZ Trip ' + ver + ' - halaman ' + (k + 1) + '/' + np) + ') Tj ET');
        t.push('BT /F2 9 Tf 40 ' + y + ' Td (No) Tj 40 0 Td (Blok) Tj 120 0 Td (Luas ha) Tj 90 0 Td (Lajur) Tj 80 0 Td (Panjang lajur m) Tj ET 0.5 w 40 ' + (y - 4) + ' m 480 ' + (y - 4) + ' l S');
        y -= 17;
        list.slice(k * PER, k * PER + PER).forEach(function (b, i) {
          var r = lj[b.id];
          t.push('BT /F1 9 Tf 40 ' + y + ' Td (' + (k * PER + i + 1) + ') Tj 40 0 Td (' + pe(b.name) + ') Tj 120 0 Td (' + fmtHa(HzBlok.areaHa(b.pts)) + ') Tj 90 0 Td (' + (r ? ribu(r.n) : '-') + ') Tj 80 0 Td (' + (r ? ribu(r.total) : '-') + ') Tj ET');
          y -= 15;
        });
        if (k === np - 1) t.push('0.5 w 40 ' + (y + 11) + ' m 480 ' + (y + 11) + ' l S BT /F2 9 Tf 40 ' + (y - 2) + ' Td (Total) Tj 40 0 Td (' + list.length + ' blok) Tj 120 0 Td (' + fmtHa(tot) + ') Tj ET');
        var ts = add(stream('', t.join('\n')));
        kids.push(add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 595.28 841.89] /Resources ' + res + ' /Contents ' + ts + ' 0 R >>'));
      }
    }
    objs[cat - 1] = '<< /Type /Catalog /Pages ' + pages + ' 0 R ' + (ocgs.length ? '/OCProperties << /OCGs [' + ocgs.map(function (nm) { return ocmap[nm].n + ' 0 R'; }).join(' ') + '] /D << /Order [' + ocgs.map(function (nm) { return ocmap[nm].n + ' 0 R'; }).join(' ') + '] /ON [' + ocgs.map(function (nm) { return ocmap[nm].n + ' 0 R'; }).join(' ') + '] >> >> ' : '') + '/Names << /EmbeddedFiles << /Names [(hzblok.json) ' + fsp + ' 0 R] >> >> /AF [' + fsp + ' 0 R] >>';
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
      if (b.lblOff) nb.lblOff = b.lblOff;
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
  HA.previewHzBlok = function (d) {
    var have = {}, add = 0, skip = 0;
    blocks().forEach(function (b) { have[nk(b.name)] = 1; });
    d.blocks.forEach(function (b) { if (!b || !b.pts || b.pts.length < 3 || !b.name) return; if (have[nk(b.name)]) { skip++; return; } have[nk(b.name)] = 1; add++; });
    return { added: add, skipped: skip, master: !!(d.master && d.master.pts && d.master.pts.length >= 3 && !masters().some(function (m) { return nk(m.name) === nk(d.master.name); })) };
  };
})();
