/* HZ Trip - logika trip (tanpa DOM, bisa diuji di Node).
 * Titik mentah tidak pernah diubah. Trip dihitung ulang dari titik mentah setiap kali dibuka. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HzTrips = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  var DEF = {
    startKmh: 5,      // trip mulai bila kecepatan >= ini ...
    startSec: 5,       // ... selama sekurang-kurangnya ini (detik)
    stopKmh: 3,       // di bawah ini dianggap berhenti
    splitSec: 60,     // berhenti selama ini (detik) -> trip berakhir
    slowKmh: 10,      // di bawah ini terus-menerus dianggap jalan kaki/merayap
    slowSec: 600,     // ... selama ini (detik) -> trip berakhir
    gapSec: 300,      // data GPS hilang selama ini -> trip berakhir
    maxAcc: 50,       // titik dengan akurasi lebih buruk (meter) diabaikan
    validKmh: 10,     // trip sah hanya bila kecepatan maks mencapai ini (jalan kaki dibuang)
    minMoveKmh: 10    // kecepatan "min" = terendah di antara titik yang masih >= ini
  };

  // CSV: waktu_ms,lat,lng,kecepatan_m_per_s,akurasi_m[,manual 0/1]
  function parseCsv(text) {
    var out = [];
    if (!text) return out;
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!l) continue;
      var p = l.split(',');
      if (p.length < 5) continue;
      var t = +p[0], lat = +p[1], lng = +p[2], v = +p[3] * 3.6, acc = +p[4];
      if (!isFinite(t) || !isFinite(lat) || !isFinite(lng) || !isFinite(v)) continue;
      out.push({ t: t, lat: lat, lng: lng, v: v, acc: isFinite(acc) ? acc : 99, m: p[5] === '1' ? 1 : 0 });
    }
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }

  function zoneOf(v) { return v <= 60 ? 'g' : (v <= 90 ? 'y' : 'r'); }

  function haversine(a, b) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }

  function median3(a, b, c) {
    return a > b ? (b > c ? b : (a > c ? c : a)) : (a > c ? a : (b > c ? c : b));
  }

  function stats(pts, i0, i1, o) {
    var dist = 0, movSec = 0, mn = Infinity, mx = 0, mxIdx = i0;
    var zg = 0, zy = 0, zr = 0;
    for (var j = i0; j <= i1; j++) {
      var p = pts[j];
      var pv = j > i0 ? pts[j - 1].v : p.v, nv = j < i1 ? pts[j + 1].v : p.v;
      var sm = median3(pv, p.v, nv); // buang lonjakan satu titik
      if (sm > mx) { mx = sm; mxIdx = j; }
      if (sm >= o.minMoveKmh && sm < mn) mn = sm;
      if (j > i0) {
        var q = pts[j - 1], dt = (p.t - q.t) / 1000;
        if (dt <= 0) continue;
        if (dt <= 10) {
          if (Math.max(p.v, q.v) >= o.stopKmh) {
            var d = (p.v + q.v) / 2 / 3.6 * dt;
            dist += d; movSec += dt;
            var z = zoneOf(sm);
            if (z === 'g') zg += dt; else if (z === 'y') zy += dt; else zr += dt;
          }
        } else {
          var hd = haversine(q, p); // celah data pendek: pakai jarak posisi bila masuk akal
          if (hd / dt * 3.6 <= 200) { dist += hd; movSec += dt; }
        }
      }
    }
    var avg = movSec > 0 ? dist / movSec * 3.6 : 0;
    var mp = pts[mxIdx];
    return {
      km: dist / 1000, min: mn === Infinity ? 0 : mn, max: mx, avg: avg,
      maxT: mp.t, maxLat: mp.lat, maxLng: mp.lng, movSec: movSec,
      zg: zg, zy: zy, zr: zr
    };
  }

  function makeTrip(pts, i0, i1, o, open) {
    var s = stats(pts, i0, i1, o);
    s.id = pts[i0].t;
    s.start = pts[i0].t;
    s.end = pts[i1].t;
    s.durSec = (pts[i1].t - pts[i0].t) / 1000;
    s.n = i1 - i0 + 1;
    s.startLat = pts[i0].lat; s.startLng = pts[i0].lng;
    s.endLat = pts[i1].lat; s.endLng = pts[i1].lng;
    s.i0 = i0; s.i1 = i1;
    s.open = !!open;
    s.manual = false;
    for (var j = i0; j <= i1; j++) { if (pts[j].m) { s.manual = true; break; } }
    return s;
  }

  function detectTrips(allPoints, opts) {
    var o = {}, k;
    for (k in DEF) o[k] = DEF[k];
    if (opts) for (k in opts) if (opts[k] != null) o[k] = opts[k];

    var pts = allPoints.filter(function (p) { return p.acc <= o.maxAcc; });
    var trips = [];
    var segStart = 0;
    for (var i = 1; i <= pts.length; i++) {
      if (i === pts.length || pts[i].t - pts[i - 1].t > o.gapSec * 1000) {
        runSegment(pts, segStart, i - 1, o, trips, i === pts.length);
        segStart = i;
      }
    }
    return { trips: trips, points: pts, o: o };
  }

  function addTrip(trips, t, o) { if (t.max >= o.validKmh) trips.push(t); }

  function runSegment(pts, a, b, o, trips, isLast) {
    var cur = null, runStart = -1, lastMove = 0, lastFast = 0;
    for (var i = a; i <= b; i++) {
      var p = pts[i];
      if (!cur) {
        if (p.v >= o.startKmh) {
          if (runStart < 0) runStart = i;
          if (p.t - pts[runStart].t >= o.startSec * 1000) {
            var s = runStart; // mundur sedikit ke awal gerak (>= stopKmh) dalam 30 detik terakhir
            while (s > a && pts[s - 1].v >= o.stopKmh && pts[runStart].t - pts[s - 1].t <= 30000) s--;
            cur = { s: s };
            lastMove = i; lastFast = i;
            runStart = -1;
          }
        } else {
          runStart = -1;
        }
      } else {
        if (p.v >= o.stopKmh) lastMove = i;
        if (p.v >= o.slowKmh) lastFast = i;
        if (p.t - pts[lastMove].t >= o.splitSec * 1000) {
          addTrip(trips, makeTrip(pts, cur.s, lastMove, o, false), o);
          cur = null; runStart = -1;
        } else if (p.t - pts[lastFast].t >= o.slowSec * 1000) {
          addTrip(trips, makeTrip(pts, cur.s, lastFast, o, false), o);
          cur = null; runStart = -1;
        }
      }
    }
    if (cur) {
      // Data berakhir saat trip masih jalan. Di segmen terakhir = trip masih berjalan (open).
      addTrip(trips, makeTrip(pts, cur.s, lastMove, o, isLast), o);
    }
  }


  // ---- potong dan gabung (titik mentah tidak diubah) ----
  // ed = { ops: [ {c: waktu_ms} potong | {j: id trip pertama} gabung dengan trip berikutnya ] }
  // Operasi dijalankan berurutan sesuai urutan Han membuatnya.
  function applyEdits(res, ed) {
    var pts = res.points, o = res.o, trips = res.trips.slice();
    if (!ed || !ed.ops) return trips;
    ed.ops.forEach(function (op) {
      var i, t;
      if (op.j !== undefined) {
        for (i = 0; i < trips.length - 1; i++) {
          if (trips[i].id === op.j) {
            var a = trips[i], b = trips[i + 1];
            trips.splice(i, 2, makeTrip(pts, a.i0, b.i1, o, b.open));
            break;
          }
        }
      } else if (op.c !== undefined) {
        for (i = 0; i < trips.length; i++) {
          t = trips[i];
          if (op.c > t.start && op.c < t.end) {
            var k = t.i0;
            while (k < t.i1 && pts[k + 1].t <= op.c) k++;
            if (k > t.i0 && k + 1 < t.i1) {
              trips.splice(i, 1, makeTrip(pts, t.i0, k, o, false), makeTrip(pts, k + 1, t.i1, o, t.open));
            }
            break;
          }
        }
      }
    });
    return trips;
  }

  // ---- jadwal mingguan ----
  // sched = { days: [7 hari, 0=Minggu] { in:'06:00', out:'17:30', brk:true, brkFrom:'11:00', brkTo:'13:30' } }
  function minOf(hhmm) {
    if (!hhmm) return -1;
    var p = String(hhmm).split(':');
    var h = +p[0], m = +p[1];
    return (isFinite(h) && isFinite(m)) ? h * 60 + m : -1;
  }
  function defaultSchedule() {
    var d = [];
    for (var i = 0; i < 7; i++) d.push({ 'in': '', out: '', brk: true, brkFrom: '11:00', brkTo: '13:30' });
    return { days: d };
  }
  function classify(sched, ts) {
    var d = new Date(ts);
    var day = sched && sched.days && sched.days[d.getDay()];
    if (!day) return 'Pribadi';
    var a = minOf(day['in']), b = minOf(day.out);
    if (a < 0 || b <= a) return 'Pribadi';
    var m = d.getHours() * 60 + d.getMinutes();
    if (m < a || m >= b) return 'Pribadi';
    if (day.brk) {
      var f = minOf(day.brkFrom), g = minOf(day.brkTo);
      if (f >= 0 && g > f && m >= f && m < g) return 'Pribadi';
    }
    return 'Kerja';
  }
  // label otomatis dari waktu mulai; check = true bila trip melewati batas jam kerja
  function autoLabel(sched, trip) {
    var a = classify(sched, trip.start), b = classify(sched, trip.end);
    return { label: a, check: a !== b };
  }
  // untuk dikirim ke Android: menit sejak 00.00 (-1 = libur)
  function nativeDays(sched) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = sched && sched.days && sched.days[i];
      var a = d ? minOf(d['in']) : -1, b = d ? minOf(d.out) : -1;
      if (a < 0 || b <= a) { a = -1; b = -1; }
      out.push({ i: a, o: b });
    }
    return out;
  }
  // jendela otomatis pada tanggal tertentu: {s,e} (ms) atau null
  function windowOn(sched, ymdStr, marginMin) {
    var p = ymdStr.split('-');
    var base = new Date(+p[0], +p[1] - 1, +p[2]);
    var day = sched && sched.days && sched.days[base.getDay()];
    if (!day) return null;
    var a = minOf(day['in']), b = minOf(day.out);
    if (a < 0 || b <= a) return null;
    return { s: base.getTime() + (a - marginMin) * 60000, e: base.getTime() + (b + marginMin) * 60000 };
  }

  // ---- format ----
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + '.' + pad(d.getMinutes()); }
  function ymd(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function km1(n) { return n.toFixed(1).replace('.', ','); }
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function dateLong(ymdStr) {
    var p = ymdStr.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  }
  function durText(sec) {
    sec = Math.round(sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + ' j ' + m + ' m';
    if (m > 0) return m + ' m';
    return sec + ' d';
  }

  return {
    DEF: DEF, parseCsv: parseCsv, detectTrips: detectTrips, zoneOf: zoneOf,
    applyEdits: applyEdits, defaultSchedule: defaultSchedule, classify: classify, autoLabel: autoLabel,
    nativeDays: nativeDays, windowOn: windowOn, minOf: minOf,
    hm: hm, ymd: ymd, km1: km1, dateLong: dateLong, durText: durText, pad: pad
  };
});
