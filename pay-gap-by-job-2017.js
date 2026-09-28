try { playIntroAnimation(); } catch (e) {}

function PayGapByJob2017() {
  this.name = 'Pay gap by job: 2017';
  this.id   = 'pay-gap-by-job-2017';
  this.loaded = false;

  // ===== THEME =====
  this.bg   = color(11, 18, 32);
  this.grid = color(90, 100, 120, 110);
  this.txt  = color(232);
  this.colMen = color(40, 210, 120);    // green (male )
  this.colFem = color(240, 120, 200);   // magenta (female )
  this.colGhostAlpha = 120;

  //  LAYOUT
  this.m = { t: 66, r: 40, b: 70, l: 90 };

  //  TUNABLES 
  this.MAX_UX = 4.6; this.MAX_UY = 5.2;        // spread caps (±£)
  this.JITTER_X = 1.2; this.JITTER_Y = 1.6;    // deterministic jitter (±£)
  this.BOUNCE_AX = 0.04; this.BOUNCE_AY = 0.06; // gentle bounce (in £)
  this.BOUNCE_FX = 0.35; this.BOUNCE_FY = 0.30;
  this.BOUNCE_EASE_MS = 1200;                  // fade-in of bounce
  this.RELAX_ITERS_PER_FRAME = 1;
  this.RELAX_WARMUP_ITERS    = 90;             // static warm-up
  this.MIN_DIST_FACTOR       = 0.98;
  this.DAMP                  = 0.94;
  this.SPRING                = 0.005;
  this.MAX_V                 = 0.06;           // velocity clamp
  this.FILL_LEFT        = true;                // decorative balance
  this.CLONES_PER_POINT = 1;

  //  DATA 
  this.rows = [];
  this._tStart = 0;
  this._decorHits = []; 

  this.preload = function () {
    var self = this;
    this.table = loadTable(
      'data/pay-gap/occupation-hourly-pay-by-gender-2017.csv',
      'csv', 'header',
      function () { self.loaded = true; }
    );
  };

  this.setup = function () {
    textFont('sans-serif');
    if (!this.loaded) return;
    this.prepare();

    // Static 
    this._relaxStatic(this.RELAX_WARMUP_ITERS);
    for (let r of this.rows) { r.vx = 0; r.vy = 0; }

    this._tStart = millis();
  };

  this.destroy = function(){};

  //  helpers 
  this._parsePay = v => parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  this._pickCol = function (cands) { for (let c of cands){ const i=this.table.columns.indexOf(c); if(i!==-1) return i; } return -1; };
  this._hash = function (s) { let h=2166136261; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return (h>>>0); };
  this._rand01 = function (seed) { let x=seed>>>0; x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/4294967295; };

  //  data prep 
  this.prepare = function () {
    this.rows = [];
    const cJob=this._pickCol(['Job','Occupation','job','occupation']);
    const cF  =this._pickCol(['Female median hourly pay','Female Median Hourly Pay','female','female_pay']);
    const cM  =this._pickCol(['Male median hourly pay','Male Median Hourly Pay','male','male_pay']);

    for (let i=0;i<this.table.getRowCount();i++){
      const job = cJob>=0 ? this.table.getString(i,cJob) : '';
      const f   = this._parsePay(this.table.getString(i,cF));
      const m   = this._parsePay(this.table.getString(i,cM));
      if (!isFinite(f) || !isFinite(m)) continue;

      const gap=m-f, gapAbs=Math.abs(gap), avg=(m+f)/2;
      const h=this._hash(job||String(i));
      const r1=this._rand01(h^0xA53), r2=this._rand01(h^0x1C3), r3=this._rand01(h^0x7F1);
      const jxUnits=(r1-0.5)*(this.JITTER_X*2), jyUnits=(r2-0.5)*(this.JITTER_Y*2);

      this.rows.push({ job,f,m,gap,gapAbs,avg, jxUnits,jyUnits, phase:r3*TWO_PI, ox:0,oy:0,vx:0,vy:0 });
    }

    const diffs=this.rows.map(r=>r.gap), avgs=this.rows.map(r=>r.avg);
    const maxAbs=max(abs(min(diffs)),abs(max(diffs)));
    this.xMin=-ceil((maxAbs+2)/5)*5; this.xMax=ceil((maxAbs+2)/5)*5;

    let yMin=min(avgs), yMax=max(avgs), padY=(yMax-yMin)*0.25;
    this.yMin=floor((yMin-padY)/5)*5; this.yMax=ceil((yMax+padY)/5)*5;

    const sorted=avgs.slice().sort((a,b)=>a-b), mid=floor(sorted.length/2);
    this.yMid=(sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2);

    this.sMin=min(this.rows.map(r=>r.gapAbs)); this.sMax=max(this.rows.map(r=>r.gapAbs)); if(this.sMin===this.sMax){this.sMin=0; this.sMax+=1;}

    this.plotW=width-this.m.l-this.m.r; this.plotH=height-this.m.t-this.m.b;
    this.xScale=this.plotW/(this.xMax-this.xMin); this.yScale=this.plotH/(this.yMax-this.yMin);
    this.xMap=v=>this.m.l+(v-this.xMin)*this.xScale; this.yMap=v=>this.m.t+this.plotH-(v-this.yMin)*this.yScale;
    this.rMap=v=>map(v,this.sMin,this.sMax,12,44);
  };

  //  axes 
  this.drawAxes = function(){
    stroke(this.grid); strokeWeight(1);
    for (let xv=this.xMin; xv<=this.xMax; xv+=5) line(this.xMap(xv), this.m.t, this.xMap(xv), this.m.t+this.plotH);
    for (let yv=this.yMin; yv<=this.yMax; yv+=5) line(this.m.l, this.yMap(yv), this.m.l+this.plotW, this.yMap(yv));

    stroke(235,240,255,180); strokeWeight(1.4);
    line(this.xMap(0), this.m.t, this.xMap(0), this.m.t+this.plotH);
    line(this.m.l, this.yMap(this.yMid), this.m.l+this.plotW, this.yMap(this.yMid));

    noStroke(); fill(this.txt); textSize(12); textAlign(CENTER,BOTTOM);
    text(' Female Pay', this.xMap(this.xMin+(this.xMax-this.xMin)*0.25), this.m.t-6);
    text(' Male Pay ',   this.xMap(this.xMin+(this.xMax-this.xMin)*0.75), this.m.t-6);

    textAlign(CENTER,TOP);
    for (let xv=this.xMin; xv<=this.xMax; xv+=5){ const lab=(xv>0?'+':'')+'£'+abs(xv); text(lab,this.xMap(xv),this.m.t+this.plotH+10); }
    textAlign(RIGHT,CENTER);
    for (let yv=this.yMin; yv<=this.yMax; yv+=5) text('£'+yv, this.m.l-10, this.yMap(yv));

    fill(this.txt); textAlign(CENTER,TOP); textSize(18);
    text('Pay Gap by Job per Hour (2017)', width/2, 14);
    textSize(13);
    text('Gap (Male − Female) in £', this.m.l+this.plotW/2, this.m.t+this.plotH+34);
    push(); translate(this.m.l-48, this.m.t+this.plotH/2); rotate(-HALF_PI);
    text('Average of Male & Female (£/hr)', 0, 0); pop();
  };

  //  tooltip 
  this._tooltip = function(px,py,row,col){
    const lines = [
      row.job,
      'Male: £' + nf(row.m,1,1) + '   Female: £' + nf(row.f,1,1),
      'Gap (M−F): £' + nf(row.gap,1,1) + ' | Avg: £' + nf(row.avg,1,1)
    ];
    textSize(12);
    let w=0; for (let s of lines) w=max(w,textWidth(s));
    const pad=8, lh=16, bw=w+pad*2, bh=lh*lines.length+pad*2;
    let bx=px+12, by=py-bh-12; if (bx+bw>width-8) bx=px-bw-12; if (by<8) by=py+12;

    push(); noStroke(); fill(20,28,45,235); rect(bx,by,bw,bh,8);
    stroke(red(col),green(col),blue(col),210); noFill(); rect(bx,by,bw,bh,8); pop();

    fill(240); noStroke(); textAlign(LEFT,TOP);
    let ty=by+pad; for (let s of lines){ text(s,bx+pad,ty); ty+=lh; }
  };

  //  bubble primitive 
  this._bubble = function(x,y,r,col,highlight,alphaOverride){
    push(); noStroke();
    const baseAlpha = (alphaOverride != null) ? alphaOverride : (highlight ? 230 : 185);
    const glowA = highlight ? 0.9 : 0.55;
    drawingContext.shadowBlur  = highlight ? 26 : 16;
    drawingContext.shadowColor = `rgba(${red(col)},${green(col)},${blue(col)},${glowA})`;
    fill(red(col),green(col),blue(col), baseAlpha);
    ellipse(x,y,r,r);
    drawingContext.shadowBlur = 0;
    fill(255,255,255,highlight?240:200);
    ellipse(x - r*0.2, y - r*0.2, max(2, r*0.18), max(2, r*0.18));
    pop();
  };

  // static & dynamic
  this._relaxStatic = function(iter){ const n=this.rows.length;
    for (let k=0;k<iter;k++){
      for (let i=0;i<n;i++){
        const ri=this.rMap(this.rows[i].gapAbs), xi=this.xMap(this.rows[i].gap+this.rows[i].ox), yi=this.yMap(this.rows[i].avg+this.rows[i].oy);
        for (let j=i+1;j<n;j++){
          const rj=this.rMap(this.rows[j].gapAbs), xj=this.xMap(this.rows[j].gap+this.rows[j].ox), yj=this.yMap(this.rows[j].avg+this.rows[j].oy);
          const dx=xi-xj, dy=yi-yj, dist=Math.hypot(dx,dy)||0.0001, minD=(ri+rj)*this.MIN_DIST_FACTOR;
          if (dist<minD){ const pushPx=(minD-dist)/2, ux=(pushPx*(dx/dist))/this.xScale, uy=(pushPx*(dy/dist))/this.yScale;
            this.rows[i].ox+=ux; this.rows[i].oy+=uy; this.rows[j].ox-=ux; this.rows[j].oy-=uy; }
        }
      }
      for (let i=0;i<n;i++){ const r=this.rows[i]; r.ox=constrain(r.ox,-this.MAX_UX,this.MAX_UX); r.oy=constrain(r.oy,-this.MAX_UY,this.MAX_UY); }
    }
  };

  this._relax = function(iter){ const n=this.rows.length;
    for (let k=0;k<iter;k++){
      for (let i=0;i<n;i++){
        const ri=this.rMap(this.rows[i].gapAbs), xi=this.xMap(this.rows[i].gap+this.rows[i].ox), yi=this.yMap(this.rows[i].avg+this.rows[i].oy);
        for (let j=i+1;j<n;j++){
          const rj=this.rMap(this.rows[j].gapAbs), xj=this.xMap(this.rows[j].gap+this.rows[j].ox), yj=this.yMap(this.rows[j].avg+this.rows[j].oy);
          const dx=xi-xj, dy=yi-yj, dist=Math.hypot(dx,dy)||0.0001, minD=(ri+rj)*this.MIN_DIST_FACTOR;
          if (dist<minD){ const pushPx=(minD-dist)/2, ux=(pushPx*(dx/dist))/this.xScale, uy=(pushPx*(dy/dist))/this.yScale;
            this.rows[i].ox+=ux; this.rows[i].oy+=uy; this.rows[j].ox-=ux; this.rows[j].oy-=uy; }
        }
      }
      for (let i=0;i<n;i++){ const r=this.rows[i];
        r.vx=(r.vx - this.SPRING*r.ox)*this.DAMP; r.vy=(r.vy - this.SPRING*r.oy)*this.DAMP;
        r.vx=constrain(r.vx,-this.MAX_V,this.MAX_V); r.vy=constrain(r.vy,-this.MAX_V,this.MAX_V);
        r.ox+=r.vx; r.oy+=r.vy; r.ox=constrain(r.ox,-this.MAX_UX,this.MAX_UX); r.oy=constrain(r.oy,-this.MAX_UY,this.MAX_UY);
      }
    }
  };

  //  decorative bubbles 
  this._drawDecor = function(t, ampScale){
    this._decorHits = [];
    if (!this.FILL_LEFT) return;

    for (let i=0;i<this.rows.length;i++){
      const r = this.rows[i];
      const s = this.rMap(r.gapAbs) * 0.88;
      const baseCol = (r.gap >= 0) ? this.colFem : this.colMen; // flipped colour

      const seed = this._hash(r.job || String(i));
      const u1 = this._rand01(seed ^ 0x55A);
      const u2 = this._rand01(seed ^ 0x1E3);
      const u3 = this._rand01(seed ^ 0x9D7);

    
      let gx = -r.gap + (u1 - 0.5) * 3.6;
      let gy =  r.avg + (u2 - 0.5) * 4.2;
      gx += (this.BOUNCE_AX * ampScale) * Math.sin(this.BOUNCE_FX*t + r.phase + 1.2);
      gy += (this.BOUNCE_AY * ampScale) * Math.cos(this.BOUNCE_FY*t + r.phase*1.1 + 0.7);

      const x = this.xMap(gx), y = this.yMap(gy);
      this._bubble(x, y, s, baseCol, false, this.colGhostAlpha);
      this._decorHits.push({x, y, r: s*0.55, col: baseCol, row: r}); // <-- no 'note'

      //  clones
      for (let c=0;c<this.CLONES_PER_POINT;c++){
        const ang = TWO_PI * (u3 + 0.37*c);
        const radX = 0.9 + 0.6 * u1, radY = 1.1 + 0.6 * u2;
        const cx = gx + radX * Math.cos(ang), cy = gy + radY * Math.sin(ang);
        const cs = max(10, s * (0.75 - 0.15*c));
        const xx = this.xMap(cx), yy = this.yMap(cy);
        this._bubble(xx, yy, cs, baseCol, false, this.colGhostAlpha - 40);
        this._decorHits.push({x: xx, y: yy, r: cs*0.55, col: baseCol, row: r}); // <-- no 'note'
      }
    }
  };

  //  main draw 
  this.draw = function(){
    if (!this.loaded) return;
    if (this.rows.length === 0) this.prepare();

    background(this.bg);
    this.drawAxes();

    
    this._relax(this.RELAX_ITERS_PER_FRAME);

    const t = millis() / 1000;
    const ampScale = constrain((millis() - this._tStart) / this.BOUNCE_EASE_MS, 0, 1);

    //   bubbles 
    this._drawDecor(t, ampScale);

    // hover
    let hover = null;

    //  bubbles 
    const order = this.rows.map((_,i)=>i).sort((a,b)=> this.rows[a].gapAbs - this.rows[b].gapAbs);
    for (let idx of order){
      const r = this.rows[idx];
      const bx = (this.BOUNCE_AX * ampScale) * Math.sin(this.BOUNCE_FX*t + r.phase);
      const by = (this.BOUNCE_AY * ampScale) * Math.cos(this.BOUNCE_FY*t + r.phase*1.3);

      const gx = r.gap + r.jxUnits + r.ox + bx;
      const gy = r.avg + r.jyUnits + r.oy + by;

      const x = this.xMap(gx), y = this.yMap(gy), s = this.rMap(r.gapAbs);
      const col = (r.gap >= 0) ? this.colMen : this.colFem;

      const hit = dist(mouseX, mouseY, x, y) <= s * 0.55;
      if (hit) hover = {x, y, col, row:r, isDecor:false};

      const dim = (hover && !hit);
      if (dim) { push(); drawingContext.globalAlpha = 0.45; this._bubble(x,y,s,col,false); pop(); }
      else      this._bubble(x,y,s,col,hit);
    }

    // tooltip 
    if (!hover && this._decorHits.length){
      for (let i = this._decorHits.length - 1; i >= 0; i--) {
        const d = this._decorHits[i];
        if (dist(mouseX, mouseY, d.x, d.y) <= d.r) { hover = {x:d.x, y:d.y, col:d.col, row:d.row, isDecor:true}; break; }
      }
    }

    if (hover) this._tooltip(hover.x, hover.y, hover.row, hover.col);
  };
}






