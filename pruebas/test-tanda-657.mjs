// Tandas 657, 658 y 659 — el «+» en cada carta de la expansión, la chispa
// del mes en la tarjeta de expansión, y el nombre inglés de un set desde
// TCGGO.
//
// PINGU (657): «hay un plus en la carta; ese plus te lleva al pop-up.
// Estaría bien que tenga un plus ahí la carta y darle para que te salte el
// pop-up de agregar». (658): «los sets se muestran así, con gráficas; te
// dice cuánto ha subido, cuánto ha bajado». IBAI (659): «algunas
// colecciones no tienen nombre en inglés».
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const semilla = ({ sesion, vista, dias, bajada }) => {
  window.__FAKE_SESSION__ = sesion
  if (vista) localStorage.setItem('mc-album-vista', vista)
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true } },
    { id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } },
  ]
  window.__FAKE_COLECCION__ = sesion === 'none' ? [] : [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
  const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  window.__FAKE_SET_VALOR__ = Array.from({ length: dias }, (_, i) => ({ set_id: 'xy5', market: 'WEST', dia: d(dias - 1 - i), valor_cm: bajada ? 500 - i * 3 : 400 + i * 3 }))
}
async function abrir(ruta, { sesion = 'admin-1', vista = null, dias = 30, bajada = false, ancho = 1200 } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla, { sesion, vista, dias, bajada })
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

console.log('── 1. El «+» en cada carta (657) ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  const mas = page.locator('#mcAlbum .mc-mas')
  check('cada carta del archivador lleva su «+»', (await mas.count()) === 2 && (await mas.first().getAttribute('role')) === 'button' && /Añadir/.test(await mas.first().getAttribute('aria-label')))
  check('  …dibujado, no un emoji', (await mas.first().locator('svg').count()) === 1)
  await page.locator('[data-anadir="xy5-1"]').click()
  await page.waitForTimeout(600)
  check('pulsarlo abre el diálogo de añadir con ESA carta…', await page.locator('#mcAnadirDialogo').evaluate((d) => d.open) && /Weedle/.test(limpio(await page.locator('#mcAdNombre').innerText())), limpio(await page.locator('#mcAdNombre').innerText()))
  check('  …y NO la ficha', !(await page.locator('#mcEditor').evaluate((d) => d.open)) && /set=xy5/.test(page.url()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Con el teclado.
  await page.locator('[data-anadir="xy5-150"]').focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  check('con Intro también', await page.locator('#mcAnadirDialogo').evaluate((d) => d.open) && /Groudon/.test(limpio(await page.locator('#mcAdNombre').innerText())))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()

  const cuad = await abrir('/mi-coleccion.html?ver=album&set=xy5', { vista: 'cuadricula', ancho: 390 })
  const m2 = cuad.page.locator('#mcAlbum .mc-rejilla-celda .mc-mas')
  const caja = await m2.first().boundingBox()
  check('en la cuadrícula del móvil también, y mide 44', (await m2.count()) === 2 && caja && caja.width >= 44 && caja.height >= 44, JSON.stringify(caja))
  await m2.first().tap()
  await cuad.page.waitForTimeout(600)
  check('  …y con el dedo abre el diálogo', await cuad.page.locator('#mcAnadirDialogo').evaluate((d) => d.open))
  await cuad.page.close()

  const sin = await abrir('/cartas.html?ver=album&set=xy5', { sesion: 'none' })
  check('sin cuenta (el catálogo público) no hay «+»: no hay a dónde añadir', (await sin.page.locator('#mcAlbum .mc-mas').count()) === 0 && (await sin.page.locator('#mcAlbum .mc-bolsillo-enlace').count()) === 2)
  await sin.page.close()
}

console.log('\n── 2. La chispa del mes (658) ──')
// La tarjeta con su chispa es la del CATÁLOGO desde la 748; en tu colección
// la estantería es la lista de su maqueta (C2).
{
  const { page, errores } = await abrir('/cartas.html')
  const chispa = page.locator('.mc-set-tarjeta[data-set="xy5"] .mc-set-chispa')
  check('la tarjeta de la expansión lleva su chispa, verde si sube', (await chispa.count()) === 1 && /sube/.test(await chispa.getAttribute('class')) && (await chispa.locator('polyline').getAttribute('points')).split(' ').length >= 3, await chispa.getAttribute('class')) // desde la 668 se pide por semanas + ocho días, no los 30 días seguidos
  check('  …delante de la cifra y del semanal', /448|487|4\d\d €/.test(limpio(await page.locator('.mc-set-tarjeta[data-set="xy5"] .mc-set-valor').innerText())))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
  const baja = await abrir('/cartas.html', { bajada: true })
  check('roja si baja', /baja/.test(await baja.page.locator('.mc-set-tarjeta[data-set="xy5"] .mc-set-chispa').getAttribute('class')))
  await baja.page.close()
  const pocos = await abrir('/cartas.html', { dias: 2 })
  check('con dos días no hay chispa (sería una raya) pero sí la cifra', (await pocos.page.locator('.mc-set-chispa').count()) === 0 && /€/.test(limpio(await pocos.page.locator('.mc-set-tarjeta[data-set="xy5"] .mc-set-valor').innerText())))
  await pocos.page.close()
  const js = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  check('la consulta pide nueve meses por semanas (668), y el semanal sigue siendo de ocho días', /fechasDeValor\(\)/.test(js) && /hace8/.test(js))
}

console.log('\n── 3. El nombre inglés de un set, desde TCGGO (659) ──')
{
  const { procesar, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`)
  const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
  const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' }
  const estados = { [CLAVE_PARES]: { episodios: { fecha: '2026-10-05T10:00:00Z', lista: [{ id: 415, nombre: 'Pitch Black', codigo: 'PBL', cartas: 1 }, { id: 416, nombre: 'Delta Reign', codigo: 'DRN', cartas: 1 }] }, hechos: { me02: { episodio: 415 }, me03: { episodio: 416 } } }, [CLAVE_ESTADO]: {} }
  const nombrados = []
  const page = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
  const r = await procesar({
    env: ENV, pausa: async () => {}, ahora: new Date('2026-10-06T01:00:00Z'),
    fetchImpl: async (url) => {
      const u = new URL(url)
      if (u.pathname.endsWith('/episodes')) return page([])
      const ep = Number(u.searchParams.get('episode_id'))
      return page([{ id: ep * 10, name: 'Carta', card_number: '1', cardmarket_id: ep * 100, type: 'singles' }])
    },
    restImpl: async (ruta) => {
      if (ruta.startsWith('tcg_sets?')) return [{ id: 'me02', name: 'Oscuridad Absoluta', name_en: null, tcg_online_code: 'PBL' }, { id: 'me03', name: 'Dominio Delta', name_en: 'Delta Reign', tcg_online_code: 'DRN' }]
      return []
    },
    guardarCartasImpl: async (filas) => filas.length,
    crearSetsImpl: async () => 0,
    nombrarSetImpl: async (setId, mercado, nombre) => { nombrados.push(`${mercado}:${setId}=${nombre}`) },
    estadoImpl: async (k) => estados[k],
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
  })
  check('el set sin nombre inglés lo recibe de su expansión; el que ya lo tiene, no', r.ok && nombrados.join() === 'WEST:me02=Pitch Black' && r.nombrados === 1, JSON.stringify({ nombrados, r: r.nombrados, e: r.error }))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
