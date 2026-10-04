"""Rigor de la tanda 553 — quién eres al guardar una repetición.

Lo que se rompe aquí no da error: una partida apuntada al revés, sin sus
mazos («Sin identificar») porque no se esperó a deducirlos, o con un
resultado inventado cuando el registro no lo dice.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

REP = 'js/repeticiones.js'
REG = 'js/repeticiones/registro.js'

MUTACIONES = [
    (REG, 'el final con la razón delante no se lee', "    [new RegExp(`\\\\. ${P} ha ganado(?: la partida)?$`), (m) => ({ tipo: 'fin', ganador: m[1] })],\n", ''),
    (REP, 'no se espera a los mazos', '  ;(R.mazos ? Promise.resolve() : pintarMazos())', '  ;Promise.resolve()'),
    (REP, 'el resultado se cuenta al revés', "(!yo || !ganador ? null : ganador === yo ? 'win' : 'loss')", "(!yo || !ganador ? null : ganador === yo ? 'loss' : 'win')"),
    (REP, 'sin final se supone que ganaste', "(!yo || !ganador ? null : ganador === yo ? 'win' : 'loss')", "(!yo ? null : !ganador ? 'win' : ganador === yo ? 'win' : 'loss')"),
    (REP, 'lo que dices de cómo acabó no cuenta', "resultadoDesde(elegido, ganador) || (elegido ? cuerpo.querySelector('[name=repResultado]:checked')?.value || null : null)", 'resultadoDesde(elegido, ganador)'),
    (REP, 'no se pregunta cómo acabó', '  const comoAcabo = ganador\n', '  const comoAcabo = true\n'),
    (REP, 'se apunta con el resultado del registro y no el dicho', '          const r = await datos.apuntarPartida(partidaParaApuntar(elegido, R.origen.id, resultado))', '          const r = await datos.apuntarPartida(partidaParaApuntar(elegido, R.origen.id))'),
    (REP, 'al poderse no se marca', '    if (puede && caja.disabled) caja.checked = true\n', ''),
    (REP, 'sin poderse sigue marcada', '    if (!puede) caja.checked = false\n', ''),
    (REP, 'no dice el mazo de cada uno', "<span class=\"rep-quien-mazo\">${escapeHtml(arq?.nombre || 'Mazo sin identificar')}</span>", ''),
    (REP, 'no dice quién ganó', "${j === ganador ? ` <span class=\"rep-quien-gana\">${icons.trophy(14)} ganó</span>` : ''}", ''),
    (REP, 'se apunta desde el otro', '  const rival = elOtro(yo)\n  const arqYo = R.mazos?.[yo]?.arq || null', '  const rival = yo\n  const arqYo = R.mazos?.[elOtro(yo)]?.arq || null'),
    (REP, 'no recuerda quién eres', '      if (elegido) recordarYo(elegido)\n', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-553.mjs')
