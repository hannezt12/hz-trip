/* HZ Trip v0.16.5 - Bagikan data blok sebagai Zip (.hzblok di dalamnya) dan buka .hzblok dari luar aplikasi (kartu Simpan/Batal) */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  // ---- zip sederhana (tanpa kompresi)
  var CT = null;
  function crc(u8) { if (!CT) { CT = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CT[n] = c >>> 0; } } var r = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) r = CT[(r ^ u8[i]) & 255] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0; }
  function u8str(s) { return new TextEncoder().encode(s); }
  HA.zipStore = function (entries) {
    var parts = [], cen = [], off = 0, d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    entries.forEach(function (e) {
      var nm = u8str(e.name), c = crc(e.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, c, true); h.setUint32(18, e.data.length, true); h.setUint32(22, e.data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, e.data);
      var g = new DataView(new ArrayBuffer(46));
      g.setUint32(0, 0x02014b50, true); g.setUint16(4, 20, true); g.setUint16(6, 20, true); g.setUint16(8, 0x0800, true); g.setUint16(10, 0, true); g.setUint16(12, tm, true); g.setUint16(14, dt, true); g.setUint32(16, c, true); g.setUint32(20, e.data.length, true); g.setUint32(24, e.data.length, true); g.setUint16(28, nm.length, true); g.setUint32(42, off, true);
      cen.push(new Uint8Array(g.buffer), nm);
      off += 30 + nm.length + e.data.length;
    });
    var cl = 0; cen.forEach(function (x) { cl += x.length; });
    var z = new DataView(new ArrayBuffer(22)); z.setUint32(0, 0x06054b50, true); z.setUint16(8, entries.length, true); z.setUint16(10, entries.length, true); z.setUint32(12, cl, true); z.setUint32(16, off, true);
    var all = parts.concat(cen, [new Uint8Array(z.buffer)]), tot = 0; all.forEach(function (x) { tot += x.length; });
    var out = new Uint8Array(tot), p = 0; all.forEach(function (x) { out.set(x, p); p += x.length; });
    return out;
  };
  function u8b64(u8) { var s = '', i; for (i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  HA.u8b64 = u8b64;
  // baca zip: kembalikan Promise<Uint8Array|null> entri pertama yang cocok
  HA.zipRead = function (u8, re) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.length), i, e = -1;
    for (i = u8.length - 22; i >= Math.max(0, u8.length - 65600); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) return Promise.resolve(null);
    var n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), k;
    for (k = 0; k < n && p + 46 <= u8.length; k++) {
      var meth = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      var nm = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      if (re.test(nm)) {
        var lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), st = lo + 30 + lnl + lxl, raw = u8.subarray(st, st + cs);
        if (meth === 0) return Promise.resolve(raw);
        if (meth === 8 && typeof DecompressionStream !== 'undefined') {
          var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(raw); w.close();
          return new Response(ds.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
        }
        return Promise.resolve(null);
      }
      p += 46 + nl + xl + cl;
    }
    return Promise.resolve(null);
  };
  // ---- ekspor: Zip berisi .hzblok
  HA.saveHzBlokZip = function (baseName, json) {
    var z = HA.zipStore([{ name: baseName + '.hzblok', data: u8str(json) }]);
    return HA.saveFile(baseName + '.zip', u8b64(z), 'application/zip');
  };
  // ---- buka: bytes (hzblok json atau zip) -> kartu Simpan/Batal
  function b64u8(b64) { var s = atob(b64), u = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  HA.hzblokOpen = function (u8, name) {
    var isZip = u8.length > 3 && u8[0] === 0x50 && u8[1] === 0x4B;
    return (isZip ? HA.zipRead(u8, /\.hzblok$/i) : Promise.resolve(u8)).then(function (b) {
      if (!b) throw new Error('Tidak ada berkas .hzblok di dalamnya');
      var d; try { d = JSON.parse(new TextDecoder().decode(b)); } catch (e) { throw new Error('Bukan berkas data blok'); }
      if (!d || d.hzblok !== 1 || !Array.isArray(d.blocks)) throw new Error('Bukan berkas data blok HZ Trip');
      var pv = HA.previewHzBlok(d);
      HA.openSheet('<div class="grab"></div><div class="st">DATA BLOK DITERIMA</div>' +
        '<div class="card" style="margin-top:10px"><b>' + esc(d.master && d.master.name || name || 'Data blok') + '</b><div class="muted" style="margin-top:4px">' + pv.added + ' blok baru, ' + pv.skipped + ' dilewati (nama sudah ada)' + (pv.master ? ' · master ditambahkan' : '') + (d.tgl ? ' · dibuat ' + esc(d.tgl) : '') + '</div></div>' +
        '<div class="row" style="gap:8px;margin-top:12px"><button class="btn" id="hoX" style="flex:1">Batal</button><button class="btn pri" id="hoY" style="flex:1"' + (pv.added || pv.master ? '' : ' disabled') + '>Simpan</button></div>');
      $('hoX').onclick = function () { HA.closeSheet(); };
      $('hoY').onclick = function () { var r = HA.restoreHzBlok(d); HA.closeSheet(); HA.toast(r.added + ' blok baru' + (r.skipped ? ', ' + r.skipped + ' dilewati' : '') + (r.master ? ', master ditambahkan' : '')); };
    }).catch(function (e) { HA.toast('Gagal membuka: ' + (e && e.message || e)); });
  };
  // pintu masuk berkas dari luar: .hzblok / zip data blok, atau berkas peta (KML, KMZ, GPX, GeoJSON)
  HA.openIncoming = function (name, u8) {
    var ext = (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1] || '', lc = ext.toLowerCase();
    if (lc === 'hzblok') return HA.hzblokOpen(u8, name);
    if (lc === 'kml' || lc === 'kmz' || lc === 'gpx' || lc === 'geojson') return HA.layImport(name, u8);
    var isZip = u8.length > 3 && u8[0] === 0x50 && u8[1] === 0x4B;
    if (isZip) return HA.zipRead(u8, /\.hzblok$/i).then(function (b) { return b ? HA.hzblokOpen(u8, name) : HA.layImport(name, u8); });
    var head = new TextDecoder().decode(u8.subarray(0, 400));
    if (/"hzblok"\s*:/.test(head)) return HA.hzblokOpen(u8, name);
    return HA.layImport(name, u8);
  };
  HA.hzblokOpenB64 = function (name, b64) { return HA.openIncoming(name, b64u8(b64)); };
  // ---- dari Android: berkas yang dibuka lewat HZ Trip
  function take() { try { var P = HA.Plug; if (P && P.takePendingBlok) P.takePendingBlok().then(function (r) { if (r && r.b64) HA.hzblokOpenB64(r.name, r.b64); }).catch(function () {}); } catch (e) {} }
  try { if (HA.Plug && HA.Plug.addListener) HA.Plug.addListener('hzblok', take); } catch (e) {}
  setTimeout(take, 1500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(take, 400); });
})();
