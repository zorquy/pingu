"""Rigor de la tanda 322 — el detalle de una carta.

Casi ninguna de estas mutaciones da error: el mapeo sigue devolviendo una
fila, Postgres sigue aceptándola y la página sigue pintándose. Lo que
cambia es lo que la página AFIRMA — que un Estadio tiene 0 PS, o que una
carta vieja no tiene marca de regulación.

Es la misma familia que el fallo de la 319: convertir «no lo sé» en un
dato. Por eso las pruebas miran el valor exacto (`=== null`) y no si el
campo existe.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

# El mapeo se mudó a js/ en la tanda 331 (lo necesita el navegador para
# completar una ficha sin engordar). Lo del SERVIDOR —las URLs y el
# idioma del mercado— se quedó donde estaba.
F = 'js/carta-detalle.js'
S = 'netlify/lib/carta-detalle.mjs'

MUTACIONES = [
    # ── 1. «No lo sé» pasa a ser un dato ──
    # Un Entrenador no tiene PS. Con esto, la página diría que un Estadio
    # tiene 0 PS, y eso no lo detecta nada salvo mirarlo.
    (F, 'los PS que faltan pasan a valer 0',
     '    hp: entero(card.hp),', '    hp: entero(card.hp) ?? 0,'),
    (F, 'los ataques que faltan pasan a ser una lista vacía',
     '    attacks: lista(card.attacks),', '    attacks: lista(card.attacks) ?? [],'),
    (F, 'los tipos que faltan pasan a ser una lista vacía',
     "    types: Array.isArray(card.types) && card.types.length ? card.types : null,",
     "    types: Array.isArray(card.types) ? card.types : [],"),

    # ── 2. Los números sin validar ──
    # Las cartas viejas traen «70» en texto y «70+» con sufijo. Una
    # cadena donde Postgres espera integer tumba la fila ENTERA y la
    # carta se queda sin engordar para siempre, sin error visible.
    (F, 'un número en texto se cuela tal cual',
     '  const n = Number(valor)\n  return Number.isInteger(n) ? n : null',
     '  return valor'),
    # Y la versión sutil: Number() convierte «70» a 70 pero «70+» a NaN,
    # y NaN tampoco es un integer válido para Postgres.
    (F, 'un número con sufijo se cuela como NaN',
     '  return Number.isInteger(n) ? n : null', '  return n'),

    # ── 3. La marca de regulación, borrada ──
    # La rellenó un SQL de 8.300 líneas. Escribirla a null cuando TCGdex
    # no la manda rompe la comprobación de reglamento de las decklists,
    # y lo hace en silencio.
    (F, 'la marca de regulación se escribe aunque no venga',
     '  if (card.regulationMark) fila.regulation_mark = card.regulationMark',
     '  fila.regulation_mark = card.regulationMark || null'),

    # ── 4. Campos que se pierden ──
    (F, 'el apellido del nombre (ex, V, VMAX) se pierde',
     '    suffix: card.suffix || null,', '    suffix: null,'),
    (F, 'la rareza y el ilustrador se pierden',
     '    rarity: card.rarity || null,\n    illustrator: card.illustrator || null,',
     '    rarity: null,\n    illustrator: null,'),
    (F, 'de qué evoluciona se pierde',
     '    evolve_from: card.evolveFrom || null,', '    evolve_from: null,'),

    # ── 5. Entrada rota que no se rechaza ──
    # Devolver una fila vacía en vez de null haría que la función
    # programada marcara la carta como engordada SIN datos, y no se
    # reintentaría nunca más.
    (F, 'una carta inválida devuelve fila en vez de null',
     "  if (!card || typeof card !== 'object') return null", '  card = card || {}'),

    # ── 6. El idioma ──
    # El ancla lleva la línea de DEBAJO a propósito: desde que existe
    # `urlDeSet`, la del idioma aparece dos veces y el andamio se niega a
    # mutar algo ambiguo (bien hecho). Un ancla es única o no es un ancla.
    (S, 'la URL de una carta pide siempre en inglés, sea cual sea el mercado',
     '  const idioma = IDIOMA_POR_MERCADO[market] || IDIOMA_POR_MERCADO.WEST\n'
     '  return `${API}/${idioma}/cards/${encodeURIComponent(cardId)}`',
     "  const idioma = 'en'\n"
     '  return `${API}/${idioma}/cards/${encodeURIComponent(cardId)}`'),
    # La copia que se separa del original. Es EXACTAMENTE lo que la
    # prueba de la copia vigilada existe para cazar.
    (S, 'la copia del mapa de idiomas se separa del original',
     "  JP: 'ja',", "  JP: 'jp',"),
    (S, 'el identificador deja de escaparse en la URL',
     'cards/${encodeURIComponent(cardId)}`\n}', 'cards/${cardId}`\n}'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-322.mjs')
