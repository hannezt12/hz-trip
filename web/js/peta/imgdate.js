/* HZ Trip v0.16.0 - tanggal citra satelit (Esri World Imagery) di sebuah titik. Layanan metadata Esri dicari saat dipakai, hasil diingat. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  // layanan metadata Esri dinamai menurut rilis; daftar ini dicoba berurutan, yang berhasil diingat
  var BASES = [
    'https://metadata.maptiles.arcgis.com/arcgis/rest/services/World_Imagery_Metadata_2026_r02/MapServer',
    'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer'
  ];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var LAY = null, cache = {}, seq = 0;
  function jget(u) { return fetch(u, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }); }
  function resOf(name) { var m = /^\s*([\d.]+)\s*(cm|m)\b/i.exec(name || ''); if (!m) return null; return +m[1] * (m[2].toLowerCase() === 'cm' ? 0.01 : 1); }
  function discover() {
    if (LAY) return Promise.resolve(LAY);
    var i = 0;
    function next() {
      if (i >= BASES.length) return Promise.reject(new Error('metadata tidak tersedia'));
      var base = BASES[i++];
      return jget(base + '?f=json').then(function (j) {
        var ls = (j.layers || []).map(function (l) { return { id: l.id, res: resOf(l.name) }; }).filter(function (l) { return l.res; }).sort(function (a, b) { return a.res - b.res; });
        if (!ls.length) throw new Error('tanpa lapisan');
        LAY = { base: base, layers: ls }; return LAY;
      }).catch(next);
    }
    return next();
  }
  function fmtDate(a) {
    var ms = a.SRC_DATE2;
    if (typeof ms === 'number' && ms > 0) { var d = new Date(ms); return BLN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
    var n = String(a.SRC_DATE || ''); if (/^\d{8}$/.test(n)) return BLN[+n.slice(4, 6) - 1] + ' ' + n.slice(0, 4);
    return '';
  }
  function query(L, idx, lat, lng) {
    var l = L.layers[idx]; if (!l) return Promise.resolve(null);
    var u = L.base + '/' + l.id + '/query?f=json&geometry=' + lng + ',' + lat + '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SRC_DATE2,SRC_DATE,SRC_RES,NICE_NAME&returnGeometry=false';
    return jget(u).then(function (j) {
      var f = j.features && j.features[0]; if (f && f.attributes) { var dt = fmtDate(f.attributes); if (dt) return { date: dt, res: f.attributes.SRC_RES || l.res }; }
      return query(L, idx + 1, lat, lng);
    });
  }
  // z = zoom peta; dibatasi oleh zoom asli citra (satNative) karena di atasnya gambar hanya diperbesar
  HA.imgDate = function (lat, lng, z) {
    var zz = Math.min(z, (HA.S.settings && HA.S.settings.satNative) || 17), ground = 156543.03 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zz);
    var key = zz + ':' + lat.toFixed(3) + ':' + lng.toFixed(3);
    if (cache[key]) return Promise.resolve(cache[key]);
    var my = ++seq;
    return discover().then(function (L) {
      var idx = 0; while (idx < L.layers.length - 1 && L.layers[idx].res < ground * 0.85) idx++;
      return query(L, idx, lat, lng);
    }).then(function (r) {
      var t = r ? 'Citra: ' + r.date + ' · ' + (+r.res < 1 ? Math.round(r.res * 100) + ' cm' : String(+(+r.res).toFixed(1)).replace('.', ',') + ' m') : '';
      if (t) cache[key] = t;
      return t;
    }).catch(function () { return ''; });
  };
})();
