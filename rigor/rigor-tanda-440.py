"""Rigor de la tanda 440 — el rediseño del panel.

Nada de esto da error al romperse: la cabecera vuelve a partirse en dos
filas, las listas de números salen abiertas encima de tus cartas, o la
fecha dice el mes equivocado. Todo se ve perfectamente bien.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

J = 'js/mi-coleccion.js'
C = 'css/mi-coleccion.css'
H = 'mi-coleccion.html'

MUTACIONES = [
    # ── La cabecera de perfil ──
    (J, 'la fecha sale de la carta mas NUEVA en vez de la mas vieja',
     "  const primera = lineas.reduce((a, b) => (String(a.created_at || '9') <= String(b.created_at || '9') ? a : b))",
     "  const primera = lineas.reduce((a, b) => (String(a.created_at || '') >= String(b.created_at || '') ? a : b))"),
    (J, 'la cabecera no se pinta cuando llegan las lineas',
     "  pintarHero()\n  $('mcResumenNota').textContent", "  $('mcResumenNota').textContent"),
    (J, 'el avatar se queda sin inicial',
     "    av.textContent = perfil.avatar_url ? '' : getInitial(dueno?.display_name || dueno?.username || 'P')",
     "    av.textContent = ''"),
    (H, 'el titulo se sale de la cabecera',
     '        <div class="mc-hero-nombre">\n          <h1 id="mcTitulo">Mi colección</h1>',
     '        <div class="mc-hero-nombre">\n          <h1 id="mcTitulo" hidden>Mi colección</h1>'),
    (H, 'la cabecera se queda sin la linea de desde cuando',
     '          <p class="mc-hero-desde" id="mcHeroDesde"></p>', '          '),

    # ── Las cuatro cifras, en UNA fila a 390 px ──
    #
    # Es lo que justifica la cabecera entera: con caja no cabían, y de ahí
    # salieron la tira de la 412 y el disimulo de la 439.
    (C, 'las cifras piden mas ancho del que hay en un movil',
     "  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));",
     "  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));"),
    (C, 'las cifras recuperan su caja',
     ".mc-cifra {\n  padding: 0 var(--e-md);\n  border-left: 1px solid var(--border);\n}",
     ".mc-cifra {\n  padding: var(--e-md) var(--e-lg);\n  border: 1px solid var(--border);\n}"),

    # ── Fuera el carrusel ──
    (C, 'la rejilla de tarjetas vuelve a pedir el ancho de un carrusel',
     "  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));\n  gap: var(--e-md);\n  margin-bottom: var(--e-lg);",
     "  grid-template-columns: 300px;\n  gap: var(--e-md);\n  margin-bottom: var(--e-lg);"),

    # ── Y lo plegado, plegado ──
    (J, 'las listas de numeros nacen abiertas',
     '    <div class="mc-estadisticas hidden" id="mcEstadisticas">', '    <div class="mc-estadisticas" id="mcEstadisticas">'),
    (J, 'el boton deja de abrirlas',
     "    const abierto = !$('mcEstadisticas').classList.toggle('hidden')", "    const abierto = $('mcEstadisticas').classList.contains('hidden')"),
    (H, 'el hueco de lo plegado desaparece del panel',
     '        <div id="mcMasEstadisticas"></div>', '        '),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-440.mjs')
