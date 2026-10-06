"""Rigor de la tanda 630 — «¿cómo la encuentro?» con lo que hacen las cartas
de la mano, y la mano contada en «tú contra ti».

Cada mutación rompe el ORIGEN: la acción, el puente, la regla de adelgazar,
la de robar hasta N, el barajar por estratos, el texto o la pila. Lo que es
solo para ir más deprisa (no mirar adelgazar en el último paso) o para
afinar una cifra que no se ve (los repartos de probar puentes) no se muta:
no cambia nada que se pueda observar."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

CA = 'js/constructor/caminos.js'
CH = 'js/constructor/caminos-html.js'
PA = 'js/constructor/partida.js'
EF = 'js/constructor/efectos.js'
LA = 'js/constructor/laboratorio.js'
CSS = 'css/laboratorio.css'

MUTACIONES = [
    # ── Un básico que se baja y se usa ──
    (CA, 'un básico con habilidad de botón no es un paso desde la mano', "      } else if (seBajaYSeUsa(c, def) && p.huecosBanca > 0) {", "      } else if (false) {"),
    (CA, 'se baja y no se usa la habilidad', "      if (accion.usa) {\n", "      if (false) {\n"),
    (CA, 'Fezandipiti no es puente', "        const bajaYUsa = !!def && seBajaYSeUsa(c, def)", "        const bajaYUsa = false"),
    (CA, 'Kadabra (roba al evolucionar) no es puente', "(conBoton(def) || def.cuando === 'evolucionar')", "conBoton(def)"),

    # ── Adelgazar ──
    (CA, 'las búsquedas no cogen de más', "      const hasta = Math.min(o.max, tope(p, o, sel.length))", "      const hasta = sel.length"),
    (CA, 'a la banca se llena hasta el último hueco', "Math.min(o.max, p.huecosBanca - 1)", "o.max"),
    (CA, 'se coge de más a la mano aunque venga un robo hasta N', "    if (o.destino === 'mano' && !adelgazarAMano) return ya\n", ""),
    (CA, 'nadie mira si hay un robo hasta N a tiro', "{ adelgazarAMano: !roboSegunMano }", "{ adelgazarAMano: true }"),
    (EF, 'Ariana no avisa de que roba según la mano', "    // Lo que roba depende de lo que tengas en la mano: lo mira «¿cómo la\n    // encuentro?» (caminos.js, tanda 630) para vaciarla antes.\n    robaSegunMano: true,\n", ""),
    (PA, 'la búsqueda no dice adónde van las cartas', "zona: 'mazo', destino })", "zona: 'mazo' })"),
    (CA, 'vaciar la mano no prepara nada', "(roboSegunMano && p.s.mano.length < manoAntes)", "false"),
    (CA, 'el paso dice «adelgaza» aunque no cambie nada', "    if (i >= 8 || !(await adelgazarCuenta(c))) c.adelgazan = c.adelgazan.map(() => 0)", "    if (i >= 8) c.adelgazan = c.adelgazan.map(() => 0)"),

    # ── Barajar por estratos ──
    (CA, 'después de barajar, la carta cae donde cae', "    if (s.repartoDeCaminos == null) return\n", "    return\n"),
    (CA, 'el `barajar` de los caminos se queda puesto', "    else delete p.barajar\n", "    else {}\n"),

    # ── Lo que se lee ──
    (CH, 'el paso dice solo «Bajar Fezandipiti ex (Flip the Script)»', "(paso.usa ? `Bajar ${n} y usar ${h}` : `Bajar ${n} (${h})`)", "`Bajar ${n} (${h})`"),
    (CH, 'no se dice que hay que coger de más', "  const adelgaza = paso.adelgaza ? ' <span class=\"lab-paso-si\">cogiendo todas las que deje: el mazo adelgaza</span>' : ''", "  const adelgaza = ''"),

    # ── La mano contada en «tú contra ti» ──
    (LA, 'tu mano no se cuenta en «tú contra ti»', "  const mano = rival || L.mesa\n", "  const mano = rival\n"),
    (CSS, 'en el móvil tu mano va siempre debajo', "  .lab-lado-rival .lab-zona-pilas,\n  .lab-lado-propio .lab-zona-pilas:has(.lab-pila-mano) {", "  .lab-lado-rival .lab-zona-pilas {"),
    (CSS, 'tus pilas con su tamaño de siempre (pisan al activo)', "  .lab-lado-propio:has(.lab-pila-mano) {\n    --lab-c-pila: 32px;\n  }\n", ""),
    (CSS, 'a 360 px tu mano sigue en la fila (pisa al activo)', "@media (max-width: 379px) {", "@media (max-width: 1px) {"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-630.mjs')
