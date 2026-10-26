/* HZ Trip: data ketinggian (DEM) untuk kontur, info lereng, dan profil ketinggian.
 * Sumber: kotak ketinggian "terrarium" (PNG, ketinggian = R*256 + G + B/256 - 32768 meter).
 * Kotak disimpan di cache yang sama dengan kotak peta (store.get / store.put), jadi bisa dipakai tanpa internet
 * setelah area itu pernah dibuka. */
(function (root) {
  'use strict';
  var URL_T = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  var mem = new Map(), pend = {}, fail = {}, store = null, MAXMEM = 90;

  function setStore(s) { store = s; }
  function urlOf(z, x, y) { return URL_T.replace('{z}', z).replace('{x}', x).replace('{y}', y); }

  function decode(blob) {
    return createImageBitmap(blob).then(function (bm) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 256;
      var cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(bm, 0, 0); if (bm.close) bm.close();
      var d = cx.getImageData(0, 0, 256, 256).data, out = new Float32Array(65536), i;
      for (i = 0; i < 65536; i++) { var v = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768; out[i] = v <= -32000 ? NaN : v; }
      return out;
    });
  }
  function netBlob(u) {
    return (store ? store.get(u) : Promise.resolve(null)).then(function (blob) {
      if (blob) return blob;
      return fetch(u, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('http'); return r.blob(); }).then(function (b) { if (store) store.put(u, b); return b; });
    });
  }
  // kotak lokal di tepi cakupan punya piksel kosong: isi dari data gratis bila ada
  function fillHoles(arr, u) {
    var i, holes = 0;
    for (i = 0; i < 65536; i++) if (arr[i] !== arr[i]) { holes++; break; }
    if (!holes) return arr;
    return netBlob(u).then(decode).then(function (n) { for (i = 0; i < 65536; i++) if (arr[i] !== arr[i]) arr[i] = n[i]; return arr; }).catch(function () { return arr; });
  }
  function loadTile(z, x, y) {
    var n = Math.pow(2, z);
    x = ((x % n) + n) % n;
    if (y < 0 || y >= n) return Promise.resolve(null);
    var k = z + '/' + x + '/' + y;
    if (mem.has(k)) { var v = mem.get(k); mem.delete(k); mem.set(k, v); return Promise.resolve(v); }
    if (pend[k]) return pend[k];
    if (fail[k] && Date.now() - fail[k] < 60000) return Promise.resolve(null);
    var u = urlOf(z, x, y);
    var p = localGet(z, x, y).then(function (lb) {
      if (lb) return decode(lb).then(function (arr) { return fillHoles(arr, u); });
      return netBlob(u).then(decode);
    }).then(function (arr) {
      mem.set(k, arr);
      while (mem.size > MAXMEM) mem.delete(mem.keys().next().value);
      delete pend[k]; return arr;
    }).catch(function () { fail[k] = Date.now(); delete pend[k]; return null; });
    pend[k] = p;
    return p;
  }

  function pxy(lat, lng, z) {
    var n = 256 * Math.pow(2, z), s = Math.sin(lat * Math.PI / 180);
    return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  }
  function pix(z, ix, iy) {
    var n = Math.pow(2, z), tx = Math.floor(ix / 256), ty = Math.floor(iy / 256);
    tx = ((tx % n) + n) % n;
    var t = mem.get(z + '/' + tx + '/' + ty);
    if (!t) return NaN;
    return t[(iy - ty * 256) * 256 + (((ix % 256) + 256) % 256)];
  }
  // ketinggian (m) di satu titik; NaN bila kotaknya belum dimuat (panggil ensure dulu)
  function elev(lat, lng, z) {
    var p = pxy(lat, lng, z), fx = p[0] - 0.5, fy = p[1] - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
    var a = pix(z, x0, y0), b = pix(z, x0 + 1, y0), c = pix(z, x0, y0 + 1), d = pix(z, x0 + 1, y0 + 1);
    return (a * (1 - ax) + b * ax) * (1 - ay) + (c * (1 - ax) + d * ax) * ay;
  }
  // muat semua kotak yang dibutuhkan titik-titik (pts: [[lat,lng],...]); hasil: {total, ok}
  function ensure(z, pts) {
    var need = {}, list = [];
    pts.forEach(function (q) {
      var p = pxy(q[0], q[1], z), X, Y;
      [-1, 1].forEach(function (dx) {
        [-1, 1].forEach(function (dy) {
          X = Math.floor((p[0] + dx) / 256); Y = Math.floor((p[1] + dy) / 256);
          var k = X + '/' + Y;
          if (!need[k]) { need[k] = 1; list.push([X, Y]); }
        });
      });
    });
    var ok = 0, i = 0;
    function worker() {
      if (i >= list.length) return Promise.resolve();
      var c = list[i++];
      return loadTile(z, c[0], c[1]).then(function (t) { if (t) ok++; return worker(); });
    }
    var ws = [];
    for (var w = 0; w < Math.min(6, list.length); w++) ws.push(worker());
    return Promise.all(ws).then(function () { return { total: list.length, ok: ok }; });
  }


  // ---------- data lokal (DEMNAS dari berkas .tif) ----------
  var LDB = null, cov = [];
  function ldb() {
    if (LDB) return LDB;
    LDB = new Promise(function (res, rej) {
      var r = indexedDB.open('hzdem', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('tiles'); d.createObjectStore('meta'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return LDB;
  }
  function lreq(st, mode, fn) {
    return ldb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(st, mode), q = fn(tx.objectStore(st));
        tx.oncomplete = function () { res(q && q.result); };
        tx.onerror = tx.onabort = function () { rej(tx.error); };
      });
    });
  }
  function localGet(z, x, y) {
    if (!cov.length) return Promise.resolve(null);
    return lreq('tiles', 'readonly', function (s) { return s.get(z + '/' + x + '/' + y); }).catch(function () { return null; });
  }
  function loadCov() {
    return lreq('meta', 'readonly', function (s) { return s.get('sheets'); }).then(function (v) { cov = v || []; return cov; }).catch(function () { cov = []; return cov; });
  }
  function hasLocal(lat, lng) {
    for (var i = 0; i < cov.length; i++) { var b = cov[i].bbox; if (lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]) return true; }
    return false;
  }
  function localInfo() {
    return loadCov().then(function (sh) {
      if (!sh.length) return { sheets: [], tiles: 0, bytes: 0, bbox: null };
      var tiles = 0, bytes = 0;
      return ldb().then(function (db) {
        return new Promise(function (res) {
          var c = db.transaction('tiles', 'readonly').objectStore('tiles').openCursor();
          c.onsuccess = function () { var cu = c.result; if (cu) { tiles++; bytes += (cu.value && cu.value.size) || 0; cu.continue(); } else res(); };
          c.onerror = function () { res(); };
        });
      }).then(function () {
        var bb = [Infinity, Infinity, -Infinity, -Infinity];
        sh.forEach(function (q) { bb = [Math.min(bb[0], q.bbox[0]), Math.min(bb[1], q.bbox[1]), Math.max(bb[2], q.bbox[2]), Math.max(bb[3], q.bbox[3])]; });
        return { sheets: sh, tiles: tiles, bytes: bytes, bbox: bb };
      });
    });
  }
  function resetMem() { mem.clear(); fail = {}; }
  function clearLocal() {
    return lreq('tiles', 'readwrite', function (s) { return s.clear(); }).then(function () {
      return lreq('meta', 'readwrite', function (s) { return s.clear(); });
    }).then(function () { cov = []; resetMem(); });
  }
  function loadLib() {
    if (root.GeoTIFF) return Promise.resolve(root.GeoTIFF);
    return new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = 'vendor/geotiff.js';
      sc.onload = function () { root.GeoTIFF ? res(root.GeoTIFF) : rej(new Error('Pustaka GeoTIFF tidak termuat')); };
      sc.onerror = function () { rej(new Error('Pustaka GeoTIFF tidak ditemukan')); };
      document.head.appendChild(sc);
    });
  }
  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }
  function encodeTile(arr) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 256;
    var cx = cv.getContext('2d'), im = cx.createImageData(256, 256), d = im.data, i, e, R, G;
    for (i = 0; i < 65536; i++) {
      var v = arr[i];
      if (v !== v) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; continue; }
      e = v + 32768; if (e < 1) e = 1;
      R = Math.floor(e / 256); G = Math.floor(e - R * 256);
      d[i * 4] = R; d[i * 4 + 1] = G; d[i * 4 + 2] = Math.min(255, Math.floor((e - Math.floor(e)) * 256)); d[i * 4 + 3] = 255;
    }
    cx.putImageData(im, 0, 0);
    return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('Gagal membuat kotak')); }, 'image/png'); });
  }
  function tileLat(ty, n256) { var yy = ty / n256; return Math.atan(Math.sinh(Math.PI * (1 - 2 * yy))) * 180 / Math.PI; }
  function latTile(lat, z) { var s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180); return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z)); }

  // baca satu berkas GeoTIFF ketinggian (EPSG:4326) dan simpan sebagai kotak lokal z11-14
  function importTiff(file, onProg) {
    var prog = onProg || function () {}, G, img, W, H, bbox, nod, data, Z0 = 11, Z1 = 14;
    return loadLib().then(function (g) { G = g; return G.fromBlob(file).then(function (t) { return t.getImage(); }).catch(function (e) { throw new Error('Bukan berkas GeoTIFF yang bisa dibaca (' + (e && e.message || e) + ')'); }); }).then(function (im) {
      img = im; W = img.getWidth(); H = img.getHeight();
      var gk = {}; try { gk = img.getGeoKeys() || {}; } catch (e) {}
      if (gk.ProjectedCSTypeGeoKey && gk.ProjectedCSTypeGeoKey !== 32767) throw new Error('Berkas memakai koordinat proyeksi (EPSG:' + gk.ProjectedCSTypeGeoKey + '). Saat ini hanya yang berkoordinat derajat (EPSG:4326) yang didukung.');
      try { bbox = img.getBoundingBox(); } catch (e) { throw new Error('Berkas tidak punya data lokasi (georeferensi).'); }
      if (!bbox || Math.abs(bbox[0]) > 180 || Math.abs(bbox[2]) > 180 || Math.abs(bbox[1]) > 90 || Math.abs(bbox[3]) > 90) throw new Error('Koordinat berkas bukan derajat (kemungkinan proyeksi). Saat ini hanya EPSG:4326 yang didukung.');
      if (img.getSamplesPerPixel() < 1) throw new Error('Berkas tidak berisi data ketinggian.');
      nod = null; try { nod = img.getGDALNoData(); } catch (e) {}
      data = new Float32Array(W * H); var y = 0, STEP = 256;
      function rd() {
        if (y >= H) return Promise.resolve();
        var y1 = Math.min(H, y + STEP);
        return img.readRasters({ window: [0, y, W, y1], samples: [0], interleave: false }).then(function (r) {
          var a = r[0], o = y * W, i, n = a.length, v;
          for (i = 0; i < n; i++) { v = a[i]; data[o + i] = (v !== v || v < -1000 || v > 9000 || (nod !== null && v === nod)) ? NaN : v; }
          y = y1; prog(Math.round(y / H * 30), 'Membaca ' + file.name);
          return tick().then(rd);
        }, function (e) { throw new Error('Gagal membaca data (kompresi/format belum didukung?): ' + (e && e.message || e)); });
      }
      return rd();
    }).then(function () {
      var rx = (bbox[2] - bbox[0]) / W, ry = (bbox[3] - bbox[1]) / H, jobs = [], z;
      for (z = Z0; z <= Z1; z++) {
        var n = Math.pow(2, z), x0 = Math.floor((bbox[0] + 180) / 360 * n), x1 = Math.floor((bbox[2] + 180) / 360 * n), y0 = latTile(bbox[3], z), y1 = latTile(bbox[1], z), tx, ty;
        for (tx = x0; tx <= x1; tx++) for (ty = y0; ty <= y1; ty++) jobs.push([z, tx, ty]);
      }
      var done = 0, made = 0;
      function sample(lat, lng) {
        var c = (lng - bbox[0]) / rx - 0.5, r = (bbox[3] - lat) / ry - 0.5;
        if (c < -0.5 || r < -0.5 || c > W - 0.5 || r > H - 0.5) return NaN;
        var c0 = Math.max(0, Math.min(W - 2, Math.floor(c))), r0 = Math.max(0, Math.min(H - 2, Math.floor(r)));
        var fx = Math.max(0, Math.min(1, c - c0)), fy = Math.max(0, Math.min(1, r - r0));
        var a = data[r0 * W + c0], b = data[r0 * W + c0 + 1], cc = data[(r0 + 1) * W + c0], d = data[(r0 + 1) * W + c0 + 1];
        if (a === a && b === b && cc === cc && d === d) return (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy;
        var best = NaN, bd = 9; // ada piksel kosong: pakai yang terdekat
        [[a, 0, 0], [b, 1, 0], [cc, 0, 1], [d, 1, 1]].forEach(function (q) { if (q[0] === q[0]) { var dd = Math.abs(fx - q[1]) + Math.abs(fy - q[2]); if (dd < bd) { bd = dd; best = q[0]; } } });
        return best;
      }
      function one(j) {
        var z = j[0], tx = j[1], ty = j[2], n256 = 256 * Math.pow(2, z), k = Math.max(1, Math.min(4, Math.round((360 / n256) / rx)));
        return lreq('tiles', 'readonly', function (s) { return s.get(z + '/' + tx + '/' + ty); }).catch(function () { return null; }).then(function (lb) {
          return lb ? decode(lb) : new Float32Array(65536).fill(NaN);
        }).then(function (arr) {
          var lats = new Float64Array(256 * k), lngs = new Float64Array(256 * k), i, jj, a, b, valid = 0;
          for (i = 0; i < 256 * k; i++) { lngs[i] = (tx * 256 + (i + 0.5) / k) / n256 * 360 - 180; lats[i] = tileLat(ty * 256 + (i + 0.5) / k, n256); }
          for (jj = 0; jj < 256; jj++) {
            if (lats[jj * k + k - 1] > bbox[3] + ry || lats[jj * k] < bbox[1] - ry) continue;
            for (i = 0; i < 256; i++) {
              var s = 0, c = 0, v;
              if (k === 1) { v = sample(lats[jj], lngs[i]); if (v === v) { s = v; c = 1; } }
              else for (a = 0; a < k; a++) for (b = 0; b < k; b++) { v = sample(lats[jj * k + a], lngs[i * k + b]); if (v === v) { s += v; c++; } }
              if (c) { arr[jj * 256 + i] = s / c; valid++; }
            }
          }
          if (!valid) return null;
          return encodeTile(arr).then(function (bl) { return lreq('tiles', 'readwrite', function (st) { return st.put(bl, z + '/' + tx + '/' + ty); }); }).then(function () { made++; });
        });
      }
      function loop(q) {
        if (q >= jobs.length) return Promise.resolve();
        return one(jobs[q]).then(function () { done++; prog(30 + Math.round(done / jobs.length * 70), 'Membuat kotak ' + done + '/' + jobs.length); return tick(); }).then(function () { return loop(q + 1); });
      }
      return loop(0).then(function () {
        return loadCov().then(function (sh) {
          sh = sh.filter(function (q) { return q.name !== file.name; });
          sh.push({ name: file.name, bbox: bbox.slice(), at: Date.now(), res: Math.round(rx * 111320) });
          return lreq('meta', 'readwrite', function (s) { return s.put(sh, 'sheets'); });
        }).then(loadCov).then(function () { resetMem(); return { tiles: made, bbox: bbox, name: file.name, w: W, h: H }; });
      });
    });
  }
  loadCov();


  // ---------- garis kontur untuk ekspor (KML): bbox [w,s,e,n], step meter ----------
  function contourLines(bbox, step, onProg) {
    var Z = 14, p0 = pxy(bbox[3], bbox[0], Z), p1 = pxy(bbox[1], bbox[2], Z);
    var pts = [], x, y;
    for (x = p0[0]; x <= p1[0] + 200; x += 200) for (y = p0[1]; y <= p1[1] + 200; y += 200) pts.push(unpxy(Math.min(x, p1[0]), Math.min(y, p1[1]), Z));
    pts.push(unpxy(p1[0], p1[1], Z));
    return ensure(Z, pts).then(function (r) {
      if (!r.ok) throw new Error('Data ketinggian belum lengkap (butuh internet)');
      var W = p1[0] - p0[0], H = p1[1] - p0[1], st = Math.max(1, Math.ceil(Math.max(W, H) / 600));
      var cols = Math.floor(W / st) + 1, rows = Math.floor(H / st) + 1, g = new Float32Array(cols * rows), i, j, mn = Infinity, mx = -Infinity;
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
        var q = unpxy(p0[0] + i * st, p0[1] + j * st, Z), v = elev(q[0], q[1], Z);
        g[j * cols + i] = v; if (isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
      }
      if (!isFinite(mn)) return [];
      var passes = hasLocal((bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2) ? 1 : 2, pass;
      for (pass = 0; pass < passes; pass++) {
        var g2 = new Float32Array(g.length);
        for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
          var s = 0, n = 0, dj, di;
          for (dj = -1; dj <= 1; dj++) for (di = -1; di <= 1; di++) {
            var ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
            var vv = g[jj * cols + ii]; if (isFinite(vv)) { s += vv; n++; }
          }
          g2[j * cols + i] = n ? s / n : NaN;
        }
        g = g2;
      }
      function ll(ix, iy) { var q = unpxy(p0[0] + ix * st, p0[1] + iy * st, Z); return [+q[0].toFixed(6), +q[1].toFixed(6)]; }
      var out = [], k;
      for (k = Math.ceil(mn / step); k <= Math.floor(mx / step); k++) {
        var Lv = k * step, segs = [], E = {};
        function lerp(a, b) { return (Lv - a) / (b - a); }
        for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
          var a = g[j * cols + i], b = g[j * cols + i + 1], cc = g[(j + 1) * cols + i + 1], d = g[(j + 1) * cols + i];
          if (!(isFinite(a) && isFinite(b) && isFinite(cc) && isFinite(d))) continue;
          if (Lv < Math.min(a, b, cc, d) || Lv > Math.max(a, b, cc, d)) continue;
          var idx = (a >= Lv ? 8 : 0) | (b >= Lv ? 4 : 0) | (cc >= Lv ? 2 : 0) | (d >= Lv ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          // titik di tepi: kunci tepi supaya segmen bisa disambung
          var T = { k: 'h' + i + ',' + j, p: function () { return ll(i + lerp(a, b), j); } }, Rr = { k: 'v' + (i + 1) + ',' + j, p: function () { return ll(i + 1, j + lerp(b, cc)); } },
              B = { k: 'h' + i + ',' + (j + 1), p: function () { return ll(i + lerp(d, cc), j + 1); } }, Lf = { k: 'v' + i + ',' + j, p: function () { return ll(i, j + lerp(a, d)); } };
          var sg;
          switch (idx) {
            case 1: case 14: sg = [[Lf, B]]; break;
            case 2: case 13: sg = [[B, Rr]]; break;
            case 3: case 12: sg = [[Lf, Rr]]; break;
            case 4: case 11: sg = [[T, Rr]]; break;
            case 6: case 9: sg = [[T, B]]; break;
            case 7: case 8: sg = [[T, Lf]]; break;
            case 5: sg = ((a + b + cc + d) / 4 >= Lv) ? [[T, Lf], [B, Rr]] : [[T, Rr], [Lf, B]]; break;
            default: sg = ((a + b + cc + d) / 4 >= Lv) ? [[T, Rr], [Lf, B]] : [[T, Lf], [B, Rr]];
          }
          sg.forEach(function (s2) { var A = s2[0], Bq = s2[1]; segs.push([A.k, A.p(), Bq.k, Bq.p()]); });
        }
        // sambung segmen jadi garis panjang
        var by = {}; segs.forEach(function (s2, n) { (by[s2[0]] = by[s2[0]] || []).push(n); (by[s2[2]] = by[s2[2]] || []).push(n); });
        var used = new Array(segs.length), lines = [];
        function nextOf(key, self) { var l = by[key] || []; for (var t = 0; t < l.length; t++) if (!used[l[t]] && l[t] !== self) return l[t]; return -1; }
        segs.forEach(function (s0, n0) {
          if (used[n0]) return; used[n0] = 1;
          var line = [s0[1], s0[3]], endK = s0[2], startK = s0[0], nx;
          while ((nx = nextOf(endK, -1)) >= 0) { used[nx] = 1; var s3 = segs[nx]; if (s3[0] === endK) { line.push(s3[3]); endK = s3[2]; } else { line.push(s3[1]); endK = s3[0]; } }
          while ((nx = nextOf(startK, -1)) >= 0) { used[nx] = 1; var s4 = segs[nx]; if (s4[0] === startK) { line.unshift(s4[3]); startK = s4[2]; } else { line.unshift(s4[1]); startK = s4[0]; } }
          if (line.length > 1) lines.push(line);
        });
        if (lines.length) out.push({ level: Lv, major: k % 5 === 0, lines: lines });
        if (onProg) onProg(k);
      }
      return out;
    });
  }
  function unpxy(px, py, z) {
    var n = 256 * Math.pow(2, z);
    return [Math.atan(Math.sinh(Math.PI * (1 - 2 * py / n))) * 180 / Math.PI, px / n * 360 - 180];
  }

  // ---------- info lereng di satu titik ----------
  function info(lat, lng) {
    var Z = 14, d = 30, dLat = d / 111320, dLng = dLat / Math.cos(lat * Math.PI / 180);
    var P = [[lat, lng], [lat + dLat, lng], [lat - dLat, lng], [lat, lng + dLng], [lat, lng - dLng]];
    return ensure(Z, P).then(function () {
      var e0 = elev(lat, lng, Z), n = elev(P[1][0], P[1][1], Z), s = elev(P[2][0], P[2][1], Z), e = elev(P[3][0], P[3][1], Z), w = elev(P[4][0], P[4][1], Z);
      if (!isFinite(e0) || !isFinite(n) || !isFinite(s) || !isFinite(e) || !isFinite(w)) return null;
      var gx = (e - w) / (2 * d), gy = (n - s) / (2 * d), pct = 100 * Math.hypot(gx, gy);
      var down = (Math.atan2(-gx, -gy) * 180 / Math.PI + 360) % 360;
      return { h: e0, pct: pct, down: down };
    });
  }

  // ---------- profil ketinggian sepanjang jalur ----------
  function hav(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  // pts: [[lat,lng],...] -> titik tiap `step` meter
  function resample(pts, step) {
    var out = { lat: [], lng: [], d: [] }, acc = 0, next = 0, i;
    if (!pts.length) return out;
    out.lat.push(pts[0][0]); out.lng.push(pts[0][1]); out.d.push(0);
    next = step;
    for (i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], seg = hav(a, b);
      if (seg <= 0) continue;
      while (acc + seg >= next) {
        var f = (next - acc) / seg;
        out.lat.push(a[0] + (b[0] - a[0]) * f); out.lng.push(a[1] + (b[1] - a[1]) * f); out.d.push(next);
        next += step;
      }
      acc += seg;
    }
    if (acc - out.d[out.d.length - 1] > step * 0.25) { var l = pts[pts.length - 1]; out.lat.push(l[0]); out.lng.push(l[1]); out.d.push(acc); }
    return out;
  }
  function smooth(a, win) {
    var h = Math.floor(win / 2), out = a.slice(), i, j;
    for (i = 0; i < a.length; i++) { var s = 0, c = 0; for (j = Math.max(0, i - h); j <= Math.min(a.length - 1, i + h); j++) { s += a[j]; c++; } out[i] = s / c; }
    return out;
  }
  function climbOf(e, thr) {
    var up = 0, down = 0, ref = e[0], i;
    for (i = 1; i < e.length; i++) {
      var dv = e[i] - ref;
      if (dv >= thr) { up += dv; ref = e[i]; } else if (dv <= -thr) { down -= dv; ref = e[i]; }
    }
    return { up: up, down: down };
  }
  // pts: [[lat,lng],...]; hasil {d,e,lat,lng,up,down,min,max,km} atau null bila data ketinggian tidak tersedia
  function profile(pts, step) {
    var Z = 14, rs = resample(pts, step || 50);
    if (rs.lat.length < 2) return Promise.resolve(null);
    var coords = rs.lat.map(function (la, i) { return [la, rs.lng[i]]; });
    return ensure(Z, coords).then(function () {
      var e = coords.map(function (c) { return elev(c[0], c[1], Z); }), bad = 0, i;
      e.forEach(function (v) { if (!isFinite(v)) bad++; });
      if (bad > e.length * 0.3) return null;
      var last = NaN;
      for (i = 0; i < e.length; i++) { if (isFinite(e[i])) last = e[i]; else if (isFinite(last)) e[i] = last; }
      for (i = e.length - 1; i >= 0; i--) { if (isFinite(e[i])) last = e[i]; else e[i] = last; }
      var es = smooth(e, 5), cl = climbOf(es, 2), mn = Infinity, mx = -Infinity;
      es.forEach(function (v) { if (v < mn) mn = v; if (v > mx) mx = v; });
      return { d: rs.d, e: es, lat: rs.lat, lng: rs.lng, up: cl.up, down: cl.down, min: mn, max: mx, km: rs.d[rs.d.length - 1] / 1000 };
    });
  }

  // ---------- lapisan kontur (kanvas) ----------
  var LC = null;
  function layerClass() {
    if (LC) return LC;
    var PAD = 0.25, S = 8;
    LC = L.Layer.extend({
      initialize: function (o) { this.o = o || {}; this._id = 0; },
      onAdd: function (map) {
        if (!map.getPane('demPane')) { var p = map.createPane('demPane'); p.style.zIndex = 260; p.style.pointerEvents = 'none'; }
        var c = this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated');
        c.style.pointerEvents = 'none';
        map.getPane('demPane').appendChild(c);
        this._update();
      },
      onRemove: function () { this._id++; L.DomUtil.remove(this._canvas); this._canvas = null; },
      getEvents: function () { return { moveend: this._update, resize: this._update, viewreset: this._update, zoomanim: this._animZoom }; },
      _animZoom: function (e) {
        var m = this._map, scale = m.getZoomScale(e.zoom, this._zoom), viewHalf = m.getSize().multiplyBy(0.5 + PAD),
          cur = m.project(this._center, e.zoom), off = viewHalf.multiplyBy(-scale).add(cur).subtract(m._getNewPixelOrigin(e.center, e.zoom));
        L.DomUtil.setTransform(this._canvas, off, scale);
      },
      redraw: function () { if (this._canvas) this._update(); },
      _update: function () {
        if (!this._canvas || !this._map) return;
        var m = this._map, size = m.getSize(), min = m.containerPointToLayerPoint(size.multiplyBy(-PAD)).round(), sz = size.multiplyBy(1 + PAD * 2).round();
        this._min = min; this._center = m.getCenter(); this._zoom = m.getZoom();
        this._canvas.width = sz.x; this._canvas.height = sz.y;
        L.DomUtil.setPosition(this._canvas, min);
        this._draw();
      },
      _draw: function () {
        var me = this, c = this._canvas, m = this._map, id = ++this._id;
        if (!c || !m) return;
        var w = c.width, h = c.height, min = this._min, zoom = m.getZoom();
        var zd = Math.max(10, Math.min(14, Math.round(zoom - 2.5)));
        var pts = [], x, y;
        for (y = 0; y <= h; y += 128) for (x = 0; x <= w; x += 128) { var ll = m.layerPointToLatLng(L.point(min.x + x, min.y + y)); pts.push([ll.lat, ll.lng]); }
        var ll2 = m.layerPointToLatLng(L.point(min.x + w, min.y + h)); pts.push([ll2.lat, ll2.lng]);
        ensure(zd, pts).then(function (r) {
          if (id !== me._id || !me._canvas) return;
          if (r.ok < r.total && me.o.onMissing) me.o.onMissing(r);
          me._render(zd);
        });
      },
      _render: function (zd) {
        var c = this._canvas, m = this._map, min = this._min, ctx = c.getContext('2d'), w = c.width, h = c.height;
        ctx.clearRect(0, 0, w, h);
        var cols = Math.ceil(w / S) + 1, rows = Math.ceil(h / S) + 1, g = new Float32Array(cols * rows), i, j, mn = Infinity, mx = -Infinity;
        for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
          var ll = m.layerPointToLatLng(L.point(min.x + i * S, min.y + j * S)), v = elev(ll.lat, ll.lng, zd);
          g[j * cols + i] = v;
          if (isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
        }
        if (!isFinite(mn)) return;
        // haluskan 2x (rata-rata 3x3, abaikan NaN)
        var cc0 = m.getCenter(), passes = hasLocal(cc0.lat, cc0.lng) ? 1 : 2;
        for (var pass = 0; pass < passes; pass++) {
          var g2 = new Float32Array(g.length);
          for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
            var s = 0, n = 0;
            for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
              var ii = i + di, jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
              var vv = g[jj * cols + ii]; if (isFinite(vv)) { s += vv; n++; }
            }
            g2[j * cols + i] = n ? s / n : NaN;
          }
          g = g2;
        }
        var I = this.o.step ? this.o.step(m.getZoom()) : 5, col = this.o.color ? this.o.color() : ['rgba(255,214,128,.8)', 'rgba(255,190,70,1)', 'rgba(0,0,0,.65)'];
        var k0 = Math.ceil(mn / I), k1 = Math.floor(mx / I), minor = [], major = [], labels = [], k;
        function lerp(a, b, L1) { return (L1 - a) / (b - a); }
        for (k = k0; k <= k1; k++) {
          var Lv = k * I, isMajor = k % 5 === 0, arr = isMajor ? major : minor, placed = [];
          for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
            var a = g[j * cols + i], b = g[j * cols + i + 1], cc = g[(j + 1) * cols + i + 1], d = g[(j + 1) * cols + i];
            if (!(isFinite(a) && isFinite(b) && isFinite(cc) && isFinite(d))) continue;
            var lo = Math.min(a, b, cc, d), hi = Math.max(a, b, cc, d);
            if (Lv < lo || Lv > hi) continue;
            var idx = (a >= Lv ? 8 : 0) | (b >= Lv ? 4 : 0) | (cc >= Lv ? 2 : 0) | (d >= Lv ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            var x0 = i * S, y0 = j * S;
            var T = [x0 + lerp(a, b, Lv) * S, y0], R = [x0 + S, y0 + lerp(b, cc, Lv) * S], B = [x0 + lerp(d, cc, Lv) * S, y0 + S], Lf = [x0, y0 + lerp(a, d, Lv) * S];
            var segs;
            switch (idx) {
              case 1: case 14: segs = [[Lf, B]]; break;
              case 2: case 13: segs = [[B, R]]; break;
              case 3: case 12: segs = [[Lf, R]]; break;
              case 4: case 11: segs = [[T, R]]; break;
              case 6: case 9: segs = [[T, B]]; break;
              case 7: case 8: segs = [[T, Lf]]; break;
              case 5: segs = ((a + b + cc + d) / 4 >= Lv) ? [[T, Lf], [B, R]] : [[T, R], [Lf, B]]; break;
              default: segs = ((a + b + cc + d) / 4 >= Lv) ? [[T, R], [Lf, B]] : [[T, Lf], [B, R]];
            }
            segs.forEach(function (sg) { arr.push(sg); });
            if (isMajor && (i + j) % 6 === 0) {
              var px = (segs[0][0][0] + segs[0][1][0]) / 2, py = (segs[0][0][1] + segs[0][1][1]) / 2, near = false;
              for (var q = 0; q < placed.length; q++) if (Math.abs(placed[q][0] - px) < 150 && Math.abs(placed[q][1] - py) < 90) { near = true; break; }
              if (!near && px > 20 && py > 20 && px < w - 40 && py < h - 20) { placed.push([px, py]); labels.push([px, py, String(Lv)]); }
            }
          }
        }
        ctx.lineCap = 'round';
        function strokeSegs(arr2, style, wd) {
          if (!arr2.length) return;
          ctx.beginPath();
          arr2.forEach(function (sg) { ctx.moveTo(sg[0][0], sg[0][1]); ctx.lineTo(sg[1][0], sg[1][1]); });
          ctx.strokeStyle = style; ctx.lineWidth = wd; ctx.stroke();
        }
        strokeSegs(minor, col[0], 0.7);
        strokeSegs(major, col[1], 1.2);
        ctx.font = '600 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        labels.forEach(function (lb) {
          ctx.lineWidth = 3; ctx.strokeStyle = col[2]; ctx.strokeText(lb[2], lb[0], lb[1]);
          ctx.fillStyle = col[1]; ctx.fillText(lb[2], lb[0], lb[1]);
        });
      }
    });
    return LC;
  }
  function contours(o) { return new (layerClass())(o); }

  root.HzDem = { contourLines: contourLines, importTiff: importTiff, localInfo: localInfo, clearLocal: clearLocal, hasLocal: hasLocal, loadCov: loadCov, resetMem: resetMem, setStore: setStore, ensure: ensure, elev: elev, info: info, profile: profile, resample: resample, contours: contours, hav: hav };
})(window);
