// El constructor de mazos (tandas 354, 355 y 357): añadir cartas, el
// límite de 4 por NOMBRE (con las versiones contando juntas), que una
// energía especial que el espejo marca «Básico» NO pase por básica
// (tanda 357: la Prisma y las suyas), importar una lista de TCG Live y
// que las energías básicas acaben SIEMPRE en la mee-00X de su tipo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1400, height: 900 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))

await page.addInitScript(() => {
  // Sin sesión a propósito: montar un mazo está abierto a todo el mundo.
  window.__FAKE_SESSION__ = 'none'
  window.__FAKE_SETS__ = [
    { id: 'sv04.5', name: 'Destinos de Paldea', market: 'WEST', tcg_online_code: 'PAF', release_date: '2024-01-26', card_count_official: 91, serie_id: 'sv', serie_name: 'Escarlata y Púrpura' },
    { id: 'sv06', name: 'Mascarada Crepuscular', market: 'WEST', tcg_online_code: 'TWM', release_date: '2024-05-24', card_count_official: 167, serie_id: 'sv', serie_name: 'Escarlata y Púrpura' },
    // El más nuevo con código y >20 cartas: es el que el buscador
    // preselecciona al entrar, y aquí vive la Prisma.
    { id: 'me02x', name: 'Héroes Ascendidos', market: 'WEST', tcg_online_code: 'ASC', release_date: '2026-05-01', card_count_official: 100, serie_id: 'me', serie_name: 'Mega Evolución' },
    { id: 'mee', name: 'Energías Mega Evolución', market: 'WEST', tcg_online_code: 'MEE', release_date: '2025-08-01', card_count_official: 16, serie_id: 'me', serie_name: 'Mega Evolución' },
  ]
  window.__FAKE_CARTAS__ = [
    // Dos impresiones del MISMO Pokémon: el límite de 4 va por nombre.
    { id: 'sv06-130', set_id: 'sv06', market: 'WEST', local_id: '130', name: 'Teal Mask Ogerpon ex', name_es: 'Ogerpon ex Máscara Turquesa', name_key: 'teal mask ogerpon ex', name_search: 'teal mask ogerpon ex ogerpon ex mascara turquesa', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'sv/sv06/130', types: ['Grass'], hp: 210 },
    { id: 'sv06-25', set_id: 'sv06', market: 'WEST', local_id: '25', name: 'Teal Mask Ogerpon ex', name_es: 'Ogerpon ex Máscara Turquesa', name_key: 'teal mask ogerpon ex', name_search: 'teal mask ogerpon ex ogerpon ex mascara turquesa', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'sv/sv06/25', types: ['Grass'], hp: 210 },
    { id: 'sv04.5-7', set_id: 'sv04.5', market: 'WEST', local_id: '7', name: 'Charmander', name_es: 'Charmander', name_key: 'charmander', name_search: 'charmander', category: 'Pokemon', stage: 'Basic', regulation_mark: 'H', image_path: 'sv/sv04.5/7', types: ['Fire'], hp: 70 },
    // La Prisma tal cual está HOY en el espejo: energy_type «Básico»
    // (tanda 357, el dato viene mal de TCGdex). Es ESPECIAL.
    { id: 'me02x-99', set_id: 'me02x', market: 'WEST', local_id: '99', name: 'Prism Energy', name_es: 'Energía Prisma', name_key: 'prism energy', name_search: 'prism energy energia prisma', category: 'Energy', energy_type: 'Básico', regulation_mark: 'J', image_path: 'me/me02x/99' },
    { id: 'mee-002', set_id: 'mee', market: 'WEST', local_id: '2', name: 'Fire Energy', name_es: 'Energía Fuego', name_key: 'fire energy', name_search: 'fire energy energia fuego', category: 'Energy', energy_type: 'Básico', regulation_mark: null, image_path: null },
  ]
})

