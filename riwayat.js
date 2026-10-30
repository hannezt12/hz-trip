/* HZ Trip - riwayat dan ringkasan 30 hari */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, Plug = HA.Plug, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function zc() { return HA.zc.apply(this, arguments); }
  function opts() { return HA.opts.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function saveOv() { return HA.saveOv.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function openPrint() { return HA.openPrint.apply(this, arguments); }
  function refreshMini() { return HA.refreshMini.apply(this, arguments); }
  function climbOfTrip() { return HA.climbOfTrip.apply(this, arguments); }
  function climbSeq() { return HA.climbSeq.apply(this, arguments); }
  function showMap() { return HA.showMap.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.typeOf = typeOf;
  HA.unitAt = unitAt;
  HA.setUnit = setUnit;
  HA.fixSlotsAfterDelete = fixSlotsAfterDelete;
  HA.renderUnitCard = renderUnitCard;
  HA.detectDay = detectDay;
  HA.edited = edited;
  HA.tripView = tripView;
  HA.loadRiwayat = loadRiwayat;
  HA.loadHistory = loadHistory;
  HA.renderHistory = renderHistory;
  HA.exitSel = exitSel;
  HA.toggleSel = toggleSel;
  HA.doMerge = doMerge;
  HA.shiftDay = shiftDay;
  HA.openTrip = openTrip;

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
  HA.KEEP_MS = 30 * 24 * 3600000;
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
})();
