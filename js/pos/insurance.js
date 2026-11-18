/* insurance.js - "Insurance reports" (تقارير التأمين).
   One case per car repaired for an insurance company: the company, claim and policy numbers, the accident (date, place,
   what happened), the surveyor, the car and its owner, the job card it belongs to, the amounts (our estimate, what the
   company approved, the excess the owner pays, what the company has paid so far), and a LOG: every note, call, document
   sent and stage change, with who and when (notes are only ever added, never rewritten).
   Photos: the case's own photos (accident report, documents, extra pictures) plus the job card's before / after photos.
   The insurance report: an A4 sheet / PDF with all of it and the photos, printed or sent on WhatsApp in one go.
   A job card whose vehicle source is "Insurance" opens its case here by itself. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, num = C.num, f3 = C.f3, Calc = C.Calc;
  var flt = { st: 'open', q: '', co: '' }, root = null;

  function received(c) { return C.r3((c.payments || []).reduce(function (t, p) { return t + num(p.amount); }, 0)); }
  function owedBy(c) { return num(c.approved) > 0 && c.status !== 'rejected' ? Math.max(0, C.r3(num(c.approved) - received(c))) : 0; }
  function stBadge(c) { var s = C.claimSt(c.status); return '<span class="badge ' + s.cls + '">' + esc(C.nm(s)) + '</span>'; }
  function job(c) { return c.invoiceId ? Store.byId(S.invoices, c.invoiceId) : null; }
  function allPhotos(c) { var j = job(c); return (c.photos || []).concat(j ? (j.photos || []).map(function (p) { return Object.assign({ fromJob: true }, p); }) : []); }
  function companies() {
    var set = {}; (S.settings.insCos || []).forEach(function (x) { if (x.name) set[x.name] = 1; }); S.claims.forEach(function (c) { if (c.company) set[c.company] = 1; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'ar'); });
  }
  function coInfo(name) { return (S.settings.insCos || []).filter(function (x) { return x.name === name; })[0] || {}; }

  function list() {
    var q = C.norm(flt.q), kq = C.plateKey(flt.q);
    return S.claims.filter(function (c) {
      if (flt.st === 'open' && (c.status === 'paid' || c.status === 'rejected')) return false;
      if (flt.st && flt.st !== 'open' && flt.st !== 'all' && c.status !== flt.st) return false;
      if (flt.co && c.company !== flt.co) return false;
      if (!q) return true;
      return C.norm([c.number, c.company, c.claimNo, c.policyNo, c.customerName, c.surveyor, c.car && c.car.make, c.car && c.car.model].join(' ')).indexOf(q) >= 0 || (kq.length >= 2 && C.plateKey(c.car && c.car.plate).indexOf(kq) >= 0);
    }).sort(function (a, b) { return num(b.updated || b.created) - num(a.updated || a.created); });
  }
  function draw() {
    var all = S.claims, open = all.filter(function (c) { return c.status !== 'paid' && c.status !== 'rejected'; });
    var waiting = all.reduce(function (t, c) { return t + owedBy(c); }, 0), month = C.today().slice(0, 7);
    var got = all.reduce(function (t, c) { return t + (c.payments || []).filter(function (p) { return String(p.date).slice(0, 7) === month; }).reduce(function (s, p) { return s + num(p.amount); }, 0); }, 0);
    var l = list(), cos = companies();
    root.innerHTML = '<div class="toolbar"><div class="search">' + icon('search') + '<input class="input" id="i-q" type="search" placeholder="' + L('الشركة، رقم المطالبة، اللوحة، العميل', 'Company, claim no., plate, customer') + '" value="' + esc(flt.q) + '"></div>' +
      (cos.length ? '<select class="input" id="i-co" style="width:auto"><option value="">' + L('كل الشركات', 'All companies') + '</option>' + cos.map(function (n) { return '<option' + (flt.co === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' : '') +
      (Store.can('insurance') ? '<button type="button" class="btn primary" id="i-new">' + icon('plus') + L('ملف تأمين جديد', 'New insurance case') + '</button>' : '') + '<button type="button" class="btn ghost" id="i-xl">' + icon('download') + 'Excel</button></div>' +
      '<div class="stats mb"><div class="stat blue"><span>' + icon('shield', 16) + L('ملفات مفتوحة', 'Open cases') + '</span><b>' + open.length + '</b></div>' +
      '<div class="stat amber"><span>' + icon('clock', 16) + L('موافَق عليه ولم يُدفع', 'Approved, not paid yet') + '</span><b class="num">' + f3(waiting) + '</b></div>' +
      '<div class="stat green"><span>' + icon('money', 16) + L('استُلم من شركات التأمين هذا الشهر', 'Received from insurers this month') + '</span><b class="num">' + f3(got) + '</b></div>' +
      '<div class="stat"><span>' + icon('list', 16) + L('كل الملفات', 'All cases') + '</span><b>' + all.length + '</b></div></div>' +
      '<div class="chips mb" id="i-st">' + [['open', L('المفتوحة', 'Open')], ['all', L('الكل', 'All')]].concat(C.CLAIM_ST.map(function (s) { return [s.id, C.nm(s)]; })).map(function (x) { var n = x[0] === 'open' ? open.length : x[0] === 'all' ? all.length : all.filter(function (c) { return c.status === x[0]; }).length; return '<button type="button" class="chip' + (flt.st === x[0] ? ' on' : '') + '" data-st="' + x[0] + '">' + esc(x[1]) + ' <span style="opacity:.7">' + n + '</span></button>'; }).join('') + '</div>' +
      (l.length ? '<div class="claim-list">' + l.map(function (c) {
        var j = job(c), ph = allPhotos(c).length, last = (c.notes || []).filter(function (n) { return n.text; }).slice(-1)[0];
        return '<button type="button" class="claim-card" data-cl="' + esc(c.id) + '"><div class="row between wrap"><b>' + icon('shield', 16) + ' ' + esc(c.company) + '</b>' + stBadge(c) + '</div>' +
          '<div class="row wrap small" style="gap:10px;margin-top:4px"><span class="ltr muted">' + esc(c.number) + '</span>' + (c.claimNo ? '<span>' + L('مطالبة: ', 'Claim: ') + '<b class="ltr">' + esc(c.claimNo) + '</b></span>' : '') + (c.car && c.car.plate ? '<span class="plate ltr">' + esc(c.car.plate) + '</span>' : '') + '<span>' + esc([c.car && c.car.make, c.car && c.car.model].filter(Boolean).join(' ')) + '</span>' + (c.customerName ? '<span>' + esc(c.customerName) + '</span>' : '') + '</div>' +
          (last ? '<p class="small muted claim-last">' + icon('notes', 13) + ' ' + esc(last.text) + ' · ' + C.fts(last.ts) + '</p>' : '') +
          '<div class="row wrap small" style="gap:12px;margin-top:4px">' + (num(c.estimate) ? '<span>' + L('التقدير ', 'Estimate ') + '<b class="num">' + f3(c.estimate) + '</b></span>' : '') + (num(c.approved) ? '<span>' + L('الموافَق ', 'Approved ') + '<b class="num">' + f3(c.approved) + '</b></span>' : '') + (received(c) ? '<span style="color:var(--ok)">' + L('المستلم ', 'Received ') + '<b class="num">' + f3(received(c)) + '</b></span>' : '') + (owedBy(c) ? '<span style="color:var(--red)">' + L('المتبقي ', 'Still owed ') + '<b class="num">' + f3(owedBy(c)) + '</b></span>' : '') +
          (j ? '<span>' + icon('notes', 13) + ' <span class="ltr">' + esc(j.number) + '</span></span>' : '') + (ph ? '<span>' + icon('camera', 13) + ' ' + ph + '</span>' : '') + '</div></button>';
      }).join('') + '</div>' : '<div class="card empty">' + icon('shield', 44) + '<p>' + (all.length ? L('لا توجد ملفات مطابقة', 'No matching cases') : L('لا توجد ملفات تأمين بعد. افتح ملفاً لكل سيارة تُصلَّح على حساب شركة تأمين، أو اختر «تأمين» كمصدر للمركبة في أمر العمل فيُفتح الملف تلقائياً.', 'No insurance cases yet. Open a case for each car repaired for an insurance company, or choose "Insurance" as the vehicle source on a job card and the case opens by itself.')) + '</p></div>');
  }

  /* ------------------------------------------------ the case form */
  function form(c, pre, done) {
    var x = c || Object.assign({ status: 'new', car: {}, photos: [], payments: [] }, pre || {}), cos = companies();
    var jobs = S.invoices.filter(function (i) { return !i.void; }).sort(function (a, b) { return b.no - a.no; }).slice(0, 300);
    var inp = function (id, label, val, attr) { return '<div class="field"><label for="' + id + '">' + label + '</label><input class="input" id="' + id + '" value="' + esc(val || '') + '" ' + (attr || '') + '></div>'; };
    var car = x.car || {};
    var m = C.modal({ title: icon('shield') + ' ' + (c ? L('تعديل ملف التأمين ', 'Edit insurance case ') + '<span class="ltr">' + esc(c.number) + '</span>' : L('ملف تأمين جديد', 'New insurance case')), size: 'lg',
      body: '<div class="grid g2">' + inp('cf-co', L('شركة التأمين *', 'Insurance company *'), x.company, 'list="cf-cos"') + '<datalist id="cf-cos">' + cos.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
        inp('cf-claim', L('رقم المطالبة', 'Claim no.'), x.claimNo, 'dir="ltr"') + inp('cf-pol', L('رقم الوثيقة (البوليصة)', 'Policy no.'), x.policyNo, 'dir="ltr"') + inp('cf-acc', L('تاريخ الحادث', 'Accident date'), x.accidentDate, 'type="date"') +
        inp('cf-loc', L('مكان الحادث', 'Accident place'), x.location) + inp('cf-sur', L('المُقيّم / المسّاح', 'Surveyor / assessor'), x.surveyor) + inp('cf-surp', L('هاتف المُقيّم', "Surveyor's phone"), x.surveyorPhone, 'dir="ltr" inputmode="tel"') +
        '<div class="field"><label for="cf-job">' + L('أمر العمل المرتبط', 'Linked job card') + '</label><select class="input" id="cf-job"><option value="">' + L('بدون', 'None') + '</option>' + jobs.map(function (i) { return '<option value="' + esc(i.id) + '"' + (x.invoiceId === i.id ? ' selected' : '') + '>' + esc(i.number + ' · ' + (i.car.plate || '') + ' · ' + (i.customerName || '')) + '</option>'; }).join('') + '</select></div>' +
        '</div><div class="section-block mt"><h4>' + icon('car', 18) + L('السيارة وصاحبها', 'The car and its owner') + '</h4><div class="grid g3">' +
        inp('cf-plate', L('اللوحة', 'Plate'), car.plate, 'dir="ltr"') + inp('cf-make', L('الشركة', 'Make'), car.make) + inp('cf-model', L('الطراز', 'Model'), car.model) + inp('cf-year', L('السنة', 'Year'), car.year, 'dir="ltr"') + inp('cf-color', L('اللون', 'Colour'), car.color) + inp('cf-vin', L('الشاصي', 'Chassis'), car.vin, 'dir="ltr"') +
        inp('cf-cn', L('اسم صاحب السيارة', "Owner's name"), x.customerName) + inp('cf-cp', L('هاتفه', 'His phone'), x.customerPhone, 'dir="ltr" inputmode="tel"') + '</div></div>' +
        '<div class="field mt"><label for="cf-desc">' + L('وصف الحادث والأضرار', 'What happened and the damage') + '</label><textarea class="input" id="cf-desc" rows="3" maxlength="3000">' + esc(x.desc || '') + '</textarea></div>' +
        '<div class="grid g3 mt">' + inp('cf-est', L('تقديرنا للإصلاح', 'Our repair estimate'), num(x.estimate) ? f3(x.estimate) : '', 'inputmode="decimal" placeholder="0.000"') + inp('cf-app', L('المبلغ الموافَق عليه', 'Approved amount'), num(x.approved) ? f3(x.approved) : '', 'inputmode="decimal" placeholder="0.000"') + inp('cf-exc', L('التحمّل على صاحب السيارة', 'Excess paid by the owner'), num(x.excess) ? f3(x.excess) : '', 'inputmode="decimal" placeholder="0.000"') + '</div>' +
        (c ? '' : '<div class="field mt"><label for="cf-note">' + L('أول ملاحظة في السجل (اختياري)', 'First note in the log (optional)') + '</label><input class="input" id="cf-note" maxlength="2000"></div>'),
      foot: '<button type="button" class="btn primary lg" id="cf-ok">' + icon('check') + L('حفظ', 'Save') + '</button>' });
    var q = function (s) { return m.el.querySelector(s); }, v = function (s) { return q(s) ? q(s).value.trim() : ''; };
    [].forEach.call(m.el.querySelectorAll('#cf-est, #cf-app, #cf-exc'), function (i) { i.classList.add('num'); });
    q('#cf-job').onchange = function () {
      var j = Store.byId(S.invoices, this.value); if (!j) return;
      [['#cf-plate', j.car.plate], ['#cf-make', j.car.make], ['#cf-model', j.car.model], ['#cf-year', j.car.year], ['#cf-color', j.car.color], ['#cf-vin', j.car.vin], ['#cf-cn', j.customerName], ['#cf-cp', j.customerPhone]].forEach(function (p) { if (!q(p[0]).value && p[1]) q(p[0]).value = p[1]; });
      if (!q('#cf-est').value && num(j.total)) q('#cf-est').value = f3(j.total);
      if (!q('#cf-claim').value && j.claimNo) q('#cf-claim').value = j.claimNo;
      if (!q('#cf-co').value && j.insCo) q('#cf-co').value = j.insCo;
    };
    q('#cf-ok').onclick = function () {
      var co = v('#cf-co');
      if (!co) return C.toast(L('اكتب اسم شركة التأمين', 'Type the insurance company'), 'warn');
      var doc = Object.assign({}, x, { id: x.id || C.uid(), company: co, claimNo: v('#cf-claim'), policyNo: v('#cf-pol'), accidentDate: v('#cf-acc'), location: v('#cf-loc'), surveyor: v('#cf-sur'), surveyorPhone: v('#cf-surp'),
        invoiceId: v('#cf-job'), car: { plate: v('#cf-plate'), make: v('#cf-make'), model: v('#cf-model'), year: v('#cf-year'), color: v('#cf-color'), vin: v('#cf-vin') }, customerName: v('#cf-cn'), customerPhone: v('#cf-cp'),
        desc: v('#cf-desc'), estimate: num(v('#cf-est')), approved: num(v('#cf-app')), excess: num(v('#cf-exc')) });
      if (!c) doc.firstNote = v('#cf-note') || L('فُتح الملف', 'Case opened');
      var jobP = Store.saveClaim(doc);
      if (Store.isAdmin() && !(S.settings.insCos || []).some(function (x2) { return x2.name === co; })) jobP = jobP.then(function (d) { return Store.saveSettings({ insCos: (S.settings.insCos || []).concat([{ name: co, phone: '', email: '', contact: '' }]) }).then(function () { return d; }); });
      C.busy(q('#cf-ok'), jobP).then(function (d) { m.close(); C.toast(L('تم الحفظ', 'Saved')); if (done) done(d); else { if (root && root.isConnected) draw(); view(d.id); } }, function () {});
    };
  }

  /* ------------------------------------------------ one case */
  function view(id) {
    var c = Store.byId(S.claims, id); if (!c) return;
    var j = job(c), edit = Store.can('insurance'), car = c.car || {}, photos = allPhotos(c), co = coInfo(c.company);
    var row = function (k, v, ltr) { return v ? '<dt>' + k + '</dt><dd' + (ltr ? ' class="ltr"' : '') + '>' + esc(v) + '</dd>' : ''; };
    var m = C.modal({ title: icon('shield') + ' ' + esc(c.company) + ' <span class="ltr muted small">' + esc(c.number) + '</span> ' + stBadge(c), size: 'xl',
      body: (edit ? '<div class="stage-pick claim mb" id="cv-st">' + C.CLAIM_ST.map(function (s) { return '<button type="button" data-cst="' + s.id + '" class="' + (c.status === s.id ? 'on ' + s.cls : '') + '">' + esc(C.nm(s)) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="grid g3 mb"><div class="card flat"><h3>' + icon('shield', 18) + L('المطالبة', 'Claim') + '</h3><dl class="kv">' + row(L('الشركة', 'Company'), c.company) + row(L('رقم المطالبة', 'Claim no.'), c.claimNo, true) + row(L('رقم الوثيقة', 'Policy no.'), c.policyNo, true) + row(L('تاريخ الحادث', 'Accident date'), c.accidentDate ? C.fdate(c.accidentDate) : '') + row(L('المكان', 'Place'), c.location) + row(L('المُقيّم', 'Surveyor'), c.surveyor) + row(L('هاتفه', 'Phone'), c.surveyorPhone, true) + '</dl></div>' +
        '<div class="card flat"><h3>' + icon('car', 18) + L('السيارة', 'Car') + '</h3><dl class="kv">' + row(L('اللوحة', 'Plate'), car.plate, true) + row(L('السيارة', 'Car'), [car.make, car.model, car.year].filter(Boolean).join(' ')) + row(L('اللون', 'Colour'), car.color) + row(L('الشاصي', 'Chassis'), car.vin, true) + row(L('صاحبها', 'Owner'), c.customerName) + row(L('هاتفه', 'Phone'), c.customerPhone, true) + '</dl>' +
        (j ? '<button type="button" class="btn sm soft mt-s" id="cv-job">' + icon('notes', 15) + L('أمر العمل ', 'Job card ') + esc(j.number) + ' · ' + esc(C.stageName(j.status)) + '</button>' : '') + '</div>' +
        '<div class="card flat"><h3>' + icon('money', 18) + L('المبالغ', 'Amounts') + '</h3><dl class="kv"><dt>' + L('تقديرنا', 'Our estimate') + '</dt><dd class="num">' + f3(c.estimate) + '</dd><dt>' + L('الموافَق عليه', 'Approved') + '</dt><dd class="num">' + f3(c.approved) + '</dd>' + (num(c.excess) ? '<dt>' + L('تحمّل صاحب السيارة', 'Owner\'s excess') + '</dt><dd class="num">' + f3(c.excess) + '</dd>' : '') +
        '<dt>' + L('استُلم من الشركة', 'Received from the company') + '</dt><dd class="num" style="color:var(--ok)">' + f3(received(c)) + '</dd>' + (owedBy(c) ? '<dt style="color:var(--red)">' + L('المتبقي على الشركة', 'Still owed by the company') + '</dt><dd class="num" style="color:var(--red)">' + f3(owedBy(c)) + '</dd>' : '') + (j ? '<dt>' + L('إجمالي أمر العمل', 'Job card total') + '</dt><dd class="num">' + f3(j.total) + '</dd>' : '') + '</dl>' +
        (edit && c.status !== 'rejected' ? '<button type="button" class="btn sm amber mt-s" id="cv-pay">' + icon('money', 15) + L('تسجيل دفعة من الشركة', 'Record a payment from the company') + '</button>' : '') + '</div></div>' +
        (c.desc ? '<div class="note mb"><b>' + L('الحادث: ', 'Accident: ') + '</b>&nbsp;' + esc(c.desc) + '</div>' : '') +
        '<div class="grid g2"><div class="card flat"><h3>' + icon('history', 18) + L('سجل المتابعة', 'Follow-up log') + '</h3>' +
        (edit ? '<form id="cv-nf" class="row mb"><input class="input grow" id="cv-n" maxlength="2000" placeholder="' + L('ماذا حدث؟ مثال: أرسلنا التقدير بالبريد / اتصل المُقيّم / وصلت الموافقة', 'What happened? e.g. estimate e-mailed / the surveyor called / approval received') + '"><button class="btn primary">' + icon('plus') + L('إضافة', 'Add') + '</button></form>' : '') +
        '<div class="timeline">' + (c.notes || []).slice().reverse().map(function (n) { return '<div class="tl"><span class="tl-dot' + (n.status ? ' st' : '') + '"></span><div><div class="small muted">' + C.fts(n.ts) + ' · ' + esc(n.by || '') + '</div>' + (n.status ? '<div>' + L('الحالة أصبحت: ', 'Status changed to: ') + '<b>' + esc(C.nm(C.claimSt(n.status))) + '</b></div>' : '') + (n.text ? '<div style="white-space:pre-wrap">' + esc(n.text) + '</div>' : '') + '</div></div>'; }).join('') + '</div></div>' +
        '<div class="card flat"><div class="row between"><h3 style="margin:0">' + icon('camera', 18) + L('الصور', 'Photos') + ' <span class="badge">' + photos.length + '</span></h3>' + (edit ? '<button type="button" class="btn sm soft" id="cv-photos">' + icon('plus', 16) + L('صور الملف', 'Case photos') + '</button>' : '') + '</div>' +
        '<div class="mt-s">' + (photos.length ? Photos.grid(photos.slice(0, 12), { small: true }) + (photos.length > 12 ? '<p class="small muted">+' + (photos.length - 12) + '</p>' : '') : '<p class="muted small">' + L('لا توجد صور. صور أمر العمل المرتبط تظهر هنا أيضاً.', 'No photos. The linked job card\'s photos show here too.') + '</p>') + '</div>' +
        (j && (j.damage || []).length ? '<div class="dmg-view mt">' + CarDiagram.svg(j.damage) + '<p class="small">' + esc(CarDiagram.list(j.damage)) + '</p></div>' : '') +
        ((c.payments || []).length ? '<h4 class="mt mb">' + L('دفعات الشركة', 'Payments from the company') + '</h4>' + c.payments.map(function (p) { return '<div class="row between small" style="padding:4px 0;border-bottom:1px solid var(--line)"><span>' + C.fdate(p.date) + ' · ' + esc(C.payName(p.method)) + (p.note ? ' · ' + esc(p.note) : '') + '</span><b class="num">' + f3(p.amount) + '</b></div>'; }).join('') : '') + '</div></div>',
      foot: (Store.isAdmin() ? '<button type="button" class="btn danger-soft" id="cv-del">' + icon('trash') + '</button>' : '') + (edit ? '<button type="button" class="btn ghost" id="cv-edit">' + icon('edit') + L('تعديل', 'Edit') + '</button>' : '') + '<span class="grow"></span>' +
        '<button type="button" class="btn ghost" id="cv-print">' + icon('print') + L('طباعة التقرير', 'Print report') + '</button><button type="button" class="btn wa" id="cv-wa">' + icon('whatsapp') + L('إرسال التقرير', 'Send report') + '</button>' });
    var q = function (s) { return m.el.querySelector(s); }, on = function (s, fn) { var e = q(s); if (e) e.onclick = fn; };
    var again = function () { m.close(); view(id); if (root && root.isConnected) draw(); };
    m.el.addEventListener('click', function (e) { var b = e.target.closest('[data-ph]'); if (b) Photos.view(photos, +b.getAttribute('data-ph')); });
    on('#cv-job', function () { m.close(); Jobs.view(j.id); });
    on('#cv-edit', function () { m.close(); form(c, null, function () { if (root && root.isConnected) draw(); view(id); }); });
    on('#cv-print', function () { report(c, 'print'); });
    on('#cv-wa', function () { report(c, 'wa'); });
    on('#cv-photos', function () {
      var changed = false;
      Photos.manage(L('صور ملف التأمين ', 'Photos of insurance case ') + esc(c.number), c.photos, { editable: true, save: function (l) { return Store.saveClaim(Object.assign({}, c, { photos: l })).then(function (d) { c = d; changed = true; }); }, onClose: function () { if (changed) again(); } });
    });
    on('#cv-del', function () { C.confirmBox(L('حذف ملف التأمين نهائياً مع سجله وصوره؟ (أمر العمل لا يتأثر)', 'Delete this insurance case for good, with its log and photos? (The job card is not affected)'), L('حذف', 'Delete'), true).then(function (y) { if (y) Store.removeClaim(c.id).then(function () { m.close(); if (root && root.isConnected) draw(); }, function (er) { C.toast(C.errText(er), 'err'); }); }); });
    var nf = q('#cv-nf');
    if (nf) nf.onsubmit = function (e) { e.preventDefault(); var t = q('#cv-n').value.trim(); if (!t) return; C.busy(nf.querySelector('button'), Store.claimNote(c.id, t)).then(again, function () {}); };
    var sp = q('#cv-st');
    if (sp) sp.onclick = function (e) {
      var b = e.target.closest('[data-cst]'); if (!b || b.getAttribute('data-cst') === c.status) return;
      var st = b.getAttribute('data-cst'), patch = { status: st };
      if (st === 'sent' && !c.sentOn) patch.sentOn = C.today();
      if (st === 'approved' && !c.approvedOn) patch.approvedOn = C.today();
      var go = function () { Store.saveClaim(Object.assign({}, c, patch)).then(again, function (er) { C.toast(C.errText(er), 'err'); }); };
      if (st === 'approved' && !num(c.approved)) {
        var mm = C.modal({ title: L('المبلغ الموافَق عليه', 'Approved amount'), size: 'sm', body: '<div class="field"><label>' + L('كم وافقت الشركة؟', 'How much did the company approve?') + '</label><input class="input num" id="ap" inputmode="decimal" value="' + (num(c.estimate) ? f3(c.estimate) : '') + '"></div>', foot: '<button type="button" class="btn primary" id="ap-ok">' + L('حفظ', 'Save') + '</button>' });
        mm.el.querySelector('#ap-ok').onclick = function () { patch.approved = num(mm.el.querySelector('#ap').value); mm.close(); go(); };
        return;
      }
      go();
    };
    on('#cv-pay', function () {
      var left = owedBy(c) || Math.max(0, C.r3(num(c.estimate) - received(c)));
      var jb = j && !j.void ? Calc.balance(j) : 0;
      var mm = C.modal({ title: L('دفعة من ', 'Payment from ') + esc(c.company), size: 'sm',
        body: '<div class="col"><div class="field"><label>' + L('المبلغ', 'Amount') + '</label><input class="input num" id="cp-a" inputmode="decimal" value="' + (left ? f3(left) : '') + '"></div>' +
          '<div class="field"><label>' + L('الطريقة', 'Method') + '</label><select class="input" id="cp-m">' + ['transfer', 'cheque', 'cash', 'card'].map(function (k) { return '<option value="' + k + '">' + esc(C.payName(k)) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>' + L('التاريخ', 'Date') + '</label><input class="input" type="date" id="cp-d" value="' + C.today() + '"></div>' +
          '<div class="field"><label>' + L('ملاحظة (رقم الشيك / التحويل)', 'Note (cheque / transfer no.)') + '</label><input class="input" id="cp-n" maxlength="120"></div>' +
          (jb > 0.0004 ? '<label class="check"><input type="checkbox" id="cp-job" checked><span><b>' + L('سجّلها أيضاً على أمر العمل ', 'Also record it on job card ') + esc(j.number) + '</b><span>' + L('المتبقي عليه ', 'Its balance is ') + f3(jb) + L(' - حتى يكون رصيد الفاتورة صحيحاً.', ' - so the bill\'s balance stays right.') + '</span></span></label>' : '') + '</div>',
        foot: '<button type="button" class="btn primary" id="cp-ok">' + icon('check') + L('حفظ', 'Save') + '</button>' });
      mm.el.querySelector('#cp-ok').onclick = function () {
        var a = num(mm.el.querySelector('#cp-a').value), meth = mm.el.querySelector('#cp-m').value, d = mm.el.querySelector('#cp-d').value || C.today(), note = mm.el.querySelector('#cp-n').value.trim();
        if (a <= 0) return C.toast(L('اكتب المبلغ', 'Type the amount'), 'warn');
        if (num(c.approved) > 0 && a > owedBy(c) + 0.0005) return C.toast(L('المبلغ أكبر من المتبقي من الموافَق عليه', 'The amount is more than what is left of the approved amount'), 'warn');
        var pays = (c.payments || []).concat([{ amount: a, method: meth, date: d, note: note, by: S.user.name }]);
        var p = Store.saveClaim(Object.assign({}, c, { payments: pays })).then(function () { return Store.claimNote(c.id, L('استُلمت دفعة ', 'Payment received ') + f3(a) + (note ? ' (' + note + ')' : '')); });
        var tick = mm.el.querySelector('#cp-job');
        if (tick && tick.checked) p = p.then(function () { return Store.touchInvoice(j.id, { payment: { amount: Math.min(a, Calc.balance(Store.byId(S.invoices, j.id))), method: meth, date: d, note: c.company } }); });
        C.busy(this, p).then(function () { mm.close(); C.toast(L('تم تسجيل الدفعة', 'Payment saved')); again(); }, function () {});
      };
    });
  }

  /* ------------------------------------------------ the insurance report (print / PDF / WhatsApp) */
  function reportHtml(c, withPrices) {
    var s = S.settings, j = job(c), car = c.car || {}, photos = allPhotos(c);
    var fld = function (en, ar, v, ltr) { return '<div class="pa-f"><span>' + en + '<br><span class="ar">' + ar + '</span></span><b' + (ltr ? ' dir="ltr"' : ' class="ar"') + '>' + esc(v || '') + '</b></div>'; };
    var head = '<div class="pa-head"><div><h1>' + esc(s.name) + '</h1><p>' + esc(s.activity) + '</p>' + (s.phone ? '<p>GSM: <b>' + esc(s.phone) + '</b></p>' : '') + '<p>' + esc(s.addr) + '</p>' + (s.cr ? '<p>C.R.: <b>' + esc(s.cr) + '</b></p>' : '') + '</div><div><img alt="" src="' + esc(Media.logo()) + '"></div>' +
      '<div class="r ar"><h1>' + esc(s.nameAr) + '</h1><p>' + esc(s.activityAr) + '</p>' + (s.phone ? '<p>نقال: <b dir="ltr">' + esc(s.phone) + '</b></p>' : '') + '<p>' + esc(s.addrAr) + '</p>' + (s.cr ? '<p>س.ت: <b dir="ltr">' + esc(s.cr) + '</b></p>' : '') + '</div></div>';
    var title = '<div class="pa-title"><div class="no">' + esc(c.number) + '<br><span style="font-size:9pt;color:#333;font-weight:600">Date / التاريخ: <b dir="ltr">' + C.fdate(C.today()) + '</b></span></div><div class="t"><b>INSURANCE REPAIR REPORT</b><span class="ar">تقرير إصلاح مقدم لشركة التأمين</span></div><div style="font-size:9pt;text-align:end">Status / <span class="ar">الحالة</span>:<br><b>' + esc(C.claimSt(c.status).en) + ' / <span class="ar">' + esc(C.claimSt(c.status).ar) + '</span></b></div></div>';
    var grid = '<div class="pa-grid">' + fld('Insurance company', 'شركة التأمين', c.company) + fld('Claim no', 'رقم المطالبة', c.claimNo, true) + fld('Policy no', 'رقم الوثيقة', c.policyNo, true) + fld('Accident date', 'تاريخ الحادث', c.accidentDate ? C.fdate(c.accidentDate) : '', true) +
      fld('Accident place', 'مكان الحادث', c.location) + fld('Surveyor', 'المُقيّم', [c.surveyor, c.surveyorPhone].filter(Boolean).join(' - ')) + fld('Vehicle owner', 'صاحب المركبة', c.customerName) + fld('Phone', 'الهاتف', c.customerPhone, true) +
      fld('Make / model', 'الشركة / الطراز', [car.make, car.model].filter(Boolean).join(' ')) + fld('Year / colour', 'السنة / اللون', [car.year, car.color].filter(Boolean).join(' / ')) + fld('Registration no', 'رقم اللوحة', car.plate, true) + fld('Chassis no', 'رقم الشاصي', car.vin, true) +
      (j ? fld('Job card', 'أمر العمل', j.number + (j.car.km ? ' · KM ' + j.car.km : ''), true) + fld('Repair stage', 'مرحلة الإصلاح', C.stage(j.status).en + ' / ' + C.stage(j.status).ar) : '') + '</div>';
    var desc = c.desc ? '<div class="pa-note"><b>Accident & damage / <span class="ar">الحادث والأضرار</span>:</b> <span class="ar">' + esc(c.desc) + '</span></div>' : '';
    var work = j && j.workNotes ? '<div class="pa-note"><b>Work done / <span class="ar">ما تم عمله</span>:</b> <span class="ar">' + esc(j.workNotes) + '</span></div>' : '';
    var n = 0, rows = j ? Print.groups(j).map(function (g) { return '<tr class="g"><td colspan="' + (withPrices ? 5 : 3) + '">' + Print.GRP[g.k][0] + ' / <span class="ar">' + Print.GRP[g.k][1] + '</span></td></tr>' + g.items.map(function (it) { n++; return '<tr><td class="c">' + n + '</td><td><span class="ar">' + esc(it.n) + '</span></td><td class="c">' + C.qf(it.q) + '</td>' + (withPrices ? '<td class="e">' + f3(it.price) + '</td><td class="e">' + f3(Calc.line(it)) + '</td>' : '') + '</tr>'; }).join(''); }).join('') : '';
    var table = rows ? '<table class="pa-tbl"><thead><tr><th style="width:8mm">#</th><th>REPAIR WORK & PARTS / <span class="ar">أعمال الإصلاح والقطع</span></th><th style="width:18mm">Qty / <span class="ar">الكمية</span></th>' + (withPrices ? '<th style="width:24mm">Price / <span class="ar">السعر</span></th><th style="width:28mm">Amount / <span class="ar">المبلغ</span></th>' : '') + '</tr></thead><tbody>' + rows +
      (withPrices ? '<tr class="tot"><td colspan="4" class="e">Sub-total / <span class="ar">المجموع</span></td><td class="e">' + f3(j.sub) + '</td></tr>' + (j.discount > 0 ? '<tr class="tot"><td colspan="4" class="e">Discount / <span class="ar">الخصم</span></td><td class="e">-' + f3(j.discount) + '</td></tr>' : '') + (j.vat > 0 ? '<tr class="tot"><td colspan="4" class="e">VAT / <span class="ar">الضريبة</span></td><td class="e">' + f3(j.vat) + '</td></tr>' : '') + '<tr class="tot grand"><td colspan="4" class="e">TOTAL / <span class="ar">الإجمالي</span> (OMR)</td><td class="e">' + f3(j.total) + '</td></tr>' : '') + '</tbody></table>' : '';
    var amounts = '<div class="pa-bottom"><div class="pa-box"><h4><span>AMOUNTS (OMR)</span><span class="ar">المبالغ</span></h4>' +
      [['Our estimate', 'تقديرنا', c.estimate], ['Approved', 'الموافَق عليه', c.approved], ['Owner\'s excess', 'التحمّل', c.excess], ['Received', 'المستلم', received(c)], ['Still owed', 'المتبقي', owedBy(c)]].filter(function (r) { return num(r[2]) > 0 || r[0] === 'Our estimate'; }).map(function (r) { return '<div class="pa-kv"><span>' + r[0] + ' / <span class="ar">' + r[1] + '</span></span><b dir="ltr">' + f3(r[2]) + '</b></div>'; }).join('') + '</div>' +
      '<div class="pa-box" style="text-align:center">' + (j && (j.damage || []).length ? CarDiagram.svg(j.damage).replace('<svg ', '<svg style="width:30mm;height:auto" ') + '<div class="ar" style="font-size:8pt">' + esc(CarDiagram.list(j.damage)) + '</div>' : '<span class="muted">-</span>') + '</div></div>';
    var log = (c.notes || []).length ? '<div class="pa-box" style="margin-top:6px"><h4><span>FOLLOW-UP LOG</span><span class="ar">سجل المتابعة</span></h4>' + c.notes.map(function (x) { return '<div class="pa-kv" style="justify-content:flex-start;gap:10px"><span dir="ltr" style="flex:none">' + C.fts(x.ts) + '</span><b class="ar" style="font-weight:500">' + esc((x.status ? '[' + C.claimSt(x.status).ar + '] ' : '') + (x.text || '')) + ' - ' + esc(x.by || '') + '</b></div>'; }).join('') + '</div>' : '';
    var sign = '<div class="pa-sign"><div>Workshop management / <span class="ar">إدارة الورشة</span></div><div>Surveyor / <span class="ar">المُقيّم</span></div></div>';
    var ph = photos.length ? '<div class="pa-photos">' + photos.map(function (p) { var t = C.tagOf(p.tag); return '<figure><img alt="" src="' + esc(Media.url(p.id)) + '"><figcaption><b>' + t.en + ' / <span class="ar">' + t.ar + '</span></b>' + (p.note ? ' - <span class="ar">' + esc(p.note) + '</span>' : '') + '</figcaption></figure>'; }).join('') + '</div>' : '';
    return '<div class="pa">' + head + title + grid + desc + work + table + amounts + log + sign + ph + '</div>';
  }
  /* the same report, drawn into a PDF (Pdf.kit) */
  function reportPdf(c, withPrices, withPhotos) {
    var K = Pdf.kit, s = S.settings, j = job(c), car = c.car || {}, photos = withPhotos ? allPhotos(c) : [];
    return Promise.all([K.fontsReady(), K.loadImg(Media.logo()), j && (j.damage || []).length ? CarDiagram.image(j.damage) : null, Promise.all(photos.map(function (p) { return K.loadImg(Media.url(p.id)); }))]).then(function (r) {
      var CW = K.CW, PX = K.PX, out = [K.header(s, false, r[1])];
      var st = C.claimSt(c.status);
      out.push({ h: 52, draw: function (cv, x, y) {
        K.text(cv, c.number, x, y + 4, { px: PX(11.5), weight: '800' });
        K.text(cv, 'Date / التاريخ: ' + C.fdate(C.today()), x, y + 4 + PX(11.5) * 1.45, { px: PX(8.6), color: '#333' });
        var t1 = 'INSURANCE REPAIR REPORT', t2 = 'تقرير إصلاح مقدم لشركة التأمين', tw = Math.max(K.wid(t1, '800', PX(12)), K.wid(t2, '700', PX(10.5))) + 30;
        K.strokeBox(cv, x + CW / 2 - tw / 2, y, tw, 46, K.BLUE, 6, [4, 3]);
        K.text(cv, t1, x + CW / 2, y + 5, { px: PX(12), weight: '800', color: K.DARK, align: 'center' });
        K.text(cv, t2, x + CW / 2, y + 5 + PX(12) * 1.45, { px: PX(10.5), weight: '700', align: 'center' });
        K.text(cv, 'Status / الحالة:', x + CW, y + 4, { px: PX(8.4), color: '#333', align: 'right' });
        K.text(cv, st.en + ' / ' + st.ar, x + CW, y + 4 + PX(8.4) * 1.45, { px: PX(9), weight: '700', align: 'right' });
      } });
      var F = [{ en: 'Insurance company', ar: 'شركة التأمين', v: c.company }, { en: 'Claim no', ar: 'رقم المطالبة', v: c.claimNo, ltr: true },
        { en: 'Policy no', ar: 'رقم الوثيقة', v: c.policyNo, ltr: true }, { en: 'Accident date', ar: 'تاريخ الحادث', v: c.accidentDate ? C.fdate(c.accidentDate) : '', ltr: true },
        { en: 'Accident place', ar: 'مكان الحادث', v: c.location }, { en: 'Surveyor', ar: 'المُقيّم', v: [c.surveyor, c.surveyorPhone].filter(Boolean).join(' - ') },
        { en: 'Vehicle owner', ar: 'صاحب المركبة', v: c.customerName }, { en: 'Phone', ar: 'الهاتف', v: c.customerPhone, ltr: true },
        { en: 'Make / model', ar: 'الشركة / الطراز', v: [car.make, car.model].filter(Boolean).join(' ') }, { en: 'Year / colour', ar: 'السنة / اللون', v: [car.year, car.color].filter(Boolean).join(' / ') },
        { en: 'Registration no', ar: 'رقم اللوحة', v: car.plate, ltr: true }, { en: 'Chassis no', ar: 'رقم الشاصي', v: car.vin, ltr: true }];
      if (j) F.push({ en: 'Job card', ar: 'أمر العمل', v: j.number + (j.car.km ? ' · KM ' + j.car.km : ''), ltr: true }, { en: 'Repair stage', ar: 'مرحلة الإصلاح', v: C.stage(j.status).en + ' / ' + C.stage(j.status).ar });
      out.push(K.fieldGrid(F));
      if (c.desc) out.push(K.noteBox('Accident & damage / الحادث والأضرار:', c.desc, CW));
      if (j && j.workNotes) out.push(K.noteBox('Work done / ما تم عمله:', j.workNotes, CW));
      if (j && j.items.length) {
        var cols = withPrices ? [30, 0, 70, 90, 100] : [30, 0, 90]; cols[1] = CW - cols.reduce(function (a, b) { return a + b; }, 0);
        var xs = []; cols.reduce(function (a, w, i) { xs[i] = a; return a + w; }, 0);
        var hp = PX(8.4), thH = hp * 1.45 + 12;
        out.push({ table: 'head', h: thH, draw: function (cv, x, y) {
          K.rect(cv, x, y, CW, thH, K.BLUE);
          var o = { px: hp, weight: '800', color: '#fff', align: 'center' }, t = function (s2, i) { K.text(cv, s2, x + xs[i] + cols[i] / 2, y + 6, o); };
          t('#', 0); t('REPAIR WORK & PARTS / أعمال الإصلاح والقطع', 1); t('Qty / الكمية', 2); if (withPrices) { t('Price / السعر', 3); t('Amount / المبلغ', 4); }
        } });
        var n = 0, tp = PX(9.2), tl = tp * 1.45;
        Print.groups(j).forEach(function (g) {
          var gh = PX(8.4) * 1.45 + 6;
          out.push({ table: 'row', h: gh, draw: function (cv, x, y) { K.rect(cv, x, y, CW, gh, K.SOFT); cv.save(); cv.strokeStyle = K.LINE; cv.strokeRect(x + 0.5, y + 0.5, CW - 1, gh - 1); cv.restore(); K.text(cv, Print.GRP[g.k][0] + ' / ' + Print.GRP[g.k][1], x + 8, y + 3, { px: PX(8.4), weight: '800', color: K.DARK }); } });
          g.items.forEach(function (it) {
            n++; var no = n, nl = K.wrap(it.n, cols[1] - 14, '400', tp), rh = nl.length * tl + 8;
            out.push({ table: 'row', h: rh, draw: function (cv, x, y) {
              cv.save(); cv.strokeStyle = K.LINE; cv.strokeRect(x + 0.5, y + 0.5, CW - 1, rh - 1); xs.slice(1).forEach(function (cx) { cv.beginPath(); cv.moveTo(x + cx + 0.5, y); cv.lineTo(x + cx + 0.5, y + rh); cv.stroke(); }); cv.restore();
              K.text(cv, String(no), x + xs[0] + cols[0] / 2, y + 4, { px: tp, align: 'center' });
              K.para(cv, nl, x + xs[1] + 7, y + 4, cols[1] - 14, tp, tl);
              K.text(cv, C.qf(it.q), x + xs[2] + cols[2] / 2, y + 4, { px: tp, align: 'center' });
              if (withPrices) { K.text(cv, f3(it.price), x + xs[3] + cols[3] - 6, y + 4, { px: tp, align: 'right' }); K.text(cv, f3(Calc.line(it)), x + xs[4] + cols[4] - 6, y + 4, { px: tp, align: 'right' }); }
            } });
          });
        });
        if (withPrices) out.push({ table: 'row', h: PX(10) * 1.45 + 8, draw: function (cv, x, y) { var h = PX(10) * 1.45 + 8; K.rect(cv, x, y, CW, h, K.BLUE); K.text(cv, 'TOTAL / الإجمالي (OMR)', x + xs[4] - 8, y + 4, { px: PX(10), weight: '800', color: '#fff', align: 'right' }); K.text(cv, f3(j.total), x + CW - 6, y + 4, { px: PX(10), weight: '800', color: '#fff', align: 'right' }); } });
        out.push(K.gap(8));
      }
      var hw = (CW - 8) / 2, iw = hw - 18;
      var am = [['Our estimate', 'تقديرنا', c.estimate], ['Approved', 'الموافَق عليه', c.approved], ['Owner\'s excess', 'التحمّل', c.excess], ['Received', 'المستلم', received(c)], ['Still owed', 'المتبقي', owedBy(c)]]
        .filter(function (x) { return num(x[2]) > 0 || x[0] === 'Our estimate'; }).map(function (x) { return K.kv(x[0], x[1], f3(x[2]), iw, { ltr: true, pt: 9, line: true }); });
      var b1 = K.box('AMOUNTS (OMR)', 'المبالغ', am, hw), DW = 90, DH = r[2] ? Math.round(DW * CarDiagram.H / CarDiagram.W) : 0;
      var dl = j && (j.damage || []).length ? K.wrap(CarDiagram.list(j.damage), iw, '400', PX(7.4)) : [];
      var bh = Math.max(b1.h, DH + dl.length * PX(7.4) * 1.4 + 34);
      out.push({ h: bh + 8, draw: function (cv, x, y) {
        K.box('AMOUNTS (OMR)', 'المبالغ', am, hw, bh).draw(cv, x, y);
        K.strokeBox(cv, x + hw + 8, y, hw, bh, '#96b6af', 5);
        K.text(cv, 'DAMAGE / أماكن الضرر', x + hw + 8 + hw / 2, y + 6, { px: PX(8.4), weight: '800', color: K.DARK, align: 'center' });
        if (r[2]) cv.drawImage(r[2], x + hw + 8 + (hw - DW) / 2, y + 24, DW, DH); else K.text(cv, '-', x + hw + 8 + hw / 2, y + 40, { px: PX(10), align: 'center', color: '#999' });
        dl.forEach(function (l, i) { K.text(cv, l, x + hw + 8 + hw / 2, y + 26 + DH + i * PX(7.4) * 1.4, { px: PX(7.4), align: 'center', lh: PX(7.4) * 1.4 }); });
      } });
      if ((c.notes || []).length) {
        var lp = PX(8.6), llh = lp * 1.45, lines = [];
        c.notes.forEach(function (x) { K.wrap(C.fts(x.ts) + '  ·  ' + (x.status ? '[' + C.claimSt(x.status).ar + '] ' : '') + (x.text || '') + ' - ' + (x.by || ''), CW - 20, '400', lp).forEach(function (l) { lines.push(l); }); });
        out.push(K.box('FOLLOW-UP LOG', 'سجل المتابعة', [{ h: lines.length * llh + 2, draw: function (cv, x, y) { K.para(cv, lines, x, y, CW - 18, lp, llh, '#222'); } }], CW));
        out.push(K.gap(6));
      }
      out.push({ h: 50, draw: function (cv, x, y) { var sw = (CW - 30) / 2; ['Workshop management / إدارة الورشة', 'Surveyor / المُقيّم'].forEach(function (g, i) { var sx = x + i * (sw + 30); K.rect(cv, sx, y + 30, sw, 1, '#555'); K.text(cv, g, sx + sw / 2, y + 33, { px: PX(8.6), color: '#333', align: 'center' }); }); } });
      if (photos.length) out = out.concat(K.photoBlocks(photos, r[3], 'Photos / الصور - ' + c.number));
      return Pdf.toPdf(K.paginate(out, 2, c.number), 'Insurance-' + (c.claimNo || c.number));
    });
  }
  function report(c, how) {
    var co = coInfo(c.company);
    if (how === 'print') {
      var m = C.modal({ title: icon('print') + ' ' + L('طباعة تقرير التأمين', 'Print the insurance report'), size: 'sm',
        body: '<div class="col"><label class="check"><input type="checkbox" id="rp-p" checked><span><b>' + L('إظهار الأسعار', 'Show the prices') + '</b><span>' + L('أسعار الأعمال والقطع من أمر العمل', 'Prices of the work and parts from the job card') + '</span></span></label>' +
          '<label class="check"><input type="checkbox" id="rp-ph" checked><span><b>' + L('إرفاق الصور', 'Include the photos') + ' (' + allPhotos(c).length + ')</b><span>' + L('قبل وبعد الإصلاح والمستندات', 'Before / after the repair and the documents') + '</span></span></label></div>',
        foot: '<button type="button" class="btn primary" id="rp-ok">' + icon('print') + L('طباعة', 'Print') + '</button>' });
      m.el.querySelector('#rp-ok').onclick = function () {
        var html = reportHtml(c, m.el.querySelector('#rp-p').checked);
        if (!m.el.querySelector('#rp-ph').checked) html = html.replace(/<div class="pa-photos">[\s\S]*$/, '</div>');
        m.close(); Print.paper(html, 'a4');
      };
      return;
    }
    var ar = C.lang === 'ar', s = S.settings, car = c.car || {}, j = job(c);
    var text = ar ? 'السادة / ' + c.company + ' المحترمين،\nتحية طيبة، مرفق تقرير إصلاح المركبة:\n' + [car.make, car.model, car.year].filter(Boolean).join(' ') + (car.plate ? ' - لوحة ' + car.plate : '') + (c.claimNo ? '\nرقم المطالبة: ' + c.claimNo : '') + (c.customerName ? '\nصاحب المركبة: ' + c.customerName : '') +
      (j ? '\nإجمالي الإصلاح: ' + f3(j.total) + ' ر.ع' : (num(c.estimate) ? '\nتقدير الإصلاح: ' + f3(c.estimate) + ' ر.ع' : '')) + '\nالحالة: ' + C.claimSt(c.status).ar + '\n\n' + (s.nameAr || s.name) + '\n' + s.phone
      : 'Dear ' + c.company + ',\nPlease find attached the repair report for the vehicle:\n' + [car.make, car.model, car.year].filter(Boolean).join(' ') + (car.plate ? ' - plate ' + car.plate : '') + (c.claimNo ? '\nClaim no: ' + c.claimNo : '') + (c.customerName ? '\nOwner: ' + c.customerName : '') +
      (j ? '\nRepair total: ' + f3(j.total) + ' OMR' : (num(c.estimate) ? '\nRepair estimate: ' + f3(c.estimate) + ' OMR' : '')) + '\nStatus: ' + C.claimSt(c.status).en + '\n\n' + s.name + '\n' + s.phone;
    WhatsApp.sendWindow({ title: L('إرسال تقرير التأمين', 'Send the insurance report'), ref: c.claimNo || c.number, phone: co.phone || c.surveyorPhone || '', text: text, sizes: false, photos: allPhotos(c).length,
      makePdf: function (o) { return reportPdf(c, true, o.photos); } });
    if (Store.can('insurance')) Store.claimNote(c.id, L('فُتحت نافذة إرسال التقرير عبر واتساب', 'The report send window was opened (WhatsApp)')).catch(function () {});
  }

  Shell.page('insurance', {
    title: function () { return L('تقارير التأمين', 'Insurance reports'); },
    render: function (el, arg) {
      root = document.createElement('div'); el.appendChild(root); draw();
      root.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-st]'))) { flt.st = b.getAttribute('data-st'); draw(); return; }
        if (e.target.closest('#i-new')) { form(null); return; }
        if (e.target.closest('#i-xl')) {
          var M = XLSX.S.MONEY, rows = [[L('الملف', 'Case'), L('الشركة', 'Company'), L('رقم المطالبة', 'Claim no.'), L('رقم الوثيقة', 'Policy no.'), L('تاريخ الحادث', 'Accident'), L('اللوحة', 'Plate'), L('السيارة', 'Car'), L('صاحبها', 'Owner'), L('الحالة', 'Status'), L('التقدير', 'Estimate'), L('الموافَق', 'Approved'), L('التحمّل', 'Excess'), L('المستلم', 'Received'), L('المتبقي', 'Owed'), L('أمر العمل', 'Job card')]];
          list().forEach(function (c) { var j = job(c); rows.push([c.number, c.company, c.claimNo || '', c.policyNo || '', c.accidentDate ? C.fdate(c.accidentDate) : '', (c.car || {}).plate || '', [(c.car || {}).make, (c.car || {}).model].filter(Boolean).join(' '), c.customerName || '', C.nm(C.claimSt(c.status)), { v: num(c.estimate), s: M }, { v: num(c.approved), s: M }, { v: num(c.excess), s: M }, { v: received(c), s: M }, { v: owedBy(c), s: M }, j ? j.number : '']); });
          Shell.excel('Garage_Insurance', L('التأمين', 'Insurance'), rows, [12, 22, 14, 14, 12, 12, 20, 20, 14, 11, 11, 10, 11, 11, 12]);
          return;
        }
        if ((b = e.target.closest('[data-cl]'))) view(b.getAttribute('data-cl'));
      });
      root.addEventListener('input', function (e) { if (e.target.id === 'i-q') { flt.q = e.target.value; draw(); var i = root.querySelector('#i-q'); i.focus(); i.setSelectionRange(flt.q.length, flt.q.length); } });
      root.addEventListener('change', function (e) { if (e.target.id === 'i-co') { flt.co = e.target.value; draw(); } });
      if (arg && arg.open) view(arg.open);
    }
  });
  window.Insurance = { view: view, form: form, received: received, owedBy: owedBy };
})();
