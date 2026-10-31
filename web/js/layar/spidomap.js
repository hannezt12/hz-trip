/* HZ Trip - SpidoMap dan putar ulang lintasan */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, E = HA.E, COL = HA.COL, native = HA.native, Plug = HA.Plug, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function zc() { return HA.zc.apply(this, arguments); }
  function opts() { return HA.opts.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function textB64() { return HA.textB64.apply(this, arguments); }
  function saveFile() { return HA.saveFile.apply(this, arguments); }
  function loadDay() { return HA.loadDay.apply(this, arguments); }
  function zoomInd() { return HA.zoomInd.apply(this, arguments); }
  function setBase() { return HA.setBase.apply(this, arguments); }
  function batSet() { return HA.batSet.apply(this, arguments); }
  function batCfg() { return HA.batCfg.apply(this, arguments); }
  function batRedraw() { return HA.batRedraw.apply(this, arguments); }
  function shapeItems() { return HA.shapeItems.apply(this, arguments); }
  function tripPts() { return HA.tripPts.apply(this, arguments); }
  function openOvSheet() { return HA.openOvSheet.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.spShow = spShow;
  HA.spResetMain = spResetMain;
  HA.spOnFix = spOnFix;
  HA.spSetActive = spSetActive;
  HA.spInit = spInit;
  HA.pbBuild = pbBuild;
  HA.pbDraw = pbDraw;
  HA.pbPlay = pbPlay;
  HA.pbClose = pbClose;
  HA.pbInit = pbInit;
  HA.openMapMenu = openMapMenu;
  HA.kmlPrep = kmlPrep;

  // ---------- SpidoMap: peta langsung di kiri Spidometer ----------
  HA.SP = { map: null, lay: null, mk: null, active: false, follow: true, zoomAuto: true, autoPaused: false, zoomBusy: false, hdAcc: 0, hdLL: null, cur: null, from: null, to: null, t0: 0, raf: 0, lastTs: 0, hudT: 0, band: -1, pendBand: -1, pendT: 0, mv: 0, lastSeg: null, rec: null, wl: null };
  function spIdx() { var p = $('spPager'); return p && p.scrollLeft > p.clientWidth / 2 ? 1 : 0; }
  function spShow(which) { var p = $('spPager'); p.scrollTo({ left: which === 'map' ? p.clientWidth : 0, behavior: 'smooth' }); }
  function spResetMain() { var p = $('spPager'); if (p) { p.scrollLeft = 0; $('spMain').scrollTop = 0; } }
  function spBtns() {
    $('spFol').textContent = 'Ikuti: ' + (HA.SP.follow ? 'ya' : 'tidak'); $('spFol').classList.toggle('on', HA.SP.follow);
    $('spZoom').textContent = 'Zoom otomatis: ' + (HA.SP.zoomAuto ? 'ya' : 'tidak'); $('spZoom').classList.toggle('on', HA.SP.zoomAuto);
    var aw = !!S.settings.spAwake;
    $('spAwake').textContent = 'Layar menyala: ' + (aw ? 'ya' : 'tidak'); $('spAwake').classList.toggle('on', aw);
  }
  function spAwake(on) {
    var want = on && HA.SP.active && !!S.settings.spAwake;
    try { Plug.keepScreen({ on: want }).catch(function () {}); } catch (e) {}
    if (navigator.wakeLock && !native) {
      if (want && !HA.SP.wl) navigator.wakeLock.request('screen').then(function (l) { HA.SP.wl = l; }).catch(function () {});
      else if (!want && HA.SP.wl) { try { HA.SP.wl.release(); } catch (e) {} HA.SP.wl = null; }
    }
  }
  function spEnsureMap() {
    if (HA.SP.map) return true;
    if (!window.L) return false;
    HA.SP.map = L.map('spMap', { zoomControl: false, preferCanvas: true, attributionControl: true }).setView([-4.95, 105.2], 17);
    setBase(HA.SP.map, 'sat');
    zoomInd(HA.SP.map);
    if (window.HzBatas) HA.SP.bat = HzBatas.attach(HA.SP.map, function () { var c = batCfg(); c.osm = false; return c; }, toast);
    HA.SP.lay = L.layerGroup().addTo(HA.SP.map);
    HA.SP.map.on('dragstart', function () { if (HA.SP.follow) { HA.SP.follow = false; spBtns(); } });
    HA.SP.map.on('zoomstart', function () { if (!HA.SP.zoomBusy && !HA.SP.autoPaused) { HA.SP.autoPaused = true; } });
    HA.SP.map.on('zoomend', function () { HA.SP.zoomBusy = false; });
    return true;
  }
  function spArrow(ll) {
    if (!HA.SP.mk) {
      HA.SP.mk = L.marker(ll, { icon: L.divIcon({ className: 'spar', html: '<svg viewBox="0 0 24 24" width="38" height="38"><path d="M12 1.5L21.5 22 12 17 2.5 22Z" fill="#8A97A0" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>', iconSize: [38, 38], iconAnchor: [19, 19] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(HA.SP.map);
    } else HA.SP.mk.setLatLng(ll);
    var el = HA.SP.mk.getElement && HA.SP.mk.getElement();
    if (el && el.firstChild) {
      el.firstChild.style.transform = 'rotate(' + HA.SP.hdAcc + 'deg)';
      var p = el.querySelector('path'), col = S.mode === 'rekam' ? '#2F80FF' : '#8A97A0';
      if (p && p.getAttribute('fill') !== col) p.setAttribute('fill', col);
    }
  }
  function spHeading(a, b) {
    var dy = (b[0] - a[0]) * 111320, dx = (b[1] - a[1]) * 111320 * Math.cos(a[0] * Math.PI / 180);
    if (dx * dx + dy * dy < 16) return false;
    var deg = Math.atan2(dx, dy) * 180 / Math.PI, d = ((deg - HA.SP.hdAcc + 540) % 360 + 360) % 360 - 180;
    HA.SP.hdAcc += d; return true;
  }
  function spRebuild() {
    if (!HA.SP.map) return;
    HA.SP.lay.clearLayers(); HA.SP.lastSeg = null;
    var pts = S.todayPts || [], res = T.detectTrips(pts, opts()), rec = S.mode === 'rekam', trips = res.trips, curT = rec && trips.length ? trips[trips.length - 1] : null;
    trips.forEach(function (t) {
      var tk = E.trackOf(res.points, t);
      tk.runs.forEach(function (r) {
        var ll = r.pts.map(function (p) { return [p.lat, p.lng]; });
        if (t === curT) L.polyline(ll, { color: COL[r.z], weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(HA.SP.lay);
        else L.polyline(ll, { color: '#9AA3A8', weight: 4, opacity: 0.55, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(HA.SP.lay);
      });
      if (t === curT) L.circleMarker([t.startLat, t.startLng], { radius: 7, color: '#fff', weight: 2, fillColor: '#3FD07A', fillOpacity: 1, interactive: false }).addTo(HA.SP.lay);
    });
    var last = pts.length ? pts[pts.length - 1] : null;
    if (last) {
      var ll2 = [last.lat, last.lng];
      HA.SP.cur = HA.SP.cur || ll2; HA.SP.from = HA.SP.to = ll2; HA.SP.lastSeg = ll2;
      if (pts.length > 1) { var pv = pts[pts.length - 2]; spHeading([pv.lat, pv.lng], ll2); }
      HA.SP.cur = ll2; spArrow(ll2);
    }
    spNote();
  }
  function spNote() {
    var n = $('spNote'), rec = S.mode === 'rekam', pts = S.todayPts || [];
    if (rec) { n.style.display = 'none'; return; }
    n.style.display = 'block';
    n.textContent = pts.length ? 'Posisi terakhir ' + T.hm(pts[pts.length - 1].t) : 'Belum ada posisi. Ketuk ◎ untuk mencari.';
  }
  function spOnFix(f) {
    var ll = [f.lat, f.lng];
    if (HA.SP.lastSeg) {
      L.polyline([HA.SP.lastSeg, ll], { color: pbZone(f.v * 3.6), weight: 6, opacity: 0.95, lineCap: 'round', interactive: false }).addTo(HA.SP.lay);
      if (f.v * 3.6 >= 5) spHeading(HA.SP.lastSeg, ll);
    }
    HA.SP.lastSeg = ll; HA.SP.from = HA.SP.cur || ll; HA.SP.to = ll; HA.SP.t0 = performance.now();
  }
  function spLoop(ts) {
    if (!HA.SP.active) return;
    var dt = HA.SP.lastTs ? Math.min(100, ts - HA.SP.lastTs) : 16; HA.SP.lastTs = ts;
    var rec = S.mode === 'rekam';
    if (HA.SP.to && HA.SP.from) {
      var f = Math.min(1, (ts - HA.SP.t0) / 1000);
      HA.SP.cur = [HA.SP.from[0] + (HA.SP.to[0] - HA.SP.from[0]) * f, HA.SP.from[1] + (HA.SP.to[1] - HA.SP.from[1]) * f];
      spArrow(HA.SP.cur);
      if (rec && HA.SP.follow) {
        var off = HA.SP.map.latLngToContainerPoint(HA.SP.cur).subtract(HA.SP.map.getSize().divideBy(2));
        if (Math.abs(off.x) > HA.SP.map.getSize().x || Math.abs(off.y) > HA.SP.map.getSize().y) HA.SP.map.setView(HA.SP.cur, HA.SP.map.getZoom(), { animate: false });
        else {
          HA.SP.map._rawPanBy(off.multiplyBy(1 - Math.exp(-dt / 220))); HA.SP.map.fire('move');
          HA.SP.mv += dt; if (HA.SP.mv > 400) { HA.SP.mv = 0; HA.SP.map.fire('moveend'); }
        }
      }
    }
    if (ts - HA.SP.hudT > 250) {
      HA.SP.hudT = ts;
      var fresh = rec && S.live.t && (Date.now() - S.live.t) < 5000, v = fresh ? S.live.v : 0;
      $('spSpd').textContent = fresh ? String(Math.round(v)) : '–';
      $('spSpd').style.color = fresh ? zc(v) : '';
      if (rec && HA.SP.follow && HA.SP.zoomAuto && !HA.SP.autoPaused && fresh) {
        var band = v < 20 ? 18 : (v < 50 ? 17 : (v < 80 ? 16 : 15));
        if (band !== HA.SP.map.getZoom()) {
          if (band !== HA.SP.pendBand) { HA.SP.pendBand = band; HA.SP.pendT = ts; }
          else if (ts - HA.SP.pendT >= 5000) { HA.SP.zoomBusy = true; HA.SP.map.setZoom(band, { animate: true }); HA.SP.pendBand = -1; }
        } else HA.SP.pendBand = -1;
      }
      // arah: GPS bila >= 5 km/j, kompas ponsel bila lebih pelan
      var gpsDrive = rec && fresh && v >= 5;
      if (!gpsDrive && HA.SP.compT && Date.now() - HA.SP.compT < 2000) {
        var dd = ((HA.SP.comp - HA.SP.hdAcc) % 360 + 540) % 360 - 180;
        if (Math.abs(dd) > 3) { HA.SP.hdAcc += dd * 0.5; spArrow(HA.SP.cur || (HA.SP.mk && HA.SP.mk.getLatLng())); }
      }
      spNote();
    }
    HA.SP.raf = requestAnimationFrame(spLoop);
  }
  function spSetActive(on) {
    if (on === HA.SP.active) return;
    HA.SP.active = on;
    $('spD0').classList.toggle('on', on); $('spD1').classList.toggle('on', !on);
    if (on) {
      if (!spEnsureMap()) { $('spNote').style.display = 'block'; $('spNote').textContent = 'Peta tidak tersedia'; HA.SP.active = false; return; }
      spBtns();
      setTimeout(function () { if (!HA.SP.active) return; HA.SP.map.invalidateSize(); spRebuild(); if (HA.SP.cur) HA.SP.map.setView(HA.SP.cur, S.mode === 'rekam' ? 17 : 17, { animate: false }); }, 60);
      HA.SP.lastTs = 0; HA.SP.raf = requestAnimationFrame(spLoop);
      spAwake(true); spCompassOn(true);
    } else {
      cancelAnimationFrame(HA.SP.raf); spAwake(false); spCompassOn(false);
    }
  }
  // kompas ponsel: dipakai saat kecepatan di bawah 5 km/jam (ujung atas / belakang ponsel)
  function spCompass(ev) {
    var al = ev.alpha, be = ev.beta, ga = ev.gamma;
    if (al == null || be == null || ga == null) return;
    if (ev.type === 'deviceorientation' && !ev.absolute) return;
    var r = Math.PI / 180, x = be * r, y = ga * r, z = al * r;
    var cY = Math.cos(y), cZ = Math.cos(z), sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z);
    // belakang ponsel (dipakai saat ponsel tegak) dan ujung atas ponsel (saat rebah); pakai yang proyeksi mendatarnya lebih besar
    var Bx = -cZ * sY - sZ * sX * cY, By = -sZ * sY + cZ * sX * cY, cX = Math.cos(x), Tx = -sZ * cX, Ty = cZ * cX;
    var bx = Bx, by = By;
    if (Math.hypot(Tx, Ty) >= Math.hypot(Bx, By)) { bx = Tx; by = Ty; }
    if (Math.hypot(bx, by) < 0.05) return;
    var h = Math.atan2(bx, by) / r; if (h < 0) h += 360;
    HA.SP.comp = h; HA.SP.compT = Date.now();
  }
  function spCompassOn(on) {
    window.removeEventListener('deviceorientationabsolute', spCompass, true);
    window.removeEventListener('deviceorientation', spCompass, true);
    if (!on) return;
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', spCompass, true);
    else window.addEventListener('deviceorientation', spCompass, true);
  }
  function spLocate() {
    HA.SP.follow = true; HA.SP.autoPaused = false; spBtns();
    if (S.mode === 'rekam' && HA.SP.cur) { HA.SP.map.setView(HA.SP.cur, HA.SP.map.getZoom(), { animate: true }); return; }
    if (!navigator.geolocation) { toast('Lokasi tidak tersedia'); return; }
    toast('Mencari posisi…');
    navigator.geolocation.getCurrentPosition(function (p) {
      var ll = [p.coords.latitude, p.coords.longitude];
      HA.SP.from = HA.SP.to = HA.SP.cur = ll; spArrow(ll); HA.SP.map.setView(ll, 17, { animate: true });
      $('spNote').style.display = 'block'; $('spNote').textContent = 'Posisi sekarang (belum merekam)';
    }, function () { toast('Posisi belum ditemukan'); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
  }
  function spInit() {
    var pg = $('spPager'), tm = null;
    pg.addEventListener('scroll', function () {
      clearTimeout(tm);
      tm = setTimeout(function () { spSetActive(S.view === 'spido' && !document.hidden && spIdx() === 1); }, 120);
    });
    $('spToMain').onclick = function () { spShow('main'); };
    $('spLoc').onclick = spLocate;
    $('spBat').onclick = function () { var bb = batSet(), on = !(bb.desa || bb.kec); bb.desa = on; bb.kec = on; saveSettings(); batRedraw(); toast(on ? 'Batas desa dan kecamatan nyala' : 'Batas wilayah mati'); };
    $('spFol').onclick = function () { HA.SP.follow = !HA.SP.follow; if (HA.SP.follow && HA.SP.cur) HA.SP.map.setView(HA.SP.cur, HA.SP.map.getZoom(), { animate: true }); spBtns(); };
    $('spZoom').onclick = function () { HA.SP.zoomAuto = !HA.SP.zoomAuto; if (HA.SP.zoomAuto) HA.SP.autoPaused = false; spBtns(); };
    $('spAwake').onclick = function () { S.settings.spAwake = !S.settings.spAwake; saveSettings(); spBtns(); spAwake(true); };
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (HA.SP.active) { HA.SP.active = false; cancelAnimationFrame(HA.SP.raf); spAwake(false); spCompassOn(false); HA.SP.resume = true; } }
      else if (HA.SP.resume) { HA.SP.resume = false; spSetActive(S.view === 'spido' && spIdx() === 1); }
    });
    window.addEventListener('resize', function () { if (S.view === 'spido' && !HA.SP.active) spResetMain(); });
    spResetMain();
  }

  // ---------- putar ulang lintasan ----------
  HA.pbOpen = pbOpen; HA.pbClose = pbClose;
  // selama Putar terbuka, aksi yang mengedit dikunci; mulai mengedit menghentikan Putar
  HA.pbLocked = function (msg) { if (HA.PB.open) { toast(msg || 'Tutup Putar dulu untuk mengedit'); return true; } return false; };
  HA.pbStopForEdit = function () { if (HA.PB.open) { pbClose(); toast('Putar dihentikan karena sedang mengedit'); } };
  HA.PB = { open: false, seq: [], ax: [], pos: 0, len: 0, playing: false, mult: 10, follow: true, raf: 0, last: 0, mk: null, ring: null, cur: null };
  function pbZone(v) { return v < 60 ? COL.g : (v < 90 ? COL.y : COL.r); }
  function pbBuild() {
    var d = HA.PB.cur, seq = [], ax = [], a = 0;
    HA.PB.seq = seq; HA.PB.ax = ax; HA.PB.pos = 0; HA.PB.len = 0;
    if (!d) return;
    var trips = HA.mapSel >= 0 ? [d.trips[HA.mapSel]] : d.trips;
    trips.forEach(function (x) {
      if (!x) return;
      d.pts.forEach(function (p) {
        if (p.t < x.t.start || p.t > x.t.end) return;
        if (seq.length) { var dt = p.t - seq[seq.length - 1].t; a += dt > 60000 ? 2000 : Math.max(0, dt); }
        seq.push(p); ax.push(a);
      });
    });
    HA.PB.len = a;
  }
  function pbAt(pos) {
    var ax = HA.PB.ax, seq = HA.PB.seq, n = seq.length;
    if (!n) return null;
    var lo = 0, hi = n - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (ax[m] <= pos) lo = m; else hi = m - 1; }
    var p = seq[lo], q = seq[Math.min(lo + 1, n - 1)];
    var span = ax[Math.min(lo + 1, n - 1)] - ax[lo], f = span > 0 ? Math.min(1, Math.max(0, (pos - ax[lo]) / span)) : 0;
    var gap = q.t - p.t > 60000, hd = null;
    for (var k = lo + 1; k < Math.min(n, lo + 8); k++) {
      var dy = (seq[k].lat - p.lat) * 111320, dx = (seq[k].lng - p.lng) * 111320 * Math.cos(p.lat * Math.PI / 180);
      if (dx * dx + dy * dy >= 16) { hd = Math.atan2(dx, dy) * 180 / Math.PI; break; }
    }
    return { h: gap ? null : hd, lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f, v: gap ? 0 : p.v + (q.v - p.v) * f, t: gap ? p.t : p.t + (q.t - p.t) * f };
  }
  function pbDraw(pan, dt) {
    var c = pbAt(HA.PB.pos);
    if (!c) { $('pbSpd').textContent = '0'; $('pbClk').textContent = '--.--.--'; return; }
    var ll = [c.lat, c.lng], col = pbZone(c.v);
    if (c.h !== null) HA.PB.hd = c.h;
    if (!HA.PB.mk) {
      HA.PB.mk = L.marker(ll, { icon: L.divIcon({ className: 'pbarrow', html: '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 1.5L21.5 22 12 17 2.5 22Z" fill="#2F80FF" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>', iconSize: [34, 34], iconAnchor: [17, 17] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(HA.map);
    } else HA.PB.mk.setLatLng(ll);
    var el = HA.PB.mk.getElement && HA.PB.mk.getElement();
    if (el && el.firstChild) el.firstChild.style.transform = 'rotate(' + (HA.PB.hd || 0) + 'deg)';
    if (pan && HA.PB.follow) {
      var off = HA.map.latLngToContainerPoint(ll).subtract(HA.map.getSize().divideBy(2));
      if (HA.PB.snap || Math.abs(off.x) > HA.map.getSize().x || Math.abs(off.y) > HA.map.getSize().y) { HA.map.setView(ll, HA.map.getZoom(), { animate: false }); HA.PB.snap = false; }
      else {
        // geser tanpa pembulatan piksel supaya gerak peta mulus; moveend berkala agar kanvas dan ubin menyusul
        HA.map._rawPanBy(off.multiplyBy(1 - Math.exp(-(dt || 16) / 220)));
        HA.map.fire('move');
        HA.PB.mv = (HA.PB.mv || 0) + (dt || 16);
        if (HA.PB.mv > 400) { HA.PB.mv = 0; HA.map.fire('moveend'); }
      }
    }
    $('pbSpd').textContent = String(Math.round(c.v));
    $('pbSpd').style.color = col;
    var d = new Date(c.t);
    $('pbClk').textContent = T.pad(d.getHours()) + '.' + T.pad(d.getMinutes()) + '.' + T.pad(d.getSeconds());
    $('pbSl').value = String(HA.PB.len ? Math.round(HA.PB.pos / HA.PB.len * 1000) : 0);
  }
  function pbTick(ts) {
    if (!HA.PB.playing) return;
    var dt = HA.PB.last ? Math.min(100, ts - HA.PB.last) : 16; HA.PB.last = ts;
    HA.PB.pos += dt * HA.PB.mult;
    if (HA.PB.pos >= HA.PB.len) { HA.PB.pos = HA.PB.len; pbPlay(false); pbDraw(true, dt); return; }
    pbDraw(true, dt);
    HA.PB.raf = requestAnimationFrame(pbTick);
  }
  function pbPlay(on) {
    HA.PB.playing = on; HA.PB.last = 0; cancelAnimationFrame(HA.PB.raf);
    if (!on && HA.map && HA.PB.open) HA.map.fire('moveend');
    $('pbPlay').innerHTML = on ? '❚❚' : '▶';
    if (on) { if (HA.PB.pos >= HA.PB.len) HA.PB.pos = 0; HA.PB.snap = HA.PB.snap || HA.PB.pos === 0; HA.PB.raf = requestAnimationFrame(pbTick); }
  }
  function pbOpen() {
    if (!HA.map) return;
    if (HA.DM && HA.DM.edit) { toast('Selesaikan edit dulu sebelum memutar'); return; }
    if (HA.closeBlockPop) HA.closeBlockPop();
    if ($('sheet').classList.contains('on')) closeSheet();
    HA.PB.open = true; $('pbBar').style.display = 'block'; $('pbHud').style.display = 'block';
    pbBuild();
    if (!HA.PB.seq.length) { toast('Belum ada lintasan untuk diputar'); pbClose(); return; }
    var ll = HA.PB.seq.map(function (p) { return [p.lat, p.lng]; });
    HA.PB.snap = true;
    setTimeout(function () { HA.map.invalidateSize(); HA.map.fitBounds(ll, { padding: [40, 40], maxZoom: 17 }); pbDraw(false); }, 80);
    pbSyncUi(); if (HA.DM && HA.DM.sync) HA.DM.sync();
  }
  function pbClose() {
    HA.PB.open = false; pbPlay(false);
    $('pbBar').style.display = 'none'; $('pbHud').style.display = 'none';
    if (HA.DM && HA.DM.sync) HA.DM.sync();
    if (HA.PB.mk && HA.map) HA.map.removeLayer(HA.PB.mk);
    HA.PB.mk = null; HA.PB.hd = 0;
    if (HA.map) setTimeout(function () { HA.map.invalidateSize(); }, 50);
  }
  function pbSyncUi() {
    document.querySelectorAll('#pbMult button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-m') === HA.PB.mult); });
    $('pbFol').classList.toggle('on', HA.PB.follow);
    $('pbFol').textContent = HA.PB.follow ? 'Ikuti: ya' : 'Ikuti: tidak';
  }
  function pbInit() {
    $('pbX').onclick = pbClose;
    $('pbPlay').onclick = function () { pbPlay(!HA.PB.playing); };
    $('pbSl').oninput = function () { HA.PB.pos = HA.PB.len * (+this.value) / 1000; HA.PB.snap = true; pbDraw(true); };
    $('pbMult').onclick = function (e) { var m = e.target.getAttribute && e.target.getAttribute('data-m'); if (m) { HA.PB.mult = +m; pbSyncUi(); } };
    $('pbFol').onclick = function () { HA.PB.follow = !HA.PB.follow; pbSyncUi(); };
  }
  function openMapMenu() {
    openSheet('<div class="grab"></div><div class="st">PETA</div>' +
      '<button class="srow" id="mmOv" style="margin-top:10px"><div class="si"><b>Peta saya</b><small>Lapisan PDF peta (tampil di mode Peta)</small></div>' + HA.CHEV + '</button>' +
      '<button class="srow" id="mmKml"><div class="si"><b>Ekspor KML</b><small>Lintasan hari ini untuk Google Earth, dengan ketinggian</small></div>' + HA.CHEV + '</button>' +
      '<label style="display:block;margin:6px 4px"><input type="checkbox" id="mmKc"' + (S.settings.kmlContour !== false ? ' checked' : '') + '> Sertakan kontur di KML</label>' +
      '<div class="h" style="margin-top:12px">JARAK KONTUR</div><div class="opts" id="mmCs">' + ['auto', '1', '2', '5', '10'].map(function (v) { return '<button class="opt' + ((S.settings.contourStep || 'auto') === v ? ' on' : '') + '" data-cs="' + v + '">' + (v === 'auto' ? 'Otomatis' : v + ' m') + '</button>'; }).join('') + '</div>' +
      '<div class="muted" style="margin-top:6px">Warna garis bergradasi: lembah merah muda pudar, makin tinggi makin abu lalu hijau muda. Otomatis: dengan data DEMNAS 10 m saat zoom jauh, 5 m menengah, 2 m dekat; tanpa DEMNAS (data gratis ±30 m) minimal 5 m.</div>' +
      '<button class="btn" id="mmX" style="width:100%;margin-top:10px">Tutup</button>');
    $('mmCs').onclick = function (e) { var v = e.target.getAttribute && e.target.getAttribute('data-cs'); if (!v) return; S.settings.contourStep = v; saveSettings(); document.querySelectorAll('#mmCs .opt').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-cs') === v); }); if (HA.DM.layer) HA.DM.layer.redraw(); };
    $('mmKc').onchange = function () { S.settings.kmlContour = this.checked; saveSettings(); };
    $('mmX').onclick = closeSheet;
    $('mmOv').onclick = function () { if (HA.pbLocked('Tutup Putar dulu untuk mengubah peta saya')) return; closeSheet(); openOvSheet(); };
    $('mmKml').onclick = function () { closeSheet(); mapKml(); };
  }
  // siapkan ketinggian + kontur untuk KML (butuh data ketinggian); selalu lanjut walau gagal
  function kmlPrep(ds, withC) {
    var opts = { title: 'HZ Trip ' + ds[0].ymd, ramp: window.HzDem && HzDem.rampColor, shapes: shapeItems(true) };
    if (!window.HzDem) return Promise.resolve(opts);
    var all = [];
    ds.forEach(function (day) { day.trips.forEach(function (x) { tripPts(day.pts, x.t).forEach(function (q) { all.push(q); }); }); });
    if (!all.length) return Promise.resolve(opts);
    toast('Menyiapkan ketinggian…');
    return HzDem.ensure(14, all).then(function () {
      opts.elev = function (lat, lng) { var e = HzDem.elev(lat, lng, 14); return isFinite(e) ? e : null; };
      if (!withC) return opts;
      var w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
      all.forEach(function (q) { s = Math.min(s, q[0]); n = Math.max(n, q[0]); w = Math.min(w, q[1]); e = Math.max(e, q[1]); });
      var m = 0.003;
      if (n - s > 0.1 || e - w > 0.1) { toast('Area terlalu luas untuk kontur (maks ±10 km); KML tanpa kontur'); return opts; }
      var bb = [w - m, s - m, e + m, n + m], step = HzDem.hasLocal((s + n) / 2, (w + e) / 2) ? 5 : 10;
      return HzDem.contourLines(bb, step).then(function (c) { opts.contours = c; opts.cstep = step; return opts; });
    }).catch(function (err) { toast(String(err && err.message || err)); return opts; });
  }
  function mapKml() {
    var day = S.mapDay;
    loadDay(day).then(function (d) {
      if (!d.trips.length) { toast('Belum ada trip pada hari ini'); return; }
      return kmlPrep([d], S.settings.kmlContour !== false).then(function (o) {
        return saveFile('HZTrip-' + day + '.kml', textB64(E.buildKml([d], o)), 'application/vnd.google-earth.kml+xml');
      });
    });
  }
})();
