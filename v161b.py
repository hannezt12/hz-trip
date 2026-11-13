def rw(f,fn):
    s=open(f).read(); n=fn(s); assert n!=s,f; open(f,'w').write(n)
def rep(s,a,b):
    assert a in s, a[:80]
    return s.replace(a,b,1)
def ix(s):
    return rep(s,'<div id="katBar" style="display:none"><div class="seg" id="katSeg">',
 '<div id="katBar" style="display:none"><div id="katSrch"><input type="search" id="katQ" placeholder="Cari blok…" autocomplete="off"><div id="katSl" style="display:none"></div></div><div id="katStrip"></div><div class="seg" id="katSeg">')
rw('index.html',ix)
def kt(s):
    # gaya kategori pada penggambaran
    s=rep(s,"""      var col = HA.tandaColOf(it);
      if (it.t === 'pt')""","""      var col = HA.tandaColOf(it), cc = it.cat ? HA.tandaCatOf(it.cat) : null, gar = !!(cc && cc.style === 'garis'), w = cc && cc.w ? cc.w : 0;
      if (it.t === 'pt')""")
    s=rep(s,"weight: 5, opacity: 0.95, lineCap","weight: w || 5, opacity: 0.95, lineCap")
    s=rep(s,"else L.polygon(it.pts, { color: col, weight: 2.5, fillColor: col, fillOpacity: opOf(it), interactive: false }).addTo(g);",
            "else L.polygon(it.pts, { color: col, weight: gar ? (w || 3) : 2.5, fill: !gar, fillColor: col, fillOpacity: gar ? 0 : opOf(it), interactive: false }).addTo(g);")
    # strip + pencarian
    s=rep(s,"  function syncUi() {","""  function inkOn(hex) { var h = String(hex).replace('#', ''); if (h.length !== 6) return '#fff'; var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111' : '#fff'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // strip kategori: ketuk = kategori aktif (dipakai saat Simpan di Ukur), tahan lama atau gir = kelola kategori
  function stripDraw() {
    var el = $('katStrip'); if (!el) return;
    var d = HA.tandaData(), act = d.brush.cat, cc = HA.tandaCatOf(act), keep = el.querySelector('.tdKs'), sl = keep ? keep.scrollLeft : 0;
    var boxes = d.cats.map(function (c) { return '<button type="button" class="tdk' + (c.id === act ? ' on' : '') + '" data-cat="' + c.id + '" style="background:' + c.col + ';color:' + inkOn(c.col) + '">' + esc(c.name) + '</button>'; }).join('') +
      '<button type="button" class="tdk kgear" data-gear="1" aria-label="Kelola kategori">⚙</button>';
    var subs = cc && cc.subs.length ? '<div class="tdSb">' + cc.subs.map(function (s, i) { var c0 = s.col || cc.col; return '<button type="button" class="tdsc' + (d.brush.sub === s.id ? ' on' : '') + '" data-sub="' + s.id + '" style="background:' + c0 + ';color:' + inkOn(c0) + '" aria-label="' + esc(s.name) + '">' + (i + 1) + '</button>'; }).join('') + '</div>' : '';
    el.innerHTML = '<div class="tdKw"><div class="tdKs">' + boxes + '</div></div>' + subs;
    var ks = el.querySelector('.tdKs'); if (ks) ks.scrollLeft = sl;
  }
  function stripWire() {
    var el = $('katStrip'), tm = null, fired = false;
    el.onclick = function (e) {
      if (fired) { fired = false; return; }
      var b = e.target.closest && e.target.closest('button'); if (!b) return;
      if (b.getAttribute('data-gear')) { HA.tandaCatPage(); return; }
      var sub = b.getAttribute('data-sub'), cat = b.getAttribute('data-cat'), d = HA.tandaData();
      if (sub) { var c = HA.tandaCatOf(d.brush.cat), sb = c && c.subs.filter(function (x) { return x.id === sub; })[0]; var was = d.brush.sub === sub; HA.tandaSetBrush(d.brush.cat, was ? null : sub); if (sb && !was) toast(c.name + ' / ' + (sb.name || 'Sub')); }
      else if (cat) { HA.tandaSetBrush(cat, null); toast('Kategori aktif: ' + HA.tandaCatOf(cat).name); }
      stripDraw();
    };
    el.addEventListener('pointerdown', function (e) { var b = e.target.closest && e.target.closest('.tdk[data-cat]'); if (!b) return; fired = false; clearTimeout(tm); tm = setTimeout(function () { fired = true; HA.tandaCatPage(); }, 550); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { el.addEventListener(n, function () { clearTimeout(tm); }); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('scroll', function () { clearTimeout(tm); }, true);
  }
  // pencarian blok terkonfirmasi: ketik nama (5 saran), kosong = terdekat dari tengah peta
  function dkm(a, b) { var R = 6371000, p = Math.PI / 180, x = (b[1] - a[1]) * p * Math.cos((a[0] + b[0]) / 2 * p), y = (b[0] - a[0]) * p; return Math.sqrt(x * x + y * y) * R; }
  function nrm(t) { return String(t).toLowerCase().replace(/\\s+/g, ''); }
  var coll = (typeof Intl !== 'undefined' && Intl.Collator) ? new Intl.Collator('id', { numeric: true }) : { compare: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; } };
  function srchList() {
    var q = nrm($('katQ').value), c = map() ? map().getCenter() : null, ref = c ? [c.lat, c.lng] : null;
    var l = HA.blocksList().filter(function (b) { return b.conf && b.pts && b.pts.length >= 3; }).map(function (b) {
      var la = 0, lo = 0; b.pts.forEach(function (p) { la += p[0]; lo += p[1]; }); la /= b.pts.length; lo /= b.pts.length;
      return { b: b, n: nrm(b.name), d: ref ? dkm(ref, [la, lo]) : 0 };
    });
    if (q) { l = l.filter(function (x) { return x.n.indexOf(q) >= 0; }); l.sort(function (a, b) { var s1 = a.n.indexOf(q) === 0 ? 0 : 1, s2 = b.n.indexOf(q) === 0 ? 0 : 1; return s1 - s2 || coll.compare(a.n, b.n); }); }
    else l.sort(function (a, b) { return a.d - b.d; });
    l = l.slice(0, 5);
    var el = $('katSl');
    el.innerHTML = l.length ? (q ? '' : '<div class="muted tdSh">Terdekat dari tengah peta</div>') + l.map(function (x) { return '<button type="button" class="bprow" data-id="' + esc(String(x.b.id)) + '"><span class="bpi"><b>' + esc(String(x.b.name)) + '</b><small>' + (x.d >= 1000 ? (x.d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(x.d) + ' m') + '</small></span></button>'; }).join('') : '<div class="muted" style="padding:0.6rem">Tidak ada blok terkonfirmasi yang cocok.</div>';
    el.style.display = 'block';
    el.querySelectorAll('.bprow').forEach(function (e) {
      e.onclick = function () {
        var id = e.getAttribute('data-id'), b = HA.blocksList().filter(function (o) { return String(o.id) === id; })[0];
        el.style.display = 'none'; $('katQ').value = ''; try { $('katQ').blur(); } catch (x) {}
        if (!b) return;
        map().fitBounds(L.polygon(b.pts).getBounds(), { padding: [40, 40], maxZoom: 19 });
        if (HA.openBlockPop) HA.openBlockPop(b);
      };
    });
  }
  function srchWire() {
    var q = $('katQ');
    q.onfocus = srchList; q.oninput = srchList;
    q.onblur = function () { setTimeout(function () { $('katSl').style.display = 'none'; }, 250); };
  }
  function syncUi() {
    stripDraw();""")
    s=rep(s,"    $('katSeg').onclick = function (e) {","    srchWire(); stripWire();\n    $('katSeg').onclick = function (e) {")
    s=rep(s,"    syncUi(); draw();\n    if (!quiet)","    syncUi(); draw(); if (HA.DM && HA.DM.regrid) HA.DM.regrid();\n    if (!quiet)")
    return s
rw('js/layar/kategori.js',kt)
