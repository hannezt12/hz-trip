/* HZ Trip v0.16.0 - mode Kategori di Lintasan: tombol Satelit/Peta dan Lintasan/Kategori, tanda per tanggal (Harian) atau per rentang. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  function $() { return HA.$.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  var KM = HA.KM = { mode: 'lintasan', range: false, from: '', to: '', lay: null, only: null, all: false };
  function map() { return HA.map; }
  function items() { try { return HA.tandaData().items || []; } catch (e) { return []; } }
  function dateOf(it) { return HA.tandaU.dateOf(it); }
  function visible() {
    return items().filter(function (it) {
      var d = dateOf(it);
      if (KM.only && it.cat !== KM.only) return false;
      if (KM.all) return true;
      return KM.range ? ((!KM.from || d >= KM.from) && (!KM.to || d <= KM.to)) : d === S.mapDay;
    });
  }
  function opOf(it) { var v = it.op; return (typeof v === 'number' && v >= 0.05 && v <= 0.95) ? v : 0.35; }
  function draw() {
    var m = map(); if (!m) return;
    if (KM.lay) { try { m.removeLayer(KM.lay); } catch (e) {} KM.lay = null; }
    if (KM.mode !== 'kategori') return;
    var list = visible(), g = KM.lay = L.layerGroup().addTo(m);
    list.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); }).forEach(function (it) {
      var col = HA.tandaColOf(it), cc = it.cat ? HA.tandaCatOf(it.cat) : null, gar = !!(cc && cc.style === 'garis'), w = cc && cc.w ? cc.w : 0;
      if (it.t === 'pt') L.circleMarker(it.pts[0], { radius: 8, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1, interactive: false }).addTo(g);
      else if (it.t === 'ln') L.polyline(it.pts, { color: col, weight: w || 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(g);
      else L.polygon(it.pts, { color: col, weight: gar ? (w || 3) : 2.5, fill: !gar, fillColor: col, fillOpacity: gar ? 0 : opOf(it), interactive: false }).addTo(g);
    });
    var n = list.length, oc = KM.only ? HA.tandaCatOf(KM.only) : null;
    if (KM.only && !oc) KM.only = null;
    $('katInfo').textContent = (KM.fillTap ? 'Ketuk isi: ' + HA.tandaBrush().name + ' \u00B7 ' : '') + (oc ? 'Hanya ' + oc.name + ' · ' : '') + (n ? n + ' tanda' + (KM.all ? ' · semua tanggal' : KM.range ? '' : ' pada tanggal ini') : (KM.all ? 'Belum ada tanda.' : KM.range ? 'Tidak ada tanda pada rentang ini.' : 'Belum ada tanda pada tanggal ini.'));
  }
  function inkOn(hex) { var h = String(hex).replace('#', ''); if (h.length !== 6) return '#fff'; var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111' : '#fff'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // strip kategori: ketuk = kategori aktif (dipakai saat Simpan di Ukur), tahan lama atau gir = kelola kategori
  function stripDraw() {
    var el = $('katStrip'); if (!el) return;
    if (KM.mode !== 'kategori') { el.innerHTML = ''; return; }
    var d = HA.tandaData(), act = d.brush.cat, cc = HA.tandaCatOf(act), keep = el.querySelector('.tdKs'), sl = keep ? keep.scrollLeft : 0;
    var boxes = d.cats.map(function (c) { return '<button type="button" class="tdk' + (c.id === act ? ' on' : '') + (c.id === KM.only ? ' only' : '') + '" data-cat="' + c.id + '" style="background:' + c.col + ';color:' + inkOn(c.col) + '">' + esc(c.name) + '</button>'; }).join('') +
      '<button type="button" class="tdk kgear" data-gear="1" aria-label="Kelola kategori">⚙</button>';
    var subs = cc && cc.subs.length ? '<div class="tdSb">' + cc.subs.map(function (s, i) { var c0 = s.col || cc.col; return '<button type="button" class="tdsc' + (d.brush.sub === s.id ? ' on' : '') + '" data-sub="' + s.id + '" style="background:' + c0 + ';color:' + inkOn(c0) + '" aria-label="' + esc(s.name) + '">' + (i + 1) + '</button>'; }).join('') + '</div>' : '';
    el.innerHTML = '<div class="tdKw"><div class="tdKs">' + boxes + '</div></div>' + subs;
    var ks = el.querySelector('.tdKs'); if (ks) ks.scrollLeft = sl;
  }
  function stripWire() {
    var el = $('katStrip'), tm = null, fired = false;
    el.onclick = function (e) {
      if (fired) { fired = false; return; }
      var b = e.target.closest && e.target.closest('button'); if (!b) return;
      if (b.getAttribute('data-gear')) { HA.tandaCatPage(); return; }
      var sub = b.getAttribute('data-sub'), cat = b.getAttribute('data-cat'), d = HA.tandaData();
      if (sub) { var c = HA.tandaCatOf(d.brush.cat), sb = c && c.subs.filter(function (x) { return x.id === sub; })[0]; var was = d.brush.sub === sub; HA.tandaSetBrush(d.brush.cat, was ? null : sub); if (sb && !was) toast(c.name + ' / ' + (sb.name || 'Sub')); }
      else if (cat) {
        var nm = HA.tandaCatOf(cat).name;
        if (KM.only === cat) { KM.only = null; toast('Semua kategori tampil'); }
        else { KM.only = cat; HA.tandaSetBrush(cat, null); toast('Hanya ' + nm + ' · ketuk lagi untuk semua'); }
        draw();
      }
      stripDraw();
    };
    el.addEventListener('pointerdown', function (e) { var b = e.target.closest && e.target.closest('.tdk[data-cat]'); if (!b) return; fired = false; clearTimeout(tm); tm = setTimeout(function () { fired = true; HA.tandaCatPage(); }, 550); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { el.addEventListener(n, function () { clearTimeout(tm); }); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('scroll', function () { clearTimeout(tm); }, true);
  }
  // pencarian blok terkonfirmasi: ketik nama (5 saran), kosong = terdekat dari tengah peta
  function dkm(a, b) { var R = 6371000, p = Math.PI / 180, x = (b[1] - a[1]) * p * Math.cos((a[0] + b[0]) / 2 * p), y = (b[0] - a[0]) * p; return Math.sqrt(x * x + y * y) * R; }
  function nrm(t) { return String(t).toLowerCase().replace(/\s+/g, ''); }
  var coll = (typeof Intl !== 'undefined' && Intl.Collator) ? new Intl.Collator('id', { numeric: true }) : { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } };
  function srchList() {
    var q = nrm($('katQ').value), c = map() ? map().getCenter() : null, ref = c ? [c.lat, c.lng] : null;
    var l = HA.blocksList().filter(function (b) { return b.conf && b.pts && b.pts.length >= 3; }).map(function (b) {
      var la = 0, lo = 0; b.pts.forEach(function (p) { la += p[0]; lo += p[1]; }); la /= b.pts.length; lo /= b.pts.length;
      return { b: b, n: nrm(b.name), d: ref ? dkm(ref, [la, lo]) : 0 };
    });
    if (q) { l = l.filter(function (x) { return x.n.indexOf(q) >= 0; }); l.sort(function (a, b) { var s1 = a.n.indexOf(q) === 0 ? 0 : 1, s2 = b.n.indexOf(q) === 0 ? 0 : 1; return s1 - s2 || coll.compare(a.n, b.n); }); }
    else l.sort(function (a, b) { return a.d - b.d; });
    l = l.slice(0, 5);
    var el = $('katSl');
    el.innerHTML = l.length ? (q ? '' : '<div class="muted tdSh">Terdekat dari tengah peta</div>') + l.map(function (x) { return '<button type="button" class="bprow" data-id="' + esc(String(x.b.id)) + '"><span class="bpi"><b>' + esc(String(x.b.name)) + '</b><small>' + (x.d >= 1000 ? (x.d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(x.d) + ' m') + '</small></span></button>'; }).join('') : '<div class="muted" style="padding:0.6rem">Tidak ada blok terkonfirmasi yang cocok.</div>';
    el.style.display = 'block';
    el.querySelectorAll('.bprow').forEach(function (e) {
      e.onclick = function () {
        var id = e.getAttribute('data-id'), b = HA.blocksList().filter(function (o) { return String(o.id) === id; })[0];
        srchClose();
        if (!b) return;
        map().fitBounds(L.polygon(b.pts).getBounds(), { padding: [40, 40], maxZoom: 19 });
        if (HA.openBlockPop) HA.openBlockPop(b);
      };
    });
  }
  function srchClose() { var e = $('katSrch'); if (!e) return; $('katSl').style.display = 'none'; e.style.display = 'none'; $('katQ').value = ''; try { $('katQ').blur(); } catch (x) {} }
  function srchOpen() {
    if (HA.DM && HA.DM.closePanel) HA.DM.closePanel();
    $('katSrch').style.display = 'block'; var q = $('katQ'); q.value = ''; stripDraw(); srchList();
    setTimeout(function () { try { q.focus(); } catch (x) {} }, 60);
  }
  function srchWire() {
    var q = $('katQ');
    q.onfocus = srchList; q.oninput = srchList;
    $('katXc').onclick = srchClose;
  }
  KM.openSearch = srchOpen;
  // tombol Back: tutup pencarian lalu panel Alat peta
  HA.mapBack = function () {
    var e = $('katSrch'); if (e && e.style.display !== 'none') { srchClose(); return true; }
    var p = document.querySelector('.toolpanel'); if (p && p.style.display !== 'none' && HA.DM && HA.DM.closePanel) { HA.DM.closePanel(); return true; }
    return false;
  };
  function dm(x) { var a = String(x || '').split('-'); return a.length === 3 ? a[2] + '/' + a[1] : ''; }
  function calLabel() {
    var e = $('mapCalT'); if (!e) return;
    var k = KM.mode === 'kategori';
    e.textContent = k && KM.all ? 'Semua' : k && KM.range ? dm(KM.from) + '–' + dm(KM.to) : dm(S.mapDay || S.today);
  }
  KM.calLabel = calLabel;
  function openCal() {
    var k = KM.mode === 'kategori';
    if (k && KM.all) { toast('Mode Semua: semua tanggal tampil'); return; }
    if (HA.DM && HA.DM.closePanel) HA.DM.closePanel();
    var rng = k && KM.range, mx = S.today;
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">' + (rng ? 'RENTANG TANGGAL' : 'TANGGAL') + '</div><button class="btn pri" id="calOk">Selesai</button></div>' + (rng
      ? '<div class="row" style="gap:8px;margin-top:8px"><label class="calL">Dari<input type="date" id="calF" max="' + mx + '" value="' + (KM.from || '') + '"></label><label class="calL">Sampai<input type="date" id="calT" max="' + mx + '" value="' + (KM.to || '') + '"></label></div>'
      : '<div class="row" style="gap:6px;margin-top:8px;align-items:center"><button class="ib" id="calP" aria-label="Hari sebelumnya"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><input type="date" id="calD" max="' + mx + '" value="' + (S.mapDay || mx) + '" style="flex:1;height:2.5rem"><button class="ib" id="calN" aria-label="Hari berikutnya"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button></div><button class="btn" id="calTd" style="width:100%;margin-top:8px">Hari ini</button>'));
    $('scrim').classList.remove('on'); $('sheet').classList.add('cmp');
    $('calOk').onclick = function () { HA.closeSheet(); };
    if (rng) {
      $('calF').onchange = function () { if (!this.value) return; KM.from = this.value; if (KM.to && KM.to < KM.from) KM.to = KM.from; $('calT').value = KM.to; syncUi(); draw(); };
      $('calT').onchange = function () { if (!this.value) return; KM.to = this.value; if (KM.from && KM.from > KM.to) KM.from = KM.to; $('calF').value = KM.from; syncUi(); draw(); };
    } else {
      var back = function () { setTimeout(function () { var d = $('calD'); if (d) d.value = S.mapDay || mx; }, 80); };
      $('calD').onchange = function () { if (!this.value) return; $('mPick').value = this.value; $('mPick').dispatchEvent(new Event('change')); back(); };
      $('calP').onclick = function () { $('mPrev').click(); back(); };
      $('calN').onclick = function () { if ((S.mapDay || mx) >= mx) { toast('Sudah hari ini'); return; } $('mNext').click(); back(); };
      $('calTd').onclick = function () { $('mToday').click(); back(); };
    }
  }
  function syncUi() {
    stripDraw();
    var kat = KM.mode === 'kategori', v = $('v-lintasan');
    v.classList.toggle('kat', kat);
    $('katBar').style.display = kat ? 'block' : 'none';
    $('katRng').style.display = 'none';
    $('mapMode').textContent = kat ? 'Kategori' : 'Lintasan';
    Array.prototype.forEach.call($('katSeg').children, function (b) { b.classList.toggle('on', b.getAttribute('data-r') === (KM.all ? '2' : KM.range ? '1' : '0')); });
    calLabel();
    $('katFrom').value = KM.from; $('katTo').value = KM.to;
    $('katFrom').max = $('katTo').max = S.today;
  }
  function setMode(m, quiet) {
    if (m !== 'kategori') KM.fillTap = false;
    if (m === KM.mode) return;
    var map_ = map();
    KM.mode = m;
    if (m === 'kategori') {
      if (HA.PB && HA.PB.open && HA.pbClose) HA.pbClose();
      if (map_ && HA.trackLayer) map_.removeLayer(HA.trackLayer);
      if (map_ && map_._pinClear) map_._pinClear();
      if (!KM.from) { var d = new Date(); d.setDate(d.getDate() - 30); KM.from = iso(d); KM.to = S.today; }
    } else if (map_ && HA.trackLayer) map_.addLayer(HA.trackLayer);
    syncUi(); draw(); if (HA.DM && HA.DM.regrid) HA.DM.regrid();
    if (!quiet) toast(m === 'kategori' ? 'Mode Kategori: tanda tampil per tanggal' : 'Mode Lintasan');
  }
  KM.setMode = setMode; KM.sync = function () { if (KM.mode === 'kategori') { syncUi(); draw(); } };
  // dipanggil setelah tanda baru disimpan: tampilkan tanggalnya di mode Kategori
  KM.show = function (date) {
    if (date) { S.mapDay = date; KM.range = false; KM.all = false; if (HA.renderMap) HA.renderMap(false); }
    if (KM.mode !== 'kategori') setMode('kategori', true); else { syncUi(); draw(); }
  };
  KM.toggleBase = function () {
    S.settings.mapMode = S.settings.mapMode === 'sat' ? 'osm' : 'sat';
    HA.saveSettings && HA.saveSettings();
    HA.setTiles(); if (HA.mini) { HA.setBase(HA.mini); HA.syncOverlays(HA.mini); }
    toast(S.settings.mapMode === 'sat' ? 'Mode Satelit' : 'Mode Peta');
  };
  function wire() {
    if (!$('mapMode')) return;
    $('mapBase').onclick = KM.toggleBase;
    $('mapMode').onclick = function () { setMode(KM.mode === 'kategori' ? 'lintasan' : 'kategori'); };
    srchWire(); stripWire();
    if ($('mapCal')) $('mapCal').onclick = openCal;
    $('katInfo').onclick = function () { if (KM.only) { KM.only = null; draw(); stripDraw(); toast('Semua kategori tampil'); } };
    $('katSeg').onclick = function (e) {
      var r = e.target.getAttribute && e.target.getAttribute('data-r'); if (r === null || r === undefined) return;
      KM.range = r === '1'; KM.all = r === '2'; syncUi(); draw();
    };
    $('katFrom').onchange = function () { KM.from = this.value; if (KM.to && KM.from > KM.to) KM.to = KM.from; syncUi(); draw(); };
    $('katTo').onchange = function () { KM.to = this.value; if (KM.from && KM.to < KM.from) KM.from = KM.to; syncUi(); draw(); };
    // Putar hanya untuk lintasan: menekannya di mode Kategori kembali ke mode Lintasan
    var po = HA.pbOpen;
    HA.pbOpen = function () { if (KM.mode === 'kategori') setMode('lintasan', true); return po.apply(this, arguments); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
