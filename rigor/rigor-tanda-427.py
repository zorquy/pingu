"""Rigor de la tanda 427 — ordenar una expansión.

Un orden mal hecho no da error NUNCA: la rejilla sale igual de bonita con
las cartas en otro sitio. Por eso cada mutación rompe el origen —la
escala, los bordes de palabra, el `sort`— y no una de sus guardas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

O = 'js/mi-coleccion/orden.js'
J = 'js/mi-coleccion.js'
H = 'mi-coleccion.html'

MUTACIONES = [
    # ── La escala ──
    (O, 'la ilustracion especial baja al escalon de la normal',
     "  'Special illustration rare': 10,", "  'Special illustration rare': 8,"),
    (O, 'la promo se cuela en medio de la escala',
     "  Promo: 0,", "  Promo: 6,"),
    (O, 'una rareza desconocida se inventa un escalon',
     "  return palabra ? palabra[1] : null", "  return palabra ? palabra[1] : 3"),
    (O, 'sin rareza se inventa un escalon',
     "  if (!rareza) return null", "  if (!rareza) return 0"),
    # Los bordes de palabra: `/rare/i` casa con «Rareza».
    (O, 'se pierden los bordes de palabra',
     "  [/\\brare\\b/i, 3],", "  [/rare/i, 3],"),
    (O, 'ya no se reconoce una rareza nueva por su palabra',
     "  const palabra = POR_PALABRAS.find(([re]) => re.test(String(rareza)))", "  const palabra = null"),

    # ── El orden ──
    (O, 'por rareza va de menos a mas',
     "      return rb - ra || porNumero(a, b)", "      return ra - rb || porNumero(a, b)"),
    (O, 'las rarezas desconocidas se van arriba',
     "      if (ra === null) return 1\n      if (rb === null) return -1",
     "      if (ra === null) return -1\n      if (rb === null) return 1"),
    (O, 'lo que te falta sale al final',
     "    return lista.sort((a, b) => (cuantas(a) ? 1 : 0) - (cuantas(b) ? 1 : 0) || porNumero(a, b))",
     "    return lista.sort((a, b) => (cuantas(b) ? 1 : 0) - (cuantas(a) ? 1 : 0) || porNumero(a, b))"),
    (O, 'dentro de un grupo no se ordena por numero',
     "    return lista.sort((a, b) => (cuantas(a) ? 1 : 0) - (cuantas(b) ? 1 : 0) || porNumero(a, b))",
     "    return lista.sort((a, b) => (cuantas(a) ? 1 : 0) - (cuantas(b) ? 1 : 0))"),
    (O, 'por nombre no desempata por numero',
     "    return lista.sort((a, b) => comoSeLlama(a).localeCompare(comoSeLlama(b), 'es') || porNumero(a, b))",
     "    return lista.sort((a, b) => comoSeLlama(a).localeCompare(comoSeLlama(b), 'es'))"),
    (O, 'ordena EN EL SITIO y se carga la lista del set',
     "  const lista = [...cartas]", "  const lista = cartas"),
    (O, 'los numeros con letras se mezclan con los numericos',
     "  return ea - eb || (Number.isFinite(na) && Number.isFinite(nb) ? na - nb : 0) || String(a.local_id).localeCompare(String(b.local_id))",
     "  return (Number.isFinite(na) && Number.isFinite(nb) ? na - nb : 0) || String(a.local_id).localeCompare(String(b.local_id))"),

    # ── El enganche ──
    (J, 'la rejilla no hace caso al desplegable',
     "  return ordenar(encajan, $('mcAlbumOrden')?.value || 'numero', { tengo: tengoDe, nombre: nombreDe })",
     "  return ordenar(encajan, 'numero', { tengo: tengoDe, nombre: nombreDe })"),
    (J, 'cambiar el orden no repinta',
     "  for (const id of ['mcAlbumRareza', 'mcAlbumTipo', 'mcAlbumOrden']) {",
     "  for (const id of ['mcAlbumRareza', 'mcAlbumTipo']) {"),
    (J, 'el desplegable se repinta y pierde lo elegido',
     "  if (orden && !orden.options.length) {", "  if (orden) {"),
    (J, 'no se pasa quien sabe cuantas tienes',
     "{ tengo: tengoDe, nombre: nombreDe })", "{ nombre: nombreDe })"),
    (H, 'la rejilla se queda sin desplegable de orden',
     '<select id="mcAlbumOrden" class="mc-chapa-select" aria-label="Cómo se ordenan las cartas"></select>', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-427.mjs')
