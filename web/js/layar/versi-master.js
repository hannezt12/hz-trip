/* HZ Trip v0.16.5 - Versi simpanan per master: salinan blok + tanda master (maks 5 manual + 1 otomatis), disimpan terpisah (IndexedDB), tidak ikut backup */
(function () {
  'use strict';
  var HA = window.HzApp;
  if (!HA || !HA.ok || !HA.masterMembers || !HA.BT) return;
  var S = HA.S, MAX = 5, DBN = 'hzver', DB = null;
  function $(i) { return document.getElementById(i); }
  function esc(s) { return HA.esc(s); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function db() {
    if (DB) return DB;
    DB = new Promise(function (res, rej) {
      try { var r = indexedDB.open(DBN, 1); r.onupgradeneeded = function () { r.result.createObjectStore('v', { keyPath: 'id' }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (x) { rej(x); }
    });
    DB.catch(function () { DB = null; });
    return DB;
  }
  function all() {
    return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('v').objectStore('v').getAll(); q.onsuccess = function () { res(q.result || []); }; q.onerror = function () { res([]); }; }); }).catch(function () { return []; });
  }
  function put(v) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('v', 'readwrite'); t.objectStore('v').put(v); t.oncomplete = res; t.onerror = function () { rej(t.error); }; }); }); }
  function del(id) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('v', 'readwrite'); t.objectStore('v').delete(id); t.oncomplete = res; t.onerror = res; }); }); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(ts) { var d = new Date(ts); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2) + ' ' + p2(d.getHours()) + '.' + p2(d.getMinutes()); }
  function memberBlocks(m) { var mem = HA.masterMembers(m); return mem.in.concat(mem.man); }
  function snapshot(m, name, auto) {
    var bl = memberBlocks(m), seen = {}, items = [];
    bl.forEach(function (b) { HA.BT.itemsOf(b).forEach(function (it) { if (!seen[it.id]) { seen[it.id] = 1; items.push(clone(it)); } }); });
    return { id: 'v' + Date.now() + Math.floor(Math.random() * 1000), mid: String(m.id), name: name, ts: Date.now(), auto: !!auto, blocks: clone(bl), items: items };
  }
  function mine(list, m) { return list.filter(function (v) { return v.mid === String(m.id); }).sort(function (a, b) { return b.ts - a.ts; }); }
  function restore(m, v) {
    var cur = memberBlocks(m), cid = {}, d = HA.tandaData(), seen = {}, bs = HA.blocksList(), sid = {};
    cur.forEach(function (b) { cid[String(b.id)] = 1; HA.BT.itemsOf(b).forEach(function (it) { seen[it.id] = 1; }); });
    v.blocks.forEach(function (b) { sid[String(b.id)] = 1; });
    S.settings.blocks = bs.filter(function (b) { return !cid[String(b.id)] && !sid[String(b.id)]; }).concat(clone(v.blocks));
    d.items = d.items.filter(function (it) { return !seen[it.id]; }).concat(clone(v.items));
    HA.saveSettings(); HA.tandaSave(); if (HA.drawBlocks) HA.drawBlocks(); if (HA.KM && HA.KM.sync) HA.KM.sync();
  }
  HA.VM = {
    snapshot: snapshot, restore: restore, all: all,
    open: function (m, back) {
      function draw() {
        all().then(function (list) {
          var l = mine(list, m), man = l.filter(function (v) { return !v.auto; }).length, nb = memberBlocks(m).length;
          HA.openSheet('<div class="grab"></div><div class="bth"><div class="st">VERSI SIMPANAN · ' + esc(m.name) + '</div><button class="btn pri" id="vmOk">Selesai</button></div>' +
            '<div class="muted" style="margin:6px 0">Salinan ' + nb + ' blok + tandanya saat ini, maks ' + MAX + ' versi. Disimpan terpisah, tidak ikut backup.</div>' +
            '<div class="row" style="gap:8px"><input type="text" id="vmN" maxlength="40" placeholder="Nama versi" style="flex:1"><button class="btn pri" id="vmS">Simpan versi</button></div>' +
            '<div class="rbL" style="margin-top:10px">' + (l.length ? l.map(function (v, i) { return '<div class="rbR vrR" data-i="' + i + '"><div class="rbT"><b>' + esc(v.name) + '</b><small>' + fmt(v.ts) + ' · ' + v.blocks.length + ' blok · ' + v.items.length + ' tanda' + (v.auto ? ' · otomatis' : '') + '</small></div><button class="btn sm" data-p="' + i + '">Pulihkan</button><button class="btn sm" data-d="' + i + '">Hapus</button></div>'; }).join('') : '<div class="muted" style="padding:10px 2px">Belum ada versi.</div>') + '</div>');
          HA.onSheetClose = back || null;
          $('vmOk').onclick = function () { HA.closeSheet(); };
          $('vmS').onclick = function () {
            if (man >= MAX) { HA.toast('Sudah ' + MAX + ' versi, hapus satu dulu'); return; }
            var nm = $('vmN').value.trim() || ('Versi ' + fmt(Date.now()));
            put(snapshot(m, nm, false)).then(function () { HA.toast('Versi disimpan'); var h = HA.onSheetClose; draw(); setTimeout(function () { HA.onSheetClose = h; }, 50); });
          };
          $('sheet').querySelectorAll('[data-p]').forEach(function (e) { e.onclick = function () {
            var v = l[+e.getAttribute('data-p')], h = HA.onSheetClose; HA.onSheetClose = null;
            HA.askConfirm('Pulihkan "' + v.name + '"?', 'Blok & tanda master ' + m.name + ' dikembalikan ke ' + v.blocks.length + ' blok / ' + v.items.length + ' tanda (' + fmt(v.ts) + '). Kondisi sekarang disimpan otomatis dulu.', 'Pulihkan', function () {
              var a = l.filter(function (z) { return z.auto; });
              Promise.all(a.map(function (z) { return del(z.id); })).then(function () { return put(snapshot(m, 'Sebelum pulihkan', true)); }).then(function () { restore(m, v); HA.toast('Versi dipulihkan'); draw(); setTimeout(function () { HA.onSheetClose = h; }, 50); });
            });
            var cn = $('cfNo'); if (cn) cn.onclick = function () { draw(); setTimeout(function () { HA.onSheetClose = h; }, 50); };
          }; });
          $('sheet').querySelectorAll('[data-d]').forEach(function (e) { e.onclick = function () {
            var v = l[+e.getAttribute('data-d')], h = HA.onSheetClose; HA.onSheetClose = null;
            HA.askConfirm('Hapus versi?', v.name + '. Hanya salinan ini yang dihapus, data blok tidak berubah.', 'Hapus', function () { del(v.id).then(function () { draw(); setTimeout(function () { HA.onSheetClose = h; }, 50); }); });
            var cn = $('cfNo'); if (cn) cn.onclick = function () { draw(); setTimeout(function () { HA.onSheetClose = h; }, 50); };
          }; });
        });
      }
      draw();
    }
  };
})();
