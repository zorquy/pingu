// Tanda 998 — una carta se enseña igual la abras por donde la abras.
//
// PINGU, con el Aerodactyl de Legend Maker: el pop-up decía «Holo / Reverse
// holo» y «Rara Holo», y la ficha completa repetía las versiones debajo
// («Versiones en Cardmarket», Standard 6,45 € / Standard 35,00 €) y decía
// «★ Rara». «Que seamos congruentes y cojamos solo un sitio.» Y en el
// buscador: el catálogo salía dos veces, los filtros ocupaban media pantalla
// y una carta a veces abría el pop-up y a veces la ficha completa.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  check('el bloque «Versiones en Cardmarket» ya no existe', !existsSync(`${RAIZ}/js/carta-versiones.js`) && !/cmVersiones|Versiones en Cardmarket/.test(readFileSync(`${RAIZ}/js/carta-mercado.js`, 'utf8')))
  const mercado = readFileSync(`${RAIZ}/js/carta-mercado.js`, 'utf8')
  check('/carta trae las versiones con el MISMO cargador que el pop-up (con las de a mano)', /versionesDeCartas\(\[carta\.id\]\)/.test(mercado))
  const borde = readFileSync(`${RAIZ}/netlify/edge-functions/meta-social.js`, 'utf8')
  const cols = (borde.match(/const COLUMNAS_CARTA =([\s\S]*?)\n\n/) || [])[1] || ''
  check('el servidor pide `rarity_en` (pintaba «Rara» donde el pop-up dice «Rara Holo»)', /\brarity_en\b/.test(cols) && /\brarity\b/.test(cols), cols.slice(0, 120))
  const { rutaDeCartaEnBuscar } = await import(`${RAIZ}/js/carta-ruta.js`)
  check('una carta de la lupa va al pop-up de Buscar, con lo buscado', rutaDeCartaEnBuscar({ id: 'ex11-1', market: 'WEST' }, ' aero ') === '/cartas?ver=buscar&q=aero&carta=ex11-1', rutaDeCartaEnBuscar({ id: 'ex11-1' }, ' aero '))
  check('  …la japonesa dice su catálogo; sin búsqueda, sin `q`', rutaDeCartaEnBuscar({ id: 'SV2a-1', market: 'JP' }) === '/cartas?ver=buscar&carta=SV2a-1&catalogo=JP')
  const filas = readFileSync(`${RAIZ}/js/buscador-filas.js`, 'utf8')
  check('  …y es lo que usan /buscar y la paleta (`destinoDe`)', /if \(grupo === 'cartas'\) return rutaDeCartaEnBuscar\(f, q\)/.test(filas))
}

const SETS = [
  { id: 'ex11', name: 'Legend Maker', serie_id: 'ex', market: 'WEST', release_date: '2006-02-13', card_count_official: 92, card_count_total: 93 },
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230 },
]
const CARTAS = [
  { id: 'ex11-1', set_id: 'ex11', local_id: '1', name: 'Aerodactyl', market: 'WEST', category: 'Pokemon', rarity: 'Rare', rarity_en: 'Rare Holo', image_path: 'ex/ex11/1', variants: { normal: false, holo: true, reverse: true }, detalle_at: new Date().toISOString() },
  { id: 'sv3-1', set_id: 'sv3', local_id: '1', name: 'Aerodactyl ex', market: 'WEST', category: 'Pokemon', image_path: 'sv/sv3/1' },
]
const VERSIONES = [{ tcggo_id: 50939, card_id: 'ex11-1', set_id: 'ex11', etiqueta: 'Cosmos Holo', origen: 'mano', cm_low: 3, cm_low_es: 3 }]
const browser = await chromium.launch()
const errores = []
async function abrir(ruta, { movil = true, sesion = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, VERSIONES, sesion }) => {
    window.__FAKE_SESSION__ = sesion ? 'user-1' : 'none'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_VERSIONES__ = VERSIONES
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRECIOS__ = [{ card_id: 'ex11-1', cm_low: 6.45, cm_low_en: 35, checked_at: new Date().toISOString() }]
  }, { SETS, CARTAS, VERSIONES, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(`${ruta}: ${String(e).slice(0, 160)}`))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  return { ctx, page }
}

console.log('── 2. La ficha completa ──')
{
  const { ctx, page } = await abrir('/carta.html?id=ex11-1')
  await page.click('.carta-pestanas [data-pestana="precio"]').catch(() => {})
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => ({
    bloque: Boolean(document.getElementById('cmVersiones') || document.querySelector('.cv-titulo')),
    chapas: [...document.querySelectorAll('#cmPrecios .pv-impresion b')].map((b) => b.textContent.trim()),
    rareza: [...document.querySelectorAll('#cartaNucleo *')].map((e) => e.textContent).find((t) => /Rara/.test(t) && t.length < 40) || '',
  }))
  check('sin «Versiones en Cardmarket» debajo', !r.bloque)
  check('las versiones son las chapas del precio, con la de a mano (Cosmos Holo)', r.chapas.includes('Cosmos Holo') && r.chapas.length >= 2, JSON.stringify(r.chapas))
  check('la rareza es la del pop-up: «Rara Holo»', /Rara Holo/.test(r.rareza), r.rareza)
  await ctx.close()
}

