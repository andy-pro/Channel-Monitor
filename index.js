/*
  # Channel Monitor System
  # UkSATSE
  # Telecommunication Service
  # andy-pro 2016
*/

var http = require("http"),
    responder = require("./responder"),
    cluster = require('cluster'), /* for restarting monitor service */
    monitor = require("./monitor/api"), /* monitor module */
    cfg = require("./config.json"), /* server confiration */
    port = process.argv[2] || cfg.port;

if (cluster.isMaster) {
  cluster.fork();
  cluster.on('exit', function(worker, code, signal) {
    console.log('Restart monitor');
    cluster.fork();
  });
} else if (cluster.isWorker) { 

  cfg.loaded = [monitor]; /* loaded modules, so no need require */
  responder.setup(cfg);
  http.createServer(responder.responder).listen(parseInt(port, 10));  
  console.log(
    '\nHTTP server running at http://localhost:' + port,
    '\nStarting at', monitor.getDT().dt,
    '\n(press Ctrl-C to exit)'
  );
  monitor.welcome(); 
  monitor.connect(); /* worker for server */
}
