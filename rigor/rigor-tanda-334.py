"""Rigor de la tanda 334 — los enums traducidos.

Ninguna de estas da error. La ficha se pinta, la carta sale, y lo que
pasa es que media pagina desaparece en silencio para las 2.811 cartas
que ya estan guardadas en espanol. Que es exactamente lo que le paso a
PINGU tres veces en dos dias.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

D = 'js/carta-detalle.js'
N = 'js/carta-nucleo.js'
CSS = 'css/carta.css'

MUTACIONES = [
    # ── 1. El fallo original: no canonizar al pintar ──
    # Es el estado en el que estaba el repo antes de la tanda. Se va el
    # subtitulo, se va el cuadro de combate y se va la huella (y con
    # ella, las otras versiones) de golpe.
    (N, 'no se devuelven los enums al ingles al pintar',
     '  const carta = canonizarCarta(cartaCruda)\n  const img = urlDeImagen',
     '  const carta = cartaCruda\n  const img = urlDeImagen'),
    (N, 'la huella se calcula con los enums traducidos',
     '  const carta = canonizarCarta(cartaCruda)\n  if (!carta || !esPokemon(carta)) return null',
     '  const carta = cartaCruda\n  if (!carta || !esPokemon(carta)) return null'),

    # ── 2. Canonizar a medias ──
    # Una tabla suelta que se queda sin invertir. Cada una apaga un
    # trozo distinto de la ficha y ninguna avisa.
    (D, 'la categoria se queda traducida',
     '    category: canonico(A_CATEGORIA, fila.category),', '    category: fila.category,'),
    (D, 'la fase se queda traducida',
     '    stage: canonico(A_FASE, fila.stage),', '    stage: fila.stage,'),
    (D, 'los tipos se quedan traducidos y los puntos salen grises',
     '    types: Array.isArray(fila.types) ? fila.types.map(tipo) : fila.types,',
     '    types: fila.types,'),
    (D, 'el tipo de la debilidad y el de la resistencia se quedan traducidos',
     '    weaknesses: conTipo(fila.weaknesses),', '    weaknesses: fila.weaknesses,'),
    (D, 'el coste de los ataques se queda traducido',
     '''    attacks: Array.isArray(fila.attacks)
      ? fila.attacks.map((a) =>
          a && typeof a === 'object' && Array.isArray(a.cost) ? { ...a, cost: a.cost.map(tipo) } : a
        )
      : fila.attacks,''',
     '    attacks: fila.attacks,'),

    # ── 3. La red de la estructura ──
    # Sin ella volvemos a depender de una lista curada, que es lo que se
    # queda viejo (la 323). El dia que TCGdex cambie una palabra, media
    # ficha se apaga otra vez sin dar error.
    (D, 'sin la via de la estructura: una palabra desconocida ya no es un Pokemon',
     '  return Number.isInteger(carta?.hp)\n}', '  return false\n}'),
    # NO hay mutacion de «la estructura se traga cualquier cosa»
    # (quitar el `if (cat === 'Trainer' || cat === 'Energy') return
    # false`): ningun Entrenador ni ninguna Energia tiene PS, asi que
    # el `Number.isInteger(hp)` de abajo devuelve lo mismo y el
    # comportamiento no cambia. Es justo la trampa de la tanda 314 —
    # dos guardas que son red de repuesto una de la otra— y una
    # mutacion que no cambia nada no es una prueba que falte.
    # ── 4. Guardar sin canonizar ──
    # Las que vengan a partir de ahora se guardan traducidas y el
    # problema se reproduce solo, carta a carta.
    (D, 'el engorde vuelve a guardar los enums traducidos',
     '  return canonizarCarta(fila)', '  return fila'),

    # ── 5. El escaneo en el movil ──
    # El bloque del movil ANTES de la base: es literalmente como estaba,
    # y la base le gana por orden porque un @media no suma
    # especificidad. La pagina no da un solo error.
    (CSS, 'el bloque del movil vuelve a ir antes de la base',
     '.carta-scan {\n  margin: 0;\n  position: sticky;\n  top: var(--e-2xl);\n}\n\n/* ── Y en el móvil, ni pegajoso ni tan grande ──\n *\n * ESTE BLOQUE VA DESPUÉS DE LA BASE Y NO ANTES, y no es un capricho de\n * orden: **un `@media` no suma especificidad**. Estaba escrito arriba,\n * antes de `.carta-scan`, así que `position: sticky` le ganaba por\n * orden de aparición y el escaneo seguía pegado al scroll en el móvil,\n * pasando por encima de la ficha. El `max-width` sí funcionaba —ese no\n * choca con nada—, y por eso parecía que la regla se aplicaba.\n *\n * Es la trampa de la tanda 299 dentro de UNA SOLA HOJA: allí era un\n * `@media` que se quedó en `components.css` con su base ya mudada.\n * Misma mecánica, mismo síntoma: el móvil se rompe y nada da error.\n *\n * En una columna el escaneo se comía la pantalla entera y había que\n * bajar para ver el primer dato. 260 px es una MEDIDA, no un paso: por\n * encima de 32 solo se le pide la retícula de 4. */\n@media (max-width: 720px) {\n  .carta-scan {\n    /* Sin columna al lado a la que acompañar, quedarse fijo solo tapa\n       lo que se está leyendo. */\n    position: static;\n    max-width: 260px;\n    margin-inline: auto;\n  }\n}\n',
     '@media (max-width: 720px) {\n  .carta-scan {\n    /* Sin columna al lado a la que acompañar, quedarse fijo solo tapa\n       lo que se está leyendo. */\n    position: static;\n    max-width: 260px;\n    margin-inline: auto;\n  }\n}\n\n.carta-scan {\n  margin: 0;\n  position: sticky;\n  top: var(--e-2xl);\n}\n\n/* ── Y en el móvil, ni pegajoso ni tan grande ──\n *\n * ESTE BLOQUE VA DESPUÉS DE LA BASE Y NO ANTES, y no es un capricho de\n * orden: **un `@media` no suma especificidad**. Estaba escrito arriba,\n * antes de `.carta-scan`, así que `position: sticky` le ganaba por\n * orden de aparición y el escaneo seguía pegado al scroll en el móvil,\n * pasando por encima de la ficha. El `max-width` sí funcionaba —ese no\n * choca con nada—, y por eso parecía que la regla se aplicaba.\n *\n * Es la trampa de la tanda 299 dentro de UNA SOLA HOJA: allí era un\n * `@media` que se quedó en `components.css` con su base ya mudada.\n * Misma mecánica, mismo síntoma: el móvil se rompe y nada da error.\n *\n * En una columna el escaneo se comía la pantalla entera y había que\n * bajar para ver el primer dato. 260 px es una MEDIDA, no un paso: por\n * encima de 32 solo se le pide la retícula de 4. */\n'),
    # Y que el tope desaparezca: a pantalla completa el escaneo se come
    # el sitio de todo lo demas.
    (CSS, 'el escaneo del movil pierde su tope de ancho',
     '    max-width: 260px;\n    margin-inline: auto;', '    margin-inline: auto;'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-334.mjs')
