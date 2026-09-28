// pay-gap-1997-2017.
function PayGapTimeSeries() {
  this.name = 'Pay gap: 1997-2017';
  this.id = 'pay-gap-timeseries';
  this.loaded = false;

  // Data
  this._rows = [];
  this._minYear = null;
  this._maxYear = null;
  this._minGap = 0;  
  this._maxGap = null;

  // Animation / state
  this._t0 = null;     // animation start
  this._hoverIdx = -1; // nearest point index

  // Theme underlay
  this._drawUnderlay = false;
  this._underlay = { r: 0, g: 0, b: 0, a: 255 };

  // Preload 
  this.preload = function () {
    const self = this;
    this.data = loadTable(
      './data/pay-gap/all-employees-hourly-pay-by-gender-1997-2017.csv',
      'csv',
      'header',
      function () {
        try {
          const toNum = (raw) => {
            const s = String(raw == null ? '' : raw).replace(/[^\d.\-]/g, '');
            const v = parseFloat(s);
            return Number.isFinite(v) ? v : 0;
          };
          const cols = (self.data.columns || []).map(c => (c || '').trim().toLowerCase());
          const yearCol = cols.find(c => c === 'year') || self.data.columns[0];
          const gapCol = cols.find(c => c === 'pay_gap');
          const maleCol = cols.find(c => /median_male/i.test(c));
          const femCol  = cols.find(c => /median_female/i.test(c));

          const tmp = [];
          for (let r = 0; r < self.data.getRowCount(); r++) {
            const year = toNum(self.data.getString(r, yearCol));
            let gap = 0;
            if (gapCol) {
              gap = toNum(self.data.getString(r, gapCol));
            } else if (maleCol && femCol) {
              const m = toNum(self.data.getString(r, maleCol));
              const f = toNum(self.data.getString(r, femCol));
              gap = (m > 0) ? ((m - f) / m) * 100 : 0;
            }
            if (year) tmp.push({ year, gap });
          }
          // sort by year
          tmp.sort((a, b) => a.year - b.year);

          self._rows = tmp;
          self._minYear = tmp.length ? tmp[0].year : 1997;
          self._maxYear = tmp.length ? tmp[tmp.length - 1].year : 2017;

          const gaps = tmp.map(d => d.gap);
          self._maxGap = gaps.length ? Math.ceil(max(...gaps) / 5) * 5 : 30; // nice round ceiling

          self.loaded = true;
        } catch (e) {
          console.error('[PayGap] parse error:', e);
          self.loaded = false;
        }
      }
    );
  };

  // Setup 
  this.setup = function () {
    this._t0 = null;
    this._hoverIdx = -1;

    // Transparent canvas
    const c = select('canvas');
    if (c) c.elt.style.background = 'transparent';

    //  parent card is lighter than body
    try {
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const parent = c ? (c.elt.parentElement || document.body) : document.body;
      const parentBg = window.getComputedStyle(parent).backgroundColor;

      const parseRGB = (s) => {
        const m = s.match(/rgba?\(([^)]+)\)/i);
        if (!m) return { r: 0, g: 0, b: 0, a: 255 };
        const p = m[1].split(',').map(x => parseFloat(x.trim()));
        return { r: p[0]||0, g: p[1]||0, b: p[2]||0, a: (p[3]!==undefined? p[3]*255 : 255) };
      };
      const lum = (c) => 0.2126*c.r + 0.7152*c.g + 0.0722*c.b;

      const body = parseRGB(bodyBg);
      const card = parseRGB(parentBg);
      this._drawUnderlay = lum(card) - lum(body) > 20;
      this._underlay = body;
    } catch (_) {
      this._drawUnderlay = false;
    }
  };

  this.destroy = function () {};

  // Helpers 
  const clamp01 = (x) => max(0, min(1, x));
  const easeOutCubic = (x) => 1 - pow(1 - x, 3);

  // axis & layout
  this._layout = function () {
    const M = { top: 72, right: 40, bottom: 70, left: 70 };
    const W = width  - M.left - M.right;
    const H = height - M.top  - M.bottom;
    return { M, W, H };
  };

  this._x = function (year, L) {
    const t = (year - this._minYear) / max(1, (this._maxYear - this._minYear));
    return L.M.left + t * L.W;
  };

  this._y = function (gap, L) {
    const t = (gap - this._minGap) / max(1e-6, (this._maxGap - this._minGap));
    // top = smaller gap
    return L.M.top + (1 - t) * L.H;
  };

  // nearest point index by mouse x
  this._nearestIdx = function (L) {
    if (!this._rows.length) return -1;
    const xs = this._rows.map(r => this._x(r.year, L));
    let best = -1, bd = 1e9;
    for (let i = 0; i < xs.length; i++) {
      const d = abs(mouseX - xs[i]);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  // Draw 
  this.draw = function () {
    if (!this.loaded || !this._rows.length) return;

    if (this._t0 == null) this._t0 = millis();
    const t = (millis() - this._t0) / 1000.0;

    // Background
    if (this._drawUnderlay) {
      push(); noStroke();
      fill(this._underlay.r, this._underlay.g, this._underlay.b, this._underlay.a);
      rect(0, 0, width, height);
      pop();
    } else {
      clear();
    }

    const L = this._layout();
    const { M, W, H } = L;

    // Title
    push();
    noStroke();
    fill(235);
    textAlign(LEFT, BASELINE);
    textSize(16);
    text('Gender Pay Gap (%): 1997–2017', M.left, M.top - 28);
    fill(200);
    textSize(12);
    text('Difference between male and female median hourly pay (percentage).', M.left, M.top - 10);
    pop();

    // Grid & axes
    const xTicks = [];
    const span = this._maxYear - this._minYear;
    const step = span > 18 ? 2 : 1;
    for (let y = this._minYear; y <= this._maxYear; y += step) xTicks.push(y);

    const yTicks = [];
    for (let g = this._minGap; g <= this._maxGap + 0.001; g += 5) yTicks.push(g);

    // zero baseline
    push();
    stroke(255,255,255,80);
    strokeWeight(2);
    line(M.left, this._y(0, L), M.left + W, this._y(0, L));
    pop();

    // grid
    push();
    stroke(255,255,255,28);
    strokeWeight(1);
    for (const gy of yTicks) {
      const yy = this._y(gy, L);
      line(M.left, yy, M.left + W, yy);
    }
    pop();

    // axes lines
    push();
    stroke(220,220,220,120);
    strokeWeight(1.5);
    line(M.left, M.top, M.left, M.top + H);            // y-axis
    line(M.left, M.top + H, M.left + W, M.top + H);    // x-axis
    pop();

    // tick labels
    push();
    noStroke();
    fill(210);
    textSize(11);
    textAlign(CENTER, TOP);
    for (const yr of xTicks) text(yr, this._x(yr, L), M.top + H + 8);
    textAlign(RIGHT, CENTER);
    for (const gg of yTicks) text(nf(gg, 0, 0) + '%', M.left - 10, this._y(gg, L));
    pop();

    //  animation progress
    const k = easeOutCubic(clamp01(t / 1.0));
    const cutYear = this._minYear + (this._maxYear - this._minYear) * k;

    //  polyline up to cutYear
    const pts = [];
    for (let i = 0; i < this._rows.length; i++) {
      const r = this._rows[i];
      if (r.year <= cutYear) {
        pts.push({ x: this._x(r.year, L), y: this._y(r.gap, L), year: r.year, gap: r.gap });
      } else if (i > 0) {
        // interpolate last partial segment
        const prev = this._rows[i - 1];
        const a = (cutYear - prev.year) / max(1e-6, (r.year - prev.year));
        const x = this._x(cutYear, L);
        const y = lerp(this._y(prev.gap, L), this._y(r.gap, L), a);
        pts.push({ x, y, year: cutYear, gap: lerp(prev.gap, r.gap, a) });
        break;
      } else {
        break;
      }
    }
    if (pts.length < 2) return;

    // Area fill under line (sky-blue)
    push();
    noStroke();
    const baseY = this._y(0, L);
    fill(135, 206, 250, 90); // sky blue with alpha
    beginShape();
    for (let i = 0; i < pts.length; i++) vertex(pts[i].x, pts[i].y);
    // close down to baseline and back
    vertex(pts[pts.length - 1].x, baseY);
    vertex(pts[0].x, baseY);
    endShape(CLOSE);
    pop();

    // Draw the line
    push();
    noFill();
    stroke(100, 170, 255);
    strokeWeight(3);
    beginShape();
    for (let i = 0; i < pts.length; i++) vertex(pts[i].x, pts[i].y);
    endShape();
    pop();

    // small markers along the visible path
    push();
    noStroke();
    fill(100, 170, 255, 220);
    for (let i = 0; i < pts.length; i += 2) { // every other point to avoid clutter
      circle(pts[i].x, pts[i].y, 4);
    }
    pop();

    // Hover / focus
    const idx = this._nearestIdx(L);
    if (idx >= 0) {
      const px = this._x(this._rows[idx].year, L);
      if (px <= pts[pts.length - 1].x + 1) {
        this._hoverIdx = idx;
      } else {
        this._hoverIdx = -1;
      }
    } else {
      this._hoverIdx = -1;
    }

    // Draw focus marker + tooltip
    if (this._hoverIdx >= 0) {
      const r = this._rows[this._hoverIdx];
      const x = this._x(r.year, L);
      const y = this._y(r.gap, L);

      // vertical guide
      push();
      stroke(255, 255, 255, 70);
      strokeWeight(1);
      drawingContext.setLineDash([5, 6]);
      line(x, M.top - 6, x, M.top + H + 6);
      drawingContext.setLineDash([]);
      pop();

      // pulsing point
      const pulse = 4 + 2 * sin(millis() / 200.0);
      push();
      noStroke();
      fill(255);
      circle(x, y, pulse + 2);
      fill(70, 140, 255);
      circle(x, y, pulse);
      pop();

      // tooltip
      const txt = r.year + ' — ' + nf(r.gap, 0, 1) + '%';
      push();
      textSize(12);
      const pad = 8;
      const tw = textWidth(txt) + pad * 2;
      const th = 24;
      let tx = x + 14, ty = y - th - 12;
      if (tx + tw > width)  tx = width - tw - 6;
      if (ty < 6)           ty = y + 14;

      noStroke(); fill(0, 0, 0, 210); rect(tx, ty, tw, th, 6);
      noFill(); stroke(100, 170, 255); strokeWeight(1); rect(tx, ty, tw, th, 6);
      noStroke(); fill(255); textAlign(LEFT, CENTER); text(txt, tx + pad, ty + th / 2);
      pop();
    }

    // Axis labels
    push();
    noStroke();
    fill(220);
    textSize(12);
    textAlign(CENTER, TOP);
    text('Year', M.left + W / 2, M.top + H + 34);
    push();
    translate(M.left - 40, M.top + H / 2);
    rotate(-HALF_PI);
    text('Pay gap (%)', 0, 0);
    pop();
    pop();
  };
}

