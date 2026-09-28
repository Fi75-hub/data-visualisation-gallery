function Gallery() {
/*menu*/

  this.visuals = [];
  this.selectedVisual = null;
  var self = this;

  // Split a name into title/subtitle by colon or last bracket group.
  function splitName(text){
    var t = String(text||'').trim();
    var m = t.match(/^(.*?)(?:\s*[:\-]\s*|\s*\()([^(]*?\d{4}[^)]*)\)?$/);
    if (m) return {title:m[1], sub:m[2]};
    return {title:t, sub:''};
  }
  // Wire up search filter
  function setupSearch(){
    var inp = document.getElementById('menu-search');
    if(!inp) return;
    inp.addEventListener('input', function(){
      var q = this.value.toLowerCase();
      var items = document.querySelectorAll('.sidebar-menu .menu-item');
      items.forEach(function(el){
        var label = (el.getAttribute('data-label')||'').toLowerCase();
        el.style.display = label.indexOf(q) !== -1 ? '' : 'none';
      });
    });
  }
  // init search soon after construction
  setTimeout(setupSearch, 0);



  // visualisation to navigation bar.
  this.addVisual = function(vis) {

    // visualisation object has id and name.
    if (!vis.hasOwnProperty('id') || !vis.hasOwnProperty('name')) {
      alert('Make sure your visualisation has an id and name!');
    }

    //  visualisation object has unique id.
    if (this.findVisIndex(vis.id) != null) {
      alert(`Vis '${vis.name}' has a duplicate id: '${vis.id}'`);
    }

    this.visuals.push(vis);
      
  
    //  menu item.
    var menuItem = createElement('li');
    var parts = splitName(vis.name);
    var iconHtml = '<span class="menu-icon">' + parts.title.charAt(0).toUpperCase() + '</span>';
    var txtHtml = '<div class="menu-text"><span class="title">'+parts.title+'</span>' + (parts.sub?'<span class="subtitle">'+parts.sub+'</span>':'') + '</div>';
    menuItem.html(iconHtml + txtHtml);
    try{ menuItem.attribute('data-label', vis.name);}catch(e){}
    menuItem.addClass('menu-item');
    menuItem.id(vis.id);
    try{ menuItem.attribute('role','button'); menuItem.attribute('tabindex','0'); }catch(e){}
    try{ menuItem.elt.addEventListener('keydown', function(ev){ if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); menuItem.elt.click(); } }); }catch(e){}

    menuItem.style('opacity','0');
    setTimeout(function(){ select('#'+vis.id).style('opacity','1'); }, 80 * (this.visuals.length));
      
    menuItem.mouseOver(function(e)
    {
        
        var targetId = (e.target && e.target.closest) ? e.target.closest('li').id : (e.srcElement||{}).id; var el = select('#' + targetId);
        el.addClass("hover");
    })
      
    menuItem.mouseOut(function(e)
    {
        var targetId = (e.target && e.target.closest) ? e.target.closest('li').id : (e.srcElement||{}).id; var el = select('#' + targetId);
        el.removeClass("hover");
    })
      
    menuItem.mouseClicked(function(e)
    {

        
   var menuItems = selectAll('.menu-item');
        
   for(var i = 0; i < menuItems.length; i++)
   {
   menuItems[i].removeClass('selected');
   }
        
   var targetId = (e.target && e.target.closest) ? e.target.closest('li').id : (e.srcElement||{}).id; var el = select('#' + targetId);
   el.addClass('selected');
        
   var cv = document.getElementById('main-canvas');
   if (cv) { cv.classList.remove('visible'); }
   // wait 1s for fade-out
   setTimeout(function(){ self.selectVisual(targetId); }, 600);
        
    })
      
      
    var visMenu = select('#visuals-menu');
    visMenu.child(menuItem);

    // Preload the data.
    if (vis.hasOwnProperty('preload')) {
      vis.preload();
    }
  };

  this.findVisIndex = function(visId) {

    for (var i = 0; i < this.visuals.length; i++) {
   if (this.visuals[i].id == visId) {
   return i;
   }
    }

  
    return null;
  };

  this.selectVisual = function(visId){
    var visIndex = this.findVisIndex(visId);

    if (visIndex != null) {

      if (this.selectedVisual != null
          && this.selectedVisual.hasOwnProperty('destroy')) {
        this.selectedVisual.destroy();
      }
      // Selecting visualisation in the gallery.
      this.selectedVisual = this.visuals[visIndex];
      try{
        var menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(function(li){ li.classList.remove('selected'); });
        var current = document.getElementById(this.selectedVisual.id);
        if (current){ current.classList.add('selected'); current.scrollIntoView({block:'nearest', behavior:'smooth'}); }
      }catch(e){}

      // Initialise visualisation only if necessary.
      if (this.selectedVisual.hasOwnProperty('setup')) {
        this.selectedVisual.setup();
      }
      
      loop();
    }
  };

  // Select the next visual in the gallery.
  this.selectNext = function() {
    if (!this.selectedVisual) {
      if (this.visuals.length > 0) this.selectVisual(this.visuals[0].id);
      return;
    }
    var idx = this.findVisIndex(this.selectedVisual.id);
    if (idx == null) return;
    var next = (idx + 1) % this.visuals.length;
    this.selectVisual(this.visuals[next].id);
  };

  // Select the previous visual in the gallery.
  this.selectPrevious = function() {
    if (!this.selectedVisual) {
      if (this.visuals.length > 0) this.selectVisual(this.visuals[0].id);
      return;
    }
    var idx = this.findVisIndex(this.selectedVisual.id);
    if (idx == null) return;
    var prev = (idx - 1 + this.visuals.length) % this.visuals.length;
    this.selectVisual(this.visuals[prev].id);
  };
}
