"""Rigor de la tanda 481 — el registro que acaba por premios y el Greninja
ex que no era.

Ninguno de estos fallos da error: la mesa se descuadra una carta, un daño
cae en el gemelo equivocado, se pinta otra impresión con otros PS. Cada
mutación rompe el ORIGEN de uno (tanda 314), no una de sus guardas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

REG = 'js/repeticiones/registro.js'
EST = 'js/repeticiones/estado.js'
IMP = 'js/repeticiones/impresion.js'
REP = 'js/repeticiones.js'

MUTACIONES = [
    # ── 1. Lo que se lee ──
    (REG, 'la carta de más por el mulligan se cuenta dos veces',
     "if (sub && ev.tipo === 'robar' && ultimo?.seNombraDespues", "if (false && sub && ev.tipo === 'robar' && ultimo?.seNombraDespues"),
    (REG, 'el desglose del daño se lee como cartas',
     "      if (ultimo?.tipo === 'resumen') {", '      if (false) {'),
    (REG, 'la mano enseñada del mulligan no es de nadie',
     "    if (ev.tipo === 'mostrar' && padre?.tipo === 'mulligan') ev.jugador = padre.jugador\n", ''),
    (REG, 'el final por premios no se entiende',
     '^Todas las cartas de Premio (?:cogidas|tomadas)', '^Todas las cartas de Premio NUNCA'),
    (REG, 'el nombre de un premio («Se ha añadido X a la mano») no se entiende',
     "[new RegExp(`^Se ha añadido (.+) a la mano de ${P}$`)", "[new RegExp(`^Se ha añadido (.+) a la manita de ${P}$`)"),
    (REG, '«un contador» (en singular) no se entiende',
     "ha recibido (\\\\d+|un|una) contador(?:es)? de daño de", "ha recibido (\\\\d+|un|una) contadores? de daño de"),

    # ── 2. La mesa ──
    (EST, 'el que hace mulligan se queda sin mano',
     '      p.mano = 7\n      p.manoConocida = []\n      p.mazo = 53\n', '      p.mano = 0\n      p.manoConocida = []\n      p.mazo = 60\n'),
    (EST, 'los contadores van a quien dice el registro (el que ataca)',
     "dueno = todosLosQueSeLlaman(s.jugadores[rival], e.pokemon).length ? rival : e.dice", 'dueno = e.dice'),
    (EST, 'los contadores de un mismo ataque caen dos veces en el mismo gemelo',
     '  const libres = todos.filter((x) => !golpeados.includes(x.id))\n', '  const libres = todos\n'),
    (EST, 'de dos gemelos cae el primero, no el tocado',
     '  if (pool.includes(p.activo)) return p.activo\n  return [...pool].sort((a, b) => b.danio - a.danio)[0]',
     '  if (pool.includes(p.activo)) return p.activo\n  return pool[0]'),
    (EST, 'el estadio que se va se descarta dos veces (y sale de la mano)',
     "if (e.sub && q && q.dueno === e.jugador && e.cartas?.length === 1", "if (false && e.sub && q && q.dueno === e.jugador && e.cartas?.length === 1"),
    (EST, 'usar el estadio en juego descarta una carta de la mano',
     '      if (s.estadio && igual(s.estadio.carta, e.carta)) {', '      if (false) {'),
    (EST, 'lo que une un Entrenador propio se quita de otro Pokémon',
     "const deEfecto = e.sub && e.padre && e.padre.tipo !== 'ataque' && e.padre.jugador === e.jugador", 'const deEfecto = false'),
    (EST, 'lo que une el rival bajo su habilidad sale del descarte',
     "const deEfecto = e.sub && e.padre && e.padre.tipo !== 'ataque' && e.padre.jugador === e.jugador", "const deEfecto = e.sub && e.padre && e.padre.tipo !== 'ataque'"),
    (EST, 'descartar dos energías se lleva al Pokémon entero',
     '      if (e.cartas?.length && e.cartas.length < cartasDe(slot).length) {', '      if (false) {'),
    (EST, 'Ciclón Levante no se lleva al Pokémon',
     '      const slot = slotQueSonEstas(p, cartas)\n', '      const slot = null\n'),
    (EST, 'el segundo golpe de Ráfaga Espejismo no cae en nadie',
     '      const obj = aQuienLeCae(p, e.pokemon, golpeados)\n', '      const obj = null\n'),

    # ── 3. La impresión ──
    (IMP, 'cualquier impresión «casa»',
     '  return [...usos].every((u) => hace.has(u))', '  return true'),
    (IMP, 'los ataques se miran en inglés',
     "const API = 'https://api.tcgdex.net/v2/es'", "const API = 'https://api.tcgdex.net/v2/en'"),
    (IMP, '«Mega-Greninja ex» cuenta como un «Greninja ex»',
     'plano(c.name) === objetivo', 'plano(c.name).includes(objetivo)'),
    (REP, 'la página no afina la impresión',
     '        if (usosDe(R.usos, r.linea.nombre).size) porAfinar.push([r.linea.nombre, r.carta])\n', ''),
    (REP, 'lo resuelto en una partida se arrastra a la siguiente',
     '  R.cartas = new Map()\n  R.pedidas = new Set()\n  R.usos = usosPorCarta(lectura)\n', '  R.usos = usosPorCarta(lectura)\n'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-481.mjs')
