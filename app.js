/* HZ Trip - tampilan dan alur aplikasi (tahap 2) */
(function () {
  'use strict';
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
  if (!Plug) { showErr('Plugin perekam tidak ditemukan'); return; }

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
    if (v !== 'lintasan' && map && map._loc) locStop(map);
    if (v !== 'lintasan' && PB.open) pbClose();
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
  function closeSheet() { $('sheet').classList.remove('on'); $('scrim').classList.remove('on'); }

  // Tombol back Android (dipanggil dari MainActivity): true = sudah ditangani di halaman.
  window.hzBack = function () {
    if ($('sheet').classList.contains('on')) { closeSheet(); return true; }
    if ($('drawer').classList.contains('on')) { $('drawer').classList.remove('on'); $('scrim').classList.remove('on'); return true; }
    if (S.sel) { exitSel(); renderHistory(); return true; }
    if (S.view === 'riwayat' && S.hMode === 'day') { S.hMode = 'list'; loadRiwayat(); return true; }
    if (S.view !== 'spido') { go('spido'); return true; }
    if (SP.active) { spShow('main'); return true; }
    return false;
  };

  // ---------- spidometer ----------
  function arcPath(r, a0, a1) {
    var cx = 180, cy = 170, rad = Math.PI / 180;
    var x0 = cx + r * Math.cos(a0 * rad), y0 = cy + r * Math.sin(a0 * rad);
    var x1 = cx + r * Math.cos(a1 * rad), y1 = cy + r * Math.sin(a1 * rad);
    return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
  }
  function drawGauge(v) {
    var a0 = 150, span = 240, f = Math.max(0, Math.min(v, 120)) / 120;
    $('gTrack').setAttribute('d', arcPath(140, a0, a0 + span));
    var g = $('gVal');
    if (f < 0.004) { g.setAttribute('d', ''); return; }
    g.setAttribute('d', arcPath(140, a0, a0 + span * f));
    g.style.stroke = zc(v);
  }
  function whenText(ts) {
    var d = new Date(ts), n = new Date();
    if (T.ymd(ts) === T.ymd(n.getTime())) return 'hari ini ' + T.hm(ts);
    var t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    if (T.ymd(ts) === T.ymd(t.getTime())) return 'besok ' + T.hm(ts);
    return HARI[d.getDay()] + ' ' + T.hm(ts);
  }
  function modeHtml() {
    if (S.mode === 'rekam') return (S.manual ? '<b>Merekam manual</b>' : '<b>Merekam otomatis</b> · berhenti sendiri setelah 5 menit diam');
    var onAuto = S.mode === 'siaga' || S.mode === 'cek', onNotif = !onAuto && S.notif;
    if (S.mode === 'siaga') return '<b>Siaga otomatis</b> · menunggu kendaraan jalan' + (S.winEnd ? '<br>Sampai jam ' + T.hm(S.winEnd) : '');
    if (S.mode === 'cek') return '<b>Memeriksa gerakan…</b> GPS menyala sebentar';
    if (onNotif) return '<b>Pengingat aktif</b> · GPS mati, popup muncul bila Anda mulai bergerak. Perekaman tetap Anda mulai sendiri.';
    if (!S.auto) return 'Rekam otomatis dimatikan (Pengaturan).';
    if (S.paused) return '<b>Otomatis dijeda</b> sampai jadwal berikutnya';
    if (S.nextStart) return 'Tidur · di luar jadwal<br>otomatis aktif ' + whenText(S.nextStart);
    return 'Jadwal mingguan belum diisi.<br><button class="btn sm" data-act="sched" style="margin-top:6px">Isi jadwal</button>';
  }
  function modeBtnsHtml() {
    if (S.mode === 'rekam') return '';
    var onAuto = S.mode === 'siaga' || S.mode === 'cek', onNotif = !onAuto && S.notif;
    return '<div class="mrow2"><button class="btn' + (onAuto ? ' on' : '') + '" data-act="auto">Aktifkan otomatis</button><button class="btn' + (onNotif ? ' on' : '') + '" data-act="notif">Pengingat aktif</button></div>';
  }
  function renderSpido() {
    var rec = S.mode === 'rekam';
    var fresh = rec && S.live.t && (Date.now() - S.live.t) < 5000;
    var v = fresh ? S.live.v : 0;
    $('gNum').textContent = Math.round(v);
    $('gNum').style.color = fresh && v > 0 ? zc(v) : '';
    drawGauge(v);
    renderBkNote(false);
    var lt = S.liveTrip;
    $('sMax').textContent = lt ? Math.round(lt.max) : '–';
    $('sAvg').textContent = lt ? Math.round(lt.avg) : '–';
    $('sKm').textContent = lt ? T.km1(lt.km) : '–';
    var b = $('btnRec');
    if (rec) { b.className = 'recbtn stop'; b.innerHTML = '<span class="dot"></span>Akhiri perekaman'; }
    else { b.className = 'recbtn start'; b.textContent = 'Mulai merekam (manual)'; }
    var g = '';
    if (rec) g = !S.live.t ? 'Menunggu sinyal GPS…' : 'GPS ±' + Math.round(S.live.acc) + ' m · ' + S.live.count + ' titik';
    $('gpsLine').textContent = g;
    $('modeBox').innerHTML = modeHtml();
    $('modeBtns').innerHTML = modeBtnsHtml();
    var w = '';
    if (!S.perm) w += '<div class="warn">Izin lokasi belum diberikan. Tekan Mulai lalu pilih "Izinkan".</div>';
    else if (native && S.auto && !S.bg) w += '<div class="warn">Agar rekam otomatis jalan saat layar mati, izinkan lokasi "Selalu".<br><button class="btn sm" data-act="bg" style="margin-top:8px">Atur izin lokasi</button></div>';
    if (native && S.auto && !S.overlay) w += '<div class="warn">Agar popup pengingat muncul di atas aplikasi lain, izinkan "Tampil di atas aplikasi lain".<br><button class="btn sm" data-act="over" style="margin-top:8px">Atur izin popup</button></div>';
    if (native && !S.battFree) w += '<div class="warn">Penghematan baterai belum dimatikan untuk HZ Trip.<br><button class="btn sm" data-act="batt" style="margin-top:8px">Buka pengaturan baterai</button></div>';
    $('warnBox').innerHTML = w;
  }

  function recomputeLive() {
    var r = T.detectTrips(S.todayPts, opts());
    var tr = r.trips[r.trips.length - 1];
    var last = S.todayPts.length ? S.todayPts[S.todayPts.length - 1].t : 0;
    S.liveTrip = (tr && (tr.open || last - tr.end < 120000)) ? tr : null;
  }
  function onFix(f) {
    if (T.ymd(f.t) !== S.today) { S.today = T.ymd(f.t); S.todayPts = []; }
    S.live = { v: f.v * 3.6, acc: f.acc, t: Date.now(), count: f.count };
    S.todayPts.push({ t: f.t, lat: f.lat, lng: f.lng, v: f.v * 3.6, acc: f.acc, m: 0 });
    if (f.count % 5 === 0 || !S.liveTrip) recomputeLive();
    if (SP.active) spOnFix(f);
    if (S.view === 'spido') renderSpido();
  }
  function refreshToday() {
    S.today = T.ymd(Date.now());
    return Plug.readDay({ date: S.today }).then(function (r) {
      S.todayPts = T.parseCsv(r.text);
      recomputeLive();
    }).catch(function () {});
  }

  function toggleRec() {
    if (S.mode === 'rekam') {
      Plug.stop().then(function () { setTimeout(syncStatus, 400); toast(S.manual ? 'Perekaman diakhiri. Pengingat aktif' : 'Otomatis dijeda. Pengingat aktif'); });
      return;
    }
    Plug.ensurePermissions().then(function (r) {
      S.perm = !!r.granted;
      if (!r.granted) { renderSpido(); toast('Izin lokasi diperlukan untuk merekam'); return; }
      return Plug.start().then(function () { S.live.t = 0; setTimeout(syncStatus, 400); });
    }).catch(function (e) { toast(String(e && e.message || e)); });
  }
  function askBackground() {
    Plug.ensureBackground().then(function (s) {
      applyStatus(s);
      if (!S.bg) toast('Pilih "Selalu izinkan" di layar izin lokasi');
    }).catch(function (e) { toast(String(e && e.message || e)); });
  }
  function openBatt() { Plug.openBatterySettings().catch(function () { toast('Tidak bisa membuka pengaturan baterai'); }); }
  function onModeAction(e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-act');
    if (a === 'resume' || a === 'auto') {
      if (!S.auto) { toast('Rekam otomatis dimatikan di Pengaturan'); return; }
      Plug.resumeAuto().then(function (st) { applyStatus(st); setTimeout(syncStatus, 500); if (S.mode !== 'siaga' && S.mode !== 'cek' && S.nextStart) toast('Di luar jadwal. Otomatis aktif ' + whenText(S.nextStart)); });
    }
    else if (a === 'notif') Plug.setWatch({ mode: 'notif' }).then(function () { setTimeout(syncStatus, 500); toast('Pengingat aktif'); }).catch(function (x) { toast(String(x && x.message || x)); });
    else if (a === 'sched') go('set');
    else if (a === 'bg') askBackground();
    else if (a === 'batt') openBatt();
    else if (a === 'over') Plug.openOverlaySettings().catch(function () {});
  }

  // ---------- riwayat ----------
  function typeOf(u) { return (S.settings.unitType && S.settings.unitType[u]) || 'Kerja'; }
  var KINDS = ['Kerja', 'Pribadi'];
  function firstOfType(k) {
    var us = S.settings.units;
    for (var i = 0; i < us.length; i++) if (typeOf(us[i]) === k) return us[i];
    return us[0];
  }
  function slotAt(k, ts) {
    var lg = S.settings.unitLog, r = null, i;
    for (i = 0; i < lg.length; i++) { var e = lg[i]; if (!e.ov && e.k === k && e.t <= ts) r = e.u; }
    if (r) return r;
    for (i = 0; i < lg.length; i++) if (!lg[i].ov && lg[i].k === k) return lg[i].u;
    return firstOfType(k);
  }
  function overrideAt(ts) {
    var lg = S.settings.unitLog;
    for (var i = lg.length - 1; i >= 0; i--) {
      if (lg[i].ov && lg[i].t <= ts) return (lg[i].u && lg[i].until > ts) ? lg[i] : null;
    }
    return null;
  }
  function kindAt(ts) { return T.classify(S.settings.schedule, ts); }
  function unitAt(ts) { var o = overrideAt(ts); return o ? o.u : slotAt(kindAt(ts), ts); }
  function nextBoundary(now) {
    var k0 = kindAt(now), t0 = Math.floor(now / 60000) * 60000;
    for (var i = 1; i <= 2880; i++) { var ts = t0 + i * 60000; if (kindAt(ts) !== k0) return ts; }
    return now + 48 * 3600000;
  }
  function pushLog(e) {
    var lg = S.settings.unitLog;
    lg.push(e);
    if (lg.length > 400) lg.splice(2, 100);
  }
  function setUnit(u) {
    var now = Date.now(), k = typeOf(u), cur = unitAt(now);
    if (u === cur && !overrideAt(now)) return;
    pushLog({ t: now, k: k, u: u });
    if (k !== kindAt(now)) pushLog({ ov: true, t: now, u: u, until: nextBoundary(now) });
    else pushLog({ ov: true, t: now, u: null, until: 0 });
    S.settings.defUnit = u;
    saveSettings();
  }
  function fixSlotsAfterDelete(u) {
    var now = Date.now();
    KINDS.forEach(function (k) { if (slotAt(k, now) === u) pushLog({ t: now, k: k, u: firstOfType(k) }); });
    var o = overrideAt(now);
    if (o && o.u === u) pushLog({ ov: true, t: now, u: null, until: 0 });
  }
  function renderUnitCard() {
    var sel = $('unitSel');
    if (!sel || document.activeElement === sel) return;
    var now = Date.now(), a = unitAt(now), o = overrideAt(now);
    sel.innerHTML = S.settings.units.map(function (u) { return '<option value="' + esc(u) + '"' + (u === a ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('');
    var nt = $('unitNote');
    if (nt) nt.textContent = o ? 'Manual sampai ' + T.hm(o.until) + ', lalu kembali otomatis.' : typeOf(a) + ' · otomatis sesuai jadwal';
  }
  var KEEP_MS = 30 * 24 * 3600000;
  function visible(ymd, trips) {
    var hid = (S.ov.hidden || []).filter(function (h) { return h.day === ymd; });
    if (!hid.length) return trips;
    return trips.filter(function (t) { return !hid.some(function (h) { return t.start <= h.end && t.end >= h.start; }); });
  }
  function detectDay(ymd, text) {
    var res = T.detectTrips(T.parseCsv(text), opts()), a = S.ov.arch && S.ov.arch[ymd];
    if (a) res.trips.forEach(function (t) { var x = a[t.id]; if (x) Object.keys(x).forEach(function (k) { t[k] = x[k]; }); });
    return res;
  }
  // Trip pendek otomatis yang muncul lama setelah trip sebelumnya dianggap salah dan disembunyikan (bisa dipulihkan 30 hari).
  var junkSeq = 0;
  function autoJunk(ymd, trips) {
    return; // aturan trip pendek salah dihapus (v0.7.3): semua trip tampil
    var ed = S.ov.days[ymd];
    if (ed && ed.ops && ed.ops.length) return;
    var gapMs = (S.settings.junkGap || 30) * 60000, maxKm = (S.settings.junkM || 500) / 1000, changed = false;
    if (!S.ov.keep) S.ov.keep = [];
    for (var i = 1; i < trips.length; i++) {
      var t = trips[i], p = trips[i - 1];
      if (t.open || t.manual || t.km >= maxKm || t.start - p.end <= gapMs) continue;
      if (S.ov.keep.indexOf(t.id) >= 0) continue;
      if ((S.ov.hidden || []).some(function (h) { return h.day === ymd && t.start <= h.end && t.end >= h.start; })) continue;
      S.ov.hidden.push({ day: ymd, start: t.start, end: t.end, at: Date.now() + (junkSeq++ % 1000), unit: unitAt(t.start), km: t.km, auto: true, id: t.id, gapMin: Math.round((t.start - p.end) / 60000) });
      changed = true;
    }
    if (changed) saveOv();
  }
  function edited(ymd, res) {
    var tr = T.applyEdits(res, S.ov.days[ymd]);
    autoJunk(ymd, tr);
    return visible(ymd, tr);
  }
  function tripView(t) {
    var o = S.ov.trips[t.id] || {};
    var u = o.unit || unitAt(t.start);
    return { t: t, unit: u, label: typeOf(u), check: T.classify(S.settings.schedule, t.start) !== T.classify(S.settings.schedule, t.end - 1000), hist: o.hist || [] };
  }
  // ---------- ringkasan 30 hari ----------
  function daySumm(ymd) {
    return Plug.readDay({ date: ymd }).then(function (r) {
      var res = detectDay(ymd, r.text);
      var tr = edited(ymd, res);
      var km = 0, mx = 0, ws = 0, ds = 0;
      tr.forEach(function (t) { km += t.km; mx = Math.max(mx, t.max); ws += t.avg * t.durSec; ds += t.durSec; });
      return { ymd: ymd, n: tr.length, km: km, max: mx, avg: ds ? ws / ds : 0, tr: tr, pts: res.points };
    }).catch(function () { return { ymd: ymd, n: 0, km: 0, max: 0, avg: 0 }; });
  }
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HR3 = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  function loadMonth() {
    var list = [], now = new Date(), i;
    for (i = 0; i < 30; i++) list.push(T.ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime()));
    return Promise.all(list.map(daySumm)).then(function (rows) {
      if (S.view !== 'riwayat' || S.hMode !== 'list') return;
      var n = 0, km = 0, mx = 0, dd = 0;
      rows.forEach(function (r) { n += r.n; km += r.km; mx = Math.max(mx, r.max); if (r.n) dd++; });
      var html = '<div class="card"><div class="sum"><div><b>' + n + '</b><small>trip</small></div><div><b>' + T.km1(km) + '</b><small>km</small></div><div><b style="color:' + zc(mx) + '">' + Math.round(mx) + '</b><small>maks km/j</small></div></div>' +
        '<div class="muted" style="margin-top:8px;text-align:center">30 hari terakhir · ' + dd + ' hari ada perjalanan</div></div>';
      html += rows.map(function (r) {
        var d = r.ymd.split('-'), dt = new Date(+d[0], +d[1] - 1, +d[2]);
        var head = '<div class="md"><small>' + HR3[dt.getDay()] + '</small><b>' + (+d[2]) + ' ' + BLN[dt.getMonth()] + '</b></div>';
        if (!r.n) return '<button class="mrow none" data-d="' + r.ymd + '">' + head + '<div class="mc"><b>–</b></div></button>';
        return '<button class="mrow" data-d="' + r.ymd + '">' + head +
          '<div class="mc"><small>MAKS</small><b style="color:' + zc(r.max) + '">' + Math.round(r.max) + '</b></div>' +
          '<div class="mc"><small>RATA2</small><b>' + Math.round(r.avg) + '</b></div>' +
          '<div class="mc"><small>KM</small><b>' + T.km1(r.km) + '</b></div>' +
          '<div class="mt">' + r.n + ' trip</div></button>';
      }).join('');
      $('monthView').innerHTML = html;
      fillMonthClimb(rows);
    });
  }
  // total naik per hari di daftar 30 hari (dihitung di latar belakang dari data ketinggian)
  function fillMonthClimb(rows) {
    var days = rows.filter(function (r) { return r.n; }), i = 0, stop = false;
    function nx() {
      if (i >= days.length || stop || S.view !== 'riwayat' || S.hMode !== 'list') return;
      var r = days[i++], tot = 0, got = 0, items = r.tr.map(function (t) { return { t: t, pts: r.pts }; });
      climbSeq(items, function (it, c) { tot += c.up; got++; }).then(function () {
        if (got < items.length) { if (!got) stop = true; }
        if (got) {
          var el = document.querySelector('#monthView .mrow[data-d="' + r.ymd + '"] .mt');
          if (el) el.textContent = r.n + ' trip · ▲ ' + Math.round(tot) + ' m';
        }
        nx();
      });
    }
    nx();
  }
  function fillDayClimb() {
    var day = S.hDay, items = S.hTrips.map(function (x) { return { t: x.t, pts: S.hPts }; });
    items.forEach(function (it, i) {
      climbOfTrip(it.t, it.pts).then(function (c) {
        if (!c || day !== S.hDay) return;
        var el = document.querySelector('#tripList [data-cl="' + i + '"]');
        if (el) el.textContent = '▲ naik ' + c.up + ' m · ▼ turun ' + c.down + ' m · ' + c.min + '–' + c.max + ' m';
      });
    });
  }
  function loadRiwayat() {
    var list = S.hMode === 'list';
    $('monthView').style.display = list ? 'block' : 'none';
    $('dayView').style.display = list ? 'none' : 'block';
    if (list) { if (!$('monthView').firstChild) $('monthView').innerHTML = '<div class="empty">Menghitung…</div>'; loadMonth(); }
    else loadHistory();
  }

  function dayEdits() { return S.ov.days[S.hDay] || (S.ov.days[S.hDay] = { ops: [] }); }
  function loadHistory() {
    Plug.readDay({ date: S.hDay }).then(function (r) {
      var res = detectDay(S.hDay, r.text);
      S.hTrips = edited(S.hDay, res).map(tripView); S.hPts = res.points;
      renderHistory();
    }).catch(function () { S.hTrips = []; S.hPts = []; renderHistory(); });
  }
  function labelChip(x) {
    var c = x.label === 'Kerja' ? 'k' : 'p';
    return '<span class="chip ' + c + '">' + x.label + '</span>' + (x.check ? '<span class="chip f">melewati batas jam</span>' : '') + (x.t.parts ? '<span class="chip m">' + x.t.parts.length + ' bagian</span>' : '');
  }
  function renderHistory() {
    refreshMini();
    $('mergeBar').style.display = S.sel ? 'flex' : 'none';
    $('tripList').style.paddingBottom = S.sel ? '90px' : '0';
    if (S.sel) updateMergeBar();
    $('dLabel').textContent = T.dateLong(S.hDay);
    $('dPick').value = S.hDay;
    $('dNext').style.opacity = S.hDay >= T.ymd(Date.now()) ? '.3' : '1';
    var list = S.hTrips, box = $('daySum'), km = 0, mx = 0, zg = 0, zy = 0, zr = 0, kk = 0, kp = 0;
    list.forEach(function (x) {
      km += x.t.km; mx = Math.max(mx, x.t.max); zg += x.t.zg; zy += x.t.zy; zr += x.t.zr;
      if (x.label === 'Kerja') kk += x.t.km; else kp += x.t.km;
    });
    if (!list.length) {
      box.innerHTML = '';
      $('tripList').innerHTML = '<div class="empty">Belum ada trip pada hari ini.<br>Trip tercatat otomatis saat Anda berkendara dalam jadwal, atau saat perekaman manual menyala.</div>';
      return;
    }
    var tot = zg + zy + zr || 1;
    box.innerHTML = '<div class="card"><div class="sum"><div><b>' + list.length + '</b><small>trip</small></div><div><b>' + T.km1(km) + '</b><small>km</small></div><div><b style="color:' + zc(mx) + '">' + Math.round(mx) + '</b><small>maks km/j</small></div></div>' +
      '<div class="zbar"><div style="flex:' + zg / tot + ';background:var(--g)"></div><div style="flex:' + zy / tot + ';background:var(--y)"></div><div style="flex:' + zr / tot + ';background:var(--r)"></div></div>' +
      '<div class="muted" style="margin-top:8px">Kerja ' + T.km1(kk) + ' km · Pribadi ' + T.km1(kp) + ' km<br>Waktu bergerak: hijau ' + T.durText(zg) + ' · kuning ' + T.durText(zy) + ' · merah ' + T.durText(zr) + '</div></div>';
    $('tripList').innerHTML = list.map(function (x, i) {
      var t = x.t;
      var isSel = S.sel && S.sel.indexOf(i) >= 0, dim = S.sel && !isSel && !(i === selLo() - 1 || i === selHi() + 1);
      return '<button class="trip' + (isSel ? ' sel' : '') + (dim ? ' dim' : '') + (S.mini && S.mini.i === i ? ' mapped' : '') + '" data-i="' + i + '"><div class="t1">' + (S.sel ? '<span class="cbx">' + (isSel ? '✓' : '') + '</span>' : '') + '<span class="tm">' + T.hm(t.start) + ' – ' + T.hm(t.end) + (t.open ? ' ●' : '') + '</span>' + (t.manual ? '<span class="chip m">manual</span>' : '') + '<span class="chip">' + esc(x.unit) + '</span>' + labelChip(x) + '<span class="pmap" data-pm="' + i + '">' + (S.mini && S.mini.i === i ? 'Tutup' : 'Peta') + '</span></div>' +
        '<div class="t2"><div><small>DURASI</small><b style="font-size:max(11px,calc(18px * var(--fs,1)))">' + T.durText(t.durSec) + '</b></div><div><small>MIN</small><b>' + Math.round(t.min) + '</b></div><div><small>MAKS</small><b style="color:' + zc(t.max) + '">' + Math.round(t.max) + '</b></div><div><small>KM</small><b>' + T.km1(t.km) + '</b></div></div><div class="clm" data-cl="' + i + '"></div></button>';
    }).join('');
    fillDayClimb();
  }
  function exitSel() { S.sel = null; $('mergeBar').style.display = 'none'; $('tripList').style.paddingBottom = '0'; }
  function selLo() { return S.sel && S.sel.length ? Math.min.apply(null, S.sel) : -99; }
  function selHi() { return S.sel && S.sel.length ? Math.max.apply(null, S.sel) : -99; }
  function selRange() { return { lo: selLo(), hi: selHi(), n: S.sel.length, ok: S.sel.length >= 2 }; }
  function updateMergeBar() {
    var r = selRange();
    if (r.ok) {
      $('mergeInfo').textContent = 'Gabungkan ' + r.n + ' trip · ' + T.hm(S.hTrips[r.lo].t.start) + ' – ' + T.hm(S.hTrips[r.hi].t.end);
      $('mergeGo').disabled = false;
    } else {
      $('mergeInfo').textContent = 'Ketuk trip di sebelahnya untuk digabung.';
      $('mergeGo').disabled = true;
    }
  }
  function toggleSel(i) {
    var lo = selLo(), hi = selHi();
    if (i === lo - 1 || i === hi + 1) S.sel.push(i);
    else if (i === lo || i === hi) { S.sel.splice(S.sel.indexOf(i), 1); if (!S.sel.length) { exitSel(); } }
    else return;
    renderHistory();
  }
  function hiddenBetween(lo, hi) {
    var a = S.hTrips[lo].t.end, b = S.hTrips[hi].t.start;
    return (S.ov.hidden || []).some(function (h) { return h.day === S.hDay && h.start > a && h.end < b; });
  }
  function doMerge() {
    var r = selRange();
    if (!r.ok) return;
    if (hiddenBetween(r.lo, r.hi)) { toast('Ada trip dihapus di antara trip ini. Pulihkan dulu di Pengaturan.'); return; }
    var ed = dayEdits(), id = S.hTrips[r.lo].t.id;
    for (var k = r.lo; k < r.hi; k++) ed.ops.push({ j: id });
    saveOv();
    exitSel();
    afterEdit(-1);
    toast(r.n + ' trip digabung');
  }
  function shiftDay(n) {
    exitSel();
    var p = S.hDay.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    var nd = T.ymd(d.getTime());
    if (nd > T.ymd(Date.now())) return;
    S.hDay = nd; loadHistory();
  }

  function hmsOf(ts) { var d = new Date(ts); return T.pad(d.getHours()) + ':' + T.pad(d.getMinutes()) + ':' + T.pad(d.getSeconds()); }
  function tsOf(day, hms) {
    var p = day.split('-'), q = hms.split(':');
    return new Date(+p[0], +p[1] - 1, +p[2], +q[0], +q[1], +(q[2] || 0)).getTime();
  }

  function openTrip(i) {
    var x = S.hTrips[i], t = x.t;
    var uOpts = S.settings.units.map(function (u) { return '<button class="opt' + (u === x.unit ? ' on' : '') + '" data-u="' + esc(u) + '">' + esc(u) + '</button>'; }).join('');
    var hist = x.hist.length ? x.hist.map(function (h) {
      return '<div class="kv"><span>' + T.hm(h.at) + ' · ' + esc(h.f) + '</span><span>' + esc(h.from || '–') + ' → ' + esc(h.to || '–') + '</span></div>';
    }).join('') : '<div class="muted">Belum ada perubahan.</div>';
    var hasNext = i < S.hTrips.length - 1;
    var ed = S.ov.days[S.hDay];
    var hasEdit = ed && (ed.ops || []).some(function (op) { return op.j === t.id || (op.c !== undefined && op.c >= t.start - 5000 && op.c <= t.end + 5000); });
    var mid = hmsOf(t.start + (t.end - t.start) / 2);
    var bts = x.check ? boundaryTs(t) : 0;
    var parts = '';
    if (t.parts && t.parts.length > 1) {
      parts = '<div class="h">BAGIAN TRIP</div>';
      t.parts.forEach(function (p, k) {
        if (k > 0) { var q = t.parts[k - 1]; parts += '<button class="btn gapbtn" data-gap="' + k + '">Jeda ' + T.durText((p.start - q.end) / 1000) + ' · Pisahkan di sini</button>'; }
        parts += '<div class="part"><span>' + T.hm(p.start) + ' – ' + T.hm(p.end) + '</span><span>' + T.km1(p.km) + ' km</span></div>';
      });
    }
    openSheet('<div class="grab"></div><div class="st">TRIP ' + T.hm(t.start) + ' – ' + T.hm(t.end) + '</div>' +
      (bts ? '<div class="warn" style="margin:6px 0">Trip ini melewati batas jam kerja pada ' + T.hm(bts) + '.<br><button class="btn sm" id="cutBound" style="margin-top:8px">Pisahkan di ' + T.hm(bts) + '</button></div>' : '') +
      '<div class="h">UNIT · ' + x.label.toUpperCase() + '</div><div class="opts" id="uOpts">' + uOpts + '</div>' +
      parts + '<div class="h">POTONG TRIP</div><div class="row"><input type="time" step="1" id="cutAt" value="' + mid + '"><button class="btn pri" id="cutGo" style="flex-shrink:0">Potong</button></div>' +
      '<div class="muted" style="margin-top:6px">Memecah trip ini menjadi dua di jam yang dipilih.</div>' +
      (hasNext ? '<button class="btn" id="joinGo" style="width:100%;margin-top:10px">Gabung dengan trip berikutnya</button>' : '') +
      (hasEdit ? '<button class="btn" id="undoGo" style="width:100%;margin-top:10px">Batalkan potongan / gabungan</button>' : '') +
      '<button class="btn" id="mapGo" style="width:100%;margin-top:10px">Lihat di peta</button>' +
      '<button class="btn danger" id="delGo" style="width:100%;margin-top:10px">Hapus trip</button>' +
      '<button class="btn" id="printGo" style="width:100%;margin-top:10px">Cetak trip ini (PDF)</button>' +
      '<div class="h">RINCIAN</div>' +
      '<div class="kv"><span>Jarak</span><span>' + T.km1(t.km) + ' km</span></div>' +
      '<div class="kv"><span>Kecepatan min / maks / rata-rata</span><span>' + Math.round(t.min) + ' / ' + Math.round(t.max) + ' / ' + Math.round(t.avg) + ' km/j</span></div>' +
      '<div class="kv"><span>Titik tercepat</span><span>' + T.hm(t.maxT) + '</span></div>' +
      '<div class="kv"><span>Hijau / kuning / merah</span><span>' + T.durText(t.zg) + ' / ' + T.durText(t.zy) + ' / ' + T.durText(t.zr) + '</span></div>' +
      '<div class="kv"><span>Titik GPS</span><span>' + t.n + (t.manual ? ' · manual' : '') + '</span></div>' +
      '<div class="h">RIWAYAT PERUBAHAN</div>' + hist +
      '<button class="btn" id="shClose" style="width:100%;margin-top:14px">Tutup</button>');
    $('shClose').onclick = closeSheet;
    $('uOpts').onclick = function (e) { var u = e.target.getAttribute && e.target.getAttribute('data-u'); if (u) change(i, 'unit', u); };
    $('cutGo').onclick = function () { doCut(i, $('cutAt').value); };
    if ($('cutBound')) $('cutBound').onclick = function () { doCutAt(i, bts, true); };
    document.querySelectorAll('#sheet [data-gap]').forEach(function (b) { b.onclick = function () { var k = +b.getAttribute('data-gap'); doCutAt(i, Math.round((t.parts[k - 1].end + t.parts[k].start) / 2000) * 1000, false); }; });
    $('printGo').onclick = function () { openPrint({ tripId: t.id }); };
    $('mapGo').onclick = function () { closeSheet(); showMap(S.hDay, i); };
    $('delGo').onclick = function () {
      askConfirm('Hapus trip ' + T.hm(t.start) + ' – ' + T.hm(t.end) + '?', 'Trip disembunyikan 30 hari dan bisa dipulihkan di Pengaturan, bagian Trip dihapus. Setelah itu titik GPS-nya dihapus permanen.', 'Hapus', function () {
        S.ov.hidden.push({ day: S.hDay, start: t.start, end: t.end, at: Date.now(), unit: x.unit, km: t.km });
        saveOv();
        afterEdit(-1);
        toast('Trip dihapus (bisa dipulihkan 30 hari)');
      });
    };
    if ($('joinGo')) $('joinGo').onclick = function () { doJoin(i); };
    if ($('undoGo')) $('undoGo').onclick = function () { askConfirm('Batalkan potongan / gabungan?', 'Trip ini kembali seperti hasil deteksi awal (potongan dan gabungan yang terkait dibatalkan).', 'Batalkan', function () { doUndo(i); }); };
  }
  function change(i, field, val) {
    var x = S.hTrips[i], id = x.t.id;
    var o = S.ov.trips[id] || (S.ov.trips[id] = { hist: [] });
    var from = x.unit, to = val;
    if (from === to) return;
    o[field] = val;
    o.hist = (o.hist || []).concat([{ at: Date.now(), f: 'Unit', from: from, to: to }]);
    saveOv();
    afterEdit(i);
  }
  function afterEdit(i) {
    Plug.readDay({ date: S.hDay }).then(function (r) {
      var res = detectDay(S.hDay, r.text);
      S.hTrips = edited(S.hDay, res).map(tripView); S.hPts = res.points;
      renderHistory();
      if (i >= 0 && i < S.hTrips.length) openTrip(Math.min(i, S.hTrips.length - 1)); else closeSheet();
    });
  }
  function doCut(i, hms) {
    if (!hms) { toast('Pilih jam potong'); return; }
    doCutAt(i, tsOf(S.hDay, hms), false);
  }
  function boundaryTs(t) {
    var k0 = T.classify(S.settings.schedule, t.start), m0 = Math.ceil((t.start + 5000) / 60000) * 60000;
    for (var m = m0; m < t.end - 5000; m += 60000) { if (T.classify(S.settings.schedule, m) !== k0) return m; }
    return 0;
  }
  function doCutAt(i, ts, noInherit) {
    var x = S.hTrips[i], t = x.t, hms = hmsOf(ts);
    if (!(ts > t.start + 5000 && ts < t.end - 5000)) { toast('Jam potong harus di dalam trip (' + T.hm(t.start) + ' – ' + T.hm(t.end) + ')'); return; }
    var ed = dayEdits();
    ed.ops.push({ c: ts });
    // potongan kedua mewarisi unit dan label trip asal
    var src = S.ov.trips[t.id];
    Plug.readDay({ date: S.hDay }).then(function (r) {
      var res = detectDay(S.hDay, r.text);
      var trips = visible(S.hDay, T.applyEdits(res, ed));
      var second = null;
      for (var k = 0; k < trips.length; k++) { if (trips[k].start > ts && trips[k - 1] && trips[k - 1].id === t.id) { second = trips[k]; break; } }
      if (!noInherit && src && second && !S.ov.trips[second.id]) {
        var c = { hist: [] };
        if (src.unit) c.unit = src.unit;
        S.ov.trips[second.id] = c;
      }
      saveOv();
      S.hTrips = trips.map(tripView); S.hPts = res.points;
      renderHistory();
      closeSheet();
      toast('Trip dipotong di ' + hms.slice(0, 5));
    });
  }
  function doJoin(i) {
    var ed = dayEdits();
    ed.ops.push({ j: S.hTrips[i].t.id });
    saveOv();
    afterEdit(i);
    toast('Trip digabung');
  }
  function doUndo(i) {
    var t = S.hTrips[i].t, ed = dayEdits();
    ed.ops = (ed.ops || []).filter(function (op) { return !(op.j === t.id || (op.c !== undefined && op.c >= t.start - 5000 && op.c <= t.end + 5000)); });
    saveOv();
    afterEdit(-1);
    toast('Potongan / gabungan dibatalkan');
  }

  // ---------- trip dihapus ----------
  function renderHidden() {
    var box = $('hidList');
    if (!box) return;
    var hs = (S.ov.hidden || []).slice().sort(function (a, b) { return b.at - a.at; });
    if (!hs.length) { box.textContent = 'Tidak ada.'; return; }
    box.innerHTML = hs.map(function (h) {
      var left = Math.max(0, Math.ceil((h.at + KEEP_MS - Date.now()) / 86400000));
      return '<div class="hrow"><span>' + esc(T.dateLong(h.day)) + '<br>' + T.hm(h.start) + ' – ' + T.hm(h.end) + ' · ' + T.km1(h.km || 0) + ' km · ' + esc(h.unit || '') + (h.auto ? '<br><i>Otomatis: kurang dari ' + (S.settings.junkM || 500) + ' m, jeda ' + h.gapMin + ' menit dari trip sebelumnya</i>' : '') + '<br>Dihapus permanen dalam ' + left + ' hari</span>' +
        '<button class="btn sm" data-restore="' + h.at + '">Pulihkan</button><button class="btn sm danger" data-purge="' + h.at + '">Hapus</button></div>';
    }).join('');
  }
  function purgeOne(h) {
    return Plug.deletePoints({ date: h.day, from: String(h.start), to: String(h.end) }).then(function () {
      S.ov.hidden = S.ov.hidden.filter(function (x) { return x !== h; });
    }).catch(function () {});
  }
  function purgeExpired() {
    var now = Date.now(), old = (S.ov.hidden || []).filter(function (h) { return h.at + KEEP_MS <= now && h.day < T.ymd(now); });
    if (!old.length) return Promise.resolve();
    return old.reduce(function (p, h) { return p.then(function () { return purgeOne(h); }); }, Promise.resolve()).then(function () { saveOv(); renderHidden(); });
  }
  function onHidden(e) {
    var r = e.target.getAttribute && e.target.getAttribute('data-restore'), g = e.target.getAttribute && e.target.getAttribute('data-purge');
    if (r) {
      var hh = S.ov.hidden.filter(function (h) { return String(h.at) === r; })[0];
      if (hh && hh.id) { if (!S.ov.keep) S.ov.keep = []; S.ov.keep.push(hh.id); }
      S.ov.hidden = S.ov.hidden.filter(function (h) { return String(h.at) !== r; });
      saveOv(); renderHidden(); toast('Trip dipulihkan');
    } else if (g) {
      var h = S.ov.hidden.filter(function (x) { return String(x.at) === g; })[0];
      if (!h) return;
      askConfirm('Hapus permanen?', 'Titik GPS trip ' + T.hm(h.start) + ' – ' + T.hm(h.end) + ' pada ' + T.dateLong(h.day) + ' dihapus dari ponsel dan tidak bisa dipulihkan.', 'Hapus permanen', function () {
        purgeOne(h).then(function () { saveOv(); renderHidden(); toast('Dihapus permanen'); });
      });
    }
  }

  // ---------- pengaturan ----------
  var ORDER = [1, 2, 3, 4, 5, 6, 0];
  var openDay = -1;
  function daySummary(x) {
    if (!x['in'] || !x.out) return 'Libur';
    var t = x['in'].replace(':', '.') + ' – ' + x.out.replace(':', '.');
    if (x.brk && x.brkFrom && x.brkTo) t += ' · istirahat ' + x.brkFrom.replace(':', '.') + '–' + x.brkTo.replace(':', '.');
    return t;
  }
  function renderSched() {
    var box = $('schedBox'), sc = S.settings.schedule, m = S.settings.margin;
    box.innerHTML = ORDER.map(function (d) {
      var x = sc.days[d], open = d === openDay;
      var libur = !x['in'] || !x.out;
      var hint = libur ? 'libur · semua trip Pribadi' : 'otomatis aktif ' + minToHm(T.minOf(x['in']) - m) + ' – ' + minToHm(T.minOf(x.out) + m);
      var body = open ? '<div class="sd-body"><div class="muted" style="margin-bottom:8px">' + hint + '</div>' +
        '<div class="r2"><label>MASUK<input type="time" data-f="in" value="' + esc(x['in'] || '') + '"></label><label>PULANG<input type="time" data-f="out" value="' + esc(x.out || '') + '"></label></div>' +
        '<label class="chk"><input type="checkbox" data-f="brk"' + (x.brk ? ' checked' : '') + '> Ada istirahat (rekam otomatis jeda)</label>' +
        (x.brk ? '<div class="r2"><label>DARI<input type="time" data-f="brkFrom" value="' + esc(x.brkFrom || '11:00') + '"></label><label>SAMPAI<input type="time" data-f="brkTo" value="' + esc(x.brkTo || '13:30') + '"></label></div>' : '') +
        (libur ? '' : '<button class="btn sm" data-clear="' + d + '" style="margin-top:8px">Jadikan libur</button>') + '</div>' : '';
      return '<div class="card sday' + (open ? ' open' : '') + '" data-d="' + d + '"><button class="sd-h" data-tog="' + d + '"><b>' + HARI[d] + '</b><span class="sd-s' + (libur ? ' off' : '') + '">' + daySummary(x) + '</span>' +
        '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' + body + '</div>';
    }).join('');
  }
  function minToHm(m) { m = (m + 1440) % 1440; return T.pad(Math.floor(m / 60)) + '.' + T.pad(m % 60); }
  function renderSettings() {
    $('unitBox').innerHTML = S.settings.units.map(function (u, i) {
      var k = typeOf(u);
      return '<div class="unit"><span>' + esc(u) + ' <span class="chip ' + (k === 'Kerja' ? 'k' : 'p') + '">' + k + '</span></span>' +
        '<button class="btn sm" data-type="' + i + '">Jadi ' + (k === 'Kerja' ? 'Pribadi' : 'Kerja') + '</button>' +
        (S.settings.units.length > 1 ? '<button class="btn sm" data-del="' + i + '">Hapus</button>' : '') + '</div>';
    }).join('');
    renderUnitCard();
    $('splitSel').value = String(S.settings.splitSec);
    $('radiusSel').value = String(S.settings.radius || 150);
    if (document.activeElement !== $('driverIn')) $('driverIn').value = S.settings.driver || '';
    $('autoChk').checked = !!S.settings.auto;
    if ($('popSel') && document.activeElement !== $('popSel')) $('popSel').value = S.popSnd || 'alarm';
    if ($('popName')) $('popName').textContent = S.popName ? 'Nada pilihan: ' + S.popName : 'Nada bawaan sistem (menurut pilihan di atas)';
    $('marginSel').value = String(S.settings.margin);
    var bits = [];
    bits.push(S.perm ? 'Izin lokasi: sudah.' : 'Izin lokasi: belum.');
    if (native) {
      bits.push(S.bg ? 'Lokasi "Selalu": sudah.' : 'Lokasi "Selalu": belum (perlu untuk rekam otomatis).');
      bits.push(S.battFree ? 'Penghematan baterai: dimatikan (bagus).' : 'Penghematan baterai: belum dimatikan.');
      bits.push(S.overlay ? 'Tampil di atas aplikasi lain (popup): sudah.' : 'Tampil di atas aplikasi lain: belum (popup tidak bisa muncul; pakai notifikasi biasa).');
      bits.push(S.actPerm ? 'Aktivitas fisik (deteksi naik kendaraan): sudah.' : 'Aktivitas fisik: belum (perlu untuk deteksi naik kendaraan).');
    }
    if (native) {
      bits.push(S.gpsOn ? 'GPS: menyala.' : 'GPS: istirahat (normal saat siaga).');
      bits.push(S.sigSensor ? 'Sensor gerak: ada.' : 'Sensor gerak: tidak ada; pemicu hanya dari pemeriksaan berkala.');
      bits.push(S.lastT ? 'Titik terakhir: ' + Math.max(0, Math.round((Date.now() - S.lastT) / 1000)) + ' detik lalu.' : 'Titik terakhir: belum ada.');
      bits.push(S.auto ? 'Rekam otomatis: aktif.' : 'Rekam otomatis: mati.');
    } else bits.push('Mode uji di browser.');
    $('setStat').innerHTML = bits.join('<br>');
    if (!S.setPage && $('setMenu').firstChild) renderSetMenu();
    if (!$('schedBox').firstChild || $('schedBox').getAttribute('data-m') !== String(S.settings.margin)) { renderSched(); $('schedBox').setAttribute('data-m', String(S.settings.margin)); }
  }
  function addUnit() {
    var v = $('unitNew').value.trim();
    if (!v) return;
    if (S.settings.units.indexOf(v) >= 0) { toast('Unit sudah ada'); return; }
    S.settings.units.push(v); S.settings.unitType[v] = $('unitNewType').value === 'Pribadi' ? 'Pribadi' : 'Kerja'; $('unitNew').value = ''; saveSettings(); renderSettings();
  }
  function onSched(e) {
    var card = e.target.closest ? e.target.closest('.sday') : null;
    if (!card) return;
    var d = +card.getAttribute('data-d'), f = e.target.getAttribute('data-f');
    if (!f) return;
    var x = S.settings.schedule.days[d];
    x[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    saveSettings(); pushSchedule();
    if (f === 'brk' || f === 'in' || f === 'out') { var sc = $('main').scrollTop; renderSched(); $('main').scrollTop = sc; }
  }

  // ---------- simpan dan bagikan ----------
  var sharing = false;
  function textB64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function saveFile(name, b64, mime) {
    window.__lastExport = { name: name, b64: b64, mime: mime };
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (native && P && P.Filesystem) {
      if (sharing) { toast('Masih ada proses bagikan berkas, tunggu sebentar'); return Promise.resolve(); }
      sharing = true;
      return P.Filesystem.writeFile({ path: 'HZTrip/' + name, data: b64, directory: 'CACHE', recursive: true }).then(function (w) {
        return P.Share ? P.Share.share({ title: name, url: w.uri, dialogTitle: 'Simpan atau bagikan' }) : null;
      }).catch(function (e) {
        var m = e && e.message || String(e);
        if (!/cancel/i.test(m)) toast('Gagal menyimpan: ' + m);
      }).then(function () { sharing = false; });
    }
    try {
      var bin = atob(b64), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([arr], { type: mime }));
      var a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (e) { toast('Gagal menyimpan: ' + e.message); }
    return Promise.resolve();
  }

  // ---------- data untuk ekspor ----------
  function loadDay(ymd) {
    return Plug.readDay({ date: ymd }).then(function (r) {
      var res = detectDay(ymd, r.text);
      return { ymd: ymd, pts: res.points, trips: edited(ymd, res).map(tripView) };
    });
  }
  function dayList(from, to) {
    var a = from.split('-'), b = to.split('-'), out = [], n = 0;
    var d = new Date(+a[0], +a[1] - 1, +a[2]), end = new Date(+b[0], +b[1] - 1, +b[2]);
    while (d <= end && n < 93) { out.push(T.ymd(d.getTime())); d.setDate(d.getDate() + 1); n++; }
    return out;
  }
  function collect(P) {
    var list = (P.scope === 'range' || P.scope === 'bulan') ? dayList(P.from, P.to) : [P.day];
    return Promise.all(list.map(loadDay)).then(function (ds) {
      return ds.map(function (d) {
        d.trips = d.trips.filter(function (x) {
          if (P.scope === 'trip') return x.t.id === P.tripId;
          return P.units.indexOf(x.unit) >= 0 && P.labels.indexOf(x.label) >= 0;
        });
        return d;
      }).filter(function (d) { return d.trips.length; });
    });
  }
  function fileBase(P) {
    if (P.scope === 'bulan') return 'HZTrip-Rekap-' + P.from.slice(0, 7);
    if (P.scope === 'range') return 'HZTrip-' + P.from + '_sd_' + P.to;
    if (P.scope === 'trip') return 'HZTrip-' + P.day + '-trip-' + T.hm(P.tripId).replace('.', '');
    return 'HZTrip-' + P.day;
  }

  // ---------- lembar cetak ----------
  var P = null;
  function openPrint(o) {
    o = o || {};
    P = { scope: o.tripId ? 'trip' : 'hari', tripId: o.tripId || 0, day: o.day || S.hDay, from: o.day || S.hDay, to: o.day || S.hDay,
      units: S.settings.units.slice(), labels: ['Kerja', 'Pribadi'], summary: true, color: true, month: T.ymd(Date.now()).slice(0, 7) };
    var tripTxt = '';
    if (o.tripId) { var x = S.hTrips.filter(function (y) { return y.t.id === o.tripId; })[0]; if (x) tripTxt = ' <span class="muted">· ' + T.hm(x.t.start) + ' – ' + T.hm(x.t.end) + '</span>'; }
    var today = T.ymd(Date.now());
    openSheet('<div class="grab"></div><div class="st">CETAK LAPORAN</div><div class="plist">' +
      '<div class="h">CAKUPAN</div>' +
      (o.tripId ? '<label><input type="radio" name="pscope" value="trip" checked> Satu trip' + tripTxt + '</label>' : '') +
      '<label><input type="radio" name="pscope" value="hari"' + (o.tripId ? '' : ' checked') + '> Satu hari</label>' +
      '<label><input type="radio" name="pscope" value="range"> Rentang tanggal (rincian per trip)</label>' +
      '<label><input type="radio" name="pscope" value="bulan"> Rekap bulanan (total per hari)</label>' +
      '<div style="margin:2px 0 4px"><div class="muted">Bulan (untuk rekap bulanan)</div><input type="month" id="pMonth" value="' + today.slice(0, 7) + '" max="' + today.slice(0, 7) + '"></div>' +
      '<div class="pgrid" style="margin-top:4px"><div><div class="muted">Dari / tanggal</div><input type="date" id="pFrom" value="' + P.day + '" max="' + today + '"></div>' +
      '<div><div class="muted">Sampai</div><input type="date" id="pTo" value="' + P.day + '" max="' + today + '"></div></div>' +
      '<div id="pFilters"><div class="h">UNIT</div><div class="pgrid" id="pUnits">' + S.settings.units.map(function (u, i) { return '<label><input type="checkbox" data-u="' + i + '" checked> ' + esc(u) + '</label>'; }).join('') + '</div>' +
      '<div class="h">LABEL</div><div class="pgrid"><label><input type="checkbox" data-l="Kerja" checked> Kerja</label><label><input type="checkbox" data-l="Pribadi" checked> Pribadi</label></div></div>' +
      '<div class="h">ISI TAMBAHAN</div>' +
      '<label><input type="checkbox" id="pSum" checked> Ringkasan di bawah tabel</label>' +
      '<label><input type="checkbox" id="pCol" checked> Warnai kecepatan maks (kuning dan merah)</label>' +
      '<label><input type="checkbox" id="pKc"' + (S.settings.kmlContour !== false ? ' checked' : '') + '> KML: sertakan kontur (area kecil, butuh data ketinggian)</label></div>' +
      '<div class="muted" id="pInfo" style="margin-top:10px">Menghitung…</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn pri" id="pPdf" style="flex:1.3;height:52px">PDF</button><button class="btn" id="pKml" style="flex:1;height:52px">KML</button></div>' +
      '<button class="btn" id="pClose" style="width:100%;margin-top:8px">Tutup</button>');
    $('pClose').onclick = closeSheet;
    $('pKc').onchange = function () { S.settings.kmlContour = this.checked; saveSettings(); };
    $('sheet').onchange = onPrintChange;
    $('pPdf').onclick = function () { runExport('pdf'); };
    $('pKml').onclick = function () { runExport('kml'); };
    syncPrint();
  }
  function onPrintChange(e) {
    var t = e.target;
    if (!P || !t) return;
    if (t.name === 'pscope') P.scope = t.value;
    else if (t.id === 'pFrom') { P.from = t.value; P.day = t.value; if (P.to < P.from) { P.to = P.from; $('pTo').value = P.to; } }
    else if (t.id === 'pTo') P.to = t.value;
    else if (t.id === 'pMonth') { if (t.value) P.month = t.value; }
    else if (t.getAttribute('data-u') !== null) { P.units = [].slice.call(document.querySelectorAll('#pUnits input')).filter(function (c) { return c.checked; }).map(function (c) { return S.settings.units[+c.getAttribute('data-u')]; }); }
    else if (t.getAttribute('data-l') !== null) { P.labels = [].slice.call(document.querySelectorAll('input[data-l]')).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-l'); }); }
    else if (t.id === 'pSum') P.summary = t.checked;
    else if (t.id === 'pCol') P.color = t.checked;
    syncPrint();
  }
  function setMonthRange() {
    var m = (P.month || T.ymd(Date.now()).slice(0, 7)).split('-'), y = +m[0], mo = +m[1];
    var last = new Date(y, mo, 0).getDate(), today = T.ymd(Date.now());
    P.from = m[0] + '-' + m[1] + '-01';
    var to = m[0] + '-' + m[1] + '-' + T.pad(last);
    P.to = to > today ? today : to;
  }
  function syncPrint() {
    if (!$('pFrom')) return;
    if (P.scope === 'bulan') setMonthRange();
    $('pTo').disabled = P.scope !== 'range';
    $('pFrom').disabled = P.scope === 'trip' || P.scope === 'bulan';
    $('pMonth').disabled = P.scope !== 'bulan';
    $('pSum').disabled = P.scope === 'bulan';
    $('pFilters').style.opacity = P.scope === 'trip' ? '.4' : '1';
    $('pInfo').textContent = 'Menghitung…';
    collect(P).then(function (ds) {
      var n = 0, km = 0;
      ds.forEach(function (d) { d.trips.forEach(function (x) { n++; km += x.t.km; }); });
      if ($('pInfo')) $('pInfo').innerHTML = n ? 'Akan mencetak <b style="color:var(--tx)">' + (P.scope === 'bulan' ? ds.length + ' hari · ' + T.km1(km) + ' km' : n + ' trip · ' + T.km1(km) + ' km') + '</b>' + (P.scope !== 'bulan' && ds.length > 1 ? ' dalam ' + ds.length + ' hari' : '') : 'Tidak ada trip pada pilihan ini.';
    });
  }
  function runExport(kind) {
    collect(P).then(function (ds) {
      if (!ds.length) { toast('Tidak ada trip pada pilihan ini'); return; }
      if (P.scope === 'bulan') ds.month = P.month;
      var base = fileBase(P);
      if (kind === 'kml') {
        return kmlPrep(ds, !!($('pKc') && $('pKc').checked)).then(function (o) {
          return saveFile(base + '.kml', textB64(E.buildKml(ds, o)), 'application/vnd.google-earth.kml+xml');
        });
      }
      if (!window.jspdf) { toast('Library PDF belum siap'); return; }
      var items = [];
      ds.forEach(function (dd) { dd.trips.forEach(function (x) { items.push({ t: x.t, pts: dd.pts, x: x }); }); });
      if (items.length > 0) toast('Menghitung ketinggian…');
      return climbSeq(items, function (it, c) { it.x.climb = c; }).then(function () {
        var doc = E.buildPdf(ds, { driver: S.settings.driver, scope: P.scope, summary: P.summary, color: P.color, month: P.month });
        return saveFile(base + '.pdf', doc.output('datauristring').split(',')[1], 'application/pdf');
      });
    }).catch(function (e) { showErr(e && e.message || e); });
  }

  // ---------- cache peta (IndexedDB) ----------
  var TC = (function () {
    var dbp = null, CAP = 300 * 1024 * 1024, puts = 0;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        try {
          var rq = indexedDB.open('hztiles', 1);
          rq.onupgradeneeded = function () { rq.result.createObjectStore('tiles', { keyPath: 'k' }); };
          rq.onsuccess = function () { res(rq.result); };
          rq.onerror = function () { rej(rq.error); };
        } catch (e) { rej(e); }
      });
      dbp.catch(function () {});
      return dbp;
    }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction('tiles', mode), st = t.objectStore('tiles'), out = fn(st);
          t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
          t.onerror = function () { rej(t.error); };
        });
      });
    }
    function get(k) { return tx('readonly', function (st) { return st.get(k); }).then(function (r) { return r ? r.blob : null; }).catch(function () { return null; }); }
    function stats() {
      return open().then(function (db) {
        return new Promise(function (res) {
          var n = 0, bytes = 0, rq = db.transaction('tiles', 'readonly').objectStore('tiles').openCursor();
          rq.onsuccess = function () { var c = rq.result; if (c) { n++; bytes += c.value.size || 0; c.continue(); } else res({ n: n, bytes: bytes }); };
          rq.onerror = function () { res({ n: n, bytes: bytes }); };
        });
      }).catch(function () { return { n: 0, bytes: 0 }; });
    }
    function prune() {
      return open().then(function (db) {
        return new Promise(function (res) {
          var all = [], total = 0, rq = db.transaction('tiles', 'readonly').objectStore('tiles').openCursor();
          rq.onsuccess = function () {
            var c = rq.result;
            if (c) { all.push({ k: c.value.k, t: c.value.t, s: c.value.size || 0 }); total += c.value.size || 0; c.continue(); return; }
            if (total <= CAP) { res(); return; }
            all.sort(function (x, y) { return x.t - y.t; });
            var st = db.transaction('tiles', 'readwrite').objectStore('tiles');
            for (var i = 0; i < all.length && total > CAP * 0.85; i++) { st.delete(all[i].k); total -= all[i].s; }
            res();
          };
          rq.onerror = function () { res(); };
        });
      }).catch(function () {});
    }
    function put(k, blob) {
      tx('readwrite', function (st) { return st.put({ k: k, blob: blob, size: blob.size, t: Date.now() }); }).catch(function () {});
      if (++puts % 60 === 0) prune();
    }
    function clear() { return tx('readwrite', function (st) { return st.clear(); }).catch(function () {}); }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    return { get: get, put: put, stats: stats, clear: clear };
  })();

  if (window.HzDem) HzDem.setStore(TC);
  var CachedLayer = null;
  function cachedLayerClass() {
    if (CachedLayer) return CachedLayer;
    CachedLayer = L.TileLayer.extend({
      createTile: function (coords, done) {
        var img = document.createElement('img'), url = this.getTileUrl(coords);
        img.alt = ''; img.setAttribute('role', 'presentation');
        function show(src, revoke) {
          img.onload = function () { if (revoke) URL.revokeObjectURL(src); done(null, img); };
          img.onerror = function () { if (revoke) URL.revokeObjectURL(src); done(null, img); };
          img.src = src;
        }
        TC.get(url).then(function (blob) {
          if (blob) { show(URL.createObjectURL(blob), true); return; }
          if (typeof fetch !== 'function') { show(url, false); return; }
          fetch(url, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('x'); return r.blob(); }).then(function (b) {
            TC.put(url, b); show(URL.createObjectURL(b), true);
          }).catch(function () { show(url, false); });
        });
        return img;
      }
    });
    return CachedLayer;
  }
  function fmtMB(b) { return (b / 1048576).toFixed(1).replace('.', ','); }
  function renderDemInfo() {
    if (!$('demInfo') || !window.HzDem) return;
    HzDem.localInfo().then(function (r) {
      if (!r.sheets.length) { $('demInfo').textContent = 'Belum ada data. Kontur memakai data gratis (±30 m, perlu internet).'; $('demDel').style.display = 'none'; return; }
      var b = r.bbox;
      $('demInfo').innerHTML = '<b>' + r.sheets.length + ' lembar</b> · ' + r.tiles + ' kotak · ' + fmtMB(r.bytes) + ' MB<br>' + r.sheets.map(function (q) { return esc(q.name); }).join('<br>') + '<br>Area: ' + b[1].toFixed(3) + '…' + b[3].toFixed(3) + '°, ' + b[0].toFixed(3) + '…' + b[2].toFixed(3) + '°';
      $('demDel').style.display = '';
    });
  }
  function demAfter() {
    if (window.HzDem) HzDem.resetMem();
    CL.clear();
    if (DM.layer) DM.layer.redraw();
    if (DM.slope) DM.slope.redraw();
    if (DM.hach) DM.hach.redraw();
    if (DM.mesh) DM.mesh.redraw();
    renderDemInfo();
  }
  function demImport(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var bar = $('demProg'), i = 0, okN = 0, errs = [];
    bar.style.display = '';
    function nx() {
      if (i >= list.length) {
        bar.style.display = 'none'; $('demAdd').disabled = false; demAfter();
        toast(okN ? ('Data ketinggian dimuat: ' + okN + ' berkas' + (errs.length ? ', ' + errs.length + ' gagal' : '')) : 'Tidak ada yang berhasil');
        if (errs.length) $('demErr').textContent = errs.join('\n'); else $('demErr').textContent = '';
        return;
      }
      var f = list[i++];
      return HzDem.importTiff(f, function (p, t) { bar.textContent = '(' + i + '/' + list.length + ') ' + t + ' · ' + p + '%'; }).then(function () { okN++; }).catch(function (e) { errs.push(f.name + ': ' + (e && e.message || e)); }).then(nx);
    }
    $('demAdd').disabled = true; $('demErr').textContent = '';
    nx();
  }
  function renderSatNat() {
    var box = $('satNat'); if (!box) return;
    var cur = S.settings.satNative || 17;
    box.innerHTML = [16, 17, 18, 19].map(function (v) { return '<button class="opt' + (cur === v ? ' on' : '') + '" data-sn="' + v + '">' + v + '</button>'; }).join('');
  }
  function renderCacheInfo() {
    renderDemInfo(); renderSatNat();
    if (!$('tcInfo')) return;
    TC.stats().then(function (s) { $('tcInfo').textContent = 'Cache peta: ' + (s.bytes / 1048576).toFixed(1).replace('.', ',') + ' MB · ' + s.n + ' kotak peta'; });
  }


  // ---------- ukuran teks ----------
  var FS = { s: 0.7, m: 0.85, l: 1 };
  function applyFont() {
    var k = S.settings.fs || 'l';
    document.documentElement.style.setProperty('--fs', String(FS[k] || 1));
    document.querySelectorAll('#fontSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === k); });
  }
  // ---------- tema ----------
  var themeMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function applyTheme() {
    var t = S.settings.theme || 'dark', r = t === 'auto' ? (themeMQ && themeMQ.matches ? 'light' : 'dark') : t;
    document.documentElement.setAttribute('data-theme', r);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', r === 'light' ? '#F2F5F6' : '#0D1215');
    document.querySelectorAll('#themeSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
  }
  if (themeMQ && themeMQ.addEventListener) themeMQ.addEventListener('change', function () { if ((S.settings.theme || 'dark') === 'auto') applyTheme(); });

  // ---------- menu Pengaturan per judul ----------
  var CHEV = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
  function bkAge() { var b = S.settings.lastBackup; return b ? Math.floor((Date.now() - b) / 86400000) : -1; }
  function dtText(ts) { var d = new Date(ts); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + T.pad(d.getHours()) + '.' + T.pad(d.getMinutes()); }
  var SPAGES = [
    { k: 'jadwal', t: 'Jadwal dan rekam otomatis', s: function () { var n = 0; S.settings.schedule.days.forEach(function (x) { if (x['in'] && x.out) n++; }); return (S.settings.auto ? 'Otomatis aktif' : 'Otomatis mati') + ' · ' + n + ' hari terjadwal'; } },
    { k: 'unit', t: 'Unit dan pengemudi', s: function () { return 'Dipakai: ' + unitAt(Date.now()) + ' · ' + S.settings.units.length + ' unit'; } },
    { k: 'peta', t: 'Peta', s: function () { var n = ovList().length; return n + ' peta saya · cache peta'; } },
    { k: 'data', t: 'Data dan cadangan', s: function () { var n = (S.ov.hidden || []).length; return (S.settings.lastBackup ? 'Cadangan ' + bkAge() + ' hari lalu' : 'Belum ada cadangan') + (n ? ' · ' + n + ' trip dihapus' : ''); } },
    { k: 'latar', t: 'Perekaman latar belakang', s: function () { return native ? ((S.bg && S.battFree) ? 'Siap' : 'Perlu diatur') : 'Mode uji'; } },
    { k: 'tampil', t: 'Tampilan', s: function () { return { dark: 'Tema gelap', light: 'Tema terang', auto: 'Ikuti sistem' }[S.settings.theme || 'dark']; } },
    { k: 'tentang', t: 'Tentang', s: function () { return 'by Yohanes div2 · Versi 0.9.2'; } }
  ];
  function renderSetMenu() {
    $('setMenu').innerHTML = SPAGES.map(function (p) { return '<button class="srow" data-sp="' + p.k + '"><div class="si"><b>' + p.t + '</b><small>' + esc(p.s()) + '</small></div>' + CHEV + '</button>'; }).join('');
  }
  function showSet(key) {
    S.setPage = key || null;
    $('setMenu').style.display = key ? 'none' : 'block';
    document.querySelectorAll('.spage').forEach(function (e) { e.classList.toggle('on', e.id === 'sp-' + key); });
    if (!key) renderSetMenu();
  }
  function openSet(key) {
    showSet(key);
    try { history.pushState({ sp: key }, ''); S.spPushed = true; } catch (e) { S.spPushed = false; }
    $('main').scrollTop = 0;
    if (key === 'peta') { renderOv(); renderCacheInfo(); }
    if (key === 'data') { renderHidden(); renderBackupInfo(); renderThinInfo(); }
    if (key === 'latar') { syncStatus(); renderDiag(); }
    if (key === 'tampil') { applyTheme(); applyFont(); }
    renderSettings();
  }
  function backSet() {
    if (S.spPushed) { try { history.back(); return; } catch (e) {} }
    showSet(null);
  }
  window.addEventListener('popstate', function () { if (S.setPage) { S.spPushed = false; showSet(null); } });

  // ---------- cadangan data ----------
  function toGz(text) {
    if (window.CompressionStream) return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    return Promise.resolve(new Blob([text]));
  }
  function blobB64(b) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(b); });
  }
  function renderBackupInfo() {
    if (!$('bkInfo')) return;
    Plug.listDays().then(function (r) {
      var n = (r.days || []).length;
      $('bkInfo').innerHTML = (S.settings.lastBackup ? 'Terakhir dibuat: <b>' + dtText(S.settings.lastBackup) + '</b> (' + bkAge() + ' hari lalu)' : 'Belum pernah membuat cadangan.') + '<br>Data di ponsel: ' + n + ' hari rekaman.' + (S.settings.lastAuto ? '<br>Cadangan otomatis terakhir: <b>' + dtText(S.settings.lastAuto) + '</b> (berkas ' + (S.settings.autoSlot || 'A') + ', ' + (S.settings.autoDir === 'EXTERNAL' ? 'folder data aplikasi' : 'Dokumen/HZTrip/cadangan') + ')' : '');
      if ($('autoBkChk')) $('autoBkChk').checked = S.settings.autoBk !== false;
    }).catch(function () {});
  }
  var bkBusy = false;
  function buildBackup() {
    return Plug.listDays().then(function (r) {
      var days = r.days || [], out = {}, i = 0;
      function next() { if (i >= days.length) return Promise.resolve(); var d = days[i++]; return Plug.readDay({ date: d }).then(function (x) { if (x.text) out[d] = x.text; return next(); }); }
      return next().then(function () { return out; });
    }).then(function (daysObj) {
      var st = JSON.parse(JSON.stringify(S.settings)); delete st.ovl; delete st.bkSnooze;
      return toGz(JSON.stringify({ app: 'hztrip', v: 1, at: Date.now(), settings: st, overrides: S.ov, days: daysObj }));
    }).then(blobB64);
  }
  var autoBusy = false;
  // hapus berkas cadangan otomatis model lama (HZTrip-auto-TANGGAL) setelah cadangan baru tersimpan
  function pruneAuto(dir) {
    var P = window.Capacitor.Plugins;
    P.Filesystem.readdir({ path: 'HZTrip/cadangan', directory: dir }).then(function (r) {
      (r.files || []).map(function (f) { return f.name || f; }).filter(function (n) { return /^HZTrip-auto-.*\.hztrip$/.test(n); }).forEach(function (n) { P.Filesystem.deleteFile({ path: 'HZTrip/cadangan/' + n, directory: dir }).catch(function () {}); });
    }).catch(function () {});
  }
  // Cadangan otomatis harian ke Dokumen/HZTrip/cadangan: 2 berkas (A dan B) diperbarui bergantian, dibuat saat app dibuka pertama kali tiap hari
  function autoBackup() {
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (!native || !P || !P.Filesystem || S.settings.autoBk === false || autoBusy || bkBusy) return Promise.resolve();
    if (S.settings.lastAuto && T.ymd(S.settings.lastAuto) === T.ymd(Date.now())) return Promise.resolve();
    autoBusy = true;
    var slot = S.settings.autoSlot === 'A' ? 'B' : 'A';
    return buildBackup().then(function (b64) {
      var path = 'HZTrip/cadangan/HZTrip-cadangan-' + slot + '.hztrip';
      function put(dir) { return P.Filesystem.writeFile({ path: path, data: b64, directory: dir, recursive: true }).then(function () { return dir; }); }
      return put('DOCUMENTS').catch(function () { return put('EXTERNAL'); });
    }).then(function (dir) {
      S.settings.lastAuto = Date.now(); S.settings.autoDir = dir; S.settings.autoSlot = slot; saveSettings();
      pruneAuto(dir); renderBackupInfo(); toast('Cadangan otomatis tersimpan');
    }).catch(function () { diagLocal('gagal'); }).then(function () { autoBusy = false; });
  }
  function diagLocal() {}
  function makeBackup() {
    if (bkBusy) return Promise.resolve();
    bkBusy = true; toast('Menyiapkan cadangan…');
    return Plug.listDays().then(function (r) {
      var days = r.days || [], out = {}, i = 0;
      function next() { if (i >= days.length) return Promise.resolve(); var d = days[i++]; return Plug.readDay({ date: d }).then(function (x) { if (x.text) out[d] = x.text; return next(); }); }
      return next().then(function () { return out; });
    }).then(function (daysObj) {
      var st = JSON.parse(JSON.stringify(S.settings)); delete st.ovl; delete st.bkSnooze;
      return toGz(JSON.stringify({ app: 'hztrip', v: 1, at: Date.now(), settings: st, overrides: S.ov, days: daysObj }));
    }).then(blobB64).then(function (b64) {
      return saveFile('HZTrip-cadangan-' + T.ymd(Date.now()) + '.hztrip', b64, 'application/octet-stream');
    }).then(function () {
      S.settings.lastBackup = Date.now(); saveSettings(); renderBackupInfo(); renderSetMenu(); renderBkNote(true);
    }).catch(function (e) { toast('Cadangan gagal: ' + (e && e.message || e)); }).then(function () { bkBusy = false; });
  }
  function readBackup(file) {
    return file.arrayBuffer().then(function (buf) {
      var u = new Uint8Array(buf);
      if (u[0] === 0x1f && u[1] === 0x8b) {
        if (!window.DecompressionStream) throw new Error('Perangkat ini tidak bisa membuka berkas cadangan');
        return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      }
      return new TextDecoder().decode(u);
    }).then(function (t) {
      var d; try { d = JSON.parse(t); } catch (e) { throw new Error('Bukan berkas cadangan HZ Trip'); }
      if (!d || d.app !== 'hztrip' || !d.days || !d.settings) throw new Error('Bukan berkas cadangan HZ Trip');
      return d;
    });
  }
  function restoreBackup(d) {
    var keys = Object.keys(d.days).sort(), today = T.ymd(Date.now());
    openSheet('<div class="grab"></div><div class="st">PULIHKAN CADANGAN</div>' +
      '<div class="muted" style="margin:6px 0">Dibuat ' + dtText(d.at || 0) + ' · ' + keys.length + ' hari rekaman · ' + (d.settings.units || []).length + ' unit.</div>' +
      '<div class="muted" style="margin-bottom:12px"><b>Tambah hari yang belum ada</b>: hanya menambah rekaman hari yang belum ada di ponsel ini; pengaturan tidak berubah.<br><b>Pulihkan semua</b>: rekaman, trip yang diedit, jadwal, unit, dan pengaturan diganti dengan isi cadangan.</div>' +
      '<div class="row" style="gap:8px"><button class="btn" id="rsAdd" style="flex:1;height:50px">Tambah hari</button><button class="btn pri" id="rsAll" style="flex:1;height:50px">Pulihkan semua</button></div>' +
      '<button class="btn" id="rsNo" style="width:100%;margin-top:8px">Batal</button>');
    $('rsNo').onclick = closeSheet;
    function run(over) {
      closeSheet(); toast('Memulihkan…');
      var i = 0, added = 0;
      function next() {
        if (i >= keys.length) return Promise.resolve();
        var k = keys[i++];
        return Plug.writeDay({ date: k, text: d.days[k], overwrite: (over && k !== today) ? '1' : '0' }).then(function (r) { if (r && r.written) added++; return next(); });
      }
      next().then(function () {
        if (over) {
          var keep = S.settings.ovl, fs = S.settings.firstSeen;
          S.settings = Object.assign({}, S.settings, d.settings); S.settings.ovl = keep; S.settings.firstSeen = fs; S.settings.lastBackup = d.at || S.settings.lastBackup;
          S.ov = d.overrides && d.overrides.trips ? d.overrides : S.ov;
          return saveSettings().then(saveOv);
        }
      }).then(function () {
        toast(over ? 'Selesai, memuat ulang…' : added + ' hari ditambahkan');
        if (over) setTimeout(function () { location.reload(); }, 900); else { renderBackupInfo(); }
      }).catch(function (e) { toast('Pemulihan gagal: ' + (e && e.message || e)); });
    }
    $('rsAdd').onclick = function () { run(false); };
    $('rsAll').onclick = function () { askConfirm('Pulihkan semua?', 'Rekaman hari yang sama, jadwal, unit, dan pengaturan di ponsel ini diganti dengan isi cadangan.', 'Pulihkan', function () { run(true); }); };
  }
  // ---------- catatan pemicu ----------
  function renderDiag() {
    if (!$('diagBox')) return;
    Plug.readDiag().then(function (r) {
      var t = (r && r.text) || '';
      $('diagBox').textContent = t ? t.split('\n').slice(-60).join('\n') : 'Belum ada catatan.';
      S.diagText = t;
    }).catch(function () { $('diagBox').textContent = 'Catatan tidak tersedia.'; });
  }

  // ---------- merampingkan data lama ----------
  function thinCutoff() { return T.ymd(Date.now() - (S.settings.thinDays || 90) * 86400000); }
  function thinList() {
    var cut = thinCutoff();
    return Plug.listDays().then(function (r) { return (r.days || []).filter(function (d) { return d < cut && !(S.ov.arch && S.ov.arch[d]); }).sort(); });
  }
  function renderThinInfo() {
    if (!$('thinInfo')) return;
    $('thinSel').value = String(S.settings.thinDays || 90);
    thinList().then(function (l) {
      var n = Object.keys(S.ov.arch || {}).length;
      $('thinInfo').innerHTML = l.length ? '<b>' + l.length + ' hari</b> lebih lama dari ' + (S.settings.thinDays || 90) + ' hari belum dirampingkan.' + (n ? '<br>Sudah dirampingkan: ' + n + ' hari.' : '') : 'Tidak ada data lama yang perlu dirampingkan.' + (n ? ' Sudah dirampingkan: ' + n + ' hari.' : '');
      $('thinGo').disabled = !l.length;
    }).catch(function () {});
  }
  var thinBusy = false;
  function runThin() {
    if (thinBusy) return;
    thinBusy = true;
    thinList().then(function (days) {
      var i = 0, done = 0, skip = 0, b0 = 0, b1 = 0;
      if (!S.ov.arch) S.ov.arch = {};
      function next() {
        if (i >= days.length) return Promise.resolve();
        var d = days[i++];
        if (i % 5 === 0) toast('Merampingkan… ' + i + '/' + days.length);
        return Plug.readDay({ date: d }).then(function (r) {
          if (!r.text) { skip++; return; }
          var x = T.thinDay(r.text, opts());
          if (!x.ok) { skip++; return; }
          if (x.after >= x.before * 0.9) { S.ov.arch[d] = {}; skip++; return; }
          S.ov.arch[d] = x.trips;
          return Plug.writeDay({ date: d, text: x.text, overwrite: '1' }).then(function (w) {
            if (w && w.written) { done++; b0 += x.bytesBefore; b1 += x.bytesAfter; } else delete S.ov.arch[d];
          });
        }).then(function () { if (i % 20 === 0) return saveOv(); }).then(next);
      }
      return next().then(saveOv).then(function () {
        toast(done + ' hari dirampingkan, hemat ' + Math.round((b0 - b1) / 1024) + ' KB' + (skip ? ' · ' + skip + ' dilewati' : ''));
      });
    }).catch(function (e) { toast('Gagal merampingkan: ' + (e && e.message || e)); }).then(function () { thinBusy = false; renderThinInfo(); renderBackupInfo(); });
  }
  function startThin() {
    if (bkAge() >= 0 && bkAge() < 1) { runThin(); return; }
    openSheet('<div class="grab"></div><div class="st">BUAT CADANGAN DULU?</div>' +
      '<div class="muted" style="margin:6px 0 12px">Merampingkan membuang titik GPS yang rapat dari data lama dan tidak bisa dibatalkan. Trip, jarak, dan kecepatan maksimum tetap sama. Cadangan menyimpan data utuh bila ingin dikembalikan.</div>' +
      '<div class="row" style="gap:8px"><button class="btn pri" id="thB" style="flex:1;height:50px">Cadangkan dulu</button><button class="btn" id="thS" style="flex:1;height:50px">Lanjut saja</button></div>' +
      '<button class="btn" id="thN" style="width:100%;margin-top:8px">Batal</button>');
    $('thN').onclick = closeSheet;
    $('thS').onclick = function () { closeSheet(); runThin(); };
    $('thB').onclick = function () { closeSheet(); makeBackup().then(function () { if (bkAge() === 0) runThin(); else toast('Cadangan belum dibuat, perampingan dibatalkan'); }); };
  }
  var bkNoteKey = null;
  function renderBkNote(force) {
    var box = $('bkNote'); if (!box) return;
    var base = S.settings.lastBackup || S.settings.firstSeen || Date.now(), age = Math.floor((Date.now() - base) / 86400000);
    var show = age >= 30 && Date.now() > (S.settings.bkSnooze || 0);
    var key = show ? 'y' + age : 'n';
    if (!force && key === bkNoteKey) return;
    bkNoteKey = key;
    box.innerHTML = show ? '<div class="bknote">' + (S.settings.lastBackup ? 'Sudah ' + age + ' hari sejak cadangan terakhir dibagikan.' : 'Cadangan belum pernah dibagikan keluar ponsel.') + ' Bagikan salinan ke WhatsApp atau Drive supaya aman bila ponsel hilang.<div class="row"><button class="btn sm pri" id="bkNow">Cadangkan</button><button class="btn sm" id="bkLater">Nanti</button></div></div>' : '';
    if (show) {
      $('bkNow').onclick = function () { makeBackup(); };
      $('bkLater').onclick = function () { S.settings.bkSnooze = Date.now() + 3 * 86400000; saveSettings(); renderBkNote(true); };
    }
  }

  // ---------- lintasan (peta) ----------
  var map = null, tileLayer = null, trackLayer = null, fitted = false, mapSel = -1, mapKeep = false, mapKind = 'all';
  var TILES = {
    sat: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Esri World Imagery'],
    osm: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; OpenStreetMap']
  };
  function ensureMap() {
    if (map) return true;
    if (!window.L) return false;
    map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([-4.95, 105.2], 14);
    trackLayer = L.layerGroup().addTo(map);
    bindPins(map, function () { return [trackLayer]; });
    setTiles();
    makeLocate(map);
    demButtons(map);
    return true;
  }
  // foto satelit hanya ada sampai zoom tertentu: di atasnya gambar diperbesar (maxNativeZoom), peta tetap bisa di-zoom sampai 22
  function tileOpts(md) { return { maxZoom: 22, maxNativeZoom: md === 'sat' ? (S.settings.satNative || 17) : 19, attribution: TILES[md][1] }; }
  function zoomInd(m) {
    var C = L.Control.extend({ options: { position: 'topleft' }, onAdd: function () {
      var e = L.DomUtil.create('div', 'zind leaflet-control');
      function u() { e.textContent = 'zoom ' + m.getZoom(); }
      m.on('zoomend', u); u(); return e;
    } });
    new C().addTo(m);
  }
  function setBase(m, force) {
    if (!m) return;
    if (m._base) { m.removeLayer(m._base); m._base = null; }
    var md = force || (S.settings.mapMode === 'sat' ? 'sat' : 'osm');
    if (TILES[md]) m._base = new (cachedLayerClass())(TILES[md][0], tileOpts(md)).addTo(m);
  }
  function setTiles() {
    if (!map) return;
    setBase(map);
    syncOverlays(map);
    if (DM.syncMode) DM.syncMode();
    batRedraw();
    document.querySelectorAll('#mapSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-map') === S.settings.mapMode); });
  }
  function gapText(g) { return 'Berhenti ' + T.hm(g.from) + '–' + T.hm(g.to) + ' (' + T.durText((g.to - g.from) / 1000) + ')'; }
  // Ketuk pin: label tampil dengan garis tipis ke pin. Beberapa pin yang berdekatan tampil bersamaan, berurutan menurut jam.
  function bindPins(m, groupFn) {
    var box = document.createElement('div');
    box.className = 'pinbox';
    box.innerHTML = '<svg class="pinsvg"></svg>';
    m.getContainer().appendChild(box);
    var svg = box.firstChild, cur = null;
    function clear() { cur = null; svg.innerHTML = ''; Array.prototype.slice.call(box.querySelectorAll('.pinl')).forEach(function (e) { e.remove(); }); }
    function place() {
      if (!cur) return;
      var sz = m.getSize(), lines = '';
      cur.forEach(function (c) {
        var p = m.latLngToContainerPoint(c.pin.ll), x = p.x + c.dx, y = p.y + c.dy;
        c.el.style.left = x + 'px'; c.el.style.top = y + 'px';
        var ax = c.dx >= 0 ? x : x + c.w, ay = y + c.h / 2;
        if (c.pin.dot) lines += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4"/>';
        lines += '<line x1="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) + '" x2="' + ax.toFixed(1) + '" y2="' + ay.toFixed(1) + '"/>';
      });
      svg.innerHTML = lines;
      svg.setAttribute('width', sz.x); svg.setAttribute('height', sz.y);
    }
    function show(list, at) {
      clear();
      var sz = m.getSize(), cx = 0, cy = 0;
      list.sort(function (p, q) { return p.t - q.t; });
      list.forEach(function (p) { var c = m.latLngToContainerPoint(p.ll); cx += c.x; cy += c.y; });
      cx /= list.length; cy /= list.length;
      var right = cx < sz.x / 2, n = list.length, GAP = 34;
      cur = list.map(function (p, i) {
        var el = document.createElement('div'); el.className = 'pinl';
        el.innerHTML = '<i style="background:' + p.col + '"></i>' + (p.html || esc(p.txt));
        el.onclick = function (e) { e.stopPropagation(); clear(); };
        box.appendChild(el);
        var w = el.offsetWidth, h = el.offsetHeight, pc = m.latLngToContainerPoint(p.ll);
        var ty = cy + (i - (n - 1) / 2) * GAP - h / 2, tx = right ? cx + 52 : cx - 52 - w;
        tx = Math.max(6, Math.min(sz.x - w - 6, tx)); ty = Math.max(6, Math.min(sz.y - h - 6, ty));
        return { el: el, pin: p, w: w, h: h, dx: tx - pc.x, dy: ty - pc.y };
      });
      place();
    }
    m._pinInfo = function (ll, html) { show([{ ll: ll, html: html, txt: '', col: '#4DA3FF', t: 0, dot: true }]); };
    m.on('click', function (e) {
      if (m._lakeDraw) { m._lakeDraw.tap(e.latlng); return; }
      if (m._slopeOn) { slopeTap(m, e); return; }
      var grp = groupFn(), pins = [];
      (grp || []).forEach(function (g) { (g._pins || []).forEach(function (p) { pins.push(p); }); });
      var near = pins.filter(function (p) { return m.latLngToContainerPoint(p.ll).distanceTo(e.containerPoint) <= 26; });
      if (!near.length) { clear(); return; }
      // buang pin kembar persis (jam dan teks sama)
      var seen = {}; near = near.filter(function (p) { var k = p.txt + '|' + p.ll.join(','); if (seen[k]) return false; seen[k] = 1; return true; });
      show(near);
    });
    m.on('move zoom', place);
    m.on('dragstart zoomstart', function () { /* label ikut peta */ });
    m._pinClear = clear;
  }
  // Gambar trek ke satu peta. faint = trip lain pada hari itu digambar samar sebagai pembanding.
  function drawTrips(group, pts, trips, sel, faint) {
    var bounds = [];
    group._pins = [];
    function dot(lat, lng, col, rad, tip, ts) {
      L.circleMarker([lat, lng], { radius: rad, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1, interactive: false }).addTo(group);
      group._pins.push({ ll: [lat, lng], txt: tip, col: col, t: ts || 0 });
    }
    trips.forEach(function (x, i) {
      var dimmed = sel >= 0 && sel !== i;
      if (dimmed && !faint) return;
      var t = x.t, tk = E.trackOf(pts, t);
      tk.runs.forEach(function (r) {
        var ll = r.pts.map(function (p) { return [p.lat, p.lng]; });
        if (dimmed) L.polyline(ll, { color: '#7C8C94', weight: 3, opacity: 0.55, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(group);
        else { L.polyline(ll, { color: COL[r.z], weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(group); bounds = bounds.concat(ll); }
      });
      if (dimmed) return;
      tk.gaps.forEach(function (g) {
        var la = [g.a.lat, g.a.lng], lb = [g.b.lat, g.b.lng];
        L.polyline([la, lb], { color: COL.s, weight: 4, opacity: 0.95, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(group);
        dot(la[0], la[1], COL.s, 6, gapText(g), g.from);
        dot(lb[0], lb[1], COL.s, 6, gapText(g), g.to);
      });
      dot(t.startLat, t.startLng, '#3FD07A', 7, 'Mulai ' + T.hm(t.start), t.start);
      dot(t.endLat, t.endLng, '#FF5B50', 7, 'Selesai ' + T.hm(t.end), t.end);
      dot(t.maxLat, t.maxLng, '#F5C518', 8, 'Tercepat ' + Math.round(t.max) + ' km/j (' + T.hm(t.maxT) + ')', t.maxT);
    });
    return bounds;
  }

  // ---------- peta mini di Riwayat (hanya lihat) ----------
  var mini = null;
  function openMini(i) {
    if (!window.L) { toast('Peta tidak tersedia'); return; }
    S.mini = { day: S.hDay, i: i, key: '' };
    $('miniWrap').style.display = 'block';
    if (!mini) {
      mini = L.map('miniMap', { zoomControl: false, preferCanvas: true, attributionControl: false }).setView([-4.95, 105.2], 14);
      setTimeout(function () { if (mini && mini._tr) bindPins(mini, function () { return [mini._tr]; }); }, 0);
      mini._tr = L.layerGroup().addTo(mini);
    }
    mini.invalidateSize();
    setBase(mini);
    syncOverlays(mini);
    renderHistory();
    setTimeout(function () {
      var m = $('main'), w = $('miniWrap');
      m.scrollTop += w.getBoundingClientRect().top - m.getBoundingClientRect().top - 4;
      if (mini) mini.invalidateSize();
    }, 40);
  }
  function refreshMini() {
    if (!S.mini) return;
    if (!mini || S.mini.day !== S.hDay || S.mini.i >= S.hTrips.length) { closeMini(true); return; }
    var x = S.hTrips[S.mini.i], t = x.t, key = t.start + '-' + t.end;
    mini._tr.clearLayers();
    var b = drawTrips(mini._tr, S.hPts || [], S.hTrips, S.mini.i, true);
    $('miniT').textContent = 'Trip ' + (S.mini.i + 1) + ' · ' + T.hm(t.start) + '–' + T.hm(t.end) + ' · ' + T.km1(t.km) + ' km';
    if (b.length && S.mini.key !== key) { S.mini.key = key; mini.invalidateSize(); mini.fitBounds(b, { padding: [28, 28], maxZoom: 18 }); }
  }
  function closeMini(noRender) {
    var was = !!S.mini;
    S.mini = null;
    $('miniWrap').style.display = 'none';
    if (mini) { try { mini.remove(); } catch (e) {} mini = null; }
    if (was && !noRender) renderHistory();
  }

  // ---------- tombol lokasi saya (tropong) ----------
  var LOC_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>';
  function locStop(m) {
    var st = m && m._loc; if (!st) return;
    if (st.id !== null) { try { navigator.geolocation.clearWatch(st.id); } catch (e) {} st.id = null; }
    if (st.dot) { m.removeLayer(st.dot); st.dot = null; }
    if (st.acc) { m.removeLayer(st.acc); st.acc = null; }
    st.follow = false; st.pos = null; if (st.btn) st.btn.classList.remove('on');
  }
  function locStart(m) {
    var st = m && m._loc; if (!st || st.id !== null) return;
    if (!navigator.geolocation) { toast('Lokasi tidak tersedia di perangkat ini'); return; }
    st.id = navigator.geolocation.watchPosition(function (p) {
      if (!m._container) return;
      var ll = [p.coords.latitude, p.coords.longitude], first = !st.pos;
      st.pos = ll;
      if (!st.acc) st.acc = L.circle(ll, { radius: p.coords.accuracy || 20, color: '#4DA3FF', weight: 1, fillColor: '#4DA3FF', fillOpacity: 0.15, interactive: false }).addTo(m);
      else { st.acc.setLatLng(ll); st.acc.setRadius(p.coords.accuracy || 20); }
      if (!st.dot) st.dot = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#4285F4', fillOpacity: 1, interactive: false, className: 'locdot' }).addTo(m);
      else st.dot.setLatLng(ll);
      if (st.want) { st.want = false; st.follow = true; if (st.btn) st.btn.classList.add('on'); m.setView(ll, Math.max(m.getZoom(), 17)); }
      else if (st.follow) m.panTo(ll, { animate: true });
    }, function (e) {
      if (st.want) { st.want = false; toast(e && e.code === 1 ? 'Izin lokasi belum diberikan' : 'Lokasi belum didapat. Pastikan GPS menyala.'); }
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
  }
  function makeLocate(m) {
    if (m._loc) return;
    var st = m._loc = { id: null, dot: null, acc: null, pos: null, follow: false, want: false, btn: null };
    var Ctl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        var b = L.DomUtil.create('button', 'locbtn leaflet-control');
        b.type = 'button'; b.setAttribute('aria-label', 'Posisi saya'); b.innerHTML = LOC_SVG;
        L.DomEvent.disableClickPropagation(b);
        b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        b.onclick = function () {
          if (st.id === null) locStart(m);
          if (st.pos) { st.follow = true; b.classList.add('on'); m.setView(st.pos, Math.max(m.getZoom(), 17)); }
          else { st.want = true; toast('Mencari posisi…'); }
        };
        st.btn = b;
        return b;
      }
    });
    new Ctl().addTo(m);
    m.on('dragstart', function () { st.follow = false; if (st.btn) st.btn.classList.remove('on'); });
    m.on('unload', function () { locStop(m); });
    locStart(m);
  }

  // ---------- kontur, lereng, profil ketinggian (data ketinggian) ----------
  var DM = { layer: null, btnK: null, btnL: null, btnP: null, pid: 0, mk: null, pr: null, miss: 0 };
  function contourStep(z) {
    var s = S.settings.contourStep || 'auto';
    if (s !== 'auto') return +s;
    var loc = false;
    try { var c = map && map.getCenter(); loc = !!(c && window.HzDem && HzDem.hasLocal(c.lat, c.lng)); } catch (e) {}
    if (loc) return z <= 15 ? 10 : (z === 16 ? 5 : 2);
    return z <= 16 ? 10 : 5;
  }
  function contourColor() {
    return S.settings.mapMode === 'osm' ? ['', '', 'rgba(255,255,255,.9)', 1] : ['', '', 'rgba(0,0,0,.75)', 0];
  }
  function meshWanted() { return false; }
  function legendSync() {
    var m = map; if (!m) return;
    if (DM.leg) { m.removeControl(DM.leg); DM.leg = null; }
    if (!window.HzDem || !(S.settings.slopeLayer || meshWanted())) return;
    var Ctl = L.Control.extend({ options: { position: 'topright' }, onAdd: function () {
      var e = L.DomUtil.create('div', 'slegend leaflet-control');
      e.innerHTML = '<span>0%</span><i class="gbar" style="background:' + HzDem.GRAD_CSS + '"></i><span>15%+</span><em>kemiringan</em>';
      return e; } });
    DM.leg = new Ctl(); DM.leg.addTo(m);
  }
  function syncMode() {
    var osm = S.settings.mapMode === 'osm';
    if (!window.HzDem || !map) return;
    if (meshWanted() && !DM.mesh) {
      DM.mesh = HzDem.meshLayer({ onMissing: function () { if (Date.now() - DM.miss > 20000) { DM.miss = Date.now(); toast('Data ketinggian belum lengkap (butuh internet)'); } } });
      DM.mesh.addTo(map);
    } else if (!meshWanted() && DM.mesh) { map.removeLayer(DM.mesh); DM.mesh = null; }
    if (!osm && V3.on) close3d();
    legendSync(); if (DM.sync) DM.sync();
  }
  function setSlopeLayer(on) {
    S.settings.slopeLayer = !!on; saveSettings();
    if (DM.sync) DM.sync();
    if (!map || !window.HzDem) return;
    if (on && !DM.slope) {
      DM.slope = HzDem.slopeLayer({ onMissing: function () { if (Date.now() - DM.miss > 20000) { DM.miss = Date.now(); toast('Data ketinggian belum lengkap (butuh internet)'); } } });
      DM.slope.addTo(map);
    } else if (!on && DM.slope) { map.removeLayer(DM.slope); DM.slope = null; }
    legendSync();
  }
  function setContour(on) {
    S.settings.contour = !!on; saveSettings();
    if (DM.sync) DM.sync();
    if (!map || !window.HzDem) return;
    if (on && !DM.layer) {
      DM.layer = HzDem.contours({ step: contourStep, color: contourColor, onMissing: function () { if (Date.now() - DM.miss > 20000) { DM.miss = Date.now(); toast('Data ketinggian belum lengkap (butuh internet)'); } } });
      DM.layer.addTo(map);
    } else if (!on && DM.layer) { map.removeLayer(DM.layer); DM.layer = null; }
  }
  var ICO_K = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M2 8c4-4 7 1 11-2s6 0 9 1"/><path d="M2 14c4-4 7 1 11-2s6 0 9 1"/><path d="M2 20c4-4 7 1 11-2s6 0 9 1"/></svg>';
  var ICO_L = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19l7-12 4 7 2-3 5 8z"/><path d="M12 3v3"/></svg>';
  var ICO_S = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18L3 6z"/><path d="M3 14l6 6M3 10l10 10"/></svg>';
  var ICO_P = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M6 16l4-5 3 3 5-7"/></svg>';
  var ICO_T = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>';
  function setHach(on) {
    S.settings.hach = !!on; saveSettings();
    if (!map || !window.HzDem) return;
    if (on && !DM.hach) {
      DM.hach = HzDem.hachLayer({ kind: function () { return S.settings.hachKind || 'down'; }, umum: function () { return S.settings.hachSmooth === 'umum'; }, osm: function () { return S.settings.mapMode === 'osm'; }, onMissing: function () { if (Date.now() - DM.miss > 20000) { DM.miss = Date.now(); toast('Data ketinggian belum lengkap (butuh internet)'); } } });
      DM.hach.addTo(map);
    } else if (!on && DM.hach) { map.removeLayer(DM.hach); DM.hach = null; }
    if (DM.sync) DM.sync();
  }
  function demButtons(m) {
    // satu tombol "Alat peta" yang membuka panel berlabel
    var closeP = function () {};
    var panel = document.createElement('div');
    panel.className = 'toolpanel'; panel.style.display = 'none';
    m.getContainer().appendChild(panel);
    L.DomEvent.disableClickPropagation(panel); L.DomEvent.disableScrollPropagation(panel);
    function row(id, label, sub) { return '<div class="trow"><button type="button" class="tsw" data-t="' + id + '" role="switch"><span class="tl">' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="tk"></span></button></div>'; }
    function ic(p) { return '<svg viewBox="0 0 24 24">' + p + '</svg>'; }
    var IC = {
      contour: ic('<path d="M3 8c3-3 6 2 9-1s6 2 9-1M3 13c3-3 6 2 9-1s6 2 9-1M3 18c3-3 6 2 9-1s6 2 9-1"/>'),
      slopeLayer: ic('<path d="M3 19L21 6v13z"/><path d="M8 19v-3M12 19v-6M16 19v-9"/>'),
      hach: ic('<path d="M4 6l4 3M4 12l4 3M10 5l4 3M10 11l4 3M16 4l4 3M16 10l4 3M4 18l4 3"/>'),
      v3d: ic('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>'),
      slopeTap: ic('<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><path d="M12 8v4M12 14.5v.5"/>'),
      prof: ic('<path d="M3 20h18M4 16l4-5 3 3 4-7 5 6"/>'),
      useNas: ic('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
      useFree: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
      lakesOn: ic('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
      shpOn: ic('<path d="M5 17l3-10 9 3 2 8z"/><circle cx="5" cy="17" r="1.5"/><circle cx="8" cy="7" r="1.5"/><circle cx="17" cy="10" r="1.5"/>'),
      batDesa: ic('<path d="M4 7l5-3 6 3 5-2v12l-5 2-6-3-5 3z"/><path d="M9 4v13M15 7v13"/>'),
      batKec: ic('<path d="M3 5h18v14H3z"/><path d="M3 12h18M12 5v14"/>'),
      draw: ic('<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>'),
      batCfg: ic('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'),
      dataGo: ic('<path d="M5 5h14M5 12h14M5 19h14"/>')
    };
    function tile(id, label, st, badge) { return '<button type="button" class="tile' + (st ? ' st' : '') + '" data-t="' + id + '">' + IC[id] + '<span>' + label + '</span>' + (badge ? '<i class="tbd" id="bd_' + id + '"></i>' : '') + '</button>'; }
    panel.innerHTML = '<div class="tt">LAPISAN</div><div class="tgrid">' + tile('contour', 'Kontur', 1) + tile('slopeLayer', 'Lereng', 1) + tile('hach', 'Arsiran', 1) + tile('v3d', '3D', 1) + tile('slopeTap', 'Info lereng', 1) + tile('prof', 'Profil', 1) + '</div>' +
      '<div class="tseg" id="tHk"><button type="button" data-k="down">Arah turun</button><button type="button" data-k="row">Searah kontur</button></div>' +
      '<div class="tseg" id="tHs"><button type="button" data-s="detail">Detail</button><button type="button" data-s="umum">Umum</button></div>' +
      '<div class="tt" style="margin-top:6px">SUMBER DATA</div><div class="tgrid">' + tile('useNas', 'DEMNAS', 1) + tile('useFree', 'DEM gratis', 1) + '</div><div class="tnote" id="tNasSub"></div>' +
      '<div class="tt">TAMPIL</div><div class="tgrid g4">' + tile('lakesOn', 'Danau', 1, 1) + tile('shpOn', 'Gambar', 1, 1) + tile('batDesa', 'Desa', 1) + tile('batKec', 'Kec.', 1) + '</div>' +
      '<div class="tt">ALAT</div><div class="tgrid">' + tile('draw', 'Gambar baru') + tile('batCfg', 'Atur batas') + tile('dataGo', 'Data peta') + '</div>';
    function state(id) {
      return id === 'contour' ? !!S.settings.contour : id === 'slopeLayer' ? !!S.settings.slopeLayer : id === 'hach' ? !!S.settings.hach : id === 'slopeTap' ? !!m._slopeOn :
        id === 'shpOn' ? S.settings.shapesOn !== false : id === 'batDesa' ? !!(S.settings.bat && S.settings.bat.desa) : id === 'batKec' ? !!(S.settings.bat && S.settings.bat.kec) : id === 'v3d' ? V3.on : id === 'useNas' ? S.settings.useNas !== false : id === 'useFree' ? S.settings.useFree !== false : id === 'lakesOn' ? S.settings.lakesOn !== false : !!S.profOpen;
    }
    function sync() {
      var any = false;
      var osmOnly = S.settings.mapMode !== 'osm';
      ['v3d'].forEach(function (t) { var e = panel.querySelector('[data-t=' + t + ']'); if (e) e.classList.toggle('dis', osmOnly); });
      panel.querySelectorAll('.tsw, .tile.st').forEach(function (b) { var on = state(b.getAttribute('data-t')); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); if (on) any = true; });
      var hs = S.settings.hachSmooth || 'detail';
      $('tHk').style.display = $('tHs').style.display = S.settings.hach ? '' : 'none';
      panel.querySelectorAll('#tHs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === hs); });
      if ($('tNasSub')) $('tNasSub').textContent = 'DEMNAS: ' + (window.HzDem && HzDem.hasAnyLocal() ? 'data impor, ±8 m' : 'belum diimpor (Pengaturan > Peta)') + ' · DEM gratis ±30 m';
      if ($('bd_shpOn')) $('bd_shpOn').textContent = shapesList().length || '';
      if ($('bd_lakesOn')) $('bd_lakesOn').textContent = lakesList().length || '';
      var k = S.settings.hachKind || 'down';
      panel.querySelectorAll('#tHk button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === k); });
      if (DM.main) DM.main.classList.toggle('hason', any);
    }
    DM.sync = sync; DM.syncMode = syncMode;
    panel.onclick = function (e) {
      var k = e.target.closest && e.target.closest('#tHk button');
      if (k) { S.settings.hachKind = k.getAttribute('data-k'); saveSettings(); if (!S.settings.hach) setHach(true); else if (DM.hach) DM.hach.redraw(); sync(); return; }
      var sm = e.target.closest && e.target.closest('#tHs button');
      if (sm) { S.settings.hachSmooth = sm.getAttribute('data-s'); saveSettings(); if (!S.settings.hach) setHach(true); else if (DM.hach) DM.hach.redraw(); sync(); return; }
      var b = e.target.closest && e.target.closest('.tsw, .tbtn, .tile'); if (!b) return;
      var id = b.getAttribute('data-t');
      if (id === 'draw') { closeP(); drawStart(); return; }
      if (id === 'dataGo') { closeP(); go('data'); return; }
      if (id === 'lakes') { closeP(); openLakes(); return; }
      if (id === 'shapes') { closeP(); openShapes(); return; }
      if (id === 'shpOn') { S.settings.shapesOn = S.settings.shapesOn === false; saveSettings(); applyShapes(); sync(); return; }
      if (id === 'batCfg') { closeP(); openBat(); return; }
      if (id === 'batDesa' || id === 'batKec') { var bb = batSet(); bb[id === 'batDesa' ? 'desa' : 'kec'] = !bb[id === 'batDesa' ? 'desa' : 'kec']; saveSettings(); batRedraw(); sync(); return; }
      if (id === 'contour') setContour(!S.settings.contour);
      else if (id === 'slopeLayer') setSlopeLayer(!S.settings.slopeLayer);
      else if (id === 'hach') setHach(!S.settings.hach);
      else if (id === 'v3d') {
        if (S.settings.mapMode !== 'osm') { toast('3D hanya tersedia di mode Peta (bukan Satelit)'); return; }
        if (V3.on) close3d(); else open3d();
      }
      else if (id === 'useNas') setSource('nas', S.settings.useNas === false);
      else if (id === 'useFree') setSource('free', S.settings.useFree === false);
      else if (id === 'lakesOn') { S.settings.lakesOn = S.settings.lakesOn === false; saveSettings(); applyLakes(); demRedraw(); }
      else if (id === 'slopeTap') {
        m._slopeOn = !m._slopeOn; if (m._pinClear) m._pinClear();
        toast(m._slopeOn ? 'Ketuk peta untuk info lereng' : 'Mode lereng mati');
      } else if (id === 'prof') { S.profOpen = !S.profOpen; renderProfile(); }
      sync();
    };
    var Ctl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        var b = L.DomUtil.create('button', 'locbtn leaflet-control');
        b.type = 'button'; b.setAttribute('aria-label', 'Alat peta'); b.innerHTML = ICO_T;
        L.DomEvent.disableClickPropagation(b);
        b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        b.onclick = function () { var open = panel.style.display === 'none'; panel.style.display = open ? 'block' : 'none'; b.classList.toggle('open', open); sync(); };
        DM.main = b; closeP = function () { panel.style.display = 'none'; b.classList.remove('open'); }; DM.closePanel = closeP; return b;
      }
    });
    new Ctl().addTo(m);
    // tombol lama dipertahankan sebagai penampung status (tidak tampil)
    DM.btnL = document.createElement('button'); DM.btnS = document.createElement('button'); DM.btnK = document.createElement('button'); DM.btnP = document.createElement('button');
    if (window.HzBatas && !DM.bat) DM.bat = HzBatas.attach(m, batCfg, toast);
    zoomInd(m);
    if (window.HzDem) HzDem.setSources(S.settings.useNas !== false, S.settings.useFree !== false);
    applyLakes(); drawShapes();
    if (S.settings.contour) setContour(true);
    if (S.settings.slopeLayer) setSlopeLayer(true);
    if (S.settings.hach) setHach(true);
    syncMode();
    sync();
  }
  var ARROW = '<span style="display:inline-block;transform:rotate(DEGdeg);font-weight:700">&#8593;</span>';
  function fmt1(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  // ---------- tampilan 3D (jaring permukaan, hanya mode Peta) ----------
  var V3 = { pdf: true, tex: null, moving: false, on: false, g: null, yaw: -30, pitch: 52, zoom: 1, exag: 3, color: 'h', ptr: {}, pd: 0, q: null, trk: [], busy: 0 };
  var ZCOL = { g: '#3FD07A', y: '#F5C518', r: '#FF5B50', s: '#9E9E9E' };
  function close3d() {
    var el = $('v3d'); if (el) el.remove();
    V3.on = false; V3.g = null; V3.busy++;
    if (map) map.getContainer().classList.remove('v3on');
    if (DM.sync) DM.sync();
  }
  function open3d(keep) {
    if (!map || !window.HzDem) return;
    if (S.settings.mapMode !== 'osm') { toast('Tampilan 3D hanya di mode Peta'); return; }
    var c = map.getContainer(), el = $('v3d'), bd = map.getBounds(), b = { s: bd.getSouth(), w: bd.getWest(), n: bd.getNorth(), e: bd.getEast() };
    if (keep && V3.g) b = V3.g.b;
    if (!el) {
      el = document.createElement('div'); el.id = 'v3d'; el.className = 'v3d';
      el.innerHTML = '<canvas id="v3c"></canvas><div class="v3bar"><div class="tseg" id="v3col"><button type="button" data-c="h">Ketinggian</button><button type="button" data-c="s">Kemiringan</button></div>' +
        '<label class="v3x">Tinggi &times;<b id="v3xv">' + V3.exag + '</b><input type="range" id="v3x" min="1" max="20" step="0.5" value="' + V3.exag + '"></label>' +
        '<div class="v3b2"><button type="button" id="v3p">Peta PDF</button><button type="button" id="v3r">Atur ulang</button><button type="button" id="v3q">Tutup</button></div></div><div class="v3leg" id="v3leg"></div><div class="v3msg" id="v3msg">Menghitung…</div>';
      c.appendChild(el); L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el);
      c.classList.add('v3on'); V3.on = true;
      $('v3q').onclick = close3d;
      $('v3p').onclick = function () { V3.pdf = !V3.pdf; this.classList.toggle('on', V3.pdf && !!V3.tex); draw3d(true); };
      $('v3r').onclick = function () { V3.yaw = -30; V3.pitch = 52; V3.zoom = 1; draw3d(true); };
      $('v3x').oninput = function () { V3.exag = +this.value; $('v3xv').textContent = V3.exag; prep3d(); V3.moving = true; draw3d(); clearTimeout(V3.wt); V3.wt = setTimeout(function () { V3.moving = false; draw3d(true); }, 250); };
      $('v3col').onclick = function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-c'); if (!k) return; V3.color = k; document.querySelectorAll('#v3col button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-c') === k); }); prep3d(); draw3d(); };
      var cv = $('v3c');
      cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); V3.ptr[e.pointerId] = [e.clientX, e.clientY]; V3.pd = 0; V3.moving = true; });
      cv.addEventListener('pointermove', function (e) {
        var p = V3.ptr[e.pointerId]; if (!p) return;
        var ids = Object.keys(V3.ptr);
        if (ids.length >= 2) {
          var o = V3.ptr[ids[0] === String(e.pointerId) ? ids[1] : ids[0]], d0 = Math.hypot(p[0] - o[0], p[1] - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]);
          if (d0 > 10) V3.zoom = Math.max(0.5, Math.min(5, V3.zoom * d1 / d0));
        } else { V3.yaw += (e.clientX - p[0]) * 0.4; V3.pitch = Math.max(12, Math.min(88, V3.pitch - (e.clientY - p[1]) * 0.3)); }
        V3.ptr[e.pointerId] = [e.clientX, e.clientY]; draw3d();
      });
      function up(e) { delete V3.ptr[e.pointerId]; if (!Object.keys(V3.ptr).length) { V3.moving = false; setTimeout(function () { draw3d(true); }, 0); } }
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', function (e) { e.preventDefault(); V3.zoom = Math.max(0.5, Math.min(5, V3.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); V3.moving = true; draw3d(); clearTimeout(V3.wt); V3.wt = setTimeout(function () { V3.moving = false; draw3d(true); }, 220); }, { passive: false });
    }
    document.querySelectorAll('#v3col button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-c') === V3.color); });
    $('v3msg').style.display = 'block'; $('v3msg').textContent = 'Menghitung…';
    var id = ++V3.busy;
    HzDem.sampleGrid(b, 70).then(function (g) {
      if (id !== V3.busy || !V3.on) return;
      if (!isFinite(g.mn)) { $('v3msg').textContent = 'Data ketinggian belum tersedia di area ini (butuh internet)'; return; }
      V3.g = g; $('v3msg').style.display = 'none';
      prep3d(); draw3d();
    });
    if (DM.sync) DM.sync();
  }
  // warna dan bayangan tiap kotak + titik jalur (dihitung ulang saat mode atau tinggi berubah)
  function prep3d() {
    var g = V3.g; if (!g) return;
    var cols = g.cols, rows = g.rows, nq = (cols - 1) * (rows - 1), col = new Uint8ClampedArray(nq * 3), ok = new Uint8Array(nq), i, j, ex = V3.exag, lx = -0.5, ly = 0.45, lz = 0.74;
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
      var q = j * (cols - 1) + i, e00 = g.z[j * cols + i], e10 = g.z[j * cols + i + 1], e01 = g.z[(j + 1) * cols + i], e11 = g.z[(j + 1) * cols + i + 1];
      if (!(e00 === e00 && e10 === e10 && e01 === e01 && e11 === e11)) continue;
      var gx = ((e10 + e11) - (e00 + e01)) / (2 * g.dx), gy = ((e00 + e10) - (e01 + e11)) / (2 * g.dy), pct = 100 * Math.hypot(gx, gy);
      var t = V3.color === 'h' ? (g.mx > g.mn ? ((e00 + e10 + e01 + e11) / 4 - g.mn) / (g.mx - g.mn) : 0.5) : pct / 15, rgb = HzDem.gradRGB(t);
      var nx = -gx * ex, ny = -gy * ex, nl = Math.sqrt(nx * nx + ny * ny + 1), sh = 0.68 + 0.42 * Math.max(0, (nx * lx + ny * ly + lz) / nl);
      col[q * 3] = rgb[0] * sh; col[q * 3 + 1] = rgb[1] * sh; col[q * 3 + 2] = rgb[2] * sh; ok[q] = 1;
    }
    V3.q = { col: col, ok: ok };
    // peta PDF: ambil gambar lapisan yang sedang tampil di peta, lalu petakan tiap titik jaring ke piksel gambar itu
    V3.tex = null;
    var ovs = (map._ovl || []).filter(function (l) { return l && l._canvas && l._min; });
    if (ovs.length) {
      var l0 = ovs[0], snap = document.createElement('canvas'); snap.width = l0._canvas.width; snap.height = l0._canvas.height;
      var sx = snap.getContext('2d');
      ovs.forEach(function (l) { sx.globalAlpha = parseFloat(l._canvas.style.opacity || 1); sx.drawImage(l._canvas, 0, 0); });
      var TX = new Float32Array(cols * rows), TY = new Float32Array(cols * rows);
      for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
        var lp = map.latLngToLayerPoint([g.b.n - j * (g.b.n - g.b.s) / (rows - 1), g.b.w + i * (g.b.e - g.b.w) / (cols - 1)]);
        TX[j * cols + i] = lp.x - l0._min.x; TY[j * cols + i] = lp.y - l0._min.y;
      }
      V3.tex = { cv: snap, TX: TX, TY: TY };
    }
    var pb = $('v3p'); if (pb) { pb.style.display = V3.tex ? '' : 'none'; pb.classList.toggle('on', V3.pdf && !!V3.tex); }
    // jalur trip (warna menurut kecepatan)
    V3.trk = [];
    var v = S.mapView, zmid = (g.mn + g.mx) / 2, md = Math.max(g.W, g.H), lift = md * 0.004 / Math.max(1, ex) * 1;
    if (v && v.trips) {
      v.trips.forEach(function (x, ti) {
        if (v.sel >= 0 && ti !== v.sel) return;
        E.trackOf(v.pts, x.t).runs.forEach(function (r) {
          var pts = [];
          r.pts.forEach(function (p) {
            if (p.lat < g.b.s || p.lat > g.b.n || p.lng < g.b.w || p.lng > g.b.e) return;
            var e = HzDem.elev(p.lat, p.lng, g.zd); if (e !== e) return;
            pts.push([(p.lng - (g.b.w + g.b.e) / 2) * g.kx, (p.lat - (g.b.s + g.b.n) / 2) * g.ky, e]);
          });
          if (pts.length > 1) V3.trk.push({ c: ZCOL[r.z] || '#fff', pts: pts, lift: lift });
        });
      });
    }
    V3.shp = [];
    shapeItems().forEach(function (s) {
      var P = s.pts, N = s.closed ? P.length : P.length - 1, runs = [], cur = [], k, t, full = true;
      function add(lat, lng) {
        var e = (lat < g.b.s || lat > g.b.n || lng < g.b.w || lng > g.b.e) ? NaN : HzDem.elev(lat, lng, g.zd);
        if (e !== e) { full = false; if (cur.length > 1) runs.push(cur); cur = []; return; }
        cur.push([(lng - (g.b.w + g.b.e) / 2) * g.kx, (lat - (g.b.s + g.b.n) / 2) * g.ky, e]);
      }
      for (k = 0; k < N; k++) {
        var p0 = P[k], p1 = P[(k + 1) % P.length], st = Math.max(1, Math.ceil(Math.hypot((p1[1] - p0[1]) * g.kx, (p1[0] - p0[0]) * g.ky) / Math.max(1, g.dx * 0.7)));
        for (t = 0; t < st; t++) add(p0[0] + (p1[0] - p0[0]) * t / st, p0[1] + (p1[1] - p0[1]) * t / st);
      }
      if (!s.closed) add(P[P.length - 1][0], P[P.length - 1][1]);
      if (cur.length > 1) runs.push(cur);
      if (!runs.length) return;
      var cl = 0, cg = 0; P.forEach(function (q) { cl += q[0]; cg += q[1]; }); cl /= P.length; cg /= P.length;
      var le = (cl < g.b.s || cl > g.b.n || cg < g.b.w || cg > g.b.e) ? NaN : HzDem.elev(cl, cg, g.zd);
      V3.shp.push({ c: s.color, runs: runs, closed: s.closed && full, label: s.label, lp: le === le ? [(cg - (g.b.w + g.b.e) / 2) * g.kx, (cl - (g.b.s + g.b.n) / 2) * g.ky, le] : null, lift: lift });
    });
    var leg = $('v3leg');
    if (leg) leg.innerHTML = V3.color === 'h' ? '<span>' + Math.round(g.mn) + ' mdpl</span><i class="gbar" style="background:' + HzDem.GRAD_CSS + '"></i><span>' + Math.round(g.mx) + ' mdpl</span>' : '<span>0%</span><i class="gbar" style="background:' + HzDem.GRAD_CSS + '"></i><span>15%+</span>';
  }
  function draw3d(withTex) {
    var g = V3.g, cv = $('v3c'); if (!g || !cv || !V3.q) return;
    var useTex = !!(withTex && V3.pdf && V3.tex && !V3.moving);
    var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0F1519'; ctx.fillRect(0, 0, w, h);
    var yaw = V3.yaw * Math.PI / 180, pt = V3.pitch * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pt), sp = Math.sin(pt);
    var zmid = (g.mn + g.mx) / 2, ex = V3.exag, sc = Math.min(w, h) * 0.95 * V3.zoom / Math.hypot(g.W, g.H), cols = g.cols, rows = g.rows, n = cols * rows;
    var SX = new Float32Array(n), SY = new Float32Array(n), DP = new Float32Array(n), i, j;
    function proj(x, y, z, o, k) { var x1 = x * cy - y * sy, y1 = x * sy + y * cy; o[0] = w / 2 + x1 * sc; o[1] = h * 0.52 - (y1 * sp + z * cp) * sc; o[2] = y1 * cp - z * sp; }
    var tmp = [0, 0, 0];
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var k = j * cols + i, z = g.z[k];
      if (z !== z) { SX[k] = NaN; continue; }
      proj(i * g.dx - g.W / 2, g.H / 2 - j * g.dy, (z - zmid) * ex, tmp);
      SX[k] = tmp[0]; SY[k] = tmp[1]; DP[k] = tmp[2];
    }
    var order = [], ok = V3.q.ok, col = V3.q.col, q, dep = new Float32Array((cols - 1) * (rows - 1));
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
      q = j * (cols - 1) + i; if (!ok[q]) continue;
      var a = j * cols + i; dep[q] = (DP[a] + DP[a + 1] + DP[a + cols] + DP[a + cols + 1]) / 4; order.push(q);
    }
    order.sort(function (p1, p2) { return dep[p2] - dep[p1]; });
    ctx.lineJoin = 'round'; ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(0,0,0,.32)';
    for (var oi = 0; oi < order.length; oi++) {
      q = order[oi]; var qj = Math.floor(q / (cols - 1)), qi = q - qj * (cols - 1), a0 = qj * cols + qi;
      ctx.fillStyle = 'rgb(' + (col[q * 3] | 0) + ',' + (col[q * 3 + 1] | 0) + ',' + (col[q * 3 + 2] | 0) + ')';
      ctx.beginPath(); ctx.moveTo(SX[a0], SY[a0]); ctx.lineTo(SX[a0 + 1], SY[a0 + 1]); ctx.lineTo(SX[a0 + cols + 1], SY[a0 + cols + 1]); ctx.lineTo(SX[a0 + cols], SY[a0 + cols]); ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (useTex) {
        var T = V3.tex, ta = a0, tb = a0 + 1, tc = a0 + cols, td = a0 + cols + 1;
        var ux = T.TX[tb] - T.TX[ta], uy = T.TY[tb] - T.TY[ta], vx = T.TX[tc] - T.TX[ta], vy = T.TY[tc] - T.TY[ta], det = ux * vy - uy * vx;
        if (Math.abs(det) > 1e-6) {
          var Sux = SX[a0 + 1] - SX[a0], Suy = SY[a0 + 1] - SY[a0], Svx = SX[a0 + cols] - SX[a0], Svy = SY[a0 + cols] - SY[a0];
          var m11 = (Sux * vy - Svx * uy) / det, m12 = (Suy * vy - Svy * uy) / det, m21 = (-Sux * vx + Svx * ux) / det, m22 = (-Suy * vx + Svy * ux) / det;
          var bx0 = Math.floor(Math.min(T.TX[ta], T.TX[tb], T.TX[tc], T.TX[td])), by0 = Math.floor(Math.min(T.TY[ta], T.TY[tb], T.TY[tc], T.TY[td])),
              bx1 = Math.ceil(Math.max(T.TX[ta], T.TX[tb], T.TX[tc], T.TX[td])), by1 = Math.ceil(Math.max(T.TY[ta], T.TY[tb], T.TY[tc], T.TY[td]));
          bx0 = Math.max(0, bx0); by0 = Math.max(0, by0); bx1 = Math.min(T.cv.width, bx1); by1 = Math.min(T.cv.height, by1);
          if (bx1 > bx0 && by1 > by0) {
            ctx.setTransform(m11 * dpr, m12 * dpr, m21 * dpr, m22 * dpr, (SX[a0] - m11 * T.TX[ta] - m21 * T.TY[ta]) * dpr, (SY[a0] - m12 * T.TX[ta] - m22 * T.TY[ta]) * dpr);
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(T.cv, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }
        }
      }
    }
    // jalur
    V3.trk.forEach(function (tr) {
      ctx.beginPath();
      tr.pts.forEach(function (p, idx) { proj(p[0], p[1], (p[2] - zmid) * ex + tr.lift * 6, tmp); if (idx) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); });
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = tr.c; ctx.lineWidth = 2.6; ctx.stroke();
    });
    (V3.shp || []).forEach(function (s) {
      ctx.beginPath();
      s.runs.forEach(function (r) { r.forEach(function (p, idx) { proj(p[0], p[1], (p[2] - zmid) * ex + s.lift * 4, tmp); if (idx) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); }); });
      if (s.closed) { ctx.closePath(); ctx.globalAlpha = 0.2; ctx.fillStyle = s.c; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4.4; ctx.stroke();
      ctx.strokeStyle = s.c; ctx.lineWidth = 2; ctx.stroke();
      if (s.lp) {
        proj(s.lp[0], s.lp[1], (s.lp[2] - zmid) * ex + s.lift * 8, tmp);
        ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3.4; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(s.label, tmp[0], tmp[1]); ctx.fillStyle = s.c; ctx.fillText(s.label, tmp[0], tmp[1]);
      }
    });
    // kompas (arah utara)
    var cx0 = w - 34, cy0 = 140; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2;
    var nx = -sy * 16, ny = -(cy * sp) * 16;
    ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + nx, cy0 + ny); ctx.stroke();
    ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('U', cx0 + nx * 1.5, cy0 + ny * 1.5);
  }
  function slopeLine(tag, r) {
    return (tag ? '<small>' + tag + '</small> ' : '') + '<b>' + Math.round(r.h) + ' mdpl</b> · ' + (r.pct < 0.5 ? 'datar' : 'lereng ' + fmt1(r.pct) + '% ' + ARROW.replace('DEG', Math.round(r.down)));
  }
  function slopeTap(m, e) {
    if (!window.HzDem) return;
    var ll = e.latlng, both = S.settings.useNas !== false && S.settings.useFree !== false;
    if (!both) {
      HzDem.info(ll.lat, ll.lng).then(function (r) {
        if (!r) { toast(S.settings.useNas === false ? 'Data ketinggian belum tersedia (butuh internet)' : 'Titik ini di luar area DEMNAS'); return; }
        m._pinInfo([ll.lat, ll.lng], '<div>' + slopeLine('', r) + '</div>');
      });
      return;
    }
    Promise.all([HzDem.info(ll.lat, ll.lng, 'nas'), HzDem.info(ll.lat, ll.lng, 'free')]).then(function (r) {
      var a = r[0], b = r[1];
      if (!a && !b) { toast('Data ketinggian belum tersedia (butuh internet)'); return; }
      var t = [];
      if (a) t.push(slopeLine('DEMNAS', a));
      if (b) t.push(slopeLine('DEM gratis', b));
      if (a && b) t.push('<small>Selisih ' + Math.round(Math.abs(a.h - b.h)) + ' m · ' + fmt1(Math.abs(a.pct - b.pct)) + '% kemiringan</small>');
      m._pinInfo([ll.lat, ll.lng], '<div style="line-height:1.35">' + t.join('<br>') + '</div>');
    });
  }
  // ---------- sumber data dan koreksi danau ----------
  function demRedraw() {
    CL.clear();
    [DM.layer, DM.slope, DM.hach, DM.mesh].forEach(function (l) { if (l) l.redraw(); });
    if (V3.on) open3d(true);
    if (S.profOpen) renderProfile();
    if (DM.sync) DM.sync();
  }
  function setSource(which, on) {
    var nas = S.settings.useNas !== false, free = S.settings.useFree !== false;
    if (which === 'nas') nas = on; else free = on;
    if (!nas && !free) { toast('Minimal satu sumber data harus nyala'); return; }
    S.settings.useNas = nas; S.settings.useFree = free; saveSettings();
    if (window.HzDem) HzDem.setSources(nas, free);
    demRedraw();
    toast(nas && free ? 'DEMNAS + DEM gratis' : nas ? 'DEMNAS saja' : 'DEM gratis saja');
  }
  // ---------- batas wilayah ----------
  function batSet() { return S.settings.bat || (S.settings.bat = {}); }
  function batCfg() {
    var b = S.settings.bat || {};
    return { desa: !!b.desa, kec: !!b.kec, online: b.online !== false, file: b.file !== false, base: b.base || '', desaId: b.desaId == null ? null : b.desaId, kecId: b.kecId == null ? null : b.kecId,
      fDesa: b.fDesa || '', fKec: b.fKec || '', minDesa: b.minDesa || 13, minKec: b.minKec || 10, osm: S.settings.mapMode === 'osm' };
  }
  function batRedraw() {
    [DM.bat, SP.bat].forEach(function (x) { if (x) x.redraw(); });
    var on = !!(S.settings.bat && (S.settings.bat.desa || S.settings.bat.kec));
    if ($('spBat')) $('spBat').classList.toggle('on', on);
    if (DM.sync) DM.sync();
  }
  var BAT_BASES = []; (function () { for (var i = 1; i <= 10; i++) BAT_BASES.push('https://geoportal.bps.go.id/server/rest/services/LCRPGR/MA' + (i < 10 ? '0' : '') + i + '_BatasWilayah/MapServer'); })();
  function guessField(fields, kind) {
    var re = kind === 'kec' ? /^(wadmkc|nama_?kec|nm_?kec|kecamatan|namobj|nama|name)/i : /^(wadmkd|namobj|nama_?desa|nm_?desa|desa|nama_?kel|nm_?kel|nama|name)/i;
    for (var i = 0; i < fields.length; i++) if (re.test(fields[i])) return fields[i];
    return fields[0] || '';
  }
  function openBat() {
    var b = batSet(), imKind = 'desa';
    function stepRow(id, label, v) { return '<div class="row" style="align-items:center;margin-top:6px"><div style="flex:1">' + label + '</div><button class="btn" data-st="' + id + '-" style="width:44px">−</button><b id="' + id + 'V" style="min-width:30px;text-align:center">' + v + '</b><button class="btn" data-st="' + id + '+" style="width:44px">+</button></div>'; }
    openSheet('<div class="grab"></div><div class="st">BATAS WILAYAH</div>' +
      '<div class="muted" style="margin:4px 0 8px">Hanya tampil di peta, tidak dicatat di trip. Batas dari data pemerintah bisa bergeser dari batas di lapangan, jadi anggap sebagai petunjuk.</div>' +
      '<div class="h">SUMBER</div>' +
      '<label><input type="checkbox" id="bOn"' + (b.online !== false ? ' checked' : '') + '> Layanan online (garis penuh)</label>' +
      '<label><input type="checkbox" id="bFi"' + (b.file !== false ? ' checked' : '') + '> Berkas impor (garis putus-putus)</label>' +
      '<div class="h" style="margin-top:12px">LAYANAN ONLINE (ArcGIS MapServer)</div>' +
      '<input type="text" id="bUrl" placeholder="https://…/MapServer" value="' + esc(b.base || '') + '">' +
      '<div class="row" style="margin-top:8px"><button class="btn" id="bFind" style="flex:1.4">Cari otomatis di lokasi peta</button><button class="btn" id="bTest" style="flex:1">Muat layer</button></div>' +
      '<div class="muted" id="bMsg" style="margin-top:6px;white-space:pre-wrap"></div>' +
      '<div style="margin-top:8px"><div class="muted">Layer desa</div><select id="bSd"></select><div class="muted" style="margin-top:4px">Kolom nama desa (kosong = otomatis)</div><input type="text" id="bFd" value="' + esc(b.fDesa || '') + '"></div>' +
      '<div style="margin-top:8px"><div class="muted">Layer kecamatan</div><select id="bSk"></select><div class="muted" style="margin-top:4px">Kolom nama kecamatan (kosong = otomatis)</div><input type="text" id="bFk" value="' + esc(b.fKec || '') + '"></div>' +
      '<div class="h" style="margin-top:12px">IMPOR BERKAS (GeoJSON atau KML)</div>' +
      '<div class="row"><button class="btn" id="bImD" style="flex:1">Impor batas desa</button><button class="btn" id="bImK" style="flex:1">Impor batas kecamatan</button></div>' +
      '<input type="file" id="bFile" multiple style="display:none"><div class="muted" id="bList" style="margin-top:6px"></div>' +
      '<div class="h" style="margin-top:12px">TAMPILAN NAMA</div>' + stepRow('bZd', 'Nama desa mulai zoom', b.minDesa || 13) + stepRow('bZk', 'Nama kecamatan mulai zoom', b.minKec || 10) +
      '<button class="btn" id="bX" style="width:100%;margin-top:12px">Tutup</button>');
    var layers = [];
    function fillSel(id, sel, guessId) {
      var s = $(id); s.innerHTML = '<option value="">(tidak dipakai)</option>' + layers.map(function (l) { return '<option value="' + l.id + '">' + esc(l.id + ' · ' + l.name) + '</option>'; }).join('');
      s.value = sel != null ? String(sel) : (guessId != null ? String(guessId) : '');
    }
    function selCur() { fillSel('bSd', b.desaId, null); fillSel('bSk', b.kecId, null); }
    function renderList() {
      var f = HzBatas.fileInfo();
      $('bList').innerHTML = f.length ? f.map(function (x, i) { return esc((x.kind === 'desa' ? 'Desa' : 'Kecamatan') + ': ' + x.name) + ' · ' + x.n + ' poligon <a href="#" data-rm="' + i + '" style="color:var(--r)">hapus</a>'; }).join('<br>') : 'Belum ada berkas.';
    }
    selCur(); renderList();
    if (b.base) arcLayersSafe();
    function arcLayersSafe() { HzBatas.arcLayers(b.base).then(function (l) { layers = l; selCur(); }).catch(function () {}); }
    function saveSel() {
      b.online = $('bOn').checked; b.file = $('bFi').checked; b.base = $('bUrl').value.trim();
      b.desaId = $('bSd').value === '' ? null : +$('bSd').value; b.kecId = $('bSk').value === '' ? null : +$('bSk').value;
      b.fDesa = $('bFd').value.trim(); b.fKec = $('bFk').value.trim();
      saveSettings(); HzBatas.clearArcCache && 0; batRedraw();
    }
    ['bOn', 'bFi'].forEach(function (i) { $(i).onchange = saveSel; });
    ['bSd', 'bSk', 'bFd', 'bFk', 'bUrl'].forEach(function (i) { $(i).onchange = saveSel; });
    $('bSd').addEventListener('change', function () { if (this.value !== '') HzBatas.arcFields($('bUrl').value.trim(), this.value).then(function (f) { if (!$('bFd').value) { $('bFd').value = guessField(f, 'desa'); saveSel(); } }).catch(function () {}); });
    $('bSk').addEventListener('change', function () { if (this.value !== '') HzBatas.arcFields($('bUrl').value.trim(), this.value).then(function (f) { if (!$('bFk').value) { $('bFk').value = guessField(f, 'kec'); saveSel(); } }).catch(function () {}); });
    $('bTest').onclick = function () {
      var u = $('bUrl').value.trim(); if (!u) { $('bMsg').textContent = 'Isi alamat layanan dulu, atau pakai Cari otomatis.'; return; }
      $('bMsg').textContent = 'Memuat daftar layer…';
      HzBatas.arcLayers(u).then(function (l) {
        layers = l; b.base = u; fillSel('bSd', null, HzBatas.guessLayer(l, 'desa')); fillSel('bSk', null, HzBatas.guessLayer(l, 'kec'));
        $('bMsg').textContent = l.length + ' layer ditemukan. Pilih layer desa dan kecamatan.'; saveSel();
        $('bSd').dispatchEvent(new Event('change')); $('bSk').dispatchEvent(new Event('change'));
      }).catch(function (e) { $('bMsg').textContent = 'Gagal: ' + (e && e.message || e); });
    };
    $('bFind').onclick = function () {
      if (!map) return; var c = map.getCenter(); $('bMsg').textContent = 'Mencari layanan yang memuat lokasi peta…';
      HzBatas.discover(c.lat, c.lng, BAT_BASES, function (base) { $('bMsg').textContent = 'Memeriksa ' + base.replace(/^.*LCRPGR\//, '') + '…'; }).then(function (r) {
        if (!r) { $('bMsg').textContent = 'Tidak ditemukan otomatis. Isi alamat layanan sendiri lalu tekan Muat layer.'; return; }
        layers = r.layers; $('bUrl').value = r.base; b.base = r.base; fillSel('bSd', null, r.desaId); fillSel('bSk', null, r.kecId);
        $('bMsg').textContent = 'Ditemukan: ' + r.base.replace(/^.*LCRPGR\//, ''); saveSel();
        $('bSd').dispatchEvent(new Event('change')); $('bSk').dispatchEvent(new Event('change'));
      });
    };
    $('bImD').onclick = function () { imKind = 'desa'; $('bFile').value = ''; $('bFile').click(); };
    $('bImK').onclick = function () { imKind = 'kec'; $('bFile').value = ''; $('bFile').click(); };
    $('bFile').onchange = function () {
      var fl = Array.prototype.slice.call(this.files || []), i = 0, msgs = [];
      $('bMsg').textContent = 'Membaca berkas…';
      (function nx() {
        if (i >= fl.length) { $('bMsg').textContent = msgs.join('\n'); renderList(); batRedraw(); return; }
        var f = fl[i++];
        HzBatas.importFile(f, imKind, imKind === 'kec' ? $('bFk').value.trim() : $('bFd').value.trim()).then(function (r) { msgs.push(f.name + ': ' + r.n + ' poligon' + (r.named < r.n ? ' (' + (r.n - r.named) + ' tanpa nama)' : '')); }, function (e) { msgs.push(f.name + ': ' + (e && e.message || e)); }).then(nx);
      })();
    };
    $('bList').onclick = function (e) { var t = e.target.closest && e.target.closest('a[data-rm]'); if (!t) return; e.preventDefault(); var x = HzBatas.fileInfo()[+t.getAttribute('data-rm')]; if (x) HzBatas.removeFile(x.kind, x.name).then(function () { renderList(); batRedraw(); }); };
    $('sheet').querySelectorAll('button[data-st]').forEach(function (bt) {
      bt.onclick = function () {
        var s = bt.getAttribute('data-st'), id = s.slice(0, -1), up = s.slice(-1) === '+';
        if (id === 'bZd') { b.minDesa = Math.max(10, Math.min(19, (b.minDesa || 13) + (up ? 1 : -1))); $('bZdV').textContent = b.minDesa; }
        else { b.minKec = Math.max(6, Math.min(16, (b.minKec || 10) + (up ? 1 : -1))); $('bZkV').textContent = b.minKec; }
        saveSettings(); batRedraw();
      };
    });
    $('bX').onclick = function () { closeSheet(); if (S.view === 'data') renderData(); };
  }
  // ---------- halaman Data peta ----------
  function viewOnMap(pts) {
    mapKeep = true; go('lintasan');
    setTimeout(function () { if (map && pts && pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 19 }); }, 900);
  }
  function afterShape() { if (S.view === 'data') { closeSheet(); renderData(); } else openShapes(); }
  function delLake(i) {
    var l = lakesList()[i]; if (!l) return;
    askConfirm('Hapus tanda "' + l.name + '"?', 'Kontur dan arah panah di sekitarnya kembali mengikuti data asli.', 'Hapus', function () { lakesList().splice(i, 1); saveSettings(); applyLakes(); demRedraw(); if (S.view === 'data') renderData(); else openLakes(); });
  }
  function renderData() {
    var tab = S.dpTab || 'danau';
    document.querySelectorAll('#dpTabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
    document.querySelectorAll('.dpp').forEach(function (e) { e.classList.toggle('on', e.id === 'dp-' + tab); });
    var box = $('dp-' + tab);
    if (tab === 'danau') {
      var ls = lakesList();
      box.innerHTML = (ls.length ? ls.map(function (l, i) {
        return '<div class="card"><div class="dprow" style="margin-top:0"><input type="text" data-lk="' + i + '" value="' + esc(l.name) + '" maxlength="30"><button class="btn sm" data-lv="' + i + '">Lihat</button><button class="btn sm danger" data-ld="' + i + '">Hapus</button></div><div class="muted" data-lm="' + i + '" style="margin-top:6px"></div></div>';
      }).join('') : '<div class="card muted">Belum ada tanda danau.</div>') +
        '<div class="muted" style="margin-top:10px">Di dalam tanda, permukaan dianggap datar di bawah tepinya, jadi panah di tepi menunjuk ke dalam. Dipakai oleh kontur, kemiringan, arsiran, Info lereng, dan profil. Matikan dengan ikon Danau di Alat peta.</div>' +
        '<button class="btn pri" id="dpNewL" style="width:100%;margin-top:12px;height:50px">+ Tandai danau baru</button>';
      ls.forEach(function (l, i) {
        function show(m) { var e = box.querySelector('[data-lm="' + i + '"]'); if (e && m && m.area) e.textContent = 'Luas datar ' + fmtArea(m.area) + (m.areaSlope ? ' · permukaan lereng ' + fmtArea(m.areaSlope) : '') + ' · keliling ' + fmtLen(m.flat); }
        if (l.m) show(l.m); else if (window.HzDem) HzDem.measure(l.pts, true).then(function (m) { l.m = m; saveSettings(); show(m); }).catch(function () {});
      });
      box.querySelectorAll('input[data-lk]').forEach(function (inp) { inp.onchange = function () { var l = lakesList()[+inp.getAttribute('data-lk')]; if (l) { l.name = inp.value.trim() || l.name; saveSettings(); drawLakes(); } }; });
      box.querySelectorAll('[data-lv]').forEach(function (b) { b.onclick = function () { var l = lakesList()[+b.getAttribute('data-lv')]; if (l) viewOnMap(l.pts); }; });
      box.querySelectorAll('[data-ld]').forEach(function (b) { b.onclick = function () { delLake(+b.getAttribute('data-ld')); }; });
      $('dpNewL').onclick = function () { mapKeep = true; go('lintasan'); setTimeout(drawStart, 700); };
    } else if (tab === 'gambar') {
      var sh = shapesList();
      box.innerHTML = (sh.length ? sh.map(function (s, i) {
        return '<div class="card"><div class="dprow" style="margin-top:0"><div class="nm"><b>' + esc(s.name) + '</b><small>' + (s.type === 'line' ? 'Garis' : 'Area') + (s.m ? ' · ' + (s.type === 'line' ? fmtLen(s.m.flat) : (s.m.area ? fmtArea(s.m.area) + ' (datar)' + (s.m.areaSlope ? ' · ' + fmtArea(s.m.areaSlope) + ' (lereng)' : '') : '')) : '') + '</small></div><button class="btn sm" data-sv="' + i + '">Lihat</button><button class="btn sm" data-se="' + i + '">Buka</button></div></div>';
      }).join('') : '<div class="card muted">Belum ada gambar.</div>') +
        '<div class="muted" style="margin-top:10px">Garis mengukur panjang. Area menandai wilayah dan mengukur luas (datar dan mengikuti lereng). Tampil di peta dan 3D.</div>' +
        '<button class="btn pri" id="dpNewS" style="width:100%;margin-top:12px;height:50px">+ Gambar baru</button>';
      box.querySelectorAll('[data-sv]').forEach(function (b) { b.onclick = function () { var s = shapesList()[+b.getAttribute('data-sv')]; if (s) viewOnMap(s.pts); }; });
      box.querySelectorAll('[data-se]').forEach(function (b) { b.onclick = function () { openShape(+b.getAttribute('data-se')); }; });
      $('dpNewS').onclick = function () { mapKeep = true; go('lintasan'); setTimeout(drawStart, 700); };
    } else if (tab === 'batas') {
      var bs = batSet(), fi = window.HzBatas ? HzBatas.fileInfo() : [];
      box.innerHTML = '<div class="card"><div class="dprow" style="margin-top:0"><div class="nm"><b>Desa</b><small>' + (bs.desa ? 'tampil di peta' : 'mati') + '</small></div><button class="btn sm" data-bt="desa">' + (bs.desa ? 'Matikan' : 'Nyalakan') + '</button></div>' +
        '<div class="dprow"><div class="nm"><b>Kecamatan</b><small>' + (bs.kec ? 'tampil di peta' : 'mati') + '</small></div><button class="btn sm" data-bt="kec">' + (bs.kec ? 'Matikan' : 'Nyalakan') + '</button></div></div>' +
        '<div class="h">BERKAS IMPOR</div><div class="card">' + (fi.length ? fi.map(function (x, i) { return '<div class="dprow" style="margin-top:' + (i ? 8 : 0) + 'px"><div class="nm"><b>' + esc(x.name) + '</b><small>' + (x.kind === 'desa' ? 'Desa' : 'Kecamatan') + ' · ' + x.n + ' poligon</small></div><button class="btn sm danger" data-bd="' + i + '">Hapus</button></div>'; }).join('') : '<div class="muted">Belum ada berkas.</div>') + '</div>' +
        '<div class="h">LAYANAN ONLINE</div><div class="card"><div class="muted" style="word-break:break-all">' + (bs.base ? esc(bs.base) : 'Belum diatur.') + '</div></div>' +
        '<button class="btn pri" id="dpBat" style="width:100%;margin-top:12px;height:50px">Pengaturan batas wilayah</button>';
      box.querySelectorAll('[data-bt]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-bt'); bs[k] = !bs[k]; saveSettings(); batRedraw(); renderData(); }; });
      box.querySelectorAll('[data-bd]').forEach(function (b) { b.onclick = function () { var x = HzBatas.fileInfo()[+b.getAttribute('data-bd')]; if (x) HzBatas.removeFile(x.kind, x.name).then(function () { batRedraw(); renderData(); }); }; });
      $('dpBat').onclick = openBat;
    } else if (tab === 'pdf') {
      renderOv();
    }
  }
  function lakesList() { return S.settings.lakes || (S.settings.lakes = []); }
  function applyLakes() {
    if (window.HzDem) HzDem.setLakes(S.settings.lakesOn !== false ? lakesList() : []);
    drawLakes();
  }
  function drawLakes() {
    if (!map) return;
    if (DM.lakeLayer) { map.removeLayer(DM.lakeLayer); DM.lakeLayer = null; }
    if (S.settings.lakesOn === false || !lakesList().length) return;
    var g = L.layerGroup();
    lakesList().forEach(function (l) {
      L.polygon(l.pts, { color: '#7FD8FF', weight: 1.2, dashArray: '5 4', fill: false, interactive: false }).bindTooltip(esc(l.name), { permanent: true, direction: 'center', className: 'lktip' }).addTo(g);
    });
    g.addTo(map); DM.lakeLayer = g;
  }
  function openLakes() {
    var ls = lakesList();
    openSheet('<div class="grab"></div><div class="st">DANAU</div>' +
      (ls.length ? ls.map(function (l, i) { return '<div class="row" style="margin-top:8px"><input type="text" data-lk="' + i + '" value="' + esc(l.name) + '" maxlength="30"><button class="btn" data-del="' + i + '" style="flex-shrink:0">Hapus</button></div><div class="muted" data-lm="' + i + '" style="margin-top:2px"></div>'; }).join('') : '<div class="muted" style="margin:8px 0">Belum ada tanda danau.</div>') +
      '<div class="muted" style="margin-top:10px">Di dalam tanda, permukaan dianggap datar di bawah tepinya, jadi panah di tepi menunjuk ke dalam. Dipakai oleh kontur, kemiringan, arsiran, Info lereng, dan profil. Matikan dengan saklar Koreksi danau.</div>' +
      '<button class="btn pri" id="lkNew" style="width:100%;margin-top:12px;height:50px">+ Tandai danau baru</button><button class="btn" id="lkX" style="width:100%;margin-top:8px">Tutup</button>');
    ls.forEach(function (l, i) {
      function show(m) { var e = $('sheet').querySelector('[data-lm="' + i + '"]'); if (e && m && m.area) e.textContent = 'Luas datar ' + fmtArea(m.area) + (m.areaSlope ? ' · permukaan lereng ' + fmtArea(m.areaSlope) : '') + ' · keliling ' + fmtLen(m.flat); }
      if (l.m) show(l.m); else if (window.HzDem) HzDem.measure(l.pts, true).then(function (m) { l.m = m; saveSettings(); show(m); }).catch(function () {});
    });
    $('lkX').onclick = closeSheet;
    $('lkNew').onclick = function () { closeSheet(); lakeStart(); };
    $('sheet').querySelectorAll('input[data-lk]').forEach(function (inp) {
      inp.onchange = function () { var l = lakesList()[+inp.getAttribute('data-lk')]; if (l) { l.name = inp.value.trim() || l.name; saveSettings(); drawLakes(); } };
    });
    $('sheet').querySelectorAll('button[data-del]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-del'), l = lakesList()[i]; if (!l) return;
        askConfirm('Hapus tanda "' + l.name + '"?', 'Kontur dan arah panah di sekitarnya kembali mengikuti data asli.', 'Hapus', function () { lakesList().splice(i, 1); saveSettings(); applyLakes(); demRedraw(); openLakes(); });
      };
    });
  }
  // ---------- gambar dan ukur (garis, area, danau) ----------
  var SHP_COL = ['#FF7AD9', '#B79CFF', '#5EE0FF', '#FFFFFF', '#00E5C0'];
  function shapesList() { return S.settings.shapes || (S.settings.shapes = []); }
  function nf(v, d) { return v.toFixed(d).replace('.', ','); }
  function fmtLen(m) { return m < 1000 ? Math.round(m) + ' m' : nf(m / 1000, 2) + ' km'; }
  function fmtArea(m) { return m < 10000 ? Math.round(m) + ' m²' : nf(m / 10000, 2) + ' ha'; }
  function shapeText(s) {
    var m = s.m; if (!m) return s.name;
    return s.name + ' · ' + (s.type === 'line' ? fmtLen(m.flat) : (m.area ? fmtArea(m.area) : ''));
  }
  function flatQ(pts, closed) {
    var R = Math.PI / 180, kx = 111320 * Math.cos(pts[0][0] * R), ky = 111320, xy = pts.map(function (p) { return [(p[1] - pts[0][1]) * kx, (p[0] - pts[0][0]) * ky]; }), len = 0, ar = 0, i;
    for (i = 0; i < xy.length - 1; i++) len += Math.hypot(xy[i + 1][0] - xy[i][0], xy[i + 1][1] - xy[i][1]);
    if (closed && xy.length > 2) { len += Math.hypot(xy[0][0] - xy[xy.length - 1][0], xy[0][1] - xy[xy.length - 1][1]); for (i = 0; i < xy.length; i++) { var p = xy[i], q = xy[(i + 1) % xy.length]; ar += p[0] * q[1] - q[0] * p[1]; } }
    return { len: len, area: Math.abs(ar) / 2 };
  }
  function measureHtml(m, type) {
    if (!m) return '<div class="muted">Menghitung…</div>';
    var h = [];
    function line(k, v) { h.push('<div class="row" style="justify-content:space-between;margin-top:4px"><span class="muted">' + k + '</span><b>' + v + '</b></div>'); }
    function pc(a, b) { return ' (' + (b >= a ? '+' : '−') + nf(Math.abs(b / a - 1) * 100, 1) + '%)'; }
    if (type === 'line') {
      line('Panjang datar', fmtLen(m.flat));
      if (m.slope != null) { line('Panjang mengikuti lereng', fmtLen(m.slope) + pc(m.flat, m.slope)); line('Naik / turun', '+' + Math.round(m.gain) + ' m / −' + Math.round(m.loss) + ' m'); line('Mulai → akhir', Math.round(m.eStart) + ' → ' + Math.round(m.eEnd) + ' mdpl'); }
    } else {
      if (m.area) line('Luas datar', fmtArea(m.area) + ' · ' + Math.round(m.area).toLocaleString('id-ID') + ' m²');
      if (m.areaSlope) { line('Luas permukaan lereng', fmtArea(m.areaSlope) + pc(m.area, m.areaSlope)); line('Kemiringan rata-rata', nf(m.pct, 1) + '%'); }
      line('Keliling datar', fmtLen(m.flat)); if (m.slope != null) line('Keliling mengikuti lereng', fmtLen(m.slope));
      if (m.zmin != null) line('Tinggi', Math.round(m.zmin) + ' – ' + Math.round(m.zmax) + ' mdpl');
    }
    if (m.slope == null) h.push('<div class="muted" style="margin-top:6px">Data ketinggian belum tersedia di area ini (butuh internet), jadi hanya ukuran datar.</div>');
    return h.join('');
  }
  function drawShapes() {
    if (!map) return;
    if (DM.shapeLayer) { map.removeLayer(DM.shapeLayer); DM.shapeLayer = null; }
    if (S.settings.shapesOn === false || !shapesList().length) return;
    var g = L.layerGroup();
    shapesList().forEach(function (s) {
      var o = { color: s.color || '#FF7AD9', weight: 2.2, interactive: false };
      var l = s.type === 'line' ? L.polyline(s.pts, o) : L.polygon(s.pts, Object.assign(o, { fillOpacity: 0.16 }));
      l.bindTooltip(esc(shapeText(s)), { permanent: true, direction: 'center', className: 'lktip' }).addTo(g);
    });
    g.addTo(map); DM.shapeLayer = g;
  }
  function applyShapes() { drawShapes(); if (V3.on) open3d(true); }
  function shapeItems() {
    var out = [];
    if (S.settings.shapesOn !== false) shapesList().forEach(function (s) { out.push({ name: s.name, pts: s.pts, closed: s.type !== 'line', color: s.color || '#FF7AD9', label: shapeText(s) }); });
    if (S.settings.lakesOn !== false) lakesList().forEach(function (l) { out.push({ name: l.name, pts: l.pts, closed: true, color: '#7FD8FF', label: l.name + (l.m && l.m.area ? ' · ' + fmtArea(l.m.area) : '') }); });
    return out;
  }
  function openShapes() {
    var ls = shapesList();
    openSheet('<div class="grab"></div><div class="st">GAMBAR & UKUR</div>' +
      (ls.length ? ls.map(function (s, i) { return '<button class="btn" data-sh="' + i + '" style="width:100%;margin-top:8px;text-align:left;height:auto;padding:8px 12px"><b>' + esc(s.name) + '</b><br><small class="muted">' + (s.type === 'line' ? 'Garis' : 'Area') + (s.m ? ' · ' + (s.type === 'line' ? fmtLen(s.m.flat) : (s.m.area ? fmtArea(s.m.area) : '')) : '') + '</small></button>'; }).join('') : '<div class="muted" style="margin:8px 0">Belum ada gambar.</div>') +
      '<div class="muted" style="margin-top:10px">Ketuk titik di peta. Pilih Garis untuk mengukur panjang, atau Area untuk menandai wilayah dan mengukur luasnya. Danau memakai alat yang sama dan juga mengoreksi ketinggian. Semua tampil di peta dan tampilan 3D.</div>' +
      '<button class="btn pri" id="shNew" style="width:100%;margin-top:12px;height:50px">+ Gambar baru</button><button class="btn" id="shX" style="width:100%;margin-top:8px">Tutup</button>');
    $('shX').onclick = closeSheet;
    $('shNew').onclick = function () { closeSheet(); drawStart(); };
    $('sheet').querySelectorAll('button[data-sh]').forEach(function (b) { b.onclick = function () { openShape(+b.getAttribute('data-sh')); }; });
  }
  function openShape(i) {
    var s = shapesList()[i]; if (!s) return;
    openSheet('<div class="grab"></div><div class="st">' + (s.type === 'line' ? 'GARIS' : 'AREA') + '</div>' +
      '<input type="text" id="shN" maxlength="40" value="' + esc(s.name) + '" style="margin-top:6px">' +
      '<div class="row" id="shC" style="margin-top:8px;gap:8px">' + SHP_COL.map(function (c) { return '<button class="btn" data-c="' + c + '" style="width:44px;height:44px;flex:none;background:' + c + ';border:3px solid ' + (c === s.color ? 'var(--tx)' : 'transparent') + '"></button>'; }).join('') + '</div>' +
      '<div id="shM" style="margin-top:10px"></div>' +
      '<textarea id="shT" rows="2" maxlength="200" placeholder="Catatan (opsional)" style="margin-top:10px;width:100%">' + esc(s.note || '') + '</textarea>' +
      '<div class="row" style="margin-top:10px"><button class="btn" id="shV" style="flex:1">Lihat di peta</button><button class="btn" id="shD" style="flex:1;color:var(--r)">Hapus</button></div>' +
      '<button class="btn" id="shX" style="width:100%;margin-top:8px">Selesai</button>');
    $('shM').innerHTML = measureHtml(s.m, s.type);
    if (!s.m && window.HzDem) HzDem.measure(s.pts, s.type !== 'line').then(function (m) { s.m = m; saveSettings(); if ($('shM')) $('shM').innerHTML = measureHtml(m, s.type); drawShapes(); }).catch(function () {});
    $('shN').onchange = function () { s.name = $('shN').value.trim() || s.name; saveSettings(); applyShapes(); };
    $('shT').onchange = function () { s.note = $('shT').value.trim(); saveSettings(); };
    $('shC').onclick = function (e) { var c = e.target.getAttribute && e.target.getAttribute('data-c'); if (!c) return; s.color = c; saveSettings(); applyShapes(); openShape(i); };
    $('shV').onclick = function () { closeSheet(); if (map) map.fitBounds(L.latLngBounds(s.pts), { padding: [50, 50], maxZoom: 19 }); };
    $('shD').onclick = function () { askConfirm('Hapus "' + s.name + '"?', 'Gambar ini dihapus dari peta dan tampilan 3D.', 'Hapus', function () { shapesList().splice(i, 1); saveSettings(); applyShapes(); afterShape(); }); };
    $('shX').onclick = function () { if (S.view === 'data') afterShape(); else { closeSheet(); openShapes(); } };
  }
  function drawStart() {
    if (!map || !window.HzDem) return;
    if (DM.closePanel) DM.closePanel();
    map._slopeOn = false; if (DM.sync) DM.sync();
    var pts = [], pl = L.polyline([], { color: '#FFFFFF', weight: 2 }).addTo(map), mk = L.layerGroup().addTo(map), bar = document.createElement('div');
    bar.className = 'lkbar';
    bar.innerHTML = '<span id="lkT"></span><button type="button" id="lkU">Urung</button><button type="button" id="lkL" class="pri">Garis</button><button type="button" id="lkA" class="pri">Area</button><button type="button" id="lkD" class="pri">Danau</button><button type="button" id="lkC">Batal</button>';
    map.getContainer().appendChild(bar);
    L.DomEvent.disableClickPropagation(bar);
    function upd() {
      pl.setLatLngs(pts.length > 2 ? pts.concat([pts[0]]) : pts);
      var t = 'Ketuk titik di peta (' + pts.length + ')';
      if (pts.length > 1) { var q = flatQ(pts, false); t += ' · garis ' + fmtLen(q.len); if (pts.length > 2) t += ' · area ' + fmtArea(flatQ(pts, true).area); }
      $('lkT').textContent = t;
    }
    function dot(q) { L.circleMarker(q, { radius: 4, color: '#FFFFFF', weight: 2, fillOpacity: 1 }).addTo(mk); }
    function end() { map._lakeDraw = null; map.removeLayer(pl); map.removeLayer(mk); bar.remove(); }
    map._lakeDraw = { tap: function (ll) { var q = [+ll.lat.toFixed(6), +ll.lng.toFixed(6)]; pts.push(q); dot(q); upd(); } };
    $('lkU').onclick = function () { pts.pop(); mk.clearLayers(); pts.forEach(dot); upd(); };
    $('lkC').onclick = end;
    function saveShape(type) {
      var n = shapesList().filter(function (x) { return x.type === type; }).length + 1, p = pts.slice();
      toast('Menghitung…');
      HzDem.measure(p, type === 'area').catch(function () { return null; }).then(function (m) {
        var s = { id: Date.now(), type: type, name: (type === 'line' ? 'Garis ' : 'Area ') + n, pts: p, color: type === 'line' ? '#FFFFFF' : '#FF7AD9', note: '', m: m };
        shapesList().push(s); S.settings.shapesOn = true; saveSettings(); end(); applyShapes(); openShape(shapesList().length - 1);
      });
    }
    $('lkL').onclick = function () { if (pts.length < 2) { toast('Minimal 2 titik'); return; } saveShape('line'); };
    $('lkA').onclick = function () { if (pts.length < 3) { toast('Minimal 3 titik'); return; } saveShape('area'); };
    $('lkD').onclick = function () {
      if (pts.length < 3) { toast('Minimal 3 titik'); return; }
      toast('Menghitung…');
      HzDem.lakeLevel(pts).then(function (lv) {
        if (lv === null) { toast('Data ketinggian belum tersedia di area ini'); return; }
        var n = lakesList().length + 1, lk = { id: Date.now(), name: 'Danau ' + n, pts: pts.slice(), level: lv };
        lakesList().push(lk);
        S.settings.lakesOn = true; saveSettings(); end(); applyLakes(); demRedraw(); openLakes();
        HzDem.measure(lk.pts, true).then(function (m) { lk.m = m; saveSettings(); }).catch(function () {});
      });
    };
    upd();
    toast('Ketuk titik di peta');
  }
  function lakeStart() { drawStart(); }
  function tripPts(pts, t) {
    var out = [];
    E.trackOf(pts, t).runs.forEach(function (r) { r.pts.forEach(function (p) { out.push([p.lat, p.lng]); }); });
    return out;
  }
  // cache hasil naik/turun per trip (kunci: jam mulai-selesai)
  var CL = (function () {
    var c = null;
    function load() { if (c) return c; try { c = JSON.parse(localStorage.getItem('hzclimb') || '{}'); } catch (e) { c = {}; } return c; }
    return { clear: function () { c = {}; try { localStorage.removeItem('hzclimb'); } catch (e) {} }, get: function (k) { return load()[k]; }, set: function (k, v) { load()[k] = v; try { localStorage.setItem('hzclimb', JSON.stringify(c)); } catch (e) {} } };
  })();
  function climbOfTrip(t, pts) {
    var k = t.start + '-' + t.end, c = CL.get(k);
    if (c) return Promise.resolve({ up: c[0], down: c[1], min: c[2], max: c[3] });
    if (!window.HzDem) return Promise.resolve(null);
    return HzDem.profile(tripPts(pts, t), 60).then(function (p) {
      if (!p) return null;
      CL.set(k, [Math.round(p.up), Math.round(p.down), Math.round(p.min), Math.round(p.max)]);
      return { up: Math.round(p.up), down: Math.round(p.down), min: Math.round(p.min), max: Math.round(p.max) };
    }).catch(function () { return null; });
  }
  function climbSeq(items, onEach) {
    var i = 0, bad = false;
    function nx() {
      if (i >= items.length || bad) return Promise.resolve();
      var it = items[i++];
      return climbOfTrip(it.t, it.pts).then(function (c) { if (!c) bad = true; else onEach(it, c); return nx(); });
    }
    return nx();
  }
  function hideProf() {
    var b = $('profBox'); if (b) b.style.display = 'none';
    if (DM.mk && map) { map.removeLayer(DM.mk); DM.mk = null; }
    if (map) setTimeout(function () { map.invalidateSize(); }, 50);
  }
  function renderProfile() {
    if (DM.sync) DM.sync();
    if (!S.profOpen) { hideProf(); return; }
    var v = S.mapView, b = $('profBox');
    if (!v || !v.trips || !v.trips.length) { b.style.display = 'block'; $('profS').textContent = 'Belum ada trip pada hari ini.'; $('profCv').style.display = 'none'; $('profR').textContent = ''; setTimeout(function () { map.invalidateSize(); }, 50); return; }
    b.style.display = 'block'; $('profCv').style.display = 'none'; $('profR').textContent = '';
    $('profT').textContent = v.sel >= 0 ? 'Profil ketinggian · trip ' + (v.sel + 1) : 'Profil ketinggian · semua trip';
    $('profS').textContent = 'Menghitung ketinggian…';
    setTimeout(function () { map.invalidateSize(); }, 50);
    var pid = ++DM.pid, list = v.trips.map(function (x) { return x.t; });
    if (v.sel >= 0 && list[v.sel]) list = [list[v.sel]];
    var parts = [];
    (function nx(i) {
      if (i >= list.length) return Promise.resolve();
      return HzDem.profile(tripPts(v.pts, list[i]), 50).then(function (p) { if (p) parts.push(p); return nx(i + 1); });
    })(0).then(function () {
      if (pid !== DM.pid) return;
      if (!parts.length) { $('profS').textContent = 'Data ketinggian belum tersedia. Hubungkan internet sekali, lalu buka lagi.'; return; }
      var pr = { d: [], e: [], lat: [], lng: [], up: 0, down: 0, min: Infinity, max: -Infinity, km: 0, seps: [] }, off = 0;
      parts.forEach(function (p, k) {
        if (k > 0) { off += 150; pr.seps.push(off - 75); }
        p.d.forEach(function (dd, j) { pr.d.push(off + dd); pr.e.push(p.e[j]); pr.lat.push(p.lat[j]); pr.lng.push(p.lng[j]); });
        off += p.d[p.d.length - 1];
        pr.up += p.up; pr.down += p.down; pr.min = Math.min(pr.min, p.min); pr.max = Math.max(pr.max, p.max); pr.km += p.km;
      });
      DM.pr = pr;
      $('profS').innerHTML = 'Terendah <b>' + Math.round(pr.min) + ' m</b> · Tertinggi <b>' + Math.round(pr.max) + ' m</b> · Naik <b>' + Math.round(pr.up) + ' m</b> · Turun <b>' + Math.round(pr.down) + ' m</b> · ' + T.km1(pr.km) + ' km';
      $('profCv').style.display = 'block';
      drawProf(-1);
    }).catch(function () { if (pid === DM.pid) $('profS').textContent = 'Gagal menghitung ketinggian.'; });
  }
  function drawProf(hi) {
    var pr = DM.pr, cv = $('profCv'); if (!pr) return;
    var dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = 100;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var cx = cv.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    var dm = pr.d[pr.d.length - 1] || 1, lo = pr.min, hiE = pr.max, span = Math.max(8, hiE - lo), top = 10, bot = 16;
    function X(dd) { return 4 + dd / dm * (W - 8); }
    function Y(e) { return H - bot - (e - lo) / span * (H - bot - top); }
    var cs = getComputedStyle(document.documentElement), tx2 = cs.getPropertyValue('--tx2') || '#8a97a0';
    cx.beginPath(); cx.moveTo(X(pr.d[0]), H - bot);
    pr.d.forEach(function (dd, i) { cx.lineTo(X(dd), Y(pr.e[i])); });
    cx.lineTo(X(pr.d[pr.d.length - 1]), H - bot); cx.closePath();
    var gr = cx.createLinearGradient(0, top, 0, H - bot); gr.addColorStop(0, 'rgba(77,163,255,.45)'); gr.addColorStop(1, 'rgba(77,163,255,.05)');
    cx.fillStyle = gr; cx.fill();
    cx.beginPath(); pr.d.forEach(function (dd, i) { if (i) cx.lineTo(X(dd), Y(pr.e[i])); else cx.moveTo(X(dd), Y(pr.e[i])); });
    cx.strokeStyle = '#4DA3FF'; cx.lineWidth = 2; cx.lineJoin = 'round'; cx.stroke();
    cx.setLineDash([3, 4]); cx.strokeStyle = tx2; cx.lineWidth = 1;
    pr.seps.forEach(function (s) { cx.beginPath(); cx.moveTo(X(s), top); cx.lineTo(X(s), H - bot); cx.stroke(); });
    cx.setLineDash([]);
    cx.fillStyle = tx2; cx.font = '11px sans-serif'; cx.textBaseline = 'alphabetic';
    cx.textAlign = 'left'; cx.fillText(Math.round(lo) + ' m', 4, H - 3);
    cx.textAlign = 'right'; cx.fillText(Math.round(hiE) + ' m', W - 4, 10);
    cx.textAlign = 'center'; cx.fillText(T.km1(pr.km) + ' km', W / 2, H - 3);
    if (hi >= 0) {
      cx.strokeStyle = '#fff'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(X(pr.d[hi]), top); cx.lineTo(X(pr.d[hi]), H - bot); cx.stroke();
      cx.fillStyle = '#4DA3FF'; cx.beginPath(); cx.arc(X(pr.d[hi]), Y(pr.e[hi]), 5, 0, 7); cx.fill(); cx.lineWidth = 2; cx.strokeStyle = '#fff'; cx.stroke();
    }
  }
  function profHover(ev) {
    var pr = DM.pr; if (!pr || !map) return;
    var cv = $('profCv'), r = cv.getBoundingClientRect(), fx = (ev.clientX - r.left - 4) / Math.max(1, r.width - 8), dm = pr.d[pr.d.length - 1] || 1, tgt = Math.max(0, Math.min(1, fx)) * dm, lo = 0, hi = pr.d.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (pr.d[mid] < tgt) lo = mid + 1; else hi = mid; }
    drawProf(lo);
    var ll = [pr.lat[lo], pr.lng[lo]];
    if (!DM.mk) DM.mk = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#4DA3FF', fillOpacity: 1, interactive: false }).addTo(map); else DM.mk.setLatLng(ll);
    $('profR').textContent = Math.round(pr.e[lo]) + ' m · ' + T.km1(pr.d[lo] / 1000) + ' km dari awal';
  }
  function profInit() {
    var cv = $('profCv');
    $('profX').onclick = function () { S.profOpen = false; renderProfile(); };
    cv.addEventListener('pointerdown', function (e) { try { cv.setPointerCapture(e.pointerId); } catch (er) {} profHover(e); e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (e.buttons || e.pointerType === 'touch') profHover(e); });
    cv.addEventListener('pointerup', function () { if (DM.mk && map) { map.removeLayer(DM.mk); DM.mk = null; } drawProf(-1); });
  }

  // ---------- peta saya (PDF ditimpa di atas peta) ----------
  function ovList() { return S.settings.ovl || (S.settings.ovl = []); }
  function syncOverlays(m) {
    if (!m || !window.HzOverlay) return;
    (m._ovl || []).forEach(function (l) { try { m.removeLayer(l); } catch (e) {} });
    m._ovl = [];
    if (S.settings.mapMode !== 'osm') return; // lapisan PDF hanya di mode Peta, tidak di Satelit
    ovList().forEach(function (o) {
      if (!o.on || !o.cal) return;
      var af = HzOverlay.affOf(o);
      if (!af) return;
      m._ovl.push(HzOverlay.makeLayer(o, { toLL: HzOverlay.toLLFn(af), opacity: S.settings.ovlOp == null ? 0.8 : S.settings.ovlOp }).addTo(m));
    });
  }
  function syncAllOverlays() { syncOverlays(map); syncOverlays(mini); }
  function setOvOpacity(v) {
    S.settings.ovlOp = v;
    [map, mini].forEach(function (m) { if (m && m._ovl) m._ovl.forEach(function (l) { l.setOpacity(v); }); });
  }
  function mb(n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  function renderOv() {
    var box = $('ovList'); if (!box) return;
    var l = ovList();
    box.innerHTML = l.length ? l.map(function (o, i) {
      var af0 = o.cal ? HzOverlay.affOf(o) : null, inf = af0 ? HzOverlay.infoAff(af0, o.cal[0].lat) : null;
      return '<div class="ovrow"><div class="nm">' + esc(o.name) + '<small>' + o.W + '×' + o.H + ' px · ' + mb(o.bytes || 0) + ' · ' + (inf ? 'terpasang, ± ' + inf.mpp.toFixed(2).replace('.', ',') + ' m/piksel' : 'belum dikalibrasi') + '</small></div>' +
        '<div style="display:flex;gap:6px;width:100%;margin-bottom:4px"><button class="btn sm" data-cal="' + i + '">' + (o.cal ? 'Kalibrasi ulang' : 'Kalibrasi') + '</button>' + (o.cal ? '<button class="btn sm" data-tune="' + i + '">Setel</button>' : '') + '<button class="btn sm" data-clean="' + i + '">Bersihkan</button>' + (o.cal ? '<button class="btn sm" data-exp="' + i + '">Ekspor</button>' : '') + '<button class="btn sm danger" data-del="' + i + '">Hapus</button></div></div>';
    }).join('') : 'Belum ada.';
  }
  function calibrateOv(i) {
    var o = ovList()[i]; if (!o) return;
    closeSheet();
    var c = map ? map.getCenter() : null;
    if (!c && S.todayPts && S.todayPts.length) { var p = S.todayPts[S.todayPts.length - 1]; c = { lat: p.lat, lng: p.lng }; }
    HzOverlay.calibrate(o, {
      base: function (m) { return new (cachedLayerClass())(TILES.sat[0], { maxZoom: 19 }).addTo(m); },
      center: c ? [c.lat, c.lng] : null,
      toast: toast,
      locate: makeLocate,
      onSave: function (cal) { o.cal = cal; delete o.aff; o.on = true; saveSettings(); renderOv(); syncAllOverlays(); setTimeout(function () { tuneOv(i); }, 50); }
    });
  }
  function tuneOv(i) {
    var o = ovList()[i]; if (!o || !o.cal) return;
    closeSheet();
    var c = map ? map.getCenter() : null;
    HzOverlay.tune(o, {
      base: function (m) { return new (cachedLayerClass())(TILES.sat[0], { maxZoom: 19 }).addTo(m); },
      locate: makeLocate,
      extra: function (m) { mapData().then(function (d) { if (m._container) drawTrips(L.layerGroup().addTo(m), d.pts, d.trips, -1, false); }).catch(function () {}); },
      center: null,
      opacity: S.settings.ovlOp == null ? 0.8 : S.settings.ovlOp,
      onOpacity: function (v) { S.settings.ovlOp = v; saveSettings(); setOvOpacity(v); },
      toast: toast,
      onClean: function () { saveSettings(); renderOv(); syncAllOverlays(); },
      onSave: function (af) { o.aff = af; saveSettings(); renderOv(); syncAllOverlays(); toast('Setelan lapisan disimpan'); }
    });
  }
  // pindahkan kalibrasi, setelan, dan kotak hapus/pangkas dari peta lama ke hasil impor baru (skala piksel berbeda)
  function carryOver(o, n) {
    var k = n.W / o.W;
    if (!(k > 0) || Math.abs(n.H / o.H - k) > 0.02 * k) return false;
    function sc(r) { return r.poly ? { poly: r.poly.map(function (p) { return [Math.round(p[0] * k), Math.round(p[1] * k)]; }) } : { x0: Math.round(r.x0 * k), y0: Math.round(r.y0 * k), x1: Math.round(r.x1 * k), y1: Math.round(r.y1 * k) }; }
    if (o.cal) n.cal = o.cal.map(function (c) { var d = Object.assign({}, c); d.u = c.u * k; d.v = c.v * k; return d; });
    if (o.aff) n.aff = { A: o.aff.A / k, B: o.aff.B / k, C: o.aff.C, D: o.aff.D / k, E: o.aff.E / k, F: o.aff.F };
    if (o.edit) {
      var e = Object.assign({}, o.edit);
      e.crop = o.edit.crop ? (o.edit.crop.mask ? o.edit.crop : sc(o.edit.crop)) : null; e.erase = (o.edit.erase || []).map(sc);
      e.keyBg = false; e.solid = false;
      n.edit = e;
    }
    n.on = o.on; return true;
  }
  function importOv(file) {
    var nm = file.name.replace(/\.pdf$/i, '');
    var inp = 'width:100%;height:44px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--tx);padding:0 12px;font-size:max(11px,calc(16px * var(--fs,1)))';
    openSheet('<div class="grab"></div><div class="st">MEMBACA PDF…</div><div class="muted">' + esc(file.name) + ' (' + mb(file.size) + ')</div>');
    HzOverlay.openPdf(file).then(function (h) {
      var hidden = {};
      h.layers.forEach(function (l) { if (!l.on) hidden[l.id] = true; });
      var lay = h.layers.length ? '<label class="lbl" style="margin-top:10px">Layer PDF (hilangkan centang untuk menyembunyikan)</label><div class="lylist" id="ovLy">' +
        h.layers.map(function (l) { return '<label><input type="checkbox" data-ly="' + esc(l.id) + '"' + (l.on ? ' checked' : '') + '> ' + esc(l.name) + '</label>'; }).join('') + '</div>' : '<div class="muted" style="margin-top:8px">PDF ini tidak punya layer. Bagian yang tidak diinginkan bisa dibuang di langkah Bersihkan.</div>';
      openSheet('<div class="grab"></div><div class="st">TAMBAH PETA</div>' +
        '<div class="muted" style="margin-bottom:6px">Berkas: ' + esc(file.name) + ' (' + mb(file.size) + ')</div>' +
        '<canvas id="ovPrev" class="ovprev"></canvas><button class="btn sm" id="ovZoom" style="margin-top:6px;width:100%">Perbesar dan periksa gambar</button>' +
        '<label class="lbl" style="margin-top:8px">Nama</label><input id="ovName" value="' + esc(nm) + '" style="' + inp + '">' +
        '<div class="pgrid" style="margin-top:10px"><div><label class="lbl">Halaman (1–' + h.numPages + ')</label><input id="ovPage" type="number" min="1" max="' + h.numPages + '" value="1" style="' + inp + '"></div>' +
        '<div><label class="lbl">Ketajaman</label><select id="ovRes" style="' + inp + ';padding:0 8px"><option value="5000">Ringan (5000 px)</option><option value="7000">Sedang (7000 px)</option><option value="9000" selected>Tajam (9000 px)</option></select></div></div>' +
        (ovList().length ? '<label class="lbl" style="margin-top:10px">Gantikan peta lama (kalibrasi dan editan dipindahkan)</label><select id="ovRep" style="' + inp + ';padding:0 8px"><option value="-1">Tidak, tambah sebagai peta baru</option>' + ovList().map(function (o, k) { return '<option value="' + k + '">' + esc(o.name) + '</option>'; }).join('') + '</select>' : '') +
        lay +
        '<div class="muted" style="margin-top:8px">Makin tajam, makin lama diproses dan makin besar di ponsel. 9000 px sudah cukup tajam untuk zoom dekat; di atas itu tidak banyak berpengaruh. Setelah dikalibrasi, ukuran m/piksel tampil di daftar peta.</div>' +
        '<div class="row" style="margin-top:14px;gap:8px"><button class="btn" id="ovNo" style="flex:1">Batal</button><button class="btn pri" id="ovGo" style="flex:1">Proses</button></div>');
      var tm = null;
      function prev() { clearTimeout(tm); tm = setTimeout(function () { var c = $('ovPrev'); if (c) h.preview(c, +$('ovPage').value || 1, hidden, 700).catch(function () {}); }, 150); }
      prev();
      var zv = null;
      $('ovZoom').onclick = function () { if (zv) zv.close(); h.viewer(+$('ovPage').value || 1, hidden, 'Periksa gambar').then(function (v) { zv = v; }).catch(function () { toast('Gagal membuka penampil'); }); };
      $('ovPage').onchange = prev;
      var ly = $('ovLy');
      if (ly) ly.onchange = function (e) { var id = e.target.getAttribute('data-ly'); if (id === null) return; if (e.target.checked) delete hidden[id]; else hidden[id] = true; prev(); };
      $('ovNo').onclick = function () { h.close(); closeSheet(); };
      $('ovGo').onclick = function () {
        if (zv) { zv.close(); zv = null; }
        var name = $('ovName').value.trim() || nm, page = +$('ovPage').value || 1, ls = +$('ovRes').value, repIdx = $('ovRep') ? +$('ovRep').value : -1, repO = repIdx >= 0 ? ovList()[repIdx] : null;
        openSheet('<div class="grab"></div><div class="st">MEMPROSES PDF…</div><div class="muted" id="ovMsg">Jangan tutup aplikasi sampai selesai.</div><div class="ovbar"><div id="ovBar"></div></div>');
        h.run({ name: name, page: page, longSide: ls, hidden: hidden }, function (f) { var b = $('ovBar'); if (b) b.style.width = Math.round(f * 100) + '%'; }).then(function (meta) {
          h.close();
          if (repO && carryOver(repO, meta)) {
            var ix = ovList().indexOf(repO);
            if (ix >= 0) ovList()[ix] = meta; else ovList().push(meta);
            HzOverlay.delOverlay(repO.id);
            saveSettings(); renderOv(); syncAllOverlays(); closeSheet();
            toast('Peta diganti. Kalibrasi dan editan dipindahkan, mohon periksa hasilnya');
            return;
          }
          if (repO) toast('Ukuran halaman berbeda: kalibrasi tidak bisa dipindahkan');
          ovList().push(meta); saveSettings(); renderOv();
          var i = ovList().length - 1;
          closeSheet();
          toast('Langkah 1: bersihkan gambar (boleh langsung Selesai)');
          cleanOv(i, function () { calibrateOv(i); });
        }).catch(function (e) {
          h.close();
          openSheet('<div class="grab"></div><div class="st">GAGAL</div><div class="muted">' + esc(e && e.message || e) + '</div><button class="btn" id="ovNo2" style="margin-top:12px;width:100%">Tutup</button>');
          $('ovNo2').onclick = closeSheet;
        });
      };
    }).catch(function (e) {
      openSheet('<div class="grab"></div><div class="st">GAGAL</div><div class="muted">' + esc(e && e.message || e) + '</div><button class="btn" id="ovNo2" style="margin-top:12px;width:100%">Tutup</button>');
      $('ovNo2').onclick = closeSheet;
    });
  }
  function exportOv(i) {
    var o = ovList()[i]; if (!o) return;
    toast('Menyiapkan peta "' + o.name + '"…');
    HzOverlay.exportOverlay(o).then(blobB64).then(function (b64) {
      return saveFile(o.name.replace(/[^\w\-]+/g, '_') + '.hzpeta', b64, 'application/octet-stream');
    }).catch(function (e) { toast('Ekspor gagal: ' + (e && e.message || e)); });
  }
  function importHz(files) {
    var i = 0, ok = 0, bad = [];
    (function nx() {
      if (i >= files.length) { renderOv(); syncAllOverlays(); toast(ok ? ok + ' peta diimpor, sudah terpasang di posisinya' + (bad.length ? ' · gagal: ' + bad.join(', ') : '') : 'Gagal: ' + bad.join('; ')); return; }
      var f = files[i++]; toast('Mengimpor ' + f.name + '…');
      HzOverlay.importOverlayFile(f).then(function (m) { ovList().push(m); saveSettings(); ok++; }, function (e) { bad.push(f.name + ' (' + (e && e.message || e) + ')'); }).then(nx);
    })();
  }
  function cleanOv(i, next) {
    var o = ovList()[i]; if (!o) return;
    closeSheet();
    HzOverlay.clean(o, { toast: toast, onChange: function () {}, onDone: function () { saveSettings(); renderOv(); syncAllOverlays(); if (next) next(); } });
  }
  function openOvSheet() {
    var l = ovList();
    var op = Math.round((S.settings.ovlOp == null ? 0.8 : S.settings.ovlOp) * 100);
    openSheet('<div class="grab"></div><div class="st">PETA SAYA</div>' + (S.settings.mapMode !== 'osm' ? '<div class="warn" style="margin-bottom:8px">Peta saya hanya tampil di mode <b>Peta</b>, bukan Satelit. Ganti mode di atas peta.</div>' : '') +
      (l.length ? l.map(function (o, i) {
        return '<div class="ovrow"><div class="nm">' + esc(o.name) + (o.cal ? '' : '<small>belum dikalibrasi (Pengaturan)</small>') + '</div>' +
          (o.cal ? '<button class="btn sm" data-tn="' + i + '">Setel</button><input type="checkbox" data-on="' + i + '"' + (o.on ? ' checked' : '') + '>' : '') + '</div>';
      }).join('') + '<div style="margin-top:10px;font-size:max(11px,calc(14px * var(--fs,1)));color:var(--tx3)">Transparansi: <span id="ovOpV">' + op + '</span>%</div><input type="range" id="ovOp" min="20" max="100" value="' + op + '" style="width:100%">'
        : '<div class="muted">Belum ada peta. Tambahkan PDF di Pengaturan, bagian PETA SAYA (PDF).</div>'));
    var sh = $('sheet');
    sh.onchange = function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-on'); if (k !== null && k !== undefined) { ovList()[+k].on = e.target.checked; saveSettings(); syncAllOverlays(); } };
    sh.onclick = function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-tn'); if (t !== null && t !== undefined) tuneOv(+t); };
    var r = $('ovOp'); if (r) r.oninput = function () { $('ovOpV').textContent = this.value; setOvOpacity(this.value / 100); };
    if (r) r.onchange = function () { saveSettings(); };
  }

  function showMap(ymd, sel) {
    S.mapDay = ymd; mapSel = sel === undefined ? -1 : sel; mapKeep = true; fitted = false;
    go('lintasan');
  }
  function openMap() {
    if (!mapKeep) { S.mapDay = S.today; mapSel = -1; fitted = false; }
    mapKeep = false;
    setTimeout(function () {
      if (!ensureMap()) { $('mapMsg').textContent = 'Peta tidak tersedia'; return; }
      map.invalidateSize();
      setTiles();
      locStart(map);
      renderMap(true);
    }, 60);
  }
  function mapData() {
    if (S.mapDay === S.today) {
      var res = T.detectTrips(S.todayPts, opts());
      return Promise.resolve({ pts: res.points, trips: edited(S.today, res).map(tripView) });
    }
    return loadDay(S.mapDay).then(function (d) { return { pts: d.pts, trips: d.trips }; });
  }
  function shiftMap(n) {
    var p = S.mapDay.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n), nd = T.ymd(d.getTime());
    if (nd > S.today) return;
    S.mapDay = nd; mapSel = -1; fitted = false; renderMap(true);
  }
  function renderMap(fit) {
    if (!map) return;
    var day = S.mapDay;
    $('mPick').value = day; $('mPick').max = S.today;
    $('mNext').style.opacity = day >= S.today ? '.3' : '1';
    $('mToday').style.visibility = day === S.today ? 'hidden' : 'visible';
    mapData().then(function (d) {
      if (day !== S.mapDay || S.view !== 'lintasan') return;
      var pts = d.pts, items = d.trips.map(function (x, i) { return { x: x, i: i }; });
      var nK = items.filter(function (o) { return o.x.label === 'Kerja'; }).length, nP = items.length - nK;
      if (mapKind === 'kerja' && !nK) mapKind = 'all';
      if (mapKind === 'pribadi' && !nP) mapKind = 'all';
      var list = items.filter(function (o) { return mapKind === 'all' || o.x.label === (mapKind === 'kerja' ? 'Kerja' : 'Pribadi'); });
      var trips = list.map(function (o) { return o.x; });
      if (mapSel >= trips.length) mapSel = -1;
      PB.cur = { pts: pts, trips: trips };
      S.mapCnt = { kerja: nK, pribadi: nP };
      var kl = { all: 'Semua · ' + items.length, kerja: 'Kerja · ' + nK, pribadi: 'Pribadi · ' + nP }[mapKind];
      $('mapChips').innerHTML = items.length > 1 ? '<button data-k="1" class="kind' + (mapSel < 0 ? ' on' : '') + '">' + kl + '</button>' + list.map(function (o, i) {
        return '<button data-i="' + i + '"' + (mapSel === i ? ' class="on"' : '') + '>' + (o.i + 1) + ' · ' + T.hm(o.x.t.start) + '</button>';
      }).join('') : '';
      trackLayer.clearLayers(); if (map._pinClear) map._pinClear();
      var bounds = drawTrips(trackLayer, pts, trips, mapSel, false);
      S.mapView = { pts: pts, trips: trips, sel: mapSel, day: day };
      if (S.profOpen) renderProfile();
      $('mapMsg').textContent = bounds.length ? '' : (day === S.today ? 'Belum ada lintasan hari ini. Lintasan muncul saat ada trip yang terekam.' : 'Tidak ada lintasan pada ' + T.dateLong(day) + '.');
      if (bounds.length && (fit || !fitted)) { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 }); fitted = true; }
      if (PB.open) { pbPlay(false); pbBuild(); if (!PB.seq.length) pbClose(); else pbDraw(false); }
    });
  }
  // ---------- SpidoMap: peta langsung di kiri Spidometer ----------
  var SP = { map: null, lay: null, mk: null, active: false, follow: true, zoomAuto: true, autoPaused: false, zoomBusy: false, hdAcc: 0, hdLL: null, cur: null, from: null, to: null, t0: 0, raf: 0, lastTs: 0, hudT: 0, band: -1, pendBand: -1, pendT: 0, mv: 0, lastSeg: null, rec: null, wl: null };
  function spIdx() { var p = $('spPager'); return p && p.scrollLeft > p.clientWidth / 2 ? 1 : 0; }
  function spShow(which) { var p = $('spPager'); p.scrollTo({ left: which === 'map' ? p.clientWidth : 0, behavior: 'smooth' }); }
  function spResetMain() { var p = $('spPager'); if (p) { p.scrollLeft = 0; $('spMain').scrollTop = 0; } }
  function spBtns() {
    $('spFol').textContent = 'Ikuti: ' + (SP.follow ? 'ya' : 'tidak'); $('spFol').classList.toggle('on', SP.follow);
    $('spZoom').textContent = 'Zoom otomatis: ' + (SP.zoomAuto ? 'ya' : 'tidak'); $('spZoom').classList.toggle('on', SP.zoomAuto);
    var aw = !!S.settings.spAwake;
    $('spAwake').textContent = 'Layar menyala: ' + (aw ? 'ya' : 'tidak'); $('spAwake').classList.toggle('on', aw);
  }
  function spAwake(on) {
    var want = on && SP.active && !!S.settings.spAwake;
    try { Plug.keepScreen({ on: want }).catch(function () {}); } catch (e) {}
    if (navigator.wakeLock && !native) {
      if (want && !SP.wl) navigator.wakeLock.request('screen').then(function (l) { SP.wl = l; }).catch(function () {});
      else if (!want && SP.wl) { try { SP.wl.release(); } catch (e) {} SP.wl = null; }
    }
  }
  function spEnsureMap() {
    if (SP.map) return true;
    if (!window.L) return false;
    SP.map = L.map('spMap', { zoomControl: false, preferCanvas: true, attributionControl: true }).setView([-4.95, 105.2], 17);
    setBase(SP.map, 'sat');
    zoomInd(SP.map);
    if (window.HzBatas) SP.bat = HzBatas.attach(SP.map, function () { var c = batCfg(); c.osm = false; return c; }, toast);
    SP.lay = L.layerGroup().addTo(SP.map);
    SP.map.on('dragstart', function () { if (SP.follow) { SP.follow = false; spBtns(); } });
    SP.map.on('zoomstart', function () { if (!SP.zoomBusy && !SP.autoPaused) { SP.autoPaused = true; } });
    SP.map.on('zoomend', function () { SP.zoomBusy = false; });
    return true;
  }
  function spArrow(ll) {
    if (!SP.mk) {
      SP.mk = L.marker(ll, { icon: L.divIcon({ className: 'spar', html: '<svg viewBox="0 0 24 24" width="38" height="38"><path d="M12 1.5L21.5 22 12 17 2.5 22Z" fill="#8A97A0" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>', iconSize: [38, 38], iconAnchor: [19, 19] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(SP.map);
    } else SP.mk.setLatLng(ll);
    var el = SP.mk.getElement && SP.mk.getElement();
    if (el && el.firstChild) {
      el.firstChild.style.transform = 'rotate(' + SP.hdAcc + 'deg)';
      var p = el.querySelector('path'), col = S.mode === 'rekam' ? '#2F80FF' : '#8A97A0';
      if (p && p.getAttribute('fill') !== col) p.setAttribute('fill', col);
    }
  }
  function spHeading(a, b) {
    var dy = (b[0] - a[0]) * 111320, dx = (b[1] - a[1]) * 111320 * Math.cos(a[0] * Math.PI / 180);
    if (dx * dx + dy * dy < 16) return false;
    var deg = Math.atan2(dx, dy) * 180 / Math.PI, d = ((deg - SP.hdAcc + 540) % 360 + 360) % 360 - 180;
    SP.hdAcc += d; return true;
  }
  function spRebuild() {
    if (!SP.map) return;
    SP.lay.clearLayers(); SP.lastSeg = null;
    var pts = S.todayPts || [], res = T.detectTrips(pts, opts()), rec = S.mode === 'rekam', trips = res.trips, curT = rec && trips.length ? trips[trips.length - 1] : null;
    trips.forEach(function (t) {
      var tk = E.trackOf(res.points, t);
      tk.runs.forEach(function (r) {
        var ll = r.pts.map(function (p) { return [p.lat, p.lng]; });
        if (t === curT) L.polyline(ll, { color: COL[r.z], weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(SP.lay);
        else L.polyline(ll, { color: '#9AA3A8', weight: 4, opacity: 0.55, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(SP.lay);
      });
      if (t === curT) L.circleMarker([t.startLat, t.startLng], { radius: 7, color: '#fff', weight: 2, fillColor: '#3FD07A', fillOpacity: 1, interactive: false }).addTo(SP.lay);
    });
    var last = pts.length ? pts[pts.length - 1] : null;
    if (last) {
      var ll2 = [last.lat, last.lng];
      SP.cur = SP.cur || ll2; SP.from = SP.to = ll2; SP.lastSeg = ll2;
      if (pts.length > 1) { var pv = pts[pts.length - 2]; spHeading([pv.lat, pv.lng], ll2); }
      SP.cur = ll2; spArrow(ll2);
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
    if (SP.lastSeg) {
      L.polyline([SP.lastSeg, ll], { color: pbZone(f.v * 3.6), weight: 6, opacity: 0.95, lineCap: 'round', interactive: false }).addTo(SP.lay);
      if (f.v * 3.6 >= 5) spHeading(SP.lastSeg, ll);
    }
    SP.lastSeg = ll; SP.from = SP.cur || ll; SP.to = ll; SP.t0 = performance.now();
  }
  function spLoop(ts) {
    if (!SP.active) return;
    var dt = SP.lastTs ? Math.min(100, ts - SP.lastTs) : 16; SP.lastTs = ts;
    var rec = S.mode === 'rekam';
    if (SP.to && SP.from) {
      var f = Math.min(1, (ts - SP.t0) / 1000);
      SP.cur = [SP.from[0] + (SP.to[0] - SP.from[0]) * f, SP.from[1] + (SP.to[1] - SP.from[1]) * f];
      spArrow(SP.cur);
      if (rec && SP.follow) {
        var off = SP.map.latLngToContainerPoint(SP.cur).subtract(SP.map.getSize().divideBy(2));
        if (Math.abs(off.x) > SP.map.getSize().x || Math.abs(off.y) > SP.map.getSize().y) SP.map.setView(SP.cur, SP.map.getZoom(), { animate: false });
        else {
          SP.map._rawPanBy(off.multiplyBy(1 - Math.exp(-dt / 220))); SP.map.fire('move');
          SP.mv += dt; if (SP.mv > 400) { SP.mv = 0; SP.map.fire('moveend'); }
        }
      }
    }
    if (ts - SP.hudT > 250) {
      SP.hudT = ts;
      var fresh = rec && S.live.t && (Date.now() - S.live.t) < 5000, v = fresh ? S.live.v : 0;
      $('spSpd').textContent = fresh ? String(Math.round(v)) : '–';
      $('spSpd').style.color = fresh ? zc(v) : '';
      if (rec && SP.follow && SP.zoomAuto && !SP.autoPaused && fresh) {
        var band = v < 20 ? 18 : (v < 50 ? 17 : (v < 80 ? 16 : 15));
        if (band !== SP.map.getZoom()) {
          if (band !== SP.pendBand) { SP.pendBand = band; SP.pendT = ts; }
          else if (ts - SP.pendT >= 5000) { SP.zoomBusy = true; SP.map.setZoom(band, { animate: true }); SP.pendBand = -1; }
        } else SP.pendBand = -1;
      }
      // arah: GPS bila >= 5 km/j, kompas ponsel bila lebih pelan
      var gpsDrive = rec && fresh && v >= 5;
      if (!gpsDrive && SP.compT && Date.now() - SP.compT < 2000) {
        var dd = ((SP.comp - SP.hdAcc) % 360 + 540) % 360 - 180;
        if (Math.abs(dd) > 3) { SP.hdAcc += dd * 0.5; spArrow(SP.cur || (SP.mk && SP.mk.getLatLng())); }
      }
      spNote();
    }
    SP.raf = requestAnimationFrame(spLoop);
  }
  function spSetActive(on) {
    if (on === SP.active) return;
    SP.active = on;
    $('spD0').classList.toggle('on', on); $('spD1').classList.toggle('on', !on);
    if (on) {
      if (!spEnsureMap()) { $('spNote').style.display = 'block'; $('spNote').textContent = 'Peta tidak tersedia'; SP.active = false; return; }
      spBtns();
      setTimeout(function () { if (!SP.active) return; SP.map.invalidateSize(); spRebuild(); if (SP.cur) SP.map.setView(SP.cur, S.mode === 'rekam' ? 17 : 17, { animate: false }); }, 60);
      SP.lastTs = 0; SP.raf = requestAnimationFrame(spLoop);
      spAwake(true); spCompassOn(true);
    } else {
      cancelAnimationFrame(SP.raf); spAwake(false); spCompassOn(false);
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
    SP.comp = h; SP.compT = Date.now();
  }
  function spCompassOn(on) {
    window.removeEventListener('deviceorientationabsolute', spCompass, true);
    window.removeEventListener('deviceorientation', spCompass, true);
    if (!on) return;
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', spCompass, true);
    else window.addEventListener('deviceorientation', spCompass, true);
  }
  function spLocate() {
    SP.follow = true; SP.autoPaused = false; spBtns();
    if (S.mode === 'rekam' && SP.cur) { SP.map.setView(SP.cur, SP.map.getZoom(), { animate: true }); return; }
    if (!navigator.geolocation) { toast('Lokasi tidak tersedia'); return; }
    toast('Mencari posisi…');
    navigator.geolocation.getCurrentPosition(function (p) {
      var ll = [p.coords.latitude, p.coords.longitude];
      SP.from = SP.to = SP.cur = ll; spArrow(ll); SP.map.setView(ll, 17, { animate: true });
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
    $('spFol').onclick = function () { SP.follow = !SP.follow; if (SP.follow && SP.cur) SP.map.setView(SP.cur, SP.map.getZoom(), { animate: true }); spBtns(); };
    $('spZoom').onclick = function () { SP.zoomAuto = !SP.zoomAuto; if (SP.zoomAuto) SP.autoPaused = false; spBtns(); };
    $('spAwake').onclick = function () { S.settings.spAwake = !S.settings.spAwake; saveSettings(); spBtns(); spAwake(true); };
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (SP.active) { SP.active = false; cancelAnimationFrame(SP.raf); spAwake(false); spCompassOn(false); SP.resume = true; } }
      else if (SP.resume) { SP.resume = false; spSetActive(S.view === 'spido' && spIdx() === 1); }
    });
    window.addEventListener('resize', function () { if (S.view === 'spido' && !SP.active) spResetMain(); });
    spResetMain();
  }

  // ---------- putar ulang lintasan ----------
  var PB = { open: false, seq: [], ax: [], pos: 0, len: 0, playing: false, mult: 10, follow: true, raf: 0, last: 0, mk: null, ring: null, cur: null };
  function pbZone(v) { return v < 60 ? COL.g : (v < 90 ? COL.y : COL.r); }
  function pbBuild() {
    var d = PB.cur, seq = [], ax = [], a = 0;
    PB.seq = seq; PB.ax = ax; PB.pos = 0; PB.len = 0;
    if (!d) return;
    var trips = mapSel >= 0 ? [d.trips[mapSel]] : d.trips;
    trips.forEach(function (x) {
      if (!x) return;
      d.pts.forEach(function (p) {
        if (p.t < x.t.start || p.t > x.t.end) return;
        if (seq.length) { var dt = p.t - seq[seq.length - 1].t; a += dt > 60000 ? 2000 : Math.max(0, dt); }
        seq.push(p); ax.push(a);
      });
    });
    PB.len = a;
  }
  function pbAt(pos) {
    var ax = PB.ax, seq = PB.seq, n = seq.length;
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
    var c = pbAt(PB.pos);
    if (!c) { $('pbSpd').textContent = '0'; $('pbClk').textContent = '--.--.--'; return; }
    var ll = [c.lat, c.lng], col = pbZone(c.v);
    if (c.h !== null) PB.hd = c.h;
    if (!PB.mk) {
      PB.mk = L.marker(ll, { icon: L.divIcon({ className: 'pbarrow', html: '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 1.5L21.5 22 12 17 2.5 22Z" fill="#2F80FF" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>', iconSize: [34, 34], iconAnchor: [17, 17] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
    } else PB.mk.setLatLng(ll);
    var el = PB.mk.getElement && PB.mk.getElement();
    if (el && el.firstChild) el.firstChild.style.transform = 'rotate(' + (PB.hd || 0) + 'deg)';
    if (pan && PB.follow) {
      var off = map.latLngToContainerPoint(ll).subtract(map.getSize().divideBy(2));
      if (PB.snap || Math.abs(off.x) > map.getSize().x || Math.abs(off.y) > map.getSize().y) { map.setView(ll, map.getZoom(), { animate: false }); PB.snap = false; }
      else {
        // geser tanpa pembulatan piksel supaya gerak peta mulus; moveend berkala agar kanvas dan ubin menyusul
        map._rawPanBy(off.multiplyBy(1 - Math.exp(-(dt || 16) / 220)));
        map.fire('move');
        PB.mv = (PB.mv || 0) + (dt || 16);
        if (PB.mv > 400) { PB.mv = 0; map.fire('moveend'); }
      }
    }
    $('pbSpd').textContent = String(Math.round(c.v));
    $('pbSpd').style.color = col;
    var d = new Date(c.t);
    $('pbClk').textContent = T.pad(d.getHours()) + '.' + T.pad(d.getMinutes()) + '.' + T.pad(d.getSeconds());
    $('pbSl').value = String(PB.len ? Math.round(PB.pos / PB.len * 1000) : 0);
  }
  function pbTick(ts) {
    if (!PB.playing) return;
    var dt = PB.last ? Math.min(100, ts - PB.last) : 16; PB.last = ts;
    PB.pos += dt * PB.mult;
    if (PB.pos >= PB.len) { PB.pos = PB.len; pbPlay(false); pbDraw(true, dt); return; }
    pbDraw(true, dt);
    PB.raf = requestAnimationFrame(pbTick);
  }
  function pbPlay(on) {
    PB.playing = on; PB.last = 0; cancelAnimationFrame(PB.raf);
    if (!on && map && PB.open) map.fire('moveend');
    $('pbPlay').innerHTML = on ? '❚❚' : '▶';
    if (on) { if (PB.pos >= PB.len) PB.pos = 0; PB.snap = PB.snap || PB.pos === 0; PB.raf = requestAnimationFrame(pbTick); }
  }
  function pbOpen() {
    if (!map) return;
    PB.open = true; $('pbBar').style.display = 'block'; $('pbHud').style.display = 'block'; $('mapPlay').style.display = 'none';
    pbBuild();
    if (!PB.seq.length) { toast('Belum ada lintasan untuk diputar'); pbClose(); return; }
    var ll = PB.seq.map(function (p) { return [p.lat, p.lng]; });
    PB.snap = true;
    setTimeout(function () { map.invalidateSize(); map.fitBounds(ll, { padding: [40, 40], maxZoom: 17 }); pbDraw(false); }, 80);
    pbSyncUi();
  }
  function pbClose() {
    PB.open = false; pbPlay(false);
    $('pbBar').style.display = 'none'; $('pbHud').style.display = 'none'; $('mapPlay').style.display = '';
    if (PB.mk && map) map.removeLayer(PB.mk);
    PB.mk = null; PB.hd = 0;
    if (map) setTimeout(function () { map.invalidateSize(); }, 50);
  }
  function pbSyncUi() {
    document.querySelectorAll('#pbMult button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-m') === PB.mult); });
    $('pbFol').classList.toggle('on', PB.follow);
    $('pbFol').textContent = PB.follow ? 'Ikuti: ya' : 'Ikuti: tidak';
  }
  function pbInit() {
    $('mapPlay').onclick = function () { pbOpen(); };
    $('pbX').onclick = pbClose;
    $('pbPlay').onclick = function () { pbPlay(!PB.playing); };
    $('pbSl').oninput = function () { PB.pos = PB.len * (+this.value) / 1000; PB.snap = true; pbDraw(true); };
    $('pbMult').onclick = function (e) { var m = e.target.getAttribute && e.target.getAttribute('data-m'); if (m) { PB.mult = +m; pbSyncUi(); } };
    $('pbFol').onclick = function () { PB.follow = !PB.follow; pbSyncUi(); };
  }
  function openMapMenu() {
    openSheet('<div class="grab"></div><div class="st">PETA</div>' +
      '<button class="srow" id="mmOv" style="margin-top:10px"><div class="si"><b>Peta saya</b><small>Lapisan PDF peta (tampil di mode Peta)</small></div>' + CHEV + '</button>' +
      '<button class="srow" id="mmKml"><div class="si"><b>Ekspor KML</b><small>Lintasan hari ini untuk Google Earth, dengan ketinggian</small></div>' + CHEV + '</button>' +
      '<label style="display:block;margin:6px 4px"><input type="checkbox" id="mmKc"' + (S.settings.kmlContour !== false ? ' checked' : '') + '> Sertakan kontur di KML</label>' +
      '<div class="h" style="margin-top:12px">JARAK KONTUR</div><div class="opts" id="mmCs">' + ['auto', '1', '2', '5', '10'].map(function (v) { return '<button class="opt' + ((S.settings.contourStep || 'auto') === v ? ' on' : '') + '" data-cs="' + v + '">' + (v === 'auto' ? 'Otomatis' : v + ' m') + '</button>'; }).join('') + '</div>' +
      '<div class="muted" style="margin-top:6px">Warna garis bergradasi: lembah merah muda pudar, makin tinggi makin abu lalu hijau muda. Otomatis: dengan data DEMNAS 10 m saat zoom jauh, 5 m menengah, 2 m dekat; tanpa DEMNAS (data gratis ±30 m) minimal 5 m.</div>' +
      '<button class="btn" id="mmX" style="width:100%;margin-top:10px">Tutup</button>');
    $('mmCs').onclick = function (e) { var v = e.target.getAttribute && e.target.getAttribute('data-cs'); if (!v) return; S.settings.contourStep = v; saveSettings(); document.querySelectorAll('#mmCs .opt').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-cs') === v); }); if (DM.layer) DM.layer.redraw(); };
    $('mmKc').onchange = function () { S.settings.kmlContour = this.checked; saveSettings(); };
    $('mmX').onclick = closeSheet;
    $('mmOv').onclick = function () { closeSheet(); openOvSheet(); };
    $('mmKml').onclick = function () { closeSheet(); mapKml(); };
  }
  // siapkan ketinggian + kontur untuk KML (butuh data ketinggian); selalu lanjut walau gagal
  function kmlPrep(ds, withC) {
    var opts = { title: 'HZ Trip ' + ds[0].ymd, ramp: window.HzDem && HzDem.rampColor, shapes: shapeItems() };
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

  // ---------- pasang ----------
  function init() {
    $('btnMenu').onclick = openDrawer;
    $('setMenu').onclick = function (e) { var b = e.target.closest ? e.target.closest('[data-sp]') : null; if (b) openSet(b.getAttribute('data-sp')); };
    document.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = backSet; });
    $('fontSeg').onclick = function (e) { var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (f) { S.settings.fs = f; saveSettings(); applyFont(); } };
    $('themeSeg').onclick = function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-t'); if (t) { S.settings.theme = t; saveSettings(); applyTheme(); } };
    pbInit();
    spInit();
    profInit();
    $('bkMake').onclick = function () { makeBackup(); };
    $('autoBkChk').onchange = function () { S.settings.autoBk = this.checked; saveSettings(); if (this.checked) autoBackup(); };
    $('thinSel').onchange = function () { S.settings.thinDays = +this.value; saveSettings(); renderThinInfo(); };
    $('thinGo').onclick = function () { startThin(); };
    $('diagShare').onclick = function () { var t = S.diagText || ''; if (!t) { toast('Belum ada catatan'); return; } saveFile('HZTrip-catatan-' + T.ymd(Date.now()) + '.txt', textB64(t), 'text/plain'); };
    $('diagClear').onclick = function () { askConfirm('Hapus catatan pemicu?', 'Semua baris catatan dihapus. Data perjalanan tidak terpengaruh.', 'Hapus', function () { Plug.clearDiag().then(renderDiag); }); };
    $('bkRestore').onclick = function () { $('bkFile').value = ''; $('bkFile').click(); };
    $('bkFile').onchange = function () { var f = this.files && this.files[0]; if (f) readBackup(f).then(restoreBackup).catch(function (e) { toast(e && e.message || 'Berkas tidak bisa dibaca'); }); };
    $('scrim').onclick = function () { closeSheet(); $('drawer').classList.remove('on'); };
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.onclick = function () { go(a.getAttribute('data-go')); }; });
    $('btnRec').onclick = toggleRec;
    $('modeBox').onclick = onModeAction;
    $('modeBtns').onclick = onModeAction;
    $('warnBox').onclick = onModeAction;
    $('mergeNo').onclick = function () { exitSel(); renderHistory(); };
    $('mergeGo').onclick = doMerge;
    $('toList').onclick = function () { exitSel(); S.hMode = 'list'; loadRiwayat(); $('main').scrollTop = 0; };
    $('monthView').onclick = function (e) { var b = e.target.closest ? e.target.closest('.mrow') : null; if (b) { exitSel(); S.hDay = b.getAttribute('data-d'); S.hMode = 'day'; loadRiwayat(); $('main').scrollTop = 0; } };
    $('dPrev').onclick = function () { shiftDay(-1); };
    $('dNext').onclick = function () { shiftDay(1); };
    $('dPick').onchange = function () { if (this.value && this.value <= T.ymd(Date.now())) { exitSel(); S.hDay = this.value; loadHistory(); } };
    (function () {
      var timer = null, sx = 0, sy = 0, fired = false;
      var tl = $('tripList');
      function cancel() { clearTimeout(timer); timer = null; }
      tl.addEventListener('pointerdown', function (e) {
        var b = e.target.closest ? e.target.closest('.trip') : null;
        fired = false; cancel();
        if (!b || S.sel || S.hTrips.length < 2) return;
        sx = e.clientX; sy = e.clientY;
        timer = setTimeout(function () {
          fired = true;
          S.sel = [+b.getAttribute('data-i')];
          try { if (navigator.vibrate) navigator.vibrate(30); } catch (er) {}
          renderHistory();
        }, 500);
      });
      tl.addEventListener('pointermove', function (e) { if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { tl.addEventListener(n, cancel); });
      tl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      tl.addEventListener('click', function (e) {
        if (fired) { fired = false; return; }
        var pm = e.target.closest ? e.target.closest('.pmap') : null;
        if (pm) { e.stopPropagation(); var pi = +pm.getAttribute('data-pm'); if (S.mini && S.mini.i === pi) closeMini(); else openMini(pi); return; }
        var b = e.target.closest ? e.target.closest('.trip') : null;
        if (!b) return;
        var ii = +b.getAttribute('data-i');
        if (S.sel) toggleSel(ii); else openTrip(ii);
      });
    })();
    $('unitAdd').onclick = addUnit;
    $('unitSel').onchange = function () { setUnit(this.value); renderUnitCard(); toast('Unit dipakai: ' + this.value); };
    $('unitBox').onclick = function (e) {
      var d = e.target.getAttribute('data-type'), x = e.target.getAttribute('data-del');
      if (d !== null) { var un = S.settings.units[+d]; S.settings.unitType[un] = typeOf(un) === 'Kerja' ? 'Pribadi' : 'Kerja'; saveSettings(); renderSettings(); }
      if (x !== null) {
        var u = S.settings.units[+x];
        askConfirm('Hapus unit ' + u + '?', 'Trip lama tetap tersimpan dengan nama unit ini.' + (unitAt(Date.now()) === u ? ' Unit ini sedang dipakai; unit aktif akan pindah ke unit lain di daftar.' : ''), 'Hapus', function () {
          S.settings.units.splice(S.settings.units.indexOf(u), 1);
          fixSlotsAfterDelete(u);
          delete S.settings.unitType[u];
          saveSettings(); renderSettings();
        });
      }
    };
    $('splitSel').onchange = function () { S.settings.splitSec = +this.value; saveSettings(); recomputeLive(); toast('Batas pisah trip disimpan'); };
    $('autoChk').onchange = function () { S.settings.auto = this.checked; saveSettings(); pushSchedule(); if (this.checked && native && !S.actPerm) askActivity(); };
    $('btnAct').onclick = askActivity;
    $('popSel').onchange = function () { S.popSnd = this.value; Plug.setPopupSound({ mode: this.value }).catch(function () {}); };
    $('btnPopPick').onclick = function () { Plug.pickPopupSound().then(function (r) { if (r && r.changed) { S.popName = r.name || 'Nada pilihan'; renderSpido(); toast('Nada popup disimpan'); } }).catch(function () { toast('Pemilih nada tidak bisa dibuka'); }); };
    $('btnPopTest').onclick = function () { Plug.testPopupSound().catch(function () {}); };
    $('btnPopDef').onclick = function () { Plug.clearPopupSound().then(function () { S.popName = ''; renderSpido(); toast('Kembali ke nada bawaan'); }).catch(function () {}); };
    $('btnOver').onclick = function () { Plug.openOverlaySettings().catch(function () { toast('Tidak bisa membuka pengaturan'); }); };
    $('marginSel').onchange = function () { S.settings.margin = +this.value; saveSettings(); renderSched(); pushSchedule(); };
    $('schedBox').onchange = onSched;
    $('schedBox').onclick = function (e) {
      var tg = e.target.closest ? e.target.closest('[data-tog]') : null;
      if (tg) { var dd = +tg.getAttribute('data-tog'); openDay = (openDay === dd) ? -1 : dd; renderSched(); return; }
      var c = e.target.getAttribute && e.target.getAttribute('data-clear');
      if (c !== null && c !== undefined) {
        var x = S.settings.schedule.days[+c];
        askConfirm('Jadikan ' + HARI[+c] + ' libur?', 'Jam masuk dan pulang hari ini dikosongkan. Semua trip hari itu dianggap Pribadi.', 'Jadikan libur', function () { x['in'] = ''; x.out = ''; saveSettings(); pushSchedule(); var sc = $('main').scrollTop; renderSched(); $('main').scrollTop = sc; });
      }
    };
    $('btnBatt').onclick = openBatt;
    $('btnBg').onclick = askBackground;
    $('btnPrint').onclick = function () { openPrint({ day: S.hMode === 'list' ? T.ymd(Date.now()) : S.hDay }); };
    document.querySelectorAll('#drawer a[data-print]').forEach(function (a) { a.onclick = function () { closeDrawer(); openPrint({ day: S.hDay }); }; });
    $('mapSeg').onclick = function (e) { var m = e.target.getAttribute && e.target.getAttribute('data-map'); if (m) { S.settings.mapMode = m; saveSettings(); setTiles(); if (mini) { setBase(mini); syncOverlays(mini); } } };
    $('mapChips').onclick = function (e) {
      var t = e.target; if (!t.getAttribute) return;
      if (t.getAttribute('data-k')) {
        var nxt = { all: 'kerja', kerja: 'pribadi', pribadi: 'all' };
        mapKind = nxt[mapKind]; if (!(S.mapCnt && S.mapCnt[mapKind]) && mapKind !== 'all') mapKind = nxt[mapKind]; if (!(S.mapCnt && S.mapCnt[mapKind]) && mapKind !== 'all') mapKind = 'all';
        mapSel = -1; PB.cur = null;
        // lewati mode yang tidak punya trip (renderMap mengembalikan ke 'all' bila kosong)
        renderMap(true); return;
      }
      var i = t.getAttribute('data-i'); if (i !== null && i !== undefined) { mapSel = +i; renderMap(true); }
    };
    $('mapMenu').onclick = openMapMenu;
    $('mPrev').onclick = function () { shiftMap(-1); };
    $('mNext').onclick = function () { shiftMap(1); };
    $('mToday').onclick = function () { S.mapDay = S.today; mapSel = -1; fitted = false; renderMap(true); };
    $('mPick').onchange = function () { if (this.value && this.value <= S.today) { S.mapDay = this.value; mapSel = -1; fitted = false; renderMap(true); } };
    $('toMap').onclick = function () { showMap(S.hDay, -1); };
    $('hidList').onclick = onHidden;
    $('miniX').onclick = function () { closeMini(); };
    $('dpTabs').onclick = function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-tab'); if (t) { S.dpTab = t; renderData(); } };
    $('ovGo').onclick = function () { S.dpTab = 'pdf'; go('data'); };
    $('ovAdd').onclick = function () { $('ovFile').value = ''; $('ovFile').click(); };
    $('ovFile').onchange = function () { if (this.files && this.files[0]) importOv(this.files[0]); };
    $('ovImp').onclick = function () { $('ovHz').value = ''; $('ovHz').click(); };
    $('ovHz').onchange = function () { importHz(Array.prototype.slice.call(this.files || [])); };
    $('ovList').onclick = function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-cal'), d = e.target.getAttribute && e.target.getAttribute('data-del');
      var cl = e.target.getAttribute && e.target.getAttribute('data-clean'), ex = e.target.getAttribute && e.target.getAttribute('data-exp');
      if (ex !== null && ex !== undefined) { exportOv(+ex); return; }
      if (cl !== null && cl !== undefined) cleanOv(+cl);
      var tu = e.target.getAttribute && e.target.getAttribute('data-tune');
      if (tu !== null && tu !== undefined) tuneOv(+tu);
      if (c !== null && c !== undefined) calibrateOv(+c);
      if (d !== null && d !== undefined) {
        var o = ovList()[+d];
        askConfirm('Hapus peta "' + o.name + '"?', 'Gambar peta ini dihapus dari ponsel. File PDF asli Anda tidak terpengaruh.', 'Hapus', function () {
          HzOverlay.delOverlay(o.id).then(function () { ovList().splice(+d, 1); saveSettings(); renderOv(); syncAllOverlays(); });
        });
      }
    };
    $('demAdd').onclick = function () { $('demFile').value = ''; $('demFile').click(); };
    $('demFile').onchange = function () { demImport($('demFile').files); };
    $('demDel').onclick = function () { askConfirm('Hapus data ketinggian?', 'Data DEMNAS di ponsel dihapus. Berkas .tif asli Anda tidak terpengaruh dan bisa diimpor lagi.', 'Hapus', function () { HzDem.clearLocal().then(function () { demAfter(); toast('Data ketinggian dihapus'); }); }); };
    $('satNat').onclick = function (e) {
      var v = e.target.getAttribute && e.target.getAttribute('data-sn'); if (!v) return;
      S.settings.satNative = +v; saveSettings(); renderSatNat(); setTiles(); if (SP.map) setBase(SP.map, 'sat');
    };
    $('tcClear').onclick = function () { askConfirm('Bersihkan cache peta?', 'Peta yang tersimpan dihapus. Peta akan diunduh lagi saat Anda melihatnya dengan internet.', 'Bersihkan', function () { TC.clear().then(function () { renderCacheInfo(); toast('Cache peta dibersihkan'); }); }); };
    $('radiusSel').onchange = function () { S.settings.radius = +this.value; saveSettings(); pushSchedule(); };
    $('driverIn').onchange = function () { S.settings.driver = this.value.trim(); saveSettings(); };

    Plug.addListener('fix', onFix);
    Plug.addListener('state', applyStatus);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { syncStatus(); refreshToday().then(renderSpido); if (S.view === 'riwayat') loadRiwayat(); purgeExpired(); autoBackup(); }
    });
    var tick = 0;
    setInterval(function () {
      tick++;
      if (S.view === 'spido' && !document.hidden) { renderSpido(); if (tick % 20 === 0) renderUnitCard(); }
      if (S.view === 'lintasan' && !document.hidden && S.mode === 'rekam' && S.mapDay === S.today && tick % 15 === 0) renderMap(false);
    }, 1000);
    setInterval(function () { if (!document.hidden) syncStatus(); }, 20000);

    loadMeta().then(function () {
      renderSettings();
      return Promise.all([syncStatus(), refreshToday()]);
    }).then(function () { pushSchedule(); renderSpido(); purgeExpired(); setTimeout(autoBackup, 6000); });
    renderSpido();
  }
  init();
})();
