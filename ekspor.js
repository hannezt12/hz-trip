/* HZ Trip - ekspor KML dan PDF, serta potongan trek berwarna untuk peta.
 * days = [{ ymd:'2026-10-16', pts:[titik mentah terfilter], trips:[{ t:trip, unit, label, check }] }]
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./trips.js'));
  else root.HzEkspor = factory(root.HzTrips);
})(typeof self !== 'undefined' ? self : this, function (T) {

  var KCOL = { g: 'ff7ad03f', y: 'ff18c5f5', r: 'ff505bff', s: 'ff9e9e9e' }; // KML = aabbggrr
  var ZNAME = { g: 'hingga 60 km/j', y: '60-90 km/j', r: 'di atas 90 km/j', s: 'berhenti' };

  function xe(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }
  function iso(ts) { return new Date(ts).toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function f6(n) { return n.toFixed(6); }

  // Potongan trek per zona warna. Titik dijarangkan (>= 2 detik) agar berkas ringan;
  // titik batas dipakai di dua potongan supaya garis tersambung.
  // Penanda berhenti: kecepatan di bawah 1 km/j terus-menerus selama >= 60 detik
  function stopFlags(pts, i0, i1) {
    var fl = {}, a = -1, j;
    function close(b) { if (a >= 0 && pts[b].t - pts[a].t >= 60000) for (var k = a; k <= b; k++) fl[k] = 1; a = -1; }
    for (j = i0; j <= i1; j++) {
      if (pts[j].v < 1) { if (a < 0) a = j; } else close(j - 1);
    }
    if (a >= 0) close(i1);
    return fl;
  }
  function zoneRuns(pts, i0, i1) {
    var fl = stopFlags(pts, i0, i1);
    function zz(j) { return fl[j] ? 's' : T.zoneOf(pts[j].v); }
    var kept = [], kz = [], last = -1e15, lastZ = null, j, p, z;
    for (j = i0; j <= i1; j++) {
      p = pts[j]; z = zz(j);
      if (j === i0 || j === i1 || p.t - last >= 2000 || z !== lastZ) { kept.push(p); kz.push(z); last = p.t; lastZ = z; }
    }
    var runs = [], cur = null;
    for (j = 1; j < kept.length; j++) {
      z = kz[j];
      if (!cur || cur.z !== z) {
        cur = { z: z, pts: [kept[j - 1]] };
        runs.push(cur);
      }
      cur.pts.push(kept[j]);
    }
    if (!runs.length && kept.length) runs.push({ z: kz[0], pts: kept.slice() });
    return runs;
  }
  // Trek satu trip: garis berwarna per bagian + jeda antar bagian (trip gabungan)
  function trackOf(pts, t) {
    var parts = t.parts && t.parts.length > 1 ? t.parts : [{ i0: t.i0, i1: t.i1 }];
    var runs = [], gaps = [];
    parts.forEach(function (pt, k) {
      runs = runs.concat(zoneRuns(pts, pt.i0, pt.i1));
      if (k > 0) {
        var a = pts[parts[k - 1].i1], b = pts[pt.i0];
        gaps.push({ a: a, b: b, from: a.t, to: b.t });
      }
    });
    return { runs: runs, gaps: gaps };
  }

  function sumDay(day) {
    var r = { n: 0, km: 0, max: 0, kerja: 0, pribadi: 0, nK: 0, nP: 0, mK: 0, mP: 0, zg: 0, zy: 0, zr: 0 };
    day.trips.forEach(function (x) {
      var t = x.t;
      r.n++; r.km += t.km; r.max = Math.max(r.max, t.max);
      r.zg += t.zg; r.zy += t.zy; r.zr += t.zr;
      if (x.label === 'Kerja') { r.nK++; r.kerja += t.km; r.mK = Math.max(r.mK, t.max); }
      else { r.nP++; r.pribadi += t.km; r.mP = Math.max(r.mP, t.max); }
    });
    return r;
  }
  function units(day) {
    var u = [];
    day.trips.forEach(function (x) { if (u.indexOf(x.unit) < 0) u.push(x.unit); });
    return u;
  }
  function range(t) { return T.hm(t.start) + ' - ' + T.hm(t.end); }

  // ================= KML =================
  function tripBalloon(x, no) {
    var t = x.t;
    return '<![CDATA[<table cellpadding="3">' +
      '<tr><td><b>Waktu</b></td><td>' + range(t) + ' (' + T.durText(t.durSec) + ')</td></tr>' +
      '<tr><td><b>Unit</b></td><td>' + xe(x.unit) + '</td></tr>' +
      '<tr><td><b>Label</b></td><td>' + x.label + '</td></tr>' +
      '<tr><td><b>Jarak</b></td><td>' + T.km1(t.km) + ' km</td></tr>' +
      '<tr><td><b>Kecepatan</b></td><td>maks ' + Math.round(t.max) + ' | rata-rata ' + Math.round(t.avg) + ' km/j</td></tr>' +
      '<tr><td><b>Waktu bergerak</b></td><td>hijau ' + T.durText(t.zg) + ' | kuning ' + T.durText(t.zy) + ' | merah ' + T.durText(t.zr) + '</td></tr>' +
      '</table>]]>';
  }
  function point(name, t, lat, lng, style, desc) {
    return '<Placemark><name>' + xe(name) + '</name><styleUrl>#' + style + '</styleUrl>' +
      (desc ? '<description>' + desc + '</description>' : '') +
      '<TimeStamp><when>' + iso(t) + '</when></TimeStamp>' +
      '<Point><coordinates>' + f6(lng) + ',' + f6(lat) + ',0</coordinates></Point></Placemark>';
  }
  function buildKml(days, opts) {
    opts = opts || {};
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
      '<name>' + xe(opts.title || 'HZ Trip') + '</name>'];
    ['g', 'y', 'r', 's'].forEach(function (z) {
      out.push('<Style id="z' + z + '"><LineStyle><color>' + KCOL[z] + '</color><width>5</width></LineStyle></Style>');
    });
    out.push('<Style id="pS"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon></IconStyle></Style>');
    out.push('<Style id="pE"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon></IconStyle></Style>');
    out.push('<Style id="pM"><IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-stars.png</href></Icon></IconStyle></Style>');
    days.forEach(function (day) {
      var s = sumDay(day);
      out.push('<Folder><name>' + xe(T.dateLong(day.ymd)) + '</name>');
      out.push('<description><![CDATA[<b>' + s.n + ' trip | ' + T.km1(s.km) + ' km | maks ' + Math.round(s.max) + ' km/j</b><br>Kerja ' + T.km1(s.kerja) + ' km | Pribadi ' + T.km1(s.pribadi) + ' km<br>Waktu bergerak: hijau ' + T.durText(s.zg) + ' | kuning ' + T.durText(s.zy) + ' | merah ' + T.durText(s.zr) + ']]></description>');
      day.trips.forEach(function (x, i) {
        var t = x.t, no = i + 1;
        out.push('<Folder><name>' + xe('Trip ' + no + ' | ' + range(t) + ' | ' + x.unit + ' | ' + x.label) + '</name>');
        out.push('<description>' + tripBalloon(x, no) + '</description>');
        out.push('<TimeSpan><begin>' + iso(t.start) + '</begin><end>' + iso(t.end) + '</end></TimeSpan>');
        var tk = trackOf(day.pts, t);
        tk.runs.forEach(function (r) {
          out.push('<Placemark><name>' + xe(ZNAME[r.z]) + '</name><styleUrl>#z' + r.z + '</styleUrl><LineString><tessellate>1</tessellate><coordinates>' +
            r.pts.map(function (p) { return f6(p.lng) + ',' + f6(p.lat) + ',0'; }).join(' ') + '</coordinates></LineString></Placemark>');
        });
        tk.gaps.forEach(function (g) {
          out.push('<Placemark><name>' + xe('Berhenti ' + T.hm(g.from) + '-' + T.hm(g.to) + ' (' + T.durText((g.to - g.from) / 1000) + ')') + '</name><styleUrl>#zs</styleUrl><LineString><tessellate>1</tessellate><coordinates>' +
            f6(g.a.lng) + ',' + f6(g.a.lat) + ',0 ' + f6(g.b.lng) + ',' + f6(g.b.lat) + ',0</coordinates></LineString></Placemark>');
        });
        out.push(point('Mulai ' + T.hm(t.start), t.start, t.startLat, t.startLng, 'pS', tripBalloon(x, no)));
        out.push(point('Selesai ' + T.hm(t.end), t.end, t.endLat, t.endLng, 'pE', tripBalloon(x, no)));
        out.push(point('Tercepat ' + Math.round(t.max) + ' km/j (' + T.hm(t.maxT) + ')', t.maxT, t.maxLat, t.maxLng, 'pM', null));
        out.push('</Folder>');
      });
      out.push('</Folder>');
    });
    out.push('</Document></kml>');
    return out.join('\n');
  }

  // ================= PDF =================
  function buildPdf(days, opts, jsPDFCtor) {
    opts = opts || {};
    var JS = jsPDFCtor || (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF);
    var doc = new JS({ unit: 'mm', format: 'a4' });
    var W = 210, M = 14, anyCheck = false;
    var printed = (function () { var d = new Date(); return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()] + ' ' + d.getFullYear() + ', ' + T.pad(d.getHours()) + '.' + T.pad(d.getMinutes()); })();
    var driver = opts.driver || '';
    var single = opts.scope === 'trip';

    function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
    function txt(s, x, y, size, bold, color, align) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      doc.setTextColor.apply(doc, hex(color || '#161C20'));
      doc.text(String(s), x, y, align ? { align: align } : undefined);
    }

    if (opts.scope === 'bulan') { monthPage(); days = []; }
    function monthPage() {
      var BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      var mm = (opts.month || (days[0] && days[0].ymd.slice(0, 7)) || '').split('-');
      var title = mm.length === 2 ? BLN[+mm[1] - 1] + ' ' + mm[0] : '';
      txt('HZ TRIP', M, 17, 9, true, '#4A5A63');
      txt('Rekap Bulanan Perjalanan', M, 25, 18, true);
      txt(title, W - M, 25, 13, true, '#161C20', 'right');
      doc.setDrawColor.apply(doc, hex('#161C20')); doc.setLineWidth(0.6); doc.line(M, 28, W - M, 28);
      var us = [], lb = [];
      days.forEach(function (d) { d.trips.forEach(function (x) { if (us.indexOf(x.unit) < 0) us.push(x.unit); if (lb.indexOf(x.label) < 0) lb.push(x.label); }); });
      [['Pengemudi', driver || '-'], ['Unit', us.join(', ') || '-'], ['Label', lb.join(' dan ') || '-']].forEach(function (it, k) {
        var x = M + k * ((W - 2 * M) / 3);
        txt(it[0], x, 34, 8, false, '#4A5A63'); txt(it[1], x, 39, 10, true);
      });
      var tk = 0, tmax = 0, ws = 0, ds = 0;
      var rows = days.map(function (d) {
        var km = 0, mx = 0, w = 0, du = 0;
        d.trips.forEach(function (x) { km += x.t.km; mx = Math.max(mx, x.t.max); w += x.t.avg * x.t.durSec; du += x.t.durSec; });
        tk += km; tmax = Math.max(tmax, mx); ws += w; ds += du;
        return { cells: [T.dateLong(d.ymd), units(d).join(', '), String(Math.round(mx)), String(Math.round(du ? w / du : 0)), T.km1(km)], max: mx };
      });
      var body = rows.map(function (r) { return r.cells; });
      body.push(['Total (' + rows.length + ' hari)', '', String(Math.round(tmax)), String(Math.round(ds ? ws / ds : 0)), T.km1(tk)]);
      doc.autoTable({
        startY: 43, margin: { left: M, right: M }, theme: 'grid',
        head: [['Tanggal', 'Unit', 'Maks km/j', 'Rata-rata km/j', 'Total km']], body: body,
        styles: { font: 'helvetica', fontSize: 10, cellPadding: { top: 2, bottom: 2, left: 2, right: 2.5 }, lineColor: [221, 227, 230], lineWidth: 0.2, textColor: hex('#161C20') },
        headStyles: { fillColor: hex('#E9EEF0'), textColor: hex('#2C3A41'), fontStyle: 'bold', fontSize: 9, lineColor: [201, 210, 215] },
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { cellWidth: 36 }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 32 }, 4: { halign: 'right', cellWidth: 24 } },
        didParseCell: function (d) {
          if (d.section === 'head' && d.column.index >= 2) d.cell.styles.halign = 'right';
          if (d.section === 'body' && d.row.index === rows.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = hex('#F3F6F7'); }
          if (d.section === 'body' && d.column.index === 2 && opts.color !== false) {
            var v = d.row.index < rows.length ? rows[d.row.index].max : tmax;
            d.cell.styles.fontStyle = 'bold';
            if (v > 90) { d.cell.styles.fillColor = hex('#FFB9B2'); d.cell.styles.textColor = hex('#6E0F08'); }
            else if (v > 60) { d.cell.styles.fillColor = hex('#FFE98A'); d.cell.styles.textColor = hex('#4A3A00'); }
          }
        }
      });
      var y = doc.lastAutoTable.finalY + 6;
      if (opts.color !== false) {
        txt('Kecepatan maks:', M, y, 8, false, '#4A5A63');
        var lx = M + 28;
        [['#FFFFFF', 'hingga 60'], ['#FFE98A', '60-90'], ['#FFB9B2', '90 ke atas']].forEach(function (b) {
          doc.setFillColor.apply(doc, hex(b[0])); doc.setDrawColor.apply(doc, hex('#C9D2D7')); doc.setLineWidth(0.2);
          doc.rect(lx, y - 2.6, 5, 3.4, 'FD'); txt(b[1], lx + 6.5, y, 8, false, '#4A5A63'); lx += 8 + doc.getTextWidth(b[1]) + 6;
        });
      }
      doc.setDrawColor.apply(doc, hex('#C9D2D7')); doc.setLineWidth(0.3); doc.line(M, 280, W - M, 280);
      txt('Rata-rata harian dihitung dari seluruh waktu berjalan pada hari itu. Data direkam dari GPS ponsel dan bersifat pembanding.', M, 284, 8, false, '#4A5A63');
    }
    days.forEach(function (day, di) {
      if (di > 0) doc.addPage();
      anyCheck = false;
      var s = sumDay(day);
      txt('HZ TRIP', M, 17, 9, true, '#4A5A63');
      txt(single ? 'Laporan Perjalanan' : (opts.scope === 'range' ? 'Laporan Perjalanan' : 'Laporan Harian Perjalanan'), M, 25, 18, true);
      txt(T.dateLong(day.ymd), W - M, 25, 13, true, '#161C20', 'right');
      doc.setDrawColor.apply(doc, hex('#161C20')); doc.setLineWidth(0.6); doc.line(M, 28, W - M, 28);

      var labels = []; day.trips.forEach(function (x) { if (labels.indexOf(x.label) < 0) labels.push(x.label); });
      var info = [['Pengemudi', driver || '-'], ['Unit', units(day).join(' dan ') || '-'], ['Label', labels.join(' dan ') || '-']];
      info.forEach(function (it, k) {
        var x = M + k * ((W - 2 * M) / 3);
        txt(it[0], x, 34, 8, false, '#4A5A63'); txt(it[1], x, 39, 10, true);
      });

      var body = day.trips.map(function (x, i) {
        if (x.check) anyCheck = true;
        var t = x.t;
        return [String(i + 1), range(t) + (x.check ? ' *' : ''), x.unit, String(Math.round(t.max)), String(Math.round(t.avg)), T.km1(t.km)];
      });
      doc.autoTable({
        startY: 43, margin: { left: M, right: M },
        head: [['No', 'Waktu', 'Unit', 'Maks', 'Rata-rata', 'Jarak km']],
        body: body, theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: { top: 2, bottom: 2, left: 2, right: 2.5 }, lineColor: [221, 227, 230], lineWidth: 0.2, textColor: hex('#161C20') },
        headStyles: { fillColor: hex('#E9EEF0'), textColor: hex('#2C3A41'), fontStyle: 'bold', fontSize: 9, lineColor: [201, 210, 215] },
        columnStyles: { 0: { halign: 'center', cellWidth: 12, textColor: hex('#4A5A63') }, 1: { cellWidth: 'auto', fontStyle: 'bold' }, 2: { cellWidth: 34 }, 3: { halign: 'right', cellWidth: 22 }, 4: { halign: 'right', cellWidth: 28 }, 5: { halign: 'right', cellWidth: 30 } },
        didParseCell: function (d) {
          if (d.section === 'head' && d.column.index >= 3) d.cell.styles.halign = 'right';
          if (d.section === 'body' && d.column.index === 3 && opts.color !== false) {
            var v = day.trips[d.row.index].t.max;
            d.cell.styles.fontStyle = 'bold';
            if (v > 90) { d.cell.styles.fillColor = hex('#FFB9B2'); d.cell.styles.textColor = hex('#6E0F08'); }
            else if (v > 60) { d.cell.styles.fillColor = hex('#FFE98A'); d.cell.styles.textColor = hex('#4A3A00'); }
          }
        }
      });
      var y = doc.lastAutoTable.finalY + 6;

      if (opts.color !== false) {
        txt('Kecepatan maks:', M, y, 8, false, '#4A5A63');
        var lx = M + 28;
        [['#FFFFFF', 'hingga 60'], ['#FFE98A', '60-90'], ['#FFB9B2', '90 ke atas']].forEach(function (b) {
          doc.setFillColor.apply(doc, hex(b[0])); doc.setDrawColor.apply(doc, hex('#C9D2D7')); doc.setLineWidth(0.2);
          doc.rect(lx, y - 2.6, 5, 3.4, 'FD'); txt(b[1], lx + 6.5, y, 8, false, '#4A5A63'); lx += 8 + doc.getTextWidth(b[1]) + 6;
        });
        y += 8;
      }

      if (single) {
        var t0 = day.trips[0].t;
        txt('RINCIAN TRIP', M, y, 8, true, '#4A5A63'); y += 5;
        [['Durasi', T.durText(t0.durSec)], ['Titik tercepat', Math.round(t0.max) + ' km/j pada ' + T.hm(t0.maxT)], ['Waktu bergerak', 'hijau ' + T.durText(t0.zg) + ' | kuning ' + T.durText(t0.zy) + ' | merah ' + T.durText(t0.zr)], ['Titik GPS', String(t0.n) + (t0.manual ? ' (rekam manual)' : '')]].forEach(function (r) {
          txt(r[0], M, y, 10, false, '#4A5A63'); txt(r[1], M + 38, y, 10, true); y += 6;
        });
      } else if (opts.summary !== false) {
        txt('RINGKASAN', M, y, 8, true, '#4A5A63'); y += 3;
        var bw = (W - 2 * M - 8) / 3;
        var cards = [
          ['Semua unit', s.n, s.km, s.max],
          ['Kerja', s.nK, s.kerja, s.mK],
          ['Pribadi', s.nP, s.pribadi, s.mP]
        ];
        cards.forEach(function (c, k) {
          var x = M + k * (bw + 4);
          doc.setDrawColor.apply(doc, hex('#C9D2D7')); doc.setLineWidth(0.3); doc.roundedRect(x, y, bw, 22, 1.5, 1.5, 'S');
          txt(c[0], x + 3, y + 5, 8, false, '#4A5A63');
          txt(c[1] + ' trip', x + 3, y + 12, 15, true);
          txt(T.km1(c[2]) + ' km | maks ' + Math.round(c[3]) + ' km/j', x + 3, y + 18.5, 8.5, false);
        });
        y += 28;
        txt('Waktu bergerak menurut zona: hijau ' + T.durText(s.zg) + ' | kuning ' + T.durText(s.zy) + ' | merah ' + T.durText(s.zr), M, y, 9.5, false);
      }

      var notes = [];
      notes.push('Data direkam dari GPS ponsel dan bersifat pembanding.');
      doc.setDrawColor.apply(doc, hex('#C9D2D7')); doc.setLineWidth(0.3); doc.line(M, 280, W - M, 280);
      notes.forEach(function (n, k) { txt(n, M, 284 + k * 4, 8, false, '#4A5A63'); });
    });

    if (days.length > 1 && opts.scope !== 'bulan') {
      doc.addPage();
      txt('HZ TRIP', M, 17, 9, true, '#4A5A63');
      txt('Rekap Rentang Tanggal', M, 25, 18, true);
      doc.setDrawColor.apply(doc, hex('#161C20')); doc.setLineWidth(0.6); doc.line(M, 28, W - M, 28);
      var tot = { n: 0, km: 0, max: 0, k: 0, p: 0 };
      var rows = days.map(function (d) {
        var s = sumDay(d); tot.n += s.n; tot.km += s.km; tot.max = Math.max(tot.max, s.max); tot.k += s.kerja; tot.p += s.pribadi;
        return [T.dateLong(d.ymd), String(s.n), T.km1(s.kerja), T.km1(s.pribadi), T.km1(s.km), String(Math.round(s.max))];
      });
      rows.push(['Total', String(tot.n), T.km1(tot.k), T.km1(tot.p), T.km1(tot.km), String(Math.round(tot.max))]);
      doc.autoTable({
        startY: 33, margin: { left: M, right: M }, theme: 'grid',
        head: [['Tanggal', 'Trip', 'Kerja km', 'Pribadi km', 'Total km', 'Maks km/j']], body: rows,
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 2, lineColor: [221, 227, 230], lineWidth: 0.2, textColor: hex('#161C20') },
        headStyles: { fillColor: hex('#E9EEF0'), textColor: hex('#2C3A41'), fontStyle: 'bold', fontSize: 9 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
        didParseCell: function (d) { if (d.section === 'head' && d.column.index >= 1) d.cell.styles.halign = 'right'; if (d.section === 'body' && d.row.index === rows.length - 1) d.cell.styles.fontStyle = 'bold'; }
      });
    }

    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      txt('Dicetak dari HZ Trip | ' + printed + ' | Halaman ' + p + ' dari ' + pages, W - M, 292, 8, false, '#4A5A63', 'right');
    }
    return doc;
  }

  return { buildKml: buildKml, buildPdf: buildPdf, zoneRuns: zoneRuns, trackOf: trackOf, sumDay: sumDay, KCOL: KCOL };
});
