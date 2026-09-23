"""Rigor de la tanda 338 — el bloque de torneos con poca muestra.

PINGU: «aunque este en 1 mazo ya deberia salir». Tiene razon en el
fondo, y el arreglo tiene dos mitades que se pueden romper por separado:
que el bloque SALGA desde un mazo, y que con uno NO diga cosas que hacen
falta tres para poder decir.

Ninguna de estas da error: el bloque se pinta y se lee bien. Lo que
cambia es si afirma algo que no puede saber.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

N = 'js/carta-nucleo.js'

MUTACIONES = [
    # ── 1. Que vuelva a esconderse ──
    # El estado del que veniamos: una carta jugada en un torneo de
    # PokeDoc sin nada que la distinga de las otras quince webs.
    (N, 'el bloque vuelve a esconderse con menos de tres mazos',
     'export const MAZOS_MINIMOS = 1', 'export const MAZOS_MINIMOS = 3'),
    # O que salga sin ningun mazo: un bloque de torneos con un cero.
    (N, 'el bloque sale aunque no lo haya jugado nadie',
     'export const MAZOS_MINIMOS = 1', 'export const MAZOS_MINIMOS = 0'),

    # ── 2. Que afirme sin muestra ──
    # Una media de una muestra de uno es el mismo numero disfrazado de
    # estadistica, y se lee como si fuera una tendencia.
    (N, 'se pinta una media con un solo mazo',
     '  const media = muestra ? mediaDeCopias(play) : null', '  const media = mediaDeCopias(play)'),
    # NO hay mutacion de la guarda de `arqs`: la habia, y el rigor la
    # canto como «sin detectar» porque no cambiaba nada — la guarda de
    # `filas` ya la cubria. Era red de repuesto (la trampa de la 314), y
    # lo que se hizo fue quitar la redundancia del codigo, no inventar
    # una prueba para ella.
    # La trampa fina, y la que se me colo al escribirlo: con `arqs`
    # vacio, `otros` se lleva TODOS los mazos y se pintaba «Se juega
    # sobre todo en · Otros 1». La misma afirmacion, dicha de otro modo.
    (N, 'el reparto se cuela por la fila de «Otros»',
     '  const filas = !muestra ? [] : [', '  const filas = [' ),
    # Y el aviso del tamano de la muestra, que es lo que deja al lector
    # decidir si se lo cree.
    (N, 'no se avisa de que la muestra es de una lista',
     "      ? ''\n      : `Son ${play.decks === 1 ? 'los datos de una sola lista'",
     "      ? ''\n      : `${'' && `Son ${play.decks === 1 ? 'los datos de una sola lista'"),

    # ── 3. Y que esto NO baje el liston de Google ──
    # Son dos preguntas distintas: que el bloque salga con un mazo es
    # bueno para quien ya esta en la pagina; ofrecerle a Google una ficha
    # cuyo unico contenido propio es «la llevo un mazo» es contenido
    # escaso, y eso castiga al sitio ENTERO.
    (N, 'se indexa una ficha con un solo mazo',
     '  return Boolean(carta?.detalle_at) && hayMuestra(play)',
     '  return Boolean(carta?.detalle_at) && hayDatosDeJuego(play)'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-325.mjs')
