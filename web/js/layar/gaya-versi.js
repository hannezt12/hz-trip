/* HZ Trip v0.16.4 - Panel gaya Ketuk isi, ubah gaya tanda (gaya asli tersimpan), (versi simpanan kini per master di versi-master.js) */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.KM || !HA.BRiw || !HA.gyOf) return;
  var KM = HA.KM, S = HA.S, BR = HA.BRiw;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function cur() { return S.settings.fillGy || (S.settings.fillGy = { scope: 'blok', m: null, w: 0, col: null }); }
  var fgArea = false;
  function visible() { return KM.mode === 'kategori' && (KM.fillTap || fgArea); }
  function gyNow() { var g = cur(), o = {}; if (g.m) o.m = g.m; if (g.w) o.w = g.w; if (g.col) o.col = g.col; return (o.m || o.w || o.col) ? o : null; }
  // tanda baru memakai gaya panel (hanya saat panel terbuka); gaya asli disimpan di gy0
  var ta = HA.tandaAdd;
  HA.tandaAdd = function (it) {
    if (it && it.t === 'pg' && !it.gy && visible()) { var g = gyNow(); if (g) { it.gy = g; it.gy0 = clone(g); } }
    return ta.apply(this, arguments);
  };
  // ---- panel gaya
  function panelHtml() {
    var g = cur(), cc = HA.tandaBrush(), base = cc && cc.color ? cc.color : '#ff9800';
    return '<div class="fgH"><b>Ketuk isi</b><button type="button" class="ib" id="fgX" aria-label="Tutup"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="fgR"><span>Cakupan</span><div class="seg" id="fgSc"><button data-v="blok"' + (!fgArea ? ' class="on"' : '') + '>Blok penuh</button><button data-v="area"' + (fgArea ? ' class="on"' : '') + '>Area gambar</button></div></div>' +
      '<div class="fgR"><span>Gaya</span><div class="seg" id="fgM"><button data-v=""' + (!g.m ? ' class="on"' : '') + '>Ikut kategori</button><button data-v="isi"' + (g.m === 'isi' ? ' class="on"' : '') + '>Isi</button><button data-v="tepi"' + (g.m === 'tepi' ? ' class="on"' : '') + '>Garis tepi</button></div></div>' +
      '<div class="fgR"><span>Tebal tepi</span><input type="number" id="fgW" min="1" max="12" step="1" value="' + (g.w || '') + '" placeholder="kategori"><span>Warna</span><input type="color" id="fgC" value="' + (g.col || base) + '"><button type="button" class="btn" id="fgC0">Ikut kategori</button></div>' +
      (fgArea ? '<div class="muted fgT">Gambar area dengan tombol Ukur (Alat peta). Bagian di dalam blok jadi tanda dengan gaya ini.</div>' : '<div class="muted fgT">Ketuk blok (sementara), atur gaya, lalu Simpan. Ketuk lagi untuk melepas.</div>' + pendHtml());
  }
  // ---- tanda tertunda (pratinjau) : ketuk blok = sementara, Simpan(N)/Batal
  var MAXP = 20, pend = { list: [], date: null, wk: null, wkSet: false, note: '' }, pvL = null;
  function pdate() { return pend.date || KM.fillDate(); }
  function pwk() { return pend.wkSet ? (pend.wk || '') : HA.wkAuto(pdate()); }
  function pkey(b, ring) { return String(b.id) + '|' + (ring ? ring[0][0] + ',' + ring[0][1] : 'full'); }
  function pvStyle() {
    var g = cur(), br = HA.tandaBrush(), col = g.col || (br && br.color) || '#ff9800', m = g.m || (HA.tandaCatInfo && 0) || 'isi';
    return { color: col, weight: g.w || 3, fill: m !== 'tepi', fillColor: col, fillOpacity: m === 'tepi' ? 0 : 0.4, dashArray: '6 4', interactive: false };
  }
  function pvDraw() {
    if (!HA.map || typeof L === 'undefined') return;
    if (pvL) { HA.map.removeLayer(pvL); pvL = null; }
    if (!pend.list.length) return;
    pvL = L.layerGroup(pend.list.map(function (z) { return L.polygon(z.pts, pvStyle()); })).addTo(HA.map);
  }
  function pendClear() { pend = { list: [], date: null, wk: null, wkSet: false, note: '' }; pvDraw(); sync(); }
  KM.pendAdd = function (b, ring) {
    if (!b || !b.conf) { HA.toast('Ketuk di dalam blok terkonfirmasi'); return false; }
    var k = pkey(b, ring), i;
    for (i = 0; i < pend.list.length; i++) if (pend.list[i].k === k) { pend.list.splice(i, 1); pvDraw(); sync(); return true; }
    if (pend.list.length >= MAXP) { HA.toast('Maksimal ' + MAXP + ' blok sekali simpan'); return false; }
    pend.list.push({ k: k, b: b, ring: ring || null, pts: ring || b.pts.map(function (p) { return [p[0], p[1]]; }) });
    pvDraw(); sync(); return true;
  };
  KM.pendCount = function () { return pend.list.length; };
  KM.pendClear = pendClear;
  KM.pendSave = function () {
    if (!pend.list.length) return;
    var br = HA.tandaBrush(), dt = pdate(), wk = pwk(), note = (pend.note || '').trim(), U = HA.tandaU, items = HA.tandaData().items, dups = [], mk = [];
    pend.list.forEach(function (z) {
      var sig = z.ring ? z.ring[0][0] + ',' + z.ring[0][1] : 'full';
      if (items.some(function (i) { return String(i.bid) === String(z.b.id) && i.cat === br.cat && (i.sub || null) === (br.sub || null) && U.dateOf(i) === dt && (i.fsig || 'full') === sig; })) dups.push(z.b.name);
      mk.push({ id: HA.tandaNewId(), t: 'pg', pts: z.pts, cat: br.cat, sub: br.sub || null, name: String(z.b.name || ''), note: note, bid: z.b.id, full: !z.ring, fsig: sig, date: dt, wk: wk || undefined, ts: Date.now() });
    });
    function go() {
      mk.forEach(function (it) { if (!it.wk) delete it.wk; HA.tandaAdd(it); });
      HA.tandaSave(); HA.toast(mk.length + ' blok ditandai ' + br.name); pendClear(); if (KM.sync) KM.sync();
    }
    if (dups.length) HA.askConfirm('Sudah ada, tetap tambah?', 'Blok ' + dups.slice(0, 6).join(', ') + (dups.length > 6 ? ' dan ' + (dups.length - 6) + ' lainnya' : '') + ' sudah ditandai ' + br.name + ' pada ' + U.d8(dt) + '. Tambah sebagai kegiatan baru?', 'Tetap tambah', go);
    else go();
  };
  function pendHtml() {
    var n = pend.list.length, wk = pwk(), dt = pdate();
    return '<div class="fgR"><span>Tanggal</span><input type="date" id="fgD" value="' + dt + '" max="' + S.today + '"><span>Waktu</span></div>' +
      '<div class="fgR" id="fgWk">' + ['Pagi', 'Siang', 'Sore', 'Malam'].map(function (w) { return '<button type="button" class="btn' + (wk === w ? ' pri' : '') + '" data-w="' + w + '">' + w + '</button>'; }).join('') + '<button type="button" class="btn' + (!wk ? ' pri' : '') + '" data-w="">—</button></div>' +
      '<div class="fgR"><input type="text" id="fgN" maxlength="120" placeholder="Catatan, mis. Urea 200 kg/ha" value="' + esc(pend.note) + '" style="flex:1"></div>' +
      '<div class="fgR"><span id="fgCnt">' + n + '/' + MAXP + '</span><button type="button" class="btn" id="fgBt" style="flex:1">Batal</button><button type="button" class="btn pri" id="fgSv" style="flex:1"' + (n ? '' : ' disabled') + '>Simpan (' + n + ')</button></div>';
  }
  function sync() {
    var wrap = $('mapWrap') || document.body, e = $('fgPanel');
    if (!visible()) { if (e) e.style.display = 'none'; if (pend.list.length) { pend.list = []; pvDraw(); } return; }
    if (!e) { e = document.createElement('div'); e.id = 'fgPanel'; e.className = 'fgPanel'; wrap.appendChild(e); }
    e.style.display = 'block'; e.innerHTML = panelHtml(); wire(e);
  }
  function wire(e) {
    var g = cur();
    $('fgX').onclick = function () { fgArea = false; KM.fillTap = false; if (KM.sync) KM.sync(); sync(); };
    $('fgSc').onclick = function (ev) {
      var b = ev.target.closest('button[data-v]'); if (!b) return;
      if (b.getAttribute('data-v') === 'area') { fgArea = true; KM.fillTap = false; g.scope = 'area'; }
      else { fgArea = false; KM.fillTap = true; g.scope = 'blok'; }
      HA.saveSettings(); if (KM.sync) KM.sync(); sync();
    };
    $('fgM').onclick = function (ev) { var b = ev.target.closest('button[data-v]'); if (!b) return; g.m = b.getAttribute('data-v') || null; HA.saveSettings(); sync(); };
    $('fgW').onchange = function () { var v = Math.round(parseFloat(this.value)); g.w = isFinite(v) ? Math.max(1, Math.min(12, v)) : 0; if (g.w) S.settings.gyLastW = g.w; HA.saveSettings(); sync(); };
    $('fgC').onchange = function () { g.col = this.value; HA.saveSettings(); };
    $('fgC0').onclick = function () { g.col = null; HA.saveSettings(); sync(); };
    ['fgM', 'fgW', 'fgC', 'fgC0'].forEach(function (id) { var el = $(id); if (el) el.addEventListener(id === 'fgW' || id === 'fgC' ? 'change' : 'click', pvDraw); });
    if ($('fgD')) {
      $('fgD').onchange = function () { if (this.value) { pend.date = this.value; if (!pend.wkSet) pend.wk = null; sync(); } };
      $('fgWk').onclick = function (ev) { var b = ev.target.closest('button[data-w]'); if (!b) return; pend.wk = b.getAttribute('data-w'); pend.wkSet = true; sync(); };
      $('fgN').oninput = function () { pend.note = this.value; };
      $('fgBt').onclick = pendClear;
      $('fgSv').onclick = KM.pendSave;
    }
  }
  var tg = KM.toggleFill;
  KM.toggleFill = function () { var r = tg.apply(this, arguments); if (!KM.fillTap) fgArea = false; sync(); return r; };
  var s0 = KM.sync; KM.sync = function () { var r = s0 && s0.apply(this, arguments); sync(); return r; };
  var sm = KM.setMode; if (sm) KM.setMode = function () { var r = sm.apply(this, arguments); if (KM.mode !== 'kategori') fgArea = false; sync(); return r; };
  // ---- ubah gaya satu tanda (+ kembalikan gaya asli)
  BR.gaya = function (it, back) {
    var g0 = it.gy ? clone(it.gy) : {}, cc = it.cat ? HA.tandaCatOf(it.cat) : null, st = { m: g0.m || '', w: g0.w || 0, col: g0.col || '' }, lastW = +S.settings.gyLastW || 0;
    if (!st.w && lastW) st.w = lastW; // tebal tepi terakhir yang dipakai terisi otomatis (berlaku setelah Terapkan)
    function html() {
      var e = HA.gyOf(it);
      return '<div class="grab"></div><div class="bth"><div class="st">GAYA TANDA</div><button class="btn" id="gyX">Batal</button></div>' +
        '<div class="fgR"><span>Gaya</span><div class="seg" id="gyM"><button data-v=""' + (!st.m ? ' class="on"' : '') + '>Ikut kategori</button><button data-v="isi"' + (st.m === 'isi' ? ' class="on"' : '') + '>Isi</button><button data-v="tepi"' + (st.m === 'tepi' ? ' class="on"' : '') + '>Garis tepi</button></div></div>' +
        '<div class="fgR"><span>Tebal tepi</span><input type="number" id="gyW" min="1" max="12" step="1" value="' + (st.w || '') + '" placeholder="kategori"></div>' +
        '<div class="fgR"><span>Warna</span><input type="color" id="gyC" value="' + (st.col || e.col) + '"><button type="button" class="btn" id="gyC0">Ikut kategori</button></div>' +
        '<div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="gyOrg" style="flex:1"' + (it.gy0 !== undefined || it.gy ? '' : ' disabled') + '>Kembalikan gaya asli</button><button class="btn pri" id="gyY" style="flex:1">Terapkan</button></div>';
    }
    function draw() {
      HA.openSheet(html()); HA.onSheetClose = back;
      $('gyX').onclick = function () { HA.closeSheet(); };
      $('gyM').onclick = function (ev) { var b = ev.target.closest('button[data-v]'); if (b) { st.m = b.getAttribute('data-v'); keep(); draw(); } };
      $('gyW').onchange = function () { var v = Math.round(parseFloat(this.value)); st.w = isFinite(v) ? Math.max(1, Math.min(12, v)) : 0; keep(); };
      $('gyC').onchange = function () { st.col = this.value; keep(); };
      $('gyC0').onclick = function () { st.col = ''; keep(); draw(); };
      $('gyOrg').onclick = function () {
        if (it.gy0) it.gy = clone(it.gy0); else delete it.gy;
        it.mod = Date.now(); HA.tandaSave(); if (KM.sync) KM.sync(); HA.onSheetClose = null; HA.toast('Gaya asli dikembalikan'); back();
      };
      $('gyY').onclick = function () {
        BR.confirmChange('Gaya tanda diubah.', function () {
          var o = {}; if (st.m) o.m = st.m; if (st.w) { o.w = st.w; S.settings.gyLastW = st.w; HA.saveSettings(); } if (st.col) o.col = st.col;
          if (it.gy0 === undefined) it.gy0 = it.gy ? clone(it.gy) : null; // simpan keadaan sebelum diubah pertama kali
          if (o.m || o.w || o.col) it.gy = o; else delete it.gy;
          it.mod = Date.now(); HA.tandaSave(); if (KM.sync) KM.sync(); HA.onSheetClose = null; back();
        }, function () { draw(); });
      };
    }
    function keep() { /* nilai disimpan di st sampai Terapkan */ }
    draw();
  };
})();
