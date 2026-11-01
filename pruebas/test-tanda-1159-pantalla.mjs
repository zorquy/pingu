// Tanda 1159 — los dos botones nuevos de /admin → Colecciones, en pantalla:
// «Traer ahora lo que falta de TCGdex» (solo en el set de las MEP) y
// «Buscar en Cardmarket» junto al id de Cardmarket de una carta.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const set = (id, name) => ({ id, name, name_en: name, serie_id: 'me', market: 'WEST', release_date: '2025-09-26', card_count_official: 110, card_count_total: 110, tcg_online_code: id.toUpperCase() })
const SETS = [set('mep', 'MEP Black Star Promos'), set('me1', 'Mega Evolution')]
const carta = (id, n, name, extra = {}) => ({ id, market: 'WEST', set_id: 'mep', local_id: n, name, name_en: name, image_path: null, category: 'Pokemon', variants: { holo: true }, origen: null, ...extra })
const CARTAS = [carta('mep-001', '001', 'Charmander', { cm_id_product_propio: 851043 }), carta('mep-090', '090', 'Mega Darkrai ex', { origen: 'relleno' })]
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
await ctx.addInitScript((d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_ERAS__: [] })
}, { SETS, CARTAS })
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|raw\.githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
const pedidas = []
await ctx.route(/\/\.netlify\/functions\//, async (r) => {
  const url = r.request().url()
  pedidas.push({ url, metodo: r.request().method(), cuerpo: r.request().postData(), auth: r.request().headers().authorization || '' })
  if (/tcgdex-rellenar-ahora/.test(url)) {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, hecho: { suyas: 111, teniamos: 107, faltaban: 4, escritas: 4, numeros: '089, 090, 091, 092', conCardmarket: 4, sinFoto: 3 }, web: { ok: true } }) })
  }
  if (/cardmarket-buscar/.test(url)) {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, total: 2, expansionesCerca: [6100], conPrecio: true, resultados: [
      { idProduct: 903676, nombre: 'Mega Darkrai ex', ataques: ['Dark Eclipse'], idExpansion: 6100, misma: true, precio: { low: 12.5, trend: 14 }, enlace: 'https://www.cardmarket.com/es/Pokemon/Products?idProduct=903676' },
      { idProduct: 880001, nombre: 'Darkrai ex', ataques: ['Dark Bolt'], idExpansion: 5900, misma: false, precio: null, enlace: 'https://www.cardmarket.com/es/Pokemon/Products?idProduct=880001' },
    ] }) })
  }
  return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
})
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))

await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(1800)
await p.locator('[data-section="colecciones"]').click()
await p.waitForTimeout(500)
await p.locator('#coleccionesMercado').selectOption('WEST').catch(() => {})
await p.waitForTimeout(500)
await p.locator('#coleccionesDesplegar').click()

console.log('── «Traer ahora lo que falta de TCGdex» ──')
await p.locator('[data-editar="me1"]').click()
await p.waitForTimeout(300)
check('en un set que no es de rellenos, no sale', (await p.locator('#colTcgdexAhora').count()) === 0)
await p.locator('[data-cerrar-hoja]').first().click().catch(() => {})
await p.waitForTimeout(300)
await p.locator('[data-editar="mep"]').click()
await p.waitForTimeout(300)
check('en las MEP sí, con cada cuánto se completa', (await p.locator('#colTcgdexAhora').isVisible()) && /cada 7 días/.test(await p.locator('.col-relleno').innerText()))
await p.locator('#colTcgdexAhora').click()
await p.waitForFunction(() => /escritas/.test(document.getElementById('colTcgdexRes')?.textContent || ''), null, { timeout: 5000 }).catch(() => {})
const res = await p.locator('#colTcgdexRes').innerText()
const peticion = pedidas.find((x) => /tcgdex-rellenar-ahora/.test(x.url))
check('pide la pasada de ESE relleno, por POST y con la sesión', peticion?.metodo === 'POST' && JSON.parse(peticion.cuerpo || '{}').clave === 'mep-tcgdex' && /^Bearer/.test(peticion.auth), JSON.stringify(peticion))
check('  …y cuenta lo que ha hecho', /Faltaban 4; escritas todas \(089, 090, 091, 092\)/.test(res) && /La web ya las enseña/.test(res), res)
await p.screenshot({ path: '/tmp/1159-relleno.png' })

console.log('── «Buscar en Cardmarket» ──')
await p.locator('#colCartas').click()
await p.waitForTimeout(800)
await p.locator('[data-editar-carta="mep-090"]').click()
await p.waitForTimeout(800)
check('junto al id de Cardmarket sale «Buscar en Cardmarket»', await p.locator('.cmb-abrir').isVisible())
await p.locator('.cmb-abrir').click()
await p.waitForFunction(() => document.querySelectorAll('[data-cmb-usar]').length > 0, null, { timeout: 5000 }).catch(() => {})
const busqueda = pedidas.find((x) => /cardmarket-buscar/.test(x.url))
const u = busqueda ? new URL(busqueda.url) : null
check('busca sola por el nombre inglés, con las hermanas que ya tienen id', u?.searchParams.get('q') === 'Mega Darkrai ex' && u?.searchParams.get('cerca') === '851043' && /^Bearer/.test(busqueda.auth), busqueda?.url)
check('  …cada resultado con su «Ver ↗» y su «Usar»', (await p.locator('[data-cmb-usar]').count()) === 2 && (await p.locator('.cmb-fila a[href*="idProduct=903676"]').count()) === 1)
check('  …la de la misma expansión, marcada', (await p.locator('.cmb-misma').count()) === 1 && /misma expansión/.test(await p.locator('.cmb-misma').innerText()))
await p.locator('[data-cmb-usar="903676"]').click()
check('«Usar» pone el id en la caja (se guarda con Guardar)', (await p.locator('#cat_cm_id_product_propio').inputValue()) === '903676' && (await p.locator('.cmb-puesta').count()) === 1)
await p.locator('.cmb-q').fill('darkrai')
await p.locator('.cmb-form button').click()
await p.waitForTimeout(500)
check('se puede buscar otra cosa', pedidas.filter((x) => /cardmarket-buscar/.test(x.url)).length === 2)
await p.locator('.cmb').scrollIntoViewIfNeeded()
await p.screenshot({ path: '/tmp/1159-buscar.png' })
check('sin errores', errores.length === 0, errores.join(' | '))

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
