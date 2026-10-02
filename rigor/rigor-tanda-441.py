"""Rigor de la tanda 441 — la pestaña Cartas.

Nada de esto da error al romperse. Una carta vuelve a ser un rectángulo
invisible, el orden se va otra vez detrás del modal, o la cuenta miente.
Todo se ve perfectamente bien.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

J = 'js/mi-coleccion.js'
C = 'css/mi-coleccion.css'
H = 'mi-coleccion.html'

MUTACIONES = [
    # ── La carta invisible: las dos mitades ──
    (J, 'el nombre vuelve a salir SOLO cuando no hay ruta de imagen',
     "          `<span class=\"mc-carta-sinfoto\">${escapeHtml(nombreDe(c))}${\n"
     "            c?.local_id ? `<small>${escapeHtml(c.local_id)}</small>` : ''\n"
     "          }</span>` +\n"
     "          (escaneo ? `<img ${escaneo} alt=\"\" width=\"245\" height=\"342\" loading=\"lazy\" />` : '')",
     "          escaneo\n"
     "            ? `<img ${escaneo} alt=\"\" width=\"245\" height=\"342\" loading=\"lazy\" />`\n"
     "            : `<span class=\"mc-carta-sinfoto\">${escapeHtml(nombreDe(c))}${\n"
     "                c?.local_id ? `<small>${escapeHtml(c.local_id)}</small>` : ''\n"
     "              }</span>`"),
    (C, 'el nombre deja de ocupar el hueco de la carta',
     "  display: flex;\n  position: absolute;\n  inset: 0;\n  flex-direction: column;\n  gap: var(--e-xs);\n  align-items: center;\n  justify-content: center;\n  padding: var(--e-sm);",
     "  display: flex;\n  flex-direction: column;\n  gap: var(--e-xs);\n  align-items: center;\n  justify-content: center;\n  padding: var(--e-sm);"),
    # Quitarle el `z-index` NO cambia nada y el rigor lo demostró: dos
    # elementos POSICIONADOS se pintan en orden de DOM, y la imagen va
    # detrás del nombre en el HTML. Lo que de verdad hace falta es el
    # `position`: sin él la imagen sería contenido en flujo, y el contenido
    # en flujo se pinta POR DEBAJO de un hermano posicionado. Así que el
    # `z-index` se fue del CSS por muerto y lo que se muta es lo que manda.
    (C, 'la imagen deja de tapar al nombre',
     ".mc-carta-foto img {\n  position: relative;\n}", ".mc-carta-foto img {\n}"),
    (J, 'la carta sin imagen pierde su numero',
     "            c?.local_id ? `<small>${escapeHtml(c.local_id)}</small>` : ''", "            ''"),

    # ── El orden, en la barra ──
    (H, 'el orden vuelve al modal de filtros',
     '          <select id="mcOrden" class="mc-chapa-select" aria-label="Ordenar">', '          <select id="mcOrden" class="mc-chapa-select" aria-label="Ordenar" hidden>'),
    (H, 'se queda sin el boton de dar la vuelta',
     '          <button type="button" class="mc-chip-filtro mc-chip-mando" id="mcOrdenAlReves" aria-pressed="false">Al revés</button>\n', '          '),

    # ── La cuenta ──
    (J, 'la cuenta no se pinta al repintar las cartas',
     "  pintarCuantas(lista.length)\n", "  \n"),
    (J, 'la cuenta dice el total en vez de lo que se ve',
     "      ? `${total.toLocaleString('es-ES')} ${total === 1 ? 'carta' : 'cartas'}`\n"
     "      : `${cuantas.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')}`",
     "      ? `${total.toLocaleString('es-ES')} ${total === 1 ? 'carta' : 'cartas'}`\n"
     "      : `${total.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')}`"),
    (H, 'la cuenta desaparece de la barra',
     '          <p class="mc-cuantas" id="mcCuantas" role="status" aria-live="polite"></p>', '          '),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-441.mjs')
