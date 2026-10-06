// Tanda 672 — el Panel es GLOBAL: las expansiones de todos los catálogos.
//
// PINGU: «me voy a Expansiones, selecciono japonés, vuelvo al Panel y no
// salen expansiones porque depende del catálogo que haya escogido. El
// Panel tiene que ser global».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [
    { id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' },
    { id: 'M6', name: 'Storm Emerald', name_en: 'Storm Emerald', serie_id: 'M', serie_name_en: 'Mega Evolution', market: 'JP', release_date: '2026-07-31', card_count_official: 76, card_count_total: 113, tcggo_id: 552 },
  ]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon' },
    { id: 'M6-080', market: 'JP', set_id: 'M6', local_id: '080', name: 'カイオーガ', name_en: 'Kyogre', image_tcggo: 'https://images.tcggo.com/k.png', rarity_en: 'Art Rare', category: 'Pokemon' },
  ]
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
    { id: 'l2', card_id: 'M6-080', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
  ]
  const dia = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  window.__FAKE_SET_VALOR__ = [0, 1, 2, 7].flatMap((k) => [{ set_id: 'M6', market: 'JP', dia: dia(k), valor_cm: 874 + k }, { set_id: 'xy5', market: 'WEST', dia: dia(k), valor_cm: 4200 - k }])
}
const cartaFalsa = () => ({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' })
async function abrir(ruta) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill(cartaFalsa()))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}

console.log('── 1. En el Panel con el catálogo occidental salen las dos expansiones, la japonesa también ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=resumen')
  const tarjetas = page.locator('#mcVistazos .mc-vistazo-sets .mc-set-tarjeta')
  const ids = await tarjetas.evaluateAll((els) => els.map((e) => `${e.dataset.market}:${e.dataset.set}`))
  check('dos tarjetas: la occidental y la japonesa, la más nueva primero', ids.join() === 'JP:M6,WEST:xy5', ids.join())
  const jp = page.locator('#mcVistazos .mc-set-tarjeta[data-set="M6"]')
  check('  …la japonesa con su valor y su progreso (1 de 113)', /874 €|87\d €/.test(limpio(await jp.innerText())) && /1 de 113/.test(limpio(await jp.innerText())), limpio(await jp.innerText()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Pulsar la japonesa desde el catálogo occidental cambia de catálogo y abre su expansión.
  await jp.click()
  await page.waitForTimeout(2500)
  check('pulsarla abre la expansión japonesa con el catálogo japonés puesto', /catalogo=JP/.test(page.url()) && /set=M6/.test(page.url()) && (await page.locator('#mcArchivadorZona:not(.hidden)').count()) === 1, page.url())
  await page.close()
}

console.log('\n── 2. Y con el catálogo japonés puesto, el Panel sigue enseñando la occidental ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=resumen&catalogo=JP')
  const ids = await page.locator('#mcVistazos .mc-vistazo-sets .mc-set-tarjeta').evaluateAll((els) => els.map((e) => `${e.dataset.market}:${e.dataset.set}`))
  check('las dos otra vez, sin «cuando añadas cartas»', ids.join() === 'JP:M6,WEST:xy5' && !/Cuando añadas cartas/.test(await page.locator('#mcVistazos').innerText()), ids.join())
  await page.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
