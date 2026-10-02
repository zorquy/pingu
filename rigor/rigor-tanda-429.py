"""Rigor de la tanda 429 — los que casi completas.

Una lista mal ordenada o mal filtrada no da error: sale una rejilla
preciosa con los Pokémon equivocados. Cada mutación rompe el criterio,
que es el origen.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

P = 'js/mi-coleccion/pokedex.js'
J = 'js/mi-coleccion.js'
H = 'mi-coleccion.html'

MUTACIONES = [
    (P, 'se cuelan los que no has empezado',
     "    .filter((f) => f.tengo > 0 && f.total && f.tengo < f.total)",
     "    .filter((f) => f.total && f.tengo < f.total)"),
    (P, 'se cuelan los que ya tienes enteros',
     "    .filter((f) => f.tengo > 0 && f.total && f.tengo < f.total)",
     "    .filter((f) => f.tengo > 0 && f.total)"),
    # AQUÍ IBA «se cuelan aquellos de los que no se sabe cuántos hay»
    # (quitar el `f.total &&`). No está porque NO CAMBIA NADA: con `total`
    # a null, `f.tengo < f.total` ya da falso —JavaScript convierte el null
    # en 0—, así que la guarda está respaldada por la comparación de al
    # lado. El `f.total &&` se queda en el código igualmente, y eso es una
    # decisión y no un descuido: sin él, el filtro dependería de una
    # coerción que no se ve al leerlo. Lo que no se puede es fingir que una
    # mutación invisible se detecta.
    (P, 'ordena por porcentaje y no por lo que falta',
     "    .sort((a, b) => (a.total - a.tengo) - (b.total - b.tengo) ||\n      b.tengo / b.total - a.tengo / a.total || a.dex - b.dex)",
     "    .sort((a, b) => b.tengo / b.total - a.tengo / a.total || a.dex - b.dex)"),
    (P, 'ordena al reves: los que mas faltan primero',
     "    .sort((a, b) => (a.total - a.tengo) - (b.total - b.tengo) ||",
     "    .sort((a, b) => (b.total - b.tengo) - (a.total - a.tengo) ||"),
    (P, 'a igualdad no desempata el mas adelantado',
     "      b.tengo / b.total - a.tengo / a.total || a.dex - b.dex)", "      a.dex - b.dex)"),
    (P, '«casi» vuelve a agrupar por generaciones',
     "  if (orden === 'cerca') {", "  if (false) {"),
    (P, 'sin ninguno a medias se deja un hueco en blanco',
     "    if (!cerca.length) {", "    if (false) {"),
    (P, 'el rotulo no dice cuantos son',
     "        <small>${cerca.length}</small>", "        <small></small>"),
    (J, 'la rejilla no hace caso al desplegable',
     "    pokedex.rejillaHtml(filas, $('mcPdxOrden')?.value || 'dex')", "    pokedex.rejillaHtml(filas, 'dex')"),
    (J, 'cambiar el orden no repinta',
     "  for (const id of ['mcPdxBuscar', 'mcPdxSoloMios', 'mcPdxOrden']) {",
     "  for (const id of ['mcPdxBuscar', 'mcPdxSoloMios']) {"),
    (H, 'la Pokedex se queda sin desplegable',
     '<option value="cerca">Los que casi completas</option>', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-429.mjs')
