"""Rigor de la tanda 512 — reportar con el registro de TCG Live.

Lo que se rompe aquí no da error: un resultado propuesto al revés, un
reporte que sale sin que nadie lo confirme, una repetición adjunta a otra
mesa, o lo pegado que se pierde al repintar. Cada mutación rompe el ORIGEN.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

RON = 'js/torneos/ronda.js'

MUTACIONES = [
    (RON, 'el resultado se propone al revés',
     "    ? `Reportar ${gane ? 'Victoria' : 'Derrota'}", "    ? `Reportar ${gane ? 'Derrota' : 'Victoria'}"),
    (RON, 'se reporta lo contrario de lo que dice el botón',
     "if (!(await reportar(mia, fin.ganador === yo ? 'win' : 'loss', juego)))", "if (!(await reportar(mia, fin.ganador === yo ? 'loss' : 'win', juego)))"),
    (RON, 'tu nombre de TCG Live no se mira',
     '  const yo = mio && lectura.jugadores.find((j) => sinMayusculas(j) === mio)\n', '  const yo = null\n'),
    (RON, 'sin tu nombre no se deduce por el del rival',
     '  return el ? lectura.jugadores.find((j) => j !== el) : null', '  return null'),
    (RON, 'los nombres se comparan distinguiendo mayúsculas',
     '  const tcgDe = (id) => sinMayusculas(ctx.inscripciones', '  const tcgDe = (id) => String(ctx.inscripciones'),
    (RON, 'lo que eliges a mano no cuenta',
     '  if (registroMesa?.yo && lectura.jugadores.includes(registroMesa.yo)) return registroMesa.yo\n', ''),
    (RON, 'un registro sin final propone resultado',
     "const finDelRegistro = (lectura) => lectura?.eventos?.findLast((e) => e.tipo === 'fin') || null",
     "const finDelRegistro = (lectura) => lectura?.eventos?.findLast((e) => e.tipo === 'fin') || { ganador: lectura.jugadores[0] }"),
    (RON, 'en un BO3 se reporta la partida que no toca',
     '  return n && juegoAbierto(confirmados, n) && !mios[n] ? n : null', '  return 1'),
    (RON, 'ya reportado, se vuelve a ofrecer reportar',
     '    return ya ? null : 0\n', '    return 0\n'),
    (RON, 'se adjunta aunque desmarques la casilla',
     '  const adjuntar = adjuntable && (!reporta || registroMesa.adjuntar)', '  const adjuntar = adjuntable'),
    (RON, 'la repetición se adjunta a otra mesa',
     '      await adjuntarATorneo(mia.id, fila.id)\n    } catch (err) {\n      fallo', "      await adjuntarATorneo('mesa-x', fila.id)\n    } catch (err) {\n      fallo"),
    (RON, 'se reporta antes de adjuntar',
     '  let fallo = null\n  if (adjuntar) {', '  let fallo = null\n  if (reporta) await reportar(mia, fin.ganador === yo ? \'win\' : \'loss\', juego)\n  if (adjuntar) {'),
    (RON, 'repintar se lleva lo pegado',
     '  area.value = registroMesa.texto\n', ''),
    (RON, 'cambiar el texto deja el veredicto viejo',
     '    if (registroMesa.lectura) {\n      registroMesa.lectura = null', '    if (false) {\n      registroMesa.lectura = null'),
    (RON, 'un reporte rechazado tira lo pegado',
     '      registroMesa = pegado\n', ''),
    (RON, 'el título no dice la partida de un BO3',
     " `Mesa ${mia.table_number}`, juego ? `${juego}.ª partida` : '']", " `Mesa ${mia.table_number}`]"),
    (RON, 'el bloque sale aunque no quede nada que hacer',
     "  if (juego === null && !adjuntable) return ''\n  const titulo", '  const titulo'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-512.mjs')
