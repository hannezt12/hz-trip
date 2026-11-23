/* HZ Trip - Lapisan blok (v0.20.0): Status tanaman (simbol) dan Varietas (warna + arsir). Data per blok hanya kode: b.ly = { idLapisan: idItem }, b.tn = bulan tanam. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function save() { return HA.saveSettings(); }
  var PATS = [['none', 'Polos'], ['d1', 'Miring /'], ['d2', 'Miring \\'], ['x', 'Silang'], ['h', 'Datar'], ['v', 'Tegak'], ['dot', 'Titik']];
  var PAL = ['#E53935', '#FB8C00', '#FDD835', '#43A047', '#00ACC1', '#1E88E5', '#5E35B1', '#D81B60', '#6D4C41', '#757575'];
  var SYMQ = ['P+', 'R1', 'R2', 'R3', 'D4', 'D5', '+', '*', '#', 'X'];

  // ---------- simbol vektor: P+ (plus merah), R1-R3 (titik), D4/D5 (dadu) ----------
  var SV_TOK = { 'P+': 1, R1: 1, R2: 1, R3: 1, D4: 1, D5: 1 };
  function isVec(sym) { return !!SV_TOK[sym]; }
  function diceN(sym) { return isVec(sym) ? 1 : 0; }
  function symK() { var v = +S.settings.symK; return v > 0 ? v : 1.5; }
  function dotsXY(sym) {
    if (sym === 'R1') return [[0, 0]]; if (sym === 'R2') return [[-0.27, 0], [0.27, 0]]; if (sym === 'R3') return [[-0.5, 0], [0, 0], [0.5, 0]];
    var d = 0.3, a = [[-d, -d], [d, -d], [-d, d], [d, d]]; if (sym === 'D5') a.push([0, 0]); return a;
  }
  function dotR(sym) { return sym.charAt(0) === 'R' ? 0.2 : 0.18; }
  function circP(x, y, r) { var k = 0.5523 * r; return n2(x + r) + ' ' + n2(y) + ' m ' + n2(x + r) + ' ' + n2(y + k) + ' ' + n2(x + k) + ' ' + n2(y + r) + ' ' + n2(x) + ' ' + n2(y + r) + ' c ' + n2(x - k) + ' ' + n2(y + r) + ' ' + n2(x - r) + ' ' + n2(y + k) + ' ' + n2(x - r) + ' ' + n2(y) + ' c ' + n2(x - r) + ' ' + n2(y - k) + ' ' + n2(x - k) + ' ' + n2(y - r) + ' ' + n2(x) + ' ' + n2(y - r) + ' c ' + n2(x + k) + ' ' + n2(y - r) + ' ' + n2(x + r) + ' ' + n2(y - k) + ' ' + n2(x + r) + ' ' + n2(y) + ' c h '; }
  // gambar simbol di tengah (cx,cy); sz = sisi kotak dasar (pt, sudah termasuk pengali); halo = tebal halo putih titik (0 = tanpa). PC (+) selalu berhalo.
  function symPdf(cx, cy, sz, sym, halo) {
    if (sym === 'P+') {
      var a = sz * 0.31, w = sz * 0.17, h = sz * 0.09;
      var pth = n2(cx - a) + ' ' + n2(cy) + ' m ' + n2(cx + a) + ' ' + n2(cy) + ' l S ' + n2(cx) + ' ' + n2(cy - a) + ' m ' + n2(cx) + ' ' + n2(cy + a) + ' l S ';
      return 'q 1 G 2 J ' + n2(w + 2 * h) + ' w ' + pth + 'Q q 0.86 0.08 0.08 RG 0 J ' + n2(w) + ' w ' + pth + 'Q';
    }
    var r = sz * dotR(sym), pts = dotsXY(sym).map(function (q) { return circP(cx + q[0] * sz, cy + q[1] * sz, r); }).join('');
    return (halo > 0 ? 'q 1 g 1 G ' + n2(halo) + ' w ' + pts + 'B Q ' : '') + 'q 0 g ' + pts + 'f Q';
  }
  // lebar simbol relatif terhadap sz (untuk tata letak)
  function symW(sym) { return sym === 'R3' ? 1.4 : sym === 'R2' ? 1.0 : 0.9; }
  function symHtml(sym) {
    if (!isVec(sym)) return esc(sym || '-');
    var body;
    if (sym === 'P+') body = '<path d="M-0.28 0H0.28M0 -0.28V0.28" stroke="#DB1414" stroke-width="0.17" fill="none"/>';
    else body = dotsXY(sym).map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + dotR(sym) + '" fill="currentColor"/>'; }).join('');
    return '<svg class="lbDice" viewBox="-0.75 -0.5 1.5 1" width="24" height="16">' + body + '</svg>';
  }
  function symTxt(sym) { return isVec(sym) ? '' : String(sym || ''); }

  // ---------- Bulan tanam: 12 warna bersama (garis tepi Master + warna bulan Laporan) ----------
  var BN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BC0 = ['#e6194b', '#f58231', '#ffe119', '#8fd14f', '#2e8b3d', '#17bebb', '#4fc3f7', '#1f4fa8', '#8e44ad', '#d81b9a', '#8d5524', '#6c7a89'];
  function bulanCol(n) { var a = S.settings.bulanCol; return (a && a[n - 1]) || BC0[n - 1]; }
  function btOn() { return !!S.settings.btOn; }
  function btW() { var v = +S.settings.btW; return v > 0 ? v : 1.5; }
  function bulanOf(b) { return b && b.tn && /^\d{4}-\d{2}$/.test(b.tn) ? +b.tn.slice(5, 7) : 0; }
  function btOpen() {
    var cnt = {}; HA.blocksList().forEach(function (b) { var m = bulanOf(b); if (m) cnt[m] = (cnt[m] || 0) + 1; });
    openSheet('<div class="grab"></div><div class="bth"><div class="st">BULAN TANAM</div><button class="btn pri" id="btX">Selesai</button></div>' +
      '<div class="muted" style="margin:4px 0 8px">Satu warna per bulan (tanpa tahun). Warna ini dipakai sebagai garis tepi blok di cetak Master dan sebagai warna bulan di Laporan Tahunan. Bulan tanam blok diatur di Edit blok (blok RC: bulan tebang terakhir).</div>' +
      '<label style="display:block"><input type="checkbox" id="btOn"' + (btOn() ? ' checked' : '') + '> Ikut cetak Master (garis tepi menurut bulan tanam)</label>' +
      '<div class="h" style="margin-top:10px">TEBAL GARIS TEPI (pt)</div><input type="number" id="btW" min="0.5" max="8" step="0.5" inputmode="decimal" value="' + btW() + '" style="width:100%">' +
      '<div class="h" style="margin-top:10px">WARNA BULAN</div><div class="lbList">' + BN.map(function (nm, i) { return '<label class="lbRow" style="min-height:2.75rem;align-items:center;gap:10px"><input type="color" data-n="' + (i + 1) + '" value="' + bulanCol(i + 1) + '"><span style="flex:1">' + nm + '</span><span class="muted">' + (cnt[i + 1] || 0) + ' blok</span></label>'; }).join('') + '</div>' +
      '<button class="btn" id="btR" style="width:100%;margin-top:8px">Kembalikan warna awal</button>');
    $('btX').onclick = home;
    $('btOn').onchange = function () { S.settings.btOn = this.checked; save(); };
    $('btW').onchange = function () { var v = Math.max(0.5, Math.min(8, parseFloat(String(this.value).replace(',', '.')) || 1.5)); S.settings.btW = v; this.value = v; save(); };
    $('sheet').querySelectorAll('input[type=color][data-n]').forEach(function (e) { e.onchange = function () { var a = (S.settings.bulanCol || BC0).slice(); a[+e.getAttribute('data-n') - 1] = e.value; S.settings.bulanCol = a; save(); }; });
    $('btR').onclick = function () { S.settings.bulanCol = null; save(); btOpen(); };
  }

  function all() {
    var a = S.settings.lyb;
    if (!a) {
      a = S.settings.lyb = [
        { id: 'status', name: 'Status tanaman', mode: 'sym', on: true, items: [
          { id: 'pc', name: 'PC', sym: '±', col: '#1F4E9E' }, { id: 'rc1', name: 'RC1', sym: '•', col: '#1F4E9E' },
          { id: 'rc2', name: 'RC2', sym: '••', col: '#1F4E9E' }, { id: 'rc3', name: 'RC3', sym: '•••', col: '#1F4E9E' },
          { id: 'rc4', name: 'RC4', sym: 'D4', col: '#1F4E9E' }, { id: 'rc5', name: 'RC5', sym: 'D5', col: '#1F4E9E' }] },
        { id: 'varietas', name: 'Varietas', mode: 'fill', on: true, items: [] }
      ];
    }
    if (!a.symMig) {
      a.symMig = 1; var M2 = { '\u00B1': 'P+', '\u2022': 'R1', '\u2022\u2022': 'R2', '\u2022\u2022\u2022': 'R3' };
      a.forEach(function (l) { if (l.id === 'status') l.items.forEach(function (it) { if (M2[it.sym]) it.sym = M2[it.sym]; }); });
    }
    if (!a.rcMig) {
      a.rcMig = 1;
      var st = null; a.forEach(function (l) { if (l.id === 'status') st = l; });
      if (st && st.items.length && st.items[st.items.length - 1].id === 'rc3') {
        st.items.push({ id: 'rc4', name: 'RC4', sym: 'D4', col: '#1F4E9E' }, { id: 'rc5', name: 'RC5', sym: 'D5', col: '#1F4E9E' }); save();
      }
    }
    return a;
  }
  function lapBy(id) { var r = null; all().forEach(function (l) { if (l.id === id) r = l; }); return r; }
  function itemBy(lap, id) { var r = null; if (lap) lap.items.forEach(function (x) { if (x.id === id) r = x; }); return r; }
  function of(b, lapId) { var lap = lapBy(lapId); return b && b.ly && lap ? itemBy(lap, b.ly[lapId]) : null; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function setItem(b, lapId, itemId) {
    var cur = b.ly && b.ly[lapId] || '';
    if (cur === (itemId || '')) return false;
    b.ly = b.ly || {};
    if (itemId) b.ly[lapId] = itemId; else delete b.ly[lapId];
    (b.lyh = b.lyh || []).push({ l: lapId, i: itemId || '', d: today() });
    if (b.lyh.length > 60) b.lyh = b.lyh.slice(-60);
    return true;
  }
  function umur(b) {
    if (!b || !b.tn || !/^\d{4}-\d{2}$/.test(b.tn)) return '';
    var n = new Date(), m = (n.getFullYear() - +b.tn.slice(0, 4)) * 12 + (n.getMonth() + 1 - +b.tn.slice(5, 7));
    return m < 0 ? '' : m + ' bln';
  }
  function txt(b) {
    var a = [], v = of(b, 'varietas'), s = of(b, 'status');
    if (v) a.push('V_' + v.name);
    if (s) a.push(s.name);
    var u = umur(b); if (u) a.push(u.replace(' bln', ' bulan'));
    all().forEach(function (l) { if (l.id === 'varietas' || l.id === 'status') return; var it = of(b, l.id); if (it) a.push(it.name); });
    return a.join('-');
  }
  function nextItem(b, lap) {
    var cur = b.ly && b.ly[lap.id], ix = -1; lap.items.forEach(function (x, i) { if (x.id === cur) ix = i; });
    return lap.items[ix + 1] || null;
  }
  function active() { return all().filter(function (l) { return l.on && l.items.length && HA.blocksList().some(function (b) { return of(b, l.id); }); }); }

  // ---------- gambar PDF: isi warna + arsir, dipotong mengikuti poligon ----------
  function rgb(h) { h = String(h || '#888888').replace('#', ''); if (h.length !== 6) h = '888888'; var f = function (i) { return (Math.round(parseInt(h.slice(i, i + 2), 16) / 255 * 1000) / 1000); }; return f(0) + ' ' + f(2) + ' ' + f(4); }
  function n2(v) { return (Math.round(v * 100) / 100); }
  function pathOf(xy) { var s = ''; xy.forEach(function (p, i) { s += n2(p[0]) + ' ' + n2(p[1]) + (i ? ' l ' : ' m '); }); return s + 'h '; }
  function fillPdf(item, xy, gs, hsp) {
    if (!item || !xy || xy.length < 3) return '';
    var s = '', x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    xy.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    if (item.col) s += 'q ' + (gs ? gs + ' gs ' : '') + rgb(item.col) + ' rg ' + pathOf(xy) + 'f Q\n';
    var pat = item.pat || 'none';
    if (pat !== 'none') {
      var w = x1 - x0, h = y1 - y0, sp = Math.max(2.5, (hsp > 0 ? hsp : 4.2) * (item.ps > 0 ? item.ps : 1)), ink = rgb(item.pc || '#000000'), k;
      s += 'q ' + pathOf(xy) + 'W n ' + ink + ' RG ' + ink + ' rg ' + n2(Math.max(0.7, Math.min(3.5, sp * 0.14))) + ' w ';
      if (pat === 'd1' || pat === 'x') for (k = -h; k <= w; k += sp) s += n2(x0 + k) + ' ' + n2(y0) + ' m ' + n2(x0 + k + h) + ' ' + n2(y1) + ' l S ';
      if (pat === 'd2' || pat === 'x') for (k = -h; k <= w; k += sp) s += n2(x0 + k) + ' ' + n2(y1) + ' m ' + n2(x0 + k + h) + ' ' + n2(y0) + ' l S ';
      if (pat === 'h') for (k = 0; k <= h; k += sp) s += n2(x0) + ' ' + n2(y0 + k) + ' m ' + n2(x1) + ' ' + n2(y0 + k) + ' l S ';
      if (pat === 'v') for (k = 0; k <= w; k += sp) s += n2(x0 + k) + ' ' + n2(y0) + ' m ' + n2(x0 + k) + ' ' + n2(y1) + ' l S ';
      if (pat === 'dot') { var gx, gy; for (gx = 0; gx <= w; gx += sp * 1.4) for (gy = 0; gy <= h; gy += sp * 1.4) s += n2(x0 + gx) + ' ' + n2(y0 + gy) + ' 1 1 re f '; }
      s += 'Q\n';
    }
    return s;
  }
  // kotak contoh (legenda) di PDF: x,y = kiri bawah, ukuran w x h
  function swatchPdf(item, x, y, w, h) { return fillPdf(item, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], null) + 'q 0 G 0.4 w ' + n2(x) + ' ' + n2(y) + ' ' + n2(w) + ' ' + n2(h) + ' re S Q\n'; }

  // ---------- gambar layar: pratinjau item ----------
  var SV = 0;
  function prevSvg(l, it) {
    if (l.mode === 'sym') return '<span class="lbSym">' + symHtml(it.sym) + '</span>';
    var id = 'lbp' + (++SV), pat = it.pat || 'none', ink = it.pc || '#000000', body = '';
    if (pat !== 'none') {
      var psz = 8 * (it.ps > 0 ? it.ps : 1), ln = { d1: '<path d="M0 8L8 0" />', d2: '<path d="M0 0L8 8" />', x: '<path d="M0 8L8 0M0 0L8 8" />', h: '<path d="M0 4H8" />', v: '<path d="M4 0V8" />', dot: '<circle cx="4" cy="4" r="1" fill="' + ink + '" stroke="none"/>' }[pat];
      body = '<defs><pattern id="' + id + '" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="scale(' + (it.ps > 0 ? it.ps : 1) + ')"><g stroke="' + ink + '" stroke-width="' + (1 + 0.3 * Math.max(0, (it.ps || 1) - 1)) + '">' + ln + '</g></pattern></defs><rect width="44" height="26" fill="url(#' + id + ')"/>';
    }
    return '<svg width="44" height="26" viewBox="0 0 44 26" class="lbSw"><rect width="44" height="26" fill="' + esc(it.col || '#888') + '" fill-opacity="1"/>' + body + '<rect width="44" height="26" fill="none" stroke="currentColor" stroke-opacity=".5"/></svg>';
  }

  // ---------- menu Lapisan ----------
  function home() {
    var ls = all();
    openSheet('<div class="grab"></div><div class="bth"><div class="st">LAPISAN</div><button class="btn pri" id="lbX">Selesai</button></div>' +
      '<div class="muted" style="margin:4px 0 8px">Keterangan blok untuk jangka panjang. Tiap blok hanya menyimpan kodenya; gambarnya dibuat saat cetak, dan tiap lapisan jadi layer sendiri di PDF.</div>' +
      ls.map(function (l) {
        var nb = HA.blocksList().filter(function (b) { return of(b, l.id); }).length;
        return '<div class="lbCard"><button type="button" class="lbOpen" data-l="' + l.id + '"><b>' + esc(l.name) + '</b><span class="muted">' + l.items.length + ' jenis · ' + nb + ' blok · ' + (l.mode === 'sym' ? 'simbol' : 'warna + arsir') + '</span></button>' +
          '<label class="lbOn"><input type="checkbox" data-on="' + l.id + '"' + (l.on ? ' checked' : '') + '> Ikut cetak</label></div>';
      }).join('') +
      (HA.obj ? '<div class="lbCard"><button type="button" class="lbOpen" id="lbObj"><b>Objek</b><span class="muted">' + HA.obj.jenis().length + ' jenis \u00B7 ' + HA.obj.objs().length + ' objek \u00B7 titik, garis, area</span></button><label class="lbOn"><input type="checkbox" id="lbObjOn"' + (HA.obj.on() ? ' checked' : '') + '> Ikut cetak</label></div>' : '') +
      '<div class="lbCard"><button type="button" class="lbOpen" id="lbBt"><b>Bulan tanam</b><span class="muted">12 warna bulan \u00B7 garis tepi \u00B7 ' + btW() + ' pt</span></button><label class="lbOn"><input type="checkbox" id="lbBtOn"' + (btOn() ? ' checked' : '') + '> Ikut cetak</label></div>' +
      '<div class="lbCard" style="display:block"><b>Tebang otomatis</b><div class="muted" style="margin:2px 0 6px">Tanda tebang/panen menaikkan status blok otomatis (nama kategori berisi "bibit" = tebang bibit, selain itu produksi). Tebang berikutnya di blok yang sama dalam jumlah hari ini dianggap lanjutan, status tidak naik lagi.</div><div class="row" style="gap:8px"><label class="calL">Produksi (hari)<input type="number" id="lbWp" min="1" max="365" value="' + winDays('produksi') + '"></label><label class="calL">Bibit (hari)<input type="number" id="lbWb" min="1" max="365" value="' + winDays('bibit') + '"></label></div></div>' +
      '<div class="row" style="gap:8px;margin-top:10px"><button class="btn" id="lbCx" style="flex:1">Ekspor CSV</button><button class="btn" id="lbCi" style="flex:1">Impor CSV</button></div>' +
      '<button class="btn" id="lbBulk" style="width:100%;margin-top:8px">Atur banyak blok</button>' +
      '<button class="btn" id="lbNew" style="width:100%;margin-top:8px">+ Lapisan baru</button>');
    $('lbX').onclick = closeSheet;
    $('sheet').querySelectorAll('.lbOpen').forEach(function (e) { e.onclick = function () { lapOpen(e.getAttribute('data-l')); }; });
    $('sheet').querySelectorAll('[data-on]').forEach(function (e) { e.onchange = function () { lapBy(e.getAttribute('data-on')).on = e.checked; save(); }; });
    if ($('lbObj')) { $('lbObj').onclick = function () { HA.obj.open(); }; $('lbObjOn').onchange = function () { S.settings.objOn = this.checked; save(); }; }
    $('lbBt').onclick = btOpen; $('lbBtOn').onchange = function () { S.settings.btOn = this.checked; save(); };
    $('lbBulk').onclick = function () { bulk(null); };
    function wv(id, k) { $(id).onchange = function () { var v = Math.max(1, Math.min(365, Math.round(+this.value) || 30)); this.value = v; (S.settings.lybWin = S.settings.lybWin || {})[k] = v; save(); }; }
    wv('lbWp', 'produksi'); wv('lbWb', 'bibit');
    $('lbCx').onclick = csvOut; $('lbCi').onclick = csvIn;
    $('lbNew').onclick = newLap;
  }
  function newLap() {
    openSheet('<div class="grab"></div><div class="bth"><div class="st">LAPISAN BARU</div><button class="btn pri" id="lnS">Simpan</button></div>' +
      '<input type="text" id="lnN" maxlength="30" placeholder="Nama lapisan, mis. Kondisi" style="width:100%;margin-top:8px">' +
      '<div class="h" style="margin-top:10px">TAMPILAN</div><div class="seg" id="lnM"><button data-v="sym" class="on">Simbol</button><button data-v="fill">Warna + arsir</button></div>' +
      '<button class="btn" id="lnB" style="width:100%;margin-top:10px">Batal</button>');
    var mode = 'sym';
    $('lnM').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-v]'); if (!b) return; mode = b.getAttribute('data-v'); $('lnM').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); };
    $('lnB').onclick = home;
    $('lnS').onclick = function () {
      var nm = $('lnN').value.trim(); if (!nm) { toast('Isi nama lapisan'); return; }
      all().push({ id: 'l' + Date.now().toString(36), name: nm, mode: mode, on: true, items: [], custom: true }); save(); home();
    };
  }
  function lapOpen(id) {
    var l = lapBy(id); if (!l) return home();
    openSheet('<div class="grab"></div><div class="bth"><div class="st">' + esc(l.name.toUpperCase()) + '</div><button class="btn pri" id="ldX">Selesai</button></div>' +
      (l.items.length ? '<div class="lbList">' + l.items.map(function (it, i) {
        var nb = HA.blocksList().filter(function (b) { return b.ly && b.ly[l.id] === it.id; }).length;
        return '<div class="lbRow"><button type="button" class="lbIt" data-i="' + it.id + '">' + prevSvg(l, it) + '<span class="lbNm"><b>' + esc(it.name) + '</b><span class="muted"> · ' + nb + ' blok</span></span></button>' +
          '<button type="button" class="btn sm" data-u="' + i + '" aria-label="Naik"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="btn sm" data-d="' + i + '" aria-label="Turun"' + (i < l.items.length - 1 ? '' : ' disabled') + '>↓</button></div>';
      }).join('') + '</div>' : '<div class="muted" style="margin:10px 0">Belum ada jenis. Tambahkan di bawah.</div>') +
      '<button class="btn pri" id="ldA" style="width:100%;margin-top:10px">+ Tambah ' + (l.mode === 'sym' ? 'status' : 'jenis') + '</button>' +
      (l.mode === 'sym' ? '<div class="muted" style="margin-top:6px">Urutan dipakai tombol Naik status (PC → RC1 → RC2 ...).</div>' : '') +
      (l.mode === 'sym' ? '<div class="h" style="margin-top:10px">UKURAN SIMBOL DI CETAK (×)</div><input type="number" id="ldSk" min="0.5" max="5" step="0.1" inputmode="decimal" value="' + symK() + '" style="width:100%"><div class="muted">1 = ukuran dasar; 1,5 = bawaan. Berlaku untuk semua simbol status.</div>' : '') +
      (l.custom ? '<button class="btn" id="ldDel" style="width:100%;margin-top:8px;color:var(--r)">Hapus lapisan ini</button>' : '') +
      '<button class="btn" id="ldBk" style="width:100%;margin-top:8px">Kembali</button>');
    $('ldX').onclick = closeSheet; $('ldBk').onclick = home;
    $('ldA').onclick = function () { itemEdit(l, null); };
    if ($('ldSk')) $('ldSk').onchange = function () { var v = Math.max(0.5, Math.min(5, parseFloat(String(this.value).replace(',', '.')) || 1.5)); S.settings.symK = v; this.value = v; save(); };
    $('sheet').querySelectorAll('.lbIt').forEach(function (e) { e.onclick = function () { itemEdit(l, itemBy(l, e.getAttribute('data-i'))); }; });
    $('sheet').querySelectorAll('[data-u],[data-d]').forEach(function (e) {
      e.onclick = function () { var u = e.hasAttribute('data-u'), i = +e.getAttribute(u ? 'data-u' : 'data-d'), j = u ? i - 1 : i + 1, t = l.items[i]; l.items[i] = l.items[j]; l.items[j] = t; save(); lapOpen(id); };
    });
    if ($('ldDel')) $('ldDel').onclick = function () {
      HA.askConfirm('Hapus lapisan ' + l.name + '?', 'Isi lapisan dan pengaturan blok untuk lapisan ini hilang. Data blok lain tidak berubah.', 'Hapus', function () {
        HA.blocksList().forEach(function (b) { if (b.ly) delete b.ly[l.id]; });
        S.settings.lyb = all().filter(function (x) { return x.id !== l.id; }); save(); home();
      });
    };
  }
  function itemEdit(l, it) {
    var nw = !it, d = it ? JSON.parse(JSON.stringify(it)) : { id: 'i' + Date.now().toString(36), name: '', sym: l.mode === 'sym' ? '•' : '', col: l.mode === 'fill' ? PAL[0] : '#1F4E9E', pat: 'none', pc: '#000000' };
    function body() {
      var h = '<input type="text" id="ieN" maxlength="30" placeholder="' + (l.mode === 'sym' ? 'Nama, mis. RC4' : 'Nama varietas') + '" value="' + esc(d.name) + '" style="width:100%;margin-top:8px">';
      if (l.mode === 'sym') {
        h += '<div class="h" style="margin-top:10px">SIMBOL DI CETAK</div><input type="text" id="ieS" maxlength="6" value="' + esc(d.sym) + '" style="width:100%"><div class="lbQ">' + SYMQ.map(function (s) { return '<button type="button" class="btn sm" data-s="' + esc(s) + '">' + symHtml(s) + '</button>'; }).join('') + '</div><div class="muted">Huruf, angka, ± dan • aman tercetak. D4 dan D5 = titik dadu (4 dan 5 titik).</div>';
      } else {
        h += '<div class="h" style="margin-top:10px">WARNA ISI</div><div class="lbQ">' + PAL.map(function (c) { return '<button type="button" class="lbC' + (d.col === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '<input type="color" id="ieC" value="' + esc(d.col) + '"></div>' +
          '<div class="h" style="margin-top:10px">POLA ARSIR</div><div class="lbQ">' + PATS.map(function (p) { return '<button type="button" class="btn sm' + (d.pat === p[0] ? ' pri' : '') + '" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
          '<div class="h" style="margin-top:10px">UKURAN ARSIR</div><div class="lbQ">' + [1, 1.5, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="btn sm' + ((d.ps || 1) === n ? ' pri' : '') + '" data-ps="' + n + '">' + String(n).replace('.', ',') + '</button>'; }).join('') + '<input type="number" id="iePs" min="0.5" max="8" step="0.5" inputmode="decimal" value="' + (d.ps || 1) + '" style="width:72px;text-align:center"></div>' +
          '<div class="h" style="margin-top:10px">WARNA ARSIR</div><div class="lbQ">' + ['#000000', '#FFFFFF'].concat(PAL).map(function (c) { return '<button type="button" class="lbC' + (d.pc === c ? ' on' : '') + '" data-pc="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '<input type="color" id="iePc" value="' + esc(d.pc) + '"></div>';
      }
      h += '<div class="h" style="margin-top:10px">CONTOH</div><div class="lbPv">' + prevSvg(l, d) + ' <b>' + esc(d.name || '(nama)') + '</b></div>';
      return h;
    }
    function draw() {
      openSheet('<div class="grab"></div><div class="bth"><div class="st">' + (nw ? 'TAMBAH' : 'EDIT') + ' · ' + esc(l.name.toUpperCase()) + '</div><button class="btn pri" id="ieS2">Simpan</button></div><div id="ieB">' + body() + '</div>' +
        (nw ? '' : '<button class="btn" id="ieDel" style="width:100%;margin-top:10px;color:var(--r)">Hapus</button>') + '<button class="btn" id="ieBk" style="width:100%;margin-top:8px">Batal</button>');
      wire();
    }
    function refreshPv() { var e = document.querySelector('#ieB .lbPv'); if (e) e.innerHTML = prevSvg(l, d) + ' <b>' + esc(d.name || '(nama)') + '</b>'; }
    function wire() {
      $('ieN').oninput = function () { d.name = this.value; refreshPv(); };
      if ($('ieS')) $('ieS').oninput = function () { d.sym = this.value; refreshPv(); };
      $('sheet').querySelectorAll('[data-s]').forEach(function (e) { e.onclick = function () { d.sym = e.getAttribute('data-s'); $('ieS').value = d.sym; refreshPv(); }; });
      $('sheet').querySelectorAll('[data-c]').forEach(function (e) { e.onclick = function () { d.col = e.getAttribute('data-c'); keep(); }; });
      $('sheet').querySelectorAll('[data-pc]').forEach(function (e) { e.onclick = function () { d.pc = e.getAttribute('data-pc'); keep(); }; });
      $('sheet').querySelectorAll('[data-p]').forEach(function (e) { e.onclick = function () { d.pat = e.getAttribute('data-p'); keep(); }; });
      $('sheet').querySelectorAll('[data-ps]').forEach(function (e) { e.onclick = function () { d.ps = parseFloat(e.getAttribute('data-ps')); keep(); }; });
      if ($('iePs')) $('iePs').onchange = function () { var v = parseFloat(String(this.value).replace(',', '.')); d.ps = isFinite(v) ? Math.max(0.5, Math.min(8, v)) : 1; keep(); };
      if ($('ieC')) $('ieC').onchange = function () { d.col = this.value; keep(); };
      if ($('iePc')) $('iePc').onchange = function () { d.pc = this.value; keep(); };
      $('ieBk').onclick = function () { lapOpen(l.id); };
      $('ieS2').onclick = function () {
        d.name = (d.name || '').trim(); if (!d.name) { toast('Isi nama'); return; }
        if (l.mode === 'sym' && !String(d.sym || '').trim()) { toast('Isi simbol'); return; }
        var dup = l.items.some(function (x) { return x.id !== d.id && x.name.toLowerCase() === d.name.toLowerCase(); }); if (dup) { toast('Nama sudah dipakai'); return; }
        if (nw) l.items.push(d); else l.items[l.items.indexOf(it)] = d;
        save(); lapOpen(l.id);
      };
      if ($('ieDel')) $('ieDel').onclick = function () {
        var nb = HA.blocksList().filter(function (b) { return b.ly && b.ly[l.id] === it.id; }).length;
        HA.askConfirm('Hapus ' + it.name + '?', nb ? nb + ' blok memakai ini dan akan dikosongkan.' : 'Belum dipakai blok mana pun.', 'Hapus', function () {
          HA.blocksList().forEach(function (b) { if (b.ly && b.ly[l.id] === it.id) setItem(b, l.id, ''); });
          l.items = l.items.filter(function (x) { return x !== it; }); save(); lapOpen(l.id);
        }, function () { itemEdit(l, it); });
      };
    }
    function keep() { var nm = d.name; draw(); $('ieN').value = nm; }
    draw();
  }

  // ---------- atur banyak blok ----------
  function bulk(preLap) {
    var ls = all().filter(function (l) { return l.items.length; });
    if (!ls.length) { toast('Isi jenis lapisan dulu'); return; }
    var st = { lap: preLap || ls[0].id, act: 'set', item: '', q: '', sel: {} };
    function lap() { return lapBy(st.lap); }
    function blocks() {
      var q = st.q.trim().toLowerCase(), col = new Intl.Collator('id', { numeric: true });
      return HA.blocksList().filter(function (b) { return !q || String(b.name).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return col.compare(String(a.name), String(b.name)); });
    }
    function rows() {
      var bl = blocks(), l = lap(), cut = bl.slice(0, 150);
      return cut.map(function (b) { var it = of(b, l.id); return '<label class="lsR"><input type="checkbox" data-b="' + b.id + '"' + (st.sel[b.id] ? ' checked' : '') + '><span class="lsT"><b>' + esc(String(b.name)) + '</b> <span class="muted">' + esc(it ? it.name : '—') + '</span></span></label>'; }).join('') +
        (bl.length > cut.length ? '<div class="muted" style="padding:8px 0">' + (bl.length - cut.length) + ' blok lagi. Ketik nomor blok di kolom cari.</div>' : '') || '<div class="muted">Tidak ada blok.</div>';
    }
    function nSel() { return Object.keys(st.sel).filter(function (k) { return st.sel[k]; }).length; }
    function draw() {
      var l = lap();
      openSheet('<div class="grab"></div><div class="bth"><div class="st">ATUR BANYAK BLOK</div><button class="btn" id="bkX">Tutup</button></div>' +
        '<div class="h" style="margin-top:6px">LAPISAN</div><select id="bkL" style="width:100%">' + ls.map(function (x) { return '<option value="' + x.id + '"' + (x.id === st.lap ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
        '<div class="seg" id="bkA" style="margin-top:8px"><button data-v="set"' + (st.act === 'set' ? ' class="on"' : '') + '>Atur ke</button><button data-v="up"' + (st.act === 'up' ? ' class="on"' : '') + '>Naik satu tingkat</button></div>' +
        (st.act === 'set' ? '<select id="bkI" style="width:100%;margin-top:8px"><option value="">(kosongkan)</option>' + l.items.map(function (x) { return '<option value="' + x.id + '"' + (x.id === st.item ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' : '<div class="muted" style="margin-top:8px">Tiap blok terpilih naik ke jenis berikutnya menurut urutan (mis. RC1 → RC2).</div>') +
        '<input type="text" id="bkQ" placeholder="Cari nomor blok" value="' + esc(st.q) + '" style="width:100%;margin-top:10px">' +
        '<div class="shAct"><button type="button" class="btn sm" id="bkAll">Semua yang tampil</button><button type="button" class="btn sm" id="bkNo">Kosongkan pilihan</button></div>' +
        '<div class="plist" id="bkR" style="max-height:38vh;overflow:auto">' + rows() + '</div>' +
        '<button class="btn pri" id="bkGo" style="width:100%;margin-top:10px;height:52px">Terapkan (' + nSel() + ' blok)</button>');
      var qv = $('bkQ').value;
      $('bkX').onclick = closeSheet; $('bkL').onchange = function () { st.lap = this.value; st.item = ''; draw(); };
      $('bkA').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-v]'); if (b) { st.act = b.getAttribute('data-v'); draw(); } };
      if ($('bkI')) $('bkI').onchange = function () { st.item = this.value; };
      $('bkQ').oninput = function () { st.q = this.value; $('bkR').innerHTML = rows(); };
      $('bkR').onchange = function (e) { var id = e.target.getAttribute && e.target.getAttribute('data-b'); if (id) { st.sel[id] = e.target.checked; $('bkGo').textContent = 'Terapkan (' + nSel() + ' blok)'; } };
      $('bkAll').onclick = function () { blocks().forEach(function (b) { st.sel[b.id] = true; }); $('bkR').innerHTML = rows(); $('bkGo').textContent = 'Terapkan (' + nSel() + ' blok)'; };
      $('bkNo').onclick = function () { st.sel = {}; $('bkR').innerHTML = rows(); $('bkGo').textContent = 'Terapkan (0 blok)'; };
      $('bkGo').onclick = function () {
        var ids = Object.keys(st.sel).filter(function (k) { return st.sel[k]; }); if (!ids.length) { toast('Pilih blok dulu'); return; }
        var bs = HA.blocksList().filter(function (b) { return st.sel[b.id]; }), L2 = lap();
        var msg = st.act === 'up' ? bs.length + ' blok naik satu tingkat pada ' + L2.name + '.' : bs.length + ' blok diatur ke ' + (st.item ? itemBy(L2, st.item).name : 'kosong') + ' pada ' + L2.name + '.';
        HA.askConfirm('Ubah ' + bs.length + ' blok?', msg, 'Terapkan', function () {
          var n = 0, skip = 0;
          bs.forEach(function (b) {
            if (st.act === 'up') { var nx = nextItem(b, L2); if (!nx) { skip++; return; } if (setItem(b, L2.id, nx.id)) { n++; if (L2.id === 'status') b.tn = today().slice(0, 7); } }
            else if (setItem(b, L2.id, st.item)) n++;
          });
          save();
          toast(n + ' blok diubah' + (skip ? ', ' + skip + ' sudah di tingkat terakhir' : '')); home();
        }, draw);
        void qv;
      };
    }
    draw();
  }

  // ---------- naik status otomatis: tanda Panen/Tebang (produksi / bibit) tercatat di blok ----------
  function blockOfItem(it) {
    var bl = HA.blocksList(), i;
    if (it.bid != null) for (i = 0; i < bl.length; i++) if (String(bl[i].id) === String(it.bid)) return bl[i];
    if (it.pts && it.pts[0] && HA.blockAt) { try { return HA.blockAt(L.latLng(it.pts[0][0], it.pts[0][1])); } catch (e) {} }
    return null;
  }
  function winDays(j) { var w = S.settings.lybWin || {}, v = +w[j]; return v > 0 ? v : 30; }
  function dayDiff(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5); }
  function umurAt(b, d) {
    if (!b || !b.tn || !/^\d{4}-\d{2}$/.test(b.tn)) return '';
    var m = (+d.slice(0, 4) - +b.tn.slice(0, 4)) * 12 + (+d.slice(5, 7) - +b.tn.slice(5, 7)); return m < 0 ? '' : m;
  }
  function suggest(it) {
    if (!it || !it.cat) return;
    var c = HA.tandaCatOf ? HA.tandaCatOf(it.cat) : null;
    if (!c || !/panen|tebang/i.test(c.name || '')) return;
    var l = lapBy('status'); if (!l || !l.items.length) return;
    var b = blockOfItem(it); if (!b || !of(b, 'status') || !nextItem(b, l)) return;
    var d = it.date || today(), j = /bibit/i.test(c.name) ? 'bibit' : 'produksi';
    if (b.stSug) { if (d <= b.stSug || dayDiff(b.stSug, d) < winDays(j)) return; }
    var cur = of(b, 'status'), nx = nextItem(b, l), um = umurAt(b, d), pt = b.tn || '', ps = b.stSug || '';
    if (!setItem(b, 'status', nx.id)) return;
    var e = b.lyh[b.lyh.length - 1]; e.jn = j; e.um = um; e.pi = cur.id; e.pt = pt; e.ps = ps; e.ds = d;
    b.tn = d.slice(0, 7); b.stSug = d; save();
    toast('Blok ' + b.name + ': ' + cur.name + ' \u2192 ' + nx.name + ' (tebang ' + j + '). Urungkan di Riwayat status.');
  }
  function undoLast(b) {
    var h = b.lyh || [], e = h[h.length - 1]; if (!e || e.ps === undefined) return false;
    if (e.pi) { b.ly = b.ly || {}; b.ly[e.l] = e.pi; } else if (b.ly) delete b.ly[e.l];
    b.tn = e.pt || ''; if (e.ps) b.stSug = e.ps; else delete b.stSug; h.pop(); save(); return true;
  }

  // ---------- impor / ekspor CSV (dicocokkan lewat nama blok persis) ----------
  function nk(v) { return String(v == null ? '' : v).toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim(); }
  function cc(v) { v = String(v == null ? '' : v); if (/^\d+[\/.\-]\d+$/.test(v)) return '="' + v + '"'; if (/[;"\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'; return v; }
  function csvOut() {
    var ls = all().filter(function (l) { return l.items.length; }), rows = [['Blok'].concat(ls.map(function (l) { return l.name; })).concat(['Bulan tanam', 'Umur']).map(cc).join(';')];
    HA.blocksList().forEach(function (b) { rows.push([b.name].concat(ls.map(function (l) { var it = of(b, l.id); return it ? it.name : ''; })).concat([b.tn || '', umur(b)]).map(cc).join(';')); });
    HA.saveFile('HZTrip-lapisan-blok-' + today() + '.csv', HA.textB64('﻿' + rows.join('\r\n')), 'text/csv');
  }
  function parseCsv(t) {
    t = String(t || '').replace(/^﻿/, ''); var fl = t.split(/\r?\n/)[0] || '', dl = ';', cs = [[';', (fl.match(/;/g) || []).length], [',', (fl.match(/,/g) || []).length], ['\t', (fl.match(/\t/g) || []).length]].sort(function (a, b) { return b[1] - a[1]; }); if (cs[0][1]) dl = cs[0][0];
    var out = [], row = [], f = '', q = false, i, c;
    for (i = 0; i < t.length; i++) {
      c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"' && f === '') q = true;
      else if (c === dl) { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); out.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); out.push(row); }
    return out.map(function (r) { return r.map(function (v) { var m = /^="(.*)"$/.exec(v.trim()); return (m ? m[1] : v).trim(); }); }).filter(function (r) { return r.some(function (v) { return v !== ''; }); });
  }
  var MONS = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, ags: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  function parseTn(v) {
    v = String(v || '').trim(); if (!v) return ''; var m, y, mo;
    if ((m = /^(\d{4})[-\/.](\d{1,2})/.exec(v))) { y = +m[1]; mo = +m[2]; }
    else if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(v))) { y = +m[3]; mo = +m[2]; }
    else if ((m = /^(\d{1,2})[-\/.](\d{4})$/.exec(v))) { y = +m[2]; mo = +m[1]; }
    else if ((m = /^([A-Za-z]{3,})[\s\-\/.]+(\d{2,4})$/.exec(v))) { mo = MONS[m[1].slice(0, 3).toLowerCase()] || 0; y = +m[2]; if (y < 100) y += 2000; }
    else return null;
    return (mo >= 1 && mo <= 12 && y >= 1990 && y <= 2100) ? y + '-' + p2(mo) : null;
  }
  function csvIn() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,.txt,text/csv,text/plain';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return; var fr = new FileReader();
      fr.onload = function () { try { csvPrev(parseCsv(fr.result)); } catch (e) { toast('Berkas tidak terbaca'); } };
      fr.readAsText(f);
    };
    inp.click();
  }
  function csvPrev(rows) {
    if (rows.length < 2) { toast('CSV kosong'); return; }
    var hd = rows[0].map(nk), ls = all(), ci = { b: -1, t: -1 }, lc = {};
    hd.forEach(function (h, i) {
      if (ci.b < 0 && /^(blok|no blok|nama blok|block)$/.test(h)) ci.b = i;
      else if (ci.t < 0 && /^(bulan tanam|tanam|tebang|bulan tanam\/tebang)$/.test(h)) ci.t = i;
      else ls.forEach(function (l) { var n = nk(l.name); if ((h === n || (l.id === 'status' && h === 'status')) && lc[l.id] == null) lc[l.id] = i; });
    });
    if (ci.b < 0) { toast('Kolom "Blok" tidak ditemukan di baris pertama'); return; }
    if (ci.t < 0 && !Object.keys(lc).length) { toast('Tidak ada kolom Status/Varietas/Bulan tanam'); return; }
    var map = {}; HA.blocksList().forEach(function (b) { (map[nk(b.name)] = map[nk(b.name)] || []).push(b); });
    var ok = [], miss = [], dup = [], unk = {}, badT = 0;
    rows.slice(1).forEach(function (r) {
      var nm = r[ci.b]; if (!nm) return; var bs = map[nk(nm)];
      if (!bs) { miss.push(nm); return; } if (bs.length > 1) { dup.push(nm); return; }
      var o = { b: bs[0], v: {}, t: null };
      Object.keys(lc).forEach(function (id) {
        var raw = (r[lc[id]] || '').trim(); if (!raw) return; var l = lapBy(id), k = nk(raw), it = null;
        l.items.forEach(function (x) { if (nk(x.name) === k || (x.sym && nk(x.sym) === k)) it = x; });
        if (it) o.v[id] = it.id; else { (unk[id] = unk[id] || {})[raw] = 1; o.v[id] = { nw: raw }; }
      });
      if (ci.t >= 0 && (r[ci.t] || '').trim()) { var tn = parseTn(r[ci.t]); if (tn === null) badT++; else o.t = tn; }
      ok.push(o);
    });
    var mk = Object.keys(unk).filter(function (id) { return lapBy(id).mode === 'fill'; });
    var h = '<div class="grab"></div><div class="st">IMPOR CSV</div><div class="muted" style="margin:6px 0">Dicocokkan lewat nama blok persis (spasi/huruf besar kecil diabaikan; "04 TS 16" tidak sama dengan "04 TS 16s"). Sel kosong tidak mengubah data.</div>' +
      '<div class="plist"><div><b>' + ok.length + '</b> blok cocok</div>' + (miss.length ? '<div>' + miss.length + ' tidak ditemukan: <span class="muted">' + esc(miss.slice(0, 8).join(', ') + (miss.length > 8 ? ' ...' : '')) + '</span></div>' : '') +
      (dup.length ? '<div>' + dup.length + ' nama kembar di app (dilewati): <span class="muted">' + esc(dup.slice(0, 5).join(', ')) + '</span></div>' : '') + (badT ? '<div>' + badT + ' bulan tanam tidak terbaca (dilewati)</div>' : '') +
      Object.keys(unk).map(function (id) { var l = lapBy(id), n = Object.keys(unk[id]); return '<div>' + n.length + ' ' + esc(l.name) + ' belum ada: <span class="muted">' + esc(n.slice(0, 8).join(', ') + (n.length > 8 ? ' ...' : '')) + '</span></div>'; }).join('') + '</div>' +
      (mk.length ? '<label style="display:block;margin-top:8px"><input type="checkbox" id="ciNw" checked> Buat otomatis item baru (' + mk.map(function (id) { return esc(lapBy(id).name); }).join(', ') + '), warna/arsir bisa diubah di menu Lapisan</label>' : '') +
      (Object.keys(unk).some(function (id) { return lapBy(id).mode === 'sym'; }) ? '<div class="muted" style="margin-top:6px">Status yang belum ada tidak dibuat otomatis (dilewati).</div>' : '') +
      '<button class="btn pri" id="ciGo" style="width:100%;margin-top:10px;height:50px"' + (ok.length ? '' : ' disabled') + '>Terapkan</button><button class="btn" id="ciNo" style="width:100%;margin-top:8px">Batal</button>';
    openSheet(h);
    $('ciNo').onclick = home;
    $('ciGo').onclick = function () {
      var mkNew = $('ciNw') && $('ciNw').checked, made = {}, n = 0, idx = 0;
      ok.forEach(function (o) {
        var ch = false;
        Object.keys(o.v).forEach(function (id) {
          var v = o.v[id], l = lapBy(id);
          if (typeof v === 'object') {
            if (l.mode !== 'fill' || !mkNew) return; var k = nk(v.nw), it = made[id + '|' + k];
            if (!it) { it = { id: 'i' + Date.now().toString(36) + (idx++), name: v.nw, sym: '', col: PAL[l.items.length % PAL.length], pat: PATS[(Math.floor(l.items.length / PAL.length) % (PATS.length - 1)) + 1][0], pc: '#000000' }; l.items.push(it); made[id + '|' + k] = it; }
            v = it.id;
          }
          if (setItem(o.b, id, v)) ch = true;
        });
        if (o.t && o.b.tn !== o.t) { o.b.tn = o.t; ch = true; }
        if (ch) n++;
      });
      save(); toast(n + ' blok diperbarui'); home();
    };
  }
  var hk = setInterval(function () {
    if (!HA.tandaAdd || HA.tandaAdd._lyb) return;
    var o = HA.tandaAdd; HA.tandaAdd = function (it) { var r = o.apply(this, arguments); try { suggest(it); } catch (e) {} return r; }; HA.tandaAdd._lyb = 1; clearInterval(hk);
  }, 700);
  function hist(b, back) {
    var h = (b.lyh || []).slice().reverse();
    openSheet('<div class="grab"></div><div class="bth"><div class="st">RIWAYAT STATUS \u00B7 BLOK ' + esc(String(b.name)).toUpperCase() + '</div><button class="btn pri" id="rhX">Tutup</button></div>' +
      (h.length ? '<div class="lbList">' + h.map(function (x) { var l = lapBy(x.l), it = l && itemBy(l, x.i); return '<div class="lbRow" style="min-height:2.75rem;align-items:center"><span class="muted" style="width:6.5rem;flex:none">' + esc(x.d) + '</span><span><b>' + esc(l ? l.name : x.l) + '</b>: ' + esc(it ? it.name : 'dikosongkan') + (x.jn ? ' <span class="muted">\u00B7 tebang ' + x.jn + (x.um !== '' && x.um != null ? ' \u00B7 umur ' + x.um + ' bln' : '') + '</span>' : '') + '</span></div>'; }).join('') + '</div>' : '<div class="muted" style="margin:10px 0">Belum ada perubahan.</div>') +
      (((b.lyh || []).length && b.lyh[b.lyh.length - 1].ps !== undefined) ? '<button class="btn" id="rhUn"' + (HA.plUn ? '' : ' disabled') + ' style="width:100%;margin-top:8px">Urungkan perubahan terakhir</button>' + (HA.plUn ? '' : '<div class="muted">Terkunci. Buka kunci di Edit blok > Lainnya.</div>') : '') +
      (b.tn ? '<div class="muted" style="margin-top:8px">Bulan tanam/tebang terakhir: ' + esc(b.tn) + '</div>' : ''));
    $('rhX').onclick = function () { if (back) back(); else closeSheet(); };
    if ($('rhUn')) $('rhUn').onclick = function () { if (undoLast(b)) { toast('Perubahan terakhir diurungkan'); hist(b, back); } };
  }
  HA.lyb = { hist: hist, suggest: suggest, all: all, by: lapBy, of: of, set: setItem, umur: umur, txt: txt, next: nextItem, active: active, fillPdf: fillPdf, swatchPdf: swatchPdf, rgb: rgb, pathOf: pathOf, PATS: PATS, PAL: PAL, prevSvg: prevSvg, diceN: diceN, isVec: isVec, symPdf: symPdf, symK: symK, symW: symW, symHtml: symHtml, symTxt: symTxt, bulanCol: bulanCol, bulanOf: bulanOf, btOn: btOn, btW: btW, BN: BN, home: home, bulk: bulk, today: today };
  document.addEventListener('DOMContentLoaded', wire); if (document.readyState !== 'loading') wire();
  function wire() {
    var a = document.querySelector('#drawer a[data-lyb]'); if (!a || a._w) return; a._w = 1;
    a.onclick = function () { HA.closeDrawer(); home(); };
  }
})();
