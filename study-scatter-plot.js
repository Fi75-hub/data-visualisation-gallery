// study-scatter-plot.
const CSV_FILE = 'study.csv'; 

function StudyScatterPlot() {
  this.name = 'Study Hours vs Score';
  this.id   = 'study-scatter-plot';
  this.loaded = false;

  // path 
  this._source = null;
  this._err = '';

  // parsed state
  this._rows = [];     // {x,y,cat,label}
  this._xCol = null;   // detected X column
  this._yCol = null;   // detected Y column
  this._catCol = null;
  this._labelCol = null;

  // ranges
  this._minX=0; this._maxX=1; this._minY=0; this._maxY=1;

  // animation
  this._t0 = null;
  this._drawUnderlay = false;
  this._underlay = { r:0,g:0,b:0,a:255 };

  //  PRELOAD 
  this.preload = () => {
    const fn = CSV_FILE;
    const enc = encodeURIComponent(fn).replace(/%2F/g,'/');
    const candidates = [
      `./data/${fn}`,
      `./data/${enc}`,
      `data/${fn}`,
      `data/${enc}`,
      `/data/${fn}`,
      `/data/${enc}`,
      `../data/${fn}`,
      `../data/${enc}`,
    ];

    const tryNext = (i) => {
      if (i >= candidates.length) { this._err = `Missing CSV in /data: ${CSV_FILE}`; this.loaded=false; return; }
      const path = candidates[i] + `?v=${Date.now()}`;
      loadTable(path, 'csv', 'header',
        (tbl) => { try { this._parse(tbl); this._source = candidates[i]; this.loaded = true; }
                   catch(e){ tryNext(i+1); } },
        () => { tryNext(i+1); }
      );
    };
    tryNext(0);
  };

  // PARSE 
  this._parse = (tbl) => {
    const cols = (tbl.columns||[]).map(c => (c||'').trim());
    if (!cols.length) throw new Error('Empty CSV');

    const toNum = (v) => {
      const s = String(v==null?'':v).replace(/[^\d.\-]/g,'');
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : NaN;
    };

    // split numeric vs categorical
    const numeric = [], categorical = [];
    for (const c of cols) {
      let nums=0, tots=0;
      for (let r=0; r<tbl.getRowCount(); r++) {
        const raw = tbl.getString(r, c);
        if (raw==null || String(raw).trim()==='') continue;
        tots++; if (Number.isFinite(toNum(raw))) nums++;
      }
      if (tots>0 && nums/tots >= 0.7) numeric.push(c);
      else categorical.push(c);
    }
    if (numeric.length < 2) throw new Error('Need at least two numeric columns');

    // choose X/Y 
    const prefX = numeric.find(c => /(hour|study|time|duration)/i.test(c)) || numeric[0];
    const prefY = numeric.find(c => /(score|mark|grade|result|percent)/i.test(c)) || (numeric[1] || numeric[0]);
    this._xCol = prefX;
    this._yCol = (prefY === prefX && numeric.length > 1) ? numeric[1] : prefY;

    //  categorical
    this._catCol   = categorical.find(c => /(student|group|class|cohort|category|type)/i.test(c)) || null;
    this._labelCol = categorical.find(c => /(student|name|id|label)/i.test(c)) || this._catCol;

    // rows
    const rows = [];
    for (let r=0; r<tbl.getRowCount(); r++) {
      const x = toNum(tbl.getString(r, this._xCol));
      const y = toNum(tbl.getString(r, this._yCol));
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const cat = this._catCol ? String(tbl.getString(r, this._catCol)||'').trim() : null;
      const label = this._labelCol ? String(tbl.getString(r, this._labelCol)||'').trim() : null;
      rows.push({x, y, cat: cat||null, label: label||null, i: r});
    }
    if (!rows.length) throw new Error('No valid numeric rows');

    this._rows = rows;
    const xs = rows.map(d=>d.x), ys = rows.map(d=>d.y);
    this._minX = Math.min.apply(null, xs); this._maxX = Math.max.apply(null, xs);
    this._minY = Math.min.apply(null, ys); this._maxY = Math.max.apply(null, ys);
  };

  //  SETUP 
  this.setup = () => {
    // transparent canvas
    const c = select('canvas');
    if (c) c.elt.style.background = 'transparent';

    //  underlay guard
    try {
      const bodyBg  = window.getComputedStyle(document.body).backgroundColor;
      const parent  = c ? (c.elt.parentElement || document.body) : document.body;
      const cardBg  = window.getComputedStyle(parent).backgroundColor;
      const parseRGB = (s) => {
        const m = s && s.match(/rgba?\(([^)]+)\)/i);
        if (!m) return { r:0, g:0, b:0, a:255 };
        const p = m[1].split(',').map(v => parseFloat(String(v).trim()));
        return { r:p[0]||0, g:p[1]||0, b:p[2]||0, a:(p.length>3 && !isNaN(p[3]) ? p[3]*255 : 255) };
      };
      const lum = (c) => 0.2126*c.r + 0.7152*c.g + 0.0722*c.b;
      const body = parseRGB(bodyBg), card = parseRGB(cardBg);
      this._drawUnderlay = (lum(card) - lum(body)) > 20;
      this._underlay = body;
    } catch(e) { this._drawUnderlay = false; }

    this._t0 = null;
  };

  // DRAW 
  this.draw = () => {
    // background handling 
    if (!this.loaded) {
      if (this._drawUnderlay) { push(); noStroke(); fill(this._underlay.r,this._underlay.g,this._underlay.b,this._underlay.a); rect(0,0,width,height); pop(); }
      else { clear(); }
      push(); noStroke(); fill(230); textAlign(CENTER,CENTER); textSize(14);
      text(this._err || `Looking for ${CSV_FILE} in /data …`, width/2, height/2); pop();
      return;
    }
    if (this._t0 == null) this._t0 = millis();
    const reveal = easeOutCubic(constrain((millis()-this._t0)/900, 0, 1));

    if (this._drawUnderlay) { push(); noStroke(); fill(this._underlay.r,this._underlay.g,this._underlay.b,this._underlay.a); rect(0,0,width,height); pop(); }
    else { clear(); }

    // layout
    const M = { top: 110, right: 300, bottom: 90, left: 80 };
    const W = width  - M.left - M.right;
    const H = height - M.top  - M.bottom;

    // title
    push();
    noStroke(); fill(235); textAlign(LEFT,BASELINE); textSize(16);
    text(this.name, M.left, M.top - 34);
    fill(200); textSize(12);
    text('Source: ' + (this._source || ('./data/' + CSV_FILE)), M.left, M.top - 14);
    pop();

    // padded domains
    const padX = (this._maxX - this._minX) * 0.06 || 1;
    const padY = (this._maxY - this._minY) * 0.12 || 1;
    const xMin = this._minX - padX, xMax = this._maxX + padX;
    const yMin = this._minY - padY, yMax = this._maxY + padY;

    const X = (v) => M.left + (W * (v - xMin)) / Math.max(1e-9, (xMax - xMin));
    const Y = (v) => M.top  + H - (H * (v - yMin)) / Math.max(1e-9, (yMax - yMin));

    // grid
    const stepX = niceStep(xMax - xMin);
    const stepY = niceStep(yMax - yMin);
    push(); stroke(220,220,220,40); strokeWeight(1);
    for (let gx = Math.ceil(xMin/stepX)*stepX; gx <= xMax+1e-9; gx += stepX) line(X(gx), M.top, X(gx), M.top+H);
    for (let gy = Math.ceil(yMin/stepY)*stepY; gy <= yMax+1e-9; gy += stepY) line(M.left, Y(gy), M.left+W, Y(gy));
    pop();
    push(); stroke(220,220,220,160); strokeWeight(1.5);
    line(M.left, M.top+H, M.left+W, M.top+H);
    line(M.left, M.top,   M.left,   M.top+H);
    pop();
    push(); noStroke(); fill(220,220,220,160); textSize(11);
    textAlign(CENTER,TOP);
    for (let gx = Math.ceil(xMin/stepX)*stepX; gx <= xMax+1e-9; gx += stepX) text(nf(gx,0,1), X(gx), M.top+H+8);
    textAlign(RIGHT, CENTER);
    for (let gy = Math.ceil(yMin/stepY)*stepY; gy <= yMax+1e-9; gy += stepY) text(nf(gy,0,1), M.left-8, Y(gy));
    pop();

    // axis captions
    push(); noStroke(); fill(220); textSize(12); textAlign(CENTER, TOP);
    text(this._xCol, M.left + W/2, M.top + H + 34);
    push(); translate(24, M.top + H/2); rotate(-HALF_PI); text(this._yCol, 0, 0); pop();
    pop();

    // category palette 
    const palette = [
      color(72,125,245), color(255,130,170), color(120,210,120), color(255,185,90),
      color(178,140,255), color(95,205,255), color(255,110,120), color(110,220,190),
      color(210,160,120), color(240,120,220), color(140,180,255), color(255,160,120)
    ];
    const catKeys = [...new Set(this._rows.map(d=>d.cat).filter(Boolean))];
    const catMap = {}; catKeys.forEach((c,i)=> catMap[c] = palette[i % palette.length]);

    // regression (on all points)
    let reg = null;
    if (this._rows.length >= 2) reg = linreg(this._rows);

    // regression glow + moving probe
    if (reg) {
      const x0 = xMin, x1 = xMax;
      const y0 = reg.a + reg.b * x0;
      const y1 = reg.a + reg.b * x1;

      // glow band
      push();
      stroke(255,255,255,50); strokeWeight(2.2);
      line(X(x0), Y(y0), X(x1), Y(y1));
      stroke(255,255,255,22); strokeWeight(8);
      line(X(x0), Y(y0), X(x1), Y(y1));
      pop();

      // probe dot slides along the line (loop)
      const tt = (millis()/1600) % 1;
      const px = lerp(X(x0), X(x1), tt), py = lerp(Y(y0), Y(y1), tt);
      const pr = 6 + 2.5 * Math.sin(millis()/220);
      push();
      noStroke(); fill(255,240,180,220); circle(px, py, pr);
      noFill(); stroke(255,240,180,120); strokeWeight(2); circle(px, py, pr+8);
      pop();

      // stats chip
      const panelX = width - 250, panelY = M.top + 10, panelW = 210, panelH = 64;
      push();
      noStroke(); fill(0,0,0,140); rect(panelX, panelY, panelW, panelH, 12);
      stroke(255,255,255,60); noFill(); rect(panelX, panelY, panelW, panelH, 12);
      noStroke(); fill(255); textAlign(LEFT, TOP); textSize(12);
      text('y = a + b·x', panelX + 12, panelY + 8);
      fill(220);
      text('a: ' + nf(reg.a,0,3) + '    b: ' + nf(reg.b,0,3), panelX + 12, panelY + 28);
      text('R²: ' + nf(reg.r2,0,3), panelX + 12, panelY + 46);
      pop();
    }

    // animated points
    const t = millis()/1000;
    let hoverIdx = -1, hoverDist = 1e9;

    for (let i=0; i<this._rows.length; i++) {
      const d = this._rows[i];
      const baseX = X(d.x), baseY = Y(d.y);

      // little floating drift per-point 
      const driftX = 2.0 * Math.sin(t*0.9 + i*0.37);
      const driftY = 2.0 * Math.cos(t*0.8 + i*0.53);

      const px = baseX + driftX;
      const py = baseY + driftY;

      // reveal scale & pulse
      const grow = 0.6 + 0.8 * reveal;
      const pulse = 1 + 0.08 * Math.sin(millis()/240 + i*0.33);
      const R = 4 * grow * pulse;

      const col = d.cat ? catMap[d.cat] : color(120,180,255);

      // track hover
      const dd = dist(mouseX, mouseY, px, py);
      if (dd < hoverDist && dd < 18) { hoverDist = dd; hoverIdx = i; }

      // draw
      push();
      noStroke();
      fill(red(col), green(col), blue(col), 70); circle(px, py, R+8); // halo
      fill(col); circle(px, py, R);
      pop();
    }

    // legend 
    if (catKeys.length) {
      const lx = width - 260, ly = M.top + 90;
      push(); noStroke(); fill(0,0,0,140); rect(lx, ly, 220, 18*catKeys.length + 20, 12);
      stroke(255,255,255,50); noFill(); rect(lx, ly, 220, 18*catKeys.length + 20, 12);
      noStroke(); textSize(12); textAlign(LEFT, CENTER);
      let yy = ly + 14;
      for (let k=0; k<catKeys.length; k++) {
        const c = catKeys[k], col = catMap[c];
        fill(col); circle(lx+16, yy+2, 8);
        fill(230); text(c, lx+30, yy);
        yy += 18;
      }
      pop();
    }

    // tooltip on hover 
    if (hoverIdx >= 0) {
      const d = this._rows[hoverIdx];
      const lines = [
        (d.label ? d.label : 'Row ' + (d.i+1)),
        this._xCol + ': ' + nf(d.x,0,2),
        this._yCol + ': ' + nf(d.y,0,2),
        (d.cat ? ('Group: ' + d.cat) : null)
      ].filter(Boolean);
      tooltipBox(mouseX+12, mouseY-12, lines);
    }
  };
}

