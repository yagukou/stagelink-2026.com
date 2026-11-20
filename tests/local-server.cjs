// Serves a transformed preview only. Never serves the production HTML verbatim.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const csp = "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
function preview() {
  let html = fs.readFileSync(path.join(root, 'Participant.html'), 'utf8');
  html = html.replace(/<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/const SUPABASE_URL = [^;]+;/, "const SUPABASE_URL = 'local-mock';")
    .replace(/const SUPABASE_ANON_KEY = [^;]+;/, "const SUPABASE_ANON_KEY = 'local-mock';")
    .replace(/const NOTIFY_GAS_URL = [^;]+;/, "const NOTIFY_GAS_URL = '';")
    .replace(/const LINE_FRIEND_URL = [^;]+;/, "const LINE_FRIEND_URL = '';");
  return html.replace('<head>', '<head><script src="/mock.js"></script>')
    .replace('</body>', '<script src="/controls.js"></script></body>');
}
function createServer() {
  return http.createServer((req,res)=>{
    const url = new URL(req.url,'http://127.0.0.1');
    const routes = { '/':()=>preview(), '/Participant.html':()=>preview(),
      '/mock.js':()=>fs.readFileSync(path.join(__dirname,'local-mock.js')),
      '/controls.js':()=>fs.readFileSync(path.join(__dirname,'local-controls.js')) };
    res.setHeader('Content-Security-Policy',csp);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method !== 'GET' || !routes[url.pathname]) {res.writeHead(404);res.end('Local preview only');return;}
    res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
    res.end(routes[url.pathname]());
  });
}
if (require.main === module) createServer().listen(4173,'127.0.0.1',()=>console.log('Local-only StageLink: http://127.0.0.1:4173 (Ctrl+C to stop)'));
module.exports = {createServer,preview,csp};
