"""Rigor de la tanda 517 — el modo stream de /repeticiones.

Lo que se rompe aquí no da error: una mesa cortada en la captura, los
controles que salen en el vídeo, una tecla que no hace nada o la dirección
de OBS que no entra en el modo.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

REP = 'js/repeticiones.js'
CSS = 'css/repeticiones.css'

MUTACIONES = [
    (REP, 'la mesa no se escala a la ventana', '  const k = Math.min((innerWidth - 32) / w, (innerHeight - 32) / h)', '  const k = 1'),
    (REP, 'la mesa no se centra', "  juego.style.setProperty('--x', `${Math.round((innerWidth - w * k) / 2)}px`)", "  juego.style.setProperty('--x', '0px')"),
    (REP, 'cambiar la ventana no la vuelve a encajar', "    S.observador.observe($('repEscena'))\n", ''),
    (REP, '«B» no cambia el fondo', "    if (S.activo && tecla === 'b') return cambiarFondoStream()", ''),
    (REP, '«N» no va al siguiente KO', "    if (tecla === 'n' && !e.shiftKey) return irAlSiguienteKo()", ''),
    (REP, '«G» no gira', "    if (tecla === 'g' && !e.shiftKey) return girarMesa()", ''),
    (REP, 'Esc no sale', "    if (S.activo && e.key === 'Escape') {", '    if (false) {'),
    (REP, 'la ayuda no se va sola', "  S.temporizador = setTimeout(() => document.documentElement.classList.remove('rep-stream-raton'), 3000)", '  S.temporizador = null'),
    (REP, 'el foco se queda en el botón de debajo', '  escena.focus({ preventScroll: true })', ''),
    (REP, '&stream no entra en el modo', '    await abrirGuardada(q.get(\'r\'))\n    if (stream) entrarStream(stream)', "    await abrirGuardada(q.get('r'))"),
    (REP, '&fondo=verde no se respeta', "  const stream = q.has('stream') ? { fondo: q.get('fondo') === 'verde' ? 'verde' : 'mesa' } : null", "  const stream = q.has('stream') ? { fondo: 'mesa' } : null"),
    (REP, 'la dirección de OBS no sale en la ayuda', "  const obs = R.origen?.id && R.origen.compartida ?", '  const obs = false ?'),
    (REP, 'al salir el foco no vuelve', "  document.querySelector('[data-accion=\"stream\"]')?.focus({ preventScroll: true })", ''),
    (CSS, 'los controles salen en la captura', '.rep-stream .rep-prob,\n.rep-stream .rep-controles > :not(.rep-nota) {', '.rep-stream .rep-prob {'),
    (CSS, 'la ayuda se va aunque tenga el foco', '.rep-stream-raton .rep-stream-ayuda,\n.rep-stream-ayuda:focus-within {', '.rep-stream-raton .rep-stream-ayuda {'),
    (CSS, 'la escena no tapa la página', '.rep-stream .rep-escena {\n  position: fixed;', '.rep-stream .rep-escena {\n  position: relative;'),
    (CSS, 'el verde no es el de croma', '  background: #00b140;', '  background: #22aa55;'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-517.mjs')
