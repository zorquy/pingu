"""Rigor de la tanda 513 — la imagen resumen de una partida.

Lo que se rompe aquí no da error: un ganador con el color del otro, un
nombre escondido que asoma en otro sitio, un mazo que se pierde o una
vista previa deformada. Cada mutación rompe el ORIGEN.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

IMG = 'js/repeticiones/resumen-imagen.js'
REP = 'js/repeticiones.js'
CSS = 'css/repeticiones.css'

MUTACIONES = [
    (IMG, 'el color va con el lado y no con el jugador',
     "  const color = (n) => COLOR_J[n === (orden.includes(protagonista) ? protagonista : orden[0]) ? 0 : 1]",
     "  const color = (n) => COLOR_J[lados.indexOf(n)]"),
    (IMG, 'la izquierda no es la de la mesa',
     '  const yo = orden.includes(izquierda) ? izquierda : orden[0]', '  const yo = orden[0]'),
    (IMG, 'esconder no toca al ganador',
     '    ganador: fin ? { nombre: nombre(fin.jugador),', '    ganador: fin ? { nombre: fin.jugador,'),
    (IMG, 'esconder deja el nombre en el título',
     "    titulo: titulo && !(esconder && titulo.includes(esconder)) ? titulo :", '    titulo: titulo ? titulo :'),
    (IMG, 'el mazo no sale',
     '    jugadores: lados.map((n) => ({ nombre: nombre(n), color: color(n), mazo: mazos?.[n]?.arq?.nombre || null })),',
     '    jugadores: lados.map((n) => ({ nombre: nombre(n), color: color(n), mazo: null })),'),
    (IMG, 'las cifras se cruzan de jugador',
     "      { etiqueta: 'Daño hecho', valores: lados.map((n) => String(por[n]?.danio ?? 0)) },",
     "      { etiqueta: 'Daño hecho', valores: [...lados].reverse().map((n) => String(por[n]?.danio ?? 0)) },"),
    (IMG, 'el ganador sale aunque el registro no lo diga',
     "  const fin = [...momentos].reverse().find((m) => m.tipo === 'fin') || null",
     "  const fin = [...momentos].reverse().find((m) => m.tipo === 'fin') || { jugador: orden[0] }"),
    (IMG, 'la imagen sale al doble de lo que dice la ventana',
     'const ESCALA = 1\n', 'const ESCALA = 2\n'),
    (IMG, 'el nombre del ganador va en blanco',
     '  ctx.fillStyle = d.ganador.color\n', "  ctx.fillStyle = '#ffffff'\n"),
    (REP, 'la casilla de esconder no hace nada',
     "        esconder: cuerpo.querySelector('#repResumenEsconder').checked ? rival : null,", '        esconder: null,'),
    (REP, 'girar la mesa no cambia la izquierda',
     '        izquierda: R.abajo,\n', '        izquierda: R.fotos[0].protagonista,\n'),
    (REP, 'el fichero se descarga con otro nombre',
     '  a.download = imagenResumen.fichero\n', "  a.download = 'imagen.png'\n"),
    (CSS, 'la vista previa se deforma en el móvil',
     '  width: min(100%, 352px, 41.6vh);\n  height: auto;', '  width: 100%;\n  height: min(52vh, 440px);'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-513.mjs')
