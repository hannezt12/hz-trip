/* HZ Trip - tampilan dan alur aplikasi (tahap 1) */
(function () {
  'use strict';
  var T = window.HzTrips;
  var COL = { g: '#3FD07A', y: '#F5C518', r: '#FF5B50' };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zc(v) { return COL[T.zoneOf(v)]; }

  // ---------- jembatan ke Android (atau tiruan di browser untuk uji) ----------
  var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var Plug = native ? window.Capacitor.registerPlugin('HzTrip') : mockPlugin();

  function mockPlugin() {
    var L = {}, timer = null, sec = 0, rec = false, lat = -4.9, lng = 105.2;
    function k(d) { return 'mock-pts-' + d; }
    function emit(n, o) { (L[n] || []).forEach(function (f) { f(o); }); }
    return {
      addListener: function (n, f) { (L[n] = L[n] || []).push(f); return Promise.resolve({ remove: function () {} }); },
      ensurePermissions: function () { return Promise.resolve({ granted: true }); },
      start: function () {
        rec = true; sec = 0;
        timer = setInterval(function () {
          sec++;
          var v = sec < 20 ? sec * 2 : (sec < 120 ? 45 + 25 * Math.sin(sec / 9) : (sec < 150 ? 0 : 50 + 45 * Math.abs(Math.sin(sec / 15))));
          var t = Date.now();
          lat += v / 3.6 * 0.000007; lng += v / 3.6 * 0.000007;
          var d = T.ymd(t), old = localStorage.getItem(k(d)) || '';
          localStorage.setItem(k(d), old + [t, lat.toFixed(6), lng.toFixed(6), (v / 3.6).toFixed(2), 6].join(',') + '\n');
          emit('fix', { t: t, lat: lat, lng: lng, v: v / 3.6, acc: 6, count: sec });
        }, 250);
        emit('state', { recording: true });
        return Promise.resolve({ recording: true });
      },
      stop: function () { clearInterval(timer); rec = false; emit('state', { recording: false }); return Promise.resolve({ recording: false }); },
      status: function () { return Promise.resolve({ recording: rec, permission: true, batteryFree: false, count: sec, lastT: Date.now(), lastV: 0, lastAcc: 6 }); },
      listDays: function () { var a = []; for (var i = 0; i < localStorage.length; i++) { var n = localStorage.key(i); if (n.indexOf('mock-pts-') === 0) a.push(n.slice(9)); } return Promise.resolve({ days: a.sort() }); },
      readDay: function (o) { return Promise.resolve({ text: localStorage.getItem(k(o.date)) || '' }); },
      saveJson: function (o) { localStorage.setItem('mock-json-' + o.name, o.data); return Promise.resolve(); },
      loadJson: function (o) { return Promise.resolve({ data: localStorage.getItem('mock-json-' + o.name) || '' }); },
      openBatterySettings: function () { return Promise.resolve(); }
    };
  }

  // ---------- keadaan ----------
  var S = {
    view: 'spido', rec: false, perm: true, battFree: false,
    live: { v: 0, acc: 0, t: 0, count: 0 },
    settings: { units: ['BT.13', 'Motor'], defUnit: 'BT.13', splitSec: 60 },
    ov: { trips: {} },
    today: T.ymd(Date.now()), todayPts: [], liveTrip: null,
    hDay: T.ymd(Date.now()), hTrips: [], hDays: []
  };

  function opts() { return { splitSec: S.settings.splitSec }; }
  function saveSettings() { return Plug.saveJson({ name: 'settings', data: JSON.stringify(S.settings) }).catch(function () {}); }
  function saveOv() { return Plug.saveJson({ name: 'overrides', data: JSON.stringify(S.ov) }).catch(function () { toast('Perubahan gagal disimpan'); }); }
  function loadMeta() {
    return Promise.all([Plug.loadJson({ name: 'settings' }), Plug.loadJson({ name: 'overrides' })]).then(function (r) {
      try { var s = JSON.parse(r[0].data); if (s && s.units) S.settings = Object.assign(S.settings, s); } catch (e) {}
      try { var o = JSON.parse(r[1].data); if (o && o.trips) S.ov = o; } catch (e) {}
    }).catch(function () {});
  }

  var toastT;
  function toast(msg) { var e = $('toast'); e.textContent = msg; e.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function () { e.style.display = 'none'; }, 2800); }

  // ---------- navigasi ----------
  var TITLES = { spido: 'SPIDOMETER', riwayat: 'RIWAYAT', set: 'PENGATURAN' };
  function go(v) {
    S.view = v;
    ['spido', 'riwayat', 'set'].forEach(function (n) { $('v-' + n).classList.toggle('on', n === v); });
    $('ttl').textContent = TITLES[v];
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-go') === v); });
    closeDrawer();
    if (v === 'riwayat') loadHistory();
    if (v === 'set') renderSettings();
    $('main').scrollTop = 0;
  }
  function openDrawer() { $('drawer').classList.add('on'); $('scrim').classList.add('on'); }
  function closeDrawer() { $('drawer').classList.remove('on'); if (!$('sheet').classList.contains('on')) $('scrim').classList.remove('on'); }
  function openSheet(html) { $('sheet').innerHTML = html; $('sheet').classList.add('on'); $('scrim').classList.add('on'); }
  function closeSheet() { $('sheet').classList.remove('on'); $('scrim').classList.remove('on'); }

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
  function renderSpido() {
    var fresh = S.rec && S.live.t && (Date.now() - S.live.t) < 5000;
    var v = fresh ? S.live.v : 0;
    $('gNum').textContent = Math.round(v);
    $('gNum').style.color = fresh && v > 0 ? zc(v) : '';
    drawGauge(v);
    var lt = S.liveTrip;
    $('sMax').textContent = lt ? Math.round(lt.max) : '–';
    $('sAvg').textContent = lt ? Math.round(lt.avg) : '–';
    $('sKm').textContent = lt ? T.km1(lt.km) : '–';
    var b = $('btnRec');
    if (S.rec) { b.className = 'recbtn stop'; b.innerHTML = '<span class="dot"></span>Akhiri perekaman'; }
    else { b.className = 'recbtn start'; b.textContent = 'Mulai merekam'; }
    var g = '';
    if (!S.rec) g = 'Tidak merekam. Tekan Mulai, lalu mengemudi.';
    else if (!S.live.t) g = 'Menunggu sinyal GPS… (di tempat terbuka lebih cepat)';
    else g = 'GPS ±' + Math.round(S.live.acc) + ' m · ' + S.live.count + ' titik tercatat';
    $('gpsLine').textContent = g;
    var w = '';
    if (!S.perm) w += '<div class="warn">Izin lokasi belum diberikan. Tekan Mulai lalu pilih "Izinkan" (sebaiknya "Selalu izinkan" bila ditawarkan).</div>';
    if (native && !S.battFree) w += '<div class="warn">Penghematan baterai belum dimatikan untuk HZ Trip. Buka Pengaturan agar perekaman tidak dimatikan sistem.</div>';
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
    S.todayPts.push({ t: f.t, lat: f.lat, lng: f.lng, v: f.v * 3.6, acc: f.acc });
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
  function syncStatus() {
    return Plug.status().then(function (s) {
      S.rec = !!s.recording; S.perm = !!s.permission; S.battFree = !!s.batteryFree;
      if (s.lastT && s.recording) S.live = { v: s.lastV * 3.6, acc: s.lastAcc, t: S.live.t, count: s.count };
      renderSpido();
    }).catch(function () {});
  }

  function toggleRec() {
    if (S.rec) {
      Plug.stop().then(function () { S.rec = false; renderSpido(); toast('Perekaman diakhiri'); });
      return;
    }
    Plug.ensurePermissions().then(function (r) {
      S.perm = !!r.granted;
      if (!r.granted) { renderSpido(); toast('Izin lokasi diperlukan untuk merekam'); return; }
      return Plug.start().then(function () { S.rec = true; S.live.t = 0; renderSpido(); });
    }).catch(function (e) { toast(String(e && e.message || e)); });
  }

  // ---------- riwayat ----------
  function tripView(t) {
    var o = S.ov.trips[t.id] || {};
    return { t: t, unit: o.unit || S.settings.defUnit, label: o.label || null, hist: o.hist || [] };
  }
  function loadHistory() {
    Plug.readDay({ date: S.hDay }).then(function (r) {
      var res = T.detectTrips(T.parseCsv(r.text), opts());
      S.hTrips = res.trips.map(tripView);
      renderHistory();
    }).catch(function () { S.hTrips = []; renderHistory(); });
  }
  function labelChip(l) {
    if (l === 'Kerja') return '<span class="chip k">Kerja</span>';
    if (l === 'Pribadi') return '<span class="chip p">Pribadi</span>';
    return '<span class="chip n">Label?</span>';
  }
  function renderHistory() {
    $('dLabel').textContent = T.dateLong(S.hDay);
    $('dPick').value = S.hDay;
    $('dNext').style.opacity = S.hDay >= T.ymd(Date.now()) ? '.3' : '1';
    var list = S.hTrips, box = $('daySum'), km = 0, mx = 0, zg = 0, zy = 0, zr = 0;
    list.forEach(function (x) { km += x.t.km; mx = Math.max(mx, x.t.max); zg += x.t.zg; zy += x.t.zy; zr += x.t.zr; });
    if (!list.length) {
      box.innerHTML = '';
      $('tripList').innerHTML = '<div class="empty">Belum ada trip pada hari ini.<br>Trip tercatat otomatis saat Anda berkendara dengan perekaman menyala.</div>';
      return;
    }
    var tot = zg + zy + zr || 1;
    box.innerHTML = '<div class="card"><div class="sum"><div><b>' + list.length + '</b><small>trip</small></div><div><b>' + T.km1(km) + '</b><small>km</small></div><div><b style="color:' + zc(mx) + '">' + Math.round(mx) + '</b><small>maks km/j</small></div></div>' +
      '<div class="zbar"><div style="flex:' + zg / tot + ';background:var(--g)"></div><div style="flex:' + zy / tot + ';background:var(--y)"></div><div style="flex:' + zr / tot + ';background:var(--r)"></div></div>' +
      '<div class="muted" style="margin-top:8px">Waktu bergerak: hijau ' + T.durText(zg) + ' · kuning ' + T.durText(zy) + ' · merah ' + T.durText(zr) + '</div></div>';
    $('tripList').innerHTML = list.map(function (x, i) {
      var t = x.t;
      return '<button class="trip" data-i="' + i + '"><div class="t1"><span class="tm">' + T.hm(t.start) + ' – ' + T.hm(t.end) + (t.open ? ' ●' : '') + '</span><span class="chip">' + esc(x.unit) + '</span>' + labelChip(x.label) + '</div>' +
        '<div class="t2"><div><small>DURASI</small><b style="font-size:18px">' + T.durText(t.durSec) + '</b></div><div><small>MIN</small><b>' + Math.round(t.min) + '</b></div><div><small>MAKS</small><b style="color:' + zc(t.max) + '">' + Math.round(t.max) + '</b></div><div><small>KM</small><b>' + T.km1(t.km) + '</b></div></div></button>';
    }).join('');
  }
  function shiftDay(n) {
    var p = S.hDay.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    var nd = T.ymd(d.getTime());
    if (nd > T.ymd(Date.now())) return;
    S.hDay = nd; loadHistory();
  }

  function openTrip(i) {
    var x = S.hTrips[i], t = x.t;
    var uOpts = S.settings.units.map(function (u) { return '<button class="opt' + (u === x.unit ? ' on' : '') + '" data-u="' + esc(u) + '">' + esc(u) + '</button>'; }).join('');
    var lOpts = ['Kerja', 'Pribadi'].map(function (l) { return '<button class="opt' + (l === x.label ? ' on' : '') + '" data-l="' + l + '">' + l + '</button>'; }).join('') +
      '<button class="opt" data-l="">Kosongkan</button>';
    var hist = x.hist.length ? x.hist.map(function (h) {
      return '<div class="kv"><span>' + T.hm(h.at) + ' · ' + esc(h.f) + '</span><span>' + esc(h.from || '–') + ' → ' + esc(h.to || '–') + '</span></div>';
    }).join('') : '<div class="muted">Belum ada perubahan.</div>';
    openSheet('<div class="grab"></div><div class="st">TRIP ' + T.hm(t.start) + ' – ' + T.hm(t.end) + '</div>' +
      '<div class="h">UNIT</div><div class="opts" id="uOpts">' + uOpts + '</div>' +
      '<div class="h">LABEL</div><div class="opts" id="lOpts">' + lOpts + '</div>' +
      '<div class="h">RINCIAN</div>' +
      '<div class="kv"><span>Jarak</span><span>' + T.km1(t.km) + ' km</span></div>' +
      '<div class="kv"><span>Kecepatan min / maks / rata-rata</span><span>' + Math.round(t.min) + ' / ' + Math.round(t.max) + ' / ' + Math.round(t.avg) + ' km/j</span></div>' +
      '<div class="kv"><span>Titik tercepat</span><span>' + T.hm(t.maxT) + '</span></div>' +
      '<div class="kv"><span>Hijau / kuning / merah</span><span>' + T.durText(t.zg) + ' / ' + T.durText(t.zy) + ' / ' + T.durText(t.zr) + '</span></div>' +
      '<div class="kv"><span>Titik GPS</span><span>' + t.n + '</span></div>' +
      '<div class="h">RIWAYAT PERUBAHAN</div>' + hist +
      '<button class="btn" id="shClose" style="width:100%;margin-top:14px">Tutup</button>');
    $('shClose').onclick = closeSheet;
    $('uOpts').onclick = function (e) { var u = e.target.getAttribute && e.target.getAttribute('data-u'); if (u) change(i, 'unit', u); };
    $('lOpts').onclick = function (e) { var l = e.target.getAttribute && e.target.getAttribute('data-l'); if (l !== null && l !== undefined) change(i, 'label', l || null); };
  }
  function change(i, field, val) {
    var x = S.hTrips[i], id = x.t.id;
    var o = S.ov.trips[id] || (S.ov.trips[id] = { hist: [] });
    var from = field === 'unit' ? x.unit : x.label;
    if (from === val) return;
    o[field] = val;
    o.hist = (o.hist || []).concat([{ at: Date.now(), f: field === 'unit' ? 'Unit' : 'Label', from: from, to: val }]);
    saveOv();
    x[field] = val; x.hist = o.hist;
    renderHistory();
    openTrip(i);
  }

  // ---------- pengaturan ----------
  function renderSettings() {
    $('unitBox').innerHTML = S.settings.units.map(function (u, i) {
      var d = u === S.settings.defUnit;
      return '<div class="unit"><span>' + esc(u) + (d ? ' <small class="muted">· bawaan</small>' : '') + '</span>' +
        (d ? '' : '<button class="btn sm" data-def="' + i + '">Jadikan bawaan</button>') +
        (S.settings.units.length > 1 ? '<button class="btn sm" data-del="' + i + '">Hapus</button>' : '') + '</div>';
    }).join('');
    $('splitSel').value = String(S.settings.splitSec);
    $('setStat').textContent = (S.perm ? 'Izin lokasi: sudah diberikan. ' : 'Izin lokasi: belum diberikan. ') + (native ? (S.battFree ? 'Penghematan baterai: dimatikan untuk HZ Trip (bagus).' : 'Penghematan baterai: belum dimatikan.') : 'Mode uji di browser.');
  }
  function addUnit() {
    var v = $('unitNew').value.trim();
    if (!v) return;
    if (S.settings.units.indexOf(v) >= 0) { toast('Unit sudah ada'); return; }
    S.settings.units.push(v); $('unitNew').value = ''; saveSettings(); renderSettings();
  }

  // ---------- pasang ----------
  function init() {
    $('btnMenu').onclick = openDrawer;
    $('scrim').onclick = function () { closeSheet(); $('drawer').classList.remove('on'); };
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.onclick = function () { go(a.getAttribute('data-go')); }; });
    $('btnRec').onclick = toggleRec;
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
    $('btnBatt').onclick = function () { Plug.openBatterySettings().catch(function () { toast('Tidak bisa membuka pengaturan baterai'); }); };

    Plug.addListener('fix', onFix);
    Plug.addListener('state', function (s) { S.rec = !!s.recording; if (!s.recording) S.live.t = 0; renderSpido(); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { syncStatus(); refreshToday().then(renderSpido); if (S.view === 'riwayat') loadHistory(); }
    });
    setInterval(function () { if (S.view === 'spido' && !document.hidden) renderSpido(); }, 1000);

    loadMeta().then(function () { return Promise.all([syncStatus(), refreshToday()]); }).then(function () { renderSpido(); });
    renderSpido();
  }
  init();
})();
