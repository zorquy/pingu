# Servidor de pruebas: como Netlify, /aprender sirve aprender.html.
#
# Y como Netlify TAMBIÉN en las direcciones bonitas (tanda 327). Antes no
# las hacía, así que /coleccion/tr daba 404 aquí y en producción daba una
# página SIN CSS —el navegador pedía /coleccion/css/style.css— y la
# diferencia no se veía por ninguna parte: las pruebas usaban
# /coleccion.html?set=tr, donde las rutas relativas sí resuelven.
import http.server, os, functools, re
RAIZ = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/test-forum'

# Lo mismo que dice netlify.toml. Si se añade una ahí, se añade aquí.
REESCRITURAS = [
    (re.compile(r'^/carta/[^/]+$'), '/carta.html'),
    (re.compile(r'^/coleccion/[^/]+$'), '/coleccion.html'),
    (re.compile(r'^/usuario/[^/]+$'), '/usuario.html'),
    (re.compile(r'^/tema/[^/]+$'), '/tema.html'),
    (re.compile(r'^/foro/[^/]+$'), '/foro.html'),
    (re.compile(r'^/noticias/[^/]+$'), '/guia.html'),
]

class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        limpio = path.split('?')[0].split('#')[0]
        for patron, destino in REESCRITURAS:
            if patron.match(limpio):
                path = destino
                break
        p = super().translate_path(path)
        if not os.path.exists(p) and not p.endswith('/') and os.path.exists(p + '.html'):
            return p + '.html'
        return p
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8892), functools.partial(H, directory=RAIZ)).serve_forever()
