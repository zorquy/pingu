"""Rigor de la tanda 496 — la repetición de una partida de torneo.

Lo que se rompe aquí no da error: una repetición que no se ofrece, que se
ofrece a quien no es, o que se queda sin poder quitarse. Cada mutación
rompe el ORIGEN de una de esas puertas (tanda 314).
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

RON = 'js/torneos/ronda.js'
DAT = 'js/repeticiones/datos.js'

MUTACIONES = [
    # (La de «se le pregunta a la base también sin cuenta» ya no es una
    # mutación: desde la 555 se le pregunta a propósito, por las de MESA.)
    (RON, 'se ofrece una cuarta repetición',
     '  const puedeAdjuntar = esMia && hayPartida && mias < 3', '  const puedeAdjuntar = esMia && hayPartida'),
    (RON, 'una mesa pendiente ofrece adjuntar',
     "  const hayPartida = m.status !== 'pending' && m.status !== 'bye' && m.player_a_id && m.player_b_id",
     '  const hayPartida = m.player_a_id && m.player_b_id'),
    (RON, 'la de contra tu rival no sale primero',
     '.sort((a, b) => contraRival(b) - contraRival(a))', ''),
    (RON, '«Quitar» sale también en la del rival',
     '      r.user_id === yo ? ` <button type="button" class="link-btn" data-quitar-rep=',
     '      true ? ` <button type="button" class="link-btn" data-quitar-rep='),
    (RON, 'el desplegable ofrece las que ya están puestas',
     '  const lista = guardadas.filter((r) => !yaPuestas.has(r.id))', '  const lista = guardadas.filter(Boolean)'),
    (RON, '«Tu partida» terminada no ofrece la repetición',
     "    const html = `<p class=\"torneo-partida-nota\">Mesa ${mia.table_number} — ${texto}</p>${repeticionesDeMesaHtml(mia)}`",
     "    const html = `<p class=\"torneo-partida-nota\">Mesa ${mia.table_number} — ${texto}</p>`"),
    (DAT, 'quitar no dice cuál',
     "'torneos_quitar_repeticion', { p_partida: partidaId, p_repeticion: replayId }", "'torneos_quitar_repeticion', { p_partida: partidaId }"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-496.mjs')
