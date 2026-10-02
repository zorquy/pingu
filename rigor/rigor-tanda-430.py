"""Rigor de la tanda 430 — la lista de lo que te falta.

Una lista mal hecha se pega igual de bien en un chat y la otra persona te
busca las cartas equivocadas. Nada de esto da error.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

L = 'js/mi-coleccion/lo-que-falta.js'
J = 'js/mi-coleccion.js'
H = 'mi-coleccion.html'

MUTACIONES = [
    (L, 'no avisa de que hay filtros puestos',
     "  const cabecera = filtrando", "  const cabecera = false"),
    (L, 'no dice el numero de la carta',
     "  return `${numero} · ${nombre}${version}`", "  return `${nombre}${version}`"),
    (L, 'no dice que version es',
     "  const version = c.__variante?.nombre ? ` (${c.__variante.nombre})` : ''", "  const version = ''"),
    (L, 'el nombre ingles le gana al español',
     "  const nombre = c.name_es || c.name || 'Carta'", "  const nombre = c.name || c.name_es || 'Carta'"),
    (L, 'sin nada que falte devuelve un encabezado solo',
     "  if (!faltan?.length) return ''", "  if (!faltan) return ''"),
    (J, 'la lista no quita las que SI tienes',
     "  return (album.aLaVista || []).filter((c) => !tengoDe(c.id, c.__variante?.nuestro || null))",
     "  return album.aLaVista || []"),
    (J, 'la lista no mira la version, solo la carta',
     "!tengoDe(c.id, c.__variante?.nuestro || null))", "!tengoDe(c.id))"),
    (J, 'el boton no dice cuantas son',
     "    ? `Copiar las ${cuantas} que me faltan`", "    ? 'Copiar lo que me falta'"),
    (J, 'el boton no se apaga sin nada que copiar',
     "  boton.disabled = !cuantas", "  boton.disabled = false"),
    (J, 'no se guarda lo que hay en pantalla',
     "  album.aLaVista = paraPintar\n", "  \n"),
    (J, 'con las versiones separadas se dice un total que no cuadra',
     "    total: album.split ? null : album.cartas.length,", "    total: album.cartas.length,"),
    (J, 'se vuelve a deducir si hay filtros en vez de preguntarlo',
     "    filtrando: Boolean(album.filtrando),",
     "    filtrando: (album.aLaVista || []).length !== album.cartas.length,"),
    (J, 'no se guarda si habia filtros puestos',
     "  album.filtrando = filtrando\n", "  \n"),
    (L, 'sin total se repite el numero de las que faltan',
     "      : `Me faltan ${cuantas} de ${donde}:`", "      : `Me faltan ${cuantas} de las ${cuantas} de ${donde}:`"),
    (H, 'la rejilla se queda sin boton de copiar',
     '<button type="button" class="mc-chip-mando" id="mcFaltanCopiar">Copiar lo que me falta</button>', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-430.mjs')
