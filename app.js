/* HZ Trip - tampilan dan alur aplikasi (tahap 2) */
(function () {
  'use strict';
  var T = window.HzTrips;
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
    settings: { units: ['BT.13', 'Motor'], defUnit: 'BT.13', splitSec: 60, auto: true, margin: 30, schedule: T.defaultSchedule() },
    ov: { trips: {}, days: {} },
    today: T.ymd(Date.now()), todayPts: [], liveTrip: null,
    hDay: T.ymd(Date.now()), hTrips: []
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
      Plug.setSchedule({ days: T.nativeDays(S.settings.schedule), auto: S.settings.auto, margin: S.settings.margin }).then(applyStatus).catch(function () {});
    }, 600);
  }

  // ---------- navigasi ----------
  var TITLES = { spido: 'SPIDOMETER', riwayat: 'RIWAYAT', set: 'PENGATURAN' };
  function go(v) {
    S.view = v;
    ['spido', 'riwayat', 'set'].forEach(function (n) { $('v-' + n).classList.toggle('on', n === v); });
    $('ttl').textContent = TITLES[v];
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-go') === v); });
    closeDrawer();
    if (v === 'riwayat') loadHistory();
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

  // ---------- pasang ----------
  function init() {
    $('btnMenu').onclick = openDrawer;
    $('scrim').onclick = function () { closeSheet(); $('drawer').classList.remove('on'); };
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.onclick = function () { go(a.getAttribute('data-go')); }; });
    $('btnRec').onclick = toggleRec;
    $('modeBox').onclick = onModeAction;
    $('warnBox').onclick = onModeAction;
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

    Plug.addListener('fix', onFix);
    Plug.addListener('state', applyStatus);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { syncStatus(); refreshToday().then(renderSpido); if (S.view === 'riwayat') loadHistory(); }
    });
    setInterval(function () { if (S.view === 'spido' && !document.hidden) renderSpido(); }, 1000);
    setInterval(function () { if (!document.hidden) syncStatus(); }, 20000);

    loadMeta().then(function () {
      renderSettings();
      return Promise.all([syncStatus(), refreshToday()]);
    }).then(function () { pushSchedule(); renderSpido(); });
    renderSpido();
  }
  init();
})();
