// Tanda 763 — Deseos y cambios (DC1) y el aviso de quien sigues (Z3).
//
// PINGU: «¿cómo lo harías? … no quiero meter un menú con demasiados
// submenús». Una pantalla con tres vistas y el mismo selector arriba en las
// dos pestañas que la forman: «La quiero» (lo que buscas), «Las que doy»
// (lo que das, con su precio, cuántas y cuánta gente la busca) y «Cruces»
// (quién encaja contigo). Las dos listas se comparten EN TEXTO. Y en la
// base, el aviso de los cambios distingue a quien sigues.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

console.log('── 1. La migración del aviso (Z3) ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-cambios-seguidos.sql`, 'utf8')
  check('reemplaza el disparador de la 376, con su tipo nuevo', /create or replace function public\.intercambios_avisar\(\)/.test(sql) && /'trade_match_seguido'/.test(sql))
  check('  …sabe si sigues a quien la da', /from public\.user_follows f where f\.follower_id = w\.user_id and f\.following_id = new\.user_id/.test(sql))
  check('  …y lo dice con su nombre', /'@' \|\| v_quien \|\| ', a quien sigues, da una carta que buscas'/.test(sql))
  check('  …cada uno con SU preferencia apagada', /d\.apagados @> array\[case when d\.sigue then 'trade_match_seguido' else 'trade_match' end\]/.test(sql))
  check('  …y sin repetir lo no leído de ninguno de los dos', /n\.type in \('trade_match', 'trade_match_seguido'\)/.test(sql))
  check('  …con los cuidados de siempre: de 0 a algo y un tope', /coalesce\(new\.cambio, 0\) <= 0 or coalesce\(old\.cambio, 0\) > 0/.test(sql) && /limit 25/.test(sql))
  check('sin tablas temporales (la 631)', !/temp(orary)? table/i.test(sql))
  const notif = readFileSync(`${RAIZ}/js/notifications.js`, 'utf8')
  check('se puede apagar en las preferencias', /trade_match_seguido: 'Cuando alguien a quien sigues da una carta que buscas'/.test(notif))
}

