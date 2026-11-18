/* print.js - a job card / bill on paper:
     a4   - the A4 job card and bill, bilingual, laid out like the garage's own paper form (amount in R.O. and Bz.,
            type of services, vehicle source, warranty, the repair terms, the damage drawing, signatures)
     job  - the same A4 sheet WITHOUT prices: the workshop copy for the technicians
     80 / 58 - receipt rolls, in the language of the screen
   Every device remembers the size it prints on; Settings holds the default for a device that never chose.
   Omani rules: garage name, C.R. number, and - only when VAT registered - "Tax invoice", the VAT number and amount. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, f3 = C.f3, Calc = C.Calc, S = Store.s;
  var SIZES = { a4: ['ورقة A4 (فاتورة)', 'A4 sheet (bill)'], job: ['A4 للورشة (بدون أسعار)', 'A4 workshop copy (no prices)'], '80': ['إيصال 80 ملم', 'Receipt 80 mm'], '58': ['إيصال 58 ملم', 'Receipt 58 mm'] };
  var PAYM = { cash: ['Cash', 'نقداً'], card: ['Card / Visa', 'بطاقة / فيزا'], transfer: ['Transfer', 'تحويل'], cheque: ['Cheque', 'شيك'] };
  var GRP = { work: ['Work / Labour', 'الأعمال والأجور'], part: ['Spare parts', 'قطع الغيار'], mat: ['Materials', 'المواد'] };

  function size(v) {
    try {
      if (v !== undefined) { localStorage.setItem(BRAND.key + '_print', v); return v; }
      var s = localStorage.getItem(BRAND.key + '_print');
      if (SIZES[s]) return s;
    } catch (e) { /* private mode */ }
    return SIZES[S.settings.printSize] ? S.settings.printSize : 'a4';
  }
  function sizeOptions(cur) {
    return Object.keys(SIZES).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(L(SIZES[k][0], SIZES[k][1])) + '</option>'; }).join('');
  }
  function docType(inv) { return inv.vatPct > 0 ? ['TAX INVOICE / JOB CARD', 'فاتورة ضريبية / أمر عمل'] : ['JOB CARD / INVOICE', 'أمر عمل / فاتورة']; }
  /* payment method as on the paper form: ACC (on account) / VISA / CASH */
  function payWay(inv) {
    var m = {}; (inv.payments || []).forEach(function (p) { m[p.method] = 1; });
    var out = Object.keys(m).map(function (k) { return PAYM[k] || [k, k]; });
    if (Calc.balance(inv) > 0.0004) out.push(['On account (ACC)', 'آجل / على الحساب']);
    return out;
  }
  /* 12.345 -> ['12', '345'] : rials and baisa, the two amount columns of the paper form */
  function roBz(n) { var s = f3(n).split('.'); return [s[0], s[1]]; }
  function groups(inv) {
    var g = { work: [], part: [], mat: [] };
    inv.items.forEach(function (it) { (g[it.grp] || g[it.kind === 'service' ? 'work' : 'part']).push(it); });
    return ['work', 'part', 'mat'].filter(function (k) { return g[k].length; }).map(function (k) { return { k: k, items: g[k] }; });
  }
  function termsList() { return { ar: String(S.settings.termsAr || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean), en: String(S.settings.termsEn || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean) }; }
  function box(on) { return '<span class="pa-cb' + (on ? ' on' : '') + '">' + (on ? '✓' : '') + '</span>'; }

  var CSS = '' +
    '.pa{font-family:"Tajawal","Segoe UI",Tahoma,Arial,sans-serif;color:#111;font-size:10pt;line-height:1.4;direction:ltr}' +
    '.pa *{box-sizing:border-box}.pa .ar{direction:rtl;unicode-bidi:isolate}' +
    '.pa-head{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;border-bottom:3px solid #11685e;padding-bottom:7px}' +
    '.pa-head h1{font-size:14pt;color:#0d4d46;line-height:1.2}.pa-head p{font-size:8.6pt;color:#333}.pa-head .r{text-align:right}' +
    '.pa-head img{max-width:40mm;max-height:30mm;object-fit:contain}' +
    '.pa-orange{color:#a07400;font-weight:700}' +
    '.pa-title{display:flex;justify-content:space-between;align-items:center;margin:8px 0 6px;gap:10px}' +
    '.pa-title .t{border:1.5px dashed #11685e;border-radius:6px;padding:3px 14px;text-align:center}.pa-title .t b{display:block;font-size:12.5pt;color:#0d4d46}.pa-title .t span{font-size:11pt;font-weight:700}' +
    '.pa-title .no{font-size:12pt;font-weight:800}.pa-title .no span{color:#c0392b;font-size:14pt}' +
    '.pa-void{display:inline-block;border:3px solid #d43d51;color:#d43d51;font-weight:800;font-size:14pt;padding:2px 14px;border-radius:8px;transform:rotate(-6deg)}' +
    '.pa-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #96b6af;border-radius:5px;overflow:hidden;margin-bottom:6px}' +
    '.pa-f{display:flex;border-bottom:1px solid #c3dad5;min-height:22px}.pa-f:nth-child(odd){border-right:1px solid #c3dad5}' +
    '.pa-f>span{background:#ebf5f3;color:#0d4d46;font-size:7.8pt;font-weight:700;padding:3px 6px;width:36%;flex:none;line-height:1.25}' +
    '.pa-f>b{padding:3px 7px;font-size:9.6pt;flex:1;word-break:break-word}' +
    '.pa-f.wide{grid-column:1/-1;border-right:0}.pa-f.wide>span{width:18%}' +
    '.pa-checks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;font-size:8.8pt}' +
    '.pa-checks>div{border:1px solid #c3dad5;border-radius:5px;padding:4px 7px}.pa-checks h5{font-size:8pt;color:#0d4d46;margin-bottom:2px}' +
    '.pa-cbs{display:flex;flex-wrap:wrap;gap:4px 12px}.pa-cbs>span{display:inline-flex;align-items:center;gap:4px}' +
    '.pa-cb{display:inline-grid;place-items:center;width:12px;height:12px;border:1.3px solid #333;font-size:9px;font-weight:800;line-height:1}.pa-cb.on{background:#11685e;border-color:#11685e;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.pa-note{border:1px dashed #96b6af;border-radius:5px;padding:4px 8px;font-size:9pt;margin-bottom:6px;white-space:pre-wrap}' +
    '.pa-tbl{width:100%;border-collapse:collapse;font-size:9.4pt}' +
    '.pa-tbl th{background:#11685e;color:#fff;font-size:8.4pt;padding:4px 6px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1px solid #11685e}' +
    '.pa-tbl td{border:1px solid #b3cec8;padding:3px 6px;vertical-align:top}.pa-tbl .c{text-align:center}.pa-tbl .e{text-align:right;white-space:nowrap}' +
    '.pa-tbl td small{display:block;color:#555;font-size:8pt}.pa-tbl tr{break-inside:avoid}' +
    '.pa-tbl tr.g td{background:#ebf5f3;color:#0d4d46;font-weight:800;font-size:8.6pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.pa-tbl tr.tot td{font-weight:800}.pa-tbl tr.grand td{background:#11685e;color:#fff;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.pa-bottom{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;break-inside:avoid}' +
    '.pa-box{border:1px solid #96b6af;border-radius:5px;padding:5px 8px;font-size:9pt}.pa-box h4{font-size:8.6pt;color:#0d4d46;display:flex;justify-content:space-between;border-bottom:1px solid #d5e7e3;margin-bottom:3px;padding-bottom:2px}' +
    '.pa-kv{display:flex;justify-content:space-between;gap:8px;padding:1px 0}.pa-kv span{color:#555}' +
    '.pa-terms{display:grid;grid-template-columns:1fr 36mm;gap:8px;margin-top:6px;break-inside:avoid;align-items:start}' +
    '.pa-terms ol{padding-inline-start:16px;font-size:7.6pt;line-height:1.45;color:#222}.pa-terms h4{font-size:8.6pt;color:#0d4d46;margin-bottom:2px}' +
    '.pa-terms svg{width:36mm;height:auto}' +
    '.pa-sign{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:20px;font-size:8.8pt;color:#333;text-align:center;break-inside:avoid}.pa-sign div{border-top:1px solid #555;padding-top:3px}' +
    '.pa-release{border:1px solid #96b6af;border-radius:5px;padding:5px 8px;margin-top:8px;font-size:8.8pt;break-inside:avoid}.pa-release p{font-weight:700;text-align:center;margin-bottom:12px}' +
    '.pa-release .lines{display:grid;grid-template-columns:1fr 1fr;gap:18px}.pa-release .lines span{border-bottom:1px dotted #555;display:block;padding-bottom:1px}' +
    '.pa-foot{text-align:center;color:#444;font-size:8.4pt;border-top:1px solid #d5e7e3;margin-top:8px;padding-top:4px}' +
    '.pa-photos{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;break-before:page}.pa-photos figure{break-inside:avoid;border:1px solid #c3dad5;border-radius:5px;padding:3px;margin:0}' +
    '.pa-photos img{width:100%;height:62mm;object-fit:cover;border-radius:3px}.pa-photos figcaption{font-size:8pt;color:#333;padding:2px}' +
    /* receipt rolls */
    '.rc{font-family:"Tajawal","Segoe UI",Tahoma,Arial,sans-serif;color:#000;font-size:9.5pt;line-height:1.4;width:100%}' +
    '.rc.n58{font-size:8.5pt}.rc *{box-sizing:border-box}.rc .c{text-align:center}' +
    '.rc h1{font-size:13pt;text-align:center;line-height:1.25}.rc.n58 h1{font-size:11.5pt}' +
    '.rc img{display:block;margin:0 auto 3px;max-width:34mm;max-height:26mm;object-fit:contain}' +
    '.rc hr{border:0;border-top:1px dashed #000;margin:5px 0}' +
    '.rc .kv{display:flex;justify-content:space-between;gap:8px}.rc .kv b{direction:ltr;unicode-bidi:isolate}' +
    '.rc .it{padding:3px 0;border-bottom:1px dotted #999}.rc .it b{display:block}' +
    '.rc .big{font-size:12.5pt;font-weight:800}.rc .tt{font-weight:800;font-size:11pt;text-align:center;margin:3px 0}' +
    '.rc .void{border:2px solid #000;text-align:center;font-weight:800;padding:2px;margin:4px 0}';

  /* ------------------------------------------------ A4 (bill, or the workshop copy without prices) */
  function a4(inv, noPrice, withPhotos) {
    var s = S.settings, dt = docType(inv), tax = inv.vatPct > 0, paid = Calc.paid(inv), bal = Calc.balance(inv), car = inv.car || {}, logo = Media.logo();
    var fld = function (en, ar, v, wide, ltr) { return '<div class="pa-f' + (wide ? ' wide' : '') + '"><span>' + en + '<br><span class="ar">' + ar + '</span></span><b' + (ltr ? ' dir="ltr"' : ' class="ar"') + '>' + esc(v || '') + '</b></div>'; };
    var pw = payWay(inv);
    var head = '<div class="pa-head"><div><h1>' + esc(s.name) + '</h1><p>' + esc(s.activity) + '</p>' + (s.phone || s.transferNo ? '<p>' + (s.phone ? 'GSM: <b>' + esc(s.phone) + '</b>' : '') + (s.transferNo ? (s.phone ? ' &nbsp;|&nbsp; ' : '') + '<span class="pa-orange">Transfer no: ' + esc(s.transferNo) + '</span>' : '') + '</p>' : '') + '<p>' + esc(s.addr) + '</p>' +
      (s.cr ? '<p>C.R.: <b>' + esc(s.cr) + '</b></p>' : '') + (tax && s.vatNo ? '<p>VATIN: <b>' + esc(s.vatNo) + '</b></p>' : '') + '</div>' +
      '<div><img alt="" src="' + esc(logo) + '"></div>' +
      '<div class="r ar"><h1>' + esc(s.nameAr || s.name) + '</h1><p>' + esc(s.activityAr) + '</p>' + (s.phone || s.transferNo ? '<p>' + (s.phone ? 'نقال: <b dir="ltr">' + esc(s.phone) + '</b>' : '') + (s.transferNo ? (s.phone ? ' &nbsp;|&nbsp; ' : '') + '<span class="pa-orange">رقم التحويل: <span dir="ltr">' + esc(s.transferNo) + '</span></span>' : '') + '</p>' : '') + '<p>' + esc(s.addrAr) + '</p>' +
      (s.cr ? '<p>س.ت: <b dir="ltr">' + esc(s.cr) + '</b></p>' : '') + (tax && s.vatNo ? '<p>الرقم الضريبي: <b dir="ltr">' + esc(s.vatNo) + '</b></p>' : '') + '</div></div>';
    var title = '<div class="pa-title"><div class="no">NO: <span dir="ltr">' + esc(inv.number) + '</span><br><span style="font-size:9pt;color:#333;font-weight:600">Date / التاريخ: <b dir="ltr">' + C.fdate(inv.date) + '</b></span></div>' +
      '<div class="t"><b>' + (noPrice ? 'JOB CARD - WORKSHOP COPY' : dt[0]) + '</b><span class="ar">' + (noPrice ? 'أمر عمل - نسخة الورشة' : dt[1]) + '</span></div>' +
      (inv.void ? '<div class="pa-void">VOID / ملغاة</div>' : '<div style="font-size:8.6pt;text-align:end">' + (noPrice ? '' : 'Payment / <span class="ar">الدفع</span>:<br><b>' + esc(pw.map(function (x) { return x[0]; }).join(' + ') || '-') + '</b><br><b class="ar">' + esc(pw.map(function (x) { return x[1]; }).join(' + ')) + '</b>') + '</div>') + '</div>';
    var grid = '<div class="pa-grid">' +
      fld('Name of customer', 'اسم العميل', inv.customerName || 'Cash customer / عميل نقدي', true) +
      fld('Phone no', 'الهاتف', inv.customerPhone, false, true) + fld('Make', 'الشركة', car.make, false, true) +
      fld('Model', 'الطراز', car.model, false, true) + fld('Year', 'السنة', car.year, false, true) +
      fld('Registration no', 'رقم اللوحة', car.plate, false, true) + fld('Color', 'اللون', car.color) +
      fld('Chassis no', 'رقم الشاصي', car.vin, false, true) + fld('MI / KM', 'العداد', car.km, false, true) +
      fld('Expected delivery', 'موعد التسليم المتوقع', inv.expDate ? C.fdate(inv.expDate) : '', false, true) + fld('Actual delivery', 'تاريخ التسليم الفعلي', inv.deliveredAt ? C.fdate(inv.deliveredAt) : '', false, true) +
      fld('Time in / out', 'وقت الدخول / الخروج', [inv.timeIn, inv.timeOut].filter(Boolean).join('  →  '), false, true) + fld('Done by', 'تم بواسطة', inv.doneBy) +
      (inv.source === 'ins' && (inv.insCo || inv.claimNo) ? fld('Insurance / claim', 'التأمين / رقم المطالبة', [inv.insCo, inv.claimNo].filter(Boolean).join(' - '), true) : '') + '</div>';
    var checks = '<div class="pa-checks"><div><h5>TYPE OF SERVICES / <span class="ar">نوع الخدمة</span></h5><div class="pa-cbs">' + C.SVC.filter(function (x) { return x.id !== 'other' || (inv.svc || []).indexOf('other') >= 0; }).map(function (x) { return '<span>' + box((inv.svc || []).indexOf(x.id) >= 0) + x.en + ' / <span class="ar">' + x.ar + '</span></span>'; }).join('') + '</div></div>' +
      '<div><h5>VEHICLE SOURCE / <span class="ar">مصدر المركبة</span></h5><div class="pa-cbs">' + C.SOURCES.filter(function (x) { return x.id !== 'other' || inv.source === 'other'; }).map(function (x) { return '<span>' + box(inv.source === x.id) + x.en + ' / <span class="ar">' + x.ar + '</span></span>'; }).join('') + '</div></div></div>';
    var notes = (inv.complaint ? '<div class="pa-note"><b>Complaint / <span class="ar">الشكوى</span>:</b> <span class="ar">' + esc(inv.complaint) + '</span></div>' : '') +
      (inv.workNotes ? '<div class="pa-note"><b>Work done / <span class="ar">ما تم عمله</span>:</b> <span class="ar">' + esc(inv.workNotes) + '</span></div>' : '') +
      (inv.note ? '<div class="pa-note"><b>Note / <span class="ar">ملاحظة</span>:</b> <span class="ar">' + esc(inv.note) + '</span></div>' : '');
    var n = 0, rows = groups(inv).map(function (g) {
      return '<tr class="g"><td colspan="' + (noPrice ? 3 : 6) + '">' + GRP[g.k][0] + ' / <span class="ar">' + GRP[g.k][1] + '</span></td></tr>' + g.items.map(function (it) {
        n++; var a = roBz(Calc.line(it));
        return '<tr><td class="c">' + n + '</td><td><span class="ar">' + esc(it.n) + '</span>' + (it.a && it.a !== it.n ? '<small>' + esc(it.a) + '</small>' : '') + '</td><td class="c">' + C.qf(it.q) + (it.unit ? ' <small class="ar">' + esc(it.unit) + '</small>' : '') + '</td>' +
          (noPrice ? '' : '<td class="e">' + f3(it.price) + '</td><td class="e">' + a[0] + '</td><td class="c">' + a[1] + '</td>') + '</tr>';
      }).join('');
    }).join('');
    if (!rows) rows = '<tr><td colspan="' + (noPrice ? 3 : 6) + '" class="c" style="color:#777;height:40px">-</td></tr>';
    var T = function (en, ar, v, cls) { var a = roBz(v); return '<tr class="' + (cls || 'tot') + '"><td colspan="4" class="e">' + en + ' / <span class="ar">' + ar + '</span></td><td class="e">' + a[0] + '</td><td class="c">' + a[1] + '</td></tr>'; };
    var table = '<table class="pa-tbl"><thead><tr><th style="width:8mm">#</th><th>DESCRIPTION / <span class="ar">التفاصيل</span></th><th style="width:20mm">Qty / <span class="ar">الكمية</span></th>' +
      (noPrice ? '' : '<th style="width:22mm">Price / <span class="ar">السعر</span></th><th style="width:20mm">Amount R.O<br><span class="ar">ريال عماني</span></th><th style="width:13mm">Bz.<br><span class="ar">بيسة</span></th>') + '</tr></thead><tbody>' + rows +
      (noPrice ? '' : T('Sub-total', 'المجموع', inv.sub) + (inv.discount > 0 ? T('Discount', 'الخصم', -inv.discount) : '') + (tax ? T('VAT ' + inv.vatPct + '%', 'ضريبة القيمة المضافة', inv.vat) : '') + T('TOTAL', 'الإجمالي', inv.total, 'tot grand') +
        T('Paid', 'المدفوع', paid) + (bal > 0.0004 ? T('Balance due', 'المتبقي', bal) : '')) + '</tbody></table>';
    var w = inv.warranty || {};
    var bottom = '<div class="pa-bottom"><div class="pa-box"><h4><span>WARRANTY</span><span class="ar">الضمان يشمل، إن وجد</span></h4><div class="ar" style="min-height:16px">' + esc(w.text || '-') + '</div>' +
      (w.from || w.to ? '<div class="pa-kv"><span>From / <span class="ar">من</span>: <b dir="ltr">' + (w.from ? C.fdate(w.from) : '....') + '</b></span><span>To / <span class="ar">إلى</span>: <b dir="ltr">' + (w.to ? C.fdate(w.to) : '....') + '</b></span></div>' : '') + '</div>' +
      '<div class="pa-box"><h4><span>PAYMENTS</span><span class="ar">الدفعات</span></h4>' + (noPrice ? '<div>-</div>' : (inv.payments.length ? inv.payments.map(function (p) { var m = PAYM[p.method] || [p.method, p.method]; return '<div class="pa-kv"><span>' + C.fdate(p.date) + ' · ' + m[0] + ' / <span class="ar">' + m[1] + '</span></span><b dir="ltr">' + f3(p.amount) + '</b></div>'; }).join('') : '<div class="muted">-</div>') +
        (s.transferNo ? '<div class="pa-kv" style="margin-top:2px"><span class="pa-orange">For transfer / <span class="ar">للدفع بالتحويل</span></span><b dir="ltr" class="pa-orange">' + esc(s.transferNo) + '</b></div>' : '')) + '</div></div>';
    var tl = termsList(), dmg = (inv.damage || []).length;
    var terms = (s.printTerms !== false && (tl.ar.length || tl.en.length)) || dmg ? '<div class="pa-terms"><div>' + (s.printTerms !== false && tl.ar.length ? '<h4 class="ar">شروط الإصلاح:</h4><ol class="ar">' + tl.ar.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '') +
      (s.printTerms !== false && tl.en.length ? '<h4>Repair terms:</h4><ol>' + tl.en.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '') + '</div>' +
      '<div style="text-align:center">' + CarDiagram.svg(inv.damage) + (dmg ? '<div style="font-size:7.4pt" class="ar">' + esc(CarDiagram.list(inv.damage)) + '</div>' : '') + '</div></div>' : '';
    var sign = '<div class="pa-sign"><div>Workshop management / <span class="ar">إدارة الورشة</span></div><div>Customer signature / <span class="ar">توقيع الزبون</span><br><span style="font-size:7.6pt" class="ar">أوافق على كافة الشروط</span></div></div>' +
      '<div class="pa-release"><p class="ar">إخلاء طرف: قد استلمت السيارة من الورشة بحالة جيدة وقد تم إصلاح الأشياء المطلوبة على أكمل وجه.</p><p style="font-weight:400;margin-top:-10px">Release: I received the car from the workshop in good condition with the requested repairs fully done.</p>' +
      '<div class="lines"><span>Name / <span class="ar">الاسم</span>:</span><span>Signature / <span class="ar">التوقيع</span>:</span></div></div>';
    var foot = '<div class="pa-foot"><span class="ar">' + esc(s.footerAr) + '</span>' + (s.footer ? ' · ' + esc(s.footer) : '') + '</div>';
    var photos = withPhotos && (inv.photos || []).length ? '<div class="pa-photos">' + inv.photos.map(function (p) { var t = C.tagOf(p.tag); return '<figure><img alt="" src="' + esc(Media.url(p.id)) + '"><figcaption><b>' + t.en + ' / <span class="ar">' + t.ar + '</span></b>' + (p.note ? ' - <span class="ar">' + esc(p.note) + '</span>' : '') + '</figcaption></figure>'; }).join('') + '</div>' : '';
    return '<div class="pa">' + head + title + grid + checks + notes + table + bottom + terms + sign + foot + photos + '</div>';
  }

  /* ------------------------------------------------ receipt roll (80 mm / 58 mm) */
  function rw() {
    return { tel: L('هاتف', 'Tel'), tr: L('رقم التحويل', 'Transfer no'), cr: L('س.ت', 'C.R.'), vatin: L('الرقم الضريبي', 'VATIN'), no: L('رقم الفاتورة', 'Bill no'), date: L('التاريخ', 'Date'),
      customer: L('العميل', 'Customer'), phone: L('الهاتف', 'Phone'), car: L('السيارة', 'Car'), plate: L('اللوحة', 'Plate'), km: L('العداد', 'Mileage'), seller: L('أعدّها', 'Prepared by'),
      sub: L('المجموع', 'Sub-total'), disc: L('الخصم', 'Discount'), vat: L('الضريبة', 'VAT'), total: L('الإجمالي (ر.ع)', 'TOTAL (OMR)'), paid: L('المدفوع', 'Paid'), bal: L('المتبقي', 'Balance due'),
      voided: L('ملغاة', 'VOID'), note: L('ملاحظة', 'Note'), title: L('فاتورة', 'Invoice'), taxTitle: L('فاتورة ضريبية', 'Tax invoice'), war: L('الضمان', 'Warranty') };
  }
  function receipt(inv, narrow) {
    var s = S.settings, tax = inv.vatPct > 0, paid = Calc.paid(inv), bal = Calc.balance(inv), ar = C.lang === 'ar', w = rw(), car = inv.car || {};
    var kv = function (k, v) { return v ? '<div class="kv"><span>' + k + '</span><b>' + esc(v) + '</b></div>' : ''; };
    return '<div class="rc' + (narrow ? ' n58' : '') + '" dir="' + (ar ? 'rtl' : 'ltr') + '"><img alt="" src="' + esc(Media.logo()) + '">' +
      '<h1>' + esc(ar ? s.nameAr || s.name : s.name || s.nameAr) + '</h1><div class="c">' + esc(ar ? s.name : s.nameAr) + '</div><div class="c">' + esc(ar ? s.addrAr : s.addr) + '</div>' +
      (s.phone ? '<div class="c">' + w.tel + ': <span dir="ltr">' + esc(s.phone) + '</span></div>' : '') + (s.transferNo ? '<div class="c">' + w.tr + ': <span dir="ltr">' + esc(s.transferNo) + '</span></div>' : '') + (s.cr ? '<div class="c">' + w.cr + ': <span dir="ltr">' + esc(s.cr) + '</span></div>' : '') +
      (tax && s.vatNo ? '<div class="c">' + w.vatin + ': <span dir="ltr">' + esc(s.vatNo) + '</span></div>' : '') +
      '<hr><div class="tt">' + (tax ? w.taxTitle : w.title) + '</div>' + (inv.void ? '<div class="void">' + w.voided + '</div>' : '') +
      kv(w.no, inv.number) + kv(w.date, C.fdate(inv.date) + ' ' + (inv.time || '')) + kv(w.customer, inv.customerName) + kv(w.phone, inv.customerPhone) +
      kv(w.car, [car.make, car.model, car.year].filter(Boolean).join(' ')) + kv(w.plate, car.plate) + kv(w.km, car.km) + kv(w.seller, inv.createdBy) + '<hr>' +
      inv.items.map(function (it) {
        return '<div class="it"><b>' + esc(C.lineName(it)) + '</b><div class="kv"><span><span dir="ltr">' + C.qf(it.q) + '</span> ' + esc(C.lineUnit(it)) + ' × <span dir="ltr">' + f3(it.price) + '</span></span><b>' + f3(Calc.line(it)) + '</b></div></div>';
      }).join('') + '<hr>' +
      kv(w.sub, f3(inv.sub)) + (inv.discount > 0 ? kv(w.disc, '-' + f3(inv.discount)) : '') + (tax ? kv(w.vat + ' ' + inv.vatPct + '%', f3(inv.vat)) : '') +
      '<div class="kv big"><span>' + w.total + '</span><b>' + f3(inv.total) + '</b></div>' + kv(w.paid, f3(paid)) + (bal > 0.0004 ? kv(w.bal, f3(bal)) : '') +
      (inv.warranty && inv.warranty.text ? '<hr>' + kv(w.war, inv.warranty.text) : '') +
      (inv.note ? '<hr><div>' + esc(inv.note) + '</div>' : '') +
      '<hr><div class="c">' + esc(ar ? s.footerAr || s.footer : s.footer || s.footerAr) + '</div></div>';
  }

  function html(inv, sz, withPhotos) { return sz === 'a4' ? a4(inv, false, withPhotos) : sz === 'job' ? a4(inv, true, withPhotos) : receipt(inv, sz === '58'); }

  /* put ready-made HTML on paper (also used by reports, statements and insurance reports) */
  function paper(inner, sz) {
    var area = document.getElementById('print-area');
    if (!area) { area = document.createElement('div'); area.id = 'print-area'; document.body.appendChild(area); }
    var page = sz === '80' ? '@page{size:80mm auto;margin:3mm}' : sz === '58' ? '@page{size:58mm auto;margin:2mm}' : '@page{size:A4;margin:9mm}';
    area.innerHTML = '<style>' + page + CSS + '</style>' + inner;
    var imgs = [].slice.call(area.querySelectorAll('img')), left = imgs.filter(function (i) { return !i.complete; }).length, fired = false;
    var go = function () { if (fired) return; fired = true; setTimeout(function () { window.print(); }, 150); };
    if (!left) return go();
    imgs.forEach(function (i) { if (!i.complete) i.onload = i.onerror = function () { if (--left <= 0) go(); }; });
    setTimeout(go, 4000);                                    // never wait for a slow photo for ever
  }
  function run(inv, sz, withPhotos) { sz = sz || size(); paper(html(inv, sz, withPhotos), sz === 'job' ? 'a4' : sz); }

  window.Print = { size: size, sizeOptions: sizeOptions, SIZES: SIZES, PAYM: PAYM, GRP: GRP, docType: docType, payWay: payWay, groups: groups, termsList: termsList, roBz: roBz,
    html: html, run: run, paper: paper, words: rw, CSS: CSS };
})();
