/* HZ Trip v0.16.5 - Lapisan berkas di SpidoMap (lihat saja): KML, KMZ, GPX, GeoJSON. Salin ke tanda per objek / per blok. Ekspor KML/GeoJSON. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.SP) return;
  var S = HA.S, MAXL = 10, WARN_N = 20000, STOP_N = 50000, WARN_B = 15 * 1024 * 1024, DRAWCAP = 4000, DBN = 'hzlay';
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  function metas() { return S.settings.layers || (S.settings.layers = []); }
  // ---------- penyimpanan (IndexedDB, di luar pengaturan) ----------
  var DB = null, MEM = {};
  function db() {
    if (DB) return DB;
    DB = new Promise(function (res, rej) { try { var r = indexedDB.open(DBN, 1); r.onupgradeneeded = function () { r.result.createObjectStore('l', { keyPath: 'id' }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (x) { rej(x); } });
    DB.catch(function () { DB = null; });
    return DB;
  }
  function dbPut(v) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('l', 'readwrite'); t.objectStore('l').put(v); t.oncomplete = res; t.onerror = function () { rej(t.error); }; }); }); }
  function dbGet(id) { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('l').objectStore('l').get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function dbDel(id) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('l', 'readwrite'); t.objectStore('l').delete(id); t.oncomplete = res; t.onerror = res; }); }).catch(function () {}); }
  function load(id) { if (MEM[id]) return Promise.resolve(MEM[id]); return dbGet(id).then(function (r) { if (r) MEM[id] = r.objs; return r ? r.objs : []; }); }
  // ---------- parser ----------
  function kc(s) { // KML aabbggrr -> {c:'#rrggbb', o}
    s = String(s || '').trim(); if (!/^[0-9a-fA-F]{8}$/.test(s)) return null;
    return { c: '#' + s.substr(6, 2) + s.substr(4, 2) + s.substr(2, 2), o: parseInt(s.substr(0, 2), 16) / 255 };
  }
  function txt(e, tag) { var n = e && e.getElementsByTagName(tag)[0]; return n ? n.textContent : ''; }
  function coords(s) { var o = []; String(s || '').trim().split(/\s+/).forEach(function (t) { var a = t.split(','); var lo = parseFloat(a[0]), la = parseFloat(a[1]); if (isFinite(la) && isFinite(lo)) o.push([la, lo]); }); return o; }
  function parseKml(text) {
    var doc = new DOMParser().parseFromString(text, 'text/xml'), err = doc.getElementsByTagName('parsererror')[0];
    if (err) throw new Error('KML tidak valid');
    var styles = {};
    function stObj(st) { var ls = st.getElementsByTagName('LineStyle')[0], ps = st.getElementsByTagName('PolyStyle')[0], is = st.getElementsByTagName('IconStyle')[0], o = {}; if (ls) { var c = kc(txt(ls, 'color')); if (c) o.col = c.c; var w = parseFloat(txt(ls, 'width')); if (w) o.w = w; } if (ps) { var f = kc(txt(ps, 'color')); if (f) { o.fc = f.c; o.fo = f.o; } if (txt(ps, 'fill') === '0') o.nf = 1; if (txt(ps, 'outline') === '0') o.no = 1; } if (is) { var ic = kc(txt(is, 'color')); if (ic) o.ic = ic.c; if (txt(is, 'scale').trim() !== '' && parseFloat(txt(is, 'scale')) === 0) o.tx = 1; } return o; }
    Array.prototype.forEach.call(doc.getElementsByTagName('Style'), function (st) { var id = st.getAttribute('id'); if (id) styles['#' + id] = stObj(st); });
    Array.prototype.forEach.call(doc.getElementsByTagName('StyleMap'), function (sm) { var id = sm.getAttribute('id'); if (!id) return; Array.prototype.forEach.call(sm.getElementsByTagName('Pair'), function (p) { if (txt(p, 'key') === 'normal') { var u = txt(p, 'styleUrl'); if (styles[u]) styles[id ? '#' + id : u] = styles[u]; else { var inl = p.getElementsByTagName('Style')[0]; if (inl) styles['#' + id] = stObj(inl); } } }); });
    var out = [];
    Array.prototype.forEach.call(doc.getElementsByTagName('Placemark'), function (pm) {
      var name = txt(pm, 'name').trim(), desc = txt(pm, 'description'), su = txt(pm, 'styleUrl').trim(), st = styles[su] || {};
      var ins = pm.getElementsByTagName('Style')[0]; if (ins && ins.parentNode === pm) st = stObj(ins);
      function add(k, c) { out.push({ k: k, c: c, n: name, d: desc, tx: k === 'p' ? st.tx : 0, col: k === 'p' ? (st.ic || st.col) : st.col, fc: st.fc, fo: st.fo, nf: st.nf, no: st.no, w: st.w }); }
      Array.prototype.forEach.call(pm.getElementsByTagName('Point'), function (g) { var c = coords(txt(g, 'coordinates')); if (c[0]) add('p', c[0]); });
      Array.prototype.forEach.call(pm.getElementsByTagName('LineString'), function (g) { var c = coords(txt(g, 'coordinates')); if (c.length > 1) add('l', c); });
      Array.prototype.forEach.call(pm.getElementsByTagName('Polygon'), function (g) {
        var rings = [], ob = g.getElementsByTagName('outerBoundaryIs')[0]; if (ob) { var r0 = coords(txt(ob, 'coordinates')); if (r0.length > 2) rings.push(r0); }
        Array.prototype.forEach.call(g.getElementsByTagName('innerBoundaryIs'), function (ib) { var r = coords(txt(ib, 'coordinates')); if (r.length > 2) rings.push(r); });
        if (rings.length) add('g', rings);
      });
    });
    return out;
  }
  function parseGpx(text) {
    var doc = new DOMParser().parseFromString(text, 'text/xml'); if (doc.getElementsByTagName('parsererror')[0]) throw new Error('GPX tidak valid');
    var out = [];
    function pt(e) { var la = parseFloat(e.getAttribute('lat')), lo = parseFloat(e.getAttribute('lon')); return isFinite(la) && isFinite(lo) ? [la, lo] : null; }
    Array.prototype.forEach.call(doc.getElementsByTagName('wpt'), function (w) { var c = pt(w); if (c) out.push({ k: 'p', c: c, n: txt(w, 'name'), d: txt(w, 'desc') }); });
    Array.prototype.forEach.call(doc.getElementsByTagName('trk'), function (t) { var n = txt(t, 'name'); Array.prototype.forEach.call(t.getElementsByTagName('trkseg'), function (sg) { var c = []; Array.prototype.forEach.call(sg.getElementsByTagName('trkpt'), function (p) { var q = pt(p); if (q) c.push(q); }); if (c.length > 1) out.push({ k: 'l', c: c, n: n, d: txt(t, 'desc') }); }); });
    Array.prototype.forEach.call(doc.getElementsByTagName('rte'), function (r) { var c = []; Array.prototype.forEach.call(r.getElementsByTagName('rtept'), function (p) { var q = pt(p); if (q) c.push(q); }); if (c.length > 1) out.push({ k: 'l', c: c, n: txt(r, 'name'), d: txt(r, 'desc') }); });
    return out;
  }
  function parseGeoJson(text) {
    var j; try { j = JSON.parse(text); } catch (e) { throw new Error('GeoJSON tidak valid'); }
    var out = [];
    function ll(c) { return [c[1], c[0]]; }
    function geom(g, pr) {
      if (!g) return; pr = pr || {};
      var o = { tx: pr.tx ? 1 : 0, n: pr.name || pr.Name || pr.NAME || '', d: pr.description || pr.desc || '', col: pr.stroke || pr.color, fc: pr.fill, fo: pr['fill-opacity'], w: pr['stroke-width'] };
      if (!o.n) { var ks = Object.keys(pr); for (var i = 0; i < ks.length; i++) if (typeof pr[ks[i]] === 'string' && pr[ks[i]]) { o.n = pr[ks[i]]; break; } }
      function push(k, c) { var z = {}; for (var q in o) z[q] = o[q]; z.k = k; z.c = c; out.push(z); }
      var t = g.type, c = g.coordinates;
      if (t === 'Point') push('p', ll(c));
      else if (t === 'MultiPoint') c.forEach(function (x) { push('p', ll(x)); });
      else if (t === 'LineString') push('l', c.map(ll));
      else if (t === 'MultiLineString') c.forEach(function (x) { push('l', x.map(ll)); });
      else if (t === 'Polygon') push('g', c.map(function (r) { return r.map(ll); }));
      else if (t === 'MultiPolygon') c.forEach(function (p) { push('g', p.map(function (r) { return r.map(ll); })); });
      else if (t === 'GeometryCollection') (g.geometries || []).forEach(function (x) { geom(x, pr); });
    }
    if (j.type === 'FeatureCollection') (j.features || []).forEach(function (f) { geom(f && f.geometry, f && f.properties); });
    else if (j.type === 'Feature') geom(j.geometry, j.properties);
    else geom(j, {});
    return out;
  }
  function bboxOf(o) {
    var s = 90, w = 180, n = -90, e = -180;
    function add(p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; }
    if (o.k === 'p') add(o.c); else if (o.k === 'l') o.c.forEach(add); else o.c[0].forEach(add);
    return [s, w, n, e];
  }
  function finish(objs) { objs.forEach(function (o) { o.bb = bboxOf(o); }); return objs; }
  HA.layParse = function (name, u8) {
    var ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '', lc = ext.toLowerCase();
    var dec = function (b) { return new TextDecoder('utf-8').decode(b); };
    if (lc === 'kmz' || (u8[0] === 0x50 && u8[1] === 0x4B)) return HA.zipRead(u8, /\.kml$/i).then(function (b) { if (!b) throw new Error('KMZ tanpa berkas KML'); return finish(parseKml(dec(b))); });
    var t = dec(u8);
    if (lc === 'gpx' || /<gpx[\s>]/i.test(t.slice(0, 2000))) return Promise.resolve(finish(parseGpx(t)));
    if (lc === 'geojson' || lc === 'json' || /^\s*[\{\[]/.test(t)) return Promise.resolve(finish(parseGeoJson(t)));
    if (lc === 'kml' || /<kml[\s>]/i.test(t.slice(0, 2000))) return Promise.resolve(finish(parseKml(t)));
    return Promise.reject(new Error('Format belum didukung (KML, KMZ, GPX, GeoJSON)'));
  };
  // ---------- gambar di SpidoMap ----------
  var grp = null, capWarned = false;
  function lc(o) { return o.col && /^#[0-9a-f]{6}$/i.test(o.col) ? o.col : '#ff4081'; }
  function drawObj(o) {
    var c = lc(o), l;
    if (o.k === 'p' && o.tx) l = L.marker(o.c, { icon: L.divIcon({ className: 'edTxW', html: '<div class="edTx" style="color:' + c + '">' + esc(o.n || '') + '</div>', iconSize: null }) });
    else if (o.k === 'p') l = L.circleMarker(o.c, { radius: 5, color: '#fff', weight: 1, fillColor: c, fillOpacity: 0.95 });
    else if (o.k === 'l') l = L.polyline(o.c, { color: c, weight: Math.max(1, Math.min(6, o.w || 2)), opacity: 0.95 });
    else l = L.polygon(o.c, { color: o.no ? 'transparent' : c, weight: o.no ? 0 : Math.max(1, Math.min(6, o.w || 2)), fill: !o.nf, fillColor: o.fc || c, fillOpacity: o.nf ? 0 : (o.fo != null ? Math.max(0.05, o.fo) : 0.25) });
    l.on('click', function (e) { if (e.originalEvent) L.DomEvent.stopPropagation(e); show(o, e.latlng); });
    return l;
  }
  function plain(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600); }
  var CUR = null;
  function show(o, ll) {
    var m = HA.SP.map; if (!m) return;
    CUR = o;
    var h = '<div style="min-width:150px"><b>' + esc(o.n || (o.k === 'p' ? 'Titik' : o.k === 'l' ? 'Garis' : 'Area')) + '</b>' + (o.d ? '<div style="margin-top:4px;max-width:220px">' + esc(plain(o.d)) + '</div>' : '') + '<div style="margin-top:6px"><button class="btn sm" id="lyCp">Salin ke tanda</button></div></div>';
    L.popup({ closeButton: true }).setLatLng(ll).setContent(h).openOn(m);
    setTimeout(function () { var b = $('lyCp'); if (b) b.onclick = function () { m.closePopup(); copyDlg([o], 'Objek: ' + (o.n || 'tanpa nama')); }; }, 30);
  }
  var drawSeq = 0;
  function redraw() {
    var m = HA.SP.map; if (!m) return;
    if (grp) { m.removeLayer(grp); grp = null; }
    var vis = metas().filter(function (x) { return x.on; }); if (!vis.length) return;
    var seq = ++drawSeq, bd = m.getBounds(), s = bd.getSouth(), w = bd.getWest(), n = bd.getNorth(), e = bd.getEast(), capped = false;
    Promise.all(vis.map(function (x) { return load(x.id); })).then(function (all) {
      if (seq !== drawSeq) return;
      var ls = [];
      all.forEach(function (objs) {
        var k = 0;
        for (var i = 0; i < objs.length; i++) {
          var b = objs[i].bb; if (b[2] < s || b[0] > n || b[3] < w || b[1] > e) continue;
          if (++k > DRAWCAP) { capped = true; break; }
          ls.push(drawObj(objs[i]));
        }
      });
      grp = L.layerGroup(ls).addTo(m);
      if (capped && !capWarned) { capWarned = true; HA.toast('Terlalu banyak objek di layar, perbesar peta untuk melihat semua'); }
    });
  }
  HA.layRedraw = redraw;
  // ---------- geometri: potong ke blok ----------
  function pip(pt, ring) { var x = pt[1], y = pt[0], ins = false, i, j; for (i = 0, j = ring.length - 1; i < ring.length; j = i++) { if (((ring[i][0] > y) !== (ring[j][0] > y)) && (x < (ring[j][1] - ring[i][1]) * (y - ring[i][0]) / (ring[j][0] - ring[i][0]) + ring[i][1])) ins = !ins; } return ins; }
  function segX(a, b, c, d) { // titik potong ruas a-b dengan c-d: parameter t di a-b
    var r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], den = r0 * s1 - r1 * s0; if (Math.abs(den) < 1e-15) return null;
    var t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den, u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
  }
  function clipLine(pts, ring) {
    var out = [], cur = [];
    for (var i = 0; i + 1 < pts.length; i++) {
      var a = pts[i], b = pts[i + 1], ts = [0, 1], j;
      for (j = 0; j < ring.length; j++) { var t = segX(a, b, ring[j], ring[(j + 1) % ring.length]); if (t != null) ts.push(t); }
      ts.sort(function (x, y) { return x - y; });
      for (j = 0; j + 1 < ts.length; j++) {
        if (ts[j + 1] - ts[j] < 1e-12) continue;
        var p = [a[0] + (b[0] - a[0]) * ts[j], a[1] + (b[1] - a[1]) * ts[j]], q = [a[0] + (b[0] - a[0]) * ts[j + 1], a[1] + (b[1] - a[1]) * ts[j + 1]], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        if (pip(mid, ring)) { if (!cur.length) cur.push(p); cur.push(q); } else if (cur.length) { out.push(cur); cur = []; }
      }
    }
    if (cur.length) out.push(cur);
    return out.filter(function (c) { return c.length > 1; });
  }
  function clipPoly(rings, ring) {
    if (typeof polygonClipping === 'undefined') return [];
    var toXY = function (r) { return r.map(function (p) { return [p[1], p[0]]; }); }, res;
    try { res = polygonClipping.intersection([toXY(ring)], rings.map(function (r) { return toXY(r); }).slice(0, 1).concat([]).length ? [rings.map(toXY)] : []); } catch (e) { return []; }
    var out = []; (res || []).forEach(function (poly) { if (poly[0] && poly[0].length > 3) out.push(poly[0].slice(0, poly[0].length - 1).map(function (q) { return [q[1], q[0]]; })); });
    return out;
  }
  function bbHit(a, b) { return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]); }
  function bbPts(pts) { var s = 90, w = 180, n = -90, e = -180; pts.forEach(function (p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; }); return [s, w, n, e]; }
  // hasil salinan: daftar item tanda
  function buildItems(objs, blocks, cat, sub, date) {
    var out = [], bc = HA.tandaBrush && 0, now = Date.now(), k = 0;
    blocks.forEach(function (b) {
      var bb = bbPts(b.pts);
      objs.forEach(function (o) {
        if (!bbHit(o.bb, bb)) return;
        var base = { cat: cat, sub: sub || null, name: String(o.n || '').slice(0, 60), note: '', bid: b.id, date: date, ts: now + (k++) };
        if (o.k === 'p') { if (pip(o.c, b.pts)) out.push(Object.assign({ id: HA.tandaNewId(), t: 'pt', pts: [o.c] }, base)); }
        else if (o.k === 'l') clipLine(o.c, b.pts).forEach(function (seg) { out.push(Object.assign({ id: HA.tandaNewId(), t: 'ln', pts: seg }, base)); });
        else clipPoly(o.c, b.pts).forEach(function (r, i) { out.push(Object.assign({ id: HA.tandaNewId(), t: 'pg', pts: r, full: false, fsig: 'ly' + r[0][0].toFixed(6) + ',' + r[0][1].toFixed(6) }, base)); });
      });
    });
    return out;
  }
  HA.layBuildItems = buildItems; HA.layClipLine = clipLine;
  function copyDlg(objs, title, onlyBlock) {
    var T = HA.tandaData(), blocks = onlyBlock ? [onlyBlock] : (HA.blocksList() || []).filter(function (b) { return b.conf && b.pts && b.pts.length >= 3; });
    if (!T.cats.length) { HA.toast('Belum ada kategori tanda'); return; }
    var dt = S.today;
    function draw(cid, sid) {
      var cc = HA.tandaCatOf(cid) || T.cats[0], subs = cc.subs || [];
      HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">SALIN KE TANDA</div><button class="btn" id="lyX">Batal</button></div><div class="muted" style="margin:6px 0">' + esc(title) + ' · dipotong per blok Terkonfirmasi' + (onlyBlock ? ' (' + esc(onlyBlock.name) + ')' : '') + '</div>' +
        '<div class="fgR"><span>Kategori</span><select id="lyC" style="flex:1">' + T.cats.map(function (c) { return '<option value="' + c.id + '"' + (c.id === cc.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
        (subs.length ? '<div class="fgR"><span>Sub</span><select id="lyS" style="flex:1"><option value="">(tanpa sub)</option>' + subs.map(function (z) { return '<option value="' + z.id + '"' + (z.id === sid ? ' selected' : '') + '>' + esc(z.name || 'Sub') + '</option>'; }).join('') + '</select></div>' : '') +
        '<div class="fgR"><span>Tanggal</span><input type="date" id="lyD" value="' + dt + '" max="' + S.today + '"></div>' +
        '<button class="btn pri" id="lyY" style="width:100%;margin-top:12px;height:48px">Salin</button>');
      $('lyX').onclick = function () { HA.closeSheet(); };
      $('lyC').onchange = function () { dt = $('lyD').value || dt; draw(this.value, ''); };
      $('lyD').onchange = function () { dt = this.value || dt; };
      $('lyY').onclick = function () {
        var d = $('lyD').value || S.today, s = $('lyS') ? $('lyS').value : '', its = buildItems(objs, blocks, cc.id, s || null, d);
        if (!its.length) { HA.toast('Tidak ada bagian yang masuk blok Terkonfirmasi'); return; }
        its.forEach(function (it) { HA.tandaAdd(it); }); HA.tandaSave(); HA.closeSheet(); HA.toast(its.length + ' tanda disalin ke ' + cc.name); if (HA.KM && HA.KM.sync) HA.KM.sync();
      };
    }
    draw(T.cats[0].id, '');
  }
  // ---------- ekspor ----------
  function closed(r) { var a = r[0], b = r[r.length - 1]; return a[0] === b[0] && a[1] === b[1] ? r : r.concat([[a[0], a[1]]]); }
  function toGeoJson(objs, name) {
    return JSON.stringify({ type: 'FeatureCollection', name: name, features: objs.map(function (o) {
      var g = o.k === 'p' ? { type: 'Point', coordinates: [o.c[1], o.c[0]] } : o.k === 'l' ? { type: 'LineString', coordinates: o.c.map(function (p) { return [p[1], p[0]]; }) } : { type: 'Polygon', coordinates: o.c.map(function (r) { return closed(r).map(function (p) { return [p[1], p[0]]; }); }) };
      var pr = { name: o.n || '' }; if (o.tx) pr.tx = 1; if (o.d) pr.description = o.d; if (o.col) pr.stroke = o.col; if (o.fc) pr.fill = o.fc;
      return { type: 'Feature', properties: pr, geometry: g };
    }) });
  }
  function toKml(objs, name) {
    function cs(a) { return a.map(function (p) { return p[1].toFixed(7) + ',' + p[0].toFixed(7) + ',0'; }).join(' '); }
    function kcol(c) { return /^#[0-9a-f]{6}$/i.test(c || '') ? 'ff' + c.substr(5, 2) + c.substr(3, 2) + c.substr(1, 2) : 'ff8040ff'; }
    return '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + esc(name) + '</name>\n' + objs.map(function (o) {
      var st = '<Style><LineStyle><color>' + kcol(o.col) + '</color><width>' + (o.w || 2) + '</width></LineStyle><PolyStyle><color>' + (o.fc ? '66' + kcol(o.fc).substr(2) : '66' + kcol(o.col).substr(2)) + '</color></PolyStyle><IconStyle><color>' + kcol(o.col) + '</color>' + (o.tx ? '<scale>0</scale>' : '') + '</IconStyle>' + (o.tx ? '<LabelStyle><color>' + kcol(o.col) + '</color></LabelStyle>' : '') + '</Style>';
      var g = o.k === 'p' ? '<Point><coordinates>' + cs([o.c]) + '</coordinates></Point>' : o.k === 'l' ? '<LineString><coordinates>' + cs(o.c) + '</coordinates></LineString>' : '<Polygon><outerBoundaryIs><LinearRing><coordinates>' + cs(closed(o.c[0])) + '</coordinates></LinearRing></outerBoundaryIs>' + o.c.slice(1).map(function (r) { return '<innerBoundaryIs><LinearRing><coordinates>' + cs(closed(r)) + '</coordinates></LinearRing></innerBoundaryIs>'; }).join('') + '</Polygon>';
      return '<Placemark><name>' + esc(o.n || '') + '</name>' + (o.d ? '<description>' + esc(plain(o.d)) + '</description>' : '') + st + g + '</Placemark>';
    }).join('\n') + '\n</Document></kml>';
  }
  HA.layToGeoJson = toGeoJson; HA.layToKml = toKml;
  // ---------- kelola ----------
  // simpan hasil parse sebagai lapisan baru
  function store(name, objs) {
    var id = 'ly' + Date.now(), nm = name.replace(/\.[^.]+$/, '').slice(0, 40);
    return dbPut({ id: id, name: nm, ts: Date.now(), objs: objs }).then(function () {
      MEM[id] = objs; var bb = objs.reduce(function (a, o) { return [Math.min(a[0], o.bb[0]), Math.min(a[1], o.bb[1]), Math.max(a[2], o.bb[2]), Math.max(a[3], o.bb[3])]; }, [90, 180, -90, -180]);
      metas().push({ id: id, name: nm, n: objs.length, on: true, bb: bb }); HA.saveSettings();
      if (HA.SP.map) HA.SP.map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: [30, 30], maxZoom: 19 });
      redraw(); return objs.length;
    });
  }
  // berkas dari luar aplikasi (ketuk KML dll): kartu Tambah/Batal
  HA.layImport = function (name, u8) {
    return HA.layParse(name, u8).then(function (objs) {
      if (!objs.length) throw new Error('Tidak ada objek yang bisa ditampilkan');
      if (objs.length > STOP_N) throw new Error(objs.length + ' objek, melebihi batas ' + STOP_N);
      var full = metas().length >= MAXL, big = objs.length > WARN_N || u8.length > WARN_B;
      HA.openSheet('<div class="grab"></div><div class="st">BERKAS PETA DITERIMA</div><div class="card" style="margin-top:10px"><b>' + esc(name) + '</b><div class="muted" style="margin-top:4px">' + objs.length + ' objek · ' + (u8.length / 1048576).toFixed(1) + ' MB' + (big ? ' · besar, bisa lambat' : '') + '</div><div class="muted" style="margin-top:4px">Ditambahkan sebagai lapisan lihat-saja di SpidoMap.' + (full ? ' Sudah ' + MAXL + ' lapisan, hapus satu dulu.' : '') + '</div></div>' +
        '<div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="liX" style="flex:1">Batal</button><button class="btn pri" id="liY" style="flex:1"' + (full ? ' disabled' : '') + '>Tambah</button></div>');
      $('liX').onclick = function () { HA.closeSheet(); };
      $('liY').onclick = function () { HA.closeSheet(); store(name, objs).then(function (n) { HA.toast(n + ' objek ditambahkan. Lihat di SpidoMap'); }).catch(function (e) { HA.toast('Gagal menyimpan: ' + (e && e.message || e)); }); };
    }).catch(function (e) { HA.toast('Gagal membuka: ' + (e && e.message || e)); });
  };
  function addFile(f) {
    var ml = metas();
    if (ml.length >= MAXL) { HA.toast('Maksimal ' + MAXL + ' lapisan, hapus satu dulu'); return; }
    function go() {
      HA.toast('Membaca ' + f.name + '…');
      f.arrayBuffer().then(function (ab) { return HA.layParse(f.name, new Uint8Array(ab)); }).then(function (objs) {
        if (!objs.length) throw new Error('Tidak ada objek yang bisa ditampilkan');
        if (objs.length > STOP_N) throw new Error(objs.length + ' objek, melebihi batas ' + STOP_N);
        var id = 'ly' + Date.now(), nm = f.name.replace(/\.[^.]+$/, '').slice(0, 40);
        return dbPut({ id: id, name: nm, ts: Date.now(), objs: objs }).then(function () {
          MEM[id] = objs; var bb = objs.reduce(function (a, o) { return [Math.min(a[0], o.bb[0]), Math.min(a[1], o.bb[1]), Math.max(a[2], o.bb[2]), Math.max(a[3], o.bb[3])]; }, [90, 180, -90, -180]);
          metas().push({ id: id, name: nm, n: objs.length, on: true, bb: bb }); HA.saveSettings();
          if (HA.SP.map) HA.SP.map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: [30, 30], maxZoom: 19 });
          redraw(); HA.toast(objs.length + ' objek ditambahkan'); panel();
        });
      }).catch(function (e) { HA.toast('Gagal: ' + (e && e.message || e)); });
    }
    if (f.size > WARN_B) { HA.askConfirm('Berkas besar', 'Ukuran ' + (f.size / 1048576).toFixed(1) + ' MB (disarankan di bawah 15 MB). Bisa lambat. Lanjutkan?', 'Lanjutkan', go); return; }
    go();
  }
  function panel() {
    var ml = metas();
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">LAPISAN BERKAS</div><button class="btn pri" id="lyOk">Selesai</button></div>' +
      '<div class="muted" style="margin:6px 0">Hanya untuk dilihat di SpidoMap. KML, KMZ, GPX, GeoJSON (' + ml.length + '/' + MAXL + ' lapisan).</div>' +
      '<div class="row" style="gap:8px"><button class="btn pri" id="lyAdd" style="flex:1;height:48px">Tambah berkas</button><button class="btn" id="lyNew" style="flex:1;height:48px">Buat lapisan baru</button></div><input type="file" id="lyF" accept=".kml,.kmz,.gpx,.geojson,.json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/geo+json,application/json,*/*" style="display:none">' +
      '<div class="rbL" style="margin-top:10px">' + (ml.length ? ml.map(function (x, i) { return '<div class="rbR" data-i="' + i + '"><div class="rbT"><b>' + esc(x.name) + '</b><small>' + x.n + ' objek</small></div><button class="btn sm' + (x.on ? ' pri' : '') + '" data-t="' + i + '">' + (x.on ? 'Tampil' : 'Sembunyi') + '</button><button class="btn sm" data-m="' + i + '">Lainnya</button></div>'; }).join('') : '<div class="muted" style="padding:10px 2px">Belum ada lapisan.</div>') + '</div>');
    $('lyOk').onclick = function () { HA.closeSheet(); };
    $('lyNew').onclick = function () { if (metas().length >= MAXL) { HA.toast('Maksimal ' + MAXL + ' lapisan, hapus satu dulu'); return; } HA.closeSheet(); if (HA.ED) HA.ED.open(null); };
    $('lyAdd').onclick = function () { $('lyF').value = ''; $('lyF').click(); };
    $('lyF').onchange = function () { if (this.files && this.files[0]) { var f = this.files[0]; HA.closeSheet(); addFile(f); } };
    $('sheet').querySelectorAll('[data-t]').forEach(function (e) { e.onclick = function () { var x = ml[+e.getAttribute('data-t')]; x.on = !x.on; HA.saveSettings(); redraw(); panel(); }; });
    $('sheet').querySelectorAll('[data-m]').forEach(function (e) { e.onclick = function () { more(ml[+e.getAttribute('data-m')]); }; });
  }
  function more(x) {
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">' + esc(x.name) + '</div><button class="btn" id="lmX">Kembali</button></div>' +
      '<div class="muted" style="margin:6px 0">' + x.n + ' objek</div>' +
      '<button class="btn pri" id="lmE" style="width:100%;margin-top:6px">Edit lapisan</button>' +
      '<button class="btn" id="lmZ" style="width:100%;margin-top:6px">Zoom ke lapisan</button>' +
      '<button class="btn" id="lmB" style="width:100%;margin-top:6px">Salin ke tanda per blok…</button>' +
      '<button class="btn" id="lmK" style="width:100%;margin-top:6px">Ekspor KML</button>' +
      '<button class="btn" id="lmG" style="width:100%;margin-top:6px">Ekspor GeoJSON</button>' +
      '<button class="btn" id="lmD" style="width:100%;margin-top:14px;color:var(--bad,#e57373)">Hapus lapisan ini</button>');
    $('lmX').onclick = panel;
    $('lmE').onclick = function () { HA.closeSheet(); if (HA.ED) HA.ED.open(x.id); };
    $('lmZ').onclick = function () { HA.closeSheet(); if (x.bb && HA.SP.map) HA.SP.map.fitBounds([[x.bb[0], x.bb[1]], [x.bb[2], x.bb[3]]], { padding: [30, 30], maxZoom: 19 }); };
    $('lmK').onclick = function () { load(x.id).then(function (o) { HA.saveFile(x.name.replace(/[^\w\-]+/g, '_') + '.kml', HA.textB64(toKml(o, x.name)), 'application/vnd.google-earth.kml+xml'); }); };
    $('lmG').onclick = function () { load(x.id).then(function (o) { HA.saveFile(x.name.replace(/[^\w\-]+/g, '_') + '.geojson', HA.textB64(toGeoJson(o, x.name)), 'application/geo+json'); }); };
    $('lmD').onclick = function () {
      HA.askConfirm('Hapus lapisan?', x.name + ' dihapus dari HZ Trip. Berkas aslinya tidak terpengaruh.', 'Hapus', function () {
        S.settings.layers = metas().filter(function (z) { return z.id !== x.id; }); delete MEM[x.id]; dbDel(x.id).then(function () { HA.saveSettings(); redraw(); HA.toast('Lapisan dihapus'); panel(); });
      });
      var cn = $('cfNo'); if (cn) cn.onclick = function () { more(x); };
    };
    $('lmB').onclick = function () {
      var bl = (HA.blocksList() || []).filter(function (b) { return b.conf && b.pts && b.pts.length >= 3 && (!x.bb || bbHit(x.bb, bbPts(b.pts))); }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'id', { numeric: true }); });
      if (!bl.length) { HA.toast('Tidak ada blok Terkonfirmasi yang tumpang tindih'); return; }
      HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">PILIH BLOK</div><button class="btn" id="lbX">Kembali</button></div><div class="rbL">' + bl.slice(0, 200).map(function (b, i) { return '<div class="rbR" data-b="' + i + '"><div class="rbT"><b>' + esc(b.name) + '</b></div><button class="btn sm pri" data-b="' + i + '">Pilih</button></div>'; }).join('') + '</div>' + (bl.length > 200 ? '<div class="muted">200 blok pertama ditampilkan.</div>' : ''));
      $('lbX').onclick = function () { more(x); };
      $('sheet').querySelectorAll('button[data-b]').forEach(function (e) { e.onclick = function () { var b = bl[+e.getAttribute('data-b')]; load(x.id).then(function (o) { copyDlg(o, x.name, b); }); }; });
    };
  }
  // untuk editor: simpan perubahan ke lapisan yang ada
  function update(id, name, objs) {
    objs.forEach(function (o) { o.bb = bboxOf(o); });
    var mt = metas().filter(function (z) { return z.id === id; })[0]; if (!mt) return Promise.reject(new Error('Lapisan tidak ditemukan'));
    return dbPut({ id: id, name: name, ts: Date.now(), objs: objs }).then(function () {
      MEM[id] = objs; mt.name = name; mt.n = objs.length;
      mt.bb = objs.reduce(function (a, o) { return [Math.min(a[0], o.bb[0]), Math.min(a[1], o.bb[1]), Math.max(a[2], o.bb[2]), Math.max(a[3], o.bb[3])]; }, [90, 180, -90, -180]);
      HA.saveSettings(); redraw();
    });
  }
  function storeNew(name, objs) { objs.forEach(function (o) { o.bb = bboxOf(o); }); return store(name, objs); }
  HA.LY = { metas: metas, load: load, dbGet: dbGet, dbPut: dbPut, dbDel: dbDel, update: update, storeNew: storeNew, toKml: toKml, toGeoJson: toGeoJson, MAXL: MAXL };
  HA.layPanel = panel;
  // tombol di SpidoMap
  function mk() {
    var w = $('spMapWrap'); if (!w || $('spLay')) return;
    var b = document.createElement('button'); b.className = 'locbtn'; b.id = 'spLay'; b.setAttribute('aria-label', 'Lapisan berkas');
    b.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l9 4.8-9 4.8-9-4.8z"/><path d="M3 12l9 4.8 9-4.8"/><path d="M3 16.7l9 4.8 9-4.8"/></svg>';
    b.onclick = panel; w.appendChild(b);
  }
  mk();
  var t0 = setInterval(function () { var m = HA.SP.map; if (m) { clearInterval(t0); m.on('moveend', redraw); redraw(); } }, 800);
})();
