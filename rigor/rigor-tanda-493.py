"""Rigor de la tanda 493 — el vídeo vertical y el recorte por turnos.

Un vídeo con el trozo mal cortado o del tamaño equivocado se descarga igual
y se ve igual de bien: lo que falla es que no es lo que se pidió. Cada
mutación rompe el ORIGEN de una de esas cosas (tanda 314).
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

VID = 'js/repeticiones/video.js'
REP = 'js/repeticiones.js'

MUTACIONES = [
    (VID, 'el trozo elegido no se usa: sale la partida entera',
     '  const { fotos, cierre } = tramoDe(todas, desde, hasta)\n', '  const { fotos, cierre } = tramoDe(todas)\n'),
    (VID, 'un trozo recortado se corta en seco',
     "(s.foco?.tipo === 'fin' ? 2.5 : i === fotos.length - 1 ? cierre : 0)", "(s.foco?.tipo === 'fin' ? 2.5 : 0)"),
    (VID, 'el vertical sale del tamaño del horizontal',
     "  const { fotos, cierre } = tramoDe(todas, desde, hasta)\n  const { ancho, alto } = medidasDe(formato)\n",
     "  const { fotos, cierre } = tramoDe(todas, desde, hasta)\n  const { ancho, alto } = medidasDe('horizontal')\n"),
    (VID, 'el vertical se dibuja con la composición horizontal',
     "  if (M.formato === 'vertical') dibujarVertical(K)", "  if (false) dibujarVertical(K)"),
    (VID, 'en el vertical el que mira va arriba',
     '  pintarNombre(K, arribaJ, 24, 112)\n', '  pintarNombre(K, abajo, 24, 112)\n'),
    (VID, 'el cartel del final no sale en el vertical',
     '  pintarCartel(K, cx, yC + 84)\n', ''),
    (VID, 'un «hasta» antes del «desde» da un trozo vacío',
     '  const b = Math.max(a, Math.min(hasta, fotos.length - 1))', '  const b = Math.min(hasta, fotos.length - 1)'),
    (REP, 'un «hasta» antes del «desde» se queda así',
     '    if (Number(hasta.value) < Number(desde.value)) {', '    if (false) {'),
    (REP, 'las duraciones no cambian con el trozo',
     "    cuerpo.querySelectorAll('[data-dura]').forEach((x) => (x.textContent = formatoTiempo(duracion(Number(x.dataset.dura)))))\n", ''),
    (REP, 'el fichero no dice que es vertical',
     "${formato === 'vertical' ? '-vertical' : ''}", ''),
    (REP, 'el vídeo no sabe el formato elegido',
     "  const formato = cuerpo.querySelector('input[name=\"repFormato\"]:checked')?.value === 'vertical' ? 'vertical' : 'horizontal'",
     "  const formato = 'horizontal'"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-493.mjs')
