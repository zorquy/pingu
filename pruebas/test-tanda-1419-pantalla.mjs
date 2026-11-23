// Tanda 1419 — Tus colores con lo que sabe el servidor, y «Colores» en /admin.
//   · Las cartas que el servidor ya tiene (`tcg_card_colores`) salen con SU
//     color sin leer la foto: la 1-3 son fotos rojas, pero el servidor dice
//     verde (la foto grande manda), y salen verdes.
//   · Una corrección del equipo manda: la 4 (foto roja, sin huella en el
//     servidor) está corregida a «azul» y sale azul.
//   · Lo que el servidor no tiene se lee en el navegador, como antes (la 5).
//   · Sin la tabla (falla la consulta), todo se lee en el navegador.
//   · /admin: la pantalla de Colores de una expansión, sus desplegables y la
//     llamada a `admin_color_corregir`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const svg = () => '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c62828"/></svg>'
const N = 6
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: i + 1 === 6 ? 'Common' : 'Illustration Rare', category: 'Pokemon' }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-11-01T10:00:00Z' }))
const VERDE = [0.52, -0.11, 0.08]
const huellaVerde = { labs: [VERDE, VERDE, VERDE], pesos: [0.4, 0.3, 0.3], croma: 0.13, luz: 0.52, bordes: { izq: VERDE, der: VERDE, arr: VERDE, aba: VERDE }, colores: { color: 'verde', paleta: [{ f: 'verde', lab: VERDE, s: 1 }], luz: 0.52 } }
const FILAS = { tcg_card_colores: [1, 2, 3].map((n) => ({ card_id: `sv8-${n}`, market: 'WEST', huella: huellaVerde, color: 'verde', color_admin: null, intentos: 0 })).concat([{ card_id: 'sv8-4', market: 'WEST', huella: null, color: null, color_admin: 'azul', intentos: 0 }]) }

const browser = await chromium.launch()
async function abrir({ sinTabla = false, ruta = '/mi-coleccion.html?ver=colores' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, COLECCION, FILAS, sinTabla }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS; window.__FAKE_COLECCION__ = COLECCION; window.__FAKE_ALBUMES__ = []
    if (!sinTabla) window.__FAKE_FILAS__ = FILAS
    else window.__FAKE_FALLA__ = { tcg_card_colores: { code: '42P01', message: 'relation "public.tcg_card_colores" does not exist' } }
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('pd-armonia-v1') } catch {}
  }, { SETS, CARTAS, COLECCION, FILAS, sinTabla })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: svg() }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  return { ctx, page, errores }
}
const chips = (page) => page.evaluate(() => [...document.querySelectorAll('#mcPanelColores .vc-chips [data-color]')].map((b) => b.textContent.trim()).join('|'))

console.log('\n── Con lo del servidor ──')
{
  const { page, ctx, errores } = await abrir()
  await page.waitForSelector('#mcPanelColores .vc-hoja', { timeout: 20000 }).catch(() => {})
  const c = await chips(page)
  check('las 1-3 salen verdes (el servidor), la 4 azul (el equipo), la 5 roja (leída aquí)', c === 'Todos · 5|Rojo · 1|Verde · 3|Azul · 1', c)
  await page.click('#mcPanelColores [data-color="azul"]')
  const azul = await page.$$eval('#mcPanelColores .vc-pared a', (as) => as.map((a) => a.dataset.carta).join())
  check('la azul es la 4, corregida', azul === 'sv8-4', azul)
  await page.waitForTimeout(700)
  const cache = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('pd-armonia-v1') || '{}')).sort().join())
  check('las huellas del servidor quedan guardadas para «Sugerir»', ['sv8-1', 'sv8-2', 'sv8-3'].every((id) => cache.includes(id)), cache)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── Sin la tabla ──')
{
  const { page, ctx, errores } = await abrir({ sinTabla: true })
  await page.waitForSelector('#mcPanelColores .vc-hoja', { timeout: 20000 }).catch(() => {})
  const c = await chips(page)
  check('todo se lee de las fotos: las cinco rojas', c === 'Todos · 5|Rojo · 5', c)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── /admin → Colores de una expansión ──')
{
  const { page, ctx, errores } = await abrir({ ruta: '/mi-coleccion.html' })
  await page.waitForTimeout(800)
  const r = await page.evaluate(async (CARTAS) => {
    const caja = document.createElement('div'); caja.id = 'hojaPrueba'; document.body.append(caja)
    const hoja = { abrir: (html) => { caja.innerHTML = html } }
    const m = await import('/admin/js/colores-set.js')
    let volvio = false
    await m.abrirColoresDeSet({ set: { id: 'sv8', name: 'Chispas Fulgurantes' }, mercado: 'WEST', cartas: CARTAS, hoja, volver: () => { volvio = true } })
    const ver = () => [...caja.querySelectorAll('.colset-carta')].map((li) => `${li.dataset.carta}:${li.querySelector('select').selectedOptions[0].textContent}`)
    const antes = ver()
    const nota = caja.querySelector('.admin-note')?.textContent || ''
    const sel = caja.querySelector('[data-color-de="sv8-1"]')
    sel.value = 'rojo'; sel.dispatchEvent(new Event('change'))
    await new Promise((ok) => setTimeout(ok, 300))
    caja.querySelector('#colsetVolver').click()
    return { antes, nota, despues: ver(), rpc: (window.__RPCS__ || []).filter((x) => x.nombre === 'admin_color_corregir'), volvio, corregida: !!caja.querySelector('.colset-carta.colset-corregida[data-carta="sv8-1"]') }
  }, CARTAS)
  check('salen las 5 ilustraciones y no la común', r.antes.length === 5 && !r.antes.some((x) => x.startsWith('sv8-6')), r.antes.join(' | '))
  check('cada una dice su automático o su corrección', r.antes.includes('sv8-1:Auto · Verde') && r.antes.includes('sv8-4:Azul') && r.antes.includes('sv8-5:Sin calcular'), r.antes.join(' | '))
  check('la nota cuenta las calculadas y las corregidas', /5 ilustraciones · 3 con color calculado · 1 corregida a mano/.test(r.nota), r.nota)
  check('corregir llama a admin_color_corregir con la carta y el grupo', r.rpc.length === 1 && r.rpc[0].args.p_card === 'sv8-1' && r.rpc[0].args.p_color === 'rojo' && r.rpc[0].args.p_market === 'WEST', JSON.stringify(r.rpc))
  check('y vuelve a las cartas', r.volvio)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
