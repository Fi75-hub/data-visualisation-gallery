// Data processing of helper functions.
function sum(data) {
  var total = 0;

  // Ensure data contains only numbers and not strings.
  data = stringsToNumbers(data);

  for (let i = 0; i < data.length; i++) {
    total = total + data[i];
  }

  return total;
}

function mean(data) {
  var total = sum(data);

  return total / data.length;
}

function sliceRowNumbers (row, start=0, end) {
  var rowData = [];

  if (!end) {
    // Parse all values until end of row.
    end = row.arr.length;
  }

  for (i = start; i < end; i++) {
    rowData.push(row.getNum(i));
  }

  return rowData;
}

function stringsToNumbers (array) {
  return array.map(v => {
    if (v === null || v === undefined) return NaN;
    const t = String(v).replace(/,/g, '').trim();
    if (t === '' || t.toLowerCase() === 'na' || t.toLowerCase() === 'n/a') return NaN;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  });
}

// Plot the helper functions

function drawAxis(layout, colour=0) {
  stroke(color(colour));

  // x-axis
  line(layout.leftMargin,
  layout.bottomMargin,
  layout.rightMargin,
  layout.bottomMargin);

  // y-axis
  line(layout.leftMargin,
  layout.topMargin,
  layout.leftMargin,
  layout.bottomMargin);
}

function drawAxisLabels(xLabel, yLabel, layout) {
  fill(230);
  noStroke();
  textAlign('center', 'center');

  // Drawing x-axis label.
  text(xLabel,
  (layout.plotWidth() / 2) + layout.leftMargin,
  layout.bottomMargin + (layout.marginSize * 1.5));

  // Drawing y-axis label.
  push();
  translate(layout.leftMargin - (layout.marginSize * 1.5),
 layout.bottomMargin / 2);
  rotate(- PI / 2);
  text(yLabel, 0, 0);
  pop();
}

function drawYAxisTickLabels(min, max, layout, mapFunction,
  decimalPlaces) {
  // Map function should always passed with.
  var range = max - min;
  var yTickStep = range / layout.numYTickLabels;

  fill(230);
  noStroke();
  textAlign('right', 'center');

  // Drawing all axis tick labels and grid lines.
  for (i = 0; i <= layout.numYTickLabels; i++) {
    var value = min + (i * yTickStep);
    var y = mapFunction(value);

    // Adding tick label.
    text(value.toFixed(decimalPlaces),
         layout.leftMargin - layout.pad,
         y);

    if (layout.grid) {
      // Adding grid line.
      stroke(200);
      line(layout.leftMargin, y, layout.rightMargin, y);
    }
  }
}

function drawXAxisTickLabel(value, layout, mapFunction) {
  // Map function should be passed with .bind(this).
  var x = mapFunction(value);

  fill(230);
  noStroke();
  textAlign('center', 'center');

  // Adding tick label.
  text(value,
   x,
    layout.bottomMargin + layout.marginSize / 2);

  if (layout.grid) {
    // Adding grid line.
    stroke(220);
    line(x,
   layout.topMargin,
    x,
    layout.bottomMargin);
  }
}

function playIntroAnimation() {
  var cv = document.getElementById('main-canvas');
  if (!cv) return;
  cv.classList.remove('pulse');
  void cv.offsetWidth;
  cv.classList.add('pulse');
  setTimeout(function(){ cv.classList.remove('pulse'); }, 1200);
}


// Shared title renderer for consistent UI
function drawTitle(title) {
  push();
  textSize(20);
  textAlign(CENTER, CENTER);
  const pad = 12;
  const w = textWidth(title) + pad * 2;
  const h = 28;
  const x = width / 2 - w / 2;
  const y = 10;
  noStroke();
  fill(255, 240);
  rect(x, y, w, h, 6);
  fill(30);
  text(title, width / 2, y + h / 2);
  pop();
}
