"""Rigor de la tanda 426 — marcar varias de golpe.

Casi nada de esto da error al romperse: un modo que se queda puesto, una
marca que se pierde al repintar, un «Cancelar» que guarda igual, cuatro
inserts donde debía haber uno, o una fila gemela de una carta que ya
tenías. Todo se ve bien en una captura. Por eso cada mutación rompe el
ORIGEN —el Set, la clave, la consulta— y no una de sus guardas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

J = 'js/mi-coleccion.js'
D = 'js/mi-coleccion/datos.js'
C = 'css/mi-coleccion.css'
H = 'mi-coleccion.html'

MUTACIONES = [
    # ── El modo ──
    #
    # AQUÍ IBA «el modo nace encendido» (cambiar el `null` de `marcadas`
    # por un Set). No está porque NO CAMBIA NADA: `abrirAlbum` ya apaga el
    # modo al entrar en una expansión, así que el valor inicial no se llega
    # a ver nunca desde la pantalla. Es el caso de CLAUDE.md —dos guardas
    # que son red de repuesto una de la otra—, y una mutación que no cambia
    # el comportamiento no es una prueba aprobada: sobra la mutación.
    (J, 'el boton no apaga el modo',
     "  $('mcMarcarAbrir')?.addEventListener('click', () => modoMarcar(!marcadas))",
     "  $('mcMarcarAbrir')?.addEventListener('click', () => modoMarcar(true))"),
    (J, 'cancelar no apaga nada',
     "  $('mcMarcarCancelar')?.addEventListener('click', () => modoMarcar(false))\n", "  \n"),
    # Y tampoco «salir de la expansión deja el modo puesto»: esa guarda
    # estaba DOS veces —al salir y al entrar— y el único camino de vuelta a
    # una rejilla pasa por `abrirAlbum`, así que quitar la de salir no
    # cambiaba nada. Se ha quitado del código; la que queda es la de
    # entrar, que sí se nota.
    (J, 'entrar en una expansion no apaga el modo',
     "  if (marcadas) modoMarcar(false)\n  album.set = setId", "  album.set = setId"),

    # ── La marca ──
    (J, 'la clave se olvida de la version',
     "const claveMarca = (cardId, variante = 'normal') => `${cardId}|${variante || 'normal'}`",
     "const claveMarca = (cardId) => `${cardId}|normal`"),
    (J, 'la marca solo vive en el DOM: se pierde al repintar',
     "const claseMarcada = (cardId, variante = 'normal') =>\n  marcadas?.has(claveMarca(cardId, variante)) ? ' marcada' : ''",
     "const claseMarcada = () => ''"),
    (J, 'volver a pulsar no desmarca',
     "  if (marcadas.has(clave)) marcadas.delete(clave)\n  else marcadas.add(clave)",
     "  marcadas.add(clave)"),
    (J, 'en modo marcar, pulsar sigue abriendo la ficha',
     "      if (marcadas && enlace.dataset.marca) {\n        e.preventDefault()\n        return alternarMarca(enlace)\n      }\n", "      "),
    (J, 'la barra espaciadora no marca',
     "    if (e.key !== ' ' && e.key !== 'Spacebar') return",
     "    if (e.key !== 'F7') return"),
    (J, 'el boton de anadir no dice cuantas',
     "    guardar.textContent = cuantas ? `Añadir ${cuantas}` : 'Añadir'",
     "    guardar.textContent = 'Añadir'"),
    (J, 'se puede guardar sin nada marcado',
     "    guardar.disabled = !cuantas", "    guardar.disabled = false"),

    # ── Lo que se guarda ──
    (D, 'vuelve a una peticion por carta',
     "  if (nuevas.length) {\n    const { data: creadas, error: fallo } = await supabase\n      .from('user_collection')\n      .insert(nuevas)\n      .select(COLUMNAS_LINEA)",
     "  if (nuevas.length) {\n    const unaAUna = []\n    for (const n of nuevas) {\n      const r = await supabase.from('user_collection').insert(n).select(COLUMNAS_LINEA)\n      if (r.error) throw traducir(r.error)\n      unaAUna.push(...(r.data || []))\n    }\n    const { data: creadas, error: fallo } = { data: unaAUna, error: null }"),
    (D, 'no mira lo que ya tienes: nace una fila gemela',
     "  const porClave = new Map((data || []).map((l) => [claveDeLinea(l), l]))",
     "  const porClave = new Map()"),
    (D, 'una escritura rechazada pasa por buena',
     "    if (!creadas?.length) throw new Error('No se ha podido guardar: revisa que has iniciado sesión.')\n", "    \n"),
    (J, 'lo guardado no entra en la lista de la pagina',
     "    for (const l of puestas) {\n      const i = lineas.findIndex((x) => x.id === l.id)\n      if (i >= 0) lineas[i] = l\n      else lineas.unshift(l)\n    }\n", "    \n"),

    # ── El CSS ──
    (C, 'la marca es solo color, sin signo',
     ".mc-bolsillo.marcada::after {\n  content: '✓';", ".mc-bolsillo.marcada::after {\n  content: '';"),
    (C, 'la barra se mete debajo de la del sitio',
     "  top: 72px;\n  flex-wrap: wrap;", "  top: 0;\n  flex-wrap: wrap;"),
    (C, 'el − y el + se quedan en modo marcar',
     ".mc-album-marcando .mc-bolsillo-controles {\n  display: none;\n}",
     ".mc-album-marcando .mc-bolsillo-controles {\n  opacity: 0.99;\n}"),
    # Y tampoco está «la barra escondida sigue ocupando»: la clase global
    # `.hidden` es `display: none !important`, así que la regla propia que
    # había aquí era código muerto y quitarla no se notaba. (El truco de la
    # 412 era con el ATRIBUTO `[hidden]`, que viene de la hoja del
    # navegador y sí se puede pisar; no con esta clase.)

    # ── El HTML ──
    (H, 'la rejilla se queda sin boton de marcar',
     '<button type="button" class="mc-chip-mando" id="mcMarcarAbrir" aria-pressed="false">Marcar varias</button>', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-426.mjs')
