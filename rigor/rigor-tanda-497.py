"""Rigor de la tanda 497 — «Jugar desde aquí».

Una posición mal puesta se juega igual: el fallo es que no es la de la
partida (una carta de más en el mazo, una energía que se puede volver a
unir, un Pokémon recién bajado que evoluciona). Cada mutación rompe el
ORIGEN de una de esas cosas (tanda 314).
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

POS = 'js/repeticiones/posicion.js'
REP = 'js/repeticiones.js'

MUTACIONES = [
    (POS, 'lo que no se vio no completa las 60',
     '  if (vistas60 < 60) entradas.push({ carta: SIN_VER, n: 60 - vistas60 })\n', ''),
    (POS, 'la energía de la mano no cuenta como gastada',
     "    if (e.tipo === 'unir' && (cat.startsWith('energ') || (!c && esEnergiaPorNombre(e.carta)))) flags.energia = true\n", ''),
    (POS, 'una energía unida por un efecto gasta la de la mano',
     '    if (e.jugador !== jugador || e.sub) continue', '    if (e.jugador !== jugador) continue'),
    (POS, 'el partidario jugado no cuenta',
     "    if (e.tipo === 'jugar' && ['supporter', 'partidario'].includes(plano(c?.trainer_type))) flags.partidario = true\n", ''),
    (POS, 'lo recién bajado puede evolucionar',
     '        entroTurno: k === actual && !viejo ? turno : 0,', '        entroTurno: 0,'),
    (POS, 'los premios se quedan en el mazo',
     '    st.premios = ocultas.splice(0, Math.max(0, p.premios))', '    st.premios = []'),
    (POS, 'la mano conocida se baraja con lo demás',
     '    const conocida = p.manoConocida.slice(0, p.mano).map(tomar)', '    const conocida = []'),
    (POS, 'le toca al que empezó, no al del turno',
     '  const actual = orden.indexOf(t.deQuien)', '  const actual = orden.indexOf(t.primero)'),
    (POS, 'el daño no viaja',
     '        danio: x.danio || 0,', '        danio: 0,'),
    (POS, 'se puede jugar desde el final',
     "  if (!lectura || !fotos?.[i] || fotos[i].fin) return false", '  if (!lectura || !fotos?.[i]) return false'),
    (REP, 'las flechas mueven la repetición con el laboratorio encima',
     "    if (document.documentElement.classList.contains('lab-abierto')) return\n", ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-497.mjs')
