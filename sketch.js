
// Global variable to store all of gallery object.
var gallery;

function setup() {
  // Creating a canvas to fill the content div from index.html.
  var c = createCanvas(1024, 576);
  c.parent('app');
  // Set an id for the canvas so we can control animations via CSS
  c.elt.id = 'main-canvas';
  // ensure canvas has initial hidden state
  c.elt.classList.remove('visible');


  // Creating a new gallery object.
  gallery = new Gallery();

  // Adding the visualisation objects here.
  gallery.addVisual(new TechDiversityRace());
  gallery.addVisual(new TechDiversityGender());
  gallery.addVisual(new PayGapByJob2017());
  gallery.addVisual(new PayGapTimeSeries());
  gallery.addVisual(new ClimateChange());
  gallery.addVisual(new WasteBarChart());
  gallery.addVisual(new CO2LineGraph());
  gallery.addVisual(new StudyScatterPlot());
  gallery.addVisual(new InternetLollipopChart());
  gallery.addVisual(new StudentSkillRadarChart());
  gallery.addVisual(new HeartbeatChart());
  gallery.addVisual(new StreamGraphChart());

}

function draw() {
  background(255);
  if (gallery.selectedVisual != null) {
    gallery.selectedVisual.draw();
    // when a visual is active, animate canvas in
    var cv = document.getElementById('main-canvas');
    if (cv && !cv.classList.contains('visible')) {
      // small timeout for smoother transition
      setTimeout(function(){ cv.classList.add('visible'); }, 60);
    }
  }
}



function mousePressed() {
  try {
    if (gallery && gallery.selectedVisual && typeof gallery.selectedVisual.mousePressed === 'function') {
      gallery.selectedVisual.mousePressed();
    }
  } catch(e) { console.warn(e); }
}

function mouseMoved() {
  try {
    if (gallery && gallery.selectedVisual && typeof gallery.selectedVisual.mouseMoved === 'function') {
      gallery.selectedVisual.mouseMoved();
    }
  } catch(e) { console.warn(e); }
}

// Keyboard navigation
function keyPressed() {
  // Leave text entry, selectors and slider keys to the focused control.
  var focused = document.activeElement;
  if (focused && (focused.matches('input, textarea, select') || focused.isContentEditable)) return;
  try {
    if (!gallery) return;
    if (keyCode === LEFT_ARROW) {
      if (typeof gallery.selectPrevious === 'function') gallery.selectPrevious();
    } else if (keyCode === RIGHT_ARROW) {
      if (typeof gallery.selectNext === 'function') gallery.selectNext();
    } else if (key === 't' || key === 'T') {
      window.tourActive = !window.tourActive;
      if (window.tourActive && !window.tourSteps) {
        //  tour steps if not provided elsewhere
        window.tourSteps = [
          'Step 1: Open "Climate Change". Press RIGHT to go to next visual.',
          'Step 2: Observe the CO₂ line draw animation.',
          'Step 3: Open "Student Skill Radar" to see the radar reveal.',
          'Step 4: Open "Study Hours vs Grades" to try bubble tooltips.',
          'Step 5: Open "Tech Diversity: Gender / Race" to see animated pies.'
        ];
        window.tourStepIndex = 0;
      }
    } else if (key === 's' || key === 'S') {
      try { saveCanvas('chart_snapshot', 'png'); } catch(e){ console.warn('saveCanvas failed', e); }
    } else if (key === 'n' || key === 'N') {
      if (window.tourSteps) window.tourStepIndex = Math.min(window.tourSteps.length-1, (window.tourStepIndex||0) + 1);
    } else if (key === 'p' || key === 'P') {
      if (window.tourSteps) window.tourStepIndex = Math.max(0, (window.tourStepIndex||0) - 1);
    }
  } catch(e) { console.warn(e); }
}

var _original_draw = null;
(function() {
  if (typeof draw === 'function') {
    _original_draw = draw;
    window.draw = function() {
      _original_draw();
      // overlay
      if (window.tourActive && window.tourSteps) {
        noStroke();
        fill(255, 240);
        rect(12, 12, 420, 80, 6);
        fill(30);
        textSize(14);
        textAlign(LEFT, TOP);
        var step = window.tourSteps[window.tourStepIndex||0] || '';
        text('Tour: ' + step, 22, 22, 400, 60);
        textSize(12);
        textAlign(RIGHT, BOTTOM);
        text('Press N/P to navigate steps. T to exit tour.', 420, 82);
      }
    }
  }
})();
