/* HZ Trip - sumber data danau dan batas wilayah */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function open3d() { return HA.open3d.apply(this, arguments); }
  function renderData() { return HA.renderData.apply(this, arguments); }
  function renderProfile() { return HA.renderProfile.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.demRedraw = demRedraw;
  HA.setSource = setSource;
  HA.batSet = batSet;
  HA.batCfg = batCfg;
  HA.batRedraw = batRedraw;
  HA.openBat = openBat;

  // ---------- sumber data dan koreksi danau ----------
  function demRedraw() {
    HA.CL.clear();
    [HA.DM.layer, HA.DM.slope, HA.DM.hach, HA.DM.mesh].forEach(function (l) { if (l) l.redraw(); });
    if (HA.V3.on) open3d(true);
    if (S.profOpen) renderProfile();
    if (HA.DM.sync) HA.DM.sync();
  }
  function setSource(which, on) {
    var nas = S.settings.useNas !== false, free = S.settings.useFree !== false;
    if (which === 'nas') nas = on; else free = on;
    if (!nas && !free) { toast('Minimal satu sumber data harus nyala'); return; }
    S.settings.useNas = nas; S.settings.useFree = free; saveSettings();
    if (window.HzDem) HzDem.setSources(nas, free);
    demRedraw();
    toast(nas && free ? 'DEMNAS + DEM gratis' : nas ? 'DEMNAS saja' : 'DEM gratis saja');
  }
  // ---------- batas wilayah ----------
  function batSet() { return S.settings.bat || (S.settings.bat = {}); }
  function batCfg() {
    var b = S.settings.bat || {};
    return { desa: !!b.desa, kec: !!b.kec, online: b.online !== false, file: b.file !== false, base: b.base || '', desaId: b.desaId == null ? null : b.desaId, kecId: b.kecId == null ? null : b.kecId,
      fDesa: b.fDesa || '', fKec: b.fKec || '', minDesa: b.minDesa || 13, minKec: b.minKec || 10, osm: S.settings.mapMode === 'osm' };
  }
  function batRedraw() {
    [HA.DM.bat, HA.SP.bat].forEach(function (x) { if (x) x.redraw(); });
    var on = !!(S.settings.bat && (S.settings.bat.desa || S.settings.bat.kec));
    if ($('spBat')) $('spBat').classList.toggle('on', on);
    if (HA.DM.sync) HA.DM.sync();
  }
  var BAT_BASES = []; (function () { for (var i = 1; i <= 10; i++) BAT_BASES.push('https://geoportal.bps.go.id/server/rest/services/LCRPGR/MA' + (i < 10 ? '0' : '') + i + '_BatasWilayah/MapServer'); })();
  function guessField(fields, kind) {
    var re = kind === 'kec' ? /^(wadmkc|nama_?kec|nm_?kec|kecamatan|namobj|nama|name)/i : /^(wadmkd|namobj|nama_?desa|nm_?desa|desa|nama_?kel|nm_?kel|nama|name)/i;
    for (var i = 0; i < fields.length; i++) if (re.test(fields[i])) return fields[i];
    return fields[0] || '';
  }
  function openBat() {
    var b = batSet(), imKind = 'desa';
    function stepRow(id, label, v) { return '<div class="row" style="align-items:center;margin-top:6px"><div style="flex:1">' + label + '</div><button class="btn" data-st="' + id + '-" style="width:44px">−</button><b id="' + id + 'V" style="min-width:30px;text-align:center">' + v + '</b><button class="btn" data-st="' + id + '+" style="width:44px">+</button></div>'; }
    openSheet('<div class="grab"></div><div class="st">BATAS WILAYAH</div>' +
      '<div class="muted" style="margin:4px 0 8px">Hanya tampil di peta, tidak dicatat di trip. Batas dari data pemerintah bisa bergeser dari batas di lapangan, jadi anggap sebagai petunjuk.</div>' +
      '<div class="h">SUMBER</div>' +
      '<label><input type="checkbox" id="bOn"' + (b.online !== false ? ' checked' : '') + '> Layanan online (garis penuh)</label>' +
      '<label><input type="checkbox" id="bFi"' + (b.file !== false ? ' checked' : '') + '> Berkas impor (garis putus-putus)</label>' +
      '<div class="h" style="margin-top:12px">LAYANAN ONLINE (ArcGIS MapServer)</div>' +
      '<input type="text" id="bUrl" placeholder="https://…/MapServer" value="' + esc(b.base || '') + '">' +
      '<div class="row" style="margin-top:8px"><button class="btn" id="bFind" style="flex:1.4">Cari otomatis di lokasi peta</button><button class="btn" id="bTest" style="flex:1">Muat layer</button></div>' +
      '<div class="muted" id="bMsg" style="margin-top:6px;white-space:pre-wrap"></div>' +
      '<div style="margin-top:8px"><div class="muted">Layer desa</div><select id="bSd"></select><div class="muted" style="margin-top:4px">Kolom nama desa (kosong = otomatis)</div><input type="text" id="bFd" value="' + esc(b.fDesa || '') + '"></div>' +
      '<div style="margin-top:8px"><div class="muted">Layer kecamatan</div><select id="bSk"></select><div class="muted" style="margin-top:4px">Kolom nama kecamatan (kosong = otomatis)</div><input type="text" id="bFk" value="' + esc(b.fKec || '') + '"></div>' +
      '<div class="h" style="margin-top:12px">IMPOR BERKAS (GeoJSON atau KML)</div>' +
      '<div class="row"><button class="btn" id="bImD" style="flex:1">Impor batas desa</button><button class="btn" id="bImK" style="flex:1">Impor batas kecamatan</button></div>' +
      '<input type="file" id="bFile" multiple style="display:none"><div class="muted" id="bList" style="margin-top:6px"></div>' +
      '<div class="h" style="margin-top:12px">TAMPILAN NAMA</div>' + stepRow('bZd', 'Nama desa mulai zoom', b.minDesa || 13) + stepRow('bZk', 'Nama kecamatan mulai zoom', b.minKec || 10) +
      '<button class="btn" id="bX" style="width:100%;margin-top:12px">Tutup</button>');
    var layers = [];
    function fillSel(id, sel, guessId) {
      var s = $(id); s.innerHTML = '<option value="">(tidak dipakai)</option>' + layers.map(function (l) { return '<option value="' + l.id + '">' + esc(l.id + ' · ' + l.name) + '</option>'; }).join('');
      s.value = sel != null ? String(sel) : (guessId != null ? String(guessId) : '');
    }
    function selCur() { fillSel('bSd', b.desaId, null); fillSel('bSk', b.kecId, null); }
    function renderList() {
      var f = HzBatas.fileInfo();
      $('bList').innerHTML = f.length ? f.map(function (x, i) { return esc((x.kind === 'desa' ? 'Desa' : 'Kecamatan') + ': ' + x.name) + ' · ' + x.n + ' poligon <a href="#" data-rm="' + i + '" style="color:var(--r)">hapus</a>'; }).join('<br>') : 'Belum ada berkas.';
    }
    selCur(); renderList();
    if (b.base) arcLayersSafe();
    function arcLayersSafe() { HzBatas.arcLayers(b.base).then(function (l) { layers = l; selCur(); }).catch(function () {}); }
    function saveSel() {
      b.online = $('bOn').checked; b.file = $('bFi').checked; b.base = $('bUrl').value.trim();
      b.desaId = $('bSd').value === '' ? null : +$('bSd').value; b.kecId = $('bSk').value === '' ? null : +$('bSk').value;
      b.fDesa = $('bFd').value.trim(); b.fKec = $('bFk').value.trim();
      saveSettings(); HzBatas.clearArcCache && 0; batRedraw();
    }
    ['bOn', 'bFi'].forEach(function (i) { $(i).onchange = saveSel; });
    ['bSd', 'bSk', 'bFd', 'bFk', 'bUrl'].forEach(function (i) { $(i).onchange = saveSel; });
    $('bSd').addEventListener('change', function () { if (this.value !== '') HzBatas.arcFields($('bUrl').value.trim(), this.value).then(function (f) { if (!$('bFd').value) { $('bFd').value = guessField(f, 'desa'); saveSel(); } }).catch(function () {}); });
    $('bSk').addEventListener('change', function () { if (this.value !== '') HzBatas.arcFields($('bUrl').value.trim(), this.value).then(function (f) { if (!$('bFk').value) { $('bFk').value = guessField(f, 'kec'); saveSel(); } }).catch(function () {}); });
    $('bTest').onclick = function () {
      var u = $('bUrl').value.trim(); if (!u) { $('bMsg').textContent = 'Isi alamat layanan dulu, atau pakai Cari otomatis.'; return; }
      $('bMsg').textContent = 'Memuat daftar layer…';
      HzBatas.arcLayers(u).then(function (l) {
        layers = l; b.base = u; fillSel('bSd', null, HzBatas.guessLayer(l, 'desa')); fillSel('bSk', null, HzBatas.guessLayer(l, 'kec'));
        $('bMsg').textContent = l.length + ' layer ditemukan. Pilih layer desa dan kecamatan.'; saveSel();
        $('bSd').dispatchEvent(new Event('change')); $('bSk').dispatchEvent(new Event('change'));
      }).catch(function (e) { $('bMsg').textContent = 'Gagal: ' + (e && e.message || e); });
    };
    $('bFind').onclick = function () {
      if (!HA.map) return; var c = HA.map.getCenter(); $('bMsg').textContent = 'Mencari layanan yang memuat lokasi peta…';
      HzBatas.discover(c.lat, c.lng, BAT_BASES, function (base) { $('bMsg').textContent = 'Memeriksa ' + base.replace(/^.*LCRPGR\//, '') + '…'; }).then(function (r) {
        if (!r) { $('bMsg').textContent = 'Tidak ditemukan otomatis. Isi alamat layanan sendiri lalu tekan Muat layer.'; return; }
        layers = r.layers; $('bUrl').value = r.base; b.base = r.base; fillSel('bSd', null, r.desaId); fillSel('bSk', null, r.kecId);
        $('bMsg').textContent = 'Ditemukan: ' + r.base.replace(/^.*LCRPGR\//, ''); saveSel();
        $('bSd').dispatchEvent(new Event('change')); $('bSk').dispatchEvent(new Event('change'));
      });
    };
    $('bImD').onclick = function () { imKind = 'desa'; $('bFile').value = ''; $('bFile').click(); };
    $('bImK').onclick = function () { imKind = 'kec'; $('bFile').value = ''; $('bFile').click(); };
    $('bFile').onchange = function () {
      var fl = Array.prototype.slice.call(this.files || []), i = 0, msgs = [];
      $('bMsg').textContent = 'Membaca berkas…';
      (function nx() {
        if (i >= fl.length) { $('bMsg').textContent = msgs.join('\n'); renderList(); batRedraw(); return; }
        var f = fl[i++];
        HzBatas.importFile(f, imKind, imKind === 'kec' ? $('bFk').value.trim() : $('bFd').value.trim()).then(function (r) { msgs.push(f.name + ': ' + r.n + ' poligon' + (r.named < r.n ? ' (' + (r.n - r.named) + ' tanpa nama)' : '')); }, function (e) { msgs.push(f.name + ': ' + (e && e.message || e)); }).then(nx);
      })();
    };
    $('bList').onclick = function (e) { var t = e.target.closest && e.target.closest('a[data-rm]'); if (!t) return; e.preventDefault(); var x = HzBatas.fileInfo()[+t.getAttribute('data-rm')]; if (x) HzBatas.removeFile(x.kind, x.name).then(function () { renderList(); batRedraw(); }); };
    $('sheet').querySelectorAll('button[data-st]').forEach(function (bt) {
      bt.onclick = function () {
        var s = bt.getAttribute('data-st'), id = s.slice(0, -1), up = s.slice(-1) === '+';
        if (id === 'bZd') { b.minDesa = Math.max(10, Math.min(19, (b.minDesa || 13) + (up ? 1 : -1))); $('bZdV').textContent = b.minDesa; }
        else { b.minKec = Math.max(6, Math.min(16, (b.minKec || 10) + (up ? 1 : -1))); $('bZkV').textContent = b.minKec; }
        saveSettings(); batRedraw();
      };
    });
    $('bX').onclick = function () { closeSheet(); if (S.view === 'data') renderData(); };
  }
})();
