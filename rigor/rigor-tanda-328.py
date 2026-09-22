"""Rigor de la tanda 328 — mismo nombre no es la misma carta.

Ninguna da error. La ficha se pinta, la lista del mazo se pinta y nadie
ve una excepcion. Lo que cambia es QUE CARTA se cree que es cada una — y
en un caso eso es marcar en rojo, como fuera de reglamento, una carta
legal en el mazo con el que alguien se ha presentado a un torneo.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

N = 'js/carta-nucleo.js'
D = 'js/torneos/cartas-decklist.js'
C = 'js/carta.js'

MUTACIONES = [
    # ── 1. El fallo grave: acusar a una carta que no se ha identificado ──
    (D, 'se vuelve a juzgar el reglamento de una gemela encontrada por nombre',
     '        if (\n          carta.exacta &&\n          carta.regulation_mark &&',
     '        if (\n          carta.regulation_mark &&'),
    # Y el cinturon: la marca de la gemela vuelve a salir del resolutor.
    (D, 'la marca de una gemela sale del resolutor',
     '  const salida = carta ? { ...carta, exacta, regulation_mark: exacta ? carta.regulation_mark : null } : null',
     '  const salida = carta ? { ...carta, exacta } : null'),
    # Un hallazgo por nombre se da por exacto: lo peor de los dos mundos.
    (D, 'un hallazgo por nombre se da por exacto',
     '      exacta = Boolean(carta)', '      exacta = true'),
    # Y el aviso que no avisa: la carta no se marca, pero tampoco se dice
    # nada y parece que la lista esta bien escrita.
    (D, 'no se avisa de las cartas que no se han podido identificar',
     '        if ((!carta || !carta.exacta) && !esEnergiaBasica(linea)) sinIdentificar += linea.quantity\n', ''),
    # Contarlo DESPUES de la salida temprana: la que no se encuentra en
    # absoluto —la mas confusa de todas— vuelve a no decir nada.
    (D, 'la carta que no se encuentra en absoluto no se cuenta',
     '        if ((!carta || !carta.exacta) && !esEnergiaBasica(linea)) sinIdentificar += linea.quantity\n        const hueco',
     '        const hueco'),
    # Y mezclar los dos mensajes, que fue justo el fallo: «no la
    # reconozco» no es «esta prohibida».
    (D, 'volver a llamar «fuera del reglamento» a lo que no se reconoce',
     '      `No he podido identificar ${sinIdentificar} ${sinIdentificar === 1 ? \'carta\' : \'cartas\'}: su colección no está en nuestro catálogo todavía. La imagen puede ser de otra impresión y de esas NO se comprueba el reglamento.`',
     '      `Fuera del reglamento: ${sinIdentificar} sin identificar.`'),

    # ── 2. La huella ──
    (N, 'volver a comparar solo por el nombre',
     "  return [\n    normalizarNombre(carta.name),\n    carta.hp ?? '',\n    carta.stage ?? '',",
     "  return [\n    normalizarNombre(carta.name),\n    '',\n    '',"),
    (N, 'el dano de los ataques deja de contar',
     "      String(a?.damage ?? ''),", "      '',"),
    (N, 'el coste de los ataques deja de contar',
     "      (Array.isArray(a?.cost) ? a.cost : []).join('+'),", "      '',"),
    # Sin ataques hay huella: dos cartas sin engordar saldrian como «la
    # misma» y volverian los trece Primeapes.
    (N, 'una carta sin engordar tiene huella igual',
     '  if (!ataques || !ataques.length) return null', '  if (false) return null'),
    # El orden de los ataques importando: la misma carta dejaria de
    # reconocerse si la API los devuelve al reves.
    (N, 'el orden de los ataques cuenta',
     '    .sort()\n  return [', '  return ['),

    # ── 3. Pocket en la ficha ──
    (C, 'Pocket vuelve a colarse en «otras versiones»',
     '    .filter((v) => esDelTCG({ id: v.set_id, serie_id: v.tcg_sets?.serie_id }))\n', ''),
    # Y con solo la serie, que es el filtro que no echaba a ninguno.
    (C, 'el filtro de «otras versiones» vuelve a mirar solo la serie',
     '    .filter((v) => esDelTCG({ id: v.set_id, serie_id: v.tcg_sets?.serie_id }))',
     '    .filter((v) => esDelTCG({ serie_id: v.tcg_sets?.serie_id }))'),

    # ── 4. Los iconos de tipo ──
    (N, 'la debilidad vuelve a salir como texto, sin su icono',
     "          .map((f) => `${puntoDeEnergia(f?.type)}<span class=\"carta-mult\">${escapeHtml(f?.value || '')}</span>`)",
     "          .map((f) => `<span class=\"carta-mult\">${escapeHtml(f?.value || '')}</span>`)"),
    # Y el punto sin nombre: quien no ve el color se queda sin saber de
    # que tipo es.
    (N, 'los puntos de energia se quedan sin nombre',
     '  return `<span class="carta-energia" data-tipo="${escapeHtml(tipo)}" title="${escapeHtml(es)}" aria-label="${escapeHtml(es)}"></span>`',
     '  return `<span class="carta-energia" data-tipo="${escapeHtml(tipo)}"></span>`'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-328.mjs')
