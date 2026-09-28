try { playIntroAnimation(); } catch (e) {}

function PieChart(x, y, diameter) {
  // Position and size
  this.x = x;
  this.y = y;
  this.diameter = diameter;

  // Visual config
  this.strokeCol = color(180);
  this.strokeW = 1;
  this.legendPad = 18;
  this.legendBox = 12;
  this.titleGap = 18;
  this.hoverLift = 6;       // small lift for hovered slice
  this.animProgress = 1.0;  // 1 = fully drawn; set <1 if you want a sweep animation
  this._hoverIndex = -1;

  // Internals
  this._angles = [];
  this._total = 0;

  // Compute angles from data
  this._computeAngles = function(values) {
    // Clean numeric input and compute total
    const nums = values.map(v => {
      if (v === null || v === undefined) return 0;
      const t = String(v).replace(/,/g, '').trim();
      const n = Number(t);
      return isFinite(n) ? Math.max(0, n) : 0;
    });

    const total = nums.reduce((s, v) => s + v, 0);
    this._total = total;

    // Avoid division by zero
    if (total <= 0) {
      this._angles = nums.map(() => 0);
      return;
    }

    // Convert to angles; fix floating error by assigning remainder to last slice
    let sumAng = 0;
    const angs = [];
    for (let i = 0; i < nums.length; i++) {
      let ang;
      if (i < nums.length - 1) {
        ang = (nums[i] / total) * TWO_PI;
        sumAng += ang;
      } else {
        ang = TWO_PI - sumAng;
      }
      angs.push(ang);
    }
    this._angles = angs;
  };

  // Find which slice is hovered
  this._computeHover = function(cx, cy, r, startAngles) {
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist2 = dx * dx + dy * dy;
    const within = dist2 <= r * r;
    if (!within) return -1;

    let a = atan2(dy, dx);
    if (a < -HALF_PI) a += TWO_PI; // normalize so start at -PI/2 upwards
    // Convert to [0, TWO_PI) relative to -PI/2 start
    let rel = a + HALF_PI;
    if (rel < 0) rel += TWO_PI;

    for (let i = 0; i < startAngles.length - 1; i++) {
      if (rel >= startAngles[i] && rel < startAngles[i + 1]) return i;
    }
    return startAngles.length - 2;
  };

  // Draw legend at the right side
  this._drawLegend = function(labels, colours, cx, cy, r) {
    const startX = cx + r + 40;
    let y = cy - r + 10;
    textAlign(LEFT, CENTER);
    textSize(12);
    noStroke();
    for (let i = 0; i < labels.length; i++) {
      fill(colours[i]);
      rect(startX, y, this.legendBox, this.legendBox, 3);
      fill(255);
      text(labels[i], startX + this.legendBox + 8, y + this.legendBox / 2);
      y += this.legendPad;
    }
  };

  // Tooltip showing only clean percentage with one decimal (no category name)
  this._tooltip = function(cx, cy, r, labels, values, idx) {
    if (idx < 0) return;
    const v = values[idx];
    if (this._total <= 0) return;
    const pct = (Number(v) / this._total) * 100;
    // Round to 1 decimal and clamp 100 due to FP noise
    const pretty = nf(min(100, max(0, round(pct * 10) / 10)), 0, 1) + '%';

    // position tooltip near mouse
    const pad = 8;
    textSize(13);
    const tw = textWidth(pretty);
    const boxW = tw + pad * 2;
    const boxH = 26;

    const mx = mouseX, my = mouseY;
    const x = mx - boxW / 2;
    const y = my - boxH - 10;

    // outer
    noStroke();
    fill(255);
    rect(x, y, boxW, boxH, 6);
    // text
    fill(20);
    textAlign(CENTER, CENTER);
    text(pretty, x + boxW / 2, y + boxH / 2);
  };

  // Public draw API: data (numbers), labels (strings), colours (p5 color or CSS), title (string)
  this.draw = function(values, labels, colours, title) {
    push();

    // Compute geometry
    const cx = this.x;
    const cy = this.y;
    const r = this.diameter / 2;

    // Convert input and compute angles once
    this._computeAngles(values);

    // Build cumulative angle starts (start at -PI/2 so first slice points up)
    let start = -HALF_PI;
    const starts = [0];
    // We keep a separate array for hit testing: [0..2PI]
    let acc = 0;
    starts[0] = 0;
    for (let i = 0; i < this._angles.length; i++) {
      acc += this._angles[i];
      starts.push(acc);
    }

    // Which slice is hovered?
    this._hoverIndex = this._computeHover(cx, cy, r, starts);

    // Draw slices
    let current = start;
    for (let i = 0; i < this._angles.length; i++) {
      const ang = this._angles[i];
      if (ang <= 0) continue;

      // Slightly lift hovered slice
      const lift = (i === this._hoverIndex) ? this.hoverLift : 0;
      const mid = current + ang / 2;
      const ox = cos(mid) * lift;
      const oy = sin(mid) * lift;

      // Slice arc
      fill(colours[i] || color(map(i, 0, this._angles.length, 0, 255), 180, 220));
      stroke(this.strokeCol);
      strokeWeight(this.strokeW);
      arc(cx + ox, cy + oy, this.diameter, this.diameter, current, current + ang, PIE);

      current += ang;
    }

    // Title (shared helper if available)
    if (typeof drawTitle === 'function' && title) {
      drawTitle(title);
    } else if (title) {
      // Fallback simple title
      noStroke();
      fill(255);
      textAlign(CENTER, TOP);
      textSize(18);
      text(title, cx, cy - r - this.titleGap);
    }

    // Legend
    this._drawLegend(labels, colours, cx, cy, r);

    // Tooltip (only percentage; hide category text)
    this._tooltip(cx, cy, r, labels, values, this._hoverIndex);

    // NOTE: We intentionally DO NOT draw any center "100%" label.
    // This removes the unwanted number in the middle reported by the user.

    pop();
  };
}
