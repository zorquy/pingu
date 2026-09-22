"""Rigor de la tanda 330 — el espanol y las eras.

Ninguna da error. La tarea sigue engordando cartas y el indice sigue
listando colecciones. Lo que cambia es el IDIOMA de lo que se guarda
—que no se ve hasta que abres una ficha— y el ORDEN del indice, que es
lo primero que ve quien entra.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

D = 'js/carta-detalle.js'
T = 'netlify/functions/cartas-detalle.mjs'
C = 'js/cartas.js'

MUTACIONES = [
    # ── 1. El idioma ──
    # Vuelta al ingles, que es el fallo original. Nada se rompe: la ficha
    # se pinta igual, solo que en otro idioma.
    (D, 'se vuelve a pedir todo en ingles',
     "export const IDIOMAS_DE_FICHA = ['es', 'en']", "export const IDIOMAS_DE_FICHA = ['en']"),
    # El orden al reves: se coge el ingles siempre, porque siempre existe,
    # y el espanol no se llega a pedir nunca.
    (D, 'el ingles va primero y el espanol no se pide nunca',
     "export const IDIOMAS_DE_FICHA = ['es', 'en']", "export const IDIOMAS_DE_FICHA = ['en', 'es']"),
    # Y la vuelta atras que deja media ficha vacia: sin ingles, las
    # anteriores a 2011 se quedan sin ataques para siempre.
    (D, 'sin respaldo en ingles, lo viejo se queda sin ficha',
     "export const IDIOMAS_DE_FICHA = ['es', 'en']", "export const IDIOMAS_DE_FICHA = ['es']"),
    # Seguir a la siguiente aunque la primera haya contestado: una
    # peticion de mas POR CARTA son 23.000 de mas.
    (D, 'se piden los dos idiomas siempre',
     '    return { fila, idioma, nombre }', '    if (idioma !== "en") continue\n    return { fila, idioma, nombre }'),
    # El nombre vacio pisando el bueno: la carta se queda sin nombre y
    # sin forma de buscarla.
    (D, 'un nombre vacio pisa el que habia',
     "    const nombre = typeof carta.name === 'string' && carta.name.trim() ? carta.name.trim() : null",
     '    const nombre = String(carta.name ?? "")'),

    # ── 2. Lo que se apunta ──
    # Sin el idioma, una traducida y una que no lo esta son
    # indistinguibles: reintentarlo dentro de un ano costaria reengordar
    # las 23.000.
    (T, 'no se apunta en que idioma se consiguio',
     '      const detalle = { ...encontrado.fila, detalle_lang: encontrado.idioma }',
     '      const detalle = { ...encontrado.fila }'),
    # Y las engordadas antes de la 330 no se vuelven a pasar: se quedan
    # en ingles para siempre.
    (T, 'las engordadas en ingles no se reintentan',
     "      '&or=(detalle_at.is.null,detalle_lang.is.null)' +", "      '&detalle_at=is.null' +"),
    # El nombre traducido, pisado con null.
    (T, 'el nombre se escribe aunque no haya llegado',
     '      if (encontrado.nombre) detalle.name = encontrado.nombre',
     '      detalle.name = encontrado.nombre'),

    # ── 3. Las eras ──
    # El umbral tan bajo que McDonald's cuenta como era y vuelve a
    # colarse entre dos eras de verdad.
    (C, "el umbral baja y McDonald's vuelve a ser una era",
     'export const CARTAS_DE_UNA_EXPANSION = 100', 'export const CARTAS_DE_UNA_EXPANSION = 10'),
    # O tan alto que no hay ninguna era y sale todo del reves.
    (C, 'el umbral sube y ya no hay ninguna era',
     'export const CARTAS_DE_UNA_EXPANSION = 100', 'export const CARTAS_DE_UNA_EXPANSION = 5000'),
    # El set mas grande decide, no el primero: una era que empieza por un
    # set pequeno dejaria de serlo.
    (C, 'decide el primer set de la serie y no el mas grande',
     '  return sets.some((s) => (s.card_count_official || s.card_count_total || 0) >= CARTAS_DE_UNA_EXPANSION)',
     '  return (sets[0]?.card_count_official || 0) >= CARTAS_DE_UNA_EXPANSION'),
    # Y lo que no tiene serie, en medio de las eras.
    (C, 'lo que no tiene serie se queda en medio',
     "    ...grupos.filter((g) => g.era && g.nombre !== SIN_CLASIFICAR),\n    ...grupos.filter((g) => !g.era && g.nombre !== SIN_CLASIFICAR),\n    ...grupos.filter((g) => g.nombre === SIN_CLASIFICAR),",
     '    ...grupos,'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-330.mjs')
