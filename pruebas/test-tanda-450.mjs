// Tanda 450 — el buscador entiende números e ilustradores, y Buscar tiene
// sus filtros contra el servidor.
//
// EL FALLO QUE LO EMPIEZA TODO, dicho por PINGU: «si yo pongo el Mega
// Mewtwo X de Breakthrough, que es el número 64, y escribo "Mewtwo 64", ya
// no me hace la búsqueda». El buscador cruzaba cada palabra contra
// `name_search` —que son los dos nombres y nada más—, así que exigía que
// «64» estuviera EN EL NOMBRE. Cero resultados, sin ningún error.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { ENTRENADORES_ES, FASES_ES } from '/home/user/pingu/js/carta-traducciones.js'
import { FILTROS_CATALOGO, ORDENES_CATALOGO, filtrosCatalogoVacios, cuantosFiltrosCatalogo } from '/home/user/pingu/js/mi-coleccion/filtros.js'

let fallos = 0
const ok = (b, msg, extra = '') => {
  console.log(`  ${b ? 'ok  ' : 'FALLA'} ${msg}${extra ? `  ${extra}` : ''}`)
  if (!b) fallos++
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 1. Los enums de TCGdex, enteros ──')
{
  // PINGU: «te he dicho solo partidario, objeto, herramienta y estadio;
  // realmente hay muchos más — máquina técnica, máquina secreta de
  // Rocket». Son OCHO, y salen del `interfaces.d.ts` de TCGdex.
  //
  // Lo que pasa cuando falta uno: `traducir` devuelve el valor TAL CUAL,
  // así que una carta de Neo sale rotulada «Technical Machine» en una web
  // en español, y el chip del filtro también. No da error: se queda viejo.
  const DE_TCGDEX = ['Supporter', 'Item', 'Stadium', 'Tool', 'Ace Spec',
    'Technical Machine', 'Goldenrod Game Corner', "Rocket's Secret Machine"]
  for (const t of DE_TCGDEX) {
    ok(ENTRENADORES_ES[t] && ENTRENADORES_ES[t] !== t, `«${t}» está traducido`, ENTRENADORES_ES[t])
  }
  ok(Object.keys(ENTRENADORES_ES).length === DE_TCGDEX.length,
    'y no hay ninguno de más inventado', Object.keys(ENTRENADORES_ES).join(', '))

  // Las fases, por lo mismo. Y una que estaba MAL escrita: TCGdex dice
  // `RESTORED` y aquí ponía `Restored`. `traducir` busca la clave EXACTA,
  // así que esa carta enseñaba «RESTORED» en una web en español.
  for (const f of ['Basic', 'Stage1', 'Stage2', 'MEGA', 'VMAX', 'VSTAR',
    'V-UNION', 'BREAK', 'Baby', 'RESTORED', 'LEVEL-UP']) {
    ok(FASES_ES[f] !== undefined, `la fase «${f}» está`, FASES_ES[f])
  }
  ok(FASES_ES.Restored === undefined, 'y «Restored» con minúsculas ya no está, que nunca llegaba')
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 2. Cómo se parte lo que se escribe ──')
{
  // `js/mi-coleccion.js` NO se puede importar en Node: arrastra
  // `js/app.js`, que toca el DOM al cargarse. Se lee como TEXTO y se monta
  // la función con `new Function`, que es lo mismo que hace la prueba de
  // `IDIOMA_POR_MERCADO` y por el mismo motivo.
  const fuente = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  const cuerpo = fuente.match(/export function partirBusqueda\(texto\) \{([\s\S]*?)\n\}/)?.[1] || ''
  ok(cuerpo.includes('numeros'), 'se ha encontrado la función', cuerpo.slice(0, 40))
  const partir = new Function('texto', cuerpo)
  ok(JSON.stringify(partir('Mewtwo 64')) === JSON.stringify({ nombre: ['Mewtwo'], numero: '64', soloNumero: false }),
    '«Mewtwo 64» = nombre Mewtwo + número 64', JSON.stringify(partir('Mewtwo 64')))
  ok(partir('64').soloNumero === true, '«64» a secas es una búsqueda por número')
  ok(partir('Mewtwo').numero === null, 'y un nombre sin número no inventa ninguno')
  // Un número pegado al nombre NO es un número suelto: «Porygon2» es un
  // nombre, y partirlo dejaría a Porygon2 sin encontrar.
  ok(partir('Porygon2').numero === null, '«Porygon2» es un nombre, no un nombre y un número')
  // Esto se mete dentro de un `or=` de PostgREST. Una coma o un paréntesis
  // del usuario cambiarían la consulta, así que solo pasan dígitos.
  ok(partir('Mewtwo 6,4').numero === null, 'y lo que no son dígitos NO pasa por número', JSON.stringify(partir('Mewtwo 6,4')))
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 3. Los filtros del catálogo ──')
{
  ok(FILTROS_CATALOGO.map((g) => g.id).join(',') === 'category,types,trainer_type,rarity',
    'los cuatro grupos', FILTROS_CATALOGO.map((g) => g.id).join(','))
  ok(FILTROS_CATALOGO.find((g) => g.id === 'types').array === true,
    '`types` va marcado como ARRAY: se filtra con solape y no con igualdad')
  const f = filtrosCatalogoVacios()
  ok(cuantosFiltrosCatalogo(f) === 0, 'sin nada puesto, cero')
  f.rarity.add('Rare').add('Common')
  f.category.add('Pokemon')
  ok(cuantosFiltrosCatalogo(f) === 3, 'y cuenta los de todos los grupos', String(cuantosFiltrosCatalogo(f)))
  // Aquí no hay precio de compra ni «cuántas tienes»: la carta no es tuya.
  // Ofrecer un criterio que no puede ordenar nada es peor que no ofrecerlo.
  const ids = ORDENES_CATALOGO.map((o) => o.id)
  ok(!ids.includes('valor') && !ids.includes('cantidad') && !ids.includes('recientes'),
    'y el orden no ofrece lo que solo tiene sentido en TU colección', ids.join(','))
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 4. El buscador, en el navegador ──')
const navegador = await chromium.launch()
const abrir = async () => {
  const p = await navegador.newPage({ viewport: { width: 420, height: 900 } })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await p.route('**assets.tcgdex.net/**', (r) => r.abort())
  await p.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'xy8', name: 'Turbolímite', serie_id: 'xy', market: 'WEST', card_count_official: 162, release_date: '2016-02-03' }]
    window.__FAKE_CARTAS__ = [
      { id: 'xy8-64', market: 'WEST', set_id: 'xy8', local_id: '64', name: 'M Mewtwo EX', name_es: 'M-Mewtwo EX', image_path: 'x/64', rarity: 'Ultra Rare', category: 'Pokemon', types: ['Psychic'], dex_ids: [150], illustrator: '5ban Graphics', variants: { normal: true } },
      { id: 'xy8-61', market: 'WEST', set_id: 'xy8', local_id: '61', name: 'Mewtwo EX', name_es: 'Mewtwo EX', image_path: 'x/61', rarity: 'Ultra Rare', category: 'Pokemon', types: ['Psychic'], dex_ids: [150], illustrator: 'Mitsuhiro Arita', variants: { normal: true } },
      { id: 'xy8-25', market: 'WEST', set_id: 'xy8', local_id: '25', name: 'Pikachu', name_es: 'Pikachu', image_path: 'x/25', rarity: 'Common', category: 'Pokemon', types: ['Lightning'], dex_ids: [25], illustrator: 'Mitsuhiro Arita', variants: { normal: true } },
      { id: 'xy8-99', market: 'WEST', set_id: 'xy8', local_id: '99', name: 'Profesor Sauce', name_es: 'Profesor Sauce', image_path: 'x/99', rarity: 'Uncommon', category: 'Trainer', trainer_type: 'Supporter', illustrator: 'Kodama', variants: { normal: true } },
    ]
    window.__FAKE_COLECCION__ = []
  })
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2800)
  return { p, errores }
}
{
  const { p, errores } = await abrir()
  ok(errores.length === 0, 'sin errores', errores.join(' | '))
  const numeros = async () => (await p.locator('#mcBuscarResultados .mc-resultado-set').allTextContents())
    .map((t) => t.split('·').pop().trim()).join(',')
  const buscar = async (q) => { await p.fill('#mcBuscarTodo', q); await p.waitForTimeout(900) }

  // EL CASO DE PINGU, tal cual.
  await buscar('Mewtwo 64')
  ok((await numeros()) === '64', '«Mewtwo 64» encuentra la 64', await numeros())
  await buscar('Mewtwo')
  ok((await numeros()) === '64,61', '  …y «Mewtwo» a secas sigue trayendo las dos', await numeros())
  await buscar('64')
  ok((await numeros()) === '64', 'un número a secas también busca', await numeros())
  // Un número puede ser el impreso O el nacional de Pokédex, y vale
  // cualquiera: quedarse con uno dejaría media web sin encontrar a la
  // primera. El 25 es la carta 25 Y el Pokédex de Pikachu.
  await buscar('Pikachu 25')
  ok((await numeros()) === '25', '«Pikachu 25» vale por número impreso y por Pokédex', await numeros())
  await buscar('Mewtwo 150')
  ok((await numeros()) === '64,61', '  …y «Mewtwo 150» los encuentra por su número de Pokédex', await numeros())

  // Y si por nombre no hay nada, se prueba por ILUSTRADOR — y lo DICE,
  // porque si no parece que el buscador ha entendido otra cosa.
  await buscar('Mitsuhiro Arita')
  ok((await numeros()) === '61,25', 'un ilustrador encuentra sus cartas', await numeros())
  ok(/ilustrador/.test(await p.locator('#mcBuscarCuantas').textContent()),
    '  …y la cuenta dice que ha buscado por ahí', await p.locator('#mcBuscarCuantas').textContent())
  await p.close()
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 5. Los filtros y el orden de Buscar ──')
{
  const { p } = await abrir()
  await p.fill('#mcBuscarTodo', 'Mewtwo')
  await p.waitForTimeout(900)
  await p.click('#mcBuscarAbrirFiltros')
  await p.waitForTimeout(500)
  const grupos = await p.locator('#mcBuscarGrupos h3').allTextContents()
  ok(grupos.join(' | ') === 'Tipo de carta | Tipo de energía | Tipo de entrenador | Rareza',
    'los cuatro grupos, en pantalla', grupos.join(' | '))
  // Los chips salen del MAPA de traducción, no de una copia: añadir un
  // tipo de entrenador allí lo añade aquí.
  const chips = await p.locator('[data-cgrupo="trainer_type"]').allTextContents()
  ok(chips.length === Object.keys(ENTRENADORES_ES).length,
    'y los de entrenador son los del mapa, los ocho', `${chips.length}: ${chips.join(', ')}`)

  // EL FILTRO VA EN LA CONSULTA. Con «Mewtwo» salen dos Pokémon; al pedir
  // solo entrenadores no puede quedar ninguna.
  await p.click('[data-cgrupo="category"][data-cvalor="Trainer"]')
  await p.waitForTimeout(900)
  ok((await p.locator('#mcBuscarResultados .mc-resultado').count()) === 0,
    'filtrar por «entrenador» deja fuera a los Pokémon', String(await p.locator('#mcBuscarResultados .mc-resultado').count()))
  ok((await p.locator('#mcBuscarFiltrosCuenta').textContent()).trim() === '1', 'y la chapa dice que hay uno puesto')
  await p.click('#mcBuscarFiltrosLimpiar')
  await p.waitForTimeout(900)
  ok((await p.locator('#mcBuscarResultados .mc-resultado').count()) === 2, 'limpiar los quita')
  await p.click('#mcBuscarFiltrosCerrar')
  await p.waitForTimeout(300)

  // La bandeja de ordenar es la MISMA pieza que la de Cartas con otra
  // lista: aquí no hay precio de compra ni «cuántas tienes».
  await p.click('#mcBuscarAbrirOrden')
  await p.waitForTimeout(400)
  const criterios = await p.locator('#mcBuscarOrdenLista [data-borden]').evaluateAll((ns) => ns.map((n) => n.dataset.borden))
  ok(criterios.join(',') === ORDENES_CATALOGO.map((o) => o.id).join(','),
    'la bandeja enseña los criterios del catálogo', criterios.join(','))
  await p.click('[data-borden="ilustrador"]')
  await p.waitForTimeout(900)
  const orden = (await p.locator('#mcBuscarResultados .mc-resultado-set').allTextContents()).map((t) => t.split('·').pop().trim())
  ok(orden.join(',') === '64,61', 'y ordena por ilustrador (5ban antes que Mitsuhiro)', orden.join(','))
  ok((await p.locator('#mcBuscarOrdenRotulo').textContent()).trim() === 'Ilustrador', 'el botón lo dice')
  await p.close()
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 6. Toda sugerencia encuentra algo ──')
{
  // La misma guarda de la 447, y aquí vuelve a hacer falta: las
  // sugerencias han cambiado para estrenar el número y el ilustrador, y
  // una sugerencia que no devuelve nada es una pantalla vacía justo
  // después de tocar lo que la web te ofrece.
  const sugerencias = [...readFileSync('/home/user/pingu/mi-coleccion.html', 'utf8')
    .matchAll(/data-sugerencia="([^"]+)"/g)].map((m) => m[1])
  const p = await navegador.newPage({ viewport: { width: 420, height: 900 } })
  await p.route('**assets.tcgdex.net/**', (r) => r.abort())
  await p.addInitScript((lista) => {
    window.__FAKE_SETS__ = [{ id: 'xy8', name: 'Turbolímite', serie_id: 'xy', market: 'WEST', card_count_official: 162 }]
    // Una carta por sugerencia, construida para que ESA sugerencia la
    // encuentre: el nombre si son palabras, el número si lo lleva, y el
    // ilustrador si no es ninguna de las dos cosas.
    window.__FAKE_CARTAS__ = lista.map((texto, i) => {
      const numero = (texto.match(/\b(\d{1,4})\b/) || [])[1]
      const palabras = texto.replace(/\b\d{1,4}\b/g, '').trim()
      const pareceNombre = /^[A-ZÁÉÍÓÚ][a-záéíóú]/.test(palabras) && palabras.split(' ').length < 3
      return {
        id: `xy8-s${i}`, market: 'WEST', set_id: 'xy8', local_id: numero || String(500 + i),
        name: pareceNombre || !palabras ? palabras || 'Carta' : 'Otra',
        name_es: pareceNombre || !palabras ? palabras || 'Carta' : 'Otra',
        image_path: `x/s${i}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [1],
        illustrator: pareceNombre ? 'Nadie' : palabras, variants: { normal: true },
      }
    })
    window.__FAKE_COLECCION__ = []
  }, sugerencias)
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  for (const texto of sugerencias) {
    await p.click(`[data-sugerencia="${texto}"]`)
    await p.waitForTimeout(900)
    const n = await p.locator('#mcBuscarResultados .mc-resultado').count()
    ok(n > 0, `la sugerencia «${texto}» encuentra algo`, `${n} resultados`)
    await p.fill('#mcBuscarTodo', '')
    await p.waitForTimeout(400)
  }
  await p.close()
}

await navegador.close()
console.log(fallos ? `\n❌ ${fallos} FALLOS` : '\n✅ TODO BIEN')
process.exit(fallos ? 1 : 0)
