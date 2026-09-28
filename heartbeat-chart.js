try{ playIntroAnimation(); }catch(e){}

function HeartbeatChart() {
  this.name = 'Resting Heart Rate Trend (Adults, 2024)';
  this.id   = 'heartbeat-chart';
  this.loaded = false;

  // Data
  this._t = [];
  this._bpm = [];
  this._sma = [];

  // UI
  this.playBtn = null;
  this.smoothBtn = null;
  this._autoPlay = true;
  this._useSMA = true;

  // Legend state
  this._legendRects = [];   
  this._legendHover = -1;  

  // Anim
  this._t0 = null;

  // Theme underlay
  this._drawUnderlay = false;
  this._underlay = { r:0,g:0,b:0,a:255 };

  // PRELOAD 
  this.preload = function () {
    var self = this;
    this.data = loadTable('./data/heartbeat.csv', 'csv', 'header', function (tbl) {
      try {
        var times = tbl.getColumn('time').map(function(v){ return parseFloat(String(v).replace(/[^\d.\-]/g,'')); }).filter(function(v){return isFinite(v);});
        var bpm   = tbl.getColumn('bpm' ).map(function(v){ return parseFloat(String(v).replace(/[^\d.\-]/g,'')); }).filter(function(v){return isFinite(v);});
        if (times.length !== bpm.length || bpm.length === 0) throw new Error('Invalid CSV columns');
        self._t = times;
        self._bpm = bpm;
        self._sma = self._calcSMA(bpm, 3);
        self.loaded = true;
      } catch(e) {
        console.error('[heartbeat] parse error', e);
        self.loaded = false;
        self._err = 'Could not parse ./data/heartbeat.csv';
      }
    }, function(){ self.loaded=false; self._err='Missing ./data/heartbeat.csv'; });
  };

  //  SETUP 
  this.setup = function () {
    // clean old UI
    if (this.playBtn && this.playBtn.remove) this.playBtn.remove(), this.playBtn=null;
    if (this.smoothBtn && this.smoothBtn.remove) this.smoothBtn.remove(), this.smoothBtn=null;

    this._t0 = null;

    var c = select('canvas');
    if (c) c.elt.style.background = 'transparent';

    // Underlay detection 
    try{
      var bodyBg = window.getComputedStyle(document.body).backgroundColor;
      var parent = c ? (c.elt.parentElement || document.body) : document.body;
      var parentBg = window.getComputedStyle(parent).backgroundColor;
      var parseRGB = function(s){
        var m = s.match(/rgba?\(([^)]+)\)/i); if (!m) return {r:0,g:0,b:0,a:255};
        var p = m[1].split(',').map(function(x){ return parseFloat(x.trim()); });
        return { r: p[0]||0, g: p[1]||0, b: p[2]||0, a: (p[3]!==undefined? p[3]*255 : 255) };
      };
      var lum = function(c){ return 0.2126*c.r + 0.7152*c.g + 0.0722*c.b; };
      var body = parseRGB(bodyBg);
      var card = parseRGB(parentBg);
      this._drawUnderlay = lum(card) - lum(body) > 20;
      this._underlay = body;
    }catch(e){ this._drawUnderlay = false; }

    if (this.loaded) {
      this.playBtn = createButton(this._autoPlay ? '⏸ Auto' : '▶ Auto');
      this._styleCtl(this.playBtn, true);
      this.playBtn.mousePressed(function(){
        this._autoPlay = !this._autoPlay;
        this.playBtn.html(this._autoPlay ? '⏸ Auto' : '▶ Auto');
      }.bind(this));

      this.smoothBtn = createButton(this._useSMA ? 'Smoothing: ON' : 'Smoothing: OFF');
      this._styleCtl(this.smoothBtn, true);
      this.smoothBtn.mousePressed(function(){
        this._useSMA = !this._useSMA;
        this.smoothBtn.html(this._useSMA ? 'Smoothing: ON' : 'Smoothing: OFF');
        this._t0 = null;
      }.bind(this));

      var place = function(){
        var cnv = select('canvas'); if (!cnv) return;
        var r = cnv.elt.getBoundingClientRect();
        var x = window.pageXOffset + r.left + r.width - 180;
        var y = window.pageYOffset + r.top + 16;
        this.playBtn.position(x, y);
        this.smoothBtn.position(x, y + 42);
      }.bind(this);
      this._place = place; place();
    }
  };

  this._styleCtl = function(elt, tight){
    elt.style('padding', tight ? '6px 10px' : '6px');
    elt.style('border-radius','10px');
    elt.style('border','1px solid rgba(255,255,255,0.2)');
    elt.style('background','rgba(0,0,0,0.35)');
    elt.style('color','#fff');
    elt.style('backdrop-filter','blur(6px)');
  };

  this.windowResized = function(){ if (this._place) this._place(); };
  this.destroy = function(){
    if (this.playBtn && this.playBtn.remove) this.playBtn.remove();
    if (this.smoothBtn && this.smoothBtn.remove) this.smoothBtn.remove();
    this.playBtn=this.smoothBtn=null;
  };

  //LEGEND
  this._layoutLegend = function(M){
    textSize(12);
    var pad = 8, sw = 12, gap = 14;
    var items = [
      { key:'raw', label:'Raw' },
      { key:'sma', label:'3-pt SMA' }
    ];
    var rects = [], totalW = 0;
    for (var i=0;i<items.length;i++){
      var tw = textWidth(items[i].label);
      var w = pad*2 + sw + 6 + tw;
      rects.push({x:0,y:0,w:w,h:22,key:items[i].key,label:items[i].label});
      totalW += w + (i<items.length-1? gap:0);
    }
    // Position in the top-right, inside the right margin 
    var x0 = width - (M.right + totalW);
    var y0 = M.top - 46; // just below title line
    var acc = x0;
    for (var j=0;j<rects.length;j++){
      rects[j].x = acc; rects[j].y = y0;
      acc += rects[j].w + (j<rects.length-1? gap:0);
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
      fill(255,255,255, isHover ? 18 : 8);
      rect(r.x, r.y, r.w, r.h, 10);

      // swatch
      noStroke();
      if (r.key === 'sma') fill(120,180,255); else fill(180);
      rect(r.x + 8, r.y + (r.h-12)/2, 12, 12, 3);

      // label
      fill(230); textSize(12); textAlign(LEFT, CENTER);
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
    try{
      var c = select('canvas'); if (c && c.elt) c.elt.style.cursor = (hover>=0? 'pointer':'default');
    }catch(e){}
  };

  this.mousePressed = function(){
    if (!this.loaded) return;
    var idx = this._legendHover;
    if (idx>=0 && idx<this._legendRects.length){
      var key = this._legendRects[idx].key;
      this._useSMA = (key === 'sma');
      if (this.smoothBtn) this.smoothBtn.html(this._useSMA ? 'Smoothing: ON' : 'Smoothing: OFF');
      this._t0 = null; // restart animation on switch
    }
  };


  // DRAW 
  this.draw = function () {
    if (!this.loaded) {
      if (this._drawUnderlay) { push(); noStroke(); fill(this._underlay.r,this._underlay.g,this._underlay.b,this._underlay.a); rect(0,0,width,height); pop(); }
      else { clear(); }
      push(); noStroke(); fill(230); textAlign(CENTER,CENTER); textSize(14);
      text(this._err || 'Loading…', width/2, height/2); pop();
      return;
    }

    if (this._t0 == null) this._t0 = millis();
    var k = constrain((millis()-this._t0)/1000, 0, 1);
    k = 1 - pow(1 - k, 3); // easeOutCubic

    // background guard
    if (this._drawUnderlay) { push(); noStroke(); fill(this._underlay.r,this._underlay.g,this._underlay.b,this._underlay.a); rect(0,0,width,height); pop(); }
    else { clear(); }

    // Layout
    var M = { top: 110, right: 260, bottom: 90, left: 70 };
    var W = width  - M.left - M.right;
    var H = height - M.top  - M.bottom;

    // Title
    push();
    noStroke(); fill(235); textAlign(LEFT,BASELINE); textSize(16);
    text(this.name, M.left, M.top - 34);
    fill(200); textSize(12);
    text('Data: ./data/heartbeat.csv — beats per minute (BPM)', M.left, M.top - 14);
    pop();

    // Legend (top-right under the title)
    this._drawLegend(M);

    var t = this._t, bpmRaw = this._bpm, bpm = this._useSMA ? this._sma : this._bpm;
    var n = bpm.length;

    // Scales
    var minB = min.apply(null, bpmRaw), maxB = max.apply(null, bpmRaw);
    var pad = max(2, (maxB - minB) * 0.2);
    var yMin = floor(minB - pad), yMax = ceil(maxB + pad);
    var x = function(i){ return M.left + (W * i) / max(1, n-1); };
    var y = function(v){ return map(v, yMin, yMax, M.top + H, M.top); };

    // Normal zone ~ 60–80, Elevated ~ 80–100 (clamped to chart range)
    var z1a = max(yMin, 60), z1b = min(yMax, 80);
    var z2a = max(yMin, 80), z2b = min(yMax, 100);
    if (z1b > z1a) { push(); noStroke(); fill(110,200,140,30); rect(M.left, y(z1b), W, y(z1a)-y(z1b), 6); pop(); }
    if (z2b > z2a) { push(); noStroke(); fill(255,170,90,22);  rect(M.left, y(z2b), W, y(z2a)-y(z2b), 6); pop(); }

    // Grid & axes
    var stepY = this._niceStep(yMax - yMin);
    push(); stroke(220,220,220,40); strokeWeight(1);
    for (var g=yMin; g<=yMax+1e-6; g+=stepY) line(M.left, y(g), M.left+W, y(g));
    pop();
    push(); stroke(220,220,220,160); strokeWeight(1.5);
    line(M.left, M.top + H, M.left + W, M.top + H);
    line(M.left, M.top, M.left, M.top + H);
    pop();
    push(); noStroke(); fill(220,220,220,160); textSize(11); textAlign(RIGHT, CENTER);
    for (var gy=yMin; gy<=yMax+1e-6; gy+=stepY) text(nf(gy,0,0), M.left - 8, y(gy));
    pop();
    push(); noStroke(); fill(220); textSize(12); textAlign(CENTER, TOP);
    text('Beats per minute (BPM)', M.left + W/2, M.top + H + 34);
    pop();

    // Gradient under curve 
    var ctx = drawingContext;
    var grad = ctx.createLinearGradient(0, M.top, 0, M.top + H);
    grad.addColorStop(0, 'rgba(120,180,255,0.25)');
    grad.addColorStop(1, 'rgba(120,180,255,0.00)');
    ctx.fillStyle = grad;

    // Animated path portion
    var lastIdx = floor((n - 1) * k);
    var frac = ((n - 1) * k) - lastIdx;

    // Area
    beginShape();
    vertex(x(0), y(bpmRaw[0]));
    for (var i=1;i<=lastIdx;i++) vertex(x(i), y(bpmRaw[i]));
    if (lastIdx < n-1) {
      var ix = lerp(x(lastIdx), x(lastIdx+1), frac);
      var iv = lerp(bpmRaw[lastIdx], bpmRaw[lastIdx+1], frac);
      vertex(ix, y(iv));
    }
    // close to baseline
    vertex(x(lastIdx < n-1 ? lastIdx+1 : n-1), M.top + H);
    vertex(x(0), M.top + H);
    endShape(CLOSE);

    // Main line (active series)
    noFill(); stroke(120,180,255); strokeWeight(3);
    beginShape();
    for (var j=0;j<=lastIdx;j++) vertex(x(j), y(bpm[j]));
    if (lastIdx < n-1) {
      var ix2 = lerp(x(lastIdx), x(lastIdx+1), frac);
      var iv2 = lerp(bpm[lastIdx], bpm[lastIdx+1], frac);
      vertex(ix2, y(iv2));
    }
    endShape();

    // Legend-hover preview of the other series 
    var hoverKey = this._legendHoverKey && this._legendHoverKey();
    if (hoverKey && ((hoverKey === 'sma' && !this._useSMA) || (hoverKey === 'raw' && this._useSMA))) {
      var pv = (hoverKey === 'sma') ? this._sma : this._bpm;
      noFill(); stroke(220,220,220,160); strokeWeight(2);
      beginShape();
      for (var j2=0;j2<=lastIdx;j2++) vertex(x(j2), y(pv[j2]));
      if (lastIdx < n-1) {
        var ix3 = lerp(x(lastIdx), x(lastIdx+1), frac);
        var iv3 = lerp(pv[lastIdx], pv[lastIdx+1], frac);
        vertex(ix3, y(iv3));
      }
      endShape();
    }

    // Auto-play sweeper / cursor
    var prog = this._autoPlay ? ((millis()/900) % (n-1)) : (lastIdx + frac);
    var cIdx = constrain(floor(prog), 0, n-2);
    var cFrac = prog - cIdx;
    var curVal = lerp(bpm[cIdx], bpm[cIdx+1], cFrac);
    var curX = lerp(x(cIdx), x(cIdx+1), cFrac);
    var curY = y(curVal);

    // Vertical sweep glow
    push();
    stroke(255,255,255,70); strokeWeight(1);
    line(curX, M.top, curX, M.top + H);
    pop();

    // Cursor dot with BPM-responsive size + gentle pulse
    var size = map(curVal, yMin, yMax, 8, 16);
    size += 1.2 * sin(millis()/200);
    push(); noStroke(); fill(255,80,100);
    circle(curX, curY, size);
    // halo
    noFill(); stroke(255,80,100,140); strokeWeight(2);
    circle(curX, curY, size + 8);
    pop();

    // Dots on fixed samples
    var tPulse = millis()/250.0;
    for (var k2=0;k2<=lastIdx;k2++) {
      var r = 3 + 0.6 * sin(tPulse + k2*0.25);
      noStroke(); fill(120,180,255);
      circle(x(k2), y(bpm[k2]), r);
    }

    // Stats panel
    var minIdx = 0, maxIdx = 0, sum = 0;
    for (var m=0;m<n;m++) { if (bpmRaw[m] < bpmRaw[minIdx]) minIdx = m; if (bpmRaw[m] > bpmRaw[maxIdx]) maxIdx = m; sum += bpmRaw[m]; }
    var avg = sum / max(1,n);

    var panelX = width - 230, panelY = M.top + 10, panelW = 200, panelH = 110;
    push();
    noStroke(); fill(0,0,0,140); rect(panelX, panelY, panelW, panelH, 12);
    stroke(255,255,255,50); noFill(); rect(panelX, panelY, panelW, panelH, 12);
    noStroke(); fill(255); textAlign(LEFT, TOP); textSize(12);
    text('Summary', panelX + 12, panelY + 10);
    fill(220);
    text('Avg: ' + nf(avg,0,1) + ' bpm', panelX + 12, panelY + 32);
    text('Min: ' + nf(bpmRaw[minIdx],0,0) + ' bpm  (t=' + this._t[minIdx] + ')', panelX + 12, panelY + 52);
    text('Max: ' + nf(bpmRaw[maxIdx],0,0) + ' bpm  (t=' + this._t[maxIdx] + ')', panelX + 12, panelY + 72);
    pop();

    // Min/Max markers
    this._marker(x(minIdx), y(bpmRaw[minIdx]), 'MIN ' + nf(bpmRaw[minIdx],0,0) + ' bpm');
    this._marker(x(maxIdx), y(bpmRaw[maxIdx]), 'MAX ' + nf(bpmRaw[maxIdx],0,0) + ' bpm');

    // Hover tooltip
    var idx = this._nearestIndex(mouseX, x, n);
    if (idx >= 0) {
      var lines = [
        't = ' + this._t[idx],
        'BPM: ' + nf(bpmRaw[idx],0,1),
        (this._useSMA ? ('3-pt avg: ' + nf(this._sma[idx],0,1)) : null)
      ].filter(Boolean);
      this._tooltip(x(idx), y(bpm[idx]) - 16, lines);
    }
  };

  // HELPERS 
  this._calcSMA = function(arr, win){
    var out = [];
    for (var i=0;i<arr.length;i++){
      var s=0,c=0;
      for (var k=i-win+1;k<=i;k++){ if (k>=0){ s+=arr[k]; c++; } }
      out.push(c? s/c : arr[i]);
    }
    return out;
  };

  this._marker = function(xc, yc, txt){
    push();
    noStroke(); fill(0,0,0,180); rect(xc-44, yc-34, 88, 24, 8);
    stroke(255,255,255,90); noFill(); rect(xc-44, yc-34, 88, 24, 8);
    noStroke(); fill(255); textSize(10); textAlign(CENTER, CENTER);
    text(txt, xc, yc - 22);
    pop();
  };

  this._nearestIndex = function(mx, xScale, n){
    var best=-1, bd=1e9;
    for (var i=0;i<n;i++){
      var d = Math.abs(mx - xScale(i));
      if (d < bd && d < 24) { bd=d; best=i; }
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

  this._niceStep = function(range){
    var span = Math.abs(range)||1;
    var step = Math.pow(10, Math.floor(Math.log10(span)) - 1);
    var choices = [1,2,5,10];
    var pick = step;
    for (var i=0;i<choices.length;i++){
      var c = choices[i]*step;
      if (span/c <= 8){ pick=c; break; }
    }
    return pick;
  };
}

