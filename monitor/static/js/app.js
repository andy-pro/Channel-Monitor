/*
 * client side
 * Channel Monitor System
 * UkSATSE
 * Telecommunication Service
 * web2spa - together we go to the single page app!
 * andy-pro 2016
 */

_ = web2spa;
 
var app = {
  name: 'monitor'
}

$(function () {
  
  _.init({
    
    app: app.name,
    selector: 'a:not(a[data-bypass])',
    lexicon: 'lexicon',
    esc_back: true,
    
    routes: [
      ['Monitor', {index:true}],
      ['Log'],
      ['Config']
    ],
    
    beforeStart: function () {
      L = _.lexicon.data;
      // channel state presets
      L.up = '<i class="glyphicon glyphicon-ok" style="color:#3f3"></i>';
      L.down = '<i class="glyphicon glyphicon-remove" style="color:#f33"></i>';
      L.off = '<i class="glyphicon glyphicon-minus" style="color:#777"></i>';    
      AlarmCtrl();
      WDTCtrl();
      _.render({ templateId:'HeaderTmpl', targetEl: 'header'});
     }, 
     
    beforeNavigate: function() {
      //
    },  
    
    afterNavigate: function() {
      //
    }
    
  });
  
});