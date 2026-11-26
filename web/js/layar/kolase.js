/* HZ Trip - Kolase blok (v0.27.9): sketsa banyak blok dalam satu lembar (maks 12 blok, 4 atau 2 per lembar),
 * isi kotak bisa dipilih, tanda titik/teks hanya untuk kolase (tidak masuk data blok). Keluaran PDF atau PNG. */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var S = HA.S, MAX = 12;
  var BN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var INF = [['nama', 'Nama blok'], ['luas', 'Luas'], ['varietas', 'Varietas'], ['status', 'Status'], ['umur', 'Umur'], ['bulan', 'Bulan tanam'], ['kategori', 'Kategori']];
  var SZ = { k: 0.7, s: 1, b: 1.5 };
  var PW = 1240, PH = 1754;     // A4 portrait 150 dpi
  function esc(x) { return HA.esc(x); }
  function cfg() {
    var c = S.settings.kolase || (S.settings.kolase = {});
    if (!c.info) { c.info = {}; INF.forEach(function (i) { c.info[i[0]] = true; }); }
    if (c.per !== 2 && c.per !== 4) c.per = 4;
    if (c.fmt !== 'png') c.fmt = 'pdf';
    return c;
  }
  var ST = null; // { sel:[ids], q:'', ann:{id:[{k,fx,fy,t,sz,on}]}, sz:'s', tool:'t', cur:id|null }

  // ---------- data blok ----------
  function blocks() { return HA.blocksList().filter(function (b) { return b && b.pts && b.pts.length >= 3; }); }
  function byId(id) { var r = null; blocks().forEach(function (b) { if (String(b.id) === String(id)) r = b; }); return r; }
  function haTxt(b) { return HzBlok.areaHa(b.pts).toFixed(2).replace('.', ',') + ' ha'; }
  function bulanTxt(b) { var m = HA.lyb.bulanOf(b); return m ? BN[m - 1] + ' ' + b.tn.slice(0, 4) : ''; }
  function kats(b) {
    var d = HA.tandaData && HA.tandaData(), out = [], seen = {};
    if (!d) return out;
    var P = HzBlok.proj(b.pts[0][0], b.pts[0][1]), xy = b.pts.map(P.xy);
    d.items.forEach(function (it) {
      if (!it.cat || !it.pts || !it.pts.length) return;
      var la = 0, lo = 0; it.pts.forEach(function (p) { la += p[0]; lo += p[1]; });
      var q = P.xy([la / it.pts.length, lo / it.pts.length]);
      if (!HzBlok.pip(q[0], q[1], xy)) return;
      var c = null; d.cats.forEach(function (x) { if (x.id === it.cat) c = x; });
      if (c && !seen[c.id]) { seen[c.id] = 1; out.push(c.name); }
    });
    return out;
  }
  function infoParts(b, info) {
    var a = [], v = HA.lyb.of(b, 'varietas'), s = HA.lyb.of(b, 'status');
    if (info.luas) a.push(haTxt(b));
    if (info.varietas && v) a.push('V_' + v.name);
    if (info.status && s) a.push(s.name);
    if (info.umur) { var u = HA.lyb.umur(b); if (u) a.push(u.replace(' bln', ' bulan')); }
    if (info.bulan) { var bt = bulanTxt(b); if (bt) a.push('Tanam ' + bt); }
    return a;
  }

  // ---------- gambar ----------
  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function geo(b) {
    var P = HzBlok.proj(b.pts[0][0], b.pts[0][1]), xy = b.pts.map(P.xy), mnx = 1e18, mny = 1e18, mxx = -1e18, mxy = -1e18;
    xy.forEach(function (p) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); });
    return { xy: xy, mnx: mnx, mny: mny, bw: Math.max(1, mxx - mnx), bh: Math.max(1, mxy - mny) };
  }
  // gambar sketsa dalam rect: blok utuh + garis blok tetangga yang masuk bingkai; kembali pemeta piksel -> fraksi bbox blok
  function sketch(ctx, b, R, ann, cw) {
    var g = geo(b), P = HzBlok.proj(b.pts[0][0], b.pts[0][1]), mg = 0.3 * Math.max(g.bw, g.bh);
    var ex0 = g.mnx - mg, ey0 = g.mny - mg, ew = g.bw + 2 * mg, eh = g.bh + 2 * mg;
    var sc = Math.min(R.w / ew, R.h / eh), ox = R.x + (R.w - ew * sc) / 2, oy = R.y + (R.h - eh * sc) / 2;
    function tp(x, y) { return [ox + (x - ex0) * sc, oy + (1 - (y - ey0) / eh) * eh * sc - 0]; }
    function px(fx, fy) { return tp(g.mnx + fx * g.bw, g.mny + fy * g.bh); }
    // bingkai tampak penuh: perluas ke seluruh rect (bukan hanya sebesar blok + margin)
    var vx0 = ex0 - (ox - R.x) / sc, vx1 = ex0 + (R.x + R.w - ox) / sc, vy0 = ey0 - ((R.y + R.h) - (oy + eh * sc)) / sc, vy1 = ey0 + eh + (oy - R.y) / sc;
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#8A98A0'; ctx.lineWidth = Math.max(1.5, cw * 0.0035); ctx.fillStyle = '#7A8890';
    ctx.font = '600 ' + Math.round(cw * 0.026) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    blocks().forEach(function (o) {
      if (o === b || String(o.id) === String(b.id)) return;
      var xy = o.pts.map(P.xy), mnx = 1e18, mxx = -1e18, mny = 1e18, mxy = -1e18;
      xy.forEach(function (p) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mny = Math.min(mny, p[1]); mxy = Math.max(mxy, p[1]); });
      if (mxx < vx0 || mnx > vx1 || mxy < vy0 || mny > vy1) return;
      ctx.beginPath(); xy.forEach(function (p, k) { var q = tp(p[0], p[1]); if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.stroke();
      var cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
      if (cx > vx0 && cx < vx1 && cy > vy0 && cy < vy1 && (mxx - mnx) * sc > cw * 0.08) { var t = tp(cx, cy); ctx.fillText(String(o.name), t[0], t[1]); }
    });
    var v = HA.lyb.of(b, 'varietas');
    ctx.beginPath();
    g.xy.forEach(function (p, i) { var q = tp(p[0], p[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.closePath();
    ctx.fillStyle = (v && v.col) || '#E6EBEE'; ctx.globalAlpha = v && v.col ? 0.85 : 1; ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(2.5, cw * 0.0065); ctx.strokeStyle = '#1B2A33'; ctx.stroke();
    // arah utara
    var ax = R.x + R.w - cw * 0.05, ay = R.y + cw * 0.075;
    ctx.fillStyle = '#1B2A33'; ctx.beginPath(); ctx.moveTo(ax, ay - cw * 0.035); ctx.lineTo(ax - cw * 0.018, ay + cw * 0.01); ctx.lineTo(ax + cw * 0.018, ay + cw * 0.01); ctx.closePath(); ctx.fill();
    ctx.font = '700 ' + Math.round(cw * 0.03) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('U', ax, ay + cw * 0.014);
    (ann || []).forEach(function (a) {
      if (!a.on) return;
      var q = px(a.fx, a.fy), f = SZ[a.sz] || 1;
      if (a.k === 'p') {
        var r = cw * 0.014 * f; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.fillStyle = '#FF3B30'; ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.35); ctx.strokeStyle = '#fff'; ctx.stroke();
        if (a.t) halo(ctx, a.t, q[0] + r * 1.6, q[1], cw * 0.036 * f, 'left');
      } else halo(ctx, a.t, q[0], q[1], cw * 0.044 * f, 'center');
    });
    ctx.restore();
    return { px: px, fx: function (x, y) { return [(x - ox) / (g.bw * sc) + (ex0 - g.mnx) / g.bw, ((eh * sc - (y - oy)) / sc + ey0 - g.mny) / g.bh]; } };
  }
  function halo(ctx, t, x, y, fs, al) {
    ctx.font = '700 ' + Math.round(fs) + 'px sans-serif'; ctx.textAlign = al; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, fs * 0.28); ctx.strokeStyle = '#fff'; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); ctx.fillStyle = '#1F4E9E'; ctx.fillText(t, x, y);
  }
  function cell(ctx, b, x, y, w, h, info, ann) {
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#9AA7AE'; ctx.lineWidth = 2;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 14); else ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    var ty = y + w * 0.035, tx = x + w * 0.04, mw = w * 0.92;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#111';
    if (info.nama) { ctx.font = '800 ' + Math.round(w * 0.06) + 'px sans-serif'; wrap(ctx, String(b.name), mw).slice(0, 2).forEach(function (l) { ctx.fillText(l, tx, ty); ty += w * 0.07; }); }
    var parts = infoParts(b, info);
    ctx.font = '600 ' + Math.round(w * 0.034) + 'px sans-serif'; ctx.fillStyle = '#2B3A42';
    if (parts.length) wrap(ctx, parts.join(' · '), mw).slice(0, 3).forEach(function (l) { ctx.fillText(l, tx, ty); ty += w * 0.043; });
    if (info.kategori) { var k = kats(b); if (k.length) { ctx.fillStyle = '#5A6A73'; wrap(ctx, k.join(', '), mw).slice(0, 2).forEach(function (l) { ctx.fillText(l, tx, ty); ty += w * 0.043; }); } }
    ty += w * 0.01;
    ctx.beginPath(); ctx.rect(x + 2, ty, w - 4, y + h - ty - 2); ctx.clip();
    var m = sketch(ctx, b, { x: x + 2, y: ty, w: w - 4, h: y + h - ty - 2 }, ann, w);
    ctx.restore(); return m;
  }
  function cellSize(per) { var cw = per === 4 ? (PW - 120 - 30) / 2 : PW - 120, ch = ((PH - 90 - 70) - 30) / 2; return { w: cw, h: ch }; }
  function sheetCount() { return Math.max(1, Math.ceil(ST.sel.length / cfg().per)); }
  function renderSheet(i) {
    var c = cfg(), per = c.per, cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
    var ctx = cv.getContext('2d'), sz = cellSize(per), ids = ST.sel.slice(i * per, i * per + per);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = '#5A6A73'; ctx.font = '600 26px sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText('Kolase blok', 60, 40);
    ctx.textAlign = 'right'; var n = new Date(); ctx.fillText(n.getDate() + ' ' + BN[n.getMonth()] + ' ' + n.getFullYear(), PW - 60, 40);
    ids.forEach(function (id, k) {
      var b = byId(id); if (!b) return;
      var col = per === 4 ? k % 2 : 0, row = per === 4 ? (k / 2) | 0 : k;
      cell(ctx, b, 60 + col * (sz.w + 30), 90 + row * (sz.h + 30), sz.w, sz.h, c.info, ST.ann[id]);
    });
    ctx.fillStyle = '#5A6A73'; ctx.font = '600 24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('Lembar ' + (i + 1) + ' dari ' + sheetCount(), PW / 2, PH - 24);
    return cv;
  }
  function stamp() { var t = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + p(t.getMonth() + 1) + p(t.getDate()); }
  function sendPdf() {
    var J = window.jspdf && window.jspdf.jsPDF; if (!J) { HA.toast('Pembuat PDF belum siap'); return; }
    var doc = new J({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }), n = sheetCount(), i;
    for (i = 0; i < n; i++) { if (i) doc.addPage(); doc.addImage(renderSheet(i).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297); }
    return HA.saveFile('Kolase_' + stamp() + '.pdf', doc.output('datauristring').split(',')[1], 'application/pdf');
  }
  function sendPngAll() {
    var n = sheetCount(), list = [], i;
    for (i = 0; i < n; i++) list.push({ name: 'Kolase_' + stamp() + (n > 1 ? '_' + (i + 1) : '') + '.png', b64: renderSheet(i).toDataURL('image/png').split(',')[1], mime: 'image/png' });
    return HA.saveFiles(list);
  }

  // ---------- layar ----------
  var el = null, ann = null, hl = null;
  function $e(id) { return el && el.querySelector('#' + id); }
  function close() { HA.klBack = null; HA.klPick = null; if (hl) { hl.remove(); hl = null; } document.querySelectorAll('.klIn').forEach(function (n) { n.remove(); }); if (el) el.remove(); el = null; ST = null; ann = null; }
  HA.klBack = null; HA.klPick = null;
  // tanda blok terpilih di peta (garis tebal + nomor urut)
  function drawHl() {
    if (hl) { hl.remove(); hl = null; }
    if (!HA.map || !ST) return;
    hl = L.layerGroup().addTo(HA.map);
    ST.sel.forEach(function (id, i) {
      var b = byId(id); if (!b) return;
      L.polygon(b.pts, { color: '#FF9500', weight: 4, fillColor: '#FF9500', fillOpacity: 0.18, interactive: false }).addTo(hl)
        .bindTooltip(String(i + 1), { permanent: true, direction: 'center', className: 'klTip' });
    });
  }
  function toggle(id) {
    id = String(id); var k = ST.sel.indexOf(id);
    if (k >= 0) ST.sel.splice(k, 1);
    else { if (ST.sel.length >= MAX) { HA.toast('Maksimal ' + MAX + ' blok'); return; } ST.sel.push(id); }
    main();
  }
  function open(pre) {
    if (el) close();
    var list = (pre || []).map(function (b) { return String(b.id); });
    if (list.length > MAX) { HA.toast('Maksimal ' + MAX + ' blok, sisanya tidak ikut'); list = list.slice(0, MAX); }
    ST = { sel: list, q: '', ann: {}, sz: 's', tool: 'p', cur: null, col: false };
    var mp = document.getElementById('map');
    if (!mp || !mp.offsetParent) HA.go('lintasan');
    if (S.settings.blkOn === false) { S.settings.blkOn = true; HA.saveSettings(); if (HA.drawBlocks) HA.drawBlocks(); }
    el = document.createElement('div'); el.id = 'klEd'; document.body.appendChild(el);
    HA.klPick = function (b) { if (b && ST && !ann) toggle(b.id); };
    HA.klBack = function () {
      if (!el) return false;
      var n = document.querySelector('.klIn'); if (n) { n.remove(); return true; }
      if (ann) { ann = null; main(); return true; }
      close(); return true;
    };
    main();
  }
  function head(title) {
    return '<div class="idh"><div class="idt" style="text-align:left;font-weight:700;padding-left:6px">' + esc(title) + '</div><button type="button" class="ib" id="klX" aria-label="Tutup">\u2715</button></div>';
  }
  var ICO_2 = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="8" rx="1.5"/><rect x="5" y="13" width="14" height="8" rx="1.5"/></svg>';
  var ICO_4 = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>';
  var ICO_AN = '<svg width="30" height="26" viewBox="0 0 30 24" fill="currentColor"><text x="1" y="18" font-family="sans-serif" font-weight="800" font-size="17">A</text><circle cx="23" cy="13" r="4.2"/></svg>';
  var ICO_CH_L = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l-8 8 8 8"/></svg>';
  var ICO_CH_R = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4l8 8-8 8"/></svg>';
  var ICO_SML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l5 5-5 5"/><path d="M20 7l-5 5 5 5"/></svg>'; // > < : kecilkan
  var ICO_BIG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7l-5 5 5 5"/><path d="M15 7l5 5-5 5"/></svg>'; // < > : besarkan
  function main() {
    var kb = el.querySelector('.klBody'), kl = el.querySelector('#klLs'), y0 = kb ? kb.scrollTop : 0, l0 = kl ? kl.scrollTop : 0;
    var c = cfg(), q = ST.q.trim().toLowerCase(), col = new Intl.Collator('id', { numeric: true }), all = blocks().slice().sort(function (a, b) { return col.compare(String(a.name), String(b.name)); });
    var shown = all.filter(function (b) { return !q || String(b.name).toLowerCase().indexOf(q) >= 0; }).slice(0, 60);
    var nA = 0; ST.sel.forEach(function (id) { (ST.ann[id] || []).forEach(function (a) { if (a.on) nA++; }); });
    var sh = sheetCount();
    el.className = 'klPn' + (ST.col ? ' col' : ''); if (HA.map) { try { HA.map.closePopup(); } catch (x) {} }
    el.innerHTML = '<div class="klPh" id="klPh"><span class="klGr"></span><b>Kolase blok</b><span class="muted">' + ST.sel.length + '/' + MAX + (ST.sel.length ? ' \u00B7 ' + sh + ' lembar' : '') + '</span><span style="flex:1"></span><button type="button" class="ib" id="klCl" aria-label="' + (ST.col ? 'Buka' : 'Lipat') + '">' + (ST.col ? ICO_BIG : ICO_SML) + '</button><button type="button" class="ib" id="klX" aria-label="Tutup">\u2715</button></div>' +
      '<div class="klBody"><div class="h">BLOK TERPILIH (' + ST.sel.length + '/' + MAX + ')</div><div class="klChips" id="klCh">' +
      (ST.sel.length ? ST.sel.map(function (id) { var b = byId(id); return b ? '<button type="button" class="klChip" data-r="' + esc(id) + '">' + esc(String(b.name)) + ' ✕</button>' : ''; }).join('') : '<span class="muted">Belum ada. Ketuk blok di peta atau cari nama di bawah.</span>') + '</div>' +
      '<input type="search" id="klQ" placeholder="Cari nama blok" value="' + esc(ST.q) + '" autocomplete="off" style="width:100%;margin-top:8px"><div class="klLs" id="klLs">' +
      shown.map(function (b) { var on = ST.sel.indexOf(String(b.id)) >= 0; return '<label class="klRw"><input type="checkbox" data-b="' + esc(String(b.id)) + '"' + (on ? ' checked' : '') + '><span>' + esc(String(b.name)) + '</span><small class="muted">' + haTxt(b) + '</small></label>'; }).join('') + (all.length > shown.length ? '<div class="muted" style="padding:6px">Menampilkan 60 pertama. Persempit dengan pencarian.</div>' : '') + '</div>' +
      '<div class="h" style="margin-top:12px">ISI TIAP KOTAK</div><div class="klInf">' + INF.map(function (i) { return '<label><input type="checkbox" data-i="' + i[0] + '"' + (c.info[i[0]] ? ' checked' : '') + '> ' + i[1] + '</label>'; }).join('') + '</div>' +
      '<div class="muted" style="margin-top:10px">Titik dan teks hanya untuk kolase ini, tidak disimpan ke data blok.</div></div>' +
      '<div class="klBar" id="klBar"><div class="seg klSg" id="klP"><button data-v="2" aria-label="2 blok per lembar"' + (c.per === 2 ? ' class="on"' : '') + '>' + ICO_2 + '</button><button data-v="4" aria-label="4 blok per lembar"' + (c.per === 4 ? ' class="on"' : '') + '>' + ICO_4 + '</button></div>' +
      '<button type="button" class="btn klTb" id="klAn" aria-label="Titik dan teks"' + (ST.sel.length ? '' : ' disabled') + '>' + ICO_AN + (nA ? '<i>' + nA + '</i>' : '') + '</button>' +
      '<div class="seg klSg" id="klF"><button data-v="pdf"' + (c.fmt === 'pdf' ? ' class="on"' : '') + '>PDF</button><button data-v="png"' + (c.fmt === 'png' ? ' class="on"' : '') + '>PNG</button></div>' +
      '<button type="button" class="btn pri klGo" id="klGo"' + (ST.sel.length ? '' : ' disabled') + '>Kirim</button></div>';
    $e('klX').onclick = close;
    $e('klPh').onclick = function (e) { if (e.target.closest && e.target.closest('#klX')) return; ST.col = !ST.col; main(); };
    drawHl();
    $e('klQ').oninput = function () { ST.q = this.value; var p = this.selectionStart; main(); var e = $e('klQ'); if (e) { e.focus(); try { e.setSelectionRange(p, p); } catch (x) {} } };
    $e('klCh').onclick = function (e) { var b = e.target.closest && e.target.closest('[data-r]'); if (!b) return; ST.sel = ST.sel.filter(function (x) { return x !== b.getAttribute('data-r'); }); main(); };
    $e('klLs').onchange = function (e) {
      var t = e.target, id = t.getAttribute('data-b'); if (!id) return;
      if (t.checked && ST.sel.length >= MAX) { t.checked = false; HA.toast('Maksimal ' + MAX + ' blok'); return; }
      toggle(id);
    };
    el.querySelectorAll('[data-i]').forEach(function (e) { e.onchange = function () { c.info[e.getAttribute('data-i')] = e.checked; HA.saveSettings(); }; });
    $e('klP').onclick = function (e) { var b = e.target.closest && e.target.closest('[data-v]'); if (!b) return; c.per = +b.getAttribute('data-v'); HA.saveSettings(); main(); };
    $e('klF').onclick = function (e) { var b = e.target.closest && e.target.closest('[data-v]'); if (!b) return; c.fmt = b.getAttribute('data-v'); HA.saveSettings(); main(); };
    $e('klAn').onclick = function () { ann = true; if (hl) { hl.remove(); hl = null; } ST.cur = ST.cur && ST.sel.indexOf(ST.cur) >= 0 ? ST.cur : ST.sel[0]; annot(); };
    $e('klGo').onclick = go;
    var nb = el.querySelector('.klBody'), nl = $e('klLs'); if (nb) nb.scrollTop = y0; if (nl) nl.scrollTop = l0;
  }
  function go() {
    var c = cfg(); if (!ST.sel.length) return;
    if (c.fmt === 'pdf') sendPdf(); else sendPngAll();
  }

  // ---------- titik dan teks ----------
  function annot() {
    el.className = 'idEd klEd';
    var id = ST.cur, b = byId(id), c = cfg(), arr = ST.ann[id] || (ST.ann[id] = []), idx = ST.sel.indexOf(id), map = null;
    el.innerHTML = head('Titik dan teks') +
      '<div class="klBody">' +
      '<canvas id="klCv" style="width:100%;border-radius:10px;margin-top:8px;touch-action:manipulation"></canvas>' +
      '<div class="klNv"><button type="button" class="btn klNb" id="klPv" aria-label="Sebelumnya"' + (idx > 0 ? '' : ' disabled') + '>' + ICO_CH_L + '</button><b>' + esc(String(b ? b.name : '')) + ' \u00B7 ' + (idx + 1) + '/' + ST.sel.length + '</b><button type="button" class="btn klNb" id="klNx" aria-label="Berikutnya"' + (idx < ST.sel.length - 1 ? '' : ' disabled') + '>' + ICO_CH_R + '</button></div>' +
      '<div class="row" style="gap:8px;margin-top:8px"><div class="seg" id="klT"><button data-v="p"' + (ST.tool === 'p' ? ' class="on"' : '') + '>Titik</button><button data-v="t"' + (ST.tool === 't' ? ' class="on"' : '') + '>Teks</button></div>' +
      '<div class="seg" id="klZ"><button data-v="k"' + (ST.sz === 'k' ? ' class="on"' : '') + '>Kecil</button><button data-v="s"' + (ST.sz === 's' ? ' class="on"' : '') + '>Sedang</button><button data-v="b"' + (ST.sz === 'b' ? ' class="on"' : '') + '>Besar</button></div></div>' +
      '<div class="muted" style="margin:6px 0">Ketuk gambar untuk menaruh ' + (ST.tool === 'p' ? 'titik (nama boleh kosong)' : 'teks') + '. Tahan lalu geser untuk memindahkan yang sudah ada.</div>' +
      '<div id="klAl">' + (arr.length ? arr.map(function (a, i) { return '<div class="klRw"><input type="checkbox" data-t="' + i + '"' + (a.on ? ' checked' : '') + '><span>' + (a.k === 'p' ? '● ' : 'T ') + esc(a.t || 'Titik') + '</span><small class="muted">' + ({ k: 'Kecil', s: 'Sedang', b: 'Besar' })[a.sz] + '</small><button type="button" class="ib" data-d="' + i + '" aria-label="Hapus">✕</button></div>'; }).join('') : '<div class="muted">Belum ada titik atau teks di blok ini.</div>') + '</div></div>' +
      '<div class="klFt"><button type="button" class="btn pri" id="klOk" style="width:100%;height:52px">Selesai</button></div>';
    var cv = $e('klCv'), sz = cellSize(c.per), sc = 1.6;
    cv.width = Math.round(sz.w * sc / 1); cv.height = Math.round(sz.h * sc / 1);
    cv.style.aspectRatio = sz.w + ' / ' + sz.h;
    function paint() { var ctx = cv.getContext('2d'); ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sz.w, sz.h); map = cell(ctx, b, 0, 0, sz.w, sz.h, c.info, arr); }
    paint();
    $e('klX').onclick = function () { ann = null; main(); };
    $e('klOk').onclick = function () { ann = null; main(); };
    $e('klPv').onclick = function () { ST.cur = ST.sel[idx - 1]; annot(); };
    $e('klNx').onclick = function () { ST.cur = ST.sel[idx + 1]; annot(); };
    $e('klT').onclick = function (e) { var x = e.target.closest && e.target.closest('[data-v]'); if (!x) return; ST.tool = x.getAttribute('data-v'); annot(); };
    $e('klZ').onclick = function (e) { var x = e.target.closest && e.target.closest('[data-v]'); if (!x) return; ST.sz = x.getAttribute('data-v'); annot(); };
    $e('klAl').onchange = function (e) { var i = e.target.getAttribute('data-t'); if (i == null) return; arr[+i].on = e.target.checked; paint(); };
    $e('klAl').onclick = function (e) { var d = e.target.closest && e.target.closest('[data-d]'); if (!d) return; arr.splice(+d.getAttribute('data-d'), 1); annot(); };
    var drag = null, st0 = null;
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * sz.w, y: (e.clientY - r.top) / r.height * sz.h, k: sz.w / r.width }; }
    cv.style.touchAction = 'none';
    cv.onpointerdown = function (e) {
      var q = pos(e), best = null, bd = 1e9;
      arr.forEach(function (a) { if (!a.on) return; var c = map.px(a.fx, a.fy), d = Math.hypot(c[0] - q.x, c[1] - q.y); if (d < 34 * q.k && d < bd) { bd = d; best = { a: a, dx: c[0] - q.x, dy: c[1] - q.y }; } });
      st0 = { x: e.clientX, y: e.clientY, moved: false }; drag = best;
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    };
    cv.onpointermove = function (e) {
      if (!st0) return;
      if (Math.hypot(e.clientX - st0.x, e.clientY - st0.y) > 6) st0.moved = true;
      if (drag && st0.moved) { var q = pos(e), f = map.fx(q.x + drag.dx, q.y + drag.dy); drag.a.fx = f[0]; drag.a.fy = f[1]; paint(); }
    };
    cv.onpointerup = function (e) {
      var s0 = st0, d = drag; st0 = null; drag = null;
      if (!s0) return;
      if (d && s0.moved) return;           // selesai menggeser
      if (s0.moved) return;                // geseran di area kosong: abaikan
      var q = pos(e), f = map.fx(q.x, q.y);
      var o = document.createElement('div'); o.className = 'klIn';
      o.innerHTML = '<div class="klBx"><div class="st">' + (ST.tool === 'p' ? 'TITIK' : 'TEKS') + '</div><input type="text" id="klTx" maxlength="40" placeholder="' + (ST.tool === 'p' ? 'Nama titik (boleh kosong)' : 'Isi teks') + '" style="width:100%;margin-top:8px"><div class="row" style="margin-top:10px"><button type="button" class="btn" id="klNo" style="flex:1;height:48px">Batal</button><button type="button" class="btn pri" id="klSv" style="flex:1;height:48px">Simpan</button></div></div>';
      document.body.appendChild(o); var t = o.querySelector('#klTx'); setTimeout(function () { t.focus(); }, 50);
      o.querySelector('#klNo').onclick = function () { o.remove(); };
      o.querySelector('#klSv').onclick = function () {
        var v = t.value.trim(); if (ST.tool === 't' && !v) { HA.toast('Isi teks dulu'); return; }
        arr.push({ k: ST.tool, fx: f[0], fy: f[1], t: v, sz: ST.sz, on: true }); o.remove(); annot();
      };
    };
    cv.onpointercancel = function () { st0 = null; drag = null; };
  }
  HA.kolase = open;
  HA.kolaseTest = function () { return { st: function () { return ST; }, renderSheet: renderSheet, cfg: cfg, go: go }; };
})();
