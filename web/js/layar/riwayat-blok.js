/* HZ Trip v0.16.2 - Riwayat blok: daftar tanda (kategori, tanggal) yang berada di satu blok */
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
        return '<div class="rbR" data-i="' + i + '"><i style="background:' + inf.col + '"></i><div class="rbT"><b>' + esc(inf.name) + (sn ? ' / ' + esc(sn) : '') + '</b><small>' + U.d8(U.dateOf(it)) + ' · ' + statTxt(it) + '</small></div><button type="button" class="rbX" data-x="' + i + '" aria-label="Hapus tanda">Hapus</button></div>';
      }).join('');
      HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">RIWAYAT · ' + esc(b.name) + '</div><button class="btn pri" id="rbOk">Tutup</button></div>' +
        (ord.length ? sum + chips + '<div class="rbL">' + rows + '</div>' : '<div class="muted" style="padding:12px 2px">Belum ada riwayat. Tanda yang disimpan di blok ini akan muncul di sini.</div>'));
      HA.onSheetClose = onClose || null;
      $('rbOk').onclick = function () { HA.closeSheet(); };
      var sh = $('sheet');
      sh.querySelectorAll('.rbC button').forEach(function (e) { e.onclick = function () { filt[key] = e.getAttribute('data-k') || null; var h = HA.onSheetClose; render(); HA.onSheetClose = h; }; });
      sh.querySelectorAll('.rbR').forEach(function (e) {
        e.onclick = function (ev) {
          var x = ev.target.closest && ev.target.closest('[data-x]');
          var it = list[+e.getAttribute('data-i')]; if (!it) return;
          if (x) {
            HA.onSheetClose = null;
            HA.askConfirm('Hapus tanda ini?', esc2(HA.tandaCatInfo(it).name) + ' · ' + U.d8(U.dateOf(it)) + '. Hanya tanda ini yang dihapus.', 'Hapus', function () {
              var d = HA.tandaData(); d.items = d.items.filter(function (z) { return z.id !== it.id; }); HA.tandaSave();
              if (HA.KM && HA.KM.sync) HA.KM.sync(); render(); HA.onSheetClose = onClose || null;
            });
            var cn = $('cfNo'); if (cn) cn.onclick = function () { render(); HA.onSheetClose = onClose || null; };
            return;
          }
          lihat(it);
        };
      });
    }
    function esc2(t) { return String(t); }
    render();
  };
})();
