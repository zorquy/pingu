"""Rigor de la tanda 413 — la impresión que se enseña, guardarse cualquier
lista, la portada de «Mis mazos», la imagen exportada y el meta del
torneo.

Casi nada de esto da error al romperse: una lista que enseña la
ilustración especial en vez de la Rara Doble se ve preciosa, un mazo que
se guarda con 22 cartas en vez de 25 no avisa, y una portada que el
constructor pisa al guardar solo se nota la próxima vez que entras en
«Mis mazos». Por eso cada mutación rompe el ORIGEN del dato.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

IC = 'js/impresion-canonica.js'
IS = 'js/impresiones-del-set.js'
LC = 'js/lista-canonica.js'
D = 'js/constructor/datos.js'
C = 'js/constructor.js'
MZ = 'js/mazos.js'
G = 'js/guardar-lista.js'
R = 'js/torneos/ronda.js'
MT = 'js/torneos/meta-torneo.js'
DI = 'js/torneos/decklist-imagen.js'
E = 'netlify/functions/escaneo.mjs'
CT = 'css/torneos.css'
CC = 'css/constructor.css'

MUTACIONES = [
    # ── 1. Qué impresión se enseña ──
    (IC, 'regla 1 apagada: se enseña la ilustración especial',
     '  if (!carta || !fueraDeLaColeccion(carta, oficiales)) return carta',
     '  return carta'),
    (IC, 'un set sin cuenta oficial lo tiene todo «fuera»',
     '  if (!tope) return false',
     '  if (!tope) return true'),
    (IC, 'dos Pokémon con el mismo nombre son la misma carta',
     '  if (!esPokemon(a) && !esPokemon(b)) return true',
     '  return true'),
    (IC, 'sin saber los ataques, se da por buena',
     '  return Boolean(x) && x === y',
     '  return x === y'),
    (IC, 'la promo gana a la colección',
     "export function esColeccionDePromos(setId, codigo = '') {",
     "export function esColeccionDePromos(setId, codigo = '') {\n  return false"),
    (IC, 'no se junta nada',
     '    if (g) g.push(e)\n    else grupos.push([e])',
     '    grupos.push([e])'),
    (IC, 'al juntar no se suman las copias',
     '    return { ...elegida, n: g.reduce((s, x) => s + (Number(x.n) || 0), 0), juntadas: g.length }',
     '    return { ...elegida, juntadas: g.length }'),
    (IS, 'la base se pide y no se usa',
     '  const conBase = entradas.map((e) => (e.carta && bases.has(e.carta.id) ? { ...e, carta: bases.get(e.carta.id) } : e))',
     '  const conBase = entradas'),
    (IS, 'no se piden los ataques de los Pokémon repetidos',
     '  await conAtaques(repetidos.map((e) => e.carta))',
     ''),
    (LC, 'las energías de un tipo no se juntan',
     '    const misma = letra && finales.find((o) => o.letra === letra)',
     '    const misma = null'),
    (LC, 'una energía suelta cuenta como «sin identificar»',
     '&& !esEnergiaBasica(e.linea) && !letraDeEnergiaBasica(e.linea.name))',
     '&& !esEnergiaBasica(e.linea))'),
    # Heredada de la 328: contar solo las gemelas y no las que no
    # aparecen por ningún lado, que son las más confusas de todas.
    (LC, 'la carta que no se encuentra en absoluto no se cuenta',
     '    .filter((e) => (!e.carta || !e.carta.exacta) && !esEnergiaBasica(e.linea) && !letraDeEnergiaBasica(e.linea.name))',
     '    .filter((e) => (e.carta && !e.carta.exacta) && !esEnergiaBasica(e.linea) && !letraDeEnergiaBasica(e.linea.name))'),
    (LC, 'la casilla lleva el número de la impresión que NO se enseña',
     '        number: carta?.exacta && carta.local_id ? carta.local_id : final.linea.number,',
     '        number: final.linea.number,'),

    # ── 2. El constructor ──
    (D, 'la energía por número no existe (MEE 9–16 sin resolver)',
     "  const tope = codigo === 'MEE' ? 16 : codigo === 'SVE' ? 8 : 0",
     '  const tope = 0'),
    (D, 'el constructor no elige impresión ni junta',
     '  const juntas = await canonizarEntradas(',
     '  const juntas = await (async (x) => x)('),
    (C, 'sin Limitless detrás del espejo',
     '  return cadenaDeEscaneo(carta, codigoDeSet(carta.set_id), calidad, cardImageUrl)',
     '  return cadenaDeEscaneo(carta, null, calidad, cardImageUrl)'),
    (C, 'la portada elegida se pisa al guardar',
     '  if (estado.portada && (estado.portadaDeFuera || estado.entradas.has(estado.portada))) return estado.portada',
     ''),
    (C, 'una portada de fuera del mazo no se reconoce',
     '  estado.portadaDeFuera = Boolean(estado.portada && !estado.entradas.has(estado.portada))',
     '  estado.portadaDeFuera = false'),
    (C, 'al abrir un mazo se olvida su portada',
     '  estado.portada = fila.cover_card || null\n  estado.entradas',
     '  estado.portada = null\n  estado.entradas'),

    # ── 3. «Mis mazos» ──
    (MZ, 'elegir portada no la guarda',
     '    const fila = await cambiarPortada(mazo.id, cartaId)',
     '    const fila = {}'),
    (MZ, 'el foco se pierde al cambiar la portada',
     "    $('mzLista').querySelector(`[data-id=\"${CSS.escape(mazo.id)}\"] [data-portada]`)?.focus()",
     ''),
    (MZ, 'la ventana no ordena: los Pokémon no van primero',
     '  const orden = [...s.P, ...s.T, ...s.E, ...(s.X || [])].map((e) => e.carta)',
     '  const orden = entradas.map((e) => e.carta)'),
    (CC, 'el buscador de la ventana con el blanco del navegador',
     '.cm-portada-buscar input {\n  min-height: 44px;',
     '.cm-portada-buscar-no input {\n  min-height: 44px;'),
    (CC, 'en el móvil, dos por fila',
     '  .cm-portada-rejilla { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); }',
     ''),

    # ── 4. Guardarse una lista ──
    (G, 'la copia se guarda PÚBLICA',
     '    is_public: false,',
     '    is_public: true,'),
    (G, 'sin cuenta no se manda a entrar',
     '  if (!sesion) return { entrar: true }',
     ''),
    (R, 'el botón no pasa a ser el enlace a la copia',
     '    boton.outerHTML = `<a class="btn-primary" href="/constructor?mazo=${encodeURIComponent(r.mazo.id)}">Abrir mi copia</a>`',
     ''),

    # ── 5. La imagen exportada ──
    (DI, 'sin /escaneo: lo que no trae permiso sale en blanco',
     '  if (linea?.set && linea?.number) fuentes.push(',
     '  if (false) fuentes.push('),
    (DI, 'las imágenes sin crossOrigin: el lienzo se mancha',
     "    img.crossOrigin = 'anonymous'",
     ''),
    (E, '/escaneo devuelve cualquier cosa con un 200',
     '    if (!/^image\\//.test(tipo)) return null',
     ''),
    (E, '/escaneo pide lo que no es una carta',
     '  if (!url) return null',
     '  if (false) return null'),

    # ── 6. El meta del torneo ──
    ('js/torneos/torneo.js', 'no hay pestaña «Meta»',
     "  { id: 'meta', texto: 'Meta' },\n",
     ''),
    (R, 'el meta no se pinta',
     '  pintarClasificacion()\n  pintarMeta()',
     '  pintarClasificacion()'),
    (R, 'cada refresco de la ficha echa del mazo que se miraba',
     '  pintarClasificacion()\n  pintarMeta()',
     '  pintarClasificacion()\n  metaAbierto = null\n  pintarMeta()'),
    (R, 'al volver, el foco no va al mazo del que se venía',
     "        ;[...contenido.querySelectorAll('[data-meta-arquetipo]')].find((b) => b.dataset.metaArquetipo === desde)?.focus()",
     ''),
    (R, '«Ver lista» del meta no recuerda de dónde se vino',
     '        focoAntesDeLista = ver\n',
     ''),
    (R, 'el puesto es el de las suizas aunque haya corte',
     '  return ordenFinal(computeStandings(montarSnapshot(rondas.length)), { rondas, partidas, campeon })',
     '  return computeStandings(montarSnapshot(rondas.length))'),
    (MT, 'el orden final ignora el corte',
     '  return [...tabla].sort((a, b) => (alcance.get(b.playerId) || 0) - (alcance.get(a.playerId) || 0))',
     '  return tabla'),
    (MT, 'los byes cuentan como victorias del mazo',
     "    const victorias = suma('wins') - suma('byesReceived')",
     "    const victorias = suma('wins')"),
    (MT, 'el menos jugado primero',
     '  fuera.sort((a, b) => b.cuantos - a.cuantos ||',
     '  fuera.sort((a, b) => a.cuantos - b.cuantos ||'),
    (MT, 'los jugadores de un mazo, en cualquier orden',
     '    g.jugadores.sort(conPuesto)',
     ''),
    (CT, 'la chapa repite el nombre del mazo',
     '.torneo-meta-mazo .torneo-arquetipo-nombre { display: none; }',
     ''),
    (CT, 'la cifra sin ancho fijo (las barras no se comparan)',
     '  min-width: 5ch;\n  text-align: right;',
     '  text-align: right;'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-413.mjs')
