// Tanda 689 — «Mi colección en una imagen», con cinco dibujos y un
// carrusel. PINGU: «me gustan todas; en vez de elegir una, dejar la que
// está y añadir estas cuatro, y con un slide vayas pasando entre la que
// quieres compartir. Y la vitrina, nueve en vez de catorce».
//
// Lo que se mira: que el diálogo abre en el resumen de siempre, que hay
// cinco puntos y un rótulo, que las flechas, los puntos, las teclas y el
// arrastre pasan de una a otra, que CADA dibujo se exporta (un canvas
// sucio por una foto sin permiso reventaría `toBlob`), que compartir
// coge la que se ve, y que los datos nuevos (el mes, la Pokédex) salen
// de la colección de verdad. Los cinco PNG se guardan en la carpeta de
// capturas para mirarlos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPTURAS = process.env.PD_CAPTURAS || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/maquetas'
const CARTA = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" rx="12" fill="${color}"/><circle cx="122" cy="150" r="70" fill="rgba(255,255,255,.5)"/></svg>`
const COLORES = ['#f7d354', '#4aa8ff', '#ff7a3d', '#6fd36f', '#d77dff', '#c9c9c9', '#ff9ad5', '#b8c4cc', '#7a6cff', '#dddddd']

const SETS = [
  { id: 'sv8', name: 'Surging Sparks', serie_id: 'sv', market: 'WEST', card_count_official: 6, card_count_total: 6, logo_path: 'x/l', release_date: '2024-11-08', tcg_online_code: 'SSP' },
  { id: 'base1', name: 'Base Set', serie_id: 'base', market: 'WEST', card_count_official: 102, card_count_total: 102, logo_path: 'x/b', release_date: '1999-01-09', tcg_online_code: 'BS' },
]
const ESPECIES = [[25, 'Pikachu', 'Lightning'], [6, 'Charizard', 'Fire'], [150, 'Mewtwo', 'Psychic'], [25, 'Pikachu ex', 'Lightning'], [448, 'Lucario', 'Fighting'], [1008, 'Miraidon', 'Lightning']]
const CARTAS = ESPECIES.map(([dex, nombre, tipo], i) => ({
  id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: nombre, name_es: nombre, image_path: `sv/sv8/${i + 1}`,
  rarity: 'Rare', category: 'Pokemon', dex_ids: [dex], types: [tipo], variants: { normal: true },
})).concat([
  { id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: 'base/base1/4', rarity: 'Rare Holo', category: 'Pokemon', dex_ids: [6], types: ['Fire'], variants: { holo: true } },
  { id: 'base1-91', market: 'WEST', set_id: 'base1', local_id: '91', name: 'Bill', name_es: 'Bill', image_path: 'base/base1/91', rarity: 'Common', category: 'Trainer', variants: { normal: true } },
])
const HOY = new Date()
const hace = (dias) => new Date(HOY.getTime() - dias * 86_400_000).toISOString()
const COL = [
  { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 50, created_at: hace(80) },
  { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 20, created_at: hace(40) },
  { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 5, created_at: hace(3) },
  { id: 'l4', card_id: 'sv8-4', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 12, created_at: hace(2) },
  { id: 'l5', card_id: 'sv8-5', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 8, created_at: hace(1) },
  { id: 'l6', card_id: 'base1-4', market: 'WEST', cantidad: 1, idioma: 'en', estado: 'EX', variante: 'holo', valor_manual: 400, created_at: hace(5) },
  { id: 'l7', card_id: 'base1-91', market: 'WEST', cantidad: 3, idioma: 'en', estado: 'NM', variante: 'normal', valor_manual: 1, created_at: hace(5) },
  { id: 'l8', card_id: 'sv8-6', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 3, created_at: hace(60) },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
let n = 0
await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: CARTA(COLORES[n++ % COLORES.length]) }))
await page.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => r.abort())
await page.route('**/r2.limitlesstcg.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="40" fill="#333"/></svg>' }))
await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort())
await page.route('**/raw.githubusercontent.com/**', (r) => r.abort())
await page.route('**/images.pokemontcg.io/**', (r) => r.abort())
await page.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
await page.addInitScript(([sets, cartas, col]) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = sets
  window.__FAKE_CARTAS__ = cartas
  window.__FAKE_COLECCION__ = col
  navigator.canShare = () => true
  navigator.share = async (d) => { window.__compartido = { texto: d.text, ficheros: (d.files || []).map((f) => ({ nombre: f.name, tipo: f.type, bytes: f.size })) }; return true }
}, [SETS, CARTAS, COL])
await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3200)

