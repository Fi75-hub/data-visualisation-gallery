try{ playIntroAnimation(); }catch(e){}

function CO2LineGraph() {
  this.name = 'Monthly CO₂ Emissions 2023';
  this.id = 'co2-line-graph';
  this.loaded = false;

  // Data
  this._months = [];
  this._values = [];   // raw
  this._sma = [];      // 3-month moving average

  // UI
  this.smoothToggle = null; // button
  this._useSMA = true;

  // Legend state
  this._legendRects = [];
  this._legendHover = -1;  

  // Anim
  this._t0 = null;

  // Theme underlay
  this._drawUnderlay = false;
  this._underlay = { r:0,g:0,b:0,a:255 };

  //PRELOAD 
  this.preload = function () {
    var self = this;
    this.data = loadTable('./data/co2-emissions.csv', 'csv', 'header', function (table) {
      try {
        var mCol = 'Month';
        var vCol = table.columns.find(function(c){ return /level|co2|ppm/i.test(c); }) || 'CO2 Level';

        var months = [];
        var values = [];
        for (var r = 0; r < table.getRowCount(); r++) {
          var m = String(table.getString(r, mCol) || '').trim();
          var raw = String(table.getString(r, vCol) || '').replace(/[^\d.\-]/g,'');
          var v = parseFloat(raw);
          if (!m || !isFinite(v)) continue;
          months.push(m);
          values.push(v);
        }
        if (!months.length) throw new Error('CSV empty or columns not found.');

        self._months = months;
        self._values = values;
        self._sma = self._calcSMA(values, 3);
        self.loaded = true;
      } catch (e) {
        console.error('CO2LineGraph parse error:', e);
        self.loaded = false;
        self._err = 'Could not read ./data/co2-emissions.csv';
      }
    }, function(){
      self.loaded = false; self._err = 'Missing ./data/co2-emissions.csv';
    });
  };

  // SETUP 
  this.setup = function () {
    if (this.smoothToggle && this.smoothToggle.remove) this.smoothToggle.remove(), this.smoothToggle = null;
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
      this.smoothToggle = createButton(this._useSMA ? 'Smoothing: ON' : 'Smoothing: OFF');
      this._styleCtl(this.smoothToggle);
      var place = function(){
        var cnv = select('canvas'); if (!cnv) return;
        var r = cnv.elt.getBoundingClientRect();
        var x = window.pageXOffset + r.left + r.width - 160;
        var y = window.pageYOffset + r.top + 16;
        this.smoothToggle.position(x, y);
      }.bind(this);
      this._placeCtl = place; place();

      this.smoothToggle.mousePressed(function(){
        this._useSMA = !this._useSMA;
        this.smoothToggle.html(this._useSMA ? 'Smoothing: ON' : 'Smoothing: OFF');
        this._t0 = null;
      }.bind(this));
    }
  };

  this._styleCtl = function(elt){
    elt.style('padding','6px 10px');
    elt.style('border-radius','10px');
    elt.style('border','1px solid rgba(255,255,255,0.2)');
    elt.style('background','rgba(0,0,0,0.35)');
    elt.style('color','#fff');
    elt.style('backdrop-filter','blur(6px)');
  };

  this.windowResized = function(){ if (this._placeCtl) this._placeCtl(); };
  this.destroy = function(){ if (this.smoothToggle && this.smoothToggle.remove) this.smoothToggle.remove(); this.smoothToggle = null; };

  //  LEGEND 
  this._layoutLegend = function(M) {
    // Two pills: Raw, 3-mo SMA
    textSize(12);
    var pad = 8, sw = 12, gap = 14;
    var items = [
      { key: 'raw', label: 'Raw' },
      { key: 'sma', label: '3-mo SMA' }
    ];
    var rects = [], totalW = 0;
    for (var i=0;i<items.length;i++){
      var tw = textWidth(items[i].label);
      var w = pad*2 + sw + 6 + tw;
      rects.push({x:0,y:0,w:w,h:22,key:items[i].key,label:items[i].label});
      totalW += w + (i<items.length-1? gap:0);
    }
    var x0 = width - (M.right + totalW);
    var y0 = M.top - 46; // under the title
    var acc = x0;
    for (var j=0;j<rects.length;j++){
      rects[j].x = acc; rects[j].y = y0; acc += rects[j].w + (j<rects.length-1? gap:0);
    }
    this._legendRects = rects;
  };

  this._drawLegend = function(M){
    this._layoutLegend(M);
    var activeKey = this._useSMA ? 'sma' : 'raw';
    for (var i=0;i<this._legendRects.length;i++){
      var r = this._legendRects[i];
      var isActive = (r.key === activeKey);
      var isHover  = (i === this._legendHover);

      push();
      // pill
      stroke(isActive ? 120 : 200, isActive ? 180 : 200, isActive ? 255 : 200);
      strokeWeight(isHover ? 2 : 1);
      fill(isHover ? 255 : 255, isHover ? 255 : 255, isHover ? 255 : 255, isHover ? 18 : 8);
      rect(r.x, r.y, r.w, r.h, 10);

      // swatch
      noStroke();
      if (r.key === 'sma') fill(120,180,255); else fill(180);
      rect(r.x + 8, r.y + (r.h-12)/2, 12, 12, 3);

      // label
      fill(230);
      textSize(12); textAlign(LEFT, CENTER);
      text(r.label, r.x + 8 + 12 + 6, r.y + r.h/2);
      pop();
    }
  };

  this._legendHoverKey = function(){
    var i = this._legendHover;
    return (i>=0 && i<this._legendRects.length) ? this._legendRects[i].key : null;
  };

  this.mouseMoved = function(){
    if (!this.loaded) return;
    var hover = -1;
    for (var i=0;i<this._legendRects.length;i++){
      var r = this._legendRects[i];
      if (mouseX>=r.x && mouseX<=r.x+r.w && mouseY>=r.y && mouseY<=r.y+r.h) { hover = i; break; }
    }
    this._legendHover = hover;
    try {
      var c = select('canvas');
      if (c && c.elt) c.elt.style.cursor = (hover>=0? 'pointer':'default');
    } catch(e){}
  };

  this.mousePressed = function(){
    if (!this.loaded) return;
    var idx = this._legendHover;
    if (idx>=0 && idx<this._legendRects.length){
      var key = this._legendRects[idx].key;
      this._useSMA = (key === 'sma');
      if (this.smoothToggle) this.smoothToggle.html(this._useSMA ? 'Smoothing: ON' : 'Smoothing: OFF');
      this._t0 = null; // restart animation on switch
    }
  };


  // DRAW 
  this.draw = function () {
    if (!this.loaded) {
      if (this._drawUnderlay) { push(); noStroke(); fill(this._underlay.r,this._underlay.g,this._underlay.b,this._underlay.a); rect(0,0,width,height); pop(); }
      else { clear(); }
    }
    if (!this.loaded) {
      push(); noStroke(); fill(230); textAlign(CENTER, CENTER); textSize(14);
      text(this._err || 'Loading…', width/2, height/2); pop();
      return;
    }

    if (this._t0 == null) this._t0 = millis();
    var k = constrain((millis()-this._t0)/1000, 0, 1);
    k = 1 - pow(1 - k, 3); // easeOutCubic

    // background guard
    if (this._drawUnderlay) { push(); noStroke(); fill(this._underlay.r,this._underlay.g,this._underlay.b,this._underlay.a); rect(0,0,width,height); pop(); }
    else { clear(); }

    // layout
    var M = { top: 110, right: 40, bottom: 90, left: 70 };
    var W = width  - M.left - M.right;
    var H = height - M.top  - M.bottom;

    // title
    push();
    noStroke(); fill(235); textAlign(LEFT,BASELINE); textSize(16);
    text('Monthly CO₂ levels — 2023', M.left, M.top - 34);
    fill(200); textSize(12);
    text('Data from ./data/co2-emissions.csv — units: ppm (parts per million)', M.left, M.top - 14);
    pop();

    // legend 
    this._drawLegend(M);

    var months = this._months;
    var values = this._useSMA ? this._sma : this._values;

    // scales
    var minV = min.apply(null, this._values);
    var maxV = max.apply(null, this._values);
    // pad a bit
    var pad = (maxV - minV) * 0.1 || 1;
    var yMin = floor((minV - pad)*10)/10;
    var yMax = ceil((maxV + pad)*10)/10;

    var x = function(i){ return M.left + (W * i) / max(1, months.length - 1); };
    var y = function(v){ return map(v, yMin, yMax, M.top + H, M.top); };

    // grid
    var stepY = niceStep(yMax - yMin);
    push(); stroke(220,220,220,40); strokeWeight(1);
    for (var g=yMin; g<=yMax+1e-6; g+=stepY) line(M.left, y(g), M.left+W, y(g));
    pop();
    // axis
    push(); stroke(220,220,220,160); strokeWeight(1.5);
    line(M.left, M.top + H, M.left + W, M.top + H);
    line(M.left, M.top, M.left, M.top + H);
    pop();
    // y labels
    push(); noStroke(); fill(220,220,220,160); textSize(11); textAlign(RIGHT, CENTER);
    for (var g2=yMin; g2<=yMax+1e-6; g2+=stepY) text(nf(g2,0,1), M.left - 8, y(g2));
    pop();
    // x labels
    push(); noStroke(); fill(220,220,220,160); textSize(11); textAlign(CENTER, TOP);
    for (var i=0;i<months.length;i++) text(months[i], x(i), M.top + H + 8);
    pop();
    // axis caption
    push(); noStroke(); fill(220); textSize(12); textAlign(CENTER, TOP);
    text('CO₂ concentration (ppm)', M.left + W/2, M.top + H + 34);
    pop();

    // gradient under curve
    var ctx = drawingContext;
    var grad = ctx.createLinearGradient(0, M.top, 0, M.top + H);
    grad.addColorStop(0, 'rgba(120,180,255,0.30)');
    grad.addColorStop(1, 'rgba(120,180,255,0.00)');
    ctx.fillStyle = grad;

    //  path up to animation 
    var lastIdx = floor((months.length - 1) * k);
    var frac = ((months.length - 1) * k) - lastIdx; 

    // Area
    beginShape();
    vertex(x(0), y(this._values[0]));
    for (var i=1;i<=lastIdx;i++) vertex(x(i), y(this._values[i]));
    if (lastIdx < months.length - 1) {
      var ix = lerp(x(lastIdx), x(lastIdx+1), frac);
      var iv = lerp(this._values[lastIdx], this._values[lastIdx+1], frac);
      vertex(ix, y(iv));
    }
    // close down to axis
    vertex(x(lastIdx < months.length - 1 ? 0 : months.length-1), M.top+H);
    vertex(x(0), M.top+H);
    endShape(CLOSE);

    // main line
    noFill();
    stroke(120,180,255);
    strokeWeight(3);
    beginShape();
    for (var i=0;i<=lastIdx;i++) vertex(x(i), y(values[i]));
    if (lastIdx < months.length - 1) {
      var ix2 = lerp(x(lastIdx), x(lastIdx+1), frac);
      var iv2 = lerp(values[lastIdx], values[lastIdx+1], frac);
      vertex(ix2, y(iv2));
    }
    endShape();

    // Legend-hover
    var hoverKey = this._legendHoverKey && this._legendHoverKey();
    if (hoverKey && ((hoverKey === 'sma' && !this._useSMA) || (hoverKey === 'raw' && this._useSMA))) {
      var pv = (hoverKey === 'sma') ? this._sma : this._values;
      noFill();
      stroke(220,220,220,160);
      strokeWeight(2);
      beginShape();
      for (var i3=0;i3<=lastIdx;i3++) vertex(x(i3), y(pv[i3]));
      if (lastIdx < months.length - 1) {
        var ix3 = lerp(x(lastIdx), x(lastIdx+1), frac);
        var iv3 = lerp(pv[lastIdx], pv[lastIdx+1], frac);
        vertex(ix3, y(iv3));
      }
      endShape();
    }

    // point markers & labels
    fill(230); noStroke(); textSize(10);
    for (var i4=0;i4<months.length;i4++) {
      var xi = x(i4), yi = y(values[i4]);
      // small glow pulse
      var r = 5 + 1.2 * sin(millis()/250 + i4*0.35);
      if (i4 <= lastIdx + 1) {
        push(); noStroke(); fill(120,180,255); circle(xi, yi, r); pop();
      }
    }

    // min / max markers on RAW series
    var minIdx = 0, maxIdx = 0;
    for (var j=1;j<this._values.length;j++){
      if (this._values[j] < this._values[minIdx]) minIdx = j;
      if (this._values[j] > this._values[maxIdx]) maxIdx = j;
    }
    this._drawMarker(x(minIdx), y(this._values[minIdx]), 'min', nf(this._values[minIdx],0,1)+' ppm');
    this._drawMarker(x(maxIdx), y(this._values[maxIdx]), 'max', nf(this._values[maxIdx],0,1)+' ppm');

    // Sweep highlight along line
    var sweepX = x((millis()/1200)% (months.length-1));
    push();
    stroke(255,255,255,80); strokeWeight(1);
    line(sweepX, M.top, sweepX, M.top + H);
    pop();

    // Hover
    var nearest = this._nearestIndex(mouseX, x, months.length);
    if (nearest >= 0) {
      var hv = this._values[nearest];
      var xv = x(nearest), yv = y(values[nearest]);
      // crosshair
      push(); stroke(255,255,255,70); strokeWeight(1); line(xv, M.top, xv, M.top + H); pop();
      // tooltip
      var lines = [months[nearest],
                   'CO₂: ' + nf(hv,0,1) + ' ppm',
                   (this._useSMA ? '3-mo avg: ' + nf(values[nearest],0,1) + ' ppm' : '—')];
      this._tooltip(xv, yv - 16, lines);
    }
  };

  //HELPERS
  this._calcSMA = function(arr, win){
    var out = [];
    for (var i=0;i<arr.length;i++){
      var s=0,c=0;
      for (var k=i-win+1;k<=i;k++){
        if (k>=0){ s += arr[k]; c++; }
      }
      out.push(c? s/c : arr[i]);
    }
    return out;
  };

  this._nearestIndex = function(mx, xScale, n){
    var best = -1, bd = 1e9;
    for (var i=0;i<n;i++){
      var d = Math.abs(mx - xScale(i));
      if (d < bd && d < 24) { bd = d; best = i; }
    }
    return best;
  };

  this._tooltip = function(tx, ty, lines){
    var pad=8; push(); textSize(12);
    var tw = 0; for (var i=0;i<lines.length;i++) tw = max(tw, textWidth(lines[i]));
    tw += pad*2;
    var th = lines.length*18 + pad*2;
    if (tx + tw > width) tx = width - tw - 6;
    if (ty - th < 0) ty = th + 6;
    noStroke(); fill(0,0,0,210); rect(tx, ty - th, tw, th, 8);
    stroke(255,255,255,70); noFill(); rect(tx, ty - th, tw, th, 8);
    noStroke(); fill(255); textAlign(LEFT,TOP);
    for (var i=0;i<lines.length;i++) text(lines[i], tx+pad, ty - th + pad + i*18);
    pop();
  };

  this._drawMarker = function(xc, yc, label, value){
    push();
    noStroke(); fill(0,0,0,180); rect(xc-40, yc-34, 80, 24, 8);
    stroke(255,255,255,90); noFill(); rect(xc-40, yc-34, 80, 24, 8);
    noStroke(); fill(255); textSize(10); textAlign(CENTER, CENTER);
    text(label.toUpperCase() + ' • ' + value, xc, yc-22);
    pop();
  };
}

//  nice tick step helper
function niceStep(range) {
  var span = Math.abs(range) || 1;
  var step = Math.pow(10, Math.floor(Math.log10(span)) - 1);
  var pretty = step;
  var choices = [1,2,5,10];
  for (var i=0;i<choices.length;i++){
    var cand = choices[i]*step;
    if (span/ cand <= 8) { pretty = cand; break; }
  }
  return pretty;
}
