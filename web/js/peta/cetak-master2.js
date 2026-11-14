/* HZ Trip v0.16.3 - Cetak Master baru: kategori, cakupan, tanggal Dari/Sampai, ceklis, ukuran, legenda manual, draft, atur posisi teks */
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
  function d8(iso) { return HA.tandaU.d8(iso); }
  var DEF = function () { return { sel: null, fmt: 'pdf', off: {}, scope: 'master', blk: '', from: addDays(S.today, -29), to: S.today, kTgl: true, kNo: true, kLuas: true, kLeg: true, luas: true, list: false, bw: 4, fs: 4, leg: [], title: '' }; };
  var PS = Object.assign(DEF(), S.settings.pmPS || {});
  function persist() { S.settings.pmPS = JSON.parse(JSON.stringify(PS)); HA.saveSettings(); }
  function clampNum(v, a, b, d) { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v)) return d; return Math.max(a, Math.min(b, v)); }
  function rangeOk() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(PS.from) || !/^\d{4}-\d{2}-\d{2}$/.test(PS.to)) return 'Isi tanggal Dari dan Sampai';
    if (PS.from > PS.to) return 'Tanggal Dari harus sebelum Sampai';
    if (dayDiff(PS.from, PS.to) + 1 > 366) return 'Rentang maksimal 1 tahun';
    return '';
  }
  function cats() { return HA.tandaData().cats; }
  function catOn(id) { return !PS.off[id]; }
  function scopeList(m) {
    var mem = HA.masterMembers(m), list = mem.in.concat(mem.man);
    if (PS.scope === 'blok') { var tk = String(PS.blk || '').split(',').map(nk).filter(Boolean); list = list.filter(function (b) { return tk.indexOf(nk(b.name)) >= 0; }); }
    return list;
  }
  function itemsOfBlock(b) {
    return HA.BT.itemsOf(b).filter(function (it) { var d = HA.tandaU.dateOf(it); return d >= PS.from && d <= PS.to && (it.cat ? catOn(it.cat) : true); });
  }
  function fmtHa(v) { return v.toFixed(2).replace('.', ','); }
  function linesFor(b) {
    var its = itemsOfBlock(b), out = [];
    if (!its.length) return out;
    if (PS.kTgl) { var last = ''; its.forEach(function (it) { var d = HA.tandaU.dateOf(it); if (d > last) last = d; }); out.push(d8(last)); }
    if (PS.kLuas) {
      var by = {}, ord = [];
      its.forEach(function (it) { var k = it.cat || '_'; if (!by[k]) { by[k] = { n: HA.tandaCatInfo(it).name, ha: 0, m: 0, p: 0 }; ord.push(k); } var st = HA.tandaStat(it); if (it.t === 'pg') by[k].ha += st.ha || 0; else if (it.t === 'ln') by[k].m += st.m || 0; else by[k].p++; });
      ord.forEach(function (k) { var o = by[k]; out.push(String(o.n).slice(0, 12) + ' ' + (o.ha ? fmtHa(o.ha) : o.m ? Math.round(o.m) + 'm' : o.p + 'x')); });
    }
    return out;
  }
  function drawItems(list) {
    var seen = {}, out = [];
    list.forEach(function (b) { itemsOfBlock(b).forEach(function (it) { if (seen[it.id]) return; seen[it.id] = 1; var c = it.cat ? HA.tandaCatOf(it.cat) : null; out.push({ t: it.t, pts: it.pts, col: HA.tandaColOf(it), gar: !!(c && c.style === 'garis'), w: c && c.w ? c.w : 0 }); }); });
    return out;
  }
  function legFromCats() { return cats().filter(function (c) { return catOn(c.id); }).map(function (c) { return { col: c.col, style: c.style === 'garis' ? 'garis' : 'isi', w: c.w || 3, txt: c.name }; }); }
  function buildOpts(m) {
    var list = scopeList(m);
    return { map: true, list: PS.list, luas: PS.luas, title: PS.title, name: PS.kNo, bw: PS.bw, fsPt: PS.fs, items: drawItems(list), lines: linesFor, legend: PS.kLeg, leg: PS.leg, dates: d8(PS.from) + ' - ' + d8(PS.to), only: list };
  }
  // ---------- panel ----------
  function panel() {
    var ms = masters(); ms.forEach(function (m, i) { if (m.id == null) m.id = Date.now() + i; });
    if (!mById(PS.sel)) PS.sel = ms.length ? ms[0].id : null;
    if (PS.kLeg && !PS.leg.length) PS.leg = legFromCats();
    var m = mById(PS.sel), list = m ? scopeList(m) : [];
    var cl = cats();
    var h = '<div class="grab"></div><div class="st">CETAK</div>' +
      '<div class="seg" id="pmMode" style="margin:6px 0 10px"><button data-m="trip">Trip</button><button data-m="master" class="on">Master</button></div>';
    if (!ms.length) { HA.openSheet(h + '<div class="card muted" style="margin-top:6px">Belum ada master. Buat di Data peta > Master: gambar poligon kawasan, lalu kembali ke sini untuk mencetak.</div><button class="btn" id="pmX" style="width:100%;margin-top:8px">Tutup</button>'); $('pmX').onclick = HA.closeSheet; wireMode(); return; }
    h += '<div class="plist"><div class="h">MASTER</div>' + ms.map(function (x) { return '<label><input type="radio" name="pmSel" value="' + esc(String(x.id)) + '"' + (String(x.id) === String(PS.sel) ? ' checked' : '') + '> ' + esc(x.name) + '</label>'; }).join('') +
      '<div class="h">FORMAT (pilih satu)</div><div class="seg" id="pmFmt"><button data-f="pdf"' + (PS.fmt === 'pdf' ? ' class="on"' : '') + '>PDF</button><button data-f="kml"' + (PS.fmt === 'kml' ? ' class="on"' : '') + '>KML</button></div>';
    if (PS.fmt === 'kml') {
      h += '<div class="muted" style="margin-top:6px">KML berisi bentuk dan posisi blok serta batas master, tanpa luasan.</div>';
    } else {
      h += '<div class="h">1. KATEGORI</div><div class="pmCats">' + (cl.length ? cl.map(function (c) { return '<label class="pmC"><input type="checkbox" data-c="' + c.id + '"' + (catOn(c.id) ? ' checked' : '') + '><i style="background:' + c.col + '"></i>' + esc(c.name) + '</label>'; }).join('') : '<div class="muted">Belum ada kategori.</div>') + '</div>' +
        '<div class="h">2. CAKUPAN</div><div class="seg" id="pmSc"><button data-s="master"' + (PS.scope === 'master' ? ' class="on"' : '') + '>Master</button><button data-s="blok"' + (PS.scope === 'blok' ? ' class="on"' : '') + '>Blok tertentu</button></div>' +
        (PS.scope === 'blok' ? '<input type="text" id="pmBlk" placeholder="No blok, pisahkan koma (mis. 04 TS 16, 04 TS 17)" value="' + esc(PS.blk) + '" style="width:100%;margin-top:6px">' : '') +
        '<div class="muted" id="pmN" style="margin-top:4px">' + list.length + ' blok akan dicetak</div>' +
        '<div class="h">3. TANGGAL (1 hari sampai 1 tahun)</div><div class="row" style="gap:8px"><label class="calL">Dari<input type="date" id="pmFr" max="' + S.today + '" value="' + PS.from + '"></label><label class="calL">Sampai<input type="date" id="pmTo" max="' + S.today + '" value="' + PS.to + '"></label></div>' +
        '<div class="h">4. TAMPILKAN</div>' +
        '<label><input type="checkbox" id="pmKt"' + (PS.kTgl ? ' checked' : '') + '> Tanggal (terakhir per blok)</label><label><input type="checkbox" id="pmKn"' + (PS.kNo ? ' checked' : '') + '> No blok</label><label><input type="checkbox" id="pmLuas"' + (PS.luas ? ' checked' : '') + '> Luas blok (ha)</label><label><input type="checkbox" id="pmKl"' + (PS.kLuas ? ' checked' : '') + '> Luas kategori per blok</label><label><input type="checkbox" id="pmKg"' + (PS.kLeg ? ' checked' : '') + '> Legenda</label><label><input type="checkbox" id="pmList"' + (PS.list ? ' checked' : '') + '> Daftar blok lengkap (lembar tabel)</label>' +
        '<div class="h">5. UKURAN</div><div class="row" style="gap:8px"><label class="calL">Garis blok (px)<input type="number" id="pmBw" min="3" max="9" step="1" value="' + PS.bw + '"></label><label class="calL">Teks (pt)<input type="number" id="pmFs" min="3" max="12" step="0.5" value="' + PS.fs + '"></label></div>' +
        '<div class="muted" style="margin-top:4px">Garis blok 3–9: 3 tipis (blok rapat), 9 tebal (terbaca jauh). Teks 3–12 pt: 4 untuk blok rapat, 8–12 untuk blok besar. Satu ukuran untuk no blok, luas, dan tanggal.</div>' +
        (PS.kLeg ? '<div class="h">6. LEGENDA</div><div id="pmLg">' + PS.leg.map(function (r, i) {
          return '<div class="pmL" data-i="' + i + '"><input type="color" data-k="col" value="' + esc(r.col) + '"><select data-k="style"><option value="isi"' + (r.style === 'isi' ? ' selected' : '') + '>Isi</option><option value="garis"' + (r.style === 'garis' ? ' selected' : '') + '>Garis</option></select><input type="number" data-k="w" min="1" max="8" value="' + (r.w || 3) + '" title="Tebal"><input type="text" data-k="txt" maxlength="40" value="' + esc(r.txt) + '" placeholder="Keterangan"><button type="button" data-x="' + i + '" aria-label="Hapus baris">✕</button></div>';
        }).join('') + '</div><div class="row" style="gap:8px;margin-top:6px"><button class="btn" id="pmLgA" style="flex:1">+ Baris</button><button class="btn" id="pmLgC" style="flex:1">Isi dari kategori</button></div>' : '') +
        '<div class="h">JUDUL</div><input type="text" id="pmTtl" maxlength="60" placeholder="Kosong = nama master" value="' + esc(PS.title) + '" style="width:100%">' +
        '<div class="h">DRAFT CETAK</div><div class="row" style="gap:6px"><select id="pmDr" style="flex:1">' + (S.settings.pmDrafts || []).map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + '</option>'; }).join('') + '</select><button class="btn" id="pmDrL">Muat</button><button class="btn" id="pmDrS">Simpan</button><button class="btn" id="pmDrD">Hapus</button></div>' +
        '<div class="muted" style="margin-top:4px">Draft hanya menyimpan pengaturan cetak. Data selalu yang terbaru.</div>' +
        '<button class="btn" id="pmPos" style="width:100%;margin-top:10px">Atur posisi teks blok</button>';
    }
    h += '<button class="btn" id="pmAtur" style="width:100%;margin-top:6px">Atur blok perbatasan</button>' +
      (PS.fmt === 'pdf' ? '<button class="btn" id="pmPrev" style="width:100%;margin-top:8px">Preview</button>' : '') +
      '<button class="btn pri" id="pmGo" style="width:100%;margin-top:8px;height:52px">Cetak ' + (PS.fmt === 'pdf' ? 'PDF' : 'KML') + '</button></div><button class="btn" id="pmX" style="width:100%;margin-top:8px">Tutup</button>';
    HA.openSheet(h);
    wire(m);
  }
  function wireMode() { var e = $('pmMode'); if (e) e.onclick = function (ev) { var b = ev.target.closest && ev.target.closest('button[data-m]'); if (b && b.getAttribute('data-m') === 'trip') { HA.closeSheet(); HA.openPrint({ day: S.hDay }); } }; }
  function wire(m) {
    var sh = $('sheet');
    $('pmX').onclick = HA.closeSheet; wireMode();
    sh.querySelectorAll('input[name=pmSel]').forEach(function (r) { r.onchange = function () { PS.sel = r.value; persist(); panel(); }; });
    $('pmFmt').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-f]'); if (b) { PS.fmt = b.getAttribute('data-f'); persist(); panel(); } };
    $('pmAtur').onclick = function () { if (HA.masterAtur) HA.masterAtur(m, panel); };
    if (PS.fmt === 'kml') { $('pmGo').onclick = function () { HA.masterCetak(m, 'kml', {}); }; return; }
    function cnt() { if ($('pmN')) $('pmN').textContent = scopeList(m).length + ' blok akan dicetak'; }
    sh.querySelectorAll('.pmC input').forEach(function (e) { e.onchange = function () { PS.off[e.getAttribute('data-c')] = !e.checked; persist(); }; });
    $('pmSc').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-s]'); if (b) { PS.scope = b.getAttribute('data-s'); persist(); panel(); } };
    if ($('pmBlk')) $('pmBlk').oninput = function () { PS.blk = this.value; cnt(); };
    if ($('pmBlk')) $('pmBlk').onchange = persist;
    $('pmFr').onchange = function () { if (this.value) { PS.from = this.value; persist(); } };
    $('pmTo').onchange = function () { if (this.value) { PS.to = this.value; persist(); } };
    [['pmKt', 'kTgl'], ['pmKn', 'kNo'], ['pmLuas', 'luas'], ['pmKl', 'kLuas'], ['pmList', 'list']].forEach(function (p) { $(p[0]).onchange = function () { PS[p[1]] = this.checked; persist(); }; });
    $('pmKg').onchange = function () { PS.kLeg = this.checked; if (PS.kLeg && !PS.leg.length) PS.leg = legFromCats(); persist(); panel(); };
    $('pmBw').onchange = function () { PS.bw = Math.round(clampNum(this.value, 3, 9, 4)); this.value = PS.bw; persist(); };
    $('pmFs').onchange = function () { PS.fs = clampNum(this.value, 3, 12, 4); this.value = PS.fs; persist(); };
    $('pmTtl').oninput = function () { PS.title = this.value; };
    $('pmTtl').onchange = persist;
    if ($('pmLg')) {
      $('pmLg').onchange = function (e) { var row = e.target.closest('.pmL'); if (!row) return; var r = PS.leg[+row.getAttribute('data-i')], k = e.target.getAttribute('data-k'); if (!r || !k) return; r[k] = k === 'w' ? Math.round(clampNum(e.target.value, 1, 8, 3)) : e.target.value; persist(); };
      $('pmLg').onclick = function (e) { var x = e.target.closest('[data-x]'); if (!x) return; PS.leg.splice(+x.getAttribute('data-x'), 1); persist(); panel(); };
      $('pmLgA').onclick = function () { PS.leg.push({ col: '#ff0000', style: 'isi', w: 3, txt: '' }); persist(); panel(); };
      $('pmLgC').onclick = function () { PS.leg = legFromCats(); persist(); panel(); };
    }
    $('pmDrS').onclick = saveDraft; $('pmDrL').onclick = loadDraft; $('pmDrD').onclick = delDraft;
    $('pmPos').onclick = function () { if (!scopeList(m).length) { toast('Belum ada blok yang dicetak'); return; } HA.closeSheet(); posEditor(m); };
    function go(prev) {
      var er = rangeOk(); if (er) { toast(er); return; }
      if (!scopeList(m).length) { toast(PS.scope === 'blok' ? 'Tidak ada blok yang cocok dengan No blok itu' : 'Belum ada blok Terkonfirmasi di master ini'); return; }
      persist(); var o = buildOpts(m);
      HA.masterCetak(m, 'pdf', o, prev);
    }
    $('pmPrev').onclick = function () { go(true); };
    $('pmGo').onclick = function () { go(false); };
  }
  // ---------- draft ----------
  function saveDraft() {
    HA.openSheet('<div class="grab"></div><div class="st">SIMPAN DRAFT</div><input type="text" id="drN" maxlength="40" placeholder="Nama draft (mis. Pembakaran Okt-Nov)" style="width:100%;margin-top:8px"><div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="drX" style="flex:1">Batal</button><button class="btn pri" id="drY" style="flex:1">Simpan</button></div>');
    $('drX').onclick = panel;
    $('drY').onclick = function () {
      var n = $('drN').value.trim(); if (!n) { toast('Isi nama draft'); return; }
      var a = S.settings.pmDrafts || (S.settings.pmDrafts = []), ex = a.filter(function (d) { return d.name === n; })[0], snap = JSON.parse(JSON.stringify(PS));
      if (ex) ex.ps = snap; else a.push({ id: String(Date.now()), name: n, ps: snap });
      HA.saveSettings(); toast('Draft tersimpan'); panel();
    };
  }
  function loadDraft() {
    var id = $('pmDr') && $('pmDr').value, d = (S.settings.pmDrafts || []).filter(function (x) { return x.id === id; })[0];
    if (!d) { toast('Belum ada draft'); return; }
    PS = Object.assign(DEF(), d.ps); persist(); toast('Draft dimuat: ' + d.name); panel();
  }
  function delDraft() {
    var id = $('pmDr') && $('pmDr').value, d = (S.settings.pmDrafts || []).filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    HA.askConfirm('Hapus draft?', d.name + '. Hanya pengaturan cetak yang dihapus, data tidak.', 'Hapus', function () { S.settings.pmDrafts = S.settings.pmDrafts.filter(function (x) { return x.id !== id; }); HA.saveSettings(); panel(); });
    var cn = $('cfNo'); if (cn) cn.onclick = panel;
  }
  // ---------- atur posisi teks ----------
  var ED = null;
  HA.pmEdClose = function () { if (!ED) return false; closeEd(); return true; };
  function closeEd() { if (ED) { ED.el.remove(); ED = null; } panel(); }
  function posEditor(m) {
    var list = scopeList(m), all = m.pts.slice();
    list.forEach(function (b) { b.pts.forEach(function (p) { all.push(p); }); });
    var la0 = 90, lo0 = 180, la1 = -90, lo1 = -180; all.forEach(function (p) { la0 = Math.min(la0, p[0]); la1 = Math.max(la1, p[0]); lo0 = Math.min(lo0, p[1]); lo1 = Math.max(lo1, p[1]); });
    var latc = (la0 + la1) / 2, kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 111320;
    var mw = Math.max(50, (lo1 - lo0) * kx), mh = Math.max(50, (la1 - la0) * ky), land = mw >= mh, PW = land ? 1190.55 : 841.89, PH = land ? 841.89 : 1190.55, M = 24;
    var sc = Math.min((PW - 2 * M) / (mw * 1.04), (PH - 2 * M) / (mh * 1.04)), fsM = PS.fs / sc, lhM = fsM * 1.15;
    function XY(p) { return [(p[1] - lo0) * kx, -(p[0] - la0) * ky]; }
    var el = document.createElement('div'); el.id = 'pmEd'; el.className = 'pmEd';
    el.innerHTML = '<div class="pmEh"><button class="btn" id="edX">Selesai</button><div id="edI" class="muted"></div><button class="btn" id="edZm">−</button><button class="btn" id="edZp">+</button><button class="btn" id="edC" disabled>Tengah</button></div><svg id="edS" xmlns="http://www.w3.org/2000/svg"></svg>';
    document.body.appendChild(el); ED = { el: el };
    var svg = $('edS'), ns = 'http://www.w3.org/2000/svg', W0 = mw * 1.04, H0 = mh * 1.04, vb = { x: -mw * 0.02, y: -mh - mh * 0.02, w: W0, h: H0 };
    function setVb() { svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h); }
    var rect = el.getBoundingClientRect(); // sesuaikan rasio
    function fit() { var r = svg.getBoundingClientRect(), a = r.width / Math.max(1, r.height); if (vb.w / vb.h < a) vb.w = vb.h * a; else vb.h = vb.w / a; setVb(); }
    var info = {}, sel = null;
    var gAll = document.createElementNS(ns, 'g'); svg.appendChild(gAll);
    list.forEach(function (b) {
      var P = b.pts.map(XY), poly = document.createElementNS(ns, 'polygon'); poly.setAttribute('points', P.map(function (q) { return q.join(','); }).join(' ')); poly.setAttribute('class', 'edP'); poly.setAttribute('stroke-width', (PS.bw * 0.2) / sc); gAll.appendChild(poly);
      var ip = HA.poi(b.pts, kx, ky), ls = []; if (PS.kNo) ls.push(String(b.name)); if (PS.luas) ls.push(fmtHa(HzBlok.areaHa(b.pts)) + ' ha'); linesFor(b).forEach(function (t) { ls.push(t); });
      if (!ls.length) ls.push(String(b.name));
      var c0 = XY(ip), off = b.lblOff || [0, 0], cx = c0[0] + off[1] * kx, cy = c0[1] - off[0] * ky;
      var g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'edL'); g.setAttribute('data-id', String(b.id));
      var wmax = 0; ls.forEach(function (t) { wmax = Math.max(wmax, t.length); });
      var bw = wmax * fsM * 0.56 + fsM * 0.4, bh = ls.length * lhM + fsM * 0.3, hit = document.createElementNS(ns, 'rect'); hit.setAttribute('x', -bw / 2); hit.setAttribute('y', -bh / 2); hit.setAttribute('width', bw); hit.setAttribute('height', bh); hit.setAttribute('class', 'edH'); g.appendChild(hit);
      ls.forEach(function (t, i) { var tx = document.createElementNS(ns, 'text'); tx.setAttribute('x', 0); tx.setAttribute('y', -bh / 2 + fsM * 0.15 + (i + 0.8) * lhM); tx.setAttribute('font-size', fsM); tx.setAttribute('text-anchor', 'middle'); tx.textContent = t; g.appendChild(tx); });
      g.setAttribute('transform', 'translate(' + cx + ',' + cy + ')'); gAll.appendChild(g);
      info[b.id] = { b: b, P: P, g: g, c0: c0, cx: cx, cy: cy, bw: bw, bh: bh };
    });
    function pip(x, y, r) { var ins = false, i, j; for (i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) ins = !ins; } return ins; }
    function overl() { var a = Object.keys(info).map(function (k) { return info[k]; }), n = 0, i, j; for (i = 0; i < a.length; i++) for (j = i + 1; j < a.length; j++) { if (Math.abs(a[i].cx - a[j].cx) < (a[i].bw + a[j].bw) / 2 && Math.abs(a[i].cy - a[j].cy) < (a[i].bh + a[j].bh) / 2) n++; } return n; }
    function head() { var n = overl(); $('edI').textContent = (sel ? String(info[sel].b.name) + ' · ' : 'Seret teks untuk menggeser · ') + (n ? n + ' pasang teks bertimpa' : 'tidak ada teks bertimpa'); $('edC').disabled = !(sel && info[sel].b.lblOff); }
    function sPt(ev) { var m2 = svg.getScreenCTM().inverse(), p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; var q = p.matrixTransform(m2); return [q.x, q.y]; }
    function mark(id) { Object.keys(info).forEach(function (k) { info[k].g.classList.toggle('sel', String(k) === String(id)); }); }
    var ptrs = {}, drag = null, pan = null, pinch = null;
    svg.style.touchAction = 'none';
    svg.onpointerdown = function (ev) {
      svg.setPointerCapture(ev.pointerId); ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var keys = Object.keys(ptrs);
      if (keys.length === 2) { drag = null; pan = null; var a = ptrs[keys[0]], b2 = ptrs[keys[1]]; pinch = { d: Math.hypot(a.x - b2.x, a.y - b2.y), w: vb.w, h: vb.h }; return; }
      var g = ev.target.closest && ev.target.closest('.edL');
      if (g) { var id = g.getAttribute('data-id'), o = info[id], p = sPt(ev); sel = id; mark(id); drag = { id: id, dx: p[0] - o.cx, dy: p[1] - o.cy, ox: o.cx, oy: o.cy, moved: false }; head(); }
      else pan = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y };
    };
    svg.onpointermove = function (ev) {
      if (ptrs[ev.pointerId]) { ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY }; }
      var keys = Object.keys(ptrs);
      if (pinch && keys.length === 2) { var a = ptrs[keys[0]], b2 = ptrs[keys[1]], d = Math.hypot(a.x - b2.x, a.y - b2.y), f = pinch.d / Math.max(1, d), cxp = (vb.x + vb.w / 2), cyp = (vb.y + vb.h / 2); vb.w = pinch.w * f; vb.h = pinch.h * f; vb.x = cxp - vb.w / 2; vb.y = cyp - vb.h / 2; setVb(); return; }
      if (drag) {
        var o = info[drag.id], p = sPt(ev), nx = p[0] - drag.dx, ny = p[1] - drag.dy;
        if (pip(nx, ny, o.P)) { o.cx = nx; o.cy = ny; o.g.setAttribute('transform', 'translate(' + nx + ',' + ny + ')'); drag.moved = true; }
      } else if (pan) {
        var r = svg.getBoundingClientRect(), s = vb.w / r.width; vb.x = pan.vx - (ev.clientX - pan.x) * s; vb.y = pan.vy - (ev.clientY - pan.y) * s; setVb();
      }
    };
    function up(ev) {
      delete ptrs[ev.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null;
      if (drag) {
        var o = info[drag.id]; if (drag.moved) { var dLng = (o.cx - o.c0[0]) / kx, dLat = -(o.cy - o.c0[1]) / ky; if (Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) delete o.b.lblOff; else o.b.lblOff = [+dLat.toFixed(8), +dLng.toFixed(8)]; HA.saveSettings(); }
        drag = null; head();
      }
      pan = null;
    }
    svg.onpointerup = up; svg.onpointercancel = up;
    svg.addEventListener('wheel', function (ev) { ev.preventDefault(); var f = ev.deltaY > 0 ? 1.2 : 1 / 1.2, p = sPt(ev); vb.x = p[0] - (p[0] - vb.x) * f; vb.y = p[1] - (p[1] - vb.y) * f; vb.w *= f; vb.h *= f; setVb(); }, { passive: false });
    function zoom(f) { var cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2; vb.w *= f; vb.h *= f; vb.x = cx - vb.w / 2; vb.y = cy - vb.h / 2; setVb(); }
    $('edZp').onclick = function () { zoom(1 / 1.5); }; $('edZm').onclick = function () { zoom(1.5); };
    $('edC').onclick = function () { if (!sel) return; var o = info[sel]; delete o.b.lblOff; o.cx = o.c0[0]; o.cy = o.c0[1]; o.g.setAttribute('transform', 'translate(' + o.cx + ',' + o.cy + ')'); HA.saveSettings(); head(); };
    $('edX').onclick = closeEd;
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
  HA.openPrintMaster = panel;
  var mb0 = HA.mapBack; HA.mapBack = function () { if (HA.pmEdClose()) return true; return mb0 ? mb0.apply(this, arguments) : false; };
})();
