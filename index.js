/*
  # Channel Monitor System
  # UkSATSE
  # Telecommunication Service
  # andy-pro 2016
*/

var http = require("http"),
    cluster = require('cluster'),
    responder = require("./responder"),
    monitor = require("./monitor/api");

if (cluster.isMaster) {
  cluster.fork();
  cluster.on('exit', function(worker, code, signal) {
    console.log('Restart monitor');
    cluster.fork();
  });
} else if (cluster.isWorker) { 
  var cfg = require("./config.json"), /* app confiration */
      lexicon = require("./lexicon.json"), /* internationalization */
      port = process.argv[2] || cfg.port;
  cfg.loaded = [monitor]; /* loaded api modules, so no need require */
  cfg.lexicon = lexicon;
  responder.setup(cfg);
  monitor.setup(cfg);
  http.createServer(responder.responder).listen(parseInt(port, 10));  
  console.log(
    '\nHTTP server running at http://localhost:' + port,
    '\n(press Ctrl-C to exit)'
  );
  monitor.welcome(); 
  monitor.connect(); /* worker for server */
}
