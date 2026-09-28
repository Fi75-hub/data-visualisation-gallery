// tech-diversity-race.js
function TechDiversityRace() {
  this.name = 'Tech Diversity: Race ';
  this.id = 'tech-diversity-race';
  this.loaded = false;

  // Parsed data
  this._categoryCol = null; 
  this._labelCol = null;      
  this._categories = [];      
  this._display = [];         
  this._companyCols = [];     
  this._selected = null;      

  // UI + state
  this.select = null;
  this._t0 = null;
  this._hover = -1;

  // white cards 
  this._drawUnderlay = false;
  this._underlay = { r: 0, g: 0, b: 0, a: 255 };


  this.preload = function () {
    const self = this;
    this.data = loadTable('./data/tech-diversity/race-2018.csv', 'csv', 'header', function () {
      try {
        const headers = self.data.columns || [];
        if (headers.length < 2) throw new Error('CSV must have categories + at least one data column.');

        self._categoryCol = headers[0];

        // Optional display/label column if present
        const labelCandidates = ['Label', 'label', 'Display', 'display', 'Name', 'name'];
        self._labelCol = labelCandidates.find(c => headers.includes(c)) || null;

        // Value columns = everything except category + optional label col
        self._companyCols = headers.filter(h => h !== self._categoryCol && h !== self._labelCol);
        self._selected = self._companyCols[0];

        // Raw categories
        self._categories = self.data.getColumn(self._categoryCol).map(s => (s || '').trim());

        // Display labels
        const fromLabelCol = self._labelCol
          ? self.data.getColumn(self._labelCol).map(s => (s || '').trim())
          : null;
        self._display = self._buildDisplayLabels(self._categories, fromLabelCol);

        self.loaded = true;
        console.log('[Race Pie] CSV loaded:', headers.join(' | '));
      } catch (e) {
        console.error('[Race Pie] Parse error:', e);
        self.loaded = false;
      }
    });
  };

  // === FUNCTION ===
  this._buildDisplayLabels = function (rawCats, labelCol) {
    const out = [];
    for (let i = 0; i < rawCats.length; i++) {
      const lbl0 = labelCol ? (labelCol[i] || '').trim() : '';
      const lbl = (lbl0 || (rawCats[i] || '')).trim(); // prefer label column
      out.push(lbl);
    }
    return out;
  };

  // Setup / UI 
  this.setup = function () {
    this._t0 = null;

    const c = select('canvas');
    if (c) c.elt.style.background = 'transparent';

    // Underlay detection 
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

    // Company dropdown
    if (this.loaded && !this.select) {
      this.select = createSelect();
      for (const col of this._companyCols) this.select.option(col, col);
      this.select.value(this._selected);
      // Style
      this.select.style('padding', '6px 10px');
      this.select.style('border-radius', '10px');
      this.select.style('border', '1px solid rgba(255,255,255,0.2)');
      this.select.style('background', 'rgba(0,0,0,0.35)');
      this.select.style('color', '#fff');
      this.select.style('backdrop-filter', 'blur(6px)');
      this.select.changed(() => { this._selected = this.select.value(); this._t0 = null; });

      const place = () => {
        const cnv = select('canvas'); if (!cnv) return;
        const r = cnv.elt.getBoundingClientRect();
        this.select.position(window.pageXOffset + r.left + r.width - 200,
                             window.pageYOffset + r.top + 16);
      };
      this._placeDropdown = place;
      place();
    }
  };

  this.windowResized = function () {
    if (this._placeDropdown) this._placeDropdown();
  };

  this.destroy = function () {
    if (this.select && this.select.remove) this.select.remove();
    this.select = null;
  };

  // Helpers
  const clamp01 = (x) => max(0, min(1, x));
  const easeOutCubic = (x) => 1 - pow(1 - x, 3);
  const toNumber = (raw) => {
    const s = String(raw == null ? '' : raw).replace(/[^\d.\-]/g, '');
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : 0;
  };

  this._valuesForSelected = function () {
    const vals = [];
    if (!this.loaded || !this._selected) return vals;
    for (let r = 0; r < this.data.getRowCount(); r++) {
      vals.push(toNumber(this.data.getString(r, this._selected)));
    }
    return vals;
  };

  // Colors
  this._colorFor = function (i, n) {
    const fixed = [
      [210, 75, 85],  // blue
      [20,  85, 95],  // orange
      [140, 55, 85],  // green
      [340, 70, 85],  // pink/red
      [50,  85, 90],  // yellow
      [280, 60, 85],  // purple
      [0,   70, 80],  // red
      [170, 60, 80],  // teal
      [300, 55, 85],  // magenta
      [90,  60, 85],  // lime
      [30,  70, 85],  // amber
      [200, 55, 80],  // steel
    ];
    let h, s, b;
    if (n <= fixed.length) {
      [h, s, b] = fixed[i % fixed.length];
    } else {
      h = (i * 137.508) % 360; s = 65; b = 88;
    }
    push(); colorMode(HSB, 360, 100, 100, 1);
    const c = color(h, s, b, 0.95);
    pop(); return c;
  };

  // Draw function
  this.draw = function () {
    if (!this.loaded) return;

    if (this._t0 == null) this._t0 = millis();
    const t = (millis() - this._t0) / 1000.0;

    // Transparent canvas
    if (this._drawUnderlay) {
      push(); noStroke();
      fill(this._underlay.r, this._underlay.g, this._underlay.b, this._underlay.a);
      rect(0, 0, width, height);
      pop();
    } else {
      clear();
    }

    // Layout
    const M = { top: 64, right: 260, bottom: 48, left: 56 }; // legend 
    const cx = (M.left + (width - M.right)) / 2;
    const cy = (M.top + (height - M.bottom)) / 2;
    const outerR = min(width - M.left - M.right, height - M.top - M.bottom) * 0.47;
    const innerR = outerR * 0.58;

    const cats = this._categories;
    const labels = this._display;       // labels (now actual CSV text)
    const vals = this._valuesForSelected();
    const n = cats.length;

    // Normalize
    const total = max(1e-6, vals.reduce((a, b) => a + b, 0));
    const sweep = easeOutCubic(clamp01(t / 0.9));

    // Title
    push(); noStroke(); fill(235); textAlign(LEFT, BASELINE); textSize(14);
    text(this._selected, M.left, M.top - 24); pop();

    // Precompute mouse polar
    const mx = mouseX - cx, my = mouseY - cy;
    const md = sqrt(mx*mx + my*my);
    let mAng = atan2(my, mx);
    while (mAng < -HALF_PI) mAng += TWO_PI;
    while (mAng > -HALF_PI + TWO_PI) mAng -= TWO_PI;

    // Draw slices
    let startAng = -HALF_PI;
    let hover = -1;

    for (let i = 0; i < n; i++) {
      const frac = vals[i] / total;
      const fullSpan = TWO_PI * frac;
      const span = fullSpan * sweep;
      const endAng = startAng + span;

      // Hover detection
      const isInRing = md >= innerR && md <= outerR + 12;
      const isInAngle = (mAng >= startAng && mAng <= endAng);
      const isHover = isInRing && isInAngle && frac > 1e-4 && sweep > 0.99;
      if (isHover) hover = i;

      const mid = (startAng + endAng) / 2;
      const offset = isHover ? 10 : 0;
      const ox = cos(mid) * offset, oy = sin(mid) * offset;

      // Slice
      const fillCol = this._colorFor(i, n);
      push();
      translate(cx + ox, cy + oy);
      noStroke(); fill(fillCol);
      arc(0, 0, outerR*2, outerR*2, startAng, endAng, PIE);
      // donut hole
      fill(0, 0, 0, 0);
      erase(); circle(0, 0, innerR*2); noErase();
      pop();

      startAng += span;
    }

    // Center readout
    push(); noStroke(); textAlign(CENTER, CENTER);
    if (hover >= 0) {
      const pct = (vals[hover] / total) * 100;
      fill(240); textSize(16); text(labels[hover], cx, cy - 10);
      textSize(22); text(nf(pct, 0, 1) + '%', cx, cy + 16);
    } else {
      fill(200); textSize(13); text('Distribution', cx, cy - 8);
      fill(240); textSize(18); text(this._selected, cx, cy + 14);
    }
    pop();

    // Legend 
    const legendX = width - M.right + 28;
    let legendY = M.top;
    const lineH = 22;

    for (let i = 0; i < n; i++) {
      const pct = total === 0 ? 0 : (vals[i] / total) * 100;
      const swatch = this._colorFor(i, n);

      push();
      noStroke();
      fill(swatch);
      rect(legendX, legendY + 6, 14, 14, 3);

      fill(i === hover ? 255 : 230);
      textAlign(LEFT, CENTER);
      textSize(12);
      text(labels[i] + ' — ' + nf(pct, 0, 1) + '%', legendX + 22, legendY + 13);
      pop();

      legendY += lineH;
    }

    // Tooltip
    if (hover >= 0) {
      const pct = (vals[hover] / total) * 100;
      const txt = labels[hover] + ': ' + nf(pct, 0, 1) + '%';

      push(); textSize(12);
      const pad = 8;
      const tw = textWidth(txt) + pad * 2;
      const th = 24;
      let tx = mouseX + 14, ty = mouseY + 14;
      if (tx + tw > width)  tx = width - tw - 6;
      if (ty + th > height) ty = height - th - 6;

      noStroke(); fill(0, 0, 0, 210); rect(tx, ty, tw, th, 6);
      const borderCol = this._colorFor(hover, n);
      noFill(); stroke(borderCol); strokeWeight(1); rect(tx, ty, tw, th, 6);
      noStroke(); fill(255); textAlign(LEFT, CENTER); text(txt, tx + pad, ty + th / 2);
      pop();
    }

    this._hover = hover;
  };
}







