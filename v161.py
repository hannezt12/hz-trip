def rw(f,fn):
    s=open(f).read(); n=fn(s); assert n!=s,f; open(f,'w').write(n)
def rep(s,a,b):
    assert a in s, a[:80]
    return s.replace(a,b,1)
# ---- tanda.js: gaya + tebal per kategori, ekspor catOf
def td(s):
    s=rep(s,"""value="' + esc(c.name) + '"><button type="button" class="ib" data-dc="' + c.id + '" aria-label="Hapus">' + IC.trash + '</button></div>';""",
"""value="' + esc(c.name) + '"><button type="button" class="ib" data-dc="' + c.id + '" aria-label="Hapus">' + IC.trash + '</button></div>' +
          '<div class="kgst"><span>Gaya</span><div class="kgg" data-gs="' + c.id + '"><button type="button" data-g="isi"' + (c.style === 'garis' ? '' : ' class="on"') + '>Isi</button><button type="button" data-g="garis"' + (c.style === 'garis' ? ' class="on"' : '') + '>Garis tepi</button></div><span>Tebal</span><input type="range" min="1" max="8" step="1" data-gw="' + c.id + '" value="' + (c.w || 3) + '"><b>' + (c.w || 3) + '</b></div>';""")
    s=rep(s,"      sh.querySelectorAll('[data-nc]').forEach(","""      sh.querySelectorAll('[data-gs] button').forEach(function (e) { e.onclick = function () { var c = catOf(e.parentNode.getAttribute('data-gs')); if (c) { c.style = e.getAttribute('data-g'); save(); draw(); } }; });
      sh.querySelectorAll('[data-gw]').forEach(function (e) { e.oninput = function () { var c = catOf(e.getAttribute('data-gw')); if (c) { c.w = +e.value; if (e.nextSibling) e.nextSibling.textContent = e.value; save(); } }; });
      sh.querySelectorAll('[data-nc]').forEach(""")
    s=rep(s,"$('kgX').onclick = function () { norm(); save(); closeSheet(); TD.palOpen = false; drawAll(); if (HA.BT) HA.BT.refresh(); if (TD.ed) edBar(); else barMain(); };",
            "$('kgX').onclick = function () { norm(); save(); closeSheet(); TD.palOpen = false; drawAll(); if (HA.BT) HA.BT.refresh(); if (TD.on) { if (TD.ed) edBar(); else barMain(); } if (HA.KM) HA.KM.sync(); };")
    s=rep(s,"HA.tandaPal = PAL; HA.tandaColOf = colOf;","HA.tandaPal = PAL; HA.tandaCatOf = catOf; HA.tandaColOf = colOf;")
    return s
rw('js/layar/tanda.js',td)
# kategori baru default Garis
def td2(s):
    return rep(s,"var c = { id: uid('k'), name: '', col:","var c = { id: uid('k'), name: '', style: 'garis', w: 3, col:")
rw('js/layar/tanda.js',td2)
# ---- dem-ui.js: urutan tile mengikuti mode
def dm(s):
    s=rep(s,"      TILES.forEach(function (t) { if (byId[t[0]]) out.push(t); });\n      return out;",
"""      TILES.forEach(function (t) { if (byId[t[0]]) out.push(t); });
      if (HA.KM && HA.KM.mode === 'kategori') { // mode Kategori: alat tanda di depan
        var fr = ['measure', 'draw', 'fill'], front = [], rest = [];
        out.forEach(function (t) { (fr.indexOf(t[0]) >= 0 ? front : rest).push(t); });
        front.sort(function (a, b) { return fr.indexOf(a[0]) - fr.indexOf(b[0]); });
        out = front.concat(rest);
      }
      return out;""")
    s=rep(s,"    HA.DM.sync = sync; HA.DM.syncMode = syncMode;","    HA.DM.sync = sync; HA.DM.syncMode = syncMode;\n    HA.DM.regrid = function () { var g = $('tGrid'); if (g) { g.innerHTML = gridHtml(); sync(); } };")
    return s
rw('js/peta/dem-ui.js',dm)
# ---- blok-ui.js: Bagikan di popup
def bu(s):
    s=rep(s,"""<button type="button" class="ib2" id="bpT" aria-label="Lipat atau buka panel\"""","""<button type="button" class="ib2" id="bpSh" aria-label="Bagikan blok"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="M8 11l7-4M8 13l7 4"/></svg></button><button type="button" class="ib2" id="bpT" aria-label="Lipat atau buka panel\"""")
    s=rep(s,"    $('bpE').onclick = function () { openBlockEdit(b); };","""    $('bpE').onclick = function () { openBlockEdit(b); };
    $('bpSh').onclick = function () {
      if (!b.conf) { toast('Hanya blok terkonfirmasi yang bisa dibagikan'); return; }
      if (!HA.BT || !HA.BT.itemsOf || !HA.BT.itemsOf(b).length) { toast('Blok ini belum punya tanda'); return; }
      HA.BT.share([b]);
    };""")
    return s
rw('js/peta/blok-ui.js',bu)
