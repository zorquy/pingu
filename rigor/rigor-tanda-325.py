"""Rigor de la tanda 325 — «en los torneos de PokeDoc».

Ninguna de estas mutaciones da error. Sale un bloque, sale un número y
sale una barra. Lo que cambia es si el número SIGNIFICA algo, y —la peor
de todas— si el agregado se ha calculado con lo que puede ver todo el
mundo o con lo que puede ver la clave de servicio.

Esa última es la que importa: los arquetipos no se guardan A PROPÓSITO,
para que la visibilidad no se pueda equivocar. Guardar un agregado
devuelve esa garantía a manos de una decisión concreta, y una decisión
que nadie vigila se cambia sola en el primer refactor.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

A = 'netlify/lib/juego-agregado.mjs'
F = 'netlify/functions/cartas-juego.mjs'
N = 'js/carta-nucleo.js'
B = 'netlify/edge-functions/meta-social.js'

MUTACIONES = [
    # ── 1. La garantía de la visibilidad ──
    # La de todas. Con la clave de servicio se salta la RLS y acabarían
    # contadas las listas de un torneo que dijo «nunca».
    (F, 'las decklists se leen con la clave que se salta la RLS',
     '    headers: { apikey: CLAVE_PUBLICA, authorization: `Bearer ${CLAVE_PUBLICA}`, accept: \'application/json\' },',
     '    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, accept: \'application/json\' },'),

    # Y su versión sutil: el agregado se va SUMANDO en vez de rehacerse.
    # Una lista que deja de ser pública seguiría contada para siempre.
    (F, 'lo que deja de ser visible se queda contado para siempre',
     "  const res = await fetch(\n    `${SUPABASE_URL}/rest/v1/tcg_card_play?updated_at=lt.${encodeURIComponent(ahora)}`,\n    { method: 'DELETE', headers: { ...servicio(clave), Prefer: 'return=minimal' } }\n  )\n  const borradas = res.ok",
     '  const borradas = true'),

    # ── 2. Un número sin muestra ──
    # Con dos mazos, «la lleva el 100%» es verdad y no dice nada.
    (N, 'basta un solo mazo para publicar una estadística',
     'export const MAZOS_MINIMOS = 3', 'export const MAZOS_MINIMOS = 1'),
    # Y el pie que dice de dónde sale el número: sin él, el 2,4 es una
    # afirmación de la casa en vez de un dato con su fuente.
    (N, 'el bloque deja de decir de dónde salen sus números',
     "`<p class=\"juego-pie\">Contado sobre las listas públicas de los torneos de PokeDoc. ` +\n    `Una lista solo entra aquí cuando su torneo la deja ver.</p>` +",
     "'' +"),

    # ── 3. La cuenta ──
    # Dos reimpresiones de Iono en el mismo mazo contarían como dos
    # mazos. El número se infla y nada se queja.
    (A, 'una carta en dos líneas del mismo mazo pierde la mitad de sus copias',
     '        const previo = enEsteMazo.get(key)\n        enEsteMazo.set(key, {',
     '        const previo = null\n        enEsteMazo.set(key, {'),
    # Las energías básicas dentro: saldrían siempre las primeras de todo.
    (A, 'las energías básicas entran en la cuenta',
     "  return seccion === 'pokemon' || seccion === 'trainer'", '  return true'),
    # Los torneos contados como listas: «en 18 torneos» cuando son 4.
    (A, 'los torneos se cuentan como si cada lista fuera uno',
     '    tournaments: f.torneos.size,', '    tournaments: f.decks,'),
    # La media, imposible de recalcular.
    (A, 'se guarda la media ya dividida y no las copias',
     '    total_copies: f.total_copies,', '    total_copies: Math.round(f.total_copies / f.decks),'),

    # ── 4. El orden, que tiene que ser ESTABLE ──
    # Sin el desempate por nombre, dos cálculos seguidos pintan distinto
    # y parece que algo se mueve cuando no se mueve nada.
    (A, 'dos arquetipos empatados se pintan en cualquier orden',
     '      .sort((a, b) => b.mazos - a.mazos || String(a.nombre).localeCompare(String(b.nombre)))',
     '      .sort((a, b) => b.mazos - a.mazos)'),
    # Y el recorte: sin él, una carta común arrastra cuarenta arquetipos
    # de un mazo cada uno.
    (A, 'se guardan todos los arquetipos, con su cola de ruido',
     '      .slice(0, ARQUETIPOS_POR_CARTA),', '      ,'),

    # ── 5. El listón de Google ──
    (N, 'vuelve a indexarse cualquier ficha engordada',
     '  return Boolean(carta?.detalle_at) && hayDatosDeJuego(play)',
     '  return Boolean(carta?.detalle_at)'),
    # Y el borde con su propia opinión: la página diría una cosa y el
    # sitemap otra.
    (B, 'el borde decide por su cuenta quién se indexa',
     'robots: mereceIndexarse(carta, play)', 'robots: mereceIndexarse(carta, null)'),

    # ── 6. La clave, calculada dos veces ──
    # Si la ficha normaliza distinto que la tarea, pregunta por una clave
    # que no existe y el bloque desaparece SIN DAR ERROR.
    (N, 'la ficha normaliza el nombre a su manera',
     '  return normalizarNombre(carta?.name)', '  return String(carta?.name ?? \'\').toLowerCase()'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-325.mjs')
