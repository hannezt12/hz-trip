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
  // ---- detail satu tanda
  function detail(it, back) {
    var U = HA.tandaU, inf = HA.tandaCatInfo(it), sn = subName(it);
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">TANDA · ' + esc(inf.name) + (sn ? ' / ' + esc(sn) : '') + '</div><button class="btn pri" id="rdOk">Kembali</button></div>' +
      '<div class="muted" style="margin:4px 0 10px">' + U.d8(U.dateOf(it)) + ' · ' + statTxt(it) + '</div>' +
      '<div class="rdG"><button class="btn" id="rdLh">Lihat di peta</button><button class="btn" id="rdKt">Ubah kategori</button><button class="btn" id="rdTg">Ubah tanggal</button><button class="btn" id="rdDl" style="color:var(--r)">Hapus tanda ini</button></div>');
    HA.onSheetClose = back;
    $('rdOk').onclick = function () { HA.closeSheet(); };
    $('rdLh').onclick = function () { lihat(it); };
    $('rdKt').onclick = function () { pickCat(it, function () { detail(it, back); }); };
    $('rdTg').onclick = function () { pickDate(it, function () { detail(it, back); }); };
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
        it.cat = e.getAttribute('data-c'); it.sub = e.getAttribute('data-s') || null; it.mod = Date.now();
        persist(); HA.onSheetClose = null; back();
      };
    });
  }
  function pickDate(it, back) {
    var U = HA.tandaU;
    HA.openSheet('<div class="grab"></div><div class="st">UBAH TANGGAL</div><label class="calL" style="margin-top:8px">Tanggal tanda<input type="date" id="pdD" max="' + HA.S.today + '" value="' + U.dateOf(it) + '"></label><div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="pdX" style="flex:1">Batal</button><button class="btn pri" id="pdY" style="flex:1">Simpan</button></div>');
    HA.onSheetClose = back;
    $('pdX').onclick = function () { HA.closeSheet(); };
    $('pdY').onclick = function () {
      var v = $('pdD').value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > HA.S.today) { HA.toast('Tanggal tidak valid'); return; }
      it.date = v; it.mod = Date.now(); persist(); HA.onSheetClose = null; back();
    };
  }
  // ---- daftar riwayat blok
  BR.open = function (b, onClose) {
    var key = String(b.id);
    function render() {
      var U = HA.tandaU, all = HA.BT.itemsOf(b).slice();
      all.sort(function (x, y) { var a = U.dateOf(x), c = U.dateOf(y); return a < c ? 1 : a > c ? -1 : (y.ts || 0) - (x.ts || 0); });
      var cats = {}, ord = [];
      all.forEach(function (it) { var k = HA.tandaCatKey(it); if (!cats[k]) { var inf = HA.tandaCatInfo(it); cats[k] = { k: k, name: inf.name, col: inf.col, n: 0, last: '' }; ord.push(cats[k]); } var c = cats[k]; c.n++; var d = U.dateOf(it); if (d > c.last) c.last = d; });
      if (filt[key] && !cats[filt[key]]) filt[key] = null;
      var f = filt[key], list = f ? all.filter(function (it) { return HA.tandaCatKey(it) === f; }) : all;
      var sum = ord.map(function (c) { return '<div class="rbS"><i style="background:' + c.col + '"></i><span>' + esc(c.name) + ' ' + c.n + '× · terakhir ' + U.d8(c.last) + '</span></div>'; }).join('');
      var chips = ord.length > 1 ? '<div class="rbC"><button type="button" data-k=""' + (!f ? ' class="on"' : '') + '>Semua</button>' + ord.map(function (c) { return '<button type="button" data-k="' + esc(c.k) + '"' + (f === c.k ? ' class="on"' : '') + '>' + esc(c.name) + '</button>'; }).join('') + '</div>' : '';
      var rows = list.map(function (it, i) {
        var inf = HA.tandaCatInfo(it), sn = subName(it);
        return '<div class="rbR" data-i="' + i + '"><i style="background:' + inf.col + '"></i><div class="rbT"><b>' + esc(inf.name) + (sn ? ' / ' + esc(sn) : '') + '</b><small>' + U.d8(U.dateOf(it)) + ' · ' + statTxt(it) + '</small></div><span class="rbG" aria-hidden="true">›</span></div>';
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
