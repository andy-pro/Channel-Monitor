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
    qs = require('querystring'),
    sp, /* hardware serial port instance */
    sp_last_cmd, /* last command cache */    
    WDT, /* Watch Dog Timer */
    _RST = 100, /* restart time */
    channels = [
      /* channel  1 */ {state: false, title: 'MP2100 Чернiвцi'},
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
    channel_count,
    cmd = {
      getstate: 'getstate',
      ver: 'ver',
      help: 'help'
    },
    dfr = { }, /* deferred object: req, res, state, server - is server service?, cb - responder callback
    state:
      pending  - request send to serial
      begining - request received from serial
      resolved - response received from serial
      rejected - error
    */
    sp_cfg = { /* serial port instance configuration */
      baudrate: 115200,
      parser: serialport.parsers.readline("\r\n")
    };

function writeToMonitor(req, cb) {
  dfr = {
    req: req.trim(),
    state: 'pending',
    server: (typeof cb == 'function') // is there request from web-client?
  };
  if (dfr.server) dfr.cb = cb;  
  // console.log('deferred:', dfr);  
  // console.log('Serial Port:'.bold.red, sp.isOpen());   
  if (sp && sp.isOpen()) sp.write(dfr.req + '\r');
  else if (dfr.server) cb({status: 'serial port closed', time: getDT().dt, query: dfr.req});   
}

function spParseState(data) {
  /* parse getstate command */
  if (WDT > 1) process.stdout.write('\033[' + (+channel_count + 1) + 'A'); // jump cursor to top
  WDT = 1;
  var dt = getDT(),
      res = dt.time.bold.bgYellow,
      query = qs.parse(data.split('?')[1]),
      msg = '';
  channel_count = 0;
  channels.forEach(function(channel, i) {
    if (!(query.mask & 0x800)) {
      var state = Boolean(query.raw & 0x800),
          status = state ? 'up  '.bold.green : 'down'.bold.red,
          title = String(i + 1) + '.' + channel.title;
      if (state != channel.state) {
        msg += '\n' + dt.dt + ' ' + title + ' change state to ' + status;
        channel.state = state;
      }
      res += '\n' + title + ' ' + status;
      channel_count++;
    }
    query.raw = query.raw << 1;
    query.mask = query.mask << 1;
  });
  process.stdout.write(res + '\n');
  if (msg) {
    console.log(msg + '\n');
    WDT = 0; // cursor will be not moved
  }
}

function spParseData(data) {  
  data = data.trim();
  if (dfr.state == 'pending' && dfr.req == data) dfr.state = 'begining';
  else if (dfr.state == 'begining' && data) {
    dfr.state = 'resolved';
    if (dfr.server) {
      dfr.cb({request: dfr.req, response: data});
    } else { // request from self
      if (dfr.req == cmd.getstate) spParseState(data);
      // else console.log(data + '\n');
    }         
  }  
}

function startMonitor(comName) {  
  console.log(('\nArduino Channel Monitor board found on ' + comName).bold.bgGreen);    
  sp = new serialport.SerialPort(comName, sp_cfg);    
  sp.on("open", function () {
    // console.log('SERIAL IS OPENED')
    writeToMonitor(cmd.ver);
    // writeToMonitor(cmd.help);
  });  
  // sp.on('data', function(data) {
    // spParseData(data);
  // }); 
  sp.on('data', spParseData);   
  sp.on('error', function (err) {
    console.log('SerialPort error'.bold.red, err);
  });  
  sp.on('close', function () {
    console.log('SerialPort closed'.bgRed, '\nTry to reconnect');
    process.exit(-1);
  });  
}

function getDT(/* get listening Dream Theater in all Date & Time */) {
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

var api = {
  
  name: 'monitor',
 
  getDT: getDT,
  
  welcome: function() {
    console.log(
      '\nChannel Monitor System'.bold.yellow,
      '\nUkSATSE'.bold.cyan, 'Telecommunication Service'
    ); 
  },
  
  connect: function() {
    
    var self = this;
    serialport.list(function (err, ports) {        
    var comName = '';        
      ports.forEach(function(port) {
        console.log('manufacturer:', port.manufacturer);
        console.log('name:', port.comName);
        // if (/^Arduino/.test(port.manufacturer)) comName = port.comName;
        if (/^COM3/.test(port.comName)) comName = port.comName;
      });
      console.log('connect to', comName);
      self.comName = comName;
      if (comName) startMonitor(comName);
      else console.log('Channel Monitor board not found'.bold.red);        
    });

    WDT = 0;
    
    setInterval(function() {
      WDT++;
      if (WDT > _RST) restartMonitor();
      else writeToMonitor(cmd.getstate);
    },
    1000);  
    
  },

  query: function(req, res) {
    writeToMonitor(req.vars.query, res);  
  },
  
  getnames: function(req, res) {
    res({request: 'getnames', response: channels});
  }
  
}

module.exports = api;
