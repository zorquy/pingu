// Tanda 826 — en el catálogo japonés el logo de TCGGO va delante del de
// Scrydex. PINGU, con Golden Sky, Silvery Ocean: salía el logo genérico de
// «Pokémon Trading Card Game» que Scrydex pone a lo antiguo, con el suyo de
// verdad guardado detrás.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { logosDePago } = await import(`${RAIZ}/js/catalogo-series.js`)
const AMBOS = { logo_scrydex: 'https://images.scrydex.com/generico', logo_tcggo: 'https://images.tcggo.com/pcg4.png' }
check('japonés: TCGGO primero', JSON.stringify(logosDePago({ market: 'JP', ...AMBOS })) === JSON.stringify([AMBOS.logo_tcggo, AMBOS.logo_scrydex]))
check('occidental: Scrydex primero, como desde la 507', logosDePago({ market: 'WEST', ...AMBOS })[0] === AMBOS.logo_scrydex)
check('sin mercado se queda como estaba', logosDePago(AMBOS)[0] === AMBOS.logo_scrydex)
check('solo uno: ese, y sin huecos', JSON.stringify(logosDePago({ market: 'JP', logo_scrydex: 'x' })) === '["x"]' && logosDePago({ market: 'JP' }).length === 0)
for (const f of ['js/mi-coleccion.js', 'js/carta-nucleo.js', 'js/lanzamientos.js']) {
  const fuente = readFileSync(`${RAIZ}/${f}`, 'utf8')
  check(`${f}: ninguna cadena de logos pone Scrydex delante a pelo`, !/\.logo_scrydex\s*(\|\||,)\s*\w+\.logo_tcggo/.test(fuente) && /logosDePago\(/.test(fuente))
}

// Y en la estantería de verdad: la fila del set japonés pinta el de TCGGO.
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
await ctx.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [
    { id: 'pcg4_ja', name: 'Golden Sky, Silvery Ocean', name_en: 'Golden Sky, Silvery Ocean', serie_id: 'pcg', serie_name: 'PCG', market: 'JP', card_count_official: 107, release_date: '2005-04-01', tcg_online_code: 'PCG4_J', tcggo_id: 691, logo_scrydex: 'https://images.scrydex.com/generico', logo_tcggo: 'https://images.tcggo.com/pcg4.png' },
    { id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, release_date: '2023-08-11', tcg_online_code: 'OBF', logo_scrydex: 'https://images.scrydex.com/obf', logo_tcggo: 'https://images.tcggo.com/obf.png' },
  ]
  window.__FAKE_CARTAS__ = [{ id: 'pcg4_ja-1', set_id: 'pcg4_ja', market: 'JP', local_id: '1', name: 'A', image_path: 'x/1' }, { id: 'sv3-1', set_id: 'sv3', market: 'WEST', local_id: '1', name: 'A', image_path: 'x/1' }]
  window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'pcg4_ja-1', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal' }]
})
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="96"><rect width="240" height="96" fill="#d4471c"/></svg>'
await ctx.route(/images\.(tcggo|scrydex)\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }))
const page = await ctx.newPage()
const fuenteDe = async (set) => {
  await page.waitForFunction((id) => document.querySelector(`.mc-set-fila[data-set="${id}"] img`), set, { timeout: 15000 }).catch(() => {})
  return page.evaluate((id) => document.querySelector(`.mc-set-fila[data-set="${id}"] img`)?.getAttribute('src') || null, set)
}
await page.goto(`${BASE}/mi-coleccion.html?ver=album&catalogo=JP`, { waitUntil: 'domcontentloaded' })
const jp = await fuenteDe('pcg4_ja')
check('estantería japonesa: Golden Sky, Silvery Ocean con el logo de TCGGO', /tcggo/.test(jp || ''), jp)
await page.goto(`${BASE}/mi-coleccion.html?ver=album&catalogo=WEST`, { waitUntil: 'domcontentloaded' })
const west = await fuenteDe('sv3')
check('estantería occidental: sigue el de Scrydex', /scrydex/.test(west || ''), west)
await browser.close()
const admin = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
check('/admin cuenta las expansiones japonesas que traen logo', /expansiones traen logo en la lista de TCGGO/.test(admin))
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
