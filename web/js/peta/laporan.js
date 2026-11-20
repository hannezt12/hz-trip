/* HZ Trip v0.17.2 - Laporan: Bulanan (kategori berwarna, blok penuh) dan Tahunan (Kategori 1 garis tepi, Kategori 2 isi, warna bulan tetap); lembar 2 tabel; editor posisi teks blok dan legenda */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.masterCetak || !HA.BT) return;
  var S = HA.S;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  function toast(t) { HA.toast(t); }
  function nk(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function masters() { return S.settings.masters || (S.settings.masters = []); }
  function mById(id) { return masters().filter(function (m) { return String(m.id) === String(id); })[0]; }
  function addDays(iso, n) { var a = iso.split('-'), d = new Date(+a[0], +a[1] - 1, +a[2] + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dayDiff(a, b) { var x = a.split('-'), y = b.split('-'); return Math.round((new Date(+y[0], +y[1] - 1, +y[2]) - new Date(+x[0], +x[1] - 1, +x[2])) / 864e5); }
  function dmy(iso) { return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(2, 4); }
  function fmtHa(v) { return v.toFixed(2).replace('.', ','); }
  function natc(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); }
  var MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MC0 = ['#e6194b', '#f58231', '#ffe119', '#8fd14f', '#2e8b3d', '#17bebb', '#4fc3f7', '#1f4fa8', '#8e44ad', '#d81b9a', '#8d5524', '#6c7a89'];
  var YR = +S.today.slice(0, 4);
  var DEF = function () { return { sel: null, jn: 'bulanan', scope: 'master', blk: '', from: addDays(S.today, -29), to: S.today, cs: [], k1: '', k2: '', y1: YR, m1: 1, y2: YR, m2: 12, kNo: true, luas: true, kLeg: true, bw: 1, fs: 2, title: '', lt: {}, lr: {}, mc: null, lg: { x: null, y: null, fs: 8 } }; };
  var PS = Object.assign(DEF(), S.settings.lpPS || {});
  PS.lg = Object.assign({ x: null, y: null, fs: 8 }, PS.lg || {}); if (!PS.lt) PS.lt = {}; if (!PS.lr) PS.lr = {}; if (!Array.isArray(PS.cs)) PS.cs = [];
  var AC = { k1: false, k2: false };
  function persist() { S.settings.lpPS = JSON.parse(JSON.stringify(PS)); HA.saveSettings(); }
  function mcol(n) { return (PS.mc && PS.mc[n - 1]) || MC0[n - 1]; }
  function clampNum(v, a, b, d) { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v)) return d; return Math.max(a, Math.min(b, v)); }
  function cats() { return HA.tandaData().cats; }
  function catById(id) { return HA.tandaCatOf(id); }
  function catName(id) { var c = catById(id); return PS.lt[id] || (c ? c.name : 'Tanda'); }
  // ---------- rentang ----------
  function monthsN() { return (PS.y2 - PS.y1) * 12 + (PS.m2 - PS.m1) + 1; }
  function range() {
    if (PS.jn === 'tahunan') { var last = new Date(PS.y2, PS.m2, 0).getDate(); return { from: PS.y1 + '-' + ('0' + PS.m1).slice(-2) + '-01', to: PS.y2 + '-' + ('0' + PS.m2).slice(-2) + '-' + ('0' + last).slice(-2) }; }
    return { from: PS.from, to: PS.to };
  }
  function rangeOk() {
    if (PS.jn === 'tahunan') { var n = monthsN(); if (n < 1) return 'Bulan Dari harus sebelum Sampai'; if (n > 12) return 'Rentang maksimal 12 bulan'; return ''; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(PS.from) || !/^\d{4}-\d{2}-\d{2}$/.test(PS.to)) return 'Isi tanggal Dari dan Sampai';
    if (PS.from > PS.to) return 'Tanggal Dari harus sebelum Sampai';
    if (dayDiff(PS.from, PS.to) + 1 > 31) return 'Rentang maksimal 1 bulan (31 hari)';
    return '';
  }
  function scopeList(m) {
    var mem = HA.masterMembers(m), list = mem.in.concat(mem.man);
    if (PS.scope === 'blok') { var tk = String(PS.blk || '').split(',').map(nk).filter(Boolean); list = list.filter(function (b) { return tk.indexOf(nk(b.name)) >= 0; }); }
    return list;
  }
  function luasTxt(it) { var st = HA.tandaStat(it); if (it.t === 'pg') return fmtHa(st.ha || 0) + ' ha'; if (it.t === 'ln') return Math.round(st.m || 0) + ' m'; return '1 titik'; }
  function areaOf(it) { return it.t === 'pg' ? (HA.tandaStat(it).ha || 0) : 0; }
  // ---------- hitung ----------
  function collect(list, ids) {
    var R = range(), recs = [];
    list.forEach(function (b) {
      HA.BT.itemsOf(b).forEach(function (it) {
        if (!it.cat || ids.indexOf(it.cat) < 0) return;
        var d = HA.tandaU.dateOf(it); if (d < R.from || d > R.to) return;
        recs.push({ b: b, it: it, d: d, ci: ids.indexOf(it.cat) });
      });
    });
    return recs;
  }
  function detailTable(m, recs, ids, periode) {
    recs.sort(function (x, y) { if (x.d !== y.d) return x.d < y.d ? -1 : 1; var n = natc(x.b.name, y.b.name); if (n) return n; if (x.ci !== y.ci) return x.ci - y.ci; return (x.it.ts || 0) - (y.it.ts || 0); });
    var rows = recs.map(function (r) {
      var c = catById(r.it.cat), nm = String(HA.tandaTabName(r.it) || '').replace(' / ', ' - ');
      return { c: [dmy(r.d), r.b.name, nm, luasTxt(r.it), fmtHa(HzBlok.areaHa(r.b.pts)) + ' ha'], sw: { 2: c ? c.col : '#888888' } };
    });
    var tot = {}; recs.forEach(function (r) { var k = r.it.cat; tot[k] = tot[k] || { ha: 0, m: 0, n: 0 }; if (r.it.t === 'pg') tot[k].ha += areaOf(r.it); else if (r.it.t === 'ln') tot[k].m += HA.tandaStat(r.it).m || 0; else tot[k].n++; });
    var first = true;
    ids.forEach(function (id) {
      var t = tot[id]; if (!t) return;
      var s = []; if (t.ha || (!t.m && !t.n)) s.push(fmtHa(t.ha) + ' ha'); if (t.m) s.push(Math.round(t.m) + ' m'); if (t.n) s.push(t.n + ' titik');
      var c = catById(id); rows.push({ c: ['', 'Total', (c ? c.name : 'Tanda'), s.join(' / '), ''], sw: { 2: c ? c.col : '#888888' }, b: true, line: first }); first = false;
    });
    return { title: 'Rincian kegiatan', sub: m.name + ' - ' + periode, cols: [{ h: 'Tanggal', x: 40, max: 10 }, { h: 'Blok', x: 100, max: 18 }, { h: 'Kategori', x: 190, sw: true, max: 34 }, { h: 'Luas', x: 420, max: 14 }, { h: 'Luas blok', x: 490, max: 12 }], rows: rows };
  }
  // ---------- susun laporan ----------
  function build(m) {
    var list = scopeList(m), R = range(), periode = dmy(R.from) + ' - ' + dmy(R.to), sh, tables = [], i;
    if (PS.jn === 'tahunan') {
      var ids = [PS.k1].concat(PS.k2 ? [PS.k2] : []);
      var recs = collect(list, ids); if (!recs.length) return null;
      var byB = {}; recs.forEach(function (r) { var k = r.b.id + '|' + r.it.cat; (byB[k] = byB[k] || { b: r.b, cat: r.it.cat, ms: {} }); var mk = r.d.slice(0, 7), o = byB[k].ms[mk] || (byB[k].ms[mk] = { a: 0 }); o.a += areaOf(r.it); });
      var fills = []; Object.keys(byB).forEach(function (k) {
        var o = byB[k], best = null; Object.keys(o.ms).forEach(function (mk) { if (!best || o.ms[mk].a > o.ms[best].a || (o.ms[mk].a === o.ms[best].a && mk > best)) best = mk; });
        fills.push({ pts: o.b.pts, mode: o.cat === PS.k1 ? 'ring' : 'inner', col: mcol(+best.slice(5, 7)) });
      });
      var leg = [], y = PS.y1, mo = PS.m1, cross = PS.y1 !== PS.y2;
      for (i = 0; i < monthsN(); i++) { var key = y + '-' + ('0' + mo).slice(-2), base = PS.lr['m:' + key] || (MN[mo - 1] + (cross ? ' ' + String(y).slice(2) : '')); leg.push({ key: 'm:' + key, base: base, col: mcol(mo), txt: base }); mo++; if (mo > 12) { mo = 1; y++; } }
      var keter = [{ kind: 'ring', txt: 'Garis tepi = ' + catName(PS.k1) }]; if (PS.k2) keter.push({ kind: 'fill', txt: 'Warna dalam = ' + catName(PS.k2) });
      var sum = {}; recs.forEach(function (r) { var mk = r.d.slice(0, 7); sum[mk] = sum[mk] || [0, 0]; sum[mk][r.it.cat === PS.k1 ? 0 : 1] += areaOf(r.it); });
      var srows = [], t1 = 0, t2 = 0; y = PS.y1; mo = PS.m1;
      for (i = 0; i < monthsN(); i++) { var mk2 = y + '-' + ('0' + mo).slice(-2), v = sum[mk2] || [0, 0]; t1 += v[0]; t2 += v[1]; srows.push({ c: [MN[mo - 1] + (cross ? ' ' + y : ''), fmtHa(v[0]) + ' ha', PS.k2 ? fmtHa(v[1]) + ' ha' : ''], sw: { 0: mcol(mo) } }); mo++; if (mo > 12) { mo = 1; y++; } }
      srows.push({ c: ['Total', fmtHa(t1) + ' ha', PS.k2 ? fmtHa(t2) + ' ha' : ''], b: true, line: true });
      tables.push({ title: 'Laporan Tahunan - ringkasan per bulan', sub: m.name + ' - ' + periode, cols: [{ h: 'Bulan', x: 40, sw: true, max: 24 }, { h: 'Luas ' + catName(PS.k1), x: 250, max: 28 }, { h: PS.k2 ? 'Luas ' + catName(PS.k2) : '', x: 410, max: 28 }], rows: srows });
      tables.push(detailTable(m, recs, ids, periode));
      sh = { name: 'Laporan Tahunan', fills: fills, leg: leg, keter: keter, info: [['Jenis', 'Tahunan']] };
    } else {
      var cs = PS.cs.filter(function (id) { return !!catById(id); });
      var rc = collect(list, cs); if (!rc.length) return null;
      var best2 = {}; rc.forEach(function (r) { var k = r.b.id; if (best2[k] == null || r.ci < best2[k].ci) best2[k] = { b: r.b, ci: r.ci }; });
      var fl = Object.keys(best2).map(function (k) { var o = best2[k], c = catById(cs[o.ci]); return { pts: o.b.pts, mode: 'full', col: c ? c.col : '#888888' }; });
      var seen = {}, lg2 = []; rc.forEach(function (r) { seen[r.it.cat] = 1; });
      cs.forEach(function (id) { if (seen[id]) { var c = catById(id); lg2.push({ key: 'c:' + id, base: catName(id), col: c ? c.col : '#888888', txt: catName(id) }); } });
      tables.push(detailTable(m, rc, cs, periode));
      sh = { name: 'Laporan Bulanan', fills: fl, leg: lg2, info: [['Jenis', 'Bulanan']] };
    }
    return { list: list, sheet: sh, tables: tables, periode: periode };
  }
  function buildOpts(m) {
    var B = build(m); if (!B) return null;
    return { map: true, layers: true, sheets: [B.sheet], tables: B.tables, list: false, luas: PS.luas, title: PS.title, name: PS.kNo, bw: PS.bw, fsPt: PS.fs, legend: PS.kLeg, lgFs: PS.lg.fs || 8, lgPos: PS.lg.x != null ? { x: PS.lg.x, y: PS.lg.y } : null, dates: B.periode, datesLbl: 'Periode', only: B.list };
  }
  // ---------- panel ----------
  function rerender() { var el = $('sheet'), st = el ? el.scrollTop : 0; panel(); var e2 = $('sheet'); if (e2) e2.scrollTop = st; }
  function acc(key, label, cur, choices, none) {
    var c = cur ? catById(cur) : null;
    return '<div class="pmAc"><button type="button" class="pmAh" data-a="' + key + '"><span>' + label + '</span><b>' + (c ? esc(c.name) : (none ? 'Tidak ada' : 'Pilih…')) + '</b><i>' + (AC[key] ? '▴' : '▾') + '</i></button>' +
      (AC[key] ? '<div class="pmAb">' + (none ? '<label><input type="radio" name="pm_' + key + '" value=""' + (!cur ? ' checked' : '') + '> Tidak ada</label>' : '') + choices.map(function (x) { return '<label><input type="radio" name="pm_' + key + '" value="' + x.id + '"' + (cur === x.id ? ' checked' : '') + '><i class="pmSw" style="background:' + x.col + '"></i>' + esc(x.name) + '</label>'; }).join('') + '</div>' : '') + '</div>';
  }
  function monSel(id, v) { return '<select id="' + id + '">' + MN.map(function (n, i) { return '<option value="' + (i + 1) + '"' + (v === i + 1 ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>'; }
  function yrSel(id, v) { var o = ''; for (var y = YR - 5; y <= YR + 1; y++) o += '<option value="' + y + '"' + (v === y ? ' selected' : '') + '>' + y + '</option>'; return '<select id="' + id + '">' + o + '</select>'; }
  function panel() {
    var ms = masters(); ms.forEach(function (m, i) { if (m.id == null) m.id = Date.now() + i; });
    if (!mById(PS.sel)) PS.sel = ms.length ? ms[0].id : null;
    var m = mById(PS.sel), list = m ? scopeList(m) : [], cl = cats();
    if (PS.k1 && PS.k1 === PS.k2) PS.k2 = '';
    var h = '<div class="grab"></div><div class="st">CETAK</div><div class="seg" id="pmMode" style="margin:6px 0 10px"><button data-m="trip">Trip</button><button data-m="master">Master</button><button data-m="laporan" class="on">Laporan</button></div>';
    if (!ms.length) { HA.openSheet(h + '<div class="card muted" style="margin-top:6px">Belum ada master. Buat di Data peta > Master: gambar poligon kawasan, lalu kembali ke sini.</div><button class="btn" id="pmX" style="width:100%;margin-top:8px">Tutup</button>'); $('pmX').onclick = HA.closeSheet; wireMode(); return; }
    var thn = PS.jn === 'tahunan';
    h += '<div class="plist"><div class="h">MASTER</div>' + ms.map(function (x) { return '<label><input type="radio" name="pmSel" value="' + esc(String(x.id)) + '"' + (String(x.id) === String(PS.sel) ? ' checked' : '') + '> ' + esc(x.name) + '</label>'; }).join('') +
      '<div class="h">JENIS LAPORAN</div><div class="seg" id="pmJn"><button data-j="bulanan"' + (!thn ? ' class="on"' : '') + '>Bulanan</button><button data-j="tahunan"' + (thn ? ' class="on"' : '') + '>Tahunan</button></div>' +
      '<div class="h">KATEGORI</div>' +
      (thn ? acc('k1', 'Kategori 1 (garis tepi)', PS.k1, cl, false) + acc('k2', 'Kategori 2 (isi dalam)', PS.k2, cl.filter(function (c) { return c.id !== PS.k1; }), true) + '<div class="muted" style="margin-top:4px">Sub kategori ikut kategorinya dan hanya tampil di lembar tabel.</div>'
        : '<div class="pmCats">' + (cl.length ? cl.map(function (c) { var i = PS.cs.indexOf(c.id); return '<label class="pmC"><input type="checkbox" data-c="' + c.id + '"' + (i >= 0 ? ' checked' : '') + '><i class="pmSw" style="background:' + c.col + '"></i>' + esc(c.name) + (i >= 0 ? '<b class="pmOrd">' + (i + 1) + '</b>' : '') + '</label>'; }).join('') : '<div class="muted">Belum ada kategori.</div>') + '</div><div class="muted" style="margin-top:4px">Urutan centang = prioritas warna bila satu blok punya beberapa kategori; kategori lain tetap tampil di tabel.</div>') +
      '<div class="h">CAKUPAN</div><div class="seg" id="pmSc"><button data-s="master"' + (PS.scope === 'master' ? ' class="on"' : '') + '>Master</button><button data-s="blok"' + (PS.scope === 'blok' ? ' class="on"' : '') + '>Blok tertentu</button></div>' +
      (PS.scope === 'blok' ? '<input type="text" id="pmBlk" placeholder="No blok, pisahkan koma (mis. 04 TS 16, 04 TS 17)" value="' + esc(PS.blk) + '" style="width:100%;margin-top:6px">' : '') +
      '<div class="muted" id="pmN" style="margin-top:4px">' + list.length + ' blok akan dicetak</div>' +
      (thn ? '<div class="h">BULAN (maksimal 12 bulan)</div><div class="row" style="gap:8px"><label class="calL">Dari bulan' + monSel('pmM1', PS.m1) + '</label><label class="calL">Tahun' + yrSel('pmY1', PS.y1) + '</label></div><div class="row" style="gap:8px;margin-top:4px"><label class="calL">Sampai bulan' + monSel('pmM2', PS.m2) + '</label><label class="calL">Tahun' + yrSel('pmY2', PS.y2) + '</label></div>' +
        '<div class="h">WARNA BULAN</div><div class="pmMc" id="pmMc">' + MN.map(function (n, i) { return '<label><input type="color" data-n="' + (i + 1) + '" value="' + mcol(i + 1) + '"><span>' + n.slice(0, 3) + '</span></label>'; }).join('') + '</div><button class="btn" id="pmMcR" style="width:100%;margin-top:4px">Kembalikan warna bulan</button>'
        : '<div class="h">TANGGAL (maksimal 1 bulan)</div><div class="row" style="gap:8px"><label class="calL">Dari<input type="date" id="pmFr" max="' + S.today + '" value="' + PS.from + '"></label><label class="calL">Sampai<input type="date" id="pmTo" max="' + S.today + '" value="' + PS.to + '"></label></div><div class="muted" style="margin-top:4px">Warna blok mengikuti warna kategori.</div>') +
      '<div class="h">TAMPILKAN</div><label><input type="checkbox" id="pmKn"' + (PS.kNo ? ' checked' : '') + '> No blok</label><label><input type="checkbox" id="pmLuas"' + (PS.luas ? ' checked' : '') + '> Luas blok (ha)</label><label><input type="checkbox" id="pmKg"' + (PS.kLeg ? ' checked' : '') + '> Legenda</label>' +
      '<div class="h">UKURAN</div><div class="row" style="gap:8px"><label class="calL">Garis blok (px)<input type="number" id="pmBw" min="0.5" max="9" step="0.5" value="' + PS.bw + '"></label><label class="calL">Teks (pt)<input type="number" id="pmFs" min="1" max="12" step="0.5" value="' + PS.fs + '"></label></div>' +
      '<div class="h">JUDUL</div><input type="text" id="pmTtl" maxlength="60" placeholder="Kosong = nama master" value="' + esc(PS.title) + '" style="width:100%">' +
      '<div class="h">DRAFT LAPORAN</div><div class="row" style="gap:6px"><select id="pmDr" style="flex:1">' + (S.settings.lpDrafts || []).map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + '</option>'; }).join('') + '</select><button class="btn" id="pmDrL">Muat</button><button class="btn" id="pmDrS">Simpan</button><button class="btn" id="pmDrD">Hapus</button></div>' +
      '<div class="muted" style="margin-top:4px">Draft hanya menyimpan pengaturan laporan. Data selalu yang terbaru.</div>' +
      '<button class="btn" id="pmPos" style="width:100%;margin-top:10px">Atur posisi teks &amp; legenda</button>' +
      '<button class="btn" id="pmPrev" style="width:100%;margin-top:8px">Preview</button><button class="btn pri" id="pmGo" style="width:100%;margin-top:8px;height:52px">Cetak PDF</button></div><button class="btn" id="pmX" style="width:100%;margin-top:8px">Tutup</button>';
    HA.openSheet(h);
    wire(m);
  }
  function wireMode() { var e = $('pmMode'); if (e) e.onclick = function (ev) { var b = ev.target.closest && ev.target.closest('button[data-m]'); if (!b) return; var md = b.getAttribute('data-m'); if (md === 'trip') { HA.closeSheet(); HA.openPrint({ day: S.hDay }); } else if (md === 'master') { HA.closeSheet(); HA.openPrintMaster(); } }; }
  function ctx(m) {
    var B = build(m);
    return { list: scopeList(m), fs: PS.fs, bw: PS.bw, kNo: PS.kNo, luas: PS.luas, sheet: B ? B.sheet : null, legOn: PS.kLeg, lg: PS.lg, persist: persist, back: panel,
      edit: function (key, v) { if (key.slice(0, 2) === 'm:') { if (v) PS.lr[key] = v; else delete PS.lr[key]; } else { var id = key.slice(2); if (v) PS.lt[id] = v; else delete PS.lt[id]; } persist(); var B2 = build(m); return B2 ? B2.sheet : null; } };
  }
  function wire(m) {
    var sh = $('sheet');
    $('pmX').onclick = HA.closeSheet; wireMode();
    sh.querySelectorAll('input[name=pmSel]').forEach(function (r) { r.onchange = function () { PS.sel = r.value; persist(); rerender(); }; });
    $('pmJn').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-j]'); if (b) { PS.jn = b.getAttribute('data-j'); persist(); rerender(); } };
    sh.querySelectorAll('.pmC input').forEach(function (e) { e.onchange = function () { var id = e.getAttribute('data-c'), i = PS.cs.indexOf(id); if (e.checked && i < 0) PS.cs.push(id); else if (!e.checked && i >= 0) PS.cs.splice(i, 1); persist(); rerender(); }; });
    sh.querySelectorAll('.pmAh').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-a'); AC[k] = !AC[k]; rerender(); }; });
    ['k1', 'k2'].forEach(function (k) { sh.querySelectorAll('input[name=pm_' + k + ']').forEach(function (r) { r.onchange = function () { PS[k] = r.value; if (PS.k1 && PS.k1 === PS.k2) PS.k2 = ''; AC[k] = false; persist(); rerender(); }; }); });
    $('pmSc').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-s]'); if (b) { PS.scope = b.getAttribute('data-s'); persist(); rerender(); } };
    function cnt() { if ($('pmN')) $('pmN').textContent = scopeList(m).length + ' blok akan dicetak'; }
    if ($('pmBlk')) { $('pmBlk').oninput = function () { PS.blk = this.value; cnt(); }; $('pmBlk').onchange = persist; }
    if ($('pmFr')) { $('pmFr').onchange = function () { if (this.value) { PS.from = this.value; persist(); } }; $('pmTo').onchange = function () { if (this.value) { PS.to = this.value; persist(); } }; }
    if ($('pmM1')) { [['pmM1', 'm1'], ['pmY1', 'y1'], ['pmM2', 'm2'], ['pmY2', 'y2']].forEach(function (p) { $(p[0]).onchange = function () { PS[p[1]] = +this.value; persist(); }; }); }
    if ($('pmMc')) { $('pmMc').onchange = function (e) { var n = +e.target.getAttribute('data-n'); if (!n) return; if (!PS.mc) PS.mc = MC0.slice(); PS.mc[n - 1] = e.target.value; persist(); }; $('pmMcR').onclick = function () { PS.mc = null; persist(); rerender(); }; }
    [['pmKn', 'kNo'], ['pmLuas', 'luas'], ['pmKg', 'kLeg']].forEach(function (p) { $(p[0]).onchange = function () { PS[p[1]] = this.checked; persist(); }; });
    $('pmBw').onchange = function () { PS.bw = Math.round(clampNum(this.value, 0.5, 9, 1) * 2) / 2; this.value = PS.bw; persist(); };
    $('pmFs').onchange = function () { PS.fs = Math.round(clampNum(this.value, 1, 12, 2) * 2) / 2; this.value = PS.fs; persist(); };
    $('pmTtl').oninput = function () { PS.title = this.value; }; $('pmTtl').onchange = persist;
    $('pmDrS').onclick = saveDraft; $('pmDrL').onclick = loadDraft; $('pmDrD').onclick = delDraft;
    $('pmPos').onclick = function () { if (!scopeList(m).length) { toast('Belum ada blok yang dicetak'); return; } var er = rangeOk(); if (er) { toast(er); return; } HA.closeSheet(); posEditor(m, ctx(m)); };
    function go(prev) {
      var er = rangeOk(); if (er) { toast(er); return; }
      if (PS.jn === 'tahunan' ? !PS.k1 : !PS.cs.length) { toast(PS.jn === 'tahunan' ? 'Pilih Kategori 1' : 'Centang minimal satu kategori'); return; }
      if (!scopeList(m).length) { toast(PS.scope === 'blok' ? 'Tidak ada blok yang cocok dengan No blok itu' : 'Belum ada blok Terkonfirmasi di master ini'); return; }
      persist(); var o = buildOpts(m); if (!o) { toast('Tidak ada kegiatan pada kategori dan tanggal yang dipilih'); return; }
      HA.masterCetak(m, 'pdf', o, prev);
    }
    $('pmPrev').onclick = function () { go(true); }; $('pmGo').onclick = function () { go(false); };
  }
  // ---------- draft ----------
  function saveDraft() {
    HA.openSheet('<div class="grab"></div><div class="st">SIMPAN DRAFT</div><input type="text" id="drN" maxlength="40" placeholder="Nama draft (mis. Laporan Pembakaran Okt)" style="width:100%;margin-top:8px"><div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="drX" style="flex:1">Batal</button><button class="btn pri" id="drY" style="flex:1">Simpan</button></div>');
    $('drX').onclick = panel;
    $('drY').onclick = function () {
      var n = $('drN').value.trim(); if (!n) { toast('Isi nama draft'); return; }
      var a = S.settings.lpDrafts || (S.settings.lpDrafts = []), ex = a.filter(function (d) { return d.name === n; })[0], snap = JSON.parse(JSON.stringify(PS));
      if (ex) ex.ps = snap; else a.push({ id: String(Date.now()), name: n, ps: snap });
      HA.saveSettings(); toast('Draft tersimpan'); panel();
    };
  }
  function loadDraft() {
    var id = $('pmDr') && $('pmDr').value, d = (S.settings.lpDrafts || []).filter(function (x) { return x.id === id; })[0];
    if (!d) { toast('Belum ada draft'); return; }
    var sel = PS.sel; PS = Object.assign(DEF(), d.ps); PS.sel = sel; PS.lg = Object.assign({ x: null, y: null, fs: 8 }, PS.lg || {}); if (!PS.lt) PS.lt = {}; if (!PS.lr) PS.lr = {}; if (!Array.isArray(PS.cs)) PS.cs = [];
    persist(); toast('Draft dimuat: ' + d.name); panel();
  }
  function delDraft() {
    var id = $('pmDr') && $('pmDr').value, d = (S.settings.lpDrafts || []).filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    HA.askConfirm('Hapus draft?', d.name + '. Hanya pengaturan laporan yang dihapus, data tidak.', 'Hapus', function () { S.settings.lpDrafts = S.settings.lpDrafts.filter(function (x) { return x.id !== id; }); HA.saveSettings(); panel(); });
    var cn = $('cfNo'); if (cn) cn.onclick = panel;
  }
  // ---------- atur posisi teks blok dan legenda ----------
  var ED = null;
  HA.pmEdClose = function () { if (!ED) return false; closeEd(); return true; };
  function closeEd() { var b = ED && ED.back; if (ED) { ED.el.remove(); ED = null; } if (b) b(); }
  HA.lpPos = function (m, o) { posEditor(m, o); };
  function posEditor(m, o) {
    o.lg = o.lg || { x: null, y: null, fs: 8 }; o.persist = o.persist || function () {};
    var list = o.list, all = m.pts.slice(), shn = o.sheet, LGS = false;
    list.forEach(function (b) { b.pts.forEach(function (p) { all.push(p); }); });
    var la0 = 90, lo0 = 180, la1 = -90, lo1 = -180; all.forEach(function (p) { la0 = Math.min(la0, p[0]); la1 = Math.max(la1, p[0]); lo0 = Math.min(lo0, p[1]); lo1 = Math.max(lo1, p[1]); });
    var latc = (la0 + la1) / 2, kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 111320;
    var mw = Math.max(50, (lo1 - lo0) * kx), mh = Math.max(50, (la1 - la0) * ky), land = mw >= mh, PW = land ? 1190.55 : 841.89, PH = land ? 841.89 : 1190.55, M = 24, G = 10, RW = 2.5;
    var sc = Math.min((PW - 2 * M) / (mw * 1.04), (PH - 2 * M) / (mh * 1.04)), fsM = o.fs / sc, lhM = fsM * 1.15;
    var offx = (PW - 2 * M - mw * sc) / 2, offy = (PH - 2 * M - mh * sc) / 2;
    function XY(p) { return [(p[1] - lo0) * kx, -(p[0] - la0) * ky]; }
    var el = document.createElement('div'); el.id = 'pmEd'; el.className = 'pmEd';
    el.innerHTML = '<div class="pmEh"><button class="btn" id="edX">Selesai</button><button class="btn" id="edZm">−</button><button class="btn" id="edZp">+</button><button class="btn" id="edFm">A−</button><button class="btn" id="edFp">A+</button><button class="btn" id="edC" disabled>Tengah</button><div id="edI" class="muted"></div></div><div class="edTx" id="edTx" hidden><input type="text" id="edTi" maxlength="30"><button class="btn pri" id="edTo">OK</button></div><svg id="edS" xmlns="http://www.w3.org/2000/svg"></svg>';
    document.body.appendChild(el); ED = { el: el, back: o.back };
    var svg = $('edS'), ns = 'http://www.w3.org/2000/svg', W0 = mw * 1.04, H0 = mh * 1.04, vb = { x: (-M - offx) / sc, y: -(PH - M - offy) / sc, w: PW / sc, h: PH / sc };
    function setVb() { svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h); }
    function fit() { var r = svg.getBoundingClientRect(), a = r.width / Math.max(1, r.height); if (vb.w / vb.h < a) vb.w = vb.h * a; else vb.h = vb.w / a; setVb(); }
    var info = {}, sel = null;
    var pg0 = document.createElementNS(ns, 'rect'); pg0.setAttribute('x', vb.x); pg0.setAttribute('y', vb.y); pg0.setAttribute('width', vb.w); pg0.setAttribute('height', vb.h); pg0.setAttribute('class', 'edPg'); svg.appendChild(pg0);
    var gPc = document.createElementNS(ns, 'g'), gAll = document.createElementNS(ns, 'g'), gLg = document.createElementNS(ns, 'g'); svg.appendChild(gPc); svg.appendChild(gAll); svg.appendChild(gLg);
    function polyEl(P, fill, stroke, sw) { var e = document.createElementNS(ns, 'polygon'); e.setAttribute('points', P.map(function (q) { return q.join(','); }).join(' ')); e.setAttribute('fill', fill); e.setAttribute('stroke', stroke); e.setAttribute('stroke-width', sw); gPc.appendChild(e); }
    ((shn && shn.fills) || []).forEach(function (f) {
      var P = f.pts.map(XY);
      if (f.mode === 'full') polyEl(P, f.col, 'none', 0);
      else if (f.mode === 'ring') polyEl(P, 'none', f.col, 2 * RW / sc);
      else { try { var ip2 = HA.insetPoly(f.pts, RW / sc); polyEl(ip2.map(XY), f.col, 'none', 0); } catch (e) {} }
    });
    list.forEach(function (b) {
      var P = b.pts.map(XY), poly = document.createElementNS(ns, 'polygon'); poly.setAttribute('points', P.map(function (q) { return q.join(','); }).join(' ')); poly.setAttribute('class', 'edP'); poly.setAttribute('stroke-width', (o.bw * 0.2) / sc); gAll.appendChild(poly);
      var ip = HA.poi(b.pts, kx, ky), ls = []; if (o.kNo) ls.push(String(b.name)); if (o.luas) ls.push(fmtHa(HzBlok.areaHa(b.pts)) + ' ha');
      if (!ls.length) ls.push(String(b.name));
      var c0 = XY(ip), off = b.lblOff || [0, 0], cx = c0[0] + off[1] * kx, cy = c0[1] - off[0] * ky;
      var g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'edL'); g.setAttribute('data-id', String(b.id));
      var wmax = 0; ls.forEach(function (t) { wmax = Math.max(wmax, t.length); });
      var bw = wmax * fsM * 0.56 + fsM * 0.4, bh = ls.length * lhM + fsM * 0.3, hit = document.createElementNS(ns, 'rect'); hit.setAttribute('x', -bw / 2); hit.setAttribute('y', -bh / 2); hit.setAttribute('width', bw); hit.setAttribute('height', bh); hit.setAttribute('class', 'edH'); g.appendChild(hit);
      ls.forEach(function (t, i) { var tx = document.createElementNS(ns, 'text'); tx.setAttribute('x', 0); tx.setAttribute('y', -bh / 2 + fsM * 0.15 + (i + 0.8) * lhM); tx.setAttribute('font-size', fsM); tx.setAttribute('text-anchor', 'middle'); tx.textContent = t; g.appendChild(tx); });
      g.setAttribute('transform', 'translate(' + cx + ',' + cy + ')'); gAll.appendChild(g);
      info[b.id] = { b: b, P: P, g: g, c0: c0, cx: cx, cy: cy, bw: bw, bh: bh };
    });
    function lgInfo() {
      var leg = o.legOn && shn ? (shn.leg || []) : [], d = HA.lgBox(leg, o.lg.fs || 8);
      var lx = o.lg.x != null ? o.lg.x * PW : M + G, tp = o.lg.y != null ? o.lg.y * PH : M + 40;
      lx = Math.max(0, Math.min(PW - d.LW, lx)); tp = Math.max(0, Math.min(PH - d.LH, tp));
      return { leg: leg, d: d, lx: lx, tp: tp };
    }
    function toSvg(lx, tp) { return [(lx - M - offx) / sc, -((PH - tp - M - offy) / sc)]; }
    function toPage(sx, sy) { return [sx * sc + M + offx, PH - (-sy * sc + M + offy)]; }
    function drawLg() {
      gLg.innerHTML = ''; var q0 = lgInfo(); if (!q0.leg.length) return;
      var d = q0.d, g = document.createElementNS(ns, 'g'), q = toSvg(q0.lx, q0.tp), fz = 8 * d.kf;
      g.setAttribute('class', 'edLg' + (LGS ? ' sel' : '')); g.setAttribute('transform', 'translate(' + q[0] + ',' + q[1] + ') scale(' + (1 / sc) + ')');
      var r0 = document.createElementNS(ns, 'rect'); r0.setAttribute('width', d.LW); r0.setAttribute('height', d.LH); r0.setAttribute('class', 'edLb'); g.appendChild(r0);
      q0.leg.forEach(function (r, k) {
        var y0 = d.RH * k, rr = document.createElementNS(ns, 'rect');
        rr.setAttribute('x', 0); rr.setAttribute('y', y0); rr.setAttribute('width', d.LW); rr.setAttribute('height', d.RH); rr.setAttribute('class', 'edLr'); rr.setAttribute('data-key', r.key); g.appendChild(rr);
        var sw = document.createElementNS(ns, 'rect'); sw.setAttribute('x', 5 * d.kf); sw.setAttribute('y', y0 + 2 * d.kf); sw.setAttribute('width', 20 * d.kf); sw.setAttribute('height', d.RH - 4 * d.kf); sw.setAttribute('fill', r.col); sw.setAttribute('pointer-events', 'none'); g.appendChild(sw);
        var t = document.createElementNS(ns, 'text'); t.setAttribute('x', 31 * d.kf); t.setAttribute('y', y0 + d.RH - 4 * d.kf); t.setAttribute('font-size', fz); t.textContent = r.txt; g.appendChild(t);
      });
      gLg.appendChild(g);
    }
    drawLg();
    function pip(x, y, r) { var ins = false, i, j; for (i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) ins = !ins; } return ins; }
    function overl() { var a = Object.keys(info).map(function (k) { return info[k]; }), n = 0, i, j; for (i = 0; i < a.length; i++) for (j = i + 1; j < a.length; j++) { if (Math.abs(a[i].cx - a[j].cx) < (a[i].bw + a[j].bw) / 2 && Math.abs(a[i].cy - a[j].cy) < (a[i].bh + a[j].bh) / 2) n++; } return n; }
    function head() { var n = overl(); $('edI').textContent = (LGS ? 'Legenda · ' : sel ? String(info[sel].b.name) + ' · ' : 'Seret teks' + (lgInfo().leg.length ? ' atau legenda' : '') + ' · ') + (n ? n + ' pasang teks bertimpa' : 'tidak ada teks bertimpa'); $('edC').disabled = LGS ? o.lg.x == null : !(sel && info[sel].b.lblOff); $('edFm').disabled = $('edFp').disabled = !lgInfo().leg.length; }
    function sPt(ev) { var m2 = svg.getScreenCTM().inverse(), p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; var q = p.matrixTransform(m2); return [q.x, q.y]; }
    function mark(id) { Object.keys(info).forEach(function (k) { info[k].g.classList.toggle('sel', String(k) === String(id)); }); }
    var ptrs = {}, drag = null, pan = null, pinch = null, lgd = null;
    svg.style.touchAction = 'none';
    svg.onpointerdown = function (ev) {
      svg.setPointerCapture(ev.pointerId); ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var keys = Object.keys(ptrs);
      if (keys.length === 2) { drag = null; pan = null; lgd = null; var a = ptrs[keys[0]], b2 = ptrs[keys[1]]; pinch = { d: Math.hypot(a.x - b2.x, a.y - b2.y), w: vb.w, h: vb.h }; return; }
      var lg = ev.target.closest && ev.target.closest('.edLg');
      if (lg) { var o2 = lgInfo(), p0 = sPt(ev), q0 = toSvg(o2.lx, o2.tp); LGS = true; sel = null; mark(null); lgd = { dx: p0[0] - q0[0], dy: p0[1] - q0[1], moved: false, key: ev.target.getAttribute && ev.target.getAttribute('data-key'), sx: ev.clientX, sy: ev.clientY, w: o2.d.LW, h: o2.d.LH }; drawLg(); head(); return; }
      LGS = false; if (gLg.firstChild) gLg.firstChild.setAttribute('class', 'edLg');
      var g = ev.target.closest && ev.target.closest('.edL');
      if (g) { var id = g.getAttribute('data-id'), oo = info[id], p = sPt(ev); sel = id; mark(id); drag = { id: id, dx: p[0] - oo.cx, dy: p[1] - oo.cy, ox: oo.cx, oy: oo.cy, moved: false }; head(); }
      else { sel = null; mark(null); pan = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y }; head(); }
    };
    svg.onpointermove = function (ev) {
      if (ptrs[ev.pointerId]) { ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY }; }
      var keys = Object.keys(ptrs);
      if (pinch && keys.length === 2) { var a = ptrs[keys[0]], b2 = ptrs[keys[1]], d = Math.hypot(a.x - b2.x, a.y - b2.y), f = pinch.d / Math.max(1, d), cxp = (vb.x + vb.w / 2), cyp = (vb.y + vb.h / 2); vb.w = pinch.w * f; vb.h = pinch.h * f; vb.x = cxp - vb.w / 2; vb.y = cyp - vb.h / 2; setVb(); return; }
      if (lgd) {
        if (Math.hypot(ev.clientX - lgd.sx, ev.clientY - lgd.sy) > 6) lgd.moved = true;
        if (lgd.moved) { var p3 = sPt(ev), pg = toPage(p3[0] - lgd.dx, p3[1] - lgd.dy), lx2 = Math.max(0, Math.min(PW - lgd.w, pg[0])), tp2 = Math.max(0, Math.min(PH - lgd.h, pg[1])); o.lg.x = lx2 / PW; o.lg.y = tp2 / PH; var qq = toSvg(lx2, tp2); gLg.firstChild.setAttribute('transform', 'translate(' + qq[0] + ',' + qq[1] + ') scale(' + (1 / sc) + ')'); }
        return;
      }
      if (drag) {
        var oo = info[drag.id], p = sPt(ev), nx = p[0] - drag.dx, ny = p[1] - drag.dy;
        if (pip(nx, ny, oo.P)) { oo.cx = nx; oo.cy = ny; oo.g.setAttribute('transform', 'translate(' + nx + ',' + ny + ')'); drag.moved = true; }
      } else if (pan) {
        var r = svg.getBoundingClientRect(), s = vb.w / r.width; vb.x = pan.vx - (ev.clientX - pan.x) * s; vb.y = pan.vy - (ev.clientY - pan.y) * s; setVb();
      }
    };
    function up(ev) {
      delete ptrs[ev.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null;
      if (lgd) { var L2 = lgd; lgd = null; if (L2.moved) { o.persist(); drawLg(); } else if (L2.key) askTxt(L2.key); head(); return; }
      if (drag) {
        var oo = info[drag.id]; if (drag.moved) { var dLng = (oo.cx - oo.c0[0]) / kx, dLat = -(oo.cy - oo.c0[1]) / ky; if (Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) delete oo.b.lblOff; else oo.b.lblOff = [+dLat.toFixed(8), +dLng.toFixed(8)]; HA.saveSettings(); }
        drag = null; head();
      }
      pan = null;
    }
    svg.onpointerup = up; svg.onpointercancel = up;
    svg.addEventListener('wheel', function (ev) { ev.preventDefault(); var f = ev.deltaY > 0 ? 1.2 : 1 / 1.2, p = sPt(ev); vb.x = p[0] - (p[0] - vb.x) * f; vb.y = p[1] - (p[1] - vb.y) * f; vb.w *= f; vb.h *= f; setVb(); }, { passive: false });
    function zoom(f) { var cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2; vb.w *= f; vb.h *= f; vb.x = cx - vb.w / 2; vb.y = cy - vb.h / 2; setVb(); }
    $('edZp').onclick = function () { zoom(1 / 1.5); }; $('edZm').onclick = function () { zoom(1.5); };
    function askTxt(key) {
      var r = (lgInfo().leg).filter(function (x) { return x.key === key; })[0]; if (!r) return;
      var bx = $('edTx'), inp = $('edTi'); bx.hidden = false; inp.value = r.base; inp.focus();
      $('edTo').onclick = function () { var v = inp.value.trim(); bx.hidden = true; shn = o.edit(key, v); drawLg(); head(); };
    }
    function fsz(dv) { o.lg.fs = Math.max(5, Math.min(14, (o.lg.fs || 8) + dv)); o.persist(); drawLg(); }
    $('edFm').onclick = function () { fsz(-0.5); }; $('edFp').onclick = function () { fsz(0.5); };
    $('edC').onclick = function () { if (LGS) { o.lg.x = null; o.lg.y = null; o.persist(); drawLg(); head(); return; } if (!sel) return; var oo = info[sel]; delete oo.b.lblOff; oo.cx = oo.c0[0]; oo.cy = oo.c0[1]; oo.g.setAttribute('transform', 'translate(' + oo.cx + ',' + oo.cy + ')'); HA.saveSettings(); head(); };
    $('edX').onclick = closeEd;
    // umpan balik ketukan: tombol menyala sesaat + keterangan singkat di layar
    var bdT = null;
    function bdg(t) { var e = $('edB'); if (!e) { e = document.createElement('div'); e.id = 'edB'; e.className = 'edB'; el.appendChild(e); } e.textContent = t; e.style.opacity = '1'; clearTimeout(bdT); bdT = setTimeout(function () { e.style.opacity = '0'; }, 1600); }
    el.querySelector('.pmEh').addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('button'); if (!b || b.disabled) return; var id = b.id;
      b.classList.add('flash'); setTimeout(function () { b.classList.remove('flash'); }, 220);
      setTimeout(function () {
        if (id === 'edZp') bdg('Diperbesar'); else if (id === 'edZm') bdg('Diperkecil');
        else if (id === 'edFm' || id === 'edFp') bdg('Ukuran teks legenda ' + String(o.lg.fs || 8).replace('.', ',') + ' pt');
        else if (id === 'edC') bdg(LGS ? 'Legenda dikembalikan ke posisi awal' : 'Teks dikembalikan ke tengah blok');
      }, 0);
    });
    fit(); head();
    ED.test = { info: info, svg: svg, kx: kx, ky: ky };
    HA.pmEdTest = ED.test;
  }
  (function () {
    var tema = null, hs = document.querySelectorAll('#sp-tampil .h'); // sisipkan sebelum judul TEMA
    for (var i = 0; i < hs.length; i++) if (/^TEMA$/.test(hs[i].textContent.trim())) { tema = hs[i]; break; }
    if (!tema) return;
    var RR = [['v3d', '3D'], ['slopeLayer', 'Kemiringan (Lereng)'], ['hach', 'Arsiran'], ['slopeTap', 'Info lereng'], ['prof', 'Profil']];
    function shown(id) { var t = S.settings.tileShow || {}; if (t[id] != null) return !!t[id]; return !!(id === 'slopeLayer' ? S.settings.slopeLayer : id === 'hach' ? S.settings.hach : false); }
    var box = document.createElement('div'); box.id = 'stTiles';
    box.innerHTML = '<div class="h">LINTASAN</div><div class="muted" style="margin-bottom:4px">Tampilkan alat di menu Alat peta (yang jarang dipakai disembunyikan)</div>' + RR.map(function (r) { return '<label style="display:flex;justify-content:space-between;padding:6px 0"><span>' + r[1] + '</span><input type="checkbox" data-tl="' + r[0] + '"' + (shown(r[0]) ? ' checked' : '') + '></label>'; }).join('');
    tema.parentNode.insertBefore(box, tema);
    box.onchange = function (e) { var k = e.target.getAttribute('data-tl'); if (!k) return; (S.settings.tileShow || (S.settings.tileShow = {}))[k] = e.target.checked; HA.saveSettings(); if (HA.DM && HA.DM.regrid) HA.DM.regrid(); };
  })();
  HA.openLaporan = panel;
  var mb0 = HA.mapBack; HA.mapBack = function () { if (HA.pmEdClose()) return true; return mb0 ? mb0.apply(this, arguments) : false; };
})();
