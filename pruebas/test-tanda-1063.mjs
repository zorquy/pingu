// Tanda 1063 — la carta que querías, conseguida, sale de «La quiero».
//
// PINGU: «cuando consigues una carta que ya querías… si yo la añado a la
// colección, debería quitársele el corazón». Lo que se mira:
//   · la regla (`cumpleDeseo`), la misma de `cambio_mover` (1047): idioma
//     pedido o cualquiera, versión pedida o cualquiera;
//   · `anadir` tacha lo que la copia cumple y nada más, por la hoja de añadir
//     de una expansión, con el aviso que lo dice y Deshacer que lo devuelve;
//   · `anadirVarias` (la selección, el CSV) también, y lo cuenta;
//   · un fallo al tachar no convierte el añadir en un error;
//   · /carta: el corazón se apaga sin recargar y el aviso lo dice.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 }]
const carta = (n, nombre, variants = { normal: true }) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, image_path: `sv/sv8/${n}`, rarity: 'Common', category: 'Pokemon', variants, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', release_date: '2024-11-08' } })
const CARTAS = [carta(1, 'Pikachu'), carta(2, 'Raichu'), carta(3, 'Chikorita', { normal: true, holo: true }), carta(4, 'Cyndaquil'), carta(5, 'Totodile')]
const deseo = (id, card, idioma = null, variante = null) => ({ id, user_id: 'admin-1', card_id: card, idioma, variante, prioridad: 1, created_at: `2026-10-2${id.slice(-1)}T10:00:00Z` })
// Pikachu en cualquier idioma y en japonés; Raichu solo en japonés; Chikorita
// Holo; Cyndaquil y Totodile en cualquiera. Y uno de otra persona.
const DESEOS = [
  deseo('d1', 'sv8-1'),
  deseo('d2', 'sv8-1', 'ja'),
  deseo('d3', 'sv8-2', 'ja'),
  deseo('d4', 'sv8-3', null, 'holo'),
  deseo('d5', 'sv8-4'),
  deseo('d6', 'sv8-5'),
  { ...deseo('d7', 'sv8-1'), user_id: 'user-2' },
]

const browser = await chromium.launch()
async function abrir(extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = []
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu' }, { id: 'user-2', username: 'lucia' }]
    Object.assign(window, d.extra)
  }, { SETS, CARTAS, DESEOS, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
}
const quedan = (page) => page.evaluate(() => window.__TABLAS__.user_wants.map((d) => d.id).sort().join())

console.log('── 1. La regla ──')
{
  const { ctx, page } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=sv8')
  const r = await page.evaluate(async () => {
    const { cumpleDeseo } = await import('/js/mi-coleccion/cambios.js')
    const c = (idioma, variante) => ({ card_id: 'x', idioma, variante })
    return {
      cualquiera: cumpleDeseo({ card_id: 'x' }, c('es', 'normal')),
      suIdioma: cumpleDeseo({ card_id: 'x', idioma: 'ja' }, c('ja', 'normal')),
      otroIdioma: cumpleDeseo({ card_id: 'x', idioma: 'ja' }, c('es', 'normal')),
      suVersion: cumpleDeseo({ card_id: 'x', variante: 'holo' }, c('es', 'holo')),
      otraVersion: cumpleDeseo({ card_id: 'x', variante: 'holo' }, c('es', 'normal')),
      sinVersionEsNormal: cumpleDeseo({ card_id: 'x', variante: 'normal' }, c('es', null)),
      otraCarta: cumpleDeseo({ card_id: 'y' }, c('es', 'normal')),
    }
  })
  check('cualquier idioma y versión: la cumple cualquier copia', r.cualquiera)
  check('  …el idioma pedido, solo ese', r.suIdioma && !r.otroIdioma)
  check('  …la versión pedida, solo esa (sin versión es la Normal)', r.suVersion && !r.otraVersion && r.sinVersionEsNormal)
  check('  …y otra carta, nunca', !r.otraCarta)
  await ctx.close()
}

