/* whatsapp.js - send a bill (or an insurance report) to the customer on WhatsApp, in ONE go.
   The window shows the suggested message (it can be edited), a Copy button, and:
     "Send PDF + message" (the main button) - one press does everything:
        computer -> the PDF is saved to Downloads, the message is copied, and the customer's chat opens in the chosen
                    WhatsApp (app or WhatsApp Web) with the message ALREADY TYPED. Drag the file into the chat and press
                    Send: the file and the message go together. Nothing to go back for.
        phone    -> the message is copied and the share menu opens with the real PDF (the message travels with it as the
                    caption where the phone allows; otherwise press and hold in the caption box -> Paste).
     "Text only" - the chat opens with the message typed: press Send.
   On a computer, the choice between the installed WhatsApp app (whatsapp://send) and WhatsApp Web is remembered by that
   computer (Settings holds the default). A phone always uses its own WhatsApp app (https://wa.me/...).
   The customer's number is optional: without it WhatsApp opens and the customer is chosen (or his number typed) there.
   WhatsApp gives a web page no way to drop a FILE into a chat by itself (only its paid Business API can), which is why
   the file is dragged in on a computer and chosen from the share menu on a phone. Nothing is sent by the server.
   Also here: the camera barcode scanner. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, f3 = C.f3, Calc = C.Calc, S = Store.s;
  var CH_KEY = BRAND.key + '_wa_channel';

  function message(inv) {
    var s = S.settings, ar = C.lang === 'ar', paid = Calc.paid(inv), bal = Calc.balance(inv), car = inv.car || {}, lines = [];
    lines.push('*' + (ar ? s.nameAr || s.name : s.name) + '*');
    lines.push((ar ? 'فاتورة / أمر عمل رقم: ' : 'Bill / job card no: ') + inv.number + (inv.void ? (ar ? ' (ملغاة)' : ' (VOID)') : ''));
    lines.push((ar ? 'التاريخ: ' : 'Date: ') + C.fdate(inv.date));
    if (inv.customerName) lines.push((ar ? 'العميل: ' : 'Customer: ') + inv.customerName);
    var carT = [car.make, car.model, car.year].filter(Boolean).join(' ');
    if (carT || car.plate) lines.push((ar ? 'السيارة: ' : 'Car: ') + carT + (car.plate ? (ar ? ' - لوحة ' : ' - plate ') + '‎' + car.plate + '‎' : ''));
    if (inv.status && inv.status !== 'delivered') lines.push((ar ? 'حالة السيارة: ' : 'Car status: ') + C.stageName(inv.status));
    if (inv.items.length) {
      lines.push('--------------------');
      inv.items.forEach(function (it, i) { lines.push((i + 1) + '. ' + C.lineName(it) + (num(it.q) !== 1 ? ' × ' + C.qf(it.q) : '') + ' = ' + f3(Calc.line(it))); });
      lines.push('--------------------');
      if (inv.discount > 0 || inv.vat > 0) lines.push((ar ? 'المجموع: ' : 'Sub-total: ') + f3(inv.sub));
      if (inv.discount > 0) lines.push((ar ? 'الخصم: ' : 'Discount: ') + '-' + f3(inv.discount));
      if (inv.vat > 0) lines.push((ar ? 'ضريبة القيمة المضافة ' : 'VAT ') + inv.vatPct + '%: ' + f3(inv.vat));
      lines.push('*' + (ar ? 'الإجمالي: ' : 'Total: ') + f3(inv.total) + (ar ? ' ر.ع' : ' OMR') + '*');
      if (paid > 0) lines.push((ar ? 'المدفوع: ' : 'Paid: ') + f3(paid));
      if (bal > 0.0004) lines.push('*' + (ar ? 'المتبقي: ' : 'Balance due: ') + f3(bal) + '*');
    }
    if (inv.warranty && inv.warranty.text) lines.push((ar ? 'الضمان: ' : 'Warranty: ') + inv.warranty.text);
    lines.push('');
    if (bal > 0.0004 && s.transferNo) lines.push((ar ? 'للدفع بالتحويل: ' : 'To pay by transfer: ') + s.transferNo);
    lines.push(ar ? (s.footerAr || 'شكراً لتعاملكم معنا') : (s.footer || 'Thank you'));
    if (s.phone) lines.push((ar ? 'للتواصل: ' : 'Contact: ') + s.phone);
    return lines.join('\n');
  }
  function num(v) { return C.num(v); }

  /* ------------------------------------------------ where WhatsApp opens */
  function isMobile() {
    var ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);     // (an iPad calls itself a Mac)
  }
  /* 'app' | 'web' : what this computer uses. Chosen in the window (or the default from Settings) and remembered. */
  function channel(v) {
    try {
      if (v !== undefined) { localStorage.setItem(CH_KEY, v === 'app' ? 'app' : 'web'); return v; }
      var s = localStorage.getItem(CH_KEY);
      if (s === 'app' || s === 'web') return s;
    } catch (e) { /* private mode */ }
    return S.settings.waChannel === 'app' ? 'app' : 'web';
  }
  function kindNow() { return isMobile() ? 'phone' : channel(); }
  function chatUrl(kind, phone, text) {
    var n = C.phoneIntl(phone), msg = text ? encodeURIComponent(text) : '';
    var q = [n ? 'phone=' + n : '', msg ? 'text=' + msg : ''].filter(Boolean).join('&');
    // without a number WhatsApp opens its own contact list
    if (kind === 'app') return 'whatsapp://send' + (q ? '?' + q : '');
    if (kind === 'web') return 'https://web.whatsapp.com/send' + (q ? '?' + q : '');
    return 'https://wa.me/' + (n ? n : '') + (msg ? '?text=' + msg : '');
  }
  /* go to the chat. Returns false when a pop-up blocker stopped WhatsApp Web (the caller then shows a link to press). */
  function openChat(kind, phone, text) {
    var url = chatUrl(kind, phone, text);
    if (kind === 'app') {                                   // hand the chat to the WhatsApp program: no new page is opened
      var a = document.createElement('a');
      a.href = url; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      return true;
    }
    // WhatsApp Web keeps to ONE browser tab (it complains when it is open in two), so the same tab is used again each time
    var w = window.open(url, kind === 'web' ? BRAND.key + '_whatsapp_web' : '_blank');
    return !!w;
  }
  function copy(txt) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return fallbackCopy(txt); });
    return Promise.resolve(fallbackCopy(txt));
  }
  function fallbackCopy(txt) {
    var t = document.createElement('textarea'); t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* not allowed */ }
    t.remove(); return ok;
  }
  function pdfSize(v) {
    try {
      if (v !== undefined) { localStorage.setItem(BRAND.key + '_wa_size', v); return v; }
      var s = localStorage.getItem(BRAND.key + '_wa_size');
      if (s === 'a4' || s === '80' || s === '58') return s;
    } catch (e) { /* private mode */ }
    var p = Print.size(); return p === 'job' ? 'a4' : p;
  }
  function channelName(k) { return k === 'app' ? L('تطبيق واتساب', 'WhatsApp app') : L('واتساب ويب', 'WhatsApp Web'); }

  /* The send window. o = { title, ref, phone, text, makePdf(opts) -> Promise<pdf>, sizes: bool, photos: n (offer to add them),
                           savePhone(ph) (optional: keep a typed number), pdfOnly: no message at all - only send / save the PDF } */
  function sendWindow(o) {
    var pdf = null, pdfErr = false, mob = isMobile(), size = pdfSize(), withPhotos = false, run = 0, only = !!o.pdfOnly;
    var m = C.modal({ title: icon('whatsapp') + ' ' + o.title + (o.ref ? ' <span class="ltr muted small">' + esc(o.ref) + '</span>' : ''), size: 'md',
      body: '<div class="col">' +
        (mob ? '' : '<div class="field"><label>' + L('الإرسال من هذا الكمبيوتر عن طريق', 'On this computer, send with') + '</label><div class="seg" id="w-ch" style="align-self:flex-start">' +
          ['app', 'web'].map(function (k) { return '<button type="button" data-ch="' + k + '" class="' + (channel() === k ? 'on' : '') + '">' + icon(k === 'app' ? 'whatsapp' : 'globe', 17) + channelName(k) + '</button>'; }).join('') + '</div><span class="hint" id="w-chhint"></span></div>') +
        '<div class="field"><label>' + L('رقم واتساب العميل', "Customer's WhatsApp number") + '</label><input class="input ltr" id="w-ph" inputmode="tel" value="' + esc(o.phone || '') + '" placeholder="9xxxxxxx"><span class="hint">' + L('اختياري: 8 أرقام (أو رقم دولي يبدأ بـ +) ليفتح على محادثته مباشرة. اتركه فارغاً فيفتح واتساب وتختار العميل هناك.', 'Optional: 8 digits (or an international number starting with +) to land on his chat. Leave it empty and WhatsApp opens for you to pick the customer.') + '</span></div>' +
        (only ? '' : '<div class="field"><div class="row between"><label for="w-msg">' + L('الرسالة المقترحة (يمكنك تعديلها)', 'Suggested message (you can edit it)') + '</label><button type="button" class="btn sm ghost" id="w-copy">' + icon('copy', 16) + L('نسخ', 'Copy') + '</button></div><textarea class="input" id="w-msg" rows="8" style="min-height:150px;font-size:14px">' + esc(o.text) + '</textarea></div>') +
        (o.sizes ? '<div class="field"><label>' + L('مقاس ملف PDF', 'PDF size') + '</label><div class="seg" id="w-size" style="align-self:flex-start;flex-wrap:wrap">' + ['a4', '80', '58'].map(function (k) { return '<button type="button" data-sz="' + k + '" class="' + (size === k ? 'on' : '') + '">' + esc(L(Print.SIZES[k][0], Print.SIZES[k][1])) + '</button>'; }).join('') + '</div></div>' : '') +
        (o.photos ? '<label class="check" id="w-phbox"><input type="checkbox" id="w-photos"><span><b>' + L('إرفاق صور السيارة داخل ملف PDF', 'Put the car photos inside the PDF') + ' (' + o.photos + ')</b><span>' + L('تُضاف الصور في صفحات بعد الفاتورة (قبل / بعد الإصلاح). الملف يصبح أكبر.', 'The photos are added on pages after the bill (before / after the repair). The file gets bigger.') + '</span></span></label>' : '') +
        '<button type="button" class="btn wa lg block busy" id="w-both" disabled>' + icon(only ? 'whatsapp' : 'send') + (only ? L('إرسال PDF عبر واتساب', 'Send the PDF on WhatsApp') : L('إرسال PDF + الرسالة', 'Send PDF + message')) + '</button>' +
        (only ? '<button type="button" class="btn ghost lg block" id="w-dl">' + icon('download') + L('حفظ PDF', 'Save the PDF') + '</button>'
          : '<div class="grid g2 keep"><button type="button" class="btn ghost" id="w-text">' + icon('msg') + L('الرسالة النصية فقط', 'Text message only') + '</button>' +
          '<button type="button" class="btn ghost" id="w-dl">' + icon('download') + L('تنزيل PDF فقط', 'Download PDF only') + '</button></div>') +
        '<div id="w-help" class="note ok hide"></div></div>' });
    var q = function (s) { return m.el.querySelector(s); };
    var both = q('#w-both'), help = q('#w-help');
    function prepare() {
      var my = ++run;
      pdf = null; pdfErr = false; both.disabled = true; both.classList.add('busy');
      o.makePdf({ size: size, photos: withPhotos }).then(function (r) { if (my === run) pdf = r; }, function () { if (my === run) pdfErr = true; })
        .then(function () { if (m.closed || my !== run) return; both.disabled = false; both.classList.remove('busy'); });
    }
    prepare();
    if (q('#w-size')) q('#w-size').onclick = function (e) {
      var b = e.target.closest('[data-sz]'); if (!b) return;
      size = pdfSize(b.getAttribute('data-sz'));
      [].forEach.call(q('#w-size').children, function (x) { x.classList.toggle('on', x === b); });
      if (q('#w-phbox')) q('#w-phbox').classList.toggle('hide', size !== 'a4');
      help.classList.add('hide'); prepare();
    };
    if (q('#w-phbox')) q('#w-phbox').classList.toggle('hide', o.sizes && size !== 'a4');
    if (q('#w-photos')) q('#w-photos').onchange = function () { withPhotos = this.checked; help.classList.add('hide'); prepare(); };
    function hint() {
      var h = q('#w-chhint'); if (!h) return;
      h.textContent = channel() === 'app' ? L('يفتح برنامج واتساب المثبّت على هذا الكمبيوتر على محادثة العميل. (يُحفظ اختيارك لهذا الجهاز)', "Opens the WhatsApp program installed on this computer on the customer's chat. (Remembered on this device)")
        : L('يفتح واتساب ويب في المتصفح على محادثة العميل. (يُحفظ اختيارك لهذا الجهاز)', "Opens WhatsApp Web in the browser on the customer's chat. (Remembered on this device)");
    }
    hint();
    if (q('#w-ch')) q('#w-ch').onclick = function (e) {
      var b = e.target.closest('[data-ch]'); if (!b) return;
      channel(b.getAttribute('data-ch'));
      [].forEach.call(q('#w-ch').children, function (x) { x.classList.toggle('on', x === b); });
      hint(); help.classList.add('hide');
    };
    function phone() {
      var ph = q('#w-ph').value.trim();
      if (ph !== '' && C.phoneIntl(ph).length < 8) { C.toast(L('الرقم غير صحيح. اتركه فارغاً لتختار العميل داخل واتساب، أو اكتب 8 أرقام.', 'The number is not valid. Leave it empty to pick the customer inside WhatsApp, or type 8 digits.'), 'warn', 6000); q('#w-ph').classList.add('err'); q('#w-ph').focus(); return null; }
      q('#w-ph').classList.remove('err');
      if (ph && ph !== (o.phone || '') && o.savePhone) o.savePhone(ph);
      return ph;
    }
    function say(html, kind) { help.className = 'note ' + (kind || 'ok'); help.innerHTML = html; }
    function blocked(kind, ph, text) {
      say(icon('alert', 18) + '<span>' + L('منع المتصفح فتح واتساب ويب. ', 'The browser blocked WhatsApp Web. ') + '<a class="link" target="' + BRAND.key + '_whatsapp_web" href="' + esc(chatUrl(kind, ph, text)) + '">' + L('اضغط هنا لفتح محادثة العميل', "Press here to open the customer's chat") + '</a></span>', 'warn');
    }
    function txt() { return only ? '' : q('#w-msg').value.trim(); }

    if (q('#w-copy')) q('#w-copy').onclick = function () { copy(q('#w-msg').value).then(function (ok) { C.toast(ok ? L('تم نسخ الرسالة', 'Message copied') : L('تعذّر النسخ، حدّد النص وانسخه', 'Could not copy; select the text and copy it'), ok ? 'ok' : 'warn'); }); };
    if (q('#w-text')) q('#w-text').onclick = function () {
      var ph = phone(); if (ph === null) return;
      if (!txt()) return C.toast(L('نص الرسالة فارغ', 'The message is empty'), 'warn');
      var kind = kindNow();
      if (!openChat(kind, ph, txt())) return blocked(kind, ph, txt());
      say(icon('check', 18) + '<span>' + (ph ? L('فُتحت محادثة العميل والرسالة مكتوبة. اضغط إرسال.', "The customer's chat is open with the message typed. Press Send.") : L('فُتح واتساب والرسالة جاهزة. اختر العميل ثم اضغط إرسال.', 'WhatsApp opened with the message ready. Pick the customer, then press Send.')) + '</span>');
    };
    q('#w-dl').onclick = function () { if (pdf) { Pdf.download(pdf); if (only) say(icon('check', 18) + '<span>' + L('تم حفظ الملف ', 'Saved ') + '<b class="ltr">' + esc(pdf.name) + '</b>' + L(' في «التنزيلات».', ' to Downloads.') + '</span>'); } else C.toast(L('لحظة، الملف قيد التجهيز', 'One moment, the file is being prepared'), 'warn'); };

    /* the one button: file + message together */
    both.onclick = function () {
      if (pdfErr || !pdf) return C.toast(L('تعذّر إنشاء ملف PDF على هذا الجهاز', 'The PDF could not be made on this device'), 'err');
      var ph = phone(); if (ph === null) return;
      var t = txt();
      if (mob && Pdf.canShare(pdf)) {
        // phone: copy the message first (same tap), then the share menu with the real file (+ the message as its caption)
        if (t) copy(t);
        Pdf.share(pdf, t).then(function (r) {
          if (r === 'shared') say(icon('check', 18) + '<span>' + L('اختر «واتساب» ثم العميل', 'Choose "WhatsApp", then the customer') + (ph ? ' (<b class="ltr">' + esc(ph) + '</b>)' : '') + (t ? L('. الرسالة تُرسل مع الملف، وإن لم تظهر فهي منسوخة: اضغط مطولاً في خانة التعليق ثم «لصق».', '. The message goes with the file; if it does not show, it is copied: press and hold in the caption box, then "Paste".') : L('، ثم اضغط إرسال.', ', then press Send.')) + '</span>');
          else if (r === 'unsupported') viaDownload(ph, t);
        });
        return;
      }
      viaDownload(ph, t);
    };
    /* computer: save the PDF, copy the message, open the chat with the message typed; the file is dropped into the chat */
    function viaDownload(ph, t) {
      var kind = kindNow();
      Pdf.download(pdf);
      if (t) copy(t);
      var steps = '<span><b>' + L('خطوة واحدة متبقية: ', 'One step left: ') + '</b>' + L('اسحب الملف ', 'drag the file ') + '<b class="ltr">' + esc(pdf.name) + '</b>' + L(' من «التنزيلات» إلى المحادثة', ' from Downloads into the chat') +
        (t ? L(' (أو 📎 ← «مستند»)، ثم اضغط إرسال. الرسالة مكتوبة في المحادثة ومنسوخة أيضاً، فتُرسل مع الملف.', ' (or 📎 → "Document"), then press Send. The message is already typed in the chat (and copied), so it goes with the file.') : L(' (أو 📎 ← «مستند»)، ثم اضغط إرسال.', ' (or 📎 → "Document"), then press Send.')) + '</span>';
      // the web tab must open while the click is fresh; the program is started a moment later so the download is not interrupted
      if (kind === 'app') { setTimeout(function () { openChat(kind, ph, t); }, 600); say(icon('file', 18) + steps); }
      else if (openChat(kind, ph, t)) say(icon('file', 18) + steps);
      else blocked(kind, ph, t);
    }
    return m;
  }

  function open(inv) {
    return sendWindow({ title: L('إرسال الفاتورة عبر واتساب', 'Send the bill on WhatsApp'), ref: inv.number, phone: inv.customerPhone, text: '', pdfOnly: true, sizes: true,       // bills go as the PDF only (the garage asked for no text message)
      photos: (inv.photos || []).length,
      makePdf: function (o) { return Pdf.make(inv, o.size, { photos: o.photos && o.size === 'a4' }); },
      savePhone: function (ph) { if (!inv.void && (Store.can('sell') || Store.can('edit_inv'))) Store.touchInvoice(inv.id, { phone: ph }).then(function (d) { inv = d; }, function () {}); } });
  }

  /* a short text (statement of account, reminder) to a number, in the WhatsApp this device uses */
  function text(phone, msg) {
    var kind = kindNow();
    if (!openChat(kind, phone, msg)) C.toast(L('منع المتصفح فتح واتساب. اسمح بالنوافذ المنبثقة لهذا الموقع.', 'The browser blocked WhatsApp. Allow pop-ups for this site.'), 'warn', 7000);
  }

  /* ------------------------------------------------ barcode scanning with the phone camera */
  var Scanner = {
    supported: function () { return 'BarcodeDetector' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
    open: function (cb) {
      var stream = null, stop = false, det;
      try { det = new window.BarcodeDetector(); } catch (e) { return C.toast(L('المسح بالكاميرا غير مدعوم على هذا الجهاز', 'Camera scanning is not supported on this device'), 'warn'); }
      var m = C.modal({ title: L('وجّه الكاميرا نحو الباركود', 'Point the camera at the barcode'), size: 'sm', body: '<video id="sc-v" playsinline muted style="width:100%;border-radius:12px;background:#000;aspect-ratio:4/3;object-fit:cover"></video>',
        onClose: function () { stop = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } });
      var v = m.el.querySelector('#sc-v');
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
        stream = s; if (stop) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        v.srcObject = s; v.play();
        (function tick() {
          if (stop) return;
          det.detect(v).then(function (codes) {
            if (codes && codes[0] && codes[0].rawValue) { var code = codes[0].rawValue; m.close(); cb(code); }
            else setTimeout(tick, 250);
          }, function () { setTimeout(tick, 400); });
        })();
      }, function () { m.close(); C.toast(L('لم يُسمح باستخدام الكاميرا', 'Camera access was not allowed'), 'err'); });
    }
  };

  window.WhatsApp = { open: open, message: message, text: text, sendWindow: sendWindow, copy: copy, isMobile: isMobile };
  window.Scanner = Scanner;
})();
