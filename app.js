/* HZ Trip - pemasangan dan inisialisasi */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok) return;
  var T = HA.T, HARI = HA.HARI, native = HA.native, Plug = HA.Plug, S = HA.S;
  // fungsi dari modul lain
  function $() { return HA.$.apply(this, arguments); }
  function saveSettings() { return HA.saveSettings.apply(this, arguments); }
  function loadMeta() { return HA.loadMeta.apply(this, arguments); }
  function toast() { return HA.toast.apply(this, arguments); }
  function applyStatus() { return HA.applyStatus.apply(this, arguments); }
  function askActivity() { return HA.askActivity.apply(this, arguments); }
  function syncStatus() { return HA.syncStatus.apply(this, arguments); }
  function pushSchedule() { return HA.pushSchedule.apply(this, arguments); }
  function go() { return HA.go.apply(this, arguments); }
  function openDrawer() { return HA.openDrawer.apply(this, arguments); }
  function closeDrawer() { return HA.closeDrawer.apply(this, arguments); }
  function askConfirm() { return HA.askConfirm.apply(this, arguments); }
  function closeSheet() { return HA.closeSheet.apply(this, arguments); }
  function renderSpido() { return HA.renderSpido.apply(this, arguments); }
  function recomputeLive() { return HA.recomputeLive.apply(this, arguments); }
  function onFix() { return HA.onFix.apply(this, arguments); }
  function refreshToday() { return HA.refreshToday.apply(this, arguments); }
  function toggleRec() { return HA.toggleRec.apply(this, arguments); }
  function askBackground() { return HA.askBackground.apply(this, arguments); }
  function openBatt() { return HA.openBatt.apply(this, arguments); }
  function onModeAction() { return HA.onModeAction.apply(this, arguments); }
  function typeOf() { return HA.typeOf.apply(this, arguments); }
  function unitAt() { return HA.unitAt.apply(this, arguments); }
  function setUnit() { return HA.setUnit.apply(this, arguments); }
  function fixSlotsAfterDelete() { return HA.fixSlotsAfterDelete.apply(this, arguments); }
  function renderUnitCard() { return HA.renderUnitCard.apply(this, arguments); }
  function loadRiwayat() { return HA.loadRiwayat.apply(this, arguments); }
  function loadHistory() { return HA.loadHistory.apply(this, arguments); }
  function renderHistory() { return HA.renderHistory.apply(this, arguments); }
  function exitSel() { return HA.exitSel.apply(this, arguments); }
  function toggleSel() { return HA.toggleSel.apply(this, arguments); }
  function doMerge() { return HA.doMerge.apply(this, arguments); }
  function shiftDay() { return HA.shiftDay.apply(this, arguments); }
  function openTrip() { return HA.openTrip.apply(this, arguments); }
  function purgeExpired() { return HA.purgeExpired.apply(this, arguments); }
  function onHidden() { return HA.onHidden.apply(this, arguments); }
  function renderSched() { return HA.renderSched.apply(this, arguments); }
  function renderSettings() { return HA.renderSettings.apply(this, arguments); }
  function addUnit() { return HA.addUnit.apply(this, arguments); }
  function onSched() { return HA.onSched.apply(this, arguments); }
  function textB64() { return HA.textB64.apply(this, arguments); }
  function saveFile() { return HA.saveFile.apply(this, arguments); }
  function openPrint() { return HA.openPrint.apply(this, arguments); }
  function demAfter() { return HA.demAfter.apply(this, arguments); }
  function demImport() { return HA.demImport.apply(this, arguments); }
  function renderSatNat() { return HA.renderSatNat.apply(this, arguments); }
  function renderCacheInfo() { return HA.renderCacheInfo.apply(this, arguments); }
  function applyFont() { return HA.applyFont.apply(this, arguments); }
  function applyTheme() { return HA.applyTheme.apply(this, arguments); }
  function openSet() { return HA.openSet.apply(this, arguments); }
  function backSet() { return HA.backSet.apply(this, arguments); }
  function autoBackup() { return HA.autoBackup.apply(this, arguments); }
  function makeBackup() { return HA.makeBackup.apply(this, arguments); }
  function readBackup() { return HA.readBackup.apply(this, arguments); }
  function restoreBackup() { return HA.restoreBackup.apply(this, arguments); }
  function renderDiag() { return HA.renderDiag.apply(this, arguments); }
  function renderThinInfo() { return HA.renderThinInfo.apply(this, arguments); }
  function startThin() { return HA.startThin.apply(this, arguments); }
  function setBase() { return HA.setBase.apply(this, arguments); }
  function setTiles() { return HA.setTiles.apply(this, arguments); }
  function openMini() { return HA.openMini.apply(this, arguments); }
  function closeMini() { return HA.closeMini.apply(this, arguments); }
  function blocksList() { return HA.blocksList.apply(this, arguments); }
  function renderBlkInfo() { return HA.renderBlkInfo.apply(this, arguments); }
  function drawBlocks() { return HA.drawBlocks.apply(this, arguments); }
  function drawRows() { return HA.drawRows.apply(this, arguments); }
  function closeBlockPop() { return HA.closeBlockPop.apply(this, arguments); }
  function renderData() { return HA.renderData.apply(this, arguments); }
  function profInit() { return HA.profInit.apply(this, arguments); }
  function ovList() { return HA.ovList.apply(this, arguments); }
  function syncOverlays() { return HA.syncOverlays.apply(this, arguments); }
  function syncAllOverlays() { return HA.syncAllOverlays.apply(this, arguments); }
  function renderOv() { return HA.renderOv.apply(this, arguments); }
  function calibrateOv() { return HA.calibrateOv.apply(this, arguments); }
  function tuneOv() { return HA.tuneOv.apply(this, arguments); }
  function importOv() { return HA.importOv.apply(this, arguments); }
  function exportOv() { return HA.exportOv.apply(this, arguments); }
  function importHz() { return HA.importHz.apply(this, arguments); }
  function cleanOv() { return HA.cleanOv.apply(this, arguments); }
  function showMap() { return HA.showMap.apply(this, arguments); }
  function shiftMap() { return HA.shiftMap.apply(this, arguments); }
  function renderMap() { return HA.renderMap.apply(this, arguments); }
  function spInit() { return HA.spInit.apply(this, arguments); }
  function pbInit() { return HA.pbInit.apply(this, arguments); }
  function openMapMenu() { return HA.openMapMenu.apply(this, arguments); }

  // ---------- pasang ----------
  function init() {
    $('btnMenu').onclick = openDrawer;
    $('setMenu').onclick = function (e) { var b = e.target.closest ? e.target.closest('[data-sp]') : null; if (b) openSet(b.getAttribute('data-sp')); };
    document.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = backSet; });
    $('fontSeg').onclick = function (e) { var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (f) { S.settings.fs = f; saveSettings(); applyFont(); } };
    $('themeSeg').onclick = function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-t'); if (t) { S.settings.theme = t; saveSettings(); applyTheme(); } };
    pbInit();
    spInit();
    profInit();
    $('bkMake').onclick = function () { makeBackup(); };
    $('autoBkChk').onchange = function () { S.settings.autoBk = this.checked; saveSettings(); if (this.checked) autoBackup(); };
    $('thinSel').onchange = function () { S.settings.thinDays = +this.value; saveSettings(); renderThinInfo(); };
    $('thinGo').onclick = function () { startThin(); };
    $('diagShare').onclick = function () { var t = S.diagText || ''; if (!t) { toast('Belum ada catatan'); return; } saveFile('HZTrip-catatan-' + T.ymd(Date.now()) + '.txt', textB64(t), 'text/plain'); };
    $('diagClear').onclick = function () { askConfirm('Hapus catatan pemicu?', 'Semua baris catatan dihapus. Data perjalanan tidak terpengaruh.', 'Hapus', function () { Plug.clearDiag().then(renderDiag); }); };
    $('bkRestore').onclick = function () { $('bkFile').value = ''; $('bkFile').click(); };
    $('bkFile').onchange = function () { var f = this.files && this.files[0]; if (f) readBackup(f).then(restoreBackup).catch(function (e) { toast(e && e.message || 'Berkas tidak bisa dibaca'); }); };
    $('scrim').onclick = function () { closeSheet(); $('drawer').classList.remove('on'); };
    document.querySelectorAll('#drawer a[data-go]').forEach(function (a) { a.onclick = function () { go(a.getAttribute('data-go')); }; });
    $('btnRec').onclick = toggleRec;
    $('modeBox').onclick = onModeAction;
    $('modeBtns').onclick = onModeAction;
    $('warnBox').onclick = onModeAction;
    $('mergeNo').onclick = function () { exitSel(); renderHistory(); };
    $('mergeGo').onclick = doMerge;
    $('toList').onclick = function () { exitSel(); S.hMode = 'list'; loadRiwayat(); $('main').scrollTop = 0; };
    $('monthView').onclick = function (e) { var b = e.target.closest ? e.target.closest('.mrow') : null; if (b) { exitSel(); S.hDay = b.getAttribute('data-d'); S.hMode = 'day'; loadRiwayat(); $('main').scrollTop = 0; } };
    $('dPrev').onclick = function () { shiftDay(-1); };
    $('dNext').onclick = function () { shiftDay(1); };
    $('dPick').onchange = function () { if (this.value && this.value <= T.ymd(Date.now())) { exitSel(); S.hDay = this.value; loadHistory(); } };
    (function () {
      var timer = null, sx = 0, sy = 0, fired = false;
      var tl = $('tripList');
      function cancel() { clearTimeout(timer); timer = null; }
      tl.addEventListener('pointerdown', function (e) {
        var b = e.target.closest ? e.target.closest('.trip') : null;
        fired = false; cancel();
        if (!b || S.sel || S.hTrips.length < 2) return;
        sx = e.clientX; sy = e.clientY;
        timer = setTimeout(function () {
          fired = true;
          S.sel = [+b.getAttribute('data-i')];
          try { if (navigator.vibrate) navigator.vibrate(30); } catch (er) {}
          renderHistory();
        }, 500);
      });
      tl.addEventListener('pointermove', function (e) { if (timer && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) cancel(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { tl.addEventListener(n, cancel); });
      tl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      tl.addEventListener('click', function (e) {
        if (fired) { fired = false; return; }
        var pm = e.target.closest ? e.target.closest('.pmap') : null;
        if (pm) { e.stopPropagation(); var pi = +pm.getAttribute('data-pm'); if (S.mini && S.mini.i === pi) closeMini(); else openMini(pi); return; }
        var b = e.target.closest ? e.target.closest('.trip') : null;
        if (!b) return;
        var ii = +b.getAttribute('data-i');
        if (S.sel) toggleSel(ii); else openTrip(ii);
      });
    })();
    $('unitAdd').onclick = addUnit;
    $('unitSel').onchange = function () { setUnit(this.value); renderUnitCard(); toast('Unit dipakai: ' + this.value); };
    $('unitBox').onclick = function (e) {
      var d = e.target.getAttribute('data-type'), x = e.target.getAttribute('data-del');
      if (d !== null) { var un = S.settings.units[+d]; S.settings.unitType[un] = typeOf(un) === 'Kerja' ? 'Pribadi' : 'Kerja'; saveSettings(); renderSettings(); }
      if (x !== null) {
        var u = S.settings.units[+x];
        askConfirm('Hapus unit ' + u + '?', 'Trip lama tetap tersimpan dengan nama unit ini.' + (unitAt(Date.now()) === u ? ' Unit ini sedang dipakai; unit aktif akan pindah ke unit lain di daftar.' : ''), 'Hapus', function () {
          S.settings.units.splice(S.settings.units.indexOf(u), 1);
          fixSlotsAfterDelete(u);
          delete S.settings.unitType[u];
          saveSettings(); renderSettings();
        });
      }
    };
    $('splitSel').onchange = function () { S.settings.splitSec = +this.value; saveSettings(); recomputeLive(); toast('Batas pisah trip disimpan'); };
    $('autoChk').onchange = function () { S.settings.auto = this.checked; saveSettings(); pushSchedule(); if (this.checked && native && !S.actPerm) askActivity(); };
    $('btnAct').onclick = askActivity;
    $('popSel').onchange = function () { S.popSnd = this.value; Plug.setPopupSound({ mode: this.value }).catch(function () {}); };
    $('btnPopPick').onclick = function () { Plug.pickPopupSound().then(function (r) { if (r && r.changed) { S.popName = r.name || 'Nada pilihan'; renderSpido(); toast('Nada popup disimpan'); } }).catch(function () { toast('Pemilih nada tidak bisa dibuka'); }); };
    $('btnPopTest').onclick = function () { Plug.testPopupSound().catch(function () {}); };
    $('btnPopDef').onclick = function () { Plug.clearPopupSound().then(function () { S.popName = ''; renderSpido(); toast('Kembali ke nada bawaan'); }).catch(function () {}); };
    $('btnOver').onclick = function () { Plug.openOverlaySettings().catch(function () { toast('Tidak bisa membuka pengaturan'); }); };
    $('marginSel').onchange = function () { S.settings.margin = +this.value; saveSettings(); renderSched(); pushSchedule(); };
    $('schedBox').onchange = onSched;
    $('schedBox').onclick = function (e) {
      var tg = e.target.closest ? e.target.closest('[data-tog]') : null;
      if (tg) { var dd = +tg.getAttribute('data-tog'); HA.openDay = (HA.openDay === dd) ? -1 : dd; renderSched(); return; }
      var c = e.target.getAttribute && e.target.getAttribute('data-clear');
      if (c !== null && c !== undefined) {
        var x = S.settings.schedule.days[+c];
        askConfirm('Jadikan ' + HARI[+c] + ' libur?', 'Jam masuk dan pulang hari ini dikosongkan. Semua trip hari itu dianggap Pribadi.', 'Jadikan libur', function () { x['in'] = ''; x.out = ''; saveSettings(); pushSchedule(); var sc = $('main').scrollTop; renderSched(); $('main').scrollTop = sc; });
      }
    };
    $('btnBatt').onclick = openBatt;
    $('btnBg').onclick = askBackground;
    $('btnPrint').onclick = function () { openPrint({ day: S.hMode === 'list' ? T.ymd(Date.now()) : S.hDay }); };
    document.querySelectorAll('#drawer a[data-print]').forEach(function (a) { a.onclick = function () { closeDrawer(); openPrint({ day: S.hDay }); }; });
    $('mapSeg').onclick = function (e) { var m = e.target.getAttribute && e.target.getAttribute('data-map'); if (m) { S.settings.mapMode = m; saveSettings(); setTiles(); if (HA.mini) { setBase(HA.mini); syncOverlays(HA.mini); } } };
    $('mapChips').onclick = function (e) {
      var t = e.target; if (!t.getAttribute) return;
      if (t.getAttribute('data-k')) {
        var nxt = { all: 'kerja', kerja: 'pribadi', pribadi: 'all' };
        HA.mapKind = nxt[HA.mapKind]; if (!(S.mapCnt && S.mapCnt[HA.mapKind]) && HA.mapKind !== 'all') HA.mapKind = nxt[HA.mapKind]; if (!(S.mapCnt && S.mapCnt[HA.mapKind]) && HA.mapKind !== 'all') HA.mapKind = 'all';
        HA.mapSel = -1; HA.PB.cur = null;
        // lewati mode yang tidak punya trip (renderMap mengembalikan ke 'all' bila kosong)
        renderMap(true); return;
      }
      var i = t.getAttribute('data-i'); if (i !== null && i !== undefined) { HA.mapSel = +i; renderMap(true); }
    };
    $('mapMenu').onclick = openMapMenu;
    $('mPrev').onclick = function () { shiftMap(-1); };
    $('mNext').onclick = function () { shiftMap(1); };
    $('mToday').onclick = function () { S.mapDay = S.today; HA.mapSel = -1; HA.fitted = false; renderMap(true); };
    $('mPick').onchange = function () { if (this.value && this.value <= S.today) { S.mapDay = this.value; HA.mapSel = -1; HA.fitted = false; renderMap(true); } };
    $('toMap').onclick = function () { showMap(S.hDay, -1); };
    $('hidList').onclick = onHidden;
    $('miniX').onclick = function () { closeMini(); };
    $('dpTabs').onclick = function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-tab'); if (t) { S.dpTab = t; renderData(); } };
    $('blkDelAll').onclick = function () {
      var n = blocksList().length; if (!n) { toast('Belum ada blok'); return; }
      askConfirm('Hapus semua ' + n + ' blok?', 'Semua blok dihapus dari aplikasi. Peta PDF dan data lain tidak terpengaruh. Blok bisa diimpor lagi dari Logbook.HZ.', 'Hapus', function () { S.settings.blocks = []; HA.RC.rows = {}; HA.RC.dep = {}; HA.RC.guide = {}; HzBlok.cache.clear(); saveSettings(); closeBlockPop(); drawBlocks(); drawRows(); renderBlkInfo(); toast('Semua blok dihapus'); });
    };
    $('ovGo').onclick = function () { S.dpTab = 'pdf'; go('data'); };
    $('ovAdd').onclick = function () { $('ovFile').value = ''; $('ovFile').click(); };
    $('ovFile').onchange = function () { if (this.files && this.files[0]) importOv(this.files[0]); };
    $('ovImp').onclick = function () { $('ovHz').value = ''; $('ovHz').click(); };
    $('ovHz').onchange = function () { importHz(Array.prototype.slice.call(this.files || [])); };
    $('ovList').onclick = function (e) {
      var c = e.target.getAttribute && e.target.getAttribute('data-cal'), d = e.target.getAttribute && e.target.getAttribute('data-del');
      var cl = e.target.getAttribute && e.target.getAttribute('data-clean'), ex = e.target.getAttribute && e.target.getAttribute('data-exp');
      if (ex !== null && ex !== undefined) { exportOv(+ex); return; }
      if (cl !== null && cl !== undefined) cleanOv(+cl);
      var tu = e.target.getAttribute && e.target.getAttribute('data-tune');
      if (tu !== null && tu !== undefined) tuneOv(+tu);
      if (c !== null && c !== undefined) calibrateOv(+c);
      if (d !== null && d !== undefined) {
        var o = ovList()[+d];
        askConfirm('Hapus peta "' + o.name + '"?', 'Gambar peta ini dihapus dari ponsel. File PDF asli Anda tidak terpengaruh.', 'Hapus', function () {
          HzOverlay.delOverlay(o.id).then(function () { ovList().splice(+d, 1); saveSettings(); renderOv(); syncAllOverlays(); });
        });
      }
    };
    $('demAdd').onclick = function () { $('demFile').value = ''; $('demFile').click(); };
    $('demFile').onchange = function () { demImport($('demFile').files); };
    $('demDel').onclick = function () { askConfirm('Hapus data ketinggian?', 'Data DEMNAS di ponsel dihapus. Berkas .tif asli Anda tidak terpengaruh dan bisa diimpor lagi.', 'Hapus', function () { HzDem.clearLocal().then(function () { demAfter(); toast('Data ketinggian dihapus'); }); }); };
    $('satNat').onclick = function (e) {
      var v = e.target.getAttribute && e.target.getAttribute('data-sn'); if (!v) return;
      S.settings.satNative = +v; saveSettings(); renderSatNat(); setTiles(); if (HA.SP.map) setBase(HA.SP.map, 'sat');
    };
    $('tcClear').onclick = function () { askConfirm('Bersihkan cache peta?', 'Peta yang tersimpan dihapus. Peta akan diunduh lagi saat Anda melihatnya dengan internet.', 'Bersihkan', function () { HA.TC.clear().then(function () { renderCacheInfo(); toast('Cache peta dibersihkan'); }); }); };
    $('radiusSel').onchange = function () { S.settings.radius = +this.value; saveSettings(); pushSchedule(); };
    $('driverIn').onchange = function () { S.settings.driver = this.value.trim(); saveSettings(); };

    Plug.addListener('fix', onFix);
    Plug.addListener('state', applyStatus);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { syncStatus(); refreshToday().then(renderSpido); if (S.view === 'riwayat') loadRiwayat(); purgeExpired(); autoBackup(); }
    });
    var tick = 0;
    setInterval(function () {
      tick++;
      if (S.view === 'spido' && !document.hidden) { renderSpido(); if (tick % 20 === 0) renderUnitCard(); }
      if (S.view === 'lintasan' && !document.hidden && S.mode === 'rekam' && S.mapDay === S.today && tick % 15 === 0) renderMap(false);
    }, 1000);
    setInterval(function () { if (!document.hidden) syncStatus(); }, 20000);

    loadMeta().then(function () {
      renderSettings();
      return Promise.all([syncStatus(), refreshToday()]);
    }).then(function () { pushSchedule(); renderSpido(); purgeExpired(); setTimeout(autoBackup, 6000); });
    renderSpido();
  }
  init();
})();
