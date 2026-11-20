/* HZ Trip - Tanda titik (v0.19.2): ikon = pola + warna + huruf, label huruf.angka, nomor per blok.
 * Terpisah dari Kategori. Data: S.settings.ttk (tanda), S.settings.ikon (ikon aktif), S.settings.ikonH (huruf per pola+warna). */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S, LAY = null;
  var PATS = [['bulat', 'Bulat'], ['kotak', 'Kotak'], ['segitiga', 'Segitiga'], ['belah', 'Belah ketupat'], ['enam', 'Segi enam']];
  var CLRS = ['#FF5A4D', '#FF8A3D', '#FFD84D', '#35D07F', '#3DD6D0', '#4DA3FF', '#C77DFF', '#FF5A8A', '#FFFFFF', '#2B3A42'];
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function ik() { return S.settings.ikon || (S.settings.ikon = { on: false, p: 'bulat', c: CLRS[0], h: 'A' }); }
  function hm() { return S.settings.ikonH || (S.settings.ikonH = {}); }
  function arr() { return S.settings.ttk || (S.settings.ttk = []); }
  function lab(t) { return t.h + '.' + t.no; }
  function ink(hex) { var h = String(hex).replace('#', ''); if (h.length !== 6) return '#fff'; var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#06202B' : '#fff'; }
  function svg(p, c, txt, sz) {
    var sh = { bulat: '<circle cx="16" cy="16" r="13"', kotak: '<rect x="4" y="4" width="24" height="24" rx="4"', segitiga: '<polygon points="16,3 30,28 2,28"', belah: '<polygon points="16,2 30,16 16,30 2,16"', enam: '<polygon points="16,2 28,9 28,23 16,30 4,23 4,9"' }[p] || '<circle cx="16" cy="16" r="13"';
    return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 32 32">' + sh + ' fill="' + c + '" stroke="#06202B" stroke-width="2"/><text x="16" y="' + (p === 'segitiga' ? 24 : 20) + '" text-anchor="middle" font-size="' + (String(txt).length > 3 ? 9 : 11) + '" font-weight="800" fill="' + ink(c) + '" font-family="sans-serif">' + esc(txt) + '</text></svg>';
  }
  function unusedLetter(skip) {
    var used = {}, k; for (k in hm()) if (k !== skip) used[hm()[k]] = 1;
    for (var i = 0; i < 26; i++) { var L1 = String.fromCharCode(65 + i); if (!used[L1]) return L1; }
    return 'A';
  }
  function edgeD(b, p) {
    var kx = 111320 * Math.cos(p[0] * Math.PI / 180), ky = 110540, xy = b.pts.map(function (q) { return [(q[1] - p[1]) * kx, (q[0] - p[0]) * ky]; }), best = Infinity, n = xy.length, i;
    for (i = 0; i < n; i++) { var a = xy[i], c = xy[(i + 1) % n], dx = c[0] - a[0], dy = c[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((-a[0]) * dx + (-a[1]) * dy) / l2)) : 0; best = Math.min(best, Math.hypot(a[0] + t * dx, a[1] + t * dy)); }
    return best;
  }
  function nextNo(bid, i) { var m = 0; arr().forEach(function (t) { if (t.bid === bid && t.p === i.p && t.c === i.c && t.h === i.h && t.no > m) m = t.no; }); return m + 1; }
  function save() { HA.saveSettings(); draw(); }

  HA.titikActive = function () { return !!ik().on; };
  HA.titikOf = function (bid) { return arr().filter(function (t) { return t.bid === bid; }); };
  HA.titikAdd = function (ll, o) {
    o = o || {}; var i = ik(), b = HA.blockAt(L.latLng(ll[0], ll[1]));
    if (!b) { toast('Titik di luar blok'); return null; }
    if (!b.conf) { toast('Blok ' + b.name + ' belum terkonfirmasi. Konfirmasi dulu di Edit Blok'); return null; }
    var it = { id: 'k' + Date.now() + Math.random().toString(36).slice(2, 5), bid: b.id, bn: String(b.name), p: i.p, c: i.c, h: i.h || 'A', no: nextNo(b.id, { p: i.p, c: i.c, h: i.h || 'A' }), ll: [+(+ll[0]).toFixed(6), +(+ll[1]).toFixed(6)], note: o.note || '', date: S.mapDay || S.today, ts: Date.now(), je: Math.round(edgeD(b, ll)) };
    arr().push(it); save(); toast(lab(it) + ' · ' + b.name + ' · ' + it.je + ' m dari tepi'); return it;
  };
  HA.titikDel = function (id) { var a = arr(), k; for (k = a.length - 1; k >= 0; k--) if (a[k].id === id) a.splice(k, 1); save(); };

  // ---------- gambar di peta ----------
  function draw() {
    var map = HA.map; if (!map) return;
    if (LAY) { map.removeLayer(LAY); LAY = null; }
    if (map.getZoom() < 16 || !arr().length) return;
    var bd = map.getBounds().pad(0.2), n = 0; LAY = L.layerGroup().addTo(map);
    arr().forEach(function (t) {
      if (n >= 400 || !bd.contains(t.ll)) return; n++;
      var mk = L.marker(t.ll, { icon: L.divIcon({ className: '', html: svg(t.p, t.c, lab(t), 36), iconSize: [36, 36], iconAnchor: [18, 18] }), zIndexOffset: 400 }).addTo(LAY);
      mk.on('click', function (e) { L.DomEvent.stop(e); edit(t, null); });
    });
  }
  HA.titikDraw = draw;
  setInterval(function () { var m = HA.map; if (m && !m._titikHook) { m._titikHook = 1; m.on('moveend zoomend', draw); draw(); } }, 1500);

  // ---------- ikon aktif (Pengaturan) ----------
  function ikonSheet(back) {
    var i = ik();
    function body() {
      return '<div class="grab"></div><div class="st">Ikon tanda titik</div>' +
        '<label class="lsA" style="margin:8px 0"><input type="checkbox" id="ikOn"' + (i.on ? ' checked' : '') + '> Ikon aktif: Ukur dan Walking langsung menyimpan tanda titik</label>' +
        '<div style="text-align:center;margin:6px 0" id="ikPv">' + svg(i.p, i.c, (i.h || 'A') + '.1', 64) + '</div>' +
        '<div class="h">POLA</div><div class="row" style="gap:6px;flex-wrap:wrap" id="ikP">' + PATS.map(function (q) { return '<button type="button" class="btn' + (i.p === q[0] ? ' pri' : '') + '" data-p="' + q[0] + '" style="padding:4px 8px">' + svg(q[0], i.c, '', 30) + '</button>'; }).join('') + '</div>' +
        '<div class="h" style="margin-top:8px">WARNA</div><div class="row" style="gap:6px;flex-wrap:wrap" id="ikC">' + CLRS.map(function (c) { return '<button type="button" data-c="' + c + '" aria-label="' + c + '" style="width:36px;height:36px;border-radius:50%;background:' + c + ';border:3px solid ' + (i.c === c ? 'var(--tx)' : 'rgba(128,128,128,.5)') + '"></button>'; }).join('') + '<input type="color" id="ikCc" value="' + i.c + '" style="width:44px;height:36px"></div>' +
        '<div class="h" style="margin-top:8px">HURUF</div><div class="row"><input type="text" id="ikH" maxlength="2" value="' + esc(i.h || 'A') + '" style="width:5rem;height:2.6rem;text-transform:uppercase;text-align:center"><span class="muted" style="flex:1">Nomor naik per blok selama pola, warna, dan huruf sama. Ganti pola atau warna = huruf berganti.</span></div>' +
        '<button class="btn pri" id="ikX" style="width:100%;margin-top:12px;height:48px">Selesai</button>';
    }
    function refresh() { openSheet(body()); bind(); }
    function combo() { return i.p + '|' + i.c; }
    function newCombo() { var k = combo(); i.h = hm()[k] || (hm()[k] = unusedLetter(k)); HA.saveSettings(); refresh(); }
    function bind() {
      $('ikOn').onchange = function () { i.on = this.checked; HA.saveSettings(); if (HA.renderSetMenu && !S.setPage) HA.renderSetMenu(); toast(i.on ? 'Ikon aktif. Ukur dan Walking menyimpan tanda titik' : 'Ikon mati. Ukur dan Walking seperti biasa'); };
      $('ikP').onclick = function (e) { var b = e.target.closest && e.target.closest('[data-p]'); if (!b) return; i.p = b.getAttribute('data-p'); newCombo(); };
      $('ikC').onclick = function (e) { var b = e.target.closest && e.target.closest('[data-c]'); if (!b) return; i.c = b.getAttribute('data-c'); newCombo(); };
      $('ikCc').onchange = function () { i.c = this.value.toUpperCase(); newCombo(); };
      $('ikH').oninput = function () { var v = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2); this.value = v; if (!v) return; i.h = v; hm()[combo()] = v; HA.saveSettings(); $('ikPv').innerHTML = svg(i.p, i.c, v + '.1', 64); };
      $('ikX').onclick = function () { closeSheet(); if (back) back(); };
    }
    if (!hm()[i.p + '|' + i.c]) hm()[i.p + '|' + i.c] = i.h || 'A';
    refresh();
  }
  HA.titikIkon = ikonSheet;

  // ---------- ubah satu tanda ----------
  function edit(t, back) {
    openSheet('<div class="grab"></div><div class="st" style="display:flex;align-items:center;gap:10px">' + svg(t.p, t.c, lab(t), 40) + '<span>' + esc(lab(t)) + ' · ' + esc(t.bn) + '</span></div>' +
      '<div class="muted" style="margin:6px 0">' + t.ll[0].toFixed(6) + ', ' + t.ll[1].toFixed(6) + ' · ' + t.je + ' m dari tepi blok</div>' +
      '<label class="ukDt" style="display:block">Catatan<textarea id="tkN" rows="3" style="width:100%" maxlength="300">' + esc(t.note || '') + '</textarea></label>' +
      '<label class="ukDt">Tanggal<input type="date" id="tkD" value="' + t.date + '" max="' + S.today + '"></label>' +
      '<div class="row" style="margin-top:12px"><button class="btn" id="tkX" style="flex:1;height:50px">Tutup</button><button class="btn" id="tkDl" style="flex:1;height:50px;color:var(--r)">Hapus</button><button class="btn pri" id="tkOk" style="flex:1;height:50px">Simpan</button></div>');
    function out() { if (back) back(); }
    $('tkX').onclick = function () { closeSheet(); out(); };
    $('tkOk').onclick = function () { t.note = $('tkN').value.trim(); var d = $('tkD').value; if (/^\d{4}-\d{2}-\d{2}$/.test(d)) t.date = d; save(); closeSheet(); out(); };
    $('tkDl').onclick = function () { askConfirm('Hapus ' + lab(t) + '?', 'Tanda ' + lab(t) + ' di ' + t.bn + ' dihapus. Nomor lain tidak berubah.', 'Hapus', function () { HA.titikDel(t.id); out(); }); var cn = $('cfNo'); if (cn) cn.onclick = function () { edit(t, back); }; };
  }

  // ---------- Daftar tanda: tab Kategori | Tanda | Draf ----------
  HA.listTabs = function (act) {
    var n1 = arr().length, n2 = (S.settings.wkDraf || []).length;
    return '<div class="tseg" style="margin:0 0 8px"><button type="button" data-lt="kat"' + (act === 'kat' ? ' class="on"' : '') + '>Kategori</button><button type="button" data-lt="tnd"' + (act === 'tnd' ? ' class="on"' : '') + '>Tanda' + (n1 ? ' (' + n1 + ')' : '') + '</button><button type="button" data-lt="drf"' + (act === 'drf' ? ' class="on"' : '') + '>Draf' + (n2 ? ' (' + n2 + ')' : '') + '</button></div>';
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-lt]'); if (!b || b.classList.contains('on')) return;
    var k = b.getAttribute('data-lt'); HA.onSheetClose = null; if (HA.walkPvClear) HA.walkPvClear();
    if (k === 'kat' && HA.BT && HA.BT.listOpen) HA.BT.listOpen(); else if (k === 'tnd') tndOpen(); else if (k === 'drf' && HA.drafOpen) HA.drafOpen();
  }, true);
  var Q = '';
  function sorted() {
    var coll = new Intl.Collator('id', { numeric: true });
    return arr().slice().sort(function (a, b) { return coll.compare(a.bn, b.bn) || coll.compare(a.h + a.p + a.c, b.h + b.p + b.c) || a.no - b.no; });
  }
  function tndOpen() {
    var q = Q.toLowerCase().replace(/\s+/g, ''), items = sorted().filter(function (t) { return !q || (t.bn + lab(t) + t.note + t.date).toLowerCase().replace(/\s+/g, '').indexOf(q) >= 0; }), ic = ik();
    openSheet('<div class="grab"></div>' + HA.listTabs('tnd') + '<div class="lsQr" style="display:flex;gap:6px"><input type="search" id="tkQ" placeholder="Cari blok, label, catatan" value="' + esc(Q) + '" autocomplete="off" style="flex:1"><button type="button" class="btn" id="tkIk" style="padding:0 8px">' + svg(ic.p, ic.c, ic.h || 'A', 28) + ' <small>' + (ic.on ? 'Aktif' : 'Mati') + '</small></button></div>' +
      '<div id="tkL" style="margin-top:8px"></div><div class="row" style="margin-top:10px"><button class="btn" id="tkNu" style="flex:1;height:46px">Susun ulang nomor</button><button class="btn" id="tkXx" style="flex:1;height:46px">Tutup</button></div>');
    $('tkXx').onclick = closeSheet;
    $('tkIk').onclick = function () { ikonSheet(tndOpen); };
    $('tkQ').oninput = function () { Q = this.value; var p = this.selectionStart; tndOpen(); var e = $('tkQ'); if (e) { e.focus(); try { e.setSelectionRange(p, p); } catch (x) {} } };
    $('tkNu').onclick = renum;
    HA.lpList($('tkL'), 'titik', {
      items: items.map(function (t) { return { id: t.id, title: t.bn + ' · ' + lab(t), sub: (t.note ? t.note + ' · ' : '') + t.date + ' · ' + t.je + ' m dari tepi' }; }),
      empty: 'Belum ada tanda titik. Aktifkan ikon, lalu pakai Ukur atau Walking.',
      onTap: function (id) { var t = byId(id); if (t) edit(t, tndOpen); },
      onEdit: function (id) { var t = byId(id); if (t) edit(t, tndOpen); },
      actions: function () { return [{ label: 'Lihat di peta', fn: function (id) { var t = byId(id); if (!t) return; closeSheet(); go(t); } }]; },
      delTitle: function (ids) { return 'Hapus ' + ids.length + ' tanda titik?'; },
      delMsg: function () { return 'Nomor tanda lain tidak berubah. Tidak bisa dibatalkan.'; },
      onDelete: function (ids) { ids.forEach(function (id) { HA.titikDel(id); }); toast(ids.length + ' tanda dihapus'); tndOpen(); }
    });
  }
  function byId(id) { return arr().filter(function (t) { return t.id === id; })[0]; }
  function go(t) {
    function f() { HA.map.setView(t.ll, 19); draw(); }
    if (S.view === 'lintasan' && HA.map) f(); else { HA.mapKeep = true; HA.go('lintasan'); setTimeout(f, 900); }
  }
  function renum() {
    var g = {}, order = [];
    sorted().forEach(function (t) { var k = t.bid + '|' + t.p + '|' + t.c + '|' + t.h; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(t); });
    if (!order.length) { toast('Belum ada tanda'); return; }
    openSheet('<div class="grab"></div><div class="st">Susun ulang nomor</div><div class="muted" style="margin:4px 0 8px">Per blok dan ikon. Nomor disusun 1, 2, 3 menurut waktu dibuat.</div>' +
      order.map(function (k, i) { var a = g[k], t = a[0], gap = a.some(function (x, j) { return false; }); void gap; return '<div class="ukRw"><span style="display:flex;align-items:center;gap:8px">' + svg(t.p, t.c, t.h, 28) + esc(t.bn) + ' · ' + a.length + ' tanda</span><button class="btn sm" data-g="' + i + '">Susun</button></div>'; }).join('') +
      '<button class="btn" id="rnX" style="width:100%;margin-top:10px;height:46px">Kembali</button>');
    $('rnX').onclick = tndOpen;
    $('sheet').onclick = function (e) {
      var b = e.target.closest && e.target.closest('[data-g]'); if (!b) return; var a = g[order[+b.getAttribute('data-g')]];
      askConfirm('Susun ulang nomor?', 'Nomor ' + esc(a[0].h) + ' di ' + a[0].bn + ' (' + a.length + ' tanda) menjadi 1 sampai ' + a.length + ' menurut waktu dibuat. Label lama berubah.', 'Susun', function () {
        a.slice().sort(function (x, y) { return x.ts - y.ts; }).forEach(function (t, j) { t.no = j + 1; }); save(); toast('Nomor disusun ulang'); renum();
      });
      var cn = $('cfNo'); if (cn) cn.onclick = renum;
    };
  }
  HA.titikOpen = tndOpen;
})();
