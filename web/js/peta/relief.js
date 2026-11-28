/* HZ Trip v0.27.31 - tema peta Relief 2.5D (hanya layar Lintasan, mode Peta): latar kertas + bayangan relief DEM,
 * bayangan blok, larikan tebu jarang, danau dan drainase biru langit. Dibatasi seukuran master induk + 300 m. */
(function () {
  'use strict';
  var HA = window.HzApp; if (!HA || !HA.ok) return;
  var S = HA.S, MARGIN_M = 300;
  HA.reliefOn = function () { return !!(S.settings.relief && S.settings.mapMode === 'osm'); };
  // kotak pembatas gabungan semua master induk (tanpa induk = null)
  HA.reliefBounds = function () {
    var ms = (S.settings.masters || []).filter(function (m) { return (m.parent == null) && m.pts && m.pts.length >= 3; });
    if (!ms.length) return null;
    var s = 90, w = 180, n = -90, e = -180;
    ms.forEach(function (m) { m.pts.forEach(function (p) { if (p[0] < s) s = p[0]; if (p[0] > n) n = p[0]; if (p[1] < w) w = p[1]; if (p[1] > e) e = p[1]; }); });
    var dl = MARGIN_M / 110540, dg = MARGIN_M / (111320 * Math.cos((s + n) / 2 * Math.PI / 180));
    return L.latLngBounds([s - dl, w - dg], [n + dl, e + dg]);
  };
  HA.reliefApply = function (m) {
    if (!m || m !== HA.map) return;
    var on = HA.reliefOn(), bd = on ? HA.reliefBounds() : null;
    if (on && !bd) { S.settings.relief = false; on = false; HA.saveSettings && HA.saveSettings(); if (HA.toast) HA.toast('Relief butuh master induk. Buat master dulu.'); }
    m.getContainer().classList.toggle('hz-relief', on);
    if (m._relief) { try { m.removeLayer(m._relief); } catch (e) {} m._relief = null; }
    if (!on) { m.setMaxBounds(null); m.setMinZoom(0); return; }
    m.setMaxBounds(bd.pad(0.02));
    m.setMinZoom(Math.max(10, m.getBoundsZoom(bd)));
    if (!bd.contains(m.getCenter())) m.fitBounds(bd);
    if (window.HzDem && HzDem.reliefLayer) m._relief = HzDem.reliefLayer({ exag: 20 }).addTo(m);
  };
})();
