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
    if (S.settings.mapMode !== 'osm') return; // lapisan PDF hanya di mode Peta, tidak di Satelit
    ovList().forEach(function (o) {
      if (!o.on || !o.cal) return;
      var af = HzOverlay.affOf(o);
      if (!af) return;
      m._ovl.push(HzOverlay.makeLayer(o, { toLL: HzOverlay.toLLFn(af), opacity: S.settings.ovlOp == null ? 0.8 : S.settings.ovlOp }).addTo(m));
    });
  }
  function syncAllOverlays() { syncOverlays(HA.map); syncOverlays(HA.mini); }
  function setOvOpacity(v) {
    S.settings.ovlOp = v;
    [HA.map, HA.mini].forEach(function (m) { if (m && m._ovl) m._ovl.forEach(function (l) { l.setOpacity(v); }); });
  }
  function mb(n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  function renderOv() {
    var box = $('ovList'); if (!box) return;
    var l = ovList();
    box.innerHTML = l.length ? l.map(function (o, i) {
      var af0 = o.cal ? HzOverlay.affOf(o) : null, inf = af0 ? HzOverlay.infoAff(af0, o.cal[0].lat) : null;
      return '<div class="ovrow"><div class="nm">' + esc(o.name) + '<small>' + o.W + '×' + o.H + ' px · ' + mb(o.bytes || 0) + ' · ' + (inf ? 'terpasang, ± ' + inf.mpp.toFixed(2).replace('.', ',') + ' m/piksel' : 'belum dikalibrasi') + '</small></div>' +
        '<div style="display:flex;gap:6px;width:100%;margin-bottom:4px"><button class="btn sm" data-cal="' + i + '">' + (o.cal ? 'Kalibrasi ulang' : 'Kalibrasi') + '</button>' + (o.cal ? '<button class="btn sm" data-tune="' + i + '">Setel</button>' : '') + '<button class="btn sm" data-clean="' + i + '">Bersihkan</button>' + (o.cal ? '<button class="btn sm" data-exp="' + i + '">Ekspor</button>' : '') + '<button class="btn sm danger" data-del="' + i + '">Hapus</button></div></div>';
    }).join('') : 'Belum ada.';
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
    HzOverlay.openPdf(file).then(function (h) {
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
      $('ovGo').onclick = function () {
        if (zv) { zv.close(); zv = null; }
        var name = $('ovName').value.trim() || nm, page = +$('ovPage').value || 1, ls = +$('ovRes').value, repIdx = $('ovRep') ? +$('ovRep').value : -1, repO = repIdx >= 0 ? ovList()[repIdx] : null;
        openSheet('<div class="grab"></div><div class="st">MEMPROSES PDF…</div><div class="muted" id="ovMsg">Jangan tutup aplikasi sampai selesai.</div><div class="ovbar"><div id="ovBar"></div></div>');
        h.run({ name: name, page: page, longSide: ls, hidden: hidden }, function (f) { var b = $('ovBar'); if (b) b.style.width = Math.round(f * 100) + '%'; }).then(function (meta) {
          h.close();
          if (repO && carryOver(repO, meta)) {
            var ix = ovList().indexOf(repO);
            if (ix >= 0) ovList()[ix] = meta; else ovList().push(meta);
            HzOverlay.delOverlay(repO.id);
            saveSettings(); renderOv(); syncAllOverlays(); closeSheet();
            toast('Peta diganti. Kalibrasi dan editan dipindahkan, mohon periksa hasilnya');
            return;
          }
          if (repO) toast('Ukuran halaman berbeda: kalibrasi tidak bisa dipindahkan');
          ovList().push(meta); saveSettings(); renderOv();
          var i = ovList().length - 1;
          closeSheet();
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
      if (bounds.length && (fit || !HA.fitted)) { HA.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 }); HA.fitted = true; }
      if (HA.PB.open) { pbPlay(false); pbBuild(); if (!HA.PB.seq.length) pbClose(); else pbDraw(false); }
    });
  }
})();
