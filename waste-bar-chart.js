// waste-bar-chart
function WasteBarChart() {
  this.name = 'Total Waste Per Category Of Pakistan';
  this.id   = 'waste-bar-chart';
  this.loaded = false;

  // Data structures
  this._rows = []; 
  this._sumTotal = 0;

  // UI state
  this._sort = 'Total ↓';
  this._showPercent = false;
  this.select = null;
  this.toggle = null;

  // Animation
  this._t0 = null;

  // Theme underlay guard
  this._drawUnderlay = false;
  this._underlay = { r:0,g:0,b:0,a:255 };

  // Data 
  this.preload = function() {
    var self = this;
    this.data = loadTable('./data/waste-data.csv', 'csv', 'header', function(tbl) {
      try{
        self._parseTable(tbl);
        self.loaded = true;
      }catch(e){
        console.error('[waste-bar] parse error', e);
        self.loaded = false;
      }
    }, function() {
      console.error('[waste-bar] failed to load CSV');
    });
  };

  this._parseTable = function(tbl) {
    var cols = (tbl.columns || []).map(function(c){ return (c||'').trim(); });
    if (!cols.length) throw new Error('No headers');

    // Pick a label column
    var labelCol = null;
    var labelHints = [/description/i, /(group.*name)/i, /category/i, /type/i, /waste/i, /material/i, /^name$/i];
    for (var i=0;i<labelHints.length;i++) {
      var re = labelHints[i];
      for (var j=0;j<cols.length;j++) if (re.test(cols[j])) { labelCol = cols[j]; break; }
      if (labelCol) break;
    }
    if (!labelCol) labelCol = cols[0];

    // Numeric columns = everything else
    var numCols = cols.filter(function(c){ return c !== labelCol; });

    function toNum(raw) {
      var s = String(raw==null?'':raw).replace(/[^0-9.\-]/g,'');
      var v = parseFloat(s);
      return isFinite(v) ? v : NaN;
    }

    var out = [];
    var sumTotal = 0;
    for (var r=0; r<tbl.getRowCount(); r++) {
      var label = String(tbl.getString(r, labelCol) || '').trim();
      if (!label) continue;
      var parts = [];
      var total = 0;
      for (var c=0;c<numCols.length;c++) {
        var val = toNum(tbl.getString(r, numCols[c]));
        if (!isNaN(val)) { parts.push({ col: numCols[c], value: val }); total += val; }
      }
      if (total>0) {
        out.push({ label: label, total: total, parts: parts });
        sumTotal += total;
      }
    }
    if (!out.length) throw new Error('No numeric rows');

    // default sort by total descending
    out.sort(function(a,b){ return b.total - a.total; });

    this._rows = out;
    this._sumTotal = sumTotal;
  };

  //Setup 
  this.setup = function() {
    if (this.select && this.select.remove) { this.select.remove(); this.select=null; }
    if (this.toggle && this.toggle.remove) { this.toggle.remove(); this.toggle=null; }
    this._t0 = null;

    var c = select('canvas');
    if (c) c.elt.style.background = 'transparent';

    // Underlay detection
    try{
      var bodyBg = window.getComputedStyle(document.body).backgroundColor;
      var parent = c ? (c.elt.parentElement || document.body) : document.body;
      var parentBg = window.getComputedStyle(parent).backgroundColor;
      var parseRGB = function(s){
        var m = s.match(/rgba?\(([^)]+)\)/i);
        if (!m) return {r:0,g:0,b:0,a:255};
        var p = m[1].split(',').map(function(x){ return parseFloat(x.trim()); });
        return { r: p[0]||0, g: p[1]||0, b: p[2]||0, a: p[3]!==undefined? p[3]*255 : 255 };
      };
      var lum = function(c){ return 0.2126*c.r + 0.7152*c.g + 0.0722*c.b; };
      var body = parseRGB(bodyBg);
      var card = parseRGB(parentBg);
      this._drawUnderlay = lum(card) - lum(body) > 20;
      this._underlay = body;
    }catch(e){ this._drawUnderlay = false; }

    if (this.loaded) {
      // Sorting dropdown
      this.select = createSelect();
      ['Total ↓','Total ↑','A→Z'].forEach(function(opt){ this.select.option(opt,opt); }, this);
      this.select.value(this._sort);
      this._styleCtl(this.select);
      this.select.changed(function(){
        this._sort = this.select.value();
        this._applySort(); this._t0 = null;
      }.bind(this));

      // Value/percent toggle
      this.toggle = createButton(this._showPercent ? 'Show values' : 'Show %');
      this._styleCtl(this.toggle,true);
      this.toggle.mousePressed(function(){
        this._showPercent = !this._showPercent;
        this.toggle.html(this._showPercent ? 'Show values' : 'Show %');
        this._t0 = null;
      }.bind(this));

      var place = function(){
        var cnv = select('canvas'); if (!cnv) return;
        var r = cnv.elt.getBoundingClientRect();
        var x = window.pageXOffset + r.left + r.width - 240;
        var y = window.pageYOffset + r.top + 16;
        this.select.position(x, y);
        this.toggle.position(x, y + 42);
      }.bind(this);
      this._placeCtrls = place; place();
    }
  };

  this._styleCtl = function(elt, tight){
    elt.style('padding', tight?'6px 10px':'6px');
    elt.style('border-radius','10px');
    elt.style('border','1px solid rgba(255,255,255,0.2)');
    elt.style('background','rgba(0,0,0,0.35)');
    elt.style('color','#fff');
    elt.style('backdrop-filter','blur(6px)');
  };

  this.windowResized = function(){ if (this._placeCtrls) this._placeCtrls(); };
  this.destroy = function(){
    if (this.select && this.select.remove) this.select.remove();
    if (this.toggle && this.toggle.remove) this.toggle.remove();
    this.select=this.toggle=null;
  };

  // Sorting application
  this._applySort = function(){
    if (!this._rows.length) return;
    if (this._sort === 'Total ↓') this._rows.sort(function(a,b){ return b.total - a.total; });
    else if (this._sort === 'Total ↑') this._rows.sort(function(a,b){ return a.total - b.total; });
    else this._rows.sort(function(a,b){ return a.label.localeCompare(b.label); });
  };

  //Draw 
  this.draw = function(){
    if (!this.loaded || !this._rows.length) {
      // keep theme underlay
      if (this._drawUnderlay) { push(); noStroke(); fill(this._underlay.r,this._underlay.g,this._underlay.b,this._underlay.a); rect(0,0,width,height); pop(); }
      else { clear(); }
      push(); noStroke(); fill(230); textAlign(CENTER,CENTER); textSize(14);
      text(this._dataError || 'Loading…', width/2, height/2); pop();
      return;
    }

    if (this._t0 == null) this._t0 = millis();
    var k = constrain((millis()-this._t0)/900, 0, 1);
    k = 1 - pow(1 - k, 3); // easeOutCubic

    // background
    if (this._drawUnderlay) { push(); noStroke(); fill(this._underlay.r,this._underlay.g,this._underlay.b,this._underlay.a); rect(0,0,width,height); pop(); }
    else { clear(); }

    var M = { top: 100, right: 40, bottom: 80, left: 180 };
    var W = width  - M.left - M.right;
    var H = height - M.top  - M.bottom;

    // Title
    push();
    noStroke(); fill(235); textAlign(LEFT,BASELINE); textSize(16);
    text('Total Waste Per Category — Pakistan', M.left, M.top - 28);
    fill(200); textSize(12);
    text(this._showPercent ? 'Showing share of total waste (%)' : 'Showing totals (units from CSV)', M.left, M.top - 10);
    pop();

    var rows = this._rows.slice();
    var n = rows.length;
    var lane = H / n;

    // compute max for scaling
    var maxVal = 0;
    if (this._showPercent) { maxVal = 100; }
    else {
      for (var i=0;i<n;i++) if (rows[i].total > maxVal) maxVal = rows[i].total;
    }
    var x = function(v){ return M.left + (W * v) / (maxVal || 1); };

    // adaptive ticks/labels 
    var step = this._adaptiveStep(maxVal, W, this._showPercent);
    var minLabelGap = 42; // px
    // grid
    push(); stroke(220,220,220,40); strokeWeight(1);
    for (var g=0; g<=maxVal+0.001; g+=step) {
      var gx = x(g);
      line(gx, M.top, gx, M.top + H);
    }
    pop();
    // axis
    push(); stroke(220,220,220,160); strokeWeight(1.5);
    line(M.left, M.top + H, M.left + W, M.top + H); pop();
    // labels with culling guard
    push(); noStroke(); fill(220,220,220,160); textSize(11); textAlign(CENTER,TOP);
    var lastX = -1e9;
    for (var g2=0; g2<=maxVal+0.001; g2+=step) {
      var tx = x(g2);
      if (tx - lastX >= minLabelGap) {
        text(nf(g2,0,0), tx, M.top + H + 8);
        lastX = tx;
      }
    }
    pop();

    // colors palette distinct
    var palette = [
      color(72,125,245), color(255,130,170), color(120,210,120), color(255,185,90),
      color(178,140,255), color(95,205,255), color(255,110,120), color(110,220,190),
      color(210,160,120), color(240,120,220), color(140,180,255), color(255,160,120)
    ];

    // bars
    var mouseIndex = -1;
    for (var i=0;i<n;i++) {
      var row = rows[i];
      var y = M.top + i*lane + lane/2;
      var val = this._showPercent ? (row.total*100/this._sumTotal) : row.total;
      var w  = (x(val) - M.left) * k;

      // label
      push(); noStroke(); fill(235); textAlign(RIGHT,CENTER); textSize(12);
      text(row.label, M.left - 12, y); pop();

      // bar gradient using canvas API
      push();
      var ctx = drawingContext;
      var x0 = M.left, x1 = M.left + max(0, w);
      var grd = ctx.createLinearGradient(x0, y, x1, y);
      var col = palette[i % palette.length];
      var rgba = 'rgba(' + floor(red(col)) + ',' + floor(green(col)) + ',' + floor(blue(col)) + ',';
      grd.addColorStop(0.0, rgba + '0.25)');
      grd.addColorStop(0.7, rgba + '0.85)');
      grd.addColorStop(1.0, rgba + '0.95)');
      ctx.fillStyle = grd;
      noStroke();
      rect(x0, y-10, max(0, w), 20, 10);
      pop();

      // value label
      push(); noStroke(); fill(235); textAlign(LEFT,CENTER); textSize(12);
      var txt = this._showPercent ? (nf(val,0,1)+'%') : nf(val,0,0);
      text(txt, M.left + w + 8, y);
      pop();

      // hit test
      if (mouseX >= M.left && mouseX <= M.left + w && mouseY >= y-12 && mouseY <= y+12) {
        mouseIndex = i;
      }
    }

    // tooltip
    if (mouseIndex >= 0) {
      var r = rows[mouseIndex];
      var pct = r.total*100/this._sumTotal;
      var lines = [
        r.label,
        'Total: ' + nf(r.total,0,0),
        'Share: ' + nf(pct,0,1) + '%'
      ];
      var parts = r.parts.slice().sort(function(a,b){ return b.value - a.value; }).slice(0,3);
      for (var p=0;p<parts.length;p++) lines.push(parts[p].col + ': ' + nf(parts[p].value,0,0));
      var pad=8;
      push(); textSize(12);
      var tw = 0; for (var i=0;i<lines.length;i++) tw = max(tw, textWidth(lines[i]));
      tw += pad*2;
      var th = lines.length*18 + pad*2;
      var tx = mouseX + 14, ty = mouseY + 14;
      if (tx + tw > width) tx = width - tw - 6;
      if (ty + th > height) ty = height - th - 6;
      noStroke(); fill(0,0,0,210); rect(tx,ty,tw,th,6);
      stroke(255,255,255,70); noFill(); rect(tx,ty,tw,th,6);
      noStroke(); fill(255); textAlign(LEFT,TOP);
      for (var i=0;i<lines.length;i++) text(lines[i], tx+pad, ty+pad + i*18);
      pop();
    }

    // axis caption
    push(); noStroke(); fill(220); textSize(12); textAlign(CENTER,TOP);
    text(this._showPercent ? 'Share of total waste (%)' : 'Total waste (units)', M.left + W/2, M.top + H + 34);
    pop();
  };

  // Helpers for adaptive ticks
  this._adaptiveStep = function(maxVal, widthPx, isPercent){
    // start with a reasonable step
    var step = isPercent ? 10 : niceStep(maxVal);
    var minGap = 42; // px between labels
    var maxTicks = floor(widthPx / minGap);
    if (maxTicks < 2) maxTicks = 2;
    // increase step until tick count fits
    while ((maxVal / step) > maxTicks) step = this._nextNiceStep(step);
    return step;
  };

  this._nextNiceStep = function(step){
    var exp = pow(10, floor(log(step) / log(10)));
    var unit = step / exp; // 1, 2, 5-ish
    var nextUnit = (unit <= 1) ? 2 : (unit <= 2 ? 5 : 10);
    return nextUnit * exp;
  };
}

// nice tick step helper
function niceStep(maxVal) {
  if (!isFinite(maxVal) || maxVal <= 0) return 1;
  if (maxVal <= 10) return 2;
  if (maxVal <= 20) return 5;
  if (maxVal <= 50) return 10;
  if (maxVal <= 100) return 20;
  if (maxVal <= 500) return 50;
  if (maxVal <= 1000) return 100;
  if (maxVal <= 5000) return 500;
  if (maxVal <= 10000) return 1000;
  return 2000;
}






