"""Rigor de la tanda 326 — que lleguen.

La fontanería no da errores cuando se rompe: da silencio. Un sitemap sin
el catálogo sigue siendo un sitemap válido; un pie sin su enlace sigue
siendo un pie; y una lista de mazo sin enlaces sigue enseñando las
cartas. Lo único que pasa es que nadie encuentra nada.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

S = 'netlify/functions/sitemap.mjs'
D = 'js/torneos/cartas-decklist.js'
R = 'js/carta-ruta.js'
I = 'index.html'

MUTACIONES = [
    # ── 1. El sitemap ofrece lo que la web marca como noindex ──
    # Es lo peor que puede hacer un sitemap: gastarle a Google el
    # presupuesto de rastreo en páginas que le vas a decir que ignore.
    (S, 'el sitemap ofrece hasta las fichas que se sirven con noindex',
     '        if (!mereceIndexarse(c, play)) continue', '        if (false) continue'),
    # Y su versión sutil: el listón, reescrito aquí a mano. Funciona hoy
    # y se queda viejo el día que cambie el de verdad.
    (S, 'el sitemap se escribe su propia regla de quién se indexa',
     '        if (!mereceIndexarse(c, play)) continue',
     '        if (!c.detalle_at) continue'),

    # ── 2. El catálogo, fuera del sitemap ──
    (S, 'las colecciones no se ofrecen',
     "        loc: `${SITIO}${rutaDeColeccion(s)}`,", "        loc: `${SITIO}/x-${s.id}`,"),
    (S, 'el índice del catálogo no se ofrece',
     "  ['/cartas', '0.8'],", ''),

    # ── 3. La clave que se calcula dos veces ──
    # Confiar en que el `unaccent` de Postgres diga exactamente lo mismo
    # que el nuestro. Hoy casi siempre sí; el día que no, la carta
    # desaparece del sitemap y nadie se entera.
    (S, 'la clave de juego se confía al unaccent de Postgres',
     '        const play = porNombre.get(claveDeJuego(c))', '        const play = porNombre.get(c.name_search)'),

    # ── 4. El enlace de la lista de un mazo ──
    (D, 'el nombre de la carta deja de enlazar a su ficha',
     "          pie.innerHTML = `<a class=\"torneo-carta-enlace\" href=\"${escapeHtml(rutaDeCarta(carta))}\">${escapeHtml(linea.name)}</a>`",
     '          pie.textContent = linea.name'),
    # …y el enlace roto, que es peor que no tener enlace: se pone aunque
    # la carta no se haya resuelto.
    (D, 'se enlaza también lo que no se ha resuelto',
     '        const pie = hueco.querySelector(\'figcaption\')',
     '        const pie = hueco.querySelector(\'figcaption\') || document.createElement(\'figcaption\')'),

    # ── 5. La trampa del barrido ──
    # Importar el molde en vez del módulo de direcciones le cuelga a
    # /torneo todas las clases de css/carta.css, que no carga.
    (D, 'la lista del mazo importa el molde entero',
     "import { rutaDeCarta } from '../carta-ruta.js'",
     "import { rutaDeCarta } from '../carta-nucleo.js'"),
    # Y el módulo de direcciones, pintando: en cuanto tenga una clase
    # dentro, vuelve el problema aunque el import esté bien.
    (R, 'el módulo de direcciones empieza a pintar HTML',
     'export function urlDeLogo(logoPath) {',
     'export function chapa(t) { return `<span class="carta-sub">${t}</span>` }\n\nexport function urlDeLogo(logoPath) {'),

    # ── 6. El pie ──
    (I, 'la portada se queda sin el enlace al catálogo',
     '        <a href="/cartas">Cartas</a>\n', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-326.mjs')
