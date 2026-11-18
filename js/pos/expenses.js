/* expenses.js - what the garage spends: rent, salaries, power, fuel... and what it BUYS FOR THE STORE.
   An expense can carry store lines (item, quantity, unit cost): then its amount is the sum of those lines and the
   quantities go straight into the store, with the purchase price updated (weighted average). Changing or deleting
   the expense corrects the store by itself (the server does it, js -> api/index.php "put expenses").
   Every expense is either paid or still due (with a due date); due ones show up in Alerts until they are paid. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, P = C.Prod, num = C.num, f3 = C.f3;
  var ef = { month: '', cat: '', st: '', kind: '' }, eroot = null;

  function expCats() {
    var set = {}; (S.settings.expCats || []).forEach(function (c) { set[c] = 1; }); S.expenses.forEach(function (x) { if (x.cat) set[x.cat] = 1; });
    return Object.keys(set);
  }
  function list() {
    return S.expenses.filter(function (x) {
      if (ef.month !== 'all' && String(x.date).slice(0, 7) !== ef.month) return false;
      if (ef.cat && x.cat !== ef.cat) return false;
      if (ef.st === 'due' && x.paid !== false) return false;
      if (ef.st === 'paid' && x.paid === false) return false;
      if (ef.kind === 'store' && !(x.items || []).length) return false;
      if (ef.kind === 'other' && (x.items || []).length) return false;
      return true;
    }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || num(b.created) - num(a.created); });
  }
  function draw() {
    if (!ef.month) ef.month = C.today().slice(0, 7);
    var l = list(), t = C.today(), total = 0, paid = 0, due = 0, store = 0;
    l.forEach(function (x) { var v = num(x.amount); total += v; if (x.paid === false) due += v; else paid += v; if ((x.items || []).length) store += v; });
    var chip = function (key, val, label) { return '<button type="button" class="chip' + (ef[key] === val ? ' on' : '') + '" data-ef="' + key + '" data-v="' + esc(val) + '">' + esc(label) + '</button>'; };
    eroot.innerHTML =
      '<div class="toolbar"><input class="input" type="month" id="e-m" style="width:auto" value="' + (ef.month === 'all' ? '' : esc(ef.month)) + '"><button type="button" class="chip' + (ef.month === 'all' ? ' on' : '') + '" id="e-all">' + L('كل الفترات', 'All time') + '</button>' +
      '<div class="seg"><button type="button" data-st="" class="' + (ef.st === '' ? 'on' : '') + '">' + L('الكل', 'All') + '</button><button type="button" data-st="paid" class="' + (ef.st === 'paid' ? 'on' : '') + '">' + L('مدفوعة', 'Paid') + '</button><button type="button" data-st="due" class="' + (ef.st === 'due' ? 'on' : '') + '">' + L('مستحقة', 'Due') + '</button></div>' +
      '<span class="grow"></span>' + (Store.can('expenses') ? '<button type="button" class="btn soft" id="e-buy">' + icon('truck') + L('مشتريات للمخزن', 'Purchase for the store') + '</button><button type="button" class="btn primary" id="e-new">' + icon('plus') + L('مصروف جديد', 'New expense') + '</button>' : '') + '<button type="button" class="btn ghost" id="e-xl">' + icon('download') + 'Excel</button></div>' +
      '<div class="row wrap mb" style="gap:6px"><span class="small muted">' + L('النوع:', 'Kind:') + '</span>' + chip('kind', '', L('الكل', 'All')) + chip('kind', 'store', L('دخلت المخزن', 'Went into the store')) + chip('kind', 'other', L('مصروفات أخرى', 'Other expenses')) + '</div>' +
      '<div class="row wrap mb" style="gap:6px"><span class="small muted">' + L('البند:', 'Category:') + '</span>' + chip('cat', '', L('الكل', 'All')) + expCats().map(function (c) { return chip('cat', c, c); }).join('') + '</div>' +
      '<div class="stats mb"><div class="stat red"><span>' + icon('wallet', 16) + L('إجمالي المصروفات', 'Total expenses') + '</span><b class="num">' + f3(total) + '</b><small>' + l.length + ' ' + L('مصروف', 'items') + '</small></div>' +
      '<div class="stat green"><span>' + icon('check', 16) + L('المدفوع', 'Paid') + '</span><b class="num">' + f3(paid) + '</b></div>' +
      '<div class="stat amber"><span>' + icon('clock', 16) + L('مستحق لم يُدفع', 'Due, not paid') + '</span><b class="num">' + f3(due) + '</b></div>' +
      '<div class="stat blue"><span>' + icon('box', 16) + L('منها مشتريات للمخزن', 'Of which store purchases') + '</span><b class="num">' + f3(store) + '</b></div></div>' +
      (l.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('التاريخ', 'Date') + '</th><th>' + L('البند', 'Category') + '</th><th>' + L('الوصف', 'Description') + '</th><th>' + L('المبلغ', 'Amount') + '</th><th>' + L('الحالة', 'Status') + '</th><th>' + L('سجّله', 'By') + '</th><th></th></tr></thead><tbody>' +
        l.map(function (x) {
          var late = x.paid === false && x.due && x.due < t, items = x.items || [];
          var st = x.paid === false ? '<span class="badge ' + (late ? 'bad' : 'warn') + '">' + (late ? L('متأخر', 'Late') : L('مستحق', 'Due')) + (x.due ? ' ' + C.fdate(x.due) : '') + '</span>' : '<span class="badge ok">' + L('مدفوع', 'Paid') + ' · ' + esc(C.payName(x.method || 'cash')) + '</span>';
          return '<tr><td class="nowrap">' + C.fdate(x.date) + '</td><td><span class="badge">' + esc(x.cat || '-') + '</span>' + (items.length ? ' <span class="badge blue">' + icon('box', 12) + ' ' + L('للمخزن', 'store') + '</span>' : '') + '</td>' +
            '<td>' + esc(x.title || '') + (x.supplier ? '<div class="small muted">' + esc(x.supplier) + (x.ref ? ' · ' + esc(x.ref) : '') + '</div>' : '') + (items.length ? '<div class="small">' + items.map(function (i) { return esc(i.n) + ' ×' + C.qf(i.q); }).join('، ') + '</div>' : '') + '</td>' +
            '<td class="num"><b>' + f3(x.amount) + '</b></td><td>' + st + '</td><td class="small">' + esc(x.createdBy || '') + '</td>' +
            '<td class="act">' + (Store.can('expenses') ? (x.paid === false ? '<button type="button" class="btn sm amber" data-epay="' + esc(x.id) + '">' + L('تم الدفع', 'Mark paid') + '</button>' : '') + '<button type="button" class="icon-btn sm" data-eedit="' + esc(x.id) + '">' + icon('edit', 18) + '</button><button type="button" class="icon-btn sm red" data-edel="' + esc(x.id) + '">' + icon('trash', 18) + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="card empty">' + icon('wallet', 44) + '<p>' + L('لا توجد مصروفات مطابقة', 'No matching expenses') + '</p></div>');
  }

  /* the expense form. opt.store: start with store lines; opt.pid: start with this store item; opt.done: called after saving */
  function form(x, opt) {
    opt = opt || {};
    var cats = expCats(), isPaid = !x || x.paid !== false, seeCost = Store.can('cost');
    var lines = x && x.items ? x.items.map(function (i) { return { pid: i.pid, q: num(i.q), cost: num(i.cost) }; }) : [];
    if (!x && opt.pid) { var p0 = Store.product(opt.pid); lines.push({ pid: opt.pid, q: 1, cost: p0 ? num(p0.lastCost || p0.cost) : 0 }); }
    var toStore = lines.length > 0 || !!opt.store;
    if (toStore && !lines.length) lines.push({ pid: '', q: 1, cost: 0 });
    var partsList = function () { return S.products.filter(function (p) { return p.kind === 'part'; }).sort(function (a, b) { return String(P.name(a)).localeCompare(String(P.name(b)), 'ar'); }); };
    var m = C.modal({ title: x ? L('تعديل المصروف', 'Edit expense') : (toStore ? L('مشتريات للمخزن', 'Purchase for the store') : L('مصروف جديد', 'New expense')), size: 'lg',
      body: '<div class="col">' +
        (seeCost ? '<label class="switch"><input type="checkbox" id="ef-store"' + (toStore ? ' checked' : '') + '><i></i><span>' + L('هذه مشتريات تدخل المخزن (قطع / مواد)', 'This is a purchase that goes into the store (parts / materials)') + '</span></label>' : '') +
        '<div id="ef-lines"></div>' +
        '<div class="grid g2">' +
        '<div class="field"><label>' + L('البند *', 'Category *') + '</label><input class="input" id="ef-c" list="ef-cats" value="' + esc(x ? x.cat || '' : (toStore ? 'مشتريات للمخزن' : '')) + '" placeholder="' + L('إيجار، رواتب، كهرباء...', 'Rent, salaries, power...') + '"><datalist id="ef-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
        '<div class="field" id="ef-abox"><label>' + L('المبلغ *', 'Amount *') + '</label><input class="input num" id="ef-a" inputmode="decimal" value="' + (x ? f3(x.amount) : '') + '"></div>' +
        '<div class="field"><label>' + L('المورد / الجهة (اختياري)', 'Supplier / paid to (optional)') + '</label><input class="input" id="ef-sup" maxlength="120" value="' + esc(x ? x.supplier || '' : '') + '"></div>' +
        '<div class="field"><label>' + L('رقم فاتورة المورد (اختياري)', "Supplier's bill no. (optional)") + '</label><input class="input ltr" id="ef-ref" maxlength="60" value="' + esc(x ? x.ref || '' : '') + '"></div>' +
        '<div class="field"><label>' + L('التاريخ', 'Date') + '</label><input class="input" type="date" id="ef-d" value="' + esc(x ? x.date : C.today()) + '"></div>' +
        '<div class="field"><label>' + L('الوصف', 'Description') + '</label><input class="input" id="ef-t" maxlength="200" value="' + esc(x ? x.title || '' : '') + '"></div>' +
        '<div class="field span2"><div class="seg" id="ef-st"><button type="button" data-p="1" class="' + (isPaid ? 'on' : '') + '">' + icon('check', 16) + L('مدفوع', 'Paid') + '</button><button type="button" data-p="0" class="' + (isPaid ? '' : 'on') + '">' + icon('clock', 16) + L('مستحق - لم يُدفع بعد', 'Due - not paid yet') + '</button></div></div>' +
        '<div class="field" id="ef-mbox"' + (isPaid ? '' : ' style="display:none"') + '><label>' + L('طريقة الدفع', 'Method') + '</label><select class="input" id="ef-m">' + ['cash', 'transfer', 'card', 'cheque'].map(function (k) { return '<option value="' + k + '"' + (x && x.method === k ? ' selected' : '') + '>' + esc(C.payName(k)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field" id="ef-dbox"' + (isPaid ? ' style="display:none"' : '') + '><label>' + L('تاريخ الاستحقاق (يُذكّرك به في التنبيهات)', 'Due date (shown in Alerts)') + '</label><input class="input" type="date" id="ef-due" value="' + esc(x && x.due ? x.due : '') + '"></div></div></div>',
      foot: '<button type="button" class="btn primary lg" id="ef-ok">' + icon('check') + L('حفظ', 'Save') + '</button>' });
    var q = function (s) { return m.el.querySelector(s); };
    function sum() { return C.r3(lines.reduce(function (t, l) { return t + C.r3(num(l.q) * num(l.cost)); }, 0)); }
    function drawLines() {
      var box = q('#ef-lines'), opts = partsList();
      q('#ef-abox').style.display = toStore ? 'none' : '';
      if (!toStore) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="section-block"><h4>' + icon('box', 18) + L('ما تم شراؤه (يدخل المخزن)', 'What was bought (goes into the store)') + '</h4>' +
        (opts.length ? '' : '<div class="note warn mb">' + L('لا توجد أصناف في المخزن بعد. اضغط «صنف جديد» لإضافة أول صنف.', 'There are no store items yet. Press "New item" to add the first one.') + '</div>') +
        lines.map(function (l, i) {
          var p = l.pid ? Store.product(l.pid) : null;
          return '<div class="buy-line" data-li="' + i + '"><select class="input" data-k="pid"><option value="">' + L('اختر الصنف...', 'Choose the item...') + '</option>' + opts.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === l.pid ? ' selected' : '') + '>' + esc(P.name(o)) + (o.unit ? ' (' + esc(P.unit(o)) + ')' : '') + ' - ' + L('المتوفر ', 'left ') + C.qf(o.stock) + '</option>'; }).join('') + '</select>' +
            '<label class="mini"><span>' + L('الكمية', 'Qty') + '</span><input class="input num" data-k="q" inputmode="decimal" value="' + C.qf(l.q) + '"></label>' +
            '<label class="mini"><span>' + L('سعر الوحدة', 'Unit cost') + '</span><input class="input num" data-k="cost" inputmode="decimal" value="' + (num(l.cost) ? f3(l.cost) : '') + '" placeholder="0.000"></label>' +
            '<b class="num lt">' + f3(C.r3(num(l.q) * num(l.cost))) + '</b><button type="button" class="icon-btn sm red" data-lrm aria-label="remove">' + icon('trash', 17) + '</button>' +
            (p && num(p.lastCost) ? '<span class="small muted span-all">' + L('آخر سعر شراء: ', 'Last cost: ') + f3(p.lastCost) + '</span>' : '') + '</div>';
        }).join('') +
        '<div class="row between wrap mt"><span class="row"><button type="button" class="btn sm soft" id="ef-add">' + icon('plus', 16) + L('سطر آخر', 'Another line') + '</button>' + (Store.can('stock') ? '<button type="button" class="btn sm ghost" id="ef-newitem">' + icon('box', 16) + L('صنف جديد', 'New item') + '</button>' : '') + '</span>' +
        '<span class="tot-row big" style="gap:12px"><span>' + L('المجموع', 'Total') + '</span><span class="num" id="ef-sum">' + C.money(sum()) + '</span></span></div></div>';
    }
    drawLines();
    m.el.addEventListener('click', function (e) {
      var b, row = e.target.closest('[data-li]');
      if ((b = e.target.closest('#ef-st [data-p]'))) {
        isPaid = b.getAttribute('data-p') === '1';
        [].forEach.call(q('#ef-st').children, function (c) { c.classList.toggle('on', c === b); });
        q('#ef-mbox').style.display = isPaid ? '' : 'none'; q('#ef-dbox').style.display = isPaid ? 'none' : '';
        return;
      }
      if (e.target.closest('#ef-add')) { lines.push({ pid: '', q: 1, cost: 0 }); drawLines(); return; }
      if (e.target.closest('#ef-newitem')) { StorePage.form(null, 'part', function (d) { var empty = lines.filter(function (l) { return !l.pid; })[0]; if (empty) { empty.pid = d.id; empty.cost = num(d.cost); } else lines.push({ pid: d.id, q: 1, cost: num(d.cost) }); drawLines(); }); return; }
      if (row && e.target.closest('[data-lrm]')) { lines.splice(+row.getAttribute('data-li'), 1); if (!lines.length) lines.push({ pid: '', q: 1, cost: 0 }); drawLines(); }
    });
    m.el.addEventListener('input', function (e) {
      var row = e.target.closest('[data-li]'); if (!row) return;
      var l = lines[+row.getAttribute('data-li')], k = e.target.getAttribute('data-k');
      if (k === 'q' || k === 'cost') { l[k] = num(e.target.value); row.querySelector('.lt').textContent = f3(C.r3(num(l.q) * num(l.cost))); q('#ef-sum').textContent = C.money(sum()); }
    });
    m.el.addEventListener('change', function (e) {
      if (e.target.id === 'ef-store') {
        toStore = e.target.checked;
        if (toStore && !lines.length) lines.push({ pid: '', q: 1, cost: 0 });
        if (toStore && !q('#ef-c').value.trim()) q('#ef-c').value = 'مشتريات للمخزن';
        drawLines(); return;
      }
      var row = e.target.closest('[data-li]');
      if (row && e.target.getAttribute('data-k') === 'pid') {
        var l = lines[+row.getAttribute('data-li')], p = Store.product(e.target.value);
        l.pid = e.target.value; if (p && !num(l.cost)) l.cost = num(p.lastCost || p.cost);
        drawLines();
      }
    });
    q('#ef-ok').onclick = function () {
      var cat = q('#ef-c').value.trim(), items = [];
      if (!cat) return C.toast(L('اكتب البند', 'Type the category'), 'warn');
      if (toStore) {
        items = lines.filter(function (l) { return l.pid; }).map(function (l) { return { pid: l.pid, q: C.r3(num(l.q)), cost: num(l.cost) }; });
        if (!items.length) return C.toast(L('اختر صنفاً واحداً على الأقل', 'Choose at least one item'), 'warn');
        if (items.some(function (l) { return l.q <= 0; })) return C.toast(L('اكتب الكمية لكل صنف', 'Type the quantity of every item'), 'warn');
      }
      var a = toStore ? C.r3(items.reduce(function (t, l) { return t + C.r3(l.q * l.cost); }, 0)) : num(q('#ef-a').value);
      if (a <= 0) return C.toast(toStore ? L('اكتب سعر الوحدة', 'Type the unit cost') : L('اكتب المبلغ', 'Type the amount'), 'warn');
      var doc = Object.assign({}, x || {}, { id: x ? x.id : C.uid(), cat: cat, amount: a, items: items, supplier: q('#ef-sup').value.trim(), ref: q('#ef-ref').value.trim(), date: q('#ef-d').value || C.today(),
        method: q('#ef-m').value, title: q('#ef-t').value.trim(), paid: isPaid, due: isPaid ? '' : q('#ef-due').value, paidOn: isPaid ? (x && x.paidOn) || '' : '' });
      var job = Store.saveExpense(doc);
      if ((S.settings.expCats || []).indexOf(cat) < 0 && Store.isAdmin()) job = job.then(function (r) { return Store.saveSettings({ expCats: (S.settings.expCats || []).concat([cat]) }).then(function () { return r; }); });   // a new category is kept for next time
      C.busy(q('#ef-ok'), job).then(function () {
        m.close(); C.toast(toStore ? L('تم الحفظ ودخلت الكميات المخزن', 'Saved; the quantities went into the store') : L('تم الحفظ', 'Saved'));
        Shell.refreshNav();
        if (opt.done) opt.done(); else if (eroot && eroot.isConnected) draw();
      }, function () {});
    };
  }
  function markPaid(x) {
    var m = C.modal({ title: L('تسجيل دفع: ', 'Record payment: ') + esc(x.cat || ''), size: 'sm',
      body: '<div class="col"><div class="note warn">' + L('المبلغ: ', 'Amount: ') + '<b class="num">' + C.money(x.amount) + '</b></div><div class="field"><label>' + L('تاريخ الدفع', 'Paid on') + '</label><input class="input" type="date" id="ep-d" value="' + C.today() + '"></div><div class="field"><label>' + L('طريقة الدفع', 'Method') + '</label><select class="input" id="ep-m">' + ['cash', 'transfer', 'card', 'cheque'].map(function (k) { return '<option value="' + k + '">' + esc(C.payName(k)) + '</option>'; }).join('') + '</select></div></div>',
      foot: '<button type="button" class="btn primary" id="ep-ok">' + icon('check') + L('تم الدفع', 'Paid') + '</button>' });
    m.el.querySelector('#ep-ok').onclick = function () {
      C.busy(this, Store.saveExpense(Object.assign({}, x, { paid: true, paidOn: m.el.querySelector('#ep-d').value || C.today(), method: m.el.querySelector('#ep-m').value }))).then(function () { m.close(); Shell.refreshNav(); if (eroot && eroot.isConnected) draw(); }, function () {});
    };
  }

  Shell.page('expenses', {
    title: function () { return L('المصروفات', 'Expenses'); },
    render: function (el, arg) {
      eroot = document.createElement('div'); el.appendChild(eroot);
      if (arg && arg.open) { ef.month = 'all'; ef.st = 'due'; }
      draw();
      if (arg && arg.open && Store.byId(S.expenses, arg.open) && Store.can('expenses')) markPaid(Store.byId(S.expenses, arg.open));
      eroot.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('#e-new')) return form(null);
        if (e.target.closest('#e-buy')) return form(null, { store: true });
        if (e.target.closest('#e-all')) { ef.month = 'all'; return draw(); }
        if ((b = e.target.closest('[data-ef]'))) { ef[b.getAttribute('data-ef')] = b.getAttribute('data-v'); return draw(); }
        if ((b = e.target.closest('[data-st]'))) { ef.st = b.getAttribute('data-st'); return draw(); }
        if (e.target.closest('#e-xl')) {
          var rows = [[L('التاريخ', 'Date'), L('البند', 'Category'), L('الوصف', 'Description'), L('المورد', 'Supplier'), L('الأصناف', 'Items'), L('المبلغ', 'Amount'), L('الحالة', 'Status'), L('الاستحقاق', 'Due'), L('طريقة الدفع', 'Method'), L('سجّله', 'By')]];
          list().forEach(function (x) { rows.push([C.fdate(x.date), x.cat, x.title, x.supplier || '', (x.items || []).map(function (i) { return i.n + ' ×' + C.qf(i.q); }).join(' | '), { v: num(x.amount), s: XLSX.S.MONEY }, x.paid === false ? L('مستحق', 'Due') : L('مدفوع', 'Paid'), x.due ? C.fdate(x.due) : '', x.paid === false ? '' : C.payName(x.method || 'cash'), x.createdBy || '']); });
          return Shell.excel('Garage_Expenses', L('المصروفات', 'Expenses'), rows, [12, 18, 30, 18, 40, 12, 10, 12, 14, 16]);
        }
        if ((b = e.target.closest('[data-epay]'))) return markPaid(Store.byId(S.expenses, b.getAttribute('data-epay')));
        if ((b = e.target.closest('[data-eedit]'))) return form(Store.byId(S.expenses, b.getAttribute('data-eedit')));
        if ((b = e.target.closest('[data-edel]'))) {
          var x = Store.byId(S.expenses, b.getAttribute('data-edel'));
          C.confirmBox(L('حذف هذا المصروف؟', 'Delete this expense?') + ((x.items || []).length ? ' ' + L('الكميات التي أدخلها المخزن ستُخصم منه.', 'The quantities it put into the store will be taken out again.') : ''), L('حذف', 'Delete'), true).then(function (y) { if (y) Store.removeExpense(x.id).then(function () { draw(); Shell.refreshNav(); }, function (er) { C.toast(C.errText(er), 'err'); }); });
        }
      });
      eroot.addEventListener('change', function (e) { if (e.target.id === 'e-m' && e.target.value) { ef.month = e.target.value; draw(); } });
    }
  });
  window.Expenses = { form: form, markPaid: markPaid };
})();
