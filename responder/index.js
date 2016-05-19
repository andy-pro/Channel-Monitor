/*
  # Multi App Responder for Node.js HTTP Server
  #
  # Single Page Applications Design
  # Static server
  # Common resources
  # 'index.html' provider for all '/path/'-like HTTP-requests
  # RPC (Remote Procedure Call), API provider for HTTP-requests
  # API provider for AJAX requests
  # Arguments to array parsing
  # Variables & POST-data to object parsing
  # Escaped JSON provider for API & AJAX
  # Access restriction
  # Fully asynchronous
  # No special dependencies
  #
  # andy-pro 2016
*/

var path = require("path"),
    fs = require("fs"),
    qs = require("querystring"),
    root = process.cwd(),
    cfg = {},
    count = 0, // requests count
    mime = {
      /* add your own mime types for responseFile */
      '.html': 'text/html; charset=UTF-8',
      '.txt': 'text/plain',
      '.css': 'text/css',
      '.jpeg': 'image/jpeg',
      '.jpg': 'image/jpeg'
    };
  /* end vars */

String.prototype.splitOnce = function(dt) {
  var self = String(this),
      pos = self.indexOf(dt);
  return (pos >=0 ) ? [self.substr(0, pos), self.substr(pos+dt.length)] : [self, ''];
}

function setup(_cfg) { /* responder confiration */
  cfg = _cfg;
  cfg.server_static = _cfg['server-static'] || 'static';
  cfg.app_static = _cfg['app-static'] || 'static';
  cfg.api = 'api';
}

function extendObj(orig, add) {
  if (add && typeof add === 'object') {
    var keys = Object.keys(add);
    var i = keys.length;
    while (i--) orig[keys[i]] = add[keys[i]];
  }
};

function escapeJSON(obj) {
  return JSON.stringify(obj).replace(/[\u0080-\uFFFF]/g, function(m) {
    return "\\u" + ("0000" + m.charCodeAt(0).toString(16)).slice(-4);
  });
}

function createCustomRequest(_req) {

  var _url = path.normalize(_req.url),
      uurl = qs.unescape(_url),
      parts = uurl.splitOnce('?'),
      req = path.parse(parts[0]),
      idx = 2;
  req.url = _url; // original url
  req.uurl = uurl; // unescaped url
  req.uri = decodeURI(_req.url);
  req.path = parts[0];
  req.query = parts[1];
  req.vars = qs.parse(req.query);
  parts = req.path.split(path.sep);
  req.application = parts[1];
  req.ajax = _req.headers['x-requested-with'] === 'XMLHttpRequest';
  req.apidir = cfg.api;
  req.method = _req.method;
  if (parts[2] === cfg.api && !req.ajax) {
    idx++;
    req.api = true;
  }
  if (cfg.mega) {
    req.controller = parts[idx];
    idx++;
  }
  req.function = parts[idx];
  req.args = parts.slice(idx+1) || [];

  req.cwd = root;
  req.approot = path.join(root, req.application);
  req.abs = path.join(root, req.path); // absolute filename

  parts = _req.headers['accept-language'].splitOnce(','); // 'en-us,ru;q=0.5', 'ru,en-us;q=0.5', 'uk,ru;q=0.8,en-US;q=0.6,en;q=0.4'
  req.lang = parts[0].toLowerCase();

  return req;
}

function responder(request, response) {

  function responseIndex(p) {
    req.ext = '.html';
    p = path.join(p, 'index'+req.ext);
    return responseFile(p);
  }

  function responseFile(src) {
    fs.readFile(src, "binary", function(err, file) {
      if (err) return responseErr(500, err);
      var meta = mime[req.ext];
      return __response(200, file, meta);
    });
  }

  function responseObj(obj) {
    return __response(200, escapeJSON(obj), 'application/json');
  }

  function responseErr(code, err) {
    if (code == 404) err = "Not found";
    // console.log('\033[1;41mError:\033[0m', code, err);
    return __response(code, err + "\n", "text/plain");
  }

  function __response(code, data, meta) {
    response.writeHead(code, meta ? {"Content-Type" : meta} : {});
    response.write(data, "binary");
    response.end();
  }

  request.setEncoding("utf8");

  var postData = "",
      foo,
      req = createCustomRequest(request);

  request.on("data", function(chunk) {
    postData += chunk;
    if (postData.length > 1e6) {
      postData = ""; // flood protect
      response.writeHead(413, {'Content-Type': 'text/plain'}).end();
      request.connection.destroy();
    }
  });

  request.on("end", function() {

    if (postData) extendObj(req.vars, qs.parse(postData)); // add post data to vars object

    fs.exists(req.abs, function(exists) {
      if (exists) {
        fs.stat(req.abs, function(err, stats) {
          if (err) responseErr(500, err);
          else {
            if (stats.isDirectory()) responseIndex(req.abs); // send 'index.html' in current dir
            else {
               // response files from 'static' directories or 'html' from anywere
               foo = cfg.mega ? req.controller : req.function;
              if (req.application === cfg.server_static || foo === cfg.app_static || req.ext === '.html') responseFile(req.abs);
              else responseErr(500, 'access denied');
            }
          }
       });
      } else {
        if (req.ajax || req.api) {
          cfg.loaded.forEach(function(module) { /* finding among loaded modules */
            if (module.name == req.application) foo = module;
          });
          if (!foo) foo = require('./' + path.join(req.application, req.apidir, (cfg.mega ? req.controller : '')));
          foo = foo[req.function];
          if (typeof foo === 'function') foo(req, responseObj);
          else responseErr(500, 'bad function');
        } else (req.ext) ? responseErr(404) : responseIndex(req.application);
      }
    });

  });

}

module.exports = {
  responder: responder,
  setup: setup
}

