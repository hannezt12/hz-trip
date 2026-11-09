/* HZ Trip - Tempat (pagar virtual) dan impor Google Timeline (v0.15.1) */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S, Plug = HA.Plug, T = HA.T;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return HA.esc(s); }
  function places() { return S.settings.places || (S.settings.places = []); }

  // ---------- Tempat ----------
  HA.pushPlaces = function () {
    return Plug.setPlaces({ places: places().map(function (p) { return { lat: p.lat, lng: p.lng, r: p.r }; }) }).then(function (st) { if (HA.applyStatus) HA.applyStatus(st); }).catch(function () {});
  };
  // tempat yang sedang dimasuki menurut native (id "hzp<indeks>")
  HA.placeNow = function () {
    var ids = (S.inPlaces || '').split(',').filter(function (x) { return x; });
    for (var i = 0; i < ids.length; i++) { var p = places()[+ids[i].replace('hzp', '')]; if (p) return p; }
    return null;
  };
  function save() { HA.saveSettings(); HA.pushPlaces(); HA.renderTempat(); if (HA.renderSetMenu && !S.setPage) HA.renderSetMenu(); }
  HA.renderTempat = function () {
    var box = $('tempatBox');
    if (!box) return;
    var ps = places();
    box.innerHTML = ps.length ? ps.map(function (p, i) {
      var now = S.inPlaces && S.inPlaces.split(',').indexOf('hzp' + i) >= 0;
      return '<div class="unit"><span><b>' + esc(p.name) + '</b>' + (now ? ' <span class="chip k">sedang di sini</span>' : '') + '<br><small class="muted">' + p.r + ' m · ' + p.lat.toFixed(5) + ', ' + p.lng.toFixed(5) + '</small></span>' +
        '<button class="btn sm" data-tp="' + i + '">Ubah</button></div>';
    }).join('') : '<div class="muted">Belum ada tempat. Berdiri di rumah atau kantor, lalu ketuk tombol di bawah.</div>';
  };
  function here() {
    return new Promise(function (res, rej) {
      if (!navigator.geolocation) { rej(new Error('Lokasi tidak tersedia')); return; }
      navigator.geolocation.getCurrentPosition(function (p) { res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); },
        function (e) { rej(new Error(e && e.code === 1 ? 'Izin lokasi ditolak' : 'Lokasi belum didapat, coba lagi di tempat terbuka')); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
    });
  }
  var NAMES = ['Rumah', 'Kantor'];
  function form(idx) {
    var p = idx == null ? null : places()[idx];
    var def = p ? p.name : (NAMES[places().length] || 'Tempat ' + (places().length + 1));
    var cur = p ? { lat: p.lat, lng: p.lng } : null;
    HA.openSheet('<div class="grab"></div><div class="st">' + (p ? 'UBAH TEMPAT' : 'TEMPAT BARU') + '</div>' +
      '<div class="muted" style="margin:6px 0 4px">Nama</div><input type="text" id="tpName" maxlength="30" value="' + esc(def) + '">' +
      '<div class="muted" style="margin:10px 0 4px">Radius (meter, minimal 100; 1000 = 1 km)</div><input type="number" id="tpR" inputmode="numeric" min="100" step="50" value="' + (p ? p.r : 500) + '">' +
      '<div class="muted" id="tpPos" style="margin-top:10px">' + (p ? 'Pusat: ' + p.lat.toFixed(5) + ', ' + p.lng.toFixed(5) : 'Mengambil lokasi…') + '</div>' +
      (p ? '<button class="btn" id="tpHere" style="width:100%;margin-top:8px">Pindahkan pusat ke lokasi saya sekarang</button>' : '') +
      '<div class="row" style="margin-top:12px"><button class="btn" id="tpCancel" style="flex:1">Batal</button><button class="btn pri" id="tpSave" style="flex:1.4"' + (p ? '' : ' disabled') + '>Simpan</button></div>' +
      (p ? '<button class="btn danger" id="tpDel" style="width:100%;margin-top:8px">Hapus tempat</button>' : ''));
    function setPos(q) { cur = q; $('tpPos').textContent = 'Pusat: ' + q.lat.toFixed(5) + ', ' + q.lng.toFixed(5) + (q.acc ? ' (±' + Math.round(q.acc) + ' m)' : ''); $('tpSave').disabled = false; }
    if (!p) here().then(setPos).catch(function (e) { if ($('tpPos')) $('tpPos').textContent = e.message; });
    if (p) $('tpHere').onclick = function () { $('tpPos').textContent = 'Mengambil lokasi…'; here().then(setPos).catch(function (e) { $('tpPos').textContent = e.message; }); };
    $('tpCancel').onclick = HA.closeSheet;
    $('tpSave').onclick = function () {
      var name = $('tpName').value.trim() || def, r = Math.round(+$('tpR').value);
      if (!isFinite(r) || r < 100) { HA.toast('Radius minimal 100 meter'); return; }
      if (!cur) { HA.toast('Lokasi belum didapat'); return; }
      var o = { id: p ? p.id : 'tp' + Date.now(), name: name, lat: cur.lat, lng: cur.lng, r: r };
      if (p) places()[idx] = o; else places().push(o);
      HA.closeSheet(); HA.toast('Tempat "' + name + '" tersimpan'); save();
    };
    if (p) $('tpDel').onclick = function () {
      HA.askConfirm('Hapus tempat "' + p.name + '"?', 'Di sekitar tempat ini HZ Trip akan merekam otomatis lagi.', 'Hapus', function () { places().splice(idx, 1); HA.toast('Tempat dihapus'); save(); });
    };
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    if (t.closest('#tpAdd')) { form(null); return; }
    var b = t.closest('[data-tp]');
    if (b) form(+b.getAttribute('data-tp'));
  });

  // ---------- Impor Google Timeline ----------
  var G = window.HzGoogle;
  function readText(f) { return f.text ? f.text() : new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsText(f); }); }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#gtBtn')) $('gtFile').click(); });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'gtFile' || !e.target.files || !e.target.files[0]) return;
    var f = e.target.files[0]; e.target.value = '';
    HA.toast('Membaca berkas…');
    readText(f).then(function (txt) {
      var r = G.parse(txt);
      if (!r.pts.length) { HA.toast('Tidak ada titik lokasi di berkas ini'); return; }
      gtSheet(r);
    }).catch(function (x) { HA.toast('Berkas tidak bisa dibaca: ' + (x && x.message || x)); });
  });
  function gtSheet(r) {
    var today = T.ymd(Date.now()), first = G.ymd(r.pts[0].t), last = G.ymd(r.pts[r.pts.length - 1].t);
    var def = T.ymd(Date.now() - 29 * 86400000); if (def < first) def = first;
    var to = last < today ? last : T.ymd(Date.now() - 86400000);
    HA.openSheet('<div class="grab"></div><div class="st">IMPOR GOOGLE TIMELINE</div>' +
      '<div class="muted" style="margin:6px 0">' + r.pts.length + ' titik · ' + T.dateLong(first) + ' sampai ' + T.dateLong(last) + '</div>' +
      '<div class="pgrid"><div><div class="muted">Dari tanggal</div><input type="date" id="gtFrom" value="' + def + '" max="' + today + '"></div><div><div class="muted">Sampai</div><input type="date" id="gtTo" value="' + to + '" max="' + to + '"></div></div>' +
      '<div class="muted" id="gtInfo" style="margin-top:10px"></div>' +
      '<div class="muted" style="margin-top:6px">Hari ini tidak ikut diimpor. Titik asli HZ Trip tetap; hanya celah yang diisi.</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" id="gtNo" style="flex:1">Batal</button><button class="btn pri" id="gtGo" style="flex:1.4">Impor</button></div>');
    function sumInfo() {
      var d = G.byDay(r.pts, $('gtFrom').value, $('gtTo').value), n = 0, k = Object.keys(d);
      k.forEach(function (x) { n += d[x].length; });
      $('gtInfo').textContent = n + ' titik pada ' + k.length + ' hari akan diperiksa.';
      return d;
    }
    sumInfo();
    $('gtFrom').onchange = $('gtTo').onchange = sumInfo;
    $('gtNo').onclick = HA.closeSheet;
    $('gtGo').onclick = function () {
      var d = sumInfo(), days = Object.keys(d).filter(function (x) { return x < today; }).sort(), added = 0, done = 0;
      if (!days.length) { HA.toast('Tidak ada hari untuk diimpor'); return; }
      $('gtGo').disabled = true; $('gtInfo').textContent = 'Mengimpor…';
      function next() {
        if (done >= days.length) {
          if (HA.sumReset) HA.sumReset();
          HA.closeSheet(); HA.toast(added + ' titik diimpor dari Google (' + days.length + ' hari)');
          if (S.view === 'riwayat') HA.loadRiwayat();
          return;
        }
        var day = days[done++];
        Plug.readDay({ date: day }).then(function (ex) {
          var m = G.mergeDay(ex.text || '', d[day], 180);
          if (!m.added) return null;
          added += m.added;
          return Plug.writeDay({ date: day, text: m.text, overwrite: '1' });
        }).then(next).catch(function (x) { HA.toast('Gagal menulis ' + day + ': ' + (x && x.message || x)); next(); });
      }
      next();
    };
  }
})();
