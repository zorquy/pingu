// Tanda 912 — las chapas de idioma, todas con su sigla, y el esqueleto del
// Panel solo en el Panel.
//
// PINGU: «siempre parece que algunos o el primero sale nombre completo y
// luego los otros con abreviación. Prefiero que sean todos bandera +
// abreviación». Y: «cuando yo cargo otra página se va todo a la mierda…
// prefiero que no se mueva tanto al recargar» — en Expansiones, el
// esqueleto del Panel salía ENCIMA de la estantería mientras llegaban tus
// cartas, y al cambiar de catálogo volvía a salir y lo empujaba todo.
//
// Lo que se mira:
//   1. Las chapas de la hoja de añadir, de «La quiero» y de /carta: bandera
//      y sigla en todas (también en la elegida), el nombre en aria-label.
//   2. /mi-coleccion?ver=album: el esqueleto del Panel no se ve ni en el
//      primer pintado (antes de que corra el JS), ni después.
//   3. Cambiar de catálogo en Expansiones no mueve la cabecera ni saca el
//      esqueleto del Panel; la estantería vieja deja paso a la de carga.
//   4. En el Panel, el esqueleto sí sale mientras cargan tus cartas.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const SETS = [
  { id: 'bw10', name: 'Plasma Blast', serie_id: 'bw', market: 'WEST', release_date: '2013-08-14', card_count_official: 101 },
  { id: 'sv8', name: 'Surging Sparks', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
  { id: 'M6A', name: '30th Celebration (Japanese)', serie_id: 'm', market: 'JP', release_date: '2026-09-16', card_count_official: 100 },
]
const carta = (id, set, n, nombre, market = 'WEST') => ({ id, market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: SETS.find((s) => s.id === set).name, serie_id: SETS.find((s) => s.id === set).serie_id } })
const CARTAS = [carta('bw10-96', 'bw10', 96, 'Virizion-EX'), carta('sv8-238', 'sv8', 238, 'Pikachu ex'), carta('M6A-001', 'M6A', 1, 'Exeggcute', 'JP')]
const COLECCION = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv8-238', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' }]