const variante = () => page.evaluate(() => window.__mcImagenVariante || null)
const rotulo = () => page.locator('#mcImagenRotulo').textContent()
const exporta = () => page.evaluate(() => {
  try {
    const c = document.getElementById('mcImagenLienzo')
    return c.width === 1080 && c.height === 1350 && c.toDataURL('image/png').length > 1000
  } catch (e) {
    return String(e)
  }
})
const guardar = async (nombre) => {
  const url = await page.evaluate(() => document.getElementById('mcImagenLienzo').toDataURL('image/png'))
  mkdirSync(CAPTURAS, { recursive: true })
  writeFileSync(`${CAPTURAS}/689-${nombre}.png`, Buffer.from(url.split(',')[1], 'base64'))
}

console.log('── 1. Abre en el equipo, con cuatro puntos ──')
{
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('#mcImagenCrear').click()
  await page.waitForTimeout(2500)
  check('se abre el diálogo', await page.evaluate(() => document.getElementById('mcImagenDialogo').open))
  check('la primera es el equipo de 6 (691: sin un euro)', (await variante()) === 'equipo' && /Mi equipo de 6 · 1 de 4/.test(await rotulo()), await rotulo())
  check('cuatro puntos, el primero marcado', (await page.locator('#mcImagenPuntos .mc-imagen-punto').count()) === 4 && (await page.locator('#mcImagenPuntos .mc-imagen-punto[aria-current="true"]').getAttribute('data-indice')) === '0')
  check('  …y se exporta', (await exporta()) === true)
  await guardar('1-equipo')
}

console.log('── 2. Los datos nuevos salen de la colección ──')
{
  const d = await page.evaluate(() => window.__mcImagenDatos || null)
  check('el equipo: Charizard y Pikachu con dos cartas (empate, gana el número más bajo), el líder con sus cartas y su sprite con respaldos', d?.equipo?.length === 5 && d.equipo[0].nombre === 'Charizard' && d.equipo[0].cartas === 2 && d.equipo[0].expansiones === 2 && d.equipo[0].desde === 1999 && d.equipo[0].ejemplos.length === 2 && d.equipo[0].sprites.length >= 2 && d.equipo[1].nombre === 'Pikachu', JSON.stringify(d?.equipo?.map((m) => [m.nombre, m.cartas, m.sprites?.length])))
  check('el viaje: de Base Set 1999 a Surging Sparks 2024, 25 años, dos épocas con Surging Sparks como la mía', d?.viaje?.antigua?.anio === 1999 && d.viaje.antigua.expansion === 'Base Set' && d.viaje.nueva.anio === 2024 && d.viaje.anios === 25 && d.viaje.epocas.map((e) => `${e.nombre}:${e.cuenta}`).join() === 'Base:2,SV:6' && d.viaje.miEpoca === 'SV', JSON.stringify(d?.viaje && { ...d.viaje, antigua: d.viaje.antigua.nombre, nueva: d.viaje.nueva.nombre }))
  check('el perfil: Completista (Surging Sparks al 100 %), con brillo, región, tipo y fetiche', d?.perfil?.perfil?.id === 'completista' && d.perfil.perfil.nombre === 'Completista' && d.alCien === 1 && d.perfil.region?.nombre === 'Kanto' && d.perfil.tipo?.nombre === 'Rayo' && d.perfil.fetiche?.nombre === 'Charizard' && d.perfil.pokemon === 7 && d.perfil.entrenadores === 1, JSON.stringify(d?.perfil))
  check('el mes: 5 cartas nuevas en 30 días, las tres últimas y Base Set como expansión nueva', d?.mes?.nuevas === 5 && d.mes.ultimas.length === 3 && d.mes.ultimas[0].nombre === 'Lucario' && d.mes.expansionesNuevas.join() === 'Base Set', JSON.stringify(d?.mes))
  check('la Pokédex: 5 especies, el Rayo el tipo que más, Kanto 5 y Paldea 1', d?.pokedex?.especies === 5 && d.pokedex.tipos[0].nombre === 'Rayo' && d.pokedex.tipos[0].cuenta === 3 && d.pokedex.regiones[0].cuenta === 5 && d.pokedex.regiones[8].cuenta === 1, JSON.stringify(d?.pokedex))
  check('  …la más antigua es la de Base Set (1999) y el favorito Charizard ×2 en dos expansiones (empata con Pikachu y gana el número más bajo)', d?.pokedex?.masAntigua?.anio === 1999 && d.pokedex.masAntigua.expansion === 'Base Set' && d.pokedex.favorito?.nombre === 'Charizard' && d.pokedex.favorito.veces === 2 && d.pokedex.favorito.expansiones === 2, JSON.stringify([d?.pokedex?.masAntigua, d?.pokedex?.favorito]))
}

