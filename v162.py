import re
def rw(f,fn):
    s=open(f).read(); n=fn(s); assert n!=s,f; open(f,'w').write(n)
def rep(s,a,b,c=1):
    assert s.count(a)>=1, a[:90]
    return s.replace(a,b,c)

# ---- index.html: cari dipindah keluar katBar
def ix(s):
    s=rep(s,'<div id="katBar" style="display:none"><div id="katSrch"><input type="search" id="katQ" placeholder="Cari blok…" autocomplete="off"><div id="katSl" style="display:none"></div></div>',
            '<div id="katSrch" style="display:none"><input type="search" id="katQ" placeholder="Cari blok…" autocomplete="off"><div id="katSl" style="display:none"></div></div>\n      <div id="katBar" style="display:none">')
    return s.replace('Versi 0.16.1','Versi 0.16.2')
rw('index.html',ix)
rw('js/sistem/sistem.js',lambda s:s.replace('0.16.1','0.16.2'))

# ---- core.js: Back
rw('js/inti/core.js',lambda s:rep(s,"    if (HA.ukurBack && HA.ukurBack()) return true;","    if (HA.mapBack && HA.mapBack()) return true;\n    if (HA.ukurBack && HA.ukurBack()) return true;"))

# ---- kategori.js
def kt(s):
    s=rep(s,"var KM = HA.KM = { mode: 'lintasan', range: false, from: '', to: '', lay: null };","var KM = HA.KM = { mode: 'lintasan', range: false, from: '', to: '', lay: null, only: null };")
    s=rep(s,"""      var d = dateOf(it);
      return KM.range""","""      var d = dateOf(it);
      if (KM.only && it.cat !== KM.only) return false;
      return KM.range""")
    s=rep(s,"""    var n = list.length;
    $('katInfo').textContent = n ? n + ' tanda'""","""    var n = list.length, oc = KM.only ? HA.tandaCatOf(KM.only) : null;
    if (KM.only && !oc) KM.only = null;
    $('katInfo').textContent = (oc ? 'Hanya ' + oc.name + ' · ' : '') + (n ? n + ' tanda'""")
    s=rep(s,"""(KM.range ? '' : ' pada tanggal ini') : (KM.range ? 'Tidak ada tanda pada rentang ini.' : 'Belum ada tanda pada tanggal ini.');""","""(KM.range ? '' : ' pada tanggal ini') : (KM.range ? 'Tidak ada tanda pada rentang ini.' : 'Belum ada tanda pada tanggal ini.'));""")
    # strip: ketuk = aktif + hanya kategori itu; ketuk lagi = semua
    s=rep(s,"""      else if (cat) { HA.tandaSetBrush(cat, null); toast('Kategori aktif: ' + HA.tandaCatOf(cat).name); }""","""      else if (cat) {
        var nm = HA.tandaCatOf(cat).name;
        if (KM.only === cat) { KM.only = null; toast('Semua kategori tampil'); }
        else { KM.only = cat; HA.tandaSetBrush(cat, null); toast('Hanya ' + nm + ' · ketuk lagi untuk semua'); }
        draw();
      }""")
    s=rep(s,"""'<button type="button" class="tdk' + (c.id === act ? ' on' : '')""","""'<button type="button" class="tdk' + (c.id === act ? ' on' : '') + (c.id === KM.only ? ' only' : '')""")
    # pencarian: dibuka dari tile Cari
    s=rep(s,"""  function srchWire() {
    var q = $('katQ');
    q.onfocus = srchList; q.oninput = srchList;
    q.onblur = function () { setTimeout(function () { $('katSl').style.display = 'none'; }, 250); };
  }""","""  function srchClose() { var e = $('katSrch'); if (!e) return; $('katSl').style.display = 'none'; e.style.display = 'none'; $('katQ').value = ''; try { $('katQ').blur(); } catch (x) {} }
  function srchOpen() {
    if (HA.DM && HA.DM.closePanel) HA.DM.closePanel();
    $('katSrch').style.display = 'block'; var q = $('katQ'); q.value = ''; srchList();
    setTimeout(function () { try { q.focus(); } catch (x) {} }, 60);
  }
  function srchWire() {
    var q = $('katQ');
    q.onfocus = srchList; q.oninput = srchList;
    q.onblur = function () { setTimeout(function () { if (document.activeElement !== q) srchClose(); }, 250); };
  }
  KM.openSearch = srchOpen;
  // tombol Back: tutup pencarian lalu panel Alat peta
  HA.mapBack = function () {
    var e = $('katSrch'); if (e && e.style.display !== 'none') { srchClose(); return true; }
    var p = document.querySelector('.toolpanel'); if (p && p.style.display !== 'none' && HA.DM && HA.DM.closePanel) { HA.DM.closePanel(); return true; }
    return false;
  };""")
    s=rep(s,"""el.style.display = 'none'; $('katQ').value = ''; try { $('katQ').blur(); } catch (x) {}
        if (!b) return;""","""srchClose();
        if (!b) return;""")
    return s
rw('js/layar/kategori.js',kt)