const browser = await chromium.launch()
async function abrir({ movil = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = []
    window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu' }]
    window.__FAKE_PRECIOS__ = []
    window.__FAKE_IDIOMAS_SET__ = { bw10: ['de', 'en', 'fr', 'it', 'pt'], M6A: ['ja', 'ko', 'zh'] }
    // Lo que se ve ANTES de que corra el JS de la página: `interactive`
    // llega antes que los módulos diferidos.
    // `interactive` llega antes que los módulos diferidos; se mira en el
    // primer cuadro, que es lo primero que se PINTA (las hojas del <head>
    // ya han llegado: bloquean el pintado).
    document.addEventListener('readystatechange', () => {
      if (document.readyState !== 'interactive') return
      requestAnimationFrame(() => {
        const e = document.getElementById('mcCargando')
        window.__ESQ_PRIMER_PINTADO__ = e ? getComputedStyle(e).display : 'sin'
        window.__ESQ_MARCA__ = document.documentElement.classList.contains('mc-sin-esq-panel')
      })
    })
  }, { SETS, CARTAS, COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
}
const textos = (page, sel) => page.$$eval(`${sel} .mc-idioma-chip`, (cs) => cs.map((c) => `${c.dataset.idioma}=${c.querySelector('span')?.textContent.trim()}|${c.getAttribute('aria-label')}|${c.querySelector('.pv-bandera') ? 'b' : '-'}`))
const todasConSigla = (lista) => lista.every((t) => { const [par, , band] = t.split('|'); const [id, txt] = par.split('='); return id ? txt === id.toUpperCase() && band === 'b' : txt === 'Cualquiera' && band === '-' })

console.log('── 1. Las chapas: bandera y sigla en todas ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=bw10')
  await page.click('#mcAlbum .mc-mas[data-anadir="bw10-96"]')
  await page.waitForTimeout(700)
  const a = await textos(page, '#mcAdIdiomas')
  check('la hoja de añadir: todas con su sigla, la elegida también', a.length === 5 && todasConSigla(a), a.join(' '))
  check('  …y el nombre en voz alta', a.some((t) => t.includes('|Inglés|')), a.join(' '))
  await page.click('#mcAdIdiomas .mc-idioma-chip[data-idioma="fr"]')
  check('  …tocar otra no cambia la forma', todasConSigla(await textos(page, '#mcAdIdiomas')))
  await page.keyboard.press('Escape')
  await page.locator('#mcAlbum [data-carta="bw10-96"]').first().click()
  await page.waitForTimeout(900)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(600)
  const q = await textos(page, '#iddChips')
  check('«La quiero»: «Cualquiera» con su palabra y el resto con su sigla', q.length === 6 && todasConSigla(q), q.join(' '))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/carta.html?id=bw10-96`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.click('#cmAnadir')
  await page.waitForTimeout(800)
  const c = await textos(page, '#cmAdIdiomas')
  check('/carta: todas con su sigla', c.length === 5 && todasConSigla(c), c.join(' '))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=M6A&catalogo=JP')
  await page.click('#mcAlbum .mc-mas[data-anadir="M6A-001"]')
  await page.waitForTimeout(700)
  const j = await textos(page, '#mcAdIdiomas')
  check('una japonesa: JA, KO y ZH', j.map((t) => t.split('|')[0]).join() === 'ja=JA,ko=KO,zh=ZH', j.join(' '))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2 y 3. El esqueleto del Panel, fuera de Expansiones ──')
for (const movil of [false, true]) {
  const { ctx, page, errores } = await abrir({ movil })
  const donde = movil ? 'móvil' : 'PC'
  await ir(page, '/mi-coleccion.html?ver=album')
  check(`${donde}: en el primer pintado, sin el esqueleto del Panel`, (await page.evaluate(() => window.__ESQ_PRIMER_PINTADO__)) === 'none', JSON.stringify(await page.evaluate(() => [window.__ESQ_PRIMER_PINTADO__, window.__ESQ_MARCA__])))
  const visible = () => page.evaluate(() => { const e = document.getElementById('mcCargando'); return !!e && getComputedStyle(e).display !== 'none' && !e.classList.contains('hidden') })
  check(`${donde}: y después, tampoco`, !(await visible()))
  const antes = await page.$eval('#mcPanelAlbum', (p) => Math.round(p.getBoundingClientRect().top + scrollY))
  // Al cambiar de catálogo, en el mismo instante: ni esqueleto del Panel ni salto.
  const justo = await page.evaluate(async () => {
    document.querySelector('#mcPanelAlbum .seg-btn[data-vista="ja"]').click()
    await new Promise((ok) => requestAnimationFrame(() => ok()))
    const e = document.getElementById('mcCargando')
    return {
      esq: !!e && getComputedStyle(e).display !== 'none' && !e.classList.contains('hidden'),
      top: Math.round(document.getElementById('mcPanelAlbum').getBoundingClientRect().top + scrollY),
      viejas: [...document.querySelectorAll('#mcEstanteriaRejilla [data-set]')].map((x) => x.dataset.set).filter((id) => id === 'bw10' || id === 'sv8').length,
    }
  })
  check(`${donde}: al cambiar a Pokémon Japón no sale el esqueleto del Panel`, !justo.esq)
  check(`${donde}:   …y Expansiones no se mueve de su sitio`, Math.abs(justo.top - antes) <= 1, `${antes} → ${justo.top}`)
  check(`${donde}:   …y la estantería occidental no se queda rotulada como japonesa`, justo.viejas === 0, String(justo.viejas))
  await page.waitForTimeout(1600)
  const japonesas = await page.$$eval('#mcEstanteriaRejilla [data-set]', (xs) => xs.map((x) => x.dataset.set))
  check(`${donde}:   …y llega la japonesa`, japonesas.includes('M6A'), japonesas.join())
  check(`${donde}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. En el Panel, el esqueleto sí ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html')
  check('el primer pintado del Panel lleva su esqueleto', (await page.evaluate(() => window.__ESQ_PRIMER_PINTADO__)) !== 'none', await page.evaluate(() => window.__ESQ_PRIMER_PINTADO__))
  check('  …y se va cuando llegan tus cartas', await page.$eval('#mcCargando', (e) => e.classList.contains('hidden')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
