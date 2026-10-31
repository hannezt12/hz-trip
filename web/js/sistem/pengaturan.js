/* HZ Trip - trip dihapus, pengaturan, simpan/bagikan, ekspor, cetak */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, E = HA.E, HARI = HA.HARI, native = HA.native, Plug = HA.Plug, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function showErr() { return HA.showErr.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function saveOv() { return HA.saveOv.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function pushSchedule() { return HA.pushSchedule.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function typeOf() { return HA.typeOf.apply(this, arguments); }
  function renderUnitCard() { return HA.renderUnitCard.apply(this, arguments); }
  function detectDay() { return HA.detectDay.apply(this, arguments); }
  function edited() { return HA.edited.apply(this, arguments); }
  function tripView() { return HA.tripView.apply(this, arguments); }
  function renderSetMenu() { return HA.renderSetMenu.apply(this, arguments); }
  function climbSeq() { return HA.climbSeq.apply(this, arguments); }
  function kmlPrep() { return HA.kmlPrep.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.renderHidden = renderHidden;
  HA.purgeExpired = purgeExpired;
  HA.onHidden = onHidden;
  HA.renderSched = renderSched;
  HA.renderSettings = renderSettings;
  HA.addUnit = addUnit;
  HA.onSched = onSched;
  HA.textB64 = textB64;
  HA.saveFile = saveFile;
  HA.loadDay = loadDay;
  HA.openPrint = openPrint;

  // ---------- trip dihapus ----------
  function renderHidden() {
    var box = $('hidList');
    if (!box) return;
    var hs = (S.ov.hidden || []).slice().sort(function (a, b) { return b.at - a.at; });
    if (!hs.length) { box.textContent = 'Tidak ada.'; return; }
    box.innerHTML = hs.map(function (h) {
      var left = Math.max(0, Math.ceil((h.at + HA.KEEP_MS - Date.now()) / 86400000));
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
    var now = Date.now(), old = (S.ov.hidden || []).filter(function (h) { return h.at + HA.KEEP_MS <= now && h.day < T.ymd(now); });
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
  HA.openDay = -1;
  function daySummary(x) {
    if (!x['in'] || !x.out) return 'Libur';
    var t = x['in'].replace(':', '.') + ' – ' + x.out.replace(':', '.');
    if (x.brk && x.brkFrom && x.brkTo) t += ' · istirahat ' + x.brkFrom.replace(':', '.') + '–' + x.brkTo.replace(':', '.');
    return t;
  }
  function renderSched() {
    var box = $('schedBox'), sc = S.settings.schedule, m = S.settings.margin;
    box.innerHTML = ORDER.map(function (d) {
      var x = sc.days[d], open = d === HA.openDay;
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
})();
