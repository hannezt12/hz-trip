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
    function st() { return { mode: mode, recording: mode === 'rekam', manual: mode === 'rekam', permission: true, background: false, batteryFree: false, auto: sched.auto, paused: false, winEnd: 0, nextStart: Date.now() + 8 * 3600000, count: sec, lastT: Date.now(), lastV: 0, lastAcc: 6, gpsOn: mode === 'rekam', sigSensor: true, actPerm: true, notif: notif, overlay: true }; }
    function emit(n, o) { (L[n] || []).forEach(function (f) { f(o); }); }
    return {
      addListener: function (n, f) { (L[n] = L[n] || []).push(f); return Promise.resolve({ remove: function () {} }); },
      ensurePermissions: function () { return Promise.resolve({ granted: true }); },
      ensureBackground: function () { return Promise.resolve(st()); },
      ensureActivity: function () { return Promise.resolve(st()); },
      openOverlaySettings: function () { return Promise.resolve(); },
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
      applyTheme();
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
    S.notif = !!s.notif; S.overlay = s.overlay !== false; S.actPerm = s.actPerm !== false; S.gpsOn = !!s.gpsOn; S.sigSensor = s.sigSensor !== false; S.lastT = s.lastT || 0;
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
  var TITLES = { spido: 'SPIDOMETER', lintasan: 'LINTASAN', riwayat: 'RIWAYAT', set: 'PENGATURAN' };
  function go(v) {
    S.view = v;
    ['spido', 'lintasan', 'riwayat', 'set'].forEach(function (n) { $('v-' + n).classList.toggle('on', n === v); });
    $('main').classList.toggle('map', v === 'lintasan');
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
  function edited(ymd, res) { return visible(ymd, T.applyEdits(res, S.ov.days[ymd])); }
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
      return { ymd: ymd, n: tr.length, km: km, max: mx, avg: ds ? ws / ds : 0 };
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
        '<div class="t2"><div><small>DURASI</small><b style="font-size:18px">' + T.durText(t.durSec) + '</b></div><div><small>MIN</small><b>' + Math.round(t.min) + '</b></div><div><small>MAKS</small><b style="color:' + zc(t.max) + '">' + Math.round(t.max) + '</b></div><div><small>KM</small><b>' + T.km1(t.km) + '</b></div></div></button>';
    }).join('');
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
      return '<div class="hrow"><span>' + esc(T.dateLong(h.day)) + '<br>' + T.hm(h.start) + ' – ' + T.hm(h.end) + ' · ' + T.km1(h.km || 0) + ' km · ' + esc(h.unit || '') + '<br>Dihapus permanen dalam ' + left + ' hari</span>' +
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
      '<label><input type="checkbox" id="pCol" checked> Warnai kecepatan maks (kuning dan merah)</label></div>' +
      '<div class="muted" id="pInfo" style="margin-top:10px">Menghitung…</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn pri" id="pPdf" style="flex:1.3;height:52px">PDF</button><button class="btn" id="pKml" style="flex:1;height:52px">KML</button></div>' +
      '<button class="btn" id="pClose" style="width:100%;margin-top:8px">Tutup</button>');
    $('pClose').onclick = closeSheet;
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
        return saveFile(base + '.kml', textB64(E.buildKml(ds, { title: 'HZ Trip ' + ds[0].ymd })), 'application/vnd.google-earth.kml+xml');
      }
      if (!window.jspdf) { toast('Library PDF belum siap'); return; }
      var doc = E.buildPdf(ds, { driver: S.settings.driver, scope: P.scope, summary: P.summary, color: P.color, month: P.month });
      return saveFile(base + '.pdf', doc.output('datauristring').split(',')[1], 'application/pdf');
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
  function renderCacheInfo() {
    if (!$('tcInfo')) return;
    TC.stats().then(function (s) { $('tcInfo').textContent = 'Cache peta: ' + (s.bytes / 1048576).toFixed(1).replace('.', ',') + ' MB · ' + s.n + ' kotak peta'; });
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
    { k: 'tentang', t: 'Tentang', s: function () { return 'Versi 0.6.3'; } }
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
    if (key === 'tampil') applyTheme();
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
      $('bkInfo').innerHTML = (S.settings.lastBackup ? 'Terakhir dibuat: <b>' + dtText(S.settings.lastBackup) + '</b> (' + bkAge() + ' hari lalu)' : 'Belum pernah membuat cadangan.') + '<br>Data di ponsel: ' + n + ' hari rekaman.' + (S.settings.lastAuto ? '<br>Cadangan otomatis terakhir: <b>' + dtText(S.settings.lastAuto) + '</b> (' + (S.settings.autoDir === 'EXTERNAL' ? 'folder data aplikasi' : 'Dokumen/HZTrip/cadangan') + ')' : '');
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
  function pruneAuto(dir) {
    var P = window.Capacitor.Plugins;
    P.Filesystem.readdir({ path: 'HZTrip/cadangan', directory: dir }).then(function (r) {
      var fs = (r.files || []).map(function (f) { return f.name || f; }).filter(function (n) { return /^HZTrip-auto-.*\.hztrip$/.test(n); }).sort();
      fs.slice(0, Math.max(0, fs.length - 4)).forEach(function (n) { P.Filesystem.deleteFile({ path: 'HZTrip/cadangan/' + n, directory: dir }).catch(function () {}); });
    }).catch(function () {});
  }
  // Cadangan otomatis mingguan ke folder Dokumen/HZTrip/cadangan (4 berkas terakhir disimpan)
  function autoBackup() {
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (!native || !P || !P.Filesystem || S.settings.autoBk === false || autoBusy || bkBusy) return Promise.resolve();
    if (Date.now() - (S.settings.lastAuto || 0) < 7 * 86400000) return Promise.resolve();
    autoBusy = true;
    return buildBackup().then(function (b64) {
      var path = 'HZTrip/cadangan/HZTrip-auto-' + T.ymd(Date.now()) + '.hztrip';
      function put(dir) { return P.Filesystem.writeFile({ path: path, data: b64, directory: dir, recursive: true }).then(function () { return dir; }); }
      return put('DOCUMENTS').catch(function () { return put('EXTERNAL'); });
    }).then(function (dir) {
      S.settings.lastAuto = Date.now(); S.settings.autoDir = dir; saveSettings();
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
    setTiles();
    makeLocate(map);
    return true;
  }
  function setBase(m) {
    if (!m) return;
    if (m._base) { m.removeLayer(m._base); m._base = null; }
    var md = S.settings.mapMode === 'sat' ? 'sat' : 'osm';
    if (TILES[md]) m._base = new (cachedLayerClass())(TILES[md][0], { maxZoom: 19, attribution: TILES[md][1] }).addTo(m);
  }
  function setTiles() {
    if (!map) return;
    setBase(map);
    syncOverlays(map);
    document.querySelectorAll('#mapSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-map') === S.settings.mapMode); });
  }
  function gapText(g) { return 'Berhenti ' + T.hm(g.from) + '–' + T.hm(g.to) + ' (' + T.durText((g.to - g.from) / 1000) + ')'; }
  // Gambar trek ke satu peta. faint = trip lain pada hari itu digambar samar sebagai pembanding.
  function drawTrips(group, pts, trips, sel, faint) {
    var bounds = [];
    function dot(lat, lng, col, rad, tip) { L.circleMarker([lat, lng], { radius: rad, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }).bindTooltip(tip).addTo(group); }
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
        dot(la[0], la[1], COL.s, 6, gapText(g));
        dot(lb[0], lb[1], COL.s, 6, gapText(g));
      });
      dot(t.startLat, t.startLng, '#3FD07A', 7, 'Mulai ' + T.hm(t.start));
      dot(t.endLat, t.endLng, '#FF5B50', 7, 'Selesai ' + T.hm(t.end));
      dot(t.maxLat, t.maxLng, '#F5C518', 8, 'Tercepat ' + Math.round(t.max) + ' km/j (' + T.hm(t.maxT) + ')');
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
        '<div style="display:flex;gap:6px;width:100%;margin-bottom:4px"><button class="btn sm" data-cal="' + i + '">' + (o.cal ? 'Kalibrasi ulang' : 'Kalibrasi') + '</button>' + (o.cal ? '<button class="btn sm" data-tune="' + i + '">Setel</button>' : '') + '<button class="btn sm" data-clean="' + i + '">Bersihkan</button>' + '<button class="btn sm danger" data-del="' + i + '">Hapus</button></div></div>';
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
  function importOv(file) {
    var nm = file.name.replace(/\.pdf$/i, '');
    var inp = 'width:100%;height:44px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--tx);padding:0 12px;font-size:16px';
    openSheet('<div class="grab"></div><div class="st">MEMBACA PDF…</div><div class="muted">' + esc(file.name) + ' (' + mb(file.size) + ')</div>');
    HzOverlay.openPdf(file).then(function (h) {
      var hidden = {};
      h.layers.forEach(function (l) { if (!l.on) hidden[l.id] = true; });
      var lay = h.layers.length ? '<label class="lbl" style="margin-top:10px">Layer PDF (hilangkan centang untuk menyembunyikan)</label><div class="lylist" id="ovLy">' +
        h.layers.map(function (l) { return '<label><input type="checkbox" data-ly="' + esc(l.id) + '"' + (l.on ? ' checked' : '') + '> ' + esc(l.name) + '</label>'; }).join('') + '</div>' : '<div class="muted" style="margin-top:8px">PDF ini tidak punya layer. Bagian yang tidak diinginkan bisa dibuang di langkah Bersihkan.</div>';
      openSheet('<div class="grab"></div><div class="st">TAMBAH PETA</div>' +
        '<div class="muted" style="margin-bottom:6px">Berkas: ' + esc(file.name) + ' (' + mb(file.size) + ')</div>' +
        '<canvas id="ovPrev" class="ovprev"></canvas>' +
        '<label class="lbl" style="margin-top:8px">Nama</label><input id="ovName" value="' + esc(nm) + '" style="' + inp + '">' +
        '<div class="pgrid" style="margin-top:10px"><div><label class="lbl">Halaman (1–' + h.numPages + ')</label><input id="ovPage" type="number" min="1" max="' + h.numPages + '" value="1" style="' + inp + '"></div>' +
        '<div><label class="lbl">Ketajaman</label><select id="ovRes" style="' + inp + ';padding:0 8px"><option value="6000">Sedang (6000 px)</option><option value="9000" selected>Tinggi (9000 px)</option><option value="13000">Sangat tinggi (13000 px)</option></select></div></div>' +
        lay +
        '<div class="muted" style="margin-top:8px">Makin tajam, makin lama diproses dan makin besar di ponsel. Nomor blok kecil butuh Tinggi atau lebih.</div>' +
        '<div class="row" style="margin-top:14px;gap:8px"><button class="btn" id="ovNo" style="flex:1">Batal</button><button class="btn pri" id="ovGo" style="flex:1">Proses</button></div>');
      var tm = null;
      function prev() { clearTimeout(tm); tm = setTimeout(function () { var c = $('ovPrev'); if (c) h.preview(c, +$('ovPage').value || 1, hidden, 700).catch(function () {}); }, 150); }
      prev();
      $('ovPage').onchange = prev;
      var ly = $('ovLy');
      if (ly) ly.onchange = function (e) { var id = e.target.getAttribute('data-ly'); if (id === null) return; if (e.target.checked) delete hidden[id]; else hidden[id] = true; prev(); };
      $('ovNo').onclick = function () { h.close(); closeSheet(); };
      $('ovGo').onclick = function () {
        var name = $('ovName').value.trim() || nm, page = +$('ovPage').value || 1, ls = +$('ovRes').value;
        openSheet('<div class="grab"></div><div class="st">MEMPROSES PDF…</div><div class="muted" id="ovMsg">Jangan tutup aplikasi sampai selesai.</div><div class="ovbar"><div id="ovBar"></div></div>');
        h.run({ name: name, page: page, longSide: ls, hidden: hidden }, function (f) { var b = $('ovBar'); if (b) b.style.width = Math.round(f * 100) + '%'; }).then(function (meta) {
          h.close();
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
  function cleanOv(i, next) {
    var o = ovList()[i]; if (!o) return;
    closeSheet();
    HzOverlay.clean(o, { onChange: function () {}, onDone: function () { saveSettings(); renderOv(); syncAllOverlays(); if (next) next(); } });
  }
  function openOvSheet() {
    var l = ovList();
    var op = Math.round((S.settings.ovlOp == null ? 0.8 : S.settings.ovlOp) * 100);
    openSheet('<div class="grab"></div><div class="st">PETA SAYA</div>' + (S.settings.mapMode !== 'osm' ? '<div class="warn" style="margin-bottom:8px">Peta saya hanya tampil di mode <b>Peta</b>, bukan Satelit. Ganti mode di atas peta.</div>' : '') +
      (l.length ? l.map(function (o, i) {
        return '<div class="ovrow"><div class="nm">' + esc(o.name) + (o.cal ? '' : '<small>belum dikalibrasi (Pengaturan)</small>') + '</div>' +
          (o.cal ? '<button class="btn sm" data-tn="' + i + '">Setel</button><input type="checkbox" data-on="' + i + '"' + (o.on ? ' checked' : '') + '>' : '') + '</div>';
      }).join('') + '<div style="margin-top:10px;font-size:14px;color:var(--tx3)">Transparansi: <span id="ovOpV">' + op + '</span>%</div><input type="range" id="ovOp" min="20" max="100" value="' + op + '" style="width:100%">'
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
      trackLayer.clearLayers();
      var bounds = drawTrips(trackLayer, pts, trips, mapSel, false);
      $('mapMsg').textContent = bounds.length ? '' : (day === S.today ? 'Belum ada lintasan hari ini. Lintasan muncul saat ada trip yang terekam.' : 'Tidak ada lintasan pada ' + T.dateLong(day) + '.');
      if (bounds.length && (fit || !fitted)) { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 }); fitted = true; }
      if (PB.open) { pbPlay(false); pbBuild(); if (!PB.seq.length) pbClose(); else pbDraw(false); }
    });
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
      '<button class="srow" id="mmKml"><div class="si"><b>Ekspor KML</b><small>Lintasan hari ini untuk Google Earth</small></div>' + CHEV + '</button>' +
      '<button class="btn" id="mmX" style="width:100%;margin-top:10px">Tutup</button>');
    $('mmX').onclick = closeSheet;
    $('mmOv').onclick = function () { closeSheet(); openOvSheet(); };
    $('mmKml').onclick = function () { closeSheet(); mapKml(); };
  }
  function mapKml() {
    var day = S.mapDay;
    loadDay(day).then(function (d) {
      if (!d.trips.length) { toast('Belum ada trip pada hari ini'); return; }
      return saveFile('HZTrip-' + day + '.kml', textB64(E.buildKml([d], { title: 'HZ Trip ' + day })), 'application/vnd.google-earth.kml+xml');
    });
  }

  // ---------- pasang ----------
  function init() {
    $('btnMenu').onclick = openDrawer;
    $('setMenu').onclick = function (e) { var b = e.target.closest ? e.target.closest('[data-sp]') : null; if (b) openSet(b.getAttribute('data-sp')); };
    document.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = backSet; });
    $('themeSeg').onclick = function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-t'); if (t) { S.settings.theme = t; saveSettings(); applyTheme(); } };
    pbInit();
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
    $('ovAdd').onclick = function () { $('ovFile').value = ''; $('ovFile').click(); };
    $('ovFile').onchange = function () { if (this.files && this.files[0]) importOv(this.files[0]); };
    $('ovList').onclick = function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-cal'), d = e.target.getAttribute && e.target.getAttribute('data-del');
      var cl = e.target.getAttribute && e.target.getAttribute('data-clean');
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
