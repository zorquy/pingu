// Tanda 1166 — Cruces nunca vacío (C2 de «PokeDoc entera»): con algo
// apuntado y nadie enfrente, tus cuentas arriba (botones a su pestaña), una
// línea de por qué y salidas como botones de verdad; en los tres vacíos. Con
// cruces, la pantalla no cambia (1042).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const b = await chromium.launch()
const ahora = new Date().toISOString()
const linea = (id, card, cambio) => ({ id, user_id: 'admin-1', card_id: card, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 2, cambio, created_at: ahora, updated_at: ahora })
const deseo = (id, card) => ({ id, user_id: 'admin-1', card_id: card, market: 'WEST', idioma: null, prioridad: 1, created_at: ahora })
async function abrir({ coleccion = [], deseos = [], movil = false }) {
  const p = await b.newPage({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: movil, hasTouch: movil, colorScheme: 'dark', locale: 'es-ES' })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.addInitScript(([col, des]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu', display_name: 'Pingu' }]
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', tcg_online_code: 'SVI', card_count_official: 10 }]
    window.__FAKE_CARTAS__ = [...Array(6)].map((_, i) => ({ id: `sv1-${i + 1}`, set_id: 'sv1', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i + 1}`, market: 'WEST', rarity: 'Rare' }))
    window.__FAKE_COLECCION__ = col
    window.__FAKE_DESEOS__ = des
  }, [coleccion, deseos])
  await p.goto(`${BASE}/mi-coleccion.html?ver=cambios`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2800)
  return { p, errores }
}
const leer = (p) => p.evaluate(() => {
  const caja = document.getElementById('mcCambiosPanel')
  // Desde la 1216 las cuentas van en la banda (sus dos primeras cifras).
  const cuentas = [...caja.querySelectorAll('.banda-s-cifra')].slice(0, 2).map((x) => x.textContent.replace(/\s+/g, '').trim())
  const botones = [...caja.querySelectorAll('.mc-cruces-salidas button')].map((x) => ({ texto: x.textContent.trim(), clase: x.className, alto: Math.round(x.getBoundingClientRect().height) }))
  return { texto: caja.innerText.replace(/\s+/g, ' ').trim().slice(0, 600), cuentas, botones, cifraVieja: Boolean(caja.querySelector('.mc-quiero-cifra')), desborda: document.documentElement.scrollWidth > innerWidth }
})

console.log('── 1. Buscas y das, y nadie encaja ──')
{
  const { p, errores } = await abrir({ coleccion: [linea('m1', 'sv1-1', 2), linea('m2', 'sv1-3', 1)], deseos: [deseo('d1', 'sv1-2'), deseo('d2', 'sv1-4'), deseo('d3', 'sv1-5')] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await leer(p)
  check('arriba, «3 cartas buscas ›» y «2 cartas das ›», sin el «0 personas encajan»', r.cuentas.join('|') === '3cartasbuscas|2cartasdas' && !r.cifraVieja, JSON.stringify(r))
  check('la línea dice que nadie encaja todavía', /Todavía nadie encaja contigo/.test(r.texto), r.texto)
  check('y dos botones de verdad: Ir al Mercado (principal) y poner más cartas', r.botones.length === 2 && r.botones[0].texto === 'Ir al Mercado' && /btn-primary/.test(r.botones[0].clase) && /cartas para cambio/.test(r.botones[1].texto) && r.botones.every((x) => x.alto >= 44), JSON.stringify(r.botones))
  await p.click('#mcCambiosPanel .mc-cruces-salidas .btn-primary')
  await p.waitForTimeout(500)
  check('  …y «Ir al Mercado» abre el Mercado', await p.evaluate(() => document.querySelector('[data-deseos-vista="mercado"][aria-pressed="true"]') !== null && !document.getElementById('mcMercadoPanel')?.classList.contains('hidden')))
  await p.goBack().catch(() => {})
  await p.goto(`${BASE}/mi-coleccion.html?ver=cambios`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  await p.click('#mcCambiosPanel .banda-s [data-ir-quiero]')
  await p.waitForTimeout(500)
  check('  …y la cuenta de «buscas» lleva a La quiero', await p.evaluate(() => /ver=quiero/.test(location.search) || document.querySelector('[data-pestania="quiero"][aria-selected="true"]') !== null))
  await p.close()
}

console.log('── 2. Buscas pero no das nada ──')
{
  const { p } = await abrir({ coleccion: [linea('m1', 'sv1-1', 0)], deseos: [deseo('d1', 'sv1-2')] })
  const r = await leer(p)
  check('«1 carta buscas» y «0 cartas das»; la línea pide poner algo para cambio', r.cuentas.join('|') === '1cartabuscas|0cartasdas' && /Pon algo para cambio/.test(r.texto), JSON.stringify(r))
  check('el botón principal es «Poner cartas para cambio»', r.botones[0]?.texto === 'Poner cartas para cambio' && /btn-primary/.test(r.botones[0].clase), JSON.stringify(r.botones))
  await p.click('#mcCambiosPanel .mc-cruces-salidas .btn-primary')
  await p.waitForTimeout(500)
  check('  …que abre «Las que doy»', await p.evaluate(() => document.querySelector('[data-deseos-vista="doy"][aria-pressed="true"]') !== null))
  await p.close()
}

console.log('── 3. Das pero no buscas nada ──')
{
  const { p } = await abrir({ coleccion: [linea('m1', 'sv1-1', 2)], deseos: [] })
  const r = await leer(p)
  check('«0 cartas buscas» y «1 carta das»; la línea pide apuntar lo que buscas', r.cuentas.join('|') === '0cartasbuscas|1cartadas' && /Apunta lo que buscas/.test(r.texto), JSON.stringify(r))
  check('botones: Ir al Mercado y Ver La quiero', r.botones.map((x) => x.texto).join('|') === 'Ir al Mercado|Ver La quiero', JSON.stringify(r.botones))
  await p.close()
}

console.log('── 4. En el móvil cabe ──')
{
  const { p } = await abrir({ coleccion: [linea('m1', 'sv1-1', 2)], deseos: [deseo('d1', 'sv1-2')], movil: true })
  const r = await leer(p)
  check('las cuentas y los botones, sin desbordar', r.cuentas.length === 2 && r.botones.length === 2 && !r.desborda, JSON.stringify(r))
  await p.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
