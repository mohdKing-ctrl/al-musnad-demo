/* customers.js - the customers and their cars.
   A customer is added by himself the first time his name is typed on a job card, and each new car he brings is added
   to his cars. For each customer: his cars (with every visit of each car), what he spent, what he still owes, his
   statement of account on WhatsApp, and "new job card" for one of his cars in one press. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, Calc = C.Calc, num = C.num, f3 = C.f3;
  var cq = '', croot = null;

  function custInvoices(c) {
    var key = C.phoneKey(c.phone), plates = {};
    (c.cars || []).forEach(function (car) { var k = C.plateKey(car.plate); if (k) plates[k] = 1; });
    return S.invoices.filter(function (i) {
      if (i.customerId) return i.customerId === c.id;
      return (c.name && C.norm(i.customerName) === C.norm(c.name)) || (key.length >= 8 && C.phoneKey(i.customerPhone) === key);
    });
  }
  function stats(c) {
    var list = custInvoices(c).filter(function (i) { return !i.void; });
    return { n: list.length, total: C.r3(list.reduce(function (t, i) { return t + num(i.total); }, 0)), due: C.r3(list.reduce(function (t, i) { return t + Calc.balance(i); }, 0)),
      last: list.reduce(function (m, i) { return i.date > m ? i.date : m; }, '') };
  }
  /* his cars: the saved ones plus any car that appears on his job cards */
  function carsOf(c, list) {
    var out = (c.cars || []).map(function (x) { return Object.assign({}, x); }), seen = {};
    out.forEach(function (x) { seen[C.plateKey(x.plate) || ('#' + x.make + x.model)] = 1; });
    (list || custInvoices(c)).forEach(function (i) { var k = C.plateKey(i.car && i.car.plate); if (k && !seen[k]) { seen[k] = 1; out.push(Object.assign({}, i.car)); } });
    return out;
  }
  function listHtml() {
    var q = C.norm(cq), pq = C.phoneKey(cq), kq = C.plateKey(cq);
    var rows = S.customers.map(function (c) { return { c: c, s: stats(c) }; }).filter(function (r) {
      return !q || C.norm(r.c.name).indexOf(q) >= 0 || (pq.length >= 3 && C.phoneKey(r.c.phone).indexOf(pq) >= 0) || (kq.length >= 2 && (r.c.cars || []).some(function (x) { return C.plateKey(x.plate).indexOf(kq) >= 0; }));
    }).sort(function (a, b) { return b.s.due - a.s.due || String(b.s.last).localeCompare(String(a.s.last)) || String(a.c.name).localeCompare(String(b.c.name), 'ar'); });
    if (!S.customers.length) return '<div class="card empty">' + icon('users', 44) + '<p>' + L('لا يوجد عملاء بعد. يُحفظ العميل وسيارته تلقائياً عند كتابة اسمه في أمر العمل.', 'No customers yet. A customer and his car are saved automatically when his name is typed on a job card.') + '</p></div>';
    var due = rows.reduce(function (t, r) { return t + r.s.due; }, 0), cars = S.customers.reduce(function (t, c) { return t + (c.cars || []).length; }, 0);
    return '<div class="stats mb"><div class="stat"><span>' + L('عدد العملاء', 'Customers') + '</span><b>' + S.customers.length + '</b></div><div class="stat blue"><span>' + L('السيارات المسجلة', 'Cars on file') + '</span><b>' + cars + '</b></div><div class="stat red"><span>' + L('إجمالي الديون على العملاء', 'Total owed by customers') + '</span><b class="num">' + f3(due) + '</b></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('العميل', 'Customer') + '</th><th>' + L('الهاتف', 'Phone') + '</th><th>' + L('السيارات', 'Cars') + '</th><th>' + L('الزيارات', 'Visits') + '</th><th>' + L('آخر زيارة', 'Last visit') + '</th><th>' + L('إجمالي ما دفعه', 'Total billed') + '</th><th>' + L('عليه', 'Owes') + '</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr data-cid="' + esc(r.c.id) + '" style="cursor:pointer"><td><b>' + esc(r.c.name) + '</b></td><td class="ltr">' + esc(r.c.phone || '') + '</td><td>' + (r.c.cars || []).map(function (x) { return '<span class="badge sm ltr" style="margin:1px">' + esc(x.plate || x.make || '-') + '</span>'; }).join('') + '</td><td class="num">' + r.s.n + '</td><td class="nowrap">' + (r.s.last ? C.fdate(r.s.last) : '-') + '</td><td class="num">' + f3(r.s.total) + '</td><td class="num">' + (r.s.due > 0.0004 ? '<b style="color:var(--red)">' + f3(r.s.due) + '</b>' : '-') + '</td><td class="act">' + icon(C.lang === 'ar' ? 'back' : 'next', 18) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function draw() {
    croot.innerHTML = '<div class="toolbar"><div class="search">' + icon('search') + '<input class="input" id="c-q" type="search" placeholder="' + L('ابحث بالاسم أو الهاتف أو رقم اللوحة', 'Search by name, phone or plate') + '" value="' + esc(cq) + '"></div>' +
      (Store.can('customers') ? '<button type="button" class="btn primary" id="c-new">' + icon('plus') + L('عميل جديد', 'New customer') + '</button>' : '') + '<button type="button" class="btn ghost" id="c-xl">' + icon('download') + 'Excel</button></div><div id="c-list">' + listHtml() + '</div>';
  }
  function form(c, done) {
    var cars = (c ? c.cars || [] : []).map(function (x) { return Object.assign({}, x); });
    var m = C.modal({ title: c ? L('تعديل العميل', 'Edit customer') : L('عميل جديد', 'New customer'), size: 'lg',
      body: '<div class="grid g2"><div class="field"><label>' + L('الاسم *', 'Name *') + '</label><input class="input" id="cf-n" value="' + esc(c ? c.name : '') + '"></div><div class="field"><label>' + L('الهاتف / واتساب', 'Phone / WhatsApp') + '</label><input class="input ltr" id="cf-p" inputmode="tel" value="' + esc(c ? c.phone || '' : '') + '"></div>' +
        '<div class="field"><label>' + L('الرقم الضريبي (للشركات)', 'VAT number (companies)') + '</label><input class="input ltr" id="cf-v" value="' + esc(c ? c.vatNo || '' : '') + '"></div>' +
        '<div class="field"><label>' + L('العنوان', 'Address') + '</label><input class="input" id="cf-a" value="' + esc(c ? c.addr || '' : '') + '"></div>' +
        '<div class="field span2"><label>' + L('ملاحظات', 'Notes') + '</label><input class="input" id="cf-o" value="' + esc(c ? c.notes || '' : '') + '"></div></div>' +
        '<div class="section-block mt"><h4>' + icon('car', 18) + L('سياراته', 'His cars') + '</h4><div id="cf-cars"></div><button type="button" class="btn sm soft mt" id="cf-addcar">' + icon('plus', 16) + L('سيارة', 'Car') + '</button></div>',
      foot: '<button type="button" class="btn primary" id="cf-ok">' + L('حفظ', 'Save') + '</button>' });
    var q = function (s) { return m.el.querySelector(s); };
    var F = [['plate', L('اللوحة', 'Plate'), 'ltr'], ['make', L('الشركة', 'Make'), ''], ['model', L('الطراز', 'Model'), ''], ['year', L('السنة', 'Year'), 'ltr'], ['color', L('اللون', 'Colour'), ''], ['vin', L('الشاصي', 'Chassis'), 'ltr']];
    function drawCars() {
      q('#cf-cars').innerHTML = cars.length ? cars.map(function (x, i) {
        return '<div class="car-row" data-ci="' + i + '">' + F.map(function (f) { return '<label class="mini"><span>' + f[1] + '</span><input class="input ' + f[2] + '" data-k="' + f[0] + '" value="' + esc(x[f[0]] || '') + '"></label>'; }).join('') + '<button type="button" class="icon-btn sm red" data-crm>' + icon('trash', 17) + '</button></div>';
      }).join('') : '<p class="small muted">' + L('لا توجد سيارات.', 'No cars.') + '</p>';
    }
    drawCars();
    m.el.addEventListener('input', function (e) { var r = e.target.closest('[data-ci]'); if (r) cars[+r.getAttribute('data-ci')][e.target.getAttribute('data-k')] = e.target.value.trim(); });
    m.el.addEventListener('click', function (e) {
      var r = e.target.closest('[data-ci]');
      if (e.target.closest('#cf-addcar')) { cars.push({ plate: '', make: '', model: '', year: '', color: '', vin: '' }); drawCars(); return; }
      if (r && e.target.closest('[data-crm]')) { cars.splice(+r.getAttribute('data-ci'), 1); drawCars(); }
    });
    q('#cf-ok').onclick = function () {
      var n = q('#cf-n').value.trim();
      if (!n) return C.toast(L('اكتب الاسم', 'Type the name'), 'warn');
      C.busy(q('#cf-ok'), Store.saveCustomer(Object.assign({}, c || {}, { id: c ? c.id : C.uid(), name: n, phone: q('#cf-p').value.trim(), vatNo: q('#cf-v').value.trim(), addr: q('#cf-a').value.trim(), notes: q('#cf-o').value.trim(),
        cars: cars.filter(function (x) { return x.plate || x.make || x.model; }), created: c ? c.created : C.today() })))
        .then(function () { m.close(); if (done) done(); else if (croot && croot.isConnected) draw(); }, function () {});
    };
  }
  function statementText(c, list, st) {
    var ar = C.lang === 'ar', s = S.settings, lines = ['*' + (ar ? s.nameAr : s.name) + '*', (ar ? 'كشف حساب: ' : 'Statement: ') + c.name, '--------------------'];
    list.filter(function (i) { return !i.void && Calc.balance(i) > 0.0004; }).forEach(function (i) { lines.push(i.number + ' · ' + C.fdate(i.date) + (i.car && i.car.plate ? ' · ' + i.car.plate : '') + ' · ' + (ar ? 'المتبقي ' : 'balance ') + f3(Calc.balance(i))); });
    lines.push('--------------------', '*' + (ar ? 'إجمالي المستحق: ' : 'Total due: ') + f3(st.due) + (ar ? ' ر.ع' : ' OMR') + '*');
    if (s.transferNo) lines.push((ar ? 'للدفع بالتحويل: ' : 'To pay by transfer: ') + s.transferNo);
    return lines.join('\n');
  }
  function view(id) {
    var c = Store.byId(S.customers, id); if (!c) return;
    var list = custInvoices(c).sort(function (a, b) { return b.no - a.no; }), st = stats(c), cars = carsOf(c, list);
    var m = C.modal({ title: icon('users') + ' ' + esc(c.name), size: 'lg',
      body: '<div class="stats mb"><div class="stat"><span>' + L('الزيارات', 'Visits') + '</span><b>' + st.n + '</b></div><div class="stat blue"><span>' + L('إجمالي فواتيره', 'Total billed') + '</span><b class="num">' + f3(st.total) + '</b></div><div class="stat red"><span>' + L('المتبقي عليه', 'Owes') + '</span><b class="num">' + f3(st.due) + '</b></div></div>' +
        '<dl class="kv mb">' + (c.phone ? '<dt>' + L('الهاتف', 'Phone') + '</dt><dd class="ltr">' + esc(c.phone) + '</dd>' : '') + (c.addr ? '<dt>' + L('العنوان', 'Address') + '</dt><dd>' + esc(c.addr) + '</dd>' : '') + (c.vatNo ? '<dt>' + L('الرقم الضريبي', 'VAT number') + '</dt><dd class="ltr">' + esc(c.vatNo) + '</dd>' : '') + (c.notes ? '<dt>' + L('ملاحظات', 'Notes') + '</dt><dd>' + esc(c.notes) + '</dd>' : '') + '</dl>' +
        '<h4 class="mb">' + icon('car', 18) + ' ' + L('سياراته', 'His cars') + '</h4>' +
        (cars.length ? '<div class="inv-grid mb">' + cars.map(function (x, i) {
          var k = C.plateKey(x.plate), visits = list.filter(function (j) { return k && C.plateKey(j.car && j.car.plate) === k; });
          var lastKm = visits.filter(function (j) { return j.car.km; })[0];
          return '<div class="inv-card" style="flex-direction:column;gap:6px"><div class="row between"><b class="plate ltr">' + esc(x.plate || '—') + '</b><span class="small muted">' + visits.length + L(' زيارة', ' visit(s)') + '</span></div><div class="nm">' + esc([x.make, x.model, x.year].filter(Boolean).join(' ') || '-') + '</div>' +
            '<span class="meta">' + esc([x.color, x.vin].filter(Boolean).join(' · ')) + (lastKm ? ' · ' + L('آخر عداد ', 'last km ') + esc(lastKm.car.km) : '') + '</span>' +
            (Store.can('sell') ? '<button type="button" class="btn sm soft" data-newjob="' + i + '">' + icon('plus', 16) + L('أمر عمل لهذه السيارة', 'Job card for this car') + '</button>' : '') + '</div>';
        }).join('') + '</div>' : '<p class="muted mb">' + L('لا توجد سيارات.', 'No cars.') + '</p>') +
        '<h4 class="mb">' + L('كشف الحساب', 'Statement of account') + '</h4>' +
        (list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('الفاتورة', 'Bill') + '</th><th>' + L('التاريخ', 'Date') + '</th><th>' + L('السيارة', 'Car') + '</th><th>' + L('الإجمالي', 'Total') + '</th><th>' + L('المدفوع', 'Paid') + '</th><th>' + L('المتبقي', 'Balance') + '</th><th></th></tr></thead><tbody>' +
          list.map(function (i) { var b = Calc.balance(i); return '<tr><td class="ltr"><button type="button" class="link" data-inv="' + esc(i.id) + '">' + esc(i.number) + '</button>' + (i.void ? ' <span class="badge bad">' + L('ملغاة', 'Void') + '</span>' : '') + '</td><td>' + C.fdate(i.date) + '</td><td class="ltr small">' + esc(i.car.plate || '') + '</td><td class="num">' + f3(i.total) + '</td><td class="num">' + f3(Calc.paid(i)) + '</td><td class="num">' + (b > 0.0004 ? '<b style="color:var(--red)">' + f3(b) + '</b>' : '-') + '</td><td class="act">' + (b > 0.0004 && (Store.can('sell') || Store.can('edit_inv')) ? '<button type="button" class="btn sm amber" data-pay="' + esc(i.id) + '">' + L('استلام', 'Receive') + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="muted">' + L('لا توجد فواتير لهذا العميل.', 'No bills for this customer.') + '</p>'),
      foot: (Store.isAdmin() ? '<button type="button" class="btn danger-soft" id="cv-del">' + icon('trash') + '</button>' : '') + (Store.can('customers') ? '<button type="button" class="btn ghost" id="cv-edit">' + icon('edit') + L('تعديل', 'Edit') + '</button>' : '') + '<span class="grow"></span>' +
        (c.phone ? '<button type="button" class="btn ghost" id="cv-msg">' + icon('whatsapp') + L('رسالة', 'Message') + '</button>' : '') +
        (st.due > 0.0004 && c.phone ? '<button type="button" class="btn wa" id="cv-wa">' + icon('whatsapp') + L('إرسال كشف الحساب', 'Send statement') + '</button>' : '') });
    var q = function (s) { return m.el.querySelector(s); };
    m.el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-inv]'))) { m.close(); Jobs.view(b.getAttribute('data-inv')); }
      if ((b = e.target.closest('[data-pay]'))) { m.close(); Jobs.pay(Store.byId(S.invoices, b.getAttribute('data-pay')), function () { if (croot && croot.isConnected) draw(); view(id); }); }
      if ((b = e.target.closest('[data-newjob]'))) { m.close(); Sell.start({ name: c.name, phone: c.phone, car: cars[+b.getAttribute('data-newjob')] }); }
    });
    if (q('#cv-edit')) q('#cv-edit').onclick = function () { m.close(); form(c, function () { draw(); view(id); }); };
    if (q('#cv-wa')) q('#cv-wa').onclick = function () { WhatsApp.text(c.phone, statementText(c, list, st)); };
    if (q('#cv-msg')) q('#cv-msg').onclick = function () { WhatsApp.text(c.phone, ''); };
    if (q('#cv-del')) q('#cv-del').onclick = function () {
      C.confirmBox(L('حذف العميل من القائمة؟ (فواتيره تبقى)', 'Remove the customer from the list? (his bills stay)'), L('حذف', 'Delete'), true).then(function (y) { if (y) Store.removeCustomer(c.id).then(function () { m.close(); draw(); }, function (er) { C.toast(C.errText(er), 'err'); }); });
    };
  }
  Shell.page('customers', {
    title: function () { return L('العملاء والسيارات', 'Customers & cars'); },
    render: function (el) {
      croot = document.createElement('div'); el.appendChild(croot); draw();
      croot.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('#c-new')) return form(null);
        if (e.target.closest('#c-xl')) {
          var M = XLSX.S.MONEY, rows = [[L('العميل', 'Customer'), L('الهاتف', 'Phone'), L('السيارات', 'Cars'), L('الزيارات', 'Visits'), L('آخر زيارة', 'Last visit'), L('إجمالي فواتيره', 'Total billed'), L('عليه', 'Owes')]];
          S.customers.forEach(function (c) { var s = stats(c); rows.push([c.name, c.phone || '', (c.cars || []).map(function (x) { return [x.plate, x.make, x.model].filter(Boolean).join(' '); }).join(' | '), s.n, s.last ? C.fdate(s.last) : '', { v: s.total, s: M }, { v: s.due, s: M }]); });
          return Shell.excel('Garage_Customers', L('العملاء', 'Customers'), rows, [26, 14, 40, 10, 12, 14, 12]);
        }
        if ((b = e.target.closest('tr[data-cid]'))) view(b.getAttribute('data-cid'));
      });
      croot.addEventListener('input', function (e) { if (e.target.id === 'c-q') { cq = e.target.value; croot.querySelector('#c-list').innerHTML = listHtml(); } });
    }
  });
  window.Customers = { view: view, stats: stats };
})();
