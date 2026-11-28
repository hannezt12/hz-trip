/* HZ Trip v0.27.29 - arsir silang hitam-kuning untuk tanda tanpa kategori (garis dipotong sesuai bentuk poligon, tanpa mengubah mesin peta) */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || typeof L === 'undefined') return;
  var IVORY = '#FFFFF0', BLACK = '#111111', YELLOW = '#F2C200';
  HA.IVORY = IVORY;
  function segs(xy, dx, dy, s) {
    var nx = -dy, ny = dx, dmin = 1e18, dmax = -1e18, out = [], i;
    for (i = 0; i < xy.length; i++) { var d0 = nx * xy[i][0] + ny * xy[i][1]; if (d0 < dmin) dmin = d0; if (d0 > dmax) dmax = d0; }
    for (var d = dmin + s / 2; d < dmax; d += s) {
      var us = [];
      for (i = 0; i < xy.length; i++) {
        var a = xy[i], b = xy[(i + 1) % xy.length], da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d;
        if ((da < 0 && db >= 0) || (da >= 0 && db < 0)) { var t = da / (da - db), px = a[0] + t * (b[0] - a[0]), py = a[1] + t * (b[1] - a[1]); us.push(dx * px + dy * py); }
      }
      us.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < us.length; i += 2) out.push([[nx * d + dx * us[i], ny * d + dy * us[i]], [nx * d + dx * us[i + 1], ny * d + dy * us[i + 1]]]);
    }
    return out;
  }
  // garis sejajar arah bearing (derajat dari utara) dipotong poligon; dipakai untuk larikan blok muda di tema 2.5D
  HA.addStripes = function (g, pts, bearing, spacingM, color, weight, opacity) {
    if (!pts || pts.length < 3) return;
    var ref = pts[0], kx = 111320 * Math.cos(ref[0] * Math.PI / 180), ky = 110540, a = bearing * Math.PI / 180;
    var xy = pts.map(function (p) { return [(p[1] - ref[1]) * kx, (p[0] - ref[0]) * ky]; });
    segs(xy, Math.sin(a), Math.cos(a), spacingM).forEach(function (sg) {
      L.polyline([[ref[0] + sg[0][1] / ky, ref[1] + sg[0][0] / kx], [ref[0] + sg[1][1] / ky, ref[1] + sg[1][0] / kx]], { color: color, weight: weight, opacity: opacity == null ? 1 : opacity, interactive: false, lineCap: 'round' }).addTo(g);
    });
  };
  // tambahkan arsir ke grup g untuk poligon pts ([lat,lng])
  HA.addHatch = function (g, pts) {
    if (!pts || pts.length < 3) return;
    var ref = pts[0], kx = 111320 * Math.cos(ref[0] * Math.PI / 180), ky = 110540;
    var xy = pts.map(function (p) { return [(p[1] - ref[1]) * kx, (p[0] - ref[0]) * ky]; });
    var x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18;
    xy.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    var s = Math.max(10, Math.max(x1 - x0, y1 - y0) / 22), r = Math.SQRT1_2;
    function back(q) { return [ref[0] + q[1] / ky, ref[1] + q[0] / kx]; }
    [[r, r, BLACK], [r, -r, YELLOW]].forEach(function (c) {
      segs(xy, c[0], c[1], s).forEach(function (sg) { L.polyline([back(sg[0]), back(sg[1])], { color: c[2], weight: 2.5, opacity: 0.95, interactive: false, lineCap: 'butt' }).addTo(g); });
    });
  };
})();