/*helpers */
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }

function linreg(pts){
  const n=pts.length; let sx=0,sy=0,sxx=0,syy=0,sxy=0;
  for (let i=0;i<n;i++){ const x=pts[i].x,y=pts[i].y; sx+=x; sy+=y; sxx+=x*x; syy+=y*y; sxy+=x*y; }
  const denom = (n*sxx - sx*sx);
  const b = denom!==0 ? (n*sxy - sx*sy) / denom : 0;
  const a = (sy - b*sx) / n;
  const r = (n*sxy - sx*sy) / ((sqrt(n*sxx - sx*sx) * sqrt(n*syy - sy*sy)) || 1);
  return {a:a, b:b, r:r, r2:r*r};
}

function niceStep(range){
  const span = Math.abs(range)||1;
  let step = Math.pow(10, Math.floor(Math.log10(span)) - 1);
  const choices=[1,2,5,10];
  let pick = step;
  for (let i=0;i<choices.length;i++){
    const c = choices[i]*step;
    if (span/c <= 8){ pick=c; break; }
  }
  return pick;
}

function tooltipBox(tx, ty, lines){
  const pad=8; push(); textSize(12);
  let tw = 0; for (let i=0;i<lines.length;i++) tw = max(tw, textWidth(lines[i]));
  tw += pad*2;
  const th = lines.length*18 + pad*2;
  if (tx + tw > width) tx = width - tw - 6;
  if (ty - th < 0) ty = th + 6;
  noStroke(); fill(0,0,0,210); rect(tx, ty - th, tw, th, 8);
  stroke(255,255,255,70); noFill(); rect(tx, ty - th, tw, th, 8);
  noStroke(); fill(255); textAlign(LEFT,TOP);
  for (let i=0;i<lines.length;i++) text(lines[i], tx+pad, ty - th + pad + i*18);
  pop();
}