const browser = await chromium.launch()
const CARTAS = [
  { id: 'sv3-125', market: 'WEST', set_id: 'sv3', local_id: '125', name: 'Charizard ex', name_es: 'Charizard ex', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
  { id: 'sv3-26', market: 'WEST', set_id: 'sv3', local_id: '26', name: 'Charmander', name_es: 'Charmander', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
  { id: 'sv3-50', market: 'WEST', set_id: 'sv3', local_id: '50', name: 'Pikachu', name_es: 'Pikachu', image_path: 'x/3', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
]
async function abrir(ruta, { movil = false, doy = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] })
  await ctx.addInitScript(({ CARTAS, doy }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Obsidiana en Llamas', market: 'WEST', serie_id: 'sv', release_date: '2023-08-11', card_count_official: 197 }]
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [
      { id: 'l1', user_id: 'admin-1', card_id: 'sv3-26', market: 'WEST', cantidad: 4, cambio: doy ? 2 : 0, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 0.5, created_at: '2026-10-01T10:00:00Z' },
      { id: 'l2', user_id: 'admin-1', card_id: 'sv3-50', market: 'WEST', cantidad: 2, cambio: doy ? 1 : 0, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
      { id: 'l9', user_id: 'user-2', card_id: 'sv3-125', market: 'WEST', cantidad: 1, cambio: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
    ]
    window.__FAKE_DESEOS__ = [
      { id: 'd1', user_id: 'admin-1', card_id: 'sv3-125', idioma: null, prioridad: 2, created_at: '2026-10-01T10:00:00Z' },
      { id: 'd2', user_id: 'user-2', card_id: 'sv3-26', idioma: null, prioridad: 1, created_at: '2026-10-01T10:00:00Z' },
      { id: 'd3', user_id: 'user-3', card_id: 'sv3-26', idioma: 'es', prioridad: 1, created_at: '2026-10-01T10:00:00Z' },
    ]
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'ana' }, { id: 'user-3', username: 'leo' }]
  }, { CARTAS, doy })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
const seg = (page, panel) => page.$$eval(`#${panel} .mc-deseos-seg [data-deseos-vista]`, (bs) => bs.map((b) => `${b.querySelector('span:not(.mc-deseos-n)').textContent.trim()}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`))

console.log('── 2. Una pantalla, tres vistas ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('arriba, «Deseos y cambios» con las tres vistas y «La quiero» puesta', /Deseos y cambios/.test(await page.textContent('#mcPanelQuiero .mc-subtitulo')) && (await seg(page, 'mcPanelQuiero')).join() === 'Mercado,La quiero*,Las que doy,Cruces', JSON.stringify(await seg(page, 'mcPanelQuiero')))
  check('  …y lo que quieres, como siempre', (await page.locator('#mcQuieroPanel .mc-deseo-baldosa').count()) === 1 && (await page.isVisible('#mcQuieroPanel')))
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(900)
  const doy = await page.$$eval('#mcDoyPanel .mc-doy-baldosa', (fs) => fs.map((f) => f.textContent.replace(/\s+/g, ' ').trim()))
  check('«Las que doy»: tus dos, cada una con lo que das', doy.length === 2 && doy.some((t) => /Charmander/.test(t) && /Doy 2 de/.test(t)) && doy.some((t) => /Pikachu/.test(t) && /Doy 1 de/.test(t)), JSON.stringify(doy))
  check('  …su precio (o «sin precio»)', doy.some((t) => /Charmander.*0,50/.test(t)) && doy.some((t) => /Pikachu.*sin precio/.test(t)), JSON.stringify(doy))
  check('  …y cuánta gente la busca', doy.some((t) => /La buscan 2.*Charmander/.test(t)) && doy.some((t) => /Pikachu.*Nadie la busca aún/.test(t)), JSON.stringify(doy))
  check('  …con la cabecera: copias que das y lo que valen', /3 copias que das · unos 1,00 €/.test((await page.textContent('#mcDoyPanel .mc-quiero-cifra')).replace(/\s+/g, ' ')), await page.textContent('#mcDoyPanel .mc-quiero-cifra'))
  check('  …y «La quiero» se esconde', !(await page.isVisible('#mcQuieroPanel')) && (await seg(page, 'mcPanelQuiero')).join() === 'Mercado,La quiero,Las que doy*,Cruces')
  await page.click('#mcDoyCompartir')
  await page.waitForTimeout(400)
  const texto = await page.evaluate(() => navigator.clipboard.readText())
  // Desde la 766 es UN texto con las dos listas y el enlace (DC1).
  check('«Compartir lista» deja la lista en TEXTO', /^Busco:\n• Charizard ex/.test(texto) && /\n\nDoy:\n• Charmander \(Obsidiana en Llamas · 26\) ×2/.test(texto) && /• Pikachu \(Obsidiana en Llamas · 50\)$/m.test(texto) && /Escríbeme en PokeDoc: http/.test(texto), texto)
  if (CAPS) await page.screenshot({ path: `${CAPS}/763-doy.png` })
  await page.click('#mcDoyPanel .mc-deseo-quien')
  await page.waitForTimeout(1200)
  check('«La buscan 2 personas» lleva a los cruces', /ver=cambios/.test(page.url()) && (await page.isVisible('#mcPanelCambios')) && (await seg(page, 'mcPanelCambios')).join() === 'Mercado,La quiero,Las que doy,Cruces*', JSON.stringify(await seg(page, 'mcPanelCambios')))
  await page.click('#mcPanelCambios [data-deseos-vista="quiero"]')
  await page.waitForTimeout(900)
  check('  …y desde los cruces, de vuelta a «La quiero»', /ver=quiero/.test(page.url()) && (await page.isVisible('#mcQuieroPanel')) && (await seg(page, 'mcPanelQuiero')).join() === 'Mercado,La quiero*,Las que doy,Cruces')
  await page.click('#mcQuieroTexto')
  await page.waitForTimeout(400)
  const busco = await page.evaluate(() => navigator.clipboard.readText())
  check('la de lo que buscas también se comparte en texto (la misma, con las dos)', /^Busco:\n• Charizard ex \(Obsidiana en Llamas · 125\)/.test(busco) && /Doy:/.test(busco), busco)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Sin nada que dar, y en el iPhone ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero', { movil: true, doy: false })
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(700)
  check('sin nada a cambio, lo dice y ofrece «Poner más para cambio» (772)', /Todavía no das ninguna/.test(await page.textContent('#mcDoyPanel')) && (await page.locator('#mcDoyPanel #mcDoyPoner').count()) === 1)
  const s = await page.$$eval('#mcPanelQuiero .mc-deseos-seg .seg-btn', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)))
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('el selector, a lo ancho y de 44', s.length === 4 && s.every((h) => h >= 44) && ancho <= 1, JSON.stringify({ s, ancho }))
  if (CAPS) await page.screenshot({ path: `${CAPS}/763-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
