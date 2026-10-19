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
    settings: { units: ['BT.13', 'Motor'], defUnit: 'BT.13', splitSec: 60, auto: true, margin: 30, driver: 'Han', radius: 150, mapMode: 'sat', schedule: T.defaultSchedule() },
    ov: { trips: {}, days: {} },
    today: T.ymd(Date.now()), todayPts: [], liveTrip: null,
    hDay: T.ymd(Date.now()), hTrips: [], hMode: 'list'
  };

  function opts() { return { splitSec: S.settings.splitSec }; }
  function saveSettings() { return Plug.saveJson({ name: 'settings', data: JSON.stringify(S.settings) }).catch(function () {}); }
  function saveOv() { return Plug.saveJson({ name: 'overrides', data: JSON.stringify(S.ov) }).catch(function () { toast('Perubahan gagal disimpan'); }); }
  function loadMeta() {
    return Promise.all([Plug.loadJson({ name: 'settings' }), Plug.loadJson({ name: 'overrides' })]).then(function (r) {
      try { var s = JSON.parse(r[0].data); if (s && s.units) S.settings = Object.assign(S.settings, s); } catch (e) {}
      try { var o = JSON.parse(r[1].data); if (o && o.trips) { S.ov = o; if (!S.ov.days) S.ov.days = {}; } } catch (e) {}
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
    $('ttl').textContent = TITLES[v];
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-go') === v); });
    closeDrawer();
    if (v === 'riwayat') { S.hMode = 'list'; loadRiwayat(); }
    if (v === 'lintasan') openMap();
    if (v === 'set') { renderSettings(); syncStatus(); }
    if (v === 'spido') { syncStatus(); renderSpido(); }
    $('main').scrollTop = 0;
  }
  function openDrawer() { $('drawer').classList.add('on'); $('scrim').classList.add('on'); }
  function closeDrawer() { $('drawer').classList.remove('on'); if (!$('sheet').classList.contains('on')) $('scrim').classList.remove('on'); }
  function openSheet(html) { $('sheet').innerHTML = html; $('sheet').classList.add('on'); $('scrim').classList.add('on'); }
  function closeSheet() { $('sheet').classList.remove('on'); $('scrim').classList.remove('on'); }

  // Tombol back Android (dipanggil dari MainActivity): true = sudah ditangani di halaman.
  window.hzBack = function () {
    if ($('sheet').classList.contains('on')) { closeSheet(); return true; }
    if ($('drawer').classList.contains('on')) { $('drawer').classList.remove('on'); $('scrim').classList.remove('on'); return true; }
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
  function tripView(t) {
    var o = S.ov.trips[t.id] || {};
    var al = T.autoLabel(S.settings.schedule, t);
    return {
      t: t, unit: o.unit || S.settings.defUnit,
      label: o.label || al.label, auto: al.label, edited: !!o.label,
      check: al.check && !o.label, hist: o.hist || []
    };
  }
  // ---------- ringkasan 30 hari ----------
  function daySumm(ymd) {
    return Plug.readDay({ date: ymd }).then(function (r) {
      var res = T.detectTrips(T.parseCsv(r.text), opts());
      var tr = T.applyEdits(res, S.ov.days[ymd]);
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
      S.hTrips = T.applyEdits(res, S.ov.days[S.hDay]).map(tripView);
      renderHistory();
    }).catch(function () { S.hTrips = []; renderHistory(); });
  }
  function labelChip(x) {
    var c = x.label === 'Kerja' ? 'k' : 'p';
    return '<span class="chip ' + c + '">' + x.label + '</span>' + (x.check ? '<span class="chip f">cek</span>' : '');
  }
  function renderHistory() {
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
      return '<button class="trip" data-i="' + i + '"><div class="t1"><span class="tm">' + T.hm(t.start) + ' – ' + T.hm(t.end) + (t.open ? ' ●' : '') + '</span>' + (t.manual ? '<span class="chip m">manual</span>' : '') + '<span class="chip">' + esc(x.unit) + '</span>' + labelChip(x) + '</div>' +
        '<div class="t2"><div><small>DURASI</small><b style="font-size:18px">' + T.durText(t.durSec) + '</b></div><div><small>MIN</small><b>' + Math.round(t.min) + '</b></div><div><small>MAKS</small><b style="color:' + zc(t.max) + '">' + Math.round(t.max) + '</b></div><div><small>KM</small><b>' + T.km1(t.km) + '</b></div></div></button>';
    }).join('');
  }
  function shiftDay(n) {
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
    var lOpts = ['Kerja', 'Pribadi'].map(function (l) { return '<button class="opt' + (l === x.label ? ' on' : '') + '" data-l="' + l + '">' + l + '</button>'; }).join('') +
      (x.edited ? '<button class="opt" data-l="">Kembali ke otomatis (' + x.auto + ')</button>' : '');
    var hist = x.hist.length ? x.hist.map(function (h) {
      return '<div class="kv"><span>' + T.hm(h.at) + ' · ' + esc(h.f) + '</span><span>' + esc(h.from || '–') + ' → ' + esc(h.to || '–') + '</span></div>';
    }).join('') : '<div class="muted">Belum ada perubahan.</div>';
    var hasNext = i < S.hTrips.length - 1;
    var ed = S.ov.days[S.hDay];
    var hasEdit = ed && (ed.ops || []).some(function (op) { return op.j === t.id || (op.c !== undefined && op.c >= t.start - 5000 && op.c <= t.end + 5000); });
    var mid = hmsOf(t.start + (t.end - t.start) / 2);
    openSheet('<div class="grab"></div><div class="st">TRIP ' + T.hm(t.start) + ' – ' + T.hm(t.end) + '</div>' +
      (x.check ? '<div class="warn" style="margin:6px 0">Trip ini melewati batas jam kerja. Periksa labelnya, atau potong di jam pergantian.</div>' : '') +
      '<div class="h">UNIT</div><div class="opts" id="uOpts">' + uOpts + '</div>' +
      '<div class="h">LABEL</div><div class="opts" id="lOpts">' + lOpts + '</div>' +
      '<div class="h">POTONG TRIP</div><div class="row"><input type="time" step="1" id="cutAt" value="' + mid + '"><button class="btn pri" id="cutGo" style="flex-shrink:0">Potong</button></div>' +
      '<div class="muted" style="margin-top:6px">Memecah trip ini menjadi dua di jam yang dipilih.</div>' +
      (hasNext ? '<button class="btn" id="joinGo" style="width:100%;margin-top:10px">Gabung dengan trip berikutnya</button>' : '') +
      (hasEdit ? '<button class="btn" id="undoGo" style="width:100%;margin-top:10px">Batalkan potongan / gabungan</button>' : '') +
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
    $('lOpts').onclick = function (e) { var l = e.target.getAttribute && e.target.getAttribute('data-l'); if (l !== null && l !== undefined) change(i, 'label', l || null); };
    $('cutGo').onclick = function () { doCut(i, $('cutAt').value); };
    $('printGo').onclick = function () { openPrint({ tripId: t.id }); };
    if ($('joinGo')) $('joinGo').onclick = function () { doJoin(i); };
    if ($('undoGo')) $('undoGo').onclick = function () { doUndo(i); };
  }
  function change(i, field, val) {
    var x = S.hTrips[i], id = x.t.id;
    var o = S.ov.trips[id] || (S.ov.trips[id] = { hist: [] });
    var from = field === 'unit' ? x.unit : x.label;
    var to = val === null ? x.auto : val;
    if (from === to) return;
    if (val === null) delete o[field]; else o[field] = val;
    o.hist = (o.hist || []).concat([{ at: Date.now(), f: field === 'unit' ? 'Unit' : 'Label', from: from, to: to }]);
    saveOv();
    afterEdit(i);
  }
  function afterEdit(i) {
    Plug.readDay({ date: S.hDay }).then(function (r) {
      var res = T.detectTrips(T.parseCsv(r.text), opts());
      S.hTrips = T.applyEdits(res, S.ov.days[S.hDay]).map(tripView);
      renderHistory();
      if (i >= 0 && i < S.hTrips.length) openTrip(Math.min(i, S.hTrips.length - 1)); else closeSheet();
    });
  }
  function doCut(i, hms) {
    var x = S.hTrips[i], t = x.t;
    if (!hms) { toast('Pilih jam potong'); return; }
    var ts = tsOf(S.hDay, hms);
    if (!(ts > t.start + 5000 && ts < t.end - 5000)) { toast('Jam potong harus di dalam trip (' + T.hm(t.start) + ' – ' + T.hm(t.end) + ')'); return; }
    var ed = dayEdits();
    ed.ops.push({ c: ts });
    // potongan kedua mewarisi unit dan label trip asal
    var src = S.ov.trips[t.id];
    Plug.readDay({ date: S.hDay }).then(function (r) {
      var res = T.detectTrips(T.parseCsv(r.text), opts());
      var trips = T.applyEdits(res, ed);
      var second = null;
      for (var k = 0; k < trips.length; k++) { if (trips[k].start > ts && trips[k - 1] && trips[k - 1].id === t.id) { second = trips[k]; break; } }
      if (src && second && !S.ov.trips[second.id]) {
        var c = { hist: [] };
        if (src.unit) c.unit = src.unit;
        if (src.label) c.label = src.label;
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
        '<label class="chk"><input type="checkbox" data-f="brk"' + (x.brk ? ' checked' : '') + '> Ada istirahat (dihitung Pribadi)</label>' +
        (x.brk ? '<div class="r2"><label>DARI<input type="time" data-f="brkFrom" value="' + esc(x.brkFrom || '11:00') + '"></label><label>SAMPAI<input type="time" data-f="brkTo" value="' + esc(x.brkTo || '13:30') + '"></label></div>' : '') +
        (libur ? '' : '<button class="btn sm" data-clear="' + d + '" style="margin-top:8px">Jadikan libur</button>') + '</div>' : '';
      return '<div class="card sday' + (open ? ' open' : '') + '" data-d="' + d + '"><button class="sd-h" data-tog="' + d + '"><b>' + HARI[d] + '</b><span class="sd-s' + (libur ? ' off' : '') + '">' + daySummary(x) + '</span>' +
        '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93A4AD" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' + body + '</div>';
    }).join('');
  }
  function minToHm(m) { m = (m + 1440) % 1440; return T.pad(Math.floor(m / 60)) + '.' + T.pad(m % 60); }
  function renderSettings() {
    $('unitBox').innerHTML = S.settings.units.map(function (u, i) {
      var d = u === S.settings.defUnit;
      return '<div class="unit"><span>' + esc(u) + (d ? ' <small class="muted">· bawaan</small>' : '') + '</span>' +
        (d ? '' : '<button class="btn sm" data-def="' + i + '">Jadikan bawaan</button>') +
        (S.settings.units.length > 1 ? '<button class="btn sm" data-del="' + i + '">Hapus</button>' : '') + '</div>';
    }).join('');
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
    S.settings.units.push(v); $('unitNew').value = ''; saveSettings(); renderSettings();
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
      return { ymd: ymd, pts: res.points, trips: T.applyEdits(res, S.ov.days[ymd]).map(tripView) };
    });
  }
  function dayList(from, to) {
    var a = from.split('-'), b = to.split('-'), out = [], n = 0;
    var d = new Date(+a[0], +a[1] - 1, +a[2]), end = new Date(+b[0], +b[1] - 1, +b[2]);
    while (d <= end && n < 93) { out.push(T.ymd(d.getTime())); d.setDate(d.getDate() + 1); n++; }
    return out;
  }
  function collect(P) {
    var list = P.scope === 'range' ? dayList(P.from, P.to) : [P.day];
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
    if (P.scope === 'range') return 'HZTrip-' + P.from + '_sd_' + P.to;
    if (P.scope === 'trip') return 'HZTrip-' + P.day + '-trip-' + T.hm(P.tripId).replace('.', '');
    return 'HZTrip-' + P.day;
  }

  // ---------- lembar cetak ----------
  var P = null;
  function openPrint(o) {
    o = o || {};
    P = { scope: o.tripId ? 'trip' : 'hari', tripId: o.tripId || 0, day: o.day || S.hDay, from: o.day || S.hDay, to: o.day || S.hDay,
      units: S.settings.units.slice(), labels: ['Kerja', 'Pribadi'], summary: true, color: true };
    var tripTxt = '';
    if (o.tripId) { var x = S.hTrips.filter(function (y) { return y.t.id === o.tripId; })[0]; if (x) tripTxt = ' <span class="muted">· ' + T.hm(x.t.start) + ' – ' + T.hm(x.t.end) + '</span>'; }
    var today = T.ymd(Date.now());
    openSheet('<div class="grab"></div><div class="st">CETAK LAPORAN</div><div class="plist">' +
      '<div class="h">CAKUPAN</div>' +
      (o.tripId ? '<label><input type="radio" name="pscope" value="trip" checked> Satu trip' + tripTxt + '</label>' : '') +
      '<label><input type="radio" name="pscope" value="hari"' + (o.tripId ? '' : ' checked') + '> Satu hari</label>' +
      '<label><input type="radio" name="pscope" value="range"> Rentang tanggal</label>' +
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
    else if (t.getAttribute('data-u') !== null) { P.units = [].slice.call(document.querySelectorAll('#pUnits input')).filter(function (c) { return c.checked; }).map(function (c) { return S.settings.units[+c.getAttribute('data-u')]; }); }
    else if (t.getAttribute('data-l') !== null) { P.labels = [].slice.call(document.querySelectorAll('input[data-l]')).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-l'); }); }
    else if (t.id === 'pSum') P.summary = t.checked;
    else if (t.id === 'pCol') P.color = t.checked;
    syncPrint();
  }
  function syncPrint() {
    if (!$('pFrom')) return;
    $('pTo').disabled = P.scope !== 'range';
    $('pFrom').disabled = P.scope === 'trip';
    $('pFilters').style.opacity = P.scope === 'trip' ? '.4' : '1';
    $('pInfo').textContent = 'Menghitung…';
    collect(P).then(function (ds) {
      var n = 0, km = 0;
      ds.forEach(function (d) { d.trips.forEach(function (x) { n++; km += x.t.km; }); });
      if ($('pInfo')) $('pInfo').innerHTML = n ? 'Akan mencetak <b style="color:var(--tx)">' + n + ' trip · ' + T.km1(km) + ' km</b>' + (ds.length > 1 ? ' dalam ' + ds.length + ' hari' : '') : 'Tidak ada trip pada pilihan ini.';
    });
  }
  function runExport(kind) {
    collect(P).then(function (ds) {
      if (!ds.length) { toast('Tidak ada trip pada pilihan ini'); return; }
      var base = fileBase(P);
      if (kind === 'kml') {
        return saveFile(base + '.kml', textB64(E.buildKml(ds, { title: 'HZ Trip ' + ds[0].ymd })), 'application/vnd.google-earth.kml+xml');
      }
      if (!window.jspdf) { toast('Library PDF belum siap'); return; }
      var doc = E.buildPdf(ds, { driver: S.settings.driver, scope: P.scope, summary: P.summary, color: P.color });
      return saveFile(base + '.pdf', doc.output('datauristring').split(',')[1], 'application/pdf');
    }).catch(function (e) { showErr(e && e.message || e); });
  }

  // ---------- lintasan (peta) ----------
  var map = null, tileLayer = null, trackLayer = null, fitted = false, mapSel = -1;
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
    if (TILES[m]) tileLayer = L.tileLayer(TILES[m][0], { maxZoom: 19, attribution: TILES[m][1] }).addTo(map);
    document.querySelectorAll('#mapSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-map') === m); });
  }
  function openMap() {
    setTimeout(function () {
      if (!ensureMap()) { $('mapMsg').textContent = 'Peta tidak tersedia'; return; }
      map.invalidateSize();
      setTiles();
      renderMap(true);
    }, 60);
  }
  function renderMap(fit) {
    if (!map) return;
    var res = T.detectTrips(S.todayPts, opts());
    var trips = T.applyEdits(res, S.ov.days[S.today]).map(tripView), pts = res.points;
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
    $('mapMsg').textContent = bounds.length ? '' : 'Belum ada lintasan hari ini. Lintasan muncul saat ada trip yang terekam.';
    if (bounds.length && (fit || !fitted)) { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 }); fitted = true; }
  }
  function mapKml() {
    loadDay(S.today).then(function (d) {
      if (!d.trips.length) { toast('Belum ada trip hari ini'); return; }
      return saveFile('HZTrip-' + S.today + '.kml', textB64(E.buildKml([d], { title: 'HZ Trip ' + S.today })), 'application/vnd.google-earth.kml+xml');
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
    $('toList').onclick = function () { S.hMode = 'list'; loadRiwayat(); $('main').scrollTop = 0; };
    $('monthView').onclick = function (e) { var b = e.target.closest ? e.target.closest('.mrow') : null; if (b) { S.hDay = b.getAttribute('data-d'); S.hMode = 'day'; loadRiwayat(); $('main').scrollTop = 0; } };
    $('dPrev').onclick = function () { shiftDay(-1); };
    $('dNext').onclick = function () { shiftDay(1); };
    $('dPick').onchange = function () { if (this.value && this.value <= T.ymd(Date.now())) { S.hDay = this.value; loadHistory(); } };
    $('tripList').onclick = function (e) { var b = e.target.closest ? e.target.closest('.trip') : null; if (b) openTrip(+b.getAttribute('data-i')); };
    $('unitAdd').onclick = addUnit;
    $('unitBox').onclick = function (e) {
      var d = e.target.getAttribute('data-def'), x = e.target.getAttribute('data-del');
      if (d !== null) { S.settings.defUnit = S.settings.units[+d]; saveSettings(); renderSettings(); }
      if (x !== null) {
        var u = S.settings.units[+x];
        S.settings.units.splice(+x, 1);
        if (S.settings.defUnit === u) S.settings.defUnit = S.settings.units[0];
        saveSettings(); renderSettings();
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
    $('radiusSel').onchange = function () { S.settings.radius = +this.value; saveSettings(); pushSchedule(); };
    $('driverIn').onchange = function () { S.settings.driver = this.value.trim(); saveSettings(); };

    Plug.addListener('fix', onFix);
    Plug.addListener('state', applyStatus);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { syncStatus(); refreshToday().then(renderSpido); if (S.view === 'riwayat') loadRiwayat(); }
    });
    var tick = 0;
    setInterval(function () {
      tick++;
      if (S.view === 'spido' && !document.hidden) renderSpido();
      if (S.view === 'lintasan' && !document.hidden && S.mode === 'rekam' && tick % 15 === 0) renderMap(false);
    }, 1000);
    setInterval(function () { if (!document.hidden) syncStatus(); }, 20000);

    loadMeta().then(function () {
      renderSettings();
      return Promise.all([syncStatus(), refreshToday()]);
    }).then(function () { pushSchedule(); renderSpido(); });
    renderSpido();
  }
  init();
})();
