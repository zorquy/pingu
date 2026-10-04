"""Rigor de la tanda 519 — asociar tu lista entera a una repetición.

Lo que se rompe aquí no da error: una probabilidad mal contada, lo que no
salió que se cuenta como visto, un premio que no es el tuyo, o «Jugar desde
aquí» que vuelve a la «Carta sin ver».
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

LIS = 'js/repeticiones/lista.js'
REP = 'js/repeticiones.js'

MUTACIONES = [
    (LIS, 'lo que la partida enseña de más no se dice', '    fuera.push({ nombre: v.nombre, copias: faltan })\n', ''),
    (LIS, 'una lista a medias no se completa', '  if (total < 60) entradas.push({ carta: SIN_VER, n: 60 - total })\n', ''),
    (LIS, 'la mano conocida no cuenta como vista', '    ...p.manoConocida.slice(0, p.mano),\n', ''),
    (LIS, 'el descarte no cuenta como visto', '    ...p.descarte,\n', ''),
    (LIS, 'las energías unidas no cuentan como vistas', '...x.cartas, ...x.energias, ...(x.herramienta', '...x.cartas, ...(x.herramienta'),
    (LIS, 'los premios cogidos se cuentan de los dos', "    if (e.tipo !== 'premio' || e.jugador !== jugador) continue", "    if (e.tipo !== 'premio') continue"),
    (LIS, 'un premio sin nombre se pierde', '      else ocultas++\n', '\n'),
    (LIS, 'la probabilidad sale al revés', 'export const probabilidadDeRobar = (n, total) => (total > 0 ? n / total : 0)', 'export const probabilidadDeRobar = (n, total) => (total > 0 ? (total - n) / total : 0)'),
    (REP, '«Jugar desde aquí» no usa la lista', 'const mazosParaLaMesa = (orden, vistas) => orden.map((n) => (R.lista?.jugador === n ? mazoConLista(R.lista.entradas, vistas[n], cartaDe) : mazosDeLaPosicion(vistas[n], cartaDe)))',
     'const mazosParaLaMesa = (orden, vistas) => orden.map((n) => mazosDeLaPosicion(vistas[n], cartaDe))'),
    (REP, 'el panel no cambia con la jugada', "  const { cartas, total } = sinVerEnLaFoto(L.entradas, foto(), L.jugador)", "  const { cartas, total } = sinVerEnLaFoto(L.entradas, R.fotos.at(-1), L.jugador)"),
    (REP, 'la lista no se recuerda', "    todas[claveDeLaPartida()] = { jugador, nombre, cartas: entradas.map((e) => [e.carta.id, e.n]), cuando: Date.now() }\n", ''),
    (REP, '«Quitar» no la borra de la memoria', '  delete todas[claveDeLaPartida()]\n  escribirListas(todas)\n  R.lista = null', '  R.lista = null'),
    (REP, 'el resumen enseña los premios del otro', '  const premios = premiosCogidos(R.lectura.eventos, n)', '  const premios = premiosCogidos(R.lectura.eventos, elOtro(n))'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-519.mjs')
