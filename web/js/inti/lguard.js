/* HZ Trip - pengaman Leaflet: koordinat kosong (null) tidak boleh membuat aplikasi galat */
(function () {
  'use strict';
  try { Error.stackTraceLimit = 40; } catch (e) {}
  var L = window.L; if (!L || !L.Map) return;
  var seen = {};
  function note(what) {
    try {
      var st = String(new Error().stack || ''), re = /([\w.\-]+\.js):(\d+):(\d+)/g, m, f = [];
      while ((m = re.exec(st)) && f.length < 4) if (!/^(leaflet|lguard)/i.test(m[1])) f.push(m[1] + ':' + m[2]);
      var k = what + ' ' + f.join('<'); if (seen[k]) return; seen[k] = 1;
      var a = JSON.parse(localStorage.getItem('hz_errlog') || '[]');
      a.push({ t: Date.now(), m: 'Koordinat kosong diabaikan: ' + k }); localStorage.setItem('hz_errlog', JSON.stringify(a.slice(-20)));
    } catch (e) {}
  }
  var M = L.Map.prototype;
  var project = M.project;
  M.project = function (ll, z) {
    if (!L.latLng(ll)) { note('project'); ll = new L.LatLng(0, 0); }
    return project.call(this, ll, z);
  };
  ['setView', 'panTo', 'flyTo'].forEach(function (n) {
    var o = M[n];
    M[n] = function (c) { if (!L.latLng(c)) { note(n); return this; } return o.apply(this, arguments); };
  });
  function clean(a) {
    if (!Array.isArray(a)) return a;
    var out = [], i, x;
    for (i = 0; i < a.length; i++) { x = a[i]; if (Array.isArray(x)) out.push(clean(x)); else if (x) out.push(x); else note('titik'); }
    return out;
  }
  var cv = L.Polyline.prototype._convertLatLngs;
  if (cv) L.Polyline.prototype._convertLatLngs = function (l) { return clean(cv.call(this, l)); };
})();
