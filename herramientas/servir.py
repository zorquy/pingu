# Servidor de pruebas: como Netlify, /aprender sirve aprender.html.
import http.server, os, functools
RAIZ = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/test-forum'
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(path)
        if not os.path.exists(p) and not p.endswith('/') and os.path.exists(p + '.html'):
            return p + '.html'
        return p
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8892), functools.partial(H, directory=RAIZ)).serve_forever()
