"""Rigor de la tanda 307 — la pestaña «Foro» de los perfiles, sin CSS.

El fallo: `.foro-act-*` se mudó a foro.css en la tanda 299 y lo pinta
js/foro-actividad.js, que solo usan /perfil y /usuario — que NO cargan
foro.css. Llevaba roto en producción desde entonces, y lo vio PINGU en
una captura.

Por qué no lo vio el barrido: foro-actividad.js entra por un `import()`
DINÁMICO y el barrido seguía solo `from '…'`.

Las mutaciones van contra las tres mitades del arreglo: que una página
se quede sin su hoja, que el barrido vuelva a quedarse corto, y que
vuelva un `var()` de una variable que no existe.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

MUTACIONES = [
    # ── LA mutación de la tanda ──
    # Con el regex viejo el barrido no llega a foro-actividad.js, y una
    # pantalla puede quedarse sin CSS sin que nada avise. Se muta la
    # PRUEBA, que es lo que aquí está bajo examen.
    (f'{SC}/test-tanda-299.mjs', 'el barrido vuelve a seguir solo los import estáticos',
     "for (const imp of txt.matchAll(/(?:from|import)\\s*\\(?\\s*'([^']+\\.js)'/g)) {",
     "for (const imp of txt.matchAll(/from\\s+'([^']+\\.js)'/g)) {"),

    # ── Una página se queda sin su hoja ──
    ('perfil.html', 'el perfil propio deja de cargar perfil.css',
     '  <link rel="stylesheet" href="css/perfil.css" />', '  <!-- sin hoja -->'),
    ('usuario.html', 'la ficha de otra persona deja de cargar perfil.css',
     '  <link rel="stylesheet" href="/css/perfil.css" />', '  <!-- sin hoja -->'),

    # ── Vuelve el color que no existe ──
    ('css/perfil.css', 'vuelve una variable que no se define en ninguna parte',
     '.foro-act-numeros span {\n  font-size: var(--t-2xs);',
     '.foro-act-numeros span {\n  color: var(--slate);\n  font-size: var(--t-2xs);'),
    # (Que un `var(--x, respaldo)` NO cante no cabe aquí: un rigor
    #  comprueba que la prueba FALLA con el código roto, y ese patrón no
    #  es un fallo. Lo cubre el propio repo: components.css usa
    #  `var(--shadow-lg, 0 12px 32px …)` en tres sitios y la prueba está
    #  en verde — si el check no distinguiera el respaldo, cantaría.)
]

rigor_comun.correr(MUTACIONES, 'test-tanda-299.mjs')
