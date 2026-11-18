/* demo-mode.js - DEMO ONLY: what makes this copy a demo on the screen.
   - a bar under the top bar: "demo", how many of the 5 trial bills are left, Reset demo, the link to Oman Falak
   - when the 5 bills are used up: a clear window instead of a short error
   - Settings -> Subscription & data: explains where the demo keeps its data
   - the sign-in screen: the demo's accounts, one press each (handled in login.js) */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon;
  var SITE = 'https://omanflak.com';

  function info() { return Store.s.demo || (window.LocalBackend ? LocalBackend.info() : { limit: 5, made: 0, left: 5 }); }

  function barHtml() {
    var d = info();
    return '<span class="demo-tag">' + L('نسخة تجريبية', 'DEMO') + '</span>' +
      '<span class="grow">' + L('بيانات مثال تُحفظ في هذا الجهاز فقط. ', 'Example data, saved on this device only. ') +
      '<b class="demo-left' + (d.left ? '' : ' none') + '">' + (d.left ? L('متبقي ', '') + d.left + L(' من ', ' of ') + d.limit + L(' فواتير تجريبية', ' trial bills left') : L('انتهت الفواتير التجريبية', 'Trial bills used up')) + '</b></span>' +
      '<button type="button" class="btn ghost sm" id="demo-reset">' + icon('refresh', 16) + L('إعادة ضبط التجربة', 'Reset demo') + '</button>' +
      '<a class="btn soft sm" href="' + SITE + '" target="_blank" rel="noopener">' + L('اطلب النظام', 'Get the system') + '</a>';
  }
  function drawBar() {
    var bar = document.getElementById('demo-bar');
    if (!bar) {
      var top = document.querySelector('.main > .top');
      if (!top) return;
      bar = document.createElement('div');
      bar.id = 'demo-bar'; bar.className = 'demo-bar';
      top.insertAdjacentElement('afterend', bar);
      bar.addEventListener('click', function (e) { if (e.target.closest('#demo-reset')) reset(); });
    }
    bar.innerHTML = barHtml();
  }
  function reset() {
    C.confirmBox(L('إعادة ضبط التجربة؟ تُحذف تجاربك وتعود بيانات المثال كما كانت. الفواتير التي أنشأتها تبقى محسوبة من الـ ', 'Reset the demo? Your tries are removed and the example data comes back. The bills you made still count towards the ') + info().limit + L(' فواتير المسموحة.', ' allowed bills.'), L('إعادة الضبط', 'Reset')).then(function (y) {
      if (!y) return;
      LocalBackend.reset().then(function () { location.href = (window.ROOT || '') + 'login/index.html'; });
    });
  }
  function limitWindow() {
    var d = info();
    C.modal({ title: icon('lock') + L('انتهت الفواتير التجريبية', 'Trial bills used up'), size: 'sm',
      body: '<p class="mb">' + L('هذه النسخة التجريبية تسمح بـ ', 'This demo allows ') + d.limit + L(' فواتير جديدة، وقد استُخدمت كلها.', ' new bills, and they are all used.') + '</p>' +
        '<p class="muted small mb">' + L('يمكنك متابعة تجربة كل الشاشات الأخرى: السيارات، العملاء، التأمين، المخزن، المصروفات، التقارير، الطباعة وواتساب للفواتير الموجودة.', 'You can keep trying every other screen: cars, customers, insurance, store, expenses, reports, printing and WhatsApp for the bills already there.') + '</p>' +
        '<div class="note ok">' + icon('star', 18) + '<span>' + L('النظام الكامل بدون حدود، على موقعك الخاص، بشعارك وبياناتك، مع نسخة احتياطية يومية.', 'The full system has no limits: on your own website, with your logo and details, and a daily backup.') + '</span></div>',
      foot: '<a class="btn primary" href="' + SITE + '" target="_blank" rel="noopener">' + L('تواصل مع عُمان فلك', 'Contact Oman Falak') + '</a>' });
  }

  Store.hooks.error = function (e) { if (e.code === 'demo_limit') { setTimeout(limitWindow, 50); drawBar(); } };
  var create = Store.createInvoice;
  Store.createInvoice = function (inv) {
    return create(inv).then(function (d) {
      drawBar();
      var left = info().left;
      if (left > 0 && left <= 2) C.toast(L('متبقي ', '') + left + L(' فواتير في النسخة التجريبية', ' bills left in the demo'), 'warn', 4000);
      return d;
    });
  };

  /* the frame is built by app.js: add the bar right after it */
  if (window.Shell) {
    var mount = Shell.mount;
    Shell.mount = function (cfg) { var r = mount.apply(this, arguments); drawBar(); return r; };
  }

  /* Settings -> Subscription & data: the demo has no server; say where its data is instead */
  var hook = setInterval(function () {
    var h = document.getElementById('d-health');
    if (h && !h.getAttribute('data-demo')) {
      h.setAttribute('data-demo', '1');
      h.innerHTML = '<h3>' + icon('lock') + L('أين تُحفظ بيانات التجربة؟', 'Where is the demo data kept?') + '</h3>' +
        '<div class="note warn mb">' + icon('alert', 18) + '<span>' + L('في النسخة التجريبية تُحفظ البيانات في متصفح هذا الجهاز فقط، ولا تُرسل إلى أي مكان.', 'In the demo the data is kept in this device\'s browser only and is not sent anywhere.') + '</span></div>' +
        '<p class="small muted">' + L('في النظام الحقيقي تُحفظ كل البيانات والصور على سيرفر موقعك في مجلد آمن، مع نسخة احتياطية يومية لآخر 30 يوماً، ويعمل من أي جوال أو كمبيوتر بكلمة المرور.', 'In the real system all data and photos are kept on your website\'s server in a safe folder, with a daily backup for 30 days, and it works from any phone or computer with the password.') + '</p>';
    }
  }, 400);

  window.DemoMode = { draw: drawBar, limitWindow: limitWindow, reset: reset };
})();
