/* HZ Trip v0.16.3 - Riwayat blok: daftar tanda di satu blok, detail tanda (lihat, ubah kategori, ubah tanggal, hapus), Tandai blok penuh, Bagikan */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.BT) return;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  var BR = HA.BRiw = {}, filt = {}, hl = null;
  function subName(it) {
    var c = it.cat ? HA.tandaCatOf(it.cat) : null; if (!c || !it.sub) return '';
    var s = (c.subs || []).filter(function (x) { return x.id === it.sub; })[0]; return s ? (s.name || '') : '';
  }
  function statTxt(it) {
    var U = HA.tandaU, st = HA.tandaStat(it), a = [];
    if (it.t === 'pt') return 'titik';
    if (it.t === 'ln') return U.ribu(st.m) + ' m garis';
    a.push(U.ha(st.ha) + ' ha'); if (st.lm) a.push(U.ribu(st.lm) + ' m lajur');
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
  BR.fmtTs = fmtTs; BR.ordKey = ordKey; BR.detail = function (it, back) { detail(it, back); };
  function wkTxt(it) { return it.wk ? ' \u00B7 ' + it.wk : ''; }
  function seqTxt(it) { var q = BR.seq(it); return q ? ' ke-' + q.n : ''; }
  // ---- detail satu tanda
  function detail(it, back) {
    var U = HA.tandaU, inf = HA.tandaCatInfo(it), sn = subName(it);
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">TANDA · ' + esc(inf.name) + (sn ? ' / ' + esc(sn) : '') + '</div><button class="btn pri" id="rdOk">Kembali</button></div>' +
      '<div class="muted" style="margin:4px 0 4px">' + U.d8(U.dateOf(it)) + wkTxt(it) + ' · ' + statTxt(it) + seqTxt(it).replace(' ke-', ' · kegiatan ke-') + '</div>' + (it.note ? '<div style="margin:2px 0 4px">' + esc(it.note) + '</div>' : '') + '<div class="muted" style="font-size:11px;margin-bottom:10px">dibuat ' + fmtTs(it.ts) + (it.mod && it.mod !== it.ts ? ' \u00B7 diubah ' + fmtTs(it.mod) : '') + '</div>' +
      '<div class="rdG"><button class="btn" id="rdLh">Lihat di peta</button><button class="btn" id="rdKt">Ubah kategori</button>' + (it.t === 'pg' ? '<button class="btn" id="rdGy">Ubah gaya</button>' : '') + '<button class="btn" id="rdTg">Ubah tanggal</button><button class="btn" id="rdWk">Ubah waktu</button><button class="btn" id="rdNt">Catatan</button><button class="btn" id="rdDl" style="color:var(--r)">Hapus tanda</button></div>');
    HA.onSheetClose = back;
    $('rdOk').onclick = function () { HA.closeSheet(); };
    $('rdLh').onclick = function () { lihat(it); };
    $('rdKt').onclick = function () { pickCat(it, function () { detail(it, back); }); };
    if ($('rdGy')) $('rdGy').onclick = function () { HA.BRiw.gaya(it, function () { detail(it, back); }); };
    $('rdTg').onclick = function () { pickDate(it, function () { detail(it, back); }); };
    $('rdWk').onclick = function () { pickWk(it, function () { detail(it, back); }); };
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
    HA.askConfirm('Simpan perubahan?', txt, 'Simpan', yes);
    var cn = $('cfNo'); if (cn) cn.onclick = no;
  }
  function pickWk(it, back) {
    HA.openSheet('<div class="grab"></div><div class="st">UBAH WAKTU</div><div class="rbC" id="pwC" style="margin-top:10px">' + ['', 'Pagi', 'Siang', 'Sore', 'Malam'].map(function (w) { return '<button type="button" data-w="' + w + '"' + ((it.wk || '') === w ? ' class="on"' : '') + '>' + (w || 'Tanpa waktu') + '</button>'; }).join('') + '</div><div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="pwX" style="flex:1">Batal</button></div>');
    HA.onSheetClose = back;
    $('pwX').onclick = function () { HA.closeSheet(); };
    $('pwC').onclick = function (e) {
      var w = e.target.getAttribute && e.target.getAttribute('data-w'); if (w == null) return;
      confirmChange('Waktu diubah ke ' + (w || 'tanpa waktu') + '.', function () { if (w) it.wk = w; else delete it.wk; it.mod = Date.now(); persist(); back(); }, function () { pickWk(it, back); });
    };
  }
  function pickNote(it, back) {
    HA.openSheet('<div class="grab"></div><div class="st">CATATAN TANDA</div><input type="text" id="pnT" maxlength="120" placeholder="mis. Urea 200 kg/ha" value="' + esc(it.note || '') + '" style="width:100%;margin-top:10px"><div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="pnX" style="flex:1">Batal</button><button class="btn pri" id="pnY" style="flex:1">Simpan</button></div>');
    HA.onSheetClose = back;
    $('pnX').onclick = function () { HA.closeSheet(); };
    $('pnY').onclick = function () { var v = $('pnT').value.trim(); confirmChange(v ? 'Catatan: ' + esc(v) : 'Catatan dihapus.', function () { it.note = v; it.mod = Date.now(); persist(); back(); }, function () { pickNote(it, back); }); };
  }
  function pickDate(it, back) {
    var U = HA.tandaU;
    HA.openSheet('<div class="grab"></div><div class="st">UBAH TANGGAL</div><label class="calL" style="margin-top:8px">Tanggal tanda<input type="date" id="pdD" max="' + HA.S.today + '" value="' + U.dateOf(it) + '"></label><div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="pdX" style="flex:1">Batal</button><button class="btn pri" id="pdY" style="flex:1">Simpan</button></div>');
    HA.onSheetClose = back;
    $('pdX').onclick = function () { HA.closeSheet(); };
    $('pdY').onclick = function () {
      var v = $('pdD').value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > HA.S.today) { HA.toast('Tanggal tidak valid'); return; }
      confirmChange('Tanggal diubah ke ' + U.d8(v) + '.', function () { it.date = v; it.mod = Date.now(); persist(); back(); }, function () { pickDate(it, back); });
    };
  }
  // ---- daftar riwayat blok
  BR.open = function (b, onClose) {
    var key = String(b.id);
    function render() {
      var U = HA.tandaU, all = HA.BT.itemsOf(b).slice();
      all.sort(function (x, y) { var a = BR.ordKey(x), c = BR.ordKey(y); return a < c ? 1 : a > c ? -1 : 0; });
      var cats = {}, ord = [];
      all.forEach(function (it) { var k = HA.tandaCatKey(it); if (!cats[k]) { var inf = HA.tandaCatInfo(it); cats[k] = { k: k, name: inf.name, col: inf.col, n: 0, last: '' }; ord.push(cats[k]); } var c = cats[k]; c.n++; var d = U.dateOf(it); if (d > c.last) c.last = d; });
      if (filt[key] && !cats[filt[key]]) filt[key] = null;
      var f = filt[key], list = f ? all.filter(function (it) { return HA.tandaCatKey(it) === f; }) : all;
      var sum = ord.map(function (c) { return '<div class="rbS"><i style="background:' + c.col + '"></i><span>' + esc(c.name) + ' ' + c.n + '× · terakhir ' + U.d8(c.last) + '</span></div>'; }).join('');
      var chips = ord.length > 1 ? '<div class="rbC"><button type="button" data-k=""' + (!f ? ' class="on"' : '') + '>Semua</button>' + ord.map(function (c) { return '<button type="button" data-k="' + esc(c.k) + '"' + (f === c.k ? ' class="on"' : '') + '>' + esc(c.name) + '</button>'; }).join('') + '</div>' : '';
      var rows = list.map(function (it, i) {
        var inf = HA.tandaCatInfo(it), sn = subName(it);
        return '<div class="rbR" data-i="' + i + '"><i style="background:' + inf.col + '"></i><div class="rbT"><b>' + esc(inf.name) + (sn ? ' / ' + esc(sn) : '') + seqTxt(it) + '</b><small>' + U.d8(U.dateOf(it)) + wkTxt(it) + ' · ' + statTxt(it) + (it.note ? ' · ' + esc(String(it.note).slice(0, 30)) : '') + '</small></div><span class="rbG" aria-hidden="true">›</span></div>';
      }).join('');
      HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">RIWAYAT · ' + esc(b.name) + '</div><button class="btn pri" id="rbOk">Tutup</button></div>' +
        (ord.length ? sum + chips + '<div class="rbL">' + rows + '</div>' : '<div class="muted" style="padding:12px 2px">Belum ada riwayat. Tanda yang disimpan di blok ini akan muncul di sini.</div>') +
        '<div class="row" style="gap:8px;margin-top:10px"><button class="btn" id="rbFull" style="flex:1">Tandai blok penuh</button>' + (ord.length ? '<button class="btn" id="rbSh" style="flex:1">Bagikan blok (PDF)</button>' : '') + '</div>');
      HA.onSheetClose = onClose || null;
      $('rbOk').onclick = function () { HA.closeSheet(); };
      $('rbFull').onclick = function () {
        if (!b.conf) { HA.toast('Hanya blok terkonfirmasi yang bisa ditandai'); return; }
        var h = HA.onSheetClose; if (HA.KM.fillBlock(b, null)) { render(); HA.onSheetClose = h; }
      };
      if ($('rbSh')) $('rbSh').onclick = function () {
        if (!b.conf) { HA.toast('Hanya blok terkonfirmasi yang bisa dibagikan'); return; }
        HA.onSheetClose = null; HA.closeSheet(); HA.BT.share([b]);
      };
      var sh = $('sheet');
      sh.querySelectorAll('.rbC button').forEach(function (e) { e.onclick = function () { filt[key] = e.getAttribute('data-k') || null; var h = HA.onSheetClose; render(); HA.onSheetClose = h; }; });
      sh.querySelectorAll('.rbR').forEach(function (e) {
        e.onclick = function () { var it = list[+e.getAttribute('data-i')]; if (it) detail(it, function () { render(); }); };
      });
    }
    render();
  };
})();
