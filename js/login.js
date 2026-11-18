/* login.js - the sign-in page (yourdomain/login): sign in with the password alone, and the first-run screen that creates
   the owner account (+ an optional view-only support account). */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, ROOT = window.ROOT || '';
  var root = document.getElementById('auth');

  function art() {
    return '<div class="auth-art">' +
      '<div class="auth-logo"><img alt="" src="' + esc(Media.logo()) + '"></div>' +
      '<h1>' + esc(L(S.settings.nameAr || BRAND.nameAr, S.settings.name || BRAND.name)) + '</h1>' +
      (window.GARAGE_DEMO ? '<p><b>' + L('نسخة تجريبية', 'Demo version') + '</b></p>' : '') +
      '<p>' + L('نظام إدارة الورشة: أوامر العمل والفواتير، صور السيارات، التأمين، المخزن، المصروفات والتقارير.', 'Garage system: job cards and bills, car photos, insurance, store, expenses and reports.') + '</p>' +
      '<ul><li>' + icon('car') + L('كل سيارة من الاستلام إلى التسليم', 'Every car from drop-off to delivery') + '</li>' +
      '<li>' + icon('camera') + L('صوّر الضرر قبل وبعد الإصلاح', 'Photograph the damage before and after') + '</li>' +
      '<li>' + icon('shield') + L('تقارير شركات التأمين جاهزة', 'Insurance reports ready to send') + '</li>' +
      '<li>' + icon('whatsapp') + L('الفاتورة على واتساب بضغطة', 'The bill on WhatsApp in one press') + '</li></ul></div>';
  }
  function shell(inner) {
    root.innerHTML = art() + '<div class="auth-form"><div class="auth-box">' + inner +
      '<div class="row between mt"><span class="small muted">' + esc(S.settings.phone ? L('للتواصل: ', 'Contact: ') + S.settings.phone : '') + '</span>' +
      '<button type="button" class="link small" id="lang">' + L('English', 'العربية') + '</button></div></div></div>';
    document.getElementById('lang').onclick = function () { C.setLang(C.lang === 'ar' ? 'en' : 'ar'); };
  }
  function showLogin() {
    shell('<h2>' + L('تسجيل الدخول', 'Sign in') + '</h2><p class="muted">' + L('اكتب كلمة المرور الخاصة بك فقط. لكل شخص كلمة مرور تفتح حسابه.', 'Type your own password only. Each person has a password that opens their account.') + '</p>' +
      '<form id="f" class="col" autocomplete="on">' +
      '<div class="field"><label for="p">' + L('كلمة المرور', 'Password') + '</label><div class="row"><input class="input ltr grow" id="p" name="password" type="password" autocomplete="current-password" style="font-size:20px;letter-spacing:2px;min-height:52px" required><button type="button" class="icon-btn" id="peek" title="' + L('إظهار', 'Show') + '" style="width:48px;height:52px">' + icon('eye') + '</button></div></div>' +
      '<button class="btn primary lg block" id="go">' + icon('lock') + L('دخول', 'Sign in') + '</button></form>');
    var f = document.getElementById('f');
    document.getElementById('peek').onclick = function () { f.p.type = f.p.type === 'password' ? 'text' : 'password'; };
    f.onsubmit = function (e) { e.preventDefault(); C.busy(document.getElementById('go'), Store.login(f.p.value)).then(go, function () {}); };
    /* the demo: its accounts, each opens with one press (the real system has no such list) */
    var D = window.GARAGE_DEMO;
    if (D && D.accounts) {
      f.insertAdjacentHTML('afterend', '<div class="note ok mt">' + icon('star', 18) + '<span>' + L('نسخة تجريبية: اختر حساباً للدخول بضغطة. كل حساب يرى ما تسمح له به صلاحياته فقط.', 'Demo: pick an account to sign in with one press. Each account sees only what its permissions allow.') + '</span></div>' +
        '<div class="demo-accs">' + D.accounts.map(function (a, i) {
          return '<button type="button" class="demo-acc" data-acc="' + i + '">' + icon(a.icon, 24) + '<span class="grow"><b>' + esc(L(a.ar, a.en)) + ' · ' + esc(L(a.roleAr, a.roleEn)) + '</b><small>' + esc(L(a.canAr, a.canEn)) + '</small><small>' + L('كلمة المرور: ', 'Password: ') + '<code>' + esc(a.pw) + '</code></small></span></button>';
        }).join('') + '</div>');
      root.querySelector('.demo-accs').onclick = function (e) {
        var b = e.target.closest('[data-acc]'); if (!b) return;
        C.busy(b, Store.login(D.accounts[+b.getAttribute('data-acc')].pw)).then(go, function () {});
      };
      return;
    }
    f.p.focus();
  }
  function showSetup() {
    shell('<h2>' + L('إعداد النظام لأول مرة', 'First-time setup') + '</h2>' +
      '<p class="muted small">' + L('هذه الشاشة تظهر مرة واحدة فقط. أنشئ حساب صاحب الورشة، ويمكن إضافة حساب دعم للعرض فقط. الدخول بعد ذلك يكون بكلمة المرور وحدها، فيجب أن تختلف كلمة مرور كل حساب.', 'This screen appears only once. Create the garage owner\'s account; a view-only support account is optional. Sign-in is then by password alone, so each account needs a different password.') + '</p>' +
      '<form id="f" class="col" autocomplete="off">' +
      '<div class="section-block"><h4>' + icon('users', 18) + L('حساب صاحب الورشة (تحكم كامل)', 'Owner account (full control)') + '</h4><div class="col">' +
      '<div class="field"><label>' + L('الاسم', 'Name') + '</label><input class="input" name="name" required></div>' +
      '<div class="field"><label>' + L('كلمة المرور (8 خانات أو أكثر)', 'Password (8+ characters)') + '</label><input class="input ltr" name="password" type="password" autocomplete="new-password" required minlength="8"></div></div></div>' +
      '<div class="section-block"><h4>' + icon('eye', 18) + L('حساب الدعم - للعرض فقط (اختياري)', 'Support account - view only (optional)') + '</h4><div class="col">' +
      '<div class="field"><label>' + L('كلمة مرور حساب الدعم (مختلفة)', 'Support password (different)') + '</label><input class="input ltr" name="vpass" type="password" autocomplete="new-password" minlength="8"></div></div></div>' +
      '<button class="btn primary lg block" id="go">' + L('إنشاء الحسابات والدخول', 'Create accounts and sign in') + '</button></form>');
    var f = document.getElementById('f');
    f.onsubmit = function (e) {
      e.preventDefault();
      var body = { name: f.name.value.trim(), password: f.password.value };
      if (f.vpass.value) body.viewer = { password: f.vpass.value };
      C.busy(document.getElementById('go'), Store.setup(body)).then(go, function () {});
    };
  }
  function go() { location.href = ROOT + 'pos/index.html'; }

  /* the garage's logo and name for this screen (public details only; the screen works without them) */
  function brand() { return Store.call('brand').then(function (d) { if (d && d.brand) ['logo', 'name', 'nameAr'].forEach(function (k) { if (d.brand[k]) S.settings[k] = d.brand[k]; }); }, function () {}); }
  Store.boot('none').then(function (state) { return brand().then(function () { return state; }); }).then(function (state) {
    if (state === 'setup') return showSetup();
    if (state === 'login') return showLogin();
    go();
  }, function (e) {
    shell('<h2>' + L('تعذّر تشغيل النظام', 'The system could not start') + '</h2><div class="note bad">' + esc(C.errText(e)) + '</div>' +
      '<p class="muted small">' + L('تأكد أن الاستضافة تعمل بـ PHP 8.1 أو أحدث مع pdo_sqlite. لم يُحفظ ولم يُفقد أي شيء.', 'Check that the hosting runs PHP 8.1+ with pdo_sqlite. Nothing was saved and nothing was lost.') + '</p>' +
      '<button class="btn primary" onclick="location.reload()">' + L('إعادة المحاولة', 'Try again') + '</button>');
  });
})();
