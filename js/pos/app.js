/* app.js - starts the point of sale: checks the sign-in, loads the data, builds the menu from what this user may do,
   and shows the reminders that are due as soon as the system opens. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, S = Store.s, ROOT = window.ROOT || '';

  function nav() {
    var n = [];
    if (Store.can('sell') || Store.isViewer()) n.push({ id: 'sell', icon: 'plus', label: L('إضافة فاتورة', 'Add bill'), short: L('إضافة فاتورة', 'Add bill'), tab: true });
    n.push({ id: 'jobs', icon: 'car', label: L('السيارات والفواتير', 'Cars & bills'), short: L('السيارات', 'Cars'), tab: true,
      count: function () { return S.invoices.filter(function (i) { return !i.void && i.status === 'ready'; }).length; } });
    n.push({ id: 'customers', icon: 'users', label: L('العملاء والسيارات', 'Customers & cars'), short: L('العملاء', 'Customers') });
    if (Store.sees('insurance')) n.push({ id: 'insurance', icon: 'shield', label: L('تقارير التأمين', 'Insurance reports'), short: L('التأمين', 'Insurance'), tab: true });
    n.push({ id: 'store', icon: 'box', label: L('المخزن والمشتريات', 'Store & purchases'), short: L('المخزن', 'Store') });
    n.push({ id: 'services', icon: 'wrench', label: L('الخدمات والأسعار', 'Services & prices'), short: L('الخدمات', 'Services') });
    if (Store.sees('expenses')) n.push({ id: 'expenses', icon: 'wallet', label: L('المصروفات', 'Expenses') });
    n.push({ id: 'alerts', icon: 'bell', label: L('التنبيهات والتذكيرات', 'Alerts & reminders'), short: L('التنبيهات', 'Alerts'), tab: true, count: function () { return window.Alerts ? Alerts.count() : 0; } });
    if (Store.sees('reports')) n.push({ id: 'reports', icon: 'chart', label: L('التقارير', 'Reports') });
    n.push('-');
    n.push({ id: 'settings', icon: 'gear', label: L('الإعدادات', 'Settings') });
    return n;
  }

  Store.boot('pos').then(function (state) {
    if (state !== 'ready') { location.replace(ROOT + 'login/index.html?next=pos'); return; }
    document.title = L(S.settings.nameAr || BRAND.nameAr, S.settings.name || BRAND.name) + ' - ' + L('نظام الورشة', 'Garage system');
    Shell.mount({ app: 'pos', nav: nav, home: function () { return Store.can('sell') || Store.isViewer() ? 'sell' : 'jobs'; },
      onPoll: function () { Alerts.popup(); if (Shell.current === 'alerts') Alerts.refresh(); } });
    setTimeout(Alerts.popup, 600);
    // a brand-new system: the usual services (names only, no prices) are put in once, the garage's own choices first
    if (S.firstRun && Store.isAdmin() && !S.products.some(function (p) { return p.kind === 'service'; })) StorePage.seedServices().then(function () { if (Shell.current === 'sell' || Shell.current === 'services') Shell.refresh(); }, function () {});
  }, function (e) {
    document.getElementById('app').innerHTML = '<div style="max-width:520px;margin:12vh auto;padding:24px" class="card"><h2 class="mb">' + L('تعذّر تشغيل النظام', 'The system could not start') + '</h2><div class="note bad mb">' + C.esc(C.errText(e)) + '</div>' +
      '<p class="muted small mb">' + L('لم يُحفظ ولم يُفقد أي شيء. تحقق من الإنترنت ثم أعد المحاولة.', 'Nothing was saved and nothing was lost. Check the internet and try again.') + '</p><button class="btn primary" onclick="location.reload()">' + L('إعادة المحاولة', 'Try again') + '</button></div>';
  });
})();
