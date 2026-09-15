"""Rigor de la tanda 305 — la escala tipográfica y los esqueletos.

Las mutaciones van contra la FORMA: no «este 13 px concreto», sino «hay
un tamaño fuera de la escala», que es lo que puede volver a pasar.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── La escala ──
    ('css/style.css', 'un paso de la escala desaparece',
     '  --t-lg: 16px;', '  /* --t-lg: 16px; */'),
    ('css/style.css', 'vuelven los saltos de medio píxel',
     '  --t-sm: 13px;', '  --t-sm: 13.5px;'),
    ('css/components.css', 'una hoja vuelve a un tamaño suelto',
     '.mini-avatar {\n  width: 26px;', '.mini-avatar {\n  font-size: 12.5px;\n  width: 26px;'),
    ('js/wall.js', 'un módulo vuelve a poner el tamaño a mano',
     'font-size: var(--t-sm);">${enlazarMenciones', 'font-size:13.5px;">${enlazarMenciones'),

    # ── Los esqueletos ──
    ('guia.html', 'la guía vuelve al rectángulo gris sin forma',
     '<div class="esq-titular"></div>', '<div></div>'),
    ('curso.html', 'el curso se queda sin renglones de párrafo',
     '            <div class="esq-linea"></div><div class="esq-linea"></div><div class="esq-linea"></div>\n          </div>\n          <div class="esq-bloque"></div>',
     '          </div>\n          <div class="esq-bloque"></div>'),
    ('guia.html', 'quien no ve la pantalla no se entera de que carga',
     '<p class="sr-only">Cargando la guía…</p>', '<p class="sr-only"></p>'),
    ('css/style.css', '.sr-only pasa a display:none y el lector deja de leerlo',
     '.sr-only {', '.sr-only {\n  display: none;'),
    ('guia.html', 'el esqueleto se sale de los marcadores de meta-social',
     '<!-- articulo:inicio --><div class="esq-articulo" aria-hidden="true">',
     '<div class="esq-articulo" aria-hidden="true">\n        <!-- articulo:inicio -->'),
    ('guia.html', 'el lector de pantalla se pone a leer el esqueleto',
     '<div class="esq-articulo" aria-hidden="true">', '<div class="esq-articulo">'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-305.mjs')
