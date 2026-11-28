/* HZ Trip - Lapisan Objek (v0.21.0): bangunan, pemukiman, sungai, jembatan, dst. Jenis bisa diubah; objek titik/garis/area dengan catatan sendiri. */
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
  var BENTUK = { pt: 'Titik', ln: 'Garis', pg: 'Area' };

  function jenis() {
    var a = S.settings.objJ;
    if (!a) {
      a = S.settings.objJ = [
        { id: 'bangunan', name: 'Bangunan', t: 'pg', col: '#6D4C41', pat: 'none', pc: '#000000', sym: 'B' },
        { id: 'pemukiman', name: 'Pemukiman', t: 'pg', col: '#FB8C00', pat: 'd1', pc: '#000000', sym: 'P' },
        { id: 'sungai', name: 'Sungai', t: 'ln', col: '#1E88E5', pat: 'none', pc: '#000000', sym: 'S' },
        { id: 'jembatan', name: 'Jembatan', t: 'pt', col: '#757575', pat: 'none', pc: '#000000', sym: 'J' }
      ];
    }
    return a;
  }
  function objs() { return S.settings.obj || (S.settings.obj = []); }
  function jBy(id) { var r = null; jenis().forEach(function (j) { if (j.id === id) r = j; }); return r; }
  function on() { return S.settings.objOn !== false; }
  function dkm(a, b) { var R = 6371000, p = Math.PI / 180, x = (b[1] - a[1]) * p * Math.cos((a[0] + b[0]) / 2 * p), y = (b[0] - a[0]) * p; return Math.sqrt(x * x + y * y) * R; }
  function lenM(pts) { var t = 0, i; for (i = 1; i < pts.length; i++) t += dkm(pts[i - 1], pts[i]); return t; }
  function nf(v, d) { return Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function sizeTxt(o) {
    if (o.t === 'pt') return o.pts[0][0].toFixed(5) + ', ' + o.pts[0][1].toFixed(5);
    if (o.t === 'ln') return nf(lenM(o.pts), 0) + ' m';
    var ha = window.HzBlok ? HzBlok.areaHa(o.pts) : 0; return ha < 1 ? nf(ha * 10000, 0) + ' m²' : nf(ha, 2) + ' ha';
  }
  function bb(pts) { var s = 90, w = 180, n = -90, e = -180; pts.forEach(function (p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; }); return [s, w, n, e]; }
  function cen(pts) { var a = 0, b = 0; pts.forEach(function (p) { a += p[0]; b += p[1]; }); return [a / pts.length, b / pts.length]; }

  // ---------- gambar PDF ----------
  // o: { mb:[s,w,n,e], X, Y, f2, pe, gs, labels }  ->  { s, used }
  function drawPdf(o) {
    var s = '', used = {}, mb = o.mb, L = HA.lyb;
    if (!on() || !L) return { s: '', used: used };
    objs().forEach(function (ob) {
      var j = jBy(ob.j); if (!j || !ob.pts || !ob.pts.length) return;
      var q = bb(ob.pts); if (q[2] < mb[0] || q[0] > mb[2] || q[3] < mb[1] || q[1] > mb[3]) return;
      used[j.id] = 1;
      var xy = ob.pts.map(function (p) { return [o.X(p[1]), o.Y(p[0])]; }), lx, ly;
      if (ob.t === 'pg') {
        s += L.fillPdf({ col: j.col, pat: j.pat, pc: j.pc }, xy, o.gs);
        s += 'q ' + L.rgb(j.col) + ' RG 0.8 w ' + L.pathOf(xy) + 'S Q\n';
        var c = cen(xy); lx = c[0]; ly = c[1];
      } else if (ob.t === 'ln') {
        s += 'q ' + L.rgb(j.col) + ' RG 1.8 w 1 J 1 j ' + xy.map(function (p, i) { return o.f2(p[0]) + ' ' + o.f2(p[1]) + (i ? ' l ' : ' m '); }).join('') + 'S Q\n';
        var mid = xy[Math.floor(xy.length / 2)]; lx = mid[0]; ly = mid[1];
      } else {
        var p0 = xy[0], sy = String(j.sym || '').slice(0, 2);
        s += 'q ' + L.rgb(j.col) + ' rg 1 G 0.6 w ' + o.f2(p0[0] - 4.5) + ' ' + o.f2(p0[1] - 4.5) + ' 9 9 re B Q\n';
        s += 'q 1 g BT /F2 6 Tf ' + o.f2(p0[0] - sy.length * 1.9) + ' ' + o.f2(p0[1] - 2.1) + ' Td (' + o.pe(sy) + ') Tj ET Q\n';
        lx = p0[0] + 7; ly = p0[1] - 2;
      }
      if (o.labels) {
        var nm = o.pe(j.name), wx = ob.t === 'pt' ? lx : lx - nm.length * 1.5;
        s += 'q 1 G 1 j 2.2 w 1 Tr BT /F1 6 Tf ' + o.f2(wx) + ' ' + o.f2(ly) + ' Td (' + nm + ') Tj ET Q q 0 g BT /F1 6 Tf ' + o.f2(wx) + ' ' + o.f2(ly) + ' Td (' + nm + ') Tj ET Q\n';
      }
    });
    return { s: s, used: used };
  }
  function geoFeatures(bbox) {
    if (!on()) return [];
    var f = [];
    objs().forEach(function (ob) {
      var j = jBy(ob.j); if (!j || !ob.pts || !ob.pts.length) return;
      if (bbox) { var q = bb(ob.pts); if (q[2] < bbox[0] || q[0] > bbox[2] || q[3] < bbox[1] || q[1] > bbox[3]) return; }
      var cc = ob.pts.map(function (p) { return [+(+p[1]).toFixed(7), +(+p[0]).toFixed(7)]; });
      f.push({ type: 'Feature', properties: { jenis: 'objek', objek: j.name, catatan: ob.note || '', warna: j.col }, geometry: ob.t === 'pt' ? { type: 'Point', coordinates: cc[0] } : (ob.t === 'ln' ? { type: 'LineString', coordinates: cc } : { type: 'Polygon', coordinates: [cc.concat([cc[0]])] }) });
    });
    return f;
  }
  function kmlFolder(bbox) {
    if (!on()) return '';
    function xe(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function kc(h) { h = String(h).replace('#', ''); return 'ff' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); }
    var x = '';
    objs().forEach(function (ob) {
      var j = jBy(ob.j); if (!j || !ob.pts || !ob.pts.length) return;
      if (bbox) { var q = bb(ob.pts); if (q[2] < bbox[0] || q[0] > bbox[2] || q[3] < bbox[1] || q[1] > bbox[3]) return; }
      var co = ob.pts.map(function (p) { return (+p[1]).toFixed(7) + ',' + (+p[0]).toFixed(7) + ',0'; });
      var st = '<Style><LineStyle><color>' + kc(j.col) + '</color><width>2</width></LineStyle><PolyStyle><color>66' + kc(j.col).slice(2) + '</color></PolyStyle><IconStyle><color>' + kc(j.col) + '</color></IconStyle></Style>';
      var g = ob.t === 'pt' ? '<Point><coordinates>' + co[0] + '</coordinates></Point>' : (ob.t === 'ln' ? '<LineString><coordinates>' + co.join(' ') + '</coordinates></LineString>' : '<Polygon><outerBoundaryIs><LinearRing><coordinates>' + co.concat([co[0]]).join(' ') + '</coordinates></LinearRing></outerBoundaryIs></Polygon>');
      x += '<Placemark><name>' + xe(j.name) + '</name><description>' + xe(ob.note || '') + '</description>' + st + g + '</Placemark>';
    });
    return x ? '<Folder><name>Objek</name>' + x + '</Folder>' : '';
  }

  // ---------- gambar peta ----------
  function draw() {
    var m = HA.map; if (!m) return;
    if (HA.objLayer) { try { m.removeLayer(HA.objLayer); } catch (e) {} HA.objLayer = null; }
    if (S.settings.objShow === false || !objs().length || m.getZoom() < 15) return;
    var g = L.layerGroup(), b = m.getBounds().pad(0.2), n = 0;
    objs().forEach(function (ob) {
      var j = jBy(ob.j); if (!j || !ob.pts || !ob.pts.length || n > 500) return;
      var q = bb(ob.pts); if (q[2] < b.getSouth() || q[0] > b.getNorth() || q[3] < b.getWest() || q[1] > b.getEast()) return; n++;
      if (ob.t === 'pt') {
        var mk = L.marker(ob.pts[0], { icon: L.divIcon({ className: '', html: '<div class="obPt" style="background:' + esc(j.col) + '">' + esc(String(j.sym || '').slice(0, 2)) + '</div>', iconSize: [24, 24] }), zIndexOffset: 300 }).addTo(g);
        mk.on('click', function (e) { L.DomEvent.stopPropagation(e); info(ob); });
      } else if (ob.t === 'ln') L.polyline(ob.pts, { color: j.col, weight: 3.5, opacity: 0.95, interactive: false }).addTo(g);
      else L.polygon(ob.pts, { color: j.col, weight: 2, fillColor: j.col, fillOpacity: j.pat && j.pat !== 'none' ? 0.2 : 0.4, dashArray: j.pat && j.pat !== 'none' ? '5 3' : null, interactive: false }).addTo(g);
    });
    g.addTo(m); HA.objLayer = g;
  }
  setInterval(function () { var m = HA.map; if (m && !m._objHook) { m._objHook = 1; m.on('moveend zoomend', draw); draw(); } }, 1500);

  // ---------- halaman Objek ----------
  function pv(j) {
    if (j.t === 'pt') return '<span class="obPt obPv" style="background:' + esc(j.col) + '">' + esc(String(j.sym || '').slice(0, 2)) + '</span>';
    if (j.t === 'ln') return '<svg width="44" height="26" viewBox="0 0 44 26" class="lbSw"><path d="M2 20 Q14 2 24 14 T42 6" fill="none" stroke="' + esc(j.col) + '" stroke-width="4" stroke-linecap="round"/></svg>';
    return HA.lyb.prevSvg({ mode: 'fill' }, j);
  }
  function home() {
    var js = jenis();
    openSheet('<div class="grab"></div><div class="bth"><div class="st">OBJEK</div><button class="btn pri" id="obX">Selesai</button></div>' +
      '<div class="muted" style="margin:4px 0 8px">Hal tetap di peta seperti bangunan, pemukiman, sungai, jembatan. Beda dengan Kategori (kegiatan bertanggal). Jenis bisa diubah dan ditambah sendiri.</div>' +
      '<button class="btn pri" id="obAdd" style="width:100%;height:52px">+ Tambah objek</button>' +
      '<button class="btn" id="obLs" style="width:100%;margin-top:8px">Daftar objek (' + objs().length + ')</button>' +
      '<label class="lbOn" style="margin-top:10px"><input type="checkbox" id="obOn"' + (on() ? ' checked' : '') + '> Ikut cetak (layer Objek di PDF, KML, GeoJSON)</label>' +
      '<label class="lbOn" style="margin-top:6px"><input type="checkbox" id="obSh"' + (S.settings.objShow !== false ? ' checked' : '') + '> Tampil di peta</label>' +
      '<div class="h" style="margin-top:12px">JENIS</div><div class="lbList">' + js.map(function (j) {
        var nb = objs().filter(function (o) { return o.j === j.id; }).length;
        return '<div class="lbRow"><button type="button" class="lbIt" data-j="' + j.id + '">' + pv(j) + '<span class="lbNm"><b>' + esc(j.name) + '</b><span class="muted"> · ' + BENTUK[j.t] + ' · ' + nb + '</span></span></button></div>';
      }).join('') + '</div>' +
      '<button class="btn" id="obNj" style="width:100%;margin-top:8px">+ Jenis baru</button>' +
      '<button class="btn" id="obBk" style="width:100%;margin-top:8px">Kembali</button>');
    $('obX').onclick = closeSheet; $('obBk').onclick = function () { HA.lyb.home(); };
    $('obAdd').onclick = pickJenis; $('obLs').onclick = function () { daftar(''); };
    $('obOn').onchange = function () { S.settings.objOn = this.checked; save(); };
    $('obSh').onchange = function () { S.settings.objShow = this.checked; save(); draw(); };
    $('obNj').onclick = function () { jEdit(null); };
    $('sheet').querySelectorAll('[data-j]').forEach(function (e) { e.onclick = function () { jEdit(jBy(e.getAttribute('data-j'))); }; });
  }
  function jEdit(j) {
    var nw = !j, d = j ? JSON.parse(JSON.stringify(j)) : { id: 'j' + Date.now().toString(36), name: '', t: 'pg', col: HA.lyb.PAL[0], pat: 'none', pc: '#000000', sym: 'O' };
    var PATS = HA.lyb.PATS, PAL = HA.lyb.PAL;
    function body() {
      var h = '<input type="text" id="jeN" maxlength="30" placeholder="Nama jenis, mis. Bengkel" value="' + esc(d.name) + '" style="width:100%;margin-top:8px">' +
        '<div class="h" style="margin-top:10px">BENTUK</div><div class="seg" id="jeT">' + ['pt', 'ln', 'pg'].map(function (k) { return '<button data-v="' + k + '"' + (d.t === k ? ' class="on"' : '') + '>' + BENTUK[k] + '</button>'; }).join('') + '</div>' +
        '<div class="h" style="margin-top:10px">WARNA</div><div class="lbQ">' + PAL.map(function (c) { return '<button type="button" class="lbC' + (d.col === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '<input type="color" id="jeC" value="' + esc(d.col) + '"></div>';
      if (d.t === 'pt') h += '<div class="h" style="margin-top:10px">HURUF DI TITIK (1-2)</div><input type="text" id="jeS" maxlength="2" value="' + esc(d.sym) + '" style="width:100%">';
      if (d.t === 'pg') h += '<div class="h" style="margin-top:10px">POLA ARSIR</div><div class="lbQ">' + PATS.map(function (p) { return '<button type="button" class="btn sm' + (d.pat === p[0] ? ' pri' : '') + '" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        '<div class="h" style="margin-top:10px">WARNA ARSIR</div><div class="lbQ">' + ['#000000', '#FFFFFF'].concat(PAL).map(function (c) { return '<button type="button" class="lbC' + (d.pc === c ? ' on' : '') + '" data-pc="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div>';
      return h + '<div class="h" style="margin-top:10px">CONTOH</div><div class="lbPv">' + pv(d) + ' <b>' + esc(d.name || '(nama)') + '</b></div>';
    }
    function draw2() {
      openSheet('<div class="grab"></div><div class="bth"><div class="st">' + (nw ? 'JENIS BARU' : 'EDIT JENIS') + '</div><button class="btn pri" id="jeOk">Simpan</button></div><div id="jeB">' + body() + '</div>' +
        (nw ? '' : '<button class="btn danger" id="jeDel" style="width:100%;margin-top:10px">Hapus jenis</button>') + '<button class="btn" id="jeBk" style="width:100%;margin-top:8px">Batal</button>');
      $('jeN').oninput = function () { d.name = this.value; };
      $('jeT').onclick = function (e) { var b = e.target.closest && e.target.closest('button[data-v]'); if (b) { d.t = b.getAttribute('data-v'); keep(); } };
      $('sheet').querySelectorAll('[data-c]').forEach(function (e) { e.onclick = function () { d.col = e.getAttribute('data-c'); keep(); }; });
      $('sheet').querySelectorAll('[data-pc]').forEach(function (e) { e.onclick = function () { d.pc = e.getAttribute('data-pc'); keep(); }; });
      $('sheet').querySelectorAll('[data-p]').forEach(function (e) { e.onclick = function () { d.pat = e.getAttribute('data-p'); keep(); }; });
      if ($('jeC')) $('jeC').onchange = function () { d.col = this.value; keep(); };
      if ($('jeS')) $('jeS').oninput = function () { d.sym = this.value; };
      $('jeBk').onclick = home;
      $('jeOk').onclick = function () {
        d.name = (d.name || '').trim(); if (!d.name) { toast('Isi nama jenis'); return; }
        if (d.t === 'pt' && !String(d.sym || '').trim()) d.sym = d.name.charAt(0).toUpperCase();
        if (jenis().some(function (x) { return x.id !== d.id && x.name.toLowerCase() === d.name.toLowerCase(); })) { toast('Nama sudah dipakai'); return; }
        var changed = !nw && j.t !== d.t;
        if (nw) jenis().push(d); else jenis()[jenis().indexOf(j)] = d;
        if (changed) objs().forEach(function (o) { if (o.j === d.id && o.t !== d.t) o.j = ''; });
        save(); draw(); home();
      };
      if ($('jeDel')) $('jeDel').onclick = function () {
        var nb = objs().filter(function (o) { return o.j === j.id; }).length;
        HA.askConfirm('Hapus jenis ' + j.name + '?', nb ? nb + ' objek jenis ini ikut dihapus dari peta.' : 'Belum ada objek jenis ini.', 'Hapus', function () {
          S.settings.obj = objs().filter(function (o) { return o.j !== j.id; }); S.settings.objJ = jenis().filter(function (x) { return x !== j; }); save(); draw(); home();
        });
      };
    }
    function keep() { var nm = d.name; draw2(); $('jeN').value = nm; }
    draw2();
  }

  // ---------- tambah objek ----------
  function needMap(fn) {
    var was = S.view === 'lintasan' && !!HA.map, n = 0; HA.mapKeep = true; if (!was) HA.go('lintasan');
    (function tick() { if (HA.map && (was || n > 2)) { if (HA.closeAll) HA.closeAll(); fn(); return; } if (++n < 30) setTimeout(tick, 300); })();
  }
  function pickJenis() {
    var js = jenis();
    openSheet('<div class="grab"></div><div class="bth"><div class="st">PILIH JENIS</div><button class="btn" id="pjX">Batal</button></div><div class="lbList">' + js.map(function (j) {
      return '<div class="lbRow"><button type="button" class="lbIt" data-j="' + j.id + '">' + pv(j) + '<span class="lbNm"><b>' + esc(j.name) + '</b><span class="muted"> · ' + BENTUK[j.t] + '</span></span></button></div>';
    }).join('') + '</div>');
    $('pjX').onclick = home;
    $('sheet').querySelectorAll('[data-j]').forEach(function (e) { e.onclick = function () { gambar(jBy(e.getAttribute('data-j'))); }; });
  }
  function bar(txt, onCancel) {
    var el = document.createElement('div'); el.className = 'lkbar bot'; el.innerHTML = '<span>' + esc(txt) + '</span><button type="button" class="btn sm" id="obCx">Batal</button>';
    HA.map.getContainer().appendChild(el); L.DomEvent.disableClickPropagation(el);
    $('obCx').onclick = function () { el.remove(); onCancel(); };
    return el;
  }
  function gambar(j) {
    if (!j) return;
    closeSheet();
    needMap(function () {
      var m = HA.map;
      if (j.t === 'pt') {
        var done = false, el = bar('Ketuk peta untuk menaruh ' + j.name, function () { done = true; m.off('click', tap); home(); });
        function tap(e) { if (done) return; done = true; el.remove(); m.off('click', tap); noteSheet(null, { j: j.id, t: 'pt', pts: [[+e.latlng.lat.toFixed(7), +e.latlng.lng.toFixed(7)]] }); }
        m.on('click', tap);
        return;
      }
      var c = m.getCenter(), P = m.latLngToContainerPoint(c), off = 50;
      function mk(dx, dy) { var ll = m.containerPointToLatLng(L.point(P.x + dx, P.y + dy)); return [ll.lat, ll.lng]; }
      var init = j.t === 'ln' ? [mk(-off, 0), mk(off, 0)] : [mk(-off, -off), mk(off, -off), mk(off, off), mk(-off, off)];
      toast('Geser titik ke tempatnya. + Titik untuk menambah titik');
      HA.editPoly(init, j.t === 'pg', function (res) {
        if (!res) { home(); return; }
        noteSheet(null, { j: j.id, t: j.t, pts: res.map(function (p) { return [+(+p[0]).toFixed(7), +(+p[1]).toFixed(7)]; }) });
      });
    });
  }
  function noteSheet(ob, nw) {
    var o = ob || nw, j = jBy(o.j), fit = j && o.t === j.t;
    openSheet('<div class="grab"></div><div class="bth"><div class="st">' + (ob ? 'EDIT OBJEK' : 'OBJEK BARU') + '</div><button class="btn pri" id="onS">Simpan</button></div>' +
      '<div class="h" style="margin-top:8px">JENIS</div><select id="onJ" style="width:100%">' + jenis().filter(function (x) { return x.t === o.t; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === o.j ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
      '<div class="h" style="margin-top:10px">CATATAN</div><textarea id="onN" rows="3" maxlength="200" placeholder="Catatan sendiri, mis. Bengkel Div 2" style="width:100%">' + esc(o.note || '') + '</textarea>' +
      '<div class="muted" style="margin-top:6px">' + esc(sizeTxt(o)) + '</div>' +
      '<button class="btn" id="onC" style="width:100%;margin-top:10px">' + (ob ? 'Batal' : 'Buang') + '</button>');
    void fit;
    $('onC').onclick = function () { if (ob) info(ob); else home(); };
    $('onS').onclick = function () {
      o.j = $('onJ').value; o.note = $('onN').value.trim();
      if (!ob) { o.id = 'o' + Date.now().toString(36); o.ts = Date.now(); objs().push(o); }
      save(); draw(); toast('Objek tersimpan'); if (ob) info(ob); else home();
    };
  }
  function info(ob) {
    var j = jBy(ob.j);
    openSheet('<div class="grab"></div><div class="bth"><div class="st">' + esc((j ? j.name : 'Objek').toUpperCase()) + '</div><button class="btn pri" id="ioX">Tutup</button></div>' +
      '<div class="muted" style="margin:6px 0">' + BENTUK[ob.t] + ' · ' + esc(sizeTxt(ob)) + '</div>' + (ob.note ? '<div class="card">' + esc(ob.note) + '</div>' : '<div class="muted">Tanpa catatan.</div>') +
      '<button class="btn" id="ioK" style="width:100%;margin-top:10px">Ke peta</button>' +
      '<div class="row" style="gap:6px;margin-top:8px"><button class="btn" id="ioE" style="flex:1">Catatan / jenis</button><button class="btn" id="ioB" style="flex:1">Ubah bentuk</button></div>' +
      '<button class="btn danger" id="ioD" style="width:100%;margin-top:8px">Hapus objek</button>');
    $('ioX').onclick = closeSheet;
    $('ioK').onclick = function () { closeSheet(); needMap(function () { var b = bb(ob.pts); if (ob.t === 'pt') HA.map.setView(ob.pts[0], Math.max(HA.map.getZoom(), 18)); else HA.map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: [50, 50], maxZoom: 19 }); }); };
    $('ioE').onclick = function () { noteSheet(ob); };
    $('ioB').onclick = function () {
      closeSheet();
      needMap(function () {
        var m = HA.map;
        if (ob.t === 'pt') { var el = bar('Ketuk peta untuk memindahkan', function () { m.off('click', tap); info(ob); }); function tap(e) { el.remove(); m.off('click', tap); ob.pts = [[+e.latlng.lat.toFixed(7), +e.latlng.lng.toFixed(7)]]; save(); draw(); info(ob); } m.on('click', tap); return; }
        HA.editPoly(ob.pts, ob.t === 'pg', function (res) { if (res) { ob.pts = res.map(function (p) { return [+(+p[0]).toFixed(7), +(+p[1]).toFixed(7)]; }); save(); draw(); } info(ob); });
      });
    };
    $('ioD').onclick = function () { HA.askConfirm('Hapus objek ini?', (j ? j.name : 'Objek') + (ob.note ? ' · ' + ob.note : ''), 'Hapus', function () { S.settings.obj = objs().filter(function (x) { return x !== ob; }); save(); draw(); daftar(''); }); };
  }
  function daftar(q) {
    var ql = String(q || '').toLowerCase(), col = new Intl.Collator('id', { numeric: true });
    var ls = objs().filter(function (o) { var j = jBy(o.j); return !ql || (j && j.name.toLowerCase().indexOf(ql) >= 0) || String(o.note || '').toLowerCase().indexOf(ql) >= 0; }).sort(function (a, b) { var ja = jBy(a.j), jb = jBy(b.j); return col.compare(ja ? ja.name : '', jb ? jb.name : '') || col.compare(a.note || '', b.note || ''); });
    var cut = ls.slice(0, 100);
    openSheet('<div class="grab"></div><div class="bth"><div class="st">DAFTAR OBJEK</div><button class="btn" id="dlX">Kembali</button></div>' +
      '<input type="search" id="dlQ" placeholder="Cari jenis atau catatan" value="' + esc(q || '') + '" style="width:100%;margin-top:8px"><div id="dlL" class="lbList">' + (cut.map(function (o) {
        var j = jBy(o.j);
        return '<div class="lbRow"><button type="button" class="lbIt" data-o="' + o.id + '">' + (j ? pv(j) : '') + '<span class="lbNm"><b>' + esc(j ? j.name : '(jenis dihapus)') + '</b><span class="muted"> · ' + esc(sizeTxt(o)) + '</span>' + (o.note ? '<br><span class="muted">' + esc(o.note) + '</span>' : '') + '</span></button></div>';
      }).join('') || '<div class="muted" style="padding:10px 0">Belum ada objek.</div>') + (ls.length > cut.length ? '<div class="muted" style="padding:8px 0">' + (ls.length - cut.length) + ' lagi. Gunakan pencarian.</div>' : '') + '</div>');
    $('dlX').onclick = home;
    $('dlQ').onchange = function () { daftar(this.value); };
    $('sheet').querySelectorAll('[data-o]').forEach(function (e) { e.onclick = function () { var o = objs().filter(function (x) { return x.id === e.getAttribute('data-o'); })[0]; if (o) info(o); }; });
  }

  HA.obj = { open: home, jenis: jenis, objs: objs, on: on, drawPdf: drawPdf, geoFeatures: geoFeatures, kmlFolder: kmlFolder, draw: draw, jBy: jBy };
})();
