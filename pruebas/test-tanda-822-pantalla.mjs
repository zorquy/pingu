// Tanda 822 (PO2) — las otras versiones de TCGGO en la ficha de /carta.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
console.log('── Lo puro ──')
const m = await import(`${RAIZ}/js/carta-versiones.js`)
check('el precio: el mínimo en español y, si no, el general; un cero no es precio', m.precioDeVersion({ cm_low_es: 2.5, cm_low: 1 }) === 2.5 && m.precioDeVersion({ cm_low: 1 }) === 1 && m.precioDeVersion({ cm_low: 0 }) === null)
check('el enlace: el de TCGGO (lleva el filtro de la versión) y, si no, el producto', m.enlaceDeVersion({ link_cm: 'https://www.tcggo.com/external/cm/43552' }) === 'https://www.tcggo.com/external/cm/43552' && /idProduct=777/.test(m.enlaceDeVersion({ cm_id_product: 777 })) && m.enlaceDeVersion({ link_cm: 'https://malo.example/x' }) === null)
check('sin versiones, nada', m.versionesHtml([]) === '')
check('no se inventa qué versión es: se numeran', /Versión 2/.test(m.versionesHtml([{ cm_low: 1 }])) && !/Reverse Holo</.test(m.versionesHtml([{ cm_low: 1 }])))

const browser = await chromium.launch()
for (const conVersiones of [true, false]) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  await ctx.addInitScript((con) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = [{ id: 'bw9', name: 'Plasma Freeze', serie_id: 'bw', market: 'WEST' }]
    window.__FAKE_CARTAS__ = [{ id: 'bw9-87', market: 'WEST', set_id: 'bw9', local_id: '87', name: 'Snorlax', image_path: 'bw/bw9/87' }]
    window.__FAKE_PRECIOS__ = [{ card_id: 'bw9-87', cm_low: 0.3, checked_at: new Date().toISOString() }]
    window.__FAKE_VERSIONES__ = con ? [{ tcggo_id: 43552, card_id: 'bw9-87', link_cm: 'https://www.tcggo.com/external/cm/43552', cm_low: 0.9, cm_low_es: 1.2 }, { tcggo_id: 43553, card_id: 'bw9-87', cm_id_product: 999 }] : []
  }, conVersiones)
  await ctx.route(/assets\.tcgdex\.net|api\.tcgdex\.net/, (r) => r.fulfill({ status: 404, body: '' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/carta.html?id=bw9-87`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  // En el móvil la ficha va en pestañas (716): el bloque vive en «Precio».
  await page.click('.carta-pestanas [data-pestana="precio"]').catch(() => {})
  await page.waitForTimeout(200)
  const r = await page.evaluate(() => {
    const c = document.getElementById('cmVersiones')
    return c && { visible: c.getBoundingClientRect().height > 0, filas: [...c.querySelectorAll('.cv-fila')].map((f) => ({ texto: f.textContent.replace(/\s+/g, ' ').trim(), href: f.getAttribute('href') })) }
  })
  if (conVersiones) {
    check('sin errores', errores.length === 0, errores.join(' | '))
    check('con versiones: el bloque sale con una fila por versión', r?.visible && r.filas.length === 2, JSON.stringify(r))
    check('  …la primera con su precio en español y el enlace de TCGGO', /Versión 2/.test(r?.filas[0]?.texto) && /1,20/.test(r.filas[0].texto) && r.filas[0].href === 'https://www.tcggo.com/external/cm/43552', JSON.stringify(r?.filas[0]))
    check('  …y la que no tiene precio lo dice, con el producto de Cardmarket', /sin precio/.test(r?.filas[1]?.texto) && /idProduct=999/.test(r.filas[1].href || ''), JSON.stringify(r?.filas[1]))
  } else {
    check('sin versiones, el bloque no sale', r && !r.visible, JSON.stringify(r))
  }
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
