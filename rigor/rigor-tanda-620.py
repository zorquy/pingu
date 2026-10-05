"""Rigor de la tanda 620 — «tú contra ti»: la mesa gira hacia quien decide,
y lo que se pide va en el centro sin tapar la mano.

Cada mutación rompe el ORIGEN de una decisión: quién decide, hacia dónde
mira la mesa, dónde se pinta lo que se pide y qué se marca como nuevo.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

LAB = 'js/constructor/laboratorio.js'
PAR = 'js/constructor/partida.js'
CSS = 'css/laboratorio.css'

MUTACIONES = [
    (LAB, 'la mesa no gira: pinta siempre al que juega', "  if (L.mesa) L.partida = L.vista || L.mesa.actual", "  if (L.mesa) L.partida = L.mesa.actual"),
    (LAB, 'nadie decide fuera de su turno', "  return L.mesa && q && q !== L.mesa.actual && L.mesa.jugadores.includes(q) ? q : null", "  return null"),
    (PAR, 'subir el activo no dice quién lo elige', "min: 1, max: 1, sinCancelar: true, partida: this, elige: this })\n    const p = this.slot(id)", "min: 1, max: 1, sinCancelar: true, partida: this })\n    const p = this.slot(id)"),
    (LAB, 'lo que se pide no va en el centro', "    medio = elegirTextoHtml(e)\n    botones = elegirBotonesHtml(e)\n", ''),
    (LAB, 'la barra flotante vuelve encima de la mano', "  el.classList.toggle('hidden', !a)\n", "  el.classList.toggle('hidden', !a && !e)\n"),
    (CSS, 'la mano se apaga eligiendo quién sube', ".lab-modo-elegir[data-eligiendo='cartas'] .lab-mano-carta:not(.lab-elegible-mano),\n", ".lab-modo-elegir[data-eligiendo='cartas'] .lab-mano-carta:not(.lab-elegible-mano),\n.lab-modo-elegir:not([data-eligiendo='cartas']) .lab-mano-carta,\n"),
    (LAB, 'lo robado a mitad de jugada no se marca', "            const nueva = antes ? !antes.has(u) : L.nuevas?.has(u)", "            const nueva = L.nuevas?.has(u)"),
    (PAR, 'todo activo que falta «ha caído»', "    const que = s.activoCaido ? 'tu activo ha caído' : 'te has quedado sin activo'", "    const que = 'tu activo ha caído'"),
    (PAR, 'el KO del rival no apunta que su activo ha caído', "      if (d === op.s.activo) op.s.activoCaido = true\n", ''),
    (LAB, 'girada, la barra dice el turno del que decide', "    else if (m.fase === 'juego') t = L.vista ? `Turno ${m.m.turnoGlobal} · decide ${L.vista.nombreJugador}` :", "    else if (m.fase === 'juego') t = false ? '' :"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-620.mjs')
