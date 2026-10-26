// Tanda 1028 — en la ficha, una versión de TCGGO sin precio por idioma lo
// pide al abrirse y se repinta: la Reverse pasa de «0,10 €, cualquier idioma»
// al español que da TCGGO, y su botón de Cardmarket lleva a ESA versión con
// los filtros (producto, idioma, estado y reverse), no a una búsqueda.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const SETS = [{ id: 'swsh3', name: 'Oscuridad Incandescente', name_en: 'Darkness Ablaze', serie_id: 'swsh', market: 'WEST', release_date: '2020-08-14', card_count_official: 189, card_count_total: 201, tcggo_id: 160 }]
const CARTAS = [{ id: 'swsh3-140', set_id: 'swsh3', local_id: '140', name: 'Lugia', market: 'WEST', category: 'Pokemon', rarity: 'Rare', rarity_en: 'Rare', image_path: 'swsh/swsh3/140', variants: { normal: true, reverse: true, holo: false, firstEdition: false }, cm_id_product: null, cm_id_product_propio: null }]
// La fila de la Reverse como la deja la pasada de precios: un solo precio
// (el de todos los idiomas), sin producto, con el enlace de TCGGO.
const VERSIONES = [{ tcggo_id: 35162, market: 'WEST', card_id: 'swsh3-140', set_id: 'swsh3', etiqueta: 'Reverse Holo', cm_id_product: null, link_cm: 'https://www.tcggo.com/external/cm/35162', cm_low: 0.1, cm_low_es: null, actualizado_at: '2026-10-22T03:00:00Z' }]
const DESPUES = [{ ...VERSIONES[0], cm_id_product: 877413, cm_low: 0.5, cm_low_en: 5, cm_low_de: 0.5, cm_low_fr: 10, cm_low_es: 25, cm_low_it: 2, actualizado_at: '2026-10-26T10:00:00Z' }]

const b = await chromium.launch()
async function abrir(ruta, { funcion = true, sesion = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion ? 'user-1' : 'none'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_PRECIOS__: [] })
    window.__FAKE_COLECCION__ = d.sesion ? [{ id: 'l1', user_id: 'user-1', card_id: 'swsh3-140', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'reverse', cantidad: 1 }] : []
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    localStorage.setItem('pokedoc-onboarding', '1')
  }, { SETS, CARTAS, VERSIONES, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88"/>' }))
  // La genérica ANTES: Playwright mira primero la última ruta registrada.
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const pedidas = []
  await ctx.route(/\/\.netlify\/functions\/tcggo-versiones-ahora/, (r) => {
    pedidas.push(r.request().url())
    r.fulfill(funcion ? { status: 200, contentType: 'application/json', body: JSON.stringify({ filas: DESPUES, pedido: true, nuevas: 1 }) } : { status: 502, contentType: 'application/json', body: '{"error":"no"}' })
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { ctx, page, pedidas, errores }
}
const tarjeta = (page) => page.evaluate(() => { const a = document.querySelector('#mcEdPrecioBloque .pv-tarjeta-tuya'); return a ? { texto: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') } : null })

console.log('── 1. Tu copia Reverse, abierta desde el buscador ──')
{
  const { ctx, page, pedidas, errores } = await abrir('/mi-coleccion.html?ver=buscar&q=lugia&carta=swsh3-140', { sesion: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la ficha se abre en tu copia y pide los precios por idioma de sus versiones (una vez)', (await page.evaluate(() => document.getElementById('mcEditor')?.open && /reverse/i.test(document.getElementById('mcEdVersionNombre')?.textContent || ''))) && pedidas.length === 1 && /card=swsh3-140&market=WEST/.test(pedidas[0]), pedidas.join())
  const t = await tarjeta(page)
  check('la tarjeta de tu copia (español) dice 25,00 €, mínimo en español', t && /25,00 €/.test(t.texto) && /mínimo en español/.test(t.texto), JSON.stringify(t))
  check('  …y su enlace va a esa versión en Cardmarket: producto, español, NM y reverse', t && /idProduct=877413/.test(t.href) && /language=4/.test(t.href) && /isReverseHolo=Y/.test(t.href) && /minCondition=/.test(t.href), t?.href)
  const lista = await page.evaluate(() => [...document.querySelectorAll('#mcEdVersiones .mc-version')].map((v) => `${v.dataset.version}:${v.querySelector('.mc-version-precio')?.textContent.trim()}`))
  check('  …y en la lista de versiones la Reverse también va a 25,00 €', lista.some((x) => /^reverse:25,00\s?€$/.test(x)), lista.join(' | '))
  await ctx.close()
}

console.log('\n── 2. Si la función no contesta, lo de antes con su enlace de TCGGO ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=buscar&q=lugia&carta=swsh3-140', { sesion: true, funcion: false })
  const t = await tarjeta(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la Reverse sigue con su único precio, y lo dice: «cualquier idioma»', t && /0,10 €/.test(t.texto) && /cualquier idioma/.test(t.texto), JSON.stringify(t))
  check('  …y el botón va al enlace de TCGGO a esa versión, no a una búsqueda por nombre', t && t.href === 'https://www.tcggo.com/external/cm/35162', t?.href)
  await ctx.close()
}

console.log('\n── 3. Sin cuenta, desde el catálogo: la lista de versiones se repinta igual ──')
{
  const { ctx, page, pedidas, errores } = await abrir('/cartas?ver=buscar&q=lugia&carta=swsh3-140')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const lista = await page.evaluate(() => [...document.querySelectorAll('#mcEdVersiones .mc-version')].map((v) => `${v.dataset.version}:${v.querySelector('.mc-version-precio')?.textContent.trim()}`))
  check('se pide una vez y la Reverse de la lista pasa a 25,00 €', pedidas.length === 1 && lista.some((x) => /^reverse:25,00\s?€$/.test(x)), `${pedidas.length} | ${lista.join(' | ')}`)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
