/* billcanvas.js - draws the job card / bill straight onto canvas pages and writes them into a PDF file (for WhatsApp).
   Every line of text is handed to the browser as ONE whole string, so the browser itself shapes the Arabic and orders
   mixed Arabic / English correctly - the same engine that draws the screen. The A4 layout follows the printed A4 sheet
   (js/pos/print.js), page by page, cutting only between rows; the table header repeats on the next page.
   Optional: the job card's photos on extra pages (two per row, with their tag and note).
   The same page engine (Pdf.kit) builds the insurance report (js/pos/insurance.js). */
(function () {
  'use strict';
  var C = window.Core, Calc = C.Calc, f3 = C.f3;
  var W = 794, H = 1123, MX = 34, MY = 28, CW = W - 2 * MX;       // A4 at 96 dpi, content width 726
  var FONT = '"Tajawal","Segoe UI",Tahoma,Arial,sans-serif';
  var PX = function (pt) { return pt * 96 / 72; };
  var BLUE = '#11685e', DARK = '#0d4d46', LINE = '#b3cec8', SOFT = '#ebf5f3', INK = '#111', ORANGE = '#a07400';
  var AR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
  var STRONG = /[A-Za-z֐-ࣿיִ-﷿ﹰ-﻿]/;
  var mc = document.createElement('canvas').getContext('2d');       // for measuring only

  function rtlOf(s) { var m = String(s).match(STRONG); return !!m && AR.test(m[0]); }
  var forceDir = null;
  function setup(c, s, weight, px) { c.font = weight + ' ' + px + 'px ' + FONT; c.direction = forceDir || (rtlOf(s) ? 'rtl' : 'ltr'); }
  function wid(s, weight, px) { setup(mc, s, weight, px); return mc.measureText(s).width; }
  function wrap(s, maxW, weight, px) {
    var out = [];
    String(s === null || s === undefined ? '' : s).split(/\r?\n/).forEach(function (para) {
      var line = '';
      para.split(' ').forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (wid(t, weight, px) <= maxW || !line) {
          if (!line && wid(w, weight, px) > maxW) {
            var part = '';
            Array.from(w).forEach(function (ch) { if (wid(part + ch, weight, px) > maxW && part) { out.push(part); part = ch; } else part += ch; });
            line = part;
          } else line = t;
        } else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  }
  function text(c, s, x, y, o) {
    if (s === '' || s === null || s === undefined) return;
    setup(c, s, o.weight || '400', o.px);
    c.fillStyle = o.color || INK; c.textAlign = o.align || 'left'; c.textBaseline = 'middle';
    c.fillText(String(s), x, y + (o.lh || o.px * 1.45) / 2);
  }
  function round(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function rect(c, x, y, w, h, fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
  function hline(c, x, y, w, color, dash) { c.save(); c.strokeStyle = color; c.lineWidth = 1; if (dash) c.setLineDash(dash); c.beginPath(); c.moveTo(x, y + 0.5); c.lineTo(x + w, y + 0.5); c.stroke(); c.restore(); }
  function strokeBox(c, x, y, w, h, color, r, dash) { c.save(); c.strokeStyle = color || LINE; c.lineWidth = 1; if (dash) c.setLineDash(dash); round(c, x + 0.5, y + 0.5, w - 1, h - 1, r || 5); c.stroke(); c.restore(); }
  /* a paragraph that may be Arabic or English: each wrapped line goes to its own reading side */
  function para(c, lines, x, y, w, px, lh, color, weight) {
    lines.forEach(function (ln, i) { var r = rtlOf(ln); text(c, ln, r ? x + w : x, y + i * lh, { px: px, lh: lh, color: color || INK, align: r ? 'right' : 'left', weight: weight || '400' }); });
  }

  /* a "label / value" row (label left in grey, value right in bold) */
  function kv(en, ar, val, w, o) {
    o = o || {};
    var px = PX(o.pt || 9.5), lh = px * 1.45, label = ar ? en + ' / ' + ar : en;
    var lw = wid(label, '400', px), avail = Math.max(w - lw - 12, w * 0.35), fd = o.ltr ? 'ltr' : null;
    forceDir = fd; var lines = wrap(val, avail, '700', px); forceDir = null;
    var h = Math.max(1, lines.length) * lh + 3;
    return { h: h, draw: function (c, x, y) {
      text(c, label, x, y + 1.5, { px: px, color: o.color || '#555', lh: lh });
      forceDir = fd; lines.forEach(function (ln, i) { text(c, ln, x + w, y + 1.5 + i * lh, { px: px, weight: '700', color: o.color || INK, align: 'right', lh: lh }); }); forceDir = null;
      if (o.line) hline(c, x, y + h - 1, w, LINE, [1, 2]);
    } };
  }
  function stackH(parts) { return parts.reduce(function (t, p) { return t + p.h; }, 0); }
  function drawStack(c, parts, x, y) { parts.forEach(function (p) { p.draw(c, x, y); y += p.h; }); }
  function box(titleEn, titleAr, rows, w, minH) {
    var tpx = PX(8.6), th = tpx * 1.45 + 6, inner = w - 18, h = Math.max(6 + th + stackH(rows) + 6, minH || 0);
    return { h: h, draw: function (c, x, y) {
      strokeBox(c, x, y, w, h, '#96b6af', 5);
      text(c, titleEn, x + 9, y + 6, { px: tpx, weight: '800', color: DARK });
      text(c, titleAr, x + w - 9, y + 6, { px: tpx, weight: '800', color: DARK, align: 'right' });
      hline(c, x + 9, y + 6 + tpx * 1.45 + 2, inner, '#d5e7e3');
      drawStack(c, rows, x + 9, y + 6 + th);
    } };
  }
  /* a dashed note box: "Title / العنوان: text" */
  function noteBox(label, str, w) {
    var px = PX(9), lh = px * 1.45, lines = wrap(label + ' ' + str, w - 18, '400', px), h = lines.length * lh + 10;
    return { h: h + 6, draw: function (c, x, y) {
      strokeBox(c, x, y, w, h, '#96b6af', 5, [3, 3]);
      para(c, lines, x + 9, y + 5, w - 18, px, lh, '#222');
    } };
  }
  function gap(n) { return { h: n, draw: function () {} }; }

  function header(s, tax, logo) {
    var LW = logo ? 150 : 0, LH = logo ? Math.min(112, Math.round(LW * logo.height / logo.width)) : 0;
    if (logo && LH === 112) LW = Math.round(112 * logo.width / logo.height);
    var colW = (CW - LW - 24) / 2, sm = PX(8.8), smLh = sm * 1.42;
    function lines(list) {
      var out = [];
      list.forEach(function (it) {
        if (!it.t) return;
        if (it.big) { var bp = PX(14); [PX(14), PX(12.5), PX(11)].some(function (p) { bp = p; return wid(it.t, '800', p) <= colW; }); wrap(it.t, colW, '800', bp).forEach(function (ln) { out.push({ t: ln, px: bp, w: '800', color: DARK, lh: bp * 1.25 }); }); return; }
        wrap(it.t, colW, it.b ? '700' : '400', sm).forEach(function (ln) { out.push({ t: ln, px: sm, w: it.b ? '700' : '400', color: it.o ? ORANGE : '#333', lh: smLh }); });
      });
      return out;
    }
    var LL = lines([{ t: s.name, big: true }, { t: s.activity }, { t: s.phone ? 'GSM: ' + s.phone : '', b: true }, { t: s.transferNo ? 'Transfer no: ' + s.transferNo : '', b: true, o: true }, { t: s.addr },
      { t: s.cr ? 'C.R.: ' + s.cr : '', b: true }, { t: tax && s.vatNo ? 'VATIN: ' + s.vatNo : '', b: true }]);
    var RL = lines([{ t: s.nameAr || s.name, big: true }, { t: s.activityAr }, { t: s.phone ? 'نقال: ' + s.phone : '', b: true }, { t: s.transferNo ? 'رقم التحويل: ' + s.transferNo : '', b: true, o: true }, { t: s.addrAr },
      { t: s.cr ? 'س.ت: ' + s.cr : '', b: true }, { t: tax && s.vatNo ? 'الرقم الضريبي: ' + s.vatNo : '', b: true }]);
    var sum = function (a) { return a.reduce(function (t, l) { return t + l.lh; }, 0); }, body = Math.max(sum(LL), sum(RL), LH), h = body + 8 + 3;
    return { h: h + 6, draw: function (c, x, y) {
      var yy = y; LL.forEach(function (l) { text(c, l.t, x, yy, { px: l.px, weight: l.w, color: l.color, lh: l.lh }); yy += l.lh; });
      yy = y; RL.forEach(function (l) { text(c, l.t, x + CW, yy, { px: l.px, weight: l.w, color: l.color, lh: l.lh, align: 'right' }); yy += l.lh; });
      if (logo) c.drawImage(logo, x + CW / 2 - LW / 2, y + (body - LH) / 2, LW, LH);
      rect(c, x, y + h - 3, CW, 3, BLUE);
    } };
  }
  /* the boxes of the paper form: label (English over Arabic) on a light background, the value beside it */
  function fieldGrid(fields) {
    var half = CW / 2, rows = [], cur = [];
    fields.forEach(function (f) { if (f.wide) { if (cur.length) { rows.push(cur); cur = []; } rows.push([f]); } else { cur.push(f); if (cur.length === 2) { rows.push(cur); cur = []; } } });
    if (cur.length) rows.push(cur);
    var lpx = PX(7.6), llh = lpx * 1.3, vpx = PX(9.4), vlh = vpx * 1.4;
    var built = rows.map(function (r) {
      var cells = r.map(function (f) {
        var w = f.wide ? CW : half, lw = f.wide ? CW * 0.18 : half * 0.36, vw = w - lw - 12;
        forceDir = f.ltr ? 'ltr' : null; var vl = wrap(f.v || '', vw, '700', vpx); forceDir = null;
        return { f: f, w: w, lw: lw, vl: vl, h: Math.max(2 * llh + 6, vl.length * vlh + 6) };
      });
      return { cells: cells, h: Math.max.apply(null, cells.map(function (x) { return x.h; })) };
    });
    var total = built.reduce(function (t, r) { return t + r.h; }, 0);
    return { h: total + 8, draw: function (c, x, y) {
      var yy = y;
      built.forEach(function (r) {
        var xx = x;
        r.cells.forEach(function (cell) {
          rect(c, xx, yy, cell.lw, r.h, SOFT);
          c.save(); c.strokeStyle = '#c3dad5'; c.lineWidth = 1; c.strokeRect(xx + 0.5, yy + 0.5, cell.w - 1, r.h - 1); c.restore();
          text(c, cell.f.en, xx + 5, yy + 3, { px: lpx, weight: '700', color: DARK, lh: llh });
          text(c, cell.f.ar, xx + cell.lw - 5, yy + 3 + llh, { px: lpx, weight: '700', color: DARK, lh: llh, align: 'right' });
          forceDir = cell.f.ltr ? 'ltr' : null;
          cell.vl.forEach(function (ln, i) { var rt = !cell.f.ltr && rtlOf(ln); text(c, ln, rt ? xx + cell.w - 6 : xx + cell.lw + 6, yy + 3 + i * vlh, { px: vpx, weight: '700', lh: vlh, align: rt ? 'right' : 'left' }); });
          forceDir = null;
          xx += cell.w;
        });
        yy += r.h;
      });
      strokeBox(c, x, y, CW, total, '#96b6af', 4);
    } };
  }
  /* checkboxes: [{en, ar, on}] in a titled box */
  function checks(titleEn, titleAr, items, w) {
    var px = PX(8.6), lh = px * 1.6, tpx = PX(8), x0 = 7, rows = [[]], rowW = 0, inner = w - 14;
    items.forEach(function (it) { var iw = 14 + wid(it.en + ' / ' + it.ar, '400', px) + 14; if (rowW + iw > inner && rows[rows.length - 1].length) { rows.push([]); rowW = 0; } rows[rows.length - 1].push({ it: it, w: iw }); rowW += iw; });
    var h = 6 + tpx * 1.45 + rows.length * lh + 4;
    return { h: h, draw: function (c, x, y) {
      strokeBox(c, x, y, w, h, '#c3dad5', 5);
      text(c, titleEn + ' / ' + titleAr, x + x0, y + 4, { px: tpx, weight: '800', color: DARK });
      rows.forEach(function (r, i) {
        var xx = x + x0, yy = y + 6 + tpx * 1.45 + i * lh;
        r.forEach(function (cell) {
          c.save(); c.lineWidth = 1.3; c.strokeStyle = cell.it.on ? BLUE : '#333'; if (cell.it.on) { c.fillStyle = BLUE; c.fillRect(xx, yy + lh / 2 - 6, 12, 12); } c.strokeRect(xx + 0.5, yy + lh / 2 - 5.5, 11, 11); c.restore();
          if (cell.it.on) { c.save(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(xx + 2.5, yy + lh / 2); c.lineTo(xx + 5, yy + lh / 2 + 3); c.lineTo(xx + 9.5, yy + lh / 2 - 3); c.stroke(); c.restore(); }
          forceDir = 'ltr'; text(c, cell.it.en + ' / ' + cell.it.ar, xx + 17, yy, { px: px, lh: lh }); forceDir = null;
          xx += cell.w;
        });
      });
    } };
  }

  /* ------------------------------------------------ the job card / bill (A4) */
  function blocks(inv, s, logo, dmgImg, noPrice) {
    var tax = inv.vatPct > 0, paid = Calc.paid(inv), bal = Calc.balance(inv), dt = Print.docType(inv), car = inv.car || {}, out = [];
    out.push(header(s, tax, logo));
    var pw = Print.payWay(inv), tpx = PX(12), spx = PX(10.5);
    var th = Math.max(tpx * 1.45 + spx * 1.45 + 12, inv.void ? 50 : 44);
    out.push({ h: th + 6, draw: function (c, x, y) {
      text(c, 'NO: ' + inv.number, x, y + 4, { px: PX(12), weight: '800' });
      text(c, 'Date / التاريخ: ' + C.fdate(inv.date), x, y + 4 + PX(12) * 1.45, { px: PX(9), weight: '600', color: '#333' });
      var t1 = noPrice ? 'JOB CARD - WORKSHOP COPY' : dt[0], t2 = noPrice ? 'أمر عمل - نسخة الورشة' : dt[1];
      var tw = Math.max(wid(t1, '800', tpx), wid(t2, '700', spx)) + 30;
      strokeBox(c, x + CW / 2 - tw / 2, y, tw, th, BLUE, 6, [4, 3]);
      text(c, t1, x + CW / 2, y + 5, { px: tpx, weight: '800', color: DARK, align: 'center' });
      text(c, t2, x + CW / 2, y + 5 + tpx * 1.45, { px: spx, weight: '700', align: 'center' });
      if (inv.void) {
        c.save(); c.translate(x + CW - 70, y + th / 2); c.rotate(-6 * Math.PI / 180);
        c.strokeStyle = '#d43d51'; c.lineWidth = 3; round(c, -64, -17, 128, 34, 8); c.stroke();
        text(c, 'VOID / ملغاة', 0, -17, { px: PX(15), weight: '800', color: '#d43d51', align: 'center', lh: 34 }); c.restore();
      } else if (!noPrice) {
        text(c, 'Payment / الدفع:', x + CW, y + 2, { px: PX(8.4), color: '#333', align: 'right' });
        text(c, pw.map(function (p) { return p[0]; }).join(' + ') || '-', x + CW, y + 2 + PX(8.4) * 1.45, { px: PX(8.8), weight: '700', align: 'right' });
        if (pw.length) text(c, pw.map(function (p) { return p[1]; }).join(' + '), x + CW, y + 2 + PX(8.4) * 1.45 + PX(8.8) * 1.45, { px: PX(8.8), weight: '700', align: 'right' });
      }
    } });
    var F = [{ en: 'Name of customer', ar: 'اسم العميل', v: inv.customerName || 'Cash customer / عميل نقدي', wide: true },
      { en: 'Phone no', ar: 'الهاتف', v: inv.customerPhone, ltr: true }, { en: 'Make', ar: 'الشركة', v: car.make },
      { en: 'Model', ar: 'الطراز', v: car.model }, { en: 'Year', ar: 'السنة', v: car.year, ltr: true },
      { en: 'Registration no', ar: 'رقم اللوحة', v: car.plate, ltr: true }, { en: 'Color', ar: 'اللون', v: car.color },
      { en: 'Chassis no', ar: 'رقم الشاصي', v: car.vin, ltr: true }, { en: 'MI / KM', ar: 'العداد', v: car.km, ltr: true },
      { en: 'Expected delivery', ar: 'التسليم المتوقع', v: inv.expDate ? C.fdate(inv.expDate) : '', ltr: true }, { en: 'Actual delivery', ar: 'التسليم الفعلي', v: inv.deliveredAt ? C.fdate(inv.deliveredAt) : '', ltr: true },
      { en: 'Time in / out', ar: 'الدخول / الخروج', v: [inv.timeIn, inv.timeOut].filter(Boolean).join('  >  '), ltr: true }, { en: 'Done by', ar: 'تم بواسطة', v: inv.doneBy }];
    if (inv.source === 'ins' && (inv.insCo || inv.claimNo)) F.push({ en: 'Insurance / claim', ar: 'التأمين / المطالبة', v: [inv.insCo, inv.claimNo].filter(Boolean).join(' - '), wide: true });
    out.push(fieldGrid(F));
    var hw = (CW - 8) / 2;
    var c1 = checks('TYPE OF SERVICES', 'نوع الخدمة', C.SVC.filter(function (x) { return x.id !== 'other' || (inv.svc || []).indexOf('other') >= 0; }).map(function (x) { return { en: x.en, ar: x.ar, on: (inv.svc || []).indexOf(x.id) >= 0 }; }), hw);
    var c2 = checks('VEHICLE SOURCE', 'مصدر المركبة', C.SOURCES.filter(function (x) { return x.id !== 'other' || inv.source === 'other'; }).map(function (x) { return { en: x.en, ar: x.ar, on: inv.source === x.id }; }), hw);
    out.push({ h: Math.max(c1.h, c2.h) + 6, draw: function (c, x, y) { c1.draw(c, x, y); c2.draw(c, x + hw + 8, y); } });
    if (inv.complaint) out.push(noteBox('Complaint / الشكوى:', inv.complaint, CW));
    if (inv.workNotes) out.push(noteBox('Work done / ما تم عمله:', inv.workNotes, CW));
    if (inv.note) out.push(noteBox('Note / ملاحظة:', inv.note, CW));

    var cols = noPrice ? [30, 0, 110] : [30, 0, 84, 84, 84, 50]; cols[1] = CW - cols.reduce(function (a, b) { return a + b; }, 0);
    var xs = []; cols.reduce(function (a, w, i) { xs[i] = a; return a + w; }, 0);
    var hpx = PX(8.4), thH = noPrice ? hpx * 1.45 + 12 : 2 * hpx * 1.3 + 10;
    var head = { table: 'head', h: thH, draw: function (c, x, y) {
      rect(c, x, y, CW, thH, BLUE);
      var o = { px: hpx, weight: '800', color: '#fff', align: 'center', lh: hpx * 1.3 }, one = function (t, i) { text(c, t, x + xs[i] + cols[i] / 2, y + (thH - hpx * 1.3) / 2, o); }, two = function (a, b, i) { text(c, a, x + xs[i] + cols[i] / 2, y + 5, o); text(c, b, x + xs[i] + cols[i] / 2, y + 5 + hpx * 1.3, o); };
      one('#', 0); one('DESCRIPTION / التفاصيل', 1); one('Qty / الكمية', 2);
      if (!noPrice) { one('Price / السعر', 3); two('Amount R.O', 'ريال عماني', 4); two('Bz.', 'بيسة', 5); }
    } };
    out.push(head);
    var tpx2 = PX(9.4), tlh = tpx2 * 1.45, apx = PX(8), alh = apx * 1.4, n = 0;
    var gridRow = function (rh, fill) { return function (c, x, y) { if (fill) rect(c, x, y, CW, rh, fill); c.save(); c.strokeStyle = LINE; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, CW - 1, rh - 1); xs.slice(1).forEach(function (cx) { c.beginPath(); c.moveTo(x + cx + 0.5, y); c.lineTo(x + cx + 0.5, y + rh); c.stroke(); }); c.restore(); }; };
    var groupsList = Print.groups(inv);
    groupsList.forEach(function (g) {
      var gh = PX(8.6) * 1.45 + 6;
      out.push({ table: 'row', h: gh, draw: function (c, x, y) { rect(c, x, y, CW, gh, SOFT); c.save(); c.strokeStyle = LINE; c.strokeRect(x + 0.5, y + 0.5, CW - 1, gh - 1); c.restore(); text(c, Print.GRP[g.k][0] + ' / ' + Print.GRP[g.k][1], x + 8, y + 3, { px: PX(8.6), weight: '800', color: DARK }); } });
      g.items.forEach(function (it) {
        n++; var no = n;
        var nameL = wrap(it.n || it.a || '', cols[1] - 14, '400', tpx2);
        var enL = it.a && it.a !== it.n ? wrap(it.a, cols[1] - 14, '400', apx) : [];
        var qty = C.qf(it.q) + (it.unit ? ' ' + it.unit : '');
        var rh = Math.max(nameL.length * tlh + enL.length * alh, tlh) + 8, a = Print.roBz(Calc.line(it));
        out.push({ table: 'row', h: rh, draw: function (c, x, y) {
          gridRow(rh)(c, x, y);
          text(c, String(no), x + xs[0] + cols[0] / 2, y + 4, { px: tpx2, align: 'center' });
          nameL.forEach(function (ln, k) { var r = rtlOf(ln); text(c, ln, r ? x + xs[1] + cols[1] - 7 : x + xs[1] + 7, y + 4 + k * tlh, { px: tpx2, align: r ? 'right' : 'left' }); });
          enL.forEach(function (ln, k) { text(c, ln, x + xs[1] + 7, y + 4 + nameL.length * tlh + k * alh, { px: apx, color: '#555', lh: alh }); });
          text(c, qty, x + xs[2] + cols[2] / 2, y + 4, { px: tpx2, align: 'center' });
          if (!noPrice) {
            text(c, f3(it.price), x + xs[3] + cols[3] - 6, y + 4, { px: tpx2, align: 'right' });
            text(c, a[0], x + xs[4] + cols[4] - 6, y + 4, { px: tpx2, align: 'right' });
            text(c, a[1], x + xs[5] + cols[5] / 2, y + 4, { px: tpx2, align: 'center' });
          }
        } });
      });
    });
    if (!groupsList.length) out.push({ table: 'row', h: 34, draw: function (c, x, y) { gridRow(34)(c, x, y); text(c, '-', x + CW / 2, y + 8, { px: tpx2, align: 'center', color: '#777' }); } });
    if (!noPrice) {
      var T = function (en, ar, v, grand) {
        var px = grand ? PX(10.5) : PX(9.2), rh = px * 1.45 + 8, a = Print.roBz(v);
        return { table: 'row', h: rh, draw: function (c, x, y) {
          if (grand) rect(c, x, y, CW, rh, BLUE);
          c.save(); c.strokeStyle = grand ? BLUE : LINE; c.strokeRect(x + 0.5, y + 0.5, CW - 1, rh - 1); [xs[4], xs[5]].forEach(function (cx) { c.beginPath(); c.moveTo(x + cx + 0.5, y); c.lineTo(x + cx + 0.5, y + rh); c.stroke(); }); c.restore();
          var col = grand ? '#fff' : INK;
          text(c, en + ' / ' + ar, x + xs[4] - 8, y + 4, { px: px, weight: '800', color: col, align: 'right' });
          text(c, a[0], x + xs[4] + cols[4] - 6, y + 4, { px: px, weight: '800', color: col, align: 'right' });
          text(c, a[1], x + xs[5] + cols[5] / 2, y + 4, { px: px, weight: '800', color: col, align: 'center' });
        } };
      };
      out.push(T('Sub-total', 'المجموع', inv.sub));
      if (inv.discount > 0) out.push(T('Discount', 'الخصم', -inv.discount));
      if (tax) out.push(T('VAT ' + inv.vatPct + '%', 'ضريبة القيمة المضافة', inv.vat));
      out.push(T('TOTAL', 'الإجمالي', inv.total, true));
      out.push(T('Paid', 'المدفوع', paid));
      if (bal > 0.0004) out.push(T('Balance due', 'المتبقي', bal));
    }
    out.push(gap(8));

    var w = inv.warranty || {}, iw = hw - 18;
    var wr = [{ h: 0, draw: function () {} }], wl = wrap(w.text || '-', iw, '400', PX(9));
    wr = [{ h: wl.length * PX(9) * 1.45 + 2, draw: function (c, x, y) { para(c, wl, x, y, iw, PX(9), PX(9) * 1.45); } }];
    if (w.from || w.to) wr.push(kv('From', 'من', (w.from ? C.fdate(w.from) : '....') + '  -  ' + (w.to ? C.fdate(w.to) : '....'), iw, { ltr: true, pt: 8.8 }));
    var pr = noPrice ? [kv('-', '', '', iw)] : (inv.payments || []).map(function (p) { var m = Print.PAYM[p.method] || [p.method, p.method]; return kv(C.fdate(p.date) + ' · ' + m[0], m[1], f3(p.amount), iw, { ltr: true, pt: 8.8 }); });
    if (!noPrice && !pr.length) pr.push(kv('-', '', '', iw));
    if (!noPrice && s.transferNo) pr.push(kv('For transfer', 'للدفع بالتحويل', s.transferNo, iw, { ltr: true, pt: 8.8, color: ORANGE }));
    var bw = box('WARRANTY', 'الضمان يشمل، إن وجد', wr, hw), bp = box('PAYMENTS', 'الدفعات', pr, hw), bh = Math.max(bw.h, bp.h);
    bw = box('WARRANTY', 'الضمان يشمل، إن وجد', wr, hw, bh); bp = box('PAYMENTS', 'الدفعات', pr, hw, bh);
    out.push({ h: bh + 8, draw: function (c, x, y) { bw.draw(c, x, y); bp.draw(c, x + hw + 8, y); } });

    var tl = Print.termsList(), showT = s.printTerms !== false && (tl.ar.length || tl.en.length), dmg = (inv.damage || []).length;
    if (showT || dmg) {
      var DW = 120, DH = Math.round(DW * CarDiagram.H / CarDiagram.W), tw2 = CW - DW - 14, tpx3 = PX(7.4), tlh3 = tpx3 * 1.45;
      var arL = [], enL2 = [];
      if (showT) {
        tl.ar.forEach(function (t, i) { wrap((i + 1) + ' - ' + t, tw2, '400', tpx3).forEach(function (l) { arL.push(l); }); });
        tl.en.forEach(function (t, i) { wrap((i + 1) + '. ' + t, tw2, '400', tpx3).forEach(function (l) { enL2.push(l); }); });
      }
      var hpx3 = PX(8.4), termsH = showT ? (arL.length ? hpx3 * 1.45 + arL.length * tlh3 + 4 : 0) + (enL2.length ? hpx3 * 1.45 + enL2.length * tlh3 : 0) : 0;
      var dl = dmg ? wrap(CarDiagram.list(inv.damage), DW, '400', PX(7)) : [];
      out.push({ h: Math.max(termsH, DH + dl.length * PX(7) * 1.4) + 6, draw: function (c, x, y) {
        var yy = y;
        if (showT && arL.length) { text(c, 'شروط الإصلاح:', x + tw2, yy, { px: hpx3, weight: '800', color: DARK, align: 'right' }); yy += hpx3 * 1.45; forceDir = 'rtl'; arL.forEach(function (l) { text(c, l, x + tw2, yy, { px: tpx3, lh: tlh3, align: 'right', color: '#222' }); yy += tlh3; }); forceDir = null; yy += 4; }
        if (showT && enL2.length) { text(c, 'Repair terms:', x, yy, { px: hpx3, weight: '800', color: DARK }); yy += hpx3 * 1.45; forceDir = 'ltr'; enL2.forEach(function (l) { text(c, l, x, yy, { px: tpx3, lh: tlh3, color: '#222' }); yy += tlh3; }); forceDir = null; }
        if (dmgImg) c.drawImage(dmgImg, x + CW - DW, y, DW, DH);
        dl.forEach(function (l, i) { text(c, l, x + CW - DW / 2, y + DH + i * PX(7) * 1.4, { px: PX(7), align: 'center', lh: PX(7) * 1.4 }); });
      } });
    }

    var sw = (CW - 30) / 2, spx2 = PX(8.6);
    var rel1 = 'إخلاء طرف: قد استلمت السيارة من الورشة بحالة جيدة وقد تم إصلاح الأشياء المطلوبة على أكمل وجه.', rel2 = 'Release: I received the car from the workshop in good condition with the requested repairs fully done.';
    var r1 = wrap(rel1, CW - 20, '700', spx2), r2 = wrap(rel2, CW - 20, '400', PX(8)), relH = 8 + r1.length * spx2 * 1.45 + r2.length * PX(8) * 1.45 + 30;
    var fpx = PX(8.4), flh = fpx * 1.45, fl = wrap([s.footerAr, s.footer].filter(Boolean).join(' · '), CW, '400', fpx);
    out.push({ h: 34 + spx2 * 2.9 + 10 + relH + 10 + fl.length * flh + 4, draw: function (c, x, y) {
      [['Workshop management / إدارة الورشة', ''], ['Customer signature / توقيع الزبون', 'أوافق على كافة الشروط']].forEach(function (g, i) {
        var sx = x + i * (sw + 30); rect(c, sx, y + 28, sw, 1, '#555');
        text(c, g[0], sx + sw / 2, y + 31, { px: spx2, color: '#333', align: 'center' });
        if (g[1]) text(c, g[1], sx + sw / 2, y + 31 + spx2 * 1.45, { px: PX(7.6), color: '#555', align: 'center' });
      });
      var ry = y + 34 + spx2 * 2.9 + 4;
      strokeBox(c, x, ry, CW, relH, '#96b6af', 5);
      r1.forEach(function (l, i) { text(c, l, x + CW / 2, ry + 5 + i * spx2 * 1.45, { px: spx2, weight: '700', align: 'center' }); });
      r2.forEach(function (l, i) { text(c, l, x + CW / 2, ry + 5 + r1.length * spx2 * 1.45 + i * PX(8) * 1.45, { px: PX(8), align: 'center', color: '#333' }); });
      var ly = ry + relH - 14;
      text(c, 'Name / الاسم: ....................................', x + 12, ly - 6, { px: PX(8.4) });
      text(c, 'Signature / التوقيع: ..............................', x + CW - 12, ly - 6, { px: PX(8.4), align: 'right' });
      hline(c, x, ry + relH + 6, CW, '#d5e7e3');
      fl.forEach(function (ln, i) { text(c, ln, x + CW / 2, ry + relH + 10 + i * flh, { px: fpx, color: '#444', align: 'center', lh: flh }); });
    } });
    return out;
  }

  /* photos, two per row with their tag and note, starting on a new page */
  function photoBlocks(photos, imgs, title) {
    var out = [], cw = (CW - 10) / 2, ph = 230, cap = PX(8.4) * 1.45 * 2 + 6;
    out.push({ page: true, h: PX(12) * 1.45 + 10, draw: function (c, x, y) { text(c, title, x + CW / 2, y, { px: PX(12), weight: '800', color: DARK, align: 'center' }); hline(c, x, y + PX(12) * 1.45 + 4, CW, BLUE); } });
    for (var i = 0; i < photos.length; i += 2) {
      (function (pair, ims) {
        out.push({ h: ph + cap + 10, draw: function (c, x, y) {
          pair.forEach(function (p, k) {
            var xx = x + k * (cw + 10), im = ims[k];
            strokeBox(c, xx, y, cw, ph + cap, '#c3dad5', 5);
            if (im) {
              var r = Math.max((cw - 8) / im.width, ph / im.height), dw = im.width * r, dh = im.height * r;
              c.save(); c.beginPath(); c.rect(xx + 4, y + 4, cw - 8, ph - 4); c.clip(); c.drawImage(im, xx + 4 + (cw - 8 - dw) / 2, y + 4 + (ph - 4 - dh) / 2, dw, dh); c.restore();
            } else text(c, '-', xx + cw / 2, y + ph / 2, { px: PX(10), align: 'center', color: '#999' });
            var t = C.tagOf(p.tag);
            forceDir = 'ltr'; text(c, t.en + ' / ' + t.ar, xx + 8, y + ph + 3, { px: PX(8.4), weight: '800', color: t.id === 'before' ? '#b3261e' : t.id === 'after' ? '#11663a' : DARK });
            if (p.ts) text(c, C.fts(p.ts), xx + cw - 8, y + ph + 3, { px: PX(8), color: '#555', align: 'right' }); forceDir = null;
            if (p.note) { var nl = wrap(p.note, cw - 16, '400', PX(8.4))[0]; para(c, [nl], xx + 8, y + ph + 3 + PX(8.4) * 1.45, cw - 16, PX(8.4), PX(8.4) * 1.45, '#333'); }
          });
        } });
      })(photos.slice(i, i + 2), imgs.slice(i, i + 2));
    }
    return out;
  }
  function loadImg(src) {
    return new Promise(function (ok) { if (!src) return ok(null); var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src; });
  }
  function fontsReady() {
    return document.fonts && document.fonts.load ? Promise.all(['400', '500', '700', '800'].map(function (w) { return document.fonts.load(w + ' 14px Tajawal', 'ابجد abc 123'); })).catch(function () {}) : Promise.resolve();
  }
  /* put blocks on A4 pages. A block with .page starts a new page; a table row that moves to a new page gets the header again */
  function paginate(list, scale, label) {
    scale = scale || 2;
    var pages = [], cur = [], y = MY, limit = H - 18, head = null;
    list.forEach(function (b) {
      if (b.table === 'head') head = b;
      if ((b.page && cur.length) || (y + b.h > limit && cur.length)) {
        pages.push(cur); cur = []; y = MY;
        if (b.table === 'row' && head) { cur.push({ b: head, y: y }); y += head.h; }
      }
      cur.push({ b: b, y: y }); y += b.h;
    });
    pages.push(cur);
    var n = pages.length;
    return pages.map(function (items, pi) {
      var cv = document.createElement('canvas'); cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
      var c = cv.getContext('2d'); c.scale(scale, scale); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
      items.forEach(function (it) { it.b.draw(c, MX, it.y); });
      if (n > 1) { forceDir = 'ltr'; text(c, (label ? label + '  ·  ' : '') + (pi + 1) + ' / ' + n, W / 2, H - 16, { px: PX(8), color: '#888', align: 'center' }); forceDir = null; }
      return cv;
    });
  }
  function render(inv, o) {
    o = o || {};
    var s = Store.s.settings, photos = o.photos ? (inv.photos || []) : [];
    return Promise.all([fontsReady(), o.noLogo ? null : loadImg(Media.logo()), CarDiagram.image(inv.damage), Promise.all(photos.map(function (p) { return loadImg(Media.url(p.id)); }))]).then(function (r) {
      var list = blocks(inv, s, r[1], r[2], o.noPrice);
      if (photos.length) list = list.concat(photoBlocks(photos, r[3], 'Photos / الصور - ' + inv.number));
      return paginate(list, 2, inv.number);
    });
  }

  /* ------------------------------------------------ the receipt-roll bill (80 mm / 58 mm) as ONE long page */
  function renderReceipt(inv, narrow, noLogo, scale) {
    var s = Store.s.settings, ar = C.lang === 'ar', w = Print.words(), tax = inv.vatPct > 0, car = inv.car || {}; scale = scale || 3;
    var Wmm = narrow ? 58 : 80, WP = Math.round(Wmm * 96 / 25.4), M = narrow ? 9 : 13, CWr = WP - 2 * M;
    var base = narrow ? 11 : 12.5, lh = base * 1.5, ops = [];
    var startX = ar ? M + CWr : M, endX = ar ? M : M + CWr, startAl = ar ? 'right' : 'left', endAl = ar ? 'left' : 'right';
    var centre = function (str, px, weight, color) {
      if (!str) return;
      wrap(str, CWr, weight || '400', px).forEach(function (ln) { ops.push({ h: px * 1.45, draw: function (c, y) { text(c, ln, M + CWr / 2, y, { px: px, weight: weight || '400', align: 'center', color: color || '#000' }); } }); });
    };
    var rule = function () { ops.push({ h: 11, draw: function (c, y) { hline(c, M, y + 5, CWr, '#000', [3, 3]); } }); };
    var row = function (label, value, o) {
      if (value === '' || value === null || value === undefined) return;
      o = o || {};
      var px = o.px || base, wt = o.bold ? '800' : '400', lw = wid(label, wt, px), room = Math.max(CWr - lw - 10, CWr * 0.4);
      var lines = wrap(String(value), room, '700', px), hh = px * 1.5;
      ops.push({ h: Math.max(1, lines.length) * hh, draw: function (c, y) {
        text(c, label, startX, y, { px: px, weight: wt, align: startAl, lh: hh, color: o.color || '#000' });
        lines.forEach(function (ln, i) { text(c, ln, endX, y + i * hh, { px: px, weight: o.bold ? '800' : '700', align: endAl, lh: hh, color: o.color || '#000' }); });
      } });
    };
    return Promise.all([fontsReady(), noLogo ? null : loadImg(Media.logo())]).then(function (r) {
      var logo = r[1];
      if (logo) { var lw2 = Math.min(narrow ? 90 : 120, CWr), lh2 = Math.round(lw2 * logo.height / logo.width); ops.push({ h: lh2 + 4, draw: function (c, y) { c.drawImage(logo, M + (CWr - lw2) / 2, y, lw2, lh2); } }); }
      centre(ar ? s.nameAr || s.name : s.name || s.nameAr, narrow ? 15 : 17, '800');
      centre(ar ? s.name : s.nameAr, base, '700');
      centre(ar ? s.addrAr : s.addr, base - 1);
      if (s.phone) centre(w.tel + ': ' + s.phone, base - 1);
      if (s.transferNo) centre(w.tr + ': ' + s.transferNo, base - 1, '700');
      if (s.cr) centre(w.cr + ': ' + s.cr, base - 1);
      if (tax && s.vatNo) centre(w.vatin + ': ' + s.vatNo, base - 1);
      rule();
      centre(tax ? w.taxTitle : w.title, base + 2.5, '800');
      if (inv.void) centre(w.voided, base + 3, '800', '#d43d51');
      row(w.no, inv.number || ''); row(w.date, C.fdate(inv.date) + ' ' + (inv.time || ''));
      row(w.customer, inv.customerName); row(w.phone, inv.customerPhone);
      row(w.car, [car.make, car.model, car.year].filter(Boolean).join(' ')); row(w.plate, car.plate); row(w.km, car.km);
      row(w.seller, inv.createdBy);
      rule();
      inv.items.forEach(function (it) {
        wrap(C.lineName(it), CWr, '700', base).forEach(function (ln) { ops.push({ h: lh, draw: function (c, y) { text(c, ln, startX, y, { px: base, weight: '700', align: startAl, lh: lh }); } }); });
        var qty = C.qf(it.q) + (C.lineUnit(it) ? ' ' + C.lineUnit(it) : '') + ' × ' + f3(it.price);
        ops.push({ h: lh + 5, draw: function (c, y) {
          text(c, qty, startX, y, { px: base - 0.5, align: startAl, lh: lh, color: '#333' });
          text(c, f3(Calc.line(it)), endX, y, { px: base, weight: '700', align: endAl, lh: lh });
          hline(c, M, y + lh + 2, CWr, '#999', [1, 2]);
        } });
      });
      ops.push({ h: 4, draw: function () {} });
      row(w.sub, f3(inv.sub));
      if (inv.discount > 0) row(w.disc, '-' + f3(inv.discount));
      if (tax) row(w.vat + ' ' + inv.vatPct + '%', f3(inv.vat));
      row(w.total, f3(inv.total), { px: base + 3.5, bold: true });
      row(w.paid, f3(Calc.paid(inv)));
      if (Calc.balance(inv) > 0.0004) row(w.bal, f3(Calc.balance(inv)), { color: '#b00020', bold: true });
      if (inv.warranty && inv.warranty.text) { rule(); row(w.war, inv.warranty.text); }
      if (inv.note) { rule(); wrap(inv.note, CWr, '400', base).forEach(function (ln) { ops.push({ h: lh, draw: function (c, y) { var rt = rtlOf(ln); text(c, ln, rt ? M + CWr : M, y, { px: base, align: rt ? 'right' : 'left', lh: lh }); } }); }); }
      rule();
      centre(ar ? s.footerAr || s.footer : s.footer || s.footerAr, base);
      var HP = Math.ceil(ops.reduce(function (t, o) { return t + o.h; }, 0) + 2 * M + 4);
      var cv = document.createElement('canvas'); cv.width = Math.round(WP * scale); cv.height = Math.round(HP * scale);
      var c = cv.getContext('2d'); c.scale(scale, scale); c.fillStyle = '#fff'; c.fillRect(0, 0, WP, HP);
      var y = M; ops.forEach(function (o) { o.draw(c, y); y += o.h; });
      cv._pt = [WP * 72 / 96, HP * 72 / 96];                  // the page size of this receipt, in PDF points
      return [cv];
    });
  }

  /* ------------------------------------------------ the PDF file: one full-page JPEG per page, written by hand (no library) */
  function jpegBytes(canvas) {
    var bin = atob(canvas.toDataURL('image/jpeg', 0.86).split(',')[1]), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function pdfFrom(list) {
    var enc = new TextEncoder(), chunks = [], pos = 0, offs = {};
    function push(u) { chunks.push(u); pos += u.length; }
    function str(s) { push(enc.encode(s)); }
    function begin(n) { offs[n] = pos; str(n + ' 0 obj\n'); }
    var n = list.length;
    push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    begin(1); str('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    var kids = []; for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    begin(2); str('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>\nendobj\n');
    list.forEach(function (p, i) {
      var page = 3 + i * 3, content = page + 1, img = page + 2, pw = p.pw.toFixed(2), ph = p.ph.toFixed(2), cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
      begin(page); str('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 ' + img + ' 0 R >> >> /Contents ' + content + ' 0 R >>\nendobj\n');
      begin(content); str('<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream\nendobj\n');
      begin(img); str('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>\nstream\n');
      push(p.bytes); str('\nendstream\nendobj\n');
    });
    var total = 3 + n * 3, xref = pos;
    str('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (var k = 1; k < total; k++) str(String(offs[k]).padStart(10, '0') + ' 00000 n \n');
    str('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }
  function toPdf(canvases, fileName) {
    var list = canvases.map(function (cv) { return { bytes: jpegBytes(cv), w: cv.width, h: cv.height, pw: cv._pt ? cv._pt[0] : 595.28, ph: cv._pt ? cv._pt[1] : 841.89 }; });
    var blob = pdfFrom(list), name = (String(fileName || 'document').replace(/[^A-Za-z0-9_-]/g, '') || 'document') + '.pdf', file = null;
    try { file = new File([blob], name, { type: 'application/pdf' }); } catch (e) { /* old browser: download only */ }
    return { blob: blob, name: name, file: file, pages: list.length };
  }
  /* size: 'a4' (default) | 'job' (A4 without prices) | '80' | '58'. photos: add the job card's photos on extra pages */
  function build(inv, size, o) {
    o = o || {};
    var job = size === '80' || size === '58' ? renderReceipt(inv, size === '58', o.noLogo) : render(inv, { noLogo: o.noLogo, photos: o.photos, noPrice: size === 'job' });
    return job.then(function (canvases) { var r = toPdf(canvases, inv.number || 'invoice'); r.size = size || 'a4'; return r; });
  }
  /* If the browser refuses to export the picture because of the logo, the PDF is made again without it. */
  function make(inv, size, o) { return build(inv, size, o).catch(function () { return build(inv, size, Object.assign({}, o, { noLogo: true })); }); }
  function download(r) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(r.blob); a.download = r.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function canShare(r) { try { return !!(r && r.file && navigator.canShare && navigator.canShare({ files: [r.file] })); } catch (e) { return false; } }
  /* the share menu with the real file (phones). text, when given, travels with the file (WhatsApp shows it as the caption) */
  function share(r, txt) {
    if (!canShare(r)) return Promise.resolve('unsupported');
    var data = { files: [r.file] };
    if (txt) { try { if (navigator.canShare({ files: [r.file], text: txt })) data.text = txt; } catch (e) { /* files only */ } }
    return navigator.share(data).then(function () { return 'shared'; }, function (e) { return e && e.name === 'AbortError' ? 'cancel' : 'unsupported'; });
  }

  window.Pdf = { make: make, download: download, share: share, canShare: canShare, render: render, renderReceipt: renderReceipt, toPdf: toPdf,
    kit: { W: W, H: H, MX: MX, MY: MY, CW: CW, PX: PX, BLUE: BLUE, DARK: DARK, LINE: LINE, SOFT: SOFT, text: text, wrap: wrap, wid: wid, para: para, rect: rect, hline: hline, strokeBox: strokeBox, rtlOf: rtlOf,
      kv: kv, box: box, noteBox: noteBox, gap: gap, header: header, fieldGrid: fieldGrid, checks: checks, photoBlocks: photoBlocks, loadImg: loadImg, fontsReady: fontsReady, paginate: paginate } };
})();
