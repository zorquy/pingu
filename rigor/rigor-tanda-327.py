"""Rigor de la tanda 327 — lo que se rompio al salir a produccion.

Aqui el patron es el mismo en las cuatro familias: la pagina se SIRVE,
el HTML esta entero, no hay ningun error en consola, y lo que falla es
lo que ve una persona. Una ruta relativa en una direccion con barra da
un 404 de CSS y la pagina sale en crudo. Un filtro sin su columna deja
pasar todo. Un punto de corte heredado aprieta los enlaces en silencio.

Ninguna de estas mutaciones rompe nada que se pueda ver desde Node.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

C = 'carta.html'
L = 'coleccion.html'
X = 'cartas.html'
I = 'index.html'
S = 'css/style.css'
SER = 'js/catalogo-series.js'
JC = 'js/cartas.js'
JL = 'js/coleccion.js'

MUTACIONES = [
    # ── 1. El fallo original, tal cual ──
    # En /coleccion/tr el navegador pide /coleccion/css/style.css. La
    # pagina se sirve igual, con su contenido, pero sin una sola regla.
    (L, 'la coleccion vuelve a pedir su CSS con ruta relativa',
     '<link rel="stylesheet" href="/css/style.css" />', '<link rel="stylesheet" href="css/style.css" />'),
    (C, 'la ficha vuelve a pedir su CSS con ruta relativa',
     '<link rel="stylesheet" href="/css/carta.css" />', '<link rel="stylesheet" href="css/carta.css" />'),
    # Y la version que solo se nota en la direccion bonita: el JavaScript.
    # La pagina se ve bien (el borde la pinto) y no hace NADA.
    (C, 'la ficha vuelve a pedir su JavaScript con ruta relativa',
     '<script type="module" src="/js/carta.js"></script>', '<script type="module" src="js/carta.js"></script>'),
    (L, 'la coleccion se queda sin el JavaScript de la casa',
     '<script type="module" src="/js/app.js"></script>', '<script type="module" src="js/app.js"></script>'),
    # El indice NO tiene direccion con barra, asi que una relativa suya
    # funciona — pero la prueba barre por netlify.toml, no por mi lista.
    (X, 'el indice mezcla una ruta relativa',
     '<link rel="stylesheet" href="/css/components.css" />', '<link rel="stylesheet" href="css/components.css" />'),

    # ── 2. Pokemon TCG Pocket ──
    (SER, 'Pocket vuelve a colarse en el catalogo',
     "export const SERIES_FUERA = ['tcgp']", 'export const SERIES_FUERA = []'),
    # Y al reves: echar a las viejas de Wizards, que traen serie vacia y
    # son el TCG mas TCG que hay.
    (SER, 'las colecciones sin serie se van fuera',
     '  return !serie || !SERIES_FUERA.includes(String(serie))',
     '  return Boolean(serie) && !SERIES_FUERA.includes(String(serie))'),
    # La sutil de verdad: el filtro esta puesto pero la consulta no pide
    # la columna, asi que recibe undefined y deja pasar TODO sin error.
    (JC, 'el indice filtra por una columna que no ha pedido',
     "'id,name,serie_id,serie_name,logo_path,release_date,card_count_official,card_count_total'",
     "'id,name,serie_name,logo_path,release_date,card_count_official,card_count_total'"),
    (JL, 'la coleccion filtra por una columna que no ha pedido',
     "'id,name,serie_id,serie_name,logo_path,release_date,card_count_official,card_count_total'",
     "'id,name,serie_name,logo_path,release_date,card_count_official,card_count_total'"),

    # ── 3. La barra ──
    # El corte heredado. No desborda nada: los enlaces se aprietan en
    # silencio, que es justo lo que llevaba meses pasando.
    (S, 'el punto de corte se queda en el de antes',
     '@media (min-width: 1160px) {\n  .nav-links {', '@media (min-width: 1080px) {\n  .nav-links {'),
    # Y la regla del chip, devuelta a su tramo: por encima de 1.179 los
    # enlaces vuelven a salir con el chip puesto y a encogerse.
    (S, 'con el chip puesto los enlaces vuelven a apretarse',
     '@media (min-width: 1160px) {\n  body:has(.nav-torneo-vivo) .nav-links {',
     '@media (min-width: 1160px) and (max-width: 1179px) {\n  body:has(.nav-torneo-vivo) .nav-links {'),

    # ── 4. Que se llegue ──
    (I, 'el catalogo desaparece de la barra de la portada',
     '        <a href="aprender.html">Aprender</a>\n        <a href="/cartas">Cartas</a>\n        <a href="foro.html">Foro</a>',
     '        <a href="aprender.html">Aprender</a>\n        <a href="foro.html">Foro</a>'),

    # ── 5. La rejilla descuadrada ──
    # Sin hueco reservado, la tarjeta sin logo se encoge y la rejilla
    # sale a trompicones: parece rota y solo falta un dato.
    (JC, 'la coleccion sin logo deja de reservar su hueco',
     '          : `<span class="cartas-coleccion-sinlogo" aria-hidden="true">${icons.cards(28)}</span>`)',
     "          : '')"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-327.mjs')
