"""Rigor de la tanda 311 — el contraste, el rojo con nombre y la retícula
del espaciado.

Cada mutación es UNA de las formas del fallo que la tanda arregla. Si
alguna sale «sin detectar», la prueba está mirando el caso y no la forma.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── 1. El contraste, medido ──
    ('css/style.css', 'el azul del tema oscuro vuelve a quedarse corto',
     '  --navy: #6fb0dc;', '  --navy: #4a90c2;'),
    ('css/style.css', 'el gris de los textos secundarios se apaga',
     '  --text-mid: #52717f;', '  --text-mid: #90a8b4;'),
    ('css/components.css', 'un control vuelve al gris de los apuntes',
     '  color: var(--text-mid);\n}\n\n.report-btn:hover {',
     '  color: var(--text-dim);\n}\n\n.report-btn:hover {'),

    # ── 2. El rojo con nombre ──
    # LA QUE DE VERDAD PASÓ: el barrido que sustituía rojos pasó también
    # por style.css y dejó el token pidiéndose a sí mismo. No da error:
    # queda sin definir y lo que lo usaba se pinta del color de al lado.
    ('css/style.css', 'el token de peligro se define en términos de sí mismo',
     '  --danger: #dc2626;', '  --danger: var(--danger);'),
    ('css/style.css', 'el token de peligro desaparece del tema oscuro',
     '  --danger: #f87171;', '  /* --danger: #f87171; */'),
    ('css/style.css', 'el fondo de peligro desaparece del tema claro',
     '  --danger-bg: #fee2e2;', '  /* --danger-bg: #fee2e2; */'),
    ('css/components.css', 'vuelve un rojo sólido escrito a mano en una hoja',
     '.falladas-critica { color: var(--danger); }', '.falladas-critica { color: #b3261e; }'),
    ('js/wall.js', 'vuelve un rojo escrito a mano en un estilo en línea',
     'color:var(--danger); font-weight:700;', 'color:#dc2626; font-weight:700;'),

    # ── 3. La retícula del espaciado ──
    ('css/portada.css', 'vuelve un espaciado que no es un paso de la escala',
     '.portada-torneo {\n  display: flex;', '.portada-torneo {\n  gap: 14px;\n  display: flex;'),
    ('css/style.css', 'un hueco grande se sale de la retícula de 4',
     '  padding-right: 36px;', '  padding-right: 34px;'),

    # ── 4. Y que nada se salga de la pantalla ──
    # El espaciado subió en 792 sitios: lo que eso rompe no es un color,
    # es una caja que ya iba justa y deja de caber.
    ('css/portada.css', 'la tarjeta del próximo torneo deja de caber en un móvil',
     '.portada-torneo {\n  display: flex;', '.portada-torneo {\n  min-width: 480px;\n  display: flex;'),

    # ── 5. La chapa de fondo sólido y su texto blanco ──
    # EL OTRO FALLO QUE DE VERDAD ESTABA AHÍ, desde antes de esta tanda:
    # un bloque de tema tiene TRES componentes de especificidad y le gana
    # a una regla base de dos, aunque la base parezca más específica.
    ('css/torneos.css', 'un bloque de tema le roba el color a la chapa de «en juego»',
     '.torneo-arte .torneo-estado-jugando {',
     ":root[data-theme='dark'] .torneo-estado-jugando { color: #7db6dd; }\n.torneo-arte .torneo-estado-jugando {"),
    # Y el token del rojo sólido, que NO se aclara en oscuro a propósito:
    # si se aclarase, el blanco de encima se quedaría en 2,4.
    ('css/style.css', 'el rojo de fondo se aclara en el tema oscuro',
     "  --danger: #f87171;", "  --danger: #f87171;\n  --danger-solid: #f87171;"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-311.mjs')
