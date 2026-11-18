/* photos.js - the photos of a job card or an insurance case.
   No limit on how many photos one job card holds; the only limit is the garage's total photo room (10 GB, api/features.php).
   Every photo is shrunk in the browser before it is uploaded (js/api.js: a 4-8 MB phone photo becomes ~150-300 KB),
   tagged "before / during / after the repair / document", can carry a short note, and can be changed or removed later.
   A photo entry: { id: '<file name on the server>', tag, note, ts, by } */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s;

  function tagBadge(t) { var g = C.tagOf(t); return '<span class="badge ' + g.cls + '">' + esc(C.nm(g)) + '</span>'; }
  function count(list, tag) { return (list || []).filter(function (p) { return !tag || p.tag === tag; }).length; }

  /* the thumbnails. opt.add: show the "take photo / choose photos" tiles; opt.small: smaller tiles */
  function grid(list, opt) {
    opt = opt || {};
    list = list || [];
    var adds = opt.add ? '<button type="button" class="ph-add" data-ph-cam>' + icon('camera', 26) + '<span>' + L('تصوير', 'Camera') + '</span></button>' +
      '<button type="button" class="ph-add" data-ph-gal>' + icon('image', 26) + '<span>' + L('من المعرض', 'Gallery') + '</span></button>' : '';
    if (!list.length && !opt.add) return '<p class="muted small">' + L('لا توجد صور.', 'No photos.') + '</p>';
    return '<div class="ph-grid' + (opt.small ? ' sm' : '') + '">' + adds + list.map(function (p, i) {
      return '<button type="button" class="ph" data-ph="' + i + '"><img loading="lazy" alt="" src="' + esc(Media.url(p.id, true)) + '">' +
        '<span class="ph-tag ' + C.tagOf(p.tag).cls + '">' + esc(C.nm(C.tagOf(p.tag))) + '</span>' + (p.note ? '<span class="ph-note">' + icon('notes', 13) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  /* the tag the next photos get, as a row of buttons */
  function tagPicker(cur) {
    return '<div class="seg ph-tags" role="group">' + C.PHOTO_TAGS.map(function (t) { return '<button type="button" data-tag="' + t.id + '" class="' + (cur === t.id ? 'on' : '') + '">' + esc(C.nm(t)) + '</button>'; }).join('') + '</div>';
  }

  /* upload photos one after the other (a slow phone connection never sends 10 photos at once).
     progress(done, total, lastInfo) is called after each one. Resolves to the new photo entries (the failed ones are left out). */
  function add(files, tag, progress) {
    files = (files || []).filter(Boolean);
    var out = [], i = 0, failed = 0;
    function next() {
      if (i >= files.length) {
        if (failed) C.toast(L('لم تُرفع ', 'Not uploaded: ') + failed + L(' صورة.', ' photo(s).'), 'warn');
        return Promise.resolve(out);
      }
      var f = files[i++];
      return Media.upload(f, 'car').then(function (id) {
        out.push({ id: id, tag: tag || 'before', note: '', ts: Math.floor(Date.now() / 1000), by: S.user ? S.user.name : '' });
        if (progress) progress(i, files.length, Media.info);
        return next();
      }, function (e) {
        if (e && e.code === 'storage_full') { C.toast(C.errText(e), 'err', 8000); return out; }
        failed++;
        if (progress) progress(i, files.length, null);
        return next();
      });
    }
    return next();
  }

  /* full-screen viewer: swipe / arrows between photos; when editable: change the tag, write a note, delete */
  function view(list, index, opt) {
    opt = opt || {};
    var i = index || 0, edit = !!opt.editable;
    var m = C.modal({ title: icon('image') + ' ' + L('الصور', 'Photos'), size: 'xl', body: '<div id="pv"></div>' });
    m.el.querySelector('.modal').classList.add('pv-modal');
    function drawOne() {
      if (!list.length) { m.close(); return; }
      if (i >= list.length) i = list.length - 1;
      var p = list[i];
      m.el.querySelector('#pv').innerHTML =
        '<div class="pv-stage"><img alt="" src="' + esc(Media.url(p.id)) + '">' +
        (list.length > 1 ? '<button type="button" class="pv-nav prev" data-prev aria-label="prev">' + icon(C.lang === 'ar' ? 'next' : 'back', 26) + '</button><button type="button" class="pv-nav next" data-next aria-label="next">' + icon(C.lang === 'ar' ? 'back' : 'next', 26) + '</button>' : '') +
        '<span class="pv-count">' + (i + 1) + ' / ' + list.length + '</span></div>' +
        '<div class="pv-info">' +
        (edit ? tagPicker(p.tag) : tagBadge(p.tag)) +
        (edit ? '<input class="input" id="pv-note" maxlength="200" placeholder="' + L('ملاحظة على الصورة (اختياري): مثال «خدش في الباب الأيمن»', 'Note on the photo (optional): e.g. "scratch on the right door"') + '" value="' + esc(p.note || '') + '">' : (p.note ? '<p>' + esc(p.note) + '</p>' : '')) +
        '<div class="row between wrap small muted"><span>' + esc(p.by || '') + (p.ts ? ' · ' + C.fts(p.ts) : '') + '</span><span class="row">' +
        '<a class="btn ghost sm" href="' + esc(Media.url(p.id)) + '" download="photo-' + (i + 1) + '" target="_blank" rel="noopener">' + icon('download', 16) + L('تنزيل', 'Download') + '</a>' +
        (edit ? '<button type="button" class="btn danger-soft sm" data-del>' + icon('trash', 16) + L('حذف الصورة', 'Delete photo') + '</button>' : '') + '</span></div></div>';
    }
    function changed() { if (opt.onChange) opt.onChange(list); }
    m.el.addEventListener('click', function (e) {
      var b;
      if (e.target.closest('[data-prev]')) { i = (i - 1 + list.length) % list.length; drawOne(); return; }
      if (e.target.closest('[data-next]')) { i = (i + 1) % list.length; drawOne(); return; }
      if ((b = e.target.closest('[data-tag]')) && edit) { list[i].tag = b.getAttribute('data-tag'); drawOne(); changed(); return; }
      if (e.target.closest('[data-del]') && edit) {
        C.confirmBox(L('حذف هذه الصورة؟', 'Delete this photo?'), L('حذف', 'Delete'), true).then(function (y) {
          if (!y) return;
          list.splice(i, 1); changed(); drawOne();
        });
      }
    });
    m.el.addEventListener('change', function (e) { if (e.target.id === 'pv-note' && edit) { list[i].note = e.target.value.trim(); changed(); } });
    m.el.addEventListener('keydown', function (e) {
      if (e.target.id === 'pv-note') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { var fwd = (e.key === 'ArrowLeft') === (C.lang === 'ar'); i = (i + (fwd ? 1 : -1) + list.length) % list.length; drawOne(); }
    });
    // swipe on phones
    var sx = null;
    m.el.addEventListener('touchstart', function (e) { if (e.target.closest('.pv-stage')) sx = e.touches[0].clientX; }, { passive: true });
    m.el.addEventListener('touchend', function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) < 50 || list.length < 2) return;
      var fwd = (dx < 0) === (C.lang !== 'ar'); i = (i + (fwd ? 1 : -1) + list.length) % list.length; drawOne();
    });
    drawOne();
    return m;
  }

  /* A window to look after the photos of a SAVED record (job card / insurance case): add more, tag, note, delete.
     save(list) must return a promise; it is called after every change. */
  function manage(title, list, opt) {
    opt = opt || {};
    list = (list || []).map(function (p) { return Object.assign({}, p); });
    var edit = !!opt.editable, tag = list.length ? 'after' : 'before', busy = false;
    var m = C.modal({ title: icon('camera') + ' ' + title, size: 'lg', body: '<div id="pm"></div>', onClose: opt.onClose });
    function drawAll(msg) {
      m.el.querySelector('#pm').innerHTML =
        (edit ? '<div class="row wrap between mb"><span class="small muted">' + L('الصور الجديدة تُسجَّل كـ:', 'New photos are tagged:') + '</span>' + tagPicker(tag) + '</div>' : '') +
        '<div class="row wrap mb" style="gap:6px">' + C.PHOTO_TAGS.map(function (t) { var n = count(list, t.id); return n ? '<span class="badge ' + t.cls + '">' + esc(C.nm(t)) + ': ' + n + '</span>' : ''; }).join('') + '<span class="badge">' + L('المجموع: ', 'Total: ') + list.length + '</span></div>' +
        (msg ? '<div class="note mb" id="pm-msg">' + msg + '</div>' : '') +
        grid(list, { add: edit }) +
        '<p class="small muted mt">' + L('اضغط على أي صورة لتكبيرها' + (edit ? '، وتغيير نوعها أو كتابة ملاحظة أو حذفها.' : '.'), 'Press a photo to see it big' + (edit ? ', change its tag, write a note or delete it.' : '.')) + '</p>';
    }
    function persist() {
      if (!opt.save) return Promise.resolve();
      busy = true;
      return opt.save(list.slice()).then(function () { busy = false; }, function (e) { busy = false; C.toast(C.errText(e), 'err'); });
    }
    function addFiles(files) {
      if (!files.length) return;
      drawAll(L('جارٍ تصغير الصور ورفعها: 0 / ', 'Shrinking and uploading photos: 0 / ') + files.length);
      add(files, tag, function (d, t, info) {
        var el = m.el.querySelector('#pm-msg');
        if (el) el.textContent = L('جارٍ تصغير الصور ورفعها: ', 'Shrinking and uploading photos: ') + d + ' / ' + t + (info ? ' (' + C.bytes(info.before) + ' → ' + C.bytes(info.after) + ')' : '');
      }).then(function (added) {
        if (!added.length) { drawAll(); return; }
        list = list.concat(added);
        persist().then(function () { drawAll(icon('check', 16) + ' ' + L('تم حفظ ', 'Saved ') + added.length + L(' صورة.', ' photo(s).')); });
      });
    }
    m.el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-tag]')) && !e.target.closest('.pv-info')) { tag = b.getAttribute('data-tag'); drawAll(); return; }
      if (e.target.closest('[data-ph-cam]')) { Shell.pickPhotos(true, false).then(addFiles); return; }
      if (e.target.closest('[data-ph-gal]')) { Shell.pickPhotos(false, true).then(addFiles); return; }
      if ((b = e.target.closest('[data-ph]'))) {
        view(list, +b.getAttribute('data-ph'), { editable: edit, onChange: function (l) { list = l; persist().then(function () { drawAll(); }); } });
      }
    });
    drawAll();
    return m;
  }

  window.Photos = { grid: grid, add: add, view: view, manage: manage, tagPicker: tagPicker, tagBadge: tagBadge, count: count };
})();
