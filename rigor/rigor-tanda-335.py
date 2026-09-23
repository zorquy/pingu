"""Rigor de la tanda 335 — el nombre traducido y la chapa de legalidad.

Aqui NADA da error. Lo que cambia es si la web ENSENA el nombre que
toca, si CRUZA por la clave que toca, y si le dice a alguien que puede o
no puede jugar una carta. Ese ultimo grupo es el importante: una chapa
equivocada no se ve rota, se ve segura.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

N = 'js/carta-nucleo.js'
R = 'js/carta-ruta.js'
D = 'js/carta-detalle.js'
T = 'netlify/functions/cartas-detalle.mjs'
S = 'netlify/functions/sitemap.mjs'
DK = 'js/torneos/cartas-decklist.js'
L = 'netlify/lib/carta-detalle.mjs'

MUTACIONES = [
    # ══ El nombre: lo que se ensena y lo que se cruza ══

    # ── 1. El fallo original, tal cual ──
    # La tarea vuelve a escribir el traducido encima de la clave. La
    # ficha se ve PERFECTA —sale en espanol— y el bloque de torneos
    # desaparece para siempre sin que nada lo diga.
    (T, 'la tarea vuelve a pisar el nombre ingles con el traducido',
     "      if (encontrado.nombre && encontrado.idioma !== 'en') detalle.name_es = encontrado.nombre",
     "      if (encontrado.nombre && encontrado.idioma !== 'en') detalle.name = encontrado.nombre"),
    # O que simplemente no lo guarde: el catalogo se queda en ingles y
    # nadie se entera, porque en ingles la ficha tambien se ve bien.
    (T, 'la tarea no guarda el nombre traducido en ninguna parte',
     "      if (encontrado.nombre && encontrado.idioma !== 'en') detalle.name_es = encontrado.nombre",
     '      /* nada */'),

    # ── 2. Los dos lados de la linea ──
    # Que lo que se ENSENA vuelva a salir del ingles: la ficha entera en
    # ingles con el catalogo traducido al lado.
    (N, 'se ensena el nombre ingles aunque haya traduccion',
     "  const es = typeof carta?.name_es === 'string' ? carta.name_es.trim() : ''",
     "  const es = ''"),
    # Y que lo que se CRUZA salga del espanol: el bloque de torneos se
    # apaga otra vez, que es el fallo entero.
    (N, 'la clave de cruce se calcula con el nombre traducido',
     '  return normalizarNombre(carta?.name)\n}',
     '  return normalizarNombre(carta?.name_es || carta?.name)\n}'),
    # El respaldo del reves: un name_es vacio dejaria la ficha SIN
    # nombre. No da error: sale un <h1> en blanco.
    (N, 'una traduccion vacia deja la ficha sin titulo',
     "  return es || carta?.name || ''", "  return es"),

    # ── 3. La direccion ──
    # Vuelve a salir del ingles. Ninguna direccion se rompe —resuelven
    # por el identificador del final— pero la canonica del sitemap y la
    # de la pagina dejan de coincidir, que es un duplicado para Google.
    (R, 'la direccion vuelve a hacerse con el nombre ingles',
     "  const nombre = (typeof carta?.name_es === 'string' && carta.name_es.trim()) || carta?.name",
     '  const nombre = carta?.name'),

    # ── 4. La rejilla ──
    # La baldosa en ingles y la ficha en espanol. Es exactamente lo que
    # se vio en la captura de /coleccion, y no lo canto ningun error.
    (N, 'la baldosa de la rejilla se queda en ingles',
     '<span class="coleccion-carta-nombre">${escapeHtml(nombreDeCarta(carta))}</span>',
     '<span class="coleccion-carta-nombre">${escapeHtml(carta?.name || \'\')}</span>'),

    # ── 5. El cruce del sitemap ──
    # Contra `name_search`, que ahora lleva los dos idiomas pegados: el
    # `in.()` no casa con NINGUNA carta traducida y el sitemap se queda
    # sin fichas. Devuelve un XML perfectamente valido.
    (S, 'el sitemap vuelve a cruzar contra la columna de buscar',
     '`tcg_cards?market=eq.WEST&name_key=in.(${nombres})',
     '`tcg_cards?market=eq.WEST&name_search=in.(${nombres})'),

    # ── 5b. La reparacion de lo que ya se guardo mal ──
    # Sin ella, las 2.811 cartas engordadas en espanol se quedan con el
    # nombre traducido en la clave PARA SIEMPRE: la web se ve perfecta y
    # su bloque de torneos no vuelve nunca.
    (T, 'no se repara ningun nombre de los que ya estan pisados',
     '    const cuantos = await repararNombresDeUnSet(clave, setId).catch(() => null)',
     '    const cuantos = 0'),
    # Marcar el set como reparado aunque la peticion haya fallado: la
    # pasada siguiente ya no vuelve, y esas cartas se quedan rotas.
    (T, 'un set se marca como reparado aunque no se haya podido',
     '    if (cuantos !== null) {', '    if (true) {'),
    # Y el contrario: no marcarlo nunca, con lo que la fase se pasa la
    # vida repitiendo los mismos sets y el engorde no avanza.
    (T, 'la reparacion no termina nunca y se come todas las pasadas',
     '    if (cuantos !== null) {', '    if (false) {'),
    # Mandar identificadores que no tenemos: un merge-duplicates con un
    # id que no existe INSERTA una fila a medias, sin set y sin imagen.
    (L, 'se mandan a la base cartas que no estan en la tabla',
     '    .filter((c) => porId.has(String(c?.id)) && porId.get(String(c.id)) !== c.name)',
     '    .filter((c) => true)'),
    # Reescribir tambien las que ya se llaman igual: no rompe nada, y
    # gasta la pasada en no cambiar nada.
    (L, 'se reescriben tambien las que ya estaban bien',
     "    .filter((c) => porId.has(String(c?.id)) && porId.get(String(c.id)) !== c.name)",
     '    .filter((c) => porId.has(String(c?.id)))'),
    # Un nombre en blanco del listado pisando el nuestro: la carta se
    # queda SIN nombre y sin forma de buscarla.
    (L, 'un nombre en blanco del listado borra el nuestro',
     "      .filter((c) => c?.id && typeof c.name === 'string' && c.name.trim())",
     '      .filter((c) => c?.id)'),
    # Y que se olvide el mercado, que es parte de la clave: el
    # merge-duplicates deja de encontrar la fila y la INSERTA.
    (L, 'el upsert se olvida del mercado',
     '    .map((c) => ({ id: c.id, market, name: porId.get(String(c.id)) }))',
     '    .map((c) => ({ id: c.id, name: porId.get(String(c.id)) }))'),
    # Y la vuelta atras de la columna nueva: sin ella, subir esto antes
    # de ejecutar la migracion tumba la consulta de sets con un 400 y
    # **para el engorde entero**.
    (T, 'sin la migracion puesta, la tarea deja de engordar',
     '  ).catch(() => rest(`tcg_sets?select=${columnas}&market=eq.${MERCADO}${ordenar}`, clave))',
     '  )'),

    # ══ La chapa de legalidad ══

    # ── 6. Afirmar sin saber ──
    # La mas grave de todas: sin las marcas de la temporada, decirle a
    # alguien que su carta no vale. Es la leccion de la 319 aplicada a
    # algo que la gente se cree.
    (N, 'sin saber las marcas se da la carta por ilegal',
     '  if (!Array.isArray(marcas) || !marcas.length) return null',
     "  if (!Array.isArray(marcas) || !marcas.length) return { estado: 'fuera', marca: '' }"),

    # ── 6b. Y el null que no es un dato (tanda 338) ──
    # `regulation_mark` a null son DOS cosas que en la base se ven
    # igual: la carta no lleva marca, o no la hemos engordado. Sin esta
    # linea, a un Mew ex recien salido le sale «No es legal en
    # Estandar», que es lo peor que se le puede decir a alguien.
    (N, 'una carta sin engordar se da por ilegal',
     '  if (!marca && !carta.detalle_at) return null', '  if (false) return null'),
    # Y el contrario: no afirmar NUNCA sin marca, con lo que las cartas
    # viejas de verdad se quedan mudas y la chapa deja de servir.
    (N, 'una carta vieja sin marca se queda muda',
     '  if (!marca && !carta.detalle_at) return null', '  if (!marca) return null'),

    # ── 7. Los dos errores simetricos ──
    # Todo legal: la chapa deja de servir para nada y quien se fie se
    # presenta en un torneo con una lista que le rechazan.
    (N, 'todas las cartas salen legales',
     "  if (marca && marcas.includes(marca)) return { estado: 'legal', marca }",
     "  if (true) return { estado: 'legal', marca }"),
    # Y la reimpresion ignorada: una carta que SI se puede jugar sale en
    # rojo. Es el mismo fallo que PINGU cazo en la 328 con el Mew ex.
    (N, 'una carta con reimpresion legal sale como prohibida',
     "  if (legalidad.reimpresion) return { estado: 'reimpresion', marca }",
     '  if (false) return null'),

    # ── 8. Las energias basicas ──
    # Se pueden jugar siempre: es regla del JUEGO, no del formato. Sin
    # esto, cuatro lineas de cada lista salen marcadas en rojo.
    (N, 'las energias basicas dejan de estar siempre dentro',
     "  if (esEnergiaBasica(carta)) return { estado: 'legal', energia: true }",
     '  if (false) return null'),
    # Y el contrario: que una energia ESPECIAL se cuele como basica.
    (D, 'una energia especial se cuela como basica',
     "  if (cat === 'Energy') return canonico(A_ENERGIA, carta?.energy_type) !== 'Special'",
     "  if (cat === 'Energy') return true"),

    # ── 9. Que la regla se escriba dos veces ──
    # El revisor con su propia copia: el dia que rote la temporada, una
    # pantalla dira que la carta vale y la otra que no.
    (DK, 'el revisor se hace su propia copia de las marcas legales',
     "import { marcasLegales, hayReimpresionLegal } from '../carta-legalidad.js'",
     "import { hayReimpresionLegal } from '../carta-legalidad.js'\n"
     "const marcasLegales = async () => ['H', 'I', 'J']"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-335.mjs')
