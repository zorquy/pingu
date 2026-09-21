"""Rigor de la tanda 324 — la ficha de una carta.

Ninguna de estas mutaciones da error. La página se pinta, Google recibe
un documento y la persona ve una carta. Lo que cambia es lo que la
página AFIRMA (que un Partidario tiene 0 PS), a quién se le ofrece
(veintitrés mil fichas casi vacías) y si el trabajo del servidor
sobrevive a que el cliente tenga un mal día.

Es la familia de siempre: convertir «no lo sé» en un dato, y dos mitades
que se separan sin que nadie se entere.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

N = 'js/carta-nucleo.js'
C = 'js/carta.js'
I = 'js/cartas.js'
B = 'netlify/edge-functions/meta-social.js'

MUTACIONES = [
    # ── 1. «No lo sé» vuelve a ser un dato ──
    # Un Partidario no tiene PS. Con esto la ficha dice «0 PS» de un
    # Entrenador, y eso no lo detecta nada salvo mirarlo.
    (N, 'los PS que faltan pasan a valer 0',
     '    if (Number.isInteger(carta.hp)) partes.push(`${carta.hp} PS`)',
     '    partes.push(`${carta.hp ?? 0} PS`)'),

    # Y el cuadro de combate donde no pinta nada: un Estadio con su
    # debilidad y su resistencia a raya.
    (N, 'el cuadro de combate sale también en un Entrenador',
     "  if (carta?.category !== 'Pokemon') return ''\n", ''),

    # ── 2. Las dos mitades se sueltan ──
    # Sin la marca, el cliente repinta lo que el borde acaba de pintar:
    # vuelve el relevo, y con él el salto de los artículos.
    (B, 'el borde no marca lo que ya ha pintado',
     ".replace('<article id=\"cartaNucleo\"', '<article id=\"cartaNucleo\" data-servidor=\"1\"')",
     ''),

    # …y la otra mitad del mismo pacto. Una consulta que falla borraba
    # una página que estaba entera. Es el fallo que destapó la prueba.
    (C, 'una consulta fallida borra lo que el borde pintó bien',
     "  if (caja?.dataset.servidor === '1') return\n  if (caja) caja.innerHTML = '<div class=\"carta-cabecera\"><h1>Carta no encontrada</h1></div>'",
     "  if (caja) caja.innerHTML = '<div class=\"carta-cabecera\"><h1>Carta no encontrada</h1></div>'"),

    # ── 3. Quién sale en Google ──
    # Veintitrés mil fichas con un nombre y una foto, ofrecidas todas.
    # Contenido escaso generado en masa: castiga al sitio ENTERO.
    (N, 'se ofrece a Google hasta la ficha que no tiene nada',
     '  return Boolean(carta?.detalle_at)', '  return true'),
    # El contrario: no se ofrece ninguna y el proyecto no sirve de nada.
    (N, 'no se ofrece ninguna ficha',
     '  return Boolean(carta?.detalle_at)\n}', '  return false\n}'),
    # `nofollow` de propina: la ficha no se indexa Y además deja de
    # pasar el enlace a su colección, que sí se indexa.
    (B, 'el noindex se lleva por delante los enlaces',
     "robots: mereceIndexarse(carta) ? null : 'noindex,follow',",
     "robots: mereceIndexarse(carta) ? null : 'noindex,nofollow',"),
    # Una colección vacía también se ofrece: esa sí es una página escasa.
    (N, 'una colección sin cartas se ofrece igual',
     '  return Boolean(set?.name) && cuantasCartas > 0', '  return Boolean(set?.name)'),

    # ── 4. La dirección ──
    # Solo el primer candidato: un identificador de set con un guion
    # dentro devuelve un 404 que nadie sabría explicar.
    (N, 'la dirección solo se intenta leer de una manera',
     '  for (const cuantos of [2, 3, 4]) {', '  for (const cuantos of [2]) {'),
    # El slug sin quitar tildes: «Piedra Pómez» daría una dirección con
    # una ó dentro, y el enlace de la rejilla no casaría con la canónica.
    (N, 'el slug se queda con las tildes',
     "    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')\n    .toLowerCase()",
     '    .toLowerCase()'),

    # ── 5. La trampa de siempre ──
    # «/cartas» también empieza por «/carta». Con esto el índice recibe
    # las etiquetas de una ficha que no existe.
    (B, 'el índice se confunde con una ficha',
     "  if (/^\\/carta(\\.html)?$/.test(ruta) || ruta.startsWith('/carta/')) return metaDeCarta(url)",
     "  if (ruta.startsWith('/carta')) return metaDeCarta(url)"),

    # ── 6. El hueco de las imágenes ──
    # Doscientas miniaturas sin medidas: la lista entera baila mientras
    # cargan, y no hay error en ninguna parte.
    (N, 'las miniaturas de la colección pierden su hueco',
     '? `<img src="${escapeHtml(img)}" alt="${escapeHtml(carta?.name || \'\')}" width="245" height="337" loading="lazy" decoding="async">`',
     '? `<img src="${escapeHtml(img)}" alt="${escapeHtml(carta?.name || \'\')}" loading="lazy" decoding="async">`'),
    # Y el escaneo grande, diferido: es lo primero que se mira, y
    # diferirlo lo deja en blanco justo el rato que importa.
    (N, 'el escaneo de la ficha se carga en diferido',
     'width="600" height="825" loading="eager"', 'width="600" height="825" loading="lazy"'),

    # ── 7. El índice ──
    # Del más viejo al más nuevo: la primera pantalla del catálogo serían
    # los sets de 1999 en vez de lo que se juega.
    (I, 'las colecciones salen de la más vieja a la más nueva',
     '.order(\'release_date\', { ascending: false, nullsFirst: false })',
     '.order(\'release_date\', { ascending: true, nullsFirst: false })'),
    # Buscar con una letra: una consulta por tecla contra 23.000 filas y
    # una pantalla de ruido.
    (I, 'el buscador dispara con una sola letra',
     '  if (q.length < 3) {', '  if (q.length < 1) {'),
    # La carrera: la respuesta lenta de «ce» pisa a la de «ceruledge».
    (I, 'una respuesta que llega tarde pisa a la más nueva',
     '  if (mio !== ultimaBusqueda) return\n', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-324.mjs')
