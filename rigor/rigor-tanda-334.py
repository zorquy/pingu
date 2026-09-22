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
    # Y al reves: que la estructura se trague cualquier cosa. Un
    # Entrenador no tiene PS, asi que esto solo puede meter ruido.
    (D, 'la estructura se traga cualquier cosa',
     "  if (cat === 'Trainer' || cat === 'Energy') return false", '  if (false) return false'),

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
     '''.carta-scan {
  margin: 0;
  position: sticky;
  top: var(--e-2xl);
}''',
     '''@media (max-width: 720px) { .carta-scan { position: static; } }
.carta-scan {
  margin: 0;
  position: sticky;
  top: var(--e-2xl);
}'''),
    # Y que el tope desaparezca: a pantalla completa el escaneo se come
    # el sitio de todo lo demas.
    (CSS, 'el escaneo del movil pierde su tope de ancho',
     '    max-width: 260px;\n    margin-inline: auto;', '    margin-inline: auto;'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-334.mjs')
