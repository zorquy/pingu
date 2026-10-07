// Tanda 381 — la Pokédex de «Mi colección».
//
// PINGU, sobre la app de TCGdex: «me gustaría hacer algo como lo que
// tienen ellos incrustado en Pokédex». Es lo que convierte un listado de
// cartas en una colección: **la gente no colecciona sets, colecciona
// Pokémon.**
//
// Lo que esta prueba mira y no supone:
//   · Que la especie sale del NOMBRE y sin pedirle nada a nadie — y que
//     los casos raros (Ho-Oh, Porygon-Z, las TAG TEAM, las Mega) caen
//     donde tienen que caer.
//   · Que lo TUYO se cuenta sin una sola consulta.
//   · Que una carta que tienes sale en su especie aunque el catálogo
//     todavía no se haya repasado.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('\n── 1. De qué Pokémon habla una carta ──')
{
  const { especiesDeCarta, especiePorDex, limpiarNombreDeCarta } =
    await import('/home/user/pingu/js/pokedex-especies.js')
  const nombres = (n) => especiesDeCarta(n).map(especiePorDex).join(' + ')

  check('lo normal', nombres('Pikachu ex') === 'Pikachu' && nombres('Surfing Pikachu') === 'Pikachu')
  // Una Mega y una forma regional son la MISMA entrada de la Pokédex:
  // quien colecciona Gardevoir quiere ver ahí su Mega.
  check('una Mega cae en su especie', nombres('Mega Gardevoir ex') === 'Gardevoir', nombres('Mega Gardevoir ex'))
  check('  …y una forma regional también', nombres('Hisuian Voltorb') === 'Voltorb', nombres('Hisuian Voltorb'))
  check('  …y una forma con máscara', nombres('Teal Mask Ogerpon ex') === 'Ogerpon', nombres('Teal Mask Ogerpon ex'))

  // Las TAG TEAM salen en las DOS. `dexesDeNombre` sola daba solo la
  // primera: «Zekrom-GX» no casa porque `aplastar` se come el guion y
  // «zekromgx» no es ninguna especie.
  check('una TAG TEAM sale en las dos especies',
    nombres('Pikachu & Zekrom-GX') === 'Pikachu + Zekrom', nombres('Pikachu & Zekrom-GX'))
  check('  …y otra', nombres('Mewtwo & Mew-GX') === 'Mewtwo + Mew', nombres('Mewtwo & Mew-GX'))

  // Y LO QUE NO SE PUEDE ROMPER AL ARREGLAR ESO: hay dos especies que se
  // llaman con guion. Partir por el guion sin más las destroza —
  // Porygon-Z (474) se convertiría en Porygon (137), que es otro
  // Pokémon—. Por eso se prueba SIEMPRE la palabra entera primero.
  check('Ho-Oh no se parte', nombres('Ho-Oh') === 'Ho-Oh' && nombres('Ho-Oh EX') === 'Ho-Oh')
  check('  …ni Porygon-Z, que NO es Porygon',
    nombres('Porygon-Z ex') === 'Porygon-Z', nombres('Porygon-Z ex'))
  check('  …y la palabra entera manda sobre el trozo',
    limpiarNombreDeCarta('Porygon-Z ex') === 'Porygon-Z ex', limpiarNombreDeCarta('Porygon-Z ex'))

  // Un Entrenador o una Energía no tienen especie, y eso NO es un fallo:
  // es la respuesta. El array vacío es lo que hace que la cola de
  // relleno se vacíe (ver la parte 3).
  for (const n of ["Boss's Orders", 'Rare Candy', 'Ultra Ball', 'Basic Fire Energy', 'Professor’s Research']) {
    check(`«${n}» no tiene especie`, especiesDeCarta(n).length === 0, JSON.stringify(especiesDeCarta(n)))
  }
  check('sin nombre tampoco se inventa', especiesDeCarta(null).length === 0 && especiesDeCarta('').length === 0)

  // No se ha tocado `dexesDeNombre`: de ella cuelga cómo se agrupan los
  // mazos en /mis-partidas y en el meta, y cambiarla movería esas
  // firmas sin que nada diera error.
  const arq = leer('js/torneos/arquetipos.js')
  check('el agrupador de mazos no se ha tocado', /export function dexesDeNombre/.test(arq) &&
    !/limpiarNombreDeCarta/.test(arq))
}