console.log('── 3. La lupa de arriba abre el pop-up ──')
{
  const { ctx, page } = await abrir('/cartas?ver=buscar&q=aerodactyl&carta=ex11-1')
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => ({ abierto: document.getElementById('mcEditor')?.open, url: location.search, nombre: document.getElementById('mcEditor')?.textContent.includes('Aerodactyl') }))
  check('`?carta=` abre la carta en el pop-up', r.abierto && r.nombre, JSON.stringify(r))
  check('  …y sale de la dirección (recargar no la vuelve a abrir), la búsqueda se queda', !/carta=/.test(r.url) && /q=aerodactyl/.test(r.url), r.url)
  await ctx.close()
  const otra = await abrir('/cartas?ver=buscar&q=aerodactyl&carta=ex11-1', { movil: false, sesion: true })
  await otra.page.waitForTimeout(800)
  check('  …también con cuenta y en el PC', await otra.page.evaluate(() => document.getElementById('mcEditor')?.open))
  await otra.ctx.close()
  // Mayús+Intro en la paleta (718) llega con #anadir: el diálogo de añadir.
  const ya = await abrir('/cartas?ver=buscar&q=aerodactyl&carta=ex11-1#anadir', { sesion: true })
  await ya.page.waitForTimeout(800)
  const a = await ya.page.evaluate(() => ({ dialogo: document.getElementById('mcAnadirDialogo')?.open, url: location.href }))
  check('  …y con `#anadir`, el diálogo de añadir abierto (y sin el `#anadir` en la dirección)', a.dialogo && !/#anadir|carta=/.test(a.url), JSON.stringify(a))
  await ya.ctx.close()
}

console.log('── 4. Los filtros de Buscar ──')
{
  const { ctx, page } = await abrir('/cartas?ver=buscar&q=aerodactyl')
  const r = await page.evaluate(() => {
    const vis = (e) => e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden'
    const mandos = document.querySelector('#mcBuscarBarra .mc-mandos')
    const hijos = [...mandos.querySelectorAll('button, select')].filter(vis)
    return {
      catalogos: [...document.querySelectorAll('.mc-mercado')].filter(vis).length,
      afinarDentro: Boolean(mandos.querySelector('#mcBuscarAfinar')),
      alturas: [...new Set(hijos.map((h) => Math.round(h.getBoundingClientRect().top)))],
      alto: Math.max(...hijos.map((h) => Math.round(h.getBoundingClientRect().height))),
      ids: hijos.map((h) => h.id),
      resultados: Math.round(document.getElementById('mcBuscarResultados').getBoundingClientRect().top),
    }
  })
  check('en el móvil el catálogo sale UNA vez (el de arriba)', r.catalogos === 1, r.catalogos)
  // «Solo las que tengo» no sale sin cuenta: no tienes ninguna.
  check('serie, expansión y «Variantes juntas» en la fila de Filtros y orden', r.afinarDentro && ['mcBuscarAbrirFiltros', 'mcBuscarAbrirOrden', 'mcBuscarSerie', 'mcBuscarSet', 'mcBuscarVariantes'].every((id) => r.ids.includes(id)), r.ids.join())
  check('  …en UNA línea de 44 px (nada se parte en dos renglones)', r.alturas.length === 1 && r.alto <= 46, JSON.stringify(r))
  check('  …y las cartas empiezan antes de un tercio de la pantalla', r.resultados < 300, r.resultados)
  await ctx.close()
  const con = await abrir('/cartas?ver=buscar&q=aerodactyl', { sesion: true })
  const c = await con.page.evaluate(() => {
    const hijos = [...document.querySelectorAll('#mcBuscarBarra .mc-mandos button, #mcBuscarBarra .mc-mandos select')].filter((e) => e.getBoundingClientRect().height > 0)
    return { que: !!document.querySelector('#mcBuscarQue:not(.hidden) [data-bus-que="tengo"]'), ids: hijos.map((h) => h.id), alturas: [...new Set(hijos.map((h) => Math.round(h.getBoundingClientRect().top)))], alto: Math.max(...hijos.map((h) => Math.round(h.getBoundingClientRect().height))) }
  })
  // 1054: «Solo las que tengo» es Todas/Tengo/Faltan (`#mcBuscarQue`).
  check('con cuenta, Todas/Tengo/Faltan también en la misma línea y sin partirse', c.que && c.alturas.length === 1 && c.alto <= 46, JSON.stringify(c))
  await con.ctx.close()
  const pc = await abrir('/cartas?ver=buscar&q=aerodactyl', { movil: false })
  const n = await pc.page.evaluate(() => [...document.querySelectorAll('.mc-mercado')].filter((e) => e.getBoundingClientRect().height > 0).length)
  check('en el PC sigue el suyo (arriba no hay otro)', n === 1, n)
  await pc.ctx.close()
}

check('sin errores en ninguna página', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
