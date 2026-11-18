/* api.js - all saving and loading goes through here.
   The PHP program on the hosting (api/index.php) keeps everything in its database; this file talks to it, keeps a copy of
   the data in memory for the screens (Store.s), shrinks photos before they are uploaded, and draws the storage ring.
   There is no "saved in the browser only" mode: when the server cannot be reached, the screen says so loudly. */
(function () {
  'use strict';
  var C = window.Core, L = C.L;
  var ROOT = window.ROOT || '';
  var API = ROOT + 'api/index.php';

  var S = {
    user: null, features: {}, staff: [],
    storage: { pos: { used: 0, count: 0, limit: 0 } },
    settings: C.defaultSettings(), counter: 0,
    products: [], customers: [], invoices: [], expenses: [], reminders: [], moves: [], claims: []
  };
  var hooks = { authLost: null, storage: null, error: null };

  function err(code, status, extra) { var e = new Error(code); e.code = code; e.status = status || 0; e.extra = extra || null; return e; }

  /* ------------------------------------------------ calls */
  function call(action, body) {
    if (window.LocalBackend) {                         // the demo: answered inside this browser (js/local-backend.js)
      return window.LocalBackend.handle(action, body).then(function (j) {
        if (j.storage) setStorage(j.storage);
        if (j.demo) S.demo = j.demo;
        return j;
      }, function (e) {
        var x = err(e.code || 'server_error', 0, e.extra);
        if (e.extra && e.extra.demo) S.demo = e.extra.demo;
        if (x.code === 'not_logged_in' && action !== 'status' && hooks.authLost) hooks.authLost();
        if (hooks.error) hooks.error(x);
        throw x;
      });
    }
    var post = body !== undefined;
    var opt = { method: post ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'X-Requested-With': 'garage' } };
    if (post) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    var ctl = window.AbortController ? new AbortController() : null, timer = null;
    if (ctl) { opt.signal = ctl.signal; timer = setTimeout(function () { ctl.abort(); }, /restore|load|media/.test(action) ? 120000 : 40000); }
    var done = function () { if (timer) clearTimeout(timer); };
    return fetch(API + '?action=' + action, opt).then(function (res) {
      return res.text().then(function (txt) {
        done();
        var j = null;
        try { j = JSON.parse(txt); } catch (e) { /* not our API */ }
        if (!j || typeof j !== 'object') throw err('no_api', res.status);
        if (!j.ok) {
          var e = err(j.error || 'server_error', res.status, j);
          if (e.code === 'not_logged_in' && action !== 'status' && hooks.authLost) hooks.authLost();
          if (j.storage) setStorage(j.storage);
          throw e;
        }
        if (j.storage) setStorage(j.storage);
        return j;
      });
    }, function () { done(); throw err('network'); });
  }
  function setStorage(st) { S.storage = st; if (hooks.storage) hooks.storage(st); }

  /* ------------------------------------------------ boot: resolves to 'ready' | 'login' | 'setup' */
  function boot(kind) {
    return call('status').then(function (st) {
      S.features = st.features || {};
      if (st.demo) S.demo = st.demo;
      if (st.setup_needed) return 'setup';
      if (!st.user) return 'login';
      S.user = st.user;
      if (kind === 'none') return 'ready';
      return loadPos().then(function () { return 'ready'; });
    });
  }
  function fixProduct(p) { p.kind = p.kind === 'service' ? 'service' : 'part'; p.stock = C.num(p.stock); return p; }
  function fixInvoice(i) {
    i.items = i.items || []; i.payments = i.payments || []; i.photos = i.photos || []; i.car = i.car || {}; i.svc = i.svc || []; i.damage = i.damage || [];
    i.status = i.status || 'open'; return i;
  }
  function loadPos() {
    return call('load').then(function (d) {
      S.user = d.user || S.user; S.features = d.features || S.features;
      S.settings = Object.assign(C.defaultSettings(), d.settings || {});
      S.products = (d.products || []).map(fixProduct);
      S.invoices = (d.invoices || []).map(fixInvoice);
      ['customers', 'expenses', 'reminders', 'moves', 'claims'].forEach(function (k) { S[k] = d[k] || []; });
      S.counter = d.counter || 0; S.staff = d.staff || [];
      S.firstRun = !d.settings;
      // a brand-new install: write the default garage details once (only the owner can)
      if (!d.settings && isAdmin()) return call('put', { col: 'settings', doc: S.settings }).then(function () {});
    });
  }
  function poll() { return call('poll').then(function (r) { if (r.reminders) S.reminders = r.reminders; return r; }); }
  function login(p) { return call('login', { password: p }).then(function (r) { S.user = r.user; return r.user; }); }
  function setup(body) { return call('setup', body).then(function (r) { S.user = r.user; return r.user; }); }
  function logout() { return call('logout', {}).then(function () { S.user = null; }); }

  /* ------------------------------------------------ who may do what (the server enforces the same rules) */
  function isAdmin() { return !!S.user && S.user.role === 'admin'; }
  function isViewer() { return !!S.user && S.user.role === 'viewer'; }
  function sees(perm) { return !!S.user && (S.user.role !== 'staff' || (S.user.perms || []).indexOf(perm) >= 0); }
  function can(perm) { return !!S.user && !isViewer() && (isAdmin() || (S.user.perms || []).indexOf(perm) >= 0); }
  function guard() { return isViewer() ? Promise.reject(err('read_only')) : null; }

  /* ------------------------------------------------ small list helpers */
  function upsert(list, doc) {
    for (var i = 0; i < list.length; i++) if (list[i].id === doc.id) { list[i] = doc; return; }
    list.push(doc);
  }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function drop(key, ids) { var g = {}; ids.forEach(function (i) { g[i] = 1; }); S[key] = S[key].filter(function (x) { return !g[x.id]; }); }
  /* the server sends back the fresh quantities of the store items a change touched */
  function applyStock(map) {
    if (!map) return;
    Object.keys(map).forEach(function (pid) {
      var p = byId(S.products, pid);
      if (p) { p.stock = C.num(map[pid].stock); if ('cost' in map[pid]) { p.cost = map[pid].cost; p.lastCost = map[pid].lastCost; } }
    });
  }
  function put(col, doc, key) {
    var g = guard(); if (g) return g;
    return call('put', { col: col, doc: doc }).then(function (r) { if (key) upsert(S[key], col === 'products' ? fixProduct(r.doc) : r.doc); applyStock(r.stock); return r.doc; });
  }
  function del(col, ids, key) {
    var g = guard(); if (g) return g;
    return call('del', { col: col, ids: ids }).then(function (r) { if (key) drop(key, ids); applyStock(r.stock); });
  }

  /* ------------------------------------------------ writes */
  function saveSettings(patch) {
    var g = guard(); if (g) return g;
    var next = Object.assign({}, S.settings, patch);
    return call('put', { col: 'settings', doc: next }).then(function (r) { S.settings = Object.assign(C.defaultSettings(), r.doc); });
  }
  function createInvoice(inv) {
    var g = guard(); if (g) return g;
    return call('create_invoice', { doc: inv }).then(function (r) { var d = fixInvoice(r.doc); upsert(S.invoices, d); S.counter = r.counter; applyStock(r.stock); return d; });
  }
  function updateInvoice(inv) {
    var g = guard(); if (g) return g;
    return call('update_invoice', { doc: inv }).then(function (r) { var d = fixInvoice(r.doc); upsert(S.invoices, d); applyStock(r.stock); return d; });
  }
  function voidInvoice(id, reason) {
    var g = guard(); if (g) return g;
    return call('void_invoice', { id: id, reason: reason || '' }).then(function (r) { var d = fixInvoice(r.doc); upsert(S.invoices, d); applyStock(r.stock); return d; });
  }
  function touchInvoice(id, body) {
    var g = guard(); if (g) return g;
    return call('invoice_touch', Object.assign({ id: id }, body)).then(function (r) { var d = fixInvoice(r.doc); upsert(S.invoices, d); return d; });
  }
  function removeInvoices(ids) {
    var g = guard(); if (g) return g;
    return call('del_invoices', { ids: ids }).then(function (r) { drop('invoices', ids); applyStock(r.stock); });
  }
  function stockMove(body) {
    var g = guard(); if (g) return g;
    return call('stock_move', body).then(function (r) { S.moves.push(r.move); applyStock(r.stock); return r.move; });
  }
  function claimNote(id, text) {
    var g = guard(); if (g) return g;
    return call('claim_note', { id: id, text: text }).then(function (r) { upsert(S.claims, r.doc); return r.doc; });
  }

  /* ------------------------------------------------ backup */
  function exportAll() {
    var out = { app: 'garage-demo', version: 1, exported: new Date().toISOString(), counter: S.counter, settings: S.settings };
    ['products', 'customers', 'invoices', 'expenses', 'reminders', 'moves', 'claims'].forEach(function (k) { out[k] = S[k]; });
    return out;
  }
  function restore(data) {
    var g = guard(); if (g) return g;
    if (!data || !Array.isArray(data.invoices) || !Array.isArray(data.products)) return Promise.reject(err('bad_backup'));
    return call('restore', { data: data }).then(loadPos);
  }

  /* ------------------------------------------------ photos */
  var webpOk = null;
  function canWebp() {
    if (webpOk === null) { try { webpOk = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { webpOk = false; } }
    return webpOk;
  }
  function toBlob(canvas, type, q) {
    return new Promise(function (res) {
      if (canvas.toBlob) canvas.toBlob(function (b) { res(b); }, type, q);
      else { var bin = atob(canvas.toDataURL(type, q).split(',')[1]), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); res(new Blob([u], { type: type })); }
    });
  }
  function loadImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return viaTag(file); });
    }
    return viaTag(file);
  }
  function viaTag(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); res(im); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(err('bad_image')); };
      im.src = url;
    });
  }
  function draw(img, max) {
    var w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    var c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);      // transparent PNGs get a white background
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  }
  /* Photo sizes. Car / accident photos keep enough detail for an insurance company to read a dent or a scratch
     (longest side 1600 px), yet a 4-8 MB phone photo becomes about 150-300 KB. 10 GB holds roughly 35,000-60,000 of them. */
  var PRESET = {
    car: { max: 1600, q: 0.72, cap: 320 * 1024 },
    item: { max: 900, q: 0.62, cap: 110 * 1024 },
    logo: { max: 600, q: 0.85, cap: 120 * 1024 }
  };
  /* -> { blob, thumb, before, after } : the shrunken photo, its small thumbnail, the sizes before / after */
  function compress(file, presetName) {
    var p = PRESET[presetName] || PRESET.car, type = canWebp() ? 'image/webp' : 'image/jpeg';
    if (!file || !/^image\//.test(file.type || 'image/')) return Promise.reject(err('bad_image'));
    return loadImage(file).then(function (img) {
      var max = p.max, q = p.q;
      function attempt() {
        return toBlob(draw(img, max), type, q).then(function (b) {
          if (!b) throw err('bad_image');
          if (b.size > p.cap && (q > 0.45 || max > 640)) {             // still heavy: lower the quality, then the size
            if (q > 0.45) q -= 0.07; else max = Math.round(max * 0.84);
            return attempt();
          }
          return b;
        });
      }
      return attempt().then(function (blob) {
        return toBlob(draw(img, 320), type, 0.62).then(function (thumb) {
          if (img.close) img.close();
          return { blob: blob, thumb: thumb, before: file.size || 0, after: blob.size + (thumb ? thumb.size : 0) };
        });
      });
    });
  }
  function b64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(',')[1]); };
      fr.onerror = function () { rej(err('bad_image')); };
      fr.readAsDataURL(blob);
    });
  }
  /* shrink + upload. Resolves the photo's name. */
  function upload(file, preset) {
    var g = guard(); if (g) return g;
    var st = S.storage.pos || {};
    if (st.limit > 0 && st.used >= st.limit) return Promise.reject(err('storage_full'));      // do not even start when the room is used up
    return compress(file, preset).then(function (c) {
      window.Media.info = { before: c.before, after: c.after };          // shown to the user: "4.2 MB -> 210 KB"
      return Promise.all([b64(c.blob), c.thumb ? b64(c.thumb) : null]).then(function (d) {
        return call('media_upload', { data: d[0], thumb: d[1] }).then(function (r) { return r.id; });
      });
    });
  }
  function mediaDel(ids) {
    ids = (ids || []).filter(Boolean);
    if (!ids.length || isViewer()) return Promise.resolve();
    return call('media_del', { ids: ids }).catch(function () { /* tidy-up only */ });
  }
  function mediaUrl(id, thumb) {
    if (!id) return '';
    if (window.LocalBackend) return window.LocalBackend.mediaUrl(id, thumb);
    return ROOT + 'api/media.php?f=' + encodeURIComponent(id) + (thumb ? '&t=1' : '');
  }
  /* the garage logo: the one uploaded in Settings, or the demo's own logo (img/logo.png) */
  function logoUrl() { return (S.settings.logo && mediaUrl(S.settings.logo)) || ROOT + 'img/logo.png'; }
  /* an item picture, or a coloured tile with its first letters when there is no photo */
  function thumbHtml(id, name, color, cls) {
    if (id) return '<img class="' + (cls || 'thumb') + '" loading="lazy" alt="" src="' + C.esc(mediaUrl(id, true)) + '">';
    return '<span class="' + (cls || 'thumb') + ' noimg" style="--tile:' + (color || '#64736c') + '">' + C.esc(C.initials(name)) + '</span>';
  }

  /* The storage ring: how much of the allowed photo room has been used. */
  function ring(title, opt) {
    opt = opt || {};
    var st = S.storage.pos || { used: 0, limit: 0, count: 0 };
    var pct = st.limit > 0 ? Math.min(100, st.used / st.limit * 100) : 0;
    var shown = pct > 0 && pct < 0.1 ? '<0.1' : (pct < 10 ? pct.toFixed(1) : String(Math.round(pct)));
    var R = 52, CIR = 2 * Math.PI * R, cls = pct >= 100 ? 'full' : pct >= 85 ? 'warn' : '';
    return '<div class="ring-card ' + cls + (opt.small ? ' small' : '') + '">' +
      '<div class="ring"><svg viewBox="0 0 120 120" role="img" aria-label="' + C.esc(title) + ' ' + shown + '%">' +
      '<circle class="ring-bg" cx="60" cy="60" r="' + R + '"/>' +
      '<circle class="ring-fg" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + CIR.toFixed(1) + '" stroke-dashoffset="' + (CIR * (1 - Math.max(pct, pct > 0 ? 1.2 : 0) / 100)).toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
      '</svg><div class="ring-mid"><b>' + shown + '%</b><span>' + L('مستخدم', 'used') + '</span></div></div>' +
      '<div class="ring-info"><h4>' + C.esc(title) + '</h4>' +
      '<p class="ring-num"><b dir="ltr">' + C.bytes(st.used) + '</b> ' + L('من', 'of') + ' <b dir="ltr">' + C.bytes(st.limit) + '</b></p>' +
      '<p class="muted">' + L('عدد الصور: ', 'Photos: ') + st.count + ' · ' + L('المتبقي: ', 'Free: ') + '<span dir="ltr">' + C.bytes(Math.max(0, st.limit - st.used)) + '</span></p>' +
      (pct >= 100 ? '<p class="ring-msg">' + L('امتلأت المساحة. احذف ما لا تحتاجه من الصور لتتمكن من رفع صور جديدة.', 'Storage is full. Delete photos you do not need to upload new ones.') + '</p>'
        : pct >= 85 ? '<p class="ring-msg">' + L('المساحة قاربت على الامتلاء.', 'Storage is almost full.') + '</p>' : '') +
      '</div></div>';
  }

  window.Store = {
    s: S, hooks: hooks, call: call, boot: boot, loadPos: loadPos, poll: poll,
    login: login, setup: setup, logout: logout,
    isAdmin: isAdmin, isViewer: isViewer, sees: sees, can: can,
    byId: byId, upsert: upsert, put: put, del: del,
    product: function (id) { return byId(S.products, id); },
    saveSettings: saveSettings,
    saveProduct: function (d) { return put('products', d, 'products'); },
    removeProducts: function (ids) { return del('products', ids, 'products'); },
    saveCustomer: function (d) { return put('customers', d, 'customers'); },
    removeCustomer: function (id) { return del('customers', [id], 'customers'); },
    saveExpense: function (d) { return put('expenses', d, 'expenses'); },
    removeExpense: function (id) { return del('expenses', [id], 'expenses'); },
    saveReminder: function (d) { return put('reminders', d, 'reminders'); },
    removeReminder: function (id) { return del('reminders', [id], 'reminders'); },
    saveClaim: function (d) { return put('claims', d, 'claims'); },
    removeClaim: function (id) { return del('claims', [id], 'claims'); },
    claimNote: claimNote,
    createInvoice: createInvoice, updateInvoice: updateInvoice, voidInvoice: voidInvoice, touchInvoice: touchInvoice, removeInvoices: removeInvoices,
    stockMove: stockMove, exportAll: exportAll, restore: restore,
    users: function () { return call('users'); },
    addUser: function (u) { var g = guard(); if (g) return g; return call('user_add', u); },
    updateUser: function (u) { var g = guard(); if (g) return g; return call('user_update', u); },
    delUser: function (id) { var g = guard(); if (g) return g; return call('user_del', { id: id }); },
    setPassword: function (b) { return call('user_password', b); },
    health: function () { return call('health'); },
    log: function () { return call('log').then(function (r) { return r.log; }); }
  };
  window.Media = { compress: compress, upload: upload, del: mediaDel, url: mediaUrl, logo: logoUrl, thumb: thumbHtml, ring: ring, PRESET: PRESET };
})();
