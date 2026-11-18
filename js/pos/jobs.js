/* jobs.js - the cars and the bills.
     Garage board : the cars now in the workshop, in three columns (received / in work / ready for delivery),
                    with how long each one has been in and whether its delivery date has passed. Move a car on with one press.
     All bills    : search (number, name, phone, plate), period, stage and payment filters, Excel.
   One job card opens in a window: everything about it, the stage, photos (add / tag / remove at any time), the damage
   drawing, payments, print in any size, WhatsApp, a service reminder for the customer, edit, void, delete (owner). */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, Calc = C.Calc, num = C.num, f3 = C.f3;
  var flt = { view: 'board', q: '', range: 'month', from: '', to: '', st: '', pay: '' }, root = null;

  function rangeDates() {
    var t = C.today();
    if (flt.range === 'today') return [t, t];
    if (flt.range === 'week') return [C.addDays(t, -6), t];
    if (flt.range === 'month') return [t.slice(0, 8) + '01', t];
    if (flt.range === 'custom') return [flt.from || '0000-00-00', flt.to || '9999-99-99'];
    return ['0000-00-00', '9999-99-99'];
  }
  function payStatus(inv) {
    if (inv.void) return ['void', L('ملغاة', 'Void'), 'bad'];
    if (num(inv.total) <= 0) return ['none', L('بدون مبلغ بعد', 'No amount yet'), ''];
    var b = Calc.balance(inv);
    if (b <= 0.0004) return ['paid', L('مدفوعة', 'Paid'), 'ok'];
    return Calc.paid(inv) > 0 ? ['part', L('مدفوعة جزئياً', 'Part paid'), 'warn'] : ['due', L('غير مدفوعة', 'Not paid'), 'warn'];
  }
  function stageBadge(inv) { var s = C.stage(inv.status); return '<span class="badge ' + s.cls + '">' + icon(s.ic, 13) + ' ' + esc(C.nm(s)) + '</span>'; }
  function daysIn(inv) { var d = Math.round((new Date(C.today() + 'T12:00:00') - new Date(inv.date + 'T12:00:00')) / 86400000); return Math.max(0, d); }
  function late(inv) { return inv.status !== 'delivered' && inv.expDate && inv.expDate < C.today(); }
  function matchQ(i, q, pq, kq) {
    if (!q) return true;
    return C.norm(i.number + ' ' + i.customerName + ' ' + i.createdBy + ' ' + (i.car.make || '') + ' ' + (i.car.model || '') + ' ' + (i.doneBy || '')).indexOf(q) >= 0 ||
      (pq.length >= 3 && C.phoneKey(i.customerPhone).indexOf(pq) >= 0) || (kq.length >= 2 && C.plateKey(i.car.plate).indexOf(kq) >= 0);
  }

  /* ------------------------------------------------ garage board */
  function boardHtml() {
    var q = C.norm(flt.q), pq = C.phoneKey(flt.q), kq = C.plateKey(flt.q), t = C.today();
    var live = S.invoices.filter(function (i) { return !i.void && matchQ(i, q, pq, kq); });
    var col = function (st) {
      var list = live.filter(function (i) { return i.status === st.id; }).sort(function (a, b) { return a.no - b.no; });
      return '<div class="board-col ' + st.id + '"><h3>' + icon(st.ic, 18) + esc(C.nm(st)) + ' <span class="badge ' + st.cls + '">' + list.length + '</span></h3>' +
        (list.length ? list.map(card).join('') : '<p class="muted small center" style="padding:14px 0">' + L('لا توجد سيارات', 'No cars') + '</p>') + '</div>';
    };
    var today = live.filter(function (i) { return i.status === 'delivered' && i.deliveredAt === t; });
    var inside = live.filter(function (i) { return i.status !== 'delivered'; }).length, ready = live.filter(function (i) { return i.status === 'ready'; }).length;
    var lateN = live.filter(late).length;
    return '<div class="stats mb"><div class="stat blue"><span>' + icon('car', 16) + L('سيارات في الورشة', 'Cars in the workshop') + '</span><b>' + inside + '</b></div>' +
      '<div class="stat green"><span>' + icon('check', 16) + L('جاهزة للتسليم', 'Ready for delivery') + '</span><b>' + ready + '</b></div>' +
      '<div class="stat ' + (lateN ? 'red' : '') + '"><span>' + icon('clock', 16) + L('تأخر موعد تسليمها', 'Past their delivery date') + '</span><b>' + lateN + '</b></div>' +
      '<div class="stat"><span>' + icon('car', 16) + L('سُلّمت اليوم', 'Delivered today') + '</span><b>' + today.length + '</b></div></div>' +
      '<div class="board">' + C.STAGES.filter(function (s) { return s.id !== 'delivered'; }).map(col).join('') + '</div>' +
      (today.length ? '<h3 class="mt2 mb">' + icon('car') + ' ' + L('سُلّمت اليوم', 'Delivered today') + '</h3><div class="inv-grid">' + today.map(card).join('') + '</div>' : '');
  }
  function card(i) {
    var st = payStatus(i), d = daysIn(i), next = C.STAGES[Math.min(3, C.STAGES.indexOf(C.stage(i.status)) + 1)];
    var ph = (i.photos || []).length;
    return '<div class="job-card' + (late(i) ? ' late' : '') + '" data-id="' + esc(i.id) + '">' +
      '<div class="row between"><b class="plate ltr">' + esc(i.car.plate || '—') + '</b><span class="small muted ltr">' + esc(i.number) + '</span></div>' +
      '<div class="nm">' + esc([i.car.make, i.car.model, i.car.year].filter(Boolean).join(' ') || L('سيارة', 'Car')) + '</div>' +
      '<div class="meta">' + esc(i.customerName || L('بدون اسم', 'No name')) + (i.customerPhone ? ' · <span class="ltr">' + esc(i.customerPhone) + '</span>' : '') + '</div>' +
      ((i.svc || []).length ? '<div class="row wrap" style="gap:4px;margin-top:4px">' + i.svc.map(function (s) { var x = C.catOf(C.SVC, s); return '<span class="badge sm" style="background:' + x.c + '1a;color:' + x.c + '">' + esc(C.nm(x)) + '</span>'; }).join('') + (i.source === 'ins' ? '<span class="badge sm info">' + icon('shield', 12) + ' ' + esc(i.insCo || L('تأمين', 'Insurance')) + '</span>' : '') + '</div>' : '') +
      '<div class="row between wrap mt-s"><span class="small">' + (i.status !== 'delivered' ? (d ? L('منذ ', '') + d + L(' يوم', ' day(s) in') : L('دخلت اليوم', 'In today')) : C.fdate(i.deliveredAt || i.date)) +
      (i.expDate && i.status !== 'delivered' ? ' · ' + (late(i) ? '<b style="color:var(--red)">' + L('تأخر: ', 'Late: ') + C.fdate(i.expDate) + '</b>' : L('التسليم: ', 'Due: ') + C.fdate(i.expDate)) : '') + '</span>' +
      '<span class="row" style="gap:6px">' + (ph ? '<span class="small muted">' + icon('camera', 14) + ' ' + ph + '</span>' : '') + (num(i.total) > 0 ? '<b class="num">' + f3(i.total) + '</b>' : '') + '</span></div>' +
      (num(i.total) > 0 && st[0] !== 'paid' ? '<span class="badge ' + st[2] + ' sm" style="margin-top:4px">' + st[1] + (Calc.balance(i) > 0 ? ' · ' + f3(Calc.balance(i)) : '') + '</span>' : '') +
      (i.status !== 'delivered' && (Store.can('sell') || Store.can('edit_inv')) ? '<button type="button" class="btn sm ' + (next.id === 'delivered' ? 'primary' : 'soft') + ' block mt-s" data-next="' + next.id + '">' + icon(next.ic, 16) + L('نقل إلى: ', 'Move to: ') + esc(C.nm(next)) + '</button>' : '') + '</div>';
  }

  /* ------------------------------------------------ all bills */
  function matches() {
    var r = rangeDates(), q = C.norm(flt.q), pq = C.phoneKey(flt.q), kq = C.plateKey(flt.q);
    return S.invoices.filter(function (i) {
      if (i.date < r[0] || i.date > r[1]) return false;
      if (flt.st && (i.void || i.status !== flt.st)) return false;
      var ps = payStatus(i)[0];
      if (flt.pay === 'unpaid' && !(ps === 'part' || ps === 'due')) return false;
      if (flt.pay === 'paid' && ps !== 'paid') return false;
      if (flt.pay === 'void' && ps !== 'void') return false;
      if (flt.pay === 'ins' && i.source !== 'ins') return false;
      return matchQ(i, q, pq, kq);
    }).sort(function (a, b) { return b.no - a.no; });
  }
  function listHtml() {
    var list = matches(), live = list.filter(function (i) { return !i.void; });
    var sum = function (fn) { return live.reduce(function (t, i) { return t + fn(i); }, 0); };
    var stats = '<div class="stats mb"><div class="stat"><span>' + L('عدد الفواتير', 'Bills') + '</span><b>' + live.length + '</b></div>' +
      '<div class="stat blue"><span>' + L('إجمالي الفواتير', 'Total billed') + '</span><b class="num">' + f3(sum(function (i) { return num(i.total); })) + '</b></div>' +
      '<div class="stat green"><span>' + L('المحصّل', 'Collected') + '</span><b class="num">' + f3(sum(Calc.paid)) + '</b></div>' +
      '<div class="stat red"><span>' + L('المتبقي على العملاء', 'Outstanding') + '</span><b class="num">' + f3(sum(Calc.balance)) + '</b></div></div>';
    if (!list.length) return stats + '<div class="card empty">' + icon('receipt', 44) + '<p>' + L('لا توجد فواتير مطابقة', 'No matching bills') + '</p></div>';
    return stats + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('الرقم', 'No.') + '</th><th>' + L('التاريخ', 'Date') + '</th><th>' + L('العميل', 'Customer') + '</th><th>' + L('السيارة', 'Car') + '</th><th>' + L('حالة السيارة', 'Car stage') + '</th><th>' + L('الإجمالي', 'Total') + '</th><th>' + L('المتبقي', 'Balance') + '</th><th>' + L('الدفع', 'Payment') + '</th><th></th></tr></thead><tbody>' +
      list.slice(0, 400).map(function (i) {
        var st = payStatus(i);
        return '<tr data-id="' + esc(i.id) + '" style="cursor:pointer"><td class="ltr"><b>' + esc(i.number) + '</b></td><td class="nowrap">' + C.fdate(i.date) + '</td>' +
          '<td>' + esc(i.customerName || L('عميل نقدي', 'Cash customer')) + (i.customerPhone ? '<div class="small muted ltr">' + esc(i.customerPhone) + '</div>' : '') + '</td>' +
          '<td>' + esc([i.car.make, i.car.model].filter(Boolean).join(' ')) + (i.car.plate ? '<div class="small ltr"><b>' + esc(i.car.plate) + '</b></div>' : '') + '</td>' +
          '<td>' + (i.void ? '' : stageBadge(i)) + '</td>' +
          '<td class="num"><b>' + f3(i.total) + '</b></td><td class="num">' + (Calc.balance(i) > 0.0004 ? '<b style="color:var(--red)">' + f3(Calc.balance(i)) + '</b>' : '-') + '</td>' +
          '<td><span class="badge ' + st[2] + '">' + st[1] + '</span></td>' +
          '<td class="act"><button type="button" class="icon-btn sm" data-print title="' + L('طباعة', 'Print') + '">' + icon('print', 18) + '</button><button type="button" class="icon-btn sm" data-wa title="WhatsApp" style="color:#1fa855">' + icon('whatsapp', 18) + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' + (list.length > 400 ? '<p class="muted small center mt">' + L('تُعرض أول 400 فاتورة. ضيّق الفترة أو استخدم البحث.', 'Showing the first 400 bills. Narrow the period or use the search.') + '</p>' : '');
  }
  function draw() {
    var board = flt.view === 'board';
    root.innerHTML = '<div class="toolbar"><div class="seg" id="v-view"><button type="button" data-view="board" class="' + (board ? 'on' : '') + '">' + icon('grid', 16) + L('السيارات في الورشة', 'Cars in the workshop') + '</button><button type="button" data-view="list" class="' + (board ? '' : 'on') + '">' + icon('list', 16) + L('كل الفواتير', 'All bills') + '</button></div>' +
      '<div class="search">' + icon('search') + '<input class="input" id="v-q" type="search" placeholder="' + L('رقم اللوحة، الاسم، الهاتف، رقم الفاتورة', 'Plate, name, phone, bill no.') + '" value="' + esc(flt.q) + '"></div>' +
      (Store.can('sell') ? '<button type="button" class="btn primary" data-go="sell">' + icon('plus') + L('إضافة فاتورة', 'Add bill') + '</button>' : '') + '</div>' +
      (board ? '' : '<div class="row wrap mb"><div class="chips" id="v-range">' + [['today', L('اليوم', 'Today')], ['week', L('7 أيام', '7 days')], ['month', L('هذا الشهر', 'This month')], ['all', L('الكل', 'All')], ['custom', L('فترة محددة', 'Custom')]].map(function (x) { return '<button type="button" class="chip' + (flt.range === x[0] ? ' on' : '') + '" data-r="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
        (flt.range === 'custom' ? '<input type="date" class="input" id="v-from" style="width:auto" value="' + esc(flt.from) + '"><span>-</span><input type="date" class="input" id="v-to" style="width:auto" value="' + esc(flt.to) + '">' : '') +
        '<select class="input" id="v-st" style="width:auto"><option value="">' + L('كل المراحل', 'Any stage') + '</option>' + C.STAGES.map(function (s) { return '<option value="' + s.id + '"' + (flt.st === s.id ? ' selected' : '') + '>' + esc(C.nm(s)) + '</option>'; }).join('') + '</select>' +
        '<select class="input" id="v-pay" style="width:auto"><option value="">' + L('كل حالات الدفع', 'Any payment') + '</option><option value="unpaid"' + (flt.pay === 'unpaid' ? ' selected' : '') + '>' + L('غير مدفوعة', 'Unpaid') + '</option><option value="paid"' + (flt.pay === 'paid' ? ' selected' : '') + '>' + L('مدفوعة', 'Paid') + '</option><option value="ins"' + (flt.pay === 'ins' ? ' selected' : '') + '>' + L('سيارات التأمين', 'Insurance cars') + '</option><option value="void"' + (flt.pay === 'void' ? ' selected' : '') + '>' + L('ملغاة', 'Void') + '</option></select>' +
        '<button type="button" class="btn ghost" id="v-xl">' + icon('download') + 'Excel</button></div>') +
      '<div id="v-list">' + (board ? boardHtml() : listHtml()) + '</div>';
  }
  function exportXl() {
    var M = XLSX.S.MONEY, cost = Store.sees('cost');
    var rows = [[L('الرقم', 'No.'), L('التاريخ', 'Date'), L('العميل', 'Customer'), L('الهاتف', 'Phone'), L('اللوحة', 'Plate'), L('السيارة', 'Car'), L('نوع الخدمة', 'Services'), L('المرحلة', 'Stage'), L('الفني', 'Technician'), L('المجموع', 'Sub-total'), L('الخصم', 'Discount'), L('الضريبة', 'VAT'), L('الإجمالي', 'Total'), L('المدفوع', 'Paid'), L('المتبقي', 'Balance')]
      .concat(cost ? [L('التكلفة', 'Cost'), L('الربح', 'Profit')] : []).concat([L('الدفع', 'Payment'), L('أعدّها', 'By'), L('البنود', 'Lines')])];
    matches().forEach(function (i) {
      rows.push([i.number, C.fdate(i.date), i.customerName, i.customerPhone, i.car.plate || '', [i.car.make, i.car.model, i.car.year].filter(Boolean).join(' '), (i.svc || []).map(C.svcName).join(', '), i.void ? L('ملغاة', 'Void') : C.stageName(i.status), i.doneBy || '',
        { v: num(i.sub), s: M }, { v: num(i.discount), s: M }, { v: num(i.vat), s: M }, { v: num(i.total), s: M }, { v: Calc.paid(i), s: M }, { v: Calc.balance(i), s: M }]
        .concat(cost ? [{ v: i.void ? 0 : Calc.cost(i), s: M }, { v: i.void ? 0 : Calc.profit(i), s: M }] : [])
        .concat([payStatus(i)[1], i.createdBy, i.items.map(function (it) { return it.n + ' ×' + C.qf(it.q); }).join(' | ')]));
    });
    Shell.excel('Garage_Bills', L('الفواتير', 'Bills'), rows, [13, 12, 22, 13, 12, 22, 18, 12, 14, 11, 10, 10, 12, 12, 12].concat(cost ? [12, 12] : []).concat([12, 14, 60]));
  }

  /* ------------------------------------------------ move a car to another stage */
  function setStage(inv, st, after) {
    var go = function (extra) {
      return Store.touchInvoice(inv.id, Object.assign({ status: st }, extra || {})).then(function (d) {
        C.toast(L('السيارة الآن: ', 'The car is now: ') + C.stageName(st));
        var done = function () { if (after) after(d); else if (root && root.isConnected) draw(); };
        // handing the car over with money still owed: ask for the payment first, then show the result once
        if (st === 'delivered' && Calc.balance(d) > 0.0004 && (Store.can('sell') || Store.can('edit_inv'))) { if (root && root.isConnected) draw(); pay(d, done, true); return d; }
        done();
        if (st === 'ready' && d.customerPhone) readyMsg(d);
        return d;
      }, function (e) { C.toast(C.errText(e), 'err'); });
    };
    go();
  }
  /* "your car is ready" on WhatsApp */
  function readyMsg(inv) {
    var s = S.settings, ar = C.lang === 'ar', car = inv.car || {};
    var msg = ar ? 'مرحباً ' + (inv.customerName || '') + '،\nسيارتك ' + [car.make, car.model].filter(Boolean).join(' ') + (car.plate ? ' (لوحة ' + car.plate + ')' : '') + ' جاهزة للاستلام في ' + (s.nameAr || s.name) + '.' + (num(inv.total) > 0 ? '\nالمبلغ: ' + f3(inv.total) + ' ر.ع' + (Calc.paid(inv) > 0 ? '، المتبقي: ' + f3(Calc.balance(inv)) + ' ر.ع' : '') : '') + '\nللتواصل: ' + s.phone
      : 'Hello ' + (inv.customerName || '') + ',\nYour car ' + [car.make, car.model].filter(Boolean).join(' ') + (car.plate ? ' (plate ' + car.plate + ')' : '') + ' is ready for collection at ' + s.name + '.' + (num(inv.total) > 0 ? '\nAmount: ' + f3(inv.total) + ' OMR' + (Calc.paid(inv) > 0 ? ', balance: ' + f3(Calc.balance(inv)) + ' OMR' : '') : '') + '\nContact: ' + s.phone;
    var m = C.modal({ title: icon('whatsapp') + ' ' + L('إبلاغ العميل أن السيارة جاهزة؟', 'Tell the customer the car is ready?'), size: 'sm',
      body: '<textarea class="input" id="rm-t" rows="6">' + esc(msg) + '</textarea>',
      foot: '<button type="button" class="btn ghost" id="rm-no">' + L('لاحقاً', 'Later') + '</button><button type="button" class="btn wa" id="rm-ok">' + icon('whatsapp') + L('إرسال', 'Send') + '</button>' });
    m.el.querySelector('#rm-no').onclick = function () { m.close(); };
    m.el.querySelector('#rm-ok').onclick = function () { WhatsApp.text(inv.customerPhone, m.el.querySelector('#rm-t').value); m.close(); };
  }

  /* ------------------------------------------------ one job card */
  function view(id) {
    var inv = Store.byId(S.invoices, id);
    if (!inv) return;
    var st = payStatus(inv), bal = Calc.balance(inv), cost = Store.sees('cost'), car = inv.car || {};
    var mayWork = (Store.can('sell') || Store.can('edit_inv')) && !inv.void;
    var canEdit = !inv.void && (Store.can('edit_inv') || (Store.can('sell') && inv.status !== 'delivered'));
    var claim = S.claims.filter(function (c) { return c.invoiceId === inv.id; })[0];
    var row = function (k, v, ltr) { return v ? '<dt>' + k + '</dt><dd' + (ltr ? ' class="ltr"' : '') + '>' + esc(v) + '</dd>' : ''; };
    var m = C.modal({ title: icon('notes') + ' <span class="ltr">' + esc(inv.number) + '</span> ' + (inv.void ? '<span class="badge bad">' + L('ملغاة', 'Void') + '</span>' : stageBadge(inv)), size: 'xl',
      body: (inv.void ? '<div class="note bad mb">' + icon('alert', 18) + '<span>' + L('ملغاة بواسطة ', 'Voided by ') + esc(inv.voidedBy || '') + ' - ' + C.fts(inv.voidedAt) + (inv.voidReason ? ' - ' + esc(inv.voidReason) : '') + '</span></div>' : '') +
        (!inv.void && mayWork ? '<div class="stage-pick mb" id="j-stage">' + C.STAGES.map(function (s) { return '<button type="button" data-stage="' + s.id + '" class="' + (inv.status === s.id ? 'on ' + s.cls : '') + '">' + icon(s.ic, 16) + esc(C.nm(s)) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="grid g3 mb"><div class="card flat"><h3>' + icon('users', 18) + L('العميل', 'Customer') + '</h3><dl class="kv">' + row(L('الاسم', 'Name'), inv.customerName || L('عميل نقدي', 'Cash customer')) + row(L('الهاتف', 'Phone'), inv.customerPhone, true) + '</dl></div>' +
        '<div class="card flat"><h3>' + icon('car', 18) + L('السيارة', 'Car') + '</h3><dl class="kv">' + row(L('اللوحة', 'Plate'), car.plate, true) + row(L('السيارة', 'Car'), [car.make, car.model, car.year].filter(Boolean).join(' ')) + row(L('اللون', 'Colour'), car.color) + row(L('الشاصي', 'Chassis'), car.vin, true) + row(L('العداد', 'Mileage'), car.km ? car.km + ' km' : '', true) + '</dl></div>' +
        '<div class="card flat"><h3>' + icon('clock', 18) + L('المواعيد', 'Times') + '</h3><dl class="kv">' + row(L('الدخول', 'In'), C.fdate(inv.date) + ' ' + (inv.timeIn || inv.time || '')) + row(L('التسليم المتوقع', 'Expected'), inv.expDate ? C.fdate(inv.expDate) : '') + row(L('سُلّمت', 'Delivered'), inv.deliveredAt ? C.fdate(inv.deliveredAt) + ' ' + (inv.timeOut || '') : '') + row(L('الفني', 'Technician'), inv.doneBy) + row(L('أعدّها', 'Made by'), inv.createdBy) + '</dl></div></div>' +
        '<div class="row wrap mb" style="gap:6px">' + (inv.svc || []).map(function (s) { return '<span class="badge blue">' + esc(C.svcName(s)) + '</span>'; }).join('') + (inv.source ? '<span class="badge">' + L('المصدر: ', 'Source: ') + esc(C.sourceName(inv.source)) + '</span>' : '') +
        (inv.source === 'ins' ? '<span class="badge info">' + icon('shield', 13) + ' ' + esc(inv.insCo || '') + (inv.claimNo ? ' · ' + esc(inv.claimNo) : '') + '</span>' : '') +
        (claim && Store.sees('insurance') ? '<button type="button" class="btn sm soft" id="j-claim">' + icon('shield', 15) + L('ملف التأمين ', 'Insurance case ') + esc(claim.number) + '</button>' : '') + '</div>' +
        (inv.complaint ? '<div class="note mb"><b>' + L('الشكوى: ', 'Complaint: ') + '</b>&nbsp;' + esc(inv.complaint) + '</div>' : '') +
        '<div class="card flat mb"><div class="row between"><h3 style="margin:0">' + icon('notes', 18) + L('ما تم عمله', 'Work done') + '</h3>' + (mayWork ? '<button type="button" class="btn sm ghost" id="j-work">' + icon('edit', 16) + L('تعديل', 'Edit') + '</button>' : '') + '</div><p class="mt-s" style="white-space:pre-wrap">' + (inv.workNotes ? esc(inv.workNotes) : '<span class="muted">-</span>') + '</p></div>' +
        '<div class="grid g2 mb"><div class="card flat"><div class="row between"><h3 style="margin:0">' + icon('camera', 18) + L('الصور', 'Photos') + ' <span class="badge">' + (inv.photos || []).length + '</span></h3><button type="button" class="btn sm soft" id="j-photos">' + icon(mayWork ? 'plus' : 'eye', 16) + (mayWork ? L('إضافة / إدارة', 'Add / manage') : L('عرض', 'View')) + '</button></div><div class="mt-s" id="j-ph">' + Photos.grid((inv.photos || []).slice(0, 8), { small: true }) + ((inv.photos || []).length > 8 ? '<p class="small muted">+' + ((inv.photos || []).length - 8) + '</p>' : '') + '</div></div>' +
        '<div class="card flat"><div class="row between"><h3 style="margin:0">' + icon('car', 18) + L('أماكن الضرر', 'Damage') + '</h3>' + (mayWork ? '<button type="button" class="btn sm ghost" id="j-dmg">' + icon('edit', 16) + L('تعديل', 'Edit') + '</button>' : '') + '</div><div class="dmg-view">' + CarDiagram.svg(inv.damage) + '<p class="small">' + ((inv.damage || []).length ? esc(CarDiagram.list(inv.damage)) : '<span class="muted">' + L('لم يُحدَّد', 'Nothing marked') + '</span>') + '</p></div></div></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('البند', 'Line') + '</th><th>' + L('النوع', 'Kind') + '</th><th>' + L('الكمية', 'Qty') + '</th><th>' + L('السعر', 'Price') + '</th><th>' + L('المبلغ', 'Amount') + '</th>' + (cost ? '<th>' + L('الربح', 'Profit') + '</th>' : '') + '</tr></thead><tbody>' +
        (inv.items.length ? inv.items.map(function (it) {
          return '<tr><td>' + esc(C.lineName(it)) + '</td><td><span class="badge sm ' + (it.grp === 'work' ? 'blue' : it.grp === 'mat' ? 'warn' : '') + '">' + esc(L(Print.GRP[it.grp || 'part'][1], Print.GRP[it.grp || 'part'][0])) + '</span></td><td class="num">' + C.qf(it.q) + (it.unit ? ' <span class="small muted">' + esc(C.lineUnit(it)) + '</span>' : '') + '</td><td class="num">' + f3(it.price) + '</td><td class="num"><b>' + f3(Calc.line(it)) + '</b></td>' +
            (cost ? '<td class="num">' + f3((num(it.price) - num(it.cost)) * num(it.q)) + '</td>' : '') + '</tr>';
        }).join('') : '<tr><td colspan="' + (cost ? 6 : 5) + '" class="muted center">' + L('لم تُضف أعمال بعد', 'No work added yet') + '</td></tr>') + '</tbody></table></div>' +
        '<div class="grid g2 mt"><div>' + (inv.payments.length ? '<h4 class="mb">' + L('الدفعات', 'Payments') + '</h4>' + inv.payments.map(function (p) { return '<div class="row between small" style="padding:4px 0;border-bottom:1px solid var(--line)"><span>' + C.fdate(p.date) + ' · ' + esc(C.payName(p.method)) + (p.by ? ' · ' + esc(p.by) : '') + '</span><b class="num">' + f3(p.amount) + '</b></div>'; }).join('') : '') +
        (inv.warranty && inv.warranty.text ? '<p class="mt small"><b>' + L('الضمان: ', 'Warranty: ') + '</b>' + esc(inv.warranty.text) + (inv.warranty.from || inv.warranty.to ? ' (' + (inv.warranty.from ? C.fdate(inv.warranty.from) : '') + ' - ' + (inv.warranty.to ? C.fdate(inv.warranty.to) : '') + ')' : '') + '</p>' : '') +
        ((inv.history || []).length ? '<p class="small muted mt">' + icon('history', 14) + ' ' + inv.history.map(function (h) { return esc(C.stageName(h.status)) + ' ' + C.fts(h.ts) + ' (' + esc(h.by) + ')'; }).join(' ← ') + '</p>' : '') +
        (inv.edits && inv.edits.length ? '<p class="small muted">' + icon('edit', 14) + ' ' + L('عُدّلت ', 'Edited ') + inv.edits.length + L(' مرة، آخرها بواسطة ', ' time(s), last by ') + esc(inv.edits[inv.edits.length - 1].by) + ' - ' + C.fts(inv.edits[inv.edits.length - 1].ts) + '</p>' : '') + '</div>' +
        '<dl class="kv"><dt>' + L('المجموع', 'Sub-total') + '</dt><dd class="num">' + f3(inv.sub) + '</dd>' + (inv.discount > 0 ? '<dt>' + L('الخصم', 'Discount') + '</dt><dd class="num">-' + f3(inv.discount) + '</dd>' : '') +
        (inv.vat > 0 ? '<dt>' + L('الضريبة ', 'VAT ') + inv.vatPct + '%</dt><dd class="num">' + f3(inv.vat) + '</dd>' : '') +
        '<dt style="font-size:17px;color:var(--ink)"><b>' + L('الإجمالي', 'Total') + '</b></dt><dd class="num" style="font-size:19px;color:var(--g700)">' + C.money(inv.total) + '</dd>' +
        '<dt>' + L('المدفوع', 'Paid') + '</dt><dd class="num">' + f3(Calc.paid(inv)) + '</dd>' + (bal > 0.0004 ? '<dt style="color:var(--red)">' + L('المتبقي', 'Balance') + '</dt><dd class="num" style="color:var(--red)">' + f3(bal) + '</dd>' : '') +
        (cost && !inv.void ? '<dt>' + L('ربح الفاتورة', 'Bill profit') + '</dt><dd class="num">' + f3(Calc.profit(inv)) + '</dd>' : '') + '</dl></div>',
      foot: (Store.isAdmin() ? '<button type="button" class="btn danger-soft" id="b-del" title="' + L('حذف نهائي', 'Delete for good') + '">' + icon('trash') + '</button>' : '') +
        (Store.can('edit_inv') && !inv.void ? '<button type="button" class="btn ghost" id="b-void">' + L('إلغاء الفاتورة', 'Void') + '</button>' : '') +
        (canEdit ? '<button type="button" class="btn soft" id="b-edit">' + icon('edit') + L('تعديل / إضافة أعمال', 'Edit / add work') + '</button>' : (!inv.void && !Store.isViewer() ? '<button type="button" class="btn ghost" id="b-noedit" style="opacity:.6">' + icon('lock', 16) + L('تعديل', 'Edit') + '</button>' : '')) +
        (mayWork && inv.customerPhone ? '<button type="button" class="btn ghost" id="b-rem" title="' + L('تذكير صيانة للعميل', 'Service reminder') + '">' + icon('bell') + L('تذكير صيانة', 'Service reminder') + '</button>' : '') +
        '<span class="grow"></span>' + (bal > 0.0004 && mayWork ? '<button type="button" class="btn amber" id="b-pay">' + icon('money') + L('استلام دفعة', 'Receive payment') + '</button>' : '') +
        '<select class="input" id="b-size" style="width:auto">' + Print.sizeOptions(Print.size()) + '</select><button type="button" class="btn ghost" id="b-print">' + icon('print') + L('طباعة', 'Print') + '</button>' +
        '<button type="button" class="btn wa" id="b-wa">' + icon('whatsapp') + L('واتساب', 'WhatsApp') + '</button>' });
    var q = function (s) { return m.el.querySelector(s); }, on = function (s, fn) { var e = q(s); if (e) e.onclick = fn; };
    var reopen = function () { m.close(); view(id); if (root && root.isConnected) draw(); };
    on('#b-print', function () {
      var sz = q('#b-size').value; Print.size(sz);
      if ((sz === 'a4' || sz === 'job') && (inv.photos || []).length) C.confirmBox(L('طباعة صور السيارة أيضاً في صفحات بعد الفاتورة؟', 'Also print the car photos on pages after the bill?'), L('نعم، مع الصور', 'Yes, with photos')).then(function (y) { Print.run(inv, sz, y); });
      else Print.run(inv, sz);
    });
    on('#b-wa', function () { m.close(); WhatsApp.open(inv); });
    on('#b-edit', function () { m.close(); Sell.edit(inv); });
    on('#b-noedit', function () { C.toast(L('السيارة سُلّمت. تعديل الفاتورة بعد التسليم يحتاج صلاحية «تعديل وإلغاء الفواتير».', 'The car was delivered. Changing the bill after delivery needs the "Edit and void bills" permission.'), 'warn', 7000); });
    on('#b-pay', function () { m.close(); pay(inv, function () { view(id); }); });
    on('#b-rem', function () { Alerts.serviceReminder(inv); });
    on('#j-claim', function () { m.close(); Insurance.view(claim.id); });
    on('#j-photos', function () {
      var changed = false;
      Photos.manage(L('صور ', 'Photos of ') + esc(inv.number) + (car.plate ? ' - <span class="ltr">' + esc(car.plate) + '</span>' : ''), inv.photos, { editable: mayWork,
        save: function (list) { return Store.touchInvoice(inv.id, { photos: list }).then(function (d) { inv = d; changed = true; }); },
        onClose: function () { if (changed) reopen(); } });
    });
    on('#j-dmg', function () { CarDiagram.edit(inv.damage, function (d) { Store.touchInvoice(inv.id, { damage: d }).then(reopen, function (e) { C.toast(C.errText(e), 'err'); }); }); });
    on('#j-work', function () {
      var mm = C.modal({ title: L('ما تم عمله', 'Work done'), size: 'md', body: '<textarea class="input" id="jw" rows="7" maxlength="3000">' + esc(inv.workNotes || '') + '</textarea>', foot: '<button type="button" class="btn primary" id="jw-ok">' + L('حفظ', 'Save') + '</button>' });
      mm.el.querySelector('#jw-ok').onclick = function () { C.busy(this, Store.touchInvoice(inv.id, { workNotes: mm.el.querySelector('#jw').value.trim() })).then(function () { mm.close(); reopen(); }, function () {}); };
    });
    var sp = q('#j-stage');
    if (sp) sp.onclick = function (e) { var b = e.target.closest('[data-stage]'); if (!b || b.getAttribute('data-stage') === inv.status) return; m.close(); setStage(inv, b.getAttribute('data-stage'), function () { view(id); if (root && root.isConnected) draw(); }); };
    on('#b-void', function () {
      var mm = C.modal({ title: L('إلغاء الفاتورة ', 'Void bill ') + esc(inv.number), size: 'sm', body: '<p class="mb">' + L('تبقى الفاتورة في القائمة بعلامة «ملغاة» وتعود قطعها إلى المخزن.', 'The bill stays in the list marked VOID and its parts go back to the store.') + '</p><div class="field"><label>' + L('السبب', 'Reason') + '</label><input class="input" id="vr" maxlength="200"></div>',
        foot: '<button type="button" class="btn danger" id="vok">' + L('إلغاء الفاتورة', 'Void the bill') + '</button>' });
      mm.el.querySelector('#vok').onclick = function () {
        C.busy(mm.el.querySelector('#vok'), Store.voidInvoice(inv.id, mm.el.querySelector('#vr').value.trim())).then(function () { mm.close(); m.close(); C.toast(L('تم إلغاء الفاتورة', 'Bill voided')); if (root && root.isConnected) draw(); }, function () {});
      };
    });
    on('#b-del', function () {
      C.confirmBox(L('حذف الفاتورة ', 'Delete bill ') + inv.number + L(' نهائياً مع صورها؟ رقمها لن يُستخدم مرة أخرى', ' for good, with its photos? Its number is never used again') + (inv.void ? '.' : L('، وتعود قطعها إلى المخزن.', ', and its parts go back to the store.')), L('حذف نهائي', 'Delete'), true).then(function (y) {
        if (y) C.busy(q('#b-del'), Store.removeInvoices([inv.id])).then(function () { m.close(); C.toast(L('تم الحذف', 'Deleted')); if (root && root.isConnected) draw(); }, function () {});
      });
    });
    return m;
  }
  function pay(inv, after, afterOnLater) {
    var bal = Calc.balance(inv);
    var m = C.modal({ title: L('استلام دفعة - ', 'Receive payment - ') + '<span class="ltr">' + esc(inv.number) + '</span>', size: 'sm',
      body: '<div class="col"><div class="note warn">' + L('المتبقي على العميل: ', 'Balance: ') + '<b class="num">' + C.money(bal) + '</b></div>' +
        '<div class="field"><label>' + L('المبلغ المستلم', 'Amount received') + '</label><input class="input num" id="p-a" inputmode="decimal" value="' + f3(bal) + '"></div>' +
        '<div class="field"><label>' + L('طريقة الدفع', 'Method') + '</label><div class="pay-methods" id="p-m" style="grid-template-columns:repeat(3,1fr)">' + ['cash', 'card', 'transfer'].map(function (x, i) { return '<button type="button" data-m="' + x + '" class="' + (i ? '' : 'on') + '">' + esc(C.payName(x)) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label>' + L('التاريخ', 'Date') + '</label><input class="input" type="date" id="p-d" value="' + C.today() + '"></div></div>',
      foot: '<button type="button" class="btn ghost" id="p-later">' + L('لاحقاً', 'Later') + '</button><button type="button" class="btn primary lg" id="p-ok">' + icon('check') + L('حفظ الدفعة', 'Save payment') + '</button>' });
    var method = 'cash';
    m.el.querySelector('#p-m').onclick = function (e) { var b = e.target.closest('[data-m]'); if (!b) return; method = b.getAttribute('data-m'); [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); };
    m.el.querySelector('#p-later').onclick = function () { m.close(); if (afterOnLater && after) after(); };
    m.el.querySelector('#p-ok').onclick = function () {
      var a = num(m.el.querySelector('#p-a').value);
      if (a <= 0 || a > bal + 0.0005) return C.toast(L('المبلغ يجب أن يكون بين 0 والمتبقي', 'The amount must be between 0 and the balance'), 'warn');
      C.busy(m.el.querySelector('#p-ok'), Store.touchInvoice(inv.id, { payment: { amount: a, method: method, date: m.el.querySelector('#p-d').value || C.today() } })).then(function () {
        m.close(); C.toast(L('تم تسجيل الدفعة', 'Payment saved'));
        if (after) after(); else if (root && root.isConnected) draw();
      }, function () {});
    };
  }

  function bind() {
    root.addEventListener('click', function (e) {
      var b, row = e.target.closest('[data-id]');
      if ((b = e.target.closest('[data-view]'))) { flt.view = b.getAttribute('data-view'); draw(); return; }
      if ((b = e.target.closest('[data-r]'))) { flt.range = b.getAttribute('data-r'); draw(); return; }
      if (e.target.closest('#v-xl')) { exportXl(); return; }
      if (!row) return;
      var inv = Store.byId(S.invoices, row.getAttribute('data-id'));
      if (!inv) return;
      if ((b = e.target.closest('[data-next]'))) { b.disabled = true; setStage(inv, b.getAttribute('data-next')); return; }
      if (e.target.closest('[data-print]')) { Print.run(inv, Print.size()); return; }
      if (e.target.closest('[data-wa]')) { WhatsApp.open(inv); return; }
      view(inv.id);
    });
    root.addEventListener('input', function (e) { if (e.target.id === 'v-q') { flt.q = e.target.value; root.querySelector('#v-list').innerHTML = flt.view === 'board' ? boardHtml() : listHtml(); } });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'v-st') flt.st = t.value; else if (t.id === 'v-pay') flt.pay = t.value; else if (t.id === 'v-from') flt.from = t.value; else if (t.id === 'v-to') flt.to = t.value; else return;
      root.querySelector('#v-list').innerHTML = listHtml();
    });
  }

  Shell.page('jobs', {
    title: function () { return L('السيارات والفواتير', 'Cars & bills'); },
    render: function (el, arg) {
      root = document.createElement('div'); el.appendChild(root); bind();
      if (arg && arg.customer) { flt.view = 'list'; flt.q = arg.customer; flt.range = 'all'; flt.pay = arg.unpaid ? 'unpaid' : ''; }
      draw();
      if (arg && arg.open) view(arg.open);
    }
  });
  window.Jobs = { view: view, pay: pay, payStatus: payStatus, refresh: function () { if (root && root.isConnected) draw(); } };
})();