console.log('\n── 2. Lo tuyo se cuenta sin consultar nada ──')
{
  const { loMioPorEspecie, filasDePokedex } = await import('/home/user/pingu/js/mi-coleccion/pokedex.js')
  const cartas = new Map([
    ['a', { id: 'a', name: 'Pikachu ex' }],
    ['b', { id: 'b', name: 'Pikachu' }],
    ['c', { id: 'c', name: 'Pikachu & Zekrom-GX' }],
    ['d', { id: 'd', name: "Boss's Orders" }],
  ])
  // DOS líneas de la misma carta (dos idiomas): una Pokédex se llena por
  // Pokémon, no por copias.
  const lineas = [{ card_id: 'a' }, { card_id: 'a' }, { card_id: 'b' }, { card_id: 'c' }, { card_id: 'd' }]
  const mio = loMioPorEspecie(lineas, cartas)
  check('cuenta cartas DISTINTAS, no copias', mio.get(25) === 3, String(mio.get(25)))
  check('  …y la TAG TEAM cuenta también en Zekrom', mio.get(644) === 1, String(mio.get(644)))
  check('  …y un Entrenador no cuenta en ninguna', [...mio.keys()].length === 2, [...mio.keys()].join(','))

  // `null` es «no se sabe cuántas hay» y `0` es «hay cero». Son cosas
  // distintas y la pantalla dice cuál es (la lección de la 319).
  const filas = filasDePokedex({ mio, totales: new Map([[25, 300]]) })
  const pika = filas.find((f) => f.dex === 25)
  const zek = filas.find((f) => f.dex === 644)
  check('con total conocido se dice «3 de 300»', pika.total === 300)
  check('  …y sin él, null y no cero', zek.total === null, String(zek.total))
  check('salen los 1.025', filas.length === 1025, String(filas.length))
  check('  …y «solo los que tengo» deja 2',
    filasDePokedex({ mio, totales: new Map(), soloMios: true }).length === 2)
  check('  …y el buscador filtra por nombre y por número',
    filasDePokedex({ mio, totales: new Map(), texto: 'pikachu' }).length === 1 &&
      filasDePokedex({ mio, totales: new Map(), texto: '25' }).length === 1)
}

console.log('\n── 3. El relleno del catálogo ──')
{
  const { procesar } = await import('/home/user/pingu/netlify/functions/cartas-pokedex.mjs')
  const catalogo = [
    { id: 'a1', name: 'Pikachu ex' }, { id: 'a2', name: "Boss's Orders" },
    { id: 'a3', name: 'Pikachu & Zekrom-GX' }, { id: 'a4', name: 'Ho-Oh EX' },
  ]
  const escrito = []
  let vuelta = 0
  const falso = async (ruta, o) => {
    if (!o) return ++vuelta === 1 ? catalogo : []
    // Desde la tanda 391 el lote se manda a `rpc/pokedex_marcar` dentro
    // de `p_filas`, y ya no como un array suelto en un upsert — aquel
    // reventaba contra los NOT NULL de la tabla.
    const cuerpo = JSON.parse(o.body)
    escrito.push(...(Array.isArray(cuerpo) ? cuerpo : cuerpo.p_filas))
    return null
  }
  const rutas = []
  const falsoConRutas = async (ruta, o) => {
    rutas.push(ruta)
    return falso(ruta, o)
  }
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'x' }, fetchImpl: falsoConRutas })
  // Y por la FUNCIÓN, no por un upsert: un upsert parcial revienta
  // contra los NOT NULL de `tcg_cards` y dejó la Pokédex vacía desde
  // esta misma tanda hasta la 391.
  check('escribe por rpc/pokedex_marcar', rutas.some((x) => String(x).includes('rpc/pokedex_marcar')),
    rutas.join(' | '))
  check('  …y no por un upsert', !rutas.some((x) => String(x).includes('on_conflict')), rutas.join(' | '))
  check('mira lo que falta y lo escribe', r.ok && r.miradas === 4, JSON.stringify(r))
  check('  …con las especies bien', JSON.stringify(escrito.map((f) => f.dex_ids)) === '[[25],[],[25,644],[250]]',
    JSON.stringify(escrito.map((f) => f.dex_ids)))

  // EL CENTINELA, que es lo que hace que la cola se vacíe: un Entrenador
  // se queda en `{}` y no en null. Sin esa diferencia los ~5.000
  // Entrenadores volverían en cada pasada PARA SIEMPRE — es la lección
  // de la 333 y de la 380, por tercera vez.
  check('  …y NINGUNA se queda a null', escrito.every((f) => Array.isArray(f.dex_ids)),
    JSON.stringify(escrito.filter((f) => !Array.isArray(f.dex_ids))))

  // Y no sale a internet: la especie está en el nombre que ya tenemos.
  // Pedírsela a TCGdex serían ~21.000 peticiones y dos días.
  const fn = leer('netlify/functions/cartas-pokedex.mjs')
  check('no le pide nada a TCGdex', !/tcgdex/i.test(fn.replace(/\/\/[^\n]*/g, '')),
    (fn.replace(/\/\/[^\n]*/g, '').match(/[^\n]*tcgdex[^\n]*/i) || [])[0])
}

console.log('\n── 4. En la pantalla ──')
const browser = await chromium.launch()
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#e9ce6a"/></svg>'
const SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" width="68" height="56"><circle cx="34" cy="28" r="20" fill="#7ac"/></svg>'

