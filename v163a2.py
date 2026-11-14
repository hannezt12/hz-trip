import re
def rw(f,fn):
    s=open(f).read(); n=fn(s); assert n!=s,f; open(f,'w').write(n)
def rep(s,a,b,c=1):
    assert s.count(a)>=1, a[:90]
    return s.replace(a,b,c)
def kt(s):
    s=rep(s,"lay: null, only: null };","lay: null, only: null, all: false };")
    s=rep(s,"      if (KM.only && it.cat !== KM.only) return false;\n      return KM.range","      if (KM.only && it.cat !== KM.only) return false;\n      if (KM.all) return true;\n      return KM.range")
    s=rep(s,"(KM.range ? '' : ' pada tanggal ini')","(KM.all ? ' · semua tanggal' : KM.range ? '' : ' pada tanggal ini')")
    s=rep(s,"(KM.range ? 'Tidak ada tanda pada rentang ini.' : 'Belum ada tanda pada tanggal ini.')","(KM.all ? 'Belum ada tanda.' : KM.range ? 'Tidak ada tanda pada rentang ini.' : 'Belum ada tanda pada tanggal ini.')")
    # strip hanya saat mode Kategori
    s=rep(s,"    var el = $('katStrip'); if (!el) return;\n","    var el = $('katStrip'); if (!el) return;\n    if (KM.mode !== 'kategori') { el.innerHTML = ''; return; }\n")
    # syncUi
    s=rep(s,"""    $('katRng').style.display = kat && KM.range ? 'flex' : 'none';
    v.classList.toggle('katR', kat && KM.range);""","""    $('katRng').style.display = 'none';""")
    s=rep(s,"""b.classList.toggle('on', (b.getAttribute('data-r') === '1') === KM.range); });""","""b.classList.toggle('on', b.getAttribute('data-r') === (KM.all ? '2' : KM.range ? '1' : '0')); });
    calLabel();""")
    # label kalender + sheet
    s=rep(s,"  function syncUi() {","""  function dm(x) { var a = String(x || '').split('-'); return a.length === 3 ? a[2] + '/' + a[1] : ''; }
  function calLabel() {
    var e = $('mapCalT'); if (!e) return;
    var k = KM.mode === 'kategori';
    e.textContent = k && KM.all ? 'Semua' : k && KM.range ? dm(KM.from) + '–' + dm(KM.to) : dm(S.mapDay || S.today);
  }
  KM.calLabel = calLabel;
  function openCal() {
    var k = KM.mode === 'kategori';
    if (k && KM.all) { toast('Mode Semua: semua tanggal tampil'); return; }
    if (HA.DM && HA.DM.closePanel) HA.DM.closePanel();
    var rng = k && KM.range, mx = S.today;
    HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">' + (rng ? 'RENTANG TANGGAL' : 'TANGGAL') + '</div><button class="btn pri" id="calOk">Selesai</button></div>' + (rng
      ? '<div class="row" style="gap:8px;margin-top:8px"><label class="calL">Dari<input type="date" id="calF" max="' + mx + '" value="' + (KM.from || '') + '"></label><label class="calL">Sampai<input type="date" id="calT" max="' + mx + '" value="' + (KM.to || '') + '"></label></div>'
      : '<div class="row" style="gap:6px;margin-top:8px;align-items:center"><button class="ib" id="calP" aria-label="Hari sebelumnya"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><input type="date" id="calD" max="' + mx + '" value="' + (S.mapDay || mx) + '" style="flex:1;height:2.5rem"><button class="ib" id="calN" aria-label="Hari berikutnya"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button></div><button class="btn" id="calTd" style="width:100%;margin-top:8px">Hari ini</button>'));
    $('scrim').classList.remove('on'); $('sheet').classList.add('cmp');
    $('calOk').onclick = function () { HA.closeSheet(); };
    if (rng) {
      $('calF').onchange = function () { if (!this.value) return; KM.from = this.value; if (KM.to && KM.to < KM.from) KM.to = KM.from; $('calT').value = KM.to; syncUi(); draw(); };
      $('calT').onchange = function () { if (!this.value) return; KM.to = this.value; if (KM.from && KM.from > KM.to) KM.from = KM.to; $('calF').value = KM.from; syncUi(); draw(); };
    } else {
      var back = function () { setTimeout(function () { var d = $('calD'); if (d) d.value = S.mapDay || mx; }, 80); };
      $('calD').onchange = function () { if (!this.value) return; $('mPick').value = this.value; $('mPick').dispatchEvent(new Event('change')); back(); };
      $('calP').onclick = function () { $('mPrev').click(); back(); };
      $('calN').onclick = function () { if ((S.mapDay || mx) >= mx) { toast('Sudah hari ini'); return; } $('mNext').click(); back(); };
      $('calTd').onclick = function () { $('mToday').click(); back(); };
    }
  }
  function syncUi() {""")
    s=rep(s,"""      var r = e.target.getAttribute && e.target.getAttribute('data-r'); if (r === null || r === undefined) return;
      KM.range = r === '1'; syncUi(); draw();""","""      var r = e.target.getAttribute && e.target.getAttribute('data-r'); if (r === null || r === undefined) return;
      KM.range = r === '1'; KM.all = r === '2'; syncUi(); draw();""")
    s=rep(s,"    srchWire(); stripWire();","    srchWire(); stripWire();\n    if ($('mapCal')) $('mapCal').onclick = openCal;\n    $('katInfo').onclick = function () { if (KM.only) { KM.only = null; draw(); stripDraw(); toast('Semua kategori tampil'); } };")
    # pencarian: tanpa auto-tutup saat blur, ada tombol silang
    s=rep(s,"    q.onblur = function () { setTimeout(function () { if (document.activeElement !== q) srchClose(); }, 250); };","    $('katXc').onclick = srchClose;")
    s=rep(s,"    $('katSrch').style.display = 'block'; var q = $('katQ'); q.value = ''; srchList();","    $('katSrch').style.display = 'block'; var q = $('katQ'); q.value = ''; stripDraw(); srchList();")
    s=rep(s,"S.mapDay = date; KM.range = false;","S.mapDay = date; KM.range = false; KM.all = false;")
    return s
rw('js/layar/kategori.js',kt)

def dm(s):
    # hapus tile Data peta dan Atur batas; Desa -> Batas
    s=rep(s,", ['batDesa', 'Desa', 1]",", ['batDesa', 'Batas', 1]")
    s=rep(s,", ['batCfg', 'Atur batas'], ['dataGo', 'Data peta']];","];")
    # mode Datar/Kontur dari panel: popup ikut
    s=rep(s,"      if (rm) { S.settings.rowMode = rm.getAttribute('data-m'); saveSettings(); drawRows(); sync(); return; }","      if (rm) { S.settings.rowMode = rm.getAttribute('data-m'); saveSettings(); drawRows(); sync(); if (HA.DM.pop && HA.DM.popId != null) { var pb = blocksList().filter(function (o) { return o.id === HA.DM.popId; })[0]; if (pb) HA.openBlockPop(pb); } return; }")
    return s
rw('js/peta/dem-ui.js',dm)
