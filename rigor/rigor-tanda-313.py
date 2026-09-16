"""Rigor de la tanda 313 — lo que no se ve.

El salto al contenido, el <h1> que faltaba, «menos movimiento» y el
hueco de las imágenes.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── 1. El salto al contenido ──
    ('foro.html', 'una página se queda sin el enlace de salto',
     '  <a class="salta-al-contenido" href="#contenido">Saltar al contenido</a>\n', ''),
    ('guia.html', 'el salto apunta a un ancla que no existe',
     '<a class="salta-al-contenido" href="#contenido">', '<a class="salta-al-contenido" href="#no-existe">'),
    ('index.html', 'el ancla del contenido desaparece',
     '<main id="contenido" class="page-content', '<main class="page-content'),
    # Un `display: none` lo saca del recorrido del tabulador: se vería
    # igual de invisible, pero ya no se podría usar, que es el caso que
    # hay que cazar.
    ('css/style.css', 'el salto deja de poder enfocarse',
     '  display: inline-flex;\n  align-items: center;\n  /* 44 de alto',
     '  display: none;\n  align-items: center;\n  /* 44 de alto'),
    ('css/style.css', 'el salto se queda visible siempre',
     '.salta-al-contenido:focus {\n  top: 8px;\n}', '.salta-al-contenido {\n  top: 8px;\n}'),

    # ── 2. El <h1> ──
    ('js/perfil.js', 'la ficha de una persona se queda sin <h1>',
     '    <h1>${escapeHtml(name)}', '    <h2 data-h1>${escapeHtml(name)}'),

    # ── 3. Menos movimiento ──
    ('css/components.css', 'el esqueleto vuelve a parpadear sin parar',
     '  .esq-linea,\n  .esq-titular,', '  .esq-linea-no,\n  .esq-titular-no,'),
    ('css/curso.css', 'los deslizamientos del curso se quedan sin red',
     '  .slide-out-left,\n  .slide-in-right,', '  .slide-out-left-no,\n  .slide-in-right-no,'),
    ('css/torneos.css', 'la entrada del calendario se queda sin red',
     '  .torneo-cal-meses.cal-entra .torneo-cal-mes,', '  .torneo-cal-meses.cal-entra-no .torneo-cal-mes,'),
    # EL FALLO QUE HABÍA DEBAJO: sin el temporizador, el globo de puntos
    # no se borra NUNCA para quien tiene el movimiento apagado.
    ('js/curso.js', 'el globo de puntos vuelve a depender solo de la animación',
     '  setTimeout(() => globo.remove(), 1200)', '  void 0'),

    # ── 4. El hueco de las imágenes ──
    ('js/curso.js', 'la imagen de un bloque deja de reservar su hueco',
     'function huecoDeImagen(ratio) {\n  const r = Number(ratio)',
     "function huecoDeImagen(ratio) {\n  return ''\n  const r = Number(ratio)"),
    ('css/torneos.css', 'la miniatura del calendario se queda sin medidas',
     '.torneo-tarjeta-imagen {\n  width: 40px;\n  height: 40px;', '.torneo-tarjeta-imagen-no {\n  width: 40px;\n  height: 40px;'),
    ('css/lanzamientos.css', 'el logo grande vuelve al máximo en vez del alto fijo',
     '.lanzamiento-logo-grande { width: 130px; height: 90px; object-fit: contain; }',
     '.lanzamiento-logo-grande { width: 130px; max-height: 90px; object-fit: contain; }'),

    # ── 5. La descripción donde sirve ──
    ('aprender.html', 'una página indexable pierde su descripción',
     '<meta name="description"', '<meta name="descripcion-no"'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-313.mjs')
