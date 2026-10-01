"""Rigor de la tanda 420 — «este mazo no es tuyo» al guardar un mazo tuyo.

El fallo no daba error de verdad: la base no tocaba nada y la pantalla lo
decía con un aviso que no dejaba hacer nada. Cada mutación quita una de las
dos piezas por su ORIGEN: el borrador que no mira de quién es su mazo, o el
guardado que no sabe guardar como nuevo.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

C = 'js/constructor.js'
D = 'js/constructor/datos.js'

MUTACIONES = [
    (C, 'el borrador se recupera con el id de un mazo que no es tuyo',
     '    if (!fila || fila.user_id !== estado.sesion.user.id) id = null\n', ''),
    (C, 'un mazo que ya no está en tu cuenta vuelve a dar error',
     '      if (!err.sinFila) throw err', '      throw err'),
    (C, 'el «como nuevo» vuelve a intentar pisar el mismo mazo',
     '      fila = await guardarMazo({ id: null, ...datos })', '      fila = await guardarMazo({ id: estado.id, ...datos })'),
    (D, 'el guardado no dice por qué no ha guardado',
     '    e.sinFila = Boolean(id)', '    e.sinFila = false'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-420.mjs')
