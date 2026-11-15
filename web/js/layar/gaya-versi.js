/* HZ Trip v0.16.4 - Panel gaya Ketuk isi, ubah gaya tanda (gaya asli tersimpan), versi simpanan per blok */
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
    return '<div class="fgH"><b>Ketuk isi</b><button type="button" id="fgX" aria-label="Tutup">✕</button></div>' +
      '<div class="fgR"><span>Cakupan</span><div class="seg" id="fgSc"><button data-v="blok"' + (!fgArea ? ' class="on"' : '') + '>Blok penuh</button><button data-v="area"' + (fgArea ? ' class="on"' : '') + '>Area gambar</button></div></div>' +
      '<div class="fgR"><span>Gaya</span><div class="seg" id="fgM"><button data-v=""' + (!g.m ? ' class="on"' : '') + '>Ikut kategori</button><button data-v="isi"' + (g.m === 'isi' ? ' class="on"' : '') + '>Isi</button><button data-v="tepi"' + (g.m === 'tepi' ? ' class="on"' : '') + '>Garis tepi</button></div></div>' +
      '<div class="fgR"><span>Tebal tepi</span><input type="number" id="fgW" min="1" max="12" step="1" value="' + (g.w || '') + '" placeholder="kategori"><span>Warna</span><input type="color" id="fgC" value="' + (g.col || base) + '"><button type="button" class="btn" id="fgC0">Ikut kategori</button></div>' +
      (fgArea ? '<div class="muted fgT">Gambar area dengan tombol Ukur (Alat peta). Bagian di dalam blok jadi tanda dengan gaya ini.</div>' : '<div class="muted fgT">Ketuk blok untuk menandainya. Gaya bisa diganti kapan saja; tanda lama diubah lewat Riwayat blok.</div>');
  }
  function sync() {
    var wrap = $('mapWrap') || document.body, e = $('fgPanel');
    if (!visible()) { if (e) e.style.display = 'none'; return; }
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
    $('fgW').onchange = function () { var v = Math.round(parseFloat(this.value)); g.w = isFinite(v) ? Math.max(1, Math.min(12, v)) : 0; HA.saveSettings(); sync(); };
    $('fgC').onchange = function () { g.col = this.value; HA.saveSettings(); };
    $('fgC0').onclick = function () { g.col = null; HA.saveSettings(); sync(); };
  }
  var tg = KM.toggleFill;
  KM.toggleFill = function () { var r = tg.apply(this, arguments); if (!KM.fillTap) fgArea = false; sync(); return r; };
  var s0 = KM.sync; KM.sync = function () { var r = s0 && s0.apply(this, arguments); sync(); return r; };
  var sm = KM.setMode; if (sm) KM.setMode = function () { var r = sm.apply(this, arguments); if (KM.mode !== 'kategori') fgArea = false; sync(); return r; };
  // ---- ubah gaya satu tanda (+ kembalikan gaya asli)
  BR.gaya = function (it, back) {
    var g0 = it.gy ? clone(it.gy) : {}, cc = it.cat ? HA.tandaCatOf(it.cat) : null, st = { m: g0.m || '', w: g0.w || 0, col: g0.col || '' };
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
        var o = {}; if (st.m) o.m = st.m; if (st.w) o.w = st.w; if (st.col) o.col = st.col;
        if (it.gy0 === undefined) it.gy0 = it.gy ? clone(it.gy) : null; // simpan keadaan sebelum diubah pertama kali
        if (o.m || o.w || o.col) it.gy = o; else delete it.gy;
        it.mod = Date.now(); HA.tandaSave(); if (KM.sync) KM.sync(); HA.onSheetClose = null; back();
      };
    }
    function keep() { /* nilai disimpan di st sampai Terapkan */ }
    draw();
  };
  // ---- versi simpanan per blok (maks 10 manual; hapus satu per satu)
  function vers() { var d = HA.tandaData(); return d.vers || (d.vers = []); }
  function snap(b, name, auto) {
    var items = HA.BT.itemsOf(b).map(clone);
    vers().push({ id: 'v' + Date.now() + Math.floor(Math.random() * 99), bid: String(b.id), bn: String(b.name || ''), name: name, ts: Date.now(), auto: !!auto, items: items });
    HA.tandaSave();
  }
  BR.versi = function (b, back) {
    function mine() { return vers().filter(function (v) { return v.bid === String(b.id); }).sort(function (x, y) { return y.ts - x.ts; }); }
    function fmt(ts) { var d = new Date(ts), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
    function draw() {
      var l = mine();
      HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">VERSI · ' + esc(b.name) + '</div><button class="btn pri" id="vrOk">Kembali</button></div>' +
        '<div class="muted" style="margin:4px 0 8px">Salinan tanda blok ini pada suatu saat (maks 10 manual). Pulihkan mengembalikan tanda blok ke versi itu; kondisi sekarang disimpan otomatis dulu.</div>' +
        '<div class="rbL">' + (l.length ? l.map(function (v, i) { return '<div class="rbR vrR" data-i="' + i + '"><div class="rbT"><b>' + esc(v.name) + '</b><small>' + fmt(v.ts) + ' · ' + v.items.length + ' tanda' + (v.auto ? ' · otomatis' : '') + '</small></div><button class="btn" data-p="' + i + '">Pulihkan</button><button class="btn" data-d="' + i + '" style="color:var(--r)">Hapus</button></div>'; }).join('') : '<div class="muted" style="padding:10px 2px">Belum ada versi tersimpan.</div>') + '</div>' +
        '<div class="row" style="gap:8px;margin-top:10px"><input type="text" id="vrN" maxlength="40" placeholder="Nama versi (mis. Sebelum geser)" style="flex:1"><button class="btn pri" id="vrS">Simpan versi</button></div>');
      HA.onSheetClose = back || null;
      $('vrOk').onclick = function () { HA.closeSheet(); };
      $('vrS').onclick = function () {
        var n = $('vrN').value.trim(); if (!n) { HA.toast('Isi nama versi'); return; }
        if (mine().filter(function (v) { return !v.auto; }).length >= 10) { HA.toast('Sudah 10 versi, hapus satu dulu'); return; }
        snap(b, n, false); var h = HA.onSheetClose; draw(); HA.onSheetClose = h; HA.toast('Versi tersimpan');
      };
      $('sheet').querySelectorAll('[data-p]').forEach(function (e) { e.onclick = function () {
        var v = mine()[+e.getAttribute('data-p')]; if (!v) return;
        var h = HA.onSheetClose; HA.onSheetClose = null;
        HA.askConfirm('Pulihkan versi "' + v.name + '"?', 'Tanda blok ' + b.name + ' dikembalikan ke ' + v.items.length + ' tanda pada ' + fmt(v.ts) + '. Kondisi sekarang disimpan otomatis dulu.', 'Pulihkan', function () {
          snap(b, 'Sebelum pulihkan ' + fmt(Date.now()), true);
          var d = HA.tandaData(), cur0 = {}; HA.BT.itemsOf(b).forEach(function (it) { cur0[it.id] = 1; });
          d.items = d.items.filter(function (it) { return !cur0[it.id]; });
          v.items.forEach(function (it) { d.items.push(clone(it)); });
          HA.tandaSave(); if (KM.sync) KM.sync(); HA.toast('Versi dipulihkan'); draw(); HA.onSheetClose = h;
        });
        var cn = $('cfNo'); if (cn) cn.onclick = function () { draw(); HA.onSheetClose = h; };
      }; });
      $('sheet').querySelectorAll('[data-d]').forEach(function (e) { e.onclick = function () {
        var v = mine()[+e.getAttribute('data-d')]; if (!v) return;
        var h = HA.onSheetClose; HA.onSheetClose = null;
        HA.askConfirm('Hapus versi?', v.name + '. Hanya salinan ini yang dihapus, tanda blok tidak berubah.', 'Hapus', function () {
          var d = HA.tandaData(); d.vers = (d.vers || []).filter(function (z) { return z.id !== v.id; }); HA.tandaSave(); draw(); HA.onSheetClose = h;
        });
        var cn = $('cfNo'); if (cn) cn.onclick = function () { draw(); HA.onSheetClose = h; };
      }; });
    }
    draw();
  };
})();
