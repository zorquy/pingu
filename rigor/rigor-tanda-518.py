"""Rigor de la tanda 518 — importar varias partidas a la vez.

Lo que se rompe aquí no da error: dos partidas leídas como una, la misma
guardada dos veces, una partida apuntada como ganada que se perdió, o una
sin ganador apuntada igual.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

VAR = 'js/repeticiones/varias.js'
REP = 'js/repeticiones.js'

MUTACIONES = [
    (VAR, 'no se parte por «Preparación»', "const INICIO = /^(preparaci[oó]n|setup)$/i", "const INICIO = /^(xpreparacion)$/i"),
    (VAR, 'la misma dos veces cuenta dos', '  return [...new Set(trozos.map((t) => t.join(\'\\n\').trim()))]', "  return trozos.map((t) => t.join('\\n').trim())"),
    (VAR, 'lo de antes de la primera se cuela', '    } else if (actual) actual.push(l)', '    } else (actual ||= []).push(l)'),
    (VAR, 'el recordado no manda', '  if (recordado && cuenta.has(recordado)) return recordado\n', ''),
    (VAR, 'con un empate se elige a uno', '  return n >= 2 && !empatado ? mas : null', '  return n >= 2 ? mas : null'),
    (REP, 'los ficheros no se leen', "  for (const f of cuerpo.querySelector('#repVariasFicheros').files || []) {", '  for (const f of []) {'),
    (REP, 'el resultado se apunta al revés', "          resultado: v.ganador === yo ? 'win' : 'loss',\n          tipo: 'normal',\n          donde: 'TCG Live',\n          replay_id: fila.id,", "          resultado: v.ganador === yo ? 'loss' : 'win',\n          tipo: 'normal',\n          donde: 'TCG Live',\n          replay_id: fila.id,"),
    (REP, 'se apunta una sin ganador', '      if (apuntar && juega && v.ganador) {', '      if (apuntar && juega) {'),
    (REP, 'se guardan compartidas', '        compartida: false,\n        mazos: v.jugadores.map', '        compartida: true,\n        mazos: v.jugadores.map'),
    (REP, 'la apuntada no lleva su repetición', '          replay_id: fila.id,\n        })', '          replay_id: null,\n        })'),
    (REP, 'no recuerda quién eres', '  if (yo) recordarYo(yo)\n  boton.disabled = true', '  boton.disabled = true'),
    (REP, 'sin decir quién eres se deja apuntar', "    <label class=\"rep-check\"><input type=\"checkbox\" id=\"repVariasApuntar\"${yo ? ' checked' : ' disabled'} />", '    <label class="rep-check"><input type="checkbox" id="repVariasApuntar" checked />'),
    (REP, 'el título no se cuenta desde ti', '        titulo: `${a} contra ${b}`,', '        titulo: `${v.jugadores[0]} contra ${v.jugadores[1]}`,'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-518.mjs')
