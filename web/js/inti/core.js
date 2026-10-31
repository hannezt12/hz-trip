/* HZ Trip - dasar: jembatan Android, keadaan, navigasi */
(function () {
  'use strict';
  var HA = window.HzApp = { ok: true };
  // fungsi dari modul lain
  function renderSpido() { return HA.renderSpido.apply(this, arguments); }
  function renderUnitCard() { return HA.renderUnitCard.apply(this, arguments); }
  function loadRiwayat() { return HA.loadRiwayat.apply(this, arguments); }
  function renderHistory() { return HA.renderHistory.apply(this, arguments); }
  function exitSel() { return HA.exitSel.apply(this, arguments); }
  function renderHidden() { return HA.renderHidden.apply(this, arguments); }
  function renderSettings() { return HA.renderSettings.apply(this, arguments); }
  function renderCacheInfo() { return HA.renderCacheInfo.apply(this, arguments); }
  function applyFont() { return HA.applyFont.apply(this, arguments); }
  function applyTheme() { return HA.applyTheme.apply(this, arguments); }
  function showSet() { return HA.showSet.apply(this, arguments); }
  function closeMini() { return HA.closeMini.apply(this, arguments); }
  function locStop() { return HA.locStop.apply(this, arguments); }
  function renderData() { return HA.renderData.apply(this, arguments); }
  function renderOv() { return HA.renderOv.apply(this, arguments); }
  function openMap() { return HA.openMap.apply(this, arguments); }
  function spShow() { return HA.spShow.apply(this, arguments); }
  function spResetMain() { return HA.spResetMain.apply(this, arguments); }
  function spSetActive() { return HA.spSetActive.apply(this, arguments); }
  function pbClose() { return HA.pbClose.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.$ = $;
  HA.esc = esc;
  HA.zc = zc;
  HA.showErr = showErr;
  HA.opts = opts;
  HA.saveSettings = saveSettings;
  HA.saveOv = saveOv;
  HA.loadMeta = loadMeta;
  HA.toast = toast;
  HA.applyStatus = applyStatus;
  HA.askActivity = askActivity;
  HA.syncStatus = syncStatus;
  HA.pushSchedule = pushSchedule;
  HA.go = go;
  HA.openDrawer = openDrawer;
  HA.closeDrawer = closeDrawer;
  HA.openSheet = openSheet;
  HA.askConfirm = askConfirm;
  HA.closeSheet = closeSheet;

  var T = window.HzTrips;
  var E = window.HzEkspor;
  var COL = { g: '#3FD07A', y: '#F5C518', r: '#FF5B50', s: '#9AA3A8' };
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zc(v) { return 'var(--' + T.zoneOf(v) + ')'; }

  // ---------- jembatan ke Android (atau tiruan di browser untuk uji) ----------
  var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var Plug;
  try {
    Plug = native
      ? (window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin('HzTrip') : window.Capacitor.Plugins.HzTrip)
      : mockPlugin();
  } catch (e) { Plug = null; }
  window.addEventListener('error', function (e) { showErr(e.message); });
  window.addEventListener('unhandledrejection', function (e) { showErr(e.reason && e.reason.message || e.reason); });
  function showErr(m) {
    var b = document.getElementById('errBar');
    if (!b) { b = document.createElement('div'); b.id = 'errBar'; b.className = 'warn'; b.style.cssText = 'position:fixed;left:12px;right:12px;top:60px;z-index:99'; document.body.appendChild(b); }
    b.textContent = 'Galat: ' + m;
  }
  if (!Plug) { HA.ok = false; showErr('Plugin perekam tidak ditemukan'); return; }

  function mockPlugin() {
    var L = {}, timer = null, sec = 0, mode = 'tidur', lat = -4.9, lng = 105.2, sched = { auto: true, margin: 30 }, notif = false;
    function k(d) { return 'mock-pts-' + d; }
    function st() { return { mode: mode, recording: mode === 'rekam', manual: mode === 'rekam', permission: true, background: false, batteryFree: false, auto: sched.auto, paused: false, winEnd: 0, nextStart: Date.now() + 8 * 3600000, count: sec, lastT: Date.now(), lastV: 0, lastAcc: 6, gpsOn: mode === 'rekam', sigSensor: true, actPerm: true, notif: notif, overlay: true, popupSound: localStorage.getItem('mock-popsnd') || 'alarm', popupName: localStorage.getItem('mock-popname') || '' }; }
    function emit(n, o) { (L[n] || []).forEach(function (f) { f(o); }); }
    return {
      addListener: function (n, f) { (L[n] = L[n] || []).push(f); return Promise.resolve({ remove: function () {} }); },
      ensurePermissions: function () { return Promise.resolve({ granted: true }); },
      ensureBackground: function () { return Promise.resolve(st()); },
      ensureActivity: function () { return Promise.resolve(st()); },
      openOverlaySettings: function () { return Promise.resolve(); },
      keepScreen: function () { return Promise.resolve(); },
      setPopupSound: function (o) { localStorage.setItem('mock-popsnd', o.mode); return Promise.resolve(); },
      pickPopupSound: function () { localStorage.setItem('mock-popname', 'Nada uji'); return Promise.resolve({ changed: true, name: 'Nada uji' }); },
      clearPopupSound: function () { localStorage.removeItem('mock-popname'); return Promise.resolve(); },
      testPopupSound: function () { return Promise.resolve(); },
      setSchedule: function (o) { sched = o; return Promise.resolve(st()); },
      resumeAuto: function () { notif = false; return Promise.resolve(st()); },
      setWatch: function (o) { notif = o.mode === 'notif'; return Promise.resolve(); },
      start: function () {
        mode = 'rekam'; sec = 0;
        timer = setInterval(function () {
          sec++;
          var v = sec < 20 ? sec * 2 : (sec < 120 ? 45 + 25 * Math.sin(sec / 9) : (sec < 150 ? 0 : 50 + 45 * Math.abs(Math.sin(sec / 15))));
          var t = Date.now();
          lat += v / 3.6 * 0.000007; lng += v / 3.6 * 0.000007;
          var d = T.ymd(t), old = localStorage.getItem(k(d)) || '';
          localStorage.setItem(k(d), old + [t, lat.toFixed(6), lng.toFixed(6), (v / 3.6).toFixed(2), 6, 1].join(',') + '\n');
          emit('fix', { t: t, lat: lat, lng: lng, v: v / 3.6, acc: 6, count: sec });
        }, 250);
        emit('state', st());
        return Promise.resolve({ recording: true });
      },
      stop: function () { clearInterval(timer); mode = 'tidur'; notif = true; emit('state', st()); return Promise.resolve({ recording: false }); },
      status: function () { return Promise.resolve(st()); },
      listDays: function () { var a = []; for (var i = 0; i < localStorage.length; i++) { var n = localStorage.key(i); if (n.indexOf('mock-pts-') === 0) a.push(n.slice(9)); } return Promise.resolve({ days: a.sort() }); },
      readDay: function (o) { return Promise.resolve({ text: localStorage.getItem(k(o.date)) || '' }); },
      deletePoints: function (o) {
        var t = localStorage.getItem(k(o.date)) || '', n = 0;
        var keep = t.split('\n').filter(function (l) { if (!l) return false; var ts = +l.split(',')[0]; if (ts >= +o.from && ts <= +o.to) { n++; return false; } return true; });
        localStorage.setItem(k(o.date), keep.length ? keep.join('\n') + '\n' : '');
        return Promise.resolve({ removed: n });
      },
      readDiag: function () { return Promise.resolve({ text: localStorage.getItem('mock-diag') || '' }); },
      clearDiag: function () { localStorage.removeItem('mock-diag'); return Promise.resolve({}); },
      writeDay: function (o) { if (localStorage.getItem(k(o.date)) && o.overwrite !== '1') return Promise.resolve({ written: false }); localStorage.setItem(k(o.date), o.text); return Promise.resolve({ written: true }); },
      saveJson: function (o) { localStorage.setItem('mock-json-' + o.name, o.data); return Promise.resolve(); },
      loadJson: function (o) { return Promise.resolve({ data: localStorage.getItem('mock-json-' + o.name) || '' }); },
      openBatterySettings: function () { return Promise.resolve(); }
    };
  }

  // ---------- keadaan ----------
  var S = {
    view: 'spido', mode: 'tidur', manual: false, paused: false, auto: true, winEnd: 0, nextStart: 0,
    perm: true, bg: true, battFree: false,
    live: { v: 0, acc: 0, t: 0, count: 0 },
    settings: { units: ['BT.13', 'Motor'], defUnit: 'BT.13', splitSec: 60, auto: true, margin: 30, driver: 'Han', radius: 150, unitType: { 'BT.13': 'Kerja', 'Motor': 'Pribadi' }, unitLog: [{ t: 0, k: 'Kerja', u: 'BT.13' }, { t: 0, k: 'Pribadi', u: 'Motor' }], mapMode: 'sat', schedule: T.defaultSchedule() },
    ov: { trips: {}, days: {} },
    today: T.ymd(Date.now()), todayPts: [], liveTrip: null,
    hDay: T.ymd(Date.now()), hTrips: [], hMode: 'list', sel: null, mapDay: ''
  };

  function opts() { return { splitSec: S.settings.splitSec }; }
  function saveSettings() { return Plug.saveJson({ name: 'settings', data: JSON.stringify(S.settings) }).catch(function () {}); }
  function saveOv() { return Plug.saveJson({ name: 'overrides', data: JSON.stringify(S.ov) }).catch(function () { toast('Perubahan gagal disimpan'); }); }
  function loadMeta() {
    return Promise.all([Plug.loadJson({ name: 'settings' }), Plug.loadJson({ name: 'overrides' })]).then(function (r) {
      try { var s = JSON.parse(r[0].data); if (s && s.units) S.settings = Object.assign(S.settings, s); if (S.settings.mapMode === 'none') S.settings.mapMode = 'osm'; } catch (e) {}
      try { var o = JSON.parse(r[1].data); if (o && o.trips) { S.ov = o; if (!S.ov.days) S.ov.days = {}; } } catch (e) {}
      if (!S.ov.hidden) S.ov.hidden = [];
      var st = S.settings;
      if (!st.unitType) {
        st.unitType = {};
        st.units.forEach(function (u) { st.unitType[u] = /motor|pribadi|mobil/i.test(u) ? 'Pribadi' : 'Kerja'; });
      }
      if (!st.unitLog) st.unitLog = [];
      st.unitLog = st.unitLog.map(function (e) { if (!e.ov && !e.k) e.k = (st.unitType[e.u] || 'Kerja'); return e; });
      ['Kerja', 'Pribadi'].forEach(function (k) {
        if (!st.unitLog.some(function (e) { return !e.ov && e.k === k; })) {
          var f = st.units.filter(function (u) { return st.unitType[u] === k; })[0] || st.units[0];
          st.unitLog.unshift({ t: 0, k: k, u: f });
        }
      });
      if (!S.settings.schedule || !S.settings.schedule.days || S.settings.schedule.days.length !== 7) S.settings.schedule = T.defaultSchedule();
      if (!S.settings.firstSeen) { S.settings.firstSeen = Date.now(); saveSettings(); }
      applyTheme(); applyFont();
    }).catch(function () {});
  }

  var toastT;
  function toast(msg) { var e = $('toast'); e.textContent = msg; e.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function () { e.style.display = 'none'; }, 2800); }

  // ---------- status dari Android ----------
  function applyStatus(s) {
    if (!s) return;
    S.mode = s.mode || (s.recording ? 'rekam' : 'tidur');
    S.manual = !!s.manual; S.paused = !!s.paused; S.auto = s.auto !== false;
    S.winEnd = s.winEnd || 0; S.nextStart = s.nextStart || 0;
    S.popSnd = s.popupSound || 'alarm'; S.popName = s.popupName || ''; S.notif = !!s.notif; S.overlay = s.overlay !== false; S.actPerm = s.actPerm !== false; S.gpsOn = !!s.gpsOn; S.sigSensor = s.sigSensor !== false; S.lastT = s.lastT || 0;
    S.perm = s.permission !== false; S.bg = s.background !== false; S.battFree = !!s.batteryFree;
    if (S.mode !== 'rekam') S.live.t = 0;
    else if (s.lastT) S.live = { v: s.lastV * 3.6, acc: s.lastAcc, t: S.live.t, count: s.count };
    if (S.view === 'spido') renderSpido();
    if (S.view === 'set') renderSettings();
  }
  function askActivity() { Plug.ensureActivity().then(applyStatus).catch(function () {}); }
  function syncStatus() { return Plug.status().then(applyStatus).catch(function () {}); }
  var pushT;
  function pushSchedule() {
    clearTimeout(pushT);
    pushT = setTimeout(function () {
      Plug.setSchedule({ days: T.nativeDays(S.settings.schedule), auto: S.settings.auto, margin: S.settings.margin, radius: S.settings.radius }).then(applyStatus).catch(function () {});
    }, 600);
  }

  // ---------- navigasi ----------
  var TITLES = { spido: 'SPIDOMETER', lintasan: 'LINTASAN', riwayat: 'RIWAYAT', set: 'PENGATURAN', data: 'DATA PETA' };
  function go(v) {
    S.view = v;
    ['spido', 'lintasan', 'riwayat', 'set', 'data'].forEach(function (n) { $('v-' + n).classList.toggle('on', n === v); });
    $('main').classList.toggle('map', v === 'lintasan');
    $('main').classList.toggle('pg', v === 'spido');
    if (v !== 'spido') spSetActive(false); else spResetMain();
    if (S.sel) exitSel();
    $('ttl').textContent = TITLES[v];
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-go') === v); });
    closeDrawer();
    if (v !== 'riwayat') closeMini(true);
    if (v !== 'lintasan' && HA.map && HA.map._loc) locStop(HA.map);
    if (v !== 'lintasan' && HA.PB.open) pbClose();
    if (v === 'riwayat') { S.hMode = 'list'; loadRiwayat(); }
    if (v === 'lintasan') openMap();
    if (S.spPushed && v !== 'set') { S.spPushed = false; try { history.back(); } catch (e) {} }
    if (v === 'set') { showSet(null); renderOv(); renderSettings(); syncStatus(); renderCacheInfo(); renderHidden(); }
    if (v === 'spido') { syncStatus(); renderSpido(); renderUnitCard(); }
    if (v === 'data') renderData();
    $('main').scrollTop = 0;
  }
  function openDrawer() { $('drawer').classList.add('on'); $('scrim').classList.add('on'); }
  function closeDrawer() { $('drawer').classList.remove('on'); if (!$('sheet').classList.contains('on')) $('scrim').classList.remove('on'); }
  function openSheet(html) { $('sheet').innerHTML = html; $('sheet').classList.add('on'); $('scrim').classList.add('on'); }
  function askConfirm(title, msg, okLabel, onOk) {
    openSheet('<div class="grab"></div><div class="st">' + esc(title) + '</div><div class="muted" style="margin:6px 0 14px">' + esc(msg) + '</div>' +
      '<div class="row"><button class="btn" id="cfNo" style="flex:1;height:50px">Batal</button><button class="btn pri" id="cfYes" style="flex:1;height:50px;background:var(--r);border-color:var(--r);color:#fff">' + esc(okLabel) + '</button></div>');
    $('cfNo').onclick = closeSheet;
    $('cfYes').onclick = function () { closeSheet(); onOk(); };
  }
  function closeSheet() { $('sheet').classList.remove('on'); $('scrim').classList.remove('on'); var h = HA.onSheetClose; HA.onSheetClose = null; if (h) h(); }

  // Tombol back Android (dipanggil dari MainActivity): true = sudah ditangani di halaman.
  window.hzBack = function () {
    if ($('sheet').classList.contains('on')) { closeSheet(); return true; }
    if ($('drawer').classList.contains('on')) { $('drawer').classList.remove('on'); $('scrim').classList.remove('on'); return true; }
    if (S.sel) { exitSel(); renderHistory(); return true; }
    if (S.view === 'riwayat' && S.hMode === 'day') { S.hMode = 'list'; loadRiwayat(); return true; }
    if (S.view !== 'spido') { go('spido'); return true; }
    if (HA.SP.active) { spShow('main'); return true; }
    return false;
  };

  // dibagikan ke modul lain
  HA.T = T;
  HA.E = E;
  HA.COL = COL;
  HA.HARI = HARI;
  HA.native = native;
  HA.Plug = Plug;
  HA.S = S;
})();
