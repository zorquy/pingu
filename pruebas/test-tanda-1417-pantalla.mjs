// Tanda 1417 — Tus colores leía UNA foto por carta (PINGU: «¿por qué solamente
// reconoce 30 cartas?»). La de TCGdex: si TCGdex no la tenía, la carta se veía
// (la <img> recorre su cadena) pero su color no se leía y se quedaba fuera de
// la pared sin decir cuántas. Ahora `huellasDe` prueba el resto de la cadena.
//   · Lo puro: `fotosParaLeer` pone primero la que se pide y luego las que
//     dejan leer sus píxeles (TCGdex, pokemontcg.io); sin repetir.
//   · La pantalla: 6 ilustraciones; a la 4, 5 y 6 TCGdex les da 404. La 4 y la
//     5 se leen de pokemontcg.io; la 6 no tiene ninguna foto que deje leer, y
//     la frase dice «Hay 1 que no se ha podido leer».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const COLOR = (n) => (n <= 3 ? '#2f6fb3' : '#c62828')
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="${COLOR(n)}"/></svg>`
const N = 6
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Illustration Rare', category: 'Pokemon' }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-11-01T10:00:00Z' }))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript(({ SETS, CARTAS, COLECCION }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS; window.__FAKE_COLECCION__ = COLECCION; window.__FAKE_ALBUMES__ = []
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('pd-armonia-v1') } catch {}
}, { SETS, CARTAS, COLECCION })
const pedidas = []
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|scrydex/, (r) => {
  const url = r.request().url()
  const n = Number((url.match(/sv8\/(\d+)/) || [])[1] || 1)
  pedidas.push(url)
  // TCGdex no tiene la 4, la 5 ni la 6 (como una expansión recién salida).
  if (/tcgdex/.test(url) && n >= 4) return r.fulfill({ status: 404, body: '' })
  // pokemontcg.io tiene la 4 y la 5, con permiso para leerlas; la 6, no.
  if (/pokemontcg/.test(url) && n === 6) return r.fulfill({ status: 404, body: '' })
  // El resto de sitios contesta la foto, pero SIN permiso (el lienzo se ensucia).
  const permiso = /tcgdex|pokemontcg/.test(url) ? { 'Access-Control-Allow-Origin': '*' } : {}
  return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: permiso, body: svg(n) })
})
await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 200)) })

await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)

console.log('\n── Lo puro ──')
{
  const r = await page.evaluate(async () => {
    const a = await import('/js/mi-coleccion/armonia.js')
    const primera = 'https://assets.tcgdex.net/en/sv/sv8/4/low.webp'
    const cadena = ['https://limitless.example/SSP_4.png', primera, 'https://images.tcggo.com/4.png', 'https://images.pokemontcg.io/sv8/4.png']
    return {
      orden: a.fotosParaLeer(null, primera, cadena),
      sinPrimera: a.fotosParaLeer(null, null, cadena),
      carta: a.fotosParaLeer({ id: 'sv8-4', market: 'WEST', set_id: 'sv8', local_id: '4', image_path: 'sv/sv8/4' }, primera),
    }
  })
  check('la que se pide va primera y las que dejan leer, delante del resto', r.orden.join(' ') === 'https://assets.tcgdex.net/en/sv/sv8/4/low.webp https://images.pokemontcg.io/sv8/4.png https://limitless.example/SSP_4.png https://images.tcggo.com/4.png', r.orden.join(' '))
  check('sin repetir ninguna', new Set(r.orden).size === r.orden.length)
  check('sin «primera», también ordena', r.sinPrimera[0] === 'https://assets.tcgdex.net/en/sv/sv8/4/low.webp' && r.sinPrimera[1] === 'https://images.pokemontcg.io/sv8/4.png', r.sinPrimera.join(' '))
  check('con solo la carta, saca su cadena entera', r.carta.length >= 2 && r.carta.some((u) => /pokemontcg/.test(u)), r.carta.join(' '))
}

console.log('\n── Tus colores, con fotos que faltan en TCGdex ──')
{
  await page.goto(`${BASE}/mi-coleccion.html?ver=colores`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcPanelColores .vc-pared a', { timeout: 20000 }).catch(() => {})
  await page.waitForFunction(() => !/Mirando/.test(document.getElementById('vcColores')?.textContent || ''), null, { timeout: 20000 }).catch(() => {})
  const r = await page.evaluate(() => ({
    ids: [...document.querySelectorAll('#mcPanelColores .vc-pared a')].map((a) => a.dataset.carta),
    resumen: document.querySelector('#mcPanelColores .mc-vista-resumen')?.textContent.replace(/\s+/g, ' ').trim(),
    chips: [...document.querySelectorAll('#mcPanelColores [data-color]')].map((b) => b.textContent.trim()),
  }))
  check('salen 5: las 3 de TCGdex y las 2 que se leen de pokemontcg.io', r.ids.length === 5 && ['sv8-4', 'sv8-5'].every((id) => r.ids.includes(id)) && !r.ids.includes('sv8-6'), r.ids.join())
  check('el rojo de la 4 y la 5 se ha leído bien', r.chips.includes('Rojo · 2') && r.chips.includes('Azul · 3'), r.chips.join('|'))
  check('la frase dice cuántas no se han podido leer', /Hay 1 que no se ha podido leer/.test(r.resumen || ''), r.resumen)
  check('se probó pokemontcg.io después del 404 de TCGdex', pedidas.some((u) => /pokemontcg\.io\/sv8\/4/.test(u)))
  await page.waitForTimeout(700)
  const guardadas = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('pd-armonia-v1') || '{}')).sort().join())
  check('la huella leída de pokemontcg.io queda guardada como las demás', /sv8-4/.test(guardadas) && /sv8-5/.test(guardadas) && !/sv8-6/.test(guardadas), guardadas)
  check('sin errores', !errores.length, errores.join(' | '))
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
