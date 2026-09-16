"""Rigor de la tanda 315 — el resto de la escala de color.

Lo que la tanda pone por escrito no es «usa tokens»: es que hay colores
FIJOS que no pueden seguir al tema porque llevan texto blanco encima.
Cada mutación deshace una de esas decisiones de la forma en que la
desharía un refactor bienintencionado — y ninguna da error en ninguna
parte, que es justo el problema.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── El blanco que va sobre un color ──
    # LA DECISIÓN: --blanco-fijo es blanco en los DOS temas. Quien lo
    # «ordene» con la superficie deja letra oscura sobre azul.
    ('css/style.css', 'el blanco fijo se apaga en el tema oscuro',
     '  --navy: #6fb0dc;', '  --navy: #6fb0dc;\n  --blanco-fijo: #e8eef2;'),
    ('css/style.css', 'el rojo sólido se aclara en oscuro y se lleva por delante el blanco de encima',
     '  --navy-dark: #3a76a3;', '  --navy-dark: #3a76a3;\n  --danger-solid: #f87171;'),
    ('css/style.css', 'el azul sólido se aclara en oscuro',
     '  --ice: #1c2b38;', '  --ice: #1c2b38;\n  --navy-solid: #6fb0dc;'),
    ('css/style.css', 'el token del blanco fijo desaparece',
     '  --blanco-fijo: #fff;', '  /* se fue */'),
    # Y el camino de vuelta: un #fff a mano en una hoja.
    ('css/components.css', 'una regla vuelve a escribir el blanco a mano',
     'yt-video .yt-enlace:hover { color: var(--blanco-fijo); }',
     'yt-video .yt-enlace:hover { color: #fff; }'),

    # ── La paleta de arte ──
    # LA DECISIÓN: los seis degradados viven en style.css y nadie más los
    # escribe. Estaban dos veces —components.css y torneos.css— y
    # cambiar la paleta era acordarse de los dos sitios.
    ('css/torneos.css', 'una tarjeta de torneo vuelve a escribir su degradado a mano',
     '.torneo-arte-2 { background: var(--arte-rosa); }',
     '.torneo-arte-2 { background: linear-gradient(135deg, #be185d, #7c3aed 130%); }'),
    ('css/style.css', 'un degradado de la paleta se queda en color plano',
     '  --arte-cian: linear-gradient(135deg, #0891b2, #2a6b96 130%);',
     '  --arte-cian: #0891b2;'),
    ('css/components.css', 'unificar deja a media rejilla sin arte',
     '.arte-6 { background: var(--arte-rosa); }', ''),
    # La forma del fallo que más miedo da al unificar: que las seis
    # tarjetas acaben apuntando al mismo token y la rejilla sea una pared
    # de un color. No lo caza ninguna lectura de fichero: hay que pintar.
    ('css/components.css', 'las seis tarjetas acaban del mismo color',
     '.arte-2 { background: var(--arte-azul); }\n'
     '.arte-3 { background: var(--arte-ambar); }\n'
     '.arte-4 { background: var(--arte-cian); }\n'
     '.arte-5 { background: var(--arte-morado); }\n'
     '.arte-6 { background: var(--arte-rosa); }',
     '.arte-2 { background: var(--arte-verde); }\n'
     '.arte-3 { background: var(--arte-verde); }\n'
     '.arte-4 { background: var(--arte-verde); }\n'
     '.arte-5 { background: var(--arte-verde); }\n'
     '.arte-6 { background: var(--arte-verde); }'),

    # ── Los respaldos que ya no hacen falta ──
    # LA DECISIÓN viene de la tanda 310 con --shadow-lg: mientras el
    # respaldo y el token conviven, dicen cosas distintas y gana el que
    # no se ha tocado.
    ('css/style.css', 'un token existente se vuelve a pedir con respaldo',
     '  background: var(--navy-solid);', '  background: var(--navy-solid, #1e5175);'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-315.mjs')
