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
    colors = require("colors"),
    qs = require("querystring"),
    fs = require("fs"),
    sp, /* hardware serial port instance */
    sp_last_cmd, /* last command cache */  
    _req, // global request
    L, // global lexicon
    WDT, /* Watch Dog Timer */
    _CH_MAX = 12,
    env = { // environment state for clients: connect, alarm: false, td
      td: [] // table <td> data
    },
    cfg = {},
    channel_count,
    logfile = 'monitor.log',
    /* deferred object: req, state, server - is server service?, cb - responder callback
    state:
      pending  - request send to serial
      begining - request received from serial
      resolved - response received from serial
      rejected - error
    */
    dfr = { };

function T(s) {
  var idx = -1,
      lang = _req.lang,
      langs = L.order;
  if ( lang === 'en-us') return s;
  for(var i=0; i < langs.length; i++) 
    if (lang === langs[i]) {
      idx = i;
      break;
    }
  if (idx >= 0 && L[s]) s = L[s][idx];
  return s;
}

function writeToMonitor(req, cb) {
  dfr = {
    req: req.trim(),
    state: 'pending',
    server: (typeof cb == 'function') // is there request from web-client?
  };
  if (dfr.server) dfr.cb = cb;   
  if (sp && sp.isOpen()) sp.write(dfr.req + '\r');
  else if (dfr.server) cb({status: 'serial port closed', time: getDT().dt, query: dfr.req});   
}

function writeToLog() {
  if (cfg.logging) {
    var msg = '';
    for (var i = 0; i < arguments.length; i++) msg += arguments[i] + '\n';
    fs.appendFile(logfile, msg, function(err) {
      if (err) console.log('Writing to log:', err);
    });
  }
}

function spParseState(data) {
  /* parse getstate command */
  if (WDT > 1) process.stdout.write('\033[' + (+channel_count + 1) + 'A'); // jump cursor to top
  WDT = 1;
  env.connect = true;
  var dt = getDT(),
      res = dt.dt.bold.bgCyan,
      raw = qs.parse(data.split('?')[1]),
      // raw = {raw: 4032, mask:31};
      mask = raw.mask,
      raw = raw.raw,
      msg = '', log = '';
  channel_count = 0;
  cfg.channels.forEach(function(channel, i) {
    if (mask & 0x800) env.td[i] = 'off';
    else {
      var state = Boolean(raw & 0x800),
          status = state ? 'up  '.bold.green : 'down'.bold.red,
          title = String(i + 1) + '.' + channel.title;
      env.td[i] = state ? 'up' : 'down';
      if (state != channel.state) {
        log = dt.dt + ' ' + title + ' change state to ';
        writeToLog(log + env.td[i]);
        msg += '\n' + log + status;
        channel.state = state;
        if (!state) env.alarm = true;
      }
      res += '\n' + title + ' ' + status;
      channel_count++;
    }
    raw = raw << 1;
    mask = mask << 1;
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
    if (dfr.server) dfr.cb(data); // route request to server
    else { // request from self
      if (dfr.req == 'getstate') spParseState(data);
      else console.log(data + '\n');
    }         
  }  
}

function startMonitor(comName) {  
  console.log(('\nArduino Channel Monitor board found on ' + comName).bold.bgGreen);    
  sp = new serialport.SerialPort(comName, { /* serial port instance configuration */
    baudrate: 115200,
    parser: serialport.parsers.readline("\r\n")
  });    
  sp.on("open", function () {
    writeToMonitor('ver');
  });  
  sp.on('close', function () {
    console.log('SerialPort closed'.bgRed, '\nTry to reconnect');
    process.exit(-1);
  });  
  sp.on('error', function (err) {
    console.log('SerialPort error'.bold.red, err);
  });  
  sp.on('data', spParseData);   
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
  
  name: 'monitor', // necessary for responder, cfg.loaded...
  
  setup: function(_cfg) {
    cfg = _cfg;
    L = _cfg.lexicon;
    for(var i = 0; i < _CH_MAX; i++) {
      cfg.channels[i] = { // convert array of str to array of obj
        state: true,
        title: cfg.channels[i] ? cfg.channels[i] : 'Channel ' + String(+i + 1)
      }
    }
  },
 
  getDT: getDT,
  
  welcome: function() {
    var msg = getDT().dt + ' start Channel Monitor System';
    writeToLog(msg, '========== ======== ===== ======= ======= ======'); // tipa banner :)
    console.log('\n' + msg.bold.yellow, '\nUkSATSE'.bold.cyan, 'Telecommunication Service'); 
  },
  
  connect: function() {
    
    var self = this, 
        comName;        
    serialport.list(function (err, ports) {        
      ports.forEach(function(port) {
        if (/^Arduino/.test(port.manufacturer)) comName = port.comName;
      });
      self.comName = comName;
      if (comName) startMonitor(comName);
      else console.log('Channel Monitor board not found'.bold.red);        
    });

    WDT = 0;
    
    setInterval(function() {
      WDT++;
      if (WDT > cfg.interval) restartMonitor(); /* restart time */
      else writeToMonitor('getstate');
    },
    1000);  
    
  },
  
  monitor: function(req, res) {
    res({interval: cfg.interval, channels: cfg.channels});
  },

  query: function(req, res) {
    var cmd = req.vars.command;
    if (cmd === 'api') {
      res('API:\n\
  api/monitor\n\
  api/query?command=[help,ver,state,getstate,setmask,tm,tms,alm,tone,notone]\n\
  api/getstate\n\
  api/getlog\n\
  api/clearlog\n\
  api/lexicon\n\
  api/restart\n');
    } else {
      writeToMonitor(cmd, res);
      if (cmd === 'alm') env.alarm = false;
    }
  },

  getstate: function(req, res) {
    res(env);
  },
  
  getlog: function(req, res) {    
    fs.readFile(logfile, 'utf-8', function(err, file) {
      if (err) res({status: 'error reading log file', error: err});
      else res({log: file});
    });    
  },
  
  clearlog: function(req, res) {    
    fs.unlink(logfile, function(err) {
      res(err ? 'Error' : 'Log file is empty');
    });    
  },
    
  lexicon: function(req, res) {
    _req = req;
    res({
      _ALARM_: T('Alarm'),
      _BTNBACK_: '<button type="button" class="close" aria-hidden="true" onclick="history.back();return false;" title="' + T('Back') + ' (Esc)">&times;</button>',
      _CANCEL_: T('Cancel'),
      _CFG_: T('Config'),
      _CHANNEL_: T('Channel'),
      _CLEAR_: T('Clear'),
      _CLR_LOG_: T('Clear Log'),
      _COMMAND_: T('Command'),
      _COMM_ERR_: T('Communication error'),
      _ERROR_: T('Error'),
      _LOG_: T('Log'),
      _RFR_: T('Refresh'),
      _SEND_: T('Send'),
      _STATUS_: T('Status')
    });
  },
  
  restart: function(req, res) {
    res('The server will restart in 5 seconds');
    setTimeout(restartMonitor, 5000);
  }
  
}

module.exports = api;
