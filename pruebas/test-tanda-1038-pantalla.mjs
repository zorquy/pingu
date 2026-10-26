// Tanda 1038 — Colección, contenido primero (PINGU: «haz todo lo
// recomendado» de la propuesta): chips y pestañas de 36 px a la vista y 44
// al dedo; Deseos y cambios con «Mercado · Quiero · Doy · Cruces» enteras y
// Evento en icono; el Mercado sin selector de catálogo; Productos sin texto
// ni título; la Pokédex sin el contador; Empezadas / Todas / Completas
// dentro de «Orden y filtro»; /cartas sin título a la vista. Y en todas, lo
// que se viene a ver empieza antes del 35 % de la pantalla del iPhone.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const N = ['Pikachu ex', 'Charizard ex', 'Eevee', 'Snorlax', 'Gengar ex', 'Lapras']
const carta = (set, market, i) => ({ id: `${set}-${i + 1}`, market, set_id: set, local_id: String(i + 1), name: N[i], name_es: N[i], image_path: `sv/${set}/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, dex_ids: [25 + i] })
const CARTAS = [...N.map((_, i) => carta('sv8', 'WEST', i)), ...N.slice(0, 3).map((_, i) => carta('SV8', 'JP', i))]
const SETS = [
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', tcg_online_code: 'SSP', card_count_official: 6, card_count_total: 6, release_date: '2024-11-08' },
  { id: 'sv7', name: 'Corona Estelar', serie_id: 'sv', market: 'WEST', tcg_online_code: 'SCR', card_count_official: 6, card_count_total: 6, release_date: '2024-09-13' },
  { id: 'SV8', name: 'Super Electric Breaker', serie_id: 'SV', market: 'JP', card_count_official: 6, card_count_total: 6, release_date: '2024-10-18' },
]
const DESEOS = CARTAS.slice(0, 4).map((c, i) => ({ id: `d${i}`, user_id: 'admin-1', card_id: c.id, idioma: null, created_at: `2026-10-2${i}T10:00:00Z` }))
// Una tuya (para «Empezadas») y dos que da otra persona: una de cada catálogo.
const COLECCION = [
  { id: 'l1', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 0 },
  { id: 'l2', user_id: 'user-1', card_id: 'sv8-5', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 1 },
  { id: 'l3', user_id: 'user-1', card_id: 'SV8-2', market: 'JP', idioma: 'ja', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 1 },
]

const b = await chromium.launch()
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_DESEOS__: d.DESEOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_PRECIOS__: [] })
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
  }, { SETS, CARTAS, DESEOS, COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { ctx, page, errores }
}
// Dónde empieza lo primero visible de `sel`, en px desde arriba. La regla es
// «antes del 35 % de la pantalla» de un iPhone de 844 (la de la propuesta):
// 296 px. El perfil «iPhone 13» de Playwright mide 664 de alto (le quita la
// barra de Safari), así que un porcentaje suyo diría otra cosa.
const TOPE = 296
const empieza = (page, sel) => page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 }); return el ? Math.round(el.getBoundingClientRect().top) : Infinity }, sel)
const visto = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' }, sel)

console.log('── 1. Los chips: 36 a la vista, 44 al dedo ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await page.evaluate(() => [...document.querySelectorAll('#mcPanelQuiero .mc-deseos-seg .seg-btn, .mc-quiero-filtro .seg-btn')].filter((x) => x.getBoundingClientRect().width > 0).map((x) => { const a = getComputedStyle(x, '::after'); return { alto: Math.round(x.getBoundingClientRect().height), franja: -parseFloat(a.top) - parseFloat(a.bottom), pos: a.position } }))
  check('las pestañas y los filtros miden 36', m.length >= 7 && m.every((x) => x.alto === 36), JSON.stringify(m.map((x) => x.alto)))
  check('  …y con su franja invisible llegan a 44 para el dedo', m.every((x) => x.pos === 'absolute' && x.alto + x.franja >= 44), JSON.stringify(m.map((x) => x.alto + x.franja)))
  await ctx.close()
}

console.log('── 2. Deseos y cambios: las cuatro enteras y Evento en icono ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero')
  const r = await page.evaluate(() => {
    const seg = document.querySelector('#mcPanelQuiero .mc-deseos-seg')
    const sr = seg.getBoundingClientRect()
    const bs = [...seg.querySelectorAll('.seg-btn')].filter((x) => x.getBoundingClientRect().width > 0)
    const ev = document.querySelector('#mcPanelQuiero .mc-evento-boton')
    const er = ev.getBoundingClientRect()
    return {
      textos: bs.map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
      dentro: bs.every((x) => { const r = x.getBoundingClientRect(); return r.left >= sr.left - 1 && r.right <= sr.right + 1 }),
      sinCortar: bs.every((x) => x.scrollWidth <= x.clientWidth + 1),
      evento: { ancho: Math.round(er.width), alto: Math.round(er.height), texto: ev.innerText.trim(), etiqueta: ev.getAttribute('aria-label'), misma: Math.abs((er.top + er.height / 2) - (sr.top + sr.height / 2)) < 4 },
    }
  })
  check('«Mercado · Quiero 4 · Doy · Cruces»', r.textos.join('|') === 'Mercado|Quiero 4|Doy|Cruces', r.textos.join('|'))
  check('  …las cuatro dentro de su barra y sin cortarse', r.dentro && r.sinCortar, JSON.stringify(r))
  // Desde la 1041 es una burbuja flotante de 56 (test-tanda-1041-pantalla.mjs).
  check('Evento: un círculo con su icono (flotante desde la 1041)', r.evento.ancho === 56 && r.evento.alto === 56 && r.evento.texto === '', JSON.stringify(r.evento))
  check('  …y su nombre para el lector', r.evento.etiqueta === 'Modo evento')
  check('las cuentas que valen 0 no salen en el móvil', await page.evaluate(() => [...document.querySelectorAll('#mcPanelQuiero .mc-deseos-n.cero')].every((x) => getComputedStyle(x).display === 'none')))
  check('lo primero de La quiero, antes del 35 % (296 px)', (await empieza(page, 'article.mc-deseo-baldosa')) < TOPE, `${await empieza(page, 'article.mc-deseo-baldosa')} px`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
  const pc = await abrir('/mi-coleccion.html?ver=quiero', { movil: false })
  const t = await pc.page.evaluate(() => [...document.querySelectorAll('#mcPanelQuiero .mc-deseos-seg .seg-btn')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()).join('|'))
  check('en el PC, los nombres largos y «Modo evento» con su texto', /La quiero/.test(t) && /Las que doy/.test(t) && (await pc.page.innerText('#mcPanelQuiero .mc-evento-boton')).includes('Modo evento'), t)
  await pc.ctx.close()
}

console.log('── 3. El Mercado: los dos catálogos, sin selector ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=mercado')
  check('sin selector de catálogo', (await page.locator('[data-mercado-catalogo], .mc-mercado-catalogo').count()) === 0)
  const r = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#mcMercadoRejilla [data-merc]')].map((x) => x.dataset.merc), rotulos: [...document.querySelectorAll('#mcMercadoRejilla .mc-catalogo-rotulo')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()) }))
  check('la occidental y debajo la japonesa, cada una con su rótulo', r.ids.join() === 'sv8-5,SV8-2' && r.rotulos.join('|') === 'Pokémon 1|Pokémon Japón 1', JSON.stringify(r))
  const filas = await page.evaluate(() => new Set([...document.querySelectorAll('.mc-mercado-mandos > *')].filter((x) => x.getBoundingClientRect().width > 0).map((x) => Math.round(x.getBoundingClientRect().top / 8))).size)
  check('idioma, orden y «Solo las que busco» en una fila', filas === 1, String(filas))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Productos ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos')
  check('sin el «Todavía no tienes productos…»', !(await page.evaluate(() => /Todavía no tienes productos/.test(document.getElementById('mcProdTuyos')?.textContent || ''))))
  check('sin el título «Expansiones» a la vista', !(await visto(page, '#mcProdNormal > .mc-subtitulo')))
  const c = await page.evaluate(() => { const r = document.querySelector('.mc-prod-catalogo').getBoundingClientRect(); return Math.round(Math.abs(r.left + r.width / 2 - innerWidth / 2)) })
  check('el catálogo, centrado bajo el buscador', c <= 4, `${c}px del centro`)
  check('la estantería empieza antes del 35 % (296 px)', (await empieza(page, '#mcProdSets')) < TOPE, `${await empieza(page, '#mcProdSets')} px`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Pokédex ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=pokedex')
  check('sin el contador de especies en el móvil', !(await visto(page, '#mcPdxEncabezado')))
  check('«Tengo» en vez de «Solo los que tengo»', (await page.innerText('#mcPdxSoloMios')).trim() === 'Tengo')
  check('las especies empiezan antes del 35 % (296 px)', (await empieza(page, '.pdx-rejilla')) < TOPE, `${await empieza(page, '.pdx-rejilla')} px`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
  const pc = await abrir('/mi-coleccion.html?ver=pokedex', { movil: false })
  check('en el PC el contador sigue', await visto(pc.page, '#mcPdxEncabezado'))
  check('  …con «Solo los que tengo» entero', (await pc.page.innerText('#mcPdxSoloMios')).trim() === 'Solo los que tengo')
  await pc.ctx.close()
}

console.log('── 6. Expansiones: una fila, y lo que se ve dentro de «Orden y filtro» ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album')
  check('Empezadas / Todas / Completas ya no están en la barra', await page.evaluate(() => Boolean(document.getElementById('mcEstanteriaEmpezadas')?.closest('#mcEstanteriaOrden'))))
  const o = await page.evaluate(() => { const b = document.getElementById('mcEstanteriaOrdenAbrir'); const r = b.getBoundingClientRect(); return { ancho: Math.round(r.width), etiqueta: b.getAttribute('aria-label'), texto: b.innerText.trim() } })
  check('«Orden» en el móvil es un icono con su nombre para el lector', o.ancho === 44 && o.texto === '' && o.etiqueta === 'Orden y filtro', JSON.stringify(o))
  check('las expansiones empiezan antes del 35 % (296 px)', (await empieza(page, '#mcEstanteriaRejilla .mc-set-tarjeta')) < TOPE, `${await empieza(page, '#mcEstanteriaRejilla .mc-set-tarjeta')} px`)
  await page.click('#mcEstanteriaOrdenAbrir')
  await page.waitForTimeout(400)
  check('la hoja se llama «Orden y filtro» y empieza por «Mostrar»', (await page.innerText('#mcEstanteriaOrdenTitulo')) === 'Orden y filtro' && (await page.$eval('#mcEstanteriaOrden .mc-filtro-titulo', (p) => p.textContent.trim())) === 'Mostrar')
  await page.click('#mcEstanteriaCompletas')
  await page.waitForTimeout(500)
  await page.click('#mcEstanteriaOrdenVer')
  await page.waitForTimeout(500)
  check('«Completas» filtra (ninguna completa: no queda ninguna)', (await page.locator('#mcEstanteriaRejilla .mc-set-tarjeta').count()) === 0)
  check('  …y «Orden» se marca, que algo de su hoja no está como viene', await page.$eval('#mcEstanteriaOrdenAbrir', (b) => b.classList.contains('activo')))
  await page.click('#mcEstanteriaOrdenAbrir')
  await page.waitForTimeout(300)
  await page.click('#mcEstanteriaEmpezadas')
  await page.waitForTimeout(500)
  await page.click('#mcEstanteriaOrdenVer')
  await page.waitForTimeout(500)
  const ids = await page.$$eval('#mcEstanteriaRejilla [data-set]', (xs) => xs.map((x) => x.dataset.set))
  check('«Empezadas»: solo la tuya', ids.join() === 'sv8', ids.join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 7. /cartas ──')
{
  const { ctx, page, errores } = await abrir('/cartas')
  const t = await page.evaluate(() => { const h = document.getElementById('mcTitulo'); return { existe: Boolean(h), texto: h?.textContent.trim(), alto: Math.round(h.getBoundingClientRect().height) } })
  check('el título «Cartas…» sigue (Google, lector) sin ocupar sitio', t.existe && t.texto.startsWith('Cartas') && t.alto <= 1, JSON.stringify(t))
  const f = await page.evaluate(() => { const a = document.getElementById('mcEstanteriaBusca').getBoundingClientRect(); const o = document.getElementById('mcEstanteriaOrdenAbrir').getBoundingClientRect(); return Math.abs((a.top + a.height / 2) - (o.top + o.height / 2)) })
  check('el buscador y «Orden» en la misma fila', f < 6, `${f}px`)
  check('las expansiones empiezan antes del 35 % (296 px)', (await empieza(page, '#mcEstanteriaRejilla .mc-set-tarjeta')) < TOPE, `${await empieza(page, '#mcEstanteriaRejilla .mc-set-tarjeta')} px`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
