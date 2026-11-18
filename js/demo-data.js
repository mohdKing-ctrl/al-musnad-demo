/* demo-data.js - DEMO ONLY: the example data the demo starts with (and comes back to with "Reset demo").
   Every name, car, plate, price and bill here is invented for the demo. No phone numbers on purpose.
   Dates are counted back from today, so the demo always looks current. */
(function () {
  'use strict';
  var B = window.BRAND || {};
  /* the demo's accounts: shown on the demo's sign-in screen with their passwords (the real system has no such list) */
  var ACC = [
    { pw: 'owner2026', icon: 'star', ar: 'صاحب الورشة', en: 'Garage owner', roleAr: 'مدير', roleEn: 'Admin', canAr: 'كل شيء: الفواتير، الأسعار، المخزن، المصروفات، التأمين، التقارير، الإعدادات، الموظفون.', canEn: 'Everything: bills, prices, store, expenses, insurance, reports, settings, workers.' },
    { pw: 'office2026', icon: 'receipt', ar: 'سعيد - الاستقبال والحسابات', en: 'Saeed - front desk & accounts', roleAr: 'موظف', roleEn: 'Worker', canAr: 'الفواتير وتعديلها، الخصم، العملاء، التأمين، المصروفات والتقارير. لا يرى أسعار الشراء.', canEn: 'Bills and editing them, discounts, customers, insurance, expenses and reports. No purchase prices.' },
    { pw: 'tech2026', icon: 'wrench', ar: 'أحمد - فني', en: 'Ahmed - technician', roleAr: 'موظف', roleEn: 'Worker', canAr: 'يفتح أوامر العمل ويصوّر السيارات ويضيف الأعمال فقط. لا أسعار شراء، لا مصروفات، لا إعدادات.', canEn: 'Opens job cards, photographs cars and adds work only. No purchase prices, expenses or settings.' }
  ];

  function seed(db) {
    var C = window.Core, now = Math.floor(Date.now() / 1000), today = C.today(), day = function (n) { return C.addDays(today, -n); };
    var docs = db.docs, put = function (col, d) { (docs[col] || (docs[col] = {}))[d.id] = d; return d; };
    var OWNER = ACC[0].ar, OFFICE = 'سعيد', TECH = 'أحمد';

    var settings = C.defaultSettings();
    settings.insCos = [{ name: 'تأمين الواحة (مثال)', phone: '', contact: '', email: '' }, { name: 'تأمين الساحل (مثال)', phone: '', contact: '', email: '' }];
    settings.warrantyText = 'ضمان 3 أشهر على الصبغ و30 يوماً على الأعمال الميكانيكية';
    docs.settings = { main: settings };

    db.users = [
      { id: 1, username: 'owner', name: OWNER, role: 'admin', perms: [], pw: ACC[0].pw },
      { id: 2, username: 'office', name: OFFICE, role: 'staff', perms: ['sell', 'edit_inv', 'discount', 'customers', 'insurance', 'expenses', 'reports'], pw: ACC[1].pw },
      { id: 3, username: 'tech', name: TECH, role: 'staff', perms: ['sell'], pw: ACC[2].pw }
    ];
    db.session = null;

    /* ---- services and prices: [id, type, Arabic, English, price, pinned order] */
    var SV = [
      ['oil', 'mech', 'تغيير زيت وفلتر', 'Oil and filter change', 6, 1], ['diag', 'mech', 'فحص كمبيوتر', 'Computer diagnosis', 5, 2],
      ['padsf', 'mech', 'تغيير سفائف أمامية', 'Front brake pads change', 8, 3], ['ac', 'mech', 'صيانة مكيف وتعبئة غاز', 'A/C service and gas refill', 15, 4],
      ['bumper', 'dent', 'سمكرة وصبغ صدام', 'Bumper denting and painting', 45, 5], ['door', 'paint', 'صبغ باب', 'Door painting', 35, 6],
      ['accident', 'dent', 'إصلاح حادث', 'Accident repair', 0, 7], ['fullpaint', 'paint', 'صبغ سيارة كامل', 'Full car painting', 280, 8],
      ['battery', 'elec', 'تغيير بطارية', 'Battery change', 2, 9], ['polish', 'paint', 'تلميع وبوليش', 'Polishing', 20, 10],
      ['padsr', 'mech', 'تغيير سفائف خلفية', 'Rear brake pads change', 8, 0], ['beltch', 'mech', 'تغيير سير', 'Belt change', 10, 0],
      ['gear', 'mech', 'صيانة قير', 'Gearbox repair', 0, 0], ['elec', 'elec', 'فحص كهرباء', 'Electrical check', 5, 0],
      ['lights', 'elec', 'إصلاح أنوار', 'Lights repair', 7, 0], ['key', 'elec', 'برمجة مفتاح', 'Key programming', 25, 0],
      ['fender', 'dent', 'سمكرة رفرف', 'Fender denting', 25, 0], ['hood', 'paint', 'صبغ كبوت', 'Bonnet painting', 40, 0],
      ['tow', 'other', 'نقل بالسطحة (ونش)', 'Tow truck', 15, 0], ['wash', 'other', 'غسيل', 'Car wash', 3, 0]
    ];
    var P = {};
    SV.forEach(function (x) { P[x[0]] = put('products', { id: 'sv-' + x[0], kind: 'service', cat: x[1], name: x[2], nameEn: x[3], price: x[4], pin: x[5], unit: '', unitEn: '', sku: '', cost: 0, lastCost: 0, stock: 0, minStock: 0, created: now - 86400 * 40, createdBy: OWNER }); });

    /* ---- the store: [id, category, Arabic, English, unit, cost, price, quantity, alert level, shelf] */
    var PT = [
      ['oil5w30', 'oil', 'زيت محرك 5W-30 (4 لتر)', 'Engine oil 5W-30 (4 L)', 'علبة', 7.200, 10.500, 18, 6, 'A1'],
      ['oilf', 'oil', 'فلتر زيت', 'Oil filter', 'حبة', 1.100, 2.500, 25, 8, 'A2'],
      ['airf', 'oil', 'فلتر هواء', 'Air filter', 'حبة', 2.000, 4.000, 4, 5, 'A2'],
      ['padsset', 'parts', 'طقم سفائف أمامية', 'Front brake pad set', 'طقم', 6.500, 12.000, 9, 4, 'B1'],
      ['disc', 'parts', 'هوب فرامل أمامي', 'Front brake disc', 'حبة', 9.000, 16.000, 3, 2, 'B1'],
      ['bat70', 'elec', 'بطارية 70 أمبير', 'Battery 70 Ah', 'حبة', 24.000, 32.000, 5, 2, 'C1'],
      ['bulb', 'elec', 'لمبة أمامية H4', 'Headlight bulb H4', 'حبة', 0.900, 2.000, 30, 10, 'C2'],
      ['gas', 'parts', 'غاز مكيف R134a', 'A/C gas R134a', 'علبة', 3.500, 6.000, 0, 4, 'C3'],
      ['belt', 'parts', 'سير مكينة', 'Engine belt', 'حبة', 4.000, 8.000, 6, 2, 'B2'],
      ['primer', 'paint', 'برايمر', 'Primer', 'لتر', 3.800, 0, 12, 4, 'D1'],
      ['paintw', 'paint', 'صبغ أبيض لؤلؤي', 'Pearl white paint', 'لتر', 9.500, 0, 7, 3, 'D1'],
      ['clear', 'paint', 'ورنيش', 'Clear coat', 'لتر', 6.000, 0, 9, 3, 'D2'],
      ['putty', 'paint', 'معجون سمكرة', 'Body filler', 'علبة', 2.800, 0, 2, 3, 'D2'],
      ['sand', 'tools', 'ورق صنفرة', 'Sandpaper', 'حبة', 0.150, 0, 140, 40, 'E1'],
      ['tape', 'tools', 'شريط تغطية', 'Masking tape', 'حبة', 0.400, 0, 35, 10, 'E1']
    ];
    PT.forEach(function (x) { P[x[0]] = put('products', { id: 'pt-' + x[0], kind: 'part', cat: x[1], name: x[2], nameEn: x[3], unit: x[4], unitEn: '', cost: x[5], lastCost: x[5], price: x[6], stock: x[7], minStock: x[8], shelf: x[9], sku: '', supplier: '', img: '', notes: '', created: now - 86400 * 40, createdBy: OWNER }); });

    /* ---- customers and their cars (no phone numbers: these are examples) */
    var CU = [
      ['c1', 'خالد بن سالم', [{ plate: '12345 أ ب', make: 'تويوتا', model: 'كامري', year: '2019', color: 'أبيض', vin: '' }]],
      ['c2', 'مؤسسة الريان للنقل', [{ plate: '4521 ر د', make: 'نيسان', model: 'باترول', year: '2021', color: 'فضي', vin: '' }, { plate: '7788 ر د', make: 'تويوتا', model: 'هايلكس', year: '2020', color: 'أبيض', vin: '' }]],
      ['c3', 'محمد بن علي', [{ plate: '98021 م', make: 'هيونداي', model: 'سوناتا', year: '2018', color: 'رمادي', vin: '' }]],
      ['c4', 'سالم بن حمد', [{ plate: '30310 س ع', make: 'كيا', model: 'سبورتاج', year: '2022', color: 'أسود', vin: '' }]],
      ['c5', 'يوسف بن ناصر', [{ plate: '5566 ي', make: 'ميتسوبيشي', model: 'باجيرو', year: '2017', color: 'أبيض', vin: '' }]],
      ['c6', 'عبدالله بن راشد', [{ plate: '20907 ع ر', make: 'شيفروليه', model: 'تاهو', year: '2020', color: 'أزرق', vin: '' }]]
    ];
    var cust = {};
    CU.forEach(function (c, i) { cust[c[0]] = put('customers', { id: c[0], name: c[1], phone: '', vatNo: '', addr: '', notes: '', cars: c[2], created: day(60 - i * 5) }); });

    /* ---- job cards: one in every stage */
    function line(key, q, price) {
      var p = P[key], svc = p.kind === 'service';
      return { pid: p.id, kind: svc ? 'service' : 'part', grp: svc ? 'work' : (p.cat === 'paint' || p.cat === 'tools' ? 'mat' : 'part'), n: p.name, a: p.nameEn, unit: p.unit || '', unitEn: '', q: q, price: price === undefined ? p.price : price, cost: svc ? 0 : p.cost };
    }
    var JOBS = [
      // [days ago, customer, car index, stage, svc types, lines, paid ratio, complaint, technician, source, extra]
      [12, 'c1', 0, 'delivered', ['mech'], [line('oil', 1), line('oil5w30', 1), line('oilf', 1), line('airf', 1)], 1, 'تغيير زيت دوري وفحص عام', TECH, 'oman', { km: '84200' }],
      [9, 'c3', 0, 'delivered', ['mech'], [line('padsf', 1), line('padsset', 1), line('disc', 2)], 1, 'صوت عند الفرامل', TECH, 'oman', { km: '121500' }],
      [8, 'c2', 0, 'delivered', ['elec', 'mech'], [line('battery', 1), line('bat70', 1), line('diag', 1), line('beltch', 1), line('belt', 1)], 0.5, 'السيارة لا تشتغل صباحاً', TECH, 'oman', { km: '65300' }],
      [5, 'c4', 0, 'ready', ['dent', 'paint'], [line('bumper', 1), line('primer', 1, 4.5), line('paintw', 1, 12), line('clear', 1, 7), line('putty', 1, 3.5)], 0.4, 'خدش وانبعاج في الصدام الأمامي', TECH, 'oman', { km: '22100', damage: ['fb'] }],
      [3, 'c5', 0, 'work', ['dent', 'paint'], [line('accident', 1, 180), line('fender', 1), line('door', 1), line('primer', 2, 4.5), line('paintw', 2, 12)], 0, 'حادث - الجهة اليمنى', TECH, 'ins', { km: '143000', damage: ['rff', 'rfd', 'fb'], insCo: 'تأمين الواحة (مثال)', claimNo: 'CL-2026-0412' }],
      [1, 'c6', 0, 'open', ['mech'], [line('diag', 1)], 0, 'المكيف لا يبرد', TECH, 'usa', { km: '58700' }],
      [0, 'c2', 1, 'open', ['mech'], [line('oil', 1), line('oil5w30', 1), line('oilf', 1)], 1, 'صيانة دورية', TECH, 'oman', { km: '98000' }]
    ];
    var times = ['08:20', '09:05', '10:30', '11:15', '16:40', '17:25', '18:10'];
    JOBS.forEach(function (j, i) {
      var n = i + 1, c = cust[j[1]], car = Object.assign({ km: '' }, c.cars[j[2]], { km: j[10].km || '' });
      var t = C.Calc.totals(j[5], 0, 0), paid = C.r3(t.total * j[6]), d = day(j[0]), st = j[3];
      var hist = [{ ts: now - j[0] * 86400, by: OFFICE, status: 'open' }];
      if (st !== 'open') hist.push({ ts: now - j[0] * 86400 + 7200, by: TECH, status: 'work' });
      if (st === 'ready' || st === 'delivered') hist.push({ ts: now - Math.max(0, j[0] - 1) * 86400, by: TECH, status: 'ready' });
      if (st === 'delivered') hist.push({ ts: now - Math.max(0, j[0] - 2) * 86400, by: OFFICE, status: 'delivered' });
      put('invoices', {
        id: String(n), no: n, number: 'INV-' + String(n).padStart(5, '0'), date: d, time: times[i % times.length],
        customerId: c.id, customerName: c.name, customerPhone: '', customerVat: '', note: '',
        items: j[5], sub: t.sub, discount: 0, vat: 0, vatPct: 0, total: t.total,
        payments: paid > 0 ? [{ amount: paid, method: i % 3 === 1 ? 'card' : 'cash', date: d, by: OFFICE, note: '' }] : [],
        car: car, svc: j[4], source: j[9], insCo: j[10].insCo || '', claimNo: j[10].claimNo || '', complaint: j[7], workNotes: st === 'delivered' ? 'تم العمل وتجربة السيارة' : '',
        doneBy: j[8], expDate: st === 'delivered' ? '' : C.addDays(today, st === 'work' ? 2 : st === 'open' ? 1 : -1), timeIn: times[i % times.length], timeOut: '',
        status: st, deliveredAt: st === 'delivered' ? day(Math.max(0, j[0] - 2)) : '', damage: j[10].damage || [],
        warranty: { text: j[4].indexOf('paint') >= 0 ? settings.warrantyText : '', from: '', to: '' }, photos: [],
        created: now - j[0] * 86400, createdBy: OFFICE, void: false, history: hist
      });
    });
    db.meta.counter = JOBS.length;

    /* ---- the insurance case of the accident car (job card 5) */
    put('claims', {
      id: 'cl1', no: 1, number: 'INS-00001', company: 'تأمين الواحة (مثال)', claimNo: 'CL-2026-0412', policyNo: 'P-77120', surveyor: 'مقيّم شركة التأمين', surveyorPhone: '',
      customerName: cust.c5.name, customerPhone: '', location: 'دوار المدينة', accidentDate: day(5), sentOn: day(3), approvedOn: day(2), desc: 'صدمة في الرفرف والباب الأمامي الأيمن والصدام الأمامي.',
      estimate: 260, approved: 240, excess: 25, status: 'repair', car: Object.assign({}, cust.c5.cars[0]), invoiceId: '5', photos: [], payments: [],
      notes: [{ ts: now - 4 * 86400, by: OFFICE, text: 'فُتح الملف واستُلمت السيارة', status: 'new' }, { ts: now - 3 * 86400, by: OFFICE, text: 'أُرسل التقدير والصور إلى شركة التأمين', status: 'sent' },
        { ts: now - 2 * 86400, by: OWNER, text: 'وافقت الشركة على 240 ر.ع والتحمّل 25 ر.ع', status: 'approved' }, { ts: now - 2 * 86400 + 3600, by: TECH, text: '', status: 'repair' }],
      created: now - 4 * 86400, createdBy: OFFICE, updated: now - 2 * 86400
    });
    db.meta.ccounter = 1;

    /* ---- expenses: a store purchase (its quantities are already in the store above) and the usual monthly costs */
    put('expenses', { id: 'e1', date: day(15), cat: 'مشتريات للمخزن', title: 'زيوت وفلاتر', supplier: 'مورد قطع الغيار (مثال)', ref: 'S-1042', amount: C.r3(10 * 7.2 + 20 * 1.1), paid: true, method: 'transfer', due: '', paidOn: '',
      items: [{ pid: P.oil5w30.id, n: P.oil5w30.name, unit: P.oil5w30.unit, q: 10, cost: 7.2 }, { pid: P.oilf.id, n: P.oilf.name, unit: P.oilf.unit, q: 20, cost: 1.1 }], created: now - 15 * 86400, createdBy: OWNER });
    [['e2', 14, 'إيجار', 'إيجار الورشة لهذا الشهر', 250, true, 0], ['e3', 10, 'كهرباء وماء', 'فاتورة الكهرباء', 48.5, true, 0], ['e4', 6, 'وقود', 'وقود السطحة', 18, true, 0],
      ['e5', 2, 'صيانة معدات', 'صيانة ضاغط الهواء', 35, true, 0], ['e6', 0, 'رواتب', 'رواتب الفنيين', 900, false, 5]].forEach(function (e) {
      put('expenses', { id: e[0], date: day(e[1]), cat: e[2], title: e[3], supplier: '', ref: '', amount: e[4], paid: e[5], method: 'cash', due: e[5] ? '' : C.addDays(today, e[6]), paidOn: '', items: [], created: now - e[1] * 86400, createdBy: OWNER });
    });

    /* ---- reminders: one shows today (the pop-up on opening), one later */
    put('reminders', { id: 'r1', text: 'طلب غاز مكيف R134a من المورد - نفدت الكمية', showOn: today, phone: '', who: '', plate: '', msg: '', done: false, by: OWNER, created: now - 86400 });
    put('reminders', { id: 'r2', text: 'موعد تغيير الزيت القادم لسيارة خالد بن سالم', showOn: C.addMonths(today, 3), phone: '', who: cust.c1.name, plate: cust.c1.cars[0].plate, msg: 'السلام عليكم، حان موعد تغيير الزيت لسيارتك. نسعد بخدمتك.', done: false, by: OFFICE, created: now - 12 * 86400 });

    /* ---- a store movement: materials used in the workshop */
    put('moves', { id: 'm1', ts: now - 4 * 86400, pid: P.sand.id, name: P.sand.name, unit: P.sand.unit, type: 'use', qty: 20, before: 160, after: 140, reason: 'تجهيز سيارة للصبغ', job: 'INV-00004', by: TECH });

    db.log = [
      { ts: now - 2 * 86400, user: OWNER, type: 'claim_status', ref: 'INS-00001', detail: 'sent > approved' },
      { ts: now - 4 * 86400, user: TECH, type: 'stock_use', ref: P.sand.name, detail: '160 > 140' },
      { ts: now - 15 * 86400, user: OWNER, type: 'purchase_add', ref: 'مورد قطع الغيار (مثال)', detail: '94' }
    ];
  }

  window.GARAGE_DEMO = { key: B.key || 'garage_demo', limit: B.limit || 5, seed: seed, accounts: ACC, media: {} };
})();
