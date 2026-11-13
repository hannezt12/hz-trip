/* HZ Trip - peta saya (PDF di atas peta) */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function esc() { return HA.esc.apply(this, arguments); }
  function opts() { return HA.opts.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function openSheet() { return HA.openSheet.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function edited() { return HA.edited.apply(this, arguments); }
  function tripView() { return HA.tripView.apply(this, arguments); }
  function saveFile() { return HA.saveFile.apply(this, arguments); }
  function loadDay() { return HA.loadDay.apply(this, arguments); }
  function cachedLayerClass() { return HA.cachedLayerClass.apply(this, arguments); }
  function blobB64() { return HA.blobB64.apply(this, arguments); }
  function ensureMap() { return HA.ensureMap.apply(this, arguments); }
  function setTiles() { return HA.setTiles.apply(this, arguments); }
  function drawTrips() { return HA.drawTrips.apply(this, arguments); }
  function locStart() { return HA.locStart.apply(this, arguments); }
  function makeLocate() { return HA.makeLocate.apply(this, arguments); }
  function blocksList() { return HA.blocksList.apply(this, arguments); }
  function drawBlocks() { return HA.drawBlocks.apply(this, arguments); }
  function renderProfile() { return HA.renderProfile.apply(this, arguments); }
  function pbBuild() { return HA.pbBuild.apply(this, arguments); }
  function pbDraw() { return HA.pbDraw.apply(this, arguments); }
  function pbPlay() { return HA.pbPlay.apply(this, arguments); }
  function pbClose() { return HA.pbClose.apply(this, arguments); }
  // fungsi untuk modul lain
  HA.ovList = ovList;
  HA.syncOverlays = syncOverlays;
  HA.syncAllOverlays = syncAllOverlays;
  HA.renderOv = renderOv;
  HA.calibrateOv = calibrateOv;
  HA.tuneOv = tuneOv;
  HA.importOv = importOv;
  HA.exportOv = exportOv;
  HA.importHz = importHz;
  HA.cleanOv = cleanOv;
  HA.openOvSheet = openOvSheet;
  HA.showMap = showMap;
  HA.openMap = openMap;
  HA.shiftMap = shiftMap;
  HA.renderMap = renderMap;

  // ---------- peta saya (PDF ditimpa di atas peta) ----------
  function ovList() { return S.settings.ovl || (S.settings.ovl = []); }
  function syncOverlays(m) {
    if (!m || !window.HzOverlay) return;
    (m._ovl || []).forEach(function (l) { try { m.removeLayer(l); } catch (e) {} });
    m._ovl = [];
    var isSp = !!(HA.SP && HA.SP.map === m);
    if (isSp ? !m._forceOvl : (S.settings.mapMode !== 'osm' && !m._forceOvl)) return; // SpidoMap: lapisan PDF hanya saat marking memilih mode Peta; peta lain hanya di mode Peta
    ovList().forEach(function (o) {
      if (!o.on || !o.cal) return;
      var af = HzOverlay.affOf(o);
      if (!af) return;
      m._ovl.push(HzOverlay.makeLayer(o, { toLL: HzOverlay.toLLFn(af), opacity: S.settings.ovlOp == null ? 0.8 : S.settings.ovlOp }).addTo(m));
    });
  }
  function syncAllOverlays() { syncOverlays(HA.map); syncOverlays(HA.mini); if (HA.SP && HA.SP.map && HA.SP.map._forceOvl) syncOverlays(HA.SP.map); }
  HA.syncOverlays = syncOverlays;
  function setOvOpacity(v) {
    S.settings.ovlOp = v;
    [HA.map, HA.mini].forEach(function (m) { if (m && m._ovl) m._ovl.forEach(function (l) { l.setOpacity(v); }); });
  }
  function mb(n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  function renderOv() {
    var box = $('ovList'); if (!box) return;
    var l = ovList();
    HA.lpList(box, 'pdf', {
      items: l.map(function (o, i) {
        var af0 = o.cal ? HzOverlay.affOf(o) : null, inf = af0 ? HzOverlay.infoAff(af0, o.cal[0].lat) : null;
        return { id: i, title: o.name, sub: o.W + '×' + o.H + ' px · ' + mb(o.bytes || 0) + ' · ' + (inf ? 'terpasang, ± ' + inf.mpp.toFixed(2).replace('.', ',') + ' m/piksel' : 'belum dikalibrasi') };
      }),
      empty: 'Belum ada peta PDF.',
      actions: function (id) {
        var o = ovList()[+id], a = [{ label: o && o.cal ? 'Kalibrasi ulang' : 'Kalibrasi', fn: function (i) { calibrateOv(+i); } }];
        if (o && o.cal) a.push({ label: 'Setel posisi', fn: function (i) { tuneOv(+i); } });
        a.push({ label: 'Bersihkan', fn: function (i) { cleanOv(+i); } });
        if (o && o.cal) a.push({ label: 'Ekspor', fn: function (i) { exportOv(+i); } });
        return a;
      },
      delTitle: function (ids) { return ids.length === 1 ? 'Hapus peta "' + (ovList()[+ids[0]] || {}).name + '"?' : 'Hapus ' + ids.length + ' peta?'; },
      delMsg: function () { return 'Gambar peta dihapus dari ponsel. File PDF asli Anda tidak terpengaruh.'; },
      onDelete: function (ids) {
        var os = ids.map(function (i) { return ovList()[+i]; }).filter(Boolean);
        Promise.all(os.map(function (o) { return HzOverlay.delOverlay(o.id); })).then(function () {
          S.settings.ovl = ovList().filter(function (o) { return os.indexOf(o) < 0; }); saveSettings(); renderOv(); syncAllOverlays();
        });
      }
    });
  }
  function calibrateOv(i) {
    var o = ovList()[i]; if (!o) return;
    closeSheet();
    var c = HA.map ? HA.map.getCenter() : null;
    if (!c && S.todayPts && S.todayPts.length) { var p = S.todayPts[S.todayPts.length - 1]; c = { lat: p.lat, lng: p.lng }; }
    HzOverlay.calibrate(o, {
      base: function (m) { return new (cachedLayerClass())(HA.TILES.sat[0], { maxZoom: 19 }).addTo(m); },
      center: c ? [c.lat, c.lng] : null,
      toast: toast,
      locate: makeLocate,
      onSave: function (cal) { o.cal = cal; delete o.aff; o.on = true; saveSettings(); renderOv(); syncAllOverlays(); setTimeout(function () { tuneOv(i); }, 50); }
    });
  }
  function tuneOv(i) {
    var o = ovList()[i]; if (!o || !o.cal) return;
    closeSheet();
    var c = HA.map ? HA.map.getCenter() : null;
    HzOverlay.tune(o, {
      base: function (m) { return new (cachedLayerClass())(HA.TILES.sat[0], { maxZoom: 19 }).addTo(m); },
      locate: makeLocate,
      extra: function (m) { mapData().then(function (d) { if (m._container) drawTrips(L.layerGroup().addTo(m), d.pts, d.trips, -1, false); }).catch(function () {}); },
      center: null,
      opacity: S.settings.ovlOp == null ? 0.8 : S.settings.ovlOp,
      onOpacity: function (v) { S.settings.ovlOp = v; saveSettings(); setOvOpacity(v); },
      toast: toast,
      onClean: function () { saveSettings(); renderOv(); syncAllOverlays(); },
      onSave: function (af) { o.aff = af; saveSettings(); renderOv(); syncAllOverlays(); toast('Setelan lapisan disimpan'); }
    });
  }
  // pindahkan kalibrasi, setelan, dan kotak hapus/pangkas dari peta lama ke hasil impor baru (skala piksel berbeda)
  function carryOver(o, n) {
    var k = n.W / o.W;
    if (!(k > 0) || Math.abs(n.H / o.H - k) > 0.02 * k) return false;
    function sc(r) { return r.poly ? { poly: r.poly.map(function (p) { return [Math.round(p[0] * k), Math.round(p[1] * k)]; }) } : { x0: Math.round(r.x0 * k), y0: Math.round(r.y0 * k), x1: Math.round(r.x1 * k), y1: Math.round(r.y1 * k) }; }
    if (o.cal) n.cal = o.cal.map(function (c) { var d = Object.assign({}, c); d.u = c.u * k; d.v = c.v * k; return d; });
    if (o.aff) n.aff = { A: o.aff.A / k, B: o.aff.B / k, C: o.aff.C, D: o.aff.D / k, E: o.aff.E / k, F: o.aff.F };
    if (o.edit) {
      var e = Object.assign({}, o.edit);
      e.crop = o.edit.crop ? (o.edit.crop.mask ? o.edit.crop : sc(o.edit.crop)) : null; e.erase = (o.edit.erase || []).map(sc);
      e.keyBg = false; e.solid = false;
      n.edit = e;
    }
    n.on = o.on; return true;
  }
  function importOv(file) {
    var nm = file.name.replace(/\.pdf$/i, '');
    var inp = 'width:100%;height:44px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--tx);padding:0 12px;font-size:max(11px,calc(16px * var(--fs,1)))';
    openSheet('<div class="grab"></div><div class="st">MEMBACA PDF…</div><div class="muted">' + esc(file.name) + ' (' + mb(file.size) + ')</div>');
    Promise.all([HzOverlay.openPdf(file), HzOverlay.readGeo(file), HA.readHzBlok ? HA.readHzBlok(file) : null]).then(function (rs) {
      var h = rs[0], geo = rs[1], hzb = rs[2];
      var hidden = {};
      h.layers.forEach(function (l) { if (!l.on) hidden[l.id] = true; });
      var lay = h.layers.length ? '<label class="lbl" style="margin-top:10px">Layer PDF (hilangkan centang untuk menyembunyikan)</label><div class="lylist" id="ovLy">' +
        h.layers.map(function (l) { return '<label><input type="checkbox" data-ly="' + esc(l.id) + '"' + (l.on ? ' checked' : '') + '> ' + esc(l.name) + '</label>'; }).join('') + '</div>' : '<div class="muted" style="margin-top:8px">PDF ini tidak punya layer. Bagian yang tidak diinginkan bisa dibuang di langkah Bersihkan.</div>';
      openSheet('<div class="grab"></div><div class="st">TAMBAH PETA</div>' +
        '<div class="muted" style="margin-bottom:6px">Berkas: ' + esc(file.name) + ' (' + mb(file.size) + ')</div>' +
        '<canvas id="ovPrev" class="ovprev"></canvas><button class="btn sm" id="ovZoom" style="margin-top:6px;width:100%">Perbesar dan periksa gambar</button>' +
        '<label class="lbl" style="margin-top:8px">Nama</label><input id="ovName" value="' + esc(nm) + '" style="' + inp + '">' +
        '<div class="pgrid" style="margin-top:10px"><div><label class="lbl">Halaman (1–' + h.numPages + ')</label><input id="ovPage" type="number" min="1" max="' + h.numPages + '" value="1" style="' + inp + '"></div>' +
        '<div><label class="lbl">Ketajaman</label><select id="ovRes" style="' + inp + ';padding:0 8px"><option value="5000">Ringan (5000 px)</option><option value="7000">Sedang (7000 px)</option><option value="9000" selected>Tajam (9000 px)</option></select></div></div>' +
        (ovList().length ? '<label class="lbl" style="margin-top:10px">Gantikan peta lama (kalibrasi dan editan dipindahkan)</label><select id="ovRep" style="' + inp + ';padding:0 8px"><option value="-1">Tidak, tambah sebagai peta baru</option>' + ovList().map(function (o, k) { return '<option value="' + k + '">' + esc(o.name) + '</option>'; }).join('') + '</select>' : '') +
        (geo ? '<label class="geol" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="ovGeo" checked> Pasang otomatis dari koordinat PDF (' + (geo.geographic ? 'lintang-bujur WGS84' : 'UTM zona ' + geo.zone + (geo.south ? ' S' : ' U')) + ')</label>' : '') +
        (hzb ? '<div class="card" style="margin-top:10px"><div style="font-weight:600">PDF ini berisi data ' + hzb.blocks.length + ' blok</div><div class="muted">Master "' + esc(hzb.master && hzb.master.name || '') + '", dicetak ' + esc(hzb.tgl || '') + '. Pulihkan hanya menambah blok yang belum ada; blok yang sudah ada tidak diubah.</div><button class="btn" id="ovRst" style="width:100%;margin-top:8px">Pulihkan blok dari PDF</button></div>' : '') +
        lay +
        '<div class="muted" style="margin-top:8px">Makin tajam, makin lama diproses dan makin besar di ponsel. 9000 px sudah cukup tajam untuk zoom dekat; di atas itu tidak banyak berpengaruh. Setelah dikalibrasi, ukuran m/piksel tampil di daftar peta.</div>' +
        '<div class="row" style="margin-top:14px;gap:8px"><button class="btn" id="ovNo" style="flex:1">Batal</button><button class="btn pri" id="ovGo" style="flex:1">Proses</button></div>');
      var tm = null;
      function prev() { clearTimeout(tm); tm = setTimeout(function () { var c = $('ovPrev'); if (c) h.preview(c, +$('ovPage').value || 1, hidden, 700).catch(function () {}); }, 150); }
      prev();
      var zv = null;
      $('ovZoom').onclick = function () { if (zv) zv.close(); h.viewer(+$('ovPage').value || 1, hidden, 'Periksa gambar').then(function (v) { zv = v; }).catch(function () { toast('Gagal membuka penampil'); }); };
      $('ovPage').onchange = prev;
      var ly = $('ovLy');
      if (ly) ly.onchange = function (e) { var id = e.target.getAttribute('data-ly'); if (id === null) return; if (e.target.checked) delete hidden[id]; else hidden[id] = true; prev(); };
      $('ovNo').onclick = function () { h.close(); closeSheet(); };
      if ($('ovRst')) $('ovRst').onclick = function () { var r = HA.restoreHzBlok(hzb); $('ovRst').disabled = true; $('ovRst').textContent = r.added + ' blok dipulihkan' + (r.skipped ? ', ' + r.skipped + ' sudah ada (dilewati)' : '') + (r.master ? ', master ditambahkan' : ''); };
      $('ovGo').onclick = function () {
        if (zv) { zv.close(); zv = null; }
        var useGeo = !!(geo && $('ovGeo') && $('ovGeo').checked);
        var name = $('ovName').value.trim() || nm, page = +$('ovPage').value || 1, ls = +$('ovRes').value, repIdx = $('ovRep') ? +$('ovRep').value : -1, repO = repIdx >= 0 ? ovList()[repIdx] : null;
        openSheet('<div class="grab"></div><div class="st">MEMPROSES PDF…</div><div class="muted" id="ovMsg">Jangan tutup aplikasi sampai selesai.</div><div class="ovbar"><div id="ovBar"></div></div>');
        h.run({ name: name, page: page, longSide: ls, hidden: hidden }, function (f) { var b = $('ovBar'); if (b) b.style.width = Math.round(f * 100) + '%'; }).then(function (meta) {
          h.close();
          var carried = !!(repO && carryOver(repO, meta)), gi = null, diff = null;
          if (useGeo) {
            var pa0 = carried ? Object.assign({}, meta.aff || HzOverlay.affOf(meta)) : null;
            gi = HzOverlay.applyGeo(meta, geo);
            if (gi && pa0) { var cu = meta.W / 2, cv = meta.H / 2, o1 = [pa0.A * cu + pa0.B * cv + pa0.C, pa0.D * cu + pa0.E * cv + pa0.F], o2 = [gi.aff.A * cu + gi.aff.B * cv + gi.aff.C, gi.aff.D * cu + gi.aff.E * cv + gi.aff.F]; diff = Math.hypot(o2[0] - o1[0], o2[1] - o1[1]) * Math.cos(gi.lat * Math.PI / 180); }
            if (!gi) toast('Koordinat PDF tidak bisa dipakai, pakai kalibrasi manual');
          }
          if (repO && carried) {
            var ix = ovList().indexOf(repO);
            if (ix >= 0) ovList()[ix] = meta; else ovList().push(meta);
            HzOverlay.delOverlay(repO.id);
          } else { if (repO) toast('Ukuran halaman berbeda: kalibrasi tidak bisa dipindahkan'); ovList().push(meta); }
          saveSettings(); renderOv(); syncAllOverlays();
          var i = ovList().indexOf(meta);
          if (gi) { geoDone(meta, geo, gi, diff, i); return; }
          closeSheet();
          if (repO && carried) { toast('Peta diganti. Kalibrasi dan editan dipindahkan, mohon periksa hasilnya'); return; }
          toast('Langkah 1: bersihkan gambar (boleh langsung Selesai)');
          cleanOv(i, function () { calibrateOv(i); });
        }).catch(function (e) {
          h.close();
          openSheet('<div class="grab"></div><div class="st">GAGAL</div><div class="muted">' + esc(e && e.message || e) + '</div><button class="btn" id="ovNo2" style="margin-top:12px;width:100%">Tutup</button>');
          $('ovNo2').onclick = closeSheet;
        });
      };
    }).catch(function (e) {
      openSheet('<div class="grab"></div><div class="st">GAGAL</div><div class="muted">' + esc(e && e.message || e) + '</div><button class="btn" id="ovNo2" style="margin-top:12px;width:100%">Tutup</button>');
      $('ovNo2').onclick = closeSheet;
    });
  }
  function ovCorners(o) {
    var af = HzOverlay.affOf(o); if (!af) return [];
    return [[0, 0], [o.W, 0], [o.W, o.H], [0, o.H]].map(function (c) { var q = L.CRS.EPSG3857.unproject(L.point(af.A * c[0] + af.B * c[1] + af.C, af.D * c[0] + af.E * c[1] + af.F)); return [q.lat, q.lng]; });
  }
  function geoDone(meta, geo, gi, diff, i) {
    var zs = ''; for (var z = 46; z <= 54; z++) zs += '<option value="' + z + '"' + (z === gi.zone ? ' selected' : '') + '>Zona ' + z + '</option>';
    openSheet('<div class="grab"></div><div class="st">PETA TERPASANG</div>' +
      '<div class="muted" style="margin:6px 0">Dipasang dari koordinat PDF (' + (geo.geographic ? 'lintang-bujur WGS84' : 'UTM zona ' + gi.zone + (gi.south ? ' Selatan' : ' Utara')) + '). Ukuran ± ' + gi.mpp.toFixed(2).replace('.', ',') + ' m/piksel. Titik tengah peta: ' + gi.lat.toFixed(5) + ', ' + gi.lng.toFixed(5) + '.' + (diff != null ? ' Selisih dengan kalibrasi lama: ± ' + (diff < 10 ? diff.toFixed(1) : Math.round(diff)).toString().replace('.', ',') + ' m.' : '') + '</div>' +
      '<div class="muted">Kalau titik tengah bukan di kebun, ganti zona lalu pasang ulang.</div>' +
      '<div class="row" style="margin-top:8px;gap:6px"><select id="gzZ" style="flex:1">' + zs + '</select><select id="gzH" style="flex:1"><option value="S"' + (gi.south ? ' selected' : '') + '>Selatan</option><option value="U"' + (gi.south ? '' : ' selected') + '>Utara</option></select><button class="btn" id="gzGo" style="flex:1">Pasang ulang</button></div>' +
      '<div class="row" style="margin-top:10px;gap:6px"><button class="btn" id="gzV" style="flex:1;height:48px">Lihat di peta</button><button class="btn" id="gzM" style="flex:1;height:48px">Kalibrasi manual</button></div>' +
      '<button class="btn pri" id="gzX" style="width:100%;margin-top:8px;height:48px">Selesai</button>');
    if (geo.geographic) { var zr = $('gzZ').parentNode; zr.style.display = 'none'; if (zr.previousSibling) zr.previousSibling.style.display = 'none'; }
    $('gzGo').onclick = function () {
      var g2 = HzOverlay.applyGeo(meta, geo, +$('gzZ').value, $('gzH').value === 'S');
      if (!g2) { toast('Zona ini tidak cocok dengan koordinat PDF'); return; }
      saveSettings(); renderOv(); syncAllOverlays(); geoDone(meta, geo, g2, null, i);
    };
    $('gzV').onclick = function () { closeSheet(); meta.on = true; saveSettings(); syncAllOverlays(); HA.mapKeep = true; go('lintasan'); setTimeout(function () { if (HA.map) HA.map.fitBounds(L.latLngBounds(ovCorners(meta)), { padding: [20, 20] }); }, 900); if (S.settings.mapMode !== 'osm') toast('Peta PDF tampil di mode Peta (bukan Satelit)'); };
    $('gzM').onclick = function () { closeSheet(); calibrateOv(i); };
    $('gzX').onclick = closeSheet;
  }
  function exportOv(i) {
    var o = ovList()[i]; if (!o) return;
    toast('Menyiapkan peta "' + o.name + '"…');
    HzOverlay.exportOverlay(o, { blocks: blocksList().filter(function (b) { return b.ovId === o.id; }) }).then(blobB64).then(function (b64) {
      return saveFile(o.name.replace(/[^\w\-]+/g, '_') + '.hzpeta', b64, 'application/octet-stream');
    }).catch(function (e) { toast('Ekspor gagal: ' + (e && e.message || e)); });
  }
  function importHz(files) {
    var i = 0, ok = 0, bad = [];
    (function nx() {
      if (i >= files.length) { renderOv(); syncAllOverlays(); toast(ok ? ok + ' peta diimpor, sudah terpasang di posisinya' + (bad.length ? ' · gagal: ' + bad.join(', ') : '') : 'Gagal: ' + bad.join('; ')); return; }
      var f = files[i++]; toast('Mengimpor ' + f.name + '…');
      HzOverlay.importOverlayFile(f).then(function (m) {
        var ex = m._extra; delete m._extra; ovList().push(m);
        if (ex && ex.blocks) ex.blocks.forEach(function (b, k) { if (b && b.pts && b.pts.length > 2) { b.id = Date.now() + k; b.ovId = m.id; blocksList().push(b); } });
        saveSettings(); ok++; drawBlocks(); }, function (e) { bad.push(f.name + ' (' + (e && e.message || e) + ')'); }).then(nx);
    })();
  }
  function cleanOv(i, next) {
    var o = ovList()[i]; if (!o) return;
    closeSheet();
    HzOverlay.clean(o, { toast: toast, onChange: function () {}, onDone: function () { saveSettings(); renderOv(); syncAllOverlays(); if (next) next(); } });
  }
  function openOvSheet() {
    var l = ovList();
    var op = Math.round((S.settings.ovlOp == null ? 0.8 : S.settings.ovlOp) * 100);
    openSheet('<div class="grab"></div><div class="st">PETA SAYA</div>' + (S.settings.mapMode !== 'osm' ? '<div class="warn" style="margin-bottom:8px">Peta saya hanya tampil di mode <b>Peta</b>, bukan Satelit. Ganti mode di atas peta.</div>' : '') +
      (l.length ? l.map(function (o, i) {
        return '<div class="ovrow"><div class="nm">' + esc(o.name) + (o.cal ? '' : '<small>belum dikalibrasi (Pengaturan)</small>') + '</div>' +
          (o.cal ? '<button class="btn sm" data-tn="' + i + '">Setel</button><input type="checkbox" data-on="' + i + '"' + (o.on ? ' checked' : '') + '>' : '') + '</div>';
      }).join('') + '<div style="margin-top:10px;font-size:max(11px,calc(14px * var(--fs,1)));color:var(--tx3)">Transparansi: <span id="ovOpV">' + op + '</span>%</div><input type="range" id="ovOp" min="20" max="100" value="' + op + '" style="width:100%">'
        : '<div class="muted">Belum ada peta. Tambahkan PDF di Pengaturan, bagian PETA SAYA (PDF).</div>'));
    var sh = $('sheet');
    sh.onchange = function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-on'); if (k !== null && k !== undefined) { ovList()[+k].on = e.target.checked; saveSettings(); syncAllOverlays(); } };
    sh.onclick = function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-tn'); if (t !== null && t !== undefined) tuneOv(+t); };
    var r = $('ovOp'); if (r) r.oninput = function () { $('ovOpV').textContent = this.value; setOvOpacity(this.value / 100); };
    if (r) r.onchange = function () { saveSettings(); };
  }

  function showMap(ymd, sel) {
    S.mapDay = ymd; HA.mapSel = sel === undefined ? -1 : sel; HA.mapKeep = true; HA.fitted = false;
    go('lintasan');
  }
  function openMap() {
    if (!HA.mapKeep) { S.mapDay = S.today; HA.mapSel = -1; HA.fitted = false; }
    HA.mapKeep = false;
    setTimeout(function () {
      if (!ensureMap()) { $('mapMsg').textContent = 'Peta tidak tersedia'; return; }
      HA.map.invalidateSize();
      setTiles();
      locStart(HA.map);
      renderMap(true);
    }, 60);
  }
  function mapData() {
    if (S.mapDay === S.today) {
      var res = T.detectTrips(S.todayPts, opts());
      return Promise.resolve({ pts: res.points, trips: edited(S.today, res).map(tripView) });
    }
    return loadDay(S.mapDay).then(function (d) { return { pts: d.pts, trips: d.trips }; });
  }
  function shiftMap(n) {
    var p = S.mapDay.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n), nd = T.ymd(d.getTime());
    if (nd > S.today) return;
    S.mapDay = nd; HA.mapSel = -1; HA.fitted = false; renderMap(true);
  }
  function renderMap(fit) {
    if (!HA.map) return;
    var day = S.mapDay;
    $('mPick').value = day; $('mPick').max = S.today;
    $('mNext').style.opacity = day >= S.today ? '.3' : '1';
    $('mToday').style.visibility = day === S.today ? 'hidden' : 'visible';
    mapData().then(function (d) {
      if (day !== S.mapDay || S.view !== 'lintasan') return;
      var pts = d.pts, items = d.trips.map(function (x, i) { return { x: x, i: i }; });
      var nK = items.filter(function (o) { return o.x.label === 'Kerja'; }).length, nP = items.length - nK;
      if (HA.mapKind === 'kerja' && !nK) HA.mapKind = 'all';
      if (HA.mapKind === 'pribadi' && !nP) HA.mapKind = 'all';
      var list = items.filter(function (o) { return HA.mapKind === 'all' || o.x.label === (HA.mapKind === 'kerja' ? 'Kerja' : 'Pribadi'); });
      var trips = list.map(function (o) { return o.x; });
      if (HA.mapSel >= trips.length) HA.mapSel = -1;
      HA.PB.cur = { pts: pts, trips: trips };
      S.mapCnt = { kerja: nK, pribadi: nP };
      var kl = { all: 'Semua · ' + items.length, kerja: 'Kerja · ' + nK, pribadi: 'Pribadi · ' + nP }[HA.mapKind];
      $('mapChips').innerHTML = items.length > 1 ? '<button data-k="1" class="kind' + (HA.mapSel < 0 ? ' on' : '') + '">' + kl + '</button>' + list.map(function (o, i) {
        return '<button data-i="' + i + '"' + (HA.mapSel === i ? ' class="on"' : '') + '>' + (o.i + 1) + ' · ' + T.hm(o.x.t.start) + '</button>';
      }).join('') : '';
      HA.trackLayer.clearLayers(); if (HA.map._pinClear) HA.map._pinClear();
      var bounds = drawTrips(HA.trackLayer, pts, trips, HA.mapSel, false);
      S.mapView = { pts: pts, trips: trips, sel: HA.mapSel, day: day };
      if (S.profOpen) renderProfile();
      $('mapMsg').textContent = bounds.length ? '' : (day === S.today ? 'Belum ada lintasan hari ini. Lintasan muncul saat ada trip yang terekam.' : 'Tidak ada lintasan pada ' + T.dateLong(day) + '.');
      if (HA.KM) HA.KM.sync();
      if (bounds.length && (fit || !HA.fitted) && !(HA.KM && HA.KM.mode === 'kategori')) { HA.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 }); HA.fitted = true; }
      if (HA.PB.open) { pbPlay(false); pbBuild(); if (!HA.PB.seq.length) pbClose(); else pbDraw(false); }
    });
  }
})();