console.log('── 3. Se pasa de una a otra: flechas, puntos, teclas, dedo ──')
{
  await page.locator('#mcImagenSiguiente').click()
  await page.waitForTimeout(1800)
  check('la flecha pasa al perfil', (await variante()) === 'perfil' && /Qué coleccionista soy · 2 de 4/.test(await rotulo()), await rotulo())
  check('  …y se exporta', (await exporta()) === true)
  await guardar('2-perfil')
  await page.locator('#mcImagenPuntos .mc-imagen-punto[data-indice="2"]').click()
  await page.waitForTimeout(2200)
  check('el punto pasa al viaje', (await variante()) === 'viaje', await rotulo())
  check('  …y se exporta', (await exporta()) === true)
  await guardar('3-viaje')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1800)
  check('la tecla pasa a la Pokédex', (await variante()) === 'pokedex' && /Mi Pokédex · 4 de 4/.test(await rotulo()), await rotulo())
  check('  …y se exporta', (await exporta()) === true)
  await guardar('4-pokedex')
  // El dedo: un arrastre a la izquierda sobre el lienzo.
  const caja = await page.locator('#mcImagenLienzo').boundingBox()
  await page.mouse.move(caja.x + caja.width * 0.8, caja.y + caja.height / 2)
  await page.mouse.down()
  await page.mouse.move(caja.x + caja.width * 0.2, caja.y + caja.height / 2, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(1800)
  check('el arrastre después de la última vuelve a la primera (ya pintada: al instante)', (await variante()) === 'equipo', await rotulo())
  await page.locator('#mcImagenAnterior').click()
  await page.waitForTimeout(400)
  check('  …y antes de la primera, la última', (await variante()) === 'pokedex')
}

console.log('── 4. Compartir coge la que se ve ──')
{
  await page.locator('#mcImagenCompartir').click()
  await page.waitForTimeout(800)
  const c = await page.evaluate(() => window.__compartido)
  check('compartir recibe un PNG con el nombre de la variante', c?.ficheros?.[0]?.tipo === 'image/png' && c.ficheros[0].bytes > 1000 && /-pokedex\.png$/.test(c.ficheros[0].nombre), JSON.stringify(c))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
}

console.log('── 5. En el móvil, las flechas miden 44 y la tira cabe ──')
{
  const movil = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true })
  await movil.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: CARTA('#f7d354') }))
  await movil.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
  await movil.addInitScript(([sets, cartas, col]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_COLECCION__ = col
  }, [SETS, CARTAS, COL])
  await movil.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await movil.waitForTimeout(3200)
  await movil.locator('#mcImagenCrear').click()
  await movil.waitForTimeout(2500)
  const medidas = await movil.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect()
    return { ant: r('mcImagenAnterior'), lienzo: r('mcImagenLienzo'), sig: r('mcImagenSiguiente'), punto: document.querySelector('.mc-imagen-punto').getBoundingClientRect(), ancho: window.innerWidth }
  })
  check('flechas y puntos de 44 px, y la tira dentro de la pantalla', medidas.ant.width >= 44 && medidas.ant.height >= 44 && medidas.punto.width >= 44 && medidas.punto.height >= 44 && medidas.sig.right <= medidas.ancho && medidas.lienzo.width > 200, JSON.stringify(medidas))
  await movil.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
