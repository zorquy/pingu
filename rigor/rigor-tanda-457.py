"""Rigor de la tanda 457 — el pulido de estilos del laboratorio.

Nada de esto da error al romperse: una mesa que no cabe se desplaza, una
mano en dos filas se juega igual (tapando la banca), una barra de vida
siempre verde se lee por el número, un aviso que se queda con los clics
solo se nota al pulsar justo debajo, un nombre cortado solo se ve cuando
no carga la imagen. Cada mutación rompe el ORIGEN de una de esas cosas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

L = 'js/constructor/laboratorio.js'
CSS = 'css/laboratorio.css'

MUTACIONES = [
    # ── 1. Que quepa ──
    (CSS, 'las cartas, del tamaño de antes (no cabe a 1440×900)',
     '  --lab-c-activo: clamp(76px, min(10.5vh, 9vw), 128px);\n  --lab-c-banca: clamp(52px, min(7vh, 6vw), 88px);\n  --lab-c-mano: clamp(68px, 9vh, 120px);',
     '  --lab-c-activo: clamp(76px, min(11vh, 9vw), 128px);\n  --lab-c-banca: clamp(52px, min(7.5vh, 6vw), 88px);\n  --lab-c-mano: clamp(68px, 10vh, 120px);'),
    (CSS, 'sin el apretado de las pantallas bajas (1366×768)',
     '@media (max-height: 880px) and (min-width: 761px) {', '@media (max-height: 1px) and (min-width: 761px) {'),
    (CSS, 'sin los mínimos de las muy bajas (1280×720)',
     '@media (max-height: 740px) and (min-width: 761px) {', '@media (max-height: 1px) and (min-width: 761px) {'),

    # ── 2. La mano ──
    (CSS, 'la mano vuelve a partirse en filas',
     '  .lab-mano {\n    flex-wrap: nowrap;\n    gap: 0;\n  }', '  .lab-mano {\n    gap: 0;\n  }'),
    (CSS, 'la última carta de la mano se sale por la derecha',
     '  .lab-mano-carta:last-child {\n    flex-shrink: 0;\n    flex-basis: var(--lab-c-mano);\n  }\n', ''),
    (CSS, 'la carta señalada no sube por encima de la siguiente',
     '  .lab-mano-carta:hover,\n  .lab-mano-carta:focus-within {\n    z-index: 2;\n  }', ''),

    # ── 3. La banca en la tableta ──
    (CSS, 'la banca solo mira el alto (en la tableta se parte)',
     'clamp(52px, min(7vh, 6vw), 88px)', 'clamp(52px, 7vh, 88px)'),

    # ── 4. La vida ──
    (CSS, 'la barra no cambia de color por debajo de la mitad',
     ".lab-ps[data-vida='media'] span {\n  background: var(--warning);\n}", ''),
    (L, 'la barra no lleva su nivel',
     "data-vida=\"${pct <= 25 ? 'baja' : pct <= 50 ? 'media' : 'alta'}\"", 'data-vida="alta"'),

    # ── 5. El registro ──
    (L, 'el turno del registro sigue con sus rayas de texto',
     "x.texto.replace(/^──\\s*|\\s*──$/g, '')", 'x.texto'),
    (CSS, 'el separador del registro sin su línea',
     "  content: '';\n  flex: 1;\n  border-top: 1px solid var(--border);", "  content: '';\n  flex: 1;"),

    # ── 6. El cambio de turno ──
    (L, 'el cambio de turno no se anuncia',
     '      mostrarCambio(ahora, L.anuncio)\n', ''),
    (CSS, 'el aviso del turno se queda con los clics',
     '  pointer-events: none;\n  transform: translate(-50%, -50%);\n  white-space: nowrap;', '  transform: translate(-50%, -50%);\n  white-space: nowrap;'),
    (L, 'el aviso del turno no se va nunca',
     'temporizadorCambio = setTimeout(() => (el.hidden = true), 1300)', 'temporizadorCambio = null'),

    # ── 7. El menú del móvil ──
    (CSS, 'la hoja del móvil sin velo',
     '    box-shadow: 0 0 0 100vmax rgba(13, 27, 42, 0.36);\n', ''),
    (CSS, 'la hoja del móvil sin asa',
     "  .lab-menu::before {\n    content: '';", '  .lab-menu::before {\n    content: none;'),

    # ── 8 y 9. Los premios y el muñeco ──
    (L, 'antes de empezar, los premios son una frase y no seis huecos',
     "  if (!s.premios.length && (s.fase === 'preparacion' || s.fase === 'mulligan')) {", '  if (false) {'),
    (CSS, 'en el móvil vuelve la frase de los premios',
     '  .lab-cuenta-prep,\n  .lab-estadio .lab-vacio {', '  .lab-estadio .lab-vacio {'),
    (CSS, 'la ficha del muñeco, estrecha (el texto se parte)',
     '  flex: 0 0 156px;', '  flex: 0 0 96px;'),

    # ── 10. Los detalles ──
    (CSS, 'en el móvil, el rótulo de quién empieza parte el interruptor',
     '  /* El rótulo («Empieza», «Vas») se queda para el lector: a la vista,\n     las tres opciones caben en una fila. */\n  .lab-segmentos-rotulo {',
     '  .lab-segmentos-rotulo-fuera {'),
    (CSS, 'en el móvil, las pestañas de una ventana en dos líneas',
     '  .lab-dialogo .lab-pestania {\n    padding: var(--e-xs);\n    font-size: var(--t-xs);\n    white-space: nowrap;\n  }\n', ''),
    (CSS, 'en la tableta, el título a la vista (el turno en tres líneas)',
     '@media (min-width: 761px) and (max-width: 1023px) {\n  .lab-titulo {', '@media (max-width: 1px) {\n  .lab-titulo {'),
    (CSS, 'en una pantalla muy ancha el juego se desparrama',
     '    max-width: 1280px;\n    margin-inline: auto;', '    margin-inline: auto;'),
    (CSS, 'la chapa de «nueva», a la derecha (tapada en la mano solapada)',
     '.lab-carta .lab-chapa-nueva {\n  position: absolute;\n  left: var(--e-xs);', '.lab-carta .lab-chapa-nueva {\n  position: absolute;\n  right: var(--e-xs);'),
    (CSS, 'las ventanas, el menú y el aviso animan con «menos movimiento»',
     '  .lab-apuntable .lab-slot-carta,\n  .lab-dialogo,\n  .lab-menu,\n  .lab-cambio {\n    animation: none;', '  .lab-apuntable .lab-slot-carta {\n    animation: none;'),
    (L, 'al ganar, sin copa',
     '${gana ? `<span class="lab-fin-icono"', '${false ? `<span class="lab-fin-icono"'),

    # ── 11. Sin imágenes ──
    (CSS, 'sin imagen, una palabra larga sale cortada por los dos lados',
     '  overflow-wrap: anywhere;\n  color: var(--text-mid);', '  color: var(--text-mid);'),
    (CSS, 'sin imagen, el margen de 4 px (en el estadio se parte «Risky»)',
     '  padding: 2px;\n  text-align: center;\n  font-size: var(--t-2xs);', '  padding: var(--e-xs);\n  text-align: center;\n  font-size: var(--t-2xs);'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-457.mjs')
