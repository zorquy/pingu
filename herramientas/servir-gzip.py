# Como servir.py pero comprimiendo (Netlify manda brotli): sin esto, medir con
# la red limitada cuenta cuatro veces los bytes de verdad.
import gzip, io, sys, functools, http.server
sys.path.insert(0, '/tmp/wt-pruebas/herramientas')
import importlib.util
src = open('/tmp/wt-pruebas/herramientas/servir.py').read().rsplit('http.server.ThreadingHTTPServer', 1)[0]
ns = {}
exec(src, ns)
H, RAIZ = ns['H'], ns['RAIZ']
class G(H):
    def send_head(self):
        f = super().send_head()
        return f
    def copyfile(self, src, dst):
        dst.write(src.read())
    def end_headers(self):
        super().end_headers()
    def do_GET(self):
        import time, os as _o
        time.sleep(float(_o.environ.get('SRV_MS', '0')) / 1000)
        limpio = self.path.split('?')[0]
        p = self.translate_path(self.path)
        import os, mimetypes, email.utils
        if os.path.isfile(p) and 'gzip' in self.headers.get('Accept-Encoding', '') and any(p.endswith(x) for x in ('.js', '.css', '.html', '.json', '.svg', '.mjs', '.webmanifest')):
            cuerpo = gzip.compress(open(p, 'rb').read(), 6)
            st = os.stat(p)
            lm = email.utils.formatdate(st.st_mtime, usegmt=True)
            if self.headers.get('If-Modified-Since') == lm:
                self.send_response(304); self.end_headers(); return
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(p) if not p.endswith('.js') else 'text/javascript')
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(cuerpo)))
            self.send_header('Last-Modified', lm)
            self.send_header('Cache-Control', 'public, max-age=0, must-revalidate')
            self.end_headers()
            self.wfile.write(cuerpo)
            return
        return super().do_GET()
http.server.ThreadingHTTPServer(('127.0.0.1', int(__import__('os').environ.get('SRV_PORT', '8893'))), functools.partial(G, directory=RAIZ)).serve_forever()
