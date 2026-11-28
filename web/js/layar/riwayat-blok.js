/* HZ Trip v0.16.3 - Riwayat blok: daftar tanda di satu blok, detail tanda (lihat, ubah kategori, ubah tanggal, hapus), Tandai blok penuh, Bagikan */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.BT) return;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  var BR = HA.BRiw = {}, filt = {}, hl = null, SISI = { U: 'Utara', S: 'Selatan', T: 'Timur', B: 'Barat' }, lastSisi = 'U';
  function subName(it) {
    var c = it.cat ? HA.tandaCatOf(it.cat) : null; if (!c || !it.sub) return '';
    var s = (c.subs || []).filter(function (x) { return x.id === it.sub; })[0]; return s ? (s.name || '') : '';
  }
  // ---- v0.27.28: progres blok kumulatif per kategori (tanda penuh = 100%, bagian menyambung sampai 100%)
  function ordAsc(x, y) { var a = BR.ordKey(x), c = BR.ordKey(y); return a < c ? -1 : a > c ? 1 : 0; }
  var GAP = 14; // hari: jeda lebih dari ini = putaran baru (sementara)
  function dayDiff(a, c) { return Math.round((Date.parse(c) - Date.parse(a)) / 864e5); }
  function todayS() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function serInfo(b, cat, sub) {
    var U = HA.tandaU, A = HzBlok.areaHa(b.pts), its = HA.BT.itemsOf(b).filter(function (z) { return z.t === 'pg' && z.cat === cat && (z.sub || null) === (sub || null); }), ser = [], tot = 0, map = {}, rd = 1, last = null;
    its.sort(ordAsc);
    its.forEach(function (z, i) {
      var d = U.dateOf(z), rn = z.part && z.part.rn;
      if (last && (rn === 'new' || (rn !== 'cont' && dayDiff(last, d) > GAP))) { rd++; ser = []; tot = 0; }
      last = d;
      if (z.full || !z.part) { map[z.id] = { cum: 100, prev: 0, rings: [], i: i, rd: rd }; ser = []; tot = 0; return; }
      var rings = ser.map(function (q) { return q.pts; }), prev = tot;
      ser.push(z); tot += (z.part.pct != null ? z.part.pct : HzBlok.areaHa(z.pts) / A * 100);
      var cum = Math.min(100, tot);
      if (tot >= 98) { cum = 100; ser = []; tot = 0; }
      map[z.id] = { cum: cum, prev: prev, rings: rings, i: i, rd: rd };
    });
    return { its: its, map: map, A: A, endCum: tot, endRings: ser.map(function (q) { return q.pts; }), rounds: rd, last: last, stale: !!(last && tot > 0 && dayDiff(last, todayS()) > GAP) };
  }
  function cumPct(it) {
    if (it.t !== 'pg' || !it.bid || !(it.full || it.part)) return null;
    var b = HA.blockById ? HA.blockById(it.bid) : null; if (!b || !b.pts) return it.part ? it.part.pct : (it.full ? 100 : null);
    var m = serInfo(b, it.cat, it.sub).map[it.id]; return m ? Math.round(m.cum * 10) / 10 : null;
  }
  function fmt1(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function statTxt(it) {
    var U = HA.tandaU, st = HA.tandaStat(it), a = [];
    if (it.t === 'pt') return 'titik';
    if (it.t === 'ln') return U.ribu(st.m) + ' m garis';
    a.push(U.ha(st.ha) + ' ha'); var cp = cumPct(it); if (cp != null) a.push('blok ' + String(cp).replace('.', ',') + '%'); if (st.lm) a.push(U.ribu(st.lm) + ' m lajur');
    return a.join(' · ');
  }
  function flash(it) {
    var m = HA.map; if (!m) return;
    if (hl) { try { m.removeLayer(hl); } catch (e) {} hl = null; }
    var o = { color: '#00D4FF', weight: 5, fillOpacity: 0, interactive: false };
    hl = it.t === 'pt' ? L.circleMarker(it.pts[0], { radius: 16, color: '#00D4FF', weight: 4, fillOpacity: 0, interactive: false }) : it.t === 'ln' ? L.polyline(it.pts, o) : L.polygon(it.pts, o);
    hl.addTo(m); var h = hl; setTimeout(function () { try { m.removeLayer(h); } catch (e) {} if (hl === h) hl = null; }, 4000);
  }
  function lihat(it) {
    HA.onSheetClose = null; HA.closeSheet();
    var d = HA.tandaU.dateOf(it);
    if (HA.KM && HA.KM.show) HA.KM.show(d);
    var m = HA.map; if (!m) return;
    setTimeout(function () {
      try { if (it.t === 'pt') m.setView(it.pts[0], Math.max(m.getZoom(), 18)); else m.fitBounds(L.latLngBounds(it.pts), { padding: [50, 50], maxZoom: 19 }); } catch (e) {}
      flash(it);
    }, 200);
  }
  function persist() { HA.tandaSave(); if (HA.KM && HA.KM.sync) HA.KM.sync(); }
  // ---- waktu kegiatan, nomor kegiatan, dibuat/diubah
  var WKI = { Pagi: 0, Siang: 1, Sore: 2, Malam: 3 };
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTs(ts) { if (!ts) return '-'; var d = new Date(ts); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2) + ' ' + p2(d.getHours()) + '.' + p2(d.getMinutes()); }
  function ordKey(it) { return HA.tandaU.dateOf(it) + (it.wk && WKI[it.wk] != null ? WKI[it.wk] : 9) + String(1e13 + (it.ts || 0)); }
  BR.seq = function (it) {
    if (it.bid == null || !it.cat) return null;
    var same = HA.tandaData().items.filter(function (z) { return String(z.bid) === String(it.bid) && z.cat === it.cat; });
    if (same.length < 2) return null;
    same.sort(function (a, c) { var x = ordKey(a), y = ordKey(c); return x < y ? -1 : x > y ? 1 : 0; });
    for (var i = 0; i < same.length; i++) if (same[i].id === it.id) return { n: i + 1, of: same.length };
    return null;
  };
  BR.confirmChange = function (a, b, c) { confirmChange(a, b, c); };
  BR.fmtTs = fmtTs; BR.ordKey = ordKey; BR.detail = function (it, back) { detail(it, back); };
  function wkTxt(it) { return it.wk ? ' \u00B7 ' + it.wk : ''; }
  function seqTxt(it) { var q = BR.seq(it); return q ? ' ke-' + q.n : ''; }
  function incTxt(it) { return it.inc ? ' <em class="rbInc">belum lengkap</em>' : ''; }
  function rdOf(it) { if (it.t !== 'pg' || it.bid == null) return null; var b = HA.blockById ? HA.blockById(it.bid) : null; if (!b || !b.pts) return null; var s = serInfo(b, it.cat, it.sub), m = s.map[it.id]; return m && s.rounds > 1 ? m.rd : null; }
  function rdTxt(it) { var r = rdOf(it); return r ? ' \u00B7 putaran ' + r : ''; }
  // ---- detail satu tanda
  function detail(it, back) {
    var U = HA.tandaU, inf = HA.tandaCatInfo(it), sn = subName(it);
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">TANDA · ' + esc(inf.name) + (sn ? ' / ' + esc(sn) : '') + '</div><button class="ib" id="rdOk" aria-label="Tutup"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="muted" style="margin:4px 0 4px">' + U.d8(U.dateOf(it)) + wkTxt(it) + ' · ' + statTxt(it) + seqTxt(it).replace(' ke-', ' · kegiatan ke-') + '</div>' + (it.note ? '<div style="margin:2px 0 4px">' + esc(it.note) + '</div>' : '') + '<div class="muted" style="font-size:11px;margin-bottom:10px">dibuat ' + fmtTs(it.ts) + (it.mod && it.mod !== it.ts ? ' \u00B7 diubah ' + fmtTs(it.mod) : '') + '</div>' +
      (it.inc ? '<div class="rdG" style="margin-bottom:8px"><button class="btn pri" id="rdLg">Lengkapi</button><button class="btn" id="rdSb">Sudah benar</button></div>' : '') +
      '<div class="rdG"><button class="btn" id="rdLh">Lihat di peta</button><button class="btn" id="rdKt">Ubah kategori</button>' + (it.t === 'pg' ? '<button class="btn" id="rdLu">Ubah luasan</button><button class="btn" id="rdGy">Ubah gaya</button>' : '') + '<button class="btn" id="rdTg">Ubah tanggal dan waktu</button><button class="btn" id="rdNt">Catatan</button><button class="btn danger" id="rdDl">Hapus tanda</button></div>');
    HA.onSheetClose = back;
    $('rdOk').onclick = function () { HA.closeSheet(); };
    $('rdLh').onclick = function () { lihat(it); };
    if ($('rdLg')) $('rdLg').onclick = function () { pickCat(it, function () { detail(it, back); }); };
    if ($('rdSb')) $('rdSb').onclick = function () { it.inc = false; persist(); HA.toast('Tanda ditandai sudah benar'); detail(it, back); };
    $('rdKt').onclick = function () { pickCat(it, function () { detail(it, back); }); };
    if ($('rdGy')) $('rdGy').onclick = function () { HA.BRiw.gaya(it, function () { detail(it, back); }); };
    if ($('rdLu')) $('rdLu').onclick = function () { luasan(it, function () { detail(it, back); }); };
    $('rdTg').onclick = function () { pickDT(it, function () { detail(it, back); }); };
    $('rdNt').onclick = function () { pickNote(it, function () { detail(it, back); }); };
    $('rdDl').onclick = function () {
      HA.onSheetClose = null;
      HA.askConfirm('Hapus tanda ini?', inf.name + ' · ' + U.d8(U.dateOf(it)) + '. Hanya tanda ini yang dihapus.', 'Hapus', function () {
        var d = HA.tandaData(); d.items = d.items.filter(function (z) { return z.id !== it.id; }); persist(); back();
      });
      var cn = $('cfNo'); if (cn) cn.onclick = function () { detail(it, back); };
    };
  }
  function pickCat(it, back) {
    var d = HA.tandaData();
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">UBAH KATEGORI</div><button class="btn" id="pkX">Batal</button></div><div class="rbL">' + d.cats.map(function (c) {
      return '<div class="rcR"><button type="button" class="rcK" data-c="' + c.id + '"><i style="background:' + c.col + '"></i><b>' + esc(c.name) + '</b>' + (it.cat === c.id && !it.sub ? ' ✓' : '') + '</button>' +
        (c.subs && c.subs.length ? '<div class="rcS">' + c.subs.map(function (s) { return '<button type="button" class="rcSb" data-c="' + c.id + '" data-s="' + s.id + '" style="background:' + (s.col || c.col) + '">' + esc(s.name || 'Sub') + (it.cat === c.id && it.sub === s.id ? ' ✓' : '') + '</button>'; }).join('') + '</div>' : '') + '</div>';
    }).join('') + '</div>');
    HA.onSheetClose = back;
    $('pkX').onclick = function () { HA.closeSheet(); };
    $('sheet').querySelectorAll('[data-c]').forEach(function (e) {
      e.onclick = function () {
        var nc = e.getAttribute('data-c'), ns = e.getAttribute('data-s') || null;
        confirmChange('Kategori diubah ke ' + esc(catNm(nc, ns)) + '.', function () { it.cat = nc; it.sub = ns; it.mod = Date.now(); persist(); back(); }, function () { pickCat(it, back); });
      };
    });
  }
  function catNm(c, s) { var cc = HA.tandaCatOf(c), sub = cc && s ? (cc.subs || []).filter(function (z) { return z.id === s; })[0] : null; return (cc ? cc.name : 'Tanpa kategori') + (sub ? ' / ' + (sub.name || 'Sub') : ''); }
  // konfirmasi sebelum perubahan pada tanda yang sudah ada
  function confirmChange(txt, yes, no) {
    HA.onSheetClose = null;
    HA.askConfirm('Simpan perubahan?', txt, 'Simpan', yes, true);
    var cn = $('cfNo'); if (cn) cn.onclick = no;
  }
  function pickNote(it, back) {
    HA.openSheet('<div class="grab"></div><div class="st">CATATAN TANDA</div><input type="text" id="pnT" maxlength="120" placeholder="mis. Urea 200 kg/ha" value="' + esc(it.note || '') + '" style="width:100%;margin-top:10px"><div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="pnX" style="flex:1">Batal</button><button class="btn pri" id="pnY" style="flex:1">Simpan</button></div>');
    HA.onSheetClose = back;
    $('pnX').onclick = function () { HA.closeSheet(); };
    $('pnY').onclick = function () { var v = $('pnT').value.trim(); confirmChange(v ? 'Catatan: ' + esc(v) : 'Catatan dihapus.', function () { it.note = v; it.mod = Date.now(); persist(); back(); }, function () { pickNote(it, back); }); };
  }
  function pickDT(it, back) {
    var U = HA.tandaU, w = it.wk || '';
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">UBAH TANGGAL DAN WAKTU</div><button class="ib" id="pdX" aria-label="Tutup"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><label class="calL" style="margin-top:8px">Tanggal tanda<input type="date" id="pdD" max="' + HA.S.today + '" value="' + U.dateOf(it) + '"></label>' +
      '<div class="muted" style="margin:10px 0 4px">Waktu</div><div class="rbC" id="pwC">' + ['', 'Pagi', 'Siang', 'Sore', 'Malam'].map(function (x) { return '<button type="button" data-w="' + x + '"' + (w === x ? ' class="on"' : '') + '>' + (x || 'Tanpa waktu') + '</button>'; }).join('') + '</div>' +
      '<div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="pdN" style="flex:1;height:50px">Batal</button><button class="btn pri" id="pdY" style="flex:1;height:50px">Simpan</button></div>');
    HA.onSheetClose = back;
    $('pdX').onclick = function () { HA.closeSheet(); }; $('pdN').onclick = function () { HA.closeSheet(); };
    $('pwC').onclick = function (e) { var x = e.target.getAttribute && e.target.getAttribute('data-w'); if (x == null) return; w = x; $('pwC').querySelectorAll('button').forEach(function (z) { z.className = z.getAttribute('data-w') === x ? 'on' : ''; }); };
    $('pdY').onclick = function () {
      var v = $('pdD').value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > HA.S.today) { HA.toast('Tanggal tidak valid'); return; }
      confirmChange('Tanggal ' + U.d8(v) + ' \u00B7 waktu ' + (w || 'tanpa waktu') + '.', function () { it.date = v; if (w) it.wk = w; else delete it.wk; it.mod = Date.now(); persist(); back(); }, function () { pickDT(it, back); });
    };
  }
  // ---- Ubah luasan (progres kumulatif) satu tanda
  function luasan(it, back) {
    var b = HA.blockById ? HA.blockById(it.bid) : null;
    if (!b || !b.pts) { HA.toast('Blok tanda ini tidak ditemukan'); return; }
    var info = serInfo(b, it.cat, it.sub), me = info.map[it.id]; if (!me) { HA.toast('Tanda ini tidak punya luasan blok'); return; }
    var nx = info.its[me.i + 1]; if (nx && nx.part && !nx.full) { HA.toast('Ada bagian lebih baru di kategori ini. Ubah tanda yang paling akhir dulu.'); return; }
    var A = info.A, prevCum = me.prev, prevHa = A * prevCum / 100, side = lastSisi, pct = '', ha = '';
    function fm(v, d) { return String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).replace('.', ','); }
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">UBAH LUASAN</div><button class="ib" id="lwX" aria-label="Tutup"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="muted" style="margin:4px 0 6px">Blok ' + esc(String(b.name)) + ' \u00B7 ' + HA.tandaU.ha(A) + ' ha \u00B7 sekarang blok ' + fm(me.cum, 1) + '%' + (prevCum > 0 ? ' \u00B7 sebelumnya ' + fm(prevCum, 1) + '%' : '') + '</div>' +
      '<div class="rbC" id="lwQ"><button type="button" data-p="25">25%</button><button type="button" data-p="50">50%</button><button type="button" data-p="75">75%</button><button type="button" data-p="100">100%</button></div>' +
      '<div class="row" style="gap:8px"><label class="calL" style="flex:1">Progres blok (%)<input type="number" id="lwP" inputmode="decimal" min="1" max="100" step="1"></label><label class="calL" style="flex:1">Luas (ha)<input type="number" id="lwH" inputmode="decimal" min="0.01" step="0.01"></label></div>' +
      '<div class="muted" style="margin:10px 0 4px">Mulai dari sisi</div><div class="seg" id="lwD">' + ['U', 'S', 'T', 'B'].map(function (k) { return '<button type="button" data-v="' + k + '"' + (k === side ? ' class="on"' : '') + '>' + SISI[k] + '</button>'; }).join('') + '</div>' +
      '<div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="lwN" style="flex:1;height:50px">Batal</button><button class="btn pri" id="lwY" style="flex:1;height:50px">Simpan</button></div>');
    HA.onSheetClose = back;
    $('lwX').onclick = function () { HA.closeSheet(); }; $('lwN').onclick = function () { HA.closeSheet(); };
    function setP(v) { pct = v; ha = A * v / 100; $('lwP').value = fm(v, 1).replace(',', '.'); $('lwH').value = fm(ha, 2).replace(',', '.'); }
    $('lwQ').onclick = function (e) { var v = e.target.getAttribute && e.target.getAttribute('data-p'); if (v) setP(+v); };
    $('lwP').oninput = function () { var v = parseFloat(this.value); if (!(v > 0)) { pct = ''; ha = ''; $('lwH').value = ''; return; } if (v > 100) { v = 100; this.value = '100'; } pct = v; ha = A * v / 100; $('lwH').value = fm(ha, 2).replace(',', '.'); };
    $('lwH').oninput = function () { var v = parseFloat(this.value); if (!(v > 0)) { pct = ''; ha = ''; $('lwP').value = ''; return; } if (v > A) { v = A; this.value = fm(A, 2).replace(',', '.'); } ha = v; pct = v / A * 100; $('lwP').value = fm(pct, 1).replace(',', '.'); };
    $('lwD').onclick = function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-v'); if (!k) return; side = lastSisi = k; $('lwD').querySelectorAll('button').forEach(function (x) { x.className = x.getAttribute('data-v') === k ? 'on' : ''; }); };
    $('lwY').onclick = function () {
      if (!(ha > 0)) { HA.toast('Isi persen atau luas dulu'); return; }
      if (pct <= prevCum + 0.05) { HA.toast('Isi lebih besar dari progres sebelumnya (' + fm(prevCum, 1) + '%)'); return; }
      var toFull = prevCum === 0 && pct >= 99.9, r = null, part = null;
      if (!toFull) {
        r = HA.KM.strip(b, side, ha - prevHa, me.rings);
        if (r.err === 'penuh') { HA.toast('Seluruh blok sudah ditandai kategori ini'); return; }
        if (r.err) { HA.toast('Gagal menggambar bagian blok'); return; }
        part = { pct: Math.round(r.ha / A * 1000) / 10, ha: Math.round(r.ha * 100) / 100, sisi: side };
      }
      confirmChange('Luasan diubah dari blok ' + fm(me.cum, 1) + '% menjadi ' + fm(toFull ? 100 : pct, 1) + '%' + (toFull ? ' (penuh).' : ' (' + fm(ha, 2) + ' ha) dari sisi ' + SISI[side] + '.'), function () {
        if (toFull) { it.pts = b.pts.map(function (q) { return [q[0], q[1]]; }); it.full = true; it.fsig = 'full'; delete it.part; }
        else {
          it.pts = r.rings[0]; it.full = false; it.fsig = r.rings[0][0][0] + ',' + r.rings[0][0][1]; it.part = part;
          r.rings.slice(1).forEach(function (ring, n) { var c = JSON.parse(JSON.stringify(it)); c.id = HA.tandaNewId(); c.pts = ring; c.fsig = ring[0][0] + ',' + ring[0][1]; c.ts = Date.now() + n + 1; HA.tandaAdd(c); });
        }
        it.mod = Date.now(); persist(); back();
      }, function () { luasan(it, back); });
    };
  }

  // ---- Tebang: Mulai tebang / Tebang selesai (RC atau PC) / Urungkan
  function tebang(b, back) {
    var L = HA.lyb, t = L.today(), nm = String(b.name);
    function go() { tebang(b, back); }
    function back2() { HA.onSheetClose = null; back(); }
    function dv() { var v = $('tbD').value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > t) { HA.toast('Tanggal tidak valid'); return ''; } return v; }
    var I = L.tbInfo(b);
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">TEBANG · BLOK ' + esc(nm).toUpperCase() + '</div><button class="ib" id="tbX" aria-label="Tutup"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="muted" style="margin:4px 0">' + esc(I.text) + '</div>' +
      '<label class="calL" style="margin-top:8px">Tanggal<input type="date" id="tbD" max="' + t + '" value="' + t + '"></label>' +
      '<div class="row" style="gap:8px;margin-top:10px"><button class="btn" id="tbM" style="flex:1;height:46px">Mulai tebang</button><button class="btn pri" id="tbS" style="flex:1;height:46px">Tebang selesai</button></div>' +
      (I.mulai ? '<button class="btn" id="tbB" style="width:100%;margin-top:8px">Batalkan mulai tebang</button>' : '') +
      (I.undo ? '<button class="btn" id="tbU" style="width:100%;margin-top:8px">Urungkan tebang selesai</button><div class="muted" style="margin-top:4px">Bisa diurungkan sampai 7 hari setelah tebang selesai.</div>' : ''));
    HA.onSheetClose = back2;
    $('tbX').onclick = function () { HA.closeSheet(); };
    $('tbM').onclick = function () {
      var d = dv(); if (!d) return; HA.onSheetClose = null;
      HA.askConfirm('Mulai tebang blok ' + nm + '?', 'Tanggal mulai: ' + HA.tandaU.d8(d) + '.', 'Mulai', function () { L.tbMulai(b, d); if (HA.drawBlocks) HA.drawBlocks(); go(); });
      var cn = $('cfNo'); if (cn) cn.onclick = go;
    };
    if ($('tbB')) $('tbB').onclick = function () { L.tbBatal(b); go(); };
    $('tbS').onclick = function () {
      var d = dv(); if (!d) return;
      if (I.mulai && d < I.mulai) { HA.toast('Tanggal selesai sebelum tanggal mulai'); return; }
      HA.onSheetClose = null;
      HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">TEBANG SELESAI · ' + HA.tandaU.d8(d) + '</div><button class="ib" id="tcX" aria-label="Kembali"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<div class="muted" style="margin:4px 0 8px">Pilih kegiatan setelah tebang. Status berubah otomatis dan blok memulai siklus baru (riwayat lama tetap tersimpan).</div>' +
        '<button class="btn pri" id="tcRc" style="width:100%;height:52px">RC · Rawat ulang</button><div class="muted" style="margin:2px 0 10px">Status naik (PC→RC1, RC1→RC2 …). Varietas tetap.</div>' +
        '<button class="btn pri" id="tcPc" style="width:100%;height:52px">PC · Tanam ulang</button><div class="muted" style="margin:2px 0 10px">Status menjadi PC. Varietas dan bulan tanam dikosongkan.</div>');
      HA.onSheetClose = go;
      $('tcX').onclick = function () { HA.closeSheet(); };
      function fin(mode) {
        var r = L.tbSelesai(b, d, mode);
        if (r === 'ok') { HA.onSheetClose = null; if (HA.drawBlocks) HA.drawBlocks(); if (HA.KM && HA.KM.sync) HA.KM.sync(); HA.toast('Tebang selesai: siklus baru dimulai (' + mode.toUpperCase() + ')'); back2(); return; }
        HA.toast(r === 'list' ? 'Isi dulu jenis status di menu Lapisan' : r === 'kosong' ? 'Isi status blok dulu' : r === 'akhir' ? 'Sudah di status terakhir, pilih PC' : 'Tidak bisa diproses');
      }
      $('tcRc').onclick = function () { fin('rc'); };
      $('tcPc').onclick = function () { fin('pc'); };
    };
    if ($('tbU')) $('tbU').onclick = function () {
      HA.onSheetClose = null;
      HA.askConfirm('Urungkan tebang selesai?', 'Status, varietas, bulan tanam dan siklus blok ' + nm + ' kembali seperti sebelum tebang selesai.', 'Urungkan', function () { if (L.tbUndo(b)) { if (HA.drawBlocks) HA.drawBlocks(); if (HA.KM && HA.KM.sync) HA.KM.sync(); HA.toast('Tebang selesai diurungkan'); } go(); });
      var cn = $('cfNo'); if (cn) cn.onclick = go;
    };
  }

  // ---- Tandai: Penuh atau Sebagian (persen/ha saling mengisi, mulai dari satu sisi blok)
  function prevParts(b, br) {
    var its = HA.BT.itemsOf(b).filter(function (it) { return it.t === 'pg' && it.cat === br.cat && (it.sub || null) === (br.sub || null); });
    its.sort(function (x, y) { var a = BR.ordKey(x), c = BR.ordKey(y); return a < c ? -1 : a > c ? 1 : 0; });
    var ser = [], A = HzBlok.areaHa(b.pts);
    its.forEach(function (it) {
      if (it.full || !it.part) { ser = []; return; }
      ser.push(it);
      var tot = 0; ser.forEach(function (z) { tot += HzBlok.areaHa(z.pts); });
      if (tot >= A * 0.98) ser = [];
    });
    return ser.map(function (z) { return z.pts; });
  }
  function tandai(b, back) {
    if (!b.conf) { HA.toast('Hanya blok terkonfirmasi yang bisa ditandai'); return; }
    var br = HA.tandaBrush(), A = HzBlok.areaHa(b.pts), nm = String(b.name);
    function back2() { HA.onSheetClose = null; back(); }
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">TANDAI · ' + esc(br.name).toUpperCase() + '</div><button class="ib" id="tdX" aria-label="Tutup"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="muted" style="margin:4px 0 10px">Blok ' + esc(nm) + ' · ' + HA.tandaU.ha(A) + ' ha</div>' +
      '<div class="row" style="gap:8px"><button class="btn pri" id="tdP" style="flex:1;height:56px">Penuh</button><button class="btn pri" id="tdS" style="flex:1;height:56px">Sebagian</button></div>');
    HA.onSheetClose = back2;
    $('tdX').onclick = function () { HA.closeSheet(); };
    $('tdP').onclick = function () { HA.onSheetClose = null; if (HA.KM.fillBlock(b, null)) back2(); else tandai(b, back); };
    $('tdS').onclick = function () { sebagian(b, br, A, back, function () { tandai(b, back); }); };
  }
  function sebagian(b, br, A, back, bk, rn) {
    var si = serInfo(b, br.cat, br.sub || null);
    if (si.stale && !rn) {
      var dd = dayDiff(si.last, todayS());
      HA.openSheet('<div class="grab"></div><div class="st">PUTARAN BARU?</div><div class="muted" style="margin:6px 0 14px">Tanda ' + esc(br.name) + ' di blok ' + esc(String(b.name)) + ' terakhir ' + dd + ' hari lalu (progres ' + String(Math.round(si.endCum * 10) / 10).replace('.', ',') + '%). Lanjutkan putaran sebelumnya atau mulai putaran baru?</div>' +
        '<div class="row" style="gap:8px"><button class="btn pri" id="prC" style="flex:1;height:50px">Lanjutkan</button><button class="btn pri" id="prN" style="flex:1;height:50px">Putaran baru</button></div><button class="btn" id="prX" style="width:100%;height:46px;margin-top:8px">Batal</button>');
      HA.onSheetClose = bk;
      $('prX').onclick = function () { HA.closeSheet(); };
      $('prC').onclick = function () { HA.onSheetClose = null; sebagian(b, br, A, back, bk, 'cont'); };
      $('prN').onclick = function () { HA.onSheetClose = null; sebagian(b, br, A, back, bk, 'new'); };
      return;
    }
    var fresh = rn === 'new', prev = fresh ? [] : si.endRings, prevCum = fresh ? 0 : si.endCum, prevHa = A * prevCum / 100, side = lastSisi, pct = '', ha = '';
    function fmt(v, d) { return String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).replace('.', ','); }
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">TANDAI SEBAGIAN · ' + esc(br.name).toUpperCase() + '</div><button class="ib" id="tsX" aria-label="Kembali"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="muted" style="margin:4px 0 6px">Blok ' + esc(String(b.name)) + ' \u00B7 ' + HA.tandaU.ha(A) + ' ha' + (prev.length ? ' \u00B7 progres sebelumnya ' + fmt(prevCum, 1) + '% (' + HA.tandaU.ha(prevHa) + ' ha)' : '') + '</div>' +
      '<div class="rbC" id="tsQ"><button type="button" data-p="25">25%</button><button type="button" data-p="50">50%</button><button type="button" data-p="75">75%</button><button type="button" data-p="100">100%</button></div>' +
      '<div class="row" style="gap:8px"><label class="calL" style="flex:1">Progres blok sekarang (%)<input type="number" id="tsP" inputmode="decimal" min="1" max="100" step="1"></label><label class="calL" style="flex:1">Luas (ha)<input type="number" id="tsH" inputmode="decimal" min="0.01" step="0.01"></label></div>' +
      '<div class="muted" style="margin:10px 0 4px">Mulai dari sisi</div><div class="seg" id="tsD">' + ['U', 'S', 'T', 'B'].map(function (k) { return '<button type="button" data-v="' + k + '"' + (k === side ? ' class="on"' : '') + '>' + SISI[k] + '</button>'; }).join('') + '</div>' +
      '<div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="tsN" style="flex:1;height:50px">Batal</button><button class="btn pri" id="tsY" style="flex:1;height:50px">Tandai</button></div>');
    HA.onSheetClose = bk;
    $('tsX').onclick = function () { HA.closeSheet(); }; $('tsN').onclick = function () { HA.closeSheet(); };
    function setP(v) { pct = v; ha = A * v / 100; $('tsP').value = fmt(v, 1).replace(',', '.'); $('tsH').value = fmt(ha, 2).replace(',', '.'); }
    $('tsQ').onclick = function (e) { var v = e.target.getAttribute && e.target.getAttribute('data-p'); if (v) setP(+v); };
    $('tsP').oninput = function () { var v = parseFloat(this.value); if (!(v > 0)) { pct = ''; ha = ''; $('tsH').value = ''; return; } if (v > 100) { v = 100; this.value = '100'; } pct = v; ha = A * v / 100; $('tsH').value = fmt(ha, 2).replace(',', '.'); };
    $('tsH').oninput = function () { var v = parseFloat(this.value); if (!(v > 0)) { pct = ''; ha = ''; $('tsP').value = ''; return; } if (v > A) { v = A; this.value = fmt(A, 2).replace(',', '.'); } ha = v; pct = v / A * 100; $('tsP').value = fmt(pct, 1).replace(',', '.'); };
    $('tsD').onclick = function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-v'); if (!k) return; side = lastSisi = k; $('tsD').querySelectorAll('button').forEach(function (x) { x.className = x.getAttribute('data-v') === k ? 'on' : ''; }); };
    $('tsY').onclick = function () {
      if (!(ha > 0)) { HA.toast('Isi persen atau luas dulu'); return; }
      if (pct <= prevCum + 0.05) { HA.toast('Isi lebih besar dari progres sebelumnya (' + fmt(prevCum, 1) + '%)'); return; }
      var r = HA.KM.strip(b, side, ha - prevHa, prev);
      if (r.err === 'penuh') { HA.toast('Seluruh blok sudah ditandai kategori ini'); return; }
      if (r.err) { HA.toast('Gagal menggambar bagian blok'); return; }
      var part = { pct: Math.round(r.ha / A * 1000) / 10, ha: Math.round(r.ha * 100) / 100, sisi: side }; if (rn) part.rn = rn;
      HA.onSheetClose = null; var n = 0;
      r.rings.forEach(function (ring, ri) { var pp = part; if (ri && part.rn === 'new') { pp = {}; for (var k in part) pp[k] = part[k]; delete pp.rn; } if (HA.KM.fillBlock(b, ring, { part: pp })) n++; });
      if (n) back(); else sebagian(b, br, A, back, bk, rn);
    };
  }
  // ---- daftar riwayat blok
  BR.open = function (b, onClose) {
    var key = String(b.id);
    function render() {
      var U = HA.tandaU, all = HA.BT.itemsOf(b).slice();
      all.sort(function (x, y) { var a = BR.ordKey(x), c = BR.ordKey(y); return a < c ? 1 : a > c ? -1 : 0; });
      var cats = {}, ord = [];
      all.forEach(function (it) { var k = HA.tandaCatKey(it); if (!cats[k]) { var inf = HA.tandaCatInfo(it); cats[k] = { k: k, name: inf.name, col: inf.col, nocat: inf.nocat, n: 0, last: '' }; ord.push(cats[k]); } var c = cats[k]; c.n++; var d = U.dateOf(it); if (d > c.last) c.last = d; });
      if (filt[key] && !cats[filt[key]]) filt[key] = null;
      var f = filt[key], list = f ? all.filter(function (it) { return HA.tandaCatKey(it) === f; }) : all;
      var prevL = b.cy ? HA.BT.itemsOf(b, true).filter(function (it) { return U.dateOf(it) < b.cy; }).sort(function (x, y) { var a = BR.ordKey(x), c = BR.ordKey(y); return a < c ? 1 : a > c ? -1 : 0; }) : [], disp = list.concat(prevL);
      var sum = ord.map(function (c) { return '<div class="rbS">' + (c.nocat ? '<i class="nocat"></i>' : '<i style="background:' + c.col + '"></i>') + '<span>' + esc(c.name) + ' ' + c.n + '× · terakhir ' + U.d8(c.last) + '</span></div>'; }).join('');
      var chips = ord.length > 1 ? '<div class="rbC"><button type="button" data-k=""' + (!f ? ' class="on"' : '') + '>Semua</button>' + ord.map(function (c) { return '<button type="button" data-k="' + esc(c.k) + '"' + (f === c.k ? ' class="on"' : '') + '>' + esc(c.name) + '</button>'; }).join('') + '</div>' : '';
 var lastRd = null;
      var rowsA = disp.map(function (it, i) {
        var inf = HA.tandaCatInfo(it), sn = subName(it), sp = '';
        if (f && i < list.length) { var r = rdOf(it); if (r && r !== lastRd) sp = '<div class="rbSp">Putaran ' + r + '</div>'; if (r) lastRd = r; }
        return sp + '<div class="rbR" data-i="' + i + '">' + (inf.nocat ? '<i class="nocat"></i>' : '<i style="background:' + inf.col + '"></i>') + '<div class="rbT"><b>' + esc(inf.name) + (sn ? ' / ' + esc(sn) : '') + seqTxt(it) + incTxt(it) + '</b><small>' + U.d8(U.dateOf(it)) + wkTxt(it) + ' · ' + statTxt(it) + (f ? '' : rdTxt(it)) + (it.note ? ' · ' + esc(String(it.note).slice(0, 30)) : '') + '</small></div><span class="rbG" aria-hidden="true">›</span></div>';
      });
      var rows = rowsA.slice(0, list.length).join(''), prevRows = rowsA.slice(list.length).join(''), ti = HA.lyb ? HA.lyb.tbInfo(b) : null;
      HA.openSheet('<div class="pmTop"><div class="grab"></div><div class="bth"><div class="st">RIWAYAT · ' + esc(b.name) + '</div><button class="ib" id="rbOk" aria-label="Tutup"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>' +
        (ti && (ti.mulai || ti.cy) ? '<div class="muted" style="margin:2px 0 4px">' + esc(ti.text) + '</div>' : '') +
        (ord.length ? sum + chips + '<div class="rbL">' + rows + (prevL.length ? '<details class="rbPv"><summary>Siklus sebelumnya (' + prevL.length + ')</summary>' + prevRows + '</details>' : '') + '</div>' : '<div class="muted" style="padding:12px 2px">' + (b.cy ? 'Belum ada riwayat di siklus ini.' : 'Belum ada riwayat. Tanda yang disimpan di blok ini akan muncul di sini.') + '</div>' + (prevL.length ? '<details class="rbPv"><summary>Siklus sebelumnya (' + prevL.length + ')</summary><div class="rbL">' + prevRows + '</div></details>' : '')) +
        '<div class="pmBot"><div class="row" style="gap:8px"><button class="btn" id="rbTb" style="flex:1;height:50px">Tebang</button><button class="btn" id="rbFull" style="flex:1;height:50px">Tandai</button></div></div>');
      HA.onSheetClose = onClose || null;
      $('rbOk').onclick = function () { HA.closeSheet(); };
      $('rbFull').onclick = function () { tandai(b, function () { render(); HA.onSheetClose = onClose || null; }); };
      $('rbTb').onclick = function () { tebang(b, function () { render(); HA.onSheetClose = onClose || null; }); };
      var sh = $('sheet');
      sh.querySelectorAll('.rbC button').forEach(function (e) { e.onclick = function () { filt[key] = e.getAttribute('data-k') || null; var h = HA.onSheetClose; render(); HA.onSheetClose = h; }; });
      sh.querySelectorAll('.rbR').forEach(function (e) {
        e.onclick = function () { var it = disp[+e.getAttribute('data-i')]; if (it) detail(it, function () { render(); }); };
      });
    }
    render();
  };
})();
