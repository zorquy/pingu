"""Rigor de la tanda 319 — la barra de progreso de la portada.

El fallo original no daba error en ninguna parte: la tarjeta pintaba la
barra a cero y decía «Sin empezar» debajo de una guía leída entera. Cada
mutación devuelve una pieza a como estaba, y la prueba tiene que CAZAR
el texto que sale, no el código que lo produce.

Se muta el ORIGEN del dato (de dónde sale el progreso) y no una de sus
guardas: si dos guardas son red de repuesto una de la otra, quitar
cualquiera deja todo igual y la mutación no prueba nada.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── 1. El origen: la portada deja de traerse el progreso ──
    # ESTE es el fallo de la 316, tal cual. La tarjeta sigue existiendo,
    # la barra sigue pintándose y no falla nada: solo miente.
    ('js/home.js', 'la portada deja de traerse el progreso (el fallo de la 316)',
     "  let progreso = null\n  const sesion = await getSession()\n  if (sesion) {",
     "  let progreso = null\n  const sesion = null\n  if (sesion) {"),

    # ── 2. El valor por defecto vuelve a afirmar algo ──
    # Un `{}` en vez de `null` convierte «no se sabe» en «no hay nada», y
    # es lo único que hacía falta para que la portada mintiera.
    ('js/guia-tarjeta.js', 'el defecto vuelve a ser {} y «no se sabe» pasa a ser «cero»',
     'export function tarjetaDeGuia(g, { progreso = null, categoria = \'\', pie = false } = {}) {',
     'export function tarjetaDeGuia(g, { progreso = {}, categoria = \'\', pie = false } = {}) {'),

    # ── 3. La distinción de los tres estados, deshecha ──
    ('js/guia-tarjeta.js', 'la barra se pinta siempre, se sepa o no',
     '  const seSabe = progreso !== null && progreso !== undefined',
     '  const seSabe = true'),

    # ── 4. …y al revés: no se pinta nunca ──
    # La mutación simétrica. Sin ella, una prueba que solo mira «sin
    # sesión no hay barra» pasaría con una tarjeta que no pinta barra
    # JAMÁS, que es el otro modo de estar roto.
    ('js/guia-tarjeta.js', 'la barra no se pinta nunca, ni sabiéndolo',
     '  const seSabe = progreso !== null && progreso !== undefined',
     '  const seSabe = false'),

    # ── 5. El progreso se pide, pero de todo el mundo ──
    # Sin el filtro por usuario la portada enseñaría el progreso ajeno.
    ('js/home.js', 'el progreso se pide sin filtrar por quién eres',
     "      .eq('user_id', sesion.user.id)\n      .in('guide_id', data.map((g) => g.id))",
     "      .in('guide_id', data.map((g) => g.id))"),

    # ── 6. Se sabe, pero no se rellena ──
    # El mapa se construye vacío: se sabe (hay barra) y todas dicen «Sin
    # empezar». Es el síntoma EXACTO que vio PINGU, por otro camino.
    ('js/home.js', 'el mapa del progreso se queda vacío',
     '    for (const f of filas || []) progreso[f.guide_id] = f',
     '    for (const f of []) progreso[f.guide_id] = f'),

    # ── 7. La otra mitad: /aprender ──
    # La tarjeta es compartida, así que una mutación en ella tiene que
    # salir en las DOS pantallas. Si /aprender no la caza, es que la
    # prueba de /aprender no está mirando el progreso.
    ('js/guia-tarjeta.js', 'una guía leída deja de decirse leída',
     "  const leida = Boolean(p?.read_at) || p?.status === 'completed'",
     '  const leida = false'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-319.mjs')
