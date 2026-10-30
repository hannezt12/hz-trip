/* HZ Trip - spidometer */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, HARI = HA.HARI, native = HA.native, Plug = HA.Plug, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function zc() { return HA.zc.apply(this, arguments); }
  function opts() { return HA.opts.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function applyStatus() { return HA.applyStatus.apply(this, arguments); }
  function syncStatus() { return HA.syncStatus.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function renderBkNote() { return HA.renderBkNote.apply(this, arguments); }
  function spOnFix() { return HA.spOnFix.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.renderSpido = renderSpido;
  HA.recomputeLive = recomputeLive;
  HA.onFix = onFix;
  HA.refreshToday = refreshToday;
  HA.toggleRec = toggleRec;
  HA.askBackground = askBackground;
  HA.openBatt = openBatt;
  HA.onModeAction = onModeAction;

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
    if (HA.SP.active) spOnFix(f);
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
})();
