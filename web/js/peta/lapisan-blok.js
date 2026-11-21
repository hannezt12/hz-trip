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
  var SYMQ = ['±', '•', '••', '•••', '••••', '+', '*', '#', 'X'];

  function all() {
    var a = S.settings.lyb;
    if (!a) {
      a = S.settings.lyb = [
        { id: 'status', name: 'Status tanaman', mode: 'sym', on: true, items: [
          { id: 'pc', name: 'PC', sym: '±', col: '#1F4E9E' }, { id: 'rc1', name: 'RC1', sym: '•', col: '#1F4E9E' },
          { id: 'rc2', name: 'RC2', sym: '••', col: '#1F4E9E' }, { id: 'rc3', name: 'RC3', sym: '•••', col: '#1F4E9E' }] },
        { id: 'varietas', name: 'Varietas', mode: 'fill', on: true, items: [] }
      ];
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
    var a = [];
    all().forEach(function (l) { var it = of(b, l.id); if (it) a.push(l.mode === 'sym' ? l.name + ' ' + it.name : it.name); });
    var u = umur(b); if (u) a.push('umur ' + u);
    return a.join(' · ');
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
  function fillPdf(item, xy, gs) {
    if (!item || !xy || xy.length < 3) return '';
    var s = '', x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    xy.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    if (item.col) s += 'q ' + (gs ? gs + ' gs ' : '') + rgb(item.col) + ' rg ' + pathOf(xy) + 'f Q\n';
    var pat = item.pat || 'none';
    if (pat !== 'none') {
      var w = x1 - x0, h = y1 - y0, sp = 4.2, ink = rgb(item.pc || '#000000'), k;
      s += 'q ' + pathOf(xy) + 'W n ' + ink + ' RG ' + ink + ' rg 0.45 w ';
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
    if (l.mode === 'sym') return '<span class="lbSym">' + esc(it.sym || '-') + '</span>';
    var id = 'lbp' + (++SV), pat = it.pat || 'none', ink = it.pc || '#000000', body = '';
    if (pat !== 'none') {
      var ln = { d1: '<path d="M0 8L8 0" />', d2: '<path d="M0 0L8 8" />', x: '<path d="M0 8L8 0M0 0L8 8" />', h: '<path d="M0 4H8" />', v: '<path d="M4 0V8" />', dot: '<circle cx="4" cy="4" r="1" fill="' + ink + '" stroke="none"/>' }[pat];
      body = '<defs><pattern id="' + id + '" width="8" height="8" patternUnits="userSpaceOnUse"><g stroke="' + ink + '" stroke-width="1">' + ln + '</g></pattern></defs><rect width="44" height="26" fill="url(#' + id + ')"/>';
    }
    return '<svg width="44" height="26" viewBox="0 0 44 26" class="lbSw"><rect width="44" height="26" fill="' + esc(it.col || '#888') + '" fill-opacity="0.75"/>' + body + '<rect width="44" height="26" fill="none" stroke="currentColor" stroke-opacity=".5"/></svg>';
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
      '<button class="btn" id="lbBulk" style="width:100%;margin-top:10px">Atur banyak blok</button>' +
      '<button class="btn" id="lbNew" style="width:100%;margin-top:8px">+ Lapisan baru</button>');
    $('lbX').onclick = closeSheet;
    $('sheet').querySelectorAll('.lbOpen').forEach(function (e) { e.onclick = function () { lapOpen(e.getAttribute('data-l')); }; });
    $('sheet').querySelectorAll('[data-on]').forEach(function (e) { e.onchange = function () { lapBy(e.getAttribute('data-on')).on = e.checked; save(); }; });
    if ($('lbObj')) { $('lbObj').onclick = function () { HA.obj.open(); }; $('lbObjOn').onchange = function () { S.settings.objOn = this.checked; save(); }; }
    $('lbBulk').onclick = function () { bulk(null); };
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
      (l.custom ? '<button class="btn" id="ldDel" style="width:100%;margin-top:8px;color:var(--r)">Hapus lapisan ini</button>' : '') +
      '<button class="btn" id="ldBk" style="width:100%;margin-top:8px">Kembali</button>');
    $('ldX').onclick = closeSheet; $('ldBk').onclick = home;
    $('ldA').onclick = function () { itemEdit(l, null); };
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
        h += '<div class="h" style="margin-top:10px">SIMBOL DI CETAK</div><input type="text" id="ieS" maxlength="6" value="' + esc(d.sym) + '" style="width:100%"><div class="lbQ">' + SYMQ.map(function (s) { return '<button type="button" class="btn sm" data-s="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div><div class="muted">Huruf, angka, ± dan • aman tercetak.</div>';
      } else {
        h += '<div class="h" style="margin-top:10px">WARNA ISI</div><div class="lbQ">' + PAL.map(function (c) { return '<button type="button" class="lbC' + (d.col === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '<input type="color" id="ieC" value="' + esc(d.col) + '"></div>' +
          '<div class="h" style="margin-top:10px">POLA ARSIR</div><div class="lbQ">' + PATS.map(function (p) { return '<button type="button" class="btn sm' + (d.pat === p[0] ? ' pri' : '') + '" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
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
        HA.askConfirm('Terapkan?', msg, 'Terapkan', function () {
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

  // ---------- usul naik status: kategori Panen/Tebang tercatat di blok ----------
  var sq = {}, sqT = null;
  function blockOfItem(it) {
    var bl = HA.blocksList(), i;
    if (it.bid != null) for (i = 0; i < bl.length; i++) if (String(bl[i].id) === String(it.bid)) return bl[i];
    if (it.pts && it.pts[0] && HA.blockAt) { try { return HA.blockAt(L.latLng(it.pts[0][0], it.pts[0][1])); } catch (e) {} }
    return null;
  }
  function suggest(it) {
    if (!it || !it.cat) return;
    var c = HA.tandaCatOf ? HA.tandaCatOf(it.cat) : null;
    if (!c || !/panen|tebang/i.test(c.name || '')) return;
    var l = lapBy('status'); if (!l || !l.items.length) return;
    var b = blockOfItem(it); if (!b || !of(b, 'status') || !nextItem(b, l)) return;
    var d = it.date || today(); if (d <= (b.stSug || '')) return;
    if (!sq[b.id] || sq[b.id].d < d) sq[b.id] = { b: b, d: d };
    clearTimeout(sqT); sqT = setTimeout(function () { flush(0); }, 1500);
  }
  function flush(n) {
    var ks = Object.keys(sq); if (!ks.length) return;
    var busy = $('sheet').classList.contains('on') || (HA.DM && HA.DM.edit);
    if (busy) { if (n < 40) sqT = setTimeout(function () { flush(n + 1); }, 2500); return; }
    var l = lapBy('status'), rows = ks.map(function (k) {
      var q = sq[k], cur = of(q.b, 'status'), nx = nextItem(q.b, l); if (!cur || !nx) return '';
      return '<label class="lsR"><input type="checkbox" data-sb="' + k + '" checked><span class="lsT"><b>Blok ' + esc(String(q.b.name)) + '</b> <span class="muted">' + esc(cur.name) + ' \u2192 ' + esc(nx.name) + ' \u00B7 panen ' + esc(q.d) + '</span></span></label>';
    }).filter(Boolean);
    if (!rows.length) { sq = {}; return; }
    openSheet('<div class="grab"></div><div class="st">NAIK STATUS?</div><div class="muted" style="margin:6px 0">Kategori panen/tebang baru dicatat. Naikkan status tanam blok berikut?</div><div class="plist" style="max-height:40vh;overflow:auto">' + rows.join('') + '</div>' +
      '<button class="btn pri" id="nsGo" style="width:100%;margin-top:10px;height:50px">Naik status</button><button class="btn" id="nsNo" style="width:100%;margin-top:8px">Lewati</button>');
    function done(apply) {
      var pick = {}; $('sheet').querySelectorAll('[data-sb]').forEach(function (e) { pick[e.getAttribute('data-sb')] = e.checked; });
      var n2 = 0;
      Object.keys(sq).forEach(function (k) {
        var q = sq[k], nx = nextItem(q.b, l); q.b.stSug = q.d;
        if (apply && pick[k] && nx && setItem(q.b, 'status', nx.id)) { q.b.tn = q.d.slice(0, 7); n2++; }
      });
      sq = {}; save(); closeSheet(); if (apply) toast(n2 + ' blok naik status');
    }
    $('nsGo').onclick = function () { done(true); }; $('nsNo').onclick = function () { done(false); };
  }
  var hk = setInterval(function () {
    if (!HA.tandaAdd || HA.tandaAdd._lyb) return;
    var o = HA.tandaAdd; HA.tandaAdd = function (it) { var r = o.apply(this, arguments); try { suggest(it); } catch (e) {} return r; }; HA.tandaAdd._lyb = 1; clearInterval(hk);
  }, 700);
  function hist(b, back) {
    var h = (b.lyh || []).slice().reverse();
    openSheet('<div class="grab"></div><div class="bth"><div class="st">RIWAYAT STATUS \u00B7 BLOK ' + esc(String(b.name)).toUpperCase() + '</div><button class="btn pri" id="rhX">Tutup</button></div>' +
      (h.length ? '<div class="lbList">' + h.map(function (x) { var l = lapBy(x.l), it = l && itemBy(l, x.i); return '<div class="lbRow" style="min-height:2.75rem;align-items:center"><span class="muted" style="width:6.5rem;flex:none">' + esc(x.d) + '</span><span><b>' + esc(l ? l.name : x.l) + '</b>: ' + esc(it ? it.name : 'dikosongkan') + '</span></div>'; }).join('') + '</div>' : '<div class="muted" style="margin:10px 0">Belum ada perubahan.</div>') +
      (b.tn ? '<div class="muted" style="margin-top:8px">Bulan tanam/tebang terakhir: ' + esc(b.tn) + '</div>' : ''));
    $('rhX').onclick = function () { if (back) back(); else closeSheet(); };
  }
  HA.lyb = { hist: hist, suggest: suggest, all: all, by: lapBy, of: of, set: setItem, umur: umur, txt: txt, next: nextItem, active: active, fillPdf: fillPdf, swatchPdf: swatchPdf, rgb: rgb, pathOf: pathOf, PATS: PATS, PAL: PAL, prevSvg: prevSvg, home: home, bulk: bulk, today: today };
  document.addEventListener('DOMContentLoaded', wire); if (document.readyState !== 'loading') wire();
  function wire() {
    var a = document.querySelector('#drawer a[data-lyb]'); if (!a || a._w) return; a._w = 1;
    a.onclick = function () { HA.closeDrawer(); home(); };
  }
})();
