/* cardiagram.js - the car drawing (seen from above) on which the damaged parts are marked, like the drawing on the
   back of the garage's paper job card. Tap a part to mark it; marked parts are orange. The same drawing is printed on the
   A4 job card and drawn into the PDF and the insurance report. */
(function () {
  'use strict';
  var C = window.Core, L = C.L, esc = C.esc, icon = C.icon;
  var Y = 22;   // room above the car for the "front" label
  /* [zone id, x, y, w, h, rx] - the car points up (front at the top) */
  var PARTS = [
    ['fb', 44, 2, 152, 26, 12], ['hood', 50, 32, 140, 80, 10], ['ws', 56, 116, 128, 34, 8], ['roof', 56, 154, 128, 112, 8],
    ['rg', 56, 270, 128, 30, 8], ['trunk', 50, 304, 140, 62, 10], ['rb', 44, 370, 152, 26, 12],
    ['lff', 26, 32, 22, 80, 8], ['lfd', 26, 116, 22, 84, 8], ['lrd', 26, 204, 22, 84, 8], ['lrf', 26, 292, 22, 74, 8],
    ['rff', 192, 32, 22, 80, 8], ['rfd', 192, 116, 22, 84, 8], ['rrd', 192, 204, 22, 84, 8], ['rrf', 192, 292, 22, 74, 8],
    ['lfw', 4, 52, 18, 46, 6], ['lrw', 4, 304, 18, 46, 6], ['rfw', 218, 52, 18, 46, 6], ['rrw', 218, 304, 18, 46, 6]
  ];
  function svg(damage, opt) {
    opt = opt || {};
    var on = {}; (damage || []).forEach(function (z) { on[z] = 1; });
    var front = L('الأمام', 'FRONT');
    var s = '<svg class="car-svg' + (opt.interactive ? ' edit' : '') + '" viewBox="0 0 240 ' + (400 + Y + 4) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(L('رسم السيارة', 'Car drawing')) + '">' +
      '<text x="120" y="14" text-anchor="middle" font-size="12" font-weight="700" fill="#384a47" font-family="Tajawal, Segoe UI, Arial, sans-serif">▲ ' + esc(front) + '</text>' +
      '<rect x="24" y="' + (Y - 2) + '" width="192" height="' + (400 + 2) + '" rx="46" fill="none" stroke="#9ab3ad" stroke-width="2"/>';
    PARTS.forEach(function (p) {
      var wheel = /w$/.test(p[0]) && p[0].length === 3, hit = !!on[p[0]];
      var fill = hit ? '#d89b00' : (wheel ? '#4a5866' : (p[0] === 'ws' || p[0] === 'rg' ? '#d6eee9' : '#ecf5f3'));
      s += '<rect data-z="' + p[0] + '" x="' + p[1] + '" y="' + (p[2] + Y) + '" width="' + p[3] + '" height="' + p[4] + '" rx="' + p[5] + '" fill="' + fill + '" stroke="' + (hit ? '#946700' : '#86a19b') + '" stroke-width="' + (hit ? 2.4 : 1.4) + '"' +
        (opt.interactive ? ' tabindex="0" style="cursor:pointer"' : '') + '><title>' + esc(C.zoneName(p[0])) + '</title></rect>';
      if (hit) s += '<circle cx="' + (p[1] + p[3] / 2) + '" cy="' + (p[2] + Y + p[4] / 2) + '" r="5" fill="#fff" stroke="#946700" stroke-width="2" pointer-events="none"/>';
    });
    return s + '</svg>';
  }
  function list(damage) { return (damage || []).map(C.zoneName).join('، '); }

  /* the editing window. done(newList) is called with the marked parts when "Save" is pressed */
  function edit(damage, done) {
    var cur = (damage || []).slice();
    var m = C.modal({ title: icon('car') + ' ' + L('حدّد أماكن الضرر على السيارة', 'Mark the damaged parts of the car'), size: 'md',
      body: '<p class="small muted mb">' + L('اضغط على أي جزء لتحديده (يصبح برتقالياً)، واضغط مرة أخرى لإلغائه.', 'Tap a part to mark it (it turns orange); tap again to unmark it.') + '</p><div class="car-wrap" id="cd"></div><p class="mt" id="cd-list"></p>',
      foot: '<button type="button" class="btn ghost" id="cd-clear">' + L('مسح الكل', 'Clear all') + '</button><span class="grow"></span><button type="button" class="btn primary" id="cd-ok">' + icon('check') + L('حفظ', 'Save') + '</button>' });
    function draw() {
      m.el.querySelector('#cd').innerHTML = svg(cur, { interactive: true });
      m.el.querySelector('#cd-list').innerHTML = cur.length ? '<b>' + L('الأماكن المحددة: ', 'Marked: ') + '</b>' + esc(list(cur)) : '<span class="muted">' + L('لم يُحدَّد أي مكان.', 'Nothing marked.') + '</span>';
    }
    function toggle(z) { var i = cur.indexOf(z); if (i >= 0) cur.splice(i, 1); else cur.push(z); draw(); }
    m.el.addEventListener('click', function (e) { var r = e.target.closest('[data-z]'); if (r) toggle(r.getAttribute('data-z')); });
    m.el.addEventListener('keydown', function (e) { var r = e.target.closest && e.target.closest('[data-z]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(r.getAttribute('data-z')); } });
    m.el.querySelector('#cd-clear').onclick = function () { cur = []; draw(); };
    m.el.querySelector('#cd-ok').onclick = function () { m.close(); done(cur); };
    draw();
  }

  /* the drawing as a picture, for the PDF (drawn onto a canvas) */
  function image(damage) {
    return new Promise(function (ok) {
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { ok(null); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(damage).replace('<svg class="car-svg"', '<svg width="240" height="' + (400 + Y + 4) + '"'));
    });
  }

  window.CarDiagram = { svg: svg, edit: edit, list: list, image: image, W: 240, H: 400 + Y + 4 };
})();
