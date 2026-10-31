/* HZ Trip: batas wilayah (desa dan kecamatan). Hanya ditampilkan di peta, tidak dicatat di trip.
 * Sumber 1: layanan peta online (ArcGIS REST MapServer, query per kotak, disimpan di cache).
 * Sumber 2: berkas impor (GeoJSON atau KML), disimpan di ponsel.
 * Nama wilayah diletakkan di bagian poligon yang sedang terlihat dan selalu di dalam batasnya. */
(function (root) {
  'use strict';
  var FILES = { desa: [], kec: [] }, DBP = null, ARC = new Map(), ARCP = {}, MAXARC = 80;

  // ---------- penyimpanan (IndexedDB) ----------
  function db() {
    if (DBP) return DBP;
    DBP = new Promise(function (res, rej) {
      var r = indexedDB.open('hzbatas', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('files'); d.createObjectStore('arc'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return DBP;
  }
  function req(st, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(st, mode), q = fn(tx.objectStore(st));
        tx.oncomplete = function () { res(q && q.result); };
        tx.onerror = tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  function loadFiles() {
    return Promise.all(['desa', 'kec'].map(function (k) {
      return req('files', 'readonly', function (s) { return s.get(k); }).then(function (v) { FILES[k] = v || []; }).catch(function () { FILES[k] = []; });
    }));
  }
  function saveFiles(k) { return req('files', 'readwrite', function (s) { return s.put(FILES[k], k); }); }
  function fileInfo() {
    var out = [];
    ['desa', 'kec'].forEach(function (k) { FILES[k].forEach(function (f) { out.push({ kind: k, name: f.name, n: f.feats.length, at: f.at }); }); });
    return out;
  }
  function removeFile(kind, name) {
    FILES[kind] = FILES[kind].filter(function (f) { return f.name !== name; });
    return saveFiles(kind);
  }
  function clearFiles() { FILES = { desa: [], kec: [] }; return req('files', 'readwrite', function (s) { return s.clear(); }); }

  // ---------- baca berkas ----------
  var KEYS = {
    desa: ['wadmkd', 'namobj', 'nama_desa', 'nm_desa', 'namadesa', 'desa', 'nama_kel', 'nm_kel', 'kelurahan', 'kel_desa', 'nama', 'name'],
    kec: ['wadmkc', 'nama_kec', 'nm_kec', 'namakec', 'kecamatan', 'namobj', 'nama', 'name']
  };
  function pickName(props, kind, field) {
    if (!props) return '';
    var low = {}, k;
    for (k in props) low[String(k).toLowerCase()] = props[k];
    if (field && low[field.toLowerCase()] != null && String(low[field.toLowerCase()]).trim()) return String(low[field.toLowerCase()]).trim();
    var list = KEYS[kind] || KEYS.desa;
    for (var i = 0; i < list.length; i++) { var v = low[list[i]]; if (v != null && String(v).trim() && isNaN(+v)) return String(v).trim(); }
    for (k in props) { var s = props[k]; if (typeof s === 'string' && s.trim().length > 2 && isNaN(+s)) return s.trim(); }
    return '';
  }
  function mkFeat(name, ring) {
    var n = ring.length, a = new Float64Array(n * 2), s = Infinity, w = Infinity, nn = -Infinity, e = -Infinity, i;
    for (i = 0; i < n; i++) {
      var lng = +ring[i][0], lat = +ring[i][1];
      a[i * 2] = lat; a[i * 2 + 1] = lng;
      if (lat < s) s = lat; if (lat > nn) nn = lat; if (lng < w) w = lng; if (lng > e) e = lng;
    }
    return { n: name, bb: [s, w, nn, e], r: a };
  }
  function ringsOf(g, out) {
    if (!g) return;
    if (g.type === 'Polygon') { if (g.coordinates && g.coordinates[0]) out.push(g.coordinates[0]); }
    else if (g.type === 'MultiPolygon') (g.coordinates || []).forEach(function (p) { if (p && p[0]) out.push(p[0]); });
    else if (g.type === 'GeometryCollection') (g.geometries || []).forEach(function (x) { ringsOf(x, out); });
  }
  function featsFromGeoJSON(obj, kind, field) {
    var list = obj.type === 'FeatureCollection' ? obj.features : (obj.type === 'Feature' ? [obj] : []), out = [];
    (list || []).forEach(function (f) {
      if (!f || !f.geometry) return;
      var rs = []; ringsOf(f.geometry, rs);
      var nm = pickName(f.properties, kind, field);
      rs.forEach(function (r) { if (r.length >= 4) out.push(mkFeat(nm, r)); });
    });
    return out;
  }
  function featsFromKml(text, kind, field) {
    var doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('KML tidak valid');
    var out = [], pms = doc.getElementsByTagName('Placemark'), i, j, k;
    for (i = 0; i < pms.length; i++) {
      var pm = pms[i], props = {}, nm = pm.getElementsByTagName('name')[0];
      if (nm) props.name = nm.textContent;
      var sd = pm.getElementsByTagName('SimpleData');
      for (j = 0; j < sd.length; j++) props[sd[j].getAttribute('name')] = sd[j].textContent;
      var dd = pm.getElementsByTagName('Data');
      for (j = 0; j < dd.length; j++) { var vv = dd[j].getElementsByTagName('value')[0]; props[dd[j].getAttribute('name')] = vv ? vv.textContent : ''; }
      var name = pickName(props, kind, field), polys = pm.getElementsByTagName('Polygon');
      for (j = 0; j < polys.length; j++) {
        var ob = polys[j].getElementsByTagName('outerBoundaryIs')[0]; if (!ob) continue;
        var co = ob.getElementsByTagName('coordinates')[0]; if (!co) continue;
        var ring = co.textContent.trim().split(/\s+/).map(function (t) { var p = t.split(','); return [+p[0], +p[1]]; }).filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
        if (ring.length >= 4) out.push(mkFeat(name, ring));
      }
    }
    return out;
  }
  function importFile(file, kind, field) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('Berkas tidak bisa dibaca')); };
      fr.onload = function () {
        var text = String(fr.result), feats;
        try {
          var t = text.replace(/^﻿/, '').trim();
          if (t.charAt(0) === '{') feats = featsFromGeoJSON(JSON.parse(t), kind, field);
          else if (t.charAt(0) === '<') feats = featsFromKml(t, kind, field);
          else throw new Error('Format tidak dikenali (pakai GeoJSON atau KML)');
        } catch (e) { rej(new Error(e && e.message ? e.message : 'Isi berkas tidak valid')); return; }
        if (!feats.length) { rej(new Error('Tidak ada poligon batas di berkas ini')); return; }
        var named = feats.filter(function (f) { return f.n; }).length;
        FILES[kind] = FILES[kind].filter(function (f) { return f.name !== file.name; });
        FILES[kind].push({ name: file.name, at: Date.now(), feats: feats });
        saveFiles(kind).then(function () { res({ n: feats.length, named: named }); }, rej);
      };
      fr.readAsText(file);
    });
  }

  // ---------- layanan online (ArcGIS REST) ----------
  function q2s(o) { return Object.keys(o).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); }
  function getJson(u) { return fetch(u, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }); }
  function arcLayers(base) {
    return getJson(base.replace(/\/+$/, '') + '?f=json').then(function (j) {
      if (j.error || !j.layers) throw new Error('Alamat bukan layanan peta ArcGIS (MapServer)');
      return j.layers.map(function (l) { return { id: l.id, name: l.name }; });
    });
  }
  function arcFields(base, id) {
    return getJson(base.replace(/\/+$/, '') + '/' + id + '?f=json').then(function (j) {
      return (j.fields || []).filter(function (f) { return f.type === 'esriFieldTypeString'; }).map(function (f) { return f.name; });
    });
  }
  function guessLayer(layers, kind) {
    var re = kind === 'kec' ? /kecamatan|kec\b/i : /desa|kelurahan|kel\b/i, hit = layers.filter(function (l) { return re.test(l.name); });
    return hit.length ? hit[0].id : null;
  }
  // cari layanan batas wilayah yang memuat titik (lat,lng); mencoba beberapa alamat bawaan
  function discover(lat, lng, bases, onProg) {
    var i = 0;
    function tryOne() {
      if (i >= bases.length) return Promise.resolve(null);
      var base = bases[i++]; if (onProg) onProg(base);
      return arcLayers(base).then(function (layers) {
        var d = guessLayer(layers, 'desa'), k = guessLayer(layers, 'kec');
        if (d === null) return tryOne();
        return getJson(base + '/' + d + '/query?' + q2s({ geometry: lng + ',' + lat, geometryType: 'esriGeometryPoint', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', returnCountOnly: 'true', f: 'json' })).then(function (c) {
          if (c && c.count > 0) return { base: base, layers: layers, desaId: d, kecId: k };
          return tryOne();
        });
      }).catch(function () { return tryOne(); });
    }
    return tryOne();
  }
  function tileEnv(z, x, y) {
    var n = Math.pow(2, z), w = x / n * 360 - 180, e = (x + 1) / n * 360 - 180;
    function lat(yy) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) * 180 / Math.PI; }
    return [w, lat(y + 1), e, lat(y)];
  }
  function arcZt(kind, z) { return kind === 'kec' ? (z >= 12 ? 10 : 8) : (z >= 15 ? 13 : (z >= 13 ? 12 : 10)); }
  function arcFetchTile(kind, conf, zt, x, y, zoom) {
    var key = kind + '|' + conf.base + '|' + conf.id + '|' + zt + '|' + x + '|' + y, env = tileEnv(zt, x, y);
    if (ARC.has(key)) return Promise.resolve(ARC.get(key));
    if (ARCP[key]) return ARCP[key];
    var off = 360 / Math.pow(2, Math.max(zt, zoom) + 8) * 1.2;
    var p = req('arc', 'readonly', function (s) { return s.get(key); }).catch(function () { return null; }).then(function (c) {
      if (c && Date.now() - c.t < 90 * 86400000) return c.feats;
      var feats = [], offset = 0;
      function page() {
        var u = conf.base.replace(/\/+$/, '') + '/' + conf.id + '/query?' + q2s({ where: '1=1', geometry: env.join(','), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true', outSR: 4326, maxAllowableOffset: off, resultOffset: offset, resultRecordCount: 1000, f: 'geojson' });
        return getJson(u).then(function (j) {
          if (j.error) throw new Error('layanan menolak permintaan');
          var part = featsFromGeoJSON(j, kind, conf.field);
          feats = feats.concat(part);
          var more = (j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit)) && part.length && offset < 5000;
          if (more) { offset += 1000; return page(); }
        });
      }
      return page().then(function () {
        req('arc', 'readwrite', function (s) { return s.put({ t: Date.now(), feats: feats }, key); }).catch(function () {});
        return feats;
      });
    }).then(function (feats) {
      ARC.set(key, feats); delete ARCP[key];
      while (ARC.size > MAXARC) ARC.delete(ARC.keys().next().value);
      return feats;
    }, function (e) { delete ARCP[key]; throw e; });
    ARCP[key] = p;
    return p;
  }
  function clearArcCache() { ARC.clear(); return req('arc', 'readwrite', function (s) { return s.clear(); }); }

  // ---------- geometri layar ----------
  function simp(pts, tol) {
    var out = [pts[0]], l = pts[0], i;
    for (i = 1; i < pts.length; i++) { var p = pts[i]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) >= tol) { out.push(p); l = p; } }
    if (out.length > 600) { var st = Math.ceil(out.length / 600), o2 = []; for (i = 0; i < out.length; i += st) o2.push(out[i]); out = o2; }
    return out;
  }
  function clip(poly, x0, y0, x1, y1) {
    function edge(pts, inside, inter) {
      var out = [], n = pts.length, i;
      for (i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % n], ia = inside(a), ib = inside(b);
        if (ia) { out.push(a); if (!ib) out.push(inter(a, b)); } else if (ib) out.push(inter(a, b));
      }
      return out;
    }
    var p = poly;
    p = edge(p, function (a) { return a[0] >= x0; }, function (a, b) { var t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }); if (p.length < 3) return [];
    p = edge(p, function (a) { return a[0] <= x1; }, function (a, b) { var t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; }); if (p.length < 3) return [];
    p = edge(p, function (a) { return a[1] >= y0; }, function (a, b) { var t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; }); if (p.length < 3) return [];
    p = edge(p, function (a) { return a[1] <= y1; }, function (a, b) { var t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; });
    return p.length < 3 ? [] : p;
  }
  function pip(x, y, p) {
    var ins = false, i, j;
    for (i = 0, j = p.length - 1; i < p.length; j = i++) {
      var xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }
  function edgeDist(x, y, p) {
    var best = Infinity, i, j;
    for (i = 0, j = p.length - 1; i < p.length; j = i++) {
      var ax = p[j][0], ay = p[j][1], bx = p[i][0], by = p[i][1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var ex = ax + t * dx - x, ey = ay + t * dy - y, d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  function area(p) { var a = 0, i, j; for (i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); }

  // titik-titik kandidat di dalam poligon yang terlihat, diurutkan dari yang paling jauh dari tepi
  function samples(p) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i;
    p.forEach(function (q) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; });
    var N = 16, out = [], gx, gy;
    for (gy = 0; gy < N; gy++) for (gx = 0; gx < N; gx++) {
      var x = x0 + (gx + 0.5) / N * (x1 - x0), y = y0 + (gy + 0.5) / N * (y1 - y0);
      if (pip(x, y, p)) out.push([x, y, edgeDist(x, y, p)]);
    }
    out.sort(function (a, b) { return b[2] - a[2]; });
    return out.slice(0, 40);
  }
  function boxFits(poly, cx, cy, w, h) {
    var hx = w / 2, hy = h / 2, pts = [[-hx, -hy], [0, -hy], [hx, -hy], [hx, 0], [hx, hy], [0, hy], [-hx, hy], [-hx, 0]], i;
    for (i = 0; i < pts.length; i++) if (!pip(cx + pts[i][0], cy + pts[i][1], poly)) return false;
    return true;
  }

  // ---------- lapisan di peta ----------
  function attach(map, getCfg, onMsg) {
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d'), raf = 0, moving = false, lastMsg = 0, ver = 0;
    cv.className = 'batcv'; cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:450';
    map.getContainer().appendChild(cv);
    function msg(t) { if (onMsg && Date.now() - lastMsg > 15000) { lastMsg = Date.now(); onMsg(t); } }
    function size() {
      var s = map.getSize(), dpr = Math.min(2, root.devicePixelRatio || 1);
      if (cv.width !== Math.round(s.x * dpr) || cv.height !== Math.round(s.y * dpr)) { cv.width = Math.round(s.x * dpr); cv.height = Math.round(s.y * dpr); }
      cv.style.width = s.x + 'px'; cv.style.height = s.y + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return s;
    }
    function gather(kind, cfg, zoom, bounds) {
      var out = [], s = bounds.getSouth(), w = bounds.getWest(), n = bounds.getNorth(), e = bounds.getEast();
      function hit(f) { var b = f.bb; return !(b[2] < s || b[0] > n || b[3] < w || b[1] > e); }
      if (cfg.file !== false) FILES[kind].forEach(function (fl) { fl.feats.forEach(function (f) { if (hit(f)) out.push({ f: f, src: 'file' }); }); });
      var conf = cfg.online !== false && cfg.base && (kind === 'kec' ? cfg.kecId : cfg.desaId) != null ? { base: cfg.base, id: kind === 'kec' ? cfg.kecId : cfg.desaId, field: kind === 'kec' ? cfg.fKec : cfg.fDesa } : null;
      if (conf) {
        var zt = arcZt(kind, zoom), nn = Math.pow(2, zt);
        function tx(lng) { return Math.floor((lng + 180) / 360 * nn); }
        function ty(lat) { var sn = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180); return Math.floor((0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI)) * nn); }
        var x0 = tx(w), x1 = tx(e), y0 = ty(n), y1 = ty(s), x, y, seen = {}, need = 0;
        if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 16) {
          for (x = x0; x <= x1; x++) for (y = y0; y <= y1; y++) {
            var key = kind + '|' + conf.base + '|' + conf.id + '|' + zt + '|' + x + '|' + y;
            if (ARC.has(key)) {
              ARC.get(key).forEach(function (f) { var k2 = f.n + '|' + f.bb[0].toFixed(5) + '|' + f.bb[1].toFixed(5) + '|' + f.r.length; if (!seen[k2] && hit(f)) { seen[k2] = 1; out.push({ f: f, src: 'online' }); } });
            } else if (!ARCP[key]) {
              need++;
              (function (xx, yy) {
                arcFetchTile(kind, conf, zt, xx, yy, zoom).then(function () { req_(true); }, function () { msg('Batas wilayah online gagal dimuat (cek internet atau alamat layanan)'); });
              })(x, y);
            }
          }
        }
      }
      return out;
    }
    function project(f, o, z) {
      var r = f.r, n = r.length / 2, sc = 256 * Math.pow(2, z), pts = new Array(n), i;
      for (i = 0; i < n; i++) {
        var lat = r[i * 2], lng = r[i * 2 + 1], sn = Math.sin(lat * Math.PI / 180);
        pts[i] = [(lng + 180) / 360 * sc - o.x, (0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI)) * sc - o.y];
      }
      return pts;
    }
    function draw(withLabels) {
      var s = size(), cfg = getCfg() || {}, z = map.getZoom();
      ctx.clearRect(0, 0, s.x, s.y);
      if (!(cfg.desa || cfg.kec) || !root.L) return;
      var minDesa = cfg.minDesa || 13, minKec = cfg.minKec || 10, osm = !!cfg.osm, bounds = map.getBounds().pad(0.1), o = map.getPixelBounds().min;
      var kinds = [];
      if (cfg.kec && z >= 8) kinds.push('kec');
      if (cfg.desa && z >= minDesa - 1) kinds.push('desa');
      var cand = [];
      kinds.forEach(function (kind) {
        var feats = gather(kind, cfg, z, bounds), lineCol = kind === 'kec' ? (osm ? '#B0237E' : '#FF7AD9') : (osm ? '#6A2FB5' : '#D6A8FF');
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        var byDash = { online: [], file: [] };
        feats.forEach(function (it) {
          var pts = simp(project(it.f, o, z), 1.4);
          if (pts.length < 3) return;
          byDash[it.src].push(pts);
          if (withLabels && it.f.n) cand.push({ kind: kind, n: it.f.n, pts: pts, src: it.src });
        });
        ['online', 'file'].forEach(function (src) {
          var arr = byDash[src]; if (!arr.length) return;
          ctx.beginPath();
          arr.forEach(function (pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); });
          ctx.setLineDash(src === 'file' ? [7, 4] : []);
          ctx.strokeStyle = osm ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.45)'; ctx.lineWidth = kind === 'kec' ? 4 : 3; ctx.stroke();
          ctx.strokeStyle = lineCol; ctx.lineWidth = kind === 'kec' ? 2.2 : 1.2; ctx.stroke();
        });
        ctx.setLineDash([]);
      });
      if (withLabels) labels(cand, cfg, z, s, osm);
    }
    function labels(cand, cfg, z, s, osm) {
      var minDesa = cfg.minDesa || 13, minKec = cfg.minKec || 10, M = 5, list = [];
      cand.forEach(function (c) {
        if (c.kind === 'desa' && z < minDesa) return;
        if (c.kind === 'kec' && (z < minKec || (cfg.desa && z > minDesa + 1))) return;
        var cl = clip(c.pts, M, M, s.x - M, s.y - M);
        if (!cl.length || area(cl) < 900) return;
        var sm = samples(cl); if (!sm.length) return;
        list.push({ c: c, poly: cl, sm: sm, clear: sm[0][2] });
      });
      // satu nama hanya sekali: ambil bagian terlihat yang paling luas
      var best = {};
      list.forEach(function (it) { var k = it.c.kind + '|' + it.c.n; if (!best[k] || best[k].clear < it.clear) best[k] = it; });
      list = Object.keys(best).map(function (k) { return best[k]; });
      list.sort(function (a, b) { return (a.c.kind === b.c.kind ? 0 : (a.c.kind === 'desa' ? -1 : 1)) || b.clear - a.clear; });
      var placed = [], base = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 1);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      list.forEach(function (it) {
        var kec = it.c.kind === 'kec', txt = kec ? it.c.n.toUpperCase() : it.c.n, sz0 = Math.max(11, Math.round((kec ? 15 : 13) * base)), sz, fit = null;
        for (sz = sz0; sz >= 11 && !fit; sz--) {
          ctx.font = (kec ? '700 ' : '600 ') + sz + 'px sans-serif';
          var w = ctx.measureText(txt).width + 6, h = sz * 1.25;
          for (var i = 0; i < it.sm.length; i++) {
            var p = it.sm[i];
            if (p[2] < h / 2) break;
            if (!boxFits(it.poly, p[0], p[1], w, h)) continue;
            var bx = [p[0] - w / 2, p[1] - h / 2, p[0] + w / 2, p[1] + h / 2], clash = false;
            for (var j = 0; j < placed.length; j++) { var q = placed[j]; if (!(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3])) { clash = true; break; } }
            if (clash) continue;
            fit = { x: p[0], y: p[1], box: bx, sz: sz };
            break;
          }
        }
        if (!fit) return;
        placed.push(fit.box);
        ctx.font = (kec ? '700 ' : '600 ') + fit.sz + 'px sans-serif';
        ctx.lineWidth = 3.2; ctx.strokeStyle = osm ? 'rgba(255,255,255,.95)' : 'rgba(0,0,0,.8)'; ctx.strokeText(txt, fit.x, fit.y);
        ctx.fillStyle = kec ? (osm ? '#8A1C62' : '#FFC2EE') : (osm ? '#4B1C8A' : '#F1DEFF'); ctx.fillText(txt, fit.x, fit.y);
      });
    }
    function req_(labelsToo) {
      if (raf) { if (labelsToo) ver = 1; return; }
      ver = labelsToo ? 1 : 0;
      raf = requestAnimationFrame(function () { raf = 0; draw(ver === 1 && !moving); });
    }
    map.on('movestart zoomstart', function () { moving = true; if (map._zooming || map._animatingZoom) ctx.clearRect(0, 0, cv.width, cv.height); });
    map.on('move', function () { req_(false); });
    map.on('moveend zoomend resize', function () { moving = false; req_(true); });
    req_(true);
    return { redraw: function () { moving = false; req_(true); }, destroy: function () { try { cv.remove(); } catch (e) {} } };
  }

  loadFiles();
  root.HzBatas = {
    attach: attach, importFile: importFile, fileInfo: fileInfo, removeFile: removeFile, clearFiles: clearFiles, loadFiles: loadFiles,
    arcLayers: arcLayers, arcFields: arcFields, guessLayer: guessLayer, discover: discover, clearArcCache: clearArcCache,
    _t: { clip: clip, samples: samples, boxFits: boxFits, pip: pip, featsFromGeoJSON: featsFromGeoJSON, featsFromKml: featsFromKml }
  };
})(window);
