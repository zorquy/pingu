// Tanda 1257 — Buscar: ascendente y descendente cambian la lista (Sergio, por
// PINGU: «se queda trabado y no cambian»), y Vender lleva la foto de cada
// carta (PINGU: «para reconocerlo visualmente, igual que en comprar»).
//
// Buscando «Charizard», casi todas las cartas de una expansión se llaman
// igual: lo único que las separaba era el desempate (número), que iba siempre
// hacia arriba, y los grupos de expansión salían siempre de la más nueva a la
// más vieja (el orden se llamaba 'fecha' en el código y 'salida' en la lista).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const b = await chromium.launch()

console.log('── 1. Buscar «charizard»: el sentido cambia la lista ──')
{
  const p = await b.newPage({ viewport: { width: 420, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.route('**assets.tcgdex.net/**', (r) => r.abort())
  await p.addInitScript(() => {
    window.__FAKE_SETS__ = [
      { id: 'obf', name: 'Obsidian Flames', serie_id: 'sv', market: 'WEST', card_count_official: 197, release_date: '2023-08-11' },
      { id: 'base1', name: 'Base Set', serie_id: 'base', market: 'WEST', card_count_official: 102, release_date: '1999-01-09' },
    ]
    const carta = (set, n, nombre) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${set}/${n}`, rarity: 'Rare', category: 'Pokemon', types: ['Fire'], dex_ids: [6], illustrator: 'Arita', variants: { holo: true } })
    window.__FAKE_CARTAS__ = [carta('obf', 125, 'Charizard ex'), carta('obf', 215, 'Charizard ex'), carta('obf', 223, 'Charizard ex'), carta('base1', 4, 'Charizard')]
    window.__FAKE_COLECCION__ = []
  })
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const lista = async () => (await p.locator('#mcBuscarResultados .mc-resultado-set').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ')
  await p.fill('#mcBuscarTodo', 'charizard'); await p.waitForTimeout(1200)
  const sentido = async (s) => { await p.click('#mcBuscarAbrirOrden'); await p.waitForTimeout(300); await p.click(`[data-bsentido="${s}"]`); await p.waitForTimeout(900); await p.keyboard.press('Escape'); await p.waitForTimeout(200) }
  const criterio = async (c) => { await p.click('#mcBuscarAbrirOrden'); await p.waitForTimeout(300); await p.click(`[data-borden="${c}"]`); await p.waitForTimeout(900) }

  const nombreAsc = await lista()
  await sentido('desc')
  const nombreDesc = await lista()
  check('por nombre: descendente no es lo mismo que ascendente', nombreAsc !== nombreDesc, `${nombreAsc}  //  ${nombreDesc}`)
  check('  …y dentro de la expansión, los números al revés (223, 215, 125)', /223.*215.*125/.test(nombreDesc), nombreDesc)

  await criterio('coleccion')
  const colAsc = await lista()
  check('«Expansión y número» ascendente: de la más vieja a la más nueva, y por número', /Base Set · 4 \| Obsidian Flames · 125 \| Obsidian Flames · 215 \| Obsidian Flames · 223/.test(colAsc), colAsc)
  await sentido('desc')
  const colDesc = await lista()
  check('  …y descendente, al revés del todo', /Obsidian Flames · 223 \| Obsidian Flames · 215 \| Obsidian Flames · 125 \| Base Set · 4/.test(colDesc), colDesc)
  const grupos = await p.$$eval('.mc-bus-grupo-texto b', (bs) => bs.map((x) => x.textContent).join(','))
  check('  …con los grupos de expansión en el mismo orden', grupos === 'Obsidian Flames,Base Set', grupos)

  await criterio('salida')
  const salDesc = await lista()
  await sentido('asc')
  const salAsc = await lista()
  check('«Fecha de salida»: lo más nuevo primero, y ascendente lo más viejo', /^Obsidian/.test(salDesc) && /^Base Set/.test(salAsc), `${salDesc} // ${salAsc}`)
  check('sin errores', !errs.length, errs.join(' | '))
  await p.close()
}

console.log('── 2. Vender: con la foto ──')
{
  const ctx = await b.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2' }], tcg_products: [{ id: 501, name: 'ETB', image: '/assets/logo.png', lang: 'en', market: 'WEST' }] }
    window.__FAKE_CARTAS__ = [{ id: 'carta-1', set_id: 'set-0', local_id: '199', name: 'Charizard ex', image_path: 'x/y/199' }]
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = { tienda_stock_lista: { total: 2, filas: [
      { id: 's1', card_id: 'carta-1', market: 'WEST', nombre: 'Charizard ex', set_id: 'set-0', numero: '199', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 1, coste: 100, precio: 180, visible: true },
      { id: 's2', product_id: 501, market: 'WEST', nombre: 'ETB', idioma: 'en', estado: 'sellado', variante: 'normal', unidades: 2, coste: 40, precio: 60, visible: true },
    ] } }
  })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  // Todas las fotos, servidas aquí (la red del contenedor no llega a las de
  // fuera): si no, la cadena de respaldos se rinde y quita la imagen (la 441).
  await p.route((u) => /\.(webp|png|jpg)(\?|$)/.test(String(u)), (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#0b7285"/></svg>' }))
  await p.goto(`${BASE}/tienda.html?vender=1`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  await p.fill('#tdvBusca', 'char'); await p.waitForTimeout(1000)
  const fotos = await p.$$eval('.tdv-resultado', (bs) => bs.map((x) => { const f = x.querySelector('.tdc-foto'); const img = f?.querySelector('img'); const r = f?.getBoundingClientRect(); return { hay: !!img, ancho: Math.round(r?.width || 0), primero: x.firstElementChild === f } }))
  check('cada resultado lleva su foto a la izquierda (la carta y el producto)', fotos.length === 2 && fotos.every((f) => f.hay && f.ancho >= 30 && f.primero), JSON.stringify(fotos))
  await p.click('.tdv-resultado >> nth=0'); await p.waitForTimeout(400)
  check('  …y la línea de la venta también', (await p.locator('.tdm-linea .tdc-foto img').count()) === 1)
  check('  …sin salirse de ancho', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