async function abrir(opciones = {}) {
  const page = await browser.newPage({ viewport: opciones.viewport || { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 220)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.route('**/r2.limitlesstcg.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: SPRITE }))
  await page.addInitScript((conDex) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', serie_name: 'SV', release_date: '2023-03-31' }]
    const carta = (n, nombre, dex) => ({
      id: `sv1-${n}`, set_id: 'sv1', local_id: String(n), name: nombre, name_es: nombre,
      image_path: `x/${n}`, market: 'WEST', dex_ids: conDex ? dex : null,
    })
    window.__FAKE_CARTAS__ = [
      carta(1, 'Pikachu ex', [25]), carta(2, 'Pikachu', [25]),
      carta(3, 'Pikachu & Zekrom-GX', [25, 644]), carta(4, 'Charizard ex', [6]),
      carta(5, "Boss's Orders", []),
    ]
    const l = (id, card) => ({
      id, user_id: 'admin-1', card_id: card, market: 'WEST', idioma: 'es', estado: 'NM',
      variante: 'normal', cantidad: 1, cambio: 0, gradeo: null, valor_manual: null,
      precio_compra: null, notas: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    window.__FAKE_COLECCION__ = [l('c1', 'sv1-1'), l('c2', 'sv1-4')]
  }, opciones.conDex !== false)
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  return { page, errores }
}

{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('salen los 1.025 Pokémon', (await page.locator('.pdx-especie').count()) === 1025,
    String(await page.locator('.pdx-especie').count()))
  check('  …y arriba se cuentan las especies, no las cartas',
    /2 de 1\.025 Pokémon/.test(limpio(await page.locator('#mcPdxCuenta').textContent())),
    limpio(await page.locator('#mcPdxCuenta').textContent()))
  const pika = page.locator('.pdx-especie[data-dex="25"]')
  check('Pikachu dice cuántas tienes de cuántas hay', /1 de 3/.test(limpio(await pika.textContent())),
    limpio(await pika.textContent()))
  check('  …y va marcado como que lo tienes', await pika.evaluate((e) => e.classList.contains('tengo')))
  check('  …y uno que no tienes, no', !(await page.locator('.pdx-especie[data-dex="1"]').evaluate((e) => e.classList.contains('tengo'))))

  await pika.click()
  await page.waitForTimeout(1200)
  check('al abrirlo salen sus cartas', (await page.locator('.pdx-carta').count()) === 3,
    String(await page.locator('.pdx-carta').count()))
  check('  …con la tuya marcada', (await page.locator('.pdx-carta.tengo').count()) === 1)
  check('  …y la cabecera lo dice', /tienes 1 de 3/.test(limpio(await page.locator('.pdx-cabecera').textContent())),
    limpio(await page.locator('.pdx-cabecera').textContent()))

  // La proporción de una carta es 1,40. El `<img>` lleva `height="342"`
  // para reservar su hueco, y ese atributo se aplica como CSS: si no se
  // pone `height: auto`, la altura queda DEFINIDA y `aspect-ratio` no
  // actúa — salían tiras de 144×342. Se MIDE.
  const medida = await page.locator('.pdx-carta img').first().evaluate((e) => {
    const r = e.getBoundingClientRect()
    return Math.round((r.height / r.width) * 100) / 100
  })
  check('  …y las cartas tienen forma de carta', Math.abs(medida - 1.4) < 0.05, `${medida} (debe ser ~1.40)`)

  await page.locator('#pdxVolver').click()
  await page.waitForTimeout(600)
  check('y se vuelve a la rejilla', (await page.locator('.pdx-especie').count()) === 1025)
  await page.close()
}

console.log('\n── 5. Sin el catálogo repasado, lo tuyo sigue saliendo ──')
{
  // Mientras `dex_ids` se rellena, la consulta por especie no devuelve
  // nada. Lo que tienes NO puede desaparecer por eso: se saca del
  // nombre, que ya está en memoria.
  const { page, errores } = await abrir({ conDex: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const pika = page.locator('.pdx-especie[data-dex="25"]')
  check('Pikachu sigue marcado', await pika.evaluate((e) => e.classList.contains('tengo')))
  check('  …y dice lo tuyo sin inventarse un total', /1 carta/.test(limpio(await pika.textContent())),
    limpio(await pika.textContent()))
  await pika.click()
  await page.waitForTimeout(1200)
  check('al abrirlo sale tu carta igual', (await page.locator('.pdx-carta').count()) === 1,
    String(await page.locator('.pdx-carta').count()))
  await page.close()
}

console.log('\n── 6. En el móvil ──')
{
  const { page } = await abrir({ viewport: { width: 390, height: 1000 } })
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  check('nada se sale de la pantalla', ancho.doc <= ancho.ventana + 1, JSON.stringify(ancho))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
