// student-skill-radar
function StudentSkillRadarChart() {
  this.name = 'Student Skill Radar';
  this.id = 'student-skill-radar';
  this.loaded = false;

  // Data/state
  this._labels = [];
  this._levels = [];
  this._maxLevel = 5;

  // Geometry cache
  this._cx = 0; this._cy = 0; this._r = 0;
  this._points = [];
  this._labelPos = [];

  // Timeline
  this._t0 = null;
  this._pulse = 0;

  // Underlay
  this._drawUnderlay = false;
  this._underlay = { r: 0, g: 0, b: 0, a: 255 };

  // Preload
  this.preload = function () {
    const self = this;
    this.data = loadTable('./data/student-skills.csv', 'csv', 'header', function () {
      try {
        const skills = [];
        const vals = [];
        for (let r = 0; r < self.data.getRowCount(); r++) {
          const s = (self.data.getString(r, 'Skill') || '').trim();
          const v = Number(self.data.getString(r, 'Level'));
          if (s && Number.isFinite(v)) { skills.push(s); vals.push(v); }
        }
        if (!skills.length) throw new Error('student-skills.csv has no valid rows.');
        self._labels = skills;
        self._levels = vals;
        self._maxLevel = Math.max(1, ...vals);
        self.loaded = true;
        console.log('[Radar] Data loaded.');
      } catch (e) {
        console.error('[Radar] Parse error:', e);
        self.loaded = false;
      }
    });
  };

  this.setup = function () {
    this._t0 = null;
    this._pulse = 0;

    // fill.
    const c = select('canvas');
    if (c) c.elt.style.background = 'transparent';

    // Auto-underlay
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
      const luminance = (c) => 0.2126*c.r + 0.7152*c.g + 0.0722*c.b;

      const body = parseRGB(bodyBg);
      const card = parseRGB(parentBg);

      const bodyDark = luminance(body) < 140;              
      const cardMuchLighter = luminance(card) - luminance(body) > 20; 
      this._drawUnderlay = bodyDark || cardMuchLighter;
      this._underlay = body;
    } catch (_) {
      this._drawUnderlay = false;
    }
  };

  this.destroy = function () {
    this._points = [];
    this._labelPos = [];
  };
  const clamp01 = (x) => max(0, min(1, x));
  const easeOutCubic = (x) => 1 - pow(1 - x, 3);
  const easeOutBack = (x) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * pow(x - 1, 3) + c1 * pow(x - 1, 2);
  };
  const easeOutElastic = (x) => {
    if (x === 0 || x === 1) return x;
    const c4 = (2 * PI) / 3;
    return pow(2, -10 * x) * sin((x * 10 - 0.75) * c4) + 1;
  };
  this._recompute = function (polyKs = 1, labelK = 1) {
    const n = this._labels.length;
    if (!n) return;

    const cx = width * 0.5;
    const cy = height * 0.5;
    const r  = min(width, height) * 0.33 * (1 + 0.06 * this._pulse);

    this._cx = cx; this._cy = cy; this._r = r;
    this._points.length = 0;
    this._labelPos.length = 0;

    for (let i = 0; i < n; i++) {
      const ang = (TWO_PI / n) * i - HALF_PI;
      const k = Array.isArray(polyKs) ? polyKs[i] : polyKs;
      const radius = r * (this._levels[i] / this._maxLevel) * k;
      const x = cx + cos(ang) * radius;
      const y = cy + sin(ang) * radius;
      this._points.push({ x, y, ang });

      const lx = cx + cos(ang) * (r + 28) * labelK;
      const ly = cy + sin(ang) * (r + 28) * labelK;
      this._labelPos.push({ x: lx, y: ly });
    }
  };

  this._hitVertex = function (mx, my) {
    const tol = 12;
    for (let i = 0; i < this._points.length; i++) {
      const p = this._points[i];
      if (dist(mx, my, p.x, p.y) <= tol) return i;
    }
    return -1;
  };

  // Draw
  this.draw = function () {
    if (!this.loaded) return;

    if (this._t0 == null) this._t0 = millis();
    const t = (millis() - this._t0) / 1000.0;
    if (this._drawUnderlay) {
      push();
      noStroke();
      fill(this._underlay.r, this._underlay.g, this._underlay.b, this._underlay.a);
      rect(0, 0, width, height);
      pop();
    } else {
      clear();
    }

    // Timeline
    const ringAlpha   = clamp01((t - 0.00) / 0.35);
    const labelK      = easeOutCubic(clamp01((t - 0.80) / 0.50));
    const labelAlpha  = clamp01((t - 0.85) / 0.45);

    // Per-vertex elastic growth 
    const n = this._labels.length;
    const polyKs = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const start = 0.20 + i * 0.035;
      const local = clamp01((t - start) / 0.75);
      polyKs[i] = easeOutElastic(local);
    }

    // Decay click pulse
    this._pulse = max(0, this._pulse - (deltaTime / 1000) * 2.2);

    // Layout
    this._recompute(polyKs, labelK);

    // Palette 
    const gridCol    = color(200, 200, 200, 200 * ringAlpha);
    const axisCol    = color(200, 200, 200, 220 * ringAlpha);
    const polyFill   = color(60, 140, 255, 60);
    const polyStroke = color(60, 140, 255, 255);
    const labelCol   = color(230, 230, 230, 255 * labelAlpha);
    const tickCol    = color(180, 180, 180, 220 * ringAlpha);

    const RING_COUNT = 5; //  single definition

    // GRID
    push();
    stroke(gridCol);
    noFill();
    strokeWeight(1);
    for (let i = 1; i <= RING_COUNT; i++) {
      const rr = (this._r * i) / RING_COUNT;
      ellipse(this._cx, this._cy, rr * 2, rr * 2);
    }
    // spokes
    stroke(axisCol);
    for (let i = 0; i < n; i++) {
      const a = (TWO_PI / n) * i - HALF_PI;
      const x = this._cx + cos(a) * this._r;
      const y = this._cy + sin(a) * this._r;
      line(this._cx, this._cy, x, y);
    }
    pop();

    // POLYGON
    if (this._points.length >= 3) {
      push();
      noStroke();
      fill(polyFill);
      beginShape();
      for (let i = 0; i < n; i++) vertex(this._points[i].x, this._points[i].y);
      endShape(CLOSE);
      pop();

      push();
      noFill();
      stroke(polyStroke);
      strokeWeight(2);
      beginShape();
      for (let i = 0; i < n; i++) vertex(this._points[i].x, this._points[i].y);
      endShape(CLOSE);
      pop();
    }

    // AXIS TICK VALUES
    push();
    fill(tickCol);
    noStroke();
    textAlign(CENTER, BOTTOM);
    textSize(11);
    for (let i = 1; i <= RING_COUNT; i++) {
      const val = (this._maxLevel * i) / RING_COUNT;
      const rr = (this._r * i) / RING_COUNT;
      text(nf(val, 0, (val % 1 ? 1 : 0)), this._cx, this._cy - rr - 3);
    }
    pop();

    // LABELS
    push();
    noStroke();
    fill(labelCol);
    textAlign(CENTER, CENTER);
    textSize(12);
    for (let i = 0; i < n; i++) {
      const lp = this._labelPos[i];
      text(this._labels[i], lp.x, lp.y);
    }
    pop();

    // INTERACTION
    const hoverIdx = this._hitVertex(mouseX, mouseY);

    // Vertices with staggered pop
    for (let i = 0; i < n; i++) {
      const p = this._points[i];
      const local = clamp01((t - 0.55 - i * 0.045) / 0.35);
      const k = easeOutBack(local);
      const baseSize = (i === hoverIdx ? 8 : 6);
      const sz = baseSize * (0.7 + 0.6 * k);

      push();
      noStroke();
      fill(i === hoverIdx ? polyStroke : color(red(polyStroke), green(polyStroke), blue(polyStroke), 220));
      circle(p.x, p.y, sz);
      pop();
    }

    // Hover tooltip 
    if (hoverIdx >= 0) {
      const p = this._points[hoverIdx];
      push();
      stroke(polyStroke);
      strokeWeight(1);
      line(this._cx, this._cy, p.x, p.y);
      pop();

      const label = this._labels[hoverIdx];
      const val = this._levels[hoverIdx];
      const txt = label + ': ' + val;

      push();
      textSize(12);
      const pad = 8;
      const tw = textWidth(txt) + pad * 2;
      const th = 24;

      let tx = mouseX + 14;
      let ty = mouseY + 14;
      if (tx + tw > width)  tx = width - tw - 6;
      if (ty + th > height) ty = height - th - 6;

      noStroke();
      fill(0, 0, 0, 210);
      rect(tx, ty, tw, th, 6);

      noFill();
      stroke(polyStroke);
      strokeWeight(1);
      rect(tx, ty, tw, th, 6);

      noStroke();
      fill(255);
      textAlign(LEFT, CENTER);
      text(txt, tx + pad, ty + th / 2);
      pop();
    }
  };

  // Subtle pulse on click
  this.mousePressed = function () {
    const d = dist(mouseX, mouseY, this._cx || 0, this._cy || 0);
    if (d <= (this._r || 0) + 24) this._pulse = 1;
  };
}



