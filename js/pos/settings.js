/* settings.js - the garage's details and logo, bills (VAT, numbering, print size, transfer number, warranty, repair terms),
   the lists (store categories, units, expense categories, insurance companies), workers and exactly what each may do,
   the change log, photo storage, subscription, where the data is kept, backup / restore, and the user's own password. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, num = C.num;
  var tab = '', root = null;

  var PERMS = [
    ['sell', L('إنشاء أوامر العمل والفواتير', 'Make job cards and bills'), L('شاشة «إضافة فاتورة»، الصور، نقل السيارة بين المراحل، استلام الدفعات، واتساب، وإضافة أعمال لسيارة لم تُسلَّم بعد', 'The "Add bill" screen, photos, moving a car between stages, receiving payments, WhatsApp, adding work to a car not yet delivered')],
    ['edit_inv', L('تعديل وإلغاء الفواتير', 'Edit and void bills'), L('تعديل الفاتورة بعد تسليم السيارة وإلغاؤها. كل تعديل يُسجَّل', 'Change a bill after the car is delivered, and void it. Every change is logged')],
    ['discount', L('الخصم وتغيير الأسعار', 'Discounts and changing prices'), L('يعطي خصماً ويغيّر سعر خدمة لها سعر ثابت', 'Gives discounts and changes the price of a service that has a fixed price')],
    ['cost', L('رؤية سعر الشراء والأرباح', 'See purchase prices and profit'), L('يرى تكلفة القطع وربح كل فاتورة، ويسجّل المشتريات للمخزن', 'Sees what parts cost and each bill\'s profit, and records store purchases')],
    ['stock', L('المخزن والخدمات', 'Store & services'), L('إضافة وتعديل القطع والمواد والخدمات وأسعارها، الصرف والجرد', 'Add / edit parts, materials, services and their prices; use and count the store')],
    ['expenses', L('المصروفات والمشتريات', 'Expenses & purchases'), L('تسجيل المصروفات والمشتريات (تدخل المخزن)', 'Record expenses and purchases (they go into the store)')],
    ['customers', L('إدارة العملاء', 'Manage customers'), L('إضافة وتعديل العملاء وسياراتهم', 'Add and edit customers and their cars')],
    ['insurance', L('تقارير التأمين', 'Insurance reports'), L('فتح ملفات التأمين، السجل، الصور، إرسال التقارير', 'Open insurance cases, the log, photos, send reports')],
    ['reports', L('التقارير', 'Reports'), L('تقارير المبيعات (والأرباح إن كانت لديه صلاحية سعر الشراء)', 'Sales reports (and profit if he may see purchase prices)')]
  ];
  var LOGT = { invoice_edit: ['تعديل فاتورة', 'Bill edited'], invoice_void: ['إلغاء فاتورة', 'Bill voided'], invoice_del: ['حذف فاتورة', 'Bill deleted'], product_add: ['إضافة صنف', 'Item added'], service_add: ['إضافة خدمة', 'Service added'], product_edit: ['تعديل صنف/خدمة', 'Item / service edited'], product_del: ['حذف صنف/خدمة', 'Item / service deleted'],
    purchase_add: ['مشتريات للمخزن', 'Store purchase'], stock_add: ['إضافة كمية', 'Quantity added'], stock_use: ['صرف للورشة', 'Used in workshop'], stock_count: ['جرد', 'Stock count'],
    expense_edit: ['تعديل مصروف', 'Expense edited'], expense_del: ['حذف مصروف', 'Expense deleted'], claim_add: ['ملف تأمين جديد', 'Insurance case added'], claim_status: ['حالة ملف تأمين', 'Insurance case status'], claim_del: ['حذف ملف تأمين', 'Insurance case deleted'],
    settings: ['تغيير الإعدادات', 'Settings changed'], user_add: ['إضافة موظف', 'Worker added'], user_del: ['حذف موظف', 'Worker deleted'], user_perms: ['تغيير صلاحيات', 'Permissions changed'], restore: ['استرجاع نسخة احتياطية', 'Backup restored'] };

  function tabs() {
    var t = [];
    if (Store.isAdmin() || Store.isViewer()) t.push(['shop', L('بيانات الورشة', 'Garage details')], ['bills', L('الفواتير والطباعة', 'Bills & printing')], ['lists', L('القوائم', 'Lists')], ['workers', L('الموظفون والصلاحيات', 'Workers & permissions')], ['log', L('سجل التعديلات', 'Change log')]);
    t.push(['storage', L('مساحة الصور', 'Photo storage')]);
    if (Store.isAdmin() || Store.isViewer()) t.push(['data', L('الاشتراك والبيانات', 'Subscription & data')]);
    t.push(['me', L('حسابي', 'My account')]);
    return t;
  }
  var field = function (label, name, val, attr, hint) { return '<div class="field"><label>' + label + '</label><input class="input" name="' + name + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (attr || '') + '>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; };
  var area = function (label, name, val, rows, hint, attr) { return '<div class="field"><label>' + label + '</label><textarea class="input" name="' + name + '" rows="' + (rows || 3) + '" ' + (attr || '') + '>' + esc(val || '') + '</textarea>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; };
  var saveBtn = function () { return Store.isAdmin() ? '<div class="row mt" style="justify-content:flex-end"><button class="btn primary lg">' + icon('check') + L('حفظ', 'Save') + '</button></div>' : ''; };

  function shopHtml() {
    var s = S.settings;
    return '<form class="card" data-form="shop"><h3>' + icon('store') + L('بيانات الورشة (تظهر في الفواتير)', 'Garage details (shown on bills)') + '</h3>' +
      '<div class="row wrap mb"><div class="brand-mark" style="width:96px;height:96px;border:1px solid var(--line)"><img alt="" src="' + esc(Media.logo()) + '"></div><div class="col" style="gap:6px"><b>' + L('شعار الورشة', 'Garage logo') + '</b><span class="small muted">' + L('يُستخدم كما هو في الفواتير وشاشة الدخول. في النظام الحقيقي يوضع شعار ورشتك هنا.', 'Used exactly as it is on bills and the sign-in screen. In the real system your own logo goes here.') + '</span>' +
      (Store.isAdmin() ? '<div class="row"><button type="button" class="btn soft sm" id="st-logo">' + icon('image', 16) + L('تغيير الشعار', 'Change logo') + '</button>' + (s.logo ? '<button type="button" class="btn danger-soft sm" id="st-logo-rm">' + L('الرجوع للشعار الأصلي', 'Back to the original logo') + '</button>' : '') + '</div>' : '') + '</div></div>' +
      '<div class="grid g2">' + field(L('اسم الورشة بالعربية', 'Garage name (Arabic)'), 'nameAr', s.nameAr) + field(L('اسم الورشة بالإنجليزية', 'Garage name (English)'), 'name', s.name, 'dir="ltr"') +
      field(L('النشاط بالعربية', 'Activity (Arabic)'), 'activityAr', s.activityAr) + field(L('النشاط بالإنجليزية', 'Activity (English)'), 'activity', s.activity, 'dir="ltr"') +
      field(L('العنوان بالعربية', 'Address (Arabic)'), 'addrAr', s.addrAr) + field(L('العنوان بالإنجليزية', 'Address (English)'), 'addr', s.addr, 'dir="ltr"') +
      field(L('رقم النقال (يظهر في الفواتير)', 'Mobile number (on bills)'), 'phone', s.phone, 'dir="ltr" inputmode="tel"') + field(L('رقم التحويل', 'Transfer number'), 'transferNo', s.transferNo, 'dir="ltr" inputmode="tel"', L('الرقم الذي يحوّل عليه العملاء المبالغ. يُطبع على الفواتير ويُذكر في رسائل واتساب عند وجود مبلغ متبقٍ.', 'The number customers transfer money to. Printed on bills and mentioned in WhatsApp messages when something is still owed.')) +
      field(L('البريد الإلكتروني', 'Email'), 'email', s.email, 'dir="ltr"') + field(L('رقم السجل التجاري', 'Commercial registration (C.R.) no.'), 'cr', s.cr, 'dir="ltr"', L('يُطبع على كل فاتورة', 'Printed on every bill')) + '</div>' + saveBtn() + '</form>';
  }
  function billsHtml() {
    var s = S.settings;
    return '<form class="card" data-form="bills"><h3>' + icon('receipt') + L('الفواتير والطباعة', 'Bills & printing') + '</h3><div class="grid g2">' +
      field(L('بادئة رقم الفاتورة', 'Bill number prefix'), 'prefix', s.prefix, 'dir="ltr" maxlength="8"', 'INV-00001') +
      '<div class="field"><label>' + L('مقاس الطباعة الافتراضي', 'Default print size') + '</label><select class="input" name="printSize">' + Print.sizeOptions(s.printSize) + '</select><span class="hint">' + L('كل جهاز يتذكر المقاس الذي يختاره.', 'Each device remembers the size it chooses.') + '</span></div>' +
      '<div class="field"><label>' + L('واتساب على الكمبيوتر يفتح في', 'On a computer, WhatsApp opens in') + '</label><select class="input" name="waChannel"><option value="web">' + L('واتساب ويب (داخل المتصفح)', 'WhatsApp Web (in the browser)') + '</option><option value="app"' + (s.waChannel === 'app' ? ' selected' : '') + '>' + L('تطبيق واتساب المثبّت على الكمبيوتر', 'The WhatsApp app installed on the computer') + '</option></select><span class="hint">' + L('كل كمبيوتر يتذكر ما يُختار في نافذة الإرسال. على الجوال يُستخدم تطبيق واتساب دائماً.', 'Each computer remembers what is chosen in the send window. A phone always uses its WhatsApp app.') + '</span></div>' +
      field(L('نص الضمان الافتراضي (اختياري)', 'Default warranty text (optional)'), 'warrantyText', s.warrantyText, 'maxlength="300"', L('يُكتب تلقائياً في كل أمر عمل جديد ويمكن تغييره.', 'Filled in on every new job card; it can be changed.')) +
      field(L('عبارة أسفل الفاتورة (عربي)', 'Bill footer (Arabic)'), 'footerAr', s.footerAr) + field(L('عبارة أسفل الفاتورة (إنجليزي)', 'Bill footer (English)'), 'footer', s.footer, 'dir="ltr"') + '</div>' +
      '<div class="section-block mt"><h4>' + icon('notes', 18) + L('شروط الإصلاح', 'Repair terms') + '</h4><label class="switch mb"><input type="checkbox" name="printTerms"' + (s.printTerms !== false ? ' checked' : '') + '><i></i><span>' + L('طباعة شروط الإصلاح على فاتورة A4', 'Print the repair terms on the A4 bill') + '</span></label>' +
      '<div class="grid g2">' + area(L('الشروط بالعربية (شرط في كل سطر)', 'Terms in Arabic (one per line)'), 'termsAr', s.termsAr, 8) + area(L('الشروط بالإنجليزية (شرط في كل سطر)', 'Terms in English (one per line)'), 'termsEn', s.termsEn, 8, '', 'dir="ltr"') + '</div></div>' +
      '<div class="section-block mt"><h4>' + L('ضريبة القيمة المضافة', 'VAT') + '</h4><label class="switch mb"><input type="checkbox" name="vatOn"' + (s.vatOn ? ' checked' : '') + '><i></i><span>' + L('الورشة مسجّلة في ضريبة القيمة المضافة', 'The garage is VAT registered') + '</span></label>' +
      '<div class="grid g2">' + field(L('الرقم الضريبي', 'VAT number (VATIN)'), 'vatNo', s.vatNo, 'dir="ltr"') + field(L('نسبة الضريبة %', 'VAT rate %'), 'vatPct', s.vatPct, 'dir="ltr" inputmode="decimal"') + '</div>' +
      '<p class="small muted mt">' + L('إذا كانت الورشة غير مسجّلة تُطبع الفاتورة بدون ضريبة، وهذا هو الصحيح.', 'If the garage is not registered the bill prints with no VAT, which is correct.') + '</p></div>' + saveBtn() + '</form>';
  }
  function listsHtml() {
    var s = S.settings, adm = Store.isAdmin();
    return '<div class="card mb"><h3>' + icon('tag') + L('تصنيفات المخزن', 'Store categories') + '</h3><div class="col" id="l-cats">' + (s.partCats || []).map(function (c, i) {
      var used = S.products.filter(function (p) { return p.kind === 'part' && p.cat === c.id; }).length;
      return '<div class="row" data-ci="' + i + '"><input class="input" data-k="ar" value="' + esc(c.ar) + '" placeholder="' + L('الاسم بالعربية', 'Arabic name') + '"' + (adm ? '' : ' disabled') + '><input class="input ltr" data-k="en" value="' + esc(c.en || '') + '" placeholder="English name"' + (adm ? '' : ' disabled') + '><span class="badge">' + used + '</span>' + (adm ? '<button type="button" class="icon-btn red" data-crm="' + i + '"' + (used ? ' disabled title="' + L('مستخدم', 'In use') + '" style="opacity:.3"' : '') + '>' + icon('trash', 18) + '</button>' : '') + '</div>';
    }).join('') + '</div><p class="small muted mt">' + L('أصناف «مواد صبغ» و«أدوات ومستهلكات» تُكتب في الفاتورة تحت «المواد»، والباقي تحت «قطع الغيار».', 'Items in "Paint materials" and "Tools & consumables" are written on the bill under "Materials"; the rest under "Spare parts".') + '</p>' +
      (adm ? '<div class="row mt"><button type="button" class="btn soft" id="l-cadd">' + icon('plus') + L('تصنيف جديد', 'New category') + '</button><span class="grow"></span><button type="button" class="btn primary" id="l-csave">' + L('حفظ التصنيفات', 'Save categories') + '</button></div>' : '') + '</div>' +
      '<div class="card mb"><h3>' + icon('shield') + L('شركات التأمين', 'Insurance companies') + '</h3><p class="small muted mb">' + L('رقم واتساب الشركة يُستخدم لإرسال تقارير التأمين إليها مباشرة.', "The company's WhatsApp number is used to send insurance reports to it directly.") + '</p><div class="col" id="l-ins">' + (s.insCos || []).map(function (c, i) {
        return '<div class="row wrap" data-ii="' + i + '"><input class="input" data-k="name" style="flex:2 1 180px" value="' + esc(c.name) + '" placeholder="' + L('اسم الشركة', 'Company name') + '"' + (adm ? '' : ' disabled') + '><input class="input ltr" data-k="phone" style="flex:1 1 120px" value="' + esc(c.phone || '') + '" placeholder="' + L('واتساب', 'WhatsApp') + '"' + (adm ? '' : ' disabled') + '><input class="input" data-k="contact" style="flex:1 1 140px" value="' + esc(c.contact || '') + '" placeholder="' + L('الشخص المسؤول', 'Contact person') + '"' + (adm ? '' : ' disabled') + '><input class="input ltr" data-k="email" style="flex:1 1 160px" value="' + esc(c.email || '') + '" placeholder="email"' + (adm ? '' : ' disabled') + '>' + (adm ? '<button type="button" class="icon-btn red" data-irm="' + i + '">' + icon('trash', 18) + '</button>' : '') + '</div>';
      }).join('') + '</div>' + (adm ? '<div class="row mt"><button type="button" class="btn soft" id="l-iadd">' + icon('plus') + L('شركة', 'Company') + '</button><span class="grow"></span><button type="button" class="btn primary" id="l-isave">' + L('حفظ الشركات', 'Save companies') + '</button></div>' : '') + '</div>' +
      '<form class="card mb" data-form="units"><h3>' + icon('box') + L('أسماء الوحدات المقترحة', 'Suggested unit names') + '</h3><div class="field"><textarea class="input" name="units" rows="3"' + (adm ? '' : ' disabled') + '>' + esc((s.units || []).join('\n')) + '</textarea><span class="hint">' + L('وحدة في كل سطر (حبة، لتر، جالون...)', 'One unit per line (piece, litre, gallon...)') + '</span></div>' + saveBtn() + '</form>' +
      '<form class="card" data-form="exp"><h3>' + icon('wallet') + L('بنود المصروفات', 'Expense categories') + '</h3><div class="field"><textarea class="input" name="expCats" rows="5"' + (adm ? '' : ' disabled') + '>' + esc((s.expCats || []).join('\n')) + '</textarea><span class="hint">' + L('بند في كل سطر', 'One category per line') + '</span></div>' + saveBtn() + '</form>';
  }
  function permChecks(sel) {
    return '<div class="grid g2">' + PERMS.map(function (p) { return '<label class="check"><input type="checkbox" value="' + p[0] + '"' + (sel.indexOf(p[0]) >= 0 ? ' checked' : '') + '><span><b>' + p[1] + '</b><span>' + p[2] + '</span></span></label>'; }).join('') + '</div>';
  }
  function workersHtml(el) {
    el.innerHTML = '<div class="card"><p class="muted">' + L('جارٍ التحميل...', 'Loading...') + '</p></div>';
    Store.users().then(function (r) {
      var n = Math.max(0, r.users.filter(function (u) { return u.role === 'staff' || u.role === 'admin'; }).length - 1), adm = Store.isAdmin(), max = r.max_staff || 0;
      el.innerHTML = '<div class="card"><div class="row between wrap mb"><h3 style="margin:0">' + icon('users') + L('الموظفون', 'Workers') + ' <span class="badge ' + (max && n >= max ? 'bad' : 'ok') + '">' + n + ' / ' + max + '</span></h3>' +
        (adm && S.features.staff_accounts && (!max || n < max) ? '<button type="button" class="btn primary" id="w-add">' + icon('plus') + L('موظف جديد', 'New worker') + '</button>' : '') + '</div>' +
        '<p class="small muted mb">' + L('كل موظف يدخل بكلمة مروره الخاصة فقط (بلا اسم مستخدم)، ويرى ويفعل فقط ما تختاره له. مثال: فني يُعطى «إنشاء أوامر العمل» فقط. باقتك تسمح بـ ', 'Each worker signs in with his own password only (no username) and sees and does only what you choose. Example: a technician gets "Make job cards" only. Your plan allows ') + max + L(' موظفاً.', ' workers.') + '</p>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('الاسم', 'Name') + '</th><th>' + L('الدور', 'Role') + '</th><th>' + L('الصلاحيات', 'Permissions') + '</th><th></th></tr></thead><tbody>' +
        r.users.map(function (u) {
          var role = u.role === 'admin' ? '<span class="badge ok">' + L('مدير - صلاحية كاملة', 'Admin - full control') + '</span>' : u.role === 'viewer' ? '<span class="badge info">' + L('دعم - عرض فقط', 'Support - view only') + '</span>' : '<span class="badge">' + L('موظف', 'Worker') + '</span>';
          var mine = u.id === S.user.id, canTouch = adm && !mine && u.role !== 'viewer';
          return '<tr><td><b>' + esc(u.name) + '</b></td><td>' + role + '</td><td class="small">' + (u.role === 'staff' ? (u.perms.length ? u.perms.map(function (k) { var p = PERMS.filter(function (x) { return x[0] === k; })[0]; return '<span class="badge" style="margin:1px">' + (p ? p[1] : k) + '</span>'; }).join(' ') : L('لا شيء (يرى السيارات والمخزن فقط)', 'Nothing (sees cars and the store only)')) : (u.role === 'admin' ? L('كل شيء', 'Everything') : L('يرى كل شيء ولا يغيّر شيئاً', 'Sees everything, changes nothing'))) + '</td>' +
            '<td class="act">' + (canTouch ? (u.role === 'staff' ? '<button type="button" class="icon-btn sm" data-wedit="' + u.id + '" title="' + L('تعديل الصلاحيات', 'Edit permissions') + '">' + icon('edit', 18) + '</button>' : '') + '<button type="button" class="icon-btn sm" data-wpass="' + u.id + '" title="' + L('كلمة مرور جديدة', 'New password') + '">' + icon('lock', 18) + '</button><button type="button" class="icon-btn sm red" data-wdel="' + u.id + '">' + icon('trash', 18) + '</button>' : '') + (mine ? '<span class="small muted">' + L('أنت', 'you') + '</span>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      el.onclick = function (e) {
        var b, find = function (id) { return r.users.filter(function (u) { return u.id === +id; })[0]; };
        if (e.target.closest('#w-add')) return workerForm(null, el);
        if ((b = e.target.closest('[data-wedit]'))) return workerForm(find(b.getAttribute('data-wedit')), el);
        if ((b = e.target.closest('[data-wpass]'))) return passForm(find(b.getAttribute('data-wpass')));
        if ((b = e.target.closest('[data-wdel]'))) { var u = find(b.getAttribute('data-wdel')); C.confirmBox(L('حذف حساب «', 'Delete the account of "') + u.name + L('»؟ يخرج من النظام فوراً وتبقى سجلاته.', '"? Signed out at once; the records stay.'), L('حذف', 'Delete'), true).then(function (y) { if (y) Store.delUser(u.id).then(function () { workersHtml(el); }, function (er) { C.toast(C.errText(er), 'err'); }); }); }
      };
    }, function (e) { el.innerHTML = '<div class="note bad">' + esc(C.errText(e)) + '</div>'; });
  }
  function workerForm(u, el) {
    var m = C.modal({ title: u ? L('صلاحيات الموظف: ', 'Worker permissions: ') + esc(u.name) : L('موظف جديد', 'New worker'), size: 'lg',
      body: '<div class="col">' + (u ? '' : '<div class="seg" id="wf-role" style="align-self:flex-start"><button type="button" data-r="staff" class="on">' + icon('users', 16) + L('موظف بصلاحيات محددة', 'Worker with chosen permissions') + '</button><button type="button" data-r="admin">' + icon('star', 16) + L('شريك - مدير بصلاحية كاملة', 'Partner - admin with full control') + '</button></div>') +
        '<div class="grid g2"><div class="field"><label>' + L('الاسم', 'Name') + '</label><input class="input" id="wf-n" value="' + esc(u ? u.name : '') + '"><span class="hint">' + L('يظهر في الفواتير وفي خانة «الفني».', 'Shown on bills and in the "Technician" box.') + '</span></div>' +
        (u ? '' : '<div class="field"><label>' + L('كلمة المرور الخاصة به (8 خانات أو أكثر)', 'His own password (8+ characters)') + '</label><input class="input ltr" id="wf-p" type="text" autocomplete="off"><span class="hint">' + L('يدخل بكلمة المرور وحدها، لذلك يجب أن تختلف عن كلمات مرور الحسابات الأخرى.', 'He signs in with the password alone, so it must differ from every other account\'s password.') + '</span></div>') + '</div>' +
        '<div id="wf-permbox"><h4 class="mb">' + L('ماذا يستطيع هذا الموظف؟', 'What may this worker do?') + '</h4><div id="wf-perms">' + permChecks(u ? u.perms : ['sell']) + '</div>' +
        '<p class="small muted mt">' + L('موظف بصلاحية «إنشاء أوامر العمل» فقط: يفتح أوامر العمل ويصوّر السيارات ويحفظ ويطبع ويرسل الفواتير، ولا يرى أسعار الشراء ولا الأرباح ولا المصروفات ولا الإعدادات.', 'A worker with "Make job cards" only: opens job cards, photographs cars, saves, prints and sends bills; he never sees purchase prices, profit, expenses or settings.') + '</p></div>' +
        '<div id="wf-adminnote" class="note warn hide">' + icon('alert', 18) + '<span>' + L('الشريك المدير يستطيع كل ما تستطيعه أنت: الأسعار، الحذف، الإعدادات، الموظفون، النسخ الاحتياطي. لا يمكنه حذف حسابك.', 'A partner admin can do everything you can: prices, deletions, settings, workers, backups. He cannot delete your account.') + '</span></div></div>',
      foot: '<button type="button" class="btn primary lg" id="wf-ok">' + icon('check') + L('حفظ', 'Save') + '</button>' });
    var q = function (s) { return m.el.querySelector(s); }, role = 'staff';
    if (q('#wf-role')) q('#wf-role').onclick = function (e) { var b = e.target.closest('[data-r]'); if (!b) return; role = b.getAttribute('data-r'); [].forEach.call(q('#wf-role').children, function (x) { x.classList.toggle('on', x === b); }); q('#wf-permbox').classList.toggle('hide', role === 'admin'); q('#wf-adminnote').classList.toggle('hide', role !== 'admin'); };
    q('#wf-ok').onclick = function () {
      var perms = [].map.call(m.el.querySelectorAll('#wf-perms input:checked'), function (i) { return i.value; }), name = q('#wf-n').value.trim();
      if (!name) return C.toast(L('اكتب اسم الموظف', "Type the worker's name"), 'warn');
      var job = u ? Store.updateUser({ id: u.id, name: name, perms: perms }) : Store.addUser({ name: name, password: q('#wf-p').value, perms: perms, role: role });
      C.busy(q('#wf-ok'), job).then(function () { m.close(); C.toast(L('تم الحفظ', 'Saved')); workersHtml(el); if (S.staff.indexOf(name) < 0) S.staff.push(name); }, function () {});
    };
  }
  function passForm(u) {
    var self = !u;
    var m = C.modal({ title: self ? L('تغيير كلمة المرور', 'Change password') : L('كلمة مرور جديدة لـ ', 'New password for ') + esc(u.name), size: 'sm',
      body: '<div class="col">' + (self ? '<div class="field"><label>' + L('كلمة المرور الحالية', 'Current password') + '</label><input class="input ltr" id="pw-o" type="password" autocomplete="current-password"></div>' : '') +
        '<div class="field"><label>' + L('كلمة المرور الجديدة (8 خانات أو أكثر)', 'New password (8+ characters)') + '</label><input class="input ltr" id="pw-n" type="' + (self ? 'password' : 'text') + '" autocomplete="new-password"></div></div>',
      foot: '<button type="button" class="btn primary" id="pw-ok">' + L('حفظ', 'Save') + '</button>' });
    m.el.querySelector('#pw-ok').onclick = function () {
      var body = { password: m.el.querySelector('#pw-n').value };
      if (self) body.old = m.el.querySelector('#pw-o').value; else body.id = u.id;
      C.busy(m.el.querySelector('#pw-ok'), Store.setPassword(body)).then(function () { m.close(); C.toast(L('تم تغيير كلمة المرور', 'Password changed')); }, function () {});
    };
  }
  function logHtml(el) {
    el.innerHTML = '<div class="card"><p class="muted">' + L('جارٍ التحميل...', 'Loading...') + '</p></div>';
    Store.log().then(function (rows) {
      el.innerHTML = '<div class="card"><h3>' + icon('history') + L('سجل التعديلات', 'Change log') + '</h3><p class="small muted mb">' + L('كل تعديل أو حذف مهم يُسجَّل هنا تلقائياً مع اسم من قام به ووقته، ولا يمكن مسحه.', 'Every important change or deletion is written here automatically with who did it and when. It cannot be erased.') + '</p>' +
        (rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + L('الوقت', 'When') + '</th><th>' + L('المستخدم', 'User') + '</th><th>' + L('العملية', 'Action') + '</th><th>' + L('على', 'On') + '</th><th>' + L('التفاصيل', 'Details') + '</th></tr></thead><tbody>' +
          rows.map(function (r) { var t = LOGT[r.type] || [r.type, r.type]; return '<tr><td class="nowrap small">' + C.fts(r.ts) + '</td><td>' + esc(r.user) + '</td><td><span class="badge">' + L(t[0], t[1]) + '</span></td><td>' + esc(r.ref) + '</td><td class="small ltr">' + esc(r.detail) + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="muted">' + L('لا توجد تعديلات مسجلة بعد.', 'No changes recorded yet.') + '</p>') + '</div>';
    }, function (e) { el.innerHTML = '<div class="note bad">' + esc(C.errText(e)) + '</div>'; });
  }
  function storageHtml() {
    var withPh = S.invoices.filter(function (i) { return (i.photos || []).length; });
    var nPh = S.invoices.reduce(function (t, i) { return t + (i.photos || []).length; }, 0) + S.claims.reduce(function (t, c) { return t + (c.photos || []).length; }, 0);
    return '<div class="rings mb">' + Media.ring(L('صور الورشة (السيارات، التأمين، المخزن)', 'Garage photos (cars, insurance, store)')) + '</div>' +
      '<div class="card"><h3>' + icon('image') + L('كيف تعمل مساحة الصور؟', 'How does photo storage work?') + '</h3><ul style="padding-inline-start:20px;line-height:2">' +
      '<li>' + L('لا يوجد حد لعدد الصور في الفاتورة الواحدة. الحد الوحيد هو المساحة الكلية: 10 جيجابايت.', 'There is no limit on how many photos one job card holds. The only limit is the total room: 10 GB.') + '</li>' +
      '<li>' + L('كل صورة تُصغَّر تلقائياً في الجوال قبل رفعها: صورة الجوال 4-8 ميجابايت تصبح تقريباً 150-300 كيلوبايت مع بقاء تفاصيل الضرر واضحة لشركات التأمين.', 'Every photo is shrunk on the phone before upload: a 4-8 MB phone photo becomes about 150-300 KB while dents and scratches stay clear for insurers.') + '</li>' +
      '<li>' + L('عند امتلاء المساحة يرفض النظام الصور الجديدة فقط، وتبقى الفواتير تعمل. لتفريغ مساحة احذف صور الفواتير القديمة التي لا تحتاجها.', 'When the room is full only new photos are refused; bills keep working. To free room, delete old photos you no longer need.') + '</li></ul>' +
      '<p class="mt">' + L('صور محفوظة في الفواتير وملفات التأمين: ', 'Photos kept on job cards and insurance cases: ') + '<b>' + nPh + '</b> · ' + L('فواتير بها صور: ', 'Job cards with photos: ') + '<b>' + withPh.length + '</b></p></div>';
  }
  /* the subscription dates: shown only. They come from js/subscription.js, which only the provider changes (on renewal),
     so the garage can never move them. */
  function subDates() {
    var sub = window.SUBSCRIPTION || {};
    return { start: sub.start ? new Date(sub.start) : null, end: sub.end ? new Date(sub.end) : null };
  }
  function subCard() {
    var d = subDates(), start = d.start, end = d.end;
    if (!end) return '';
    var form = '<dl class="kv mt" style="max-width:460px"><dt>' + L('تاريخ بداية الاشتراك', 'Subscription start date') + '</dt><dd>' + (start ? C.fdate(C.ymd(start)) : '-') + '</dd>' +
      '<dt>' + L('تاريخ نهاية الاشتراك (موعد التجديد)', 'Subscription end date (renewal)') + '</dt><dd>' + C.fdate(C.ymd(end)) + '</dd></dl>';
    var days = Math.ceil((end - new Date()) / 86400000), total = start ? Math.max(1, (end - start) / 86400000) : 365, pct = Math.max(0, Math.min(100, 100 - days / total * 100));
    return '<div class="card mb"><h3>' + icon('clock') + L('الاشتراك - الباقة المتكاملة', 'Subscription - complete plan') + '</h3><div class="row between wrap"><div><b style="font-size:26px;color:' + (days < 30 ? 'var(--red)' : 'var(--g700)') + '">' + (days >= 0 ? days : 0) + '</b> ' + L('يوماً متبقياً', 'days left') + '</div>' +
      '<div class="small muted">' + L('من ', 'From ') + (start ? C.fdate(C.ymd(start)) : '') + L(' إلى ', ' to ') + C.fdate(C.ymd(end)) + '</div></div><div class="bar mt"><i style="width:' + pct + '%"></i></div>' +
      (days < 30 ? '<p class="ring-msg mt">' + L('الاشتراك قارب على الانتهاء. تواصل مع عُمان فلك للتجديد.', 'The subscription is about to end. Contact Oman Falak to renew.') + '</p>' : '') + form + '</div>';
  }
  function dataHtml(el) {
    el.innerHTML = subCard() + '<div class="card mb" id="d-health"><h3>' + icon('lock') + L('أين تُحفظ بياناتك؟', 'Where is your data kept?') + '</h3><p class="muted">' + L('جارٍ الفحص...', 'Checking...') + '</p></div>' +
      '<div class="card"><h3>' + icon('download') + L('النسخة الاحتياطية', 'Backup') + '</h3><p class="small muted mb">' + L('نزّل نسخة من كل بياناتك (فواتير، عملاء، مخزن، مصروفات، تأمين) واحتفظ بها. السيرفر يحفظ أيضاً نسخة يومية لآخر 30 يوماً. الصور لا تدخل في هذا الملف.', 'Download a copy of all your data (bills, customers, store, expenses, insurance) and keep it. The server also keeps a daily copy for the last 30 days. Photos are not inside this file.') + '</p>' +
      '<div class="row wrap"><button type="button" class="btn primary" id="d-backup">' + icon('download') + L('تنزيل نسخة احتياطية', 'Download backup') + '</button>' + (Store.isAdmin() ? '<button type="button" class="btn ghost" id="d-restore">' + L('استرجاع من ملف', 'Restore from file') + '</button>' : '') + '</div></div>';
    Store.health().then(function (h) {
      var safe = h.kind === 'outside' || h.kind === 'custom';
      el.querySelector('#d-health').innerHTML = '<h3>' + icon('lock') + L('أين تُحفظ بياناتك؟', 'Where is your data kept?') + '</h3>' +
        '<div class="note ' + (safe ? 'ok' : 'warn') + ' mb">' + icon(safe ? 'check' : 'alert', 18) + '<span>' + (safe ? L('مجلد آمن خارج الموقع: لا يتأثر بالتحديثات ولا بتغيير الدومين.', 'Safe folder outside the website: untouched by updates or a change of domain.') : L('داخل مجلد الموقع (محمي). يُفضَّل المجلد الآمن خارج الموقع.', 'Inside the website folder (protected). The safe folder outside the website is preferred.')) + '</span></div>' +
        '<dl class="kv"><dt>' + L('يمكن الحفظ', 'Can save') + '</dt><dd>' + (h.writable ? L('نعم', 'Yes') : L('لا!', 'No!')) + '</dd><dt>' + L('حفظ الصور', 'Photos can be saved') + '</dt><dd>' + (h.media_writable ? L('نعم', 'Yes') : L('لا!', 'No!')) + '</dd><dt>' + L('حجم قاعدة البيانات', 'Database size') + '</dt><dd class="ltr">' + C.bytes(h.db_bytes) + '</dd><dt>' + L('الفواتير / الأصناف', 'Bills / items') + '</dt><dd>' + h.invoices + ' / ' + h.products + '</dd>' +
        '<dt>' + L('النسخ اليومية المحفوظة', 'Daily copies kept') + '</dt><dd>' + h.backups + (h.last_backup ? ' (' + L('آخرها ', 'last ') + C.fdate(h.last_backup) + ')' : '') + '</dd><dt>PHP / SQLite</dt><dd class="ltr">' + esc(h.php) + ' / ' + esc(h.sqlite) + '</dd></dl>';
    }, function (e) { el.querySelector('#d-health').insertAdjacentHTML('beforeend', '<div class="note bad">' + esc(C.errText(e)) + '</div>'); });
    el.onclick = function (e) {
      if (e.target.closest('#d-backup')) {
        var blob = new Blob([JSON.stringify(Store.exportAll())], { type: 'application/json' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'garage-demo-backup-' + C.today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
      }
      if (e.target.closest('#d-restore')) {
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = function () {
          var f = inp.files[0]; if (!f) return;
          var fr = new FileReader();
          fr.onload = function () {
            var data; try { data = JSON.parse(String(fr.result)); } catch (x) { return C.toast(C.errText({ code: 'bad_backup' }), 'err'); }
            C.confirmBox(L('استرجاع هذه النسخة سيستبدل كل البيانات الحالية. هل أنت متأكد؟', 'Restoring this copy replaces ALL current data. Are you sure?'), L('استرجاع', 'Restore'), true).then(function (y) {
              if (y) Store.restore(data).then(function () { C.toast(L('تم الاسترجاع', 'Restored')); Shell.refresh(); }, function (er) { C.toast(C.errText(er), 'err'); });
            });
          };
          fr.readAsText(f);
        };
        inp.click();
      }
    };
  }
  function meHtml() {
    return '<div class="card"><h3>' + icon('users') + esc(S.user.name) + '</h3><dl class="kv mb" style="max-width:420px"><dt>' + L('الدور', 'Role') + '</dt><dd>' + (Store.isAdmin() ? L('مدير', 'Admin') : Store.isViewer() ? L('دعم - عرض فقط', 'Support - view only') : L('موظف', 'Worker')) + '</dd></dl>' +
      '<div class="row wrap">' + (Store.isViewer() ? '' : '<button type="button" class="btn primary" id="me-pass">' + icon('lock') + L('تغيير كلمة المرور', 'Change password') + '</button>') +
      '<button type="button" class="btn ghost" id="me-lang">' + icon('globe') + L('English', 'العربية') + '</button></div></div>';
  }

  function draw() {
    var ts = tabs();
    if (!ts.some(function (t) { return t[0] === tab; })) tab = ts[0][0];
    root.innerHTML = '<div class="tabs">' + ts.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div id="st-body"></div>';
    var el = root.querySelector('#st-body');
    if (tab === 'shop') el.innerHTML = shopHtml();
    else if (tab === 'bills') el.innerHTML = billsHtml();
    else if (tab === 'lists') el.innerHTML = listsHtml();
    else if (tab === 'workers') workersHtml(el);
    else if (tab === 'log') logHtml(el);
    else if (tab === 'storage') el.innerHTML = storageHtml();
    else if (tab === 'data') dataHtml(el);
    else el.innerHTML = meHtml();
    if (!Store.isAdmin()) [].forEach.call(el.querySelectorAll('form input, form select, form textarea'), function (i) { i.disabled = true; });
  }
  function readRows(sel, attr, keys) {
    return [].map.call(root.querySelectorAll(sel + ' [' + attr + ']'), function (row) { var o = {}; keys.forEach(function (k) { o[k] = row.querySelector('[data-k="' + k + '"]').value.trim(); }); return o; });
  }
  function readCats() { var old = S.settings.partCats || []; return readRows('#l-cats', 'data-ci', ['ar', 'en']).map(function (c, i) { return { id: old[i] ? old[i].id : 'c' + C.uid().slice(0, 6), ar: c.ar, en: c.en }; }); }
  function readIns() { return readRows('#l-ins', 'data-ii', ['name', 'phone', 'contact', 'email']); }
  function bind() {
    root.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-tab]'))) { tab = b.getAttribute('data-tab'); draw(); return; }
      if (e.target.closest('#st-logo')) { Shell.pickPhoto(false).then(function (f) { if (!f) return; Media.upload(f, 'logo').then(function (id) { return Store.saveSettings({ logo: id }); }).then(function () { C.toast(L('تم حفظ الشعار', 'Logo saved')); location.reload(); }, function (er) { C.toast(C.errText(er), 'err'); }); }); return; }
      if (e.target.closest('#st-logo-rm')) { Store.saveSettings({ logo: '' }).then(function () { location.reload(); }, function (er) { C.toast(C.errText(er), 'err'); }); return; }
      if (e.target.closest('#l-cadd')) { S.settings.partCats = readCats().concat([{ id: 'c' + C.uid().slice(0, 6), ar: '', en: '' }]); draw(); return; }
      if ((b = e.target.closest('[data-crm]')) && !b.disabled) { var cs = readCats(); cs.splice(+b.getAttribute('data-crm'), 1); S.settings.partCats = cs; draw(); return; }
      if ((b = e.target.closest('#l-csave'))) { C.busy(b, Store.saveSettings({ partCats: readCats().filter(function (c) { return c.ar; }) })).then(function () { C.toast(L('تم الحفظ', 'Saved')); draw(); }, function () {}); return; }
      if (e.target.closest('#l-iadd')) { S.settings.insCos = readIns().concat([{ name: '', phone: '', contact: '', email: '' }]); draw(); return; }
      if ((b = e.target.closest('[data-irm]'))) { var is = readIns(); is.splice(+b.getAttribute('data-irm'), 1); S.settings.insCos = is; draw(); return; }
      if ((b = e.target.closest('#l-isave'))) { C.busy(b, Store.saveSettings({ insCos: readIns().filter(function (c) { return c.name; }) })).then(function () { C.toast(L('تم الحفظ', 'Saved')); draw(); }, function () {}); return; }
      if (e.target.closest('#me-pass')) { passForm(null); return; }
      if (e.target.closest('#me-lang')) C.setLang(C.lang === 'ar' ? 'en' : 'ar');
    });
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, kind = f.getAttribute('data-form'), patch = {};
      [].forEach.call(f.elements, function (i) { if (!i.name) return; patch[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
      if (kind === 'bills') { patch.vatPct = num(patch.vatPct); patch.prefix = (patch.prefix || 'INV').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'INV'; if (patch.vatOn && !patch.vatNo) return C.toast(L('اكتب الرقم الضريبي', 'Type the VAT number'), 'warn'); }
      if (kind === 'exp') patch = { expCats: patch.expCats.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean) };
      if (kind === 'units') patch = { units: patch.units.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean) };
      C.busy(f.querySelector('button.primary'), Store.saveSettings(patch)).then(function () { C.toast(L('تم الحفظ', 'Saved')); if (kind === 'shop') location.reload(); }, function () {});
    });
  }

  Shell.page('settings', {
    title: function () { return L('الإعدادات', 'Settings'); },
    render: function (el, arg) { if (arg && arg.tab) tab = arg.tab; root = document.createElement('div'); el.appendChild(root); bind(); draw(); }
  });
})();
