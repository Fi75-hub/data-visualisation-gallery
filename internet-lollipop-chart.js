// internet-lollipop-chart
function InternetLollipopChart() {
  this.name = 'Internet Users by Country';
  this.id = 'internet-lollipop-chart';
  this.loaded = false;

  // Data/state
  this._rows = [];   
  this._sort = 'Value ↓'; 
  this.select = null;
  this._t0 = null;
  this._hover = -1;

  // white cards 
  this._drawUnderlay = false;
  this._underlay = { r: 0, g: 0, b: 0, a: 255 };

  // Data 
  this.preload = function () {
    const self = this;
    this.data = loadTable('./data/lollipop-data.csv', 'csv', 'header', function () {
      try {
        // Accept various header casings
        const cols = (self.data.columns || []).map(c => (c || '').trim());
        const countryCol = cols.find(c => /country/i.test(c)) || cols[0];
        const valueCol   = cols.find(c => /internet|value|percent/i.test(c)) || cols[1];

        const toNum = (raw) => {
          const s = String(raw == null ? '' : raw).replace(/[^\d.\-]/g, '');
          const v = parseFloat(s);
          return Number.isFinite(v) ? v : 0;
        };

        const rows = [];
        for (let r = 0; r < self.data.getRowCount(); r++) {
          const country = (self.data.getString(r, countryCol) || '').trim();
          const value = toNum(self.data.getString(r, valueCol));
          if (country) rows.push({ country, value });
        }
        self._rows = rows;
        self.loaded = true;
        console.log('[Lollipop] CSV loaded:', rows.length, 'rows');
      } catch (e) {
        console.error('[Lollipop] Parse error:', e);
        self.loaded = false;
      }
    });
  };

  // Setup / UI 
  this.setup = function () {
    this._t0 = null;
    this._hover = -1;

    // Transparent canvas
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

    if (this.loaded && !this.select) {
      this.select = createSelect();
      ['Value ↓', 'Value ↑', 'A → Z'].forEach(opt => this.select.option(opt, opt));
      this.select.value(this._sort);
      // style
      this.select.style('padding', '6px 10px');
      this.select.style('border-radius', '10px');
      this.select.style('border', '1px solid rgba(255,255,255,0.2)');
      this.select.style('background', 'rgba(0,0,0,0.35)');
      this.select.style('color', '#fff');
      this.select.style('backdrop-filter', 'blur(6px)');
      this.select.changed(() => { this._sort = this.select.value(); this._t0 = null; });

      const place = () => {
        const cnv = select('canvas'); if (!cnv) return;
        const r = cnv.elt.getBoundingClientRect();
        this.select.position(window.pageXOffset + r.left + r.width - 160,
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
  const easeOutBack = (x) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * pow(x - 1, 3) + c1 * pow(x - 1, 2);
  };

  this._sortedRows = function () {
    const rows = this._rows.slice();
    if (this._sort === 'Value ↓') rows.sort((a,b)=> b.value - a.value);
    else if (this._sort === 'Value ↑') rows.sort((a,b)=> a.value - b.value);
    else rows.sort((a,b)=> a.country.localeCompare(b.country));
    return rows;
  };

  // Draw 
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
    const M = { top: 70, right: 40, bottom: 90, left: 80 };
    const W = width  - M.left - M.right;
    const H = height - M.top  - M.bottom;

    const rows = this._sortedRows();
    const n = rows.length || 1;
    const lane = H / n;

    // Scales
    const maxVal = max(100, ...rows.map(r => r.value));
    const xScale = (v) => M.left + (W * v) / maxVal;

    // Animation progress
    const k = easeOutCubic(clamp01(t / 0.9));

    // Colors
    const gridCol  = color(200,200,200,60);
    const tickCol  = color(200,200,200,180);
    const textCol  = color(235);
    const lineCol  = color(120,170,255,160);
    const dotCol   = color(70,140,255);
    const avgCol   = color(255,255,255,60);

    // Title
    push(); noStroke(); fill(textCol); textAlign(LEFT, BASELINE); textSize(14);
    text(this.name + ' — ' + this._sort, M.left, M.top - 28); pop();

    // X grid/ticks
    const ticks = [0, 20, 40, 60, 80, 100];
    push(); stroke(gridCol); strokeWeight(1);
    for (const tk of ticks) {
      const x = xScale(tk);
      line(x, M.top, x, M.top + H);
    }
    pop();

    // X labels
    push(); noStroke(); fill(tickCol); textAlign(CENTER, TOP); textSize(11);
    for (const tk of ticks) {
      const x = xScale(tk);
      text(tk + '%', x, M.top + H + 8);
    }
    pop();

    // Average line
    const avg = rows.reduce((a,b)=>a+b.value,0) / rows.length;
    const avgX = xScale(avg * k); // animate with k
    push();
    stroke(avgCol); strokeWeight(2); drawingContext.setLineDash([6,6]);
    line(avgX, M.top - 6, avgX, M.top + H + 6);
    drawingContext.setLineDash([]); // reset
    noStroke(); fill(tickCol); textAlign(CENTER, BOTTOM); textSize(11);
    text('Avg ' + nf(avg,0,1) + '%', avgX, M.top - 8);
    pop();

    // Lollipops
    this._hover = -1;
    for (let i = 0; i < n; i++) {
      const y = M.top + i * lane + lane/2;
      const targetX = xScale(rows[i].value);
      const x = M.left + (targetX - M.left) * k; // animated

      // stem
      push();
      stroke(lineCol); strokeWeight(3);
      line(M.left, y, x, y);
      pop();

      // dot 
      const local = clamp01((t - i*0.04)/0.9);
      const popk = easeOutBack(local);
      const r = 6 * (0.75 + 0.25*popk);

      push();
      noStroke(); fill(dotCol);
      circle(x, y, r*2);
      pop();

      // labels
      push();
      noStroke(); fill(textCol); textSize(12);
      textAlign(RIGHT, CENTER);
      text(rows[i].country, M.left - 10, y);
      textAlign(LEFT, CENTER);
      text(nf(rows[i].value, 0, 0) + '%', x + 10, y);
      pop();

      // hover hit test
      if (dist(mouseX, mouseY, x, y) <= 10) this._hover = i;
    }

    // Tooltip
    if (this._hover >= 0) {
      const r = rows[this._hover];
      const txt = r.country + ': ' + nf(r.value,0,1) + '%';
      push();
      textSize(12);
      const pad = 8;
      const tw = textWidth(txt) + pad * 2;
      const th = 24;
      let tx = mouseX + 14, ty = mouseY + 14;
      if (tx + tw > width)  tx = width - tw - 6;
      if (ty + th > height) ty = height - th - 6;

      noStroke(); fill(0,0,0,210); rect(tx, ty, tw, th, 6);
      noFill(); stroke(dotCol); strokeWeight(1); rect(tx, ty, tw, th, 6);
      noStroke(); fill(255); textAlign(LEFT, CENTER); text(txt, tx + pad, ty + th/2);
      pop();
    }
  };
}


