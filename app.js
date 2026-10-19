/* HZ Trip - tampilan dan alur aplikasi (tahap 2) */
(function () {
  'use strict';
  var T = window.HzTrips;
  var E = window.HzEkspor;
  var COL = { g: '#3FD07A', y: '#F5C518', r: '#FF5B50' };
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zc(v) { return COL[T.zoneOf(v)]; }

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
    var L = {}, timer = null, sec = 0, mode = 'tidur', lat = -4.9, lng = 105.2, sched = { auto: true, margin: 30 };
    function k(d) { return 'mock-pts-' + d; }
    function st() { return { mode: mode, recording: mode === 'rekam', manual: mode === 'rekam', permission: true, background: false, batteryFree: false, auto: sched.auto, paused: false, winEnd: 0, nextStart: Date.now() + 8 * 3600000, count: sec, lastT: Date.now(), lastV: 0, lastAcc: 6 }; }
    function emit(n, o) { (L[n] || []).forEach(function (f) { f(o); }); }
    return {
      addListener: function (n, f) { (L[n] = L[n] || []).push(f); return Promise.resolve({ remove: function () {} }); },
      ensurePermissions: function () { return Promise.resolve({ granted: true }); },
      ensureBackground: function () { return Promise.resolve(st()); },
      setSchedule: function (o) { sched = o; return Promise.resolve(st()); },
      resumeAuto: function () { return Promise.resolve(st()); },
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
      stop: function () { clearInterval(timer); mode = 'tidur'; emit('state', st()); return Promise.resolve({ recording: false }); },
      status: function () { return Promise.resolve(st()); },
      listDays: function () { var a = []; for (var i = 0; i < localStorage.length; i++) { var n = localStorage.key(i); if (n.indexOf('mock-pts-') === 0) a.push(n.slice(9)); } return Promise.resolve({ days: a.sort() }); },
      readDay: function (o) { return Promise.resolve({ text: localStorage.getItem(k(o.date)) || '' }); },
      deletePoints: function (o) {
        var t = localStorage.getItem(k(o.date)) || '', n = 0;
        var keep = t.split('\n').filter(function (l) { if (!l) return false; var ts = +l.split(',')[0]; if (ts >= +o.from && ts <= +o.to) { n++; return false; } return true; });
        localStorage.setItem(k(o.date), keep.length ? keep.join('\n') + '\n' : '');
        return Promise.resolve({ removed: n });
      },
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
      try { var s = JSON.parse(r[0].data); if (s && s.units) S.settings = Object.assign(S.settings, s); } catch (e) {}
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
    S.perm = s.permission !== false; S.bg = s.background !== false; S.battFree = !!s.batteryFree;
    if (S.mode !== 'rekam') S.live.t = 0;
    else if (s.lastT) S.live = { v: s.lastV * 3.6, acc: s.lastAcc, t: S.live.t, count: s.count };
    if (S.view === 'spido') renderSpido();
    if (S.view === 'set') renderSettings();
  }
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
    if (v === 'riwayat') { S.hMode = 'list'; loadRiwayat(); }
    if (v === 'lintasan') openMap();
    if (v === 'set') { renderSettings(); syncStatus(); renderCacheInfo(); renderHidden(); }
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
    g.setAttribute('stroke', zc(v));
  }
  function whenText(ts) {
    var d = new Date(ts), n = new Date();
    if (T.ymd(ts) === T.ymd(n.getTime())) return 'hari ini ' + T.hm(ts);
    var t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    if (T.ymd(ts) === T.ymd(t.getTime())) return 'besok ' + T.hm(ts);
    return HARI[d.getDay()] + ' ' + T.hm(ts);
  }
  function modeHtml() {
    if (S.mode === 'rekam') return '<div class="modebox">' + (S.manual ? '<b>Merekam manual</b>' : '<b>Merekam otomatis</b> · berhenti sendiri setelah 5 menit diam') + '</div>';
    if (S.mode === 'siaga') return '<div class="modebox"><b>Siaga otomatis</b> · menunggu kendaraan jalan' + (S.winEnd ? '<br>jadwal sampai ' + T.hm(S.winEnd) : '') + '</div>';
    if (S.mode === 'cek') return '<div class="modebox"><b>Memeriksa gerakan…</b> GPS menyala sebentar</div>';
    if (!S.auto) return '<div class="modebox">Rekam otomatis dimatikan (Pengaturan).</div>';
    if (S.paused) return '<div class="modebox"><b>Otomatis dijeda</b> sampai jadwal berikutnya<br><button class="btn sm" data-act="resume">Aktifkan lagi</button></div>';
    if (S.nextStart) return '<div class="modebox">Tidur · di luar jadwal<br>otomatis aktif ' + whenText(S.nextStart) + '</div>';
    return '<div class="modebox">Jadwal mingguan belum diisi.<br><button class="btn sm" data-act="sched">Isi jadwal</button></div>';
  }
  function renderSpido() {
    var rec = S.mode === 'rekam';
    var fresh = rec && S.live.t && (Date.now() - S.live.t) < 5000;
    var v = fresh ? S.live.v : 0;
    $('gNum').textContent = Math.round(v);
    $('gNum').style.color = fresh && v > 0 ? zc(v) : '';
    drawGauge(v);
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
    var w = '';
    if (!S.perm) w += '<div class="warn">Izin lokasi belum diberikan. Tekan Mulai lalu pilih "Izinkan".</div>';
    else if (native && S.auto && !S.bg) w += '<div class="warn">Agar rekam otomatis jalan saat layar mati, izinkan lokasi "Selalu".<br><button class="btn sm" data-act="bg" style="margin-top:8px">Atur izin lokasi</button></div>';
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
      Plug.stop().then(function () { setTimeout(syncStatus, 400); toast(S.manual ? 'Perekaman diakhiri' : 'Otomatis dijeda sampai jadwal berikutnya'); });
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
    if (a === 'resume') Plug.resumeAuto().then(applyStatus);
    else if (a === 'sched') go('set');
    else if (a === 'bg') askBackground();
    else if (a === 'batt') openBatt();
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
    sel.innerHTML = S.settings.units.map(function (u) { return '<option value="' + esc(u) + '"' + (u === a ? ' selected' : '') + '>' + esc(u) + ' · ' + typeOf(u) + '</option>'; }).join('');
    var nt = $('unitNote');
    if (nt) nt.textContent = o ? 'Manual sampai ' + T.hm(o.until) + ', lalu kembali otomatis.' : 'Otomatis: sekarang jam ' + (kindAt(now) === 'Kerja' ? 'kerja' : 'pribadi') + '.';
  }
  var KEEP_MS = 30 * 24 * 3600000;
  function visible(ymd, trips) {
    var hid = (S.ov.hidden || []).filter(function (h) { return h.day === ymd; });
    if (!hid.length) return trips;
    return trips.filter(function (t) { return !hid.some(function (h) { return t.start <= h.end && t.end >= h.start; }); });
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
      var res = T.detectTrips(T.parseCsv(r.text), opts());
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
      var res = T.detectTrips(T.parseCsv(r.text), opts());
      S.hTrips = edited(S.hDay, res).map(tripView);
      renderHistory();
    }).catch(function () { S.hTrips = []; renderHistory(); });
  }
  function labelChip(x) {
    var c = x.label === 'Kerja' ? 'k' : 'p';
    return '<span class="chip ' + c + '">' + x.label + '</span>' + (x.check ? '<span class="chip f">melewati batas jam</span>' : '') + (x.t.parts ? '<span class="chip m">' + x.t.parts.length + ' bagian</span>' : '');
  }
  function renderHistory() {
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
      return '<button class="trip' + (isSel ? ' sel' : '') + (dim ? ' dim' : '') + '" data-i="' + i + '"><div class="t1">' + (S.sel ? '<span class="cbx">' + (isSel ? '✓' : '') + '</span>' : '') + '<span class="tm">' + T.hm(t.start) + ' – ' + T.hm(t.end) + (t.open ? ' ●' : '') + '</span>' + (t.manual ? '<span class="chip m">manual</span>' : '') + '<span class="chip">' + esc(x.unit) + '</span>' + labelChip(x) + '</div>' +
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
    if ($('undoGo')) $('undoGo').onclick = function () { doUndo(i); };
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
      var res = T.detectTrips(T.parseCsv(r.text), opts());
      S.hTrips = edited(S.hDay, res).map(tripView);
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
      var res = T.detectTrips(T.parseCsv(r.text), opts());
      var trips = visible(S.hDay, T.applyEdits(res, ed));
      var second = null;
      for (var k = 0; k < trips.length; k++) { if (trips[k].start > ts && trips[k - 1] && trips[k - 1].id === t.id) { second = trips[k]; break; } }
      if (!noInherit && src && second && !S.ov.trips[second.id]) {
        var c = { hist: [] };
        if (src.unit) c.unit = src.unit;
        S.ov.trips[second.id] = c;
      }
      saveOv();
      S.hTrips = trips.map(tripView);
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
        '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93A4AD" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' + body + '</div>';
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
    } else bits.push('Mode uji di browser.');
    $('setStat').innerHTML = bits.join('<br>');
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
      var res = T.detectTrips(T.parseCsv(r.text), opts());
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

  // ---------- lintasan (peta) ----------
  var map = null, tileLayer = null, trackLayer = null, fitted = false, mapSel = -1, mapKeep = false;
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
    return true;
  }
  function setTiles() {
    if (!map) return;
    if (tileLayer) { map.removeLayer(tileLayer); tileLayer = null; }
    var m = S.settings.mapMode;
    if (TILES[m]) tileLayer = new (cachedLayerClass())(TILES[m][0], { maxZoom: 19, attribution: TILES[m][1] }).addTo(map);
    document.querySelectorAll('#mapSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-map') === m); });
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
      var trips = d.trips, pts = d.pts;
      if (mapSel >= trips.length) mapSel = -1;
      $('mapChips').innerHTML = trips.length > 1 ? '<button data-i="-1"' + (mapSel < 0 ? ' class="on"' : '') + '>Semua</button>' + trips.map(function (x, i) {
        return '<button data-i="' + i + '"' + (mapSel === i ? ' class="on"' : '') + '>' + (i + 1) + ' · ' + T.hm(x.t.start) + '</button>';
      }).join('') : '';
      trackLayer.clearLayers();
      var bounds = [];
      trips.forEach(function (x, i) {
        if (mapSel >= 0 && mapSel !== i) return;
        var t = x.t;
        E.zoneRuns(pts, t.i0, t.i1).forEach(function (r) {
          var ll = r.pts.map(function (p) { return [p.lat, p.lng]; });
          L.polyline(ll, { color: COL[r.z], weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(trackLayer);
          bounds = bounds.concat(ll);
        });
        function dot(lat, lng, col, rad, tip) { L.circleMarker([lat, lng], { radius: rad, color: '#fff', weight: 2, fillColor: col, fillOpacity: 1 }).bindTooltip(tip).addTo(trackLayer); }
        dot(t.startLat, t.startLng, '#3FD07A', 7, 'Mulai ' + T.hm(t.start));
        dot(t.endLat, t.endLng, '#FF5B50', 7, 'Selesai ' + T.hm(t.end));
        dot(t.maxLat, t.maxLng, '#F5C518', 8, 'Tercepat ' + Math.round(t.max) + ' km/j (' + T.hm(t.maxT) + ')');
      });
      $('mapMsg').textContent = bounds.length ? '' : (day === S.today ? 'Belum ada lintasan hari ini. Lintasan muncul saat ada trip yang terekam.' : 'Tidak ada lintasan pada ' + T.dateLong(day) + '.');
      if (bounds.length && (fit || !fitted)) { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 }); fitted = true; }
    });
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
    $('scrim').onclick = function () { closeSheet(); $('drawer').classList.remove('on'); };
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.onclick = function () { go(a.getAttribute('data-go')); }; });
    $('btnRec').onclick = toggleRec;
    $('modeBox').onclick = onModeAction;
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
    $('autoChk').onchange = function () { S.settings.auto = this.checked; saveSettings(); pushSchedule(); };
    $('marginSel').onchange = function () { S.settings.margin = +this.value; saveSettings(); renderSched(); pushSchedule(); };
    $('schedBox').onchange = onSched;
    $('schedBox').onclick = function (e) {
      var tg = e.target.closest ? e.target.closest('[data-tog]') : null;
      if (tg) { var dd = +tg.getAttribute('data-tog'); openDay = (openDay === dd) ? -1 : dd; renderSched(); return; }
      var c = e.target.getAttribute && e.target.getAttribute('data-clear');
      if (c !== null && c !== undefined) { var x = S.settings.schedule.days[+c]; x['in'] = ''; x.out = ''; saveSettings(); pushSchedule(); var sc = $('main').scrollTop; renderSched(); $('main').scrollTop = sc; }
    };
    $('btnBatt').onclick = openBatt;
    $('btnBg').onclick = askBackground;
    $('btnPrint').onclick = function () { openPrint({ day: S.hMode === 'list' ? T.ymd(Date.now()) : S.hDay }); };
    document.querySelectorAll('#drawer a[data-print]').forEach(function (a) { a.onclick = function () { closeDrawer(); openPrint({ day: S.hDay }); }; });
    $('mapSeg').onclick = function (e) { var m = e.target.getAttribute && e.target.getAttribute('data-map'); if (m) { S.settings.mapMode = m; saveSettings(); setTiles(); } };
    $('mapChips').onclick = function (e) { var i = e.target.getAttribute && e.target.getAttribute('data-i'); if (i !== null && i !== undefined) { mapSel = +i; renderMap(true); } };
    $('mapKml').onclick = mapKml;
    $('mPrev').onclick = function () { shiftMap(-1); };
    $('mNext').onclick = function () { shiftMap(1); };
    $('mToday').onclick = function () { S.mapDay = S.today; mapSel = -1; fitted = false; renderMap(true); };
    $('mPick').onchange = function () { if (this.value && this.value <= S.today) { S.mapDay = this.value; mapSel = -1; fitted = false; renderMap(true); } };
    $('toMap').onclick = function () { showMap(S.hDay, -1); };
    $('hidList').onclick = onHidden;
    $('tcClear').onclick = function () { askConfirm('Bersihkan cache peta?', 'Peta yang tersimpan dihapus. Peta akan diunduh lagi saat Anda melihatnya dengan internet.', 'Bersihkan', function () { TC.clear().then(function () { renderCacheInfo(); toast('Cache peta dibersihkan'); }); }); };
    $('radiusSel').onchange = function () { S.settings.radius = +this.value; saveSettings(); pushSchedule(); };
    $('driverIn').onchange = function () { S.settings.driver = this.value.trim(); saveSettings(); };

    Plug.addListener('fix', onFix);
    Plug.addListener('state', applyStatus);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { syncStatus(); refreshToday().then(renderSpido); if (S.view === 'riwayat') loadRiwayat(); purgeExpired(); }
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
    }).then(function () { pushSchedule(); renderSpido(); purgeExpired(); });
    renderSpido();
  }
  init();
})();
