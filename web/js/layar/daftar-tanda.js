// Daftar semua marking: satu baris per blok, kategori, dan tanggal; centang, cari, preview, bagikan
(function () {
  'use strict';
  var HA = window.HzApp, BT = HA && HA.BT; if (!BT) return;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  var LS = { sel: {}, q: '', off: {}, back: false, fold: {}, init: false }, all = [], byKey = {};
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
    if ($('lsDl')) { $('lsDl').disabled = !nr; $('lsDl').textContent = nr ? 'Hapus ' + nr : 'Hapus'; }
    var v = all.filter(vis), c = v.filter(function (r) { return LS.sel[r.key]; }).length;
    if ($('lsAll')) { $('lsAll').checked = !!v.length && c === v.length; $('lsAll').indeterminate = c > 0 && c < v.length; }
    if ($('lsCnt')) $('lsCnt').textContent = nr ? nr + ' baris dipilih' : v.length + ' baris';
  }
  function paint() {
    var U = HA.tandaU, v = all.filter(vis), h = '';
    if (!all.length) { $('lsBody').innerHTML = '<div class="card muted">Belum ada tanda di blok terkonfirmasi.</div>'; foot(); return; }
    if (!v.length) { $('lsBody').innerHTML = '<div class="card muted">Tidak ada yang cocok.</div>'; foot(); return; }
    var dates = [], by = {};
    v.forEach(function (r) { if (!by[r.d]) { by[r.d] = []; dates.push(r.d); } by[r.d].push(r); });
    if (!LS.init) { LS.init = true; dates.forEach(function (d, i) { LS.fold[d] = i !== 0; }); } // bawaan: hanya tanggal terbaru terbuka
    var srch = !!norm(LS.q);
    dates.forEach(function (d) {
      var cnt = by[d], allOn = cnt.every(function (x) { return LS.sel[x.key]; }), nSel = cnt.filter(function (x) { return LS.sel[x.key]; }).length, cols = [], seen = {};
      cnt.forEach(function (x) { if (!seen[x.k]) { seen[x.k] = 1; cols.push(x.col); } });
      var shut = LS.fold[d] && !srch;
      h += '<div class="lsD"><input type="checkbox" data-d="' + d + '"' + (allOn ? ' checked' : '') + ' aria-label="Pilih semua tanggal ini"><button type="button" class="lsF" data-f="' + d + '" aria-expanded="' + (shut ? 'false' : 'true') + '"><span class="lsAr">' + (shut ? '\u25B8' : '\u25BE') + '</span><b>' + dayName(d) + ' ' + U.d8(d) + '</b><span class="lsDots">' + cols.slice(0, 6).map(function (c) { return '<i class="tdd" style="background:' + c + '"></i>'; }).join('') + (cols.length > 6 ? '<small>+' + (cols.length - 6) + '</small>' : '') + '</span><span class="muted lsN">' + (nSel ? nSel + '/' : '') + cnt.length + '</span></button></div>';
      if (shut) return;
      cnt.forEach(function (r) {
        h += '<label class="lsR"><input type="checkbox" data-k="' + esc(r.key) + '"' + (LS.sel[r.key] ? ' checked' : '') + '><i class="tdd" style="background:' + r.col + '"></i><span class="lsT"><b>' + esc(String(r.b.name)) + '</b> <span class="muted">' + esc(r.name) + '</span><br><span class="lsS">' + esc(line(r)) + '</span></span><button type="button" class="lsO" data-o="' + esc(r.key) + '" aria-label="Buka blok">\u203A</button></label>';
      });
    });
    $('lsBody').innerHTML = h; foot();
  }
  function inLintasan() { var v = document.getElementById('v-lintasan'); return !!(v && v.classList.contains('on') && HA.map); }
  function showBlock(b) {
    LS.back = false; HA.closeSheet();
    var m = HA.map; try { m.fitBounds(L.polygon(b.pts).getBounds(), { padding: [40, 40], maxZoom: 19 }); } catch (e) {}
    if (HA.openBlockPop) HA.openBlockPop(b);
  }
  function openBlock(b) { if (inLintasan()) { showBlock(b); return; } LS.back = true; HA.closeSheet(); BT.pick(b, true); }
  function open() {
    all = rows(); byKey = {}; all.forEach(function (r) { byKey[r.key] = r; });
    Object.keys(LS.sel).forEach(function (k) { if (!byKey[k]) delete LS.sel[k]; });
    var cs = {}, co = [];
    all.forEach(function (r) { if (!cs[r.k]) { cs[r.k] = { k: r.k, name: r.name, col: r.col, n: 0 }; co.push(cs[r.k]); } cs[r.k].n++; });
    HA.openSheet('<div class="grab"></div><div class="lsTop"><div class="st">DAFTAR TANDA</div><input type="search" id="lsQ" placeholder="Cari no blok, kategori, tanggal" value="' + esc(LS.q) + '" autocomplete="off">' +
      '<div class="lsCh" id="lsCh">' + co.map(function (c) { return '<label class="lsC"><input type="checkbox" data-c="' + esc(c.k) + '"' + (LS.off[c.k] ? '' : ' checked') + '><i style="background:' + c.col + '"></i>' + esc(c.name) + '</label>'; }).join('') + '</div>' +
      '<label class="lsA"><input type="checkbox" id="lsAll"> Pilih semua yang tampil <span class="muted" id="lsCnt"></span></label></div>' +
      '<div id="lsBody"></div>' +
      '<div class="lsFoot"><button class="btn" id="lsPv" disabled>Preview</button><button class="btn pri" id="lsGo" disabled>Bagikan</button><button class="btn lsDel" id="lsDl" disabled>Hapus</button></div>' +
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
    $('lsBody').onclick = function (e) { var f = e.target.closest && e.target.closest('[data-f]'); if (f) { var d = f.getAttribute('data-f'); LS.fold[d] = !LS.fold[d]; paint(); return; } var o = e.target.closest && e.target.closest('[data-o]'); if (!o) return; e.preventDefault(); var r = byKey[o.getAttribute('data-o')]; if (r) openBlock(r.b); };
    $('lsPv').onclick = preview;
    $('lsDl').onclick = function () {
      var rs = all.filter(function (r) { return LS.sel[r.key]; }); if (!rs.length) return;
      var want = {}, nt = 0, bl = {}, cats = {}, ds = {}; rs.forEach(function (r) { want[r.key] = r; });
      var items = HA.tandaData().items, del = [];
      rs.forEach(function (r) { BT.itemsOf(r.b).forEach(function (it) { if (HA.tandaCatKey(it) === r.k && HA.tandaU.dateOf(it) === r.d && del.indexOf(it.id) < 0) del.push(it.id); }); bl[r.b.id] = 1; cats[r.name] = 1; ds[r.d] = 1; });
      var dl = Object.keys(ds).sort(), dtxt = dl.length === 1 ? HA.tandaU.d8(dl[0]) : dl.length + ' tanggal', ct = Object.keys(cats), ctxt = ct.slice(0, 3).join(', ') + (ct.length > 3 ? ' dan ' + (ct.length - 3) + ' lainnya' : '');
      HA.askConfirm('Hapus ' + del.length + ' tanda?', del.length + ' tanda di ' + Object.keys(bl).length + ' blok (' + ctxt + ', ' + dtxt + ') akan dihapus. Tidak bisa dibatalkan.', 'Hapus', function () {
        var d = HA.tandaData(); d.items = d.items.filter(function (it) { return del.indexOf(it.id) < 0; });
        HA.tandaSave(); LS.sel = {}; HA.toast(del.length + ' tanda dihapus'); if (HA.KM && HA.KM.sync) HA.KM.sync(); if (HA.BT && HA.BT.refresh) HA.BT.refresh(); open();
      });
      var cn = $('cfNo'); if (cn) cn.onclick = function () { open(); };
    };
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
          { label: inLintasan() ? 'Lihat blok ini' : 'Edit blok ini', fn: function (i) { if (inLintasan()) { HA.closeSheet(); showBlock(pg[i].blk); } else { LS.back = true; HA.closeSheet(); BT.pick(pg[i].blk, true); } } },
          { label: 'Keluarkan', fn: function (i) { var id = pg[i].blk.id; all.forEach(function (r) { if (r.b.id === id) LS.sel[r.key] = false; }); if (selData().blks.length) preview(); else open(); } }
        ]
      });
    }).catch(function () { HA.toast('Gagal menyusun preview'); });
  }
  BT.listOpen = open;
  BT.onLeave = function () { LS.sel = {}; LS.q = ''; LS.off = {}; LS.back = false; LS.fold = {}; LS.init = false; };
  BT.afterDeselect = function () {
    if (!LS.back) return;
    setTimeout(function () { if (!LS.back) return; LS.back = false; if (!BT.curBlock || !BT.curBlock()) open(); }, 120);
  };
})();
