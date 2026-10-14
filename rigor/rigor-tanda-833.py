"""Rigor de la tanda 833 — saltar una jornada de liga que no se jugó.

Cada mutación rompe el ORIGEN: el botón, lo que inserta saltar (cerrada,
sin empezar), el paso a «en juego», la regla de «saltada», el final al
saltar la última, el estado al recuperar y «Tus jornadas»."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

RO = 'js/torneos/ronda.js'
JO = 'js/torneos/jornadas.js'

MUTACIONES = [
    (RO, 'no sale «Saltar»', "          `<button class=\"btn-secondary\" id=\"btnSaltarJornada\">Saltar la jornada ${n}</button>`", "          ''"),
    (RO, 'el botón no hace nada', "  if ($('btnSaltarJornada')) $('btnSaltarJornada').addEventListener('click', saltarJornada)\n", ""),
    (RO, 'saltar crea la ronda SIN cerrar', ".insert({ tournament_id: ctx.torneo.id, round_number: n, phase: 'swiss', status: 'finished', closed_at: ahora() })", ".insert({ tournament_id: ctx.torneo.id, round_number: n, phase: 'swiss', status: 'pending', closed_at: ahora() })"),
    (RO, 'saltar la marca como empezada', ".insert({ tournament_id: ctx.torneo.id, round_number: n, phase: 'swiss', status: 'finished', closed_at: ahora() })", ".insert({ tournament_id: ctx.torneo.id, round_number: n, phase: 'swiss', status: 'finished', started_at: ahora(), closed_at: ahora() })"),
    (RO, 'la liga no pasa a «en juego»', "    await supabase.from('tournaments').update({ status: 'in_progress' }).eq('id', ctx.torneo.id)\n    ctx.torneo.status = 'in_progress'\n  }\n  if (ultima) {", "  }\n  if (ultima) {"),
    (RO, 'saltar la última no cierra la liga', "    if (ctx.torneo.top_cut_size === 0) await terminarTorneo('Liga terminada: la clasificación de abajo es la final.')", "    if (false) await terminarTorneo('Liga terminada: la clasificación de abajo es la final.')"),
    (RO, 'recuperar deja la liga en «cerradas»', "    const antes = esLiga() ? 'registration_open' : 'registration_closed'", "    const antes = 'registration_closed'"),
    (RO, 'sin aviso de fecha', "  if (!fecha || Date.now() - new Date(fecha).getTime() < 86400000) return ''", "  return ''"),
    (RO, 'la línea de tiempo no dice «No se jugó»', "          ? (rondaSaltada(r) ? 'No se jugó' : 'Terminada')", "          ? 'Terminada'"),
    (RO, 'un torneo de un día también se salta', "      if (esLiga()) {\n        // El botón sale siempre (801)", "      if (true) {\n        // El botón sale siempre (801)"),
    (JO, 'la regla de «saltada» mira solo el estado', "export const esRondaSaltada = (r) => Boolean(r) && r.phase === 'swiss' && r.status === 'finished' && !r.started_at", "export const esRondaSaltada = (r) => Boolean(r) && r.phase === 'swiss' && r.status === 'finished'"),
    (JO, '«Tus jornadas» no sabe de saltadas', "    saltadas: new Set((rondas.data || []).filter(esRondaSaltada).map((r) => r.round_number)),\n", ""),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-833.mjs')
