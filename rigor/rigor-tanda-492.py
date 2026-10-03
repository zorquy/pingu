"""Rigor de la tanda 492 — los momentos clave y la partida en números.

Un número mal contado no da error: sale en la tabla con cara de verdad. Una
marca mal puesta cae a unos píxeles del pulgar. Cada mutación rompe el
ORIGEN de uno (tanda 314).
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

NUM = 'js/repeticiones/numeros.js'
CAR = 'js/repeticiones/carrera.js'
REP = 'js/repeticiones.js'
CSS = 'css/repeticiones.css'

MUTACIONES = [
    # ── 1. Los momentos ──
    (NUM, 'cada KO de un doble KO es un momento aparte',
     "while (j < ev.length && ['ko', 'descartarTodoDe', 'descartarDe'].includes(ev[j].tipo)) {", "while (j < ev.length && j === i) {"),
    (NUM, 'el golpe que tumba sale también como golpe gordo',
     '      if (golpe != null) causantes.add(golpe)\n', ''),
    (NUM, 'un golpe de 200 justos no es gordo',
     "e.danio >= GOLPE_GORDO && !causantes.has(i)", "e.danio > GOLPE_GORDO && !causantes.has(i)"),
    (NUM, 'un KO no sabe quién coge los premios',
     "        if (ev[k].tipo === 'premio') {\n          premios =", "        if (ev[k].tipo === 'premioNunca') {\n          premios ="),
    (NUM, '«siguiente KO» se queda en el que estás',
     "m.tipo === 'ko' && m.foto > i", "m.tipo === 'ko' && m.foto >= i"),

    # ── 2. Los números ──
    (NUM, 'los contadores no cuentan como daño',
     '        sumaDanio(e.jugador, e.n * 10)\n', ''),
    (NUM, 'el segundo golpe se le apunta al que lo recibe',
     '        sumaDanio(otro(orden, e.jugador), e.danio)\n', '        sumaDanio(e.jugador, e.danio)\n'),
    (NUM, 'el KO se le apunta al que pierde el Pokémon',
     "      case 'ko': {\n        const quien = otro(orden, e.jugador)", "      case 'ko': {\n        const quien = e.jugador"),
    (NUM, 'el KO que se deduce de la vida no cuenta',
     "        if (viejo && queda && ![queda.activo, ...queda.banca].some((x) => x?.id === viejo.id)) {", "        if (false) {"),
    (NUM, 'usar el estadio cuenta como jugarlo',
     "if (despues?.foco?.tipo === 'jugar' && !despues.foco.estadio) jugada(e.jugador, e.carta)", "if (despues?.foco?.tipo === 'jugar') jugada(e.jugador, e.carta)"),
    (NUM, 'la carrera mira el principio del turno, no el final',
     '    const s = fotos?.[fin]\n', '    const s = fotos?.[ini]\n'),

    # ── 3. La página ──
    (REP, 'las marcas no caen en su sitio',
     'style="--p: ${(m.foto / ultimo).toFixed(4)}"', 'style="--p: ${(m.foto / (ultimo + 1)).toFixed(4)}"'),
    (CSS, 'las marcas no cuentan el medio pulgar',
     '  left: calc(8px + (100% - 16px) * var(--p));', '  left: calc(100% * var(--p));'),
    (REP, 'el momento en el que estás no se marca',
     "  lista.querySelector(`[data-foto=\"${R.i}\"]`)?.setAttribute('aria-current', 'step')\n", ''),
    (REP, '«Siguiente KO» no se apaga después del último',
     '  if (ko) ko.disabled = !siguienteKo(R.momentos, R.i)\n', ''),
    (CAR, 'la nota del gráfico no sale nunca',
     '    nota.hidden = false\n', ''),
    (CAR, 'un clic en el gráfico no lleva a ningún sitio',
     "  if (alIr) tapa.addEventListener('click', (ev) => alIr(turnoEn(ev)))\n", ''),
    (CAR, 'los nombres del registro entran por innerHTML',
     '    quien.textContent = n\n', '    quien.innerHTML = n\n'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-492.mjs')
