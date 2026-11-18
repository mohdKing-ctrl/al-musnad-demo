/* alerts.js - "Alerts & reminders".
   The owner's own reminders: a text, and WHEN it should appear (today, after a week, a month, 3 months, 6 months or a
   chosen date). From that day it shows here, in the bell at the top, and in a window as soon as the system is opened,
   until it is marked done or put off. A reminder may carry a customer's number and a message (for example "time for your
   car's oil change"), sent on WhatsApp with one press. A job card makes such a service reminder in two taps.
   Automatic alerts: cars whose delivery date has passed, cars ready but not collected, store items low or out, customers
   who owe, expenses due, insurance cases waiting. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, P = C.Prod, Calc = C.Calc, num = C.num, f3 = C.f3;
  var rroot = null;

  function due() { var t = C.today(); return S.reminders.filter(function (r) { return !r.done && (r.showOn || '') <= t; }).sort(function (a, b) { return String(a.showOn).localeCompare(String(b.showOn)); }); }
  function upcoming() { var t = C.today(); return S.reminders.filter(function (r) { return !r.done && (r.showOn || '') > t; }).sort(function (a, b) { return String(a.showOn).localeCompare(String(b.showOn)); }); }
  function custDebts() {
    var by = {};
    S.invoices.forEach(function (i) {
      var b = Calc.balance(i); if (b <= 0.0004) return;
      var k = i.customerId || C.norm(i.customerName) || i.id;
      by[k] = by[k] || { name: i.customerName || '-', phone: i.customerPhone || '', due: 0, n: 0 };
      by[k].due = C.r3(by[k].due + b); by[k].n++;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.due - a.due; });
  }
  function auto() {
    var t = C.today(), live = S.invoices.filter(function (i) { return !i.void; });
    return {
      late: live.filter(function (i) { return i.status !== 'delivered' && i.expDate && i.expDate < t; }),
      ready: live.filter(function (i) { return i.status === 'ready'; }),
      out: S.products.filter(function (p) { return p.kind === 'part' && !p.archived && P.out(p); }),
      low: S.products.filter(function (p) { return p.kind === 'part' && !p.archived && !P.out(p) && P.low(p); }),
      debts: custDebts(),
      bills: Store.sees('expenses') ? S.expenses.filter(function (x) { return x.paid === false; }).sort(function (a, b) { return String(a.due || '9999').localeCompare(String(b.due || '9999')); }) : [],
      claims: Store.sees('insurance') ? S.claims.filter(function (c) {
        if (c.status === 'sent' && c.sentOn && c.sentOn <= C.addDays(t, -7)) return true;              // estimate sent a week ago, no answer yet
        if ((c.status === 'done' || c.status === 'approved' || c.status === 'repair') && num(c.approved) > 0 && Insurance.received(c) < num(c.approved) - 0.0005 && c.status === 'done') return true;   // repaired, not paid yet
        return false;
      }) : []
    };
  }
  /* the number in the bell and next to "Alerts" in the menu */
  function count() {
    var a = auto(), t = C.today();
    return due().length + a.late.length + a.out.length + a.low.length + a.bills.filter(function (x) { return !x.due || x.due <= C.addDays(t, 7); }).length + a.claims.length;
  }

  /* ------------------------------------------------ the reminder form (also the service reminder from a job card) */
  var WHEN = [['0d', L('اليوم', 'Today')], ['1w', L('بعد أسبوع', 'In a week')], ['1m', L('بعد شهر', 'In a month')], ['3m', L('بعد 3 أشهر', 'In 3 months')], ['6m', L('بعد 6 أشهر', 'In 6 months')], ['1y', L('بعد سنة', 'In a year')]];
  function whenDate(k) { var t = C.today(); return k === '0d' ? t : k === '1w' ? C.addDays(t, 7) : k === '1m' ? C.addMonths(t, 1) : k === '3m' ? C.addMonths(t, 3) : k === '6m' ? C.addMonths(t, 6) : C.addMonths(t, 12); }
  function form(r, pre) {
    pre = pre || {};
    var x = r || {}, showOn = x.showOn || pre.showOn || C.today();
    var m = C.modal({ title: icon('bell') + ' ' + (r ? L('تعديل التذكير', 'Edit reminder') : L('تذكير جديد', 'New reminder')), size: 'md',
      body: '<div class="col"><div class="field"><label>' + L('التذكير *', 'Reminder *') + '</label><textarea class="input" id="rf-t" rows="2" maxlength="500" placeholder="' + L('مثال: طلب مواد صبغ / الاتصال بشركة التأمين / موعد سيارة', 'e.g. order paint / call the insurance company / a car appointment') + '">' + esc(x.text || pre.text || '') + '</textarea></div>' +
        '<div class="field"><label>' + L('متى يظهر لك؟', 'When should it appear?') + '</label><div class="chips wrap" id="rf-w">' + WHEN.map(function (w) { return '<button type="button" class="chip' + (whenDate(w[0]) === showOn ? ' on' : '') + '" data-w="' + w[0] + '">' + w[1] + '</button>'; }).join('') + '</div>' +
        '<div class="row mt-s"><span class="small muted">' + L('أو في تاريخ:', 'or on:') + '</span><input class="input" type="date" id="rf-d" style="width:auto" value="' + esc(showOn) + '"></div><span class="hint">' + L('يظهر في التنبيهات وفي نافذة عند فتح النظام ابتداءً من هذا اليوم.', 'From that day it shows in Alerts and in a window when the system is opened.') + '</span></div>' +
        '<div class="section-block"><h4>' + icon('whatsapp', 18) + L('لعميل (اختياري)', 'For a customer (optional)') + '</h4><div class="grid g2 keep"><div class="field"><label>' + L('العميل', 'Customer') + '</label><input class="input" id="rf-who" maxlength="120" value="' + esc(x.who || pre.who || '') + '"></div><div class="field"><label>' + L('رقمه', 'His number') + '</label><input class="input ltr" id="rf-ph" inputmode="tel" maxlength="40" value="' + esc(x.phone || pre.phone || '') + '"></div></div>' +
        '<div class="field"><label>' + L('رقم اللوحة', 'Plate no.') + '</label><input class="input ltr" id="rf-pl" maxlength="30" value="' + esc(x.plate || pre.plate || '') + '"></div>' +
        '<div class="field"><label>' + L('رسالة واتساب جاهزة للعميل', 'A ready WhatsApp message for the customer') + '</label><textarea class="input" id="rf-msg" rows="4" maxlength="1000">' + esc(x.msg || pre.msg || '') + '</textarea></div></div></div>',
      foot: '<button type="button" class="btn primary lg" id="rf-ok">' + icon('check') + L('حفظ التذكير', 'Save reminder') + '</button>' });
    var q = function (s) { return m.el.querySelector(s); };
    q('#rf-w').onclick = function (e) { var b = e.target.closest('[data-w]'); if (!b) return; q('#rf-d').value = whenDate(b.getAttribute('data-w')); [].forEach.call(this.children, function (c) { c.classList.toggle('on', c === b); }); };
    q('#rf-d').onchange = function () { [].forEach.call(q('#rf-w').children, function (c) { c.classList.remove('on'); }); };
    q('#rf-ok').onclick = function () {
      var text = q('#rf-t').value.trim();
      if (!text) return C.toast(L('اكتب التذكير', 'Type the reminder'), 'warn');
      var doc = Object.assign({}, x, { id: x.id || C.uid(), text: text, showOn: q('#rf-d').value || C.today(), who: q('#rf-who').value.trim(), phone: q('#rf-ph').value.trim(), plate: q('#rf-pl').value.trim(), msg: q('#rf-msg').value.trim(), invoiceId: x.invoiceId || pre.invoiceId || '', done: false });
      C.busy(q('#rf-ok'), Store.saveReminder(doc)).then(function () {
        m.close(); C.toast(L('تم حفظ التذكير، يظهر في ', 'Reminder saved; it appears on ') + C.fdate(doc.showOn));
        Shell.refreshNav(); if (rroot && rroot.isConnected) draw();
      }, function () {});
    };
  }
  /* from a job card: "remind this customer about his next service" */
  function serviceReminder(inv) {
    var s = S.settings, car = inv.car || {}, ar = C.lang === 'ar', carT = [car.make, car.model].filter(Boolean).join(' ');
    form(null, {
      text: L('تذكير صيانة: ', 'Service reminder: ') + (inv.customerName || '') + (carT ? ' - ' + carT : '') + (car.plate ? ' (' + car.plate + ')' : ''),
      who: inv.customerName, phone: inv.customerPhone, plate: car.plate, invoiceId: inv.id, showOn: C.addMonths(C.today(), 3),
      msg: ar ? 'مرحباً ' + (inv.customerName || '') + '،\nنذكّرك بموعد صيانة سيارتك ' + carT + (car.plate ? ' (لوحة ' + car.plate + ')' : '') + '.\nيسعدنا استقبالك في ' + (s.nameAr || s.name) + '.\nللحجز: ' + s.phone
        : 'Hello ' + (inv.customerName || '') + ',\nThis is a reminder that your car ' + carT + (car.plate ? ' (plate ' + car.plate + ')' : '') + ' is due for its service.\nWe look forward to seeing you at ' + s.name + '.\nTo book: ' + s.phone
    });
  }

  function remRow(r, isDue) {
    return '<div class="rem' + (isDue ? ' due' : '') + '" data-rid="' + esc(r.id) + '"><div class="grow"><b>' + esc(r.text) + '</b>' +
      '<div class="small muted">' + (isDue ? '<span class="badge warn">' + icon('bell', 12) + ' ' + (r.showOn < C.today() ? L('منذ ', 'since ') : '') + C.fdate(r.showOn) + '</span>' : '<span class="badge">' + L('يظهر في ', 'shows on ') + C.fdate(r.showOn) + '</span>') +
      (r.who ? ' · ' + esc(r.who) : '') + (r.phone ? ' · <span class="ltr">' + esc(r.phone) + '</span>' : '') + (r.plate ? ' · <span class="ltr">' + esc(r.plate) + '</span>' : '') + ' · ' + esc(r.by || '') + '</div></div>' +
      '<div class="row wrap rem-acts">' + (r.phone ? '<button type="button" class="btn sm wa" data-rwa title="WhatsApp">' + icon('whatsapp', 16) + L('أرسل', 'Send') + '</button>' : '') +
      (isDue ? '<button type="button" class="btn sm ghost" data-rlater>' + icon('clock', 16) + L('أجّل', 'Later') + '</button>' : '') +
      '<button type="button" class="btn sm soft" data-rdone>' + icon('check', 16) + L('تم', 'Done') + '</button>' +
      '<button type="button" class="icon-btn sm" data-redit>' + icon('edit', 17) + '</button><button type="button" class="icon-btn sm red" data-rdel>' + icon('trash', 17) + '</button></div></div>';
  }
  function draw() {
    var a = auto(), d = due(), u = upcoming(), t = C.today();
    var block = function (title, ic, cls, rows, empty) { return '<div class="card"><h3>' + icon(ic) + title + ' <span class="badge ' + cls + '">' + rows.length + '</span></h3>' + (rows.length ? '<div class="col" style="gap:6px">' + rows.slice(0, 30).join('') + '</div>' + (rows.length > 30 ? '<p class="small muted mt">+' + (rows.length - 30) + '</p>' : '') : '<p class="muted small">' + empty + '</p>') + '</div>'; };
    var carRow = function (i, extra) { return '<button type="button" class="inv-card" data-job="' + esc(i.id) + '" style="padding:9px"><span class="grow"><b class="ltr">' + esc(i.car.plate || i.number) + '</b> ' + esc([i.car.make, i.car.model].filter(Boolean).join(' ')) + '<br><span class="meta">' + esc(i.customerName || '') + ' · ' + extra + '</span></span>' + icon(C.lang === 'ar' ? 'back' : 'next', 18) + '</button>'; };
    var prow = function (p, extra) { return '<button type="button" class="inv-card" data-item="' + esc(p.id) + '" style="padding:8px">' + Media.thumb(p.img, P.name(p), '#167f72') + '<span class="grow"><span class="nm">' + esc(P.name(p)) + '</span><br><span class="meta">' + extra + '</span></span></button>'; };
    rroot.innerHTML = '<div class="card mb"><div class="row between wrap mb"><h3 style="margin:0">' + icon('bell') + L('تذكيراتي', 'My reminders') + '</h3>' + (Store.isViewer() ? '' : '<button type="button" class="btn primary" id="r-new">' + icon('plus') + L('تذكير جديد', 'New reminder') + '</button>') + '</div>' +
      (d.length ? '<h4 class="small muted mb">' + L('حان وقتها', 'Due now') + '</h4><div class="col" style="gap:8px">' + d.map(function (r) { return remRow(r, true); }).join('') + '</div>' : '<p class="muted small">' + L('لا توجد تذكيرات حان وقتها.', 'No reminders due now.') + '</p>') +
      (u.length ? '<h4 class="small muted mt mb">' + L('قادمة', 'Coming up') + '</h4><div class="col" style="gap:8px">' + u.slice(0, 50).map(function (r) { return remRow(r, false); }).join('') + '</div>' : '') + '</div>' +
      '<div class="grid g2">' +
      block(L('سيارات تأخر موعد تسليمها', 'Cars past their delivery date'), 'clock', 'bad', a.late.map(function (i) { return carRow(i, L('الموعد كان ', 'was due ') + C.fdate(i.expDate) + ' · ' + esc(C.stageName(i.status))); }), L('لا توجد سيارات متأخرة.', 'No late cars.')) +
      block(L('جاهزة ولم تُستلم', 'Ready, not collected'), 'check', 'ok', a.ready.map(function (i) { return carRow(i, (i.customerPhone ? '<span class="ltr">' + esc(i.customerPhone) + '</span>' : '') + (Calc.balance(i) > 0 ? ' · ' + L('عليه ', 'owes ') + f3(Calc.balance(i)) : '')); }), L('لا توجد سيارات تنتظر الاستلام.', 'No cars waiting to be collected.')) +
      block(L('أصناف نافدة من المخزن', 'Out of stock'), 'alert', 'bad', a.out.map(function (p) { return prow(p, L('الكمية: ', 'Quantity: ') + C.qf(p.stock) + (p.supplier ? ' · ' + esc(p.supplier) : '')); }), L('لا توجد أصناف نافدة.', 'Nothing is out of stock.')) +
      block(L('كمية منخفضة', 'Low stock'), 'box', 'warn', a.low.map(function (p) { return prow(p, L('المتبقي: ', 'Left: ') + C.qf(p.stock) + ' ' + esc(P.unit(p)) + ' · ' + L('حد التنبيه ', 'alert at ') + C.qf(p.minStock)); }), L('كل الكميات فوق حد التنبيه.', 'All quantities are above their alert level.')) +
      block(L('عملاء عليهم مبالغ', 'Customers who owe'), 'users', 'bad', a.debts.map(function (r) { return '<button type="button" class="inv-card" data-cust="' + esc(r.name) + '" style="padding:10px"><span class="grow"><span class="nm">' + esc(r.name) + '</span> <span class="meta ltr">' + esc(r.phone) + '</span><br><span class="meta">' + r.n + L(' فاتورة', ' bill(s)') + '</span></span><b class="num" style="color:var(--red)">' + f3(r.due) + '</b></button>'; }), L('لا توجد ديون على العملاء.', 'No customer owes anything.')) +
      (Store.sees('expenses') ? block(L('مصروفات مستحقة لم تُدفع', 'Expenses due, not paid yet'), 'wallet', 'warn', a.bills.map(function (x) { var late = x.due && x.due < t; return '<button type="button" class="inv-card" data-exp="' + esc(x.id) + '" style="padding:10px"><span class="grow"><span class="nm">' + esc(x.cat || '') + (x.supplier ? ' - ' + esc(x.supplier) : '') + '</span><br><span class="meta">' + esc(x.title || '') + (x.due ? ' · ' + (late ? '<b style="color:var(--red)">' + L('تأخر: ', 'Late: ') : L('يستحق: ', 'Due: ')) + C.fdate(x.due) + (late ? '</b>' : '') : '') + '</span></span><b class="num" style="color:var(--red)">' + f3(x.amount) + '</b></button>'; }), L('لا توجد مصروفات مستحقة.', 'No unpaid expenses.')) : '') +
      (Store.sees('insurance') ? block(L('ملفات تأمين تحتاج متابعة', 'Insurance cases to follow up'), 'shield', 'warn', a.claims.map(function (c) { return '<button type="button" class="inv-card" data-claim="' + esc(c.id) + '" style="padding:10px"><span class="grow"><span class="nm">' + esc(c.company) + ' <span class="ltr small">' + esc(c.claimNo || c.number) + '</span></span><br><span class="meta">' + esc(C.nm(C.claimSt(c.status))) + (c.status === 'sent' ? ' · ' + L('أُرسل في ', 'sent on ') + C.fdate(c.sentOn) : ' · ' + L('لم يُدفع بعد', 'not paid yet')) + '</span></span>' + icon(C.lang === 'ar' ? 'back' : 'next', 18) + '</button>'; }), L('لا شيء ينتظر.', 'Nothing waiting.')) : '') + '</div>';
  }
  function act(r, what, after) {
    if (what === 'wa') { WhatsApp.text(r.phone, r.msg || r.text); return; }
    if (what === 'edit') { form(r); return; }
    if (what === 'del') { C.confirmBox(L('حذف هذا التذكير؟', 'Delete this reminder?'), L('حذف', 'Delete'), true).then(function (y) { if (y) Store.removeReminder(r.id).then(after, function (er) { C.toast(C.errText(er), 'err'); }); }); return; }
    if (what === 'done') { Store.saveReminder(Object.assign({}, r, { done: true })).then(after, function (er) { C.toast(C.errText(er), 'err'); }); return; }
    if (what === 'later') {
      var m = C.modal({ title: L('تأجيل التذكير', 'Put off the reminder'), size: 'sm', body: '<div class="unit-pick">' + [['1d', L('إلى الغد', 'Until tomorrow')], ['3d', L('3 أيام', '3 days')], ['1w', L('أسبوع', 'A week')], ['1m', L('شهر', 'A month')]].map(function (o) { return '<button type="button" data-l="' + o[0] + '"><span>' + o[1] + '</span></button>'; }).join('') + '</div>' });
      m.body.addEventListener('click', function (e) {
        var b = e.target.closest('[data-l]'); if (!b) return; var k = b.getAttribute('data-l'), t = C.today();
        var d = k === '1d' ? C.addDays(t, 1) : k === '3d' ? C.addDays(t, 3) : k === '1w' ? C.addDays(t, 7) : C.addMonths(t, 1);
        m.close(); Store.saveReminder(Object.assign({}, r, { showOn: d })).then(function () { C.toast(L('يظهر مرة أخرى في ', 'It shows again on ') + C.fdate(d)); after(); }, function (er) { C.toast(C.errText(er), 'err'); });
      });
    }
  }

  /* when the system is opened: the reminders that are due now, in a window (once per opening) */
  function popup() {
    var list = due();
    if (!list.length) return;
    var key = BRAND.key + '_seen_' + C.today() + '_' + list.map(function (r) { return r.id; }).join('.').slice(0, 300);
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) { /* private mode: show it */ }
    var m = C.modal({ title: icon('bell') + ' ' + L('تذكيرات حان وقتها', 'Reminders due now') + ' <span class="badge warn">' + list.length + '</span>', size: 'md', body: '<div class="col" id="pp" style="gap:8px"></div>',
      foot: '<button type="button" class="btn ghost" id="pp-all">' + L('فتح التنبيهات', 'Open Alerts') + '</button><button type="button" class="btn primary" id="pp-ok">' + L('حسناً', 'OK') + '</button>' });
    var drawP = function () { var l = due(); if (!l.length) { m.close(); return; } m.el.querySelector('#pp').innerHTML = l.map(function (r) { return remRow(r, true); }).join(''); Shell.refreshNav(); };
    drawP();
    m.el.querySelector('#pp-ok').onclick = function () { m.close(); };
    m.el.querySelector('#pp-all').onclick = function () { m.close(); Shell.go('alerts'); };
    m.el.addEventListener('click', function (e) {
      var row = e.target.closest('[data-rid]'); if (!row) return;
      var r = Store.byId(S.reminders, row.getAttribute('data-rid')); if (!r) return;
      var w = e.target.closest('[data-rwa]') ? 'wa' : e.target.closest('[data-rlater]') ? 'later' : e.target.closest('[data-rdone]') ? 'done' : e.target.closest('[data-redit]') ? 'edit' : e.target.closest('[data-rdel]') ? 'del' : '';
      if (w === 'edit') m.close();
      if (w) act(r, w, drawP);
    });
  }

  Shell.page('alerts', {
    title: function () { return L('التنبيهات والتذكيرات', 'Alerts & reminders'); },
    render: function (el) {
      rroot = document.createElement('div'); el.appendChild(rroot); draw();
      var after = function () { draw(); Shell.refreshNav(); };
      rroot.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('#r-new')) return form(null);
        var row = e.target.closest('[data-rid]');
        if (row) {
          var r = Store.byId(S.reminders, row.getAttribute('data-rid')); if (!r) return;
          var w = e.target.closest('[data-rwa]') ? 'wa' : e.target.closest('[data-rlater]') ? 'later' : e.target.closest('[data-rdone]') ? 'done' : e.target.closest('[data-redit]') ? 'edit' : e.target.closest('[data-rdel]') ? 'del' : '';
          if (w) act(r, w, after);
          return;
        }
        if ((b = e.target.closest('[data-job]'))) return Jobs.view(b.getAttribute('data-job'));
        if ((b = e.target.closest('[data-item]'))) return StorePage.details(b.getAttribute('data-item'));
        if ((b = e.target.closest('[data-cust]'))) return Shell.go('jobs', { customer: b.getAttribute('data-cust'), unpaid: true });
        if ((b = e.target.closest('[data-exp]'))) return Shell.go('expenses', { open: b.getAttribute('data-exp') });
        if ((b = e.target.closest('[data-claim]'))) return Insurance.view(b.getAttribute('data-claim'));
      });
    }
  });
  window.Alerts = { count: count, popup: popup, form: form, serviceReminder: serviceReminder, custDebts: custDebts, refresh: function () { if (rroot && rroot.isConnected) draw(); } };
})();
