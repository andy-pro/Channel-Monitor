/*** MonitorController ***/
function MonitorCtrl() {
  
  _.load_and_render(null, function() {
    app.tds = $('.channel-state'); // array of <td>, contains channel's state
    var i = parseInt($scope.interval);
    app.refresh_interval = i * 1000;
    app.WDT.timeout = i * 2;
    clearInterval(app.refresh_handler);
    app.refresh_handler = setInterval(refreshMonitor, app.refresh_interval);
  }, refreshMonitor); 

  function refreshMonitor() {
    _.load({
      url:'getstate',
      onload: function(data) {
        if (data) {
          app.tds.each(function(i, td) { td.innerHTML = L[data.td[i]] || L._ERROR_; });
          if (data.alarm && !app.alarm) {
            app.alarm = true;
            _.show_msg(L._ALARM_);            
          }
          if (data.connect) {
            if (!app.alarm) _.show_msg(L._RFR_, 'success', 1);
            app.WDT.counter = 0;
          }
        }
      }
    });    
  }

}
/* end MonitorController */

/*** LogController ***/
function LogCtrl() {

  _.render();  

  var form = new Form({
        safe: true,
        onpost: function(data) {
          ta.val(data.log).caretToEnd();
        }
      }), 
      ta = $('textarea');  
  form.post();

}
/* end LogController */

/*** AlarmController ***/
function AlarmCtrl() {
  
  _.msg_div.click(function() {
    app.alarm = false;
    _.load({
      url: 'query',
      vars: {command: 'alm'}
    });
  });
  
}
/* end AlarmController */

/*** WatchDogTimerController ***/
function WDTCtrl() {

  var WDT = {
    counter: 0,
    timeout: 5, // watchdog counter timeout
  }
  
  setInterval(function() {
    if (WDT.counter === WDT.timeout) {
      WDT.counter++;
      console.warn(L._COMM_ERR_);
      _.show_msg(L._COMM_ERR_);
      app.alarm = false;
    } else if (WDT.counter < WDT.timeout) WDT.counter++;
  }, 1000);
  
  app.WDT = WDT;
  
}
/* end WatchDogTimerController */

/*** ConfigController ***/
function ConfigCtrl() {
  
  function addToArea(data) {
    if (typeof data === 'object') data = data.status;
    ta.val(ta.val() + data + '\n\n').caretToEnd();;
    fi.focus().select();
  }
  
  function clearArea() {
    ta.val('');
    return false;
  }

  function clearLog() {
    if (confirm("A you sure?")) {
      _.load({
        url:'clearlog',
        onload: addToArea
      });
    }
    return false;
  }

  _.render();
  
  var form = new Form({
        safe: true,
        onpost: addToArea,
        events: {
          'click #clear':clearArea,
          'click #clearlog':clearLog
        }
      }), 
      ta = $('textarea'),
      fi = form.inputfirst;
  
  form.init();

}
/* end ConfigController */
