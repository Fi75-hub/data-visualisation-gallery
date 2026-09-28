try { playIntroAnimation(); } catch (e) {}

function StreamGraphChart() {
  this.name = 'Device Usage Streamgraph';
  this.id = 'streamgraph-chart';
  this.loaded = false;

  // UI state
  this.revealT0 = 0;
  this.percentMode = false;     // ABS vs %
  this.soloLayer = -1;          // legend click to isolate 
  this.hoveredLayer = -1;

  // hit targets
  this._legendBoxes = [];
  this._modeToggle = { x: 0, y: 0, w: 0, h: 0 };

  // utils 
  this._sum = arr => arr.reduce((a, b) => a + b, 0);
  this._mean = arr => this._sum(arr) / Math.max(1, arr.length);
  this._movAvg = function (arr, w) {
    var out = new Array(arr.length);
    var r = Math.floor(w / 2);
    for (var i = 0; i < arr.length; i++) {
      var s = 0, c = 0;
      for (var k = i - r; k <= i + r; k++) {
        if (k >= 0 && k < arr.length) { s += arr[k]; c++; }
      }
      out[i] = s / Math.max(1, c);
    }
    return out;
  };

  // palette
  this._palette = [
    [ 66, 179, 213, 200], // teal
    [239, 133,  83, 200], // orange
    [145, 153, 203, 200], // blue
    [214, 121, 191, 200], // pink
    [165, 214,  83, 200], // green
    [252, 216,  82, 200]  // yellow
  ];

  //  ordering 
  this._insideOutOrder = function (series) {
    var idx = series.map((s, i) => ({ i, area: this._sum(s) }))
                    .sort((a, b) => b.area - a.area)     // big → small
                    .map(o => o.i);
    var top = [], bottom = [], balance = 0;
    for (var k = 0; k < idx.length; k++) {
      var i = idx[k], weight = this._sum(series[i]);
      if (balance <= 0) { top.push(i); balance += weight; }
      else { bottom.push(i); balance -= weight; }
    }
    bottom.reverse();
    return bottom.concat(top); // bottom layers first, then top layers
  };

  // rect hit test
  this._hit = function (x, y, w, h) {
    return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  };

  this.preload = function () {
    var self = this;
    this.data = loadTable('./data/stream-data.csv', 'csv', 'header', function () {
      self.loaded = true;
    });
  };

  this.setup = function () {
    this.revealT0 = millis();
  };

  this.destroy = function () {};

  this.mousePressed = function () {
    // ABS ↔ % toggle
    if (this._hit(this._modeToggle.x, this._modeToggle.y, this._modeToggle.w, this._modeToggle.h)) {
      this.percentMode = !this.percentMode;
      this.revealT0 = millis();
      return;
    }
    // legend solo
    for (var i = 0; i < this._legendBoxes.length; i++) {
      var b = this._legendBoxes[i];
      if (this._hit(b.x, b.y, b.w, b.h)) {
        this.soloLayer = (this.soloLayer === b.layer ? -1 : b.layer);
        this.revealT0 = millis();
        return;
      }
    }
  };

  this.draw = function () {
    background(7, 16, 34);

    if (!this.loaded) {
      fill(230); noStroke(); textAlign(CENTER, CENTER);
      text('Loading...', width / 2, height / 2);
      return;
    }

    try { drawTitleBox(this.name); }
    catch (e) { fill(230); noStroke(); textAlign(CENTER, TOP); textSize(20); text(this.name, width/2, 10); }

    // layout
    var left = 80, right = width - 40, top = 70, bottom = height - 60;
    var plotW = right - left, plotH = bottom - top;

    // data columns
    var yrs = this.data.getColumn('year').map(v => parseInt(v, 10));
    var cats = this.data.columns.slice(1);
    var seriesRaw = [];
    for (var c = 0; c < cats.length; c++) {
      seriesRaw[c] = this.data.getColumn(cats[c]).map(v => parseFloat(v));
    }
    var n = yrs.length;

    var order = this._insideOutOrder(seriesRaw);
    cats = order.map(i => cats[i]);
    var series = order.map(i => seriesRaw[i]);

    // totals per x
    var totals = new Array(n);
    for (var i = 0; i < n; i++) {
      var t = 0; for (var j = 0; j < series.length; j++) t += series[j][i];
      totals[i] = t;
    }

    // ABS vs % values
    var seriesDraw = [];
    if (this.percentMode) {
      for (j = 0; j < series.length; j++) {
        seriesDraw[j] = new Array(n);
        for (i = 0; i < n; i++) {
          seriesDraw[j][i] = totals[i] ? (series[j][i] / totals[i]) * 100 : 0;
        }
      }
    } else {
      seriesDraw = series;
    }

    // vertical domain
    var maxTotal = 0;
    for (i = 0; i < n; i++) {
      var sTot = 0; for (j = 0; j < seriesDraw.length; j++) sTot += seriesDraw[j][i];
      if (sTot > maxTotal) maxTotal = sTot;
    }
    var scale = plotH / Math.max(1e-9, maxTotal);

    //  totals for a calmer centered baseline
    var totalsSmooth = this._movAvg(
      Array.from({ length: n }, (_, i2) => {
        var sum = 0; for (var k = 0; k < seriesDraw.length; k++) sum += seriesDraw[k][i2];
        return sum;
      }), 7
    );

    // cumulative previous heights
    var cumPrev = new Array(seriesDraw.length);
    for (j = 0; j < seriesDraw.length; j++) cumPrev[j] = new Array(n).fill(0);
    for (i = 0; i < n; i++) {
      var run = 0;
      for (j = 0; j < seriesDraw.length; j++) {
        cumPrev[j][i] = run;
        run += seriesDraw[j][i];
      }
    }

    // reveal 
    var progress = constrain((millis() - this.revealT0) / 900, 0, 1);
    var iMax = floor(1 + (n - 1) * progress);

    // axes
    stroke(120); strokeWeight(1);
    line(left, bottom, right, bottom);
    line(left, top, left, bottom);
    noStroke(); fill(200); textSize(11); textAlign(CENTER, TOP);
    for (i = 0; i < n; i++) {
      var xt = map(i, 0, n - 1, left, right);
      if (i % 2 === 0) text(yrs[i], xt, bottom + 6);
    }
    var steps = 4;
    for (var s = 1; s <= steps; s++) {
      var v = maxTotal * s / steps;
      var yy = bottom - v * scale;
      stroke(60); line(left, yy, right, yy);
      noStroke(); fill(180); textAlign(RIGHT, CENTER);
      text(this.percentMode ? nf(v, 1, 0) + '%' : nf(v, 1, 0), left - 8, yy);
    }
    noStroke(); fill(230); textAlign(CENTER, BOTTOM);
    text('Year', (left + right) / 2, height - 10);
    push(); translate(24, (top + bottom) / 2); rotate(-HALF_PI);
    text(this.percentMode ? 'Share (%)' : 'Usage (relative)', 0, 0);
    pop();

    // determine hovered layer at nearest x
    var ix = round(map(mouseX, left, right, 0, n - 1));
    ix = constrain(ix, 0, n - 1);
    var insidePlot = (mouseX > left && mouseX < right && mouseY > top && mouseY < bottom);
    this.hoveredLayer = -1;
    if (insidePlot) {
      var baseY = top + (plotH - totalsSmooth[ix] * scale) / 2;
      for (j = 0; j < seriesDraw.length; j++) {
        var y0 = baseY + cumPrev[j][ix] * scale;
        var y1 = y0 + seriesDraw[j][ix] * scale;
        if (mouseY >= y0 && mouseY <= y1) { this.hoveredLayer = j; break; }
      }
    }
    push();
    curveTightness(0.3);

    // draw layers
    var PAD = 2; // how many virtual points to repeat at ends
    for (var layer = 0; layer < seriesDraw.length; layer++) {
      var col = this._palette[layer % this._palette.length];
      var alpha = col[3];

      if (this.soloLayer !== -1 && layer !== this.soloLayer) alpha = 70;
      if (this.hoveredLayer !== -1 && layer !== this.hoveredLayer) alpha = Math.min(alpha, 120);

      noStroke(); fill(col[0], col[1], col[2], alpha);

      beginShape();

      // TOP edge 
      for (i = -PAD; i < iMax + PAD; i++) {
        var ii = constrain(i, 0, iMax - 1);
        var x = map(ii, 0, n - 1, left, right);
        var base = top + (plotH - totalsSmooth[ii] * scale) / 2;
        var y = base + (cumPrev[layer][ii] + seriesDraw[layer][ii]) * scale;
        curveVertex(x, y);
      }

      // BOTTOM edge
      for (i = iMax - 1 + PAD; i >= -PAD; i--) {
        ii = constrain(i, 0, iMax - 1);
        x = map(ii, 0, n - 1, left, right);
        base = top + (plotH - totalsSmooth[ii] * scale) / 2;
        y = base + (cumPrev[layer][ii]) * scale;
        curveVertex(x, y);
      }

      endShape(CLOSE);

      // crisp outline on hovered 
      if ((this.hoveredLayer === layer || this.soloLayer === layer) && iMax > 2) {
        noFill();
        stroke(255); strokeWeight(1.6);
        beginShape();
        for (i = -PAD; i < iMax + PAD; i++) {
          ii = constrain(i, 0, iMax - 1);
          x = map(ii, 0, n - 1, left, right);
          base = top + (plotH - totalsSmooth[ii] * scale) / 2;
          y = base + (cumPrev[layer][ii] + seriesDraw[layer][ii]) * scale;
          curveVertex(x, y);
        }
        for (i = iMax - 1 + PAD; i >= -PAD; i--) {
          ii = constrain(i, 0, iMax - 1);
          x = map(ii, 0, n - 1, left, right);
          base = top + (plotH - totalsSmooth[ii] * scale) / 2;
          y = base + (cumPrev[layer][ii]) * scale;
          curveVertex(x, y);
        }
        endShape(CLOSE);
      }
    }
    pop(); 

    // vertical guide + tooltip
    if (insidePlot) {
      var vx = map(ix, 0, n - 1, left, right);
      stroke(255, 110); line(vx, top, vx, bottom);

      var lines = ['Year: ' + yrs[ix]];
      var totAbs = totals[ix];
      for (j = 0; j < seriesDraw.length; j++) {
        var lab = cats[j] + ': ';
        if (this.percentMode) {
          var pct = totAbs ? (seriesRaw[j][ix] / totAbs) * 100 : 0;
          lab += nf(pct, 1, 1) + '%';
        } else {
          lab += nf(seriesRaw[j][ix], 1, 0);
          var share = totAbs ? (seriesRaw[j][ix] / totAbs) * 100 : 0;
          lab += ' (' + nf(share, 1, 1) + '%)';
        }
        lines.push(lab);
      }
      if (!this.percentMode) lines.splice(1, 0, 'Total: ' + nf(totAbs, 1, 0));

      textSize(12);
      var tw = 0; for (i = 0; i < lines.length; i++) tw = Math.max(tw, textWidth(lines[i]));
      var bx = Math.min(Math.max(vx + 12, left), right - (tw + 16));
      var by = top + 10, bw = tw + 16, bh = 18 * lines.length + 6;
      noStroke(); fill(255, 242); rect(bx, by, bw, bh, 6);
      fill(30); textAlign(LEFT, TOP);
      for (i = 0; i < lines.length; i++) text(lines[i], bx + 8, by + 6 + 18 * i);
    }

    // legend 
    this._legendBoxes = [];
    var lx = left + 10, ly = top - 28, stepX = 120;
    textSize(11); textAlign(LEFT, CENTER);
    for (j = 0; j < cats.length; j++) {
      var col = this._palette[j % this._palette.length];
      var bx1 = lx + j * stepX, by1 = ly - 6, bw1 = 14, bh1 = 14;
      fill(col[0], col[1], col[2], 220); noStroke(); rect(bx1, by1, bw1, bh1, 3);
      fill(230);
      var lbl = cats[j] + (this.soloLayer === j ? ' (solo)' : '');
      text(lbl, bx1 + 18, ly);
      this._legendBoxes.push({ x: bx1, y: by1, w: Math.max(60, textWidth(lbl) + 22), h: 16, layer: j });
    }

    // mode toggle (ABS / %)
    var pillW = 84, pillH = 22;
    var px = right - pillW, py = top - 34;
    this._modeToggle = { x: px, y: py, w: pillW, h: pillH };
    noStroke(); fill(255, 235); rect(px, py, pillW, pillH, 12);
    fill(30); textAlign(CENTER, CENTER); textSize(12);
    text(this.percentMode ? '% mode' : 'ABS mode', px + pillW / 2, py + pillH / 2);
  };
}
