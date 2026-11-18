/* sell.js - the job card / point of sale screen ("أمر عمل جديد").
   Left: the services price list and the store items (tap to add). Right: the job card, ONE scrolling panel:
     1. customer and car (type the plate and a known car fills itself in, with its earlier visits)
     2. the job: type of services, where the car is from (insurance -> company + claim no.), complaint, what was done,
        who works on it, expected delivery, stage, warranty
     3. photos (no limit; before / during / after) and the damage drawing
     4. the lines (work, spare parts, materials), totals, payment, and Save & print / Save + WhatsApp / Save only.
   The same screen edits a saved job card. A job card being written is kept on the device (draft) until it is saved. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, P = C.Prod, Calc = C.Calc, num = C.num, f3 = C.f3;
  var cart = null, flt = { q: '', tab: 'svc', cat: '' }, root = null, uploading = 0;

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function draftKey() { return BRAND.key + '_draft_' + (S.user ? S.user.id : 0); }
  function fresh() {
    return { editing: null, cname: '', cphone: '', car: { plate: '', make: '', model: '', year: '', color: '', vin: '', km: '' },
      svc: [], source: '', insCo: '', claimNo: '', complaint: '', workNotes: '', doneBy: '', expDate: '', timeIn: C.nowTime(), timeOut: '',
      status: 'open', warranty: { text: S.settings.warrantyText || '', from: '', to: '' }, damage: [], photos: [], lines: [],
      discount: 0, method: 'cash', paid: null, note: '', key: '', open: { car: true, job: true, photos: true } };
  }
  function isEmpty(c) { return !c.lines.length && !c.cname && !c.car.plate && !c.photos.length && !c.complaint; }
  var saveDraft = C.debounce(function () {
    if (!cart || cart.editing) return;
    if (isEmpty(cart)) ls(draftKey(), null); else ls(draftKey(), JSON.stringify(cart));
  }, 400);
  function vatPct() { return cart.editing ? num(cart.editing.vatPct) : (S.settings.vatOn ? num(S.settings.vatPct) : 0); }
  function totals() { return Calc.totals(cart.lines, cart.discount, vatPct()); }
  function prevPaid() { return cart.editing ? Calc.paid(cart.editing) : 0; }
  /* what is paid now: null = automatic (in full when the car is handed over, otherwise later) */
  function paidNow(t) {
    var left = Math.max(0, C.r3(t.total - prevPaid()));
    if (cart.paid === null) return cart.editing ? 0 : left;            // a new bill is paid in full unless "Later" or an amount is chosen
    return Math.min(Math.max(num(cart.paid), 0), left);
  }
  function grpName(g) { return g === 'work' ? L('عمل', 'Work') : g === 'mat' ? L('مواد', 'Material') : L('قطعة', 'Part'); }
  function grpOf(p) { return p.kind === 'service' ? 'work' : (p.cat === 'paint' || p.cat === 'tools' ? 'mat' : 'part'); }

  /* store quantities: how much this job asks for, and how much the store has (plus what this job card already holds) */
  function asked(pid) { return cart.lines.reduce(function (t, l) { return t + (l.pid === pid ? num(l.q) : 0); }, 0); }
  function available(pid) {
    var p = Store.product(pid); if (!p) return 0;
    var have = num(p.stock);
    if (cart.editing) cart.editing.items.forEach(function (it) { if (it.pid === pid && it.kind === 'part') have += num(it.q); });
    return have;
  }

  /* ------------------------------------------------ known cars: plate -> car, owner, visits */
  function carIndex() {
    var idx = {};
    S.customers.forEach(function (c) { (c.cars || []).forEach(function (car) { var k = C.plateKey(car.plate); if (k) idx[k] = idx[k] || { car: car, name: c.name, phone: c.phone || '', cid: c.id, jobs: [] }; }); });
    S.invoices.forEach(function (i) {
      var k = C.plateKey(i.car && i.car.plate); if (!k) return;
      var e = idx[k] = idx[k] || { car: i.car, name: i.customerName, phone: i.customerPhone, cid: i.customerId, jobs: [] };
      e.jobs.push(i);
      if (!e.last || i.no > e.last.no) { e.last = i; if (!e.name) e.name = i.customerName; if (!e.phone) e.phone = i.customerPhone; ['make', 'model', 'year', 'color', 'vin'].forEach(function (f) { if (i.car[f]) e.car = Object.assign({}, e.car, (function () { var o = {}; o[f] = i.car[f]; return o; })()); }); }
    });
    return idx;
  }
  function lookupPlate(silent) {
    var k = C.plateKey(cart.car.plate);
    if (!k) return null;
    var e = carIndex()[k];
    if (!e) return null;
    var changed = false;
    ['make', 'model', 'year', 'color', 'vin'].forEach(function (f) { if (!cart.car[f] && e.car[f]) { cart.car[f] = e.car[f]; changed = true; } });
    if (!cart.cname && e.name) { cart.cname = e.name; changed = true; }
    if (!cart.cphone && e.phone) { cart.cphone = e.phone; changed = true; }
    if (changed && !silent) C.toast(L('سيارة معروفة: تمت تعبئة بياناتها', 'Known car: its details were filled in'));
    return e;
  }
  function history(e) {
    var jobs = e.jobs.slice().sort(function (a, b) { return b.no - a.no; });
    var m = C.modal({ title: icon('history') + ' ' + L('زيارات السيارة ', 'Visits of car ') + '<span class="ltr">' + esc(e.car.plate || '') + '</span>', size: 'lg',
      body: jobs.length ? '<div class="col">' + jobs.map(function (i) {
        return '<button type="button" class="inv-card" data-job="' + esc(i.id) + '"><span class="grow"><span class="nm ltr">' + esc(i.number) + '</span> <span class="badge ' + C.stage(i.status).cls + '">' + esc(C.stageName(i.status)) + '</span><br>' +
          '<span class="meta">' + C.fdate(i.date) + (i.car.km ? ' · ' + esc(i.car.km) + ' km' : '') + ' · ' + esc(i.items.map(C.lineName).slice(0, 4).join('، ')) + '</span></span><b class="num">' + f3(i.total) + '</b></button>';
      }).join('') + '</div>' : '<p class="muted">' + L('لا توجد زيارات سابقة.', 'No earlier visits.') + '</p>' });
    m.el.addEventListener('click', function (ev) { var b = ev.target.closest('[data-job]'); if (b) { m.close(); Jobs.view(b.getAttribute('data-job')); } });
  }

  /* ------------------------------------------------ the left side: services and store items */
  function matches() {
    var q = C.norm(flt.q), want = flt.tab === 'svc' ? 'service' : 'part';
    return S.products.filter(function (p) {
      if (p.archived || p.kind !== want) return false;
      if (flt.cat && p.cat !== flt.cat) return false;
      if (!q) return true;
      return C.norm([p.name, p.nameEn, p.sku].join(' ')).indexOf(q) >= 0;
    }).sort(function (a, b) { return flt.tab === 'svc' ? StorePage.svcOrder(a, b) : P.newestFirst(a, b); });   // pinned services first
  }
  function catsFor() { return flt.tab === 'svc' ? C.SVC : (S.settings.partCats || []); }
  function gridHtml() {
    var list = matches(), svc = flt.tab === 'svc';
    var none = !S.products.some(function (p) { return p.kind === (svc ? 'service' : 'part'); });
    if (none) return '<div class="empty">' + icon(svc ? 'wrench' : 'box', 44) + '<p>' + (svc ? L('قائمة الخدمات فارغة. أضف خدماتك وأسعارها من صفحة «الخدمات والأسعار»، أو أضف بنداً يدوياً في الفاتورة.', 'The services list is empty. Add your services and prices on the "Services & prices" page, or add a manual line on the job card.')
      : L('لا توجد أصناف في المخزن بعد. أضفها من صفحة «المخزن والمشتريات».', 'No store items yet. Add them on the "Store & purchases" page.')) + '</p>' +
      (Store.can('stock') ? '<button type="button" class="btn primary mt" data-go="' + (svc ? 'services' : 'store') + '">' + icon('plus') + (svc ? L('إضافة خدمات', 'Add services') : L('إضافة أصناف', 'Add items')) + '</button>' : '') + '</div>';
    if (!list.length) return '<div class="empty">' + icon('search', 40) + '<p>' + L('لا توجد نتائج', 'No results') + '</p></div>';
    return '<div class="p-grid' + (svc ? ' svc' : '') + '">' + list.slice(0, 200).map(function (p) {
      if (svc) {
        var sc = C.catOf(C.SVC, p.cat);
        return '<button type="button" class="s-card' + (num(p.pin) ? ' pinned' : '') + '" data-p="' + esc(p.id) + '" style="--tile:' + (sc.c || '#64707c') + '"><span class="nm">' + esc(P.name(p)) + '</span>' +
          '<span class="row between"><span class="badge" style="background:none;padding:0;color:var(--tile)">' + esc(C.catName(sc)) + '</span><b class="num">' + (num(p.price) > 0 ? f3(p.price) : L('حسب العمل', 'by job')) + '</b></span></button>';
      }
      var out = P.out(p), cat = C.catOf(S.settings.partCats, p.cat);
      return '<button type="button" class="p-card' + (out ? ' out' : '') + '" data-p="' + esc(p.id) + '">' + Media.thumb(p.img, P.name(p), '#167f72', 'thumb pic') +
        (out ? '<span class="st badge bad">' + L('نافد', 'Out') + '</span>' : P.low(p) ? '<span class="st badge warn">' + L('منخفض', 'Low') + '</span>' : '') +
        '<span class="info"><span class="nm">' + esc(P.name(p)) + '</span><span class="pr"><span class="num">' + f3(p.price) + '</span>' + (P.unit(p) ? ' <small>/ ' + esc(P.unit(p)) + '</small>' : '') + '</span>' +
        '<span class="more">' + esc(C.catName(cat)) + ' · ' + L('المتوفر: ', 'In store: ') + '<b>' + C.qf(p.stock) + '</b></span></span></button>';
    }).join('') + '</div>';
  }
  function add(p) {
    var l = cart.lines.filter(function (x) { return x.pid === p.id; })[0];
    if (l) l.q = C.r3(num(l.q) + 1);
    else { l = { pid: p.id, kind: p.kind === 'service' ? 'service' : 'part', grp: grpOf(p), q: 1, price: num(p.price) }; cart.lines.push(l); }
    drawCart();
    C.toast(L('أُضيف: ', 'Added: ') + P.name(p), 'ok', 1400);
  }

  /* ------------------------------------------------ the job card side */
  function lineHtml(l, i) {
    var p = l.pid ? Store.product(l.pid) : null;
    var name = p ? P.name(p) : (l.n || L('بند يدوي', 'Manual line'));
    var listPriced = p && p.kind === 'service' ? num(p.price) > 0 : !!p;
    var canPrice = Store.can('discount') || !listPriced;            // a service with no list price is priced by whoever writes the job card
    var sub = '<span class="badge sm ' + (l.grp === 'work' ? 'blue' : l.grp === 'mat' ? 'warn' : '') + '">' + grpName(l.grp) + '</span>';
    if (p && p.kind === 'part') {
      var need = asked(l.pid), have = available(l.pid);
      sub += ' ' + (need > have + 0.0005 ? '<b style="color:var(--red)">' + L('المتوفر في المخزن: ', 'In store: ') + C.qf(have) + '</b>' : L('المتوفر: ', 'In store: ') + C.qf(have)) + (P.unit(p) ? ' ' + esc(P.unit(p)) : '');
    }
    return '<div class="cart-line" data-i="' + i + '"><div><div class="nm">' + esc(name) + '</div><div class="sub">' + sub + '</div></div>' +
      '<button type="button" class="icon-btn sm red" data-rm title="' + L('حذف', 'Remove') + '">' + icon('trash', 18) + '</button>' +
      '<div class="ctl"><span class="qty"><button type="button" data-minus aria-label="-">' + icon('minus', 16) + '</button><input data-q inputmode="decimal" value="' + C.qf(l.q) + '" aria-label="' + L('الكمية', 'Quantity') + '"><button type="button" data-plus aria-label="+">' + icon('plus', 16) + '</button></span>' +
      '<span class="x">×</span><input class="input num price" data-price inputmode="decimal" value="' + (num(l.price) || !canPrice ? f3(l.price) : '') + '" placeholder="0.000"' + (canPrice ? '' : ' disabled') + ' aria-label="' + L('السعر', 'Price') + '">' +
      '<span class="lt num" data-lt>' + f3(Calc.line(l)) + '</span></div></div>';
  }
  function sec(id, ic, title, extra, body) {
    var open = cart.open[id] !== false;
    return '<details class="cart-sec"' + (open ? ' open' : '') + '><summary data-sec="' + id + '">' + icon(ic, 18) + '<b>' + title + '</b>' + (extra ? '<span class="sec-x">' + extra + '</span>' : '') + icon('next', 16) + '</summary><div class="sec-body">' + body + '</div></details>';
  }
  function inp(id, label, val, attr) { return '<div class="field"><label for="' + id + '">' + label + '</label><input class="input" id="' + id + '" value="' + esc(val || '') + '" autocomplete="off" ' + (attr || '') + '></div>'; }
  function carSec() {
    var e = cart.car.plate ? carIndex()[C.plateKey(cart.car.plate)] : null;
    var custList = '<datalist id="cust-list">' + S.customers.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.phone || '') + '</option>'; }).join('') + '</datalist>';
    var plates = carIndex(), plateList = '<datalist id="plate-list">' + Object.keys(plates).slice(0, 400).map(function (k) { return '<option value="' + esc(plates[k].car.plate) + '">' + esc([plates[k].car.make, plates[k].car.model, plates[k].name].filter(Boolean).join(' - ')) + '</option>'; }).join('') + '</datalist>';
    return sec('car', 'car', L('العميل والسيارة', 'Customer & car'), cart.car.plate ? '<span class="ltr">' + esc(cart.car.plate) + '</span>' : '',
      '<div class="grid g2 keep">' + inp('c-plate', L('رقم اللوحة', 'Plate no.'), cart.car.plate, 'list="plate-list" dir="ltr" placeholder="12345 AB"') + inp('c-km', L('العداد (كم)', 'Mileage (km)'), cart.car.km, 'inputmode="numeric" dir="ltr"') + '</div>' + plateList +
      (e && e.jobs.length ? '<button type="button" class="note ok visits" id="c-visits">' + icon('history', 18) + '<span>' + L('سيارة معروفة: ', 'Known car: ') + '<b>' + e.jobs.length + '</b>' + L(' زيارة سابقة، آخرها ', ' earlier visit(s), last on ') + C.fdate(e.last.date) + ' - ' + L('اضغط للعرض', 'press to see') + '</span></button>' : '') +
      '<div class="grid g2 keep">' + inp('c-name', L('اسم العميل', 'Customer name'), cart.cname, 'list="cust-list"') + inp('c-phone', L('الهاتف / واتساب', 'Phone / WhatsApp'), cart.cphone, 'inputmode="tel" dir="ltr" placeholder="9xxxxxxx"') + '</div>' + custList +
      '<div class="grid g3 keep">' + inp('c-make', L('الشركة', 'Make'), cart.car.make, 'list="make-list" placeholder="' + L('تويوتا', 'Toyota') + '"') + inp('c-model', L('الطراز', 'Model'), cart.car.model) + inp('c-year', L('السنة', 'Year'), cart.car.year, 'inputmode="numeric" dir="ltr"') + '</div>' +
      '<datalist id="make-list">' + ['Toyota', 'Nissan', 'Lexus', 'Hyundai', 'Kia', 'Mitsubishi', 'Honda', 'Ford', 'Chevrolet', 'GMC', 'Mazda', 'Suzuki', 'Land Rover', 'Mercedes', 'BMW', 'Jeep', 'Dodge', 'Isuzu', 'تويوتا', 'نيسان', 'لكزس', 'هيونداي', 'كيا', 'ميتسوبيشي'].map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist>' +
      '<div class="grid g2 keep">' + inp('c-color', L('اللون', 'Colour'), cart.car.color) + inp('c-vin', L('رقم الشاصي', 'Chassis no. (VIN)'), cart.car.vin, 'dir="ltr"') + '</div>');
  }
  function jobSec() {
    var cos = (S.settings.insCos || []).map(function (c) { return c.name; });
    return sec('job', 'wrench', L('تفاصيل العمل', 'Job details'), cart.svc.length ? esc(cart.svc.map(C.svcName).join('، ')) : '',
      '<div class="field"><label>' + L('نوع الخدمة', 'Type of service') + '</label><div class="chips wrap" id="c-svc">' + C.SVC.map(function (s) { return '<button type="button" class="chip' + (cart.svc.indexOf(s.id) >= 0 ? ' on' : '') + '" data-svc="' + s.id + '">' + esc(C.nm(s)) + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><label>' + L('مصدر المركبة', 'Vehicle source') + '</label><div class="chips wrap" id="c-src">' + C.SOURCES.map(function (s) { return '<button type="button" class="chip' + (cart.source === s.id ? ' on' : '') + '" data-src="' + s.id + '">' + (s.id === 'ins' ? icon('shield', 15) + ' ' : '') + esc(C.nm(s)) + '</button>'; }).join('') + '</div></div>' +
      (cart.source === 'ins' ? '<div class="grid g2 keep ins-box">' + inp('c-insco', L('شركة التأمين', 'Insurance company'), cart.insCo, 'list="insco-list"') + inp('c-claim', L('رقم المطالبة', 'Claim no.'), cart.claimNo, 'dir="ltr"') + '<datalist id="insco-list">' + cos.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></div>' +
        (Store.can('insurance') ? '<p class="small muted">' + icon('shield', 14) + ' ' + L('عند الحفظ يُفتح ملف لها في «تقارير التأمين» تلقائياً.', 'On saving, a case is opened for it in "Insurance reports" automatically.') + '</p>' : '') : '') +
      '<div class="field"><label for="c-comp">' + L('شكوى العميل / المطلوب', "Customer's complaint / request") + '</label><textarea class="input" id="c-comp" rows="2" maxlength="1500">' + esc(cart.complaint) + '</textarea></div>' +
      '<div class="field"><label for="c-work">' + L('ما تم عمله / ملاحظات الفني', 'Work done / technician notes') + '</label><textarea class="input" id="c-work" rows="2" maxlength="3000">' + esc(cart.workNotes) + '</textarea></div>' +
      '<div class="grid g2 keep">' + inp('c-done', L('الفني (تم بواسطة)', 'Technician (done by)'), cart.doneBy, 'list="staff-list"') + inp('c-exp', L('موعد التسليم المتوقع', 'Expected delivery'), cart.expDate, 'type="date"') + '</div>' +
      '<datalist id="staff-list">' + (S.staff || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<div class="grid g2 keep">' + inp('c-tin', L('وقت الدخول', 'Time in'), cart.timeIn, 'type="time"') + inp('c-tout', L('وقت الخروج', 'Time out'), cart.timeOut, 'type="time"') + '</div>' +
      '<div class="field"><label>' + L('حالة السيارة', 'Car stage') + '</label><div class="stage-pick" id="c-stage">' + C.STAGES.map(function (s) { return '<button type="button" data-stage="' + s.id + '" class="' + (cart.status === s.id ? 'on ' + s.cls : '') + '">' + icon(s.ic, 16) + esc(C.nm(s)) + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><label for="c-war">' + L('الضمان (اختياري)', 'Warranty (optional)') + '</label><input class="input" id="c-war" maxlength="300" value="' + esc(cart.warranty.text) + '" placeholder="' + L('مثال: ضمان على الصبغ 6 أشهر', 'e.g. 6 months on the paint') + '"></div>' +
      (cart.warranty.text ? '<div class="grid g2 keep">' + inp('c-wfrom', L('الضمان من', 'Warranty from'), cart.warranty.from, 'type="date"') + inp('c-wto', L('إلى', 'To'), cart.warranty.to, 'type="date"') + '</div>' : ''));
  }
  function photoSec() {
    var n = cart.photos.length;
    return sec('photos', 'camera', L('الصور وأماكن الضرر', 'Photos & damage'), (n ? n + ' ' + L('صورة', 'photos') : '') + (cart.damage.length ? ' · ' + cart.damage.length + ' ' + L('ضرر', 'marks') : ''),
      '<div class="row between wrap"><span class="small muted">' + L('الصور الجديدة تُسجَّل كـ:', 'New photos are tagged:') + '</span>' + Photos.tagPicker(cart.phTag || 'before') + '</div>' +
      (uploading ? '<div class="note" id="c-up">' + L('جارٍ تصغير الصور ورفعها...', 'Shrinking and uploading photos...') + '</div>' : '') +
      Photos.grid(cart.photos, { add: true, small: true }) +
      '<button type="button" class="dmg-btn" id="c-dmg"><span class="dmg-mini">' + CarDiagram.svg(cart.damage) + '</span><span class="grow"><b>' + L('رسم السيارة: حدّد أماكن الضرر', 'Car drawing: mark the damage') + '</b><br><span class="small muted">' + (cart.damage.length ? esc(CarDiagram.list(cart.damage)) : L('اضغط لتحديد الأجزاء المتضررة', 'Press to mark the damaged parts')) + '</span></span></button>');
  }
  function drawCart() {
    var el = root.querySelector('#cart'), t = totals(), ed = cart.editing, pct = vatPct(), now = paidNow(t), left = C.r3(t.total - prevPaid());
    var keepScroll = el.scrollTop;
    var auto = cart.paid === null, isFull = (auto && !ed) || (!auto && num(cart.paid) >= left - 0.0005 && left > 0), isLater = (auto && !!ed) || (!auto && num(cart.paid) === 0);
    el.innerHTML =
      '<div class="cart-title row between"><h3>' + (ed ? icon('edit') + ' ' + L('تعديل ', 'Editing ') + '<span class="ltr">' + esc(ed.number) + '</span>' : icon('notes') + ' ' + L('إضافة فاتورة', 'Add bill')) + '</h3>' +
      '<span class="row"><button type="button" class="btn sm ghost" id="c-clear">' + (ed ? L('إلغاء التعديل', 'Cancel edit') : L('جديد', 'New')) + '</button>' +
      '<button type="button" class="icon-btn cart-close" id="c-close" aria-label="close">' + icon('x') + '</button></span></div>' +
      carSec() + jobSec() + photoSec() +
      '<div class="lines-head row between"><b>' + icon('list', 18) + ' ' + L('الأعمال والقطع', 'Work & parts') + ' <span class="badge">' + cart.lines.length + '</span></b>' +
      '<button type="button" class="btn sm soft" id="c-manual">' + icon('plus', 16) + L('بند يدوي', 'Manual line') + '</button></div>' +
      '<div class="cart-lines" id="c-lines">' + (cart.lines.length ? cart.lines.map(lineHtml).join('') : '<div class="empty small">' + icon('wrench', 36) + '<p>' + L('اضغط على خدمة أو صنف لإضافته، أو أضف بنداً يدوياً. يمكنك حفظ الفاتورة الآن وإضافة الأعمال لاحقاً.', 'Tap a service or an item to add it, or add a manual line. You can save the job card now and add the work later.') + '</p></div>') + '</div>' +
      '<div class="cart-foot">' +
      '<div class="tot-row"><span>' + L('المجموع', 'Sub-total') + '</span><b class="num" id="t-sub">' + f3(t.sub) + '</b></div>' +
      (Store.can('discount') ? '<div class="tot-row"><span>' + L('الخصم', 'Discount') + '</span><input class="input num" id="c-disc" inputmode="decimal" value="' + (cart.discount ? f3(cart.discount) : '') + '" placeholder="0.000"></div>' : (cart.discount ? '<div class="tot-row"><span>' + L('الخصم', 'Discount') + '</span><b class="num">' + f3(cart.discount) + '</b></div>' : '')) +
      (pct > 0 ? '<div class="tot-row"><span>' + L('ضريبة القيمة المضافة ', 'VAT ') + pct + '%</span><b class="num" id="t-vat">' + f3(t.vat) + '</b></div>' : '') +
      '<div class="tot-row big"><span>' + L('الإجمالي', 'Total') + '</span><span class="num" id="t-total">' + C.money(t.total) + '</span></div>' +
      (ed ? '<div class="tot-row small"><span>' + L('المدفوع سابقاً', 'Paid before') + '</span><b class="num">' + f3(prevPaid()) + '</b></div>' : '') +
      (left > 0.0005 || !ed ? '<div class="pay-methods" id="c-method">' + ['cash', 'card', 'transfer'].map(function (m) { return '<button type="button" data-m="' + m + '" class="' + (cart.method === m ? 'on' : '') + '">' + esc(C.payName(m)) + '</button>'; }).join('') + '</div>' +
        '<div class="tot-row"><span>' + (ed ? L('يدفع الآن', 'Paying now') : L('المدفوع الآن', 'Paid now')) + '</span><span class="row"><button type="button" class="btn sm ' + (isFull ? 'primary' : 'ghost') + '" id="c-full">' + L('كامل', 'Full') + '</button><button type="button" class="btn sm ' + (isLater && !isFull ? 'amber' : 'ghost') + '" id="c-credit">' + L('لاحقاً', 'Later') + '</button>' +
        '<input class="input num" id="c-paid" inputmode="decimal" value="' + (auto ? '' : f3(cart.paid)) + '" placeholder="' + f3(now) + '"></span></div>' : '') +
      '<div class="tot-row small" id="t-bal-row"' + (left - now > 0.0005 ? '' : ' style="display:none"') + '><span style="color:var(--red);font-weight:700">' + L('المتبقي على العميل', 'Balance on customer') + '</span><b class="num" id="t-bal" style="color:var(--red)">' + f3(left - now) + '</b></div>' +
      '<div class="save-row"><button type="button" class="btn primary lg" data-save="print">' + icon('print') + (ed ? L('حفظ وطباعة', 'Save & print') : L('حفظ وطباعة', 'Save & print')) + '</button>' +
      '<button type="button" class="btn wa lg" data-save="wa">' + icon('whatsapp') + L('حفظ + واتساب', 'Save + WhatsApp') + '</button></div>' +
      '<div class="row between"><button type="button" class="btn ghost grow" data-save="none">' + icon('check', 18) + (ed ? L('حفظ التعديلات فقط', 'Save changes only') : L('حفظ فقط', 'Save only')) + '</button>' +
      '<select class="input" id="c-size" style="width:auto" aria-label="' + L('مقاس الطباعة', 'Print size') + '">' + Print.sizeOptions(Print.size()) + '</select></div>' +
      (ed && !Store.can('edit_inv') ? '<p class="small muted">' + icon('lock', 14) + ' ' + L('بعد تسليم السيارة لا يمكن تعديل الفاتورة إلا بصلاحية «تعديل وإلغاء الفواتير».', 'After the car is delivered the bill can only be changed with the "Edit and void bills" permission.') + '</p>' : '') +
      '</div>';
    toggleBar();
    el.scrollTop = keepScroll;
    saveDraft();
  }
  function toggleBar() {
    var t = totals(), tg = root.querySelector('#cart-toggle');
    if (tg) tg.innerHTML = '<span>' + icon('notes') + ' ' + (cart.editing ? esc(cart.editing.number) : L('الفاتورة', 'Bill')) + ' (' + cart.lines.length + (cart.photos.length ? ' · ' + icon('camera', 16) + cart.photos.length : '') + ')</span><b class="num">' + C.money(t.total) + '</b>';
  }
  function liveTotals() {
    var t = totals(), now = paidNow(t), left = C.r3(t.total - prevPaid()), set = function (id, v) { var e = root.querySelector(id); if (e) e.textContent = v; };
    set('#t-sub', f3(t.sub)); set('#t-vat', f3(t.vat)); set('#t-total', C.money(t.total));
    var br = root.querySelector('#t-bal-row');
    if (br) { br.style.display = left - now > 0.0005 ? '' : 'none'; set('#t-bal', f3(left - now)); }
    var pi = root.querySelector('#c-paid'); if (pi) pi.placeholder = f3(now);
    toggleBar();
    saveDraft();
  }

  /* ------------------------------------------------ photos while the job card is being written */
  function addPhotos(files) {
    if (!files.length) return;
    uploading++; drawCart();
    Photos.add(files, cart.phTag || 'before', function (d, t, info) {
      var el = root.querySelector('#c-up');
      if (el) el.textContent = L('جارٍ تصغير الصور ورفعها: ', 'Shrinking and uploading photos: ') + d + ' / ' + t + (info ? ' (' + C.bytes(info.before) + ' → ' + C.bytes(info.after) + ')' : '');
    }).then(function (added) {
      uploading--;
      cart.photos = cart.photos.concat(added);
      cart.open.photos = true;
      drawCart();
      if (added.length) C.toast(L('أُضيفت ', 'Added ') + added.length + L(' صورة', ' photo(s)'));
    });
  }

  /* ------------------------------------------------ save */
  function findCustomer() {
    var n = C.norm(cart.cname), ph = C.phoneKey(cart.cphone);
    return S.customers.filter(function (c) { return (n && C.norm(c.name) === n) || (ph && ph.length >= 8 && C.phoneKey(c.phone) === ph); })[0] || null;
  }
  /* the customer list follows the job cards: a new customer is added, a new car is added to his cars */
  function keepCustomer(doc) {
    if (!doc.customerName || !(Store.can('customers') || Store.can('sell'))) return Promise.resolve(findCustomer());
    var c = findCustomer(), car = cart.car, has = car.plate || car.make;
    if (c) {
      var cars = (c.cars || []).slice(), k = C.plateKey(car.plate), known = k ? cars.filter(function (x) { return C.plateKey(x.plate) === k; })[0] : null;
      var patch = null;
      if (has && !known && k) patch = { cars: cars.concat([{ plate: car.plate, make: car.make, model: car.model, year: car.year, color: car.color, vin: car.vin }]) };
      if (!c.phone && doc.customerPhone) patch = Object.assign(patch || {}, { phone: doc.customerPhone });
      if (!patch) return Promise.resolve(c);
      return Store.saveCustomer(Object.assign({}, c, patch)).then(function (x) { return x; }, function () { return c; });
    }
    return Store.saveCustomer({ id: C.uid(), name: doc.customerName, phone: doc.customerPhone, cars: has ? [{ plate: car.plate, make: car.make, model: car.model, year: car.year, color: car.color, vin: car.vin }] : [], created: C.today() })
      .then(function (x) { return x; }, function () { return null; });
  }
  /* a car from an insurance company gets its own case in "Insurance reports" (once) */
  function keepClaim(inv) {
    if (inv.source !== 'ins' || !inv.insCo || !Store.can('insurance')) return Promise.resolve();
    var has = S.claims.some(function (c) { return c.invoiceId === inv.id || (inv.claimNo && c.claimNo === inv.claimNo && c.company === inv.insCo); });
    if (has) return Promise.resolve();
    return Store.saveClaim({ id: C.uid(), company: inv.insCo, claimNo: inv.claimNo, invoiceId: inv.id, customerName: inv.customerName, customerPhone: inv.customerPhone,
      car: inv.car, status: 'new', estimate: inv.total, approved: 0, excess: 0, photos: [], payments: [],
      firstNote: L('فُتح الملف من الفاتورة ', 'Case opened from bill ') + inv.number }).then(function () { C.toast(L('فُتح ملف تأمين لهذه السيارة', 'An insurance case was opened for this car')); }, function () {});
  }
  function save(action, btn) {
    cart.lines = cart.lines.filter(function (l) { return num(l.q) > 0; });
    if (uploading) return C.toast(L('انتظر حتى ينتهي رفع الصور', 'Wait until the photos finish uploading'), 'warn');
    if (!cart.lines.length && !cart.cname.trim() && !cart.car.plate.trim()) return C.toast(L('اكتب اسم العميل أو رقم اللوحة، أو أضف عملاً', 'Type the customer name or the plate, or add work'), 'warn');
    var t = totals(), now = paidNow(t), ed = cart.editing;
    if (!ed && now < t.total - 0.0005 && !cart.cname.trim()) { cart.open.car = true; drawCart(); C.toast(L('الفاتورة غير المدفوعة بالكامل تحتاج اسم العميل', 'A bill that is not fully paid needs the customer name'), 'warn'); var n = root.querySelector('#c-name'); if (n) n.focus(); return; }
    var cust = findCustomer();
    var doc = {
      date: ed ? ed.date : C.today(), time: ed ? ed.time : C.nowTime(),
      customerId: cust ? cust.id : '', customerName: cart.cname.trim() || (cust ? cust.name : ''), customerPhone: cart.cphone.trim() || (cust ? cust.phone || '' : ''),
      customerVat: cust ? cust.vatNo || '' : '', note: cart.note, vatPct: vatPct(),
      car: Object.assign({}, cart.car), svc: cart.svc.slice(), source: cart.source, insCo: cart.source === 'ins' ? cart.insCo.trim() : '', claimNo: cart.source === 'ins' ? cart.claimNo.trim() : '',
      complaint: cart.complaint, workNotes: cart.workNotes, doneBy: cart.doneBy, expDate: cart.expDate, timeIn: cart.timeIn, timeOut: cart.timeOut,
      status: cart.status, deliveredAt: ed && ed.status === 'delivered' && cart.status === 'delivered' ? ed.deliveredAt : '', damage: cart.damage.slice(), warranty: Object.assign({}, cart.warranty), photos: cart.photos.slice(),
      items: cart.lines.map(function (l) {
        var p = l.pid ? Store.product(l.pid) : null;
        var it = { pid: p ? p.id : '', kind: p ? (p.kind === 'service' ? 'service' : 'part') : 'manual', grp: l.grp, n: p ? p.name : l.n, a: p ? p.nameEn || '' : (l.a || ''), unit: p ? p.unit || '' : (l.unit || ''), unitEn: p ? p.unitEn || '' : '', q: num(l.q), price: num(l.price) };
        if (!p) it.cost = num(l.cost);
        return it;
      }),
      sub: t.sub, discount: t.discount, vat: t.vat, total: t.total
    };
    if (cart.status === 'delivered' && !doc.timeOut) doc.timeOut = C.nowTime();
    var job;
    if (ed) {
      doc.id = ed.id;
      doc.payments = (ed.payments || []).map(function (p) { return Object.assign({}, p); });
      var over = C.r3(Calc.paid(ed) - t.total);
      if (over > 0.0005 && !cart.refundOk) {
        // the bill became smaller than what the customer already paid: the difference goes back to him
        C.confirmBox(L('الإجمالي الجديد ', 'The new total ') + f3(t.total) + L(' أقل من المدفوع سابقاً ', ' is less than what was already paid ') + f3(Calc.paid(ed)) + L('. سيُسجَّل المدفوع بقيمة الإجمالي الجديد، وتُرجع للعميل ', '. The paid amount will be set to the new total and you give back ') + f3(over) + L(' ر.ع. متابعة؟', ' OMR to the customer. Continue?'), L('نعم، احفظ', 'Yes, save')).then(function (y) { if (y) { cart.refundOk = true; save(action, btn); } });
        return;
      }
      for (var k = doc.payments.length - 1; k >= 0 && over > 0.0005; k--) {          // take the difference off the latest payments
        var cut = Math.min(over, num(doc.payments[k].amount));
        doc.payments[k].amount = C.r3(num(doc.payments[k].amount) - cut); over = C.r3(over - cut);
      }
      doc.payments = doc.payments.filter(function (p) { return num(p.amount) > 0; });
      if (now > 0.0005) doc.payments.push({ amount: now, method: cart.method, date: C.today(), by: S.user.name });
      job = keepCustomer(doc).then(function (c) { if (c && !doc.customerId) doc.customerId = c.id; return Store.updateInvoice(doc); });
    } else {
      doc.payments = now > 0 ? [{ amount: now, method: cart.method, date: C.today() }] : [];
      doc.clientKey = cart.key || (cart.key = C.uid() + C.uid());
      job = keepCustomer(doc).then(function (c) { if (c) doc.customerId = c.id; return Store.createInvoice(doc); });
    }
    C.busy(btn, job).then(function (inv) {
      C.toast((ed ? L('تم حفظ التعديلات: ', 'Changes saved: ') : L('تم حفظ الفاتورة: ', 'Bill saved: ')) + inv.number);
      keepClaim(inv);
      cart = fresh(); ls(draftKey(), null);
      root.querySelector('#cart').classList.remove('open');
      if (ed && action === 'none') { Shell.go('jobs', { open: inv.id }); return; }
      draw();
      if (action === 'print') Print.run(inv, Print.size());
      if (action === 'wa') WhatsApp.open(inv);
    }, function () {});
  }

  /* ------------------------------------------------ page */
  function draw() {
    var cats = catsFor().filter(function (c) { return S.products.some(function (p) { return p.cat === c.id && p.kind === (flt.tab === 'svc' ? 'service' : 'part'); }); });
    root.innerHTML = '<div class="sell"><section>' +
      '<div class="sell-bar"><div class="seg" id="s-tab"><button type="button" data-tab="svc" class="' + (flt.tab === 'svc' ? 'on' : '') + '">' + icon('wrench', 16) + L('الخدمات', 'Services') + '</button><button type="button" data-tab="part" class="' + (flt.tab === 'part' ? 'on' : '') + '">' + icon('box', 16) + L('قطع ومواد', 'Parts & materials') + '</button></div>' +
      '<div class="search">' + icon('search') + '<input class="input" id="s-q" type="search" placeholder="' + (flt.tab === 'svc' ? L('ابحث عن خدمة', 'Search a service') : L('ابحث بالاسم أو الرمز', 'Search by name or code')) + '" value="' + esc(flt.q) + '" autocomplete="off"></div></div>' +
      (cats.length ? '<div class="chips" id="s-cats"><button type="button" class="chip' + (flt.cat ? '' : ' on') + '" data-c="">' + L('الكل', 'All') + '</button>' +
        cats.map(function (c) { return '<button type="button" class="chip' + (flt.cat === c.id ? ' on' : '') + '" data-c="' + esc(c.id) + '">' + esc(C.catName(c)) + '</button>'; }).join('') + '</div>' : '') +
      '<div id="s-grid">' + gridHtml() + '</div></section>' +
      '<aside class="cart" id="cart"></aside></div>' +
      '<button type="button" class="btn primary lg cart-toggle" id="cart-toggle"></button>';
    drawCart();
  }
  function setCar(f, v) { cart.car[f] = v; }
  function bind() {
    root.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('summary[data-sec]'))) { var d = b.parentNode; cart.open[b.getAttribute('data-sec')] = !d.open; return; }
      if ((b = e.target.closest('[data-p]'))) { var p = Store.product(b.getAttribute('data-p')); if (p) add(p); return; }
      if ((b = e.target.closest('[data-tab]'))) { flt.tab = b.getAttribute('data-tab'); flt.cat = ''; flt.q = ''; draw(); return; }
      if ((b = e.target.closest('[data-c]'))) { flt.cat = b.getAttribute('data-c'); draw(); return; }
      if ((b = e.target.closest('[data-svc]'))) { var s = b.getAttribute('data-svc'), i = cart.svc.indexOf(s); if (i >= 0) cart.svc.splice(i, 1); else cart.svc.push(s); drawCart(); return; }
      if ((b = e.target.closest('[data-src]'))) { var src = b.getAttribute('data-src'); cart.source = cart.source === src ? '' : src; drawCart(); return; }
      if ((b = e.target.closest('[data-stage]'))) { cart.status = b.getAttribute('data-stage'); if (cart.status === 'delivered' && !cart.timeOut) cart.timeOut = C.nowTime(); drawCart(); return; }
      if ((b = e.target.closest('[data-tag]'))) { cart.phTag = b.getAttribute('data-tag'); drawCart(); return; }
      if (e.target.closest('[data-ph-cam]')) { Shell.pickPhotos(true, false).then(addPhotos); return; }
      if (e.target.closest('[data-ph-gal]')) { Shell.pickPhotos(false, true).then(addPhotos); return; }
      if ((b = e.target.closest('[data-ph]'))) { Photos.view(cart.photos, +b.getAttribute('data-ph'), { editable: true, onChange: function (l) { cart.photos = l; drawCart(); } }); return; }
      if (e.target.closest('#c-dmg')) { CarDiagram.edit(cart.damage, function (d) { cart.damage = d; drawCart(); }); return; }
      if (e.target.closest('#c-visits')) { var ce = carIndex()[C.plateKey(cart.car.plate)]; if (ce) history(ce); return; }
      if ((b = e.target.closest('[data-m]'))) { cart.method = b.getAttribute('data-m'); drawCart(); return; }
      if ((b = e.target.closest('[data-save]'))) { save(b.getAttribute('data-save'), b); return; }
      if (e.target.closest('#cart-toggle')) { root.querySelector('#cart').classList.add('open'); return; }
      if (e.target.closest('#c-close')) { root.querySelector('#cart').classList.remove('open'); return; }
      if (e.target.closest('#c-clear')) {
        var was = cart.editing;
        if (was) { cart = fresh(); Shell.go('jobs', { open: was.id }); return; }
        if (isEmpty(cart)) return;
        C.confirmBox(L('مسح الفاتورة الحالية والبدء من جديد؟', 'Clear this bill and start a new one?'), L('مسح', 'Clear'), true).then(function (y) {
          if (!y) return;
          var ids = cart.photos.map(function (x) { return x.id; });
          cart = fresh(); ls(draftKey(), null); draw(); Media.del(ids);
        });
        return;
      }
      if (e.target.closest('#c-full')) { cart.paid = cart.editing ? C.r3(totals().total - prevPaid()) : null; drawCart(); return; }
      if (e.target.closest('#c-credit')) { cart.paid = 0; drawCart(); return; }
      if (e.target.closest('#c-manual')) return manual();
      var row = e.target.closest('.cart-line');
      if (row) {
        var l = cart.lines[+row.getAttribute('data-i')];
        if (!l) return;
        if (e.target.closest('[data-rm]')) { cart.lines.splice(+row.getAttribute('data-i'), 1); drawCart(); }
        else if (e.target.closest('[data-plus]')) { l.q = C.r3(num(l.q) + 1); drawCart(); }
        else if (e.target.closest('[data-minus]')) { l.q = C.r3(Math.max(0, num(l.q) - 1)); if (!l.q) cart.lines.splice(+row.getAttribute('data-i'), 1); drawCart(); }
      }
    });
    var fields = { 'c-name': function (v) { cart.cname = v; }, 'c-phone': function (v) { cart.cphone = v; }, 'c-plate': function (v) { setCar('plate', v); }, 'c-km': function (v) { setCar('km', v); },
      'c-make': function (v) { setCar('make', v); }, 'c-model': function (v) { setCar('model', v); }, 'c-year': function (v) { setCar('year', v); }, 'c-color': function (v) { setCar('color', v); }, 'c-vin': function (v) { setCar('vin', v); },
      'c-insco': function (v) { cart.insCo = v; }, 'c-claim': function (v) { cart.claimNo = v; }, 'c-comp': function (v) { cart.complaint = v; }, 'c-work': function (v) { cart.workNotes = v; },
      'c-done': function (v) { cart.doneBy = v; }, 'c-exp': function (v) { cart.expDate = v; }, 'c-tin': function (v) { cart.timeIn = v; }, 'c-tout': function (v) { cart.timeOut = v; },
      'c-war': function (v) { cart.warranty.text = v; }, 'c-wfrom': function (v) { cart.warranty.from = v; }, 'c-wto': function (v) { cart.warranty.to = v; } };
    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 's-q') { flt.q = t.value; root.querySelector('#s-grid').innerHTML = gridHtml(); return; }
      if (fields[t.id]) { fields[t.id](t.value); saveDraft(); if (t.id === 'c-name') { var c = findCustomer(); if (c && !cart.cphone && c.phone) { cart.cphone = c.phone; root.querySelector('#c-phone').value = c.phone; } } return; }
      if (t.id === 'c-disc') { cart.discount = num(t.value); liveTotals(); return; }
      if (t.id === 'c-paid') { cart.paid = t.value.trim() === '' ? null : num(t.value); liveTotals(); return; }
      var row = t.closest('.cart-line');
      if (row) {
        var l = cart.lines[+row.getAttribute('data-i')];
        if (t.hasAttribute('data-q')) l.q = num(t.value);
        if (t.hasAttribute('data-price')) l.price = num(t.value);
        row.querySelector('[data-lt]').textContent = f3(Calc.line(l));
        liveTotals();
      }
    });
    root.addEventListener('change', function (e) {
      var t = e.target, row = t.closest('.cart-line');
      if (t.id === 'c-size') { Print.size(t.value); return; }
      if (t.id === 'c-plate') { var before = JSON.stringify([cart.cname, cart.cphone, cart.car]); lookupPlate(); if (JSON.stringify([cart.cname, cart.cphone, cart.car]) !== before || carIndex()[C.plateKey(cart.car.plate)]) drawCart(); return; }
      if (t.id === 'c-name') {
        var c = findCustomer();
        if (c && !cart.car.plate && (c.cars || []).length === 1) { Object.assign(cart.car, c.cars[0], { km: cart.car.km }); drawCart(); }
        else if (c && !cart.car.plate && (c.cars || []).length > 1) pickCar(c);
        return;
      }
      if (t.id === 'c-war') { drawCart(); return; }
      if (row && (t.hasAttribute('data-q') || t.hasAttribute('data-price'))) drawCart();
    });
  }
  /* a customer with several cars: which one came in? */
  function pickCar(c) {
    var m = C.modal({ title: icon('car') + ' ' + L('أي سيارة؟', 'Which car?'), size: 'sm',
      body: '<div class="unit-pick">' + c.cars.map(function (car, i) { return '<button type="button" data-car="' + i + '"><span>' + esc([car.make, car.model, car.year].filter(Boolean).join(' ') || '-') + '</span><b class="ltr">' + esc(car.plate || '') + '</b></button>'; }).join('') +
        '<button type="button" data-car="-1"><span>' + L('سيارة أخرى (جديدة)', 'Another (new) car') + '</span></button></div>' });
    m.body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-car]'); if (!b) return;
      var i = +b.getAttribute('data-car');
      if (i >= 0) Object.assign(cart.car, c.cars[i], { km: cart.car.km });
      m.close(); drawCart();
    });
  }
  function manual() {
    var seeCost = Store.can('cost');
    var mm = C.modal({ title: L('بند يدوي', 'Manual line'), size: 'sm',
      body: '<div class="col"><div class="field"><label>' + L('الوصف', 'Description') + '</label><input class="input" id="m-n" maxlength="200"></div>' +
        '<div class="field"><label>' + L('النوع', 'Kind') + '</label><div class="seg" id="m-g"><button type="button" data-g="work" class="on">' + L('عمل / أجور', 'Work / labour') + '</button><button type="button" data-g="part">' + L('قطعة غيار', 'Spare part') + '</button><button type="button" data-g="mat">' + L('مواد', 'Material') + '</button></div></div>' +
        '<div class="grid g2 keep"><div class="field"><label>' + L('الكمية', 'Qty') + '</label><input class="input num" id="m-q" inputmode="decimal" value="1"></div><div class="field"><label>' + L('السعر للعميل', 'Price to customer') + '</label><input class="input num" id="m-p" inputmode="decimal" placeholder="0.000"></div></div>' +
        (seeCost ? '<div class="field"><label>' + L('التكلفة علينا (اختياري)', 'Our cost (optional)') + '</label><input class="input num" id="m-c" inputmode="decimal" placeholder="0.000"><span class="hint">' + L('مثال: قطعة اشتريتها من الخارج لهذه السيارة. تُحسب في الأرباح ولا تظهر للعميل.', 'e.g. a part bought outside for this car. Counted in the profit, never shown to the customer.') + '</span></div>' : '') +
        '<p class="small muted">' + L('لا يؤثر على المخزن. لإخراج صنف من المخزن اختره من «قطع ومواد».', 'Does not touch the store. To take an item out of the store, pick it under "Parts & materials".') + '</p></div>',
      foot: '<button type="button" class="btn primary" id="m-ok">' + icon('plus') + L('إضافة', 'Add') + '</button>' });
    var g = 'work';
    mm.el.querySelector('#m-g').onclick = function (e) { var b = e.target.closest('[data-g]'); if (!b) return; g = b.getAttribute('data-g'); [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); };
    mm.el.querySelector('#m-n').focus();
    mm.el.querySelector('#m-ok').onclick = function () {
      var n = mm.el.querySelector('#m-n').value.trim(), q = num(mm.el.querySelector('#m-q').value), pr = num(mm.el.querySelector('#m-p').value), co = seeCost ? num(mm.el.querySelector('#m-c').value) : 0;
      if (!n || q <= 0) return C.toast(L('اكتب الوصف والكمية', 'Type the description and quantity'), 'warn');
      cart.lines.push({ pid: '', kind: 'manual', grp: g, n: n, q: q, price: pr, cost: co }); mm.close(); drawCart();
    };
  }

  Shell.page('sell', {
    title: function () { return cart && cart.editing ? L('تعديل الفاتورة', 'Edit bill') : L('إضافة فاتورة', 'Add bill'); },
    render: function (el) {
      if (!cart) {
        cart = fresh();
        var d = ls(draftKey());
        if (d) { try { var o = JSON.parse(d); if (o && o.car && Array.isArray(o.lines)) { cart = Object.assign(fresh(), o, { editing: null }); C.toast(L('رجعنا إلى الفاتورة التي لم تُحفظ بعد', 'Back to the bill that was not saved yet')); } } catch (x) { /* broken draft */ } }
      }
      root = document.createElement('div'); el.appendChild(root);
      bind();
      draw();
    }
  });

  window.Sell = {
    /* open a saved job card in this screen to change it */
    edit: function (inv) {
      if (cart && !cart.editing && !isEmpty(cart)) ls(draftKey(), JSON.stringify(cart));      // the job card being written is kept
      cart = fresh();
      cart.editing = inv;
      ['complaint', 'workNotes', 'doneBy', 'expDate', 'timeIn', 'timeOut', 'status', 'source', 'insCo', 'claimNo', 'note'].forEach(function (k) { cart[k] = inv[k] || cart[k] || ''; });
      cart.status = inv.status || 'open';
      cart.cname = inv.customerName || ''; cart.cphone = inv.customerPhone || ''; cart.discount = num(inv.discount);
      cart.car = Object.assign(fresh().car, inv.car || {}); cart.svc = (inv.svc || []).slice(); cart.damage = (inv.damage || []).slice();
      cart.photos = (inv.photos || []).map(function (p) { return Object.assign({}, p); }); cart.warranty = Object.assign({ text: '', from: '', to: '' }, inv.warranty || {});
      cart.paid = 0;
      cart.lines = inv.items.map(function (it) {
        var p = it.pid ? Store.product(it.pid) : null;
        if (p) return { pid: p.id, kind: it.kind, grp: it.grp || grpOf(p), q: num(it.q), price: num(it.price) };
        return { pid: '', kind: 'manual', grp: it.grp || 'work', n: it.n, a: it.a, unit: it.unit, q: num(it.q), price: num(it.price), cost: num(it.cost) };
      });
      Shell.go('sell');
    },
    /* start a new job card for a known customer / car (from the customers page or a reminder) */
    start: function (o) {
      if (cart && !cart.editing && !isEmpty(cart)) {
        return C.confirmBox(L('توجد فاتورة لم تُحفظ بعد. استبدالها بفاتورة جديدة؟', 'A bill is not saved yet. Replace it with a new one?'), L('نعم', 'Yes')).then(function (y) { if (y) { cart = null; ls(draftKey(), null); Sell.start(o); } });
      }
      cart = fresh();
      cart.cname = o.name || ''; cart.cphone = o.phone || '';
      if (o.car) cart.car = Object.assign(fresh().car, o.car);
      Shell.go('sell');
    },
    hasDraft: function () { return !!(cart && !cart.editing && !isEmpty(cart)); }
  };
})();