console.log('── 2. Añadir desde la expansión tacha lo que cumple, y Deshacer lo devuelve ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=sv8')
  const corazones = () => page.$$eval('#mcAlbum [data-carta] .mc-quiero-marca', (ms) => [...new Set(ms.map((m) => m.closest('[data-carta]').dataset.carta))].sort().join())
  check('de entrada, corazón en las cinco', (await corazones()) === 'sv8-1,sv8-2,sv8-3,sv8-4,sv8-5', await corazones())
  await page.locator('#mcAlbum [data-anadir="sv8-1"]').first().click()
  await page.waitForSelector('#mcAnadirDialogo[open]', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('#mcAdIdiomas .mc-idioma-chip[data-idioma="es"]').click()
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  check('el Pikachu en español tacha el de «cualquier idioma» y deja el japonés', (await quedan(page)) === 'd2,d3,d4,d5,d6,d7', await quedan(page))
  const aviso = await page.evaluate(() => document.querySelector('.mc-deshacer-texto')?.textContent || '')
  check('  …y el aviso lo dice', /añadida.*sale de «La quiero»/.test(aviso), aviso)
  await page.click('.mc-deshacer-boton')
  await page.waitForTimeout(1200)
  const tras = await page.evaluate(() => ({ coleccion: window.__TABLAS__.user_collection.filter((l) => l.user_id === 'admin-1').length, d1: window.__TABLAS__.user_wants.find((d) => d.id === 'd1') }))
  check('Deshacer quita la carta y devuelve el deseo, con su id y su fecha', tras.coleccion === 0 && tras.d1?.created_at === '2026-10-21T10:00:00Z' && !tras.d1?.idioma, JSON.stringify(tras))
  check('  …y vuelve a quedar todo como estaba', (await quedan(page)) === 'd1,d2,d3,d4,d5,d6,d7', await quedan(page))

  // Raichu en español: buscas la japonesa, así que no se toca.
  await page.locator('#mcAlbum [data-anadir="sv8-2"]').first().click()
  await page.waitForSelector('#mcAnadirDialogo[open]', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('#mcAdIdiomas .mc-idioma-chip[data-idioma="es"]').click()
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  check('el Raichu en español no tacha el que buscas en japonés', (await quedan(page)) === 'd1,d2,d3,d4,d5,d6,d7', await quedan(page))
  const aviso2 = await page.evaluate(() => document.querySelector('.mc-deshacer-texto')?.textContent || '')
  check('  …y el aviso no lo menciona', /añadida/.test(aviso2) && !/La quiero/.test(aviso2), aviso2)

  // Lo de otra persona no se toca nunca.
  const d7 = await page.evaluate(() => window.__TABLAS__.user_wants.some((d) => d.id === 'd7'))
  check('el deseo de otra persona sigue', d7)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Varias de golpe (la selección y el CSV) ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=sv8')
  const r = await page.evaluate(async () => {
    const datos = await import('/js/mi-coleccion/datos.js')
    const puestas = await datos.anadirVarias('admin-1', [
      { card_id: 'sv8-3', idioma: 'es', estado: 'NM', variante: 'normal' },
      { card_id: 'sv8-4', idioma: 'en', estado: 'NM', variante: 'normal' },
      { card_id: 'sv8-5', idioma: 'es', estado: 'NM', variante: 'normal' },
    ])
    return { puestas: puestas.length, tachados: datos.deseosTachadosPor(puestas).map((d) => d.id).sort().join() }
  })
  check('tres añadidas; la Chikorita Normal no tacha la Holo que buscas', r.puestas === 3 && r.tachados === 'd5,d6', JSON.stringify(r))
  check('  …y en la base quedan los demás', (await quedan(page)) === 'd1,d2,d3,d4,d7', await quedan(page))
  const r2 = await page.evaluate(async () => {
    const datos = await import('/js/mi-coleccion/datos.js')
    const nueva = await datos.anadir('admin-1', { card_id: 'sv8-3', idioma: 'es', estado: 'NM', variante: 'holo', cantidad: 1 })
    return datos.deseosTachadosPor(nueva).map((d) => d.id).join()
  })
  check('la Chikorita Holo sí la tacha', r2 === 'd4' && (await quedan(page)) === 'd1,d2,d3,d7', `${r2} / ${await quedan(page)}`)
  // El corazón de la expansión, al día sin recargar.
  await page.waitForTimeout(600)
  const marcas = await page.$$eval('#mcAlbum [data-carta] .mc-quiero-marca', (ms) => [...new Set(ms.map((m) => m.closest('[data-carta]').dataset.carta))].sort().join())
  check('  …y el corazón solo queda donde aún la quieres y no la tienes', !/sv8-[345]/.test(marcas), marcas)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Si tachar falla, la carta se añade igual ──')
{
  // Que la base diga que no al borrar deseos: la RLS no da error, vuelve vacía.
  const { ctx, page, errores } = await abrir({ __RLS_SIN_BORRAR__: ['user_wants'] })
  await ir(page, '/mi-coleccion.html?ver=album&set=sv8')
  const r = await page.evaluate(async () => {
    const datos = await import('/js/mi-coleccion/datos.js')
    const nueva = await datos.anadir('admin-1', { card_id: 'sv8-1', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 })
    return { id: !!nueva?.id, tachados: datos.deseosTachadosPor(nueva).length }
  })
  check('la carta entra y no se anuncia como quitado lo que la base no borró', r.id && r.tachados === 0, JSON.stringify(r))
  check('  …y el deseo sigue', (await quedan(page)).includes('d1'), await quedan(page))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. /carta: el corazón se apaga sin recargar ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/carta.html?id=sv8-4')
  check('de entrada, la quieres', (await page.getAttribute('#cmQuiero', 'aria-pressed')) === 'true')
  await page.click('#cmAnadir')
  await page.waitForSelector('dialog[open] #cmAdGuardar', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(400)
  const toasts = []
  await page.exposeFunction('__apuntarAviso', (t) => toasts.push(t))
  await page.evaluate(() => new MutationObserver(() => document.querySelectorAll('.toast, [class*="toast"]').forEach((t) => window.__apuntarAviso(t.textContent))).observe(document.body, { childList: true, subtree: true }))
  await page.click('#cmAdGuardar')
  await page.waitForTimeout(1500)
  check('se añade y el deseo sale de la base', (await quedan(page)) === 'd1,d2,d3,d4,d6,d7', await quedan(page))
  check('  …el corazón se apaga', (await page.getAttribute('#cmQuiero', 'aria-pressed')) === 'false')
  check('  …y el aviso lo dice', toasts.some((t) => /añadida.*sale de «La quiero»/.test(t)), toasts.join(' | '))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
