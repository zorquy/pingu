// Tanda 453 — los mismos filtros, dentro de un Pokémon.
//
// PINGU: «cuando entras a un Pokémon en la Pokédex no hay filtros; debería
// haber los mismos que en buscar, porque dentro de un Pokémon también
// puede haber distintas rarezas y tipos».
//
// Son los mismos cuatro grupos, pero las OPCIONES salen de otro sitio, y
// eso es lo que esta prueba defiende. En Buscar salen de los mapas de
// traducción porque no hay nada de donde sacarlas; aquí las cartas de la
// especie están TODAS en memoria, así que salen de ellas — y eso evita
// ofrecer «Estadio» dentro de un Pikachu, que sería un filtro que deja la
// pantalla en blanco siempre.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { valoresDeCartas, pasaFiltrosDeCarta, filtrosCatalogoVacios, FILTROS_CATALOGO } from '/home/user/pingu/js/mi-coleccion/filtros.js'

let fallos = 0
const ok = (b, msg, extra = '') => {
  console.log(`  ${b ? 'ok  ' : 'FALLA'} ${msg}${extra ? `  ${extra}` : ''}`)
  if (!b) fallos++
}
const BASE = 'http://localhost:8892'

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 1. De dónde salen las opciones, en Node ──')
{
  const A = {
    categoriaEs: (v) => ({ Pokemon: 'Pokémon', Trainer: 'Entrenador' })[v] || v,
    tipoEs: (v) => ({ Lightning: 'Rayo', Fire: 'Fuego' })[v] || v,
    rarezaEs: (v) => ({ Common: 'Común', Rare: 'Rara' })[v] || v,
    entrenadorEs: (v) => v,
  }
  const CARTAS = [
    { id: 'a', category: 'Pokemon', types: ['Lightning'], rarity: 'Common' },
    { id: 'b', category: 'Pokemon', types: ['Lightning'], rarity: 'Rare' },
    { id: 'c', category: 'Pokemon', types: ['Fire'], rarity: 'Rare' },
    // Sin rareza: `cartas-detalle` todavía no ha llegado a esta.
    { id: 'd', category: 'Pokemon', types: null, rarity: null },
  ]
  const grupos = valoresDeCartas(CARTAS, A)
  ok(grupos.map((g) => g.id).join(',') === 'types,rarity',
    'solo los grupos con DOS valores o más', grupos.map((g) => g.id).join(','))
  // `category` tiene un solo valor en estas cuatro: un filtro con una
  // opción no filtra nada, y dentro de un Pokémon eso pasa casi siempre.
  ok(!grupos.some((g) => g.id === 'category'), '  …y «Tipo de carta» no se pinta, que aquí siempre es uno')
  ok(!grupos.some((g) => g.id === 'trainer_type'), '  …ni «Tipo de entrenador», que no existe en un Pokémon')
  const rarezas = grupos.find((g) => g.id === 'rarity').valores
  ok(JSON.stringify(rarezas.map((v) => v.rotulo)) === JSON.stringify(['Común', 'Rara']),
    'cada opción es un RÓTULO', JSON.stringify(rarezas))
  const sinCurar = grupos.find((g) => g.id === 'types').valores.map((v) => v.rotulo)
  ok(!sinCurar.includes(null) && !sinCurar.includes(''),
    'y una carta sin curar no inventa un cajón «sin tipo»', JSON.stringify(sinCurar))

  // SE AGRUPA POR EL RÓTULO Y NO POR EL VALOR CRUDO (tanda 455). TCGdex
  // TRADUCE LOS ENUMS: la misma rareza está guardada como `Common` o como
  // `Común` según en qué idioma se importara esa fila, y el catálogo se ha
  // importado en varios. Agrupando por el crudo salían DOS chips que
  // dicen lo mismo —PINGU mandó la captura: «Común · Común · Ninguno ·
  // None»— y, peor, pulsar uno dejaba fuera la mitad de las cartas.
  const MEZCLA = [
    { id: 'x', rarity: 'Common' },
    { id: 'y', rarity: 'Común' },
    { id: 'z', rarity: 'Rare' },
  ]
  const mezclados = valoresDeCartas(MEZCLA, A).find((g) => g.id === 'rarity')
  ok(mezclados.valores.length === 2, 'las dos formas de la misma rareza son UN chip',
    JSON.stringify(mezclados.valores))
  ok(mezclados.valores.find((v) => v.rotulo === 'Común').crudos.sort().join('|') === 'Common|Común',
    '  …que se queda con las dos formas crudas que ha visto')

  const f = filtrosCatalogoVacios()
  f.rarity.add('Rara')
  ok(CARTAS.filter((c) => pasaFiltrosDeCarta(c, f, A)).map((c) => c.id).join(',') === 'b,c', 'filtrar por rareza deja las suyas')
  f.types.add('Fuego')
  ok(CARTAS.filter((c) => pasaFiltrosDeCarta(c, f, A)).map((c) => c.id).join(',') === 'c', 'y entre grupos RESTAN')
  ok(CARTAS.filter((c) => pasaFiltrosDeCarta(c, filtrosCatalogoVacios(), A)).length === 4, 'sin filtros pasa todo')
  // Y un chip encuentra las dos formas: es la mitad que faltaba.
  const g2 = filtrosCatalogoVacios()
  g2.rarity.add('Común')
  ok(MEZCLA.filter((c) => pasaFiltrosDeCarta(c, g2, A)).map((c) => c.id).join(',') === 'x,y',
    'y pulsar «Común» encuentra también las guardadas como `Common`')
  ok(FILTROS_CATALOGO.length === 4, 'y son los MISMOS cuatro grupos que en Buscar', String(FILTROS_CATALOGO.length))
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 2. En la pantalla ──')
const navegador = await chromium.launch()
{
  const p = await navegador.newPage({ viewport: { width: 390, height: 844 } })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await p.route('**assets.tcgdex.net/**', (r) => r.abort())
  await p.route('**limitlesstcg**', (r) => r.abort())
  await p.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas', serie_id: 'sv', market: 'WEST', card_count_official: 20, release_date: '2024-11-08' }]
    const def = [['1', 'Common', 'Lightning'], ['2', 'Rare', 'Lightning'], ['3', 'Ultra Rare', 'Lightning'],
      ['4', 'Common', 'Fire'], ['5', 'Rare', 'Fire'], ['6', 'Hyper rare', 'Lightning']]
    window.__FAKE_CARTAS__ = def.map(([n, r, t]) => ({
      id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: n, name: `Pikachu ${n}`, name_es: `Pikachu ${n}`,
      image_path: `x/${n}`, rarity: r, category: 'Pokemon', types: [t], dex_ids: [25], variants: { normal: true },
    }))
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-01T00:00:00Z' }]
  })
  await p.goto(`${BASE}/mi-coleccion.html?ver=pokedex`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2800)
  await p.locator('[data-dex="25"]').first().click()
  await p.waitForTimeout(1400)
  ok(errores.length === 0, 'sin errores', errores.join(' | '))

  ok((await p.locator('.pdx-carta').count()) === 6, 'salen las seis cartas', String(await p.locator('.pdx-carta').count()))

  // LA MISMA BARRA QUE BUSCAR (tanda 455). La primera versión puso los
  // chips sueltos en la pantalla, apostando a que casi siempre quedaría un
  // grupo; en un Bulbasaur con 31 cartas quedaron TRES con siete rarezas,
  // o sea 300 px de chips antes de ver una carta. Lo que se mide ahora es
  // justo eso: que las cartas empiecen ARRIBA.
  //
  // Y se mide contra LA CABECERA de la especie, no contra la ventana: el
  // `top` de la ventana depende de cuánto se haya desplazado la página, y
  // la primera versión de esta comprobación daba «-192px» —un número que
  // pasaba el listón sin significar nada—. Lo que importa es cuánto hay
  // ENTRE el nombre del Pokémon y su primera carta.
  const hueco = await p.evaluate(() => {
    const cab = document.querySelector('.pdx-cabecera').getBoundingClientRect()
    const rejilla = document.querySelector('.pdx-cartas').getBoundingClientRect()
    return Math.round(rejilla.top - cab.bottom)
  })
  ok(hueco < 120, 'entre el nombre y la primera carta cabe la barra y poco más', `${hueco}px`)
  ok(await p.locator('#pdxAbrirFiltros').isVisible(), 'y los filtros son un botón, como en Buscar')

  await p.locator('#pdxAbrirFiltros').click()
  await p.waitForTimeout(500)
  const grupos = await p.locator('#mcPdxGrupos h3').allTextContents()
  ok(grupos.join(' | ') === 'Tipo de energía | Rareza', 'con los grupos que esta especie tiene', grupos.join(' | '))
  await p.locator('[data-egrupo="rarity"][data-evalor="Común"]').click()
  await p.waitForTimeout(600)
  ok((await p.locator('.pdx-carta').count()) === 2, 'un chip filtra', String(await p.locator('.pdx-carta').count()))
  // Con un filtro puesto la rejilla se acorta, y si nada lo dijera
  // parecería que han desaparecido cartas (la lección de la 441).
  ok(/2 de 6 con los filtros/.test(await p.locator('.pdx-cabecera .subtext').textContent()),
    '  …y la cabecera dice de cuántas', await p.locator('.pdx-cabecera .subtext').textContent())
  await p.locator('[data-egrupo="types"][data-evalor="Fuego"]').click()
  await p.waitForTimeout(600)
  ok((await p.locator('.pdx-carta').count()) === 1, 'y entre grupos restan también aquí')

  // LOS FILTROS NO SE ARRASTRAN A OTRA ESPECIE. Las rarezas de un Pikachu
  // no son las de un Charizard: un filtro heredado dejaría la pantalla
  // vacía sin que nada dijera por qué.
  await p.locator('#mcPdxFiltrosVer').click()
  await p.waitForTimeout(400)
  await p.locator('#pdxVolver').click()
  await p.waitForTimeout(900)
  await p.locator('[data-dex="25"]').first().click()
  await p.waitForTimeout(1400)
  ok((await p.locator('.pdx-carta').count()) === 6, 'al volver a entrar, los filtros están limpios',
    String(await p.locator('.pdx-carta').count()))
  // ACOTADO a `.pdx-filtros`, y me pilló escribiéndola: `.mc-chip-filtro`
  // la usan también las pestañas del diálogo de adornos, que nacen con una
  // encendida. Sin acotar, esta comprobación habla de otra pantalla. Es la
  // misma trampa de las tarjetas de colección (447) y de las dos bandejas
  // (452), tres tandas seguidas.
  ok((await p.locator('#mcPdxGrupos .chip-filtro.activa').count()) === 0, '  …y ningún chip encendido')
  await p.close()
}

await navegador.close()
console.log(fallos ? `\n❌ ${fallos} FALLOS` : '\n✅ TODO BIEN')
process.exit(fallos ? 1 : 0)
