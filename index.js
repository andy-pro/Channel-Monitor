/*
  # Channel Monitor
  #
  # server
  #
  # andy-pro 2016
*/

/*
colors and styles!
text colors

    black
    red
    green
    yellow
    blue
    magenta
    cyan
    white
    gray
    grey

background colors

    bgBlack
    bgRed
    bgGreen
    bgYellow
    bgBlue
    bgMagenta
    bgCyan
    bgWhite

styles

    reset
    bold
    dim
    italic
    underline
    inverse
    hidden
    strikethrough

extras

    rainbow
    zebra
    america
    trap
    random


*/

var serialport = require("serialport"),
    colors = require('colors'),
    sp, /* hardware port instance */
    sp_last_cmd,
    getstate_cmd = 'getstate',
    WDT = -1, /* Watch Dog Timer */
    _rst = 10, /* restart time */
    time, /* local time */
    channels = [
      'MP2100 Чернiвцi',
      'ОГМД Дубно',
      'ОГМД Iвано-Франкiвсьск',
      'ОГМД КДП-ПРЦ R&S',
      'ОГМД КДП-ПМРЦ R&S',
      'IKM 15/30 system 1',
      'IKM 15/30 system 2'
    ],
    channel_count = channels.length,
    cursor_up_cmd = '\033[' + (+channel_count + 3) + 'A',
    sp_cfg = {
      baudrate: 115200,
      parser: serialport.parsers.readline("\n")
    };

function writeToMonitor(cmd) {
  sp_last_cmd = cmd;
  sp.write(cmd + '\r');
}

function startMonitor(comName) {
  
  console.log(('Arduino Channel Monitor board found on ' + comName).bold.bgGreen);
    
  sp = new serialport.SerialPort(comName, sp_cfg);
    
  sp.on("open", function () {
    
    sp.on('data', function(data) {
      data = data.trim();
      if (sp_last_cmd.charAt(0) === data.charAt(0) && sp_last_cmd === data) return;
      if (sp_last_cmd == getstate_cmd && data) {
        if (WDT > 1) process.stdout.write(cursor_up_cmd);
        WDT = 1;
        var s = time.bold.bgYellow;
        channels.forEach(function(i) {
          s += '\n' + i;
        });
        process.stdout.write(s + '\n' + data + '      \n');
      } else console.log(data);
    });
    
    sp.on('error', function (err) {
      console.log('SerialPort error'.bold.red, err);
    });  
    
    sp.on('close', function () {
      WDT = 0;
      sp = null;
      console.log('SerialPort closed.'.bgMagenta);
      console.log('Try to connect in next ' + _rst + 's');
    });

    writeToMonitor('ver');
    // writeToMonitor('help');
    
  });
  
}
    
setInterval(function() {
  WDT++;
  if (sp && sp.isOpen()) {
    if (WDT > _rst) sp.close();
    else {
      time = new Date().toLocaleTimeString();
      writeToMonitor(getstate_cmd);
    }
  } else {
    if (WDT > _rst || !WDT) {
      WDT = 0;
      serialport.list(function (err, ports) {        
        var comName = '';        
        ports.forEach(function(port) {
          if (/^Arduino/.test(port.manufacturer)) comName = port.comName;
        });        
        if (comName) startMonitor(comName);
        else console.log('Channel Monitor board not found'.bold.red);        
      });
    }
  }
}, 1000);
