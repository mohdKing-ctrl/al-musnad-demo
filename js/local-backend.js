/* local-backend.js - DEMO ONLY: the server's actions done inside this browser.
   The real garage system keeps everything on its own server (PHP + SQLite). This demo copy has no server: every action the
   screens send (create a bill, save an item, upload a photo ...) is answered here with the same rules, and the records are
   kept in this browser only (localStorage, photos in IndexedDB). Nothing is sent anywhere.
   The demo allows DEMO.limit new bills (5). The example bills do not count, and "Reset demo" does not give them back. */
(function () {
  'use strict';
  var C = window.Core, r3 = C.r3, num = C.num;
  var DEMO = window.GARAGE_DEMO || {};
  var KEY = (DEMO.key || 'garage_demo') + '_db_v1';
  var QKEY = (DEMO.key || 'garage_demo') + '_made';                 // how many bills the visitor made (kept on reset)
  var IDB = (DEMO.key || 'garage_demo') + '_media';
  var GB = 1024 * 1024 * 1024;
  var LIMITS = { photos: 10 * GB, max_staff: 15, bills: DEMO.limit || 5 };

  var PERMS = ['sell', 'edit_inv', 'discount', 'cost', 'stock', 'expenses', 'customers', 'insurance', 'reports'];
  var METHODS = ['cash', 'card', 'transfer', 'cheque'];
  var STAGES = ['open', 'work', 'ready', 'delivered'];
  var SVC_TYPES = ['dent', 'paint', 'mech', 'elec', 'other'];
  var SOURCES = ['oman', 'usa', 'uae', 'ins', 'other'];
  var PHOTO_TAGS = ['before', 'during', 'after', 'doc'];
  var CLAIM_ST = ['new', 'sent', 'approved', 'repair', 'done', 'paid', 'rejected'];
  var ZONES = ['fb', 'hood', 'ws', 'roof', 'rg', 'trunk', 'rb', 'lff', 'lfd', 'lrd', 'lrf', 'rff', 'rfd', 'rrd', 'rrf', 'lfw', 'lrw', 'rfw', 'rrw'];
  var ID_RE = /^[A-Za-z0-9_-]{1,64}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/, MEDIA_RE = /^[a-f0-9]{20}\.(webp|jpg|png)$/;

  var db = null, idb = null, urls = {}, readyP = null;

  function err(code, extra) { var e = new Error(code); e.code = code; e.extra = extra || null; return e; }
  function fresh() {
    var d = { users: [], docs: {}, meta: { counter: 0, ccounter: 0 }, log: [], media: {}, session: null };
    if (DEMO.seed) DEMO.seed(d);
    return d;
  }
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    if (raw) { try { db = JSON.parse(raw); } catch (e) { db = null; } }
    if (!db || !db.docs) { db = fresh(); try { save(); } catch (e) { /* ignore */ } }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw err('storage_browser'); } }
  function made() { try { return Math.max(0, parseInt(localStorage.getItem(QKEY) || '0', 10) || 0); } catch (e) { return 0; } }
  function setMade(n) { try { localStorage.setItem(QKEY, String(n)); } catch (e) { /* ignore */ } }
  function col(name) { return db.docs[name] || (db.docs[name] = {}); }
  function all(name) { var c = col(name); return Object.keys(c).map(function (k) { return c[k]; }); }
  function get(name, id) { var d = col(name)[id]; return d ? clone(d) : null; }
  function put(name, d) { col(name)[d.id] = d; }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function now() { return Math.floor(Date.now() / 1000); }
  function today() { return C.today(); }
  function me() { return db.session ? db.users.filter(function (u) { return u.id === db.session; })[0] || null : null; }
  function pub(u) { return u ? { id: u.id, username: u.username, name: u.name, role: u.role, perms: (u.perms || []).filter(function (p) { return PERMS.indexOf(p) >= 0; }) } : null; }
  function log(type, ref, detail) { db.log.unshift({ ts: now(), user: (me() || {}).name || '', type: type, ref: String(ref || '').slice(0, 120), detail: String(detail || '').slice(0, 400) }); if (db.log.length > 800) db.log.length = 800; }

  /* ---------------------------------------------- who may do what (same rules as the real server) */
  function needUser() { var u = me(); if (!u) throw err('not_logged_in'); return u; }
  function sees(u, p) { return u.role === 'admin' || u.role === 'viewer' || (u.perms || []).indexOf(p) >= 0; }
  function can(u, p) { if (u.role === 'viewer') return false; return u.role === 'admin' || (u.perms || []).indexOf(p) >= 0; }
  function needPerm() { var u = needUser(), ps = [].slice.call(arguments); if (u.role === 'viewer') throw err('read_only'); for (var i = 0; i < ps.length; i++) if (can(u, ps[i])) return u; throw err('no_permission'); }
  function needAdmin() { var u = needUser(); if (u.role === 'viewer') throw err('read_only'); if (u.role !== 'admin') throw err('admin_only'); return u; }

  /* ---------------------------------------------- small cleaners */
  function text(v, max) { if (v === null || v === undefined || typeof v === 'object') return ''; return String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, max); }
  function cdate(v) { return typeof v === 'string' && DATE_RE.test(v) ? v : ''; }
  function isNum(v) { return v !== null && v !== '' && v !== undefined && typeof v !== 'object' && isFinite(Number(v)); }
  function car(c, km) {
    c = c && typeof c === 'object' ? c : {};
    var o = { plate: text(c.plate, 30), make: text(c.make, 60), model: text(c.model, 60), year: text(c.year, 10), color: text(c.color, 40), vin: text(c.vin, 40) };
    if (km) o.km = text(c.km, 20);
    return o;
  }
  function pick(list, v, def) { return list.indexOf(v) >= 0 ? v : def; }
  function inter(list, v) { return Array.isArray(v) ? list.filter(function (x) { return v.map(String).indexOf(x) >= 0; }) : []; }

  /* ---------------------------------------------- photos */
  function usage() {
    var u = { pos: { used: 0, count: 0, limit: LIMITS.photos } };
    Object.keys(db.media).forEach(function (k) { u.pos.used += db.media[k].bytes; u.pos.count++; });
    return u;
  }
  function docMedia(doc) {
    var found = {};
    (function walk(v) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k]); });
      else if (typeof v === 'string' && v.length < 30 && MEDIA_RE.test(v)) found[v] = 1;
    })(doc);
    return Object.keys(found);
  }
  function inUse() {
    var used = {};
    Object.keys(db.docs).forEach(function (c) { all(c).forEach(function (d) { docMedia(d).forEach(function (m) { used[m] = 1; }); }); });
    return used;
  }
  function mediaKnown(doc) { docMedia(doc).forEach(function (m) { if (!db.media[m]) throw err('bad_image'); }); }
  function mediaDelete(names) {
    names.forEach(function (n) {
      if (!db.media[n]) return;
      delete db.media[n];
      if (urls[n]) { try { URL.revokeObjectURL(urls[n].full); if (urls[n].thumb) URL.revokeObjectURL(urls[n].thumb); } catch (e) { /* ignore */ } delete urls[n]; }
      if (idb) { try { var st = idb.transaction('m', 'readwrite').objectStore('m'); st.delete(n); st.delete(n + '.t'); } catch (e) { /* ignore */ } }
    });
  }
  function release(old, next) {
    if (!old) return;
    var keep = {}; (next ? docMedia(next) : []).forEach(function (m) { keep[m] = 1; });
    var gone = docMedia(old).filter(function (m) { return !keep[m]; });
    if (!gone.length) return;
    var used = inUse();
    mediaDelete(gone.filter(function (m) { return !used[m]; }));
  }
  function cleanPhotos(list, u) {
    if (!list) return [];
    if (!Array.isArray(list) || list.length > 500) throw err('bad_doc');
    var seen = {}, out = [];
    list.forEach(function (p) {
      if (!p || typeof p !== 'object') throw err('bad_doc');
      var id = String(p.id || '');
      if (!MEDIA_RE.test(id) || seen[id]) return;
      seen[id] = 1;
      out.push({ id: id, tag: pick(PHOTO_TAGS, p.tag, 'before'), note: text(p.note, 200), ts: parseInt(p.ts, 10) || now(), by: text(p.by, 80) || u.name });
    });
    return out;
  }
  function openIdb() {
    return new Promise(function (res) {
      try {
        var rq = indexedDB.open(IDB, 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('m'); };
        rq.onsuccess = function () { idb = rq.result; res(); };
        rq.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function loadUrls() {
    return new Promise(function (res) {
      if (!idb) return res();
      try {
        var rq = idb.transaction('m', 'readonly').objectStore('m').openCursor();
        rq.onsuccess = function () {
          var cur = rq.result;
          if (!cur) return res();
          var k = String(cur.key), base = k.replace(/\.t$/, ''), u = urls[base] || (urls[base] = {});
          u[/\.t$/.test(k) ? 'thumb' : 'full'] = URL.createObjectURL(cur.value);
          cur.continue();
        };
        rq.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function ready() {
    if (!readyP) readyP = openIdb().then(loadUrls).then(function () { load(); });
    return readyP;
  }
  function mediaUrl(id, thumb) {
    if (DEMO.media && DEMO.media[id]) return (window.ROOT || '') + DEMO.media[id];
    var u = urls[id];
    return u ? (thumb && u.thumb ? u.thumb : u.full || '') : '';
  }
  function b64Blob(b64, type) {
    var bin = atob(b64), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: type });
  }

  /* ---------------------------------------------- store */
  function product(id) { return col('products')[id] || null; }
  function counted(p) { return !!p && (p.kind || 'part') === 'part'; }
  function applyStock(items, sign) {
    (items || []).forEach(function (it) {
      if (!it.pid || it.kind !== 'part') return;
      var p = product(it.pid);
      if (!counted(p)) return;
      p.stock = r3(num(p.stock) + sign * num(it.q));
    });
  }
  function applyPurchase(lines, sign) {
    (lines || []).forEach(function (ln) {
      var p = product(String(ln.pid));
      if (!counted(p)) return;
      var q = num(ln.q), unit = num(ln.cost), have = num(p.stock);
      if (sign > 0) {
        p.cost = Math.round((have > 0 && num(p.cost) > 0 ? (have * num(p.cost) + q * unit) / (have + q) : unit) * 1e5) / 1e5;
        p.lastCost = Math.round(unit * 1e5) / 1e5;
      } else {
        var rest = have - q;
        if (rest > 0.0005) { var c = (have * num(p.cost) - q * unit) / rest; if (c > 0) p.cost = Math.round(c * 1e5) / 1e5; }
      }
      p.stock = r3(have + sign * q);
    });
  }
  function stockOf(items) {
    var out = {}, u = me(), cost = u && sees(u, 'cost');
    (items || []).forEach(function (it) {
      var pid = String(it.pid || '');
      if (!pid || out[pid]) return;
      var p = product(pid);
      if (!p) return;
      out[pid] = { stock: num(p.stock) };
      if (cost) { out[pid].cost = p.cost || 0; out[pid].lastCost = p.lastCost || 0; }
    });
    return out;
  }
  function cleanPays(pays) {
    if (!pays) return [];
    if (!Array.isArray(pays) || pays.length > 200) throw err('bad_doc');
    return pays.map(function (p) {
      if (!p || !isNum(p.amount) || Number(p.amount) <= 0 || METHODS.indexOf(String(p.method || '')) < 0) throw err('bad_doc');
      return { amount: r3(Number(p.amount)), method: String(p.method), date: cdate(p.date) || today(), by: text(p.by, 80), note: text(p.note, 120) };
    });
  }
  function paidSum(pays) { return r3(pays.reduce(function (t, p) { return t + Number(p.amount); }, 0)); }
  function cleanItems(items, u, oldItems) {
    if (!Array.isArray(items) || items.length > 300) throw err('bad_doc');
    var seeCost = can(u, 'cost');
    return items.map(function (it) {
      if (!it || typeof it !== 'object') throw err('bad_doc');
      var q = num(it.q), price = num(it.price);
      if (!isNum(it.q) || q <= 0 || q > 1e6 || !isNum(it.price) || price < 0 || price > 1e7) throw err('bad_doc');
      var pid = String(it.pid || '');
      if (pid && !ID_RE.test(pid)) throw err('bad_doc');
      var p = pid ? product(pid) : null;
      var kind = p ? ((p.kind || 'part') === 'service' ? 'service' : 'part') : 'manual';
      var row = { pid: p ? pid : '', kind: kind, n: text(it.n, 200), a: text(it.a, 200), unit: text(it.unit, 40), unitEn: text(it.unitEn, 40),
        grp: ['work', 'part', 'mat'].indexOf(it.grp) >= 0 ? it.grp : (kind === 'service' ? 'work' : 'part'), q: q, price: r3(price) };
      if (!row.n) row.n = p ? String(p.name || '') : '-';
      if (kind === 'part') row.cost = Math.round(num(p.cost) * 1e5) / 1e5;
      else if (kind === 'manual') {
        if (seeCost) row.cost = Math.round(Math.max(0, Math.min(1e7, num(it.cost))) * 1e5) / 1e5;
        else { var prev = 0; (oldItems || []).some(function (o) { if (o.kind === 'manual' && o.n === row.n) { prev = num(o.cost); return true; } return false; }); row.cost = prev; }
      } else row.cost = 0;
      return row;
    });
  }
  function checkInvoice(inp, u, old) {
    var doc = {};
    doc.items = cleanItems(inp.items, u, (old || {}).items || []);
    var sub = r3(doc.items.reduce(function (t, it) { return t + r3(it.price * it.q); }, 0));
    var disc = r3(Math.min(Math.max(num(inp.discount), 0), sub)), pct = num(inp.vatPct);
    if (pct < 0 || pct > 100) throw err('bad_doc');
    var vat = r3((sub - disc) * pct / 100), total = r3(sub - disc + vat), t = { sub: sub, discount: disc, vat: vat, total: total };
    Object.keys(t).forEach(function (k) { if (!isNum(inp[k]) || Math.abs(Number(inp[k]) - t[k]) > 0.002) throw err('bad_totals'); doc[k] = t[k]; });
    doc.vatPct = pct;
    doc.payments = cleanPays(inp.payments || []);
    if (paidSum(doc.payments) > total + 0.002) throw err('overpaid');
    doc.date = cdate(inp.date) || today();
    doc.time = /^\d{2}:\d{2}$/.test(String(inp.time || '')) ? String(inp.time) : C.nowTime();
    var cid = String(inp.customerId || '');
    doc.customerId = ID_RE.test(cid) ? cid : '';
    doc.customerName = text(inp.customerName, 120); doc.customerPhone = text(inp.customerPhone, 40); doc.customerVat = text(inp.customerVat, 40); doc.note = text(inp.note, 1000);
    // the garage part of a job card
    doc.car = car(inp.car, true);
    doc.svc = inter(SVC_TYPES, inp.svc);
    doc.source = pick(SOURCES, inp.source, '');
    doc.insCo = text(inp.insCo, 120); doc.claimNo = text(inp.claimNo, 60); doc.complaint = text(inp.complaint, 1500); doc.workNotes = text(inp.workNotes, 3000);
    doc.doneBy = text(inp.doneBy, 160); doc.expDate = cdate(inp.expDate); doc.timeIn = text(inp.timeIn, 20); doc.timeOut = text(inp.timeOut, 20);
    doc.status = pick(STAGES, inp.status, 'open');
    doc.deliveredAt = cdate(inp.deliveredAt);
    if (doc.status === 'delivered' && !doc.deliveredAt) doc.deliveredAt = today();
    doc.damage = inter(ZONES, inp.damage);
    var w = inp.warranty && typeof inp.warranty === 'object' ? inp.warranty : {};
    doc.warranty = { text: text(w.text, 300), from: cdate(w.from), to: cdate(w.to) };
    doc.photos = cleanPhotos(inp.photos || [], u);
    return doc;
  }
  function strip(inv) { inv = clone(inv); (inv.items || []).forEach(function (it) { delete it.cost; }); return inv; }
  function prefix() { var s = col('settings').main || {}; return (String(s.prefix || 'INV').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'INV').slice(0, 8); }
  function padNo(n, p) { return p + '-' + String(n).padStart(5, '0'); }
  function nextCounter(k) { db.meta[k] = (parseInt(db.meta[k], 10) || 0) + 1; return db.meta[k]; }

  /* runs one action; a failure leaves the saved data exactly as it was */
  function tx(fn) {
    var before = JSON.stringify(db);
    try { var r = fn(); save(); return r; } catch (e) { db = JSON.parse(before); throw e; }
  }

  /* ---------------------------------------------- the actions */
  var A = {
    brand: function () { var s = col('settings').main || {}; return { ok: true, brand: { name: s.name || '', nameAr: s.nameAr || '', logo: s.logo || '' } }; },
    status: function () { return { ok: true, setup_needed: !db.users.length, user: pub(me()), features: { staff_accounts: true, max_staff: LIMITS.max_staff }, demo: demoInfo() }; },
    setup: function () { throw err('already_setup'); },
    login: function (b) {
      var pw = String((b || {}).password || ''), u = pw ? db.users.filter(function (x) { return x.pw === pw; })[0] : null;
      if (!u) throw err('bad_login');
      db.session = u.id; save();
      return { ok: true, user: pub(u) };
    },
    logout: function () { db.session = null; save(); return { ok: true }; },
    load: function () {
      var u = needUser(), cost = sees(u, 'cost');
      var r = { ok: true, user: pub(u), features: { staff_accounts: true, max_staff: LIMITS.max_staff }, storage: usage(), counter: db.meta.counter || 0, settings: clone(col('settings').main || null), demo: demoInfo() };
      r.products = clone(all('products'));
      r.invoices = clone(all('invoices'));
      if (!cost) { r.products.forEach(function (p) { delete p.cost; delete p.lastCost; }); r.invoices = r.invoices.map(strip); }
      r.customers = clone(all('customers'));
      r.reminders = clone(all('reminders'));
      r.expenses = sees(u, 'expenses') || sees(u, 'reports') ? clone(all('expenses')) : [];
      if (!cost) r.expenses.forEach(function (x) { (x.items || []).forEach(function (ln) { delete ln.cost; }); });
      r.moves = sees(u, 'stock') ? clone(all('moves')) : [];
      r.claims = sees(u, 'insurance') || sees(u, 'reports') ? clone(all('claims')) : [];
      r.staff = db.users.filter(function (x) { return x.role === 'admin' || x.role === 'staff'; }).map(function (x) { return x.name; });
      return r;
    },
    poll: function () { needUser(); return { ok: true, storage: usage(), reminders: clone(all('reminders')), demo: demoInfo() }; },
    health: function () {
      var u = needUser(); if (u.role !== 'admin' && u.role !== 'viewer') throw err('admin_only');
      return { ok: true, kind: 'demo', dir: '', writable: true, db_bytes: (localStorage.getItem(KEY) || '').length * 2, php: '-', sqlite: '-', backups: 0, last_backup: null,
        invoices: all('invoices').length, products: all('products').length, media_writable: !!idb, storage: usage(), time: '' };
    },
    put: function (b) {
      var u = needUser(); if (u.role === 'viewer') throw err('read_only');
      var c = String(b.col || ''), rules = { settings: [], products: ['stock'], customers: ['customers', 'sell'], expenses: ['expenses'], reminders: PERMS, claims: ['insurance'] };
      if (!rules[c]) throw err('bad_collection');
      if (!(u.role === 'admin' || rules[c].some(function (p) { return can(u, p); }))) throw err('no_permission');
      var single = c === 'settings', doc = b.doc;
      if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw err('bad_doc');
      doc = clone(doc);
      if (!single) { doc.id = String(doc.id || ''); if (!ID_RE.test(doc.id)) throw err('bad_id'); }
      var id = single ? 'main' : doc.id;
      mediaKnown(doc);
      return tx(function () {
        var old = get(c, id);
        if (c === 'products') {
          var name = text(doc.name, 160); if (!name) throw err('missing_name');
          doc.name = name; doc.nameEn = text(doc.nameEn, 160); doc.kind = doc.kind === 'service' ? 'service' : 'part';
          doc.price = r3(Math.max(0, num(doc.price))); doc.unit = text(doc.unit, 40); doc.unitEn = text(doc.unitEn, 40); doc.sku = text(doc.sku, 40);
          if (doc.sku) all('products').forEach(function (o) { if (String(o.id) !== id && String(o.sku || '') === doc.sku) throw err('barcode_taken', { code: doc.sku, product: o.name }); });
          var seeCost = can(u, 'cost');
          if (old) {
            doc.stock = num(old.stock);
            if ((old.kind || 'part') !== doc.kind) doc.kind = old.kind || 'part';
            if (!seeCost) { doc.cost = old.cost || 0; doc.lastCost = old.lastCost || 0; } else { doc.cost = Math.round(Math.max(0, num(doc.cost)) * 1e5) / 1e5; doc.lastCost = old.lastCost !== undefined ? old.lastCost : doc.cost; }
            doc.created = old.created || now();
            var ch = [];
            if (Math.abs(num(old.price) - doc.price) > 0.0005) ch.push('price ' + num(old.price) + ' > ' + doc.price);
            if (Math.abs(num(old.cost) - num(doc.cost)) > 0.000005) ch.push('cost ' + num(old.cost) + ' > ' + num(doc.cost));
            if (old.name !== name) ch.push('name');
            if (ch.length) log('product_edit', name, ch.join(', '));
          } else {
            doc.stock = doc.kind === 'part' ? r3(Math.max(0, num(doc.stock))) : 0;
            doc.cost = seeCost ? Math.round(Math.max(0, num(doc.cost)) * 1e5) / 1e5 : 0;
            doc.lastCost = doc.cost; doc.created = now(); doc.createdBy = u.name;
            log(doc.kind === 'service' ? 'service_add' : 'product_add', name, doc.kind === 'part' ? 'stock ' + doc.stock : 'price ' + doc.price);
          }
          doc.minStock = r3(Math.max(0, num(doc.minStock)));
        }
        if (c === 'settings') { if (u.role !== 'admin') throw err('admin_only'); log('settings', '', ''); }
        if (c === 'expenses') {
          var seeC = can(u, 'cost'), lines = (Array.isArray(doc.items) ? doc.items : []).map(function (ln) {
            if (!ln || typeof ln !== 'object') throw err('bad_doc');
            var pid = String(ln.pid || ''), q = num(ln.q), cc = num(ln.cost), p = ID_RE.test(pid) ? product(pid) : null;
            if (!counted(p) || q <= 0 || q > 1e6 || cc < 0 || cc > 1e7) throw err('bad_doc');
            return { pid: pid, n: String(p.name || ''), unit: String(p.unit || ''), q: r3(q), cost: Math.round(cc * 1e5) / 1e5 };
          });
          if (lines.length > 200) throw err('bad_doc');
          if (lines.length && !seeC) throw err('no_permission');
          if (lines.length) { var sum = r3(lines.reduce(function (t, ln) { return t + r3(ln.q * ln.cost); }, 0)); doc.amount = r3(num(doc.amount)); if (Math.abs(doc.amount - sum) > 0.002) throw err('bad_totals'); }
          if (num(doc.amount) <= 0) throw err('bad_doc');
          doc.items = lines; doc.amount = r3(num(doc.amount)); doc.cat = text(doc.cat, 60); doc.title = text(doc.title, 200); doc.supplier = text(doc.supplier, 120); doc.ref = text(doc.ref, 60);
          doc.date = cdate(doc.date) || today(); doc.paid = !('paid' in doc) || !!doc.paid; doc.method = pick(METHODS, doc.method, 'cash'); doc.due = cdate(doc.due); doc.paidOn = cdate(doc.paidOn);
          if (old) { applyPurchase(old.items || [], -1); doc.createdBy = old.createdBy || u.name; doc.created = old.created || now(); log('expense_edit', doc.title || doc.cat, num(old.amount) + ' > ' + doc.amount); }
          else { doc.createdBy = u.name; doc.created = now(); if (lines.length) log('purchase_add', doc.supplier || doc.cat, String(doc.amount)); }
          applyPurchase(lines, +1);
        }
        if (c === 'claims') {
          doc.company = text(doc.company, 120); if (!doc.company) throw err('missing_company');
          var mx = { claimNo: 60, policyNo: 60, surveyor: 120, surveyorPhone: 40, customerName: 120, customerPhone: 40, location: 200, desc: 3000 };
          Object.keys(mx).forEach(function (k) { doc[k] = text(doc[k], mx[k]); });
          ['accidentDate', 'sentOn', 'approvedOn'].forEach(function (k) { doc[k] = cdate(doc[k]); });
          ['estimate', 'approved', 'excess'].forEach(function (k) { doc[k] = r3(Math.max(0, Math.min(1e7, num(doc[k])))); });
          doc.status = pick(CLAIM_ST, doc.status, 'new'); doc.car = car(doc.car, false);
          var iid = String(doc.invoiceId || ''); doc.invoiceId = ID_RE.test(iid) && col('invoices')[iid] ? iid : '';
          doc.photos = cleanPhotos(doc.photos || [], u); doc.payments = cleanPays(doc.payments || []);
          if (doc.approved > 0 && paidSum(doc.payments) > doc.approved + 0.002) throw err('overpaid');
          if (old) {
            doc.notes = old.notes || []; doc.no = old.no || 0; doc.number = old.number || ''; doc.created = old.created || now(); doc.createdBy = old.createdBy || u.name;
            if ((old.status || '') !== doc.status) { doc.notes.push({ ts: now(), by: u.name, text: '', status: doc.status }); log('claim_status', doc.number, (old.status || '') + ' > ' + doc.status); }
          } else {
            var n = nextCounter('ccounter'); doc.no = n; doc.number = padNo(n, 'INS'); doc.created = now(); doc.createdBy = u.name;
            doc.notes = [{ ts: now(), by: u.name, text: text(doc.firstNote, 2000), status: doc.status }];
            log('claim_add', doc.number, doc.company);
          }
          delete doc.firstNote; doc.updated = now();
        }
        if (c === 'reminders') {
          doc.text = text(doc.text, 500); if (!doc.text) throw err('missing_text');
          doc.showOn = cdate(doc.showOn) || today(); doc.phone = text(doc.phone, 40); doc.who = text(doc.who, 120); doc.plate = text(doc.plate, 30); doc.msg = text(doc.msg, 1000); doc.done = !!doc.done;
          doc.by = old ? old.by || u.name : u.name; doc.created = old ? old.created || now() : now();
        }
        if (c === 'customers') {
          doc.name = text(doc.name, 120); if (!doc.name) throw err('missing_name');
          doc.cars = (Array.isArray(doc.cars) ? doc.cars : []).slice(0, 60).map(function (x) { return car(x, false); }).filter(function (x) { return Object.keys(x).some(function (k) { return x[k]; }); });
        }
        put(c, doc);
        release(old, doc);
        var res = clone(doc);
        if (c === 'products' && !sees(u, 'cost')) { delete res.cost; delete res.lastCost; }
        return { ok: true, doc: res, storage: usage(), stock: c === 'expenses' ? stockOf((doc.items || []).concat((old || {}).items || [])) : null };
      });
    },
    del: function (b) {
      var u = needUser(); if (u.role === 'viewer') throw err('read_only');
      var c = String(b.col || ''), rules = { products: ['stock'], customers: [], expenses: ['expenses'], reminders: PERMS, claims: [], moves: [] };
      if (!rules[c]) throw err('bad_collection');
      if (!(u.role === 'admin' || rules[c].some(function (p) { return can(u, p); }))) throw err('no_permission');
      var ids = Array.isArray(b.ids) ? b.ids : [b.id];
      ids.forEach(function (id) { if (typeof id !== 'string' || !ID_RE.test(id)) throw err('bad_id'); });
      return tx(function () {
        var touched = [];
        ids.forEach(function (id) {
          var old = get(c, id); if (!old) return;
          if (c === 'expenses' && (old.items || []).length) { applyPurchase(old.items, -1); touched = touched.concat(old.items); }
          delete col(c)[id];
          release(old, null);
          if (c === 'products') log('product_del', old.name, 'stock ' + num(old.stock));
          if (c === 'expenses') log('expense_del', old.title || old.cat, String(num(old.amount)));
          if (c === 'claims') log('claim_del', old.number, old.company);
        });
        return { ok: true, storage: usage(), stock: touched.length ? stockOf(touched) : null };
      });
    },
    claim_note: function (b) {
      var u = needPerm('insurance'), id = String(b.id || ''), t = text(b.text, 2000);
      if (!ID_RE.test(id) || !t) throw err('missing_text');
      return tx(function () {
        var cdoc = col('claims')[id]; if (!cdoc) throw err('not_found');
        cdoc.notes = cdoc.notes || []; cdoc.notes.push({ ts: now(), by: u.name, text: t }); cdoc.updated = now();
        return { ok: true, doc: clone(cdoc) };
      });
    },
    create_invoice: function (b) {
      var u = needPerm('sell'), inp = b.doc;
      if (!inp || typeof inp !== 'object') throw err('bad_doc');
      mediaKnown(inp);
      var key = typeof inp.clientKey === 'string' ? inp.clientKey : '';
      if (key && db.meta.idem && db.meta.idem[key] && col('invoices')[db.meta.idem[key]]) {
        var prev = get('invoices', db.meta.idem[key]);
        return { ok: true, doc: sees(u, 'cost') ? prev : strip(prev), counter: db.meta.counter, duplicate: true, stock: stockOf(prev.items), storage: usage(), demo: demoInfo() };
      }
      if (made() >= LIMITS.bills) throw err('demo_limit', { demo: demoInfo() });          // THE DEMO LIMIT
      var res = tx(function () {
        var doc = checkInvoice(inp, u);
        if (!can(u, 'discount') && doc.discount > 0) throw err('no_permission');
        if (!doc.customerId && !doc.customerName && paidSum(doc.payments) < doc.total - 0.002) throw err('credit_needs_customer');
        var n = nextCounter('counter');
        doc.no = n; doc.id = String(n); doc.number = padNo(n, prefix()); doc.created = now(); doc.createdBy = u.name; doc.void = false; doc.mine = true;
        doc.payments.forEach(function (p) { if (!p.by) p.by = u.name; });
        doc.history = [{ ts: now(), by: u.name, status: doc.status }];
        applyStock(doc.items, -1);
        put('invoices', doc);
        if (key) { db.meta.idem = db.meta.idem || {}; db.meta.idem[key] = doc.id; }
        return doc;
      });
      setMade(made() + 1);
      return { ok: true, doc: sees(u, 'cost') ? clone(res) : strip(res), counter: db.meta.counter, duplicate: false, stock: stockOf(res.items), storage: usage(), demo: demoInfo() };
    },
    update_invoice: function (b) {
      var u = needPerm('sell', 'edit_inv'), inp = b.doc, id = inp && typeof inp === 'object' ? String(inp.id || '') : '';
      if (!ID_RE.test(id)) throw err('bad_id');
      mediaKnown(inp);
      return tx(function () {
        var old = get('invoices', id); if (!old) throw err('not_found');
        if (old.void) throw err('is_void');
        if (!can(u, 'edit_inv') && old.status === 'delivered') throw err('no_permission');
        applyStock(old.items || [], +1);
        var doc = checkInvoice(inp, u, old);
        if (!can(u, 'discount') && doc.discount > num(old.discount) + 0.0005) throw err('no_permission');
        applyStock(doc.items, -1);
        ['id', 'no', 'number', 'created', 'createdBy', 'mine'].forEach(function (k) { if (k in old) doc[k] = old[k]; });
        doc.void = false;
        doc.history = old.history || [];
        if ((old.status || '') !== doc.status) doc.history.push({ ts: now(), by: u.name, status: doc.status });
        doc.history = doc.history.slice(-40);
        var edits = Array.isArray(old.edits) ? old.edits : [], sig = function (l) { return JSON.stringify((l || []).map(function (i) { return [i.n, i.q, i.price]; })); };
        if (Math.abs(num(old.total) - doc.total) > 0.0005 || sig(old.items) !== sig(doc.items)) { edits.push({ ts: now(), by: u.name, from: num(old.total), to: doc.total }); log('invoice_edit', doc.number, num(old.total) + ' > ' + doc.total); }
        doc.edits = edits.slice(-30);
        put('invoices', doc);
        release(old, doc);
        return { ok: true, doc: sees(u, 'cost') ? clone(doc) : strip(doc), stock: stockOf(doc.items.concat(old.items || [])), storage: usage() };
      });
    },
    void_invoice: function (b) {
      var u = needPerm('edit_inv'), id = String(b.id || '');
      if (!ID_RE.test(id)) throw err('bad_id');
      return tx(function () {
        var d = col('invoices')[id]; if (!d) throw err('not_found');
        if (!d.void) {
          applyStock(d.items || [], +1);
          d.void = true; d.voidedAt = now(); d.voidedBy = u.name; d.voidReason = text(b.reason, 200);
          log('invoice_void', d.number, String(num(d.total)));
        }
        return { ok: true, doc: sees(u, 'cost') ? clone(d) : strip(d), stock: stockOf(d.items) };
      });
    },
    invoice_touch: function (b) {
      var u = needPerm('sell', 'edit_inv'), id = String(b.id || '');
      if (!ID_RE.test(id)) throw err('bad_id');
      if (b.photos !== undefined) mediaKnown({ p: b.photos });
      return tx(function () {
        var old = get('invoices', id); if (!old) throw err('not_found');
        var d = clone(old);
        if (b.payment !== undefined) {
          if (d.void) throw err('is_void');
          var pay = cleanPays([b.payment])[0]; pay.by = u.name; d.payments.push(pay);
          if (paidSum(d.payments) > num(d.total) + 0.002) throw err('overpaid');
        }
        if (b.phone !== undefined) {
          var ph = String(b.phone).trim();
          if (!/^[0-9+\-() ٠-٩۰-۹]{0,40}$/.test(ph)) throw err('bad_phone');
          d.customerPhone = ph;
        }
        if (b.status !== undefined) {
          if (d.void) throw err('is_void');
          var s = String(b.status); if (STAGES.indexOf(s) < 0) throw err('bad_doc');
          if (d.status !== s) {
            d.status = s; d.history = (d.history || []).concat([{ ts: now(), by: u.name, status: s }]).slice(-40);
            if (s === 'delivered') { d.deliveredAt = cdate(b.deliveredAt) || today(); d.timeOut = text(b.timeOut, 20) || C.nowTime(); } else d.deliveredAt = '';
          }
        }
        if (b.photos !== undefined) d.photos = cleanPhotos(b.photos, u);
        if (b.workNotes !== undefined) d.workNotes = text(b.workNotes, 3000);
        if (b.damage !== undefined) d.damage = inter(ZONES, b.damage);
        put('invoices', d);
        release(old, d);
        return { ok: true, doc: sees(u, 'cost') ? clone(d) : strip(d), storage: usage() };
      });
    },
    del_invoices: function (b) {
      needAdmin();
      var ids = b.ids;
      if (!Array.isArray(ids) || !ids.length || ids.length > 1000) throw err('bad_id');
      ids.forEach(function (id) { if (typeof id !== 'string' || !ID_RE.test(id)) throw err('bad_id'); });
      return tx(function () {
        var items = [];
        ids.forEach(function (id) {
          var old = get('invoices', id); if (!old) return;
          if (!old.void) { applyStock(old.items || [], +1); items = items.concat(old.items || []); }
          delete col('invoices')[id];
          release(old, null);
          log('invoice_del', old.number || id, String(num(old.total)));
        });
        return { ok: true, deleted: ids.length, stock: stockOf(items), storage: usage() };
      });
    },
    stock_move: function (b) {
      var u = needPerm('stock'), pid = String(b.pid || ''), type = String(b.type || '');
      if (!ID_RE.test(pid) || ['add', 'use', 'count'].indexOf(type) < 0) throw err('bad_doc');
      var qty = num(b.qty);
      if (!isNum(b.qty) || qty < 0 || qty > 1e7 || (type !== 'count' && qty <= 0)) throw err('bad_doc');
      return tx(function () {
        var p = product(pid); if (!counted(p)) throw err('not_found');
        var before = num(p.stock);
        p.stock = type === 'add' ? r3(before + qty) : type === 'use' ? r3(before - qty) : r3(qty);
        var mv = { id: C.uid(), ts: now(), pid: pid, name: p.name || '', unit: p.unit || '', type: type, qty: qty, before: before, after: p.stock, reason: text(b.reason, 200), job: text(b.job, 40), by: u.name };
        put('moves', mv);
        log('stock_' + type, p.name, before + ' > ' + p.stock);
        return { ok: true, move: clone(mv), stock: stockOf([{ pid: pid }]) };
      });
    },
    storage: function () { needUser(); return { ok: true, storage: usage() }; },
    log: function () { var u = needUser(); if (u.role !== 'admin' && u.role !== 'viewer') throw err('admin_only'); return { ok: true, log: clone(db.log) }; },
    restore: function (b) {
      var u = needAdmin(), data = b.data;
      if (!data || !Array.isArray(data.invoices) || !Array.isArray(data.products)) throw err('bad_backup');
      return tx(function () {
        ['settings', 'products', 'customers', 'invoices', 'expenses', 'reminders', 'moves', 'claims'].forEach(function (c) {
          if (c === 'settings') { if (data.settings && typeof data.settings === 'object') db.docs.settings = { main: clone(data.settings) }; return; }
          if (!(c in data)) return;
          db.docs[c] = {};
          (data[c] || []).forEach(function (d) { if (d && ID_RE.test(String(d.id || ''))) col(c)[String(d.id)] = clone(d); });
        });
        var maxNo = 0; data.invoices.forEach(function (d) { maxNo = Math.max(maxNo, parseInt(d.no, 10) || 0); });
        var maxC = 0; (data.claims || []).forEach(function (d) { maxC = Math.max(maxC, parseInt(d.no, 10) || 0); });
        db.meta.counter = Math.max(parseInt(data.counter, 10) || 0, maxNo, db.meta.counter || 0);
        db.meta.ccounter = Math.max(maxC, db.meta.ccounter || 0);
        log('restore', '', data.invoices.length + ' invoices');
        return { ok: true, user: pub(u) };
      });
    },
    users: function () {
      var u = needUser(); if (u.role !== 'admin' && u.role !== 'viewer') throw err('admin_only');
      return { ok: true, users: db.users.map(pub), max_staff: LIMITS.max_staff };
    },
    user_add: function (b) {
      needAdmin();
      var name = String(b.name || '').trim(), pass = String(b.password || '');
      if (!name) throw err('missing_name');
      if (pass.length < 8) throw err('password_short');
      if (db.users.some(function (x) { return x.pw === pass; })) throw err('password_taken');
      if (db.users.filter(function (x) { return x.role === 'staff' || x.role === 'admin'; }).length - 1 >= LIMITS.max_staff) throw err('staff_limit');
      var role = b.role === 'admin' ? 'admin' : 'staff';
      return tx(function () {
        var id = db.users.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1;
        db.users.push({ id: id, username: 'user-' + id, name: name.slice(0, 80), role: role, perms: role === 'admin' ? [] : inter(PERMS, b.perms), pw: pass });
        log('user_add', name, role);
        return { ok: true };
      });
    },
    user_update: function (b) {
      needAdmin();
      var t = db.users.filter(function (x) { return x.id === parseInt(b.id, 10); })[0];
      if (!t) throw err('not_found');
      if (t.role !== 'staff' && t.role !== 'admin') throw err('protected_account');
      return tx(function () {
        var name = String(b.name || '').trim();
        if (name) t.name = name.slice(0, 80);
        t.perms = t.role === 'admin' ? [] : inter(PERMS, b.perms);
        log('user_perms', t.name, t.perms.join(','));
        return { ok: true };
      });
    },
    user_del: function (b) {
      var m = needAdmin(), id = parseInt(b.id, 10), t = db.users.filter(function (x) { return x.id === id; })[0];
      if (!t) throw err('not_found');
      if (id === m.id) throw err('cannot_delete_self');
      if (t.role !== 'staff' && t.role !== 'admin') throw err('protected_account');
      if (t.role === 'admin' && db.users.filter(function (x) { return x.role === 'admin'; }).length < 2) throw err('protected_account');
      return tx(function () { db.users = db.users.filter(function (x) { return x.id !== id; }); log('user_del', t.name, ''); return { ok: true }; });
    },
    user_password: function (b) {
      var m = needUser(), pass = String(b.password || '');
      if (pass.length < 8) throw err('password_short');
      var target = b.id !== undefined ? parseInt(b.id, 10) : m.id, t;
      if (target !== m.id) {
        needAdmin();
        t = db.users.filter(function (x) { return x.id === target; })[0];
        if (!t) throw err('not_found');
        if (t.role !== 'staff' && t.role !== 'admin') throw err('protected_account');
      } else {
        if (m.role === 'viewer') throw err('read_only');
        if (String(b.old || '') !== m.pw) throw err('bad_login');
        t = m;
      }
      if (db.users.some(function (x) { return x.id !== target && x.pw === pass; })) throw err('password_taken');
      return tx(function () { t.pw = pass; return { ok: true }; });
    },
    media_upload: function (b) {
      needPerm('sell', 'edit_inv', 'stock', 'insurance');
      var data = String(b.data || ''), thumb = b.thumb ? String(b.thumb) : '';
      if (!data || data.length > 700 * 1024 * 1.4 + 64) throw err(data ? 'image_too_large' : 'bad_image');
      var head = atob(data.slice(0, 24)), type = head.indexOf('WEBP') >= 0 ? 'image/webp' : head.charCodeAt(0) === 0x89 ? 'image/png' : 'image/jpeg';
      var ext = type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg';
      var full = b64Blob(data, type), small = thumb ? b64Blob(thumb, type) : null, bytes = full.size + (small ? small.size : 0);
      var st = usage().pos;
      if (st.used + bytes > st.limit) throw err('storage_full');
      var a = new Uint8Array(10); crypto.getRandomValues(a);
      var name = [].map.call(a, function (x) { return x.toString(16).padStart(2, '0'); }).join('') + '.' + ext;
      return new Promise(function (res, rej) {
        var done = function () {
          db.media[name] = { bytes: bytes, created: now() };
          urls[name] = { full: URL.createObjectURL(full), thumb: small ? URL.createObjectURL(small) : '' };
          try { save(); } catch (e) { return rej(e); }
          res({ ok: true, id: name, bytes: bytes, storage: usage() });
        };
        if (!idb) return done();
        try {
          var t = idb.transaction('m', 'readwrite'), os = t.objectStore('m');
          os.put(full, name); if (small) os.put(small, name + '.t');
          t.oncomplete = done; t.onerror = function () { rej(err('storage_browser')); };
        } catch (e) { done(); }
      });
    },
    media_del: function (b) {
      needPerm('sell', 'edit_inv', 'stock', 'insurance');
      var used = inUse();
      mediaDelete((Array.isArray(b.ids) ? b.ids.slice(0, 200) : []).filter(function (m) { return typeof m === 'string' && !used[m]; }));
      save();
      return { ok: true, storage: usage() };
    }
  };

  function demoInfo() { var m = made(); return { limit: LIMITS.bills, made: m, left: Math.max(0, LIMITS.bills - m) }; }

  /* -> Promise of the same JSON the real server answers with. Errors carry .code like the real ones. */
  function handle(action, body) {
    return ready().then(function () {
      var fn = A[action];
      if (!fn) throw err('unknown_action');
      return fn(body || {});
    }).then(function (r) { return clone(r); });
  }
  /* "Reset demo": the example data comes back; the bills already made still count towards the limit */
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    return new Promise(function (res) {
      try { if (idb) idb.close(); var rq = indexedDB.deleteDatabase(IDB); rq.onsuccess = rq.onerror = rq.onblocked = function () { res(); }; } catch (e) { res(); }
    });
  }

  window.LocalBackend = { handle: handle, ready: ready, mediaUrl: mediaUrl, reset: reset, info: demoInfo };
})();
