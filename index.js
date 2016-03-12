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
    cluster = require('cluster'),
    colors = require('colors'),
    qs = require('querystring'),
    sp, /* hardware port instance */
    sp_last_cmd,
    getstate_cmd = 'getstate',
    WDT, /* Watch Dog Timer */
    _rst = 10, /* restart time */
    channels = [
      /* channel  1 */ {state: true, title: 'MP2100 Чернiвцi'},
      /* channel  2 */ {state: true, title: 'ОГМД Дубно'},
      /* channel  3 */ {state: true, title: 'ОГМД Iвано-Франкiвсьск'},
      /* channel  4 */ {state: true, title: 'ОГМД КДП-ПРЦ R&S'},
      /* channel  5 */ {state: true, title: 'ОГМД КДП-ПМРЦ R&S'},
      /* channel  6 */ {state: true, title: 'IKM 15/30 system 1'},
      /* channel  7 */ {state: true, title: 'IKM 15/30 system 2'},
      /* channel  8 */ {state: true, title: 'ch8'},
      /* channel  9 */ {state: true, title: 'ch9'},
      /* channel 10 */ {state: true, title: 'ch10'},
      /* channel 11 */ {state: true, title: 'ch11'}, 
      /* channel 12 */ {state: true, title: 'ch12'}
    ],
    sp_cfg = {
      baudrate: 115200,
      parser: serialport.parsers.readline("\n")
    };

function writeToMonitor(cmd) {
  if (sp && sp.isOpen()) {
    sp_last_cmd = cmd;
    sp.write(cmd + '\r');
  }
}

function startMonitor(comName) {
  
  console.log(('Arduino Channel Monitor board found on ' + comName).bold.bgGreen);
    
  sp = new serialport.SerialPort(comName, sp_cfg);
    
  sp.on("open", function () {
    
    var channel_count;

    sp.on('data', function(data) {
      data = data.trim();
      if (sp_last_cmd.charAt(0) == data.charAt(0) && sp_last_cmd == data) return;
      if (sp_last_cmd == getstate_cmd && data) {
        if (WDT > 1) process.stdout.write('\033[' + (+channel_count + 2) + 'A');
        WDT = 1;
        var dt = getDT(),
            res = dt.time.bold.bgYellow,
            query = qs.parse(data.split('?')[1]),
            msg = '';
        channel_count = 0;
        channels.forEach(function(channel) {
          if (!(query.mask & 0x800)) {
            var state = Boolean(query.raw & 0x800),
                status = state ? 'up  '.bold.green : 'down'.bold.red;
            if (state != channel.state) {
              msg += '\n' + dt.dt + ' ' + channel.title + ' change state to ' + status;
              channel.state = state;
            }
            res += '\n' + channel.title + ' ' + status;
            channel_count++;
          }
          query.raw = query.raw << 1;
          query.mask = query.mask << 1;
        });
        process.stdout.write(res + '\n');
        if (msg) {
          console.log(msg);
          WDT = 0; // cursor will be not moved
        }
      } else console.log(data);
    });
    
    sp.on('error', function (err) {
      console.log('SerialPort error'.bold.red, err);
    });  
    
    sp.on('close', function () {
      console.log('SerialPort closed'.bgRed);
      console.log('Try to reconnect');
      process.exit(-1);
    });

    writeToMonitor('ver');
    // writeToMonitor('help');
    
  });
  
}

function getDT(/* get listen Dream Theater */) {
  var date = new Date(),
      time = date.toLocaleTimeString();
  date = date.toLocaleDateString();
  return {
    date: date,
    time: time,
    dt: date + ' ' + time
  }
}

function restartMonitor() {
  if (sp && sp.isOpen()) sp.close();
  else process.exit(-1);  
}
    
if (cluster.isMaster) {
  console.log(
    '\nChannel Monitor System'.bold.yellow,
    '\nUkSATSE'.bold.cyan, 'служба СЭЗ', 
    '\nStarting at', getDT().dt,
    '\n(press Ctrl-C to exit)'
  );
  cluster.fork();

  cluster.on('exit', function(worker, code, signal) {
    console.log('Restart');
    cluster.fork();
  });

} else if (cluster.isWorker) {
  
  serialport.list(function (err, ports) {        
    var comName = '';        
    ports.forEach(function(port) {
      if (/^Arduino/.test(port.manufacturer)) comName = port.comName;
    });        
    if (comName) startMonitor(comName);
    else console.log('Channel Monitor board not found'.bold.red);        
  });
  
  WDT = 0;
  
  setInterval(function() {
    WDT++;
    if (WDT > _rst) restartMonitor();
    else writeToMonitor(getstate_cmd);
  },
  1000); 
    
  
}