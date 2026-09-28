// Local-only preview. Serves an explicit allowlist, never personal config or credentials.
const http = require('http'), fs = require('fs'), path = require('path');
const { demoAircraft } = require('../lib/opensky');
const horizon = require('../examples/horizon.demo.json');
const root = path.join(__dirname, '..');
const allowed = /^(?:\/docs\/demo\.html|\/examples\/horizon\.demo\.json|\/MMM-PlaneHorizon\.(?:js|css)|\/lib\/(?:sky|aircraft|models|view)\.js)$/;
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/demo-data') {
    const home = horizon.observers[0];
    const now = new Date('2026-06-20T14:00:00Z').getTime() / 1000;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ now, traffic: demoAircraft(home.lat, home.lon, now, 0) }));
    return;
  }
  const file = pathname === '/' ? '/docs/demo.html' : pathname;
  if (!allowed.test(file)) { res.writeHead(404); res.end('Not found'); return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  res.setHeader('Content-Type', types[path.extname(file)]);
  fs.createReadStream(path.join(root, file)).on('error', () => res.destroy()).pipe(res);
}).listen(8098, '127.0.0.1', () => console.log('Offline preview: http://127.0.0.1:8098'));
