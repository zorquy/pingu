"""Rigor de la tanda 462 — los efectos solos, el activo en el centro y
/repeticiones.

Casi nada de esto da error al romperse: un veto que caduca un turno antes
deja jugar el objeto y ya está; un Casco Suerte que no roba es una mano con
dos cartas menos; una repetición que confunde dos Pokémon gemelos pinta
una mesa perfectamente válida… y falsa. Cada mutación rompe el ORIGEN de
una de esas cosas, no una de sus guardas (tanda 314).
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

P = 'js/constructor/partida.js'
T = 'js/constructor/textos.js'
RG = 'js/repeticiones/registro.js'
ES = 'js/repeticiones/estado.js'
RJ = 'js/repeticiones.js'
RC = 'css/repeticiones.css'
LC = 'css/laboratorio.css'

MUTACIONES = [
    # ── 1. Los efectos ──
    (P, 'el veto de Budew caduca antes de llegar al turno del rival',
     '[p.que]: { turno: op.s.turno + 1, por } }', '[p.que]: { turno: op.s.turno, por } }'),
    (P, 'el Casco Suerte no roba',
     "      this.robar(2, { motivo: 'Casco Suerte' })\n", ''),
    (P, 'el veto de objetos se lleva por delante las herramientas (y todo)',
     "if (esObjeto(c) && this.vetado('objetos'))", "if (this.vetado('objetos'))"),

    # ── 2. El lector: todo o nada ──
    (T, 'un ataque entendido a medias se da por leído',
     'return { pasos, completo: sinLeer.length === 0, sinLeer }', 'return { pasos, completo: pasos.length > 0, sinLeer }'),

    # ── 3. El registro ──
    (RG, '«ha robado 1 carta de Premio» se lee como robar una carta',
     "    [new RegExp(`^${P} ha (?:cogido|tomado|robado|obtenido) (una|\\\\d+) cartas? de Premio`, 'i'), (m) => ({ tipo: 'premio', jugador: m[1], n: num(m[2]) })],\n    [new RegExp(`^${P} took (a|\\\\d+) Prize cards?`), (m) => ({ tipo: 'premio', jugador: m[1], n: num(m[2]) })],\n    [new RegExp(`^${P} ha robado (una|",
     "    [new RegExp(`^${P} ha robado (una|"),
    (RG, 'el KO en español no se reconoce',
     '(m, l) => koEnEspanol(l, P)', '() => null'),
    (ES, 'tras un KO, «se han descartado N cartas del X» tira a su gemelo',
     'if (s.caido && s.caido.jugador === e.jugador && igual(s.caido.nombre, e.pokemon)) {', 'if (false) {'),
    (ES, 'el intercambio contado dos veces vuelve a cambiar',
     '      p.activo = sube\n      s.subio = sube.id\n', '      p.activo = sube\n'),
    (ES, 'una herramienta va al primer gemelo aunque ya lleve otra',
     'const slot = libre || buscar(p, e.a, e.donde)', 'const slot = buscar(p, e.a, e.donde)'),
    (ES, 'un KO sin su línea no se deduce de la vida',
     '        if (!viejo.ko && ps && viejo.danio >= ps) viejo.ko = true\n', ''),

    # ── 4. /repeticiones ──
    (RJ, 'no se reproduce sola',
     '  reproducir()\n  resolverCartas(nombresDe(lectura), R.vez)', '  resolverCartas(nombresDe(lectura), R.vez)'),
    (RJ, 'el deslizador vuelve a la jugada de antes',
     '    const destino = Number(e.target.value)\n    parar()\n    ir(destino)', '    parar()\n    ir(Number(e.target.value))'),
    (RJ, 'el cartel del turno sale también al saltar con el deslizador',
     "if (s.foco?.tipo === 'turno' && R.i === antes + 1 && s.linea", "if (s.foco?.tipo === 'turno' && s.linea"),
    (RJ, 'el cartel del turno no se va nunca (con «menos movimiento»)',
     '  setTimeout(() => el.remove(), Math.max(600, 1200 / R.velocidad))\n', ''),
    (RJ, 'la línea del registro no se marca',
     "  el.setAttribute('aria-current', 'step')\n", ''),
    (RC, 'la mesa empieza debajo de la barra de arriba',
     '  scroll-margin-top: 76px;\n', ''),
    (RC, 'en el móvil, los controles en tres filas',
     '  .rep-cuenta,\n  .rep-velocidad-texto {', '  .rep-velocidad-texto {'),
    (RC, 'en el móvil, la mesa con todo el margen de la página',
     '  .rep-juego {\n    margin-inline: calc(-1 * var(--e-lg));\n  }\n', ''),

    # ── 5. La mesa del laboratorio ──
    (LC, 'lo centrado vuelve a ser la pareja carta + vida',
     "  .lab-slot-activo::before {\n    content: '';", '  .lab-slot-activo::before {\n    content: none;'),
    (LC, 'la última del descarte, con el nombre encima del dibujo',
     '.lab-pila-cara img {\n  position: absolute;\n  inset: 0;\n', '.lab-pila-cara img {\n'),
    (LC, 'el pie del activo de arriba vuelve a 72 px (se mete bajo el mazo)',
     '    --lab-pie-activo: 64px;', '    --lab-pie-activo: 72px;'),

    # ── 6. El sitio ──
    ('foro.html', 'una página sin el enlace en «Jugar»',
     '            <a href="/repeticiones">Repeticiones</a>\n', ''),
    ('netlify/functions/sitemap.mjs', 'el sitemap sin la página',
     "  ['/repeticiones', '0.6'],\n", ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-462.mjs')
