"""Rigor de la tanda 329 — lo que solo viene en el set completo.

Ninguna de estas mutaciones da error. La tarea corre, contesta su JSON y
los sets siguen ahi. Lo que cambia es que tres columnas se quedan vacias
para siempre — y con ellas se van las eras del indice, el filtro de
Pocket del importador y la resolucion de las decklists de 98 sets.

Es la familia del silencio: nada falla, simplemente nada se rellena.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

L = 'netlify/lib/carta-detalle.mjs'
T = 'js/tcgdex.js'

MUTACIONES = [
    # ── 1. Lo que se cura ──
    # Vuelve a curar solo la fecha: la serie y el codigo se quedan a null
    # para siempre y nadie se entera, porque la tarea sigue diciendo que
    # ha curado sets.
    (L, 'solo se cura la fecha, como antes',
     "  const { serie_id, serie_name } = serieDeSet(completo)\n  if (!fila?.serie_id && serie_id) cambios.serie_id = serie_id\n  if (!fila?.serie_name && serie_name) cambios.serie_name = serie_name\n  const codigo = codigoLiveDeSet(completo)\n  if (!fila?.tcg_online_code && codigo) cambios.tcg_online_code = codigo\n",
     ''),
    (L, 'el codigo de TCG Live se queda sin curar',
     '  if (!fila?.tcg_online_code && codigo) cambios.tcg_online_code = codigo\n', ''),

    # ── 2. Lo que PISA lo que ya estaba ──
    # Escribir encima de lo que ya hay: una respuesta rara de la API
    # borra un codigo bueno, y las decklists de ese set dejan de
    # resolverse. Y no da error, porque escribir null es escribir.
    (L, 'lo que llega pisa lo que ya estaba curado',
     '  if (!fila?.serie_id && serie_id) cambios.serie_id = serie_id',
     '  cambios.serie_id = serie_id'),
    (L, 'una fecha vacia borra la que habia',
     '  if (!fila?.release_date && fecha) cambios.release_date = fecha',
     '  cambios.release_date = fecha'),

    # ── 3. Quien entra en la fase ──
    # Con solo la fecha, un set que ya la tiene pero no tiene serie ni
    # codigo no entra nunca: la fase se da por acabada con 210 sets sin
    # serie.
    (L, 'volver a pedir fecha y codigo: el cerrojo de la 329',
     '  return !fila?.serie_id || !fila?.serie_name',
     '  return !fila?.serie_id || !fila?.serie_name || !fila?.release_date || !fila?.tcg_online_code'),
    (L, 'un set con fecha se da por completo aunque no se haya visitado',
     '  return !fila?.serie_id || !fila?.serie_name', '  return !fila?.release_date'),

    # ── 4. El importador ──
    # Volver a escribir la serie desde el LISTADO, donde no viene: pone
    # null en los 210 y BORRA lo que la tarea acaba de curar. Es el fallo
    # original, y solo se nota al reimportar.
    (T, 'el importador vuelve a escribir la serie desde el listado',
     '  if (set.serie?.id) fila.serie_id = set.serie.id\n  if (set.serie?.name) fila.serie_name = set.serie.name',
     '  fila.serie_id = set.serie?.id || null\n  fila.serie_name = set.serie?.name || null'),
    # Y el filtro de Pocket que no filtra: es como entraron los catorce.
    (T, 'fetchSets vuelve a filtrar Pocket por una serie que nunca llega',
     '  return (sets || []).filter(esDelTCG)',
     '  return (sets || []).filter((s) => !SERIES_EXCLUIDAS.includes(s.serie?.id))'),

    # ── 5. El codigo, mal normalizado ──
    # Sin mayusculas, «twm» no casa con el «TWM» de una decklist y ese
    # set deja de resolverse. La carta cae al camino por nombre.
    (L, 'el codigo se guarda tal cual viene, sin normalizar',
     '  const limpio = bruto.trim().toUpperCase()', '  const limpio = bruto.trim()'),
    # Y sin la criba: un valor raro traduce una decklist a otra carta.
    (L, 'cualquier cosa vale como codigo',
     "  return /^[A-Z0-9]{2,6}$/.test(limpio) ? limpio : null", '  return limpio'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-329.mjs')
