// Daftar semua marking: satu baris per blok, kategori, dan tanggal; centang, cari, preview, bagikan
(function () {
  'use strict';
  var HA = window.HzApp, BT = HA && HA.BT; if (!BT) return;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  var LS = { sel: {}, q: '', off: {}, back: false }, all = [], byKey = {};
  var coll = new Intl.Collator('id', { numeric: true }), HR = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ''); }
  function dayName(iso) { var a = iso.split('-'); return HR[new Date(+a[0], +a[1] - 1, +a[2]).getDay()]; }

  function rows() {
    var map = {}, out = [], U = HA.tandaU;
    BT.blocks().forEach(function (b) {
      BT.itemsOf(b).forEach(function (it) {
        var k = HA.tandaCatKey(it), d = U.dateOf(it), key = b.id + '|' + k + '|' + d, r = map[key];
        if (!r) { var inf = HA.tandaCatInfo(it); r = map[key] = { key: key, b: b, k: k, d: d, name: inf.name, col: inf.col, ha: 0, lm: 0, m: 0, pt: 0, n: 0 }; out.push(r); }
        r.n++; var st = HA.tandaStat(it);
        if (it.t === 'pt') r.pt++; else if (it.t === 'ln') r.m += st.m; else { r.ha += st.ha; r.lm += st.lm; }
      });
    });
    out.sort(function (x, y) { return x.d < y.d ? 1 : (x.d > y.d ? -1 : (coll.compare(String(x.b.name), String(y.b.name)) || coll.compare(x.name, y.name))); });
    return out;
  }
  function line(r) {
    var U = HA.tandaU, a = [];
    if (r.ha) a.push(U.ha(r.ha) + ' ha');
    if (r.lm) a.push(U.ribu(r.lm) + ' m lajur');
    if (r.m) a.push(U.ribu(r.m) + ' m garis');
    if (r.pt) a.push(r.pt + ' titik');
    return a.join(' · ') || '-';
  }
  function vis(r) {
    if (LS.off[r.k]) return false;
    var q = norm(LS.q); if (!q) return true;
    var U = HA.tandaU, hay = norm(r.b.name + ' ' + r.name + ' ' + U.d8(r.d) + ' ' + r.d + ' ' + dayName(r.d));
    return hay.indexOf(q) >= 0;
  }
  function selData() {
    var pre = {}, blks = [], seen = {};
    all.forEach(function (r) {
      if (!LS.sel[r.key]) return;
      var id = r.b.id; if (!pre[id]) pre[id] = {};
      (pre[id][r.k] = pre[id][r.k] || {})[r.d] = 1;
      if (!seen[id]) { seen[id] = 1; blks.push(r.b); }
    });
    blks.sort(function (a, b) { return coll.compare(String(a.name), String(b.name)); });
    return { pre: pre, blks: blks };
  }
  function foot() {
    var s = selData(), n = s.blks.length, nr = 0; Object.keys(LS.sel).forEach(function (k) { if (LS.sel[k]) nr++; });
    if ($('lsPv')) { $('lsPv').disabled = !n; $('lsPv').textContent = n ? 'Preview ' + n + ' blok' : 'Preview'; }
    if ($('lsGo')) { $('lsGo').disabled = !n; $('lsGo').textContent = n ? 'Bagikan ' + n + ' blok' : 'Bagikan'; }
    var v = all.filter(vis), c = v.filter(function (r) { return LS.sel[r.key]; }).length;
    if ($('lsAll')) { $('lsAll').checked = !!v.length && c === v.length; $('lsAll').indeterminate = c > 0 && c < v.length; }
    if ($('lsCnt')) $('lsCnt').textContent = nr ? nr + ' baris dipilih' : v.length + ' baris';
  }
  function paint() {
    var U = HA.tandaU, v = all.filter(vis), h = '', last = null, grp = [];
    if (!all.length) { $('lsBody').innerHTML = '<div class="card muted">Belum ada tanda di blok terkonfirmasi.</div>'; foot(); return; }
    if (!v.length) { $('lsBody').innerHTML = '<div class="card muted">Tidak ada yang cocok.</div>'; foot(); return; }
    v.forEach(function (r) {
      if (r.d !== last) { last = r.d; var cnt = v.filter(function (x) { return x.d === r.d; }), allOn = cnt.every(function (x) { return LS.sel[x.key]; }); h += '<label class="lsD"><input type="checkbox" data-d="' + r.d + '"' + (allOn ? ' checked' : '') + '><b>' + dayName(r.d) + ' ' + U.d8(r.d) + '</b><span class="muted">' + cnt.length + ' baris</span></label>'; }
      h += '<label class="lsR"><input type="checkbox" data-k="' + esc(r.key) + '"' + (LS.sel[r.key] ? ' checked' : '') + '><i class="tdd" style="background:' + r.col + '"></i><span class="lsT"><b>' + esc(String(r.b.name)) + '</b> <span class="muted">' + esc(r.name) + '</span><br><span class="lsS">' + esc(line(r)) + '</span></span><button type="button" class="lsO" data-o="' + esc(r.key) + '" aria-label="Buka blok">›</button></label>';
    });
    $('lsBody').innerHTML = h; foot();
  }
  function openBlock(b) { LS.back = true; HA.closeSheet(); BT.pick(b, true); }
  function open() {
    all = rows(); byKey = {}; all.forEach(function (r) { byKey[r.key] = r; });
    Object.keys(LS.sel).forEach(function (k) { if (!byKey[k]) delete LS.sel[k]; });
    var cs = {}, co = [];
    all.forEach(function (r) { if (!cs[r.k]) { cs[r.k] = { k: r.k, name: r.name, col: r.col, n: 0 }; co.push(cs[r.k]); } cs[r.k].n++; });
    HA.openSheet('<div class="grab"></div><div class="lsTop"><div class="st">DAFTAR MARKING</div><input type="search" id="lsQ" placeholder="Cari no blok, kategori, tanggal" value="' + esc(LS.q) + '" autocomplete="off">' +
      '<div class="lsCh" id="lsCh">' + co.map(function (c) { return '<label class="lsC"><input type="checkbox" data-c="' + esc(c.k) + '"' + (LS.off[c.k] ? '' : ' checked') + '><i style="background:' + c.col + '"></i>' + esc(c.name) + '</label>'; }).join('') + '</div>' +
      '<label class="lsA"><input type="checkbox" id="lsAll"> Pilih semua yang tampil <span class="muted" id="lsCnt"></span></label></div>' +
      '<div id="lsBody"></div>' +
      '<div class="lsFoot"><button class="btn" id="lsPv" disabled>Preview</button><button class="btn pri" id="lsGo" disabled>Bagikan</button></div>' +
      '<button class="btn" id="lsX" style="width:100%;margin-top:8px">Tutup</button>');
    paint();
    $('lsQ').oninput = function () { LS.q = this.value; paint(); };
    $('lsCh').onchange = function (e) { var k = e.target.getAttribute('data-c'); if (k) { LS.off[k] = !e.target.checked; paint(); } };
    $('lsAll').onchange = function () { var on = this.checked; all.filter(vis).forEach(function (r) { LS.sel[r.key] = on; }); paint(); };
    $('lsBody').onchange = function (e) {
      var k = e.target.getAttribute('data-k'), d = e.target.getAttribute('data-d');
      if (k) LS.sel[k] = e.target.checked;
      else if (d) all.filter(vis).forEach(function (r) { if (r.d === d) LS.sel[r.key] = e.target.checked; });
      else return;
      paint();
    };
    $('lsBody').onclick = function (e) { var o = e.target.closest && e.target.closest('[data-o]'); if (!o) return; e.preventDefault(); var r = byKey[o.getAttribute('data-o')]; if (r) openBlock(r.b); };
    $('lsPv').onclick = preview;
    $('lsGo').onclick = function () { var s = selData(); if (!s.blks.length) return; BT.share(s.blks, s.pre); HA.onSheetClose = function () { setTimeout(open, 60); }; };
    $('lsX').onclick = HA.closeSheet;
  }
  function preview() {
    var s = selData(); if (!s.blks.length) return;
    HA.toast('Menyusun preview…');
    var groups = s.blks.map(function (b) { return { title: '', items: BT.selItems(b, s.pre), blk: b }; }), meta = {}, SH = BT.SH;
    var names = []; groups.forEach(function (g) { BT.catNamesOf(g.items).forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); }); });
    BT.buildPdf(groups, { nama: SH.nama, nilai: SH.nilai, fs: SH.fs, summary: groups.length > 1, meta: meta }).then(function (bytes) {
      var off = meta.sumPages || 0, pg = meta.pages || [], labs = (off ? ['Ringkasan'] : []).concat(pg.map(function (p) { return String(p.blk.name) + (p.cat ? ' \u00B7 ' + p.cat : ''); }));
      HA.pdfPreview(bytes, function () { HA.saveFile(BT.fileName(groups.length, names, 'pdf', true), btoa(bytes), 'application/pdf'); }, {
        labels: labs, off: off, go: 'Cetak PDF', onBack: function () { open(); },
        actions: [
          { label: 'Edit blok ini', fn: function (i) { LS.back = true; HA.closeSheet(); BT.pick(pg[i].blk, true); } },
          { label: 'Keluarkan', fn: function (i) { var id = pg[i].blk.id; all.forEach(function (r) { if (r.b.id === id) LS.sel[r.key] = false; }); if (selData().blks.length) preview(); else open(); } }
        ]
      });
    }).catch(function () { HA.toast('Gagal menyusun preview'); });
  }
  BT.listOpen = open;
  BT.onLeave = function () { LS.sel = {}; LS.q = ''; LS.off = {}; LS.back = false; };
  BT.afterDeselect = function () {
    if (!LS.back) return;
    setTimeout(function () { if (!LS.back) return; LS.back = false; if (!BT.curBlock || !BT.curBlock()) open(); }, 120);
  };
})();
