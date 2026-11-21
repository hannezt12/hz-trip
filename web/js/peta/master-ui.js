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

  // ---------- cetak (drawer > Cetak > Master) ----------
  function ribu(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fsNum(v) { var l = { s: 5, m: 7.5, l: 11 }[v]; if (l) return l; var n = parseFloat(v); return isFinite(n) ? n : null; }
  var PS = { sel: null, fmt: 'pdf', map: true, list: false, title: '', fs: 'a', pos: 'c', luas: (function () { try { return localStorage.getItem('hz_pmluas') !== '0'; } catch (e) { return true; } })() };
  function printPanel() {
    var ms = masters(); ms.forEach(function (m, i) { if (m.id == null) m.id = Date.now() + i; });
    if (!mById(PS.sel)) PS.sel = ms.length ? ms[0].id : null;
    var m = mById(PS.sel), mem = m ? members(m) : null;
    openSheet('<div class="grab"></div><div class="st">CETAK</div>' +
      '<div class="seg" id="pmMode" style="margin:6px 0 10px"><button data-m="trip">Trip</button><button data-m="master" class="on">Master</button><button data-m="laporan">Laporan</button></div>' +
      (ms.length ? '<div class="plist"><div class="h">MASTER</div>' + ms.map(function (x) {
        var mm = members(x), n = mm.in.length + mm.man.length;
        return '<label><input type="radio" name="pmSel" value="' + esc(String(x.id)) + '"' + (String(x.id) === String(PS.sel) ? ' checked' : '') + '> ' + esc(x.name) + ' <span class="muted">· ' + n + ' blok · ' + fmtHa(haOf(mm.in.concat(mm.man))) + ' ha' + (mm.pend.length ? ' · ' + mm.pend.length + ' perlu diatur' : '') + '</span></label>';
      }).join('') +
        '<div class="h">FORMAT (pilih satu)</div><div class="seg" id="pmFmt"><button data-f="pdf"' + (PS.fmt === 'pdf' ? ' class="on"' : '') + '>PDF</button><button data-f="kml"' + (PS.fmt === 'kml' ? ' class="on"' : '') + '>KML</button><button data-f="data"' + (PS.fmt === 'data' ? ' class="on"' : '') + '>Data blok</button></div>' +
        (PS.fmt === 'pdf' ? '<div class="h">ISI PDF</div><label><input type="checkbox" id="pmMap"' + (PS.map ? ' checked' : '') + '> Peta (satu lembar, ber-geo)</label><label><input type="checkbox" id="pmLuas"' + (PS.luas ? ' checked' : '') + '> Tampilkan luas di peta</label><label><input type="checkbox" id="pmList"' + (PS.list ? ' checked' : '') + '> Daftar blok lengkap</label>' +
          (HA.lyb && (HA.lyb.all().some(function (l) { return l.items.length; }) || (HA.obj && HA.obj.objs().length)) ? '<div class="h">LAPISAN BLOK (layer PDF)</div>' + HA.lyb.all().filter(function (l) { return l.items.length; }).map(function (l) { return '<label><input type="checkbox" data-lyo="' + l.id + '"' + (l.on ? ' checked' : '') + '> ' + esc(l.name) + '</label>'; }).join('') + (HA.obj && HA.obj.objs().length ? '<label><input type="checkbox" data-lyo="__obj"' + (HA.obj.on() ? ' checked' : '') + '> Objek (' + HA.obj.objs().length + ')</label>' : '') : '') +
          '<div class="h">JUDUL</div><input type="text" id="pmTtl" maxlength="60" placeholder="Kosong = nama master" value="' + esc(PS.title) + '" style="width:100%">' +
          '<div class="h">UKURAN TEKS NO BLOK (pt)</div><div class="row" style="gap:6px"><button class="btn" id="pmFm" style="width:3rem">−</button><input type="number" id="pmFn" min="1" max="30" step="0.5" inputmode="decimal" placeholder="Otomatis" value="' + (fsNum(PS.fs) != null ? fsNum(PS.fs) : '') + '" style="flex:1;text-align:center"><button class="btn" id="pmFp" style="width:3rem">+</button><button class="btn' + (fsNum(PS.fs) == null ? ' on' : '') + '" id="pmFa">Otomatis</button></div><div class="muted" style="margin-top:2px">Luas ikut ukuran ini, tampil di bawah nomor.</div>' +
          ''
          : PS.fmt === 'data' ? '<div class="muted" style="margin-top:6px">Satu berkas ringan (Zip berisi .hzblok, tanpa gambar): blok Terkonfirmasi di dalam master ini. Penerima membukanya di HZ Trip; hanya blok baru yang ditambahkan.</div>' : '<div class="muted" style="margin-top:6px">KML berisi bentuk dan posisi blok serta batas master, tanpa luasan.</div>') +
        '</div>' +
        '<div class="muted" id="pmInfo" style="margin-top:8px">' + (mem ? (mem.in.length + mem.man.length) + ' blok akan dicetak' + (mem.pend.length ? ' · ' + mem.pend.length + ' blok perbatasan belum diputuskan' : '') : '') + '</div>' +
        '<button class="btn" id="pmAtur" style="width:100%;margin-top:6px">Atur blok perbatasan</button><button class="btn" id="pmVer" style="width:100%;margin-top:6px">Versi simpanan master</button>' +
        (PS.fmt === 'pdf' && PS.map ? '<button class="btn" id="pmPosB" style="width:100%;margin-top:6px">Atur posisi teks blok</button>' : '') +
        (PS.fmt === 'pdf' ? '<button class="btn" id="pmPrev" style="width:100%;margin-top:8px">Preview</button>' : '') + '<button class="btn pri" id="pmGo" style="width:100%;margin-top:8px;height:52px">' + (PS.fmt === 'data' ? 'Kirim data blok' : 'Cetak ' + (PS.fmt === 'pdf' ? 'PDF' : 'KML')) + '</button>'
        : '<div class="card muted" style="margin-top:6px">Belum ada master. Buat di Data peta > Master: gambar poligon kawasan, lalu kembali ke sini untuk mencetak.</div>') +
      '<button class="btn" id="pmX" style="width:100%;margin-top:8px">Tutup</button>');
    $('pmX').onclick = closeSheet;
    $('pmMode').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-m]'); if (!b) return; var md = b.getAttribute('data-m'); if (md === 'trip') { closeSheet(); HA.openPrint({ day: S.hDay }); } else if (md === 'laporan' && HA.openLaporan) { closeSheet(); HA.openLaporan(); } };
    if (!ms.length) return;
    $('sheet').querySelectorAll('input[name=pmSel]').forEach(function (r) { r.onchange = function () { PS.sel = r.value; printPanel(); }; });
    $('pmFmt').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-f]'); if (b) { PS.fmt = b.getAttribute('data-f'); printPanel(); } };
    if ($('pmLuas')) $('pmLuas').onchange = function () { PS.luas = this.checked; try { localStorage.setItem('hz_pmluas', this.checked ? '1' : '0'); } catch (e) {} };
    if ($('pmTtl')) {
      $('pmTtl').oninput = function () { PS.title = this.value; };
      (function () {
        var inp = $('pmFn'), au = $('pmFa');
        function setF(v) { if (v == null) { PS.fs = 'a'; inp.value = ''; au.classList.add('on'); HA.toast('Ukuran teks: otomatis'); return; } v = Math.max(1, Math.min(30, Math.round(v * 2) / 2)); PS.fs = v; inp.value = v; au.classList.remove('on'); HA.toast('Ukuran teks ' + String(v).replace('.', ',') + ' pt'); }
        $('pmFm').onclick = function () { setF((fsNum(PS.fs) != null ? fsNum(PS.fs) : 6) - 0.5); };
        $('pmFp').onclick = function () { setF((fsNum(PS.fs) != null ? fsNum(PS.fs) : 6) + 0.5); };
        au.onclick = function () { setF(null); };
        inp.onchange = function () { var v = parseFloat(String(this.value).replace(',', '.')); setF(isFinite(v) ? v : null); };
      })();
    }
    if ($('pmPrev')) $('pmPrev').onclick = function () {
      if (!PS.map && !PS.list) { toast('Centang minimal Peta atau Daftar blok'); return; }
      cetak(m, 'pdf', { map: PS.map, list: PS.list, luas: PS.luas, title: PS.title, fs: PS.fs, pos: PS.pos }, true);
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
      cetak(m, PS.fmt, { map: PS.map, list: PS.list, luas: PS.luas, title: PS.title, fs: PS.fs, pos: PS.pos });
    };
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
        if (prev && HA.pdfPreview) { HA.pdfPreview(bytes, function () { HA.saveFile(base + '.pdf', btoa(bytes), 'application/pdf'); }); return; }
        HA.saveFile(base + '.pdf', btoa(bytes), 'application/pdf'); return;
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
      var mw = Math.max(50, (mb[3] - mb[1]) * kx), mh = Math.max(50, (mb[2] - mb[0]) * ky), land = mw >= mh, PW = land ? 1190.55 : 841.89, PH = land ? 841.89 : 1190.55, M = 24;
      var fw = PW - 2 * M, fh = PH - 2 * M, sc = Math.min(fw / (mw * 1.04), fh / (mh * 1.04)), offx = (fw - mw * sc) / 2, offy = (fh - mh * sc) / 2;
      var X = function (lng) { return M + offx + (lng - mb[1]) * kx * sc; }, Y = function (lat) { return M + offy + (lat - mb[0]) * ky * sc; };
      var lngAt = function (x) { return mb[1] + (x - M - offx) / (kx * sc); }, latAt = function (y) { return mb[0] + (y - M - offy) / (ky * sc); };
      var c = [], infos = [];
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
      c.push('BT /F2 13 Tf ' + f2(PW / 2 - tw / 2) + ' ' + f2(PH - 17) + ' Td (' + pe(ttl) + ') Tj ET');
      list.forEach(function (b) {
        var s = ''; b.pts.forEach(function (p, i) { s += f2(X(p[1])) + ' ' + f2(Y(p[0])) + (i ? ' l ' : ' m '); });
        lapA.forEach(function (lp) {
          if (lp.mode !== 'fill') return; var li = HA.lyb.of(b, lp.id); if (!li) return;
          (lapUsed[lp.id] = lapUsed[lp.id] || {})[li.id] = 1;
          c.push(L('Lapisan: ' + lp.name, HA.lyb.fillPdf(li, b.pts.map(function (p) { return [X(p[1]), Y(p[0])]; }), '/GS1')));
        });
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
        lapA.forEach(function (lp) { if (lp.mode !== 'sym') return; var li = HA.lyb.of(o.b, lp.id); if (li) { ls.push(li.sym); lyr.push('Lapisan: ' + lp.name); (lapUsed[lp.id] = lapUsed[lp.id] || {})[li.id] = 1; } });
        var lh = fsU * 1.15, y0 = cy + (ls.length * lh) / 2 - fsU * 0.85;
        ls.forEach(function (t, i) {
          var tp = 'BT /F1 ' + f2(fsU) + ' Tf ' + f2(cx - t.length * fsU * 0.52 / 2) + ' ' + f2(y0 - i * lh) + ' Td (' + pe(t) + ') Tj ET';
          // biru tinta tua (jadi abu tua di fotokopi) + halo putih tipis; tepi blok tetap hitam
          c.push(L(lyr[i], 'q 1 G 1 j ' + f2(fsU * 0.32) + ' w 1 Tr ' + tp + ' Q q 0.122 0.306 0.62 rg 0 Tr ' + tp + ' Q'));
        });
      });
      // skala dan panah utara
      var scStart = c.length;
      var L0 = [100, 200, 500, 1000, 2000, 5000].filter(function (v) { return v * sc < fw * 0.25; }).pop() || 100, bx = PW / 2 - L0 * sc / 2, by = M + 16;
      c.push('1 w ' + f2(bx) + ' ' + f2(by) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by) + ' l S ' + f2(bx) + ' ' + f2(by - 4) + ' m ' + f2(bx) + ' ' + f2(by + 4) + ' l S ' + f2(bx + L0 * sc) + ' ' + f2(by - 4) + ' m ' + f2(bx + L0 * sc) + ' ' + f2(by + 4) + ' l S');
      c.push('BT /F1 8 Tf ' + f2(bx) + ' ' + f2(by + 7) + ' Td (' + (L0 >= 1000 ? (L0 / 1000) + ' km' : L0 + ' m') + ') Tj ET');
      var nx0 = PW - M - 24, ny0 = PH - M - 46;
      c.push('1 w ' + f2(nx0) + ' ' + f2(ny0) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l S ' + f2(nx0 - 5) + ' ' + f2(ny0 + 20) + ' m ' + f2(nx0) + ' ' + f2(ny0 + 28) + ' l ' + f2(nx0 + 5) + ' ' + f2(ny0 + 20) + ' l S');
      c.push('BT /F2 9 Tf ' + f2(nx0 - 3) + ' ' + f2(ny0 - 10) + ' Td (U) Tj ET');
      if (c.length > scStart) c.push(L('Legenda dan tabel', c.splice(scStart).join('\n')));
      // legenda: tabel info (Master: sudut paling kosong; Laporan: kanan bawah), kotak daftar (kiri, bisa digeser), keterangan (kiri bawah)
      var rows = [['Master', m.name.length > 24 ? m.name.slice(0, 23) + '.' : m.name], ['Jumlah blok', String(list.length)], ['Total luas', fmtHa(tot) + ' ha']].concat(opts.dates ? [[opts.datesLbl || 'Tanggal', opts.dates]] : [], [['Dicetak', tgl], ['Versi app', ver]]);
      if (sh && sh.info) rows = rows.concat(sh.info);
      var kf = (opts.lgFs || 8) / 8, fb = f2(8 * kf), lgStart = c.length;
      if (opts.legend !== false) {
        var IW = 190, RH0 = 14, IH = RH0 * rows.length, G = 10;
        var cands = sh ? [[PW - M - G - IW, M + G]] : [[PW - M - G - IW, M + G], [M + G, M + G], [M + G, PH - M - G - IH]];
        var ovl = function (cd) { var n = 0; infos.forEach(function (o) { if (o.x1 > cd[0] - 6 && o.x0 < cd[0] + IW + 6 && o.y1 > cd[1] - 6 && o.y0 < cd[1] + IH + 6) n++; }); return n; };
        var best = cands[0], bo = ovl(best); cands.forEach(function (cd) { var o2 = ovl(cd); if (o2 < bo) { bo = o2; best = cd; } });
        var ix = best[0], iy = best[1];
        c.push('1 g 0.5 w ' + f2(ix) + ' ' + f2(iy) + ' ' + f2(IW) + ' ' + f2(IH) + ' re f 0 g ' + f2(ix) + ' ' + f2(iy) + ' ' + f2(IW) + ' ' + f2(IH) + ' re S');
        rows.forEach(function (r, i) {
          var ty = iy + IH - RH0 * (i + 1);
          if (i) c.push('0.5 w ' + f2(ix) + ' ' + f2(ty + RH0) + ' m ' + f2(ix + IW) + ' ' + f2(ty + RH0) + ' l S');
          c.push('BT /F2 8 Tf ' + f2(ix + 5) + ' ' + f2(ty + 4) + ' Td (' + pe(r[0]) + ') Tj ET BT /F1 8 Tf ' + f2(ix + 74) + ' ' + f2(ty + 4) + ' Td (' + pe(r[1]) + ') Tj ET');
        });
        c.push('0.5 w ' + f2(ix + 70) + ' ' + f2(iy) + ' m ' + f2(ix + 70) + ' ' + f2(iy + IH) + ' l S');
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
        var rowsL = []; lapA.forEach(function (lp) { var u = lapUsed[lp.id]; if (!u) return; rowsL.push({ h: lp.name }); lp.items.forEach(function (it) { if (u[it.id]) rowsL.push({ lp: lp, it: it }); }); });
        if (Object.keys(objU).length) { rowsL.push({ h: 'Objek' }); HA.obj.jenis().forEach(function (j) { if (objU[j.id]) rowsL.push({ oj: j }); }); }
        if (rowsL.length) {
          var RHl = 12, LWl = 140, LHl = rowsL.length * RHl + 6, lx0 = M + 10, ly0 = M + 10 + (sh && sh.keter ? sh.keter.length * 16 + 8 : 0);
          c.push('1 g 0.5 w ' + f2(lx0) + ' ' + f2(ly0) + ' ' + f2(LWl) + ' ' + f2(LHl) + ' re f 0 G ' + f2(lx0) + ' ' + f2(ly0) + ' ' + f2(LWl) + ' ' + f2(LHl) + ' re S');
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
            if (r.lp.mode === 'fill') c.push(HA.lyb.swatchPdf(r.it, lx0 + 5, ty - 1, 18, 9)); else c.push('0 g BT /F2 9 Tf ' + f2(lx0 + 5) + ' ' + f2(ty) + ' Td (' + pe(r.it.sym) + ') Tj ET');
            c.push('0 g BT /F1 8 Tf ' + f2(lx0 + 30) + ' ' + f2(ty) + ' Td (' + pe(r.it.name) + ') Tj ET');
          });
        }
      }
      if (opts.layers !== false && opts.legend !== false && c.length > lgStart) { var lgs = c.splice(lgStart).join('\n'); c.push(L('Legenda dan tabel', lgs)); }
      var resP = res; if (ocgs.length) resP = res.replace(/ >>$/, ' /Properties << ' + ocgs.map(function (nm) { return '/' + ocmap[nm].k + ' ' + ocmap[nm].n + ' 0 R'; }).join(' ') + ' >> >>');
      var cs = add(stream('', c.join('\n')));
      var corners = [[M, M], [M, PH - M], [PW - M, PH - M], [PW - M, M]], lp = [0, 0, 0, 1, 1, 1, 1, 0], gp = [];
      corners.forEach(function (q) { gp.push(latAt(q[1]).toFixed(7), lngAt(q[0]).toFixed(7)); });
      var vp = '/VP [ << /Type /Viewport /Name (Peta) /BBox [' + f2(M) + ' ' + f2(M) + ' ' + f2(PW - M) + ' ' + f2(PH - M) + '] /Measure << /Type /Measure /Subtype /GEO /Bounds [0 0 0 1 1 1 1 0] /GPTS [' + gp.join(' ') + '] /LPTS [' + lp.join(' ') + '] /GCS << /Type /GEOGCS /WKT (GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]) /EPSG 4326 >> /PDU [/M /DEG /DEG] >> >> ]';
      kids.push(add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + f2(PW) + ' ' + f2(PH) + '] /Resources ' + resP + ' /Contents ' + cs + ' 0 R ' + vp + ' >>'));
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
