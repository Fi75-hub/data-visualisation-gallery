function TechDiversityGender() {
  // Menu name 
  this.name = 'Tech Diversity: Gender';
  this.id   = 'tech-diversity-gender';

  // Layout
  this.layout = {
    leftMargin: 150,   
    rightMargin: null, 
    topMargin: 40,
    bottomMargin: null, 
    pad: 6,
    plotWidth: function () { return this.rightMargin - this.leftMargin; },
    plotHeight: function () { return this.bottomMargin - this.topMargin; }
  };

  // Colors
  this.femaleColour = color(255, 90, 90);   // red
  this.maleColour   = color(60, 210, 160);  // teal/green
  this.gridColour   = color(110, 120, 140, 110);
  this.textColour   = color(232);

  // Data / state
  this.loaded = false;
  this.data = null;
  this.labelLayer = null; 
  this.hoverRow = -1;      

  //  load data 
  this.preload = function () {
    var self = this;
    this.data = loadTable(
      './data/tech-diversity/gender-2018.csv',
      'csv',
      'header',
      function () { self.loaded = true; }
    );
  };

  // setup 
  this.setup = function () {
    this.layout.rightMargin  = width  - 30;
    this.layout.bottomMargin = height - 30;

    textFont('sans-serif');


    this._buildLabelLayer();
  };

  this.destroy = function () {};

  //  helpers 
  this._mapPercentToWidth = function (percent) {
    return map(percent, 0, 100, 0, this.layout.plotWidth());
  };

  this._beginPlotClip = function () {
    const x = this.layout.leftMargin;
    const y = this.layout.topMargin;
    const w = this.layout.plotWidth();
    const h = this.layout.plotHeight();
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(x, y, w, h);
    drawingContext.clip();
  };

  this._endPlotClip = function () {
    drawingContext.restore();
  };

  this._buildLabelLayer = function () {
    // Draw company 
    if (!this.loaded) return;

    const w = this.layout.leftMargin - 16; // space for labels
    const h = height;
    this.labelLayer = createGraphics(max(1, w), max(1, h));

    const g = this.labelLayer;
    g.clear();
    g.textFont('sans-serif');
    g.textSize(14);
    g.fill(232);
    g.noStroke();
    g.textAlign(RIGHT, CENTER);

    const n = this.data.getRowCount();
    const lineH = this.layout.plotHeight() / n;

    for (let i = 0; i < n; i++) {
      const y = this.layout.topMargin + i * lineH + (lineH / 2);
      const name = this.data.getString(i, 'company');
      g.text(name, w - 2, y); 
    }
  };

  //  drawing 
  this.draw = function () {
    if (!this.loaded) return;

    // Background
    background(11, 18, 32);

    // Grid lines 
    stroke(this.gridColour);
    strokeWeight(1);
    for (let p = 0; p <= 100; p += 25) {
      const x = this.layout.leftMargin + this._mapPercentToWidth(p);
      line(x, this.layout.topMargin, x, this.layout.bottomMargin);
      // top tick labels
      noStroke(); fill(this.textColour); textSize(12); textAlign(CENTER, BOTTOM);
      text(p + '%', x, this.layout.topMargin - 6);
      stroke(this.gridColour);
    }

    // Midline 
    stroke(230, 235, 245, 180);
    strokeWeight(1.4);
    const midX = this.layout.leftMargin + this._mapPercentToWidth(50);
    line(midX, this.layout.topMargin, midX, this.layout.bottomMargin);

    // Title & legend
    noStroke();
    fill(this.textColour);
    textAlign(CENTER, TOP);
    textSize(22);
    text('Tech Diversity: Gender (2018)', width / 2, 8);

    // Legend (top-right)
    const legendX = this.layout.rightMargin - 160;
    const legendY = this.layout.topMargin - 8;
    textAlign(LEFT, BOTTOM); textSize(13);
    // female
    fill(this.femaleColour); noStroke(); rect(legendX + 58, legendY - 10, 18, 10, 3);
    fill(this.textColour); text('Female', legendX + 80, legendY);
    // male
    fill(this.maleColour); rect(legendX + 138, legendY - 10, 18, 10, 3);
    fill(this.textColour); text('Male', legendX + 160, legendY);

    // Draw labels 
    if (this.labelLayer) image(this.labelLayer, 0, 0);

    // Bars + tooltips 
    this._beginPlotClip();

    // Row height
    const n = this.data.getRowCount();
    const lineH = this.layout.plotHeight() / n;

    // Hover detection
    this.hoverRow = -1;

    //  company row
    for (let i = 0; i < n; i++) {
      const yTop = this.layout.topMargin + i * lineH + 2;
      const barH = lineH - this.layout.pad;

      const female = this.data.getNum(i, 'female');
      const male   = this.data.getNum(i, 'male');

      const fW = this._mapPercentToWidth(female);
      const mW = this._mapPercentToWidth(male);

      // female bar 
      noStroke();
      fill(this.femaleColour);
      rect(this.layout.leftMargin, yTop, fW, barH, 6);

      // male bar 
      fill(this.maleColour);
      rect(this.layout.leftMargin + fW, yTop, mW, barH, 6)

      // Hover hit test inside the row’s full bar band
      const insideX = mouseX >= this.layout.leftMargin &&
                      mouseX <= this.layout.leftMargin + fW + mW;
      const insideY = mouseY >= yTop && mouseY <= (yTop + barH);
      if (insideX && insideY) this.hoverRow = i;
    }

    // Tooltip 
    if (this.hoverRow >= 0) {
      const yTop = this.layout.topMargin + this.hoverRow * lineH + 2;
      const barH = lineH - this.layout.pad;
      const female = this.data.getNum(this.hoverRow, 'female');
      const male   = this.data.getNum(this.hoverRow, 'male');
      const company= this.data.getString(this.hoverRow, 'company');

      //  tooltip slightly inside the bar band
      const tx = constrain(mouseX + 14,
        this.layout.leftMargin + 12,
        this.layout.leftMargin + this.layout.plotWidth() - 220);
      const ty = constrain(yTop + barH / 2 - 34,
        this.layout.topMargin + 6,
        this.layout.bottomMargin - 68);

      // Panel
      push();
      noStroke();
      fill(20, 28, 45, 235);
      rect(tx, ty, 210, 68, 10);
      stroke(140, 220, 200); noFill();
      rect(tx, ty, 210, 68, 10);
      pop();

      // Text
      fill(this.textColour); noStroke(); textSize(13); textAlign(LEFT, TOP);
      text(company, tx + 10, ty + 8);
      textSize(12);
      text('Female: ' + nf(female, 1, 1) + '%', tx + 10, ty + 28);
      text('Male: '   + nf(male,   1, 1) + '%', tx + 10, ty + 46);
    }

    this._endPlotClip(); //  clipping 
  };

  // resize
  this.onResize = function () {
    this.layout.rightMargin  = width  - 30;
    this.layout.bottomMargin = height - 30;
    this._buildLabelLayer();
  };
}



