/* shell.js - the frame of the point of sale: side menu, top bar, phone tab bar, page switching, language button,
   sign-out, the view-only banner and the one-minute check (photo storage, new alerts). */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon, S = Store.s, ROOT = window.ROOT || '';
  var cfg = null, pages = {}, current = '', pollTimer = null;

  function page(name, def) { pages[name] = def; }

  function brand() {
    return '<div class="brand"><div class="brand-mark"><img alt="" src="' + esc(Media.logo()) + '"></div>' +
      '<div><b>' + esc(L(S.settings.nameAr || BRAND.nameAr, S.settings.name || BRAND.name)) + '</b><small>' + L('نظام إدارة الورشة', 'Garage system') + '</small></div></div>';
  }
  function navHtml() {
    return cfg.nav().map(function (n) {
      if (n === '-') return '<div class="nav-sep"></div>';
      var cnt = n.count ? n.count() : 0;
      return '<button type="button" class="nav-item' + (n.id === current ? ' on' : '') + '" data-go="' + n.id + '">' + icon(n.icon) + '<span>' + esc(n.label) + '</span>' +
        (cnt ? '<span class="count">' + cnt + '</span>' : '') + '</button>';
    }).join('');
  }
  /* the phone's bottom bar: the pages marked "tab" (at most 4) + More */
  function tabbarHtml() {
    var all = cfg.nav().filter(function (n) { return n !== '-'; }), items = all.filter(function (n) { return n.tab; });
    if (items.length < 4) items = items.concat(all.filter(function (n) { return !n.tab; })).slice(0, 4); else items = items.slice(0, 4);
    return items.map(function (n) {
      var cnt = n.count ? n.count() : 0;
      return '<button type="button" class="' + (n.id === current ? 'on' : '') + '" data-go="' + n.id + '">' + icon(n.icon, 22) + '<span>' + esc(n.short || n.label) + '</span>' + (cnt ? '<span class="count">' + cnt + '</span>' : '') + '</button>';
    }).join('') + '<button type="button" data-menu>' + icon('menu', 22) + '<span>' + L('المزيد', 'More') + '</span></button>';
  }
  function roleName() {
    var r = S.user.role;
    return r === 'admin' ? L('مدير (صلاحية كاملة)', 'Admin (full control)') : r === 'viewer' ? L('دعم - عرض فقط', 'Support - view only') : L('موظف', 'Worker');
  }

  function mount(config) {
    cfg = config;
    var root = document.getElementById('app');
    root.className = 'shell';
    root.innerHTML =
      '<aside class="side" id="side">' + brand() + '<nav class="nav" id="nav"></nav>' +
      '<div class="side-foot">' +
      '<div class="me">' + icon('users') + '<div class="grow"><b>' + esc(S.user.name) + '</b>' + esc(roleName()) + '</div>' +
      '<button type="button" class="icon-btn" id="logout" title="' + L('تسجيل الخروج', 'Sign out') + '">' + icon('logout') + '</button></div></div></aside>' +
      '<div class="main">' +
      (Store.isViewer() ? '<div class="banner view">' + icon('eye', 18) + L('حساب للعرض فقط: ترى كل شيء ولا يمكنك تغيير أي شيء.', 'View-only account: you can see everything and change nothing.') + '</div>' : '') +
      '<header class="top"><button type="button" class="icon-btn only-m" data-menu aria-label="menu">' + icon('menu') + '</button>' +
      '<img class="top-logo only-m" alt="" src="' + esc(Media.logo()) + '"><h1 id="title"></h1>' +
      '<span id="top-extra" class="row"></span>' +
      '<button type="button" class="icon-btn bell" id="bell" title="' + L('التنبيهات', 'Alerts') + '">' + icon('bell') + '<span class="dot hide" id="bell-dot"></span></button>' +
      '<button type="button" class="lang" id="lang">' + L('EN', 'ع') + '</button></header>' +
      '<div class="view" id="view"></div></div>' +
      '<nav class="tabbar" id="tabbar"></nav>';

    root.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (g) { go(g.getAttribute('data-go')); closeSide(); return; }
      if (e.target.closest('[data-menu]')) openSide();
    });
    document.getElementById('lang').onclick = function () { C.setLang(C.lang === 'ar' ? 'en' : 'ar'); };
    document.getElementById('bell').onclick = function () { go('alerts'); };
    document.getElementById('logout').onclick = function () {
      Store.logout().then(function () { location.href = ROOT + 'login/index.html'; }, function () { location.href = ROOT + 'login/index.html'; });
    };
    var measure = function () { var h = 0; [].forEach.call(root.querySelectorAll('.banner'), function (b) { h += b.offsetHeight; }); document.documentElement.style.setProperty('--ban', h + 'px'); };
    // measured again once the page has finished loading (fonts, styles), and whenever the strip changes size
    measure(); window.addEventListener('resize', measure); window.addEventListener('load', measure); requestAnimationFrame(measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    if (window.ResizeObserver) [].forEach.call(root.querySelectorAll('.banner'), function (b) { new ResizeObserver(measure).observe(b); });
    Store.hooks.authLost = function () { location.href = ROOT + 'login/index.html'; };
    window.addEventListener('hashchange', function () { var h = location.hash.slice(1).split('/')[0]; if (h && h !== current && pages[h]) go(h); });
    var first = location.hash.slice(1).split('/')[0];
    go(pages[first] && allowed(first) ? first : cfg.home());
    bell();
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden) Store.poll().then(function () { bell(); refreshNav(); if (cfg.onPoll) cfg.onPoll(); }, function () {}); }, 60000);
  }
  function allowed(id) { return cfg.nav().some(function (n) { return n !== '-' && n.id === id; }); }
  function openSide() {
    var s = document.getElementById('side');
    s.classList.add('open');
    var sh = document.createElement('div'); sh.className = 'side-shade'; sh.id = 'side-shade'; sh.onclick = closeSide;
    document.body.appendChild(sh);
  }
  function closeSide() {
    document.getElementById('side').classList.remove('open');
    var sh = document.getElementById('side-shade'); if (sh) sh.remove();
  }
  function bell() {
    var d = document.getElementById('bell-dot');
    if (!d) return;
    var n = window.Alerts ? Alerts.count() : 0;
    d.textContent = n > 99 ? '99+' : String(n);
    d.classList.toggle('hide', !n);
  }
  function refreshNav() {
    document.getElementById('nav').innerHTML = navHtml();
    document.getElementById('tabbar').innerHTML = tabbarHtml();
    bell();
  }
  function go(name, arg) {
    if (!pages[name] || !allowed(name)) name = cfg.home();
    if (current && pages[current] && pages[current].leave) pages[current].leave();
    current = name;
    if (location.hash.slice(1).split('/')[0] !== name) history.replaceState(null, '', '#' + name);
    document.getElementById('title').textContent = pages[name].title();
    document.getElementById('top-extra').innerHTML = '';
    refreshNav();
    var v = document.getElementById('view');
    v.innerHTML = '';
    window.scrollTo(0, 0);
    try { pages[name].render(v, arg); }
    catch (e) { console.error(e); v.innerHTML = '<div class="note bad">' + esc(L('تعذّر عرض هذه الصفحة.', 'This page could not be shown.')) + ' ' + esc(e.message) + '</div>'; }
  }
  /* draw the current page again (after a save) */
  function refresh(arg) { if (current) go(current, arg); }

  /* On a phone every table is shown as a stack of cards (css/app.css): each cell then needs the name of its column.
     This copies the column titles onto the cells of every table the pages draw, whenever something is drawn. */
  function labelTables() {
    [].forEach.call(document.querySelectorAll('table.tbl'), function (t) {
      var heads = [].map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
      if (!heads.length) return;
      [].forEach.call(t.querySelectorAll('tbody tr'), function (tr) {
        if (tr._lab) return;
        tr._lab = 1;
        [].forEach.call(tr.children, function (td, i) { if (heads[i]) td.setAttribute('data-l', heads[i]); });
      });
    });
  }
  var labelPending = 0;
  if (window.MutationObserver) new MutationObserver(function () {
    if (labelPending) return;
    labelPending = requestAnimationFrame(function () { labelPending = 0; labelTables(); });
  }).observe(document.body, { childList: true, subtree: true });

  /* "take photo / choose photos": camera = open the phone camera; multi = choose many photos at once from the gallery */
  function pickPhotos(camera, multi) {
    return new Promise(function (res) {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      if (camera) inp.setAttribute('capture', 'environment');
      if (multi) inp.multiple = true;
      inp.style.display = 'none';
      inp.onchange = function () { var f = inp.files ? [].slice.call(inp.files) : []; inp.remove(); res(f); };
      document.body.appendChild(inp);
      inp.click();
    });
  }
  function pickPhoto(camera) { return pickPhotos(camera, false).then(function (f) { return f[0] || null; }); }
  /* Excel export helper: rows = [[...]], first row is the header */
  function excel(file, sheetName, rows, widths) {
    var H = XLSX.S.HEAD;
    var out = rows.map(function (r, i) { return i === 0 ? r.map(function (c) { return { v: c, s: H }; }) : r; });
    XLSX.save(file + '_' + C.today() + '.xlsx', [{ name: sheetName, rows: out, cols: widths, rtl: C.lang === 'ar', headerRows: 1 }]);
  }

  window.Shell = { page: page, mount: mount, go: go, refresh: refresh, refreshNav: refreshNav, bell: bell, pickPhoto: pickPhoto, pickPhotos: pickPhotos, excel: excel,
    get current() { return current; }, setExtra: function (html) { document.getElementById('top-extra').innerHTML = html; } };
})();
