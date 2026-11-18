/* reports.js - the numbers of a chosen period.
   Bills: count, total billed, collected, still owed, discounts, VAT. Profit & loss (for whoever may see costs):
   income = bills without VAT and after discount; cost = what the parts used on those bills cost (store price at the time)
   + the costs typed on free lines; gross profit = income - cost; running expenses = expenses WITHOUT store lines.
   Purchases for the store are NOT taken off the profit when they are bought (that would count them twice): they become
   cost when the parts are used on a bill. Also: work / parts / materials, service types, technicians, workers, payment
   methods, the best services and parts, insurance, expenses by category. Everything to Excel. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, Calc = C.Calc, num = C.num, f3 = C.f3;
  var per = { k: 'month', from: '', to: '' }, root = null;

  function range() {
    var t = C.today(), y = t.slice(0, 4), m = t.slice(0, 7);
    if (per.k === 'today') return [t, t];
    if (per.k === 'week') return [C.addDays(t, -6), t];
    if (per.k === 'month') return [m + '-01', t];
    if (per.k === 'last') { var d = C.addMonths(m + '-01', -1); return [d, C.addDays(m + '-01', -1)]; }
    if (per.k === 'year') return [y + '-01-01', t];
    return [per.from || '0000-00-00', per.to || '9999-99-99'];
  }
  function inR(d, r) { return d >= r[0] && d <= r[1]; }
  function add(map, k, v, n) { map[k] = map[k] || { v: 0, n: 0 }; map[k].v = C.r3(map[k].v + v); map[k].n += n === undefined ? 1 : n; }
  function sorted(map) { return Object.keys(map).map(function (k) { return { k: k, v: map[k].v, n: map[k].n }; }).sort(function (a, b) { return b.v - a.v; }); }

  function compute() {
    var r = range(), cost = Store.sees('cost');
    var bills = S.invoices.filter(function (i) { return !i.void && inR(i.date, r); });
    var o = { r: r, n: bills.length, total: 0, sub: 0, disc: 0, vat: 0, paidOnBills: 0, due: 0, cost: 0, income: 0, collected: 0,
      grp: {}, svc: {}, tech: {}, worker: {}, methods: {}, items: {}, jobsBySvc: {}, exp: {}, expTotal: 0, purchases: 0, cars: {} };
    bills.forEach(function (i) {
      o.total += num(i.total); o.sub += num(i.sub); o.disc += num(i.discount); o.vat += num(i.vat); o.paidOnBills += Calc.paid(i); o.due += Calc.balance(i);
      o.income += num(i.sub) - num(i.discount); if (cost) o.cost += Calc.cost(i);
      add(o.worker, i.createdBy || '-', num(i.total));
      (i.doneBy ? String(i.doneBy).split(/[،,+\/]| و /).map(function (x) { return x.trim(); }).filter(Boolean) : ['-']).forEach(function (t, k, arr) { add(o.tech, t, C.r3(num(i.total) / arr.length)); });
      (i.svc && i.svc.length ? i.svc : ['none']).forEach(function (s) { add(o.jobsBySvc, s, num(i.total)); });
      var pk = C.plateKey(i.car && i.car.plate); if (pk) o.cars[pk] = 1;
      i.items.forEach(function (it) {
        var amt = Calc.line(it), g = it.grp || (it.kind === 'service' ? 'work' : 'part');
        add(o.grp, g, amt);
        if (g === 'work') { var p = it.pid ? Store.product(it.pid) : null; add(o.svc, p ? p.cat || 'other' : 'other', amt); }
        add(o.items, (it.kind === 'manual' ? '✎ ' : '') + it.n, amt, num(it.q));
      });
    });
    S.invoices.forEach(function (i) { if (!i.void) (i.payments || []).forEach(function (p) { if (inR(p.date, r)) { o.collected += num(p.amount); add(o.methods, p.method, num(p.amount)); } }); });
    S.expenses.forEach(function (x) {
      if (!inR(x.date, r)) return;
      if ((x.items || []).length) { o.purchases += num(x.amount); return; }
      o.expTotal += num(x.amount); add(o.exp, x.cat || '-', num(x.amount));
    });
    var claims = S.claims.filter(function (c) { return inR(C.ymd(new Date((c.created || 0) * 1000)), r); });
    o.ins = { opened: claims.length, approved: claims.reduce(function (t, c) { return t + num(c.approved); }, 0),
      received: S.claims.reduce(function (t, c) { return t + (c.payments || []).filter(function (p) { return inR(p.date, r); }).reduce(function (s, p) { return s + num(p.amount); }, 0); }, 0),
      owed: S.claims.reduce(function (t, c) { return t + Insurance.owedBy(c); }, 0) };
    ['total', 'sub', 'disc', 'vat', 'paidOnBills', 'due', 'cost', 'income', 'collected', 'expTotal', 'purchases'].forEach(function (k) { o[k] = C.r3(o[k]); });
    o.gross = C.r3(o.income - o.cost); o.net = C.r3(o.gross - o.expTotal);
    return o;
  }
  function table(title, ic, rows, cols, empty) {
    return '<div class="card"><h3>' + icon(ic) + title + '</h3>' + (rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '<p class="muted small">' + (empty || L('لا توجد بيانات في هذه الفترة.', 'No data in this period.')) + '</p>') + '</div>';
  }
  function bar(v, max) { return '<div class="bar" style="min-width:60px"><i style="width:' + (max > 0 ? Math.max(2, v / max * 100) : 0) + '%"></i></div>'; }
  function draw() {
    var o = compute(), cost = Store.sees('cost'), r = o.r;
    var GN = { work: L('الأعمال والأجور', 'Work / labour'), part: L('قطع الغيار', 'Spare parts'), mat: L('المواد', 'Materials') };
    var svcRows = sorted(o.svc), maxS = svcRows.length ? svcRows[0].v : 0;
    root.innerHTML = '<div class="toolbar"><div class="chips">' + [['today', L('اليوم', 'Today')], ['week', L('7 أيام', '7 days')], ['month', L('هذا الشهر', 'This month')], ['last', L('الشهر الماضي', 'Last month')], ['year', L('هذه السنة', 'This year')], ['custom', L('فترة محددة', 'Custom')]].map(function (x) { return '<button type="button" class="chip' + (per.k === x[0] ? ' on' : '') + '" data-k="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (per.k === 'custom' ? '<input type="date" class="input" id="r-from" style="width:auto" value="' + esc(per.from) + '"><span>-</span><input type="date" class="input" id="r-to" style="width:auto" value="' + esc(per.to) + '">' : '') +
      '<span class="grow"></span><button type="button" class="btn ghost" id="r-print">' + icon('print') + L('طباعة', 'Print') + '</button><button type="button" class="btn ghost" id="r-xl">' + icon('download') + 'Excel</button></div>' +
      '<p class="small muted mb">' + L('الفترة: ', 'Period: ') + C.fdate(r[0]) + ' - ' + C.fdate(r[1]) + '</p>' +
      '<div class="stats mb"><div class="stat"><span>' + icon('car', 16) + L('أوامر العمل', 'Job cards') + '</span><b>' + o.n + '</b><small>' + Object.keys(o.cars).length + L(' سيارة', ' cars') + '</small></div>' +
      '<div class="stat blue"><span>' + icon('receipt', 16) + L('إجمالي الفواتير', 'Total billed') + '</span><b class="num">' + f3(o.total) + '</b></div>' +
      '<div class="stat green"><span>' + icon('money', 16) + L('المحصّل في الفترة', 'Collected in the period') + '</span><b class="num">' + f3(o.collected) + '</b></div>' +
      '<div class="stat red"><span>' + icon('clock', 16) + L('متبقٍ من فواتير الفترة', 'Still owed on these bills') + '</span><b class="num">' + f3(o.due) + '</b></div></div>' +
      (cost ? '<div class="card mb pl"><h3>' + icon('chart') + L('الأرباح والخسائر', 'Profit & loss') + '</h3><dl class="kv">' +
        '<dt>' + L('الإيرادات (بعد الخصم، بدون الضريبة)', 'Income (after discount, without VAT)') + '</dt><dd class="num">' + f3(o.income) + '</dd>' +
        '<dt>' + L('تكلفة القطع والمواد المستخدمة', 'Cost of the parts & materials used') + '</dt><dd class="num">-' + f3(o.cost) + '</dd>' +
        '<dt><b>' + L('الربح الإجمالي', 'Gross profit') + '</b></dt><dd class="num"><b>' + f3(o.gross) + '</b></dd>' +
        '<dt>' + L('المصروفات التشغيلية (إيجار، رواتب...)', 'Running expenses (rent, salaries...)') + '</dt><dd class="num">-' + f3(o.expTotal) + '</dd>' +
        '<dt style="font-size:17px;color:var(--ink)"><b>' + L('صافي الربح', 'Net profit') + '</b></dt><dd class="num" style="font-size:20px;color:' + (o.net >= 0 ? 'var(--ok)' : 'var(--red)') + '">' + C.money(o.net) + '</dd></dl>' +
        '<p class="small muted mt">' + L('مشتريات المخزن في الفترة: ', 'Store purchases in the period: ') + '<b class="num">' + f3(o.purchases) + '</b> - ' + L('لا تُخصم هنا عند شرائها، بل تُحسب تكلفةً عندما تُستخدم القطع في الفواتير (حتى لا تُحسب مرتين).', 'not taken off here when bought; they count as cost when the parts are used on bills (so they are never counted twice).') +
        (o.vat > 0 ? ' ' + L('الضريبة المحصّلة: ', 'VAT charged: ') + '<b class="num">' + f3(o.vat) + '</b>.' : '') + (o.disc > 0 ? ' ' + L('الخصومات: ', 'Discounts: ') + '<b class="num">' + f3(o.disc) + '</b>.' : '') + '</p></div>' : '') +
      '<div class="grid g2">' +
      table(L('الأعمال والقطع والمواد', 'Work, parts & materials'), 'list', ['work', 'part', 'mat'].filter(function (k) { return o.grp[k]; }).map(function (k) { return '<tr><td>' + GN[k] + '</td><td class="num">' + o.grp[k].n + '</td><td class="num"><b>' + f3(o.grp[k].v) + '</b></td></tr>'; }), [L('النوع', 'Kind'), L('عدد البنود', 'Lines'), L('المبلغ', 'Amount')]) +
      table(L('حسب نوع الخدمة', 'By type of service'), 'wrench', svcRows.map(function (x) { return '<tr><td>' + esc(C.svcName(x.k)) + '</td><td class="num"><b>' + f3(x.v) + '</b></td><td>' + bar(x.v, maxS) + '</td></tr>'; }), [L('النوع', 'Type'), L('مبلغ الأعمال', 'Work amount'), ''], L('تظهر هنا الأعمال المختارة من قائمة الخدمات.', 'Work picked from the services list shows here.')) +
      table(L('أوامر العمل حسب نوع الخدمة المؤشَّر', 'Job cards by the service type ticked'), 'car', sorted(o.jobsBySvc).map(function (x) { return '<tr><td>' + (x.k === 'none' ? L('غير محدد', 'Not set') : esc(C.svcName(x.k))) + '</td><td class="num">' + x.n + '</td><td class="num">' + f3(x.v) + '</td></tr>'; }), [L('النوع', 'Type'), L('العدد', 'Count'), L('إجمالي فواتيرها', 'Their total')]) +
      table(L('حسب الفني', 'By technician'), 'wrench', sorted(o.tech).map(function (x) { return '<tr><td>' + (x.k === '-' ? L('غير محدد', 'Not set') : esc(x.k)) + '</td><td class="num">' + x.n + '</td><td class="num">' + f3(x.v) + '</td></tr>'; }), [L('الفني', 'Technician'), L('أوامر العمل', 'Job cards'), L('المبلغ', 'Amount')]) +
      table(L('حسب الموظف الذي أنشأ الفاتورة', 'By the worker who made the bill'), 'users', sorted(o.worker).map(function (x) { return '<tr><td>' + esc(x.k) + '</td><td class="num">' + x.n + '</td><td class="num">' + f3(x.v) + '</td></tr>'; }), [L('الموظف', 'Worker'), L('الفواتير', 'Bills'), L('المبلغ', 'Amount')]) +
      table(L('المحصّل حسب طريقة الدفع', 'Collected by payment method'), 'money', sorted(o.methods).map(function (x) { return '<tr><td>' + esc(C.payName(x.k)) + '</td><td class="num">' + x.n + '</td><td class="num"><b>' + f3(x.v) + '</b></td></tr>'; }), [L('الطريقة', 'Method'), L('الدفعات', 'Payments'), L('المبلغ', 'Amount')]) +
      table(L('الأكثر دخلاً (خدمات وقطع)', 'Top earners (services & parts)'), 'star', sorted(o.items).slice(0, 15).map(function (x) { return '<tr><td>' + esc(x.k) + '</td><td class="num">' + C.qf(x.n) + '</td><td class="num">' + f3(x.v) + '</td></tr>'; }), [L('البند', 'Line'), L('الكمية', 'Qty'), L('المبلغ', 'Amount')]) +
      (Store.sees('expenses') || Store.sees('reports') ? table(L('المصروفات التشغيلية حسب البند', 'Running expenses by category'), 'wallet', sorted(o.exp).map(function (x) { return '<tr><td>' + esc(x.k) + '</td><td class="num">' + x.n + '</td><td class="num">' + f3(x.v) + '</td></tr>'; }), [L('البند', 'Category'), L('العدد', 'Count'), L('المبلغ', 'Amount')]) : '') +
      '<div class="card"><h3>' + icon('shield') + L('التأمين', 'Insurance') + '</h3><dl class="kv"><dt>' + L('ملفات فُتحت في الفترة', 'Cases opened in the period') + '</dt><dd>' + o.ins.opened + '</dd><dt>' + L('الموافَق عليه لها', 'Approved for them') + '</dt><dd class="num">' + f3(o.ins.approved) + '</dd><dt>' + L('استُلم من الشركات في الفترة', 'Received from insurers in the period') + '</dt><dd class="num" style="color:var(--ok)">' + f3(o.ins.received) + '</dd><dt>' + L('المتبقي على الشركات (كل الملفات)', 'Still owed by insurers (all cases)') + '</dt><dd class="num" style="color:var(--red)">' + f3(o.ins.owed) + '</dd></dl></div>' +
      '</div>';
    return o;
  }
  function excel(o) {
    var M = XLSX.S.MONEY, cost = Store.sees('cost'), rows = [[L('البند', 'Item'), L('القيمة', 'Value')]];
    rows.push([L('الفترة', 'Period'), C.fdate(o.r[0]) + ' - ' + C.fdate(o.r[1])], [L('أوامر العمل', 'Job cards'), o.n], [L('إجمالي الفواتير', 'Total billed'), { v: o.total, s: M }], [L('المحصّل في الفترة', 'Collected'), { v: o.collected, s: M }], [L('المتبقي', 'Still owed'), { v: o.due, s: M }], [L('الخصومات', 'Discounts'), { v: o.disc, s: M }], [L('الضريبة', 'VAT'), { v: o.vat, s: M }]);
    if (cost) rows.push([L('الإيرادات', 'Income'), { v: o.income, s: M }], [L('تكلفة القطع', 'Cost of parts'), { v: o.cost, s: M }], [L('الربح الإجمالي', 'Gross profit'), { v: o.gross, s: M }], [L('المصروفات التشغيلية', 'Running expenses'), { v: o.expTotal, s: M }], [L('صافي الربح', 'Net profit'), { v: o.net, s: M }], [L('مشتريات المخزن', 'Store purchases'), { v: o.purchases, s: M }]);
    rows.push(['', '']);
    sorted(o.svc).forEach(function (x) { rows.push([L('خدمات: ', 'Services: ') + C.svcName(x.k), { v: x.v, s: M }]); });
    sorted(o.tech).forEach(function (x) { rows.push([L('الفني: ', 'Technician: ') + x.k, { v: x.v, s: M }]); });
    sorted(o.methods).forEach(function (x) { rows.push([L('الدفع: ', 'Payment: ') + C.payName(x.k), { v: x.v, s: M }]); });
    sorted(o.exp).forEach(function (x) { rows.push([L('مصروف: ', 'Expense: ') + x.k, { v: x.v, s: M }]); });
    Shell.excel('Garage_Report', L('التقرير', 'Report'), rows, [46, 18]);
  }
  Shell.page('reports', {
    title: function () { return L('التقارير', 'Reports'); },
    render: function (el) {
      root = document.createElement('div'); el.appendChild(root);
      var last = draw();
      root.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-k]'))) { per.k = b.getAttribute('data-k'); last = draw(); return; }
        if (e.target.closest('#r-xl')) { excel(last); return; }
        if (e.target.closest('#r-print')) {
          var s = S.settings, clone = root.cloneNode(true); [].forEach.call(clone.querySelectorAll('.toolbar, button'), function (x) { x.remove(); });
          Print.paper('<div class="pa" dir="' + (C.lang === 'ar' ? 'rtl' : 'ltr') + '"><h2 style="text-align:center">' + esc(L(s.nameAr, s.name)) + ' - ' + L('تقرير', 'Report') + '</h2>' + clone.innerHTML + '</div><style>.pa .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.pa .stat,.pa .card{border:1px solid #c3dad5;border-radius:6px;padding:6px 8px;margin-bottom:6px;break-inside:avoid}.pa .grid.g2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pa table{width:100%;border-collapse:collapse;font-size:9pt}.pa td,.pa th{border-bottom:1px solid #dde;padding:3px;text-align:start}.pa .kv{display:grid;grid-template-columns:1fr auto;gap:2px 10px}.pa .bar{display:none}.pa h3{font-size:11pt}.pa .stat b{display:block;font-size:13pt}.pa svg{display:none}</style>', 'a4');
        }
      });
      root.addEventListener('change', function (e) { if (e.target.id === 'r-from') { per.from = e.target.value; last = draw(); } if (e.target.id === 'r-to') { per.to = e.target.value; last = draw(); } });
    }
  });
})();
