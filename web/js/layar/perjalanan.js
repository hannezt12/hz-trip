/* HZ Trip - Perjalanan: kelompok trip lintas hari, dibuat manual (v0.15.0) */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, S = HA.S;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return HA.esc(s); }
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function groups() { return S.ov.groups || (S.ov.groups = []); }
  function sd(ymd) { var p = ymd.split('-'); return (+p[2]) + ' ' + BLN[+p[1] - 1]; }
  function lab(l) { return '<span class="chip ' + (l === 'Kerja' ? 'k' : 'p') + '">' + l + '</span>'; }
  function span(g) {
    var ds = g.m.map(function (m) { return m.d; }).sort();
    if (!ds.length) return { a: '', b: '', n: 0 };
    var u = ds.filter(function (d, i) { return ds.indexOf(d) === i; });
    return { a: u[0], b: u[u.length - 1], n: u.length };
  }
  // trip -> perjalanan yang memuatnya (atau null)
  function pjOf(day, t) {
    var gs = groups();
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      for (var k = 0; k < g.m.length; k++) {
        var m = g.m[k];
        if (m.d === day && (m.id === t.id || (t.start <= m.e && t.end >= m.s))) return { g: g, label: (g.dl && g.dl[day]) || g.label };
      }
    }
    return null;
  }
  HA.pjOf = pjOf;
  HA.pjHtml = function () {
    var gs = groups().slice().sort(function (a, b) { return span(b).b < span(a).b ? -1 : 1; });
    var h = '<div class="pjH"><b>PERJALANAN</b><button class="btn sm" id="pjNew">+ Buat perjalanan</button></div>';
    if (!gs.length) return h + '<div class="muted" style="margin-bottom:8px">Gabungkan trip dari beberapa tanggal (misalnya dinas luar kota) menjadi satu perjalanan.</div>';
    return h + gs.map(function (g) {
      var s = span(g), su = g.sum || {};
      return '<button class="pjr" data-g="' + g.id + '"><div class="pjn"><b>' + esc(g.name) + '</b>' + lab(g.label) + '</div><div class="pjs">' +
        (s.a === s.b ? sd(s.a) : sd(s.a) + ' – ' + sd(s.b)) + ' · ' + s.n + ' hari · ' + g.m.length + ' trip' + (su.km != null ? ' · ' + T.km1(su.km) + ' km' : '') + '</div></button>';
    }).join('');
  };
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('#pjNew')) { openForm(null); return; }
    var b = t.closest('.pjr');
    if (b) openGroup(b.getAttribute('data-g'));
  });
  function byId(id) { var gs = groups(); for (var i = 0; i < gs.length; i++) if (gs[i].id === id) return gs[i]; return null; }
  function refreshList() { if (S.view === 'riwayat' && S.hMode === 'list') { $('monthView').innerHTML = ''; HA.loadRiwayat(); } else if (S.view === 'riwayat') HA.loadHistory(); }

  // ---------- form buat / ubah ----------
  var F = null;
  function openForm(g) {
    var today = T.ymd(Date.now()), yest = T.ymd(Date.now() - 86400000), sp = g ? span(g) : null;
    F = { g: g, days: [], chk: {} };
    if (g) g.m.forEach(function (m) { F.chk[m.d + '|' + m.id] = 1; });
    HA.openSheet('<div class="grab"></div><div class="st">' + (g ? 'UBAH PERJALANAN' : 'PERJALANAN BARU') + '</div>' +
      '<div class="muted" style="margin:4px 0">Nama perjalanan</div><input type="text" id="pjName" maxlength="40" placeholder="mis. Bandar Lampung" value="' + esc(g ? g.name : '') + '">' +
      '<div class="pgrid" style="margin-top:8px"><div><div class="muted">Dari tanggal</div><input type="date" id="pjFrom" max="' + today + '" value="' + (sp ? sp.a : yest) + '"></div>' +
      '<div><div class="muted">Sampai</div><input type="date" id="pjTo" max="' + today + '" value="' + (sp ? sp.b : today) + '"></div></div>' +
      '<div class="h">LABEL</div><div class="seg" id="pjLab"><button data-l="Kerja"' + (!g || g.label === 'Kerja' ? ' class="on"' : '') + '>Kerja</button><button data-l="Pribadi"' + (g && g.label === 'Pribadi' ? ' class="on"' : '') + '>Pribadi</button></div>' +
      '<div class="h">PILIH TRIP</div><div id="pjTrips"><div class="muted">Menghitung…</div></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" id="pjCancel" style="flex:1">Batal</button><button class="btn pri" id="pjSave" style="flex:1.4">Simpan</button></div>');
    $('pjCancel').onclick = function () { if (g) openGroup(g.id); else HA.closeSheet(); };
    $('pjLab').onclick = function (e) { var b = e.target.getAttribute && e.target.getAttribute('data-l'); if (!b) return; [].forEach.call($('pjLab').children, function (c) { c.className = c.getAttribute('data-l') === b ? 'on' : ''; }); };
    $('pjFrom').onchange = $('pjTo').onchange = loadRange;
    $('pjTrips').onchange = function (e) { var k = e.target.getAttribute('data-k'); if (!k) return; if (e.target.checked) F.chk[k] = 1; else delete F.chk[k]; sync(); };
    $('pjSave').onclick = save;
    loadRange();
  }
  function rangeDays(a, b) {
    var out = [], x = a.split('-'), y = b.split('-'), d = new Date(+x[0], +x[1] - 1, +x[2]), e = new Date(+y[0], +y[1] - 1, +y[2]);
    while (d <= e && out.length < 21) { out.push(T.ymd(d.getTime())); d.setDate(d.getDate() + 1); }
    return out;
  }
  var seq = 0;
  function loadRange() {
    var a = $('pjFrom').value, b = $('pjTo').value, my = ++seq;
    if (!a || !b || b < a) { $('pjTrips').innerHTML = '<div class="muted">Tanggal tidak valid.</div>'; return; }
    var ds = rangeDays(a, b);
    Promise.all(ds.map(HA.loadDayView)).then(function (rows) {
      if (my !== seq || !$('pjTrips')) return;
      F.days = rows.filter(function (r) { return r.trips.length; });
      var h = '';
      F.days.forEach(function (d) {
        h += '<div class="pjD">' + T.dateLong(d.ymd) + '</div>';
        d.trips.forEach(function (x) {
          var k = d.ymd + '|' + x.t.id, o = pjOf(d.ymd, x.t), other = o && (!F.g || o.g.id !== F.g.id);
          h += '<label class="pjT' + (other ? ' off' : '') + '"><input type="checkbox" data-k="' + k + '"' + (F.chk[k] ? ' checked' : '') + (other ? ' disabled' : '') + '> <span>' + T.hm(x.t.start) + ' – ' + T.hm(x.t.end) + ' · ' + esc(x.unit) + ' · ' + T.km1(x.t.km) + ' km' + (other ? ' · sudah di ' + esc(o.g.name) : '') + '</span></label>';
        });
      });
      $('pjTrips').innerHTML = h || '<div class="muted">Tidak ada trip pada rentang ini.</div>';
      sync();
    });
  }
  function sync() {
    var n = Object.keys(F.chk).length;
    if ($('pjSave')) { $('pjSave').disabled = n < 1; $('pjSave').textContent = 'Simpan' + (n ? ' (' + n + ' trip)' : ''); }
  }
  function save() {
    var name = $('pjName').value.trim();
    if (!name) { HA.toast('Isi nama perjalanan'); return; }
    var label = ($('pjLab').querySelector('.on') || $('pjLab').firstChild).getAttribute('data-l'), m = [];
    F.days.forEach(function (d) { d.trips.forEach(function (x) { if (F.chk[d.ymd + '|' + x.t.id]) m.push({ d: d.ymd, id: x.t.id, s: x.t.start, e: x.t.end }); }); });
    // trip lama yang tidak tampil di rentang (mis. rentang diubah) tetap dipertahankan
    if (F.g) F.g.m.forEach(function (o) { if (F.chk[o.d + '|' + o.id] && !m.some(function (z) { return z.d === o.d && z.id === o.id; })) m.push(o); });
    if (!m.length) { HA.toast('Pilih minimal satu trip'); return; }
    var g = F.g;
    if (!g) { g = { id: 'pj' + Date.now(), name: name, label: label, dl: {}, m: m }; groups().push(g); }
    else { g.name = name; g.label = label; g.m = m; g.dl = g.dl || {}; Object.keys(g.dl).forEach(function (d) { if (g.dl[d] === label || !m.some(function (z) { return z.d === d; })) delete g.dl[d]; }); }
    HA.saveOv();
    HA.toast('Perjalanan "' + name + '" tersimpan');
    refreshList();
    openGroup(g.id);
  }

  // ---------- rincian ----------
  function openGroup(id) {
    var g = byId(id);
    if (!g) { HA.closeSheet(); return; }
    HA.openSheet('<div class="grab"></div><div class="st">PERJALANAN</div><div class="muted">Menghitung…</div>');
    HA.groupDays(g).then(function (ds) {
      var n = 0, km = 0, mx = 0, du = 0, w = 0;
      ds.forEach(function (d) { d.trips.forEach(function (x) { n++; km += x.t.km; mx = Math.max(mx, x.t.max); du += x.t.durSec; w += x.t.avg * x.t.durSec; }); });
      g.sum = { km: km, n: n }; HA.saveOv();
      var rows = ds.map(function (d) {
        var k = 0, c = 0, eff = (g.dl && g.dl[d.ymd]) || g.label;
        d.trips.forEach(function (x) { k += x.t.km; c++; });
        return '<div class="pjDay"><span>' + T.dateLong(d.ymd) + '<small>' + c + ' trip · ' + T.km1(k) + ' km</small></span><button class="chip ' + (eff === 'Kerja' ? 'k' : 'p') + '" data-dl="' + d.ymd + '">' + eff + '</button></div>';
      }).join('');
      var sp = span(g);
      HA.openSheet('<div class="grab"></div><div class="st">PERJALANAN</div>' +
        '<div class="pjT1"><b>' + esc(g.name) + '</b>' + lab(g.label) + '</div>' +
        '<div class="muted">' + (sp.a === sp.b ? T.dateLong(sp.a) : T.dateLong(sp.a) + ' – ' + T.dateLong(sp.b)) + '</div>' +
        '<div class="sum" style="margin:10px 0;display:grid;grid-template-columns:repeat(4,1fr)"><div><b>' + sp.n + '</b><small>hari</small></div><div><b>' + n + '</b><small>trip</small></div><div><b>' + T.km1(km) + '</b><small>km</small></div><div><b style="color:' + HA.zc(mx) + '">' + Math.round(mx) + '</b><small>maks km/j</small></div></div>' +
        '<div class="muted">Waktu berjalan ' + T.durText(du) + ' · rata-rata ' + Math.round(du ? w / du : 0) + ' km/j</div>' +
        '<div class="h">LABEL PER HARI (ketuk untuk ganti)</div>' + rows +
        '<div class="h">CETAK / EKSPOR</div>' +
        '<button class="btn pri" id="pjPdfT" style="width:100%;height:48px">PDF · satu lembar total</button>' +
        '<button class="btn" id="pjPdfD" style="width:100%;margin-top:8px;height:48px">PDF · total + rincian per hari</button>' +
        '<button class="btn" id="pjKml" style="width:100%;margin-top:8px;height:48px">KML · seluruh rute</button>' +
        '<div class="row" style="margin-top:12px"><button class="btn" id="pjEdit" style="flex:1">Ubah isi</button><button class="btn danger" id="pjDel" style="flex:1">Bongkar</button></div>' +
        '<button class="btn" id="pjX" style="width:100%;margin-top:8px">Tutup</button>');
      $('pjX').onclick = function () { HA.closeSheet(); refreshList(); };
      $('pjEdit').onclick = function () { openForm(g); };
      $('pjPdfT').onclick = function () { HA.groupExport(g, 'pdf-total'); };
      $('pjPdfD').onclick = function () { HA.groupExport(g, 'pdf-hari'); };
      $('pjKml').onclick = function () { HA.groupExport(g, 'kml'); };
      $('pjDel').onclick = function () {
        HA.askConfirm('Bongkar perjalanan "' + g.name + '"?', 'Hanya pengelompokan yang dilepas. Trip dan data GPS tidak berubah.', 'Bongkar', function () {
          S.ov.groups = groups().filter(function (z) { return z.id !== g.id; });
          HA.saveOv(); HA.closeSheet(); HA.toast('Perjalanan dibongkar'); refreshList();
        });
      };
      document.querySelectorAll('#sheet [data-dl]').forEach(function (b) {
        b.onclick = function () {
          var d = b.getAttribute('data-dl'), cur = (g.dl && g.dl[d]) || g.label, nx = cur === 'Kerja' ? 'Pribadi' : 'Kerja';
          g.dl = g.dl || {};
          if (nx === g.label) delete g.dl[d]; else g.dl[d] = nx;
          HA.saveOv(); openGroup(g.id);
        };
      });
    });
  }
})();
