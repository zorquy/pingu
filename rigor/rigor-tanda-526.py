"""Rigor de la tanda 526 — el upsert que no podía formar su fila.

Todas estas mutaciones salen VERDES en el ayudante puro y rojas en
producción, que es justo lo que pasó: el fallo vivía en la sentencia que se
arma a mano dentro de la función.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

LIB = 'netlify/lib/scrydex.mjs'
FUN = 'netlify/functions/scrydex-relleno.mjs'

MUTACIONES = [
    # El fallo original, en sus dos sitios.
    (LIB, 'la fila se queda sin `local_id`', '    local_id: nuestra.local_id,\n', ''),
    (LIB, 'la fila se queda sin `name`', '    name: nuestra.name,\n', ''),
    (FUN, 'la sentencia de los nombres se queda sin `local_id`',
     'set_id: nuestra.set_id, local_id: nuestra.local_id, name: bueno',
     'set_id: nuestra.set_id, name: bueno'),
    # Y que no se cuele un valor de ELLOS donde va el nuestro: el id de la
    # carta es el de TCGdex y el suyo es otro (la lección de la 505).
    (LIB, 'el `local_id` que se manda es el SUYO', '    local_id: nuestra.local_id,', '    local_id: suya?.number,'),
    (LIB, 'el `name` que se manda es el SUYO', '    name: nuestra.name,', '    name: suya?.name,'),
    # El freno de los dos lados.
    (FUN, 'un fallo nuestro vuelve a saltarse la página',
     '    const seSalta = seRinde && !nuestro\n    const separa = seRinde && nuestro',
     '    const seSalta = seRinde\n    const separa = false'),
    (FUN, 'parado no se guarda', "      ...(separa ? { parado: porque } : {}),\n", ''),
    (FUN, 'parado no para: sigue gastando', '  if (estado?.parado) {', '  if (false) {'),
    (FUN, 'y un fallo SUYO deja de saltarse la página',
     '    const seSalta = seRinde && !nuestro',
     '    const seSalta = false'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-526.mjs')