# ---- dem-ui.js: tile Cari, ketuk luar, kunci saat edit
def dm(s):
    s=rep(s,"      measure: ic(","      search: ic('<circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"M20 20l-4.5-4.5\"/>'),\n      measure: ic(")
    s=rep(s,"var TILES = [['contour', 'Kontur', 1],","var TILES = [['search', 'Cari'], ['contour', 'Kontur', 1],")
    s=rep(s,"""      if (HA.KM && HA.KM.mode === 'kategori') { // mode Kategori: alat tanda di depan
        var fr = ['measure', 'draw', 'fill'], front = [], rest = [];""","""      var si = -1; out.forEach(function (t, i) { if (t[0] === 'search') si = i; }); if (si > 0) out.unshift(out.splice(si, 1)[0]);
      if (HA.KM && HA.KM.mode === 'kategori') { // mode Kategori: Cari lalu alat tanda di depan
        var fr = ['search', 'measure', 'draw', 'fill'], front = [], rest = [];""")
    s=rep(s,"      if (id === 'measure') { closeP(); HA.measureStart(); return; }","      if (id === 'search') { closeP(); if (HA.KM && HA.KM.openSearch) HA.KM.openSearch(); return; }\n      if (id === 'measure') { closeP(); HA.measureStart(); return; }")
    s=rep(s,"b.onclick = function () { var open = panel.style.display === 'none'; if (open) HA.closeAll({ panel: true });","b.onclick = function () { var open = panel.style.display === 'none'; if (open && HA.DM.edit) { toast('Selesaikan atau batalkan edit dulu'); return; } if (open) HA.closeAll({ panel: true });")
    s=rep(s,"    new Ctl().addTo(m);","""    new Ctl().addTo(m);
    // ketuk di luar panel menutup panel saja (ketukan tidak diteruskan ke peta)
    m.getContainer().addEventListener('click', function (e) {
      if (panel.style.display === 'none') return;
      if (e.target.closest && e.target.closest('.toolpanel, .locbtn')) return;
      closeP(); e.stopPropagation(); e.preventDefault();
    }, true);""")
    return s
rw('js/peta/dem-ui.js',dm)

# ---- blok-ui.js: popup per mode + Edit Blok
def bu(s):
    # popup: hanya data row di Datar; lereng/cekungan/cembung/jalan hanya Kontur
    s=rep(s,"""'<div class="bl" id="bpR">Menghitung…</div><div class="bl" id="bpA"></div><div class="bl" id="bpD"></div><div class="bl" id="bpH"></div><div class="bl" id="bpL"></div>'""","""'<div class="bl" id="bpR">Menghitung…</div>' + (mode === 'kontur' ? '<div class="bl" id="bpA"></div><div class="bl" id="bpD"></div><div class="bl" id="bpH"></div><div class="bl" id="bpL"></div>' : '')""")
    s=rep(s,"""    if (b.dir != null && window.HzDem) {""","""    if (mode === 'kontur' && b.dir != null && window.HzDem) {""")
    s=rep(s,"""    var depP = rowsP.catch(function () { return null; }).then(function () { return computeDep(b); }).catch(function () { return null; });""","""    var depP = mode !== 'kontur' ? Promise.resolve(undefined) : rowsP.catch(function () { return null; }).then(function () { return computeDep(b); }).catch(function () { return null; });""")
    s=rep(s,"""      if (id !== HA.DM.popSeq || !$('bpD')) return;
      if (d && mode === 'kontur')""","""      if (mode !== 'kontur' || id !== HA.DM.popSeq || !$('bpD')) return;
      if (d && mode === 'kontur')""")
    # tombol Riwayat di header popup
    s=rep(s,"""'<button type="button" class="ib2" id="bpSh" aria-label="Bagikan blok">""","""'<button type="button" class="ib2" id="bpHi" aria-label="Riwayat blok"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg></button>' + '<button type="button" class="ib2" id="bpSh" aria-label="Bagikan blok">""")
    s=rep(s,"    $('bpSh').onclick = function () {","    $('bpHi').onclick = function () { if (HA.BRiw) HA.BRiw.open(b); };\n    $('bpSh').onclick = function () {")
    # Edit Blok: hapus baris angka arah + Terpendek
    s=re.sub(r"      '<div class=\"muted\" style=\"margin-top:8px\">Arah row \(° dari utara, 0–179\)</div>' \+\n      '<div class=\"row bedir\">.*?</div>' \+\n",
      "      '<div class=\"muted\" id=\"beDt\" style=\"margin-top:8px\">' + (b.dir == null ? 'Arah row belum diatur. Gunakan Ketuk 2 titik.' : 'Arah row ' + Math.round(b.dir) + '° · ' + dirStat(b.dir)) + '</div>' +\n",s,count=1,flags=re.S)
    assert 'bedir' not in s.split('function openBlockEdit')[1].split('beMo')[0]
    s=s.replace("""'<div class="row" style="margin-top:6px;gap:6px"><button class="btn" id="beP" style="flex:1">Ketuk 2 titik</button>""","""'<div class="row" style="margin-top:6px;gap:6px"><button class="btn" id="beP" style="flex:1">Ketuk 2 titik</button>""")
    s=rep(s,"""'<button class="btn" id="beMo" style="width:100%;margin-top:8px">Lainnya ▾</button>'""","""'<button class="btn" id="beHi" style="width:100%;margin-top:8px">Riwayat blok</button>' +
      '<button class="btn" id="beMo" style="width:100%;margin-top:8px">Lainnya ▾</button>'""")
    lines=s.split('\n'); out=[]
    skip=('    function setDir(v)',"    $('beD').onchange","    $('sheet').querySelectorAll('button[data-d]').forEach(function (x) { x.onclick","    var lg = (sg + 90) % 180","    function sgLabel()","    $('beS').onclick","    sgLabel();")
    for l in lines:
        if l.startswith(skip): continue
        out.append(l)
    s='\n'.join(out)
    s=rep(s,"['beN', 'beD', 'beS', 'beP',","['beN', 'beP',")
    s=rep(s,"      $('sheet').querySelectorAll('button[data-d]').forEach(function (x) { x.disabled = lk; });\n","")
    s=rep(s,"    $('beT').onchange =","    $('beHi').onclick = function () { HA.onSheetClose = null; if (HA.BRiw) HA.BRiw.open(b, function () { openBlockEdit(b); }); };\n    $('beT').onchange =")
    return s
rw('js/peta/blok-ui.js',bu)
