/* HZ Trip v0.17.0 - Editor lapisan: laman terpisah untuk membuat/mengubah titik, garis, area, teks. Draf otomatis, Simpan/Buang/Lanjut. Data tetap GeoJSON/KML. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.LY) return;
  var S = HA.S, LY = HA.LY, MAXO = 5000, UNDO = 60;
  var COLS = ['#FFD84D', '#FF5B50', '#FF9800', '#3FD07A', '#00D4FF', '#2F80FF', '#B06CFF', '#FF4081', '#FFFFFF', '#222222'];
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var E = null; // sesi editor
  function tr(txt) { return String(txt || ''); }

  // ---------- helper geometri ----------
  function ringOf(o) { var r = o.c[0]; if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1); return r; }
  function ptsOf(o) { return o.k === 'l' ? o.c : o.k === 'g' ? ringOf(o) : [o.c]; }
  function normObjs(list) { // cincin poligon tanpa titik penutup selama diedit
    list.forEach(function (o) { if (o.k === 'g') o.c[0] = ringOf(o); });
    return list;
  }

  // ---------- draf ----------
  var saveT = null;
  function draftSave() {
    if (!E) return;
    clearTimeout(saveT);
    saveT = setTimeout(function () { LY.dbPut({ id: 'draft', target: E.id, name: E.name, objs: E.objs, ts: Date.now() }); }, 500);
  }
  function draftClear() { clearTimeout(saveT); return LY.dbDel('draft'); }

  // ---------- perubahan + undo ----------
  function snap() { E.undo.push(JSON.stringify(E.objs)); if (E.undo.length > UNDO) E.undo.shift(); E.redo = []; }
  function changed() { E.dirty = true; draftSave(); render(); bar(); }
  function doUndo() { if (!E.undo.length) return; E.redo.push(JSON.stringify(E.objs)); E.objs = JSON.parse(E.undo.pop()); fixSel(); changed(); }
  function doRedo() { if (!E.redo.length) return; E.undo.push(JSON.stringify(E.objs)); E.objs = JSON.parse(E.redo.pop()); fixSel(); changed(); }
  function fixSel() { if (E.sel != null && !E.objs[E.sel]) E.sel = null; E.vi = null; }

  // ---------- gambar ----------
  function colOf(o) { return /^#[0-9a-f]{6}$/i.test(o.col || '') ? o.col : '#FFD84D'; }
  function iconTx(o, on) { return L.divIcon({ className: 'edTxW', html: '<div class="edTx' + (on ? ' on' : '') + '" style="color:' + colOf(o) + '">' + esc(o.n || 'Teks') + '</div>', iconSize: null }); }
  function dot(cls) { var z = /mid/.test(cls) ? 18 : 26; return L.divIcon({ className: 'edH ' + cls, iconSize: [z, z], iconAnchor: [z / 2, z / 2] }); }
  function render() {
    if (!E || !E.map) return;
    var m = E.map;
    if (E.g) m.removeLayer(E.g);
    E.g = L.layerGroup().addTo(m);
    E.objs.forEach(function (o, i) {
      var on = i === E.sel, c = colOf(o), l;
      if (o.k === 'p') {
        if (o.tx) l = L.marker(o.c, { icon: iconTx(o, on), interactive: E.tool === 'sel' });
        else l = L.circleMarker(o.c, { radius: on ? 9 : 7, color: on ? '#fff' : '#06202B', weight: on ? 3 : 2, fillColor: c, fillOpacity: 1 });
      } else if (o.k === 'l') l = L.polyline(o.c, { color: c, weight: (o.w || 3) + (on ? 2 : 0), opacity: 0.95 });
      else l = L.polygon([ringOf(o)].concat(o.c.slice(1)), { color: on ? '#fff' : c, weight: (o.w || 3) + (on ? 1 : 0), fillColor: o.fc || c, fillOpacity: o.fo != null ? o.fo : 0.3 });
      if (E.tool === 'sel') l.on('click', function (ev) { L.DomEvent.stopPropagation(ev); pick(i); });
      l.addTo(E.g);
    });
    handles(); drawDraft();
  }
  function handles() {
    if (E.h) { E.map.removeLayer(E.h); E.h = null; }
    if (E.tool !== 'sel' || E.sel == null) return;
    var o = E.objs[E.sel]; if (!o) return;
    E.h = L.layerGroup().addTo(E.map);
    if (o.k === 'p') { mkHandle(o.c, 'v', function (ll) { snap(); o.c = [ll.lat, ll.lng]; changed(); }, null); return; }
    var pts = ptsOf(o), n = pts.length, i;
    for (i = 0; i < n; i++) (function (i) {
      mkHandle(pts[i], 'v' + (E.vi === i ? ' sel' : ''), function (ll) { snap(); setPt(o, i, [ll.lat, ll.lng]); changed(); }, function () { E.vi = E.vi === i ? null : i; handles(); bar(); });
    })(i);
    var segs = o.k === 'g' ? n : n - 1;
    for (i = 0; i < segs; i++) (function (i) {
      var a = pts[i], b = pts[(i + 1) % n], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      var mk = L.marker(mid, { icon: dot('mid'), draggable: false, keyboard: false }).addTo(E.h);
      mk.on('click', function (ev) { L.DomEvent.stopPropagation(ev); snap(); insPt(o, i + 1, mid); E.vi = i + 1; changed(); });
    })(i);
  }
  function mkHandle(ll, cls, onDrag, onTap) {
    var mk = L.marker(ll, { icon: dot(cls), draggable: true, keyboard: false, autoPan: false }).addTo(E.h);
    mk.on('dragend', function () { onDrag(mk.getLatLng()); });
    if (onTap) mk.on('click', function (ev) { L.DomEvent.stopPropagation(ev); onTap(); });
    return mk;
  }
  function setPt(o, i, p) { if (o.k === 'l') o.c[i] = p; else o.c[0][i] = p; }
  function insPt(o, i, p) { if (o.k === 'l') o.c.splice(i, 0, p); else o.c[0].splice(i, 0, p); }
  function delPt(o, i) { if (o.k === 'l') o.c.splice(i, 1); else o.c[0].splice(i, 1); }
  function drawDraft() {
    if (E.dl) { E.map.removeLayer(E.dl); E.dl = null; }
    if (!E.draft.length) return;
    var ls = [], c = E.col;
    if (E.draft.length > 1) ls.push(E.tool === 'pg' ? L.polygon(E.draft, { color: c, weight: 3, dashArray: '6 4', fillOpacity: 0.2 }) : L.polyline(E.draft, { color: c, weight: 3, dashArray: '6 4' }));
    E.draft.forEach(function (p, i) { ls.push(L.circleMarker(p, { radius: i === E.draft.length - 1 ? 7 : 5, color: '#06202B', weight: 2, fillColor: c, fillOpacity: 1, interactive: false })); });
    E.dl = L.layerGroup(ls).addTo(E.map);
  }

  // ---------- aksi ----------
  function pick(i) { E.sel = i; E.vi = null; render(); bar(); }
  function addObj(o) { snap(); o.col = o.col || E.col; E.objs.push(o); E.sel = E.objs.length - 1; E.vi = null; changed(); }
  function onMap(ev) {
    var ll = [ev.latlng.lat, ev.latlng.lng];
    if (E.tool === 'sel') { if (E.sel != null) { E.sel = null; E.vi = null; render(); bar(); } return; }
    if (E.objs.length >= MAXO && (E.tool === 'pt' || E.tool === 'tx')) { HA.toast('Maksimal ' + MAXO + ' objek di editor'); return; }
    if (E.tool === 'pt') { addObj({ k: 'p', c: ll, n: '' }); return; }
    if (E.tool === 'tx') { askText('', function (t) { if (t) { addObj({ k: 'p', c: ll, n: t, tx: 1 }); } }); return; }
    E.draft.push(ll); drawDraft(); bar();
  }
  function finishShape() {
    var need = E.tool === 'pg' ? 3 : 2;
    if (E.draft.length < need) { HA.toast('Butuh minimal ' + need + ' titik'); return; }
    var pts = E.draft.slice(); E.draft = [];
    addObj(E.tool === 'pg' ? { k: 'g', c: [pts] } : { k: 'l', c: pts });
  }
  function setTool(t) { E.tool = t; E.draft = []; if (t !== 'sel') { E.sel = null; E.vi = null; } render(); bar(); }
  function askText(cur, cb) {
    HA.openSheet('<div class="grab"></div><div class="st">TEKS</div><input type="text" id="edTi" maxlength="80" value="' + esc(cur) + '" placeholder="Tulisan di peta" style="width:100%;margin-top:10px"><div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="edTx_">Batal</button><button class="btn pri" id="edTy" style="flex:1">Simpan</button></div>');
    $('edTx_').onclick = HA.closeSheet;
    $('edTy').onclick = function () { var v = $('edTi').value.trim(); HA.closeSheet(); cb(v); };
    setTimeout(function () { var i = $('edTi'); if (i) i.focus(); }, 200);
  }
  function props() {
    var o = E.objs[E.sel]; if (!o) return;
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">' + (o.tx ? 'TEKS' : o.k === 'p' ? 'TITIK' : o.k === 'l' ? 'GARIS' : 'AREA') + '</div><button class="btn pri" id="epOk">Selesai</button></div>' +
      '<input type="text" id="epN" maxlength="80" placeholder="' + (o.tx ? 'Tulisan' : 'Nama') + '" value="' + esc(o.n || '') + '" style="width:100%;margin-top:8px">' +
      (o.tx ? '' : '<input type="text" id="epD" maxlength="300" placeholder="Keterangan (dosis, catatan)" value="' + esc(plain(o.d)) + '" style="width:100%;margin-top:8px">') +
      '<div class="edCs" id="epC" style="margin-top:10px">' + COLS.map(function (c) { return '<button type="button" data-c="' + c + '" class="edC' + (colOf(o).toLowerCase() === c.toLowerCase() ? ' on' : '') + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div>' +
      (o.k !== 'p' ? '<div class="fgR" style="margin-top:8px"><span>Tebal</span><input type="range" id="epW" min="1" max="8" step="1" value="' + (o.w || 3) + '" style="flex:1"></div>' : '') +
      (o.k === 'g' ? '<div class="fgR"><span>Isi</span><input type="range" id="epF" min="0" max="80" step="5" value="' + Math.round((o.fo != null ? o.fo : 0.3) * 100) + '" style="flex:1"></div>' : ''));
    var snapped = false; function pre() { if (!snapped) { snap(); snapped = true; } }
    $('epOk').onclick = HA.closeSheet;
    $('epN').oninput = function () { pre(); o.n = this.value; changed(); };
    if ($('epD')) $('epD').oninput = function () { pre(); o.d = this.value; changed(); };
    $('epC').onclick = function (ev) { var b = ev.target.closest('[data-c]'); if (!b) return; pre(); o.col = b.getAttribute('data-c'); if (o.k === 'g') o.fc = o.col; E.col = o.col; changed(); [].forEach.call($('epC').children, function (x) { x.classList.toggle('on', x === b); }); };
    if ($('epW')) $('epW').oninput = function () { pre(); o.w = +this.value; changed(); };
    if ($('epF')) $('epF').oninput = function () { pre(); o.fo = +this.value / 100; changed(); };
  }
  function plain(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function delObj() {
    var o = E.objs[E.sel]; if (!o) return;
    HA.askConfirm('Hapus objek?', (o.n ? o.n + ': ' : '') + (o.tx ? 'teks' : o.k === 'p' ? 'titik' : o.k === 'l' ? 'garis' : 'area') + ' ini dihapus dari lapisan (bisa Urungkan).', 'Hapus', function () { snap(); E.objs.splice(E.sel, 1); E.sel = null; E.vi = null; changed(); });
  }
  function delVertex() {
    var o = E.objs[E.sel]; if (!o || E.vi == null) return;
    var n = ptsOf(o).length, min = o.k === 'g' ? 3 : 2;
    if (n <= min) { HA.toast('Tidak bisa, minimal ' + min + ' titik'); return; }
    snap(); delPt(o, E.vi); E.vi = null; changed();
  }

  // ---------- tampilan ----------
  function ico(d) { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; }
  var IC = {
    sel: ico('<path d="M5 3l14 8-6 2-2 6z"/>'), pt: ico('<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'), ln: ico('<path d="M4 19l6-9 4 5 6-9"/><circle cx="4" cy="19" r="1.5"/><circle cx="20" cy="6" r="1.5"/>'),
    pg: ico('<path d="M5 6l9-3 6 8-4 9-11-3z"/>'), tx: ico('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'), un: ico('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>'), re: ico('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>')
  };
  function bar() {
    if (!E) return;
    var T = [['sel', 'Pilih'], ['pt', 'Titik'], ['ln', 'Garis'], ['pg', 'Area'], ['tx', 'Teks']];
    var h = '<div class="edTools">' + T.map(function (t) { return '<button type="button" class="edT' + (E.tool === t[0] ? ' on' : '') + '" data-tool="' + t[0] + '">' + IC[t[0]] + '<span>' + t[1] + '</span></button>'; }).join('') + '</div><div class="edAct">';
    h += '<button type="button" class="btn" data-a="un"' + (E.undo.length ? '' : ' disabled') + '>' + IC.un + '</button><button type="button" class="btn" data-a="re"' + (E.redo.length ? '' : ' disabled') + '>' + IC.re + '</button>';
    if (E.tool === 'ln' || E.tool === 'pg') h += '<button type="button" class="btn" data-a="dun"' + (E.draft.length ? '' : ' disabled') + '>Urung titik</button><button type="button" class="btn" data-a="dx"' + (E.draft.length ? '' : ' disabled') + '>Batal</button><button type="button" class="btn pri" data-a="dok"' + (E.draft.length >= (E.tool === 'pg' ? 3 : 2) ? '' : ' disabled') + '>Selesai</button>';
    else if (E.tool === 'sel' && E.sel != null) {
      var o = E.objs[E.sel];
      h += '<button type="button" class="btn" data-a="pr">Properti</button>' + (o && o.k !== 'p' ? '<button type="button" class="btn danger" data-a="dv"' + (E.vi != null ? '' : ' disabled') + '>Hapus titik</button>' : '') + '<button type="button" class="btn edDel" data-a="do">Hapus</button>';
    } else if (E.tool === 'pt' || E.tool === 'tx') h += '<span class="edHint">Ketuk peta untuk menaruh ' + (E.tool === 'tx' ? 'teks' : 'titik') + '</span>';
    else h += '<span class="edHint">Ketuk objek untuk memilih' + (E.objs.length ? '' : ', atau pilih alat untuk mulai') + '</span>';
    $('edBar').innerHTML = h + '</div>';
    if ($('edCnt')) $('edCnt').textContent = E.objs.length + ' objek';
  }
  function build() {
    var d = document.createElement('div'); d.id = 'edPg';
    d.innerHTML = '<div class="edTop"><button type="button" class="btn" id="edBk" aria-label="Kembali">‹</button><input type="text" id="edNm" maxlength="40" placeholder="Nama lapisan"><span class="muted" id="edCnt"></span><button type="button" class="btn" id="edMn" aria-label="Menu">⋯</button><button type="button" class="btn pri" id="edSv">Simpan</button></div><div id="edMap"></div><div id="edBar"></div>';
    document.body.appendChild(d); return d;
  }
  function menu() {
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">MENU EDITOR</div><button class="btn" id="emX">Tutup</button></div>' +
      '<button class="btn" id="emB" style="width:100%;margin-top:6px">Latar: ' + (E.base === 'sat' ? 'Satelit → Peta' : 'Peta → Satelit') + '</button>' +
      '<button class="btn" id="emZ" style="width:100%;margin-top:6px">Zoom ke semua objek</button>' +
      '<button class="btn" id="emK" style="width:100%;margin-top:6px">Ekspor KML</button>' +
      '<button class="btn" id="emG" style="width:100%;margin-top:6px">Ekspor GeoJSON</button>');
    $('emX').onclick = HA.closeSheet;
    $('emB').onclick = function () { E.base = E.base === 'sat' ? 'osm' : 'sat'; HA.setBase(E.map, E.base); HA.closeSheet(); };
    $('emZ').onclick = function () { HA.closeSheet(); fit(); };
    function ex(kind) { var nm = (E.name || 'lapisan').replace(/[^\w\-]+/g, '_'), os = work(); if (!os.length) { HA.toast('Belum ada objek'); return; } HA.closeSheet(); HA.saveFile(nm + (kind === 'k' ? '.kml' : '.geojson'), HA.textB64(kind === 'k' ? LY.toKml(os, E.name) : LY.toGeoJson(os, E.name)), kind === 'k' ? 'application/vnd.google-earth.kml+xml' : 'application/geo+json'); }
    $('emK').onclick = function () { ex('k'); }; $('emG').onclick = function () { ex('g'); };
  }
  function work() { var os = clone(E.objs); os.forEach(function (o) { if (o.k === 'g') o.c[0] = ringOf(o); }); return os; }
  function fit() {
    var pts = []; E.objs.forEach(function (o) { ptsOf(o).forEach(function (p) { pts.push(p); }); });
    if (pts.length) { try { E.map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 19 }); } catch (e) {} }
  }

  // ---------- simpan / keluar ----------
  function save(then) {
    var nm = ($('edNm').value || '').trim() || 'Lapisan baru', os = work();
    if (!os.length) { HA.toast('Belum ada objek untuk disimpan'); return; }
    E.name = nm;
    var p = E.id ? LY.update(E.id, nm, os) : LY.storeNew(nm, os).then(function () { var ms = LY.metas(); E.id = ms[ms.length - 1].id; });
    p.then(function () { E.dirty = false; return draftClear(); }).then(function () { HA.toast('Lapisan disimpan'); if (then) then(); else bar(); }).catch(function (e) { HA.toast('Gagal menyimpan: ' + (e && e.message || e)); });
  }
  function close() {
    var d = $('edPg'); try { E.map.remove(); } catch (e) {} if (d) d.remove(); E = null;
    if (HA.SP && HA.SP.map) { HA.SP.map.invalidateSize(); if (HA.layRedraw) HA.layRedraw(); }
  }
  function back() {
    if (!E) return;
    if (E.draft.length) { E.draft = []; drawDraft(); bar(); return; }
    if (!E.dirty) { draftClear(); close(); return; }
    HA.openSheet('<div class="grab"></div><div class="st">SIMPAN PERUBAHAN?</div><div class="muted" style="margin:6px 0 12px">Ada perubahan yang belum disimpan pada "' + esc(E.name || 'Lapisan baru') + '".</div>' +
      '<div class="row" style="gap:8px"><button class="btn" id="exL" style="flex:1;height:50px">Lanjut</button><button class="btn" id="exB" style="flex:1;height:50px;color:var(--r)">Buang</button><button class="btn pri" id="exS" style="flex:1;height:50px">Simpan</button></div>');
    $('exL').onclick = HA.closeSheet;
    $('exB').onclick = function () { HA.closeSheet(); draftClear().then(close); };
    $('exS').onclick = function () { HA.closeSheet(); save(close); };
  }

  // ---------- buka ----------
  function start(id, name, objs, dirty) {
    var d = build(), center = [-4.95, 105.2], z = 14;
    E = { id: id, name: name, objs: normObjs(objs), sel: null, vi: null, tool: 'sel', draft: [], undo: [], redo: [], dirty: !!dirty, col: '#FFD84D', base: S.settings.mapMode === 'osm' ? 'osm' : 'sat', g: null, h: null, dl: null };
    $('edNm').value = name || '';
    $('edNm').oninput = function () { E.name = this.value; E.dirty = true; draftSave(); };
    var m = E.map = L.map('edMap', { zoomControl: false, doubleClickZoom: false, preferCanvas: false, fadeAnimation: false }).setView(center, z);
    if (HA.SP && HA.SP.map) { try { m.setView(HA.SP.map.getCenter(), Math.min(19, Math.max(12, HA.SP.map.getZoom()))); } catch (e) {} } else if (HA.map) { try { m.setView(HA.map.getCenter(), HA.map.getZoom()); } catch (e) {} }
    HA.setBase(m, E.base);
    m.on('click', onMap);
    $('edBk').onclick = back; $('edMn').onclick = menu; $('edSv').onclick = function () { save(); };
    $('edBar').onclick = function (ev) {
      var t = ev.target.closest('[data-tool]'); if (t) { setTool(t.getAttribute('data-tool')); return; }
      var a = ev.target.closest('[data-a]'); if (!a || a.disabled) return; a = a.getAttribute('data-a');
      if (a === 'un') doUndo(); else if (a === 're') doRedo(); else if (a === 'dun') { E.draft.pop(); drawDraft(); bar(); } else if (a === 'dx') { E.draft = []; drawDraft(); bar(); } else if (a === 'dok') finishShape();
      else if (a === 'pr') props(); else if (a === 'do') delObj(); else if (a === 'dv') delVertex();
    };
    setTimeout(function () { if (!E) return; m.invalidateSize(); if (E.objs.length) fit(); render(); bar(); }, 60);
  }
  function openEd(id) {
    if (E) return;
    if (!window.L) { HA.toast('Peta tidak tersedia'); return; }
    function begin() {
      if (id) {
        var mt = LY.metas().filter(function (z) { return z.id === id; })[0]; if (!mt) return;
        if (mt.n > MAXO) { HA.toast('Lapisan terlalu besar untuk diedit (maks ' + MAXO + ' objek, ini ' + mt.n + ')'); return; }
        LY.load(id).then(function (o) { start(id, mt.name, clone(o), false); });
      } else start(null, '', [], false);
    }
    LY.dbGet('draft').then(function (d) {
      if (!d || !d.objs || !d.objs.length) { begin(); return; }
      var when = new Date(d.ts), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
      HA.askConfirm('Lanjutkan draf?', 'Ada draf "' + (d.name || 'Lapisan baru') + '" yang belum disimpan (' + d.objs.length + ' objek, ' + p2(when.getDate()) + '.' + p2(when.getMonth() + 1) + ' ' + p2(when.getHours()) + '.' + p2(when.getMinutes()) + '). Batal = buang draf.', 'Lanjutkan', function () {
        var mt = d.target && LY.metas().filter(function (z) { return z.id === d.target; })[0];
        start(mt ? d.target : null, d.name || '', clone(d.objs), true);
      });
      var cn = $('cfNo'); if (cn) cn.onclick = function () { HA.closeSheet(); draftClear().then(begin); };
    });
  }
  HA.ED = { open: openEd, back: back, isOpen: function () { return !!E; }, _s: function () { return E; } };
})();
