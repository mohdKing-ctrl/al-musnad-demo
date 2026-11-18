/* store.js - two pages:
     store    "Store & purchases": the spare parts and materials (paint, filler, oils, filters, electrical...) with how much
              is left, the purchases that filled the store (they are expenses with store lines - js/pos/expenses.js), and every
              movement: used on a job card, used in the workshop, counted, corrected.
     services "Services & prices": the price list of the work the garage does (denting, painting, mechanical, electrical...).
              A service with no price is priced on each job card. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, P = C.Prod, num = C.num, f3 = C.f3;

  /* ================================================== store */
  var sf = { tab: 'items', q: '', cat: '', st: '' }, root = null;
  function parts() { return S.products.filter(function (p) { return p.kind === 'part'; }); }
  function itemList() {
    var q = C.norm(sf.q);
    return parts().filter(function (p) {
      if (sf.cat && p.cat !== sf.cat) return false;
      if (sf.st === 'low' && !(P.low(p) || P.out(p))) return false;
      if (sf.st === 'out' && !P.out(p)) return false;
      return !q || C.norm([p.name, p.nameEn, p.sku, p.supplier].join(' ')).indexOf(q) >= 0;
    }).sort(P.newestFirst);
  }
  function itemsHtml() {
    var all = parts(), list = itemList(), cost = Store.sees('cost');
    var value = all.reduce(function (t, p) { return t + Math.max(0, num(p.stock)) * num(p.cost); }, 0);
    var low = all.filter(function (p) { return P.low(p) && !P.out(p); }).length, out = all.filter(P.out).length;
    var head = '<div class="stats mb"><div class="stat"><span>' + icon('box', 16) + L('أصناف المخزن', 'Store items') + '</span><b>' + all.length + '</b></div>' +
      '<div class="stat amber"><span>' + icon('alert', 16) + L('منخفضة', 'Low') + '</span><b>' + low + '</b></div><div class="stat red"><span>' + icon('alert', 16) + L('نافدة', 'Out') + '</span><b>' + out + '</b></div>' +
      (cost ? '<div class="stat blue"><span>' + icon('money', 16) + L('قيمة المخزن (بسعر الشراء)', 'Store value (at cost)') + '</span><b class="num">' + f3(value) + '</b></div>' : '') + '</div>';
    if (!all.length) return head + '<div class="card empty">' + icon('box', 44) + '<p>' + L('المخزن فارغ. أضف قطع الغيار والمواد (مواد الصبغ، المعجون، الزيوت...) لتعرف كم بقي منها، أو سجّل مشترياتك من «مشتريات جديدة» فتدخل المخزن مباشرة.', 'The store is empty. Add spare parts and materials (paint, filler, oils...) to know how much is left, or record your purchases with "New purchase" so they go straight into the store.') + '</p></div>';
    var cats = S.settings.partCats || [];
    return head + '<div class="row wrap mb" style="gap:6px"><div class="chips"><button type="button" class="chip' + (sf.cat ? '' : ' on') + '" data-cat="">' + L('الكل', 'All') + '</button>' + cats.map(function (c) { return '<button type="button" class="chip' + (sf.cat === c.id ? ' on' : '') + '" data-cat="' + esc(c.id) + '">' + esc(C.catName(c)) + '</button>'; }).join('') + '</div>' +
      '<select class="input" id="st-st" style="width:auto"><option value="">' + L('كل الكميات', 'All quantities') + '</option><option value="low"' + (sf.st === 'low' ? ' selected' : '') + '>' + L('منخفضة أو نافدة', 'Low or out') + '</option><option value="out"' + (sf.st === 'out' ? ' selected' : '') + '>' + L('نافدة', 'Out') + '</option></select></div>' +
      (list.length ? '<div class="inv-grid">' + list.map(function (p) {
        var cls = P.out(p) ? 'bad' : P.low(p) ? 'warn' : 'ok';
        return '<button type="button" class="inv-card" data-item="' + esc(p.id) + '">' + Media.thumb(p.img, P.name(p), '#167f72', 'thumb lg') +
          '<span class="grow"><span class="nm">' + esc(P.name(p)) + '</span><br><span class="meta">' + esc(C.catName(C.catOf(cats, p.cat))) + (p.sku ? ' · <span class="ltr">' + esc(p.sku) + '</span>' : '') + '</span>' +
          '<div class="q"><span class="badge ' + cls + '">' + L('المتوفر: ', 'Left: ') + C.qf(p.stock) + ' ' + esc(P.unit(p)) + '</span></div>' +
          '<span class="meta">' + L('البيع: ', 'Sell: ') + '<b class="num">' + f3(p.price) + '</b>' + (cost ? ' · ' + L('الشراء: ', 'Cost: ') + '<span class="num">' + f3(p.cost) + '</span>' : '') + '</span></span></button>';
      }).join('') + '</div>' : '<div class="card empty">' + icon('search', 40) + '<p>' + L('لا توجد نتائج', 'No results') + '</p></div>');
  }
  function purchases() { return S.expenses.filter(function (x) { return (x.items || []).length; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || num(b.created) - num(a.created); }); }
  function purchasesHtml() {
    if (!Store.sees('expenses')) return '<div class="note">' + L('عرض المشتريات يحتاج صلاحية «المصروفات والمشتريات».', 'Seeing purchases needs the "Expenses & purchases" permission.') + '</div>';
    var list = purchases(), cost = Store.sees('cost');
    var month = C.today().slice(0, 7), mTotal = list.filter(function (x) { return String(x.date).slice(0, 7) === month; }).reduce(function (t, x) { return t + num(x.amount); }, 0);
    var due = list.filter(function (x) { return x.paid === false; }).reduce(function (t, x) { return t + num(x.amount); }, 0);
    return '<div class="note mb">' + icon('swap', 18) + '<span>' + L('كل مشترى للمخزن هو مصروف أيضاً: يُسجَّل في «المصروفات» ويدخل المخزن مباشرة. تعديله أو حذفه يعدّل المخزن تلقائياً.', 'Every purchase for the store is also an expense: it appears under "Expenses" and goes straight into the store. Changing or deleting it corrects the store automatically.') + '</span></div>' +
      '<div class="stats mb"><div class="stat red"><span>' + L('مشتريات هذا الشهر', 'Purchases this month') + '</span><b class="num">' + f3(mTotal) + '</b></div><div class="stat amber"><span>' + L('مستحق للموردين', 'Owed to suppliers') + '</span><b class="num">' + f3(due) + '</b></div></div>' +
      (list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('التاريخ', 'Date') + '</th><th>' + L('المورد', 'Supplier') + '</th><th>' + L('الأصناف', 'Items') + '</th><th>' + L('المبلغ', 'Amount') + '</th><th>' + L('الحالة', 'Status') + '</th><th>' + L('سجّله', 'By') + '</th><th></th></tr></thead><tbody>' +
        list.map(function (x) {
          return '<tr><td class="nowrap">' + C.fdate(x.date) + '</td><td>' + esc(x.supplier || '-') + (x.ref ? '<div class="small muted ltr">' + esc(x.ref) + '</div>' : '') + '</td><td class="small">' + x.items.map(function (i) { return esc(i.n) + ' ×' + C.qf(i.q) + (cost && i.cost !== undefined ? ' (' + f3(i.cost) + ')' : ''); }).join('<br>') + '</td>' +
            '<td class="num"><b>' + f3(x.amount) + '</b></td><td>' + (x.paid === false ? '<span class="badge warn">' + L('مستحق', 'Due') + (x.due ? ' ' + C.fdate(x.due) : '') + '</span>' : '<span class="badge ok">' + L('مدفوع', 'Paid') + '</span>') + '</td><td class="small">' + esc(x.createdBy || '') + '</td>' +
            '<td class="act">' + (Store.can('expenses') ? '<button type="button" class="icon-btn sm" data-pedit="' + esc(x.id) + '">' + icon('edit', 18) + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="card empty">' + icon('truck', 44) + '<p>' + L('لا توجد مشتريات بعد.', 'No purchases yet.') + '</p></div>');
  }
  /* every movement of the store: job cards, purchases, workshop use, counts */
  function movesFor(pid) {
    var out = [];
    S.invoices.forEach(function (i) { if (i.void) return; i.items.forEach(function (it) { if (it.pid === pid && it.kind === 'part') out.push({ ts: i.created || 0, date: i.date, what: L('على أمر العمل ', 'On job card ') + i.number + (i.car && i.car.plate ? ' (' + i.car.plate + ')' : ''), q: -num(it.q), by: i.createdBy, job: i.id }); }); });
    S.expenses.forEach(function (x) { (x.items || []).forEach(function (it) { if (it.pid === pid) out.push({ ts: x.created || 0, date: x.date, what: L('شراء', 'Purchase') + (x.supplier ? ' - ' + x.supplier : ''), q: num(it.q), by: x.createdBy }); }); });
    S.moves.forEach(function (m) { if (m.pid === pid) out.push({ ts: m.ts, date: C.ymd(new Date(m.ts * 1000)), what: moveName(m) + (m.reason ? ' - ' + m.reason : '') + (m.job ? ' (' + m.job + ')' : ''), q: m.type === 'count' ? null : (m.type === 'use' ? -num(m.qty) : num(m.qty)), after: m.type === 'count' ? m.after : null, by: m.by }); });
    return out.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || b.ts - a.ts; });
  }
  function moveName(m) { return m.type === 'use' ? L('استُخدم في الورشة', 'Used in the workshop') : m.type === 'count' ? L('جرد', 'Count') : L('إضافة', 'Added'); }
  function movesHtml() {
    if (!Store.sees('stock')) return '<div class="note">' + L('تحتاج صلاحية «المخزن والخدمات».', 'Needs the "Store & services" permission.') + '</div>';
    var list = S.moves.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 500);
    return list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('الوقت', 'When') + '</th><th>' + L('الصنف', 'Item') + '</th><th>' + L('الحركة', 'Movement') + '</th><th>' + L('الكمية', 'Qty') + '</th><th>' + L('قبل ← بعد', 'Before → after') + '</th><th>' + L('السبب', 'Reason') + '</th><th>' + L('بواسطة', 'By') + '</th></tr></thead><tbody>' +
      list.map(function (m) { return '<tr><td class="nowrap small">' + C.fts(m.ts) + '</td><td>' + esc(m.name) + '</td><td><span class="badge ' + (m.type === 'use' ? 'warn' : m.type === 'count' ? 'info' : 'ok') + '">' + moveName(m) + '</span></td><td class="num">' + C.qf(m.qty) + '</td><td class="num small">' + C.qf(m.before) + ' → ' + C.qf(m.after) + '</td><td class="small">' + esc([m.reason, m.job].filter(Boolean).join(' · ')) + '</td><td class="small">' + esc(m.by) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="card empty">' + icon('history', 44) + '<p>' + L('لا توجد حركات يدوية بعد. ما يُصرف على أوامر العمل يظهر في صفحة كل صنف.', 'No manual movements yet. What job cards use shows on each item\'s page.') + '</p></div>';
  }
  function storeDraw() {
    var tabs = [['items', L('قطع ومواد', 'Parts & materials')], ['purchases', L('المشتريات', 'Purchases')], ['moves', L('حركة المخزن', 'Store movements')]];
    root.innerHTML = '<div class="toolbar">' + (sf.tab === 'items' ? '<div class="search">' + icon('search') + '<input class="input" id="st-q" type="search" placeholder="' + L('ابحث بالاسم أو الرمز أو المورد', 'Search by name, code or supplier') + '" value="' + esc(sf.q) + '"></div>' : '<span class="grow"></span>') +
      (Store.can('stock') ? '<button type="button" class="btn soft" id="st-new">' + icon('plus') + L('صنف جديد', 'New item') + '</button>' : '') +
      (Store.can('expenses') && Store.can('cost') ? '<button type="button" class="btn primary" id="st-buy">' + icon('truck') + L('مشتريات جديدة', 'New purchase') + '</button>' : '') +
      (sf.tab === 'items' ? '<button type="button" class="btn ghost" id="st-xl">' + icon('download') + 'Excel</button>' : '') + '</div>' +
      '<div class="tabs">' + tabs.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (sf.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="st-body">' + (sf.tab === 'items' ? itemsHtml() : sf.tab === 'purchases' ? purchasesHtml() : movesHtml()) + '</div>';
  }

  /* ------------------------------------------------ one item / service: the form */
  function form(p, kind, done) {
    kind = p ? p.kind : kind;
    var svc = kind === 'service', seeCost = Store.can('cost'), img = p ? p.img || '' : '', uploaded = [];
    var cats = svc ? C.SVC : (S.settings.partCats || []);
    var m = C.modal({ title: (p ? L('تعديل ', 'Edit ') : L('إضافة ', 'Add ')) + (svc ? L('خدمة', 'service') : L('صنف للمخزن', 'store item')), size: 'lg',
      body: '<div class="grid g2">' +
        (svc ? '' : '<div class="span2"><div class="photo-drop" id="f-photo"></div></div>') +
        '<div class="field"><label>' + L('الاسم بالعربية *', 'Name (Arabic) *') + '</label><input class="input" id="f-n" maxlength="160" value="' + esc(p ? p.name : '') + '"></div>' +
        '<div class="field"><label>' + L('الاسم بالإنجليزية', 'Name (English)') + '</label><input class="input" id="f-ne" dir="ltr" maxlength="160" value="' + esc(p ? p.nameEn || '' : '') + '"></div>' +
        '<div class="field"><label>' + (svc ? L('نوع الخدمة', 'Type of service') : L('التصنيف', 'Category')) + '</label><select class="input" id="f-c">' + cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (p && p.cat === c.id ? ' selected' : '') + '>' + esc(C.catName(c)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>' + (svc ? L('السعر (اتركه فارغاً إذا كان يختلف من سيارة لأخرى)', 'Price (leave empty if it differs from car to car)') : L('سعر البيع للعميل', 'Selling price to the customer')) + '</label><input class="input num" id="f-p" inputmode="decimal" value="' + (p && num(p.price) ? f3(p.price) : '') + '" placeholder="0.000"></div>' +
        (svc ? '' :
          '<div class="field"><label>' + L('الوحدة', 'Unit') + '</label><input class="input" id="f-u" list="f-units" maxlength="40" value="' + esc(p ? p.unit || '' : 'حبة') + '"><datalist id="f-units">' + (S.settings.units || []).map(function (u) { return '<option value="' + esc(u) + '">'; }).join('') + '</datalist></div>' +
          (seeCost ? '<div class="field"><label>' + L('سعر الشراء (التكلفة)', 'Purchase price (cost)') + '</label><input class="input num" id="f-cost" inputmode="decimal" value="' + (p && num(p.cost) ? f3(p.cost) : '') + '" placeholder="0.000"><span class="hint">' + L('يتحدث تلقائياً من المشتريات (متوسط مرجّح).', 'Updated automatically from purchases (weighted average).') + '</span></div>' : '') +
          (p ? '' : '<div class="field"><label>' + L('الكمية الموجودة الآن', 'Quantity there now') + '</label><input class="input num" id="f-q" inputmode="decimal" placeholder="0"></div>') +
          '<div class="field"><label>' + L('نبّهني عندما تصل الكمية إلى', 'Alert me when the quantity reaches') + '</label><input class="input num" id="f-min" inputmode="decimal" value="' + (p && num(p.minStock) ? C.qf(p.minStock) : '') + '" placeholder="0"></div>' +
          '<div class="field"><label>' + L('الرمز / رقم القطعة (اختياري)', 'Code / part no. (optional)') + '</label><input class="input ltr" id="f-sku" maxlength="40" value="' + esc(p ? p.sku || '' : '') + '"></div>' +
          '<div class="field"><label>' + L('المورد (اختياري)', 'Supplier (optional)') + '</label><input class="input" id="f-sup" maxlength="120" value="' + esc(p ? p.supplier || '' : '') + '"></div>' +
          '<div class="field"><label>' + L('مكانه في المخزن (اختياري)', 'Shelf / place (optional)') + '</label><input class="input" id="f-shelf" maxlength="80" value="' + esc(p ? p.shelf || '' : '') + '"></div>') +
        '<div class="field span2"><label>' + L('ملاحظات', 'Notes') + '</label><input class="input" id="f-notes" maxlength="300" value="' + esc(p ? p.notes || '' : '') + '"></div></div>' +
        (p && !svc ? '<p class="small muted mt">' + L('الكمية لا تُعدَّل من هنا: تتغير بأوامر العمل والمشتريات، أو من «جرد / تصحيح» في صفحة الصنف.', 'The quantity is not changed here: it moves with job cards and purchases, or with "Count / correct" on the item page.') + '</p>' : ''),
      foot: '<button type="button" class="btn primary lg" id="f-ok">' + icon('check') + L('حفظ', 'Save') + '</button>',
      onClose: function () { var gone = uploaded.filter(function (x) { return x !== img; }); if (gone.length && !saved) Media.del(gone); } });
    var q = function (s) { return m.el.querySelector(s); }, saved = false;
    function photo(msg) {
      var box = q('#f-photo'); if (!box) return;
      box.innerHTML = (img ? '<img alt="" src="' + esc(Media.url(img)) + '">' : icon('camera', 40)) + '<div class="acts"><button type="button" class="btn soft sm" id="f-cam">' + icon('camera', 16) + L('تصوير', 'Camera') + '</button><button type="button" class="btn ghost sm" id="f-gal">' + icon('image', 16) + L('من المعرض', 'Gallery') + '</button>' + (img ? '<button type="button" class="btn danger-soft sm" id="f-rm">' + L('إزالة', 'Remove') + '</button>' : '') + '</div>' + (msg ? '<span class="saved">' + msg + '</span>' : '');
    }
    photo();
    m.el.addEventListener('click', function (e) {
      var cam = e.target.closest('#f-cam'), gal = e.target.closest('#f-gal');
      if (cam || gal) {
        Shell.pickPhoto(!!cam).then(function (f) {
          if (!f) return;
          photo(L('جارٍ التصغير والرفع...', 'Shrinking and uploading...'));
          Media.upload(f, 'item').then(function (id) { img = id; uploaded.push(id); photo(Media.info ? C.bytes(Media.info.before) + ' → ' + C.bytes(Media.info.after) : ''); }, function (er) { photo(); C.toast(C.errText(er), 'err'); });
        });
      }
      if (e.target.closest('#f-rm')) { img = ''; photo(); }
    });
    q('#f-n').focus();
    q('#f-ok').onclick = function () {
      var name = q('#f-n').value.trim();
      if (!name) return C.toast(L('اكتب الاسم', 'Type the name'), 'warn');
      var val = function (s) { var e = q(s); return e ? e.value.trim() : ''; };
      var doc = Object.assign({}, p || {}, { id: p ? p.id : C.uid(), kind: kind, name: name, nameEn: val('#f-ne'), cat: val('#f-c'), price: num(val('#f-p')), notes: val('#f-notes') });
      if (!svc) Object.assign(doc, { img: img, unit: val('#f-u'), minStock: num(val('#f-min')), sku: C.normDigits(val('#f-sku')), supplier: val('#f-sup'), shelf: val('#f-shelf') });
      if (!svc && seeCost) doc.cost = num(val('#f-cost'));
      if (!svc && !p) doc.stock = num(val('#f-q'));
      C.busy(q('#f-ok'), Store.saveProduct(doc)).then(function (d) { saved = true; m.close(); C.toast(L('تم الحفظ', 'Saved')); if (done) done(d); }, function () {});
    };
  }

  /* ------------------------------------------------ one store item: details, movements, use / count */
  function details(id) {
    var p = Store.product(id); if (!p) return;
    var cost = Store.sees('cost'), mv = movesFor(id);
    var m = C.modal({ title: icon('box') + ' ' + esc(P.name(p)), size: 'lg',
      body: '<div class="detail-hero"><div>' + Media.thumb(p.img, P.name(p), '#167f72', 'pic') + '</div><div>' +
        '<div class="loc-boxes mb"><div class="loc-box total"><span>' + L('المتوفر', 'In store') + '</span><b class="num">' + C.qf(p.stock) + '</b><small>' + esc(P.unit(p)) + '</small></div>' +
        '<div class="loc-box"><span>' + L('سعر البيع', 'Selling price') + '</span><b class="num">' + f3(p.price) + '</b></div>' +
        (cost ? '<div class="loc-box"><span>' + L('سعر الشراء', 'Cost') + '</span><b class="num">' + f3(p.cost) + '</b>' + (num(p.lastCost) && Math.abs(num(p.lastCost) - num(p.cost)) > 0.0005 ? '<small>' + L('آخر شراء ', 'last ') + f3(p.lastCost) + '</small>' : '') + '</div>' : '<div class="loc-box"><span>' + L('حد التنبيه', 'Alert at') + '</span><b class="num">' + C.qf(p.minStock) + '</b></div>') + '</div>' +
        '<dl class="kv">' + (p.nameEn ? '<dt>English</dt><dd class="ltr">' + esc(p.nameEn) + '</dd>' : '') + '<dt>' + L('التصنيف', 'Category') + '</dt><dd>' + esc(C.catName(C.catOf(S.settings.partCats, p.cat))) + '</dd>' +
        (p.sku ? '<dt>' + L('الرمز', 'Code') + '</dt><dd class="ltr">' + esc(p.sku) + '</dd>' : '') + (p.supplier ? '<dt>' + L('المورد', 'Supplier') + '</dt><dd>' + esc(p.supplier) + '</dd>' : '') + (p.shelf ? '<dt>' + L('مكانه', 'Shelf') + '</dt><dd>' + esc(p.shelf) + '</dd>' : '') +
        (num(p.minStock) ? '<dt>' + L('حد التنبيه', 'Alert at') + '</dt><dd>' + C.qf(p.minStock) + '</dd>' : '') + (p.notes ? '<dt>' + L('ملاحظات', 'Notes') + '</dt><dd>' + esc(p.notes) + '</dd>' : '') + '</dl></div></div>' +
        '<h4 class="mt2 mb">' + icon('history', 18) + ' ' + L('حركة الصنف', 'Item movements') + '</h4>' +
        (mv.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('التاريخ', 'Date') + '</th><th>' + L('الحركة', 'Movement') + '</th><th>' + L('الكمية', 'Qty') + '</th><th>' + L('بواسطة', 'By') + '</th></tr></thead><tbody>' +
          mv.slice(0, 200).map(function (x) { return '<tr' + (x.job ? ' data-job="' + esc(x.job) + '" style="cursor:pointer"' : '') + '><td class="nowrap">' + C.fdate(x.date) + '</td><td>' + esc(x.what) + '</td><td class="num"><b style="color:' + (x.q === null ? 'var(--blue)' : x.q < 0 ? 'var(--red)' : 'var(--ok)') + '">' + (x.q === null ? '= ' + C.qf(x.after) : (x.q > 0 ? '+' : '') + C.qf(x.q)) + '</b></td><td class="small">' + esc(x.by || '') + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="muted">' + L('لا توجد حركات بعد.', 'No movements yet.') + '</p>'),
      foot: (Store.can('stock') ? '<button type="button" class="btn danger-soft" id="d-del">' + icon('trash') + '</button><button type="button" class="btn ghost" id="d-edit">' + icon('edit') + L('تعديل', 'Edit') + '</button>' : '') + '<span class="grow"></span>' +
        (Store.can('stock') ? '<button type="button" class="btn ghost" id="d-count">' + icon('list') + L('جرد / تصحيح', 'Count / correct') + '</button><button type="button" class="btn amber" id="d-use">' + icon('wrench') + L('صرف للورشة', 'Use in workshop') + '</button>' : '') +
        (Store.can('expenses') && Store.can('cost') ? '<button type="button" class="btn primary" id="d-buy">' + icon('truck') + L('شراء كمية', 'Buy more') + '</button>' : '') });
    var q = function (s) { return m.el.querySelector(s); }, on = function (s, fn) { var e = q(s); if (e) e.onclick = fn; };
    var again = function () { m.close(); details(id); if (root && root.isConnected) storeDraw(); };
    m.el.addEventListener('click', function (e) { var r = e.target.closest('[data-job]'); if (r) { m.close(); Jobs.view(r.getAttribute('data-job')); } });
    on('#d-edit', function () { m.close(); form(p, 'part', function () { details(id); if (root && root.isConnected) storeDraw(); }); });
    on('#d-buy', function () { m.close(); Expenses.form(null, { pid: id, done: function () { details(id); if (root && root.isConnected) storeDraw(); } }); });
    on('#d-del', function () {
      C.confirmBox(L('حذف «', 'Delete "') + P.name(p) + L('» من المخزن؟ الفواتير السابقة لا تتأثر.', '" from the store? Earlier bills are not affected.'), L('حذف', 'Delete'), true).then(function (y) {
        if (y) Store.removeProducts([id]).then(function () { m.close(); C.toast(L('تم الحذف', 'Deleted')); if (root && root.isConnected) storeDraw(); }, function (er) { C.toast(C.errText(er), 'err'); });
      });
    });
    var move = function (type) {
      var use = type === 'use';
      var mm = C.modal({ title: use ? L('صرف من المخزن للورشة', 'Use from the store in the workshop') : L('جرد / تصحيح الكمية', 'Count / correct the quantity'), size: 'sm',
        body: '<div class="col"><div class="note">' + L('الموجود في النظام: ', 'In the system: ') + '<b class="num">' + C.qf(p.stock) + '</b> ' + esc(P.unit(p)) + '</div>' +
          '<div class="field"><label>' + (use ? L('الكمية المصروفة', 'Quantity used') : L('الكمية الموجودة فعلاً بعد العد', 'Quantity really there after counting')) + '</label><input class="input num" id="mv-q" inputmode="decimal"></div>' +
          (use ? '<div class="field"><label>' + L('لأي سيارة / أمر عمل (اختياري)', 'For which car / job card (optional)') + '</label><input class="input" id="mv-j" maxlength="40" placeholder="INV-00012"></div>' : '') +
          '<div class="field"><label>' + L('السبب / ملاحظة', 'Reason / note') + '</label><input class="input" id="mv-r" maxlength="200" placeholder="' + (use ? L('مثال: صبغ صدام سيارة الزبون', 'e.g. painting a customer\'s bumper') : L('مثال: جرد آخر الشهر', 'e.g. month-end count')) + '"></div>' +
          (use ? '<p class="small muted">' + L('للمواد التي لا تُحسب على العميل (مثل ورق الصنفرة والمعجون). ما يُكتب على الفاتورة يُخصم تلقائياً.', 'For materials not charged to the customer (sandpaper, filler...). What is written on a bill is taken off automatically.') + '</p>' : '') + '</div>',
        foot: '<button type="button" class="btn primary" id="mv-ok">' + icon('check') + L('حفظ', 'Save') + '</button>' });
      mm.el.querySelector('#mv-q').focus();
      mm.el.querySelector('#mv-ok').onclick = function () {
        var v = mm.el.querySelector('#mv-q').value.trim();
        if (v === '' || num(v) < 0 || (use && num(v) <= 0)) return C.toast(L('اكتب الكمية', 'Type the quantity'), 'warn');
        C.busy(this, Store.stockMove({ pid: id, type: type, qty: num(v), reason: mm.el.querySelector('#mv-r').value.trim(), job: use ? mm.el.querySelector('#mv-j').value.trim() : '' })).then(function () { mm.close(); C.toast(L('تم الحفظ', 'Saved')); again(); }, function () {});
      };
    };
    on('#d-use', function () { move('use'); });
    on('#d-count', function () { move('count'); });
  }

  Shell.page('store', {
    title: function () { return L('المخزن والمشتريات', 'Store & purchases'); },
    render: function (el, arg) {
      root = document.createElement('div'); el.appendChild(root);
      if (arg && arg.tab) sf.tab = arg.tab;
      if (arg && arg.low) { sf.tab = 'items'; sf.st = 'low'; }
      storeDraw();
      root.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-tab]'))) { sf.tab = b.getAttribute('data-tab'); storeDraw(); return; }
        if ((b = e.target.closest('[data-cat]'))) { sf.cat = b.getAttribute('data-cat'); storeDraw(); return; }
        if (e.target.closest('#st-new')) { form(null, 'part', function () { storeDraw(); }); return; }
        if (e.target.closest('#st-buy')) { Expenses.form(null, { store: true, done: function () { sf.tab = 'purchases'; storeDraw(); } }); return; }
        if (e.target.closest('#st-xl')) {
          var cost = Store.sees('cost'), M = XLSX.S.MONEY;
          var rows = [[L('الصنف', 'Item'), 'English', L('التصنيف', 'Category'), L('الرمز', 'Code'), L('الكمية', 'Qty'), L('الوحدة', 'Unit'), L('سعر البيع', 'Price')].concat(cost ? [L('سعر الشراء', 'Cost'), L('القيمة', 'Value')] : []).concat([L('حد التنبيه', 'Alert at'), L('المورد', 'Supplier')])];
          itemList().forEach(function (p) { rows.push([p.name, p.nameEn || '', C.catName(C.catOf(S.settings.partCats, p.cat)), p.sku || '', num(p.stock), p.unit || '', { v: num(p.price), s: M }].concat(cost ? [{ v: num(p.cost), s: M }, { v: C.r3(Math.max(0, num(p.stock)) * num(p.cost)), s: M }] : []).concat([num(p.minStock), p.supplier || ''])); });
          Shell.excel('Garage_Store', L('المخزن', 'Store'), rows, [30, 24, 16, 14, 10, 10, 12].concat(cost ? [12, 12] : []).concat([10, 18]));
          return;
        }
        if ((b = e.target.closest('[data-item]'))) { details(b.getAttribute('data-item')); return; }
        if ((b = e.target.closest('[data-pedit]'))) { Expenses.form(Store.byId(S.expenses, b.getAttribute('data-pedit')), { done: storeDraw }); }
      });
      root.addEventListener('input', function (e) { if (e.target.id === 'st-q') { sf.q = e.target.value; root.querySelector('#st-body').innerHTML = itemsHtml(); } });
      root.addEventListener('change', function (e) { if (e.target.id === 'st-st') { sf.st = e.target.value; root.querySelector('#st-body').innerHTML = itemsHtml(); } });
    }
  });

  /* ================================================== services & prices */
  var vroot = null, vq = '';
  /* The services the garage asked to see FIRST (pin = their order at the top of "New job card"), then the other usual ones.
     Names only: the garage types its own prices (a service without a price is priced on each job card). */
  var TOP = [
    ['mech', 'تغيير سفائف أمامية', 'Front brake pads change'], ['mech', 'تغيير سفائف خلفية', 'Rear brake pads change'],
    ['mech', 'تنزيل ماكينة', 'Engine removal and overhaul'], ['paint', 'صبغ سيارة كامل', 'Full car painting'],
    ['paint', 'صبغ سيارة جزئي', 'Partial car painting'], ['dent', 'إصلاح حادث سيارة', 'Car accident repair'],
    ['dent', 'سمكرة وصبغ صدام', 'Bumper denting and painting'], ['mech', 'تغيير زيت وفلتر', 'Oil and filter change'],
    ['mech', 'فحص كمبيوتر', 'Computer diagnosis'], ['mech', 'صيانة مكيف', 'A/C service']
  ];
  var COMMON = [
    ['dent', 'سمكرة صدام أمامي', 'Front bumper denting'], ['dent', 'سمكرة صدام خلفي', 'Rear bumper denting'], ['dent', 'سمكرة باب', 'Door denting'], ['dent', 'سمكرة رفرف', 'Fender denting'], ['dent', 'تعديل هيكل / شاصي', 'Body / chassis straightening'],
    ['paint', 'صبغ صدام', 'Bumper painting'], ['paint', 'صبغ باب', 'Door painting'], ['paint', 'صبغ رفرف', 'Fender painting'], ['paint', 'صبغ كبوت', 'Bonnet painting'], ['paint', 'تلميع وبوليش', 'Polishing'],
    ['mech', 'صيانة مكينة', 'Engine repair'], ['mech', 'صيانة قير', 'Gearbox repair'], ['mech', 'تغيير سير', 'Belt change'],
    ['elec', 'فحص كهرباء', 'Electrical check'], ['elec', 'إصلاح أسلاك', 'Wiring repair'], ['elec', 'تغيير بطارية', 'Battery change'], ['elec', 'إصلاح أنوار', 'Lights repair'], ['elec', 'برمجة مفتاح', 'Key programming'],
    ['other', 'نقل بالسطحة (ونش)', 'Tow truck'], ['other', 'غسيل', 'Car wash']
  ];
  /* order of the services everywhere: the pinned ones first (in their order), then by name */
  function svcOrder(a, b) {
    var pa = num(a.pin), pb = num(b.pin);
    if (pa && pb) return pa - pb;
    if (pa || pb) return pa ? -1 : 1;
    return String(P.name(a)).localeCompare(String(P.name(b)), 'ar');
  }
  /* add the usual services that are not there yet (by name). Resolves to how many were added */
  function seedServices() {
    var have = {}; S.products.forEach(function (p) { if (p.kind === 'service') have[C.norm(p.name)] = p; });
    var list = TOP.map(function (c, i) { return c.concat([i + 1]); }).concat(COMMON.map(function (c) { return c.concat([0]); }));
    var t0 = Math.floor(Date.now() / 1000), added = 0, i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(added);
      var c = list[i++], old = have[C.norm(c[1])];
      if (old) {
        if (c[3] && !num(old.pin)) return Store.saveProduct(Object.assign({}, old, { pin: c[3] })).then(next);   // already there: just put it at the top
        return next();
      }
      added++;
      return Store.saveProduct({ id: C.uid(), kind: 'service', cat: c[0], name: c[1], nameEn: c[2], price: 0, pin: c[3], created: t0 }).then(next);
    }
    return next();
  }
  function nextPin() { return S.products.reduce(function (m, p) { return p.kind === 'service' ? Math.max(m, num(p.pin)) : m; }, 0) + 1; }
  function services() {
    var q = C.norm(vq);
    return S.products.filter(function (p) { return p.kind === 'service' && (!q || C.norm(p.name + ' ' + (p.nameEn || '')).indexOf(q) >= 0); });
  }
  function svcRow(p, edit) {
    var n = 0; S.invoices.forEach(function (i) { if (!i.void) i.items.forEach(function (it) { if (it.pid === p.id) n += num(it.q); }); });
    var on = num(p.pin) > 0;
    return '<tr><td><b>' + esc(p.name) + '</b></td><td class="ltr">' + esc(p.nameEn || '') + '</td><td class="num">' + (num(p.price) > 0 ? '<b>' + f3(p.price) + '</b>' : '<span class="muted">' + L('حسب العمل', 'by job') + '</span>') + '</td><td class="num">' + C.qf(n) + '</td>' +
      '<td class="act">' + (edit ? '<button type="button" class="icon-btn sm pin' + (on ? ' on' : '') + '" data-spin="' + esc(p.id) + '" title="' + (on ? L('إزالة من أول القائمة', 'Remove from the top') : L('إظهارها أول شيء في أمر العمل', 'Show it first on the job card')) + '">' + icon('star', 18) + '</button>' +
        '<button type="button" class="icon-btn sm" data-sedit="' + esc(p.id) + '">' + icon('edit', 18) + '</button><button type="button" class="icon-btn sm red" data-sdel="' + esc(p.id) + '">' + icon('trash', 18) + '</button>' : '') + '</td></tr>';
  }
  function svcTable(rows) {
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('الخدمة', 'Service') + '</th><th>English</th><th>' + L('السعر', 'Price') + '</th><th>' + L('مرات العمل', 'Times done') + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function svcDraw() {
    var all = S.products.filter(function (p) { return p.kind === 'service'; }), list = services(), edit = Store.can('stock');
    var top = list.filter(function (p) { return num(p.pin) > 0; }).sort(svcOrder);
    vroot.innerHTML = '<div class="toolbar"><div class="search">' + icon('search') + '<input class="input" id="sv-q" type="search" placeholder="' + L('ابحث عن خدمة', 'Search a service') + '" value="' + esc(vq) + '"></div>' +
      (edit ? '<button type="button" class="btn primary" id="sv-new">' + icon('plus') + L('خدمة جديدة', 'New service') + '</button>' : '') + '</div>' +
      (!all.length ? '<div class="card empty">' + icon('wrench', 44) + '<p>' + L('قائمة الخدمات فارغة. اضغط «خدمة جديدة» لإضافة خدماتك وأسعارها.', 'The services list is empty. Press "New service" to add your services and prices.') + '</p></div>'
        : (top.length ? '<div class="card mb svc-group pinbox"><h3>' + icon('star', 18) + L('تظهر أول شيء في أمر العمل', 'Shown first on the job card') + ' <span class="badge warn">' + top.length + '</span></h3>' +
            '<p class="small muted mb">' + L('بهذا الترتيب. اضغط النجمة بجانب أي خدمة لإضافتها هنا أو إزالتها.', 'In this order. Press the star next to any service to add it here or take it off.') + '</p>' + svcTable(top.map(function (p) { return svcRow(p, edit); }).join('')) + '</div>' : '') +
          C.SVC.map(function (t) {
            var g = list.filter(function (p) { return (p.cat || 'other') === t.id || (t.id === 'other' && !C.SVC.some(function (x) { return x.id === p.cat; })); }).sort(svcOrder);
            if (!g.length) return '';
            return '<div class="card mb svc-group" style="--tile:' + t.c + '"><h3><span class="dot" style="background:' + t.c + '"></span>' + esc(C.nm(t)) + ' <span class="badge">' + g.length + '</span></h3>' + svcTable(g.map(function (p) { return svcRow(p, edit); }).join('')) + '</div>';
          }).join(''));
  }
  Shell.page('services', {
    title: function () { return L('الخدمات والأسعار', 'Services & prices'); },
    render: function (el) {
      vroot = document.createElement('div'); el.appendChild(vroot); svcDraw();
      vroot.addEventListener('click', function (e) {
        var b;
        if (e.target.closest('#sv-new')) return form(null, 'service', svcDraw);
        if ((b = e.target.closest('[data-spin]'))) {
          var sp = Store.product(b.getAttribute('data-spin'));
          b.disabled = true;
          Store.saveProduct(Object.assign({}, sp, { pin: num(sp.pin) ? 0 : nextPin() })).then(svcDraw, function (er) { C.toast(C.errText(er), 'err'); svcDraw(); });
          return;
        }
        if ((b = e.target.closest('[data-sedit]'))) return form(Store.product(b.getAttribute('data-sedit')), 'service', svcDraw);
        if ((b = e.target.closest('[data-sdel]'))) {
          var p = Store.product(b.getAttribute('data-sdel'));
          C.confirmBox(L('حذف الخدمة «', 'Delete the service "') + P.name(p) + L('»؟ الفواتير السابقة لا تتأثر.', '"? Earlier bills are not affected.'), L('حذف', 'Delete'), true).then(function (y) { if (y) Store.removeProducts([p.id]).then(svcDraw, function (er) { C.toast(C.errText(er), 'err'); }); });
        }
      });
      vroot.addEventListener('input', function (e) { if (e.target.id === 'sv-q') { vq = e.target.value; svcDraw(); var i = vroot.querySelector('#sv-q'); i.focus(); i.setSelectionRange(vq.length, vq.length); } });
    }
  });

  window.StorePage = { form: form, details: details, svcOrder: svcOrder, seedServices: seedServices };
})();
