"""Rigor de la tanda 624 — una norma para todas las cartas: la impresión de
rareza más baja, de cualquier colección, con UNA escala de rareza.

Cada mutación rompe el ORIGEN (la escala, la regla, la consulta, la puerta
por la que pasan todos), no una de sus guardas de repuesto."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

ESC = 'js/rareza-escala.js'
ORD = 'js/mi-coleccion/orden.js'
CAN = 'js/impresion-canonica.js'
DEL = 'js/impresiones-del-set.js'
LIS = 'js/lista-canonica.js'
REP = 'js/repeticiones.js'
TCG = 'js/tcgdex.js'

MUTACIONES = [
    # ── La escala ──
    (ESC, 'la escala no entiende «Común»', "  [/\\b(common|comun)\\b/i, 1],", "  [/\\bcommon\\b/i, 1],"),
    (ESC, 'se compara con tildes («Rara Híper» no casa)', "  const palabra = POR_PALABRAS.find(([re]) => re.test(texto))", "  const palabra = POR_PALABRAS.find(([re]) => re.test(String(rareza)))"),
    (ESC, 'la galería vuelve a ser una holo del montón', "  [/\\b(illustration|ilustracion|gallery|galeria)\\b/i, 8],", "  [/\\b(illustration|ilustracion)\\b/i, 8],"),
    (ESC, 'manda `rarity` y no `rarity_en`', "  for (const r of [carta?.rarity_en, carta?.rarity]) {", "  for (const r of [carta?.rarity, carta?.rarity_en]) {"),
    (ESC, 'una rareza desconocida se inventa un escalón', "  return palabra ? palabra[1] : null", "  return palabra ? palabra[1] : 3"),
    (ORD, 'el álbum ordena por `rarity` a secas', "      const ra = rangoDeCarta(a)\n      const rb = rangoDeCarta(b)", "      const ra = rangoDeRareza(a.rarity)\n      const rb = rangoDeRareza(b.rarity)"),

    # ── La regla ──
    (CAN, 'a igual rareza también se cambia', "    return propia == null ? sinImagen : r < propia || (sinImagen && r <= propia)", "    return propia == null ? sinImagen : r <= propia"),
    (CAN, 'una legal pasa a una que no lo es', "    if (legal(carta) && !legal(c)) return false\n", ""),
    (CAN, 'una con marca pasa a una de antes de las marcas', "    if (marca(carta) && !marca(c)) return false\n", ""),
    (CAN, 'una promo sustituye a una de colección', "    if (esPromo(c) && !esPromo(carta)) return false\n", ""),
    (CAN, 'la promo de un ex «baja» a su Rara Doble', "const RANGO_DE_PROMO = 3.5", "const RANGO_DE_PROMO = 6"),
    (CAN, 'una de rareza desconocida cuenta como «más baja»', "    if (r == null || !mismaCartaEntreIdiomas(c, carta)) return false", "    if (!mismaCartaEntreIdiomas(c, carta)) return false"),
    (CAN, 'lo de TCG Pocket entra', "    if (!c || c.id === carta.id || !tieneImagen(c) || esDePocket(c)) return false", "    if (!c || c.id === carta.id || !tieneImagen(c)) return false"),
    (CAN, 'se cambia a una sin imagen', "    if (!c || c.id === carta.id || !tieneImagen(c) || esDePocket(c)) return false", "    if (!c || c.id === carta.id || esDePocket(c)) return false"),
    (CAN, 'un Pokémon con el mismo nombre es la misma carta', "  return forma !== '' && forma === formaDeJuego(b)", "  return true"),
    (CAN, 'el nombre español no cruza', "const nombresDe = (c) => new Set([c?.name_key, limpio(c?.name), limpio(c?.name_es)].filter(Boolean))", "const nombresDe = (c) => new Set([c?.name_key, limpio(c?.name)].filter(Boolean))"),
    (CAN, 'a igual rareza no manda su colección', "    if (sa !== sb) return sa - sb\n    const la", "    const la"),

    # ── La puerta y la consulta ──
    (DEL, 'la regla 0 no se aplica', "  const entradas = await aLaMasComun(entradasDadas, columnas).catch(() => entradasDadas)", "  const entradas = entradasDadas"),
    (DEL, 'no se buscan reimpresiones por el nombre español', "    nombres.length ? pedir().in('name_es', nombres).limit(1000) : { data: [] },", "    { data: [] },"),
    (DEL, 'la caché da filas cortas a quien pide más columnas', "  const llave = (k) => `${sel}|${k}`", "  const llave = (k) => k"),
    (DEL, 'no se avisa del cambio de colección', "{ ...mejor, cambio_de_set: true, codigo_set: deSet.get(mejor.set_id)?.codigo || '' }", "mejor"),
    (LIS, 'la lista mezcla el código de una colección con el número de otra', "        ...(carta?.cambio_de_set ? { set: carta.codigo_set || '' } : {}),\n", ""),
    (TCG, '`searchCards` vuelve a llamar a lo que solo reexporta', "import { normalizeSearch } from './texto.js'\n", ""),
    (REP, 'la que casa con lo que hace se salta la norma', "      nueva = c ? (await canonizarEntradas([{ carta: c, n: 1 }], { columnas: COLUMNAS }).catch(() => [{ carta: c }]))[0]?.carta || c : null", "      nueva = c"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-624.mjs')
