/* HZ Trip - cache peta, tampilan, cadangan, merampingkan data */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, native = HA.native, Plug = HA.Plug, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function opts() { return HA.opts.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function saveOv() { return HA.saveOv.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function syncStatus() { return HA.syncStatus.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function unitAt() { return HA.unitAt.apply(this, arguments); }
  function renderHidden() { return HA.renderHidden.apply(this, arguments); }
  function renderSettings() { return HA.renderSettings.apply(this, arguments); }
  function saveFile() { return HA.saveFile.apply(this, arguments); }
  function renderBlkInfo() { return HA.renderBlkInfo.apply(this, arguments); }
  function ovList() { return HA.ovList.apply(this, arguments); }
  function renderOv() { return HA.renderOv.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.cachedLayerClass = cachedLayerClass;
  HA.demAfter = demAfter;
  HA.demImport = demImport;
  HA.renderSatNat = renderSatNat;
  HA.renderCacheInfo = renderCacheInfo;
  HA.applyFont = applyFont;
  HA.applyTheme = applyTheme;
  HA.renderSetMenu = renderSetMenu;
  HA.showSet = showSet;
  HA.openSet = openSet;
  HA.backSet = backSet;
  HA.blobB64 = blobB64;
  HA.autoBackup = autoBackup;
  HA.makeBackup = makeBackup;
  HA.readBackup = readBackup;
  HA.restoreBackup = restoreBackup;
  HA.renderDiag = renderDiag;
  HA.renderThinInfo = renderThinInfo;
  HA.startThin = startThin;
  HA.renderBkNote = renderBkNote;

  // ---------- cache peta (IndexedDB) ----------
  HA.TC = (function () {
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

  if (window.HzDem) HzDem.setStore(HA.TC);
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
        HA.TC.get(url).then(function (blob) {
          if (blob) { show(URL.createObjectURL(blob), true); return; }
          if (typeof fetch !== 'function') { show(url, false); return; }
          fetch(url, { mode: 'cors' }).then(function (r) { if (!r.ok) throw new Error('x'); return r.blob(); }).then(function (b) {
            HA.TC.put(url, b); show(URL.createObjectURL(b), true);
          }).catch(function () { show(url, false); });
        });
        return img;
      }
    });
    return CachedLayer;
  }
  function fmtMB(b) { return (b / 1048576).toFixed(1).replace('.', ','); }
  function renderDemInfo() {
    if (!$('demInfo') || !window.HzDem) return;
    HzDem.localInfo().then(function (r) {
      if (!r.sheets.length) { $('demInfo').textContent = 'Belum ada data. Kontur memakai data gratis (±30 m, perlu internet).'; $('demDel').style.display = 'none'; return; }
      var b = r.bbox;
      $('demInfo').innerHTML = '<b>' + r.sheets.length + ' lembar</b> · ' + r.tiles + ' kotak · ' + fmtMB(r.bytes) + ' MB<br>' + r.sheets.map(function (q) { return esc(q.name); }).join('<br>') + '<br>Area: ' + b[1].toFixed(3) + '…' + b[3].toFixed(3) + '°, ' + b[0].toFixed(3) + '…' + b[2].toFixed(3) + '°';
      $('demDel').style.display = '';
    });
  }
  function demAfter() {
    if (window.HzDem) HzDem.resetMem();
    HA.CL.clear();
    if (HA.DM.layer) HA.DM.layer.redraw();
    if (HA.DM.slope) HA.DM.slope.redraw();
    if (HA.DM.hach) HA.DM.hach.redraw();
    if (HA.DM.mesh) HA.DM.mesh.redraw();
    renderDemInfo();
  }
  function demImport(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    var bar = $('demProg'), i = 0, okN = 0, errs = [];
    bar.style.display = '';
    function nx() {
      if (i >= list.length) {
        bar.style.display = 'none'; $('demAdd').disabled = false; demAfter();
        toast(okN ? ('Data ketinggian dimuat: ' + okN + ' berkas' + (errs.length ? ', ' + errs.length + ' gagal' : '')) : 'Tidak ada yang berhasil');
        if (errs.length) $('demErr').textContent = errs.join('\n'); else $('demErr').textContent = '';
        return;
      }
      var f = list[i++];
      return HzDem.importTiff(f, function (p, t) { bar.textContent = '(' + i + '/' + list.length + ') ' + t + ' · ' + p + '%'; }).then(function () { okN++; }).catch(function (e) { errs.push(f.name + ': ' + (e && e.message || e)); }).then(nx);
    }
    $('demAdd').disabled = true; $('demErr').textContent = '';
    nx();
  }
  function renderSatNat() {
    var box = $('satNat'); if (!box) return;
    var cur = S.settings.satNative || 17;
    box.innerHTML = [16, 17, 18, 19].map(function (v) { return '<button class="opt' + (cur === v ? ' on' : '') + '" data-sn="' + v + '">' + v + '</button>'; }).join('');
  }
  function renderCacheInfo() {
    renderDemInfo(); renderSatNat();
    if (!$('tcInfo')) return;
    HA.TC.stats().then(function (s) { $('tcInfo').textContent = 'Cache peta: ' + (s.bytes / 1048576).toFixed(1).replace('.', ',') + ' MB · ' + s.n + ' kotak peta'; });
  }


  // ---------- ukuran teks ----------
  var FS = { s: 0.7, m: 0.85, l: 1 };
  function applyFont() {
    var k = S.settings.fs || 'l';
    document.documentElement.style.setProperty('--fs', String(FS[k] || 1));
    document.querySelectorAll('#fontSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === k); });
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
  HA.CHEV = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
  function bkAge() { var b = S.settings.lastBackup; return b ? Math.floor((Date.now() - b) / 86400000) : -1; }
  function dtText(ts) { var d = new Date(ts); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + T.pad(d.getHours()) + '.' + T.pad(d.getMinutes()); }
  var SPAGES = [
    { k: 'jadwal', t: 'Jadwal dan rekam otomatis', s: function () { var n = 0; S.settings.schedule.days.forEach(function (x) { if (x['in'] && x.out) n++; }); return (S.settings.auto ? 'Otomatis aktif' : 'Otomatis mati') + ' · ' + n + ' hari terjadwal'; } },
    { k: 'unit', t: 'Unit dan pengemudi', s: function () { return 'Dipakai: ' + unitAt(Date.now()) + ' · ' + S.settings.units.length + ' unit'; } },
    { k: 'peta', t: 'Peta', s: function () { var n = ovList().length; return n + ' peta saya · cache peta'; } },
    { k: 'data', t: 'Data dan cadangan', s: function () { var n = (S.ov.hidden || []).length; return (S.settings.lastBackup ? 'Cadangan ' + bkAge() + ' hari lalu' : 'Belum ada cadangan') + (n ? ' · ' + n + ' trip dihapus' : ''); } },
    { k: 'latar', t: 'Perekaman latar belakang', s: function () { return native ? ((S.bg && S.battFree) ? 'Siap' : 'Perlu diatur') : 'Mode uji'; } },
    { k: 'tampil', t: 'Tampilan', s: function () { return { dark: 'Tema gelap', light: 'Tema terang', auto: 'Ikuti sistem' }[S.settings.theme || 'dark']; } },
    { k: 'tentang', t: 'Tentang', s: function () { return 'by Yohanes div2 · Versi 0.9.9'; } }
  ];
  function renderSetMenu() {
    $('setMenu').innerHTML = SPAGES.map(function (p) { return '<button class="srow" data-sp="' + p.k + '"><div class="si"><b>' + p.t + '</b><small>' + esc(p.s()) + '</small></div>' + HA.CHEV + '</button>'; }).join('');
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
    if (key === 'peta') { renderOv(); renderCacheInfo(); renderBlkInfo(); }
    if (key === 'data') { renderHidden(); renderBackupInfo(); renderThinInfo(); }
    if (key === 'latar') { syncStatus(); renderDiag(); }
    if (key === 'tampil') { applyTheme(); applyFont(); }
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
      $('bkInfo').innerHTML = (S.settings.lastBackup ? 'Terakhir dibuat: <b>' + dtText(S.settings.lastBackup) + '</b> (' + bkAge() + ' hari lalu)' : 'Belum pernah membuat cadangan.') + '<br>Data di ponsel: ' + n + ' hari rekaman.' + (S.settings.lastAuto ? '<br>Cadangan otomatis terakhir: <b>' + dtText(S.settings.lastAuto) + '</b> (berkas ' + (S.settings.autoSlot || 'A') + ', ' + (S.settings.autoDir === 'EXTERNAL' ? 'folder data aplikasi' : 'Dokumen/HZTrip/cadangan') + ')' : '');
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
  // hapus berkas cadangan otomatis model lama (HZTrip-auto-TANGGAL) setelah cadangan baru tersimpan
  function pruneAuto(dir) {
    var P = window.Capacitor.Plugins;
    P.Filesystem.readdir({ path: 'HZTrip/cadangan', directory: dir }).then(function (r) {
      (r.files || []).map(function (f) { return f.name || f; }).filter(function (n) { return /^HZTrip-auto-.*\.hztrip$/.test(n); }).forEach(function (n) { P.Filesystem.deleteFile({ path: 'HZTrip/cadangan/' + n, directory: dir }).catch(function () {}); });
    }).catch(function () {});
  }
  // Cadangan otomatis harian ke Dokumen/HZTrip/cadangan: 2 berkas (A dan B) diperbarui bergantian, dibuat saat app dibuka pertama kali tiap hari
  function autoBackup() {
    var P = window.Capacitor && window.Capacitor.Plugins;
    if (!native || !P || !P.Filesystem || S.settings.autoBk === false || autoBusy || bkBusy) return Promise.resolve();
    if (S.settings.lastAuto && T.ymd(S.settings.lastAuto) === T.ymd(Date.now())) return Promise.resolve();
    autoBusy = true;
    var slot = S.settings.autoSlot === 'A' ? 'B' : 'A';
    return buildBackup().then(function (b64) {
      var path = 'HZTrip/cadangan/HZTrip-cadangan-' + slot + '.hztrip';
      function put(dir) { return P.Filesystem.writeFile({ path: path, data: b64, directory: dir, recursive: true }).then(function () { return dir; }); }
      return put('DOCUMENTS').catch(function () { return put('EXTERNAL'); });
    }).then(function (dir) {
      S.settings.lastAuto = Date.now(); S.settings.autoDir = dir; S.settings.autoSlot = slot; saveSettings();
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
})();
