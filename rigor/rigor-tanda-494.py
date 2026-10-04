"""Rigor de la tanda 494 — los mazos de una repetición y apuntarla en
Mis partidas.

Un mazo mal contado o una partida mal apuntada no dan error: salen en la
pantalla con toda la pinta de estar bien. Cada mutación rompe el ORIGEN de
uno de esos datos (tanda 314).
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MAZ = 'js/repeticiones/mazos.js'
REP = 'js/repeticiones.js'
DAT = 'js/repeticiones/datos.js'
CON = 'js/constructor.js'
MIS = 'js/mis-partidas.js'

MUTACIONES = [
    (MAZ, 'cada cuenta SUMA las veces que se vio, en vez del máximo a la vez',
     '      for (const [c, k] of ahora) if (k > (max[n].get(c) || 0)) max[n].set(c, k)\n',
     '      for (const [c, k] of ahora) max[n].set(c, (max[n].get(c) || 0) + k)\n'),
    (MAZ, 'el arquetipo se cruza con el nombre en español',
     '      name: c?.name || v.nombre,\n', '      name: v.nombre,\n'),
    (MAZ, 'sin catálogo, un Pokémon en juego no es Pokémon',
     "  if (enJuego.has(nombre)) return 'pokemon'\n", ''),
    (REP, 'los mazos se guardan al revés de los jugadores',
     "const mazosParaGuardar = () => (R.mazos ? R.fotos[0].orden.map((n) => R.mazos[n]?.arq?.nombre || '') : null)",
     "const mazosParaGuardar = () => (R.mazos ? [...R.fotos[0].orden].reverse().map((n) => R.mazos[n]?.arq?.nombre || '') : null)"),
    (REP, 'el enlace del constructor no dice de dónde viene',
     ", de: 'repeticion' })}", ' })}'),
    (REP, 'la partida se apunta siempre como ganada',
     "!yo || !ganador ? null : ganador === yo ? 'win' : 'loss')", "!yo || !ganador ? null : 'win')"),
    (REP, 'el mazo apuntado no lleva la clave del torneo',
     "  const clave = (arq) => (arq && mazosCargados ? mazosCargados.claveDeArquetipo(arq) : 'sin-mazo')",
     "  const clave = (arq) => (arq ? `d:${arq.nombre}` : 'sin-mazo')"),
    (REP, 'un nombre recordado de otro no deja a nadie sin marcar',
     "  return recordado ? '' : R.fotos[0].protagonista", '  return R.fotos[0].protagonista'),
    (REP, 'apuntarla no deja enlace a la repetición',
     '    replay_id: replayId,\n', ''),
    (DAT, 'apuntarla dos veces da un error en vez de decir que ya estaba',
     "  if (error?.code === '23505') return { ya: true }\n", ''),
    (CON, 'el constructor no avisa de que es lo que se vio',
     "    if (p.get('de') === 'repeticion') {", '    if (false) {'),
    (CON, 'el constructor no le pone el nombre',
     '    if (nombre && !estado.nombre) estado.nombre = nombre\n', ''),
    (MIS, 'Mis partidas no sabe de qué repetición viene una partida',
     '    repeticion: p.replay_id || null,\n', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-494.mjs')
