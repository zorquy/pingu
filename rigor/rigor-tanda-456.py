"""Rigor de la tanda 456 — el laboratorio a dos y la mesa de un clic.

Casi nada de esto da error al romperse. Un premio que no se coge deja la
partida igual de jugable; una energía que se va al descarte que no es el
suyo no se nota hasta que alguien cuenta las cartas; un clic que juega en
el primer Pokémon en vez de en el que tocaste «funciona»; una lengüeta
encima de un botón se pulsa igual… por el otro lado. Cada mutación rompe
el ORIGEN de una de esas cosas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

P = 'js/constructor/partida.js'
E = 'js/constructor/efectos.js'
L = 'js/constructor/laboratorio.js'
C = 'js/constructor.js'
CSS = 'css/laboratorio.css'

MUTACIONES = [
    # ── 1. La mesa ──
    (P, 'el turno no pasa al otro',
     '    this.m.turnoDe = this.indice(op)\n', '    this.m.turnoDe = this.indice(j)\n'),
    (P, 'un KO fuera de un ataque no da premios al otro',
     '      this.mesa?.premiosPendientes(op, n)\n', ''),
    (P, 'lo que cae va al descarte de quien lo descarta, no al de su dueño',
     '    for (const u of uids) this.duenoDe(u).s.descarte.push(u)', '    for (const u of uids) this.s.descarte.push(u)'),
    (P, 'el estadio se queda solo en un lado',
     '    if (this.oponente) this.oponente.s.estadio = uid\n', ''),
    (P, 'la debilidad no cuenta',
     "      else total *= numero(w.value, 2)\n", ''),
    (P, 'la resistencia no cuenta',
     '      total -= numero(r.value, 30)\n', ''),
    (P, 'un ataque de verdad no mira la debilidad',
     'const dr = this.oponente ? this.debilidadYResistencia(slot, objetivo, danio + extra) : { total: danio + extra, razones: [] }',
     'const dr = { total: danio + extra, razones: [] }'),
    (P, 'deshacer solo devuelve un lado',
     '    this.jugadores[1].s = f.b\n', ''),
    (P, 'para el otro, el KO no pasó «en el último turno de su rival»',
     '      if (this.enTurno) op.s.koUltimoTurnoRival = true\n', ''),
    (P, 'quien no puede robar no pierde',
     "    if (!s.mazo.length) {\n      this.terminar('derrota'", "    if (false) {\n      this.terminar('derrota'"),
    (P, "Boss's Orders no cambia el activo del otro",
     '      op.cambiarActivo(d)\n      return true', '      return true'),
    (P, 'quién empieza se cambia con la partida empezada',
     "    if (this.m.fase !== 'preparacion' && this.m.fase !== 'mulligan') return\n    this.m.primero = i",
     '    this.m.primero = i'),
    (P, 'ir primero o segundo se cambia con la partida empezada',
     "  ponerVaPrimero(primero) {\n    if (this.s.fase !== 'preparacion' && this.s.fase !== 'mulligan') return\n",
     '  ponerVaPrimero(primero) {\n'),
    (P, '«listo» sin activo',
     "    if (!j.s.activo) throw new NoSePuede(`${j.nombreJugador}: elige primero tu Pokémon activo.`)\n", ''),

    # ── 2. Las cartas que tocan al rival ──
    (E, 'el rival no roba tras barajar (Juez, Estampa…)',
     '  op.manoAlMazo()\n  op.robar(n, { motivo })', '  op.manoAlMazo()'),
    (E, 'el rival no descarta (Xerosic)',
     "zona: 'mano', partida: op })\n  op.descartar(el)\n", "zona: 'mano', partida: op })\n"),
    (E, 'la energía quitada va a MI descarte',
     '  op.s.descarte.push(fuera)\n', '  p.s.descarte.push(fuera)\n'),
    (E, 'Martillo Mejorado quita también energías básicas',
     "filtro: (c) => !esEnergiaBasica(c) })),", "filtro: () => true })),"),

    # ── 3. Jugar con un clic ──
    (L, 'con varios sitios posibles, se juega en el primero sin preguntar',
     '  if (valen.length === 1 || !conSitio.length) return hacer(() => p.jugarDeMano(uid, valen[0], ui))',
     '  if (true) return hacer(() => p.jugarDeMano(uid, valen[0], ui))'),
    (L, 'tocar un Pokémon que brilla juega en otro',
     '      const o = sl && L.apuntar.opciones[sl.dataset.slotCarta]', '      const o = sl && Object.values(L.apuntar.opciones)[0]'),
    (L, 'Escape no cancela el apuntar (cierra el laboratorio)',
     '    else if (cancelarApuntar()) {', '    else if (false) {'),
    (L, 'el foco no va al primero que brilla',
     '  primero?.focus({ preventScroll: true })\n', ''),
    (L, 'la carta que no se puede jugar no va apagada',
     "            const j = s.fase === 'turno' || s.fase === 'preparacion' ? jugable(u) : false", '            const j = true'),
    (L, 'tras pasar el turno, la pantalla sigue con el mismo jugador',
     '  if (L.mesa) L.partida = L.mesa.actual\n', ''),
    (L, 'en la preparación se ve lo que puso el otro',
     "  const tapado = rival && m?.fase === 'preparacion'", '  const tapado = false'),
    (L, 'el interruptor de quién empieza (mesa) no hace nada',
     '        else L.mesa.ponerPrimero(Number(v))\n', '\n'),
    (L, 'el interruptor de ir primero (muñeco) no hace nada',
     "        } else p.ponerVaPrimero(v === 'primero')", '        }'),

    # ── 4. Ver la carta ──
    (L, 'el clic derecho no enseña la carta',
     '    if (verLoDeBajo(e.target)) e.preventDefault()', '    void 0'),
    (L, 'mantener pulsado enseña la carta y el toque de después la juega',
     '      if (verLoDeBajo(el)) L.ignorarClic = true', '      verLoDeBajo(el)'),
    (L, '«v» no enseña la carta',
     '    verLoDeBajo(foco)\n    return true', '    return true'),

    # ── 5. El panel ──
    (L, 'en ancho el panel empieza cerrado',
     'const panelVisible = () => (L.panelAbierto == null ? anchoGrande() : L.panelAbierto)', 'const panelVisible = () => (L.panelAbierto == null ? false : L.panelAbierto)'),
    (L, 'cerrado, no queda lengüeta',
     "  pestana?.classList.toggle('hidden', abierto)", "  pestana?.classList.toggle('hidden', true)"),
    (L, '«p» no abre el panel',
     "  if (e.key === 'p' || e.key === 'P') {\n    accionDeBarra('panel')", "  if (e.key === 'p' || e.key === 'P') {\n    void 0"),
    (CSS, 'la lengüeta tapa la mesa (sin su sitio)',
     '    padding-right: 56px;\n', ''),

    # ── 6. Elegir el mazo ──
    (L, 'un mazo de 4 cartas vale',
     '      if (total < 13) throw', '      if (false) throw'),
    (L, '«Mis mazos» no carga los tuyos',
     '        const filas = await misMazos(L.userId)\n        cuerpo._mios = filas', '        const filas = []\n        cuerpo._mios = filas'),
    (C, 'el constructor no le dice al laboratorio quién eres',
     'userId: estado.sesion?.user?.id || null })', 'userId: null })'),
    (L, 'se reparte sin el mazo del jugador 2',
     "    caja.querySelector('[data-dlg=\"ok\"]').disabled = m === 'mesa' && !b.mazos[1]", "    caja.querySelector('[data-dlg=\"ok\"]').disabled = false"),
    (L, 'cambiar un mazo y cancelar cambia la partida en juego',
     '      L.borrador.mazos[i] = { nombre,', '      L.mazos[i] = L.borrador.mazos[i] = { nombre,'),

    # ── 6b. Lo que encontró la revisión ──
    (L, 'una ventana que hay que contestar se cierra con Escape (y bloquea la mesa)',
     '  if (dialogoObligatorio) {', '  if (false) {'),
    (L, 'tras una jugada, el foco se cae al «body»',
     '    pintar()\n    devolverFoco(foco)\n  }\n}', '    pintar()\n  }\n}'),
    (L, 'al cerrar una ventana, el foco no vuelve a quien la abrió',
     '  devolverFoco(antes?.marca, antes?.el)\n', ''),
    (L, 'al cerrar el panel estrecho, el foco va a una lengüeta escondida',
     "        ;(pest && pest.getClientRects().length ? pest : $('.lab-btn-panel'))?.focus()", '        pest?.focus()'),
    (L, 'Escape cierra el laboratorio con el panel estrecho abierto',
     '    } else if (panelVisible() && !anchoGrande()) {', '    } else if (false) {'),
    (L, 'el Ctrl+Z del laboratorio le llega también al constructor',
     '        e.preventDefault()\n        e.stopPropagation()\n', '        e.preventDefault()\n'),
    (L, 'el tabulador se escapa del laboratorio',
     "  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) return atraparTab(", "  if (false) return atraparTab("),
    (L, 'las flechas no se mueven por un grupo de opciones',
     "  if (radio && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) {", '  if (false) {'),
    (CSS, 'la cabecera se parte en dos filas entre 1.200 y 1.300',
     '  .lab-barra {\n    flex-wrap: nowrap;\n  }\n', ''),
    (CSS, 'el corte de los botones de icono, a ojo (1.199)',
     '@media (max-width: 1299px) {', '@media (max-width: 1199px) {'),
    (CSS, 'el título de la barra se monta encima de los modos',
     '    flex: 0 1000 auto;\n    min-width: 112px;\n', '    flex: 0 1000 auto;\n'),
    (CSS, 'entre 761 y 1.099 el turno no baja a dos líneas (se corta)',
     '    line-height: 1.25;\n    white-space: normal;\n  }\n}', '    line-height: 1.25;\n  }\n}'),
    (CSS, 'el turno cede antes que el nombre de los mazos',
     '  .lab-titulo {\n    flex: 0 1000 auto;', '  .lab-titulo {\n    flex: 0 0 auto;'),
    (E, 'Iono: solo roba quien tenía mano',
     '      if (L || suya.length) {', '      if (L) {'),
    (E, 'Campana Oscura confunde también a un Oscuro del otro',
     "      if (suyo && !(p.oponente && esDeTipo(p.oponente.cartaDe(suyo), 'D'))) ponerEstado(suyo, 'confundido')", "      if (suyo) ponerEstado(suyo, 'confundido')"),

    # ── 7. El dibujo ──
    (CSS, 'el tapete cambia con el tema',
     'linear-gradient(180deg, var(--navy-solid-dark) 0%, var(--navy-solid) 50%, var(--navy-solid-dark) 100%)',
     'linear-gradient(180deg, var(--bg) 0%, var(--ice) 50%, var(--bg) 100%)'),
    (CSS, 'la mano no se queda abajo',
     '.lab-mano-zona {\n  position: sticky;\n  bottom: 0;\n', '.lab-mano-zona {\n'),
    (CSS, 'en el móvil, la mano tapa la banca al elegir',
     '  .lab-modo-apuntar .lab-mano-zona {\n    display: none;\n  }\n', ''),
    (CSS, 'la fila de muñecos estira la mesa en el móvil',
     '  align-items: stretch;\n  gap: var(--e-sm);\n}', '  gap: var(--e-sm);\n}'),
    (CSS, 'la cabecera del móvil no cabe en dos filas',
     '  .lab-btn-texto {\n    position: absolute;\n    width: 1px;\n    height: 1px;\n    overflow: hidden;\n    clip-path: inset(50%);\n    white-space: nowrap;\n  }\n}',
     '}'),
    (CSS, 'el latido no se apaga con «menos movimiento»',
     '  .lab-apuntable .lab-slot-carta,\n  .lab-dialogo,', '  .lab-dialogo,'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-456.mjs')
