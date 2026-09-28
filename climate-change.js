try { playIntroAnimation(); } catch (e) {}

function ClimateChange() {
  this.name = 'Climate Change';
  this.id = 'climate-change';

  this.xAxisLabel = 'Year';
  this.yAxisLabel = '°C anomaly';

  this.loaded = false;
  this.playing = false;
  this.yearsPerFrame = 2;

  this.preload = function () {
    var self = this;
    this.data = loadTable(
      './data/surface-temperature/surface-temperature.csv',
      'csv',
      'header',
      function () { self.loaded = true; }
    );
  };

  this.setup = function () {
    if (!this.loaded) {
      console.log('Data not yet loaded');
      return;
    }

    // data
    this.years = this.data.getColumn('year').map(function (v) { return parseInt(v, 10); });
    this.values = this.data.getColumn('temperature').map(function (v) { return parseFloat(v); });

    this.minYear = Math.min.apply(null, this.years);
    this.maxYear = Math.max.apply(null, this.years);
    this.minTemperature = Math.min.apply(null, this.values);
    this.maxTemperature = Math.max.apply(null, this.values);
    this.meanTemperature = mean(this.values);

    // layout
    var marginSize = 40;
    this.layout = {
      marginSize: marginSize,
      leftMargin: marginSize * 2,
      rightMargin: width - marginSize,
      topMargin: marginSize + 30,
      bottomMargin: height - marginSize * 2,
      pad: 6,
      plotWidth: function () { return this.rightMargin - this.leftMargin; },
      plotHeight: function () { return this.bottomMargin - this.topMargin; },
      grid: false,
      numXTickLabels: 8,
      numYTickLabels: 8
    };

    // sliders
    this.startSlider = createSlider(this.minYear, this.maxYear - 1, this.minYear, 1);
    this.startSlider.position(400, 10);
    this.endSlider = createSlider(this.minYear + 1, this.maxYear, this.maxYear, 1);
    this.endSlider.position(650, 10);

    // 10-year rolling average
    var w = 10;
    this.rolling = [];
    for (var i = 0; i < this.values.length; i++) {
      var s = 0, c = 0;
      for (var k = i - Math.floor((w - 1) / 2); k <= i + Math.floor(w / 2); k++) {
        if (k >= 0 && k < this.values.length) { s += this.values[k]; c++; }
      }
      this.rolling[i] = s / c;
    }

    // play button rect 
    this._btn = { x: 0, y: 0, w: 28, h: 28 };
  };

  this.destroy = function () {
    if (this.startSlider) this.startSlider.remove();
    if (this.endSlider) this.endSlider.remove();
  };

  this.mousePressed = function () {
    if (!this._btn) return;
    var bx = this._btn.x, by = this._btn.y, bw = this._btn.w, bh = this._btn.h;
    if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
      if (this.endSlider.value() >= this.maxYear) {
        this.startSlider.value(this.minYear);
        this.endSlider.value(this.minYear + 1);
      }
      this.playing = !this.playing;
    }
  };

  this.draw = function () {
    background(7, 16, 34);

    if (!this.loaded) {
      fill(230); noStroke(); textAlign(CENTER, CENTER); text('Loading data...', width / 2, height / 2);
      return;
    }

    // title
    try { drawTitleBox(this.name); }
    catch (e) { fill(230); noStroke(); textAlign(CENTER, CENTER); textSize(20); text(this.name, width / 2, 24); }

    // sliders 
    if (this.startSlider.value() >= this.endSlider.value()) {
      this.startSlider.value(this.endSlider.value() - 1);
    }
    this.startYear = this.startSlider.value();
    this.endYear = this.endSlider.value();

    // animate
    if (this.playing) {
      var nextEnd = this.endSlider.value() + this.yearsPerFrame;
      if (nextEnd >= this.maxYear) {
        this.endSlider.value(this.maxYear);
        this.playing = false; // stop cleanly at the end
      } else {
        this.endSlider.value(nextEnd);
      }
    }

    // axes & labels
    drawYAxisTickLabels(this.minTemperature, this.maxTemperature, this.layout,
      this.mapTemperatureToHeight.bind(this), 1);
    drawAxis(this.layout, 230);
    drawAxisLabels(this.xAxisLabel, this.yAxisLabel, this.layout);

    // 0° baseline
    stroke(120, 150); strokeWeight(1);
    var y0 = this.mapTemperatureToHeight(0);
    line(this.layout.leftMargin, y0, this.layout.rightMargin, y0);
    noStroke(); fill(230, 90); textAlign(LEFT, BOTTOM); text('0° baseline', this.layout.leftMargin + 8, y0 - 4);

    // figure out index range from slider years
    var idxStart = this.years.indexOf(this.startYear); if (idxStart < 0) idxStart = 0;
    var idxEnd = this.years.indexOf(this.endYear); if (idxEnd < 0) idxEnd = this.years.length - 1;

    var numYears = max(1, this.endYear - this.startYear);
    var segmentWidth = this.layout.plotWidth() / numYears;

    // heat stripes
    for (var i = idxStart; i < idxEnd; i++) {
      var x = this.mapYearToWidth(this.years[i]) - segmentWidth / 2;
      var c = this.mapTemperatureToColour(this.values[i]); c.setAlpha(90);
      noStroke(); fill(c);
      rect(x, this.layout.topMargin, segmentWidth, this.layout.plotHeight());
    }

    // annual line 
    noFill();
    for (var g = 6; g >= 1; g--) {
      stroke(255, 255, 255, 16 - g * 2);
      strokeWeight(g);
      beginShape();
      for (var i1 = idxStart; i1 <= idxEnd; i1++) {
        var xx = this.mapYearToWidth(this.years[i1]);
        var yy = this.mapTemperatureToHeight(this.values[i1]);
        curveVertex(xx, yy);
      }
      endShape();
    }

    // 10-yr average
    stroke(255); strokeWeight(2);
    beginShape();
    for (var i2 = idxStart; i2 <= idxEnd; i2++) {
      var xx2 = this.mapYearToWidth(this.years[i2]);
      var yy2 = this.mapTemperatureToHeight(this.rolling[i2]);
      curveVertex(xx2, yy2);
    }
    endShape();

    // legend pill (top-left)
    var lx = this.layout.leftMargin + 8;
    var ly = this.layout.topMargin - 26;
    textSize(11); textAlign(LEFT, CENTER);
    noStroke(); fill(255, 230); rect(lx - 6, ly - 10, 210, 20, 6);
    // avg swatch
    fill(30); stroke(255, 120); strokeWeight(3);
    line(lx + 12, ly, lx + 36, ly);
    noStroke(); fill(30); text('10-year avg', lx + 44, ly + 1);
    // annual swatch
    stroke(255, 255, 255, 80); strokeWeight(4); line(lx + 110, ly, lx + 138, ly);
    noStroke(); fill(30); text('Annual', lx + 146, ly + 1);

    // hover tooltip
    if (mouseX > this.layout.leftMargin && mouseX < this.layout.rightMargin &&
        mouseY > this.layout.topMargin && mouseY < this.layout.bottomMargin) {
      var yr = round(map(mouseX, this.layout.leftMargin, this.layout.rightMargin, this.startYear, this.endYear));
      yr = constrain(yr, this.startYear, this.endYear);
      var idx = this.years.indexOf(yr);
      if (idx !== -1) {
        var vx = this.mapYearToWidth(yr);
        var vy = this.mapTemperatureToHeight(this.values[idx]);
        stroke(255, 80); strokeWeight(1); line(vx, this.layout.topMargin, vx, this.layout.bottomMargin);
        fill(255); noStroke(); ellipse(vx, vy, 6, 6);

        var ra = this.rolling[idx];
        var box = 'Year: ' + yr + '\nAnomaly: ' + nf(this.values[idx], 1, 3) + '°C' +
                  '\n10yr avg: ' + nf(ra, 1, 3) + '°C';
        textSize(12);
        var tw = textWidth('Anomaly: -0.000°C   ') + 10;
        var th = 40;
        var bx = vx + 12, by = vy - th - 10;
        bx = constrain(bx, this.layout.leftMargin, this.layout.rightMargin - tw);
        by = constrain(by, this.layout.topMargin, this.layout.bottomMargin - th);
        fill(255, 240); stroke(30, 80); strokeWeight(1); rect(bx, by, tw, th, 6);
        noStroke(); fill(30); textAlign(LEFT, TOP); text(box, bx + 6, by + 4);
      }
    }

    // PLAY BUTTON 
    var bw = 28, bh = 28;
    var bx = this.layout.rightMargin - bw; 
    var by = 8;
    this._btn.x = bx; this._btn.y = by; this._btn.w = bw; this._btn.h = bh;

    noStroke(); fill(255, 230); rect(bx, by, bw, bh, 6);
    fill(30);
    if (this.playing) {
      // pause icon
      rect(bx + 8, by + 5, 4, 18, 1);
      rect(bx + 16, by + 5, 4, 18, 1);
    } else {
      // play icon
      triangle(bx + 9, by + 5, bx + 9, by + 23, bx + 21, by + 14);
    }

    // show current year range under sliders
    textSize(11); fill(200); noStroke(); textAlign(CENTER, TOP);
    text(this.startSlider.value(), this.startSlider.x + this.startSlider.width / 2, this.startSlider.y + 18);
    text(this.endSlider.value(),   this.endSlider.x   + this.endSlider.width   / 2, this.endSlider.y   + 18);
  };

  // helpers
  this.mapYearToWidth = function (value) {
    return map(value, this.startYear, this.endYear, this.layout.leftMargin, this.layout.rightMargin);
  };

  this.mapTemperatureToHeight = function (value) {
    return map(value, this.minTemperature, this.maxTemperature, this.layout.bottomMargin, this.layout.topMargin);
  };

  this.mapTemperatureToColour = function (value) {
    var r = map(value, this.minTemperature, this.maxTemperature, 0, 255);
    var b = 255 - r;
    return color(r, 0, b, 120);
  };
}