await page.goto(`${BASE}/constructor.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2400)

const cuenta = () => page.locator('#cmTabCuenta').innerText()

console.log('\n── 1. Al entrar: la colección más nueva, y añadir funciona ──')
{
  check('el buscador preselecciona la colección más nueva en tiendas', await page.locator('#cmSet').inputValue() === 'me02x')
  await page.waitForSelector('.cm-resultado[data-id="me02x-99"]', { timeout: 5000 }).catch(() => {})
  check('la Prisma sale en los resultados', await page.locator('.cm-resultado[data-id="me02x-99"]').count() === 1)
  await page.click('.cm-resultado[data-id="me02x-99"] [data-anadir]')
  await page.waitForTimeout(200)
  check('pulsarla la añade al mazo', await cuenta() === '1' && (await page.locator('.cm-carta[data-id="me02x-99"]').count()) === 1)
}

console.log('\n── 2. La Prisma es ESPECIAL aunque el espejo diga «Básico» (357) ──')
{
  // Si pasara por básica no tendría límite: la quinta copia entraría.
  for (let i = 0; i < 5; i++) {
    await page.click('.cm-resultado[data-id="me02x-99"] [data-anadir]')
    await page.waitForTimeout(120)
  }
  check('el límite de 4 copias se le aplica', await cuenta() === '4', `cuenta ${await cuenta()}`)
}

console.log('\n── 3. Los filtros de energía no se fían de energy_type (357) ──')
{
  // Sin la colección puesta: «Básica» fija la colección MEE por dentro,
  // y con otra elegida a la vez los dos filtros no casan con nada.
  await page.selectOption('#cmSet', '')
  await page.waitForTimeout(400)
  await page.selectOption('#cmCategoria', 'E')
  await page.waitForTimeout(600)
  await page.selectOption('#cmSubtipo', 'basica')
  await page.waitForTimeout(600)
  check('«Básica» enseña las de MEE', await page.locator('.cm-resultado[data-id="mee-002"]').count() === 1)
  check('…y a la Prisma no', await page.locator('.cm-resultado[data-id="me02x-99"]').count() === 0)
  await page.selectOption('#cmSubtipo', 'especial')
  await page.waitForTimeout(600)
  check('«Especial» enseña la Prisma', await page.locator('.cm-resultado[data-id="me02x-99"]').count() === 1)
  check('…y las básicas no', await page.locator('.cm-resultado[data-id="mee-002"]').count() === 0)
}

console.log('\n── 4. El límite de 4 es por NOMBRE: las versiones cuentan juntas ──')
{
  await page.selectOption('#cmCategoria', '')
  await page.waitForTimeout(400)
  await page.selectOption('#cmSet', '')
  await page.fill('#cmTexto', 'ogerpon')
  await page.locator('#cmFormBuscar button[type="submit"]').click()
  await page.waitForSelector('.cm-resultado[data-id="sv06-130"]', { timeout: 5000 }).catch(() => {})
  for (let i = 0; i < 4; i++) {
    await page.click('.cm-resultado[data-id="sv06-130"] [data-anadir]')
    await page.waitForTimeout(120)
  }
  check('cuatro copias de la primera impresión entran', await cuenta() === '8', `cuenta ${await cuenta()}`)
  await page.click('.cm-resultado[data-id="sv06-25"] [data-anadir]')
  await page.waitForTimeout(300)
  check('la quinta por OTRA impresión no entra', await cuenta() === '8', `cuenta ${await cuenta()}`)
}

console.log('\n── 5. Importar una lista de TCG Live, con las básicas a mee-00X ──')
{
  await page.click('#cmBtnHerramientas')
  await page.click('#cmMenuHerramientas [data-accion="importar"]')
  await page.waitForTimeout(400)
  await page.fill('#cmImportarTexto', 'Pokémon: 4\n4 Charmander PAF 7\n\nEnergy: 3\n3 Basic {R} Energy SVE 2\n\nTotal Cards: 7')
  await page.click('#cmImportarBoton')
  await page.waitForTimeout(1200)
  check('la lista sustituye al mazo y suma 7', await cuenta() === '7', `cuenta ${await cuenta()}`)
  check('el Charmander es la impresión que decía la lista', await page.locator('.cm-carta[data-id="sv04.5-7"]').count() === 1)
  // Aunque la lista dijera «SVE 2», la básica se lleva a la MEE de su
  // tipo: una sola fila por energía, con el dibujo del 30 aniversario.
  check('la energía básica acaba en mee-002', await page.locator('.cm-carta[data-id="mee-002"]').count() === 1)
  check('y no queda ninguna fila SVE', await page.locator('.cm-carta[data-id^="sve-"]').count() === 0)
}

check('sin errores de página', errores.length === 0, errores.join(' | '))

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
